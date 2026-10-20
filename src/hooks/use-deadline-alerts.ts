"use client";

/**
 * Milesto — Phase 10 — memoized bridge between stored records and the
 * deadline alert engine. Pass the same array instance across renders
 * (e.g. from useMemo) to avoid recomputation.
 */

import { useMemo } from "react";
import {
  computeDeadlineAlerts,
  type AlertSourceItem,
  type ComputeAlertsOptions,
  type DeadlineAlert,
} from "@/lib/alerts";

export function useDeadlineAlerts(
  items: readonly AlertSourceItem[],
  options?: ComputeAlertsOptions,
): DeadlineAlert[] {
  return useMemo(
    () => computeDeadlineAlerts(items, options ?? {}).alerts,
    [items, options],
  );
}