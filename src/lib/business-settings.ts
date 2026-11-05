// Business / invoice settings (Phase 5) — server-side helpers.
// A single row per user holds the branding used on invoices and PDF
// exports: business info, logo, currency, footer and payment instructions.
import { db } from "@/lib/db";
import type { BusinessSettingsDTO } from "@/lib/types";

export interface BusinessSettingsRow {
  id: string;
  userId: string;
  businessName: string;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  taxInfo: string | null;
  currency: string;
  invoiceFooter: string | null;
  paymentInstructions: string | null;
  logoData: string | null;
  logoName: string | null;
}

/**
 * Load the user's business settings, creating the row with defaults on
 * first access so callers never have to deal with nulls.
 */
export async function getBusinessSettings(
  userId: string,
): Promise<BusinessSettingsRow> {
  const existing = await db.businessSettings.findUnique({
    where: { userId },
  });
  if (existing) return existing as BusinessSettingsRow;
  const created = await db.businessSettings.create({
    data: { userId },
  });
  return created as BusinessSettingsRow;
}

export function serializeBusinessSettings(
  row: BusinessSettingsRow,
): BusinessSettingsDTO {
  return {
    businessName: row.businessName,
    businessEmail: row.businessEmail,
    businessPhone: row.businessPhone,
    businessAddress: row.businessAddress,
    taxInfo: row.taxInfo,
    currency: row.currency,
    invoiceFooter: row.invoiceFooter,
    paymentInstructions: row.paymentInstructions,
    logoData: row.logoData,
    logoName: row.logoName,
  };
}