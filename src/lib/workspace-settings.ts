"use client";

import { useCallback, useEffect, useState } from "react";

export type WorkspaceSettings = {
  workspaceName: string;
  ownerName: string;
  ownerRole: string;
  ownerInitials: string;
};

export const WORKSPACE_SETTINGS_KEY = "milesto.settings.v1";

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  workspaceName: "",
  ownerName: "",
  ownerRole: "Workspace owner",
  ownerInitials: "",
};

function asText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function loadWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_WORKSPACE_SETTINGS };
  try {
    const raw = window.localStorage.getItem(WORKSPACE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_WORKSPACE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettings> | null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_WORKSPACE_SETTINGS };
    return {
      workspaceName: asText(parsed.workspaceName, DEFAULT_WORKSPACE_SETTINGS.workspaceName),
      ownerName: asText(parsed.ownerName, DEFAULT_WORKSPACE_SETTINGS.ownerName),
      ownerRole: asText(parsed.ownerRole, DEFAULT_WORKSPACE_SETTINGS.ownerRole),
      ownerInitials: asText(parsed.ownerInitials, DEFAULT_WORKSPACE_SETTINGS.ownerInitials),
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_SETTINGS };
  }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable (private mode, quota) — settings stay in memory only.
  }
}

export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function resolveWorkspaceName(settings: WorkspaceSettings): string {
  return settings.workspaceName.trim() || "Milesto";
}

export function resolveOwnerName(settings: WorkspaceSettings): string {
  return settings.ownerName.trim() || "Workspace owner";
}

export function resolveOwnerInitials(settings: WorkspaceSettings): string {
  const custom = settings.ownerInitials.trim();
  if (custom) return custom.slice(0, 3).toUpperCase();
  return deriveInitials(settings.ownerName);
}

export function useWorkspaceSettings() {
  const [settings, setSettings] = useState<WorkspaceSettings>({
    ...DEFAULT_WORKSPACE_SETTINGS,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadWorkspaceSettings());
    setHydrated(true);
  }, []);

  const save = useCallback((next: WorkspaceSettings) => {
    const cleaned: WorkspaceSettings = {
      workspaceName: next.workspaceName.trim(),
      ownerName: next.ownerName.trim(),
      ownerRole: next.ownerRole.trim() || DEFAULT_WORKSPACE_SETTINGS.ownerRole,
      ownerInitials: next.ownerInitials.trim().toUpperCase(),
    };
    setSettings(cleaned);
    saveWorkspaceSettings(cleaned);
    return cleaned;
  }, []);

  return { settings, hydrated, save };
}