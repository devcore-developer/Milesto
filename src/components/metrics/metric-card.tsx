import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Metric } from "@/types";

const accentMap: Record<Metric["accent"], { iconWrap: string; icon: string }> = {
  blue: { iconWrap: "bg-primary/10", icon: "text-primary" },
  teal: { iconWrap: "bg-chart-2/10", icon: "text-chart-2" },
  green: { iconWrap: "bg-success-soft", icon: "text-success-foreground" },
  amber: { iconWrap: "bg-warning-soft", icon: "text-warning-foreground" },
  violet: { iconWrap: "bg-chart-5/10", icon: "text-chart-5" },
};

interface MetricCardProps extends Metric {
  icon?: LucideIcon;
  className?: string;
}

export function MetricCard({ label, value, delta, hint, accent, icon: Icon, className }: MetricCardProps) {
  const accentCfg = accentMap[accent];
  const DeltaIcon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : Minus;
  const deltaTone =
    delta?.tone === "positive" ? "text-success-foreground" : delta?.tone === "negative" ? "text-danger" : "text-muted-foreground";

  return (
    <Card className={cn("relative overflow-hidden p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
        </div>
        {Icon && (
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accentCfg.iconWrap)}>
            <Icon className={cn("h-4.5 w-4.5", accentCfg.icon)} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {delta && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", deltaTone)}>
            <DeltaIcon className="h-3.5 w-3.5" />
            {delta.value}
          </span>
        )}
        {hint && <span className="text-muted-foreground">· {hint}</span>}
      </div>
    </Card>
  );
}