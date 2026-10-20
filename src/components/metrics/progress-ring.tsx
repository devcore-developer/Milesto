import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number; // 0–100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  tone?: "blue" | "teal" | "green" | "amber";
  className?: string;
}

const toneColors: Record<NonNullable<ProgressRingProps["tone"]>, string> = {
  blue: "hsl(var(--chart-1))",
  teal: "hsl(var(--chart-2))",
  green: "hsl(var(--chart-3))",
  amber: "hsl(var(--chart-4))",
};

export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 8,
  label,
  sublabel,
  tone = "blue",
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  const color = toneColors[tone];

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            opacity={0.6}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-semibold tabular-nums text-foreground">{Math.round(clamped)}%</span>
        </div>
      </div>
      {label && (
        <div className="text-center">
          <p className="text-xs font-medium text-foreground">{label}</p>
          {sublabel && <p className="text-2xs text-muted-foreground">{sublabel}</p>}
        </div>
      )}
    </div>
  );
}