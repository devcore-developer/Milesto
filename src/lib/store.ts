"use client";

import { create } from "zustand";
import {
  DEFAULT_REMINDER_SETTINGS,
  saveReminderSettings,
  type ReminderSettings,
} from "@/lib/notifications";
import { remindersApi } from "@/lib/api-client";
import type { TaskDTO } from "@/lib/types";

export type View =
  | "dashboard"
  | "tasks"
  | "projects"
  | "project-detail"
  | "timeline"
  | "calendar"
  | "clients"
  | "invoices"
  | "documents"
  | "settings";

interface UIState {
  activeView: View;
  /** Project currently opened in the detail view */
  selectedProjectId: string | null;
  /** Global task dialog state (so any view can open it) */
  taskDialogOpen: boolean;
  editingTask: TaskDTO | null;
  /** Project preset when creating a task from inside a project */
  taskDialogProjectId: string | null;
  /** Due-date preset when creating a task from the calendar ("YYYY-MM-DD") */
  taskDialogDueDate: string | null;
  /** Phase 3 reminder settings (hydrated from localStorage in AppRoot) */
  reminderSettings: ReminderSettings;
  setView: (view: View) => void;
  openProject: (projectId: string) => void;
  requestNewTask: (presetProjectId?: string, presetDueDate?: string) => void;
  openEditTask: (task: TaskDTO) => void;
  setTaskDialogOpen: (open: boolean) => void;
  setReminderSettings: (
    settings: ReminderSettings,
    options?: { sync?: boolean },
  ) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: "dashboard",
  selectedProjectId: null,
  taskDialogOpen: false,
  editingTask: null,
  taskDialogProjectId: null,
  taskDialogDueDate: null,
  reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
  setView: (view) => set({ activeView: view }),
  openProject: (projectId) =>
    set({ activeView: "project-detail", selectedProjectId: projectId }),
  requestNewTask: (presetProjectId, presetDueDate) =>
    set({
      // The task dialog is rendered globally (AppRoot) so any view can open
      // it without navigating away from the current screen.
      taskDialogOpen: true,
      editingTask: null,
      taskDialogProjectId: presetProjectId ?? null,
      taskDialogDueDate: presetDueDate ?? null,
    }),
  openEditTask: (task) =>
    set({
      taskDialogOpen: true,
      editingTask: task,
      taskDialogProjectId: task.projectId ?? null,
      taskDialogDueDate: null,
    }),
  setTaskDialogOpen: (open) =>
    set(
      open
        ? { taskDialogOpen: true }
        : {
            taskDialogOpen: false,
            editingTask: null,
            taskDialogProjectId: null,
            taskDialogDueDate: null,
          },
    ),
  // Persist to localStorage (instant cache) and, when `sync` is set, to the
  // database (source of truth — survives cleared browser data & new devices).
  setReminderSettings: (settings, options) => {
    set({ reminderSettings: settings });
    saveReminderSettings(settings);
    if (options?.sync) {
      void remindersApi.update(settings).catch((e) => {
        // Non-fatal: the UI keeps working from the localStorage cache.
        console.warn("[mylist] reminder settings sync failed", e);
      });
    }
  },
}));