// Document generation core (Phase 6) — shared by the create dialog, the
// editor and (indirectly) the PDF template. Pure functions, client-safe:
// no server-only imports. Every document is stored as a flat list of
// sections (text / list / table) which the editor can freely add, remove,
// reorder and edit, and which the PDF template renders in a premium
// My List branded layout.
import { formatMoney } from "@/lib/finance";
import type {
  DocSection,
  DocSectionList,
  DocSectionTable,
  DocSectionText,
  DocumentContent,
  DocumentLanguage,
  DocumentType,
} from "@/lib/types";

// ───────────────────────── ids ─────────────────────────

let sectionSeq = 0;

/** Unique-enough section id for React keys and editor operations. */
export function newSectionId(): string {
  sectionSeq += 1;
  return `sec-${Date.now().toString(36)}-${sectionSeq}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

// ───────────────────────── factories ─────────────────────────

export function textSection(heading: string, body: string): DocSectionText {
  return { id: newSectionId(), kind: "text", heading, body };
}

export function listSection(heading: string, items: string[]): DocSectionList {
  return { id: newSectionId(), kind: "list", heading, items };
}

export function tableSection(
  heading: string,
  columns: string[],
  rows: string[][],
): DocSectionTable {
  return { id: newSectionId(), kind: "table", heading, columns, rows };
}

/** Blank section of a given kind, localized headings included. */
export function emptySection(
  kind: DocSection["kind"],
  lang: DocumentLanguage,
): DocSection {
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  if (kind === "list") return listSection(L("New list", "قائمة جديدة"), []);
  if (kind === "table") {
    return tableSection(
      L("New table", "جدول جديد"),
      [L("Item", "البند"), L("Details", "التفاصيل")],
      [],
    );
  }
  return textSection(L("New section", "قسم جديد"), "");
}

// ───────────────────────── date helper ─────────────────────────

/** Locale-aware short date (latin digits in Arabic too). */
export function fmtDocDate(
  iso: string | null | undefined,
  lang: DocumentLanguage,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

/** Locale-aware long date used in report bodies. */
export function fmtDocDateLong(
  iso: string | null | undefined,
  lang: DocumentLanguage,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

// ───────────────────────── inputs ─────────────────────────

/** The slice of the project a generator needs (ProjectDTO compatible). */
export interface DocProjectInfo {
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  deadline: string | null;
  deliveryDate: string | null;
  notes: string | null;
  agreedPrice: number;
  additionalCharges: number;
  discount: number;
  totalValue: number;
  clientName?: string | null;
}

/** The slice of a task a generator needs (TaskDTO compatible). */
export interface DocTaskInfo {
  id: string;
  title: string;
  // TODO | IN_PROGRESS | COMPLETED
  status: string;
  dueDate: string | null;
}

export interface BuildDocContentInput {
  type: DocumentType;
  lang: DocumentLanguage;
  project?: DocProjectInfo | null;
  tasks?: DocTaskInfo[];
  /** Completion report — ids of completed tasks to include (default: all). */
  selectedTaskIds?: string[];
  /** SOW — include the "Pricing & payment terms" section. */
  includePricing?: boolean;
  /** SOW — currency used to format the price (defaults to app currency). */
  currency?: string;
  /** Completion report — explicit progress override (0–100). */
  progressPct?: number | null;
  now?: Date;
}

// ───────────────────────── titles ─────────────────────────

/** Sensible default title for a new document. */
export function defaultDocTitle(
  type: DocumentType,
  projectName: string | null | undefined,
  lang: DocumentLanguage,
): string {
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const project = projectName?.trim();
  switch (type) {
    case "SCOPE_OF_WORK":
      return project
        ? `${L("Scope of Work", "نطاق العمل")} — ${project}`
        : L("Scope of Work", "نطاق العمل");
    case "COMPLETION_REPORT":
      return project
        ? `${L("Work Completion Report", "تقرير إتمام العمل")} — ${project}`
        : L("Work Completion Report", "تقرير إتمام العمل");
    case "PROGRESS_REPORT":
      return project
        ? `${L("Project Progress Report", "تقرير تقدم المشروع")} — ${project}`
        : L("Project Progress Report", "تقرير تقدم المشروع");
    default:
      return project
        ? `${L("Project Report", "تقرير المشروع")} — ${project}`
        : L("Project Report", "تقرير المشروع");
  }
}

// ───────────────────────── builder ─────────────────────────

function taskStats(tasks: DocTaskInfo[], now: Date) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const todo = tasks.filter((t) => t.status === "TODO").length;
  const open = tasks.filter((t) => t.status !== "COMPLETED");
  const overdue = open.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    if (Number.isNaN(d.getTime())) return false;
    d.setHours(23, 59, 59, 999);
    return d.getTime() < now.getTime();
  });
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, inProgress, todo, open, overdue, pct };
}

/**
 * Build the default section content for a document type. Everything it
 * generates is editable afterwards — the generators only provide a
 * professional starting point seeded from the linked project/tasks.
 */
export function buildDocumentContent(input: BuildDocContentInput): DocumentContent {
  const { type, lang } = input;
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const project = input.project ?? null;
  const tasks = input.tasks ?? [];
  const now = input.now ?? new Date();
  const name = project?.name?.trim() || L("the project", "المشروع");
  const sections: DocSection[] = [];

  if (type === "SCOPE_OF_WORK") {
    // 1. Project overview
    sections.push(
      textSection(
        L("Project Overview", "نظرة عامة على المشروع"),
        project?.description?.trim() ||
          L(
            `This document defines the scope of work for "${name}". It describes the objectives, the scope of services, the deliverables, the timeline and the terms agreed between the parties.`,
            `يحدد هذا المستند نطاق العمل الخاص بـ«${name}»، ويوضح الأهداف ونطاق الخدمات والتسليمات والجدول الزمني والشروط المتفق عليها بين الطرفين.`,
          ),
      ),
    );

    // 2. Objectives
    sections.push(
      listSection(
        L("Objectives", "الأهداف"),
        [
          L(
            `Deliver "${name}" with the agreed quality standards.`,
            `تنفيذ «${name}» وفق معايير الجودة المتفق عليها.`,
          ),
          L(
            "Complete the work within the agreed timeline.",
            "إنهاء العمل خلال الجدول الزمني المتفق عليه.",
          ),
          L(
            "Maintain clear communication and regular progress updates throughout the project.",
            "الحفاظ على تواصل واضح وتحديثات دورية للتقدم طوال فترة المشروع.",
          ),
        ],
      ),
    );

    // 3. Scope of services
    sections.push(
      listSection(
        L("Scope of Services", "نطاق الخدمات"),
        [
          L(
            "Initial analysis and requirements gathering.",
            "التحليل الأولي وجمع المتطلبات.",
          ),
          L(
            `Execution of the core work items of ${name}.`,
            `تنفيذ عناصر العمل الأساسية الخاصة بـ${name}.`,
          ),
          L(
            "Review rounds and corrections until final approval.",
            "جولات مراجعة وتعديلات حتى الموافقة النهائية.",
          ),
        ],
      ),
    );

    // 4. Deliverables
    sections.push(
      listSection(
        L("Deliverables", "التسليمات"),
        [
          L(
            `All deliverables of ${name} as described in the scope of services.`,
            `جميع مخرجات ${name} كما هي موصوفة في نطاق الخدمات.`,
          ),
          L(
            "Source files and final assets upon final approval.",
            "ملفات المصدر والملفات النهائية بعد الموافقة النهائية.",
          ),
        ],
      ),
    );

    // 5. Features & requirements — seeded from the project tasks
    const features = tasks
      .slice(0, 10)
      .map((t) => t.title.trim())
      .filter(Boolean);
    sections.push(
      listSection(
        L("Features & Requirements", "الميزات والمتطلبات"),
        features.length
          ? features
          : [
              L(
                "Requirements are captured in the project task list.",
                "تُوثَّق المتطلبات في قائمة مهام المشروع.",
              ),
            ],
      ),
    );

    // 6. Timeline & milestones
    const start = project?.startDate ?? null;
    const end = project?.deliveryDate ?? project?.deadline ?? null;
    sections.push(
      tableSection(
        L("Timeline & Milestones", "الجدول الزمني والمحطات"),
        [L("Milestone", "المحطة"), L("Target date", "التاريخ المستهدف"), L("Notes", "ملاحظات")],
        [
          [
            L("Project kickoff", "انطلاق المشروع"),
            fmtDocDate(start, lang),
            L("Work begins", "بدء التنفيذ"),
          ],
          [
            L("Final delivery & handover", "التسليم النهائي والتسلم"),
            fmtDocDate(end, lang),
            L("Final review and handover", "المراجعة النهائية والتسلم"),
          ],
        ],
      ),
    );

    // 7. Pricing & payment terms (optional)
    if (input.includePricing && project && project.totalValue > 0) {
      const money = formatMoney(project.totalValue, lang, input.currency);
      sections.push(
        textSection(
          L("Pricing & Payment Terms", "السعر وشروط الدفع"),
          L(
            `Total project value: ${money}. Payment is made according to the schedule agreed between the parties.`,
            `إجمالي قيمة المشروع: ${money}. يتم الدفع وفق الجدول المتفق عليه بين الطرفين.`,
          ),
        ),
      );
    }

    // 8. Exclusions & limitations
    sections.push(
      listSection(
        L("Exclusions & Limitations", "الاستثناءات والحدود"),
        [
          L(
            "Any services not explicitly listed in the scope of services.",
            "أي خدمات غير مذكورة صراحةً في نطاق الخدمات.",
          ),
          L(
            "Third-party fees, licenses or subscriptions.",
            "رسوم الجهات الخارجية أو التراخيص أو الاشتراكات.",
          ),
          L(
            "Major changes requested after final approval may require a separate agreement.",
            "التغييرات الجوهرية بعد الموافقة النهائية قد تتطلب اتفاقًا منفصلًا.",
          ),
        ],
      ),
    );

    // 9. Notes & additional terms
    sections.push(
      textSection(L("Notes & Additional Terms", "ملاحظات وشروط إضافية"), ""),
    );

    return { sections };
  }

  if (type === "COMPLETION_REPORT") {
    const stats = taskStats(tasks, now);
    const selected = new Set(
      input.selectedTaskIds ??
        tasks.filter((t) => t.status === "COMPLETED").map((t) => t.id),
    );
    const completed = tasks.filter(
      (t) => t.status === "COMPLETED" && selected.has(t.id),
    );
    const remaining = tasks.filter((t) => t.status !== "COMPLETED");
    const pct =
      input.progressPct != null
        ? Math.min(100, Math.max(0, Math.round(input.progressPct)))
        : stats.pct;

    // 1. Completed tasks (selected)
    sections.push(
      listSection(
        L("Completed Tasks", "المهام المكتملة"),
        completed.length
          ? completed.map((t) => t.title.trim())
          : [
              L(
                "No completed tasks were recorded at the time of this report.",
                "لم تُسجَّل أي مهام مكتملة وقت إعداد هذا التقرير.",
              ),
            ],
      ),
    );

    // 2-4. Delivered features / modifications / technical changes
    sections.push(listSection(L("Delivered Features", "الميزات المسلَّمة"), []));
    sections.push(
      listSection(L("Implemented Modifications", "التعديلات المنفَّذة"), []),
    );
    sections.push(listSection(L("Technical Changes", "التغييرات التقنية"), []));

    // 5. Progress
    sections.push(
      textSection(
        L("Progress", "نسبة الإنجاز"),
        L(
          `Overall completion: ${pct}% (${stats.done} of ${stats.total} tasks completed).`,
          `نسبة الإنجاز الإجمالية: ${pct}% (تم إنجاز ${stats.done} من ${stats.total} مهمة).`,
        ),
      ),
    );

    // 6. Remaining tasks
    sections.push(
      listSection(
        L("Remaining Tasks", "المهام المتبقية"),
        remaining.length
          ? remaining.map((t) => t.title.trim())
          : [
              L(
                "No remaining tasks — all tasks are complete.",
                "لا توجد مهام متبقية — جميع المهام مكتملة.",
              ),
            ],
      ),
    );

    // 7. Notes & recommendations
    sections.push(
      textSection(L("Notes & Recommendations", "ملاحظات وتوصيات"), ""),
    );

    return { sections };
  }

  if (type === "PROGRESS_REPORT") {
    const stats = taskStats(tasks, now);
    const pending = stats.open.filter((t) => !stats.overdue.includes(t));

    // 1. Project overview
    sections.push(
      textSection(
        L("Project Overview", "نظرة عامة على المشروع"),
        project?.description?.trim() ||
          L(
            `Progress report for "${name}" — a snapshot of what has been completed, what is in progress and what is still pending.`,
            `تقرير تقدم لمشروع «${name}» — لمحة عما تم إنجازه وما هو قيد التنفيذ وما لم يُنجز بعد.`,
          ),
      ),
    );

    // 2. Current progress
    sections.push(
      textSection(
        L("Current Progress", "التقدم الحالي"),
        L(
          `${stats.pct}% of the project tasks are completed (${stats.done} of ${stats.total}). ${stats.inProgress} task(s) in progress.`,
          `اكتمل ${stats.pct}% من مهام المشروع (${stats.done} من ${stats.total}). وعدد المهام قيد التنفيذ ${stats.inProgress}.`,
        ),
      ),
    );

    // 3. Completed tasks
    const doneTasks = tasks.filter((t) => t.status === "COMPLETED");
    sections.push(
      listSection(
        L("Completed Tasks", "المهام المكتملة"),
        doneTasks.length
          ? doneTasks.map((t) => t.title.trim())
          : [L("No tasks completed yet.", "لم تُكتمل أي مهام بعد.")],
      ),
    );

    // 4. Pending tasks
    sections.push(
      listSection(
        L("Pending Tasks", "المهام المعلَّقة"),
        pending.length
          ? pending.map((t) => t.title.trim())
          : [L("No pending tasks.", "لا توجد مهام معلَّقة.")],
      ),
    );

    // 5. Overdue tasks
    sections.push(
      listSection(
        L("Overdue Tasks", "المهام المتأخرة"),
        stats.overdue.length
          ? stats.overdue.map(
              (t) => `${t.title.trim()} (${L("was due", "كان مستحقًا")} ${fmtDocDate(t.dueDate, lang)})`,
            )
          : [L("No overdue tasks.", "لا توجد مهام متأخرة.")],
      ),
    );

    // 6. Timeline status
    let timeline = L("No deadline is set for this project.", "لا يوجد موعد نهائي محدد لهذا المشروع.");
    const deadline = project?.deadline ?? null;
    if (deadline) {
      const d = new Date(deadline);
      if (!Number.isNaN(d.getTime())) {
        const dayMs = 24 * 60 * 60 * 1000;
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.round((target.getTime() - today.getTime()) / dayMs);
        if (diff > 0) {
          timeline = L(
            `Deadline ${fmtDocDate(deadline, lang)} — ${diff} day(s) remaining.`,
            `الموعد النهائي ${fmtDocDate(deadline, lang)} — متبقٍ ${diff} يوم.`,
          );
        } else if (diff === 0) {
          timeline = L(
            `Deadline is today (${fmtDocDate(deadline, lang)}).`,
            `الموعد النهائي اليوم (${fmtDocDate(deadline, lang)}).`,
          );
        } else {
          timeline = L(
            `Deadline ${fmtDocDate(deadline, lang)} — overdue by ${Math.abs(diff)} day(s).`,
            `الموعد النهائي ${fmtDocDate(deadline, lang)} — متأخر بـ ${Math.abs(diff)} يوم.`,
          );
        }
      }
    }
    sections.push(textSection(L("Timeline Status", "حالة الجدول الزمني"), timeline));

    // 7. Progress statistics
    sections.push(
      tableSection(
        L("Progress Statistics", "إحصائيات التقدم"),
        [L("Metric", "المؤشر"), L("Value", "القيمة")],
        [
          [L("Total tasks", "إجمالي المهام"), String(stats.total)],
          [L("Completed", "مكتملة"), String(stats.done)],
          [L("In progress", "قيد التنفيذ"), String(stats.inProgress)],
          [L("Not started", "لم تبدأ"), String(stats.todo)],
          [L("Overdue", "متأخرة"), String(stats.overdue.length)],
          [L("Completion", "نسبة الإنجاز"), `${stats.pct}%`],
        ],
      ),
    );

    // 8. Project notes
    sections.push(
      textSection(L("Project Notes", "ملاحظات المشروع"), project?.notes?.trim() ?? ""),
    );

    return { sections };
  }

  // CUSTOM_REPORT — a flexible starting point the user reshapes freely.
  sections.push(textSection(L("Summary", "الملخص"), ""));
  sections.push(listSection(L("Details", "التفاصيل"), []));
  sections.push(textSection(L("Notes", "ملاحظات"), ""));
  return { sections };
}

// ───────────────────────── helpers for the editor ─────────────────────────

/** Parse stored content JSON defensively (never throws). */
export function parseDocumentContent(raw: string | null | undefined): DocumentContent {
  if (!raw) return { sections: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<DocumentContent>;
    if (!parsed || !Array.isArray(parsed.sections)) return { sections: [] };
    return { sections: parsed.sections as DocSection[] };
  } catch {
    return { sections: [] };
  }
}

/** True when a section has nothing to render (PDF skips it gracefully). */
export function isSectionEmpty(section: DocSection): boolean {
  if (section.kind === "text") return !section.body.trim();
  if (section.kind === "list") return section.items.length === 0;
  return section.columns.length === 0 || section.rows.length === 0;
}