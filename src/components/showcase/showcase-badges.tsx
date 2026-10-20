import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge, ProjectStatusBadge, TaskStatusBadge } from "@/components/metrics/status-badge";
import type { Priority, ProjectStatus, TaskStatus } from "@/types";

const projectStatuses: ProjectStatus[] = ["planning", "in-progress", "on-hold", "at-risk", "completed"];
const taskStatuses: TaskStatus[] = ["todo", "in-progress", "in-review", "blocked", "done"];
const priorities: Priority[] = ["low", "medium", "high", "critical"];

export function ShowcaseBadges() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Badges & indicators</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Project status</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {projectStatuses.map((s) => <ProjectStatusBadge key={s} status={s} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Task status</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {taskStatuses.map((s) => <TaskStatusBadge key={s} status={s} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Priority</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {priorities.map((p) => <PriorityBadge key={p} priority={p} />)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Badge variants</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </CardContent>
      </Card>
    </section>
  );
}