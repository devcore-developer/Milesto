"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ChartContainer } from "./chart-container";
import { ChartLegend } from "./chart-legend";
import { ChartTooltip } from "./chart-tooltip";
import { formatCompactCurrency } from "@/lib/utils";
import type { ChartDatum } from "@/types";

interface BarSeriesConfig {
  key: string;
  name: string;
  color: string;
}

interface BarChartCardProps {
  title: string;
  description?: string;
  data: ChartDatum[];
  xKey: string;
  yKey?: string;
  series: BarSeriesConfig[];
  height?: number;
  format?: "number" | "currency" | "percent";
  layout?: "horizontal" | "vertical";
  stackId?: string;
  legendItems?: { name: string; color: string }[];
  className?: string;
}

export function BarChartCard({
  title,
  description,
  data,
  xKey,
  yKey,
  series,
  height = 280,
  format = "number",
  layout = "horizontal",
  stackId,
  legendItems,
  className,
}: BarChartCardProps) {
  const isVertical = layout === "vertical";
  
  return (
    <ChartContainer
      title={title}
      description={description}
      action={legendItems ? <ChartLegend items={legendItems} /> : undefined}
      className={className}
    >
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            layout={layout} 
            margin={{ top: 8, right: 12, left: isVertical ? 0 : -8, bottom: 0 }} 
            barGap={4} 
            barCategoryGap="22%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={isVertical} horizontal={!isVertical} />
            {isVertical ? (
              <>
                <XAxis 
                  type="number" 
                  axisLine={false} 
                  tickLine={false} 
                  tickMargin={8} 
                  tickFormatter={(v: any) => (format === "currency" ? formatCompactCurrency(Number(v)) : String(v))} 
                />
                <YAxis 
                  dataKey={yKey || xKey} 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tickMargin={8} 
                  width={120} 
                />
              </>
            ) : (
              <>
                <XAxis 
                  dataKey={xKey} 
                  axisLine={false} 
                  tickLine={false} 
                  tickMargin={8} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickMargin={8} 
                  width={48} 
                  tickFormatter={(v: any) => (format === "currency" ? formatCompactCurrency(Number(v)) : String(v))} 
                />
              </>
            )}
            <Tooltip
              content={<ChartTooltip format={format} />}
              cursor={{ fill: "hsl(var(--accent))", opacity: 0.4 }}
            />
            {series.map((s) => (
              <Bar 
                key={s.key} 
                dataKey={s.key} 
                name={s.name} 
                fill={s.color} 
                radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} 
                maxBarSize={36}
                stackId={stackId}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}