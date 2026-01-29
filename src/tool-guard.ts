import type { Policy, ToolGuardResult } from './types.js';

export function guardTool(tool: string, args?: any, policy?: Policy): ToolGuardResult {
  const violations: string[] = [];

  if (!policy) {
    return { allowed: true };
  }

  // 1. Blocklist check
  if (policy.toolBlocklist?.includes(tool)) {
    violations.push('tool-blocked');
  }

  // 2. Allowlist check (if defined, tool must be in it)
  if (policy.toolAllowlist?.length && !policy.toolAllowlist.includes(tool)) {
    violations.push('tool-not-allowed');
  }

  // 3. Granular Validator (Custom Logic)
  if (policy.toolValidator) {
    const validationResult = policy.toolValidator(tool, args);
    if (validationResult === false) {
      violations.push('tool-validation-failed');
    } else if (typeof validationResult === 'string') {
      return {
        allowed: false,
        violations: ['tool-validation-failed'],
        reason: validationResult,
      };
    }
  }

  if (violations.length) {
    return {
      allowed: false,
      violations,
      reason: violations.includes('tool-blocked') 
        ? `Tool '${tool}' is explicitly blocked by policy.`
        : `Tool '${tool}' failed security policy validation.`,
    };
  }

  return { allowed: true };
}
