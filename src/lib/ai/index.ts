// Public surface of the AI foundation (Phase A1).
// Later phases (A2–A6) import from here only — internal layout may change.

export { aiStatus, getAIProvider } from "@/lib/ai/provider";
export {
  aiChatText,
  aiChatJSON,
  aiTranscribe,
  aiErrorStatus,
} from "@/lib/ai/client";
export { AICallError } from "@/lib/ai/types";
export type {
  AICapability,
  AIProvider,
  AIStatusDTO,
  AIHealthDTO,
  AIChatOptions,
} from "@/lib/ai/types";