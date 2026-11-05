"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { BrandMark } from "@/components/mylist/shell/brand-mark";

export function LoginView() {
  const { t } = useI18n();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    login.mutate({ email: email.trim(), password });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center gap-5 text-center">
            <BrandMark size="md" />
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t("auth.loginTitle")}</h2>
              <p className="mt-1.5 text-sm text-slate-500">{t("auth.loginSubtitle")}</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="login-email">{t("auth.email")}</Label>
              <Input
                id="login-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">{t("auth.password")}</Label>
              <Input
                id="login-password"
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={login.isPending}>
              {login.isPending && <Loader2 className="size-4 animate-spin" />}
              {login.isPending ? t("auth.signingIn") : t("auth.loginCta")}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">{t("auth.secureNote")}</p>
      </div>
    </div>
  );
}
