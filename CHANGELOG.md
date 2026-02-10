# Changelog

## 0.1.0

Initial public release.

### Core Client
- `Agntor` client with config-object constructor (`apiKey`, `agentId`, `chain`)
- Five modules: `identity`, `verify`, `escrow`, `settle`, `reputation`
- Event system (`on` / `off`) for `escrow_created`, `escrow_settled`, `verification_changed`, etc.
- Configurable base URL, timeout, and retry policy
- Fail-fast validation on missing configuration

### Ticket System
- `TicketIssuer` for JWT-based audit ticket generation and validation

### Protection Utilities
- `guard` — prompt-injection detection with regex, heuristic, and LLM-based deep scan
- `redact` — PII and secret redaction with blockchain-specific patterns (EVM/Solana/BTC private keys, BIP-39 mnemonic seeds, keystore JSON, HD derivation paths)
- `guardTool` — policy-based tool allow/blocklist
- `wrapAgentTool` — high-level wrapper applying redact + guard + SSRF check to any tool function

### Settlement Guard
- `settlementGuard` — x402 payment request scam detection combining heuristic analysis (known-bad addresses, reputation thresholds, amount sanity) with optional LLM deep scan

### Guard Providers
- `createOpenAIGuardProvider` — battery-included OpenAI guard provider for deep scan
- `createAnthropicGuardProvider` — battery-included Anthropic guard provider for deep scan

### Provider Infrastructure
- Multi-provider LLM layer: OpenAI, Anthropic, Google Gemini, AWS Bedrock, Groq, Fireworks, OpenRouter, Vercel AI Gateway, and generic OpenAI-compatible endpoints
- `callProvider` / `parseModel` / `getProvider` for unified LLM access
- Automatic fallback with configurable timeout for cold-start resilience

### Network Security
- `validateUrl` — SSRF prevention with DNS resolution and private IP detection
- `isUrlString` — lightweight URL format check

### Transaction Simulator
- `TransactionSimulator` — dry-run on-chain transactions via `eth_call` and `eth_estimateGas`

### Structured Output Schemas
- Zod schemas: `GuardResponseSchema`, `SettlementDecisionSchema`, `SimulationResultSchema`
- `parseStructuredOutput` for safe JSON-to-schema parsing

### AP2 Protocol
- `getAP2Headers` / `parseAP2Headers` for Agentic Commerce header generation

### Other
- TypeScript-first with full type declarations and source maps
- ESM-only (Node.js >= 18)
