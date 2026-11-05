"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarDays,
  FolderKanban,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProjects, useTasks } from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { computeNotifications, type NotificationItem } from "@/lib/notifications";
import { useUIStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Localized relative text for a reminder item. */
function useItemLabel() {
  const { t } = useI18n();
  return (item: NotificationItem): string => {
    switch (item.kind) {
      case "task-overdue":
        return t("notifications.overdueBy", { days: Math.abs(item.days) });
      case "task-due-soon":
        return item.days === 0
          ? t("notifications.dueToday")
          : t("notifications.taskDueIn", { days: item.days });
      case "project-overdue":
        return t("notifications.overdueBy", { days: Math.abs(item.days) });
      case "project-deadline-soon":
        return item.days === 0
          ? t("notifications.deadlineToday")
          : t("notifications.deadlineIn", { days: item.days });
      case "project-delivery-soon":
        return item.days === 0
          ? t("notifications.deliveryToday")
          : t("notifications.deliveryIn", { days: item.days });
    }
  };
}

function ItemIcon({ item }: { item: NotificationItem }) {
  const overdue = item.kind === "task-overdue" || item.kind === "project-overdue";
  const Icon =
    item.kind === "task-overdue"
      ? AlertTriangle
      : item.kind === "task-due-soon"
        ? ListTodo
        : item.kind === "project-overdue"
          ? AlertTriangle
          : item.kind === "project-deadline-soon"
            ? FolderKanban
            : CalendarClock;
  return (
    <Icon
      className={cn(
        "size-4 shrink-0",
        overdue
          ? "text-red-500"
          : item.kind.startsWith("task")
            ? "text-blue-600"
            : "text-primary",
      )}
    />
  );
}

/** Bell button + reminders popover. Rendered in the shell (desktop + mobile). */
export function NotificationBell({ dark = false }: { dark?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // Ticking clock so the list stays correct across midnight.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: tasksData } = useTasks();
  const { data: projectsData } = useProjects();
  const settings = useUIStore((s) => s.reminderSettings);
  const openProject = useUIStore((s) => s.openProject);
  const openEditTask = useUIStore((s) => s.openEditTask);
  const setView = useUIStore((s) => s.setView);

  const labelFor = useItemLabel();

  const items = useMemo(
    () =>
      computeNotifications(
        tasksData?.tasks ?? [],
        projectsData?.projects ?? [],
        settings,
        now,
      ),
    [tasksData, projectsData, settings, now],
  );

  const tasksById = useMemo(
    () => new Map((tasksData?.tasks ?? []).map((task) => [task.id, task])),
    [tasksData],
  );

  function onItemClick(item: NotificationItem) {
    setOpen(false);
    if (item.kind.startsWith("task")) {
      const task = tasksById.get(item.refId);
      if (task) openEditTask(task);
    } else {
      openProject(item.refId);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("notifications.title")}
          className={cn(
            "relative",
            dark
              ? "text-blue-100 hover:bg-white/10 hover:text-white"
              : "text-slate-600 hover:text-slate-900",
          )}
        >
          <Bell className="size-4.5" />
          {items.length > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {items.length > 9 ? "9+" : items.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">
            {t("notifications.title")}
          </p>
          {items.length > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
              {items.length}
            </span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
              <Bell className="size-7 text-slate-200" />
              <p className="text-sm font-medium text-slate-600">
                {t("notifications.empty")}
              </p>
              <p className="text-xs text-slate-400">{t("notifications.emptyHint")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onItemClick(item)}
                    className="flex w-full items-start gap-2.5 px-4 py-2.5 text-start transition-colors hover:bg-slate-50"
                  >
                    <span className="mt-0.5">
                      <ItemIcon item={item} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs font-medium",
                          item.kind.endsWith("overdue")
                            ? "text-red-600"
                            : "text-slate-500",
                        )}
                      >
                        {labelFor(item)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 text-primary hover:text-primary"
            onClick={() => {
              setOpen(false);
              setView("calendar");
            }}
          >
            <CalendarDays className="size-4" />
            {t("notifications.openCalendar")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}