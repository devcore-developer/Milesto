/**
 * Milesto — Phase 10 — Notification read-state store (Phase 10 §6, §8).
 *
 * Idempotent by design: alert keys are stable (`kind:id:dueDate`), so
 * repeated visits never duplicate notification state. Keys that have no
 * entry yet count as unread, which lets new alerts raise the badge without
 * any write. Opening the panel marks alerts as SEEN; marking READ is an
 * explicit user action (row click / mark all).
 */

import {
  createStorageKey,
  loadState,
  removeState,
  saveState,
  type StorageLike,
} from "@/lib/persistence";

export const NOTIFICATION_STATE_VERSION = 1;

const STATE_KEY = createStorageKey("notification-state");

export interface NotificationEntry {
  seenAt: string;
  readAt: string | null;
}

export type NotificationState = Record<string, NotificationEntry>;

export function emptyNotificationState(): NotificationState {
  return {};
}

function isValidState(value: unknown): value is NotificationState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  for (const entry of Object.values(record)) {
    if (typeof entry !== "object" || entry === null) return false;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.seenAt !== "string") return false;
    if (candidate.readAt !== null && typeof candidate.readAt !== "string") return false;
  }
  return true;
}

/** Marks keys as seen. First-seen timestamp wins, so re-opening is a no-op. */
export function applySeen(
  state: NotificationState,
  keys: readonly string[],
  atISO: string,
): NotificationState {
  const next: NotificationState = { ...state };
  for (const key of keys) {
    const existing = next[key];
    next[key] = existing ?? { seenAt: atISO, readAt: null };
  }
  return next;
}

/** Marks keys as read (explicit acknowledgement). Preserves first-seen. */
export function applyRead(
  state: NotificationState,
  keys: readonly string[],
  atISO: string,
): NotificationState {
  const next: NotificationState = { ...state };
  for (const key of keys) {
    const existing = next[key];
    next[key] = { seenAt: existing?.seenAt ?? atISO, readAt: atISO };
  }
  return next;
}

/** Unknown keys (never seen) count as unread so new alerts raise the badge. */
export function isUnread(state: NotificationState, key: string): boolean {
  const entry = state[key];
  return entry ? entry.readAt === null : true;
}

export function unreadCount(state: NotificationState, keys: readonly string[]): number {
  let count = 0;
  for (const key of keys) {
    if (isUnread(state, key)) count += 1;
  }
  return count;
}

export function loadNotificationState(storage?: StorageLike): NotificationState {
  return (
    loadState<NotificationState>(STATE_KEY, {
      version: NOTIFICATION_STATE_VERSION,
      storage,
      validate: isValidState,
    }) ?? {}
  );
}

export function saveNotificationState(state: NotificationState, storage?: StorageLike): boolean {
  return saveState(STATE_KEY, NOTIFICATION_STATE_VERSION, state, storage);
}

export function clearNotificationState(storage?: StorageLike): void {
  removeState(STATE_KEY, storage);
}