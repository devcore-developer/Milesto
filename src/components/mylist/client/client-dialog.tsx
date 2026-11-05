"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useCreateClient, useUpdateClient } from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { CLIENT_STATUSES, type ClientDTO, type ClientStatus } from "@/lib/types";

/** Shared dialog for creating & editing clients. */
export function ClientDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientDTO | null;
}) {
  const { t } = useI18n();
  const isEdit = !!client;

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ClientStatus>("ACTIVE");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(client?.name ?? "");
      setCompany(client?.company ?? "");
      setEmail(client?.email ?? "");
      setPhone(client?.phone ?? "");
      setAddress(client?.address ?? "");
      setNotes(client?.notes ?? "");
      setStatus(client?.status ?? "ACTIVE");
      setSaving(false);
    }
  }, [open, client]);

  async function onSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      company: company.trim() ? company.trim() : null,
      email: email.trim() ? email.trim() : null,
      phone: phone.trim() ? phone.trim() : null,
      address: address.trim() ? address.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      status,
    };
    try {
      if (isEdit && client) {
        await updateClient.mutateAsync({ id: client.id, data: payload });
      } else {
        await createClient.mutateAsync(payload);
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
            {isEdit ? t("clients.editClient") : t("clients.newClient")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? t("clients.editClient") : t("clients.newClient")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">{t("clients.nameLabel")}</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("clients.namePlaceholder")}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client-company">{t("clients.companyLabel")}</Label>
              <Input
                id="client-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t("clients.companyPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-status">{t("clients.statusLabel")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(s === "ACTIVE" ? "clients.statusActive" : "clients.statusInactive")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client-email">{t("clients.emailLabel")}</Label>
              <Input
                id="client-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("clients.emailPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-phone">{t("clients.phoneLabel")}</Label>
              <Input
                id="client-phone"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("clients.phonePlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-address">{t("clients.addressLabel")}</Label>
            <Input
              id="client-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("clients.addressPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-notes">{t("clients.notesLabel")}</Label>
            <Textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("clients.notesPlaceholder")}
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