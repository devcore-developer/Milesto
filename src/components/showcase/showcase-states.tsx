import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Inbox, FileText } from "lucide-react";
import { DeadlineIndicator } from "@/components/common/deadline-indicator";

const deadlineSamples = [
  { iso: "2024-08-04", label: "Overdue" },
  { iso: "2024-08-12", label: "Due soon" },
  { iso: "2024-08-25", label: "Upcoming" },
];

export function ShowcaseStates() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">States</h2>
      <p className="text-xs text-muted-foreground">Loading, empty, and error patterns plus deadline tones.</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Loading skeleton</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Empty state</CardTitle></CardHeader>
          <CardContent>
            <EmptyState
              icon={Inbox}
              title="No notes yet"
              description="Capture decisions, meeting outcomes, and shared context for your projects."
              actionLabel="Create note"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Error state</CardTitle></CardHeader>
          <CardContent>
            <ErrorState
              title="Couldn’t load reports"
              description="A network error occurred while fetching analytics data."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Deadline indicators</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 pt-1">
            {deadlineSamples.map((d) => (
              <div key={d.label} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                <span className="text-xs text-muted-foreground">{d.label}</span>
                <DeadlineIndicator iso={d.iso} />
              </div>
            ))}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">Completed</span>
              <DeadlineIndicator iso="2024-07-22" completed />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}