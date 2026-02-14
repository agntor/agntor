import type {
  GuardProvider,
  TransactionMeta,
  SettlementGuardResult,
} from './types.js';
import { SettlementDecisionSchema } from './schemas.js';

// ---------------------------------------------------------------------------
// Heuristic rules (no LLM needed)
// ---------------------------------------------------------------------------

/** Known scam / sanctioned contract addresses (lowercase). Extend as needed. */
const KNOWN_BAD_ADDRESSES = new Set<string>([
  // Placeholder — in production, this would be fetched from an on-chain
  // oracle or maintained by the Agntor backend.
]);

/** Thresholds for heuristic risk scoring */
const HEURISTIC_THRESHOLDS = {
  /** Reputation score below this is considered high-risk */
  lowReputation: 0.3,
  /** Amount (in USD-equivalent) above which extra scrutiny applies */
  highValueUsd: 500,
} as const;

/**
 * Build the system prompt sent to the LLM for settlement analysis.
 */
function buildSettlementPrompt(meta: TransactionMeta): string {
  const parts = [
    `You are Agntor's Settlement Guard, a financial security analyst specializing in blockchain transaction risk assessment.`,
    ``,
    `Analyze the following payment request and determine if it is likely a scam, overpriced, or otherwise high-risk.`,
    ``,
    `## Transaction Details`,
    `- **Amount:** ${meta.amount} ${meta.currency}`,
    `- **Recipient address:** ${meta.recipientAddress}`,
    `- **Service description:** "${meta.serviceDescription}"`,
  ];

  if (meta.reputationScore !== undefined) {
    parts.push(`- **Counterparty reputation score:** ${meta.reputationScore} (0 = no history, 1 = perfect)`);
  }
  if (meta.chainId !== undefined) {
    parts.push(`- **Chain ID:** ${meta.chainId}`);
  }
  if (meta.additionalContext) {
    parts.push(`- **Additional context:** ${meta.additionalContext}`);
  }

  parts.push(
    ``,
    `## Risk Indicators to Consider`,
    `1. Is the amount reasonable for the described service?`,
    `2. Is the reputation score suspiciously low?`,
    `3. Does the contract address appear on known scam lists?`,
    `4. Does the service description seem vague, misleading, or designed to extract funds?`,
    `5. Are there signs of a honeypot, rug pull, or social engineering?`,
    ``,
    `Respond with ONLY valid JSON matching this schema:`,
    `{`,
    `  "classification": "pass" | "block",`,
    `  "reasoning": "<detailed explanation of your risk assessment>"`,
    `}`,
    ``,
    `- "block" if the transaction appears high-risk, overpriced, or likely a scam.`,
    `- "pass" if the transaction appears legitimate and reasonably priced.`,
    ``,
    `Be conservative — protecting funds is more important than convenience.`,
  );

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Heuristic-only analysis (no LLM)
// ---------------------------------------------------------------------------

function heuristicAnalysis(meta: TransactionMeta): {
  riskScore: number;
  riskFactors: string[];
} {
  const factors: string[] = [];
  let score = 0;

  // 1. Known bad address
  if (KNOWN_BAD_ADDRESSES.has(meta.recipientAddress.toLowerCase())) {
    factors.push('Recipient address is on the known-bad list');
    score += 0.5;
  }

  // 2. Low reputation
  if (meta.reputationScore !== undefined && meta.reputationScore < HEURISTIC_THRESHOLDS.lowReputation) {
    factors.push(`Counterparty reputation score (${meta.reputationScore}) is below threshold (${HEURISTIC_THRESHOLDS.lowReputation})`);
    score += 0.3;
  }

  // 3. High-value transaction
  const numericAmount = parseFloat(meta.amount.replace(/[^0-9.]/g, ''));
  if (!Number.isNaN(numericAmount) && numericAmount > HEURISTIC_THRESHOLDS.highValueUsd) {
    factors.push(`Transaction amount ($${numericAmount}) exceeds high-value threshold ($${HEURISTIC_THRESHOLDS.highValueUsd})`);
    score += 0.15;
  }

  // 4. Vague service description
  if (meta.serviceDescription.trim().length < 10) {
    factors.push('Service description is suspiciously short or vague');
    score += 0.1;
  }

  // 5. Zero-address or null-like recipient
  if (/^0x0{40}$/i.test(meta.recipientAddress)) {
    factors.push('Recipient is the zero address');
    score += 0.5;
  }

  return { riskScore: Math.min(score, 1), riskFactors: factors };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Options for the settlement guard.
 */
export interface SettlementGuardOptions {
  /**
   * When `true`, sends the transaction metadata to an LLM for semantic
   * analysis in addition to the fast heuristic checks.
   */
  deepScan?: boolean;

  /**
   * LLM provider used for deep-scan mode (same interface as the prompt
   * injection guard). Required when `deepScan` is `true`.
   */
  provider?: GuardProvider;

  /**
   * Optional error callback invoked when the LLM provider fails.
   * By default, provider failures are fail-open (silently ignored).
   * Use this to log or monitor provider issues.
   */
  onError?: (error: Error) => void;
}

/**
 * Settlement Guard — evaluates whether an x402 payment request is
 * legitimate or likely a scam.
 *
 * Combines fast heuristic checks (known-bad addresses, reputation
 * thresholds, amount sanity) with an optional LLM-based deep scan.
 *
 * @example
 * ```ts
 * import { settlementGuard, createOpenAIGuardProvider } from '@agntor/sdk';
 *
 * const result = await settlementGuard(
 *   {
 *     amount: '50',
 *     currency: 'USDC',
 *     recipientAddress: '0xabc...',
 *     serviceDescription: 'Data Analysis',
 *     reputationScore: 0.4,
 *   },
 *   { deepScan: true, provider: createOpenAIGuardProvider({ apiKey }) },
 * );
 *
 * if (result.classification === 'block') {
 *   console.warn('High-risk transaction:', result.reasoning);
 * }
 * ```
 */
export async function settlementGuard(
  meta: TransactionMeta,
  options?: SettlementGuardOptions,
): Promise<SettlementGuardResult> {
  // ----- Heuristic pass (always runs) -----
  const { riskScore: heuristicScore, riskFactors } = heuristicAnalysis(meta);

  // Fast-path block if heuristics alone are conclusive
  if (heuristicScore >= 0.7) {
    return {
      classification: 'block',
      reasoning: `Blocked by heuristic analysis: ${riskFactors.join('; ')}`,
      riskScore: heuristicScore,
      riskFactors,
    };
  }

  // ----- Optional LLM deep scan -----
  if (options?.deepScan && options.provider) {
    try {
      const systemPrompt = buildSettlementPrompt(meta);
      // Re-use the GuardProvider interface: we feed the full prompt as the
      // "input" and expect { classification, reasoning } back.
      const llmResult = await options.provider.classify(systemPrompt);
      const parsed = SettlementDecisionSchema.parse(llmResult);

      if (parsed.classification === 'block') {
        riskFactors.push('LLM flagged as high-risk');
      }

      const combined = parsed.classification === 'block'
        ? Math.min(heuristicScore + 0.4, 1)
        : heuristicScore;

      return {
        classification: combined >= 0.5 ? 'block' : 'pass',
        reasoning: parsed.reasoning,
        riskScore: combined,
        riskFactors,
      };
    } catch (err) {
      // Fail-open for LLM errors — heuristics still protect the user.
      const error = err instanceof Error ? err : new Error(String(err));
      options.onError?.(error);
    }
  }

  return {
    classification: heuristicScore >= 0.5 ? 'block' : 'pass',
    reasoning:
      riskFactors.length > 0
        ? `Heuristic analysis: ${riskFactors.join('; ')}`
        : 'No risk signals detected.',
    riskScore: heuristicScore,
    riskFactors,
  };
}
