import { z } from 'zod';

/**
 * Audit levels that determine the trust tier of an agent
 */
export const AuditLevel = z.enum(['Bronze', 'Silver', 'Gold', 'Platinum']);
export type AuditLevel = z.infer<typeof AuditLevel>;

/**
 * Constraints enforced on agent operations
 */
export const AuditConstraints = z.object({
  /** Maximum dollar value for a single operation */
  max_op_value: z.number().positive(),
  
  /** Allowed MCP servers this agent can interact with */
  allowed_mcp_servers: z.array(z.string()),
  
  /** Whether the kill switch is currently active */
  kill_switch_active: z.boolean(),
  
  /** Maximum number of operations per hour (optional) */
  max_ops_per_hour: z.number().positive().optional(),
  
  /** Geographic restrictions (optional) */
  geo_restrictions: z.array(z.string()).optional(),

  /** Require x402 payment proof for transactions */
  requires_x402_payment: z.boolean().optional(),
});
export type AuditConstraints = z.infer<typeof AuditConstraints>;

/**
 * x402 proof of payment payload (minimal)
 */
export interface X402PaymentProof {
  fromAddress?: string;
  toAddress?: string;
  chainId?: string;
  txHash?: string;
}

/**
 * The complete audit ticket payload
 */
export const AuditTicketPayload = z.object({
  /** Issuer (Agntor authority) */
  iss: z.string(),
  
  /** Subject (Agent ID) */
  sub: z.string(),
  
  /** Issued at (Unix timestamp in seconds) */
  iat: z.number(),
  
  /** Expiry (Unix timestamp in seconds) */
  exp: z.number(),
  
  /** Audit certification level */
  audit_level: AuditLevel,
  
  /** Operational constraints */
  constraints: AuditConstraints,
  
  /** Optional metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AuditTicketPayload = z.infer<typeof AuditTicketPayload>;

/**
 * Options for generating audit tickets
 */
export interface TicketGenerationOptions {
  /** Agent ID to issue ticket for */
  agentId: string;
  
  /** Audit level to grant */
  auditLevel: AuditLevel;
  
  /** Operational constraints */
  constraints: AuditConstraints;
  
  /** Ticket validity duration in seconds (default: 300 = 5 minutes) */
  validityDuration?: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of ticket validation
 */
export interface ValidationResult {
  /** Whether the ticket is valid */
  valid: boolean;
  
  /** Decoded payload if valid */
  payload?: AuditTicketPayload;
  
  /** Error message if invalid */
  error?: string;
  
  /** Error code for programmatic handling */
  errorCode?: 'EXPIRED' | 'INVALID_SIGNATURE' | 'INVALID_FORMAT' | 'KILL_SWITCH' | 'CONSTRAINT_VIOLATION';
}

/**
 * Configuration for the ticket issuer
 */
export interface TicketIssuerConfig {
  /** Secret key for signing tickets (HMAC) or private key (RSA) */
  signingKey: string;
  
  /** Public key for verification (only needed for RSA) */
  publicKey?: string;
  
  /** Signing algorithm (default: HS256) */
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  
  /** Issuer identifier (your Agntor authority domain) */
  issuer: string;
  
  /** Default ticket validity in seconds (default: 300) */
  defaultValidity?: number;
}

/**
 * Guard/Redact/Tool policies
 */
export interface Policy {
  injectionPatterns?: Array<RegExp | string>;
  redactionPatterns?: Array<{ type: string; pattern: RegExp | string; replacement?: string }>;
  toolBlocklist?: string[];
  toolAllowlist?: string[];
  cweMap?: Record<string, string>;
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
