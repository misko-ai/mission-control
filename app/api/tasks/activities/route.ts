import { NextRequest, NextResponse } from "next/server";
import { getTaskActivities } from "@/lib/store";
import { buildActivitySummary } from "@/lib/diagnostics";
import type { TaskActivityEntry } from "@/lib/types";

function enrich(a: TaskActivityEntry) {
  return { ...a, summary: buildActivitySummary(a) };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    let activities = await getTaskActivities();

    // --- Filters ---
    const taskId = searchParams.get("taskId");
    if (taskId) activities = activities.filter((a) => a.taskId === taskId);

    const agentId = searchParams.get("agentId");
    if (agentId) activities = activities.filter((a) => a.agentId === agentId);

    const action = searchParams.get("action");
    if (action) activities = activities.filter((a) => a.action === action);

    const actor = searchParams.get("actor");
    if (actor) activities = activities.filter((a) => a.actor === actor);

    const reasonCode = searchParams.get("reasonCode");
    if (reasonCode) activities = activities.filter((a) => a.reasonCode === reasonCode);

    const since = searchParams.get("since");
    if (since) {
      const sinceMs = new Date(since).getTime();
      if (!isNaN(sinceMs)) activities = activities.filter((a) => new Date(a.timestamp).getTime() >= sinceMs);
    }

    const until = searchParams.get("until");
    if (until) {
      const untilMs = new Date(until).getTime();
      if (!isNaN(untilMs)) activities = activities.filter((a) => new Date(a.timestamp).getTime() <= untilMs);
    }

    const total = activities.length;

    // --- Sort ---
    const order = searchParams.get("order");
    const asc = order === "asc";
    activities.sort((a, b) => {
      const at = new Date(a.timestamp).getTime();
      const bt = new Date(b.timestamp).getTime();
      return asc ? at - bt : bt - at;
    });

    // --- Pagination ---
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Math.max(1, Math.min(isNaN(limitParam) ? 50 : limitParam, 100));

    const offsetParam = parseInt(searchParams.get("offset") || "0", 10);
    const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);

    activities = activities.slice(offset, offset + limit);

    return NextResponse.json({
      activities: activities.map(enrich),
      total,
      limit,
      offset,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load activities" }, { status: 500 });
  }
}
