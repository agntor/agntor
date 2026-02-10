// Core client
export { Agntor } from './agntor.js';

// Ticket system
export { TicketIssuer } from './issuer.js';

// Protection utilities
export { guard, DEFAULT_INJECTION_PATTERNS } from './guard.js';
export { redact, DEFAULT_REDACTION_PATTERNS } from './redact.js';
export { guardTool, wrapAgentTool } from './tool-guard.js';

// Settlement guard (x402 scam detection)
export { settlementGuard } from './settlement-guard.js';

// Battery-included guard providers
export { createOpenAIGuardProvider } from './providers/guard-openai.js';
export { createAnthropicGuardProvider } from './providers/guard-anthropic.js';

// Provider infrastructure
export {
  callProvider,
  parseModel,
  getProvider,
  providers,
  DEFAULT_GUARD_MODEL,
} from './providers/index.js';

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
  ChatMessage,
  AnalysisResponse,
  MultimodalContentPart,
  ParsedModel,
  TransactionMeta,
  SettlementGuardResult,
} from './types.js';

export type {
  WrapAgentToolOptions,
} from './tool-guard.js';

export type {
  SettlementGuardOptions,
} from './settlement-guard.js';

export type {
  OpenAIGuardProviderOptions,
} from './providers/guard-openai.js';

export type {
  AnthropicGuardProviderOptions,
} from './providers/guard-anthropic.js';

export type {
  GuardResponse,
  SettlementDecision,
  SimulationResult,
} from './schemas.js';

export type {
  SimulatorConfig,
  SimulationParams,
} from './simulator.js';

export type {
  ProviderConfig,
  ResponseFormat,
  JsonSchema,
} from './providers/index.js';

export type {
  FallbackOptions,
} from './providers/index.js';
