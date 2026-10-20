"use client";

/**
 * Milesto — Phase 10 — `usePersistentState`.
 *
 * Drop-in upgrade for `useState` inside any client provider that wants its
 * state to survive page refreshes (Phase 10 §7):
 *
 *   const [state, setState, meta] = usePersistentState(
 *     createStorageKey("projects"),
 *     () => buildSeed(),           // existing seed builder — used ONLY when
 *                                  // nothing (valid) is stored yet
 *     { version: 1 },
 *   );
 *
 * Safety rules:
 * - The stored value always wins over the seed (seeds can never overwrite
 *   user data — Phase 10 §7).
 * - Nothing is written before hydration completes, so the first render can
 *   never clobber stored data with the seed.
 * - Write failures (e.g. quota) surface as `meta.saveError` instead of
 *   throwing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadState,
  saveState,
  type StorageLike,
} from "@/lib/persistence";

export interface UsePersistentStateOptions<T> {
  /** Bump to invalidate old payloads; pair with `migrate` to convert them. */
  version: number;
  storage?: StorageLike;
  validate?: (data: unknown) => boolean;
  migrate?: (data: unknown, fromVersion: number) => T | null;
}

export interface PersistentStateMeta {
  /** False until the stored value (if any) has been applied after mount. */
  hydrated: boolean;
  /** Non-null when the last write failed (e.g. storage quota exceeded). */
  saveError: string | null;
}

export type UsePersistentStateResult<T> = readonly [
  T,
  (next: T | ((prev: T) => T)) => void,
  PersistentStateMeta,
];

export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
  options: UsePersistentStateOptions<T>,
): UsePersistentStateResult<T> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [value, setValue] = useState<T>(() =>
    typeof initial === "function" ? (initial as () => T)() : initial,
  );
  const valueRef = useRef<T>(value);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Hydrate once per key: stored data (when valid) replaces the seed.
  useEffect(() => {
    const current = optionsRef.current;
    const stored = loadState<T>(key, {
      version: current.version,
      storage: current.storage,
      validate: current.validate,
      migrate: current.migrate,
    });
    if (stored !== null) {
      valueRef.current = stored;
      setValue(stored);
    }
    hydratedRef.current = true;
    setHydrated(true);
  }, [key]);

  const setPersistent = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(valueRef.current) : next;
      valueRef.current = resolved;
      setValue(resolved);
      if (!hydratedRef.current) return; // Never write the seed over stored data.
      const current = optionsRef.current;
      const ok = saveState(key, current.version, resolved, current.storage);
      setSaveError(ok ? null : "persist-failed");
    },
    [key],
  );

  return [value, setPersistent, { hydrated, saveError }] as const;
}