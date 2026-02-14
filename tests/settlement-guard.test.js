import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { settlementGuard } from '../dist/settlement-guard.js';

describe('settlementGuard()', () => {
  const baseMeta = {
    amount: '50',
    currency: 'USDC',
    recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
    serviceDescription: 'Data analysis and report generation',
  };

  describe('heuristic: normal transactions', () => {
    it('passes a normal transaction', async () => {
      const result = await settlementGuard(baseMeta);
      assert.equal(result.classification, 'pass');
      assert.ok(result.riskScore < 0.5);
    });
  });

  describe('heuristic: zero address', () => {
    it('blocks transactions to the zero address', async () => {
      const result = await settlementGuard({
        ...baseMeta,
        recipientAddress: '0x0000000000000000000000000000000000000000',
      });
      assert.equal(result.classification, 'block');
      assert.ok(result.riskFactors.length > 0);
      assert.ok(result.riskFactors.some((f) => f.includes('zero address')));
    });
  });

  describe('heuristic: low reputation', () => {
    it('flags low reputation score', async () => {
      const result = await settlementGuard({
        ...baseMeta,
        reputationScore: 0.1,
      });
      assert.ok(result.riskScore > 0);
      assert.ok(result.riskFactors.some((f) => f.includes('reputation')));
    });
  });

  describe('heuristic: high-value transaction', () => {
    it('flags high-value transactions', async () => {
      const result = await settlementGuard({
        ...baseMeta,
        amount: '1000',
      });
      assert.ok(result.riskFactors.some((f) => f.includes('high-value')));
    });
  });

  describe('heuristic: vague description', () => {
    it('flags suspiciously short descriptions', async () => {
      const result = await settlementGuard({
        ...baseMeta,
        serviceDescription: 'stuff',
      });
      assert.ok(result.riskFactors.some((f) => f.includes('vague')));
    });
  });

  describe('combined heuristics: conclusive block', () => {
    it('blocks when multiple risk factors combine', async () => {
      const result = await settlementGuard({
        ...baseMeta,
        recipientAddress: '0x0000000000000000000000000000000000000000',
        reputationScore: 0.1,
        serviceDescription: 'x',
      });
      assert.equal(result.classification, 'block');
      assert.ok(result.riskScore >= 0.7);
    });
  });

  describe('deep scan error reporting', () => {
    it('calls onError when provider fails', async () => {
      const errors = [];
      const failingProvider = {
        classify: async () => { throw new Error('timeout'); },
      };

      const result = await settlementGuard(baseMeta, {
        deepScan: true,
        provider: failingProvider,
        onError: (err) => errors.push(err),
      });

      // Should still return a result (fail-open)
      assert.ok(result.classification);
      assert.equal(errors.length, 1);
      assert.equal(errors[0].message, 'timeout');
    });
  });

  describe('result shape', () => {
    it('returns all expected fields', async () => {
      const result = await settlementGuard(baseMeta);
      assert.ok('classification' in result);
      assert.ok('reasoning' in result);
      assert.ok('riskScore' in result);
      assert.ok('riskFactors' in result);
      assert.ok(typeof result.riskScore === 'number');
      assert.ok(Array.isArray(result.riskFactors));
    });
  });
});
