"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  ListTodo,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects, useTasks } from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import { useUIStore } from "@/lib/store";
import { PRIORITY_COLORS } from "@/components/mylist/task/badges";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekDays,
  collectCalendarEvents,
  dateKeyToDate,
  dayLabel,
  groupEventsByDate,
  monthLabel,
  shortDateLabel,
  toDateKey,
  weekRangeLabel,
  weekdayLabels,
  weekStartsOnFor,
  type CalendarEvent,
  type CalendarMode,
} from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";

type Mode = CalendarMode;

const MAX_EVENTS_PER_CELL = 3;

/** Dot color: project color for project events, priority color for tasks. */
function eventDotColor(
  event: CalendarEvent,
  projectColorById: Map<string, string | null>,
): string {
  if (event.projectId) {
    const color = projectColorById.get(event.projectId);
    if (color) return color;
    return "#1E3A8A";
  }
  return PRIORITY_COLORS[event.priority];
}

export function CalendarView() {
  const { t, lang } = useI18n();
  const setView = useUIStore((s) => s.setView);
  const openProject = useUIStore((s) => s.openProject);
  const openEditTask = useUIStore((s) => s.openEditTask);
  const requestNewTask = useUIStore((s) => s.requestNewTask);

  const weekStartsOn = weekStartsOnFor(lang);

  const [mode, setMode] = useState<Mode>("month");
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(new Date()));

  const { data: tasksData, isLoading: tasksLoading } = useTasks();
  const { data: projectsData, isLoading: projectsLoading } = useProjects();

  // Ticking clock so "today" highlights stay correct across midnight.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const tasks = tasksData?.tasks ?? [];
  const projects = projectsData?.projects ?? [];

  const eventsByDate = useMemo(() => {
    const events = collectCalendarEvents(tasks, projects, now);
    return groupEventsByDate(events);
  }, [tasks, projects, now]);

  const projectColorById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.color])),
    [projects],
  );

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const loading = tasksLoading || projectsLoading;
  const todayKey = toDateKey(now);

  function navigate(direction: 1 | -1) {
    setViewDate((d) => {
      if (mode === "month") return addMonths(d, direction);
      if (mode === "week") return addDays(d, 7 * direction);
      return addDays(d, direction);
    });
  }

  function goToday() {
    const d = new Date();
    setViewDate(d);
    setSelectedKey(toDateKey(d));
  }

  function openEvent(event: CalendarEvent) {
    if (event.taskId) {
      const task = tasksById.get(event.taskId);
      if (task) openEditTask(task);
      return;
    }
    if (event.projectId) {
      openProject(event.projectId);
    }
  }

  function openDay(key: string) {
    setSelectedKey(key);
    setViewDate(dateKeyToDate(key));
    setMode("day");
  }

  function addTaskOn(key: string) {
    requestNewTask(undefined, key);
  }

  const periodLabel =
    mode === "month"
      ? monthLabel(viewDate, lang)
      : mode === "week"
        ? weekRangeLabel(buildWeekDays(viewDate, weekStartsOn)[0], lang)
        : dayLabel(dateKeyToDate(selectedKey), lang);

  const headerLabelKey: Record<
    Mode,
    "calendar.viewMonth" | "calendar.viewWeek" | "calendar.viewDay"
  > = {
    month: "calendar.viewMonth",
    week: "calendar.viewWeek",
    day: "calendar.viewDay",
  };

  const modes: Mode[] = ["month", "week", "day"];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("calendar")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("calendar.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode switch */}
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-1">
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  mode === m
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                {t(headerLabelKey[m])}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("calendar.previous")}
            onClick={() => navigate(-1)}
          >
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            {t("today")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("calendar.next")}
            onClick={() => navigate(1)}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>

      {/* Period label + quick add */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-800">{periodLabel}</h2>
        <Button className="gap-2" onClick={() => addTaskOn(selectedKey)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">{t("tasks.newTask")}</span>
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : mode === "month" ? (
        <MonthGrid
          viewDate={viewDate}
          weekStartsOn={weekStartsOn}
          lang={lang}
          todayKey={todayKey}
          eventsByDate={eventsByDate}
          projectColorById={projectColorById}
          onOpenDay={openDay}
          onOpenEvent={openEvent}
          onAddTask={addTaskOn}
        />
      ) : mode === "week" ? (
        <WeekGrid
          viewDate={viewDate}
          weekStartsOn={weekStartsOn}
          lang={lang}
          todayKey={todayKey}
          eventsByDate={eventsByDate}
          projectColorById={projectColorById}
          onOpenDay={openDay}
          onOpenEvent={openEvent}
          onAddTask={addTaskOn}
        />
      ) : (
        <DayAgenda
          selectedKey={selectedKey}
          lang={lang}
          events={eventsByDate.get(selectedKey) ?? []}
          projectColorById={projectColorById}
          onOpenEvent={openEvent}
          onAddTask={addTaskOn}
        />
      )}

      {/* Legend */}
      <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 p-3 text-xs text-slate-500">
        <span className="font-semibold text-slate-600">{t("timeline.legend")}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500" />
          {t("tasks.statusCompleted")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-blue-600" />
          {t("calendar.upcoming")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500" />
          {t("overdue")}
        </span>
        <button
          className="ms-auto inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          onClick={() => setView("timeline")}
        >
          <CalendarRange className="size-3.5" />
          {t("projects.projectTimeline")}
        </button>
      </Card>
    </div>
  );
}

interface GridProps {
  viewDate: Date;
  weekStartsOn: 0 | 6;
  lang: string;
  todayKey: string;
  eventsByDate: Map<string, CalendarEvent[]>;
  projectColorById: Map<string, string | null>;
  onOpenDay: (key: string) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onAddTask: (key: string) => void;
}

function EventChip({
  event,
  color,
  onClick,
}: {
  event: CalendarEvent;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 text-start text-[11px] font-medium transition-colors",
        event.completed
          ? "bg-slate-50 text-slate-400 line-through hover:bg-slate-100"
          : event.overdue
            ? "bg-red-50 text-red-700 hover:bg-red-100"
            : "bg-blue-50/70 text-slate-700 hover:bg-blue-100",
      )}
      title={event.title}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{
          backgroundColor: event.completed
            ? "#94A3B8"
            : event.overdue
              ? "#DC2626"
              : color,
        }}
      />
      <span className="truncate">{event.title}</span>
    </button>
  );
}

function AddTaskButton({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      aria-label={label}
      title={label}
      className="ms-auto rounded p-0.5 text-slate-300 transition-all hover:bg-primary/10 hover:text-primary focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
    >
      <Plus className="size-3.5" />
    </button>
  );
}

function MonthGrid({
  viewDate,
  weekStartsOn,
  lang,
  todayKey,
  eventsByDate,
  projectColorById,
  onOpenDay,
  onOpenEvent,
  onAddTask,
}: GridProps) {
  const { t } = useI18n();
  const grid = useMemo(
    () => buildMonthGrid(viewDate, weekStartsOn),
    [viewDate, weekStartsOn],
  );
  const weekdays = useMemo(
    () => weekdayLabels(weekStartsOn, lang),
    [weekStartsOn, lang],
  );
  const month = viewDate.getMonth();

  return (
    <Card className="p-2 sm:p-3">
      <div className="grid grid-cols-7 gap-1 pb-1">
        {weekdays.map((label, i) => (
          <div
            key={`${label}-${i}`}
            className="py-1 text-center text-[11px] font-semibold text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const key = toDateKey(d);
          const inMonth = d.getMonth() === month;
          const isToday = key === todayKey;
          const events = eventsByDate.get(key) ?? [];
          const visible = events.slice(0, MAX_EVENTS_PER_CELL);
          const hidden = events.length - visible.length;
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onOpenDay(key)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onOpenDay(key);
                }
              }}
              className={cn(
                "group flex min-h-16 cursor-pointer flex-col gap-0.5 rounded-lg border p-1 transition-colors sm:min-h-24",
                inMonth
                  ? "border-slate-100 bg-white hover:bg-slate-50"
                  : "border-transparent bg-slate-50/60",
                isToday && "border-primary/60 ring-1 ring-primary/40",
              )}
            >
              <div className="flex items-center">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
                    isToday
                      ? "bg-primary text-white"
                      : inMonth
                        ? "text-slate-700"
                        : "text-slate-300",
                  )}
                >
                  {d.getDate()}
                </span>
                {inMonth && (
                  <AddTaskButton
                    onAdd={() => onAddTask(key)}
                    label={t("calendar.addTaskOn", { date: d.getDate() })}
                  />
                )}
              </div>
              {visible.map((event) => (
                <EventChip
                  key={event.id}
                  event={event}
                  color={eventDotColor(event, projectColorById)}
                  onClick={() => onOpenEvent(event)}
                />
              ))}
              {hidden > 0 && (
                <span className="px-1 text-[10px] font-semibold text-slate-400">
                  {t("calendar.moreEvents", { count: hidden })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekGrid({
  viewDate,
  weekStartsOn,
  lang,
  todayKey,
  eventsByDate,
  projectColorById,
  onOpenDay,
  onOpenEvent,
  onAddTask,
}: GridProps) {
  const { t } = useI18n();
  const days = useMemo(
    () => buildWeekDays(viewDate, weekStartsOn),
    [viewDate, weekStartsOn],
  );
  const weekdayFmt = useMemo(
    () => weekdayLabels(weekStartsOn, lang),
    [weekStartsOn, lang],
  );

  return (
    <Card className="overflow-x-auto p-2 sm:p-3">
      <div className="grid min-w-3xl grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const key = toDateKey(d);
          const isToday = key === todayKey;
          const events = eventsByDate.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "group flex min-h-44 flex-col rounded-lg border p-1.5",
                isToday ? "border-primary/60 bg-primary/5" : "border-slate-100 bg-white",
              )}
            >
              <button
                onClick={() => onOpenDay(key)}
                className="flex flex-col items-center gap-0.5 rounded-md pb-1.5 transition-colors hover:bg-slate-50"
              >
                <span className="text-[10px] font-semibold text-slate-400">
                  {weekdayFmt[(i + weekStartsOn) % 7]}
                </span>
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                    isToday ? "bg-primary text-white" : "text-slate-700",
                  )}
                >
                  {d.getDate()}
                </span>
              </button>
              <div className="flex flex-col gap-1">
                {events.map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    color={eventDotColor(event, projectColorById)}
                    onClick={() => onOpenEvent(event)}
                  />
                ))}
              </div>
              <div className="mt-auto pt-1">
                <AddTaskButton
                  onAdd={() => onAddTask(key)}
                  label={t("calendar.addTaskOn", { date: shortDateLabel(d, lang) })}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DayAgenda({
  selectedKey,
  lang,
  events,
  projectColorById,
  onOpenEvent,
  onAddTask,
}: {
  selectedKey: string;
  lang: string;
  events: CalendarEvent[];
  projectColorById: Map<string, string | null>;
  onOpenEvent: (event: CalendarEvent) => void;
  onAddTask: (key: string) => void;
}) {
  const { t } = useI18n();
  const date = dateKeyToDate(selectedKey);
  const taskEvents = events.filter((e) => e.kind === "task");
  const projectEvents = events.filter((e) => e.kind !== "task");

  const kindKey: Record<CalendarEvent["kind"], TranslationKey> = {
    task: "calendar.taskDue",
    "project-start": "calendar.projectStart",
    "project-deadline": "calendar.projectDeadline",
    "project-delivery": "calendar.projectDelivery",
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <CalendarDays className="size-5 text-primary" />
          </div>
          <p className="font-bold text-slate-800">{dayLabel(date, lang)}</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => onAddTask(selectedKey)}
        >
          <Plus className="size-4" />
          {t("calendar.addTaskHere")}
        </Button>
      </Card>

      {events.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <CalendarDays className="size-8 text-slate-300" />
          <p className="font-medium text-slate-700">{t("calendar.noEvents")}</p>
          <p className="text-sm text-slate-400">{t("calendar.noEventsHint")}</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ListTodo className="size-4 text-blue-600" />
              {t("calendar.tasksDue")}
            </p>
            {taskEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                {t("calendar.emptyDay")}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {taskEvents.map((event) => (
                  <li key={event.id}>
                    <button
                      onClick={() => onOpenEvent(event)}
                      className="flex w-full items-center gap-2.5 py-2.5 text-start transition-colors hover:bg-slate-50"
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm font-medium",
                          event.completed
                            ? "text-slate-400 line-through"
                            : "text-slate-800",
                        )}
                      >
                        {event.title}
                      </span>
                      {event.overdue && !event.completed && (
                        <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                          {t("overdue")}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FolderKanban className="size-4 text-primary" />
              {t("calendar.projectMilestones")}
            </p>
            {projectEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                {t("calendar.emptyDay")}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {projectEvents.map((event) => (
                  <li key={event.id}>
                    <button
                      onClick={() => onOpenEvent(event)}
                      className="flex w-full items-center gap-2.5 py-2.5 text-start transition-colors hover:bg-slate-50"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: eventDotColor(event, projectColorById),
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {event.title}
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">
                        {t(kindKey[event.kind])}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}