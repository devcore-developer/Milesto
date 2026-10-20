"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ChartContainer } from "./chart-container";
import { ChartLegend } from "./chart-legend";
import { ChartTooltip } from "./chart-tooltip";
import type { ChartDatum } from "@/types";

interface SeriesConfig {
  key: string;
  name: string;
  color: string;
  dashed?: boolean;
}

interface LineChartCardProps {
  title: string;
  description?: string;
  data: ChartDatum[];
  xKey: string;
  series: SeriesConfig[];
  height?: number;
  legendItems?: { name: string; color: string }[];
}

export function LineChartCard({
  title,
  description,
  data,
  xKey,
  series,
  height = 280,
  legendItems,
}: LineChartCardProps) {
  return (
    <ChartContainer
      title={title}
      description={description}
      action={legendItems ? <ChartLegend items={legendItems} /> : undefined}
    >
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis axisLine={false} tickLine={false} tickMargin={8} width={36} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={{ r: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}