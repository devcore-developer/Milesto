// One OpenAI-compatible HTTP adapter covers every supported provider
// (Groq, OpenRouter, z.ai, OpenAI, Gemini's OpenAI-compatible endpoint, …).
// Plain fetch — no SDKs, no native dependencies, Vercel-safe.

import type { AIConfig } from "@/lib/ai/config";
import type { AIChatOptions, AIProvider } from "@/lib/ai/types";
import { AICallError } from "@/lib/ai/types";

type ChatRole = "system" | "user" | "assistant";
interface ChatMessage {
  role: ChatRole;
  content: string;
}

function sanitize(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

function mapHttpError(status: number, body: string): AICallError {
  if (status === 401 || status === 403) {
    return new AICallError("AI_AUTH", 502, sanitize(body));
  }
  if (status === 429) {
    return new AICallError("AI_PROVIDER_RATE_LIMIT", 429, sanitize(body));
  }
  if (status >= 500) {
    return new AICallError("AI_PROVIDER_ERROR", 502, sanitize(body));
  }
  return new AICallError("AI_BAD_RESPONSE", 502, sanitize(body));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new AICallError("AI_TIMEOUT", 504);
    }
    throw new AICallError(
      "AI_NETWORK",
      502,
      e instanceof Error ? sanitize(e.message) : undefined,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort JSON extraction from a model answer (handles ```json fences,
 *  leading prose and trailing text around a JSON object). */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new AICallError("AI_BAD_RESPONSE", 502, "answer is not valid JSON");
  }
}

export function createOpenAICompatibleProvider(cfg: AIConfig): AIProvider {
  async function chat(
    messages: ChatMessage[],
    opts?: AIChatOptions & { jsonMode?: boolean },
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages,
      temperature: opts?.temperature ?? 0.2,
      max_tokens: opts?.maxTokens ?? 2048,
    };
    if (opts?.jsonMode) body.response_format = { type: "json_object" };

    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${cfg.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        cfg.timeoutMs,
      );
    } catch (e) {
      // Network-level failure cannot be fixed by dropping JSON mode.
      throw e;
    }

    if (!res.ok) {
      // Some compatible providers reject response_format — one retry without it.
      if (opts?.jsonMode && res.status === 400) {
        return chat(messages, { ...opts, jsonMode: false });
      }
      throw mapHttpError(res.status, await res.text().catch(() => ""));
    }

    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new AICallError("AI_BAD_RESPONSE", 502, "empty answer");
    }
    return content;
  }

  return {
    info: {
      configured: true,
      provider: cfg.provider,
      model: cfg.model,
      capabilities: {
        chat: true,
        vision: cfg.vision,
        stt: Boolean(cfg.transcribeModel),
      },
    },

    async chatText(prompt, opts) {
      const messages: ChatMessage[] = [];
      if (opts?.system) messages.push({ role: "system", content: opts.system });
      messages.push({ role: "user", content: prompt });
      return chat(messages, opts);
    },

    async chatJSON(prompt, opts) {
      const messages: ChatMessage[] = [];
      if (opts?.system) messages.push({ role: "system", content: opts.system });
      messages.push({ role: "user", content: prompt });
      const text = await chat(messages, { ...opts, jsonMode: true });
      return extractJson(text);
    },

    async transcribe(file, filename) {
      if (!cfg.transcribeModel) {
        throw new AICallError(
          "AI_NOT_CONFIGURED",
          400,
          "AI_TRANSCRIBE_MODEL is not set",
        );
      }
      const form = new FormData();
      form.append("file", file, filename);
      form.append("model", cfg.transcribeModel);
      const res = await fetchWithTimeout(
        `${cfg.baseUrl}/audio/transcriptions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${cfg.apiKey}` },
          body: form,
        },
        cfg.timeoutMs,
      );
      if (!res.ok) {
        throw mapHttpError(res.status, await res.text().catch(() => ""));
      }
      const data = (await res.json().catch(() => null)) as {
        text?: string;
      } | null;
      if (typeof data?.text !== "string") {
        throw new AICallError("AI_BAD_RESPONSE", 502, "no transcript in answer");
      }
      return data.text;
    },

    async describeImage(dataUrl, prompt) {
      if (!cfg.vision) {
        throw new AICallError("AI_BAD_CONFIG", 400, "vision disabled");
      }
      const res = await fetchWithTimeout(
        `${cfg.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
            temperature: 0.2,
            max_tokens: 700,
          }),
        },
        cfg.timeoutMs,
      );
      if (!res.ok) {
        throw mapHttpError(res.status, await res.text().catch(() => ""));
      }
      const data = (await res.json().catch(() => null)) as {
        choices?: { message?: { content?: string } }[];
      } | null;
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new AICallError("AI_BAD_RESPONSE", 502, "empty vision answer");
      }
      return content;
    },
  };
}