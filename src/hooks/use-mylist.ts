"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  authApi,
  businessSettingsApi,
  categoriesApi,
  clientsApi,
  documentsApi,
  invoicesApi,
  paymentsApi,
  projectsApi,
  statsApi,
  tasksApi,
  ApiError,
  type BusinessSettingsInput,
  type ClientInput,
  type DocumentInput,
  type InvoiceInput,
  type PaymentInput,
  type ProjectFilters,
  type ProjectInput,
  type TaskFilters,
  type TaskInput,
} from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type {
  AuthState,
  AuthUser,
  BusinessSettingsDTO,
  CategoryDTO,
  ClientDTO,
  ClientDetailDTO,
  DashboardStats,
  DocumentRecordDTO,
  InvoiceDTO,
  ProjectDTO,
  ProjectDetailDTO,
  SubtaskDTO,
  TaskDTO,
} from "@/lib/types";

export const qk = {
  authState: ["auth-state"] as const,
  tasks: (filters: TaskFilters) => ["tasks", filters] as const,
  categories: ["categories"] as const,
  stats: ["stats"] as const,
  projects: (filters: ProjectFilters) => ["projects", filters] as const,
  project: (id: string) => ["projects", "detail", id] as const,
  clients: (filters: { status?: string; q?: string }) => ["clients", filters] as const,
  client: (id: string) => ["clients", "detail", id] as const,
  invoices: (filters: { q?: string; clientId?: string; projectId?: string }) =>
    ["invoices", filters] as const,
  documents: (filters: {
    q?: string;
    type?: string;
    clientId?: string;
    projectId?: string;
  }) => ["documents", filters] as const,
  businessSettings: ["business-settings"] as const,
};

/** Map API error codes to localized messages. */
export function useApiErrorMessage() {
  const { t } = useI18n();
  return (e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.code === "INVALID_CREDENTIALS") return t("auth.invalidCredentials");
      if (e.code === "TOO_MANY_ATTEMPTS") return t("auth.tooManyAttempts");
      if (e.code === "WRONG_PASSWORD") return t("settings.wrongPassword");
      if (e.code === "CATEGORY_EXISTS") return t("tasks.categoryAlreadyExists");
      if (e.code === "CLIENT_HAS_INVOICES") return t("clients.hasInvoicesError");
      if (e.code === "INVOICE_NUMBER_TAKEN") return t("invoices.numberTaken");
      if (e.code === "OVERPAID") return t("payments.overInvoice");
      if (e.code === "INVOICE_DRAFT") return t("payments.blockedDraft");
      if (e.code === "VALIDATION" && e.issues?.length) return e.issues[0].message;
    }
    return t("errorGeneric");
  };
}

// ───────────────────────── Auth ─────────────────────────

export function useAuthState() {
  return useQuery<AuthState>({
    queryKey: qk.authState,
    queryFn: authApi.state,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useSetup() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  return useMutation<{ user: AuthUser }, unknown, { name: string; email: string; password: string }>({
    mutationFn: authApi.setup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.authState });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  return useMutation<{ user: AuthUser }, unknown, { email: string; password: string }>({
    mutationFn: authApi.login,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.authState });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      // Update the actively-observed auth state first so the app
      // immediately renders the login view, then purge all other
      // cached queries (tasks, stats, categories, …).
      qc.setQueryData(qk.authState, {
        needsSetup: false,
        authed: false,
        user: null,
      });
      qc.removeQueries({
        predicate: (q) => q.queryKey[0] !== "auth-state",
      });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ user: AuthUser }, unknown, { name: string }>({
    mutationFn: authApi.updateProfile,
    onSuccess: () => {
      toast.success(t("settings.profileSaved"));
      qc.invalidateQueries({ queryKey: qk.authState });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useChangePassword() {
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<
    { ok: boolean },
    unknown,
    { currentPassword: string; newPassword: string }
  >({
    mutationFn: authApi.changePassword,
    onSuccess: () => toast.success(t("settings.passwordUpdated")),
    onError: (e) => toast.error(message(e)),
  });
}

// ───────────────────────── Tasks ─────────────────────────

export function useTasks(filters: TaskFilters = {}) {
  return useQuery<{ tasks: TaskDTO[] }>({
    queryKey: qk.tasks(filters),
    queryFn: () => tasksApi.list(filters),
    staleTime: 5_000,
  });
}

/** Invalidate every task-derived view (tasks lists, stats, projects). */
function invalidateTaskDependents(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: qk.stats });
  qc.invalidateQueries({ queryKey: ["projects"] });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ task: TaskDTO }, unknown, TaskInput>({
    mutationFn: (body) => tasksApi.create(body),
    onSuccess: () => {
      toast.success(t("tasks.taskCreated"));
      invalidateTaskDependents(qc);
      qc.invalidateQueries({ queryKey: qk.categories });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<
    { task: TaskDTO },
    unknown,
    { id: string; data: Partial<TaskInput> }
  >({
    mutationFn: ({ id, data }) => tasksApi.update(id, data),
    onSuccess: () => {
      toast.success(t("tasks.taskUpdated"));
      invalidateTaskDependents(qc);
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ ok: boolean }, unknown, { id: string }>({
    mutationFn: ({ id }) => tasksApi.remove(id),
    onSuccess: () => {
      toast.success(t("tasks.taskDeleted"));
      invalidateTaskDependents(qc);
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useAddSubtask() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<
    { subtask: SubtaskDTO },
    unknown,
    { taskId: string; title: string }
  >({
    mutationFn: ({ taskId, title }) => tasksApi.addSubtask(taskId, title),
    onSuccess: () => {
      toast.success(t("tasks.subtaskAdded"));
      invalidateTaskDependents(qc);
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  return useMutation<
    { ok: boolean },
    unknown,
    { subtaskId: string; data: { title?: string; completed?: boolean } }
  >({
    mutationFn: ({ subtaskId, data }) => tasksApi.updateSubtask(subtaskId, data),
    onSuccess: () => {
      invalidateTaskDependents(qc);
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useRemoveSubtask() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  return useMutation<{ ok: boolean }, unknown, { subtaskId: string }>({
    mutationFn: ({ subtaskId }) => tasksApi.removeSubtask(subtaskId),
    onSuccess: () => {
      invalidateTaskDependents(qc);
    },
    onError: (e) => toast.error(message(e)),
  });
}

// ───────────────────────── Categories ─────────────────────────

export function useCategories() {
  return useQuery<{ categories: CategoryDTO[] }>({
    queryKey: qk.categories,
    queryFn: categoriesApi.list,
    staleTime: 30_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ category: CategoryDTO }, unknown, { name: string; color?: string }>({
    mutationFn: (body) => categoriesApi.create(body),
    onSuccess: () => {
      toast.success(t("tasks.categoryCreated"));
      qc.invalidateQueries({ queryKey: qk.categories });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ ok: boolean }, unknown, { id: string }>({
    mutationFn: ({ id }) => categoriesApi.remove(id),
    onSuccess: () => {
      toast.success(t("tasks.categoryDeleted"));
      qc.invalidateQueries({ queryKey: qk.categories });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: qk.stats });
    },
    onError: (e) => toast.error(message(e)),
  });
}

// ───────────────────────── Stats ─────────────────────────

export function useStats() {
  const tzOffset = new Date().getTimezoneOffset();
  return useQuery<{ stats: DashboardStats }>({
    queryKey: qk.stats,
    queryFn: () => statsApi.get(tzOffset),
    staleTime: 5_000,
  });
}

// ───────────────────────── Projects ─────────────────────────

export function useProjects(filters: ProjectFilters = {}) {
  return useQuery<{ projects: ProjectDTO[] }>({
    queryKey: qk.projects(filters),
    queryFn: () => projectsApi.list(filters),
    staleTime: 5_000,
  });
}

export function useProject(id: string | null) {
  return useQuery<{ project: ProjectDetailDTO }>({
    queryKey: qk.project(id ?? "none"),
    queryFn: () => projectsApi.get(id as string),
    enabled: !!id,
    staleTime: 5_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ project: ProjectDTO }, unknown, ProjectInput>({
    mutationFn: (body) => projectsApi.create(body),
    onSuccess: () => {
      toast.success(t("projects.projectCreated"));
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<
    { project: ProjectDTO },
    unknown,
    { id: string; data: Partial<ProjectInput> }
  >({
    mutationFn: ({ id, data }) => projectsApi.update(id, data),
    onSuccess: () => {
      toast.success(t("projects.projectUpdated"));
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ ok: boolean }, unknown, { id: string }>({
    mutationFn: ({ id }) => projectsApi.remove(id),
    onSuccess: () => {
      toast.success(t("projects.projectDeleted"));
      qc.invalidateQueries({ queryKey: ["projects"] });
      // Tasks of the deleted project are kept but unlinked.
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: qk.stats });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e) => toast.error(message(e)),
  });
}

// ───────────────────── Clients & finance (Phase 4) ─────────────────────

/** Any invoice change affects the clients list + project financials too. */
function invalidateFinance(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["invoices"] });
  qc.invalidateQueries({ queryKey: ["clients"] });
  qc.invalidateQueries({ queryKey: ["projects"] });
}

export function useClients(filters: { status?: string; q?: string } = {}) {
  return useQuery<{ clients: ClientDTO[] }>({
    queryKey: qk.clients(filters),
    queryFn: () => clientsApi.list(filters),
    staleTime: 5_000,
  });
}

export function useClient(id: string | null) {
  return useQuery<{ client: ClientDetailDTO }>({
    queryKey: qk.client(id ?? "none"),
    queryFn: () => clientsApi.get(id as string),
    enabled: !!id,
    staleTime: 5_000,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ client: ClientDTO }, unknown, ClientInput>({
    mutationFn: (body) => clientsApi.create(body),
    onSuccess: () => {
      toast.success(t("clients.clientCreated"));
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<
    { client: ClientDTO },
    unknown,
    { id: string; data: Partial<ClientInput> }
  >({
    mutationFn: ({ id, data }) => clientsApi.update(id, data),
    onSuccess: () => {
      toast.success(t("clients.clientUpdated"));
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ ok: boolean }, unknown, { id: string }>({
    mutationFn: ({ id }) => clientsApi.remove(id),
    onSuccess: () => {
      toast.success(t("clients.clientDeleted"));
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useInvoices(
  filters: { q?: string; clientId?: string; projectId?: string } = {},
) {
  return useQuery<{ invoices: InvoiceDTO[] }>({
    queryKey: qk.invoices(filters),
    queryFn: () => invoicesApi.list(filters),
    staleTime: 5_000,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ invoice: InvoiceDTO }, unknown, InvoiceInput>({
    mutationFn: (body) => invoicesApi.create(body),
    onSuccess: () => {
      toast.success(t("invoices.invoiceCreated"));
      invalidateFinance(qc);
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<
    { invoice: InvoiceDTO },
    unknown,
    { id: string; data: Partial<InvoiceInput> }
  >({
    mutationFn: ({ id, data }) => invoicesApi.update(id, data),
    onSuccess: () => {
      toast.success(t("invoices.invoiceUpdated"));
      invalidateFinance(qc);
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ ok: boolean }, unknown, { id: string }>({
    mutationFn: ({ id }) => invoicesApi.remove(id),
    onSuccess: () => {
      toast.success(t("invoices.invoiceDeleted"));
      invalidateFinance(qc);
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useAddPayment() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<
    { invoice: InvoiceDTO },
    unknown,
    { invoiceId: string; data: PaymentInput }
  >({
    mutationFn: ({ invoiceId, data }) => invoicesApi.addPayment(invoiceId, data),
    onSuccess: () => {
      toast.success(t("payments.paymentRecorded"));
      invalidateFinance(qc);
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ ok: boolean }, unknown, { id: string }>({
    mutationFn: ({ id }) => paymentsApi.remove(id),
    onSuccess: () => {
      toast.success(t("payments.paymentDeleted"));
      invalidateFinance(qc);
    },
    onError: (e) => toast.error(message(e)),
  });
}

// ───────────── Business / invoice settings (Phase 5) ─────────────

export function useBusinessSettings() {
  return useQuery<{ settings: BusinessSettingsDTO }>({
    queryKey: qk.businessSettings,
    queryFn: businessSettingsApi.get,
    staleTime: 60_000,
  });
}

export function useUpdateBusinessSettings() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<
    { settings: BusinessSettingsDTO },
    unknown,
    BusinessSettingsInput
  >({
    mutationFn: (body) => businessSettingsApi.update(body),
    onSuccess: () => {
      toast.success(t("businessSettings.saved"));
      qc.invalidateQueries({ queryKey: qk.businessSettings });
    },
    onError: (e) => toast.error(message(e)),
  });
}

// ───────────────────── Documents (Phase 6) ─────────────────────

export type DocumentFilters = {
  q?: string;
  type?: string;
  clientId?: string;
  projectId?: string;
};

export function useDocuments(filters: DocumentFilters = {}) {
  return useQuery<{ documents: DocumentRecordDTO[] }>({
    queryKey: qk.documents(filters),
    queryFn: () => documentsApi.list(filters),
    staleTime: 5_000,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ document: DocumentRecordDTO }, unknown, DocumentInput>({
    mutationFn: (body) => documentsApi.create(body),
    onSuccess: () => {
      toast.success(t("documents.created"));
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<
    { document: DocumentRecordDTO },
    unknown,
    { id: string; data: Partial<DocumentInput> }
  >({
    mutationFn: ({ id, data }) => documentsApi.update(id, data),
    onSuccess: () => {
      toast.success(t("documents.updated"));
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) => toast.error(message(e)),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  const message = useApiErrorMessage();
  const { t } = useI18n();
  return useMutation<{ ok: boolean }, unknown, { id: string }>({
    mutationFn: ({ id }) => documentsApi.remove(id),
    onSuccess: () => {
      toast.success(t("documents.deleted"));
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) => toast.error(message(e)),
  });
}