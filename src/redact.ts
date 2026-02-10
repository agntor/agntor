import type { Policy, RedactResult } from './types.js';

/**
 * Default redaction patterns for common PII and Secrets
 */
export const DEFAULT_REDACTION_PATTERNS = [
  // Emails
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  // Credit Cards (Luhn check not included in regex)
  { type: 'credit_card', pattern: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[CREDIT_CARD]' },
  // IPv4 Addresses
  { type: 'ipv4', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP_ADDRESS]' },
  // US SSN
  { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  // AWS Access Key ID
  { type: 'aws_access_key', pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[AWS_KEY]' },
  // Generic Secret/API Key (rough)
  { type: 'api_key', pattern: /\b(api_key|secret|password|token)\s*[:=]\s*["']?[a-zA-Z0-9\-_]{20,}["']?/gi, replacement: '$1: [REDACTED]' },
  // Bearer Token
  { type: 'bearer_token', pattern: /bearer\s+[a-zA-Z0-9._\-\/+=]{20,}/gi, replacement: 'Bearer [REDACTED]' },
  // Phone Numbers
  { type: 'phone_number', pattern: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[PHONE]' },
  // Street Addresses (Common US/UK formats)
  { type: 'street_address', pattern: /\b\d{1,5}\s(?:[A-Z]{1}[a-z]+(?:\s[A-Z]{1}[a-z]+)*)\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\b/g, replacement: '[ADDRESS]' },

  // ---------------------------------------------------------------------------
  // Blockchain / Crypto-specific patterns
  // ---------------------------------------------------------------------------

  // Ethereum / EVM private key (64 hex chars, optionally 0x-prefixed)
  { type: 'private_key', pattern: /\b(?:0x)?[0-9a-fA-F]{64}\b/g, replacement: '[PRIVATE_KEY]' },

  // BIP-39 Mnemonic Seed Phrase (12 or 24 lowercase words)
  // Matches common seed phrase patterns: 12 or 24 space-separated lowercase words
  { type: 'mnemonic_seed', pattern: /\b(?:[a-z]{3,8}\s){11}[a-z]{3,8}\b/g, replacement: '[MNEMONIC_12]' },
  { type: 'mnemonic_seed', pattern: /\b(?:[a-z]{3,8}\s){23}[a-z]{3,8}\b/g, replacement: '[MNEMONIC_24]' },

  // Solana private key (base58, 87-88 chars)
  { type: 'solana_private_key', pattern: /\b[1-9A-HJ-NP-Za-km-z]{87,88}\b/g, replacement: '[SOLANA_PRIVATE_KEY]' },

  // Bitcoin WIF private key (starts with 5, K, or L; base58check)
  { type: 'btc_wif_key', pattern: /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, replacement: '[BTC_PRIVATE_KEY]' },

  // Ethereum keystore JSON (detect the cipher/ciphertext structure)
  { type: 'keystore_json', pattern: /"ciphertext"\s*:\s*"[0-9a-fA-F]{64,}"/g, replacement: '"ciphertext": "[REDACTED_KEYSTORE]"' },

  // HD derivation path (e.g. m/44'/60'/0'/0/0) — not a secret itself but
  // contextually sensitive when paired with a key or mnemonic
  { type: 'hd_path', pattern: /\bm\/\d+'?\/\d+'?\/\d+'?(?:\/\d+'?){0,2}\b/g, replacement: '[HD_PATH]' },
];

export function redact(input: string, policy: Policy): RedactResult {
  const customPatterns = policy.redactionPatterns ?? [];
  const allPatterns = [...DEFAULT_REDACTION_PATTERNS, ...customPatterns];
  
  const findings: Array<{ type: string; span: [number, number]; value?: string }> = [];
  const matches: Array<{ start: number; end: number; type: string; replacement: string; value: string }> = [];

  allPatterns.forEach(({ type, pattern, replacement }) => {
    const base = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g');
    const regex = base.global ? base : new RegExp(base.source, base.flags + 'g');
    
    for (const match of input.matchAll(regex)) {
      if (match.index === undefined) continue;
      const value = match[0];
      matches.push({
        start: match.index,
        end: match.index + value.length,
        type,
        replacement: replacement ?? '[REDACTED]',
        value,
      });
    }
  });

  // Sort by start position, then by length descending for overlapping matches
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  let cursor = 0;
  let output = '';
  for (const match of matches) {
    if (match.start < cursor) continue;
    output += input.slice(cursor, match.start) + match.replacement;
    findings.push({ type: match.type, span: [match.start, match.end], value: match.value });
    cursor = match.end;
  }
  output += input.slice(cursor);

  return { redacted: output, findings };
}
