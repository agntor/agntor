import type { Policy, ToolGuardResult } from './types.js';

export function guardTool(tool: string, policy: Policy): ToolGuardResult {
  const violations: string[] = [];

  if (policy.toolAllowlist?.length && !policy.toolAllowlist.includes(tool)) {
    violations.push('tool-not-allowed');
  }

  if (policy.toolBlocklist?.includes(tool)) {
    violations.push('tool-blocked');
  }

  if (violations.length) {
    return {
      allowed: false,
      violations,
      reason: 'Tool blocked by policy',
    };
  }

  return { allowed: true };
}
