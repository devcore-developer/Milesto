// AI environment configuration — server-side only.
//
// Free-first rules enforced here:
// - Nothing is hardcoded: provider label, key, base URL and model all come
//   from environment variables (AI_PROVIDER / AI_API_KEY / AI_BASE_URL /
//   AI_MODEL). Swapping providers never requires code changes.
// - Missing configuration is a VALID state: the app stays 100% usable and
//   AI surfaces only show a "not configured" state.
// - No credentials are ever logged or serialized to the client.

export interface AIConfig {
  /** Display label only (e.g. "groq", "openrouter", "z.ai", "openai"). */
  provider: string;
  apiKey: string;
  /** OpenAI-compatible root, e.g. "https://api.groq.com/openai/v1". */
  baseUrl: string;
  /** Chat model id from the provider (must handle JSON-style answers). */
  model: string;
  /** Speech-to-text model id — when null, STT capability is off. */
  transcribeModel: string | null;
  /** Image input capability flag (disable with AI_VISION=0). */
  vision: boolean;
  timeoutMs: number;
  /** Max AI calls per user per day (cost guard on top of provider limits). */
  dailyLimit: number;
}

function readInt(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    console.warn(`[ai] invalid ${name}="${raw}" — using default ${fallback}`);
    return fallback;
  }
  return Math.round(n);
}

/** Read AI_* env vars at call time — never cached, so Vercel env updates
 *  apply without a rebuild of this module's state. */
export function aiConfig(): AIConfig {
  return {
    provider: (process.env.AI_PROVIDER ?? "openai-compatible").trim(),
    apiKey: (process.env.AI_API_KEY ?? "").trim(),
    baseUrl: (process.env.AI_BASE_URL ?? "").trim().replace(/\/+$/, ""),
    model: (process.env.AI_MODEL ?? "").trim(),
    transcribeModel: (process.env.AI_TRANSCRIBE_MODEL ?? "").trim() || null,
    vision: (process.env.AI_VISION ?? "1").trim() !== "0",
    timeoutMs: readInt("AI_TIMEOUT_MS", 60_000, 1_000, 120_000),
    dailyLimit: readInt("AI_DAILY_LIMIT", 200, 1, 10_000),
  };
}

/** True only when key + base URL + model are all present. */
export function isAIConfigured(cfg: AIConfig = aiConfig()): boolean {
  return Boolean(cfg.apiKey && cfg.baseUrl && cfg.model);
}