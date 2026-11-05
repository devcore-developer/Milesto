import { z } from "zod";
import {
  CLIENT_STATUSES,
  DISCOUNT_TYPES,
  DOCUMENT_TYPES,
  PAYMENT_METHODS,
  PROJECT_STATUSES,
  STORED_INVOICE_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/types";

const dateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color");

// ───────────────────────── Auth ─────────────────────────

export const setupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.email("Invalid email").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.email("Invalid email").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});

// ───────────────────────── Tasks ─────────────────────────

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  notes: z.string().max(10_000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  startDate: dateString.nullable().optional(),
  dueDate: dateString.nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  projectId: z.string().min(1).nullable().optional(),
  subtasks: z
    .array(z.object({ title: z.string().trim().min(1).max(200) }))
    .max(50)
    .optional(),
});

export const taskUpdateSchema = taskCreateSchema.partial();

// ───────────────────────── Projects ─────────────────────────

/**
 * Money fields: 0 … 999,999,999. NOTE: deliberately NO `.default(0)` —
 * in Zod v4 a default fires even for missing keys inside `.partial()`
 * schemas, which would silently reset financial fields to 0 on every
 * partial PATCH. Routes apply `?? 0` where a default is actually needed.
 */
const money = z.number().min(0, "Cannot be negative").max(999_999_999);

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().max(2_000).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  startDate: dateString.nullable().optional(),
  deadline: dateString.nullable().optional(),
  deliveryDate: dateString.nullable().optional(),
  color: hexColor.nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
  // ── Financials & client link (Phase 4) ──
  clientId: z.string().min(1).nullable().optional(),
  agreedPrice: money.nullable().optional(),
  additionalCharges: money.nullable().optional(),
  additionalNotes: z.string().max(2_000).nullable().optional(),
  discount: money.nullable().optional(),
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const subtaskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
});

export const subtaskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
});

// ───────────────────────── Categories ─────────────────────────

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  color: hexColor.optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

// ───────────────────── Reminder settings (Phase 3) ─────────────────────

export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  taskDaysBefore: z
    .number()
    .int("Whole days only")
    .min(0, "Minimum is 0 days")
    .max(30, "Maximum is 30 days"),
  projectDaysBefore: z
    .number()
    .int("Whole days only")
    .min(0, "Minimum is 0 days")
    .max(30, "Maximum is 30 days"),
  includeOverdue: z.boolean(),
});

// ───────────────────── Clients & finance (Phase 4) ─────────────────────

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional()
    .transform((v) => (v === "" ? null : v));

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  company: optionalText(160),
  email: z
    .union([z.literal(""), z.string().trim().email("Invalid email").max(200)])
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  phone: optionalText(40),
  address: optionalText(400),
  notes: optionalText(2_000),
  status: z.enum(CLIENT_STATUSES).optional(),
});

export const clientUpdateSchema = clientCreateSchema.partial();

/** ISO-style currency code: 2–6 latin letters, uppercased on parse. */
const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,6}$/, "Invalid currency code");

export const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(240),
  quantity: z
    .number()
    .positive("Quantity must be greater than zero")
    .max(1_000_000),
  unitPrice: money,
});

export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;

export const invoiceCreateSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  projectId: z.string().min(1).nullable().optional(),
  // Empty string → server generates INV-YYYY-####
  number: z.string().trim().max(40).nullable().optional(),
  issueDate: dateString.optional(),
  dueDate: dateString.nullable().optional(),
  status: z.enum(STORED_INVOICE_STATUSES).optional(),
  currency: currencyCode.optional(),
  /**
   * Line items (Phase 5): when `items` is provided the server computes the
   * subtotal from them and ignores `subtotal`. When omitted, the manual
   * `subtotal` is used (legacy invoices without line items).
   */
  items: z.array(invoiceItemInputSchema).max(100).optional(),
  subtotal: z.number().min(0, "Cannot be negative").max(999_999_999).optional(),
  discountType: z.enum(DISCOUNT_TYPES).optional(),
  discountValue: money.optional(),
  additionalCharges: money.optional(),
  additionalNotes: optionalText(500),
  notes: optionalText(2_000),
  terms: optionalText(2_000),
});

export const invoiceUpdateSchema = invoiceCreateSchema.partial();

// ───────────── Business / invoice settings (Phase 5) ─────────────

export const businessSettingsUpdateSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(120).optional(),
  businessEmail: z
    .union([z.literal(""), z.string().trim().email("Invalid email").max(200)])
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  businessPhone: optionalText(40),
  businessAddress: optionalText(400),
  taxInfo: optionalText(200),
  currency: currencyCode.nullable().optional(),
  invoiceFooter: optionalText(500),
  paymentInstructions: optionalText(2_000),
  /** Logo as a data URL — empty string clears it. */
  logoData: z
    .string()
    .max(600_000, "Logo is too large")
    .refine((v) => v === "" || v.startsWith("data:image/"), "Invalid logo image")
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  logoName: optionalText(200),
});

export const paymentCreateSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be greater than zero")
    .max(999_999_999),
  paidAt: dateString.optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  notes: optionalText(500),
});

// ───────────────────── Documents (Phase 6) ─────────────────────

const sectionId = z.string().min(1).max(60);
const sectionHeading = z.string().trim().min(1, "Heading is required").max(160);

export const docTextSectionSchema = z.object({
  id: sectionId,
  kind: z.literal("text"),
  heading: sectionHeading,
  body: z.string().max(20_000),
});

export const docListSectionSchema = z.object({
  id: sectionId,
  kind: z.literal("list"),
  heading: sectionHeading,
  items: z
    .array(z.string().max(2_000))
    .max(200, "List is too long"),
});

export const docTableSectionSchema = z.object({
  id: sectionId,
  kind: z.literal("table"),
  heading: sectionHeading,
  columns: z.array(z.string().trim().min(1, "Column name is required").max(120)).min(1).max(6),
  rows: z.array(z.array(z.string().max(2_000)).max(6)).max(300, "Table is too long"),
});

export const docSectionSchema = z.discriminatedUnion("kind", [
  docTextSectionSchema,
  docListSectionSchema,
  docTableSectionSchema,
]);

export const documentContentSchema = z
  .object({ sections: z.array(docSectionSchema).max(40, "Too many sections") })
  .refine(
    (content) =>
      content.sections.every(
        (s) => s.kind !== "table" || s.rows.every((r) => r.length === s.columns.length),
      ),
    "Table rows must match their columns",
  );

export type DocumentContentInput = z.infer<typeof documentContentSchema>;

export const documentCreateSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().trim().min(1, "Title is required").max(200),
  language: z.enum(["en", "ar"]).optional(),
  issueDate: dateString.optional(),
  clientId: z.string().min(1).nullable().optional(),
  projectId: z.string().min(1).nullable().optional(),
  content: documentContentSchema,
});

export const documentUpdateSchema = documentCreateSchema.partial();

/** Uniform 400 response body for failed validation */
export function validationError(issues: { path: string; message: string }[]) {
  return Response.json({ error: "VALIDATION", issues }, { status: 400 });
}

export function zodIssues(error: z.ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}