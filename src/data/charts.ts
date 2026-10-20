import type { ChartDatum } from "@/types";

/** Completed vs planned tasks per week (last 8 weeks). */
export const weeklyThroughput: ChartDatum[] = [
  { week: "W1", completed: 18, planned: 22 },
  { week: "W2", completed: 24, planned: 25 },
  { week: "W3", completed: 21, planned: 28 },
  { week: "W4", completed: 32, planned: 30 },
  { week: "W5", completed: 28, planned: 31 },
  { week: "W6", completed: 35, planned: 33 },
  { week: "W7", completed: 30, planned: 34 },
  { week: "W8", completed: 38, planned: 36 },
];

/** Revenue vs cost per month (last 6 months). */
export const monthlyRevenue: ChartDatum[] = [
  { month: "Jan", revenue: 12500, cost: 8200 },
  { month: "Feb", revenue: 14800, cost: 9100 },
  { month: "Mar", revenue: 13200, cost: 8800 },
  { month: "Apr", revenue: 17500, cost: 10200 },
  { month: "May", revenue: 18900, cost: 11000 },
  { month: "Jun", revenue: 21400, cost: 11800 },
];

/** Cumulative planned vs actual progress (percent). */
export const cumulativeProgress: ChartDatum[] = [
  { week: "W1", planned: 12, actual: 10 },
  { week: "W2", planned: 24, actual: 21 },
  { week: "W3", planned: 36, actual: 33 },
  { week: "W4", planned: 48, actual: 46 },
  { week: "W5", planned: 60, actual: 58 },
  { week: "W6", planned: 72, actual: 71 },
  { week: "W7", planned: 84, actual: 82 },
  { week: "W8", planned: 96, actual: 95 },
];

export interface DonutSlice {
  name: string;
  value: number;
  colorVar: string; // CSS var, e.g. "var(--chart-1)"
}

export const taskDistribution: DonutSlice[] = [
  { name: "Completed", value: 142, colorVar: "var(--chart-3)" },
  { name: "In Progress", value: 68, colorVar: "var(--chart-1)" },
  { name: "In Review", value: 24, colorVar: "var(--chart-5)" },
  { name: "Todo", value: 47, colorVar: "var(--chart-4)" },
  { name: "Blocked", value: 14, colorVar: "var(--chart-6)" },
];