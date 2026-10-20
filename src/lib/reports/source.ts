// طبقة القراءة الدفاعية من الـ Providers — نفس أسلوب Phase 8
// لو أسماء حقول الموديلات عندك مختلفة، التعديل بيتم هنا وبس
import { isDoneTaskStatus, normalizePriority, readArray } from "@/lib/timeline/adapters";
import type { ReportNote, ReportTask } from "@/types/reports";

function asRec(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

function readStr(source: unknown, keys: string[]): string | undefined {
  const rec = asRec(source);
  if (!rec) return undefined;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return undefined;
}

function readDateField(source: unknown, keys: string[]): string | undefined {
  const raw = readStr(source, keys);
  return raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : undefined;
}

function readNumberField(source: unknown, keys: string[]): number | undefined {
  const rec = asRec(source);
  if (!rec) return undefined;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

export function readArrayFirst(source: unknown, keys: string[]): unknown[] {
  for (const k of keys) {
    const arr = readArray<unknown>(source, k);
    if (arr.length > 0) return arr;
  }
  return [];
}

export function buildReportTasks(projectsRaw: unknown): ReportTask[] {
  const out: ReportTask[] = [];
  const seen = new Set<string>();
  const push = (t: unknown, fallbackProjectId: string) => {
    const rec = asRec(t);
    if (!rec) return;
    const id = readStr(rec, ["id"]);
    if (!id || seen.has(id)) return;
    seen.add(id);
    const status = readStr(rec, ["status"]) ?? "";
    const depsRaw = Array.isArray(rec["dependencies"]) ? (rec["dependencies"] as unknown[]) : [];
    const dependencies = Array.from(
      new Set(
        depsRaw
          .map((d) => (typeof d === "string" ? d : readStr(d, ["id"])))
          .filter((x): x is string => Boolean(x))
          .filter((d) => d !== id)
      )
    );
    out.push({
      id,
      projectId: readStr(rec, ["projectId"]) ?? fallbackProjectId,
      phaseId: readStr(rec, ["phaseId"]),
      title: readStr(rec, ["title", "name"]) ?? id,
      status,
      priority: normalizePriority(readStr(rec, ["priority"])),
      startDate: readDateField(rec, ["startDate"]),
      dueDate: readDateField(rec, ["dueDate", "endDate"]),
      done: isDoneTaskStatus(status) || rec["completed"] === true,
      completedAt: readDateField(rec, ["completedAt", "completedDate", "doneAt"]),
      assignee: readStr(rec, ["assignee", "owner", "assigneeName"]),
      weight: readNumberField(rec, ["weight"]),
      dependencies,
    });
  };
  for (const t of readArray<unknown>(projectsRaw, "tasks")) push(t, readStr(t, ["projectId"]) ?? "");
  for (const p of readArray<unknown>(projectsRaw, "projects")) {
    const pid = readStr(p, ["id"]) ?? "";
    for (const t of readArray<unknown>(p, "tasks")) push(t, pid);
  }
  return out;
}

export function buildReportNotes(notesRaw: unknown): ReportNote[] {
  return readArray<unknown>(notesRaw, "notes")
    .map((n) => ({
      id: readStr(n, ["id"]) ?? "",
      projectId: readStr(n, ["projectId"]),
      title: readStr(n, ["title", "name"]),
      content: readStr(n, ["content", "body", "text", "description"]),
      updatedAt: readDateField(n, ["updatedAt", "createdAt", "date"]),
    }))
    .filter((n) => n.id !== "" || Boolean(n.content));
}

export interface QualityRawData {
  cases: unknown[];
  bugs: unknown[]; // أخطاء/عيوب
  gates: unknown[];
  executions: unknown[];
}

export function buildQualityRaw(testingRaw: unknown): QualityRawData {
  return {
    cases: readArrayFirst(testingRaw, ["testCases", "tests", "cases"]),
    bugs: readArrayFirst(testingRaw, ["bugs", "issues", "defects"]),
    gates: readArrayFirst(testingRaw, ["qualityGates", "gates"]),
    executions: readArrayFirst(testingRaw, ["executions", "runs", "testRuns"]),
  };
}