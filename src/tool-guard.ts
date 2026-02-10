import type { Policy, GuardOptions, ToolGuardResult } from './types.js';
import { guard } from './guard.js';
import { redact } from './redact.js';
import { validateUrl } from './utils/network.js';

// ---------------------------------------------------------------------------
// Existing guardTool — policy-based tool allow/blocklist
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// wrapAgentTool — high-level wrapper that applies guard + redact + SSRF
// ---------------------------------------------------------------------------

/**
 * Options for `wrapAgentTool`.
 */
export interface WrapAgentToolOptions {
  /** Policy for redaction and prompt-injection guard. */
  policy: Policy;

  /**
   * Name of the tool (used for guardTool allow/blocklist checks).
   * If omitted, the wrapped function's `.name` is used.
   */
  toolName?: string;

  /** Guard options (e.g. `deepScan`, `provider`). */
  guardOptions?: GuardOptions;

  /**
   * When `true`, any string argument that looks like a URL will be
   * validated against the SSRF guard before the tool executes.
   * @default true
   */
  ssrfCheck?: boolean;
}

/**
 * Wrap any tool function with Agntor's guard, redact, and SSRF layers.
 *
 * The returned async function:
 * 1. Checks the tool against the policy allow/blocklist.
 * 2. Redacts sensitive data from all string arguments.
 * 3. Runs prompt-injection guard on the serialized arguments.
 * 4. (Optional) Validates URL arguments against SSRF rules.
 * 5. Invokes the original tool with the sanitized arguments.
 *
 * @example
 * ```ts
 * import { wrapAgentTool } from '@agntor/sdk';
 *
 * const safeFetch = wrapAgentTool(myFetchTool, {
 *   policy: { toolBlocklist: ['dangerousTool'] },
 * });
 *
 * // Will throw if blocked by policy or if injection is detected
 * const result = await safeFetch('https://example.com/api');
 * ```
 */
export function wrapAgentTool<T extends (...args: any[]) => any>(
  toolFn: T,
  options: WrapAgentToolOptions,
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  const {
    policy,
    toolName = toolFn.name || 'anonymous',
    guardOptions,
    ssrfCheck = true,
  } = options;

  return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    // 1. Tool allow/blocklist check
    const toolCheck = guardTool(toolName, args, policy);
    if (!toolCheck.allowed) {
      throw new Error(
        `[Agntor] Tool "${toolName}" blocked: ${toolCheck.reason ?? toolCheck.violations?.join(', ')}`,
      );
    }

    // 2. Redact sensitive data from string arguments
    const safeArgs = args.map((arg) => {
      if (typeof arg === 'string') {
        return redact(arg, policy).redacted;
      }
      return arg;
    }) as Parameters<T>;

    // 3. Prompt-injection guard on serialised arguments
    const serialised = JSON.stringify(safeArgs);
    const guardResult = await guard(serialised, policy, guardOptions);
    if (guardResult.classification === 'block') {
      throw new Error(
        `[Agntor] Tool "${toolName}" input blocked by guard: ${guardResult.violation_types.join(', ')}`,
      );
    }

    // 4. SSRF check on any URL-shaped string arguments
    if (ssrfCheck) {
      for (const arg of safeArgs) {
        if (typeof arg === 'string' && isLikelyUrl(arg)) {
          try {
            await validateUrl(arg);
          } catch (err) {
            throw new Error(
              `[Agntor] Tool "${toolName}" blocked — SSRF risk: ${(err as Error).message}`,
            );
          }
        }
      }
    }

    // 5. Execute the original tool
    return toolFn(...safeArgs);
  };
}

/**
 * Quick heuristic: does this string look like a URL?
 */
function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
