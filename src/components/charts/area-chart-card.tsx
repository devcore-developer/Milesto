"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ChartContainer } from "./chart-container";
import { ChartLegend } from "./chart-legend";
import { ChartTooltip } from "./chart-tooltip";
import type { ChartDatum } from "@/types";

interface AreaSeriesConfig {
  key: string;
  name: string;
  color: string;
  dashed?: boolean;
}

interface AreaChartCardProps {
  title: string;
  description?: string;
  data: ChartDatum[];
  xKey: string;
  series: AreaSeriesConfig[];
  height?: number;
  format?: "number" | "currency" | "percent";
  legendItems?: { name: string; color: string }[];
  className?: string;
}

export function AreaChartCard({
  title,
  description,
  data,
  xKey,
  series,
  height = 280,
  format = "percent",
  legendItems,
  className,
}: AreaChartCardProps) {
  return (
    <ChartContainer
      title={title}
      description={description}
      action={legendItems ? <ChartLegend items={legendItems} /> : undefined}
      className={className}
    >
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              width={36}
              tickFormatter={(v: any) => (format === "percent" ? `${v}%` : String(v))}
            />
            <Tooltip content={<ChartTooltip format={format} />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                fill={`url(#area-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}