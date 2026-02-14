# Contributing to @agntor/sdk

Thank you for your interest in contributing to the Agntor SDK!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/agntor-protocol/sdk.git
cd sdk

# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test
```

## Testing Your Changes

The SDK uses Node's built-in test runner. After making changes:

```bash
# 1. Run the test suite
npm test

# 2. Build your changes
npm run build

# 3. Type-check
npx tsc --noEmit
```

## Code Style

- Use TypeScript strict mode
- Export all public types from `src/types.ts`
- Follow existing naming conventions
- Use `unknown` instead of `any` for untyped values

## Runtime Dependencies

The SDK has three runtime dependencies — keep this minimal:
- `zod` — runtime schema validation for structured LLM output
- `jsonwebtoken` — JWT audit ticket generation/validation
- `ipaddr.js` — SSRF prevention (private IP detection)

Do not add new runtime dependencies without discussion.

## What We're Looking For

- **Performance optimizations**: The SDK must validate tickets in <5ms
- **New algorithms**: Support for ES256, RS512, etc.
- **Better error messages**: Make debugging easier for developers
- **Documentation improvements**: Real-world usage examples
- **Test coverage**: Tests for all exported functions

## Pull Request Guidelines

1. Ensure all types are exported in `src/index.ts`
2. Update the README.md if you add new methods
3. Add tests for new functionality
4. Keep changes focused and atomic
5. Add inline comments for complex crypto operations

## Architecture Notes

The SDK is the **core primitive** of Agntor:

```
src/
  agntor.ts          — Main client (identity, verify, escrow, settle, reputation)
  issuer.ts          — JWT audit ticket generation and validation
  guard.ts           — Prompt injection detection (regex + heuristic + LLM deep scan)
  redact.ts          — PII/secret redaction engine
  tool-guard.ts      — Policy-based tool allow/blocklist + wrapAgentTool
  settlement-guard.ts — x402 payment scam detection
  simulator.ts       — On-chain transaction dry-run via eth_call
  ap2.ts             — AP2 (Agentic Commerce) protocol header helpers
  schemas.ts         — Zod schemas for structured LLM output parsing
  types.ts           — All TypeScript types and Zod runtime schemas
  utils/network.ts   — SSRF prevention (URL validation, private IP detection)
  providers/         — LLM provider abstraction layer (OpenAI, Anthropic, Google, etc.)
```

## Questions?

Open an issue or reach out at https://github.com/agntor/agntor/issues
