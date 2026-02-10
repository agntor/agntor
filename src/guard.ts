import type { GuardResult, GuardOptions, Policy } from './types.js';
import { GuardResponseSchema } from './schemas.js';

/**
 * Default injection patterns to catch common prompt injection attacks
 */
export const DEFAULT_INJECTION_PATTERNS = [
  /\bignore\s+all\s+previous\s+instructions\b/i,
  /\bdisregard\s+all\s+previous\s+instructions\b/i,
  /\byou\s+are\s+now\s+in\s+developer\s+mode\b/i,
  /\bnew\s+system\s+prompt\b/i,
  /\boverride\s+system\s+settings\b/i,
  /\[system\s+override\]/i,
  /\bforget\s+everything\s+you\s+know\b/i,
  /\bdo\s+not\s+mention\s+the\s+instructions\b/i,
  /\bshow\s+me\s+your\s+system\s+prompt\b/i,
  /\brepeat\s+the\s+instructions\s+verbatim\b/i,
  /\boutput\s+the\s+full\s+prompt\b/i,
];

export async function guard(
  input: string,
  policy: Policy,
  options?: GuardOptions,
): Promise<GuardResult> {
  const violations: string[] = [];
  
  // 1. Pattern Matching (Fast)
  const patterns = [...DEFAULT_INJECTION_PATTERNS, ...(policy.injectionPatterns ?? [])];
  
  patterns.forEach((pattern) => {
    const rx = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    if (rx.test(input)) {
      violations.push('prompt-injection');
    }
  });

  // 2. Heuristic Checks (Fast)
  // Check for suspicious character patterns or excessive use of delimiters
  if ((input.match(/\[|\]|\{|\}/g) || []).length > 20) {
    violations.push('potential-obfuscation');
  }

  // 3. Deep Scan — LLM-based semantic guard (optional)
  let reasoning: string | undefined;

  if (options?.deepScan && options.provider) {
    try {
      const llmResult = await options.provider.classify(input);
      const parsed = GuardResponseSchema.parse(llmResult);
      reasoning = parsed.reasoning;

      if (parsed.classification === 'block') {
        violations.push('llm-flagged-injection');
      }
    } catch {
      // Intentionally fail-open: if the LLM provider is unavailable or
      // misconfigured, the fast regex/heuristic path still protects the
      // input. Callers should monitor their provider separately.
    }
  }

  const classification = violations.length ? 'block' : 'pass';

  const cwe_codes = violations
    .map((v) => policy.cweMap?.[v])
    .filter(Boolean) as string[];

  // Token usage estimation (rough)
  const tokens = Math.ceil(input.length / 4);
  const usage = { promptTokens: tokens, completionTokens: 0, totalTokens: tokens };

  return { 
    classification, 
    violation_types: [...new Set(violations)], 
    cwe_codes: [...new Set(cwe_codes)],
    reasoning,
    usage,
  };
}
