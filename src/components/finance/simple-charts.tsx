"use client";

/**
 * Zero-dependency SVG charts for the finance views.
 * Tooltips are native <title> elements; legends are plain flex rows.
 * Currencies are never mixed inside one series.
 */

import { cn } from "@/lib/utils";

const DEFAULT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
];

function compactMajor(minor: number): string {
  const major = minor / 100;
  const abs = Math.abs(major);
  const sign = major < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const scaled = value / base;
  const niceScaled = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return niceScaled * base;
}

function truncateLabel(label: string): string {
  return label.length > 16 ? `${label.slice(0, 15)}…` : label;
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-44 items-center justify-center rounded-md border border-dashed border-border/70 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function CurrencyPicker({
  currencies,
  value,
  onChange,
}: {
  currencies: string[];
  value: string | null;
  onChange: (currency: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {currencies.map((currency) => (
        <button
          key={currency}
          type="button"
          onClick={() => onChange(currency)}
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
            value === currency
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}

interface BarSeries {
  key: string;
  label: string;
  values: number[];
}

export function BarGroupChart({
  categories,
  series,
  colors = DEFAULT_COLORS,
  valueFormatter,
  height = 260,
  emptyMessage = "No records yet.",
}: {
  categories: string[];
  series: BarSeries[];
  colors?: string[];
  valueFormatter?: (value: number, categoryIndex: number) => string;
  height?: number;
  emptyMessage?: string;
}) {
  const hasData = categories.length > 0 && series.some((s) => s.values.some((v) => v !== 0));
  if (categories.length === 0 || !hasData) return <ChartEmpty message={emptyMessage} />;

  const width = 640;
  const padLeft = 56;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 26;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const maxVal = Math.max(1, ...series.flatMap((s) => s.values.map((v) => Math.max(0, v))));
  const top = niceMax(maxVal);
  const groupWidth = plotWidth / categories.length;
  const barWidth = Math.min(26, Math.max(6, (groupWidth - 14) / series.length));
  const labelStep = Math.ceil(categories.length / 10);

  const yFor = (value: number) =>
    padTop + plotHeight - (Math.max(0, value) / top) * plotHeight;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const value = top * t;
          const y = yFor(value);
          return (
            <g key={t}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : "3 3"}
              />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
                {compactMajor(value)}
              </text>
            </g>
          );
        })}
        {categories.map((category, categoryIndex) => {
          const groupX = padLeft + categoryIndex * groupWidth;
          const startX = groupX + (groupWidth - series.length * barWidth) / 2;
          return (
            <g key={category}>
              {series.map((s, seriesIndex) => {
                const value = s.values[categoryIndex] ?? 0;
                const barHeight = (Math.max(0, value) / top) * plotHeight;
                const x = startX + seriesIndex * barWidth;
                const y = padTop + plotHeight - barHeight;
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={y}
                    width={Math.max(barWidth - 2, 1)}
                    height={Math.max(barHeight, value > 0 ? 2 : 0)}
                    rx={2}
                    fill={colors[seriesIndex % colors.length]}
                    opacity={0.9}
                  >
                    <title>
                      {`${s.label} · ${category}: ${
                        valueFormatter ? valueFormatter(value, categoryIndex) : compactMajor(value)
                      }`}
                    </title>
                  </rect>
                );
              })}
              {categoryIndex % labelStep === 0 ? (
                <text
                  x={groupX + groupWidth / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={10}
                >
                  {category}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <ChartLegend items={series.map((s, i) => ({ label: s.label, color: colors[i % colors.length] }))} />
    </div>
  );
}

export function LineAreaChart({
  points,
  color = DEFAULT_COLORS[0],
  height = 260,
  valueFormatter,
  emptyMessage = "No records yet.",
}: {
  points: { label: string; value: number }[];
  color?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
}) {
  const hasData = points.some((p) => p.value !== 0);
  if (points.length < 2 || !hasData) return <ChartEmpty message={emptyMessage} />;

  const width = 640;
  const padLeft = 56;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 26;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const values = points.map((p) => p.value);
  const maxVal = Math.max(0, ...values);
  const minVal = Math.min(0, ...values);
  const span = maxVal - minVal || 1;
  const baseline = Math.min(Math.max(0, minVal), maxVal);

  const xFor = (index: number) =>
    padLeft + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yFor = (value: number) => padTop + ((maxVal - value) / span) * plotHeight;

  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.value)}`).join(" ");
  const areaPath = `M ${xFor(0)},${yFor(baseline)} L ${points
    .map((p, i) => `${xFor(i)},${yFor(p.value)}`)
    .join(" L ")} L ${xFor(points.length - 1)},${yFor(baseline)} Z`;
  const labelIndices = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const value = minVal + span * t;
          const y = yFor(value);
          return (
            <g key={t}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={value === 0 ? undefined : "3 3"}
              />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
                {compactMajor(value)}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill={color} opacity={0.12} />
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth={2} />
        {points.map((point, index) => (
          <circle key={`${point.label}-${index}`} cx={xFor(index)} cy={yFor(point.value)} r={2.5} fill={color}>
            <title>{`${point.label}: ${valueFormatter ? valueFormatter(point.value) : compactMajor(point.value)}`}</title>
          </circle>
        ))}
        {labelIndices.map((index) => (
          <text
            key={index}
            x={xFor(index)}
            y={height - 8}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground"
            fontSize={10}
          >
            {points[index]?.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function HBarChart({
  rows,
  seriesLabels,
  colors = DEFAULT_COLORS,
  valueFormatter,
  emptyMessage = "No records yet.",
}: {
  rows: { label: string; values: number[] }[];
  seriesLabels: string[];
  colors?: string[];
  valueFormatter?: (value: number, seriesIndex: number) => string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) return <ChartEmpty message={emptyMessage} />;

  const width = 640;
  const labelWidth = 110;
  const valueWidth = 74;
  const rowHeight = 40;
  const barHeight = 11;
  const barGap = 4;
  const height = rows.length * rowHeight + 8;
  const plotWidth = width - labelWidth - valueWidth;
  const maxVal = Math.max(1, ...rows.flatMap((row) => row.values.map((v) => Math.max(0, v))));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
        {rows.map((row, rowIndex) => {
          const rowY = rowIndex * rowHeight + 6;
          const blockHeight = seriesLabels.length * barHeight + (seriesLabels.length - 1) * barGap;
          return (
            <g key={`${row.label}-${rowIndex}`}>
              <text
                x={labelWidth - 8}
                y={rowY + blockHeight / 2 + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={11}
              >
                {truncateLabel(row.label)}
              </text>
              {row.values.map((value, seriesIndex) => {
                const barWidth = (Math.max(0, value) / maxVal) * plotWidth;
                const y = rowY + seriesIndex * (barHeight + barGap);
                const display = valueFormatter ? valueFormatter(value, seriesIndex) : compactMajor(value);
                return (
                  <g key={`${row.label}-${seriesLabels[seriesIndex]}`}>
                    <rect
                      x={labelWidth}
                      y={y}
                      width={Math.max(barWidth, value > 0 ? 2 : 0)}
                      height={barHeight}
                      rx={2}
                      fill={colors[seriesIndex % colors.length]}
                      opacity={0.9}
                    >
                      <title>{`${seriesLabels[seriesIndex]} · ${row.label}: ${display}`}</title>
                    </rect>
                    <text
                      x={labelWidth + Math.max(barWidth, 0) + 6}
                      y={y + barHeight - 2}
                      className="fill-muted-foreground"
                      fontSize={10}
                    >
                      {compactMajor(value)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <ChartLegend items={seriesLabels.map((label, i) => ({ label, color: colors[i % colors.length] }))} />
    </div>
  );
}