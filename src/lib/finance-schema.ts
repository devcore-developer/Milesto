import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Validation schemas for the Finance module (Phase 7).
 * Same strategy as testing-schema.ts: every context mutation passes through
 * a schema before touching state, so invalid or partial data never reaches
 * storage. Amounts are validated as positive finite numbers; negative
 * amounts are never accepted (refunds/adjustments are modelled via `kind`).
 * ------------------------------------------------------------------------- */

const isoDate = z
  .string()
  .min(10, "A valid date is required")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be in YYYY-MM-DD format");

const positiveAmount = z.coerce
  .number({ invalid_type_error: "Amount must be a number" })
  .positive("Amount must be greater than zero")
  .max(1_000_000_000, "Amount is unrealistically large");

const currencyCode = z.enum(["USD", "EGP", "EUR", "GBP", "SAR", "AED"], {
  errorMap: () => ({ message: "Currency is required" }),
});

export const financeProfileSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  currency: currencyCode,
  paymentMode: z.enum(["fixed-price", "milestones"], {
    errorMap: () => ({ message: "Payment mode is required" }),
  }),
  contractDate: isoDate.optional(),
  expectedDeliveryDate: isoDate.optional(),
  paymentTerms: z.enum(
    ["Due on Receipt", "Net 15", "Net 30", "Net 60", "Milestone-based", "Custom"],
    { errorMap: () => ({ message: "Payment terms are required" }) }
  ),
  notes: z.string().max(2000, "Notes are too long").optional(),
});

export type FinanceProfileInput = z.infer<typeof financeProfileSchema>;

export const obligationSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  milestone: z.string().min(2, "Milestone label must be at least 2 characters"),
  description: z.string().max(2000).optional(),
  amount: positiveAmount,
  currency: currencyCode,
  dueDate: isoDate,
  reference: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export type ObligationInput = z.infer<typeof obligationSchema>;

export const transactionSchema = z.object({
  obligationId: z.string().min(1, "A payment obligation is required"),
  kind: z.enum(["Payment", "Refund", "Adjustment"], {
    errorMap: () => ({ message: "Transaction kind is required" }),
  }),
  amount: positiveAmount,
  date: isoDate,
  method: z.enum(["Bank Transfer", "Cash", "Credit Card", "Cheque", "Online", "Other"], {
    errorMap: () => ({ message: "Payment method is required" }),
  }),
  reference: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

export const expenseSchema = z.object({
  projectId: z.string().optional(),
  description: z.string().min(3, "Description must be at least 3 characters"),
  amount: positiveAmount,
  currency: currencyCode,
  date: isoDate,
  category: z.enum(
    ["Hosting", "Domain", "Software", "Contractor", "Marketing", "Infrastructure", "Other"],
    { errorMap: () => ({ message: "Category is required" }) }
  ),
  vendor: z.string().max(120).optional(),
  status: z.enum(["Paid", "Unpaid"], {
    errorMap: () => ({ message: "Payment status is required" }),
  }),
  receiptRef: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export const reversalSchema = z.object({
  reason: z.string().min(3, "A reversal reason is required for the audit trail"),
});

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid data";
}