import { MetricCard } from "@/components/metrics/metric-card";
import { FolderKanban, ListChecks, Target, Wallet } from "lucide-react";
import { headlineMetrics } from "@/data/metrics";

const icons = [FolderKanban, ListChecks, Target, Wallet];

export function ShowcaseMetrics() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Metric cards</h2>
      <p className="text-xs text-muted-foreground">Headline KPIs with comparison deltas and contextual hints.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {headlineMetrics.map((m, i) => (
          <MetricCard key={m.label} {...m} icon={icons[i]} />
        ))}
      </div>
    </section>
  );
}