import { NextResponse } from "next/server";
import { clearCache } from "@/lib/db";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  clearCache();
  return NextResponse.json({ cleared: true });
}
