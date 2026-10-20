"use client";

/**
 * Milesto — Phase 10 — storage availability warning (Phase 10 §3, §7).
 *
 * Renders a dismissible banner when Milesto had to fall back to in-memory
 * storage (private browsing / blocked localStorage). In that mode data will
 * not survive reloads, so staying silent would be dishonest.
 */

import { useEffect, useState } from "react";
import { isPersistentStorageAvailable } from "@/lib/persistence";

const DISMISS_KEY = "milesto:storage-warning-dismissed";

export function StorageWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isPersistentStorageAvailable()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage itself is unavailable — that is exactly why we warn.
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Nothing else we can do — banner just hides for this session.
    }
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-foreground"
    >
      <span>
        Storage is unavailable in this browser session, so your data will not survive a page
        refresh. Export a backup before closing the tab.
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="rounded px-2 py-0.5 text-xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        Dismiss
      </button>
    </div>
  );
}