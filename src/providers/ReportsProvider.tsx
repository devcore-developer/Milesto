"use client";

/**
 * Milesto — Reports provider (Phase 9, hardened in Phase 10)
 *
 * Aggregates every domain the reports surface reads from:
 * - ProjectProvider (app layout): projects, phases, tasks + the Phase 5
 *   testing state (test cases, executions, bugs, gates).
 * - FinanceProvider (app layout): profiles, obligations, transactions, expenses.
 * - NotesProvider + TimelineProvider are mounted HERE (same per-page pattern
 *   the Knowledge Center uses) so the reports page never depends on how
 *   other pages mount their providers.
 *
 * `milestones` / `deliverables` / `events` come from the Timeline module and
 * are part of the context value on purpose: report tabs must be able to read
 * them from useReports() instead of guessing at other providers.
 */

import * as React from "react";
import { useProjects } from "@/lib/project-context";
import { useFinance } from "@/lib/finance-context";
import { NotesProvider, useNotes } from "@/lib/notes-context";
import { TimelineProvider, useTimeline } from "@/providers/TimelineProvider";
import type {
  Bug,
  Phase,
  Project,
  QualityGate,
  Task,
  TestCase,
  TestExecution,
} from "@/types";
import type {
  FinanceExpense,
  FinanceObligation,
  FinanceTransaction,
  ProjectFinanceProfile,
} from "@/types/finance";
import type { Milestone, TimelineDeliverable, TimelineEvent } from "@/lib/timeline";

/**
 * Note records are derived straight from the Notes context value, so the
 * shape can never drift from what useNotes() actually returns.
 */
type Note = ReturnType<typeof useNotes>["notes"][number];

export interface ReportsContextValue {
  today: string;

  // Projects & execution (from ProjectProvider)
  projects: Project[];
  phases: Phase[];
  tasks: Task[];
  getProjectProgress: (projectId: string) => number;

  // Testing & quality (from ProjectProvider)
  testCases: TestCase[];
  executions: TestExecution[];
  bugs: Bug[];
  gates: QualityGate[];

  // Knowledge (from NotesProvider)
  notes: Note[];

  // Finance (from FinanceProvider)
  profiles: ProjectFinanceProfile[];
  obligations: FinanceObligation[];
  transactions: FinanceTransaction[];
  expenses: FinanceExpense[];

  // Timeline & deliverables (from TimelineProvider)
  milestones: Milestone[];
  deliverables: TimelineDeliverable[];
  events: TimelineEvent[];
}

const ReportsContext = React.createContext<ReportsContextValue | undefined>(undefined);

function ReportsDataSource({ children }: { children: React.ReactNode }) {
  const { projects, phases, tasks, testCases, executions, bugs, gates, getProjectProgress } = useProjects();
  const { profiles, obligations, transactions, expenses } = useFinance();
  const { notes } = useNotes();
  const { milestones, deliverables, events, today } = useTimeline();

  const value = React.useMemo<ReportsContextValue>(
    () => ({
      today,
      projects,
      phases,
      tasks,
      getProjectProgress,
      testCases,
      executions,
      bugs,
      gates,
      notes,
      profiles,
      obligations,
      transactions,
      expenses,
      milestones,
      deliverables,
      events,
    }),
    [
      today,
      projects,
      phases,
      tasks,
      getProjectProgress,
      testCases,
      executions,
      bugs,
      gates,
      notes,
      profiles,
      obligations,
      transactions,
      expenses,
      milestones,
      deliverables,
      events,
    ]
  );

  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  return (
    <NotesProvider>
      <TimelineProvider>
        <ReportsDataSource>{children}</ReportsDataSource>
      </TimelineProvider>
    </NotesProvider>
  );
}

export function useReports(): ReportsContextValue {
  const ctx = React.useContext(ReportsContext);
  if (!ctx) {
    throw new Error("useReports must be used within a ReportsProvider");
  }
  return ctx;
}

export default ReportsProvider;