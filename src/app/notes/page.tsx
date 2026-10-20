import { Suspense } from "react";

import { NotesBrowser } from "@/components/notes/notes-browser";

export default function NotesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <Suspense
        fallback={
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Loading knowledge center…
          </div>
        }
      >
        <NotesBrowser />
      </Suspense>
    </main>
  );
}