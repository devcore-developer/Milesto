import { cn } from "@/lib/utils";

export interface LegendItem {
  name: string;
  color: string; // CSS color or var()
}

interface ChartLegendProps {
  items: LegendItem[];
  className?: string;
}

export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)}>
      {items.map((item) => (
        <li key={item.name} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          <span className="font-medium text-foreground/80">{item.name}</span>
        </li>
      ))}
    </ul>
  );
}