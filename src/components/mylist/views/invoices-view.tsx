"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  Settings2,
  Trash2,
  Wallet,
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
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useClients,
  useDeleteInvoice,
  useInvoices,
  useUpdateInvoice,
} from "@/hooks/use-mylist";
import { invoicePdfUrl } from "@/lib/api-client";
import { formatDate, useI18n } from "@/lib/i18n";
import { formatMoney, invoiceDisplayState } from "@/lib/finance";
import type { InvoiceDTO, InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { InvoiceStatusBadge } from "@/components/mylist/finance/invoice-badge";
import { InvoiceDialog } from "@/components/mylist/finance/invoice-dialog";
import { PaymentDialog } from "@/components/mylist/finance/payment-dialog";
import { FinanceDashboard } from "@/components/mylist/views/finance-view";
import { InvoiceDetailDialog } from "@/components/mylist/invoices/invoice-detail-dialog";
import { BusinessSettingsDialog } from "@/components/mylist/invoices/business-settings-dialog";

const ALL = "__all__";
const ALL_CLIENTS = "__clients_all__";

type SortKey = "newest" | "oldest" | "totalDesc" | "totalAsc" | "dueDate" | "number";

function displayStateOf(invoice: InvoiceDTO): InvoiceStatus {
  return invoiceDisplayState({
    status: invoice.status,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    dueDate: invoice.dueDate,
  });
}

/**
 * Invoices view (Phase 5): complete invoice management — search, status &
 * client filters, sorting, a detailed read-only view with payment history,
 * PDF open/download, and the financial dashboard as a second tab.
 */
export function InvoicesView() {
  const { t, lang } = useI18n();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusF, setStatusF] = useState<string>(ALL);
  const [clientF, setClientF] = useState<string>(ALL_CLIENTS);
  const [sortF, setSortF] = useState<SortKey>("newest");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceDTO | null>(null);
  const [paying, setPaying] = useState<InvoiceDTO | null>(null);
  const [viewing, setViewing] = useState<InvoiceDTO | null>(null);
  const [deleting, setDeleting] = useState<InvoiceDTO | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();

  const { data, isLoading } = useInvoices();
  const invoices = useMemo(() => data?.invoices ?? [], [data]);
  const { data: clientsData } = useClients();
  const clients = useMemo(() => clientsData?.clients ?? [], [clientsData]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusF !== ALL) list = list.filter((inv) => displayStateOf(inv) === statusF);
    if (clientF !== ALL_CLIENTS) list = list.filter((inv) => inv.client?.id === clientF);
    if (debounced) {
      const q = debounced;
      list = list.filter(
        (inv) =>
          inv.number.toLowerCase().includes(q) ||
          (inv.client?.name ?? "").toLowerCase().includes(q) ||
          (inv.client?.company ?? "").toLowerCase().includes(q) ||
          (inv.project?.name ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    switch (sortF) {
      case "oldest":
        sorted.sort((a, b) => Date.parse(a.issueDate) - Date.parse(b.issueDate));
        break;
      case "totalDesc":
        sorted.sort((a, b) => b.total - a.total);
        break;
      case "totalAsc":
        sorted.sort((a, b) => a.total - b.total);
        break;
      case "dueDate": {
        sorted.sort((a, b) => {
          const av = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
          const bv = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
          return av - bv;
        });
        break;
      }
      case "number":
        sorted.sort((a, b) => a.number.localeCompare(b.number));
        break;
      default:
        // newest — API order already (issueDate desc)
        sorted.sort((a, b) => Date.parse(b.issueDate) - Date.parse(a.issueDate));
    }
    return sorted;
  }, [invoices, statusF, clientF, debounced, sortF]);

  const hasFilters = !!debounced || statusF !== ALL || clientF !== ALL_CLIENTS;

  const statusOptions: { value: string; label: string }[] = [
    { value: ALL, label: t("invoices.filterAll") },
    { value: "DRAFT", label: t("invoices.statusDraft") },
    { value: "SENT", label: t("invoices.statusSent") },
    { value: "PARTIALLY_PAID", label: t("invoices.statusPartiallyPaid") },
    { value: "PAID", label: t("invoices.statusPaid") },
    { value: "OVERDUE", label: t("invoices.statusOverdue") },
    { value: "CANCELLED", label: t("invoices.statusCancelled") },
  ];

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "newest", label: t("invoices.sortNewest") },
    { value: "oldest", label: t("invoices.sortOldest") },
    { value: "totalDesc", label: t("invoices.sortTotalDesc") },
    { value: "totalAsc", label: t("invoices.sortTotalAsc") },
    { value: "dueDate", label: t("invoices.sortDueDate") },
    { value: "number", label: t("invoices.sortNumber") },
  ];

  function RowActions({ invoice }: { invoice: InvoiceDTO }) {
    const canPay =
      invoice.status !== "DRAFT" &&
      invoice.status !== "CANCELLED" &&
      invoice.remaining > 0;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-slate-400"
            aria-label={t("actions")}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setViewing(invoice)}>
            <Eye className="size-4" />
            {t("invoices.view")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(invoice)}>
            {t("edit")}
          </DropdownMenuItem>
          {canPay && (
            <DropdownMenuItem onClick={() => setPaying(invoice)}>
              <Wallet className="size-4" />
              {t("payments.record")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href={invoicePdfUrl(invoice.id, lang)} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              {t("invoices.pdfOpen")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={invoicePdfUrl(invoice.id, lang, true)} download>
              <Download className="size-4" />
              {t("invoices.pdfDownload")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {invoice.status === "DRAFT" && (
            <DropdownMenuItem
              onClick={() => updateInvoice.mutate({ id: invoice.id, data: { status: "SENT" } })}
            >
              {t("invoices.markSent")}
            </DropdownMenuItem>
          )}
          {invoice.status === "SENT" && (
            <DropdownMenuItem
              onClick={() => updateInvoice.mutate({ id: invoice.id, data: { status: "DRAFT" } })}
            >
              {t("invoices.markDraft")}
            </DropdownMenuItem>
          )}
          {invoice.status !== "CANCELLED" ? (
            <DropdownMenuItem
              onClick={() =>
                updateInvoice.mutate({ id: invoice.id, data: { status: "CANCELLED" } })
              }
            >
              {t("invoices.markCancelled")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => updateInvoice.mutate({ id: invoice.id, data: { status: "SENT" } })}
            >
              {t("invoices.markSent")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => setDeleting(invoice)}
          >
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function onEdit(invoice: InvoiceDTO) {
    setEditing(invoice);
    setEditorOpen(true);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("invoices")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("invoices.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("businessSettings.title")}
            title={t("businessSettings.title")}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-4" />
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="size-4" />
            {t("invoices.newInvoice")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">{t("finance.tabInvoices")}</TabsTrigger>
          <TabsTrigger value="dashboard">{t("finance.tabOverview")}</TabsTrigger>
        </TabsList>

        {/* ── Invoices tab ── */}
        <TabsContent value="invoices" className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("invoices.searchPlaceholder")}
                className="h-9 ps-9"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:w-auto">
              <Select value={statusF} onValueChange={setStatusF}>
                <SelectTrigger className="h-9 w-full lg:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={clientF} onValueChange={setClientF}>
                <SelectTrigger className="h-9 w-full lg:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CLIENTS}>
                    {t("invoices.filterAllClients")}
                  </SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortF} onValueChange={(v) => setSortF(v as SortKey)}>
                <SelectTrigger className="h-9 w-full lg:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-12 text-center">
              <Receipt className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">
                {hasFilters ? t("invoices.emptyFilteredTitle") : t("invoices.emptyTitle")}
              </p>
              <p className="text-sm text-slate-400">
                {hasFilters
                  ? t("invoices.emptyFilteredSubtitle")
                  : t("invoices.emptySubtitle")}
              </p>
              {!hasFilters && (
                <Button
                  className="mt-2 gap-2"
                  onClick={() => {
                    setEditing(null);
                    setEditorOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  {t("invoices.newInvoice")}
                </Button>
              )}
            </Card>
          ) : (
            <>
              {/* Desktop table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("invoices.numberLabel")}</TableHead>
                        <TableHead>{t("invoices.clientLabel")}</TableHead>
                        <TableHead>{t("invoices.issueDateLabel")}</TableHead>
                        <TableHead>{t("invoices.dueDateLabel")}</TableHead>
                        <TableHead className="text-end">{t("invoices.totalLabel")}</TableHead>
                        <TableHead className="text-end">{t("invoices.paidLabel")}</TableHead>
                        <TableHead className="text-end">{t("invoices.remainingLabel")}</TableHead>
                        <TableHead>{t("invoices.statusLabel")}</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((invoice) => {
                        const display = displayStateOf(invoice);
                        return (
                          <TableRow
                            key={invoice.id}
                            className="cursor-pointer"
                            onClick={() => setViewing(invoice)}
                          >
                            <TableCell className="font-medium" dir="ltr">
                              {invoice.number}
                            </TableCell>
                            <TableCell>
                              <span className="block max-w-40 truncate text-sm">
                                {invoice.client?.name ?? t("invoices.noClient")}
                              </span>
                              {invoice.project && (
                                <span className="block max-w-40 truncate text-xs text-slate-400">
                                  {invoice.project.name}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-slate-500">
                              {formatDate(invoice.issueDate, lang)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-slate-500">
                              {invoice.dueDate ? formatDate(invoice.dueDate, lang) : "—"}
                            </TableCell>
                            <TableCell className="text-end font-medium tabular-nums" dir="ltr">
                              {formatMoney(invoice.total, lang, invoice.currency)}
                            </TableCell>
                            <TableCell className="text-end tabular-nums" dir="ltr">
                              <span
                                className={cn(
                                  invoice.remaining > 0 ? "text-amber-600" : "text-emerald-600",
                                )}
                              >
                                {formatMoney(invoice.amountPaid, lang, invoice.currency)}
                              </span>
                            </TableCell>
                            <TableCell className="text-end tabular-nums" dir="ltr">
                              <span
                                className={cn(
                                  invoice.remaining > 0 ? "text-slate-700" : "text-emerald-600",
                                )}
                              >
                                {formatMoney(invoice.remaining, lang, invoice.currency)}
                              </span>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <InvoiceStatusBadge status={display} />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <RowActions invoice={invoice} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map((invoice) => {
                  const display = displayStateOf(invoice);
                  return (
                    <Card
                      key={invoice.id}
                      className="space-y-3 p-4"
                      onClick={() => setViewing(invoice)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900" dir="ltr">
                            {invoice.number}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {invoice.client?.name ?? t("invoices.noClient")}
                            {invoice.project ? ` · ${invoice.project.name}` : ""}
                          </p>
                        </div>
                        <InvoiceStatusBadge status={display} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400">{t("invoices.totalLabel")}</p>
                          <p className="font-semibold tabular-nums text-slate-700" dir="ltr">
                            {formatMoney(invoice.total, lang, invoice.currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">
                            {t("invoices.remainingLabel")}
                          </p>
                          <p
                            className={cn(
                              "font-semibold tabular-nums",
                              invoice.remaining > 0 ? "text-amber-600" : "text-emerald-600",
                            )}
                            dir="ltr"
                          >
                            {formatMoney(invoice.remaining, lang, invoice.currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">{t("invoices.paidLabel")}</p>
                          <p className="font-semibold tabular-nums text-emerald-600" dir="ltr">
                            {formatMoney(invoice.amountPaid, lang, invoice.currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">
                            {t("invoices.dueDateLabel")}
                          </p>
                          <p className="font-medium text-slate-600">
                            {invoice.dueDate ? formatDate(invoice.dueDate, lang) : "—"}
                          </p>
                        </div>
                      </div>
                      <div
                        className="flex items-center justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs text-slate-400">
                          {t("invoices.issueDateLabel")}: {formatDate(invoice.issueDate, lang)}
                        </span>
                        <RowActions invoice={invoice} />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Financial dashboard tab ── */}
        <TabsContent value="dashboard">
          <FinanceDashboard />
        </TabsContent>
      </Tabs>

      {/* Create / edit invoice */}
      <InvoiceDialog open={editorOpen} onOpenChange={setEditorOpen} invoice={editing} />

      {/* Read-only detail with payment history & PDF actions */}
      <InvoiceDetailDialog
        invoice={viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={(invoice) => {
          setViewing(null);
          onEdit(invoice);
        }}
        onPay={(invoice) => {
          setViewing(null);
          setPaying(invoice);
        }}
      />

      {/* Record payment */}
      <PaymentDialog invoice={paying} onOpenChange={(o) => !o && setPaying(null)} />

      {/* Business / invoice settings */}
      <BusinessSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("invoices.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.number && `"${deleting.number}" — `}
              {t("invoices.deleteConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleting) deleteInvoice.mutate({ id: deleting.id });
                setDeleting(null);
              }}
            >
              {deleteInvoice.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}