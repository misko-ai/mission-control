import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  return NextResponse.json({
    endpoints: [
      { path: "/api/debug/clear-cache", method: "POST", description: "Clear in-memory data cache" },
      { path: "/api/debug/corrupt-store", method: "POST", description: "Corrupt or delete store files for testing" },
    ],
  });
}
