"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddSubtask,
  useCategories,
  useCreateCategory,
  useCreateTask,
  useProjects,
  useRemoveSubtask,
  useUpdateSubtask,
  useUpdateTask,
} from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/store";
import type { TaskDTO, TaskPriority, TaskStatus } from "@/lib/types";
import {
  PRIORITY_COLORS,
  priorityLabelKey,
  statusLabelKey,
} from "@/components/mylist/task/badges";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LocalSubtask {
  key: string;
  id?: string;
  title: string;
  completed: boolean;
}

const NO_CATEGORY = "__none__";
const NO_PROJECT = "__no_project__";

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function fromDateInput(value: string): string | null {
  return value ? `${value}T12:00:00.000Z` : null;
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDTO | null;
}) {
  const { t } = useI18n();
  const isEdit = !!task;

  const { data: catData } = useCategories();
  const categories = catData?.categories ?? [];
  const { data: projData } = useProjects();
  const projects = projData?.projects ?? [];
  const presetProjectId = useUIStore((s) => s.taskDialogProjectId);
  const presetDueDate = useUIStore((s) => s.taskDialogDueDate);

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createCategory = useCreateCategory();
  const addSubtask = useAddSubtask();
  const updateSubtask = useUpdateSubtask();
  const removeSubtask = useRemoveSubtask();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [categoryId, setCategoryId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [subs, setSubs] = useState<LocalSubtask[]>([]);
  const [newSub, setNewSub] = useState("");
  const [showCatInput, setShowCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setNotes(task?.notes ?? "");
      setStatus(task?.status ?? "TODO");
      setPriority(task?.priority ?? "MEDIUM");
      setCategoryId(task?.categoryId ?? "");
      setProjectId(task?.projectId ?? presetProjectId ?? "");
      setDueDate(task?.dueDate ? toDateInput(task.dueDate) : (presetDueDate ?? ""));
      setStartDate(toDateInput(task?.startDate));
      setSubs(
        task
          ? task.subtasks.map((s) => ({
              key: s.id,
              id: s.id,
              title: s.title,
              completed: s.completed,
            }))
          : [],
      );
      setNewSub("");
      setShowCatInput(false);
      setNewCatName("");
    }
  }, [open, task, presetProjectId, presetDueDate]);

  function addLocalSub() {
    const clean = newSub.trim();
    if (!clean) return;
    setSubs((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: clean, completed: false },
    ]);
    setNewSub("");
  }

  async function onCreateCategory() {
    const name = newCatName.trim();
    if (!name) return;
    try {
      const res = await createCategory.mutateAsync({ name });
      setCategoryId(res.category.id);
      setNewCatName("");
      setShowCatInput(false);
    } catch {
      // toast already shown by hook
    }
  }

  async function onSave() {
    if (!title.trim() || saving) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      notes: notes.trim() ? notes.trim() : null,
      status,
      priority,
      categoryId: categoryId || null,
      projectId: projectId || null,
      dueDate: fromDateInput(dueDate),
      startDate: fromDateInput(startDate),
    };
    try {
      if (isEdit && task) {
        await updateTask.mutateAsync({ id: task.id, data: payload });

        const original = new Map(task.subtasks.map((s) => [s.id, s]));
        const kept = new Set<string>();

        // Apply local changes to existing subtasks
        for (const s of subs) {
          if (s.id) {
            kept.add(s.id);
            const orig = original.get(s.id);
            if (orig && orig.completed !== s.completed) {
              await updateSubtask.mutateAsync({
                subtaskId: s.id,
                data: { completed: s.completed },
              });
            }
          }
        }
        // Remove deleted subtasks
        for (const id of original.keys()) {
          if (!kept.has(id)) await removeSubtask.mutateAsync({ subtaskId: id });
        }
        // Add new subtasks (preserve requested completion state)
        for (const s of subs) {
          if (!s.id) {
            const created = await addSubtask.mutateAsync({ taskId: task.id, title: s.title });
            if (s.completed) {
              await updateSubtask.mutateAsync({
                subtaskId: created.subtask.id,
                data: { completed: true },
              });
            }
          }
        }
      } else {
        await createTask.mutateAsync({
          ...payload,
          subtasks: subs.map((s) => ({ title: s.title })),
        });
      }
      onOpenChange(false);
    } catch {
      // toast already shown by hook
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("tasks.editTask") : t("tasks.newTask")}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? t("tasks.editTask") : t("tasks.newTask")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">{t("tasks.taskTitleLabel")}</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("tasks.taskTitlePlaceholder")}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("tasks.statusLabel")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(statusLabelKey(s))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("tasks.priorityLabel")}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
                        {t(priorityLabelKey(p))}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-due">{t("tasks.dueDateLabel")}</Label>
              <Input
                id="task-due"
                type="date"
                dir="ltr"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-start">{t("tasks.startDateLabel")}</Label>
              <Input
                id="task-start"
                type="date"
                dir="ltr"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("tasks.categoryLabel")}</Label>
              <button
                type="button"
                onClick={() => setShowCatInput((v) => !v)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {showCatInput ? t("cancel") : `+ ${t("tasks.addCategory")}`}
              </button>
            </div>
            {showCatInput ? (
              <div className="flex gap-2">
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={t("tasks.newCategoryPlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onCreateCategory();
                    }
                  }}
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={onCreateCategory}
                  disabled={createCategory.isPending || !newCatName.trim()}
                >
                  {t("add")}
                </Button>
              </div>
            ) : (
              <Select value={categoryId || NO_CATEGORY} onValueChange={(v) => setCategoryId(v === NO_CATEGORY ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>{t("tasks.filterNoCategory")}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("tasks.projectLabel")}</Label>
            <Select
              value={projectId || NO_PROJECT}
              onValueChange={(v) => setProjectId(v === NO_PROJECT ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>{t("tasks.filterNoProject")}</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: p.color ?? "#1E3A8A" }}
                      />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-notes">{t("tasks.notesLabel")}</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("tasks.notesPlaceholder")}
              rows={3}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t("tasks.subtasksLabel")}</Label>
            {subs.length > 0 && (
              <ul className="space-y-1.5">
                {subs.map((s) => (
                  <li key={s.key} className="group flex items-center gap-2.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <Checkbox
                      checked={s.completed}
                      onCheckedChange={(checked) =>
                        setSubs((prev) =>
                          prev.map((x) =>
                            x.key === s.key ? { ...x, completed: !!checked } : x,
                          ),
                        )
                      }
                      aria-label={s.title}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-sm",
                        s.completed ? "text-slate-400 line-through" : "text-slate-700",
                      )}
                    >
                      {s.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubs((prev) => prev.filter((x) => x.key !== s.key))}
                      className="text-slate-300 transition-colors hover:text-red-500"
                      aria-label={t("delete")}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addLocalSub();
              }}
            >
              <Input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                placeholder={t("tasks.addSubtaskPlaceholder")}
                className="h-9 text-sm"
              />
              <Button type="submit" variant="outline" size="icon" className="size-9 shrink-0" disabled={!newSub.trim()}>
                <Plus className="size-4" />
              </Button>
            </form>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={onSave} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}