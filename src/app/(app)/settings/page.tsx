"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { deriveInitials, useWorkspaceSettings } from "@/lib/workspace-settings";
import type { WorkspaceSettings } from "@/lib/workspace-settings";

const TIMELINE_CACHE_KEY = "milesto.timeline.state";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

const secondaryButtonClass =
  "inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function DataRow({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 max-w-md text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, hydrated, save } = useWorkspaceSettings();
  const [form, setForm] = useState<WorkspaceSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [clearedCache, setClearedCache] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    if (hydrated && form === null) {
      setForm({ ...settings });
    }
  }, [hydrated, settings, form]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    if (!clearedCache) return;
    const timer = window.setTimeout(() => setClearedCache(false), 2500);
    return () => window.clearTimeout(timer);
  }, [clearedCache]);

  if (!hydrated || !form) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      </div>
    );
  }

  const setField = (patch: Partial<WorkspaceSettings>) =>
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const previewInitials =
    form.ownerInitials.trim().slice(0, 3).toUpperCase() || deriveInitials(form.ownerName);

  function handleSave() {
    if (!form) return;
    save(form);
    setSaved(true);
  }

  function handleExport() {
    if (!form) return;
    try {
      const blob = new Blob([JSON.stringify(form, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "milesto-settings.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Export is best-effort; ignore environments that block downloads.
    }
  }

  function handleClearTimelineCache() {
    try {
      window.localStorage.removeItem(TIMELINE_CACHE_KEY);
    } catch {
      // ignore
    }
    setClearedCache(true);
  }

  function handleClearAll() {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      window.setTimeout(() => setConfirmClearAll(false), 4000);
      return;
    }
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace, profile, and local data settings for Milesto.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Profile &amp; workspace</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How you and your workspace appear across the app.
          </p>
        </div>
        <div className="space-y-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
              {previewInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {form.ownerName.trim() || "No name set"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {form.ownerRole.trim() || "Workspace owner"}
                {form.workspaceName.trim() ? ` · ${form.workspaceName.trim()}` : ""}
              </p>
            </div>
          </div>

          <Field label="Workspace name">
            <input
              value={form.workspaceName}
              onChange={(event) => setField({ workspaceName: event.target.value })}
              placeholder="Milesto"
              className={inputClass}
            />
          </Field>

          <Field label="Your name">
            <input
              value={form.ownerName}
              onChange={(event) => setField({ ownerName: event.target.value })}
              placeholder="Your full name"
              className={inputClass}
            />
          </Field>

          <Field label="Role / title">
            <input
              value={form.ownerRole}
              onChange={(event) => setField({ ownerRole: event.target.value })}
              placeholder="Workspace owner"
              className={inputClass}
            />
          </Field>

          <Field
            label="Avatar initials"
            hint="Leave empty to derive them automatically from your name."
          >
            <input
              value={form.ownerInitials}
              onChange={(event) => setField({ ownerInitials: event.target.value.toUpperCase() })}
              maxLength={3}
              placeholder={deriveInitials(form.ownerName) || "e.g. MV"}
              className={inputClass}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Save changes
            </button>
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {saved ? "Saved" : "Preferences are stored locally in this browser."}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Data</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage data that Milesto stores locally in this browser.
          </p>
        </div>
        <div className="divide-y divide-border">
          <DataRow
            title="Export settings"
            description="Download your profile and workspace preferences as a JSON file."
            action={
              <button type="button" onClick={handleExport} className={secondaryButtonClass}>
                Export JSON
              </button>
            }
          />
          <DataRow
            title="Clear timeline cache"
            description="Milesto caches timeline milestones and events in this browser. Clearing the cache resets the timeline to an empty state on your next visit."
            action={
              <div className="flex items-center gap-2">
                {clearedCache ? (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Cleared
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleClearTimelineCache}
                  className={secondaryButtonClass}
                >
                  Clear cache
                </button>
              </div>
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-rose-500/30 bg-card">
        <div className="border-b border-rose-500/20 px-4 py-3">
          <h2 className="text-sm font-semibold text-rose-600 dark:text-rose-400">Danger zone</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Irreversible actions on locally stored data.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Clear all local data</p>
            <p className="mt-0.5 max-w-md text-xs text-muted-foreground">
              Removes every Milesto entry from this browser — settings, the timeline cache, and
              any other locally stored data — then reloads the page.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearAll}
            className={
              confirmClearAll
                ? "inline-flex h-9 shrink-0 items-center rounded-md border border-rose-500/40 bg-rose-500/20 px-4 text-sm font-medium text-rose-600 dark:text-rose-300"
                : "inline-flex h-9 shrink-0 items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-4 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
            }
          >
            {confirmClearAll ? "Click again to confirm" : "Clear all data"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card px-4 py-4">
        <h2 className="text-sm font-semibold text-foreground">About</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Milesto is a personal project execution platform — plan projects, run delivery, track
          financial obligations, and capture knowledge, all in one workspace.
        </p>
      </section>
    </div>
  );
}