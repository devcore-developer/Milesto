"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useClients, useCreateProject, useUpdateProject } from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { formatMoney, projectTotalValue } from "@/lib/finance";
import {
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  type ProjectDTO,
  type ProjectStatus,
  type TaskPriority,
} from "@/lib/types";
import {
  PRIORITY_COLORS,
  priorityLabelKeyFor,
  projectStatusLabelKey,
} from "@/components/mylist/project/badges";

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function fromDateInput(value: string): string | null {
  return value ? `${value}T12:00:00.000Z` : null;
}

const NONE = "__none__";

/** Money text field state → number for the API ("", "1,200" → 1200). */
function toMoney(value: string): number {
  const n = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectDTO | null;
}) {
  const { t, lang } = useI18n();
  const isEdit = !!project;

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { data: clientsData } = useClients();
  const clients = clientsData?.clients ?? [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PLANNING");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState<string>(NONE);
  const [agreedPrice, setAgreedPrice] = useState("");
  const [additionalCharges, setAdditionalCharges] = useState("");
  const [discount, setDiscount] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setStatus(project?.status ?? "PLANNING");
      setPriority(project?.priority ?? "MEDIUM");
      setStartDate(toDateInput(project?.startDate));
      setDeadline(toDateInput(project?.deadline));
      setDeliveryDate(toDateInput(project?.deliveryDate));
      setNotes(project?.notes ?? "");
      setClientId(project?.client?.id ?? NONE);
      setAgreedPrice(project?.agreedPrice ? String(project.agreedPrice) : "");
      setAdditionalCharges(
        project?.additionalCharges ? String(project.additionalCharges) : "",
      );
      setDiscount(project?.discount ? String(project.discount) : "");
      setAdditionalNotes(project?.additionalNotes ?? "");
      setSaving(false);
    }
  }, [open, project]);

  // Live financial preview (mirrors server-side math).
  const preview = useMemo(() => {
    const agreed = toMoney(agreedPrice);
    const additional = toMoney(additionalCharges);
    const disc = toMoney(discount);
    return {
      total: projectTotalValue({ agreedPrice: agreed, additionalCharges: additional, discount: disc }),
    };
  }, [agreedPrice, additionalCharges, discount]);

  async function onSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      status,
      priority,
      startDate: fromDateInput(startDate),
      deadline: fromDateInput(deadline),
      deliveryDate: fromDateInput(deliveryDate),
      notes: notes.trim() ? notes.trim() : null,
      // ── Financials & client link (Phase 4) ──
      clientId: clientId === NONE ? null : clientId,
      agreedPrice: toMoney(agreedPrice),
      additionalCharges: toMoney(additionalCharges),
      discount: toMoney(discount),
      additionalNotes: additionalNotes.trim() ? additionalNotes.trim() : null,
    };
    try {
      if (isEdit && project) {
        await updateProject.mutateAsync({ id: project.id, data: payload });
      } else {
        await createProject.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // toast already shown by hook
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("projects.editProject") : t("projects.newProject")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? t("projects.editProject") : t("projects.newProject")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">{t("projects.nameLabel")}</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projects.namePlaceholder")}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-desc">{t("projects.descriptionLabel")}</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("projects.descriptionPlaceholder")}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("projects.statusLabel")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(projectStatusLabelKey(s))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("projects.priorityLabel")}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: PRIORITY_COLORS[p] }}
                        />
                        {t(priorityLabelKeyFor(p))}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="project-start">{t("projects.startDateLabel")}</Label>
              <Input
                id="project-start"
                type="date"
                dir="ltr"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-deadline">{t("projects.deadlineLabel")}</Label>
              <Input
                id="project-deadline"
                type="date"
                dir="ltr"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-delivery">{t("projects.deliveryDateLabel")}</Label>
            <Input
              id="project-delivery"
              type="date"
              dir="ltr"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>

          {/* ── Client & financials (Phase 4) ── */}
          <Separator />

          <div className="space-y-2">
            <Label>{t("projects.clientLabel")}</Label>
            <Select value={clientId} onValueChange={(v) => setClientId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("projects.clientNone")}</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company ? `${c.name} — ${c.company}` : c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="project-price">{t("finance.agreedPrice")}</Label>
              <Input
                id="project-price"
                inputMode="decimal"
                dir="ltr"
                className="tabular-nums"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-additional">{t("finance.additionalCharges")}</Label>
              <Input
                id="project-additional"
                inputMode="decimal"
                dir="ltr"
                className="tabular-nums"
                value={additionalCharges}
                onChange={(e) => setAdditionalCharges(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-discount">{t("finance.discount")}</Label>
              <Input
                id="project-discount"
                inputMode="decimal"
                dir="ltr"
                className="tabular-nums"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-additional-notes">
              {t("finance.additionalNotes")}
            </Label>
            <Textarea
              id="project-additional-notes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">
              {t("finance.projectTotal")}
            </span>
            <span className="text-lg font-bold tabular-nums text-primary" dir="ltr">
              {formatMoney(preview.total, lang)}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-notes">{t("projects.notesLabel")}</Label>
            <Textarea
              id="project-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("projects.notesPlaceholder")}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={onSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}