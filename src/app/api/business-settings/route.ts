import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import {
  getBusinessSettings,
  serializeBusinessSettings,
} from "@/lib/business-settings";
import {
  businessSettingsUpdateSchema,
  validationError,
  zodIssues,
} from "@/lib/validation";

// GET /api/business-settings — the user's invoice branding (created on first access)
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const row = await getBusinessSettings(user.id);
    return NextResponse.json({ settings: serializeBusinessSettings(row) });
  } catch (e) {
    console.error("[business-settings GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// PUT /api/business-settings — update branding & invoice defaults.
// All fields are optional; omitted keys keep their current value and an
// empty-string logo (`""`) clears the stored logo.
export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const parsed = businessSettingsUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    await getBusinessSettings(user.id); // ensure the row exists

    const data: Record<string, unknown> = {};
    if (d.businessName !== undefined) data.businessName = d.businessName;
    if (d.businessEmail !== undefined) data.businessEmail = d.businessEmail;
    if (d.businessPhone !== undefined) data.businessPhone = d.businessPhone;
    if (d.businessAddress !== undefined) data.businessAddress = d.businessAddress;
    if (d.taxInfo !== undefined) data.taxInfo = d.taxInfo;
    if (d.currency !== undefined && d.currency !== null) data.currency = d.currency;
    if (d.invoiceFooter !== undefined) data.invoiceFooter = d.invoiceFooter;
    if (d.paymentInstructions !== undefined)
      data.paymentInstructions = d.paymentInstructions;
    if (d.logoData !== undefined) {
      data.logoData = d.logoData;
      // Keep the stored filename in sync with the logo (cleared together).
      if (d.logoData === null) data.logoName = null;
      else if (d.logoName !== undefined) data.logoName = d.logoName;
    } else if (d.logoName !== undefined) {
      data.logoName = d.logoName;
    }

    const row = await db.businessSettings.update({
      where: { userId: user.id },
      data,
    });

    return NextResponse.json({ settings: serializeBusinessSettings(row) });
  } catch (e) {
    console.error("[business-settings PUT]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}