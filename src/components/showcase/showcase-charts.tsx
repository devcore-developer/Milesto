import { LineChartCard } from "@/components/charts/line-chart-card";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { DonutChartCard } from "@/components/charts/donut-chart-card";
import { ChartLegend } from "@/components/charts/chart-legend";
import {
  weeklyThroughput,
  monthlyRevenue,
  cumulativeProgress,
  taskDistribution,
} from "@/data/charts";

export function ShowcaseCharts() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Charts</h2>
      <p className="text-xs text-muted-foreground">
        Reusable chart components with consistent palette, subtle gridlines, and shared tooltip styling.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LineChartCard
          title="Weekly throughput"
          description="Completed vs planned tasks (last 8 weeks)"
          data={weeklyThroughput}
          xKey="week"
          series={[
            { key: "completed", name: "Completed", color: "hsl(var(--chart-1))" },
            { key: "planned", name: "Planned", color: "hsl(var(--chart-4))", dashed: true },
          ]}
          legendItems={[
            { name: "Completed", color: "hsl(var(--chart-1))" },
            { name: "Planned", color: "hsl(var(--chart-4))" },
          ]}
        />

        <BarChartCard
          title="Revenue vs cost"
          description="Monthly project revenue and direct cost"
          data={monthlyRevenue}
          xKey="month"
          format="currency"
          series={[
            { key: "revenue", name: "Revenue", color: "hsl(var(--chart-1))" },
            { key: "cost", name: "Cost", color: "hsl(var(--chart-4))" },
          ]}
          legendItems={[
            { name: "Revenue", color: "hsl(var(--chart-1))" },
            { name: "Cost", color: "hsl(var(--chart-4))" },
          ]}
        />

        <AreaChartCard
          title="Cumulative progress"
          description="Planned vs actual completion (% of plan)"
          data={cumulativeProgress}
          xKey="week"
          series={[
            { key: "planned", name: "Planned", color: "hsl(var(--muted-foreground))", dashed: true },
            { key: "actual", name: "Actual", color: "hsl(var(--chart-2))" },
          ]}
          legendItems={[
            { name: "Planned", color: "hsl(var(--muted-foreground))" },
            { name: "Actual", color: "hsl(var(--chart-2))" },
          ]}
        />

        <div className="grid grid-cols-1 gap-4">
          <DonutChartCard
            title="Task distribution"
            description="Open and closed tasks across all projects"
            data={taskDistribution}
            centerLabel="Total tasks"
            height={220}
          />
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <ChartLegend
              items={taskDistribution.map((d) => ({ name: d.name, color: d.colorVar }))}
            />
          </div>
        </div>
      </div>
    </section>
  );
}