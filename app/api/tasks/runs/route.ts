import { NextRequest, NextResponse } from "next/server";
import { getTaskRuns, getTaskRunById } from "@/lib/store";
import { buildRunSummary } from "@/lib/diagnostics";
import { logError } from "@/lib/logger";
import type { TaskRun } from "@/lib/types";

function enrich(run: TaskRun) {
  return { ...run, summary: buildRunSummary(run) };
}

const VALID_SORT_FIELDS = ["claimedAt", "finishedAt", "durationMs", "attempt"] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

function compareRuns(a: TaskRun, b: TaskRun, field: SortField, asc: boolean): number {
  let av: number;
  let bv: number;

  switch (field) {
    case "claimedAt":
      av = new Date(a.claimedAt).getTime();
      bv = new Date(b.claimedAt).getTime();
      break;
    case "finishedAt":
      av = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      bv = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      break;
    case "durationMs":
      av = a.durationMs ?? 0;
      bv = b.durationMs ?? 0;
      break;
    case "attempt":
      av = a.attempt;
      bv = b.attempt;
      break;
  }

  return asc ? av - bv : bv - av;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Single-run lookup
    const runId = searchParams.get("runId");
    if (runId) {
      const run = await getTaskRunById(runId);
      if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }
      return NextResponse.json({ run: enrich(run) });
    }

    let runs = await getTaskRuns();

    // --- Filters ---
    const taskId = searchParams.get("taskId");
    if (taskId) runs = runs.filter((r) => r.taskId === taskId);

    const agentId = searchParams.get("agentId");
    if (agentId) runs = runs.filter((r) => r.agentId === agentId);

    const status = searchParams.get("status");
    if (status) runs = runs.filter((r) => r.status === status);

    if (searchParams.get("active") === "true") {
      runs = runs.filter((r) => r.status === "active");
    } else if (searchParams.get("terminal") === "true") {
      runs = runs.filter((r) => r.status !== "active");
    }

    const since = searchParams.get("since");
    if (since) {
      const sinceMs = new Date(since).getTime();
      if (!isNaN(sinceMs)) runs = runs.filter((r) => new Date(r.claimedAt).getTime() >= sinceMs);
    }

    const until = searchParams.get("until");
    if (until) {
      const untilMs = new Date(until).getTime();
      if (!isNaN(untilMs)) runs = runs.filter((r) => new Date(r.claimedAt).getTime() <= untilMs);
    }

    const total = runs.length;

    // --- Sort ---
    const sortParam = searchParams.get("sort") as SortField | null;
    const sortField: SortField = sortParam && VALID_SORT_FIELDS.includes(sortParam) ? sortParam : "claimedAt";
    const order = searchParams.get("order");
    const asc = order === "asc";

    runs.sort((a, b) => compareRuns(a, b, sortField, asc));

    // --- Pagination ---
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Math.max(1, Math.min(isNaN(limitParam) ? 50 : limitParam, 200));

    const offsetParam = parseInt(searchParams.get("offset") || "0", 10);
    const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);

    runs = runs.slice(offset, offset + limit);

    return NextResponse.json({
      runs: runs.map(enrich),
      total,
      limit,
      offset,
    });
  } catch (err) {
    logError("GET /api/tasks/runs", err);
    return NextResponse.json({ error: "Failed to load runs" }, { status: 500 });
  }
}
