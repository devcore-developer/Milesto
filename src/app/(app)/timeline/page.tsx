"use client";

/**
 * Milesto — Timeline page (Phase 10 fix)
 *
 * TimelineProvider is mounted per-page (same pattern as ReportsProvider on
 * the reports page and the Knowledge Center): the (app) layout supplies
 * ProjectProvider + FinanceProvider, and TimelineProvider sits underneath
 * them here so useTimeline() works everywhere in this route — including
 * during static prerendering.
 */

import { TimelineProvider } from "@/providers/TimelineProvider";
import { TimelineWorkspace } from "@/components/timeline/TimelineWorkspace";

export default function TimelinePage() {
  return (
    <TimelineProvider>
      <TimelineWorkspace />
    </TimelineProvider>
  );
}