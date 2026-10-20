"use client";

// Compatibility shim — the canonical implementation lives in @/lib/finance-context
// (which is where the app layout imports FinanceProvider from).
export {
  FinanceProvider,
  useFinance,
  useFinanceSafe,
  useFinanceBridge,
} from "@/lib/finance-context";
export type {
  FinanceContextValue,
  FinanceBridgeValue,
  ProjectRef,
} from "@/lib/finance-context";