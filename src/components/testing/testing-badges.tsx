import { Badge } from "@/components/ui/badge";
import type { BugSeverity, BugStatus, ExecutionStatus, GateStatus } from "@/types";

type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral";

const executionVariants: Record<ExecutionStatus, BadgeVariant> = {
  Pass: "success",
  Fail: "danger",
  Blocked: "warning",
  Skipped: "info",
  "Not Run": "neutral",
};

const severityVariants: Record<BugSeverity, BadgeVariant> = {
  Critical: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
};

const bugStatusVariants: Record<BugStatus, BadgeVariant> = {
  Open: "danger",
  "In Progress": "warning",
  Fixed: "success",
  Retest: "info",
  Closed: "neutral",
  Deferred: "neutral",
};

const gateStatusVariants: Record<GateStatus, BadgeVariant> = {
  Pending: "neutral",
  "Ready for Review": "info",
  Approved: "success",
  Rejected: "danger",
  Blocked: "warning",
};

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  return <Badge variant={executionVariants[status]}>{status}</Badge>;
}

export function SeverityBadge({ severity }: { severity: BugSeverity }) {
  return <Badge variant={severityVariants[severity]}>{severity}</Badge>;
}

export function BugStatusBadge({ status }: { status: BugStatus }) {
  return <Badge variant={bugStatusVariants[status]}>{status}</Badge>;
}

export function GateStatusBadge({ status }: { status: GateStatus }) {
  return <Badge variant={gateStatusVariants[status]}>{status}</Badge>;
}