"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Users,
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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients, useDeleteClient } from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import type { ClientDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/finance";
import { ClientDialog } from "@/components/mylist/client/client-dialog";
import { ClientDetailView } from "@/components/mylist/client/client-detail-view";

const ALL = "__all__";
const OUTSTANDING = "__outstanding__";

type StatusFilter = typeof ALL | "ACTIVE" | "INACTIVE" | typeof OUTSTANDING;

function ClientStatusBadge({ status }: { status: "ACTIVE" | "INACTIVE" }) {
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

function ClientCard({
  client,
  onOpen,
  onEdit,
  onDelete,
}: {
  client: ClientDTO;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, lang } = useI18n();
  const { financials } = client;

  return (
    <Card
      className="group cursor-pointer p-4 transition-shadow hover:shadow-md"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${t("clients.nameLabel")}: ${client.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900">{client.name}</h3>
            {client.company && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                <Building2 className="size-3 shrink-0" />
                {client.company}
              </p>
            )}
          </div>
        </div>
        <ClientStatusBadge status={client.status} />
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        {client.email && (
          <p className="flex items-center gap-1.5" dir="ltr">
            <Mail className="size-3 shrink-0 text-slate-400" />
            <span className="truncate">{client.email}</span>
          </p>
        )}
        {client.phone && (
          <p className="flex items-center gap-1.5" dir="ltr">
            <Phone className="size-3 shrink-0 text-slate-400" />
            <span className="truncate">{client.phone}</span>
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
        <div>
          <p className="text-[10px] font-medium text-slate-400">
            {t("clients.projectCount", { count: client.projectCount })}
          </p>
          <p className="font-semibold tabular-nums text-slate-700" dir="ltr">
            {formatMoney(financials.projectValue, lang)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-slate-400">
            {t("clients.invoiceCount", { count: client.invoiceCount })}
          </p>
          <p
            className={cn(
              "font-semibold tabular-nums",
              financials.outstanding > 0 ? "text-red-600" : "text-emerald-600",
            )}
            dir="ltr"
          >
            {formatMoney(financials.outstanding, lang)}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-slate-500 hover:text-primary"
          onClick={onEdit}
        >
          {t("edit")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-slate-500 hover:text-red-600"
          onClick={onDelete}
        >
          {t("delete")}
        </Button>
      </div>
    </Card>
  );
}

export function ClientsView() {
  const { t } = useI18n();
  const deleteClient = useDeleteClient();

  // Detail page state (kept local — back returns to the list)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (selectedId) {
    return (
      <ClientDetailView
        clientId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <ClientsList
      onOpenClient={setSelectedId}
      onDelete={(client) => deleteClient.mutate({ id: client.id })}
      deletePending={deleteClient.isPending}
    />
  );
}

function ClientsList({
  onOpenClient,
  onDelete,
  deletePending,
}: {
  onOpenClient: (id: string) => void;
  onDelete: (client: ClientDTO) => void;
  deletePending: boolean;
}) {
  const { t } = useI18n();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDTO | null>(null);
  const [deleting, setDeleting] = useState<ClientDTO | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusF, setStatusF] = useState<StatusFilter>(ALL);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading } = useClients({
    q: debounced || undefined,
    status: statusF === "ACTIVE" || statusF === "INACTIVE" ? statusF : undefined,
  });

  const clients = useMemo(() => {
    const list = data?.clients ?? [];
    return statusF === OUTSTANDING
      ? list.filter((c) => c.financials.outstanding > 0)
      : list;
  }, [data, statusF]);

  // Chips count from the unfiltered list for stability.
  const { data: allData } = useClients();
  const all = allData?.clients ?? [];
  const stats = {
    total: all.length,
    active: all.filter((c) => c.status === "ACTIVE").length,
    inactive: all.filter((c) => c.status === "INACTIVE").length,
    outstanding: all.filter((c) => c.financials.outstanding > 0).length,
  };

  const chips: { key: StatusFilter; label: string; count: number; tone: string }[] = [
    { key: ALL, label: t("clients.filterAll"), count: stats.total, tone: "bg-blue-50 text-blue-700" },
    { key: "ACTIVE", label: t("clients.filterActive"), count: stats.active, tone: "bg-emerald-50 text-emerald-700" },
    { key: "INACTIVE", label: t("clients.filterInactive"), count: stats.inactive, tone: "bg-slate-100 text-slate-600" },
    { key: OUTSTANDING, label: t("clients.filterOutstanding"), count: stats.outstanding, tone: "bg-red-50 text-red-700" },
  ];

  const hasFilters = !!debounced || statusF !== ALL;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("clients")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("clients.subtitle")}</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          {t("clients.newClient")}
        </Button>
      </div>

      {/* Stats chips */}
      {stats.total > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => setStatusF(statusF === chip.key ? ALL : chip.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-transform hover:opacity-80 active:scale-95",
                  chip.tone,
                  statusF === chip.key && "ring-2 ring-primary/40",
                )}
              >
                {chip.label}
                <span className="font-bold">{chip.count}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("clients.searchPlaceholder")}
            className="h-9 ps-9"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <Users className="size-8 text-slate-300" />
          <p className="font-medium text-slate-700">
            {hasFilters ? t("clients.emptyFilteredTitle") : t("clients.emptyTitle")}
          </p>
          <p className="text-sm text-slate-400">
            {hasFilters ? t("clients.emptyFilteredSubtitle") : t("clients.emptySubtitle")}
          </p>
          {!hasFilters && (
            <Button
              className="mt-2 gap-2"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("clients.newClient")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              onOpen={() => onOpenClient(c.id)}
              onEdit={() => {
                setEditing(c);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleting(c)}
            />
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <ClientDialog open={dialogOpen} onOpenChange={setDialogOpen} client={editing} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clients.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name && `"${deleting.name}" — `}
              {t("clients.deleteConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleting) onDelete(deleting);
                setDeleting(null);
              }}
            >
              {deletePending && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}