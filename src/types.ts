import { z } from 'zod';

// ---------------------------------------------------------------------------
// Provider types (used by the LLM provider layer in ./providers/)
// ---------------------------------------------------------------------------

/**
 * A single part of a multimodal message (text or image).
 */
export type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/**
 * A chat message in the unified Agntor format.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MultimodalContentPart[];
}

/**
 * Unified response shape returned by every LLM provider adapter.
 */
export interface AnalysisResponse {
  id: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

/**
 * Result of parsing a "provider/model" string.
 */
export interface ParsedModel {
  provider: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Settlement Guard types (x402 scam detection)
// ---------------------------------------------------------------------------

/**
 * Metadata describing a payment request received during an x402 flow.
 */
export interface TransactionMeta {
  /** Amount in human-readable units (e.g. "50 USDC") */
  amount: string;
  /** Token / currency symbol */
  currency: string;
  /** Recipient contract or wallet address */
  recipientAddress: string;
  /** Human-readable description of the service being paid for */
  serviceDescription: string;
  /** Reputation score of the counterparty (0–1) */
  reputationScore?: number;
  /** On-chain ID of the chain (e.g. 1, 137, 8453) */
  chainId?: number;
  /** Any extra context the caller wants the LLM to consider */
  additionalContext?: string;
}

/**
 * Result of the settlement guard analysis.
 */
export interface SettlementGuardResult {
  /** Overall risk classification */
  classification: 'pass' | 'block';
  /** LLM reasoning or rule explanation */
  reasoning: string;
  /** Numeric risk score 0–1 (0 = safe, 1 = certain scam) */
  riskScore: number;
  /** Individual risk signals that contributed to the decision */
  riskFactors: string[];
}

// ---------------------------------------------------------------------------
// Agntor SDK Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the Agntor SDK client.
 */
export interface AgntorConfig {
  /** Your Agntor API key (e.g. "agntor_live_xxx") */
  apiKey: string;

  /** The canonical agent URI (e.g. "agent://my-agent") */
  agentId: string;

  /** Target chain for on-chain operations */
  chain: string;

  /** API base URL – defaults to production */
  baseUrl?: string;

  /** Request timeout in milliseconds (default: 30 000) */
  timeout?: number;

  /** Maximum automatic retries on transient errors (default: 3) */
  maxRetries?: number;
}

// ---------------------------------------------------------------------------
// Audit levels & constraints (ticket system)
// ---------------------------------------------------------------------------

export const AuditLevel = z.enum(['Bronze', 'Silver', 'Gold', 'Platinum']);
export type AuditLevel = z.infer<typeof AuditLevel>;

export const AuditConstraints = z.object({
  max_op_value: z.number().positive(),
  allowed_mcp_servers: z.array(z.string()),
  kill_switch_active: z.boolean(),
  max_ops_per_hour: z.number().positive().optional(),
  geo_restrictions: z.array(z.string()).optional(),
  requires_x402_payment: z.boolean().optional(),
});
export type AuditConstraints = z.infer<typeof AuditConstraints>;

export interface X402PaymentProof {
  fromAddress?: string;
  toAddress?: string;
  chainId?: string;
  txHash?: string;
}

export const AuditTicketPayload = z.object({
  iss: z.string(),
  sub: z.string(),
  iat: z.number(),
  exp: z.number(),
  audit_level: AuditLevel,
  constraints: AuditConstraints,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AuditTicketPayload = z.infer<typeof AuditTicketPayload>;

export interface TicketGenerationOptions {
  agentId: string;
  auditLevel: AuditLevel;
  constraints: AuditConstraints;
  validityDuration?: number;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  payload?: AuditTicketPayload;
  error?: string;
  errorCode?: 'EXPIRED' | 'INVALID_SIGNATURE' | 'INVALID_FORMAT' | 'KILL_SWITCH' | 'CONSTRAINT_VIOLATION';
}

export interface TicketIssuerConfig {
  signingKey: string;
  publicKey?: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  issuer: string;
  defaultValidity?: number;
}

// ---------------------------------------------------------------------------
// Guard / Redact / Tool policies
// ---------------------------------------------------------------------------

export interface Policy {
  injectionPatterns?: Array<RegExp | string>;
  redactionPatterns?: Array<{ type: string; pattern: RegExp | string; replacement?: string }>;
  toolBlocklist?: string[];
  toolAllowlist?: string[];
  cweMap?: Record<string, string>;
  toolValidator?: (tool: string, args?: unknown) => boolean | string;
}

/**
 * Provider used for LLM-based "deep scan" guarding.
 *
 * Implement this interface to plug in any model (GPT-4o, Claude, etc.)
 * as a semantic guard for prompt-injection detection.
 */
export interface GuardProvider {
  /**
   * Classify the given input as safe or unsafe.
   *
   * The implementation must return valid JSON matching `GuardResponseSchema`
   * from `schemas.ts` (i.e. `{ classification, reasoning }`).
   */
  classify(input: string): Promise<{ classification: 'pass' | 'block'; reasoning: string }>;
}

export interface GuardOptions {
  /**
   * When `true`, falls back to an LLM-based semantic scan
   * after the fast regex pass, using the provided `provider`.
   */
  deepScan?: boolean;

  /**
   * LLM provider used for deep-scan mode.
   * Required when `deepScan` is `true`.
   */
  provider?: GuardProvider;
}

export interface GuardResult {
  classification: 'pass' | 'block';
  violation_types: string[];
  cwe_codes: string[];
  reasoning?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface RedactResult {
  redacted: string;
  findings: Array<{ type: string; span: [number, number]; value?: string }>;
}

export interface ToolGuardResult {
  allowed: boolean;
  violations?: string[];
  reason?: string;
}

// ---------------------------------------------------------------------------
// Identity module types
// ---------------------------------------------------------------------------

export interface AgentIdentity {
  agentId: string;
  name?: string;
  organization?: string;
  chain?: string;
  wallet?: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Verification module types
// ---------------------------------------------------------------------------

export interface VerificationStatus {
  agentId: string;
  verified: boolean;
  auditLevel?: string;
  capabilities?: string[];
  badge?: string;
}

export interface AttestationParams {
  capability: string;
  proof: string;
}

// ---------------------------------------------------------------------------
// Escrow module types
// ---------------------------------------------------------------------------

export interface EscrowCreateParams {
  counterparty: string;
  amount: number;
  condition: string;
  timeout: number;
}

export interface EscrowRecord {
  escrowId: string;
  status: string;
  amount: number;
  counterparty: string;
  condition: string;
  timeout: number;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Settlement module types
// ---------------------------------------------------------------------------

export interface SettlementResult {
  escrowId: string;
  outcome: string;
  proof?: string;
  settledAt?: string;
}

// ---------------------------------------------------------------------------
// Reputation module types
// ---------------------------------------------------------------------------

export interface ReputationScore {
  agentId: string;
  successRate: number;
  escrowVolume: number;
  slashes: number;
  counterpartiesCount: number;
}

export interface ReputationHistoryEntry {
  timestamp: string;
  event: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type AgntorEvent =
  | 'escrow_created'
  | 'escrow_funded'
  | 'escrow_settled'
  | 'escrow_cancelled'
  | 'verification_changed'
  | 'reputation_updated';

export type AgntorEventCallback = (data: unknown) => void;

// ---------------------------------------------------------------------------
// SDK Error
// ---------------------------------------------------------------------------

export class AgntorError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = 'AgntorError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
