# @agntor/sdk

JWT-based audit ticket generation and validation for Agntor trust verification.

## Installation

```bash
npm install @agntor/sdk
```

## Quick Start

```typescript
import { TicketIssuer } from '@agntor/sdk';

// Initialize issuer with your secret
const issuer = new TicketIssuer({
  signingKey: process.env.AGNTOR_SECRET_KEY!,
  issuer: 'agntor.com',
  algorithm: 'HS256',
  defaultValidity: 300, // 5 minutes
});

// Generate ticket for an agent
const ticket = issuer.generateTicket({
  agentId: 'agent-12345',
  auditLevel: 'Gold',
  constraints: {
    max_op_value: 50.0,
    allowed_mcp_servers: ['finance-node', 'legal-node'],
    kill_switch_active: false,
    requires_x402_payment: true,
  },
});

// Validate ticket (async)
const result = await issuer.validateTicket(ticket);
if (result.valid) {
  console.log('Agent certified:', result.payload?.audit_level);
}

// Validate with transaction constraints
const txResult = await issuer.validateTransaction(ticket, 25.0, 'finance-node', {
  protocol: 'x402',
  x402Proof: { txHash: '0xabc123', chainId: '1' },
});
if (!txResult.valid) {
  console.error('Transaction blocked:', txResult.error);
}
```

## API Reference

## Protections

```typescript
import { guard, redact, guardTool } from '@agntor/sdk';

const policy = {
  injectionPatterns: [/ignore previous instructions/i],
  redactionPatterns: [{ type: 'pii', pattern: /\b\d{3}-\d{2}-\d{4}\b/g }],
  toolBlocklist: ['shell.exec'],
};

const guardResult = await guard('input text', policy);
const redaction = redact('ssn 123-45-6789', policy);
const toolDecision = guardTool('shell.exec', policy);
```

### `TicketIssuer`

#### Constructor

```typescript
new TicketIssuer(config: TicketIssuerConfig)
```

**Config Options:**
- `signingKey`: Secret key for HMAC or private key for RSA
- `issuer`: Your Agntor authority identifier
- `algorithm`: JWT algorithm (default: 'HS256')
- `defaultValidity`: Default ticket lifetime in seconds (default: 300)
- `publicKey`: Public key for RSA verification (optional)

#### Methods

**`generateTicket(options: TicketGenerationOptions): string`**

Generates a signed JWT ticket.

**`validateTicket(token: string): Promise<ValidationResult>`**

Validates ticket signature, expiry, and kill switch status.

**`validateTicketSync(token: string): ValidationResult`**

Synchronous validation for performance-critical paths.

**`validateTransaction(token: string, value: number, server?: string, paymentContext?: { protocol?: string; x402Proof?: X402PaymentProof }): Promise<ValidationResult>`**

Validates ticket AND enforces transaction constraints.

**`decodeTicket(token: string): AuditTicketPayload | null`**

Decodes ticket without validation (debugging only).

## Ticket Structure

```typescript
{
  iss: "agntor.com",       // Issuer
  sub: "agent-id-12345",            // Agent ID
  iat: 1734567890,                  // Issued at (Unix)
  exp: 1734568190,                  // Expires at (Unix)
  audit_level: "Gold",              // Trust tier
  constraints: {
    max_op_value: 50.00,            // Max transaction value
    allowed_mcp_servers: [...],     // Whitelist
    kill_switch_active: false,      // Emergency cutoff
    max_ops_per_hour: 100,          // Rate limit (optional)
    geo_restrictions: ["US", "EU"]  // Regions (optional)
  },
  metadata: { ... }                 // Custom data
}
```

## Audit Levels

- **Bronze**: Basic verification ($0-$10 transactions)
- **Silver**: Standard compliance ($10-$50)
- **Gold**: Enhanced audit ($50-$500)
- **Platinum**: Enterprise-grade ($500+)

## Error Codes

- `EXPIRED`: Ticket past expiry time
- `INVALID_SIGNATURE`: Cryptographic verification failed
- `INVALID_FORMAT`: Malformed token
- `KILL_SWITCH`: Agent has been emergency-disabled
- `CONSTRAINT_VIOLATION`: Transaction exceeds limits

## Security Best Practices

1. **Use RS256 for production**: RSA signatures prevent secret leakage
2. **Rotate keys regularly**: Update `signingKey` monthly
3. **Keep tickets short-lived**: 5-minute validity prevents replay attacks
4. **Monitor kill switches**: Implement real-time alerting
5. **Validate on every transaction**: Never trust old tickets

## Performance

- **Ticket generation**: <1ms
- **Validation (sync)**: <1ms
- **Validation (async)**: <5ms

Designed for sub-second x402 handshakes.
