"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CircleDollarSign,
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
  TrendingUp,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useDeleteInvoice,
  useDeletePayment,
  useInvoices,
  useClients,
  useUpdateInvoice,
} from "@/hooks/use-mylist";
import { invoicePdfUrl } from "@/lib/api-client";
import { formatDate, useI18n } from "@/lib/i18n";
import type { InvoiceDTO, InvoiceStatus } from "@/lib/types";
import {
  formatMoney,
  invoiceDisplayState,
  monthlyFinancials,
  overallFinancials,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
import { InvoiceStatusBadge } from "@/components/mylist/finance/invoice-badge";
import { InvoiceDialog } from "@/components/mylist/finance/invoice-dialog";
import { PaymentDialog } from "@/components/mylist/finance/payment-dialog";
import { MonthlyChart } from "@/components/mylist/finance/monthly-chart";
import { InvoiceDetailDialog } from "@/components/mylist/invoices/invoice-detail-dialog";
import { BusinessSettingsDialog } from "@/components/mylist/invoices/business-settings-dialog";

const ALL = "__all__";
const ALL_CLIENTS = "__clients_all__";

type SortKey = "newest" | "oldest" | "totalDesc" | "totalAsc" | "dueDate" | "number";

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  tone: "blue" | "green" | "red" | "slate";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", toneClass)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-400">{label}</p>
          <p className="truncate text-lg font-bold tabular-nums text-slate-900 sm:text-xl" dir="ltr">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Sort/filter helper — display state is derived per invoice. */
function displayStateOf(invoice: InvoiceDTO): InvoiceStatus {
  return invoiceDisplayState({
    status: invoice.status,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    dueDate: invoice.dueDate,
  });
}

/**
 * Financial dashboard — the overview content (totals, monthly trend,
 * recent payments). Also rendered standalone as the second tab of the
 * invoices view, so it stays exported. `onNew` optionally shows a
 * call-to-action inside the empty state.
 */
export function FinanceDashboard({ onNew }: { onNew?: () => void }) {
  const { t, lang } = useI18n();
  const deletePayment = useDeletePayment();

  const { data } = useInvoices();
  const invoices = useMemo(() => data?.invoices ?? [], [data]);

  const overall = useMemo(() => overallFinancials(invoices), [invoices]);
  const monthly = useMemo(
    () => monthlyFinancials(invoices, 6, lang),
    [invoices, lang],
  );

  // Recent payments across all invoices (newest 6).
  const recentPayments = useMemo(() => {
    const rows = invoices.flatMap((invoice) =>
      invoice.payments.map((payment) => ({ invoice, payment })),
    );
    rows.sort((a, b) => Date.parse(b.payment.paidAt) - Date.parse(a.payment.paidAt));
    return rows.slice(0, 6);
  }, [invoices]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CircleDollarSign}
          label={t("finance.totalRevenue")}
          value={formatMoney(overall.revenue, lang)}
          tone="blue"
        />
        <StatCard
          icon={Wallet}
          label={t("finance.collected")}
          value={formatMoney(overall.collected, lang)}
          tone="green"
        />
        <StatCard
          icon={Banknote}
          label={t("finance.outstanding")}
          value={formatMoney(overall.outstanding, lang)}
          tone={overall.outstanding > 0 ? "red" : "green"}
        />
        <StatCard
          icon={TrendingUp}
          label={t("finance.collectionRate")}
          value={`${overall.collectionRate}%`}
          tone="slate"
        />
      </div>

      {invoices.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <Receipt className="size-8 text-slate-300" />
          <p className="font-medium text-slate-700">{t("finance.noData")}</p>
          <p className="text-sm text-slate-400">{t("finance.noDataHint")}</p>
          {onNew && (
            <Button className="mt-2 gap-2" onClick={onNew}>
              <Plus className="size-4" />
              {t("invoices.newInvoice")}
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("finance.monthlyTrend")}</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyChart data={monthly} />
              </CardContent>
            </Card>

            {/* Monthly table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("finance.monthCol")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("finance.monthCol")}</TableHead>
                        <TableHead className="text-end">{t("finance.legendInvoiced")}</TableHead>
                        <TableHead className="text-end">{t("finance.legendCollected")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...monthly].reverse().map((point) => (
                        <TableRow key={point.key}>
                          <TableCell className="font-medium">{point.label}</TableCell>
                          <TableCell className="text-end tabular-nums" dir="ltr">
                            {formatMoney(point.invoiced, lang)}
                          </TableCell>
                          <TableCell className="text-end tabular-nums text-emerald-600" dir="ltr">
                            {formatMoney(point.collected, lang)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent payments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("finance.recentPayments")}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentPayments.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  {t("finance.noPayments")}
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentPayments.map(({ invoice, payment }) => (
                    <div key={payment.id} className="group flex items-center gap-3 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Wallet className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700" dir="ltr">
                          {formatMoney(payment.amount, lang, invoice.currency)}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {t("payments.for", { number: invoice.number })}
                          {invoice.client ? ` · ${invoice.client.name}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatDate(payment.paidAt, lang)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                        aria-label={t("delete")}
                        onClick={() => deletePayment.mutate({ id: payment.id })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Finance & invoices view (Phase 5) — the complete invoice management
 * surface: financial overview tab, full invoice list (search, status &
 * client filters, sorting, per-invoice currency, remaining balance),
 * read-only detail with payment history, PDF open/download, business
 * branding settings, and the full payment lifecycle.
 */
export function FinanceView() {
  const { t, lang } = useI18n();

  const [dialogOpen, setDialogOpen] = useState(false);
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

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(invoice: InvoiceDTO) {
    setEditing(invoice);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("invoices")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("finance.subtitle")}</p>
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
          <Button className="gap-2" onClick={openNew}>
            <Plus className="size-4" />
            {t("invoices.newInvoice")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t("finance.tabOverview")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("finance.tabInvoices")}</TabsTrigger>
        </TabsList>

        {/* ── Overview tab ── */}
        <TabsContent value="overview" className="space-y-4">
          <FinanceDashboard onNew={openNew} />
        </TabsContent>

        {/* ── Invoices tab ── */}
        <TabsContent value="invoices" className="space-y-4">
          <InvoicesTab
            invoices={invoices}
            clients={clients}
            isLoading={isLoading}
            updatePending={updateInvoice.isPending}
            onNew={openNew}
            onView={setViewing}
            onEdit={openEdit}
            onPay={setPaying}
            onSetStatus={(invoice, status) =>
              updateInvoice.mutate({ id: invoice.id, data: { status } })
            }
            onDelete={setDeleting}
          />
        </TabsContent>
      </Tabs>

      {/* Create / edit invoice */}
      <InvoiceDialog open={dialogOpen} onOpenChange={setDialogOpen} invoice={editing} />

      {/* Read-only detail with payment history & PDF actions */}
      <InvoiceDetailDialog
        invoice={viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={(invoice) => {
          setViewing(null);
          openEdit(invoice);
        }}
        onPay={(invoice) => {
          setViewing(null);
          setPaying(invoice);
        }}
      />

      {/* Record payment */}
      <PaymentDialog invoice={paying} onOpenChange={(o) => !o && setPaying(null)} />

      {/* Business / invoice branding settings */}
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

function InvoicesTab({
  invoices,
  clients,
  isLoading,
  updatePending,
  onNew,
  onView,
  onEdit,
  onPay,
  onSetStatus,
  onDelete,
}: {
  invoices: InvoiceDTO[];
  clients: { id: string; name: string }[];
  isLoading: boolean;
  updatePending: boolean;
  onNew: () => void;
  onView: (invoice: InvoiceDTO) => void;
  onEdit: (invoice: InvoiceDTO) => void;
  onPay: (invoice: InvoiceDTO) => void;
  onSetStatus: (invoice: InvoiceDTO, status: "DRAFT" | "SENT" | "CANCELLED") => void;
  onDelete: (invoice: InvoiceDTO) => void;
}) {
  const { t, lang } = useI18n();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusF, setStatusF] = useState<string>(ALL);
  const [clientF, setClientF] = useState<string>(ALL_CLIENTS);
  const [sortF, setSortF] = useState<SortKey>("newest");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusF !== ALL) {
      list = list.filter((invoice) => displayStateOf(invoice) === statusF);
    }
    if (clientF !== ALL_CLIENTS) {
      list = list.filter((invoice) => invoice.client?.id === clientF);
    }
    if (debounced) {
      const q = debounced;
      list = list.filter(
        (invoice) =>
          invoice.number.toLowerCase().includes(q) ||
          (invoice.client?.name ?? "").toLowerCase().includes(q) ||
          (invoice.client?.company ?? "").toLowerCase().includes(q) ||
          (invoice.project?.name ?? "").toLowerCase().includes(q),
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
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-slate-400"
            aria-label={t("actions")}
            disabled={updatePending}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => onView(invoice)}>
            <Eye className="size-4" />
            {t("invoices.view")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(invoice)}>
            {t("edit")}
          </DropdownMenuItem>
          {invoice.status !== "DRAFT" &&
            invoice.status !== "CANCELLED" &&
            invoice.remaining > 0 && (
              <DropdownMenuItem onClick={() => onPay(invoice)}>
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
            <DropdownMenuItem onClick={() => onSetStatus(invoice, "SENT")}>
              {t("invoices.markSent")}
            </DropdownMenuItem>
          )}
          {invoice.status === "SENT" && (
            <DropdownMenuItem onClick={() => onSetStatus(invoice, "DRAFT")}>
              {t("invoices.markDraft")}
            </DropdownMenuItem>
          )}
          {invoice.status !== "CANCELLED" ? (
            <DropdownMenuItem onClick={() => onSetStatus(invoice, "CANCELLED")}>
              {t("invoices.markCancelled")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onSetStatus(invoice, "SENT")}>
              {t("invoices.markSent")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => onDelete(invoice)}
          >
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
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
              <SelectItem value={ALL_CLIENTS}>{t("invoices.filterAllClients")}</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
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
            {hasFilters ? t("invoices.emptyFilteredSubtitle") : t("invoices.emptySubtitle")}
          </p>
          {!hasFilters && (
            <Button className="mt-2 gap-2" onClick={onNew}>
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
                        onClick={() => onView(invoice)}
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
                  onClick={() => onView(invoice)}
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
                      <p className="text-[10px] text-slate-400">{t("invoices.dueDateLabel")}</p>
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
    </>
  );
}