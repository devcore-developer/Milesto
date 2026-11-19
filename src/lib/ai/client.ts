// Server-side AI entry points — every call is:
// 1. auth-gated (routes call these only after getSessionUser),
// 2. rate-limited per user per day (cost guard, on top of provider limits),
// 3. audited (compact server log — no prompt content, no secrets).

import { aiConfig } from "@/lib/ai/config";
import { getAIProvider } from "@/lib/ai/provider";
import { AICallError, type AIChatOptions } from "@/lib/ai/types";
import { checkRateLimit } from "@/lib/rate-limit";

function authorize(userId: string): void {
  const cfg = aiConfig();
  if (!checkRateLimit(`ai:${userId}`, cfg.dailyLimit, 24 * 60 * 60_000)) {
    throw new AICallError("AI_RATE_LIMITED", 429);
  }
}

export async function aiChatText(
  userId: string,
  prompt: string,
  opts?: AIChatOptions,
): Promise<string> {
  authorize(userId);
  const provider = getAIProvider();
  console.info(
    `[ai] chatText ${provider.info.provider}/${provider.info.model} user=${userId} chars=${prompt.length}`,
  );
  return provider.chatText(prompt, opts);
}

export async function aiChatJSON<T = unknown>(
  userId: string,
  prompt: string,
  opts?: AIChatOptions,
): Promise<T> {
  authorize(userId);
  const provider = getAIProvider();
  console.info(
    `[ai] chatJSON ${provider.info.provider}/${provider.info.model} user=${userId} chars=${prompt.length}`,
  );
  return (await provider.chatJSON(prompt, opts)) as T;
}

export async function aiTranscribe(
  userId: string,
  file: Blob,
  filename: string,
): Promise<string> {
  authorize(userId);
  const provider = getAIProvider();
  if (!provider.info.capabilities.stt) {
    throw new AICallError(
      "AI_NOT_CONFIGURED",
      400,
      "AI_TRANSCRIBE_MODEL is not set",
    );
  }
  console.info(
    `[ai] transcribe ${provider.info.provider} user=${userId} bytes=${file.size}`,
  );
  return provider.transcribe(file, filename);
}

/** Image understanding — gated on the vision capability flag and the same
 *  per-user daily budget as every other AI call. */
export async function aiVision(
  userId: string,
  dataUrl: string,
  prompt: string,
): Promise<string> {
  authorize(userId);
  const provider = getAIProvider();
  if (!provider.info.capabilities.vision) {
    throw new AICallError("AI_BAD_CONFIG", 400, "provider lacks vision");
  }
  console.info(
    `[ai] vision ${provider.info.provider} user=${userId} bytes=${dataUrl.length}`,
  );
  return provider.describeImage(dataUrl, prompt);
}

/** Map any thrown AI error to the API error shape used by route handlers. */
export function aiErrorStatus(e: unknown): { status: number; code: string } {
  if (e instanceof AICallError) return { status: e.status, code: e.code };
  return { status: 500, code: "SERVER_ERROR" };
}