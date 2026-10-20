import type { Metadata } from "next";
import { TestingWorkspace } from "@/components/testing/testing-workspace";

export const metadata: Metadata = { title: "Testing & Quality — Milesto" };

export default function TestingPage() {
  return <TestingWorkspace />;
}