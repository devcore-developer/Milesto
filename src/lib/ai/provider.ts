// Provider factory — the ONLY place that turns environment configuration
// into an AIProvider instance. Swapping providers is an env-var change;
// no analysis or feature code ever references a concrete provider.

import { aiConfig, isAIConfigured } from "@/lib/ai/config";
import { createOpenAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import { AICallError, type AIProvider, type AIStatusDTO } from "@/lib/ai/types";

/** Secret-free status for the Settings panel and API responses. */
export function aiStatus(): AIStatusDTO {
  const cfg = aiConfig();
  const configured = isAIConfigured(cfg);
  return {
    configured,
    provider: configured ? cfg.provider : null,
    model: configured ? cfg.model : null,
    capabilities: {
      chat: configured,
      vision: configured && cfg.vision,
      stt: configured && Boolean(cfg.transcribeModel),
    },
  };
}

/** The configured provider, or AICallError("AI_NOT_CONFIGURED").
 *  Never falls back to another provider and never makes a paid call —
 *  the app talks only to what the user explicitly configured. */
export function getAIProvider(): AIProvider {
  const cfg = aiConfig();
  if (!isAIConfigured(cfg)) {
    throw new AICallError("AI_NOT_CONFIGURED", 400);
  }
  return createOpenAICompatibleProvider(cfg);
}