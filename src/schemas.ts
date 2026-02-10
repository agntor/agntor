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
 * Parse a raw string (e.g. from an LLM) against a Zod schema.
 * Returns the parsed value on success, or throws on failure.
 */
export function parseStructuredOutput<T>(
  raw: string,
  schema: z.ZodType<T>,
): T {
  const json: unknown = JSON.parse(raw);
  return schema.parse(json);
}
