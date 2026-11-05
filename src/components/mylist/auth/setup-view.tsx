"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetup } from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { BrandMark } from "@/components/mylist/shell/brand-mark";

export function SetupView() {
  const { t } = useI18n();
  const setup = useSetup();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("fieldRequired");
    if (!email.trim()) next.email = t("fieldRequired");
    if (password.length < 8) next.password = t("auth.passwordHint");
    if (password !== confirm) next.confirm = t("auth.passwordMismatch");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setup.mutate({ name: name.trim(), email: email.trim(), password });
  }

  const features = [t("tasks"), t("projects"), t("calendar"), t("invoices"), t("documents")];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Brand panel (desktop) */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#172554] via-[#1E3A8A] to-[#1D4ED8] p-10 text-white lg:flex">
        <BrandMark size="lg" dark />
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">{t("appName")}</h1>
          <p className="max-w-md text-lg text-blue-100">{t("brandTagline")}</p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-blue-50">
                <CheckCircle2 className="size-5 text-blue-300" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-blue-200/80">{t("auth.secureNote")}</p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-start">
            <div className="lg:hidden">
              <BrandMark size="md" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t("auth.setupTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{t("auth.setupSubtitle")}</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="setup-name">{t("auth.name")}</Label>
              <Input
                id="setup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.namePlaceholder")}
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-email">{t("auth.email")}</Label>
              <Input
                id="setup-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                autoComplete="email"
                required
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-password">{t("auth.password")}</Label>
              <Input
                id="setup-password"
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordHint")}
                autoComplete="new-password"
                required
              />
              {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-confirm">{t("auth.confirmPassword")}</Label>
              <Input
                id="setup-confirm"
                type="password"
                dir="ltr"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
              {errors.confirm && <p className="text-xs text-red-600">{errors.confirm}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={setup.isPending}>
              {setup.isPending && <Loader2 className="size-4 animate-spin" />}
              {setup.isPending ? t("auth.creatingAccount") : t("auth.setupCta")}
            </Button>
            <p className="text-center text-xs text-slate-400">{t("auth.secureNote")}</p>
          </form>
        </div>
      </div>
    </div>
  );
}
