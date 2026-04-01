import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, AppSettings } from "@/lib/store";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body as { settings: Partial<AppSettings> };

    if (settings) {
      await updateSettings(settings);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
