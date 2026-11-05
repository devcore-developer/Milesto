"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { useAuthState, useBusinessSettings } from "@/hooks/use-mylist";
import { useUIStore } from "@/lib/store";
import { loadReminderSettings } from "@/lib/notifications";
import { remindersApi } from "@/lib/api-client";
import { setDefaultCurrency } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { LoginView } from "@/components/mylist/auth/login-view";
import { SetupView } from "@/components/mylist/auth/setup-view";
import { AppShell } from "@/components/mylist/shell/app-shell";
import { TaskDialog } from "@/components/mylist/task/task-dialog";
import { DashboardView } from "@/components/mylist/views/dashboard-view";
import { TasksView } from "@/components/mylist/views/tasks-view";
import { ProjectsView } from "@/components/mylist/views/projects-view";
import { ProjectDetailView } from "@/components/mylist/views/project-detail-view";
import { TimelineView } from "@/components/mylist/views/timeline-view";
import { CalendarView } from "@/components/mylist/views/calendar-view";
import { ClientsView } from "@/components/mylist/views/clients-view";
import { FinanceView } from "@/components/mylist/views/finance-view";
import { DocumentsView } from "@/components/mylist/views/documents-view";
import { SettingsView } from "@/components/mylist/views/settings-view";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <CheckCircle2 className="size-7 animate-pulse" />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-bounce rounded-full bg-primary/60"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppRoot() {
  const { data, isLoading } = useAuthState();
  const activeView = useUIStore((s) => s.activeView);
  const selectedProjectId = useUIStore((s) => s.selectedProjectId);
  const taskDialogOpen = useUIStore((s) => s.taskDialogOpen);
  const editingTask = useUIStore((s) => s.editingTask);
  const setTaskDialogOpen = useUIStore((s) => s.setTaskDialogOpen);
  const setReminderSettings = useUIStore((s) => s.setReminderSettings);

  const authed = data?.authed === true;

  // Phase 5: point every money formatter at the currency configured in the
  // invoice settings (falls back to EGP until the settings load).
  const settingsQuery = useBusinessSettings();
  useEffect(() => {
    const currency = settingsQuery.data?.settings.currency;
    if (currency) setDefaultCurrency(currency);
  }, [settingsQuery.data]);

  // Hydrate Phase 3 reminder settings once the session is known:
  // 1) localStorage first (instant — also covers offline use),
  // 2) then the database (source of truth). When the user never saved
  //    settings in the DB yet, adopt any local customization and create
  //    the row once so settings persist across browsers & devices.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    remindersApi
      .get()
      .then((res) => {
        if (cancelled) return;
        if (res.source === "db") {
          setReminderSettings(res.settings); // cache only — DB already authoritative
        } else {
          setReminderSettings(loadReminderSettings(), { sync: true });
        }
      })
      .catch(() => {
        // Server unreachable — keep the localStorage values.
        if (!cancelled) setReminderSettings(loadReminderSettings());
      });
    return () => {
      cancelled = true;
    };
  }, [authed, setReminderSettings]);

  if (isLoading) return <Splash />;

  if (data?.needsSetup) return <SetupView />;
  if (!data?.authed || !data.user) return <LoginView />;

  const user = data.user;

  return (
    <AppShell user={user}>
      <div className={cn("w-full")}>
        {activeView === "dashboard" && <DashboardView user={user} />}
        {activeView === "tasks" && <TasksView />}
        {activeView === "projects" && <ProjectsView />}
        {activeView === "project-detail" && selectedProjectId && (
          <ProjectDetailView projectId={selectedProjectId} />
        )}
        {activeView === "project-detail" && !selectedProjectId && <ProjectsView />}
        {activeView === "timeline" && <TimelineView />}
        {activeView === "calendar" && <CalendarView />}
        {/* Clients */}
        {activeView === "clients" && <ClientsView />}
        {/* Finance & invoices */}
        {activeView === "invoices" && <FinanceView />}
        {/* Documents */}
        {activeView === "documents" && <DocumentsView />}
        {activeView === "settings" && <SettingsView user={user} />}
      </div>

      {/* Global task dialog — reachable from every view */}
      <TaskDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} task={editingTask} />
    </AppShell>
  );
}