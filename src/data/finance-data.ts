/**
 * Milesto — finance seed dataset (Phase 7).
 *
 * Demo data only: real obligations, transactions and expenses so every
 * KPI/chart is built from genuine stored records. Project ids here
 * (PRJ-001 … PRJ-004) should match the existing project seed — adjust
 * them in this single file if your project ids differ.
 */

import type {
  Currency,
  FinanceExpense,
  FinanceObligation,
  FinanceTransaction,
  ProjectFinanceProfile,
} from "@/types/finance";

export interface FinanceSeed {
  obligations: FinanceObligation[];
  transactions: FinanceTransaction[];
  expenses: FinanceExpense[];
  profiles: ProjectFinanceProfile[];
}

function obligation(
  id: string,
  projectId: string,
  title: string,
  amountMinor: number,
  currency: Currency,
  dueDate: string,
  extra: Partial<FinanceObligation> = {},
): FinanceObligation {
  return {
    id,
    projectId,
    title,
    amountMinor,
    currency,
    dueDate,
    cancelledAt: null,
    createdAt: "2025-11-01T09:00:00.000Z",
    updatedAt: "2025-11-01T09:00:00.000Z",
    ...extra,
  };
}

function transaction(
  id: string,
  obligationId: string,
  projectId: string,
  type: FinanceTransaction["type"],
  amountMinor: number,
  currency: Currency,
  date: string,
  method: FinanceTransaction["method"],
  extra: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id,
    obligationId,
    projectId,
    type,
    amountMinor,
    currency,
    date,
    method,
    voidedAt: null,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
    ...extra,
  };
}

function expense(
  id: string,
  description: string,
  amountMinor: number,
  currency: Currency,
  date: string,
  category: FinanceExpense["category"],
  extra: Partial<FinanceExpense> = {},
): FinanceExpense {
  return {
    id,
    description,
    amountMinor,
    currency,
    date,
    category,
    projectId: null,
    paymentStatus: "paid",
    paidOn: date,
    voidedAt: null,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
    ...extra,
  };
}

function profile(
  projectId: string,
  contractValueMinor: number,
  currency: Currency,
  contractDate: string,
  extra: Partial<ProjectFinanceProfile> = {},
): ProjectFinanceProfile {
  return {
    projectId,
    contractValueMinor,
    currency,
    contractDate,
    expectedDeliveryDate: null,
    createdAt: `${contractDate}T12:00:00.000Z`,
    updatedAt: `${contractDate}T12:00:00.000Z`,
    ...extra,
  };
}

export const FINANCE_SEED: FinanceSeed = {
  obligations: [
    obligation("OB-1", "PRJ-001", "Advance payment — 40%", 7_200_000, "EGP", "2025-11-20", {
      description: "Contract signing advance per the payment schedule.",
      reference: "INV-2025-114",
      createdAt: "2025-11-10T09:00:00.000Z",
      updatedAt: "2025-11-10T09:00:00.000Z",
    }),
    obligation("OB-2", "PRJ-001", "Beta milestone — 40%", 7_200_000, "EGP", "2026-02-15", {
      reference: "INV-2026-032",
      notes: "Client asked for a 2-week extension before the beta review.",
    }),
    obligation("OB-3", "PRJ-001", "Final delivery — 20%", 3_600_000, "EGP", "2026-04-10", {
      reference: "INV-2026-047",
    }),
    obligation("OB-4", "PRJ-002", "Kickoff payment — 25%", 600_000, "USD", "2026-02-01", {
      reference: "INV-2026-005",
    }),
    obligation("OB-5", "PRJ-002", "Phase 2 payment — 35%", 840_000, "USD", "2026-06-15", {
      reference: "INV-2026-018",
    }),
    obligation("OB-6", "PRJ-002", "Handover payment — 40%", 960_000, "USD", "2026-11-30", {
      reference: "INV-2026-019",
    }),
    obligation("OB-7", "PRJ-003", "Design retainer — September", 1_500_000, "EGP", "2026-09-30"),
    obligation("OB-8", "PRJ-003", "Design retainer — October", 1_500_000, "EGP", "2026-10-25"),
    obligation("OB-9", "PRJ-003", "Design retainer — November", 1_500_000, "EGP", "2026-11-30"),
    obligation("OB-10", "PRJ-004", "Signing payment", 2_400_000, "EGP", "2026-04-20"),
    obligation("OB-11", "PRJ-004", "MVP acceptance payment", 2_400_000, "EGP", "2026-08-01", {
      notes: "6,000 EGP refunded after the scope dispute — see TXN-9.",
    }),
    obligation("OB-12", "PRJ-004", "Launch final payment", 1_200_000, "EGP", "2026-12-20"),
    obligation("OB-13", "PRJ-002", "Optional AR support package", 300_000, "USD", "2026-10-10", {
      cancelledAt: "2026-05-02T10:00:00.000Z",
      cancelNote: "Client dropped the AR scope during the May review.",
    }),
  ],
  transactions: [
    transaction("TXN-1", "OB-1", "PRJ-001", "payment", 7_200_000, "EGP", "2025-11-18", "bank_transfer", {
      reference: "TRX-88121",
    }),
    transaction("TXN-2", "OB-2", "PRJ-001", "payment", 4_000_000, "EGP", "2026-02-20", "bank_transfer", {
      reference: "TRX-88450",
    }),
    transaction("TXN-3", "OB-2", "PRJ-001", "payment", 2_000_000, "EGP", "2026-03-05", "bank_transfer", {
      reference: "TRX-88512",
    }),
    transaction("TXN-4", "OB-4", "PRJ-002", "payment", 600_000, "USD", "2026-01-28", "card", {
      reference: "STRIPE-2231",
    }),
    transaction("TXN-5", "OB-5", "PRJ-002", "payment", 500_000, "USD", "2026-06-12", "bank_transfer", {
      reference: "WIRE-7741",
    }),
    transaction("TXN-6", "OB-7", "PRJ-003", "payment", 1_500_000, "EGP", "2026-09-27", "cash", {
      reference: "RCPT-0187",
    }),
    transaction("TXN-7", "OB-10", "PRJ-004", "payment", 2_400_000, "EGP", "2026-04-18", "bank_transfer", {
      reference: "TRX-90110",
    }),
    transaction("TXN-8", "OB-11", "PRJ-004", "payment", 2_400_000, "EGP", "2026-08-05", "bank_transfer", {
      reference: "TRX-90342",
    }),
    transaction("TXN-9", "OB-11", "PRJ-004", "refund", 600_000, "EGP", "2026-09-01", "bank_transfer", {
      reference: "RF-1042",
      notes: "Partial refund after the scope dispute.",
    }),
    transaction("TXN-10", "OB-5", "PRJ-002", "payment", 1_000_000, "USD", "2026-06-14", "bank_transfer", {
      reference: "WIRE-7758",
      voidedAt: "2026-06-15T09:30:00.000Z",
      voidReason: "Duplicate entry — reversed the next day.",
    }),
  ],
  expenses: [
    expense("EXP-1", "Vercel Pro — annual plan", 120_000, "USD", "2026-01-05", "hosting", {
      vendor: "Vercel",
      receiptRef: "VRC-2026-01",
    }),
    expense("EXP-2", "Domain renewals (milesto.io + 2)", 85_000, "EGP", "2026-02-10", "domain", {
      vendor: "Namecheap",
      paidOn: "2026-02-12",
      receiptRef: "NC-88421",
    }),
    expense("EXP-3", "Figma team seats — Q1", 54_000, "USD", "2026-03-01", "software", {
      vendor: "Figma",
      paidOn: "2026-03-03",
    }),
    expense("EXP-4", "Backend contractor — PRJ-001", 3_000_000, "EGP", "2026-01-20", "contractor", {
      projectId: "PRJ-001",
      vendor: "A. Hassan",
      paidOn: "2026-02-01",
    }),
    expense("EXP-5", "QA contractor — PRJ-001", 1_200_000, "EGP", "2026-03-15", "contractor", {
      projectId: "PRJ-001",
      vendor: "M. Adel",
      paidOn: "2026-03-20",
    }),
    expense("EXP-6", "Motion designer — PRJ-002", 150_000, "USD", "2026-05-10", "contractor", {
      projectId: "PRJ-002",
      vendor: "Studio Nine",
      paymentStatus: "unpaid",
      paidOn: null,
    }),
    expense("EXP-7", "Meta ads — PRJ-004 launch", 420_000, "EGP", "2026-08-25", "marketing", {
      projectId: "PRJ-004",
      vendor: "Meta",
      paidOn: "2026-08-28",
    }),
    expense("EXP-8", "Office internet — September", 115_000, "EGP", "2026-09-01", "infrastructure", {
      vendor: "Vodafone",
      paidOn: "2026-09-04",
    }),
    expense("EXP-9", "Stock assets bundle", 30_000, "USD", "2026-07-12", "software", {
      vendor: "Envato",
      paymentStatus: "unpaid",
      paidOn: null,
    }),
    expense("EXP-10", "Photography freelancer — PRJ-003", 650_000, "EGP", "2026-10-05", "contractor", {
      projectId: "PRJ-003",
      vendor: "N. Samir",
      paidOn: "2026-10-08",
    }),
    expense("EXP-11", "Legacy ERP licence", 240_000, "USD", "2026-04-02", "software", {
      vendor: "OldSoft",
      voidedAt: "2026-04-06T11:00:00.000Z",
      voidReason: "Vendor cancelled the deal — never invoiced.",
    }),
  ],
  profiles: [
    profile("PRJ-001", 18_000_000, "EGP", "2025-11-10", {
      expectedDeliveryDate: "2026-03-30",
      paymentTerms: "40% advance, 40% at beta, 20% on final delivery.",
      agreementNotes: "Fixed-price contract. Extra revisions billed separately.",
    }),
    profile("PRJ-002", 2_400_000, "USD", "2026-01-15", {
      expectedDeliveryDate: "2026-09-30",
      paymentTerms: "25% kickoff, 35% phase 2, 40% handover.",
    }),
    profile("PRJ-004", 6_000_000, "EGP", "2026-04-05", {
      expectedDeliveryDate: "2026-12-15",
      paymentTerms: "Signing 40%, MVP acceptance 40%, launch 20%.",
    }),
    // PRJ-003 intentionally has no profile — contracted value falls back
    // to the sum of its active obligations.
  ],
};