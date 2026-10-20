/**
 * Milesto — Phase 10 — Finance <-> deadline alert bridge (Phase 10 §6).
 *
 * Builds alert source items from REAL stored finance records only:
 * - Cancelled obligations are ignored.
 * - An obligation counts as completed only when collected amounts
 *   (non-voided payments minus refunds) cover its full amount — this keeps
 *   the Phase 7 "planned vs collected" separation intact.
 * - No payment records are created or modified here (Phase 8 §7 invariant).
 *
 * The item types are STRUCTURAL on purpose: they match the stored finance
 * models in `src/types/finance.ts` regardless of their interface names, so
 * this module stays decoupled from type-naming changes.
 */

import type { AlertSourceItem } from "@/lib/alerts";

export interface SettleableObligation {
  id: string;
  projectId: string;
  title: string;
  amountMinor: number;
  dueDate: string;
  cancelledAt?: string | null;
}

export interface SettleableTransaction {
  obligationId: string;
  type: "payment" | "refund";
  amountMinor: number;
  voidedAt?: string | null;
}

/** Collected = non-voided payments minus refunds for one obligation. */
export function collectedMinorForObligation(
  obligation: Pick<SettleableObligation, "id">,
  transactions: readonly SettleableTransaction[],
): number {
  let collected = 0;
  for (const tx of transactions) {
    if (tx.obligationId !== obligation.id) continue;
    if (tx.voidedAt != null) continue;
    collected += tx.type === "payment" ? tx.amountMinor : -tx.amountMinor;
  }
  return collected;
}

export function isObligationSettled(
  obligation: Pick<SettleableObligation, "id" | "amountMinor">,
  transactions: readonly SettleableTransaction[],
): boolean {
  return collectedMinorForObligation(obligation, transactions) >= obligation.amountMinor;
}

export interface BuildFinanceAlertItemsOptions {
  /** Optional projectId -> projectName lookup for friendlier alerts. */
  projectNames?: Record<string, string>;
  /** Optional deep-link builder (e.g. `/finance?obligation=${o.id}`). */
  urlBuilder?: (obligation: SettleableObligation) => string;
}

export function buildFinanceAlertItems(
  obligations: readonly SettleableObligation[],
  transactions: readonly SettleableTransaction[],
  options: BuildFinanceAlertItemsOptions = {},
): AlertSourceItem[] {
  const items: AlertSourceItem[] = [];
  for (const obligation of obligations) {
    if (obligation.cancelledAt != null) continue;
    const settled = isObligationSettled(obligation, transactions);
    const projectName =
      obligation.projectId != null
        ? (options.projectNames?.[obligation.projectId] ?? null)
        : null;
    items.push({
      id: obligation.id,
      title: obligation.title,
      kind: "payment",
      dueDate: obligation.dueDate,
      projectId: obligation.projectId ?? null,
      projectName,
      completed: settled,
      priority: null,
      url: options.urlBuilder ? options.urlBuilder(obligation) : null,
    });
  }
  return items;
}