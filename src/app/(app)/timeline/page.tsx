"use client";

/**
 * Milesto — Timeline page (Phase 10 fix)
 *
 * Per-page provider mounting, same pattern as the reports page:
 * - ProjectProvider comes from the (app) layout.
 * - FinanceProvider + TimelineProvider are mounted HERE, in that order,
 *   because TimelineProvider reads payment obligations from the Finance
 *   module (useFinance) and must sit underneath it.
 * With this chain every useTimeline() call inside the workspace resolves
 * during static prerendering too.
 */

import { FinanceProvider } from "@/lib/finance-context";
import { TimelineProvider } from "@/providers/TimelineProvider";
import { TimelineWorkspace } from "@/components/timeline/TimelineWorkspace";

export default function TimelinePage() {
  return (
    <FinanceProvider>
      <TimelineProvider>
        <TimelineWorkspace />
      </TimelineProvider>
    </FinanceProvider>
  );
}