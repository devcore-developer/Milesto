"use client";

import type {
  AuthState,
  AuthUser,
  BusinessSettingsDTO,
  CategoryDTO,
  ClientDTO,
  ClientDetailDTO,
  DashboardStats,
  DocumentContent,
  DocumentRecordDTO,
  InvoiceDTO,
  PaymentDTO,
  ProjectDTO,
  ProjectDetailDTO,
  SubtaskDTO,
  TaskDTO,
} from "@/lib/types";
import type { ReminderSettings } from "@/lib/notifications";

export class ApiError extends Error {
  code: string;
  status: number;
  issues?: { path: string; message: string }[];

  constructor(code: string, status: number, issues?: { path: string; message: string }[]) {
    super(code);
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let code = "SERVER_ERROR";
    let issues: { path: string; message: string }[] | undefined;
    try {
      const body = await res.json();
      code = body.error ?? code;
      issues = body.issues;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(code, res.status, issues);
  }
  return res.json() as Promise<T>;
}

// ───────────────────────── Auth ─────────────────────────

export const authApi = {
  state: () => request<AuthState>("/api/auth/state"),
  setup: (body: { name: string; email: string; password: string }) =>
    request<{ user: AuthUser }>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  updateProfile: (body: { name: string }) =>
    request<{ user: AuthUser }>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

// ───────────────────────── Tasks ─────────────────────────

export interface TaskFilters {
  status?: string;
  priority?: string;
  categoryId?: string;
  q?: string;
}

export interface TaskInput {
  title: string;
  notes?: string | null;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  categoryId?: string | null;
  projectId?: string | null;
  subtasks?: { title: string }[];
}

export const tasksApi = {
  list: (filters: TaskFilters = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return request<{ tasks: TaskDTO[] }>(`/api/tasks${qs ? `?${qs}` : ""}`);
  },
  create: (body: TaskInput) =>
    request<{ task: TaskDTO }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<TaskInput>) =>
    request<{ task: TaskDTO }>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),
  addSubtask: (taskId: string, title: string) =>
    request<{ subtask: SubtaskDTO }>(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  updateSubtask: (subtaskId: string, body: { title?: string; completed?: boolean }) =>
    request<{ ok: boolean }>(`/api/subtasks/${subtaskId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeSubtask: (subtaskId: string) =>
    request<{ ok: boolean }>(`/api/subtasks/${subtaskId}`, { method: "DELETE" }),
};

// ───────────────────────── Projects ─────────────────────────

export interface ProjectFilters {
  status?: string;
  priority?: string;
  q?: string;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  status?: string;
  priority?: string;
  startDate?: string | null;
  deadline?: string | null;
  deliveryDate?: string | null;
  color?: string | null;
  notes?: string | null;
  // ── Financials & client link (Phase 4) ──
  clientId?: string | null;
  agreedPrice?: number;
  additionalCharges?: number;
  additionalNotes?: string | null;
  discount?: number;
}

export const projectsApi = {
  list: (filters: ProjectFilters = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return request<{ projects: ProjectDTO[] }>(`/api/projects${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) =>
    request<{ project: ProjectDetailDTO }>(`/api/projects/${id}`),
  create: (body: ProjectInput) =>
    request<{ project: ProjectDTO }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<ProjectInput>) =>
    request<{ project: ProjectDTO }>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
};

// ───────────────────────── Categories ─────────────────────────

export const categoriesApi = {
  list: () => request<{ categories: CategoryDTO[] }>("/api/categories"),
  create: (body: { name: string; color?: string }) =>
    request<{ category: CategoryDTO }>("/api/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/categories/${id}`, { method: "DELETE" }),
};

// ───────────────────── Reminder settings (Phase 3) ─────────────────────

export const remindersApi = {
  /**
   * Load the saved reminder configuration. `source:"db"` means the user
   * has saved settings before; `source:"default"` means no row exists yet
   * and the API returned the default values without writing anything.
   */
  get: () =>
    request<{
      settings: ReminderSettings;
      source: "db" | "default";
    }>("/api/reminders/settings"),
  /** Persist the reminder configuration (creates the row on first save). */
  update: (settings: ReminderSettings) =>
    request<{ settings: ReminderSettings }>("/api/reminders/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};

// ───────────────────── Clients & finance (Phase 4) ─────────────────────

export interface ClientInput {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: string;
}

export const clientsApi = {
  list: (filters: { status?: string; q?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return request<{ clients: ClientDTO[] }>(`/api/clients${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) =>
    request<{ client: ClientDetailDTO }>(`/api/clients/${id}`),
  create: (body: ClientInput) =>
    request<{ client: ClientDTO }>("/api/clients", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<ClientInput>) =>
    request<{ client: ClientDTO }>(`/api/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/clients/${id}`, { method: "DELETE" }),
};

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceInput {
  clientId: string;
  projectId?: string | null;
  number?: string | null;
  issueDate?: string;
  dueDate?: string | null;
  status?: string;
  currency?: string;
  /** Line items — when sent, the server computes the subtotal from them */
  items?: InvoiceItemInput[];
  /** Manual subtotal (used only when `items` is not sent) */
  subtotal?: number;
  discountType?: string;
  discountValue?: number;
  additionalCharges?: number;
  additionalNotes?: string | null;
  notes?: string | null;
  terms?: string | null;
}

export interface PaymentInput {
  amount: number;
  paidAt?: string;
  method?: string;
  notes?: string | null;
}

export const invoicesApi = {
  list: (filters: { q?: string; clientId?: string; projectId?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return request<{ invoices: InvoiceDTO[] }>(`/api/invoices${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<{ invoice: InvoiceDTO }>(`/api/invoices/${id}`),
  create: (body: InvoiceInput) =>
    request<{ invoice: InvoiceDTO }>("/api/invoices", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<InvoiceInput>) =>
    request<{ invoice: InvoiceDTO }>(`/api/invoices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/invoices/${id}`, { method: "DELETE" }),
  addPayment: (invoiceId: string, body: PaymentInput) =>
    request<{ invoice: InvoiceDTO }>(`/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const paymentsApi = {
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/payments/${id}`, { method: "DELETE" }),
};

// ───────────── Business / invoice settings (Phase 5) ─────────────────────

export interface BusinessSettingsInput {
  businessName?: string;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  taxInfo?: string | null;
  currency?: string | null;
  invoiceFooter?: string | null;
  paymentInstructions?: string | null;
  /** Logo as a data URL — empty string clears the stored logo */
  logoData?: string | null;
  logoName?: string | null;
}

export const businessSettingsApi = {
  get: () =>
    request<{ settings: BusinessSettingsDTO }>("/api/business-settings"),
  update: (body: BusinessSettingsInput) =>
    request<{ settings: BusinessSettingsDTO }>("/api/business-settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

/** URL of the premium PDF export for an invoice. */
export function invoicePdfUrl(
  invoiceId: string,
  lang: "en" | "ar",
  download = false,
): string {
  const params = new URLSearchParams({ lang });
  if (download) params.set("download", "1");
  return `/api/invoices/${invoiceId}/pdf?${params.toString()}`;
}

// ───────────────────── Documents (Phase 6) ─────────────────────

export interface DocumentInput {
  type: string;
  title: string;
  /** Output language of the document itself (defaults to "en") */
  language?: "en" | "ar";
  issueDate?: string;
  clientId?: string | null;
  projectId?: string | null;
  /** Full section content — replaces the saved content when sent */
  content?: DocumentContent;
}

export const documentsApi = {
  list: (
    filters: { q?: string; type?: string; clientId?: string; projectId?: string } = {},
  ) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return request<{ documents: DocumentRecordDTO[] }>(
      `/api/documents${qs ? `?${qs}` : ""}`,
    );
  },
  get: (id: string) =>
    request<{ document: DocumentRecordDTO }>(`/api/documents/${id}`),
  create: (body: DocumentInput) =>
    request<{ document: DocumentRecordDTO }>("/api/documents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<DocumentInput>) =>
    request<{ document: DocumentRecordDTO }>(`/api/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/documents/${id}`, { method: "DELETE" }),
};

/** URL of the premium PDF export for a saved document. */
export function documentPdfUrl(documentId: string, download = false): string {
  const params = new URLSearchParams();
  if (download) params.set("download", "1");
  const qs = params.toString();
  return `/api/documents/${documentId}/pdf${qs ? `?${qs}` : ""}`;
}

// ───────────────────────── Stats ─────────────────────────

export const statsApi = {
  get: (tzOffset: number) =>
    request<{ stats: DashboardStats }>(`/api/stats?tzOffset=${tzOffset}`),
};