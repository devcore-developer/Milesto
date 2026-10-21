"use client";

import { FinanceProvider } from "@/lib/finance-context";
import { NotesProvider } from "@/lib/notes-context";
import { TimelineProvider } from "@/providers/TimelineProvider";
import { TimelineWorkspace } from "@/components/timeline/TimelineWorkspace";

export default function TimelinePage() {
  return (
    <FinanceProvider>
      <NotesProvider>
        <TimelineProvider>
          <TimelineWorkspace />
        </TimelineProvider>
      </NotesProvider>
    </FinanceProvider>
  );
}