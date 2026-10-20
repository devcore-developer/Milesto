import type { Metadata } from "next";
import TimelineWorkspace from "@/components/timeline/TimelineWorkspace";

export const metadata: Metadata = {
  title: "الجدول الزمني والمخرجات — Milesto",
};

export default function TimelinePage() {
  return <TimelineWorkspace />;
}