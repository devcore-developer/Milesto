"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { ChartContainer } from "./chart-container";
import { ChartTooltip } from "./chart-tooltip";
import type { DonutSlice } from "@/data/charts";

interface DonutChartCardProps {
  title: string;
  description?: string;
  data: DonutSlice[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChartCard({
  title,
  description,
  data,
  height = 280,
  centerLabel,
  centerValue,
}: DonutChartCardProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const label = centerLabel ?? "Total";
  const value = centerValue ?? String(total);

  return (
    <ChartContainer title={title} description={description}>
      <div className="relative" style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            >
              {data.map((slice) => (
                <Cell key={slice.name} fill={slice.colorVar} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
        </div>
      </div>
    </ChartContainer>
  );
}