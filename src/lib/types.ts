// Shared domain types & wire DTOs (JSON-serialized shapes, dates as ISO strings)

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PROJECT_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Statuses physically stored on the invoice row. PARTIALLY_PAID / PAID /
 * OVERDUE are derived from payments + dates so financial data always stays
 * consistent (see `invoiceDisplayState` in lib/finance.ts).
 */
export const STORED_INVOICE_STATUSES = ["DRAFT", "SENT", "CANCELLED"] as const;
export type StoredInvoiceStatus = (typeof STORED_INVOICE_STATUSES)[number];

export const CLIENT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CARD", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DOCUMENT_TYPES = [
  "SCOPE_OF_WORK",
  "COMPLETION_REPORT",
  "PROGRESS_REPORT",
  "CUSTOM_REPORT",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Output language of a generated document (Phase 6) */
export type DocumentLanguage = "en" | "ar";

// ───────────────────── Documents (Phase 6) ─────────────────────

/** Free-text section: heading + multi-line body */
export interface DocSectionText {
  id: string;
  kind: "text";
  heading: string;
  body: string;
}

/** Bullet list section: heading + items */
export interface DocSectionList {
  id: string;
  kind: "list";
  heading: string;
  items: string[];
}

/** Table section: heading + columns + rows (each row matches columns) */
export interface DocSectionTable {
  id: string;
  kind: "table";
  heading: string;
  columns: string[];
  rows: string[][];
}

export type DocSection = DocSectionText | DocSectionList | DocSectionTable;

/** JSON-serialized into DocumentRecord.content */
export interface DocumentContent {
  sections: DocSection[];
}

/** Client info embedded in the document DTO / PDF header */
export interface DocumentClientInfo {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface DocumentRecordDTO {
  id: string;
  /** Auto-generated DOC-YYYY-#### */
  number: string;
  type: DocumentType;
  title: string;
  language: DocumentLanguage;
  issueDate: string;
  clientId: string | null;
  projectId: string | null;
  client: DocumentClientInfo | null;
  project: { id: string; name: string } | null;
  content: DocumentContent;
  createdAt: string;
  updatedAt: string;
}

/** Single-owner private application — currency chosen in invoice settings */
export const DEFAULT_CURRENCY = "EGP";

/** Currencies offered in the invoice settings selector (free 3-letter codes
 * are also accepted by the API — this list only powers the UI dropdown). */
export const CURRENCIES = [
  "EGP",
  "USD",
  "EUR",
  "GBP",
  "SAR",
  "AED",
  "KWD",
  "QAR",
  "BHD",
  "OMR",
  "JOD",
  "MAD",
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface SubtaskDTO {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDTO {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  order: number;
  categoryId: string | null;
  projectId: string | null;
  category: { id: string; name: string; color: string } | null;
  project?: { id: string; name: string } | null;
  subtasks: SubtaskDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDTO {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  startDate: string | null;
  deadline: string | null;
  deliveryDate: string | null;
  color: string | null;
  notes: string | null;
  /** Computed from tasks: total / completed / percentage */
  taskTotal: number;
  taskDone: number;
  progressPct: number;
  /** Deadline passed while project is still active */
  overdue: boolean;
  /** Days until deadline (negative = overdue), null when no deadline */
  daysRemaining: number | null;
  client: { id: string; name: string } | null;
  /** ── Financials (Phase 4) ── agreed + additional - discount (≥ 0) */
  agreedPrice: number;
  additionalCharges: number;
  additionalNotes: string | null;
  discount: number;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailDTO extends ProjectDTO {
  tasks: TaskDTO[];
  /** Sum of amountPaid over countable invoices linked to this project */
  paid: number;
  /** totalValue - paid (≥ 0) */
  remaining: number;
  /** Invoices linked to this project (newest first) */
  invoices: InvoiceDTO[];
}

export interface DashboardStats {
  totals: {
    all: number;
    todo: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };
  completionPct: number;
  dueToday: TaskDTO[];
  upcoming: TaskDTO[];
  byPriority: { priority: TaskPriority; count: number }[];
  last7Days: { date: string; label: string; completed: number }[];
}

// ───────────────────── Clients & finance (Phase 4) ─────────────────────

export interface PaymentDTO {
  id: string;
  invoiceId: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod | null;
  notes: string | null;
  createdAt: string;
}

/** Line item of an invoice (Phase 5) */
export interface InvoiceItemDTO {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  order: number;
}

/** Business branding & invoice defaults (Phase 5) — one row per user */
export interface BusinessSettingsDTO {
  businessName: string;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  /** Free-text tax identification shown on invoices */
  taxInfo: string | null;
  /** ISO currency code applied to new invoices */
  currency: string;
  invoiceFooter: string | null;
  paymentInstructions: string | null;
  /** Logo as a data URL (data:image/…;base64,…) */
  logoData: string | null;
  logoName: string | null;
}

export interface InvoiceDTO {
  id: string;
  number: string;
  /** Stored status — display status is derived (see invoiceDisplayState) */
  status: StoredInvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  /** Delivery / extra fees on top of the line items (Phase 5) */
  additionalCharges: number;
  additionalNotes: string | null;
  total: number;
  amountPaid: number;
  remaining: number;
  currency: string;
  notes: string | null;
  terms: string | null;
  client:
    | {
        id: string;
        name: string;
        company: string | null;
        /** Contact fields are populated for the PDF export; some list
         * endpoints select only id/name/company. */
        email: string | null;
        phone: string | null;
        address: string | null;
      }
    | null;
  project: { id: string; name: string } | null;
  /** Line items (ordered) — empty for legacy invoices created without items */
  items: InvoiceItemDTO[];
  payments: PaymentDTO[];
  /** dueDate passed while unpaid (derived) */
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientFinancials {
  /** Sum of non-cancelled project totals for this client */
  projectValue: number;
  /** Sum of totals over invoices that are neither draft nor cancelled */
  invoiced: number;
  /** Sum of amountPaid over those same invoices */
  paid: number;
  /** invoiced - paid (≥ 0) */
  outstanding: number;
}

export interface ClientDTO {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: ClientStatus;
  projectCount: number;
  invoiceCount: number;
  financials: ClientFinancials;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDetailDTO extends ClientDTO {
  projects: ProjectDTO[];
  invoices: InvoiceDTO[];
}

export interface DocumentStats {
  total: number;
  byType: { type: DocumentType; count: number }[];
}

export interface AuthState {
  needsSetup: boolean;
  authed: boolean;
  user: AuthUser | null;
}