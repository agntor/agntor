import { z } from 'zod';

/**
 * Structured output schema for LLM-based guard responses.
 *
 * Using Zod "strict JSON mode" ensures that when the guard asks a model
 * "Is this input safe?", the response is always machine-parseable.
 */
export const GuardResponseSchema = z.object({
  classification: z.enum(['pass', 'block']),
  reasoning: z.string(),
});
export type GuardResponse = z.infer<typeof GuardResponseSchema>;

/**
 * Structured output schema for settlement / escrow decisions.
 */
export const SettlementDecisionSchema = z.object({
  classification: z.enum(['pass', 'block']),
  reasoning: z.string(),
});
export type SettlementDecision = z.infer<typeof SettlementDecisionSchema>;

/**
 * Structured output schema for transaction simulation results.
 */
export const SimulationResultSchema = z.object({
  safe: z.boolean(),
  gasEstimate: z.number().optional(),
  stateChanges: z.array(
    z.object({
      type: z.string(),
      address: z.string(),
      before: z.string().optional(),
      after: z.string().optional(),
    }),
  ).optional(),
  warnings: z.array(z.string()).optional(),
  error: z.string().optional(),
});
export type SimulationResult = z.infer<typeof SimulationResultSchema>;

/**
 * Strip markdown code fences that LLMs commonly wrap JSON in.
 *
 * Handles:
 * - ```json ... ```
 * - ``` ... ```
 * - Leading/trailing whitespace
 */
function stripCodeFences(raw: string): string {
  let s = raw.trim();
  // Match ```json or ``` at the start, and ``` at the end
  const fenceStart = /^```(?:json|JSON)?\s*\n?/;
  const fenceEnd = /\n?\s*```\s*$/;
  if (fenceStart.test(s) && fenceEnd.test(s)) {
    s = s.replace(fenceStart, '').replace(fenceEnd, '');
  }
  return s.trim();
}

/**
 * Parse a raw string (e.g. from an LLM) against a Zod schema.
 * Returns the parsed value on success, or throws a descriptive error on failure.
 *
 * Handles common LLM output quirks:
 * - Strips markdown code fences (```json ... ```)
 * - Provides clear error messages with the raw input for debugging
 * - Validates against the provided Zod schema
 */
export function parseStructuredOutput<T>(
  raw: string,
  schema: z.ZodType<T>,
): T {
  if (!raw || !raw.trim()) {
    throw new Error(
      '[Agntor] parseStructuredOutput: received empty input. ' +
      'The LLM may have returned an empty response.',
    );
  }

  const cleaned = stripCodeFences(raw);

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch (err) {
    const preview = cleaned.length > 200 ? cleaned.slice(0, 200) + '...' : cleaned;
    throw new Error(
      `[Agntor] parseStructuredOutput: failed to parse JSON. ` +
      `${(err as Error).message}. Raw input: "${preview}"`,
    );
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(
      `[Agntor] parseStructuredOutput: schema validation failed. ${issues}`,
    );
  }

  return result.data;
}
