import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseModel, getProvider, providers } from '../dist/providers/index.js';

describe('parseModel()', () => {
  it('parses "openai/gpt-4o"', () => {
    const result = parseModel('openai/gpt-4o');
    assert.equal(result.provider, 'openai');
    assert.equal(result.model, 'gpt-4o');
  });

  it('parses "anthropic/claude-3-5-sonnet-latest"', () => {
    const result = parseModel('anthropic/claude-3-5-sonnet-latest');
    assert.equal(result.provider, 'anthropic');
    assert.equal(result.model, 'claude-3-5-sonnet-latest');
  });

  it('handles model names with slashes (e.g. bedrock/us.anthropic/claude-3-5-sonnet)', () => {
    const result = parseModel('bedrock/us.anthropic/claude-3-5-sonnet');
    assert.equal(result.provider, 'bedrock');
    assert.equal(result.model, 'us.anthropic/claude-3-5-sonnet');
  });

  it('throws on missing slash', () => {
    assert.throws(
      () => parseModel('gpt-4o'),
      /Invalid model format/,
    );
  });

  it('throws on empty provider', () => {
    assert.throws(
      () => parseModel('/gpt-4o'),
      /Invalid model format/,
    );
  });

  it('throws on empty model', () => {
    assert.throws(
      () => parseModel('openai/'),
      /Invalid model format/,
    );
  });
});

describe('getProvider()', () => {
  it('returns OpenAI provider', () => {
    const provider = getProvider('openai');
    assert.ok(provider);
    assert.ok(provider.baseUrl);
    assert.ok(provider.transformRequest);
    assert.ok(provider.transformResponse);
  });

  it('returns Anthropic provider', () => {
    const provider = getProvider('anthropic');
    assert.ok(provider);
  });

  it('returns Google provider', () => {
    const provider = getProvider('google');
    assert.ok(provider);
  });

  it('throws on unknown provider', () => {
    assert.throws(
      () => getProvider('nonexistent'),
      /Unsupported provider/,
    );
  });

  it('error message lists supported providers', () => {
    try {
      getProvider('nonexistent');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('openai'));
      assert.ok(err.message.includes('anthropic'));
      assert.ok(err.message.includes('google'));
    }
  });
});

describe('providers registry', () => {
  it('contains all expected providers', () => {
    const expected = [
      'openai', 'openai-compatible', 'anthropic', 'google',
      'bedrock', 'vercel', 'groq', 'fireworks', 'openrouter',
    ];
    for (const name of expected) {
      assert.ok(providers[name], `Missing provider: ${name}`);
    }
  });

  it('does not contain superagent', () => {
    assert.equal(providers['superagent'], undefined);
  });

  it('every provider has required fields', () => {
    for (const [name, provider] of Object.entries(providers)) {
      assert.ok(typeof provider.baseUrl === 'string', `${name}: missing baseUrl`);
      assert.ok(typeof provider.envVar === 'string', `${name}: missing envVar`);
      assert.ok(typeof provider.authHeader === 'function', `${name}: missing authHeader`);
      assert.ok(typeof provider.transformRequest === 'function', `${name}: missing transformRequest`);
      assert.ok(typeof provider.transformResponse === 'function', `${name}: missing transformResponse`);
    }
  });
});
