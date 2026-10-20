"use client";

/**
 * Milesto — Phase 10 — In-app deadline notification center (Phase 10 §6, §8).
 *
 * Renders deadline alerts computed from REAL stored records by
 * `computeDeadlineAlerts`. Behavior:
 * - Badge counts unread alerts; opening the panel marks them SEEN only
 *   (idempotent — first-seen wins, so repeated visits never re-notify).
 * - Marking READ happens on row click or "Mark all read"; state persists
 *   through the notification store (localStorage, versioned).
 * - Accessible: aria-expanded trigger, Escape closes and restores focus,
 *   rows are real buttons, outside click dismisses.
 *
 * Deliberately self-contained: only the verified `Button`/`Badge` primitives
 * are imported; icons are inline SVG and class joining uses a local helper.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ALERT_BUCKETS,
  formatAlertDate,
  formatDaysRemaining,
  groupAlertsByBucket,
  type AlertBucket,
  type DeadlineAlert,
} from "@/lib/alerts";
import {
  applyRead,
  applySeen,
  isUnread,
  loadNotificationState,
  saveNotificationState,
  unreadCount,
  type NotificationState,
} from "@/lib/notification-store";
import type { StorageLike } from "@/lib/persistence";

export interface NotificationCenterProps {
  alerts: readonly DeadlineAlert[];
  /** Called when the user activates an alert row (deep link into a module). */
  onOpenAlert?: (alert: DeadlineAlert) => void;
  /** Alternate storage (tests / custom stores). Defaults to localStorage. */
  storage?: StorageLike;
  className?: string;
}

const BUCKET_LABELS: Record<AlertBucket, string> = {
  overdue: "Overdue",
  today: "Due today",
  next7: "Next 7 days",
  next30: "Next 30 days",
};

const SEVERITY_VARIANTS: Record<DeadlineAlert["severity"], "danger" | "warning" | "info" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function Icon({
  children,
  className = "h-4 w-4",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function BellIcon() {
  return (
    <Icon>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Icon>
  );
}

function MarkAllIcon() {
  return (
    <Icon>
      <path d="m18 6-11 11-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </Icon>
  );
}

function InboxIcon() {
  return (
    <Icon className="h-8 w-8">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Icon>
  );
}

export function NotificationCenter({
  alerts,
  onOpenAlert,
  storage,
  className,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<NotificationState>(() => ({}));
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const storageRef = useRef<StorageLike | undefined>(storage);
  storageRef.current = storage;

  // Load persisted state after mount so SSR and first client render match.
  useEffect(() => {
    setState(loadNotificationState(storageRef.current));
    setMounted(true);
  }, []);

  const alertKeys = useMemo(() => alerts.map((alert) => alert.key), [alerts]);
  const grouped = useMemo(() => groupAlertsByBucket(alerts), [alerts]);
  const unread = mounted ? unreadCount(state, alertKeys) : 0;

  const persist = useCallback((next: NotificationState) => {
    setState(next);
    saveNotificationState(next, storageRef.current);
  }, []);

  const handleToggle = useCallback(() => {
    const opening = !open;
    setOpen(opening);
    if (opening) {
      // Mark current alerts as seen — first-seen wins, so this is idempotent.
      persist(applySeen(loadNotificationState(storageRef.current), alertKeys, new Date().toISOString()));
    }
  }, [open, alertKeys, persist]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleOpenAlert = useCallback(
    (alert: DeadlineAlert) => {
      persist(applyRead(loadNotificationState(storageRef.current), [alert.key], new Date().toISOString()));
      onOpenAlert?.(alert);
      setOpen(false);
    },
    [onOpenAlert, persist],
  );

  const handleMarkAllRead = useCallback(() => {
    persist(applyRead(loadNotificationState(storageRef.current), alertKeys, new Date().toISOString()));
  }, [alertKeys, persist]);

  return (
    <div ref={containerRef} className={cx("relative", className)}>
      <Button
        ref={triggerRef}
        variant="ghost"
        onClick={handleToggle}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        className="relative h-9 w-9 p-0"
      >
        <BellIcon />
        {mounted && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="region"
          aria-label="Deadline notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Deadlines</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={unread === 0}
              className="h-7 gap-1 px-2 text-xs"
            >
              <MarkAllIcon />
              Mark all read
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <InboxIcon />
                <p className="text-sm font-medium">All caught up</p>
                <p className="text-xs text-muted-foreground">
                  Nothing is due or overdue in the next 30 days.
                </p>
              </div>
            ) : (
              ALERT_BUCKETS.map((bucket) => {
                const bucketAlerts = grouped[bucket];
                if (bucketAlerts.length === 0) return null;
                return (
                  <section key={bucket} aria-label={BUCKET_LABELS[bucket]} className="border-t first:border-t-0">
                    <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        {BUCKET_LABELS[bucket]}
                      </span>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {bucketAlerts.length}
                      </Badge>
                    </div>
                    <ul>
                      {bucketAlerts.map((alert) => {
                        const isUnreadItem = isUnread(state, alert.key);
                        return (
                          <li key={alert.key}>
                            <button
                              type="button"
                              onClick={() => handleOpenAlert(alert)}
                              title={alert.title}
                              className={cx(
                                "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                                isUnreadItem && "bg-accent/40",
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cx(
                                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                                  isUnreadItem ? "bg-primary" : "bg-transparent",
                                )}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium leading-5">
                                  {alert.title}
                                </span>
                                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="shrink-0 text-[10px] uppercase tracking-wider">
                                    {alert.kind}
                                  </span>
                                  {alert.projectName && (
                                    <span className="max-w-[8rem] truncate">{alert.projectName}</span>
                                  )}
                                  <span className="ml-auto shrink-0">
                                    {formatAlertDate(alert.dueDate)}
                                  </span>
                                </span>
                              </span>
                              <Badge
                                variant={SEVERITY_VARIANTS[alert.severity]}
                                className="mt-0.5 shrink-0"
                              >
                                {formatDaysRemaining(alert.daysRemaining)}
                              </Badge>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}