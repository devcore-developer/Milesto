import { describe, expect, it } from "vitest";
import {
  applyRead,
  applySeen,
  clearNotificationState,
  emptyNotificationState,
  isUnread,
  loadNotificationState,
  saveNotificationState,
  unreadCount,
} from "@/lib/notification-store";
import { MemoryStorage, createStorageKey } from "@/lib/persistence";

const KEY_A = "task:t1:2026-05-10";
const KEY_B = "payment:o1:2026-05-11";

describe("reducers", () => {
  it("marks seen once (first-seen wins, so re-visits are idempotent)", () => {
    let state = emptyNotificationState();
    state = applySeen(state, [KEY_A], "2026-05-10T08:00:00.000Z");
    state = applySeen(state, [KEY_A], "2026-05-11T08:00:00.000Z");
    expect(state[KEY_A]?.seenAt).toBe("2026-05-10T08:00:00.000Z");
    expect(state[KEY_A]?.readAt).toBeNull();
  });

  it("marks read while preserving seenAt; unknown keys stay unread", () => {
    let state = applySeen(emptyNotificationState(), [KEY_A], "2026-05-10T08:00:00.000Z");
    expect(isUnread(state, KEY_A)).toBe(true);
    state = applyRead(state, [KEY_A], "2026-05-10T09:00:00.000Z");
    expect(state[KEY_A]?.readAt).toBe("2026-05-10T09:00:00.000Z");
    expect(isUnread(state, KEY_A)).toBe(false);
    expect(isUnread(state, KEY_B)).toBe(true);
  });

  it("counts unread across known and unknown keys", () => {
    const state = applyRead(emptyNotificationState(), [KEY_A], "2026-05-10T09:00:00.000Z");
    expect(unreadCount(state, [KEY_A, KEY_B])).toBe(1);
  });

  it("never mutates the input state", () => {
    const original = emptyNotificationState();
    applySeen(original, [KEY_A], "2026-05-10T08:00:00.000Z");
    expect(original).toEqual({});
  });
});

describe("storage round-trip", () => {
  it("persists and reloads state; corrupted payloads fall back to empty", () => {
    const storage = new MemoryStorage();
    const state = applyRead(
      applySeen(emptyNotificationState(), [KEY_A], "2026-05-10T08:00:00.000Z"),
      [KEY_A],
      "2026-05-10T09:00:00.000Z",
    );
    expect(saveNotificationState(state, storage)).toBe(true);
    expect(loadNotificationState(storage)).toEqual(state);

    storage.setItem(createStorageKey("notification-state"), "{broken");
    expect(loadNotificationState(storage)).toEqual({});
  });

  it("clears state", () => {
    const storage = new MemoryStorage();
    saveNotificationState(
      applySeen(emptyNotificationState(), [KEY_A], "2026-05-10T08:00:00.000Z"),
      storage,
    );
    clearNotificationState(storage);
    expect(loadNotificationState(storage)).toEqual({});
  });
});