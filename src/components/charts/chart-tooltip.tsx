import { cn } from "@/lib/utils";
import { formatCompactCurrency, formatPercent } from "@/lib/utils";

type TooltipEntry = {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  /** Override per-series formatting. */
  format?: "number" | "currency" | "percent";
  className?: string;
}

function formatValue(value: unknown, fmt: ChartTooltipProps["format"]) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  if (fmt === "currency") return formatCompactCurrency(n);
  if (fmt === "percent") return formatPercent(n);
  return new Intl.NumberFormat("en-US").format(n);
}

export function ChartTooltip({ active, payload, label, format = "number", className }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        "min-w-[8rem] rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-md backdrop-blur-sm",
        className
      )}
    >
      {label !== undefined && label !== "" && (
        <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">{formatValue(entry.value, format)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}