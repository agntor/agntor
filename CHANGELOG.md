# Changelog

## 0.1.0

Initial public release.

- `Agntor` client with config-object constructor (`apiKey`, `agentId`, `chain`)
- Five modules: `identity`, `verify`, `escrow`, `settle`, `reputation`
- Event system (`on` / `off`) for `escrow_created`, `escrow_settled`, `verification_changed`, etc.
- Configurable base URL, timeout, and retry policy
- Fail-fast validation on missing configuration
- `TicketIssuer` for JWT-based audit ticket generation and validation
- `guard` / `redact` / `guardTool` protection utilities
- AP2 protocol header helpers
- TypeScript-first with full type declarations
