/**
 * Milesto — money primitives.
 *
 * Amounts are handled as integer minor units. Parsing goes through
 * strict string validation (never parseFloat) so "19.99" is exactly
 * 1999 minor units with no floating point drift.
 */

import { CURRENCY_DECIMALS, type Currency, type CurrencyAmount } from "@/types/finance";

/** Hard ceiling: 999,999,999.99 major units. */
export const MAX_MINOR = 99_999_999_999;

/**
 * Parses a user-typed decimal amount into integer minor units.
 * Accepts optional thousands separators ("1,234.56"). Returns null
 * for anything malformed, negative, too precise, or too large.
 */
export function parseAmountToMinor(raw: string, currency: Currency): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const decimals = CURRENCY_DECIMALS[currency];
  const dotIndex = cleaned.indexOf(".");
  const intPart = dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex);
  const fracPart = dotIndex === -1 ? "" : cleaned.slice(dotIndex + 1);
  if (fracPart.length > decimals) return null;

  const intDigits = intPart.replace(/^0+(?=\d)/, "");
  if (intDigits.length > 11) return null;

  const multiplier = 10 ** decimals;
  const minor =
    Number(intDigits) * multiplier + Number((fracPart + "0".repeat(decimals)).slice(0, decimals));
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) return null;
  return minor;
}

/** Converts integer minor units back to a plain major-unit string ("1234.56"). */
export function minorToMajorString(minor: number, currency: Currency): string {
  if (!Number.isSafeInteger(minor)) {
    throw new Error("Minor amount must be an integer");
  }
  const decimals = CURRENCY_DECIMALS[currency];
  const multiplier = 10 ** decimals;
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const intPart = Math.floor(abs / multiplier).toString();
  const fracPart = decimals === 0 ? "" : "." + (abs % multiplier).toString().padStart(decimals, "0");
  return `${negative ? "-" : ""}${intPart}${fracPart}`;
}

/** Formats minor units for display with the currency code, e.g. "USD 1,234.56". */
export function formatMinorAmount(minor: number, currency: Currency): string {
  const major = minorToMajorString(minor, currency);
  const negative = major.startsWith("-");
  const unsigned = negative ? major.slice(1) : major;
  const [intPart, fracPart = ""] = unsigned.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const digits = fracPart ? `${grouped}.${fracPart}` : grouped;
  return `${negative ? "-" : ""}${currency} ${digits}`;
}

/** Formats a grouped CurrencyAmount ("USD 1,234.56"). */
export function formatCurrencyAmount(amount: CurrencyAmount): string {
  return formatMinorAmount(amount.minor, amount.currency);
}

/** Adds two amounts of the SAME currency. Cross-currency addition is a bug — throw. */
export function addSameCurrency(a: CurrencyAmount, b: CurrencyAmount): CurrencyAmount {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} to ${b.currency} — amounts stay grouped per currency`);
  }
  return { currency: a.currency, minor: a.minor + b.minor };
}