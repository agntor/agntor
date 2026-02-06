# @agntor/sdk

Trust and payment rail for AI agents — identity, verification, escrow, settlement, and reputation.

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

| Option | Default | Description |
|------------|---------------------------|--------------------------------------|
| `apiKey` | *required* | Your Agntor API key |
| `agentId` | *required* | Your canonical agent URI |
| `chain` | *required* | Target chain (e.g. `"base"`) |
| `baseUrl` | `https://api.agntor.com` | API base URL (override for staging) |
| `timeout` | `30000` | Request timeout in ms |
| `maxRetries`| `3` | Max retries on transient errors |

## Ticket System (Advanced)

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

## Protection Utilities

```typescript
import { guard, redact, guardTool } from "@agntor/sdk";

const guardResult = await guard("user input", {
  injectionPatterns: [/ignore previous instructions/i],
});

const redaction = redact("ssn 123-45-6789", {});

const toolCheck = guardTool("shell.exec", undefined, {
  toolBlocklist: ["shell.exec"],
});
```

## License

MIT — see [LICENSE](./LICENSE)
