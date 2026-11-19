"use client";

import { useState } from "react";
import {
  Bell,
  Bot,
  Check,
  Globe,
  Info,
  Loader2,
  Lock,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAIStatus,
  useChangePassword,
  useTestAIConnection,
  useUpdateProfile,
} from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import { useUIStore } from "@/lib/store";
import type { ReminderSettings } from "@/lib/notifications";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const REMINDER_DAY_OPTIONS = [0, 1, 3, 7, 14] as const;

const REMINDER_DAY_KEY: Record<number, TranslationKey> = {
  0: "notifications.days0",
  1: "notifications.days1",
  3: "notifications.days3",
  7: "notifications.days7",
  14: "notifications.days14",
};

// ── AI provider panel (Phase A1) ──
const AI_CAPABILITIES = [
  { name: "chat" as const, labelKey: "ai.capChat" as TranslationKey },
  { name: "vision" as const, labelKey: "ai.capVision" as TranslationKey },
  { name: "stt" as const, labelKey: "ai.capStt" as TranslationKey },
];

const AI_PROBE_ERROR_KEY: Record<string, TranslationKey> = {
  AI_AUTH: "ai.errorAuth",
  AI_PROVIDER_RATE_LIMIT: "ai.errorRateLimit",
  AI_RATE_LIMITED: "ai.errorRateLimit",
  AI_TIMEOUT: "ai.errorTimeout",
  AI_NETWORK: "ai.errorNetwork",
  AI_PROVIDER_ERROR: "ai.errorProvider",
  AI_BAD_RESPONSE: "ai.errorProvider",
};

function probeMessage(
  probe: { ok: boolean; latencyMs?: number; error?: string },
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): { ok: boolean; text: string } {
  if (probe.ok) {
    return { ok: true, text: t("ai.testOk", { ms: probe.latencyMs ?? 0 }) };
  }
  const key = AI_PROBE_ERROR_KEY[probe.error ?? ""] ?? "ai.errorProvider";
  return { ok: false, text: t("ai.testFailed", { error: t(key) }) };
}

export function SettingsView({ user }: { user: AuthUser }) {
  const { t, lang, setLang } = useI18n();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const ai = useAIStatus();
  const testConnection = useTestAIConnection();
  const probe =
    testConnection.data?.probe != null
      ? probeMessage(testConnection.data.probe, t)
      : null;

  const [name, setName] = useState(user.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");

  const reminderSettings = useUIStore((s) => s.reminderSettings);
  const setReminderSettings = useUIStore((s) => s.setReminderSettings);

  function updateReminders(patch: Partial<ReminderSettings>) {
    setReminderSettings({ ...reminderSettings, ...patch }, { sync: true });
  }

  function saveProfile() {
    if (!name.trim()) return;
    updateProfile.mutate({ name: name.trim() });
  }

  function savePassword() {
    setPwError("");
    if (newPassword.length < 8) {
      setPwError(t("auth.passwordHint"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t("auth.passwordMismatch"));
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("brandTagline")}</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4.5 text-primary" />
            {t("settings.profileSection")}
          </CardTitle>
          <CardDescription>{t("settings.profileSectionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">{t("settings.displayName")}</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("auth.namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-email">{t("settings.emailReadonly")}</Label>
            <Input id="settings-email" value={user.email} dir="ltr" disabled />
          </div>
          <Button onClick={saveProfile} disabled={!name.trim() || name.trim() === user.name || updateProfile.isPending}>
            {updateProfile.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("settings.saveProfile")}
          </Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4.5 text-primary" />
            {t("settings.securitySection")}
          </CardTitle>
          <CardDescription>{t("settings.securitySectionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-current">{t("settings.currentPassword")}</Label>
            <Input
              id="settings-current"
              type="password"
              dir="ltr"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-new">{t("settings.newPassword")}</Label>
              <Input
                id="settings-new"
                type="password"
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("settings.passwordMinHint")}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-confirm">{t("auth.confirmPassword")}</Label>
              <Input
                id="settings-confirm"
                type="password"
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          {pwError && <p className="text-xs text-red-600">{pwError}</p>}
          <Button
            onClick={savePassword}
            disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}
          >
            {changePassword.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("settings.updatePassword")}
          </Button>
        </CardContent>
      </Card>

      {/* AI provider (Phase A1) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4.5 text-primary" />
            {t("ai.sectionTitle")}
          </CardTitle>
          <CardDescription>{t("ai.sectionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ai.isLoading ? (
            <p className="text-sm text-slate-400">{t("loading")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    ai.data?.configured
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {ai.data?.configured
                    ? t("ai.statusActive")
                    : t("ai.statusNotConfigured")}
                </span>
                {ai.data?.provider && (
                  <span
                    className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    dir="ltr"
                  >
                    {ai.data.provider}
                  </span>
                )}
                {ai.data?.model && (
                  <span
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                    dir="ltr"
                  >
                    {ai.data.model}
                  </span>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {AI_CAPABILITIES.map((cap) => {
                  const ok = ai.data?.capabilities[cap.name] ?? false;
                  return (
                    <div
                      key={cap.name}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <span className="text-sm text-slate-600">
                        {t(cap.labelKey)}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          ok ? "text-emerald-600" : "text-slate-400",
                        )}
                      >
                        {ok ? t("ai.capAvailable") : t("ai.capUnavailable")}
                      </span>
                    </div>
                  );
                })}
              </div>

              {ai.data?.configured ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => testConnection.mutate()}
                    disabled={testConnection.isPending}
                  >
                    {testConnection.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {t("ai.testConnection")}
                  </Button>
                  {probe && (
                    <p
                      className={cn(
                        "text-sm",
                        probe.ok ? "text-emerald-600" : "text-red-600",
                      )}
                    >
                      {probe.text}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  <p>{t("ai.notConfiguredHint")}</p>
                  <p className="font-mono text-xs text-slate-500" dir="ltr">
                    AI_PROVIDER · AI_API_KEY · AI_BASE_URL · AI_MODEL
                  </p>
                  <p>{t("ai.freeTierNote")}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Reminders (Phase 3) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4.5 text-primary" />
            {t("settings.remindersSection")}
          </CardTitle>
          <CardDescription>{t("settings.remindersSectionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Master switch */}
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700">
              {t("notifications.enableReminders")}
            </span>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={reminderSettings.enabled}
              onChange={(e) => updateReminders({ enabled: e.target.checked })}
            />
            <span
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40",
                reminderSettings.enabled ? "bg-primary" : "bg-slate-300",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
                  reminderSettings.enabled ? "start-[1.375rem]" : "start-0.5",
                )}
              />
            </span>
          </label>

          {reminderSettings.enabled && (
            <>
              <div className="space-y-2">
                <Label>{t("notifications.taskDaysLabel")}</Label>
                <Select
                  value={String(reminderSettings.taskDaysBefore)}
                  onValueChange={(v) => updateReminders({ taskDaysBefore: Number(v) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_DAY_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {t(REMINDER_DAY_KEY[d])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("notifications.projectDaysLabel")}</Label>
                <Select
                  value={String(reminderSettings.projectDaysBefore)}
                  onValueChange={(v) => updateReminders({ projectDaysBefore: Number(v) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_DAY_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {t(REMINDER_DAY_KEY[d])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-sm text-slate-700">
                  {t("notifications.includeOverdue")}
                </span>
                <Checkbox
                  checked={reminderSettings.includeOverdue}
                  onCheckedChange={(checked) =>
                    updateReminders({ includeOverdue: checked === true })
                  }
                />
              </label>
            </>
          )}
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="size-4.5 text-primary" />
            {t("settings.languageSection")}
          </CardTitle>
          <CardDescription>{t("settings.languageSectionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {(["en", "ar"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                lang === l
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50",
              )}
            >
              {l === "en" ? t("settings.languageEn") : t("settings.languageAr")}
              {lang === l && <Check className="size-4" />}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4.5 text-primary" />
            {t("settings.aboutSection")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{t("settings.aboutVersion")}</p>
          <p>{t("settings.aboutData")}</p>
          <p className="text-slate-400">{t("settings.aboutRoadmap")}</p>
        </CardContent>
      </Card>
    </div>
  );
}