"use client";

/**
 * Milesto — Timeline & Deliverables provider (Phase 8, hardened in Phase 10)
 *
 * State: milestones, deliverables and user-created events, persisted under
 * the module's own versioned localStorage key (same honest pattern as the
 * Finance module — no server, no cross-device sync).
 *
 * Derived timeline events (milestone due dates, deliverable due dates and
 * payment obligations pulled from the Finance module) are recomputed on every
 * read via buildTimelineEvents — they are never stored, so they can never
 * disagree with the underlying records.
 */

import * as React from "react";
import { useProjects } from "@/lib/project-context";
import { useFinance } from "@/lib/finance-context";
import {
  seedCustomEvents,
  seedDeliverables,
  seedMilestones,
} from "@/data/timeline-data";
import {
  buildTimelineEvents,
  canTransitionDeliverable,
  canTransitionMilestone,
  customEventInputSchema,
  customEventPatchSchema,
  deliverableInputSchema,
  deliverablePatchSchema,
  detectDependencyCycle,
  firstIssueMessage,
  isISODate,
  milestoneInputSchema,
  milestonePatchSchema,
  nextTimelineId,
  todayISO,
  unknownDependencies,
  type Milestone,
  type StoredTimelineState,
  type TimelineDeliverable,
  type TimelineEvent,
} from "@/lib/timeline";

/**
 * Result of every timeline mutation. Defined (and exported) here because the
 * project context does not export a MutationResult type.
 */
export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const TIMELINE_STORAGE_KEY = "milesto.timeline.state";
const TIMELINE_STATE_VERSION = 1;

interface TimelinePersistedState extends StoredTimelineState {
  version: number;
  savedAt: string;
}

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function isPersistedState(value: unknown): value is TimelinePersistedState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === TIMELINE_STATE_VERSION &&
    typeof v.savedAt === "string" &&
    Array.isArray(v.milestones) &&
    Array.isArray(v.deliverables) &&
    Array.isArray(v.customEvents)
  );
}

function loadTimelineState(): TimelinePersistedState | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(TIMELINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPersistedState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveTimelineState(state: StoredTimelineState): string | null {
  if (!hasStorage()) return "localStorage is not available in this environment";
  try {
    const payload: TimelinePersistedState = {
      ...state,
      version: TIMELINE_STATE_VERSION,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(payload));
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage error";
    return `Failed to save: ${message}`;
  }
}

function clearTimelineStorage(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(TIMELINE_STORAGE_KEY);
  } catch {
    // Nothing else we can do here.
  }
}

function cloneSeed(): StoredTimelineState {
  return {
    milestones: seedMilestones.map((m) => ({ ...m, dependencies: m.dependencies ? [...m.dependencies] : undefined })),
    deliverables: seedDeliverables.map((d) => ({ ...d, dependencies: d.dependencies ? [...d.dependencies] : undefined })),
    customEvents: seedCustomEvents.map((e) => ({ ...e })),
  };
}

/** Ids of derived events ("evt:...") — mutations must reject them. */
function isDerivedEventId(id: string): boolean {
  return id.startsWith("evt:");
}

export interface TimelineContextValue {
  milestones: Milestone[];
  deliverables: TimelineDeliverable[];
  customEvents: TimelineEvent[];
  /** Derived (milestones + deliverables + payments) plus custom events, sorted by date. */
  events: TimelineEvent[];
  today: string;
  persistenceError: string | null;
  hydrated: boolean;

  getMilestoneById: (id: string) => Milestone | undefined;
  getDeliverableById: (id: string) => TimelineDeliverable | undefined;

  addMilestone: (data: unknown) => MutationResult;
  updateMilestone: (id: string, data: unknown) => MutationResult;
  deleteMilestone: (id: string) => MutationResult;

  addDeliverable: (data: unknown) => MutationResult;
  updateDeliverable: (id: string, data: unknown) => MutationResult;
  setDeliverableStatus: (id: string, status: TimelineDeliverable["status"]) => MutationResult;
  deleteDeliverable: (id: string) => MutationResult;

  addEvent: (data: unknown) => MutationResult;
  updateEvent: (id: string, data: unknown) => MutationResult;
  deleteEvent: (id: string) => MutationResult;

  /** Restores the demonstration dataset and clears persisted timeline state. */
  resetTimelineData: () => void;
}

const TimelineContext = React.createContext<TimelineContextValue | undefined>(undefined);

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  const { projects } = useProjects();
  const { obligations } = useFinance();
  const seed = React.useRef<StoredTimelineState>(cloneSeed());

  const [milestones, setMilestones] = React.useState<Milestone[]>(() => seed.current.milestones);
  const [deliverables, setDeliverables] = React.useState<TimelineDeliverable[]>(() => seed.current.deliverables);
  const [customEvents, setCustomEvents] = React.useState<TimelineEvent[]>(() => seed.current.customEvents);
  const [persistenceError, setPersistenceError] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);
  const hydratedRef = React.useRef(false);
  // Frozen once per mount so a session's view of "today" is stable.
  const [today] = React.useState<string>(() => todayISO());

  React.useEffect(() => {
    const stored = loadTimelineState();
    if (stored) {
      setMilestones(stored.milestones);
      setDeliverables(stored.deliverables);
      setCustomEvents(stored.customEvents);
    }
    hydratedRef.current = true;
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydratedRef.current) return;
    const error = saveTimelineState({ milestones, deliverables, customEvents });
    setPersistenceError(error);
  }, [milestones, deliverables, customEvents]);

  const getMilestoneById = React.useCallback(
    (id: string) => milestones.find((m) => m.id === id),
    [milestones]
  );

  const getDeliverableById = React.useCallback(
    (id: string) => deliverables.find((d) => d.id === id),
    [deliverables]
  );

  /* ------------------------------ milestones ------------------------------ */

  const addMilestone = React.useCallback(
    (data: unknown): MutationResult => {
      const parsed = milestoneInputSchema.safeParse(data);
      if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };
      const input = parsed.data;
      if (!projects.some((p) => p.id === input.projectId)) {
        return { ok: false, error: `Unknown project ${input.projectId}` };
      }
      const draft: Milestone = {
        id: nextTimelineId("MS", milestones.map((m) => m.id)),
        projectId: input.projectId,
        title: input.title,
        dueDate: input.dueDate,
        status: input.status,
        description: input.description,
        dependencies: input.dependencies,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const merged = [...milestones, draft];
      if (unknownDependencies(merged).length > 0) {
        return { ok: false, error: "Dependencies must reference existing milestones." };
      }
      const cycle = detectDependencyCycle(merged);
      if (cycle) {
        return { ok: false, error: `Dependency cycle detected: ${cycle.join(" → ")}` };
      }
      setMilestones(merged);
      return { ok: true, id: draft.id };
    },
    [milestones, projects]
  );

  const updateMilestone = React.useCallback(
    (id: string, data: unknown): MutationResult => {
      const target = milestones.find((m) => m.id === id);
      if (!target) return { ok: false, error: `Milestone ${id} not found` };
      const parsed = milestonePatchSchema.safeParse(data);
      if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };
      const patch = parsed.data;
      if (patch.status && patch.status !== target.status) {
        if (!canTransitionMilestone(target.status, patch.status)) {
          return {
            ok: false,
            error: `Invalid transition: ${target.status} → ${patch.status}. Milestones follow an explicit workflow.`,
          };
        }
      }
      if (patch.dueDate !== undefined && !isISODate(patch.dueDate)) {
        return { ok: false, error: "Due date must be a real date (YYYY-MM-DD)." };
      }
      const updated: Milestone = { ...target, ...patch, updatedAt: new Date().toISOString() };
      const merged = milestones.map((m) => (m.id === id ? updated : m));
      if (unknownDependencies(merged).length > 0) {
        return { ok: false, error: "Dependencies must reference existing milestones." };
      }
      const cycle = detectDependencyCycle(merged);
      if (cycle) {
        return { ok: false, error: `Dependency cycle detected: ${cycle.join(" → ")}` };
      }
      setMilestones(merged);
      return { ok: true, id };
    },
    [milestones]
  );

  const deleteMilestone = React.useCallback(
    (id: string): MutationResult => {
      const target = milestones.find((m) => m.id === id);
      if (!target) return { ok: false, error: `Milestone ${id} not found` };
      // Strip dangling references from other milestones' dependency lists.
      const cleaned = milestones
        .filter((m) => m.id !== id)
        .map((m) =>
          m.dependencies?.includes(id)
            ? { ...m, dependencies: m.dependencies.filter((d) => d !== id), updatedAt: new Date().toISOString() }
            : m
        );
      setMilestones(cleaned);
      return { ok: true, id };
    },
    [milestones]
  );

  /* ----------------------------- deliverables ----------------------------- */

  const addDeliverable = React.useCallback(
    (data: unknown): MutationResult => {
      const parsed = deliverableInputSchema.safeParse(data);
      if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };
      const input = parsed.data;
      if (!projects.some((p) => p.id === input.projectId)) {
        return { ok: false, error: `Unknown project ${input.projectId}` };
      }
      const draft: TimelineDeliverable = {
        id: nextTimelineId("DLV", deliverables.map((d) => d.id)),
        projectId: input.projectId,
        name: input.name,
        dueDate: input.dueDate,
        status: input.status,
        description: input.description,
        phaseId: input.phaseId,
        dependencies: input.dependencies,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const merged = [...deliverables, draft];
      if (unknownDependencies(merged).length > 0) {
        return { ok: false, error: "Dependencies must reference existing deliverables." };
      }
      const cycle = detectDependencyCycle(merged);
      if (cycle) {
        return { ok: false, error: `Dependency cycle detected: ${cycle.join(" → ")}` };
      }
      setDeliverables(merged);
      return { ok: true, id: draft.id };
    },
    [deliverables, projects]
  );

  const updateDeliverable = React.useCallback(
    (id: string, data: unknown): MutationResult => {
      const target = deliverables.find((d) => d.id === id);
      if (!target) return { ok: false, error: `Deliverable ${id} not found` };
      const parsed = deliverablePatchSchema.safeParse(data);
      if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };
      const patch = parsed.data;
      if (patch.status && patch.status !== target.status) {
        if (!canTransitionDeliverable(target.status, patch.status)) {
          return {
            ok: false,
            error: `Invalid transition: ${target.status} → ${patch.status}. Deliverables follow an explicit workflow.`,
          };
        }
      }
      if (patch.dueDate !== undefined && patch.dueDate !== null && !isISODate(patch.dueDate)) {
        return { ok: false, error: "Due date must be a real date (YYYY-MM-DD)." };
      }
      const updated: TimelineDeliverable = { ...target, ...patch, updatedAt: new Date().toISOString() };
      const merged = deliverables.map((d) => (d.id === id ? updated : d));
      if (unknownDependencies(merged).length > 0) {
        return { ok: false, error: "Dependencies must reference existing deliverables." };
      }
      const cycle = detectDependencyCycle(merged);
      if (cycle) {
        return { ok: false, error: `Dependency cycle detected: ${cycle.join(" → ")}` };
      }
      setDeliverables(merged);
      return { ok: true, id };
    },
    [deliverables]
  );

  const setDeliverableStatus = React.useCallback(
    (id: string, status: TimelineDeliverable["status"]): MutationResult =>
      updateDeliverable(id, { status }),
    [updateDeliverable]
  );

  const deleteDeliverable = React.useCallback(
    (id: string): MutationResult => {
      const target = deliverables.find((d) => d.id === id);
      if (!target) return { ok: false, error: `Deliverable ${id} not found` };
      const cleaned = deliverables
        .filter((d) => d.id !== id)
        .map((d) =>
          d.dependencies?.includes(id)
            ? { ...d, dependencies: d.dependencies.filter((dep) => dep !== id), updatedAt: new Date().toISOString() }
            : d
        );
      setDeliverables(cleaned);
      return { ok: true, id };
    },
    [deliverables]
  );

  /* ---------------------------- custom events ----------------------------- */

  const addEvent = React.useCallback(
    (data: unknown): MutationResult => {
      const parsed = customEventInputSchema.safeParse(data);
      if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };
      const input = parsed.data;
      if (input.projectId && !projects.some((p) => p.id === input.projectId)) {
        return { ok: false, error: `Unknown project ${input.projectId}` };
      }
      const created: TimelineEvent = {
        id: nextTimelineId("EVT", customEvents.map((e) => e.id)),
        title: input.title,
        date: input.date,
        kind: "custom",
        status: "planned",
        projectId: input.projectId,
        description: input.description,
        createdAt: new Date().toISOString(),
      };
      setCustomEvents((prev) => [...prev, created]);
      return { ok: true, id: created.id };
    },
    [customEvents, projects]
  );

  const updateEvent = React.useCallback(
    (id: string, data: unknown): MutationResult => {
      if (isDerivedEventId(id)) {
        return { ok: false, error: "This event is derived from another record — edit its source instead." };
      }
      const target = customEvents.find((e) => e.id === id);
      if (!target) return { ok: false, error: `Event ${id} not found` };
      const parsed = customEventPatchSchema.safeParse(data);
      if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };
      const patch = parsed.data;
      if (patch.projectId && !projects.some((p) => p.id === patch.projectId)) {
        return { ok: false, error: `Unknown project ${patch.projectId}` };
      }
      const updated: TimelineEvent = {
        ...target,
        ...patch,
        status: patch.status ?? target.status,
      };
      setCustomEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return { ok: true, id };
    },
    [customEvents, projects]
  );

  const deleteEvent = React.useCallback(
    (id: string): MutationResult => {
      if (isDerivedEventId(id)) {
        return { ok: false, error: "This event is derived from another record — it cannot be deleted here." };
      }
      const target = customEvents.find((e) => e.id === id);
      if (!target) return { ok: false, error: `Event ${id} not found` };
      setCustomEvents((prev) => prev.filter((e) => e.id !== id));
      return { ok: true, id };
    },
    [customEvents]
  );

  /* ------------------------------ derived --------------------------------- */

  const events = React.useMemo(
    () =>
      buildTimelineEvents({
        milestones,
        deliverables,
        customEvents,
        paymentDues: obligations.map((o) => ({
          id: o.id,
          projectId: o.projectId,
          title: o.title,
          dueDate: o.dueDate,
          cancelled: Boolean(o.cancelledAt),
        })),
        today,
      }),
    [milestones, deliverables, customEvents, obligations, today]
  );

  const resetTimelineData = React.useCallback(() => {
    clearTimelineStorage();
    const fresh = cloneSeed();
    setMilestones(fresh.milestones);
    setDeliverables(fresh.deliverables);
    setCustomEvents(fresh.customEvents);
    setPersistenceError(null);
  }, []);

  const value = React.useMemo<TimelineContextValue>(
    () => ({
      milestones,
      deliverables,
      customEvents,
      events,
      today,
      persistenceError,
      hydrated,
      getMilestoneById,
      getDeliverableById,
      addMilestone,
      updateMilestone,
      deleteMilestone,
      addDeliverable,
      updateDeliverable,
      setDeliverableStatus,
      deleteDeliverable,
      addEvent,
      updateEvent,
      deleteEvent,
      resetTimelineData,
    }),
    [
      milestones,
      deliverables,
      customEvents,
      events,
      today,
      persistenceError,
      hydrated,
      getMilestoneById,
      getDeliverableById,
      addMilestone,
      updateMilestone,
      deleteMilestone,
      addDeliverable,
      updateDeliverable,
      setDeliverableStatus,
      deleteDeliverable,
      addEvent,
      updateEvent,
      deleteEvent,
      resetTimelineData,
    ]
  );

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

export function useTimeline(): TimelineContextValue {
  const ctx = React.useContext(TimelineContext);
  if (!ctx) {
    throw new Error("useTimeline must be used within a TimelineProvider");
  }
  return ctx;
}

export default TimelineProvider;