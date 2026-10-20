// تصدير حقيقي: CSV (بـ BOM عشان العربي يفتح صح في Excel) + طباعة/حفظ PDF من المتصفح
export function escapeCSVValue(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows];
  return "\uFEFF" + lines.map((line) => line.map(escapeCSVValue).join(",")).join("\r\n");
}

export interface CSVTable {
  headers: string[];
  rows: unknown[][];
}

export function buildCSVWithMeta(title: string, rangeLabel: string, table: CSVTable): string {
  const lines: unknown[][] = [[title], [rangeLabel], [], table.headers, ...table.rows];
  return "\uFEFF" + lines.map((line) => line.map(escapeCSVValue).join(",")).join("\r\n");
}

export function downloadCSV(filename: string, csv: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printCurrentReport(): void {
  if (typeof window === "undefined") return;
  window.print();
}