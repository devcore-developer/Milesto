// أدوات تواريخ معزولة تمامًا عن الـ timezone — حسابات integer على نصوص ISO فقط
// عشان أي عرض (تقويم/جانت/قائمة) ميعرضش نفس الميعاد في يوم مختلف

export const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
] as const;

export const AR_WEEKDAYS_SHORT = ["إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت", "أحد"] as const; // 0 = الإثنين

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return MONTH_DAYS[month - 1] ?? 30;
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISODate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
}

export function fromISO(iso: string): { y: number; m: number; d: number } {
  if (!isISODate(iso)) throw new Error(`تاريخ غير صالح: ${iso}`);
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) };
}

// Howard Hinnant's civil-date algorithms — بدون Date objects نهائيًا
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = m > 2 ? m - 3 : m + 9;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z: number): { y: number; m: number; d: number } {
  const z2 = z + 719468;
  const era = Math.floor(z2 / 146097);
  const doe = z2 - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? y + 1 : y, m, d };
}

export function addDaysISO(iso: string, days: number): string {
  const { y, m, d } = fromISO(iso);
  const next = civilFromDays(daysFromCivil(y, m, d) + days);
  return toISODate(next.y, next.m, next.d);
}

export function diffDays(startIso: string, endIso: string): number {
  const a = fromISO(startIso);
  const b = fromISO(endIso);
  return daysFromCivil(b.y, b.m, b.d) - daysFromCivil(a.y, a.m, a.d);
}

export function weekdayOfISO(iso: string): number {
  // 0 = الإثنين … 6 = الأحد (1970-01-01 = خميس = 3)
  const { y, m, d } = fromISO(iso);
  const z = daysFromCivil(y, m, d);
  return (((z % 7) + 7) + 3) % 7;
}

export function startOfWeekISO(iso: string): string {
  return addDaysISO(iso, -weekdayOfISO(iso));
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

export function monthKeyLabel(monthKey: string): string {
  const m = Number(monthKey.slice(5, 7));
  return `${AR_MONTHS[m - 1] ?? ""} ${monthKey.slice(0, 4)}`;
}

export function formatArabicDate(iso: string): string {
  const { y, m, d } = fromISO(iso);
  return `${d} ${AR_MONTHS[m - 1] ?? ""} ${y}`;
}

export function formatDaysLeft(iso: string, today: string): string {
  const d = diffDays(today, iso);
  if (d < 0) return d === -1 ? "متأخر يوم" : `متأخر ${Math.abs(d)} يوم`;
  if (d === 0) return "النهاردة";
  if (d === 1) return "بكرة";
  return `باقي ${d} يوم`;
}

export function todayISO(): string {
  const n = new Date();
  return toISODate(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export function buildMonthGrid(year: number, month: number): string[] {
  const gridStart = startOfWeekISO(toISODate(year, month, 1));
  return Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i));
}