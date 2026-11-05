"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarRange,
  FolderKanban,
  Loader2,
  ListFilter,
  Plus,
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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteProject,
  useProjects,
} from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/store";
import { formatMoney } from "@/lib/finance";
import {
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  type ProjectDTO,
  type ProjectStatus,
  type TaskPriority,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DeadlineChip,
  ProjectProgress,
  ProjectStatusBadge,
  ProjectPriorityDot,
  projectStatusLabelKey,
  priorityLabelKeyFor,
} from "@/components/mylist/project/badges";
import { ProjectDialog } from "@/components/mylist/project/project-dialog";

type SortKey = "newest" | "deadline" | "progress" | "name";

const ALL = "__all__";
const NO_PROJECT_COLOR = "#1E3A8A";

function sortProjects(
  projects: ProjectDTO[],
  sort: SortKey,
  locale: string,
): ProjectDTO[] {
  const arr = [...projects];
  const dl = (p: ProjectDTO) =>
    p.deadline ? Date.parse(p.deadline) : Number.POSITIVE_INFINITY;
  switch (sort) {
    case "newest":
      arr.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      break;
    case "deadline":
      arr.sort((a, b) => dl(a) - dl(b));
      break;
    case "progress":
      arr.sort((a, b) => b.progressPct - a.progressPct);
      break;
    case "name":
      arr.sort((a, b) => a.name.localeCompare(b.name, locale));
      break;
  }
  return arr;
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full min-w-32 sm:w-auto">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectDTO;
  onEdit: (p: ProjectDTO) => void;
  onDelete: (p: ProjectDTO) => void;
}) {
  const { t, lang } = useI18n();
  const openProject = useUIStore((s) => s.openProject);
  const color = project.color ?? NO_PROJECT_COLOR;

  return (
    <Card
      className="group cursor-pointer p-0 transition-shadow hover:shadow-md"
      onClick={() => openProject(project.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProject(project.id);
        }
      }}
      aria-label={`${t("projects.openProject")}: ${project.name}`}
    >
      <div className="h-1.5 w-full rounded-t-lg" style={{ backgroundColor: color }} />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate font-semibold text-slate-900">
            {project.name}
          </h3>
          <ProjectStatusBadge status={project.status} />
        </div>

        {project.description && (
          <p className="line-clamp-2 text-sm text-slate-500">{project.description}</p>
        )}

        {project.client && (
          <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">{project.client.name || t("projects.clientLabel")}</span>
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <ProjectPriorityDot priority={project.priority} />
          <DeadlineChip
            deadline={project.deadline}
            overdue={project.overdue}
            daysRemaining={project.daysRemaining}
          />
          {project.totalValue > 0 && (
            <span className="ms-auto text-xs font-semibold tabular-nums text-primary" dir="ltr">
              {formatMoney(project.totalValue, lang)}
            </span>
          )}
        </div>

        <ProjectProgress
          pct={project.progressPct}
          done={project.taskDone}
          total={project.taskTotal}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {t("projects.taskCount", { count: project.taskTotal })}
          </span>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-slate-500 hover:text-primary"
              onClick={() => onEdit(project)}
            >
              {t("edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-slate-500 hover:text-red-600"
              onClick={() => onDelete(project)}
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ProjectsView() {
  const { t, lang } = useI18n();
  const setView = useUIStore((s) => s.setView);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDTO | null>(null);
  const [deleting, setDeleting] = useState<ProjectDTO | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusF, setStatusF] = useState(ALL);
  const [priorityF, setPriorityF] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const filters = useMemo(
    () => ({
      q: debounced || undefined,
      status: statusF !== ALL ? statusF : undefined,
      priority: priorityF !== ALL ? priorityF : undefined,
    }),
    [debounced, statusF, priorityF],
  );

  const { data, isLoading } = useProjects(filters);
  const deleteProject = useDeleteProject();

  const projects = useMemo(
    () => sortProjects(data?.projects ?? [], sort, lang),
    [data, sort, lang],
  );

  const hasFilters = !!debounced || statusF !== ALL || priorityF !== ALL;

  // Header stats are computed from the unfiltered list so they stay stable.
  const { data: allData } = useProjects();
  const all = allData?.projects ?? [];
  const stats = useMemo(() => {
    const active = all.filter((p) => p.status === "ACTIVE").length;
    const onHold = all.filter((p) => p.status === "ON_HOLD").length;
    const completed = all.filter((p) => p.status === "COMPLETED").length;
    const overdue = all.filter((p) => p.overdue).length;
    const dueSoon = all.filter(
      (p) =>
        !p.overdue &&
        p.status !== "COMPLETED" &&
        p.status !== "CANCELLED" &&
        p.daysRemaining !== null &&
        p.daysRemaining >= 0 &&
        p.daysRemaining <= 7,
    ).length;
    return { active, onHold, completed, overdue, dueSoon, total: all.length };
  }, [all]);

  const statusChips = [
    { key: "ACTIVE" as const, label: t("projects.activeProjects"), count: stats.active, tone: "bg-blue-50 text-blue-700" },
    { key: "__duesoon", label: t("projects.dueSoonProjects"), count: stats.dueSoon, tone: "bg-sky-50 text-sky-700" },
    { key: "__overdue", label: t("projects.overdueProjects"), count: stats.overdue, tone: "bg-red-50 text-red-700" },
    { key: "ON_HOLD" as const, label: t("projects.onHoldProjects"), count: stats.onHold, tone: "bg-amber-50 text-amber-700" },
    { key: "COMPLETED" as const, label: t("projects.completedProjects"), count: stats.completed, tone: "bg-emerald-50 text-emerald-700" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("projects")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("timeline.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setView("timeline")}>
            <CalendarRange className="size-4" />
            <span className="hidden sm:inline">{t("projects.projectTimeline")}</span>
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            {t("projects.newProject")}
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      {stats.total > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {statusChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => {
                  if (chip.key === "__overdue" || chip.key === "__duesoon") return;
                  setStatusF(statusF === chip.key ? ALL : (chip.key as ProjectStatus));
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-transform active:scale-95",
                  chip.tone,
                  "hover:opacity-80",
                  statusF === chip.key && "ring-2 ring-primary/40",
                )}
              >
                {chip.label}
                <span className="font-bold">{chip.count}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("projects.searchPlaceholder")}
          className="h-9 sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={statusF} onChange={setStatusF} placeholder={t("projects.filterAllStatuses")}>
            <SelectItem value={ALL}>{t("projects.filterAllStatuses")}</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(projectStatusLabelKey(s))}
              </SelectItem>
            ))}
          </FilterSelect>

          <FilterSelect value={priorityF} onChange={setPriorityF} placeholder={t("projects.filterAllPriorities")}>
            <SelectItem value={ALL}>{t("projects.filterAllPriorities")}</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {t(priorityLabelKeyFor(p))}
              </SelectItem>
            ))}
          </FilterSelect>

          <div className="flex items-center gap-1.5 sm:ms-auto">
            <ListFilter className="size-4 shrink-0 text-slate-400" />
            <FilterSelect value={sort} onChange={(v) => setSort(v as SortKey)} placeholder={t("tasks.sortBy")}>
              <SelectItem value="newest">{t("projects.sortNewest")}</SelectItem>
              <SelectItem value="deadline">{t("projects.sortDeadline")}</SelectItem>
              <SelectItem value="progress">{t("projects.sortProgress")}</SelectItem>
              <SelectItem value="name">{t("projects.sortName")}</SelectItem>
            </FilterSelect>
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <FolderKanban className="size-8 text-slate-300" />
          <p className="font-medium text-slate-700">
            {hasFilters ? t("projects.emptyFilteredTitle") : t("projects.emptyTitle")}
          </p>
          <p className="text-sm text-slate-400">
            {hasFilters ? t("projects.emptyFilteredSubtitle") : t("projects.emptySubtitle")}
          </p>
          {!hasFilters && (
            <Button
              className="mt-2 gap-2"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("projects.newProject")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={(proj) => {
                setEditing(proj);
                setDialogOpen(true);
              }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} project={editing} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("projects.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name && `"${deleting.name}" — `}
              {t("projects.deleteConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleting) deleteProject.mutate({ id: deleting.id });
                setDeleting(null);
              }}
            >
              {deleteProject.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}