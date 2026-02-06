import { z } from 'zod';

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

export interface GuardResult {
  classification: 'pass' | 'block';
  violation_types: string[];
  cwe_codes: string[];
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
