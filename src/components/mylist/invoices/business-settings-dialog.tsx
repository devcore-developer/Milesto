"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
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
import {
  useBusinessSettings,
  useUpdateBusinessSettings,
} from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/types";

const MAX_LOGO_BYTES = 300 * 1024; // 300 KB raw file → ~400 KB as data URL

/**
 * Invoice customization dialog (Phase 5): business branding, logo, tax
 * info, currency, invoice footer and payment instructions — everything the
 * PDF export needs.
 */
export function BusinessSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { data } = useBusinessSettings();
  const update = useUpdateBusinessSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [taxInfo, setTaxInfo] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [invoiceFooter, setInvoiceFooter] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [logoData, setLogoData] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && data?.settings) {
      const s = data.settings;
      setBusinessName(s.businessName);
      setBusinessEmail(s.businessEmail ?? "");
      setBusinessPhone(s.businessPhone ?? "");
      setBusinessAddress(s.businessAddress ?? "");
      setTaxInfo(s.taxInfo ?? "");
      setCurrency(s.currency || DEFAULT_CURRENCY);
      setInvoiceFooter(s.invoiceFooter ?? "");
      setPaymentInstructions(s.paymentInstructions ?? "");
      setLogoData(s.logoData);
      setLogoName(s.logoName);
      setLogoError(false);
      setSaving(false);
    }
  }, [open, data]);

  function pickLogo(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_LOGO_BYTES) {
      setLogoError(true);
      return;
    }
    setLogoError(false);
    const reader = new FileReader();
    reader.onload = () => {
      setLogoData(typeof reader.result === "string" ? reader.result : null);
      setLogoName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function onSave() {
    if (saving || !businessName.trim()) return;
    setSaving(true);
    try {
      await update.mutateAsync({
        businessName: businessName.trim(),
        businessEmail: businessEmail.trim(),
        businessPhone: businessPhone.trim(),
        businessAddress: businessAddress.trim(),
        taxInfo: taxInfo.trim(),
        currency,
        invoiceFooter: invoiceFooter.trim(),
        paymentInstructions: paymentInstructions.trim(),
        logoData,
        logoName,
      });
      onOpenChange(false);
    } catch {
      // toast already shown by hook
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("businessSettings.title")}</DialogTitle>
          <DialogDescription>{t("businessSettings.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {logoData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoData} alt="Logo" className="size-full object-cover" />
              ) : (
                <ImageUp className="size-6 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700">
                {t("businessSettings.logo")}
              </p>
              <p className="text-xs text-slate-400">{t("businessSettings.logoHint")}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageUp className="size-3.5" />
                  {logoData ? t("businessSettings.logoReplace") : t("businessSettings.logoUpload")}
                </Button>
                {logoData && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-red-600 hover:text-red-700"
                    onClick={() => {
                      setLogoData(null);
                      setLogoName(null);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    {t("businessSettings.logoRemove")}
                  </Button>
                )}
              </div>
              {logoError && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {t("businessSettings.logoTooLarge")}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  pickLogo(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bs-name">{t("businessSettings.businessName")} *</Label>
              <Input
                id="bs-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t("businessSettings.businessNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bs-currency">{t("businessSettings.currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="bs-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...CURRENCIES, currency])].map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bs-email">{t("businessSettings.businessEmail")}</Label>
              <Input
                id="bs-email"
                dir="ltr"
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                placeholder="business@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bs-phone">{t("businessSettings.businessPhone")}</Label>
              <Input
                id="bs-phone"
                dir="ltr"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                placeholder="+20 100 000 0000"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bs-address">{t("businessSettings.businessAddress")}</Label>
              <Input
                id="bs-address"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bs-tax">{t("businessSettings.taxInfo")}</Label>
              <Input
                id="bs-tax"
                value={taxInfo}
                onChange={(e) => setTaxInfo(e.target.value)}
                placeholder={t("businessSettings.taxInfoPlaceholder")}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bs-instructions">
                {t("businessSettings.paymentInstructions")}
              </Label>
              <Textarea
                id="bs-instructions"
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                rows={3}
                placeholder={t("businessSettings.paymentInstructionsPlaceholder")}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bs-footer">{t("businessSettings.invoiceFooter")}</Label>
              <Textarea
                id="bs-footer"
                value={invoiceFooter}
                onChange={(e) => setInvoiceFooter(e.target.value)}
                rows={2}
                placeholder={t("businessSettings.invoiceFooterPlaceholder")}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={onSave} disabled={saving || !businessName.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}