import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseStructuredOutput, GuardResponseSchema, SettlementDecisionSchema, SimulationResultSchema } from '../dist/schemas.js';

describe('parseStructuredOutput()', () => {
  describe('basic JSON parsing', () => {
    it('parses valid JSON against a schema', () => {
      const raw = '{"classification": "pass", "reasoning": "looks fine"}';
      const result = parseStructuredOutput(raw, GuardResponseSchema);
      assert.equal(result.classification, 'pass');
      assert.equal(result.reasoning, 'looks fine');
    });

    it('parses "block" classification', () => {
      const raw = '{"classification": "block", "reasoning": "injection detected"}';
      const result = parseStructuredOutput(raw, GuardResponseSchema);
      assert.equal(result.classification, 'block');
    });
  });

  describe('markdown code fence stripping', () => {
    it('strips ```json fences', () => {
      const raw = '```json\n{"classification": "pass", "reasoning": "ok"}\n```';
      const result = parseStructuredOutput(raw, GuardResponseSchema);
      assert.equal(result.classification, 'pass');
    });

    it('strips ``` fences (no language)', () => {
      const raw = '```\n{"classification": "pass", "reasoning": "ok"}\n```';
      const result = parseStructuredOutput(raw, GuardResponseSchema);
      assert.equal(result.classification, 'pass');
    });

    it('strips ```JSON fences (uppercase)', () => {
      const raw = '```JSON\n{"classification": "block", "reasoning": "bad"}\n```';
      const result = parseStructuredOutput(raw, GuardResponseSchema);
      assert.equal(result.classification, 'block');
    });

    it('handles extra whitespace around fences', () => {
      const raw = '  ```json\n  {"classification": "pass", "reasoning": "ok"}  \n  ```  ';
      const result = parseStructuredOutput(raw, GuardResponseSchema);
      assert.equal(result.classification, 'pass');
    });
  });

  describe('error handling', () => {
    it('throws on empty string', () => {
      assert.throws(
        () => parseStructuredOutput('', GuardResponseSchema),
        /empty input/,
      );
    });

    it('throws on whitespace-only string', () => {
      assert.throws(
        () => parseStructuredOutput('   \n  ', GuardResponseSchema),
        /empty input/,
      );
    });

    it('throws descriptive error on invalid JSON', () => {
      assert.throws(
        () => parseStructuredOutput('not json at all', GuardResponseSchema),
        /failed to parse JSON/,
      );
    });

    it('throws descriptive error on schema mismatch', () => {
      const raw = '{"wrong": "shape"}';
      assert.throws(
        () => parseStructuredOutput(raw, GuardResponseSchema),
        /schema validation failed/,
      );
    });

    it('includes field path in schema error', () => {
      const raw = '{"classification": "invalid_value", "reasoning": "ok"}';
      assert.throws(
        () => parseStructuredOutput(raw, GuardResponseSchema),
        /classification/,
      );
    });

    it('includes raw input preview in JSON parse error', () => {
      assert.throws(
        () => parseStructuredOutput('broken{json', GuardResponseSchema),
        /Raw input/,
      );
    });
  });

  describe('SettlementDecisionSchema', () => {
    it('parses valid settlement decision', () => {
      const raw = '{"classification": "block", "reasoning": "high risk"}';
      const result = parseStructuredOutput(raw, SettlementDecisionSchema);
      assert.equal(result.classification, 'block');
      assert.equal(result.reasoning, 'high risk');
    });
  });

  describe('SimulationResultSchema', () => {
    it('parses minimal simulation result', () => {
      const raw = '{"safe": true}';
      const result = parseStructuredOutput(raw, SimulationResultSchema);
      assert.equal(result.safe, true);
    });

    it('parses full simulation result', () => {
      const raw = JSON.stringify({
        safe: false,
        gasEstimate: 21000,
        stateChanges: [{ type: 'balance', address: '0xabc' }],
        warnings: ['high gas'],
        error: 'reverted',
      });
      const result = parseStructuredOutput(raw, SimulationResultSchema);
      assert.equal(result.safe, false);
      assert.equal(result.gasEstimate, 21000);
      assert.equal(result.stateChanges.length, 1);
      assert.equal(result.warnings.length, 1);
    });
  });
});
