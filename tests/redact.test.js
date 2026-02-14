import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redact, DEFAULT_REDACTION_PATTERNS } from '../dist/redact.js';

describe('redact()', () => {
  const emptyPolicy = {};

  describe('email redaction', () => {
    it('redacts email addresses', () => {
      const result = redact('Contact me at user@example.com please', emptyPolicy);
      assert.ok(result.redacted.includes('[EMAIL]'));
      assert.ok(!result.redacted.includes('user@example.com'));
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].type, 'email');
    });

    it('redacts multiple emails', () => {
      const result = redact('a@b.com and c@d.org', emptyPolicy);
      assert.ok(!result.redacted.includes('a@b.com'));
      assert.ok(!result.redacted.includes('c@d.org'));
    });
  });

  describe('SSN redaction', () => {
    it('redacts US SSN format', () => {
      const result = redact('SSN: 123-45-6789', emptyPolicy);
      assert.ok(result.redacted.includes('[SSN]'));
      assert.ok(!result.redacted.includes('123-45-6789'));
    });
  });

  describe('AWS key redaction', () => {
    it('redacts AWS access key IDs', () => {
      const result = redact('key is AKIAIOSFODNN7EXAMPLE', emptyPolicy);
      assert.ok(result.redacted.includes('[AWS_KEY]'));
      assert.ok(!result.redacted.includes('AKIAIOSFODNN7EXAMPLE'));
    });
  });

  describe('API key/secret redaction', () => {
    it('redacts api_key = value patterns', () => {
      const result = redact('api_key: sk_live_abc123def456ghi789jkl', emptyPolicy);
      assert.ok(result.redacted.includes('[REDACTED]'));
      assert.ok(!result.redacted.includes('sk_live_abc123def456ghi789jkl'));
    });

    it('redacts Bearer tokens', () => {
      const result = redact('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', emptyPolicy);
      assert.ok(result.redacted.includes('[REDACTED]'));
    });
  });

  describe('blockchain-specific redaction', () => {
    it('redacts Ethereum private keys (64 hex chars)', () => {
      const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const result = redact(`My key: ${key}`, emptyPolicy);
      assert.ok(result.redacted.includes('[PRIVATE_KEY]'));
      assert.ok(!result.redacted.includes(key));
    });

    it('redacts keystore JSON ciphertext', () => {
      const input = '{"ciphertext": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6"}';
      const result = redact(input, emptyPolicy);
      assert.ok(result.redacted.includes('[REDACTED_KEYSTORE]'));
    });

    it('redacts HD derivation paths', () => {
      const result = redact("path: m/44'/60'/0'/0/0", emptyPolicy);
      assert.ok(result.redacted.includes('[HD_PATH]'));
    });
  });

  describe('custom patterns', () => {
    it('applies custom redaction patterns', () => {
      const result = redact('My account is ACC-12345', {
        redactionPatterns: [
          { type: 'account_id', pattern: /ACC-\d+/g, replacement: '[ACCOUNT]' },
        ],
      });
      assert.ok(result.redacted.includes('[ACCOUNT]'));
      assert.ok(!result.redacted.includes('ACC-12345'));
    });
  });

  describe('no matches', () => {
    it('returns input unchanged when no patterns match', () => {
      const input = 'Hello, this is a normal sentence.';
      const result = redact(input, emptyPolicy);
      assert.equal(result.redacted, input);
      assert.equal(result.findings.length, 0);
    });
  });

  describe('findings metadata', () => {
    it('includes span information for each finding', () => {
      const input = 'email: user@example.com done';
      const result = redact(input, emptyPolicy);
      assert.ok(result.findings.length >= 1);
      const finding = result.findings.find((f) => f.type === 'email');
      assert.ok(finding);
      assert.ok(Array.isArray(finding.span));
      assert.equal(finding.span.length, 2);
      assert.ok(finding.span[0] < finding.span[1]);
    });
  });

  describe('DEFAULT_REDACTION_PATTERNS export', () => {
    it('is an array with expected pattern types', () => {
      assert.ok(Array.isArray(DEFAULT_REDACTION_PATTERNS));
      const types = DEFAULT_REDACTION_PATTERNS.map((p) => p.type);
      assert.ok(types.includes('email'));
      assert.ok(types.includes('ssn'));
      assert.ok(types.includes('private_key'));
      assert.ok(types.includes('mnemonic_seed'));
    });
  });
});
