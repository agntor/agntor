import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TicketIssuer } from '../dist/issuer.js';

const TEST_CONFIG = {
  signingKey: 'test-secret-key-for-testing-only',
  issuer: 'test-issuer',
  algorithm: 'HS256',
  defaultValidity: 300,
};

const VALID_OPTIONS = {
  agentId: 'agent://test-agent',
  auditLevel: 'Gold',
  constraints: {
    max_op_value: 100,
    allowed_mcp_servers: ['server-a', 'server-b'],
    kill_switch_active: false,
  },
};

describe('TicketIssuer', () => {
  describe('generateTicket()', () => {
    it('generates a JWT string', () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);
      assert.ok(typeof ticket === 'string');
      assert.ok(ticket.split('.').length === 3, 'JWT should have 3 parts');
    });

    it('sets requires_x402_payment to true by default', () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);
      const decoded = issuer.decodeTicket(ticket);
      assert.equal(decoded.constraints.requires_x402_payment, true);
    });

    it('respects custom validity duration', () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket({ ...VALID_OPTIONS, validityDuration: 60 });
      const decoded = issuer.decodeTicket(ticket);
      assert.equal(decoded.exp - decoded.iat, 60);
    });

    it('includes metadata when provided', () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket({
        ...VALID_OPTIONS,
        metadata: { environment: 'test' },
      });
      const decoded = issuer.decodeTicket(ticket);
      assert.equal(decoded.metadata.environment, 'test');
    });
  });

  describe('validateTicket()', () => {
    it('validates a freshly generated ticket', async () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);
      const result = await issuer.validateTicket(ticket);
      assert.equal(result.valid, true);
      assert.ok(result.payload);
      assert.equal(result.payload.sub, 'agent://test-agent');
      assert.equal(result.payload.audit_level, 'Gold');
    });

    it('rejects ticket with wrong key', async () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);

      const otherIssuer = new TicketIssuer({ ...TEST_CONFIG, signingKey: 'wrong-key' });
      const result = await otherIssuer.validateTicket(ticket);
      assert.equal(result.valid, false);
      assert.equal(result.errorCode, 'INVALID_SIGNATURE');
    });

    it('rejects expired ticket', async () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      // Create a ticket that expired 1 second ago
      const ticket = issuer.generateTicket({ ...VALID_OPTIONS, validityDuration: -1 });
      const result = await issuer.validateTicket(ticket);
      assert.equal(result.valid, false);
      assert.equal(result.errorCode, 'EXPIRED');
    });

    it('rejects ticket with kill switch active', async () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket({
        ...VALID_OPTIONS,
        constraints: {
          ...VALID_OPTIONS.constraints,
          kill_switch_active: true,
        },
      });
      const result = await issuer.validateTicket(ticket);
      assert.equal(result.valid, false);
      assert.equal(result.errorCode, 'KILL_SWITCH');
    });

    it('rejects garbage token', async () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const result = await issuer.validateTicket('not.a.valid.jwt');
      assert.equal(result.valid, false);
    });
  });

  describe('validateTicketSync()', () => {
    it('validates synchronously', () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);
      const result = issuer.validateTicketSync(ticket);
      assert.equal(result.valid, true);
      assert.ok(result.payload);
    });

    it('rejects expired ticket synchronously', () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket({ ...VALID_OPTIONS, validityDuration: -1 });
      const result = issuer.validateTicketSync(ticket);
      assert.equal(result.valid, false);
      assert.equal(result.errorCode, 'EXPIRED');
    });
  });

  describe('validateTransaction()', () => {
    it('passes valid transaction within constraints', async () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);
      const result = await issuer.validateTransaction(ticket, 50, 'server-a', {
        protocol: 'x402',
        x402Proof: { txHash: '0xabc123' },
      });
      assert.equal(result.valid, true);
    });

    it('rejects transaction exceeding max_op_value', async () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);
      const result = await issuer.validateTransaction(ticket, 200, 'server-a', {
        protocol: 'x402',
        x402Proof: { txHash: '0xabc123' },
      });
      assert.equal(result.valid, false);
      assert.equal(result.errorCode, 'CONSTRAINT_VIOLATION');
      assert.ok(result.error.includes('exceeds limit'));
    });

    it('rejects transaction to disallowed MCP server', async () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);
      const result = await issuer.validateTransaction(ticket, 50, 'server-unknown', {
        protocol: 'x402',
        x402Proof: { txHash: '0xabc123' },
      });
      assert.equal(result.valid, false);
      assert.equal(result.errorCode, 'CONSTRAINT_VIOLATION');
      assert.ok(result.error.includes('not in allowed list'));
    });

    it('rejects non-x402 protocol when required', async () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);
      const result = await issuer.validateTransaction(ticket, 50, 'server-a', {
        protocol: 'other',
      });
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('x402'));
    });

    it('rejects missing payment proof', async () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);
      const result = await issuer.validateTransaction(ticket, 50, 'server-a', {
        protocol: 'x402',
        x402Proof: {},
      });
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('payment proof'));
    });
  });

  describe('decodeTicket()', () => {
    it('decodes without validation', () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const ticket = issuer.generateTicket(VALID_OPTIONS);
      const decoded = issuer.decodeTicket(ticket);
      assert.ok(decoded);
      assert.equal(decoded.sub, 'agent://test-agent');
    });

    it('returns null for garbage input', () => {
      const issuer = new TicketIssuer(TEST_CONFIG);
      const decoded = issuer.decodeTicket('not-a-jwt');
      assert.equal(decoded, null);
    });
  });
});
