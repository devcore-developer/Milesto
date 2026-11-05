"use client";

import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FileText,
  FolderKanban,
  Languages,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Receipt,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import { useUIStore, type View } from "@/lib/store";
import { useLogout } from "@/hooks/use-mylist";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/mylist/shell/brand-mark";
import { NotificationBell } from "@/components/mylist/shell/notification-bell";

const NAV_ITEMS: { view: View; icon: LucideIcon }[] = [
  { view: "dashboard", icon: LayoutDashboard },
  { view: "tasks", icon: ListTodo },
  { view: "projects", icon: FolderKanban },
  { view: "timeline", icon: CalendarRange },
  { view: "calendar", icon: CalendarDays },
  { view: "clients", icon: Users },
  { view: "invoices", icon: Receipt },
  { view: "documents", icon: FileText },
  { view: "settings", icon: Settings },
];

const MOBILE_MAIN: View[] = ["dashboard", "tasks", "projects", "timeline"];

/** Highlight "Projects" while the detail page of a project is open. */
function navMatches(item: View, active: View): boolean {
  if (item === "projects" && active === "project-detail") return true;
  return item === active;
}

/** Translation key for a nav view. */
function navLabelKey(view: View): TranslationKey {
  if (view === "timeline") return "timeline";
  if (view === "project-detail") return "projects";
  return view as TranslationKey;
}

export function LangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Switch language"
      className={cn(
        "gap-1.5",
        dark ? "text-blue-100 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:text-slate-900",
      )}
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
    >
      <Languages className="size-4" />
      <span className="text-xs font-semibold">{lang === "en" ? "عربي" : "EN"}</span>
    </Button>
  );
}

function NavButton({
  view,
  icon: Icon,
  active,
  onSelect,
  dark = false,
}: {
  view: View;
  icon: LucideIcon;
  active: boolean;
  onSelect: (v: View) => void;
  dark?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button
      onClick={() => onSelect(view)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        dark
          ? active
            ? "bg-white/15 text-white"
            : "text-blue-100/70 hover:bg-white/10 hover:text-white"
          : active
            ? "bg-primary/10 text-primary"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      <span>{t(navLabelKey(view))}</span>
    </button>
  );
}

export function AppShell({ user, children }: { user: AuthUser; children: ReactNode }) {
  const { t } = useI18n();
  const { activeView, setView } = useUIStore();
  const logout = useLogout();
  const [moreOpen, setMoreOpen] = useState(false);

  const selectView = (v: View) => {
    setView(v);
    setMoreOpen(false);
  };

  const sidebar = (
    <>
      <div className="p-5">
        <BrandMark size="md" dark />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.view}
            view={item.view}
            icon={item.icon}
            active={navMatches(item.view, activeView)}
            onSelect={selectView}
            dark
          />
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name ?? user.email}</p>
            <p className="truncate text-xs text-blue-200/70" dir="ltr">
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell dark />
          <LangToggle dark />
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 gap-1.5 text-blue-100 hover:bg-white/10 hover:text-white"
            onClick={() => logout.mutate()}
          >
            <LogOut className="size-4 rtl:rotate-180" />
            {t("logout")}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col bg-sidebar lg:flex">
        {sidebar}
      </aside>

      <div className="flex min-h-screen flex-col lg:ms-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <BrandMark size="sm" />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LangToggle />
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600"
              aria-label={t("logout")}
              onClick={() => logout.mutate()}
            >
              <LogOut className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-24 md:px-8 lg:pb-8">
          {children}
        </main>

        <footer className="mt-auto hidden items-center justify-between border-t border-slate-200 px-8 py-4 text-xs text-slate-400 lg:flex">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" />
            {t("aboutVersion")}
          </span>
          <span>{new Date().getFullYear()}</span>
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_MAIN.map((view) => {
          const item = NAV_ITEMS.find((n) => n.view === view)!;
          const Icon = item.icon;
          const active = navMatches(view, activeView);
          return (
            <button
              key={view}
              onClick={() => selectView(view)}
              className={cn(
                "flex min-w-11 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium",
                active ? "text-primary" : "text-slate-400",
              )}
            >
              <Icon className="size-5" />
              {t(navLabelKey(view))}
            </button>
          );
        })}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex min-w-11 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium",
                ["clients", "invoices", "documents", "settings", "project-detail"].includes(
                  activeView,
                )
                  ? "text-primary"
                  : "text-slate-400",
              )}
            >
              <Settings className="size-5" />
              {t("more")}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl p-0">
            <SheetHeader className="p-4 pb-2">
              <SheetTitle className="text-start">{t("more")}</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2 p-4 pt-0">
              {NAV_ITEMS.filter((n) => !MOBILE_MAIN.includes(n.view)).map((item) => (
                <NavButton
                  key={item.view}
                  view={item.view}
                  icon={item.icon}
                  active={navMatches(item.view, activeView)}
                  onSelect={selectView}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}