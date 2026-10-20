import { Badge } from "@/components/ui/badge";
import type { ProjectStatus, TaskStatus, Priority } from "@/types";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  switch (status) {
    case "planning": return <Badge variant="neutral">Planning</Badge>;
    case "in-progress": return <Badge variant="info">In Progress</Badge>;
    case "on-hold": return <Badge variant="warning">On Hold</Badge>;
    case "at-risk": return <Badge variant="danger">At Risk</Badge>;
    case "completed": return <Badge variant="success">Completed</Badge>;
  }
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  switch (status) {
    case "todo": return <Badge variant="neutral">Todo</Badge>;
    case "in-progress": return <Badge variant="info">In Progress</Badge>;
    case "in-review": return <Badge variant="secondary">In Review</Badge>;
    case "blocked": return <Badge variant="danger">Blocked</Badge>;
    case "done": return <Badge variant="success">Done</Badge>;
  }
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  switch (priority) {
    case "low": return <Badge variant="outline">Low</Badge>;
    case "medium": return <Badge variant="secondary">Medium</Badge>;
    case "high": return <Badge variant="warning">High</Badge>;
    case "critical": return <Badge variant="danger">Critical</Badge>;
  }
}