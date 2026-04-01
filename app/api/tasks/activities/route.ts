import { NextResponse } from "next/server";
import { getTaskActivities } from "@/lib/store";

export async function GET() {
  try {
    const activities = await getTaskActivities();
    return NextResponse.json({ activities });
  } catch {
    return NextResponse.json({ error: "Failed to load activities" }, { status: 500 });
  }
}
