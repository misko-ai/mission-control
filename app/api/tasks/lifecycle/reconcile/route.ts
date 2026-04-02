import { NextRequest, NextResponse } from "next/server";
import { reconcileStaleRuns } from "@/lib/lifecycle";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    let thresholdMs: number | undefined;
    try {
      const body = await request.json();
      thresholdMs = body.thresholdMs;
    } catch {
      // Empty body is fine
    }

    const result = await reconcileStaleRuns({
      force: true,
      thresholdMs,
    });

    return NextResponse.json({
      success: true,
      repairedCount: result.repairs.length,
      repairs: result.repairs,
    });
  } catch (err) {
    logError("POST /api/tasks/lifecycle/reconcile", err);
    return NextResponse.json({ error: "Failed to reconcile" }, { status: 500 });
  }
}
