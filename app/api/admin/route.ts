import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    endpoints: [
      { path: "/api/admin/cleanup", method: "POST", description: "Clean up old task runs and activities" },
    ],
  });
}
