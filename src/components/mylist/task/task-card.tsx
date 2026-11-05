"use client";

import { useState } from "react";
import {
  ChevronDown,
  FolderKanban,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  useAddSubtask,
  useRemoveSubtask,
  useUpdateSubtask,
  useUpdateTask,
} from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import type { TaskDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  CategoryChip,
  DueChip,
  PriorityBadge,
  StatusBadge,
} from "@/components/mylist/task/badges";

export function TaskCard({
  task,
  onEdit,
  onDelete,
}: {
  task: TaskDTO;
  onEdit: (task: TaskDTO) => void;
  onDelete: (task: TaskDTO) => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [newSub, setNewSub] = useState("");

  const updateTask = useUpdateTask();
  const addSubtask = useAddSubtask();
  const updateSubtask = useUpdateSubtask();
  const removeSubtask = useRemoveSubtask();

  const done = task.status === "COMPLETED";
  const subDone = task.subtasks.filter((s) => s.completed).length;
  const subTotal = task.subtasks.length;

  return (
    <Card
      className={cn(
        "gap-0 p-4 transition-shadow hover:shadow-md",
        done && "bg-slate-50/80",
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={done}
          className="mt-0.5 shrink-0"
          disabled={updateTask.isPending}
          onCheckedChange={(checked) =>
            updateTask.mutate({
              id: task.id,
              data: { status: checked ? "COMPLETED" : "TODO" },
            })
          }
          aria-label={task.title}
        />

        <div className="min-w-0 flex-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center gap-1.5 text-start"
            aria-expanded={expanded}
          >
            <span
              className={cn(
                "flex-1 text-sm font-medium break-words",
                done ? "text-slate-400 line-through" : "text-slate-900",
              )}
            >
              {task.title}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-slate-400 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {task.category && (
              <CategoryChip name={task.category.name} color={task.category.color} />
            )}
            {task.project && (
              <span className="inline-flex max-w-40 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                <FolderKanban className="size-3 shrink-0" />
                <span className="truncate">{task.project.name}</span>
              </span>
            )}
            {task.dueDate && <DueChip isoDateStr={task.dueDate} />}
            {subTotal > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                {t("tasks.subtaskProgress", { done: subDone, total: subTotal })}
                <Progress value={(subDone / subTotal) * 100} className="h-1 w-10" />
              </span>
            )}
          </div>

          {expanded && (
            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
              {task.notes && (
                <p className="text-sm whitespace-pre-wrap text-slate-600">{task.notes}</p>
              )}

              {subTotal > 0 && (
                <ul className="space-y-1.5">
                  {task.subtasks.map((sub) => (
                    <li key={sub.id} className="group flex items-center gap-2.5">
                      <Checkbox
                        checked={sub.completed}
                        className="shrink-0"
                        onCheckedChange={(checked) =>
                          updateSubtask.mutate({
                            subtaskId: sub.id,
                            data: { completed: !!checked },
                          })
                        }
                        aria-label={sub.title}
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 text-sm",
                          sub.completed ? "text-slate-400 line-through" : "text-slate-700",
                        )}
                      >
                        {sub.title}
                      </span>
                      <button
                        onClick={() => removeSubtask.mutate({ subtaskId: sub.id })}
                        className="text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500 focus:opacity-100"
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
                  const title = newSub.trim();
                  if (!title) return;
                  addSubtask.mutate(
                    { taskId: task.id, title },
                    { onSuccess: () => setNewSub("") },
                  );
                }}
              >
                <Input
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  placeholder={t("tasks.addSubtaskPlaceholder")}
                  className="h-8 text-sm"
                />
                <Button type="submit" variant="outline" size="icon" className="size-8 shrink-0" disabled={!newSub.trim()}>
                  <Plus className="size-3.5" />
                </Button>
              </form>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0 text-slate-400" aria-label={t("actions")}>
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil className="size-4" />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(task)}
            >
              <Trash2 className="size-4" />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}