import type { Metric } from "@/types";

export const headlineMetrics: Metric[] = [
  {
    label: "Active Projects",
    value: "6",
    delta: { value: "+2 vs last month", direction: "up", tone: "positive" },
    hint: "2 launching this quarter",
    accent: "blue",
  },
  {
    label: "Open Tasks",
    value: "129",
    delta: { value: "−14 vs last week", direction: "down", tone: "positive" },
    hint: "38 due this week",
    accent: "teal",
  },
  {
    label: "On-Time Delivery",
    value: "92%",
    delta: { value: "+3.1 pts", direction: "up", tone: "positive" },
    hint: "Rolling 30-day average",
    accent: "green",
  },
  {
    label: "Revenue (MTD)",
    value: "$21.4K",
    delta: { value: "−4.2% vs target", direction: "down", tone: "negative" },
    hint: "Target: $22.4K",
    accent: "amber",
  },
];

export interface ProgressRingDatum {
  label: string;
  value: number;
  tone: "blue" | "teal" | "green" | "amber";
  sublabel?: string;
}

export const progressRings: ProgressRingDatum[] = [
  { label: "Atlas Platform", value: 68, tone: "blue", sublabel: "On track" },
  { label: "Northwind Mobile", value: 84, tone: "green", sublabel: "Ahead" },
  { label: "Ledger Migration", value: 32, tone: "amber", sublabel: "At risk" },
  { label: "Helix API", value: 51, tone: "teal", sublabel: "On track" },
];

export interface ProgressBarDatum {
  label: string;
  value: number;
  tone: "blue" | "teal" | "green" | "amber";
}

export const progressBars: ProgressBarDatum[] = [
  { label: "Design system adoption", value: 78, tone: "blue" },
  { label: "Test coverage", value: 64, tone: "teal" },
  { label: "Documentation", value: 41, tone: "amber" },
  { label: "Performance budget", value: 92, tone: "green" },
];