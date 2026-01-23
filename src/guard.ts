import type { GuardResult, Policy } from './types.js';

export async function guard(input: string, policy: Policy): Promise<GuardResult> {
  const violations: string[] = [];
  const patterns = policy.injectionPatterns ?? [];
  patterns.forEach((pattern) => {
    const rx = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    if (rx.test(input)) {
      violations.push('prompt-injection');
    }
  });

  const classification = violations.length ? 'block' : 'pass';

  const cwe_codes = violations
    .map((v) => policy.cweMap?.[v])
    .filter(Boolean) as string[];

  const tokens = Math.ceil(input.length / 4);
  const usage = { promptTokens: tokens, completionTokens: 0, totalTokens: tokens };

  return { classification, violation_types: violations, cwe_codes, usage };
}
