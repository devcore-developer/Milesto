"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ListFilter, Plus, Tags, Trash2 } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useDeleteTask,
  useStats,
  useTasks,
} from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/store";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskDTO, type TaskPriority } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  priorityLabelKey,
  statusLabelKey,
} from "@/components/mylist/task/badges";
import { TaskCard } from "@/components/mylist/task/task-card";

type SortKey = "newest" | "dueDate" | "priority" | "title";

const PRIORITY_ORDER: TaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

function sortTasks(tasks: TaskDTO[], sort: SortKey, locale: string): TaskDTO[] {
  const arr = [...tasks];
  const due = (t: TaskDTO) => (t.dueDate ? Date.parse(t.dueDate) : Number.POSITIVE_INFINITY);
  switch (sort) {
    case "newest":
      arr.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      break;
    case "dueDate":
      arr.sort((a, b) => due(a) - due(b));
      break;
    case "priority":
      arr.sort(
        (a, b) =>
          PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
          due(a) - due(b),
      );
      break;
    case "title":
      arr.sort((a, b) => a.title.localeCompare(b.title, locale));
      break;
  }
  return arr;
}

const ALL = "__all__";

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

export function TasksView() {
  const { t, lang } = useI18n();
  const openEditTask = useUIStore((s) => s.openEditTask);
  const requestNewTask = useUIStore((s) => s.requestNewTask);

  const [deleting, setDeleting] = useState<TaskDTO | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusF, setStatusF] = useState(ALL);
  const [priorityF, setPriorityF] = useState(ALL);
  const [categoryF, setCategoryF] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("newest");

  const [newCatName, setNewCatName] = useState("");
  const [catPopoverOpen, setCatPopoverOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const filters = useMemo(
    () => ({
      q: debounced || undefined,
      status: statusF !== ALL ? statusF : undefined,
      priority: priorityF !== ALL ? priorityF : undefined,
      categoryId: categoryF !== ALL ? categoryF : undefined,
    }),
    [debounced, statusF, priorityF, categoryF],
  );

  const { data, isLoading } = useTasks(filters);
  const { data: statsData } = useStats();
  const { data: catData } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const deleteTask = useDeleteTask();

  const categories = catData?.categories ?? [];
  const stats = statsData?.stats;
  const tasks = useMemo(() => sortTasks(data?.tasks ?? [], sort, lang), [data, sort, lang]);

  const hasFilters =
    !!debounced || statusF !== ALL || priorityF !== ALL || categoryF !== ALL;

  function handleCreateCategory() {
    const name = newCatName.trim();
    if (!name) return;
    createCategory.mutate(
      { name },
      {
        onSuccess: () => {
          setNewCatName("");
          setCatPopoverOpen(false);
        },
      },
    );
  }

  const statusChips = stats
    ? [
        { key: ALL, label: t("all"), count: stats.totals.all, tone: "bg-slate-100 text-slate-700" },
        { key: "TODO", label: t("tasks.statusTodo"), count: stats.totals.todo, tone: "bg-slate-100 text-slate-700" },
        { key: "IN_PROGRESS", label: t("tasks.statusInProgress"), count: stats.totals.inProgress, tone: "bg-sky-50 text-sky-700" },
        { key: "COMPLETED", label: t("tasks.statusCompleted"), count: stats.totals.completed, tone: "bg-emerald-50 text-emerald-700" },
        { key: "__overdue", label: t("overdue"), count: stats.totals.overdue, tone: "bg-red-50 text-red-700" },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("tasks")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("tasks.taskCount", { count: tasks.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={catPopoverOpen} onOpenChange={setCatPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Tags className="size-4" />
                <span className="hidden sm:inline">{t("tasks.categoriesTitle")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <p className="mb-2 text-sm font-semibold">{t("tasks.categoriesTitle")}</p>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {categories.length === 0 && (
                  <p className="py-2 text-sm text-slate-400">{t("noResults")}</p>
                )}
                {categories.map((c) => (
                  <div key={c.id} className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{c.taskCount}</span>
                    </span>
                    <button
                      onClick={() => deleteCategory.mutate({ id: c.id })}
                      className="text-slate-300 transition-colors hover:text-red-500"
                      aria-label={`${t("delete")} ${c.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="flex gap-2">
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={t("tasks.newCategoryPlaceholder")}
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                />
                <Button size="sm" className="h-8" disabled={!newCatName.trim() || createCategory.isPending} onClick={handleCreateCategory}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            className="gap-2"
            onClick={() => {
              requestNewTask();
            }}
          >
            <Plus className="size-4" />
            {t("tasks.newTask")}
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && stats.totals.all > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {statusChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => {
                  if (chip.key === "__overdue") return;
                  setStatusF(chip.key);
                }}
                disabled={chip.key === "__overdue"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-transform active:scale-95",
                  chip.tone,
                  chip.key !== "__overdue" && "hover:opacity-80",
                  chip.key === "__overdue" && "cursor-default",
                  statusF === chip.key && chip.key !== "__overdue" && "ring-2 ring-primary/40",
                )}
              >
                {chip.label}
                <span className="font-bold">{chip.count}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={stats.completionPct} className="h-2 flex-1" />
            <span className="text-xs font-semibold text-slate-500">
              {t("dashboard.completionRate")} {stats.completionPct}%
            </span>
          </div>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("tasks.searchPlaceholder")}
          className="h-9 sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={statusF} onChange={setStatusF} placeholder={t("tasks.filterAllStatuses")}>
            <SelectItem value={ALL}>{t("tasks.filterAllStatuses")}</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(statusLabelKey(s))}
              </SelectItem>
            ))}
          </FilterSelect>

          <FilterSelect value={priorityF} onChange={setPriorityF} placeholder={t("tasks.filterAllPriorities")}>
            <SelectItem value={ALL}>{t("tasks.filterAllPriorities")}</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {t(priorityLabelKey(p))}
              </SelectItem>
            ))}
          </FilterSelect>

          <FilterSelect value={categoryF} onChange={setCategoryF} placeholder={t("tasks.filterAllCategories")}>
            <SelectItem value={ALL}>{t("tasks.filterAllCategories")}</SelectItem>
            <SelectItem value="none">{t("tasks.filterNoCategory")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </FilterSelect>

          <div className="flex items-center gap-1.5 sm:ms-auto">
            <ListFilter className="size-4 shrink-0 text-slate-400" />
            <FilterSelect value={sort} onChange={(v) => setSort(v as SortKey)} placeholder={t("tasks.sortBy")}>
              <SelectItem value="newest">{t("tasks.sortNewest")}</SelectItem>
              <SelectItem value="dueDate">{t("tasks.sortDueDate")}</SelectItem>
              <SelectItem value="priority">{t("tasks.sortPriority")}</SelectItem>
              <SelectItem value="title">{t("tasks.sortTitle")}</SelectItem>
            </FilterSelect>
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <ListFilter className="size-8 text-slate-300" />
          <p className="font-medium text-slate-700">
            {hasFilters ? t("tasks.emptyFilteredTitle") : t("tasks.emptyTitle")}
          </p>
          <p className="text-sm text-slate-400">
            {hasFilters ? t("tasks.emptyFilteredSubtitle") : t("tasks.emptySubtitle")}
          </p>
          {!hasFilters && (
            <Button
              className="mt-2 gap-2"
              onClick={() => {
                requestNewTask();
              }}
            >
              <Plus className="size-4" />
              {t("tasks.newTask")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={openEditTask} onDelete={setDeleting} />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tasks.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.title && `"${deleting.title}" — `}
              {t("tasks.deleteConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleting) deleteTask.mutate({ id: deleting.id });
                setDeleting(null);
              }}
            >
              {deleteTask.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}