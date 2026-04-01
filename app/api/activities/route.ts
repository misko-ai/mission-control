import { NextResponse } from "next/server";
import { getActivities } from "@/lib/store";

export async function GET() {
  try {
    const activities = await getActivities();
    return NextResponse.json({ activities });
  } catch {
    return NextResponse.json({ error: "Failed to load activities" }, { status: 500 });
  }
}
