/**
 * Milesto — Phase 10 — Data integrity audit toolkit (Phase 10 §1, §7).
 *
 * Generic, dependency-free checks that can be composed per module:
 * duplicate ids, broken references, invalid dates and inverted date
 * ranges. All checks are pure and return structured issues so the app
 * (or a future diagnostics page) can surface them instead of silently
 * keeping inconsistent data.
 */

import { isISODateString } from "@/lib/alerts";

export type IntegritySeverity = "error" | "warning" | "info";

export interface IntegrityIssue {
  code: string;
  severity: IntegritySeverity;
  entity: string;
  entityId: string | null;
  message: string;
}

export type IntegrityCheck = () => IntegrityIssue[];

export function findDuplicateIds(
  entities: ReadonlyArray<{ id: string }>,
  entity: string,
): IntegrityIssue[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const candidate of entities) {
    if (seen.has(candidate.id)) duplicates.add(candidate.id);
    else seen.add(candidate.id);
  }
  return [...duplicates].sort().map((id) => ({
    code: "DUPLICATE_ID",
    severity: "error",
    entity,
    entityId: id,
    message: `Duplicate ${entity} id "${id}".`,
  }));
}

export interface ReferenceCheckOptions {
  entity: string;
  refName: string;
  /** Empty/missing values are allowed (optional relation) by default. */
  allowEmpty?: boolean;
  severity?: IntegritySeverity;
}

export function findBrokenReferences<T extends { id?: string | null }>(
  items: readonly T[],
  refField: string,
  validIds: readonly string[] | ReadonlySet<string>,
  options: ReferenceCheckOptions,
): IntegrityIssue[] {
  const valid = validIds instanceof Set ? validIds : new Set(validIds);
  const allowEmpty = options.allowEmpty ?? true;
  const severity = options.severity ?? "error";
  const issues: IntegrityIssue[] = [];

  for (const item of items) {
    const record = item as unknown as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : null;
    const raw = record[refField];
    if (raw == null || raw === "") {
      if (!allowEmpty) {
        issues.push({
          code: "MISSING_REFERENCE",
          severity,
          entity: options.entity,
          entityId: id,
          message: `${options.entity} "${id ?? "(unknown)"}" is missing required ${options.refName}.`,
        });
      }
      continue;
    }
    const ref = typeof raw === "string" ? raw : String(raw);
    if (!valid.has(ref)) {
      issues.push({
        code: "BROKEN_REFERENCE",
        severity,
        entity: options.entity,
        entityId: id,
        message: `${options.entity} "${id ?? "(unknown)"}" references missing ${options.refName} "${ref}".`,
      });
    }
  }
  return issues;
}

/** Validates that non-empty values of the given fields are real ISO dates. */
export function findDateIssues<T extends { id?: string | null }>(
  items: readonly T[],
  entity: string,
  dateFields: readonly string[],
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const item of items) {
    const record = item as unknown as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : null;
    for (const field of dateFields) {
      const raw = record[field];
      if (raw == null || raw === "") continue; // Optional dates are allowed.
      if (typeof raw !== "string" || !isISODateString(raw)) {
        issues.push({
          code: "INVALID_DATE",
          severity: "error",
          entity,
          entityId: id,
          message: `${entity} "${id ?? "(unknown)"}" has invalid ${field}: ${String(raw)}.`,
        });
      }
    }
  }
  return issues;
}

/** Flags records where a start date is strictly after its end date. */
export function findDateInversions<T extends { id?: string | null }>(
  items: readonly T[],
  entity: string,
  pairs: ReadonlyArray<{ startField: string; endField: string; label?: string }>,
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const item of items) {
    const record = item as unknown as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : null;
    for (const pair of pairs) {
      const start = record[pair.startField];
      const end = record[pair.endField];
      if (typeof start !== "string" || typeof end !== "string") continue;
      if (!isISODateString(start) || !isISODateString(end)) continue; // Reported by findDateIssues.
      if (start > end) {
        issues.push({
          code: "INVERTED_DATE_RANGE",
          severity: "warning",
          entity,
          entityId: id,
          message: `${entity} "${id ?? "(unknown)"}": ${pair.label ?? `${pair.startField} must be on or before ${pair.endField}`} (${start} > ${end}).`,
        });
      }
    }
  }
  return issues;
}

/** Composes checks; a throwing check becomes an issue instead of crashing the audit. */
export function runIntegrityChecks(checks: readonly IntegrityCheck[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const check of checks) {
    try {
      issues.push(...check());
    } catch (error) {
      issues.push({
        code: "CHECK_FAILED",
        severity: "error",
        entity: "audit",
        entityId: null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return issues;
}

export interface IntegritySummary {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  byCode: Record<string, number>;
}

export function summarizeIntegrity(issues: readonly IntegrityIssue[]): IntegritySummary {
  const summary: IntegritySummary = { total: 0, errors: 0, warnings: 0, infos: 0, byCode: {} };
  for (const issue of issues) {
    summary.total += 1;
    if (issue.severity === "error") summary.errors += 1;
    else if (issue.severity === "warning") summary.warnings += 1;
    else summary.infos += 1;
    summary.byCode[issue.code] = (summary.byCode[issue.code] ?? 0) + 1;
  }
  return summary;
}