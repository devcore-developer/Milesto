"use client";

import { useMemo, useState } from "react";
import {
  Download,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
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
import {
  useClients,
  useDeleteDocument,
  useDocuments,
} from "@/hooks/use-mylist";
import { documentPdfUrl } from "@/lib/api-client";
import { formatDate, useI18n } from "@/lib/i18n";
import { printPdfUrl } from "@/lib/print-client";
import type { DocumentRecordDTO } from "@/lib/types";
import { DocTypeBadge } from "@/components/mylist/documents/doc-type-badge";
import { DocumentDialog } from "@/components/mylist/documents/document-dialog";
import { DocumentEditor } from "@/components/mylist/documents/document-editor";

const ALL = "__all__";

/**
 * Documents view (Phase 6): saved document history with search, type and
 * client filters; every document can be edited, previewed, downloaded as a
 * premium PDF, printed directly, or deleted.
 */
export function DocumentsView() {
  const { t, lang } = useI18n();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentRecordDTO | null>(null);
  const [deleting, setDeleting] = useState<DocumentRecordDTO | null>(null);

  const [q, setQ] = useState("");
  const [type, setType] = useState<string>(ALL);
  const [clientFilter, setClientFilter] = useState<string>(ALL);

  const deleteDocument = useDeleteDocument();

  const filters = useMemo(
    () => ({
      q: q.trim() || undefined,
      type: type === ALL ? undefined : type,
      clientId: clientFilter === ALL ? undefined : clientFilter,
    }),
    [q, type, clientFilter],
  );
  const { data, isLoading } = useDocuments(filters);
  const documents = useMemo(() => data?.documents ?? [], [data]);

  const { data: clientsData } = useClients();
  const clients = clientsData?.clients ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("documents")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("documents.subtitle")}</p>
        </div>
        <Button className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          {t("documents.newDocument")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("documents.searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("documents.filterAllTypes")}</SelectItem>
            <SelectItem value="SCOPE_OF_WORK">{t("documents.typeSow")}</SelectItem>
            <SelectItem value="COMPLETION_REPORT">
              {t("documents.typeCompletion")}
            </SelectItem>
            <SelectItem value="PROGRESS_REPORT">
              {t("documents.typeProgress")}
            </SelectItem>
            <SelectItem value="CUSTOM_REPORT">
              {t("documents.typeCustom")}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("documents.filterAllClients")}</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="size-7 text-primary" />
            </div>
            {q || type !== ALL || clientFilter !== ALL ? (
              <>
                <h3 className="text-lg font-semibold text-slate-900">
                  {t("documents.emptyFilteredTitle")}
                </h3>
                <p className="text-sm text-slate-500">
                  {t("documents.emptyFilteredSubtitle")}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-900">
                  {t("documents.emptyTitle")}
                </h3>
                <p className="text-sm text-slate-500">
                  {t("documents.emptySubtitle")}
                </p>
                <Button className="mt-1 gap-1.5" onClick={() => setDialogOpen(true)}>
                  <Plus className="size-4" />
                  {t("documents.newDocument")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-36">{t("documents.colNumber")}</TableHead>
                  <TableHead>{t("documents.colTitle")}</TableHead>
                  <TableHead className="w-40">{t("documents.colClient")}</TableHead>
                  <TableHead className="w-40">{t("documents.colProject")}</TableHead>
                  <TableHead className="w-28">{t("documents.colDate")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer"
                    onClick={() => setEditing(doc)}
                  >
                    <TableCell dir="ltr" className="font-medium tabular-nums text-slate-500">
                      {doc.number}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate font-medium text-slate-900">
                          {doc.title}
                        </span>
                        <span className="w-fit">
                          <DocTypeBadge type={doc.type} />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {doc.client?.name ?? <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {doc.project?.name ?? <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {formatDate(doc.issueDate, lang)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        doc={doc}
                        onEdit={() => setEditing(doc)}
                        onDelete={() => setDeleting(doc)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="cursor-pointer p-4 transition-colors hover:border-blue-200"
                onClick={() => setEditing(doc)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-semibold text-slate-900">{doc.title}</p>
                    <p className="text-xs tabular-nums text-slate-400" dir="ltr">
                      {doc.number} · {formatDate(doc.issueDate, lang)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <DocTypeBadge type={doc.type} />
                      {doc.client && (
                        <span className="text-xs text-slate-500">{doc.client.name}</span>
                      )}
                      {doc.project && (
                        <span className="text-xs text-slate-400">· {doc.project.name}</span>
                      )}
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      doc={doc}
                      onEdit={() => setEditing(doc)}
                      onDelete={() => setDeleting(doc)}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create dialog */}
      <DocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(doc) => setEditing(doc)}
      />

      {/* Editor */}
      <DocumentEditor document={editing} onOpenChange={(o) => !o && setEditing(null)} />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("documents.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("documents.deleteConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleting) deleteDocument.mutate({ id: deleting.id });
                setDeleting(null);
              }}
            >
              {deleteDocument.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Row actions: edit / download PDF / print / delete. */
function RowMenu({
  doc,
  onEdit,
  onDelete,
}: {
  doc: DocumentRecordDTO;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, lang } = useI18n();
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
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem className="gap-2" onClick={onEdit}>
          <Pencil className="size-3.5" />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" asChild>
          <a href={documentPdfUrl(doc.id, true)} download>
            <Download className="size-3.5" />
            {t("documents.downloadPdf")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          onClick={() => printPdfUrl(documentPdfUrl(doc.id))}
        >
          <Printer className="size-3.5" />
          {t("documents.print")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-red-600 focus:text-red-600"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}