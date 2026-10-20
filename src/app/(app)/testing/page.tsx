"use client";

import { PageHeader } from "@/components/common/page-header";
import { TestingDashboard } from "@/components/testing/testing-dashboard";

export default function TestingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Testing & Quality" description="Monitor test executions, bug tracking, and quality gates across all projects." />
      <TestingDashboard />
    </div>
  );
}