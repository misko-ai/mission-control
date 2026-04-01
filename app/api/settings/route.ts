import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, AppSettings } from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_THEME,
  VALID_LOG_LEVEL,
} from "@/lib/validation";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    logError("GET /api/settings", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body as { settings: Partial<AppSettings> };

    if (settings) {
      const checks: unknown[] = [];
      if (settings.theme !== undefined) {
        checks.push(optionalEnum(settings.theme, "theme", VALID_THEME, settings.theme));
      }
      if (settings.logLevel !== undefined) {
        checks.push(optionalEnum(settings.logLevel, "logLevel", VALID_LOG_LEVEL, settings.logLevel));
      }
      const errors = collectErrors(...checks);
      const vRes = validationResponse(errors);
      if (vRes) return vRes;

      await updateSettings(settings);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PATCH /api/settings", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
