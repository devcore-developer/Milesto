"use client";

/**
 * Stream view — a reverse-chronological feed of timeline events grouped by
 * month. Purely presentational: all data decisions happen upstream.
 */

import * as React from "react";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";
import { formatMonthLabel, formatTimelineDate, monthOf, type TimelineEvent } from "@/lib/timeline";
import { EventKindBadge } from "./timeline-ui";

export interface StreamViewProps {
  events: TimelineEvent[];
  today: string;
  getProjectName: (projectId: string | undefined) => string | undefined;
  onSelect: (event: TimelineEvent) => void;
}

export function StreamView({ events, today, getProjectName, onSelect }: StreamViewProps) {
  const groups = React.useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const key = monthOf(event.date);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [events]);

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nothing on the timeline"
        description="No events match the current filters. Add a custom event or adjust the search."
      />
    );
  }

  return (
    <div className="space-y-6" aria-label="Timeline stream">
      {groups.map(([month, monthEvents]) => (
        <section key={month} aria-label={formatMonthLabel(month)}>
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">{formatMonthLabel(month)}</h3>
            <span className="text-xs text-muted-foreground">{monthEvents.length} event(s)</span>
          </div>
          <ol className="space-y-2">
            {monthEvents.map((event) => {
              const past = event.date < today;
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(event)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      event.overdue && "border-danger/60"
                    )}
                    aria-label={`${event.title} on ${formatTimelineDate(event.date)}`}
                  >
                    <span
                      className={cn(
                        "mt-0.5 w-20 shrink-0 text-xs font-medium tabular-nums",
                        past ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {formatTimelineDate(event.date)}
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{event.title}</span>
                        {event.overdue && (
                          <Badge variant="danger">
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            Overdue
                          </Badge>
                        )}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <EventKindBadge kind={event.kind} />
                        {getProjectName(event.projectId) && <span>{getProjectName(event.projectId)}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}