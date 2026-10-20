"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  FinanceExpense,
  FinanceObligation,
  FinanceTransaction,
  ProjectFinanceProfile,
} from "@/types/finance";
import {
  assertValid,
  compactPatch,
  validateExpenseInput,
  validateObligationInput,
  validateProfileInput,
  validateTransactionInput,
  type ExpenseInput,
  type ObligationInput,
  type ProfileInput,
  type TransactionInput,
} from "@/lib/finance-calculations";
import {
  buildProjectOptions,
  deriveProjectIds,
  resolveProjectName,
  type ProjectRef,
} from "@/components/finance/project-lookup";

export type { ProjectRef };

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowStamp(): string {
  return new Date().toISOString();
}

export interface FinanceContextValue {
  obligations: FinanceObligation[];
  transactions: FinanceTransaction[];
  expenses: FinanceExpense[];
  profiles: ProjectFinanceProfile[];
  createObligation(input: ObligationInput): FinanceObligation;
  updateObligation(
    id: string,
    patch: Partial<
      Pick<
        FinanceObligation,
        "projectId" | "title" | "description" | "amountMinor" | "currency" | "dueDate" | "reference" | "notes"
      >
    >,
  ): FinanceObligation;
  cancelObligation(id: string, reason: string): void;
  createTransaction(input: TransactionInput): FinanceTransaction;
  voidTransaction(id: string, reason: string): void;
  createExpense(input: ExpenseInput): FinanceExpense;
  updateExpense(
    id: string,
    patch: Partial<
      Pick<
        FinanceExpense,
        "projectId" | "description" | "amountMinor" | "currency" | "date" | "category" | "vendor" | "paymentStatus" | "paidOn" | "receiptRef" | "notes"
      >
    >,
  ): FinanceExpense;
  voidExpense(id: string, reason: string): void;
  saveProfile(input: ProfileInput): void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function missingProviderError(): never {
  throw new Error("FinanceProvider is not mounted — wrap the app with <FinanceProvider>.");
}

const FALLBACK_FINANCE: FinanceContextValue = {
  obligations: [],
  transactions: [],
  expenses: [],
  profiles: [],
  createObligation: missingProviderError,
  updateObligation: missingProviderError,
  cancelObligation: missingProviderError,
  createTransaction: missingProviderError,
  voidTransaction: missingProviderError,
  createExpense: missingProviderError,
  updateExpense: missingProviderError,
  voidExpense: missingProviderError,
  saveProfile: missingProviderError,
};

/**
 * Seed starts intentionally EMPTY: every KPI must come from real stored
 * records — no fabricated history. Empty states are rendered honestly.
 */
export function FinanceProvider({ children }: { children: ReactNode }) {
  const [obligations, setObligations] = useState<FinanceObligation[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [profiles, setProfiles] = useState<ProjectFinanceProfile[]>([]);

  const createObligation = useCallback((input: ObligationInput): FinanceObligation => {
    assertValid(validateObligationInput(input));
    const record: FinanceObligation = {
      id: createId(),
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description ?? "",
      amountMinor: input.amountMinor,
      currency: input.currency,
      dueDate: input.dueDate,
      reference: input.reference ?? "",
      notes: input.notes ?? "",
      createdAt: nowStamp(),
      updatedAt: nowStamp(),
    };
    setObligations((prev) => [record, ...prev]);
    return record;
  }, []);

  const updateObligation = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<
          FinanceObligation,
          "projectId" | "title" | "description" | "amountMinor" | "currency" | "dueDate" | "reference" | "notes"
        >
      >,
    ): FinanceObligation => {
      let updated: FinanceObligation | null = null;
      setObligations((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const next: FinanceObligation = { ...o, ...compactPatch(patch), updatedAt: nowStamp() };
          assertValid(
            validateObligationInput({
              projectId: next.projectId,
              title: next.title,
              description: next.description ?? "",
              amountMinor: next.amountMinor,
              currency: next.currency,
              dueDate: next.dueDate,
              reference: next.reference ?? "",
              notes: next.notes ?? "",
            }),
          );
          updated = next;
          return next;
        }),
      );
      if (!updated) throw new Error("Obligation not found.");
      return updated;
    },
    [],
  );

  const cancelObligation = useCallback((id: string, reason: string): void => {
    const trimmed = reason.trim();
    if (!trimmed) throw new Error("A reason is required to cancel an obligation.");
    setObligations((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        if (o.cancelledAt) throw new Error("Obligation is already cancelled.");
        return { ...o, cancelledAt: nowStamp(), cancelNote: trimmed, updatedAt: nowStamp() };
      }),
    );
  }, []);

  const createTransaction = useCallback(
    (input: TransactionInput): FinanceTransaction => {
      const obligation = obligations.find((o) => o.id === input.obligationId);
      if (!obligation) throw new Error("Obligation not found.");
      if (obligation.cancelledAt) {
        throw new Error("Cannot record a transaction against a cancelled obligation.");
      }
      assertValid(validateTransactionInput(obligation, input));
      const record: FinanceTransaction = {
        id: createId(),
        obligationId: obligation.id,
        projectId: obligation.projectId,
        type: input.type,
        amountMinor: input.amountMinor,
        currency: obligation.currency,
        date: input.date,
        method: input.method,
        reference: input.reference ?? "",
        notes: input.notes ?? "",
        createdAt: nowStamp(),
        updatedAt: nowStamp(),
      };
      setTransactions((prev) => [record, ...prev]);
      return record;
    },
    [obligations],
  );

  const voidTransaction = useCallback((id: string, reason: string): void => {
    const trimmed = reason.trim();
    if (!trimmed) throw new Error("A reason is required to void a transaction.");
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.voidedAt) throw new Error("Transaction is already voided.");
        return { ...t, voidedAt: nowStamp(), voidReason: trimmed, updatedAt: nowStamp() };
      }),
    );
  }, []);

  const createExpense = useCallback((input: ExpenseInput): FinanceExpense => {
    assertValid(validateExpenseInput(input));
    const paid = input.paymentStatus === "paid";
    const record: FinanceExpense = {
      id: createId(),
      description: input.description.trim(),
      amountMinor: input.amountMinor,
      currency: input.currency,
      date: input.date,
      category: input.category,
      projectId: input.projectId,
      vendor: input.vendor ?? "",
      paymentStatus: input.paymentStatus,
      ...(paid && input.paidOn ? { paidOn: input.paidOn } : {}),
      receiptRef: input.receiptRef ?? "",
      notes: input.notes ?? "",
      createdAt: nowStamp(),
      updatedAt: nowStamp(),
    };
    setExpenses((prev) => [record, ...prev]);
    return record;
  }, []);

  const updateExpense = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<
          FinanceExpense,
          "projectId" | "description" | "amountMinor" | "currency" | "date" | "category" | "vendor" | "paymentStatus" | "paidOn" | "receiptRef" | "notes"
        >
      >,
    ): FinanceExpense => {
      let updated: FinanceExpense | null = null;
      setExpenses((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          const merged: FinanceExpense = { ...e, ...compactPatch(patch), updatedAt: nowStamp() };
          if (merged.paymentStatus === "unpaid") delete merged.paidOn;
          assertValid(
            validateExpenseInput({
              description: merged.description,
              amountMinor: merged.amountMinor,
              currency: merged.currency,
              date: merged.date,
              category: merged.category,
              projectId: merged.projectId ?? null,
              vendor: merged.vendor ?? "",
              paymentStatus: merged.paymentStatus,
              paidOn: merged.paidOn ?? undefined,
              receiptRef: merged.receiptRef ?? "",
              notes: merged.notes ?? "",
            }),
          );
          updated = merged;
          return merged;
        }),
      );
      if (!updated) throw new Error("Expense not found.");
      return updated;
    },
    [],
  );

  const voidExpense = useCallback((id: string, reason: string): void => {
    const trimmed = reason.trim();
    if (!trimmed) throw new Error("A reason is required to void an expense.");
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        if (e.voidedAt) throw new Error("Expense is already voided.");
        return { ...e, voidedAt: nowStamp(), voidReason: trimmed, updatedAt: nowStamp() };
      }),
    );
  }, []);

  const saveProfile = useCallback((input: ProfileInput): void => {
    assertValid(validateProfileInput(input));
    setProfiles((prev) => {
      const existing = prev.find((p) => p.projectId === input.projectId);
      if (existing) {
        return prev.map((p) =>
          p.projectId === input.projectId
            ? {
                ...p,
                contractValueMinor: input.contractValueMinor,
                currency: input.currency,
                contractDate: input.contractDate,
                expectedDeliveryDate: input.expectedDeliveryDate,
                paymentTerms: input.paymentTerms ?? "",
                agreementNotes: input.agreementNotes ?? "",
                updatedAt: nowStamp(),
              }
            : p,
        );
      }
      const record: ProjectFinanceProfile = {
        projectId: input.projectId,
        contractValueMinor: input.contractValueMinor,
        currency: input.currency,
        contractDate: input.contractDate,
        expectedDeliveryDate: input.expectedDeliveryDate,
        paymentTerms: input.paymentTerms ?? "",
        agreementNotes: input.agreementNotes ?? "",
        createdAt: nowStamp(),
        updatedAt: nowStamp(),
      };
      return [...prev, record];
    });
  }, []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      obligations,
      transactions,
      expenses,
      profiles,
      createObligation,
      updateObligation,
      cancelObligation,
      createTransaction,
      voidTransaction,
      createExpense,
      updateExpense,
      voidExpense,
      saveProfile,
    }),
    [
      obligations,
      transactions,
      expenses,
      profiles,
      createObligation,
      updateObligation,
      cancelObligation,
      createTransaction,
      voidTransaction,
      createExpense,
      updateExpense,
      voidExpense,
      saveProfile,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error("useFinance must be used inside <FinanceProvider>.");
  }
  return ctx;
}

export function useFinanceSafe(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  return ctx ?? FALLBACK_FINANCE;
}

export interface FinanceBridgeValue {
  finance: FinanceContextValue;
  projectName: string | null;
  projectOptions: ProjectRef[];
  resolveProjectName(projectId: string): string;
}

export function useFinanceBridge(
  projectId?: string | null,
  projects?: readonly ProjectRef[],
): FinanceBridgeValue {
  const finance = useFinanceSafe();

  const directory = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects ?? []) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const knownProjectIds = useMemo(
    () =>
      deriveProjectIds({
        obligations: finance.obligations,
        transactions: finance.transactions,
        expenses: finance.expenses,
        profiles: finance.profiles,
      }),
    [finance.obligations, finance.transactions, finance.expenses, finance.profiles],
  );

  const projectOptions = useMemo(
    () => buildProjectOptions(projects ?? [], knownProjectIds),
    [projects, knownProjectIds],
  );

  const projectName = projectId ? resolveProjectName(projects ?? [], projectId) ?? projectId : null;

  const resolve = useCallback(
    (id: string) => directory.get(id) ?? id,
    [directory],
  );

  return { finance, projectName, projectOptions, resolveProjectName: resolve };
}