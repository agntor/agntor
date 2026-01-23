import type { Policy, RedactResult } from './types.js';

export function redact(input: string, policy: Policy): RedactResult {
  const patterns = policy.redactionPatterns ?? [];
  const findings: Array<{ type: string; span: [number, number]; value?: string }> = [];

  const matches: Array<{ start: number; end: number; type: string; replacement: string; value: string }> = [];

  patterns.forEach(({ type, pattern, replacement }) => {
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

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

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
