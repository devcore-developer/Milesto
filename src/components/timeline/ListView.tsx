"use client";

/**
 * List view — a flat, sortable-by-date table of timeline events with
 * keyboard-accessible rows and explicit overdue highlighting.
 */

import * as React from "react";
import { AlertTriangle, CalendarX2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";
import { formatTimelineDate, type TimelineEvent } from "@/lib/timeline";
import { EventKindBadge } from "./timeline-ui";

export interface ListViewProps {
  events: TimelineEvent[];
  today: string;
  getProjectName: (projectId: string | undefined) => string | undefined;
  onSelect: (event: TimelineEvent) => void;
}

export function ListView({ events, today, getProjectName, onSelect }: ListViewProps) {
  const sorted = React.useMemo(() => [...events], [events]);

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="No events to list"
        description="Nothing matches the current filters. Try clearing the search or switching the project filter."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Date</TableHead>
            <TableHead>Event</TableHead>
            <TableHead className="w-36">Project</TableHead>
            <TableHead className="w-32">Kind</TableHead>
            <TableHead className="w-24 text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((event) => {
            const projectName = getProjectName(event.projectId);
            return (
              <TableRow
                key={event.id}
                className={cn(event.overdue && "bg-danger/5")}
              >
                <TableCell className="whitespace-nowrap tabular-nums">
                  {formatTimelineDate(event.date)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto justify-start gap-2 px-1 py-0.5 text-left font-medium"
                    onClick={() => onSelect(event)}
                    aria-label={`Open details for ${event.title}`}
                  >
                    <span className="truncate">{event.title}</span>
                    {event.overdue && (
                      <Badge variant="danger">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Overdue
                      </Badge>
                    )}
                  </Button>
                  {event.description && (
                    <p className="mt-0.5 line-clamp-1 px-1 text-xs text-muted-foreground">{event.description}</p>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {projectName ?? "—"}
                </TableCell>
                <TableCell>
                  <EventKindBadge kind={event.kind} />
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {event.status === "done" ? "Done" : event.status === "cancelled" ? "Cancelled" : event.date < today ? "Past" : "Upcoming"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}