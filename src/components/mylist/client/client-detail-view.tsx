"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  FolderKanban,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Receipt,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClient, useDeleteClient } from "@/hooks/use-mylist";
import { formatDate, useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/store";
import { formatMoney, invoiceDisplayState } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { ProjectStatusBadge } from "@/components/mylist/project/badges";
import { InvoiceStatusBadge } from "@/components/mylist/finance/invoice-badge";
import { InvoiceDialog } from "@/components/mylist/finance/invoice-dialog";
import { ClientDialog } from "@/components/mylist/client/client-dialog";
import type { ClientDetailDTO } from "@/lib/types";

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "blue" | "green" | "red";
}) {
  const toneClass = {
    slate: "text-slate-900",
    blue: "text-blue-700",
    green: "text-emerald-600",
    red: "text-red-600",
  }[tone];
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums sm:text-xl", toneClass)} dir="ltr">
        {value}
      </p>
    </Card>
  );
}

type Activity = { iso: string; label: string };

function buildActivity(client: ClientDetailDTO): Activity[] {
  const items: Activity[] = [];
  items.push({ iso: client.createdAt, label: "__clientCreated" });
  for (const project of client.projects) {
    items.push({ iso: project.createdAt, label: `__project:${project.name}` });
  }
  for (const invoice of client.invoices) {
    items.push({ iso: invoice.createdAt, label: `__invoice:${invoice.number}` });
    for (const payment of invoice.payments) {
      items.push({ iso: payment.createdAt, label: `__payment:${invoice.number}` });
    }
  }
  items.sort((a, b) => Date.parse(b.iso) - Date.parse(a.iso));
  return items.slice(0, 8);
}

export function ClientDetailView({
  clientId,
  onBack,
}: {
  clientId: string;
  onBack: () => void;
}) {
  const { t, lang } = useI18n();
  const openProject = useUIStore((s) => s.openProject);
  const deleteClient = useDeleteClient();

  const { data, isLoading } = useClient(clientId);
  const client = data?.client;

  const [editOpen, setEditOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const activity = useMemo(() => (client ? buildActivity(client) : []), [client]);

  if (isLoading || !client) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const f = client.financials;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-500"
            aria-label={t("clients.backToClients")}
            onClick={onBack}
          >
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
                {client.name}
              </h1>
              <InvoiceStatusBadgeProxy status={client.status} />
            </div>
            {client.company && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                <Building2 className="size-3.5" />
                {client.company}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setInvoiceOpen(true)}>
            <Receipt className="size-4" />
            {t("clientDetail.newInvoiceFor")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setEditOpen(true)} aria-label={t("edit")}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="text-slate-400 hover:text-red-600"
            onClick={() => setDeleteOpen(true)}
            aria-label={t("delete")}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("clientDetail.totalProjectValue")}
          value={formatMoney(f.projectValue, lang)}
          tone="blue"
        />
        <StatCard
          label={t("clientDetail.totalInvoiced")}
          value={formatMoney(f.invoiced, lang)}
          tone="slate"
        />
        <StatCard
          label={t("clientDetail.totalPaid")}
          value={formatMoney(f.paid, lang)}
          tone="green"
        />
        <StatCard
          label={t("clientDetail.outstanding")}
          value={formatMoney(f.outstanding, lang)}
          tone={f.outstanding > 0 ? "red" : "green"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Contact info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("clientDetail.infoSection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {client.email ? (
              <p className="flex items-center gap-2 text-slate-600" dir="ltr">
                <Mail className="size-4 shrink-0 text-slate-400" />
                <span className="truncate">{client.email}</span>
              </p>
            ) : null}
            {client.phone ? (
              <p className="flex items-center gap-2 text-slate-600" dir="ltr">
                <Phone className="size-4 shrink-0 text-slate-400" />
                <span className="truncate">{client.phone}</span>
              </p>
            ) : null}
            {client.address ? (
              <p className="flex items-start gap-2 text-slate-600">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <span>{client.address}</span>
              </p>
            ) : null}
            {!client.email && !client.phone && !client.address && (
              <p className="text-sm text-slate-400">—</p>
            )}
            {client.notes && (
              <>
                <div className="border-t border-slate-100 pt-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <StickyNote className="size-3.5" />
                    {t("clients.notesLabel")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                    {client.notes}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Projects */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="size-4 text-primary" />
              {t("clientDetail.projectsSection")}
              <span className="ms-auto text-xs font-normal text-slate-400">
                {t("clients.projectCount", { count: client.projects.length })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {client.projects.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                {t("clientDetail.noProjects")}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {client.projects.map((project) => (
                  <button
                    key={project.id}
                    className="flex w-full items-center gap-3 py-2.5 text-start transition-colors hover:bg-slate-50"
                    onClick={() => openProject(project.id)}
                    aria-label={`${t("clientDetail.openProject")}: ${project.name}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-700">
                        {project.name}
                      </span>
                      <span className="text-xs text-slate-400" dir="ltr">
                        {formatMoney(project.totalValue, lang)}
                      </span>
                    </span>
                    <ProjectStatusBadge status={project.status} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-4 text-primary" />
            {t("clientDetail.invoicesSection")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {client.invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Receipt className="size-8 text-slate-300" />
              <p className="text-sm text-slate-400">{t("clientDetail.noInvoices")}</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setInvoiceOpen(true)}>
                <Plus className="size-3.5" />
                {t("clientDetail.newInvoiceFor")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("invoices.numberLabel")}</TableHead>
                    <TableHead>{t("invoices.issueDateLabel")}</TableHead>
                    <TableHead>{t("invoices.dueDateLabel")}</TableHead>
                    <TableHead className="text-end">{t("invoices.totalLabel")}</TableHead>
                    <TableHead className="text-end">{t("invoices.paidLabel")}</TableHead>
                    <TableHead>{t("invoices.statusLabel")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.invoices.map((invoice) => {
                    const display = invoiceDisplayState({
                      status: invoice.status,
                      total: invoice.total,
                      amountPaid: invoice.amountPaid,
                      dueDate: invoice.dueDate,
                    });
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium" dir="ltr">
                          {invoice.number}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-500">
                          {formatDate(invoice.issueDate, lang)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-500">
                          {invoice.dueDate ? formatDate(invoice.dueDate, lang) : "—"}
                        </TableCell>
                        <TableCell className="text-end font-medium tabular-nums" dir="ltr">
                          {formatMoney(invoice.total, lang)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums text-emerald-600" dir="ltr">
                          {formatMoney(invoice.amountPaid, lang)}
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={display} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" />
            {t("clientDetail.activitySection")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              {t("clientDetail.noActivity")}
            </p>
          ) : (
            <div className="space-y-2.5">
              {activity.map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary/50" />
                  <span className="min-w-0 flex-1 truncate text-slate-600">
                    {item.label === "__clientCreated"
                      ? t("clientDetail.activityClientCreated")
                      : item.label.startsWith("__project:")
                        ? t("clientDetail.activityProjectCreated", {
                            name: item.label.slice("__project:".length),
                          })
                        : item.label.startsWith("__payment:")
                          ? t("clientDetail.activityPayment", {
                              number: item.label.slice("__payment:".length),
                            })
                          : t("clientDetail.activityInvoiceCreated", {
                              number: item.label.slice("__invoice:".length),
                            })}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDate(item.iso, lang, "d MMM yyyy")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <ClientDialog open={editOpen} onOpenChange={setEditOpen} client={client} />

      {/* New invoice for this client */}
      <InvoiceDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        invoice={null}
        presetClientId={client.id}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clients.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${client.name}" — `}
              {t("clients.deleteConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                deleteClient.mutate(
                  { id: client.id },
                  { onSuccess: onBack },
                );
              }}
            >
              {deleteClient.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Client status chip rendered in the header (avoids import cycle noise). */
function InvoiceStatusBadgeProxy({ status }: { status: "ACTIVE" | "INACTIVE" }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        status === "ACTIVE"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-500",
      )}
    >
      {t(status === "ACTIVE" ? "clients.statusActive" : "clients.statusInactive")}
    </span>
  );
}