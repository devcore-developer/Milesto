import { Clock, AlertTriangle, CheckCircle2, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { daysUntil, formatDate } from "@/lib/utils";
import type { DeadlineTone } from "@/types";

interface DeadlineIndicatorProps {
  iso: string;
  completed?: boolean;
  className?: string;
}

function resolveTone(iso: string, completed?: boolean): { tone: DeadlineTone; label: string } {
  if (completed) return { tone: "completed", label: "Completed" };
  const days = daysUntil(iso);
  if (days < 0) return { tone: "overdue", label: `${Math.abs(days)}d overdue` };
  if (days <= 3) return { tone: "due-soon", label: `Due in ${days}d` };
  if (days <= 14) return { tone: "upcoming", label: `Due in ${days}d` };
  return { tone: "upcoming", label: formatDate(iso, { month: "short", day: "numeric" }) };
}

const toneStyles: Record<DeadlineTone, { wrap: string; icon: typeof Clock; iconClass: string }> = {
  overdue: { wrap: "text-danger", icon: AlertTriangle, iconClass: "text-danger" },
  "due-soon": { wrap: "text-warning-foreground", icon: Clock, iconClass: "text-warning" },
  upcoming: { wrap: "text-muted-foreground", icon: CalendarClock, iconClass: "text-muted-foreground" },
  completed: { wrap: "text-success-foreground", icon: CheckCircle2, iconClass: "text-success" },
};

export function DeadlineIndicator({ iso, completed, className }: DeadlineIndicatorProps) {
  const { tone, label } = resolveTone(iso, completed);
  const cfg = toneStyles[tone];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cfg.wrap, className)}>
      <Icon className={cn("h-3.5 w-3.5", cfg.iconClass)} />
      {label}
    </span>
  );
}