/**
 * Milesto — Phase 10 — Client persistence engine.
 *
 * Milesto keeps application state in React providers / module stores
 * (in-memory per session). This module adds an optional, versioned
 * localStorage layer so daily use survives page refreshes, plus
 * export/import backup utilities.
 *
 * Design rules (Phase 10 §7 — Data Integrity and Recovery):
 * - Never throws on read/write failures; degrades to in-memory storage.
 * - Stored payloads are versioned. Unknown versions are ignored unless a
 *   `migrate` function is supplied, so old shapes never corrupt new state.
 * - Seeds can never overwrite existing data: `loadState` returns null when
 *   nothing is stored, and callers fall back to their seed in that case.
 * - Storage is injectable for deterministic unit tests (node environment).
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * In-memory fallback used on the server, in tests, and in private browser
 * modes where `localStorage` access throws.
 */
export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

const MILESTO_PREFIX = "milesto:";
const sharedMemory = new MemoryStorage();
let cachedDefault: StorageLike | null = null;
let warnedFallback = false;

/** Builds the canonical namespaced storage key for a store scope. */
export function createStorageKey(scope: string): string {
  return `${MILESTO_PREFIX}${scope}`;
}

/**
 * Returns the best available storage: window.localStorage when reachable
 * (probed with a write, because Safari private mode throws on access),
 * otherwise a shared in-memory fallback.
 */
export function getDefaultStorage(): StorageLike {
  if (cachedDefault) return cachedDefault;
  if (typeof window !== "undefined") {
    try {
      const ls = window.localStorage;
      const probe = `${MILESTO_PREFIX}__probe`;
      ls.setItem(probe, "1");
      ls.removeItem(probe);
      cachedDefault = ls;
      return ls;
    } catch {
      if (!warnedFallback) {
        warnedFallback = true;
        console.warn(
          "[milesto] localStorage unavailable — using in-memory storage. Data will not survive reloads.",
        );
      }
    }
  }
  cachedDefault = sharedMemory;
  return sharedMemory;
}

/** True when writes will outlive the current page (localStorage reachable). */
export function isPersistentStorageAvailable(): boolean {
  return getDefaultStorage() !== sharedMemory;
}

export interface PersistEnvelope<T = unknown> {
  version: number;
  /** ISO timestamp of the last successful save. */
  savedAt: string;
  data: T;
}

export interface LoadOptions<T> {
  version: number;
  storage?: StorageLike;
  /** Return false to reject a payload (treated as absent, seed applies). */
  validate?: (data: unknown) => boolean;
  /**
   * Convert a payload stored with `fromVersion` to the current shape.
   * Returning null aborts the load (seed applies).
   */
  migrate?: (data: unknown, fromVersion: number) => T | null;
}

function isEnvelope(value: unknown): value is PersistEnvelope<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === "number" &&
    typeof record.savedAt === "string" &&
    "data" in record
  );
}

/**
 * Loads a previously saved payload. Returns null (never throws) when the key
 * is absent, corrupted, rejected by `validate`, or stored with an unsupported
 * version — in every one of those cases the caller should fall back to seed.
 */
export function loadState<T>(key: string, options: LoadOptions<T>): T | null {
  const storage = options.storage ?? getDefaultStorage();
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null || raw === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[milesto] Ignoring corrupted payload for "${key}".`);
    return null;
  }
  if (!isEnvelope(parsed)) {
    console.warn(`[milesto] Ignoring malformed envelope for "${key}".`);
    return null;
  }

  if (parsed.version !== options.version) {
    if (!options.migrate) {
      console.warn(
        `[milesto] Skipping "${key}": stored version ${parsed.version} != expected ${options.version}.`,
      );
      return null;
    }
    const migrated = options.migrate(parsed.data, parsed.version);
    if (migrated === null) {
      console.warn(`[milesto] Migration failed for "${key}".`);
      return null;
    }
    if (options.validate && !options.validate(migrated)) {
      console.warn(`[milesto] Migrated payload rejected for "${key}".`);
      return null;
    }
    return migrated;
  }

  if (options.validate && !options.validate(parsed.data)) {
    console.warn(`[milesto] Stored payload rejected by validation for "${key}".`);
    return null;
  }
  return parsed.data as T;
}

/** Saves a payload. Returns false instead of throwing on quota/write errors. */
export function saveState<T>(
  key: string,
  version: number,
  data: T,
  storage?: StorageLike,
): boolean {
  const target = storage ?? getDefaultStorage();
  const envelope: PersistEnvelope<T> = {
    version,
    savedAt: new Date().toISOString(),
    data,
  };
  try {
    target.setItem(key, JSON.stringify(envelope));
    return true;
  } catch (error) {
    console.warn(`[milesto] Failed to persist "${key}".`, error);
    return false;
  }
}

/** Removes a stored payload. Never throws. */
export function removeState(key: string, storage?: StorageLike): void {
  const target = storage ?? getDefaultStorage();
  try {
    target.removeItem(key);
  } catch (error) {
    console.warn(`[milesto] Failed to remove "${key}".`, error);
  }
}

/* -------------------------------------------------------------------------
 * Backup / restore (Phase 10 §7 — backup and recovery guidance)
 * ---------------------------------------------------------------------- */

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupEntry {
  key: string;
  envelope: PersistEnvelope<unknown>;
}

export interface BackupFile {
  app: "milesto";
  kind: "milesto-backup";
  schemaVersion: number;
  exportedAt: string;
  entries: BackupEntry[];
}

/** Collects every currently stored Milesto envelope for the given keys. */
export function exportBackup(keys: readonly string[], storage?: StorageLike): BackupFile {
  const target = storage ?? getDefaultStorage();
  const entries: BackupEntry[] = [];
  for (const key of keys) {
    let raw: string | null = null;
    try {
      raw = target.getItem(key);
    } catch {
      raw = null;
    }
    if (raw === null) continue;
    try {
      const envelope: unknown = JSON.parse(raw);
      if (isEnvelope(envelope)) entries.push({ key, envelope });
    } catch {
      // Skip corrupted entries silently — they cannot be recovered anyway.
    }
  }
  return {
    app: "milesto",
    kind: "milesto-backup",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Parses backup text. Throws a descriptive Error on invalid input. */
export function parseBackup(json: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid backup file: not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid backup file: unexpected payload.");
  }
  const record = parsed as Record<string, unknown>;
  if (record.app !== "milesto" || record.kind !== "milesto-backup") {
    throw new Error("Invalid backup file: this does not look like a Milesto backup.");
  }
  if (record.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schema version: ${String(record.schemaVersion)}.`);
  }
  if (!Array.isArray(record.entries)) {
    throw new Error("Invalid backup file: entries are missing.");
  }
  const entries: BackupEntry[] = [];
  for (const candidate of record.entries) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const entry = candidate as Record<string, unknown>;
    if (typeof entry.key !== "string" || !isEnvelope(entry.envelope)) continue;
    entries.push({ key: entry.key, envelope: entry.envelope });
  }
  return {
    app: "milesto",
    kind: "milesto-backup",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt:
      typeof record.exportedAt === "string" ? record.exportedAt : new Date().toISOString(),
    entries,
  };
}

export interface RestoreResult {
  restored: string[];
  skipped: Array<{ key: string; reason: string }>;
}

/**
 * Writes every backup entry back into storage (recovery semantics: the
 * backup wins over current in-memory state after the next hydration).
 */
export function restoreBackup(backup: BackupFile, storage?: StorageLike): RestoreResult {
  const target = storage ?? getDefaultStorage();
  const restored: string[] = [];
  const skipped: RestoreResult["skipped"] = [];
  for (const entry of backup.entries) {
    try {
      target.setItem(entry.key, JSON.stringify(entry.envelope));
      restored.push(entry.key);
    } catch (error) {
      skipped.push({
        key: entry.key,
        reason: error instanceof Error ? error.message : "write failed",
      });
    }
  }
  return { restored, skipped };
}

/** e.g. milesto-backup-2026-05-10-0905.json (local time). */
export function backupFilename(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `milesto-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/** Downloads a backup file in the browser. No-op (with a warning) on the server. */
export function downloadBackup(backup: BackupFile): void {
  if (typeof document === "undefined") {
    console.warn("[milesto] downloadBackup is browser-only.");
    return;
  }
  const blob = new Blob([serializeBackup(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = backupFilename();
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}