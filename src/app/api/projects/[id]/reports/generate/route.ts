import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { validationError, zodIssues, reportGenerateSchema } from "@/lib/validation";
import { textSection, listSection, newSectionId } from "@/lib/documents";
import type { DocSection, DocumentContent } from "@/lib/types";
import { isProjectOverdue } from "@/lib/project-utils";

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/:id/reports/generate — DETERMINISTIC progress /
// completion report from REAL rows (works with no AI key — Tier A).
// Lands in the existing Documents module with per-type versioning.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const project = await db.project.findFirst({
      where: { id, userId: user.id },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!project) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const parsed = reportGenerateSchema.safeParse(
      await req.json().catch(() => ({})),
    );
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const { type, language } = parsed.data;

    const tasks = await db.task.findMany({
      where: { projectId: id, userId: user.id },
      include: { subtasks: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });

    const L = (en: string, ar: string) => (language === "ar" ? ar : en);
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "COMPLETED");
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
    const todo = tasks.filter((t) => t.status === "TODO");
    const todayMid = new Date().setHours(0, 0, 0, 0);
    const overdue = tasks.filter(
      (t) => t.status !== "COMPLETED" && t.dueDate && t.dueDate.getTime() < todayMid,
    );
    const progressPct = total === 0 ? 0 : Math.round((done.length / total) * 100);
    const subtaskTotal = tasks.reduce((n, t) => n + t.subtasks.length, 0);
    const subtaskDone = tasks.reduce(
      (n, t) => n + t.subtasks.filter((s) => s.completed).length,
      0,
    );

    const sections: DocSection[] = [];
    sections.push(
      textSection(
        L("Overview", "نظرة عامة"),
        language === "ar"
          ? `تقرير ${type === "COMPLETION_REPORT" ? "إكمال" : "تقدم"} لمشروع «${project.name}». نسبة الإنجاز ${progressPct}% (${done.length} من ${total} مهمة).`
          : `${type === "COMPLETION_REPORT" ? "Completion" : "Progress"} report for “${project.name}”. Overall progress is ${progressPct}% (${done.length} of ${total} tasks completed).`,
      ),
    );
    const statsId = newSectionId();
    sections.push({
      id: statsId,
      kind: "table",
      heading: L("Numbers", "الأرقام"),
      columns: [L("Metric", "المؤشر"), L("Value", "القيمة")],
      rows: [
        [L("Total tasks", "إجمالي المهام"), String(total)],
        [L("Completed", "مكتملة"), String(done.length)],
        [L("In progress", "قيد التنفيذ"), String(inProgress.length)],
        [L("Not started", "لم تبدأ"), String(todo.length)],
        [L("Overdue", "متأخرة"), String(overdue.length)],
        [L("Subtasks done", "المهام الفرعية المكتملة"), `${subtaskDone}/${subtaskTotal}`],
        [L("Overall progress", "نسبة الإنجاز"), `${progressPct}%`],
      ],
    });
    const pushTaskList = (headingEn: string, headingAr: string, rows: typeof tasks) => {
      if (rows.length === 0) return;
      sections.push(listSection(L(headingEn, headingAr), rows.map((t) => `${t.title}${t.dueDate ? ` — ${t.dueDate.toISOString().slice(0, 10)}` : ""}`)));
    };
    pushTaskList("Completed work", "الأعمال المكتملة", done);
    pushTaskList("In progress", "قيد التنفيذ", inProgress);
    pushTaskList("Remaining", "المتبقي", todo);
    pushTaskList("Overdue items", "بنود متأخرة", overdue);

    const content: DocumentContent = { sections };

    const previous = await db.documentRecord.findFirst({
      where: { userId: user.id, projectId: id, type },
      orderBy: [{ versionNo: "desc" }, { createdAt: "desc" }],
      select: { id: true, versionNo: true },
    });
    const prefix = `DOC-${new Date().getFullYear()}-`;
    const count = await db.documentRecord.count({
      where: { userId: user.id, number: { startsWith: prefix } },
    });
    let number = `${prefix}${String(count + 1).padStart(4, "0")}`;
    while (await db.documentRecord.findUnique({ where: { number } })) {
      number = `${prefix}${String(Number(number.slice(-4)) + 1).padStart(4, "0")}`;
    }

    const title = language === "ar"
      ? `${type === "COMPLETION_REPORT" ? "تقرير إكمال" : "تقرير تقدم"} — ${project.name}`
      : `${type === "COMPLETION_REPORT" ? "Completion Report" : "Progress Report"} — ${project.name}`;

    const doc = await db.documentRecord.create({
      data: {
        type,
        number,
        title,
        language,
        userId: user.id,
        clientId: project.clientId,
        projectId: id,
        content: JSON.stringify(content),
        versionNo: (previous?.versionNo ?? 0) + 1,
        previousVersionId: previous?.id ?? null,
        aiTrace: null,
      },
    });

    return NextResponse.json(
      { document: { id: doc.id, number: doc.number, title: doc.title, versionNo: doc.versionNo } },
      { status: 201 },
    );
  } catch (e) {
    console.error("[reports generate]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}