import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAP2Headers, parseAP2Headers, AP2_VERSION, AP2_EXTENSION_URI } from '../dist/ap2.js';

describe('AP2 Protocol', () => {
  describe('constants', () => {
    it('AP2_VERSION is a string', () => {
      assert.ok(typeof AP2_VERSION === 'string');
      assert.ok(AP2_VERSION.length > 0);
    });

    it('AP2_EXTENSION_URI points to Google AP2 spec', () => {
      assert.ok(AP2_EXTENSION_URI.includes('google-agentic-commerce'));
    });
  });

  describe('getAP2Headers()', () => {
    it('returns headers with version and extension URI', () => {
      const headers = getAP2Headers();
      assert.equal(headers['X-AP2-Version'], AP2_VERSION);
      assert.equal(headers['X-AP2-Extension-URI'], AP2_EXTENSION_URI);
    });

    it('includes agent ID when provided', () => {
      const headers = getAP2Headers('agent://my-agent');
      assert.equal(headers['X-AP2-Agent-ID'], 'agent://my-agent');
    });

    it('omits agent ID when not provided', () => {
      const headers = getAP2Headers();
      assert.equal(headers['X-AP2-Agent-ID'], undefined);
    });

    it('includes platform header', () => {
      const headers = getAP2Headers();
      assert.equal(headers['X-AP2-Platform'], 'Agntor');
    });

    it('includes roles', () => {
      const headers = getAP2Headers();
      assert.ok(headers['X-AP2-Roles']);
      assert.ok(headers['X-AP2-Roles'].length > 0);
    });

    it('includes supported methods', () => {
      const headers = getAP2Headers();
      assert.ok(headers['X-AP2-Supported-Methods']);
      assert.ok(headers['X-AP2-Supported-Methods'].includes('x402'));
    });
  });

  describe('parseAP2Headers()', () => {
    it('parses headers from a Headers object', () => {
      const headers = new Headers({
        'X-AP2-Version': '1.0-draft',
        'X-AP2-Agent-ID': 'agent://test',
        'X-AP2-Roles': 'buyer,seller',
      });
      const parsed = parseAP2Headers(headers);
      assert.equal(parsed.version, '1.0-draft');
      assert.equal(parsed.agentId, 'agent://test');
      assert.deepEqual(parsed.roles, ['buyer', 'seller']);
    });

    it('returns empty roles when header is missing', () => {
      const headers = new Headers({
        'X-AP2-Version': '1.0-draft',
      });
      const parsed = parseAP2Headers(headers);
      assert.deepEqual(parsed.roles, []);
    });

    it('returns null for missing headers', () => {
      const headers = new Headers();
      const parsed = parseAP2Headers(headers);
      assert.equal(parsed.version, null);
      assert.equal(parsed.agentId, null);
    });
  });
});
