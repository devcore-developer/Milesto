"use client";

import { useState } from "react";
import { TestingDashboard } from "@/components/testing/testing-dashboard";
import { TestCaseManager } from "@/components/testing/test-case-manager";
import { BugManager } from "@/components/testing/bug-manager";
import { QualityGatesPanel } from "@/components/testing/quality-gates-panel";
import { AutomatedImportPanel } from "@/components/testing/automated-import-panel";
import { defaultTestingFilters, type TestingFilters } from "@/lib/testing-analytics";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "cases", label: "Test cases" },
  { id: "bugs", label: "Bugs" },
  { id: "gates", label: "Quality gates" },
  { id: "import", label: "CI import" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TestingWorkspace() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [filters, setFilters] = useState<TestingFilters>({ ...defaultTestingFilters });

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Testing & Quality</h1>
        <p className="text-sm text-muted-foreground">One shared dataset drives every number here — cases, executions, bugs and gates.</p>
        <p className="text-xs text-muted-foreground">Data lives in memory for this session and resets on refresh.</p>
      </header>

      <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" ? (
        <TestingDashboard filters={filters} onFiltersChange={setFilters} onReviewGates={() => setTab("gates")} />
      ) : null}
      {tab === "cases" ? <TestCaseManager filters={filters} onFiltersChange={setFilters} /> : null}
      {tab === "bugs" ? <BugManager /> : null}
      {tab === "gates" ? <QualityGatesPanel /> : null}
      {tab === "import" ? <AutomatedImportPanel /> : null}
    </div>
  );
}