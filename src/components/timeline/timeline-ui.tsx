"use client";

/**
 * Shared presentation helpers for the Timeline module: status/variant maps,
 * badge components and the event-details dialog.
 *
 * The dialog deliberately does NOT receive "today" as a prop — it derives
 * overdue state itself from the event's computed `overdue` flag (set by
 * buildTimelineEvents) plus the local clock, so every call site stays simple
 * and props can never drift out of sync.
 */

import * as React from "react";
import { AlertTriangle, CalendarClock, Flag, PackageCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatTimelineDate, todayISO, type MilestoneStatus, type TimelineDeliverable, type TimelineEvent, type TimelineEventKind } from "@/lib/timeline";

/* ------------------------------- labels ---------------------------------- */

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  planned: "Planned",
  "in-progress": "In Progress",
  done: "Done",
  "at-risk": "At Risk",
  cancelled: "Cancelled",
};

export const MILESTONE_STATUS_VARIANTS: Record<MilestoneStatus, "neutral" | "info" | "success" | "danger" | "warning"> = {
  planned: "neutral",
  "in-progress": "info",
  done: "success",
  "at-risk": "danger",
  cancelled: "warning",
};

export const DELIVERABLE_STATUS_LABELS: Record<TimelineDeliverable["status"], string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  submitted: "Submitted",
  approved: "Approved",
};

export const DELIVERABLE_STATUS_VARIANTS: Record<TimelineDeliverable["status"], "neutral" | "info" | "warning" | "success"> = {
  pending: "neutral",
  "in-progress": "info",
  submitted: "warning",
  approved: "success",
};

export const EVENT_KIND_LABELS: Record<TimelineEventKind, string> = {
  milestone: "Milestone",
  deliverable: "Deliverable",
  payment: "Payment",
  custom: "Event",
};

const EVENT_KIND_ICONS: Record<TimelineEventKind, React.ComponentType<{ className?: string }>> = {
  milestone: Flag,
  deliverable: PackageCheck,
  payment: Wallet,
  custom: CalendarClock,
};

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return <Badge variant={MILESTONE_STATUS_VARIANTS[status]}>{MILESTONE_STATUS_LABELS[status]}</Badge>;
}

export function DeliverableStatusBadge({ status }: { status: TimelineDeliverable["status"] }) {
  return <Badge variant={DELIVERABLE_STATUS_VARIANTS[status]}>{DELIVERABLE_STATUS_LABELS[status]}</Badge>;
}

export function EventKindBadge({ kind }: { kind: TimelineEventKind }) {
  const Icon = EVENT_KIND_ICONS[kind];
  return (
    <Badge variant="outline" className="normal-case">
      <Icon className="h-3 w-3" aria-hidden />
      {EVENT_KIND_LABELS[kind]}
    </Badge>
  );
}

/* --------------------------- event details dialog ------------------------ */

export interface EventDetailsDialogProps {
  event: TimelineEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolved display name for the event's project (optional). */
  projectName?: string;
}

export function EventDetailsDialog({ event, open, onOpenChange, projectName }: EventDetailsDialogProps) {
  if (!event) return null;
  const overdue = event.overdue ?? (event.status === "planned" && event.date < todayISO());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" role="dialog" aria-label={`Event details: ${event.title}`}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            <span>{event.title}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <EventKindBadge kind={event.kind} />
            {event.status === "done" && <Badge variant="success">Done</Badge>}
            {event.status === "cancelled" && <Badge variant="warning">Cancelled</Badge>}
            {overdue && event.status === "planned" && (
              <Badge variant="danger">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Overdue
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="font-medium tabular-nums">{formatTimelineDate(event.date)}</dd>
          </div>
          {projectName && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Project</dt>
              <dd className="font-medium">{projectName}</dd>
            </div>
          )}
          {event.description && (
            <div className="space-y-1">
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed text-foreground">
                {event.description}
              </dd>
            </div>
          )}
          {event.sourceId && (
            <p className={cn("rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground")}>
              This entry is generated from the linked {EVENT_KIND_LABELS[event.sourceKind ?? "custom"].toLowerCase()} record — edit it at the source.
            </p>
          )}
        </dl>
      </DialogContent>
    </Dialog>
  );
}