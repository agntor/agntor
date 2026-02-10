// Core client
export { Agntor } from './agntor.js';

// Ticket system
export { TicketIssuer } from './issuer.js';

// Protection utilities
export { guard, DEFAULT_INJECTION_PATTERNS } from './guard.js';
export { redact, DEFAULT_REDACTION_PATTERNS } from './redact.js';
export { guardTool } from './tool-guard.js';

// Network security (SSRF guard)
export { validateUrl, isUrlString } from './utils/network.js';

// Structured output schemas
export {
  GuardResponseSchema,
  SettlementDecisionSchema,
  SimulationResultSchema,
  parseStructuredOutput,
} from './schemas.js';

// Transaction simulator
export { TransactionSimulator } from './simulator.js';

// AP2 protocol helpers
export { getAP2Headers, parseAP2Headers, AP2_VERSION, AP2_EXTENSION_URI } from './ap2.js';

// Zod schemas (runtime values), error class, and inferred types
export { AuditLevel, AuditConstraints, AuditTicketPayload, AgntorError } from './types.js';

// Pure type exports
export type {
  AuditLevel as AuditLevelType,
  AuditConstraints as AuditConstraintsType,
  AuditTicketPayload as AuditTicketPayloadType,
  AgntorConfig,
  TicketGenerationOptions,
  ValidationResult,
  TicketIssuerConfig,
  X402PaymentProof,
  Policy,
  GuardResult,
  GuardOptions,
  GuardProvider,
  RedactResult,
  ToolGuardResult,
  AgentIdentity,
  VerificationStatus,
  AttestationParams,
  EscrowCreateParams,
  EscrowRecord,
  SettlementResult,
  ReputationScore,
  ReputationHistoryEntry,
  AgntorEvent,
  AgntorEventCallback,
} from './types.js';

export type {
  GuardResponse,
  SettlementDecision,
  SimulationResult,
} from './schemas.js';

export type {
  SimulatorConfig,
  SimulationParams,
} from './simulator.js';
