"use client";

/**
 * Calendar view — month grid (Sunday-first) built from buildMonthMatrix.
 * Navigation and the selected month live inside this view so the rest of the
 * workspace stays stateless; events are matched to days by their ISO date.
 */

import * as React from "react";
import { AlertTriangle, CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";
import {
  addMonthsISO,
  buildMonthMatrix,
  formatMonthLabel,
  monthOf,
  type TimelineEvent,
} from "@/lib/timeline";

export interface CalendarViewProps {
  events: TimelineEvent[];
  today: string;
  getProjectName: (projectId: string | undefined) => string | undefined;
  onSelect: (event: TimelineEvent) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MAX_DOTS_PER_DAY = 3;

export function CalendarView({ events, today, getProjectName, onSelect }: CalendarViewProps) {
  const [cursorMonth, setCursorMonth] = React.useState<string>(() => monthOf(today));

  const weeks = React.useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(cursorMonth)) return [];
    return buildMonthMatrix(Number(cursorMonth.slice(0, 4)), Number(cursorMonth.slice(5, 7)) - 1);
  }, [cursorMonth]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const goBack = React.useCallback(() => setCursorMonth((m) => addMonthsISO(m, -1).slice(0, 7)), []);
  const goForward = React.useCallback(() => setCursorMonth((m) => addMonthsISO(m, 1).slice(0, 7)), []);
  const goToday = React.useCallback(() => setCursorMonth(monthOf(today)), [today]);

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="Nothing on the calendar"
        description="No events match the current filters, so there is nothing to place on the month grid."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={goBack} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={goForward} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday} className="ml-1">
            Today
          </Button>
        </div>
        <p className="text-sm font-semibold text-foreground" aria-live="polite">
          {formatMonthLabel(cursorMonth)}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border" role="grid" aria-label={`Calendar for ${formatMonthLabel(cursorMonth)}`}>
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((cell) => {
            const dayEvents = byDay.get(cell.date) ?? [];
            const isToday = cell.date === today;
            return (
              <div
                key={cell.date}
                className={cn(
                  "min-h-[84px] border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                  !cell.inMonth && "bg-muted/30",
                  isToday && "bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs tabular-nums",
                      isToday ? "bg-primary font-semibold text-primary-foreground" : cell.inMonth ? "text-foreground" : "text-muted-foreground/60"
                    )}
                  >
                    {Number(cell.date.slice(8, 10))}
                  </span>
                  {dayEvents.some((e) => e.overdue) && (
                    <AlertTriangle className="h-3 w-3 text-danger" aria-label="Overdue events on this day" />
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, MAX_DOTS_PER_DAY).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelect(event)}
                      className={cn(
                        "block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        event.status === "done"
                          ? "text-muted-foreground line-through"
                          : event.overdue
                            ? "bg-danger/10 font-medium text-danger"
                            : "bg-accent/40 text-foreground"
                      )}
                      title={`${event.title}${getProjectName(event.projectId) ? ` — ${getProjectName(event.projectId)}` : ""}`}
                    >
                      {event.title}
                    </button>
                  ))}
                  {dayEvents.length > MAX_DOTS_PER_DAY && (
                    <p className="px-1 text-[11px] text-muted-foreground">
                      +{dayEvents.length - MAX_DOTS_PER_DAY} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}