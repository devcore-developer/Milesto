import type { Metadata } from "next";
import ReportsWorkspace from "@/components/reports/ReportsWorkspace";

export const metadata: Metadata = {
  title: "التقارير والتحليلات — Milesto",
};

export default function ReportsPage() {
  return <ReportsWorkspace />;
}