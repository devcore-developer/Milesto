import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import {
  reminderSettingsSchema,
  validationError,
  zodIssues,
} from "@/lib/validation";

// Default values mirror src/lib/notifications.ts DEFAULT_REMINDER_SETTINGS.
const DEFAULTS = {
  enabled: true,
  taskDaysBefore: 3,
  projectDaysBefore: 7,
  includeOverdue: true,
};

function shape(row: {
  enabled: boolean;
  taskDaysBefore: number;
  projectDaysBefore: number;
  includeOverdue: boolean;
}) {
  return {
    enabled: row.enabled,
    taskDaysBefore: row.taskDaysBefore,
    projectDaysBefore: row.projectDaysBefore,
    includeOverdue: row.includeOverdue,
  };
}

// GET /api/reminders/settings — current reminder configuration.
// Returns source:"db" when the user already saved settings, or
// source:"default" when no row exists yet (nothing is written on GET).
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const row = await db.reminderSetting.findUnique({
      where: { userId: user.id },
    });
    if (!row) {
      return NextResponse.json({ settings: DEFAULTS, source: "default" });
    }
    return NextResponse.json({ settings: shape(row), source: "db" });
  } catch (e) {
    console.error("[reminders/settings GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// PUT /api/reminders/settings — create or update the reminder configuration.
export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const parsed = reminderSettingsSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));

    const row = await db.reminderSetting.upsert({
      where: { userId: user.id },
      update: { ...parsed.data },
      create: { userId: user.id, ...parsed.data },
    });

    return NextResponse.json({ settings: shape(row) });
  } catch (e) {
    console.error("[reminders/settings PUT]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}