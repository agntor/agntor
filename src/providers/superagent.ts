import type { ChatMessage, AnalysisResponse } from "../types.js";
import type { ProviderConfig, ResponseFormat } from "./types.js";

/**
 * Default fallback timeout in milliseconds before falling back to
 * the always-on endpoint.
 */
export const DEFAULT_FALLBACK_TIMEOUT_MS = 5_000;

/**
 * Placeholder fallback URL — overridden via the `AGNTOR_FALLBACK_URL`
 * environment variable when a dedicated inference endpoint is deployed.
 */
export const DEFAULT_FALLBACK_URL = "FALLBACK_ENDPOINT_PLACEHOLDER";

/**
 * Resolve the fallback URL from an explicit value, env var, or default.
 */
export function getFallbackUrl(override?: string): string {
  return (
    override ??
    process.env.AGNTOR_FALLBACK_URL ??
    DEFAULT_FALLBACK_URL
  );
}

/**
 * Superagent provider — Agntor's own guard model endpoint.
 *
 * Uses an Ollama-compatible chat/completions format.  The endpoint does
 * not require an API key (authentication is handled at the network
 * level), so `envVar` is intentionally left empty.
 */
export const superagentProvider: ProviderConfig = {
  baseUrl:
    process.env.AGNTOR_SUPERAGENT_URL ??
    "https://guard.agntor.com/v1/chat/completions",
  envVar: "", // no key required

  authHeader: (_apiKey: string) => ({
    "Content-Type": "application/json",
  }),

  transformRequest: (
    model: string,
    messages: ChatMessage[],
    _responseFormat?: ResponseFormat,
  ) => ({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : m.content.map((p) => (p.type === "text" ? p.text : "")).join(""),
    })),
    stream: false,
    temperature: 0,
  }),

  transformResponse: (response: unknown): AnalysisResponse => {
    // Ollama-compatible response shape
    const res = response as {
      id?: string;
      choices?: Array<{
        message?: { role?: string; content?: string };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const choice = res.choices?.[0];
    return {
      id: res.id ?? "superagent",
      usage: {
        promptTokens: res.usage?.prompt_tokens ?? 0,
        completionTokens: res.usage?.completion_tokens ?? 0,
        totalTokens: res.usage?.total_tokens ?? 0,
      },
      choices: [
        {
          index: 0,
          message: {
            role: choice?.message?.role ?? "assistant",
            content: choice?.message?.content ?? "",
          },
          finish_reason: choice?.finish_reason ?? "stop",
        },
      ],
    };
  },
};
