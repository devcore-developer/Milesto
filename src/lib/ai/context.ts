// Assistant context builder (Phase A6) — server-only.
// Concise DETERMINISTIC context, never the full history:
//   1. last 10 messages (role + content, length-capped per message)
//   2. project facts snapshot from real rows
//   3. approved-plan digest (titles only)
// The stored brief stays complete in the DB — only the AI request is capped.
import { db } from "@/lib/db";
import { draftPayloadOf } from "@/lib/serializers";
import { isProjectOverdue } from "@/lib/project-utils";

const MAX_CONTEXT_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1_200;

export interface AssistantContext {
  factsBlock: string;
  history: { role: "USER" | "ASSISTANT"; content: string }[];
}

export async function buildAssistantContext(
  userId: string,
  projectId: string,
  conversationId: string | null,
): Promise<AssistantContext> {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    include: {
      tasks: {
        include: { subtasks: true },
        orderBy: { dueDate: "asc" },
      },
    },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const tasks = project.tasks;
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const overdue = tasks.filter(
    (t) =>
      t.status !== "COMPLETED" &&
      t.dueDate &&
      t.dueDate.getTime() < new Date().setHours(0, 0, 0, 0),
  );
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

  const facts: string[] = [
    `Project: ${project.name}`,
    `Status: ${project.status}; priority ${project.priority}`,
    `Start: ${project.startDate?.toISOString().slice(0, 10) ?? "not set"}; deadline: ${project.deadline?.toISOString().slice(0, 10) ?? "not set"}`,
    `Progress: ${progressPct}% (${done}/${total} tasks completed, ${inProgress} in progress)`,
    `Overdue (${overdue.length}): ${overdue.slice(0, 5).map((t) => `${t.title} (due ${t.dueDate?.toISOString().slice(0, 10)})`).join("; ") || "none"}`,
  ];
  const upcoming = tasks
    .filter((t) => t.status !== "COMPLETED" && t.dueDate)
    .slice(0, 5)
    .map((t) => `${t.title} (due ${t.dueDate?.toISOString().slice(0, 10)})`);
  if (upcoming.length) facts.push(`Next deadlines: ${upcoming.join("; ")}`);

  // Approved-plan digest (titles only)
  const approved = await db.aIPlanDraft.findFirst({
    where: { projectId, status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
  });
  if (approved) {
    const plan = draftPayloadOf(approved);
    const digest = plan.modules
      .map((m) => `${m.name}: ${m.tasks.map((t) => t.title).join(", ")}`)
      .join(" | ");
    if (digest) facts.push(`Approved plan digest: ${digest.slice(0, 3_000)}`);
  }

  let history: AssistantContext["history"] = [];
  if (conversationId) {
    const conv = await db.aIConversation.findFirst({
      where: { id: conversationId, projectId, project: { userId } },
      include: { messages: { orderBy: { createdAt: "desc" }, take: MAX_CONTEXT_MESSAGES } },
    });
    if (conv) {
      history = conv.messages
        .reverse()
        .map((m) => ({
          role: m.role as "USER" | "ASSISTANT",
          content: m.content.slice(0, MAX_MESSAGE_CHARS),
        }));
    }
  }

  return { factsBlock: facts.join("\n"), history };
}