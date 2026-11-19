// Server-side DTO builders (Phase 4) — convert Prisma rows into the wire
// DTOs defined in lib/types.ts. Structural input types keep them compatible
// with any `include` shape used by the API routes.
import { normalizePlan, planTaskCount, type AIPlan } from "@/lib/ai/plan-schema";
import type {
  AIDraftDTO,
  AIDraftSummaryDTO,
  BriefAttachmentDTO,
  BriefSourceType,
  BriefVersionDTO,
  ClientDTO,
  ClientFinancials,
  ClientStatus,
  DiscountType,
  DocumentContent,
  DocumentLanguage,
  DocumentRecordDTO,
  DocumentType,
  InvoiceDTO,
  PaymentDTO,
  PaymentMethod,
  StoredInvoiceStatus,
} from "@/lib/types";
import {
  clientFinancials,
  invoiceDisplayState,
  invoiceRemaining,
  projectRemaining,
  projectTotalValue,
  round2,
} from "@/lib/finance";
import type { ProjectDTO } from "@/lib/types";

// ───────────────────────── Payments ─────────────────────────

export interface PaymentRowLike {
  id: string;
  invoiceId: string;
  amount: number;
  paidAt: Date;
  method: string | null;
  notes: string | null;
  createdAt: Date;
}

export function serializePayment(p: PaymentRowLike): PaymentDTO {
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    amount: round2(p.amount),
    paidAt: p.paidAt.toISOString(),
    method: (p.method as PaymentMethod | null) ?? null,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
  };
}

// ───────────────────────── Invoices ─────────────────────────

export interface InvoiceItemRowLike {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  order: number;
}

export interface InvoiceRowLike {
  id: string;
  number: string;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  subtotal: number;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  additionalCharges: number;
  additionalNotes: string | null;
  total: number;
  amountPaid: number;
  currency: string;
  notes: string | null;
  terms: string | null;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    id: string;
    name: string;
    company: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  project?: { id: string; name: string } | null;
  items?: InvoiceItemRowLike[];
  payments?: PaymentRowLike[];
}

export function serializeInvoice(row: InvoiceRowLike): InvoiceDTO {
  const total = round2(row.total);
  const amountPaid = round2(row.amountPaid);
  const payments = (row.payments ?? [])
    .map(serializePayment)
    .sort((a, b) => Date.parse(b.paidAt) - Date.parse(a.paidAt));
  const items = [...(row.items ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      id: item.id,
      description: item.description,
      quantity: round2(item.quantity),
      unitPrice: round2(item.unitPrice),
      amount: round2(item.amount),
      order: item.order,
    }));
  const dueDate = row.dueDate ? row.dueDate.toISOString() : null;
  const display = invoiceDisplayState({
    status: row.status,
    total,
    amountPaid,
    dueDate,
  });
  return {
    id: row.id,
    number: row.number,
    status: row.status as StoredInvoiceStatus,
    issueDate: row.issueDate.toISOString(),
    dueDate,
    subtotal: round2(row.subtotal),
    discountType: row.discountType as DiscountType,
    discountValue: round2(row.discountValue),
    discountAmount: round2(row.discountAmount),
    additionalCharges: round2(row.additionalCharges ?? 0),
    additionalNotes: row.additionalNotes ?? null,
    total,
    amountPaid,
    remaining: invoiceRemaining(total, amountPaid),
    currency: row.currency,
    notes: row.notes,
    terms: row.terms,
    client: row.client
      ? {
          id: row.client.id,
          name: row.client.name,
          company: row.client.company ?? null,
          email: row.client.email ?? null,
          phone: row.client.phone ?? null,
          address: row.client.address ?? null,
        }
      : null,
    project: row.project ?? null,
    items,
    payments,
    overdue: display === "OVERDUE",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ───────────────────── Documents (Phase 6) ─────────────────────

export interface DocumentRowLike {
  id: string;
  number: string;
  type: string;
  title: string;
  language: string;
  issueDate: Date;
  content: string;
  clientId: string | null;
  projectId: string | null;
  versionNo: number;
  previousVersionId: string | null;
  aiTrace: string | null;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    id: string;
    name: string;
    company: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  project?: { id: string; name: string } | null;
}

/** Parse the stored content JSON defensively — a corrupt row never 500s. */
function parseContent(raw: string): DocumentContent {
  try {
    const parsed = JSON.parse(raw) as Partial<DocumentContent>;
    if (!parsed || !Array.isArray(parsed.sections)) return { sections: [] };
    return { sections: parsed.sections };
  } catch {
    return { sections: [] };
  }
}

export function serializeDocumentRecord(row: DocumentRowLike): DocumentRecordDTO {
  return {
    id: row.id,
    number: row.number,
    type: row.type as DocumentType,
    title: row.title,
    language: (row.language === "ar" ? "ar" : "en") as DocumentLanguage,
    issueDate: row.issueDate.toISOString(),
    clientId: row.clientId,
    projectId: row.projectId,
    client: row.client
      ? {
          id: row.client.id,
          name: row.client.name,
          company: row.client.company ?? null,
          email: row.client.email ?? null,
          phone: row.client.phone ?? null,
          address: row.client.address ?? null,
        }
      : null,
    project: row.project ?? null,
    content: parseContent(row.content),
    versionNo: row.versionNo,
    previousVersionId: row.previousVersionId,
    aiTrace: row.aiTrace,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ───────────────────────── Clients ─────────────────────────

export interface ClientProjectLite {
  status: string;
  agreedPrice: number;
  additionalCharges: number;
  discount: number;
}

export interface ClientInvoiceLite {
  status: string;
  total: number;
  amountPaid: number;
}

export interface ClientRowLike {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { projects?: number; invoices?: number };
  projects?: ClientProjectLite[];
  invoices?: ClientInvoiceLite[];
}

export function serializeClient(row: ClientRowLike): ClientDTO {
  const financials: ClientFinancials = clientFinancials(
    row.projects ?? [],
    row.invoices ?? [],
  );
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    status: row.status as ClientStatus,
    projectCount: row._count?.projects ?? row.projects?.length ?? 0,
    invoiceCount: row._count?.invoices ?? row.invoices?.length ?? 0,
    financials,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ───────────────── Projects (financial projection) ─────────────────

/** Project fields needed to compute its financial card on detail pages. */
export interface ProjectFinancialLite {
  status: string;
  agreedPrice: number;
  additionalCharges: number;
  discount: number;
}

/** Reusable financial block for the project detail page. */
export function projectFinancialSummary(
  project: ProjectFinancialLite,
  invoices: { status: string; amountPaid: number }[],
): { totalValue: number; paid: number; remaining: number } {
  const totalValue = projectTotalValue(project);
  const paid = round2(
    invoices
      .filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED")
      .reduce((sum, i) => sum + i.amountPaid, 0),
  );
  return { totalValue, paid, remaining: projectRemaining(totalValue, paid) };
}

/** Narrow helper used when reusing ProjectDTO data client-side. */
export function projectValueOf(p: ProjectDTO): number {
  return projectTotalValue(p);
}

// ───────────────────────── Brief (Phase A2) ─────────────────────────

interface AttachmentRowLike {
  id: string;
  name: string;
  mime: string;
  size: number;
  processingStatus: string;
  extractedText: string | null;
  visionSummary: string | null;
  createdAt: Date;
}

/** Attachments are listed without their (potentially heavy) data URLs. */
export function serializeBriefAttachment(a: AttachmentRowLike): BriefAttachmentDTO {
  return {
    id: a.id,
    name: a.name,
    mime: a.mime,
    size: a.size,
    processingStatus: a.processingStatus as BriefAttachmentDTO["processingStatus"],
    extractedText: a.extractedText,
    visionSummary: a.visionSummary,
    createdAt: a.createdAt.toISOString(),
  };
}

interface VersionRowLike {
  id: string;
  versionNo: number;
  content: string;
  transcript: string | null;
  language: string;
  sourceTypes: string;
  attachments: AttachmentRowLike[];
  createdAt: Date;
}

export function serializeBriefVersion(v: VersionRowLike): BriefVersionDTO {
  let sourceTypes: BriefSourceType[] = [];
  try {
    const parsed: unknown = JSON.parse(v.sourceTypes);
    if (Array.isArray(parsed)) {
      sourceTypes = parsed.filter(
        (s): s is BriefSourceType =>
          s === "text" || s === "voice" || s === "files",
      );
    }
  } catch {
    // corrupt JSON → treat as no sources
  }
  return {
    id: v.id,
    versionNo: v.versionNo,
    content: v.content,
    transcript: v.transcript,
    language: v.language as BriefVersionDTO["language"],
    sourceTypes,
    attachments: v.attachments.map(serializeBriefAttachment),
    createdAt: v.createdAt.toISOString(),
  };
}

// ───────────────────── AI plan drafts (Phase A3) ─────────────────────

interface DraftRowLike {
  id: string;
  projectId: string;
  briefVersionId: string | null;
  status: string;
  language: string;
  provider: string | null;
  model: string | null;
  payload: string;
  createdAt: Date;
  updatedAt: Date;
}

export function draftPayloadOf(row: { payload: string }): AIPlan {
  try {
    return normalizePlan(JSON.parse(row.payload));
  } catch {
    return normalizePlan(null);
  }
}

export function serializeAIDraft(row: DraftRowLike): AIDraftDTO {
  const plan = draftPayloadOf(row);
  return {
    id: row.id,
    projectId: row.projectId,
    briefVersionId: row.briefVersionId,
    status: row.status as AIDraftDTO["status"],
    language: row.language as AIDraftDTO["language"],
    provider: row.provider,
    model: row.model,
    payload: plan,
    moduleCount: plan.modules.length,
    taskCount: planTaskCount(plan),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeAIDraftSummary(row: DraftRowLike): AIDraftSummaryDTO {
  const plan = draftPayloadOf(row);
  return {
    id: row.id,
    status: row.status as AIDraftSummaryDTO["status"],
    language: row.language as AIDraftSummaryDTO["language"],
    moduleCount: plan.modules.length,
    taskCount: planTaskCount(plan),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}