// AI provider abstraction — provider-agnostic, free-first.
// Implementations are plain OpenAI-compatible HTTP adapters (no SDKs).
// This module is safe to import from client code (type-only) and server code.

export type AICapability = "chat" | "vision" | "stt";

/** Public status shown in Settings — never contains secrets (no API key). */
export interface AIStatusDTO {
  configured: boolean;
  /** Display label from AI_PROVIDER (e.g. "groq", "openrouter", "z.ai"). */
  provider: string | null;
  model: string | null;
  capabilities: { chat: boolean; vision: boolean; stt: boolean };
}

/** Status + optional connectivity probe result (Settings "Test connection"). */
export interface AIHealthDTO extends AIStatusDTO {
  probe?: { ok: boolean; latencyMs?: number; error?: string };
}

export interface AIChatOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Normalized AI error — codes are stable API contract codes the UI can
 * translate. `detail` is a sanitized provider message (never contains the
 * API key and is truncated).
 */
export class AICallError extends Error {
  code:
    | "AI_NOT_CONFIGURED"
    | "AI_BAD_CONFIG"
    | "AI_AUTH"
    | "AI_RATE_LIMITED"
    | "AI_PROVIDER_RATE_LIMIT"
    | "AI_TIMEOUT"
    | "AI_NETWORK"
    | "AI_PROVIDER_ERROR"
    | "AI_BAD_RESPONSE";
  status: number;
  detail?: string;

  constructor(code: AICallError["code"], status = 500, detail?: string) {
    super(code);
    this.name = "AICallError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export interface AIProvider {
  /** Public, secret-free description of the configured provider. */
  info: AIStatusDTO;
  chatText(prompt: string, opts?: AIChatOptions): Promise<string>;
  /** Best-effort strict JSON answer (JSON mode + fallback parsing). */
  chatJSON(prompt: string, opts?: AIChatOptions): Promise<unknown>;
  /** Voice → text (usable only when info.capabilities.stt is true). */
  transcribe(file: Blob, filename: string): Promise<string>;
  /**
   * Image understanding (usable only when info.capabilities.vision is true).
   * `dataUrl` is a `data:image/…;base64,…` string; the prompt asks a
   * bounded question so providers answer compactly.
   */
  describeImage(dataUrl: string, prompt: string): Promise<string>;
}