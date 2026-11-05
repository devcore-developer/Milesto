"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  Flag,
  Link2,
  ListPlus,
  Loader2,
  Pencil,
  Play,
  Receipt,
  StickyNote,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteTask,
  useProject,
  useUpdateProject,
  useUpdateTask,
  useTasks,
} from "@/hooks/use-mylist";
import { formatDate, useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/store";
import type { TaskDTO } from "@/lib/types";
import { formatMoney, invoiceDisplayState } from "@/lib/finance";
import { cn } from "@/lib/utils";
import {
  DueChip,
  PRIORITY_COLORS,
  priorityLabelKey,
} from "@/components/mylist/task/badges";
import {
  DeadlineChip,
  ProjectPriorityDot,
  ProjectProgress,
  ProjectStatusBadge,
} from "@/components/mylist/project/badges";
import { InvoiceStatusBadge } from "@/components/mylist/finance/invoice-badge";
import { ProjectDialog } from "@/components/mylist/project/project-dialog";

function DateInfo({ label, iso }: { label: string; iso: string | null }) {
  const { lang } = useI18n();
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-slate-700" dir="ltr">
        {iso ? formatDate(iso, lang) : "—"}
      </p>
    </div>
  );
}

/** Vertical mini-timeline: milestones (start / deadline / delivery) + task dates. */
function ProjectMiniTimeline({
  startDate,
  deadline,
  deliveryDate,
  tasks,
}: {
  startDate: string | null;
  deadline: string | null;
  deliveryDate: string | null;
  tasks: TaskDTO[];
}) {
  const { t, lang } = useI18n();

  type Entry = { iso: string; label: string; kind: "milestone" | "task"; done?: boolean; overdue?: boolean };
  const entries: Entry[] = [];
  if (startDate)
    entries.push({ iso: startDate, label: t("projects.startDateLabel"), kind: "milestone" });
  for (const task of tasks) {
    if (task.dueDate)
      entries.push({
        iso: task.dueDate,
        label: task.title,
        kind: "task",
        done: task.status === "COMPLETED",
        overdue:
          task.status !== "COMPLETED" &&
          new Date(task.dueDate).getTime() < Date.now(),
      });
  }
  if (deadline)
    entries.push({ iso: deadline, label: t("timeline.deadline"), kind: "milestone" });
  if (deliveryDate)
    entries.push({ iso: deliveryDate, label: t("projects.deliveryDateLabel"), kind: "milestone" });

  entries.sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso));

  if (entries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-400">{t("projects.noDates")}</p>
    );
  }

  return (
    <div className="relative space-y-0" dir="ltr">
      {entries.map((entry, i) => (
        <div key={`${entry.iso}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < entries.length - 1 && (
            <span className="absolute start-[7px] top-4 h-full w-px bg-slate-200" />
          )}
          <span
            className={cn(
              "relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2 bg-white",
              entry.kind === "milestone"
                ? "border-primary"
                : entry.done
                  ? "border-emerald-500 bg-emerald-500"
                  : entry.overdue
                    ? "border-red-400"
                    : "border-slate-300",
            )}
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-sm",
                entry.kind === "milestone"
                  ? "font-semibold text-slate-800"
                  : entry.done
                    ? "text-slate-400 line-through"
                    : "text-slate-600",
              )}
              dir="auto"
            >
              {entry.label}
            </p>
            <p className="text-xs text-slate-400">{formatDate(entry.iso, lang, "d MMM yyyy")}</p>
          </div>
          {entry.kind === "milestone" && <Flag className="size-3.5 shrink-0 text-primary/50" />}
        </div>
      ))}
    </div>
  );
}

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const { t, lang } = useI18n();
  const setView = useUIStore((s) => s.setView);
  const requestNewTask = useUIStore((s) => s.requestNewTask);
  const openEditTask = useUIStore((s) => s.openEditTask);

  const { data, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [editOpen, setEditOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<TaskDTO | null>(null);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const project = data?.project;

  // Unlinked / other-project tasks available for linking
  const { data: allTasksData } = useTasks();
  const linkableTasks = useMemo(
    () => (allTasksData?.tasks ?? []).filter((task) => task.projectId !== projectId),
    [allTasksData, projectId],
  );

  const notesValue = notesDraft ?? project?.notes ?? "";

  if (isLoading || !project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-56 rounded-xl lg:col-span-2" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  const accent = project.color ?? "#1E3A8A";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-500"
            aria-label={t("projects.backToProjects")}
            onClick={() => setView("projects")}
          >
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => requestNewTask(project.id)}
          >
            <ListPlus className="size-4" />
            {t("projects.addTaskToProject")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setEditOpen(true)} aria-label={t("edit")}>
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>

      {project.overdue && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          <CalendarClock className="size-4 shrink-0" />
          {project.daysRemaining !== null &&
            t("projects.overdueBy", { days: Math.abs(project.daysRemaining) })}
        </div>
      )}

      {/* Overview + timeline */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("projects.overview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <ProjectStatusBadge status={project.status} />
              <ProjectPriorityDot priority={project.priority} />
              <DeadlineChip
                deadline={project.deadline}
                overdue={project.overdue}
                daysRemaining={project.daysRemaining}
              />
              {project.client && (
                <span className="inline-flex max-w-48 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                  <Building2 className="size-3 shrink-0" />
                  <span className="truncate">
                    {project.client.name || t("projects.clientLabel")}
                  </span>
                </span>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-medium text-slate-500">{t("projects.progress")}</span>
                <span className="text-2xl font-bold tracking-tight text-primary">
                  {project.progressPct}%
                </span>
              </div>
              <ProjectProgress
                pct={project.progressPct}
                done={project.taskDone}
                total={project.taskTotal}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <DateInfo label={t("projects.startDateLabel")} iso={project.startDate} />
              <DateInfo label={t("projects.deadlineLabel")} iso={project.deadline} />
              <DateInfo label={t("projects.deliveryDateLabel")} iso={project.deliveryDate} />
              <div>
                <p className="text-xs font-medium text-slate-400">{t("projects.checklist")}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">
                  {t("projects.tasksDone", {
                    done: project.taskDone,
                    total: project.taskTotal,
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="size-4 text-primary" />
              {t("projects.timelineSection")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectMiniTimeline
              startDate={project.startDate}
              deadline={project.deadline}
              deliveryDate={project.deliveryDate}
              tasks={project.tasks}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Financials (Phase 4) ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="size-4 text-primary" />
              {t("finance.financialsSection")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t("finance.agreedPrice")}</span>
              <span className="font-medium tabular-nums text-slate-800" dir="ltr">
                {formatMoney(project.agreedPrice, lang)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t("finance.additionalCharges")}</span>
              <span className="font-medium tabular-nums text-slate-800" dir="ltr">
                {formatMoney(project.additionalCharges, lang)}
              </span>
            </div>
            {project.additionalNotes && (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {project.additionalNotes}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t("finance.discount")}</span>
              <span className="font-medium tabular-nums text-amber-700" dir="ltr">
                −{formatMoney(project.discount, lang)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
              <span className="font-medium text-slate-600">{t("finance.projectTotal")}</span>
              <span className="text-lg font-bold tabular-nums text-primary" dir="ltr">
                {formatMoney(project.totalValue, lang)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t("finance.projectPaid")}</span>
              <span className="flex items-center gap-1.5 font-medium tabular-nums text-emerald-600" dir="ltr">
                <Wallet className="size-3.5" />
                {formatMoney(project.paid, lang)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t("finance.projectRemaining")}</span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  project.remaining > 0 ? "text-red-600" : "text-emerald-600",
                )}
                dir="ltr"
              >
                {formatMoney(project.remaining, lang)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4 text-primary" />
              {t("finance.linkedInvoices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.invoices.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                {t("finance.noLinkedInvoices")}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {project.invoices.map((invoice) => {
                  const display = invoiceDisplayState({
                    status: invoice.status,
                    total: invoice.total,
                    amountPaid: invoice.amountPaid,
                    dueDate: invoice.dueDate,
                  });
                  return (
                    <div key={invoice.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700" dir="ltr">
                          {invoice.number}
                        </p>
                        <p className="text-xs text-slate-400">
                          {invoice.client?.name ?? t("invoices.noClient")} ·{" "}
                          {formatDate(invoice.issueDate, lang)}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="text-sm font-semibold tabular-nums text-slate-800" dir="ltr">
                          {formatMoney(invoice.total, lang)}
                        </p>
                        <p className="text-xs tabular-nums text-emerald-600" dir="ltr">
                          {t("finance.projectPaid")}: {formatMoney(invoice.amountPaid, lang)}
                        </p>
                      </div>
                      <InvoiceStatusBadge status={display} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task checklist */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-primary" />
            {t("projects.checklist")}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => requestNewTask(project.id)}
          >
            <ListPlus className="size-3.5" />
            {t("projects.addTaskToProject")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <ClipboardList className="size-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">{t("projects.noTasks")}</p>
              <p className="text-xs text-slate-400">{t("projects.noTasksHint")}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {project.tasks.map((task) => (
                <div key={task.id} className="group flex items-center gap-3 py-2.5">
                  <Checkbox
                    checked={task.status === "COMPLETED"}
                    disabled={updateTask.isPending}
                    onCheckedChange={(checked) =>
                      updateTask.mutate({
                        id: task.id,
                        data: { status: checked ? "COMPLETED" : "TODO" },
                      })
                    }
                    aria-label={task.title}
                    className="shrink-0"
                  />
                  <button
                    className="min-w-0 flex-1 text-start"
                    onClick={() => openEditTask(task)}
                  >
                    <span
                      className={cn(
                        "block truncate text-sm",
                        task.status === "COMPLETED"
                          ? "text-slate-400 line-through"
                          : "text-slate-700",
                      )}
                    >
                      {task.title}
                    </span>
                  </button>
                  <span
                    className="hidden size-2 shrink-0 rounded-full sm:block"
                    style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                    title={t(priorityLabelKey(task.priority))}
                  />
                  {task.dueDate && <DueChip isoDateStr={task.dueDate} />}
                  {task.status !== "COMPLETED" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden size-7 shrink-0 text-slate-300 hover:text-emerald-600 group-hover:block"
                      aria-label={t("tasks.statusCompleted")}
                      onClick={() =>
                        updateTask.mutate({ id: task.id, data: { status: "COMPLETED" } })
                      }
                    >
                      <Play className="size-3.5" />
                    </Button>
                  )}
                  <button
                    onClick={() => setDeletingTask(task)}
                    className="shrink-0 text-slate-300 transition-colors hover:text-red-500"
                    aria-label={t("delete")}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Link existing task */}
          {linkableTasks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <Link2 className="size-4 shrink-0 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">
                {t("projects.linkExistingTask")}
              </span>
              <Select
                value="__none"
                onValueChange={(taskId) => {
                  if (!taskId || taskId === "__none") return;
                  updateTask.mutate({ id: taskId, data: { projectId: project.id } });
                }}
              >
                <SelectTrigger className="h-8 w-full max-w-56 text-xs">
                  <SelectValue placeholder={t("projects.linkTaskPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none" disabled>
                    {t("projects.linkTaskPlaceholder")}
                  </SelectItem>
                  {linkableTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="size-4 text-primary" />
            {t("projects.notesSection")}
          </CardTitle>
          {notesDraft !== null && notesDraft !== (project.notes ?? "") && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setNotesDraft(null)}
              >
                {t("cancel")}
              </Button>
              <Button
                size="sm"
                disabled={updateProject.isPending}
                onClick={() =>
                  updateProject.mutate(
                    {
                      id: project.id,
                      data: { notes: notesDraft.trim() ? notesDraft.trim() : null },
                    },
                    { onSuccess: () => setNotesDraft(null) },
                  )
                }
              >
                {updateProject.isPending && <Loader2 className="size-3.5 animate-spin" />}
                {t("save")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Textarea
            value={notesValue}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder={t("projects.notesPlaceholder")}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <ProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />

      {/* Task delete confirmation */}
      <AlertDialog open={!!deletingTask} onOpenChange={(o) => !o && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tasks.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTask?.title && `"${deletingTask.title}" — `}
              {t("tasks.deleteConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deletingTask) deleteTask.mutate({ id: deletingTask.id });
                setDeletingTask(null);
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}