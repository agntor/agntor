# @agntor/sdk

Trust and payment rail for AI agents — identity, verification, escrow, settlement, and reputation.

> **ESM-only.** This package ships as native ES modules and requires Node.js >= 18.

## Installation

```bash
npm install @agntor/sdk
```

## Quick Start

```typescript
import { Agntor } from "@agntor/sdk";

const agntor = new Agntor({
  apiKey: "agntor_live_xxx",
  agentId: "agent://my-agent",
  chain: "base",
});

// Check another agent's reputation
const rep = await agntor.reputation.get("agent://counterparty");
console.log(rep.successRate, rep.escrowVolume);

// Create an escrow
const escrow = await agntor.escrow.create({
  counterparty: "agent://worker",
  amount: 50,
  condition: "task_complete",
  timeout: 3600,
});
```

## Modules

```
Agntor
 ├─ identity   — register, resolve, me
 ├─ verify     — status, attest, badge
 ├─ escrow     — create, fund, status, cancel
 ├─ settle     — release, slash, resolve
 └─ reputation — get, history
```

### Identity

```typescript
await agntor.identity.register();
await agntor.identity.resolve("agent://other");
await agntor.identity.me();
```

### Verification

```typescript
await agntor.verify.status("agent://other");
await agntor.verify.attest({ capability: "can_execute_http_calls", proof: "signed_msg" });
await agntor.verify.badge();
```

### Escrow

```typescript
const escrow = await agntor.escrow.create({
  counterparty: "agent://worker",
  amount: 100,
  condition: "api_returns_200",
  timeout: 3600,
});
await agntor.escrow.fund(escrow.escrowId);
await agntor.escrow.status(escrow.escrowId);
await agntor.escrow.cancel(escrow.escrowId);
```

### Settlement

```typescript
await agntor.settle.release(escrowId);
await agntor.settle.slash(escrowId);
await agntor.settle.resolve(escrowId, proofPayload);
```

### Reputation

```typescript
const score = await agntor.reputation.get("agent://other");
// { successRate, escrowVolume, slashes, counterpartiesCount }

const history = await agntor.reputation.history("agent://other");
```

## Events

```typescript
agntor.on("escrow_created", (data) => console.log("New escrow:", data));
agntor.on("escrow_settled", (data) => console.log("Settled:", data));
agntor.on("verification_changed", (data) => console.log("Verification:", data));
```

## Configuration

| Option       | Default                   | Description                          |
|--------------|---------------------------|--------------------------------------|
| `apiKey`     | *required*                | Your Agntor API key                  |
| `agentId`    | *required*                | Your canonical agent URI             |
| `chain`      | *required*                | Target chain (e.g. `"base"`)         |
| `baseUrl`    | `https://api.agntor.com`  | API base URL (override for staging)  |
| `timeout`    | `30000`                   | Request timeout in ms                |
| `maxRetries` | `3`                       | Max retries on transient errors      |

## Protection Utilities

### Prompt-Injection Guard

Detects prompt injection attacks with a three-layer approach: fast regex patterns, heuristic analysis, and optional LLM-based deep scan.

```typescript
import { guard } from "@agntor/sdk";

// Fast regex + heuristic scan (no API key needed)
const result = await guard("user input", {
  injectionPatterns: [/ignore previous instructions/i],
});

if (result.classification === "block") {
  console.log("Blocked:", result.violation_types);
}
```

#### Deep Scan with Guard Providers

For semantic analysis, use a battery-included guard provider — just pass an API key:

```typescript
import { guard, createOpenAIGuardProvider } from "@agntor/sdk";

const provider = createOpenAIGuardProvider({ apiKey: "sk-..." });
// or: createAnthropicGuardProvider({ apiKey: "sk-ant-..." })

const result = await guard(userInput, policy, {
  deepScan: true,
  provider,
});
```

Available providers:

| Factory                          | Env Variable         | Default Model              |
|----------------------------------|----------------------|----------------------------|
| `createOpenAIGuardProvider()`    | `OPENAI_API_KEY`     | `gpt-4o-mini`              |
| `createAnthropicGuardProvider()` | `ANTHROPIC_API_KEY`  | `claude-3-5-haiku-latest`  |

### PII & Secret Redaction

Strips sensitive data from text before it leaves your system. Includes blockchain-specific patterns out of the box.

```typescript
import { redact } from "@agntor/sdk";

const { redacted, findings } = redact(
  "My key is 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  {},
);
// redacted: "My key is [PRIVATE_KEY]"
```

**Default patterns include:**

| Category             | Examples                                          |
|----------------------|---------------------------------------------------|
| PII                  | Email, phone, SSN, credit card, street address    |
| Cloud secrets        | AWS access keys, Bearer tokens, API key/secrets   |
| Blockchain keys      | EVM private keys, Solana keys, BTC WIF keys       |
| Wallet recovery      | BIP-39 mnemonic seeds (12- and 24-word)           |
| Key storage          | Keystore JSON ciphertext, HD derivation paths     |

### Tool Guard

Policy-based allow/blocklist for tool invocations:

```typescript
import { guardTool } from "@agntor/sdk";

const check = guardTool("shell.exec", undefined, {
  toolBlocklist: ["shell.exec"],
});
// check.allowed === false
```

### wrapAgentTool

High-level wrapper that automatically applies **redact + guard + SSRF check** to any tool function:

```typescript
import { wrapAgentTool } from "@agntor/sdk";

const safeFetch = wrapAgentTool(myFetchTool, {
  policy: { toolBlocklist: ["dangerous_tool"] },
});

// Inputs are redacted, guard-checked, and SSRF-validated before execution
const result = await safeFetch("https://api.example.com/data");
```

## Settlement Guard (x402)

Evaluates whether a payment request is legitimate or likely a scam. Combines fast heuristic checks with an optional LLM deep scan.

```typescript
import { settlementGuard, createOpenAIGuardProvider } from "@agntor/sdk";

const result = await settlementGuard(
  {
    amount: "50",
    currency: "USDC",
    recipientAddress: "0xabc...",
    serviceDescription: "Data Analysis",
    reputationScore: 0.4,
  },
  {
    deepScan: true,
    provider: createOpenAIGuardProvider({ apiKey: "sk-..." }),
  },
);

if (result.classification === "block") {
  console.warn(`High-risk (${result.riskScore}):`, result.reasoning);
  console.warn("Risk factors:", result.riskFactors);
}
```

**Heuristic checks (always run):**
- Known-bad / sanctioned addresses
- Low counterparty reputation score
- High-value transaction threshold
- Vague or missing service descriptions
- Zero-address detection

## Transaction Simulator

Dry-run an on-chain transaction via `eth_call` before signing:

```typescript
import { TransactionSimulator } from "@agntor/sdk";

const sim = new TransactionSimulator({
  rpcUrl: "https://mainnet.base.org",
  maxGas: 500_000,
});

const result = await sim.simulate({
  from: "0xSender...",
  to: "0xContract...",
  data: "0xCalldata...",
  value: "0x0",
});

if (!result.safe) {
  console.warn("Simulation failed:", result.error ?? result.warnings);
}
```

## SSRF Protection

Validates URLs against private/internal IP ranges with DNS resolution:

```typescript
import { validateUrl } from "@agntor/sdk";

try {
  await validateUrl("https://api.example.com/resource");
  // Safe to fetch
} catch (err) {
  // URL targets localhost, private IP, or uses blocked protocol
}
```

## AP2 Protocol Helpers

Generate and parse [AP2 (Agentic Commerce)](https://github.com/anthropics/anthropic-cookbook) headers:

```typescript
import { getAP2Headers, parseAP2Headers } from "@agntor/sdk";

const headers = getAP2Headers({
  agentId: "agent://my-agent",
  roles: ["buyer"],
  supportedMethods: ["x402"],
});
```

## Structured Output Schemas

Zod schemas for validating LLM responses:

```typescript
import { parseStructuredOutput, GuardResponseSchema } from "@agntor/sdk";

const parsed = parseStructuredOutput(llmRawOutput, GuardResponseSchema);
// { classification: "pass" | "block", reasoning: string }
```

## Ticket System

For low-level audit ticket operations:

```typescript
import { TicketIssuer } from "@agntor/sdk";

const issuer = new TicketIssuer({
  signingKey: process.env.AGNTOR_SECRET_KEY!,
  issuer: "agntor.com",
  algorithm: "HS256",
  defaultValidity: 300,
});

const ticket = issuer.generateTicket({
  agentId: "agent-123",
  auditLevel: "Gold",
  constraints: {
    max_op_value: 50,
    allowed_mcp_servers: ["finance-node"],
    kill_switch_active: false,
  },
});

const result = await issuer.validateTicket(ticket);
```

## License

MIT — see [LICENSE](./LICENSE)
