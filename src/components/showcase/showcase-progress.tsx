import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProgressRing } from "@/components/metrics/progress-ring";
import { Progress } from "@/components/ui/progress";
import { progressRings, progressBars } from "@/data/metrics";
import { cn } from "@/lib/utils";

const barToneClass = {
  blue: "bg-chart-1",
  teal: "bg-chart-2",
  green: "bg-chart-3",
  amber: "bg-chart-4",
} as const;

export function ShowcaseProgress() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Progress indicators</h2>
      <p className="text-xs text-muted-foreground">Rings for project completion, bars for adoption metrics.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project completion</CardTitle>
            <CardDescription>Per-project progress against plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {progressRings.map((r) => (
                <ProgressRing key={r.label} value={r.value} label={r.label} sublabel={r.sublabel} tone={r.tone} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace health</CardTitle>
            <CardDescription>Adoption and quality metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            {progressBars.map((b) => (
              <div key={b.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{b.label}</span>
                  <span className="font-medium tabular-nums text-muted-foreground">{b.value}%</span>
                </div>
                <Progress value={b.value} indicatorClassName={cn(barToneClass[b.tone])} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}