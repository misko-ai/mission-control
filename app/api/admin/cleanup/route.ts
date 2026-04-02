import { NextRequest, NextResponse } from "next/server";
import { getData, saveData, generateId } from "@/lib/db";
import { logError } from "@/lib/logger";
import type { TaskRun, TaskActivityEntry } from "@/lib/types";

interface CleanupResult {
  dryRun: boolean;
  policy: {
    olderThanDays: number;
    keepPerTask: number;
    keepMinActivities: number;
    cutoff: string;
  };
  runs: {
    total: number;
    removed: number;
    kept: number;
    protectedActive: number;
    protectedCurrentRun: number;
    protectedPerTask: number;
    removedIds: string[];
  };
  activities: {
    total: number;
    removed: number;
    kept: number;
    protectedRecent: number;
    removedIds: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const dryRun = body.dryRun !== false; // default true
    const olderThanDays = Math.max(1, Math.min(body.olderThanDays ?? 7, 365));
    const keepPerTask = Math.max(1, Math.min(body.keepPerTask ?? 3, 50));
    const keepMinActivities = Math.max(5, Math.min(body.keepMinActivities ?? 20, 100));

    const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const cutoff = new Date(cutoffMs).toISOString();

    const data = await getData();

    // --- Identify protected run IDs ---

    // 1. Active runs are never deleted
    const activeRunIds = new Set(
      data.taskRuns.filter((r) => r.status === "active").map((r) => r.id)
    );

    // 2. Runs referenced by task.currentRunId
    const currentRunIds = new Set(
      data.tasks.map((t) => t.currentRunId).filter(Boolean) as string[]
    );

    // 3. Keep N most recent terminal runs per task
    const perTaskKept = new Set<string>();
    const taskRunGroups = new Map<string, TaskRun[]>();
    for (const run of data.taskRuns) {
      if (run.status === "active") continue;
      const group = taskRunGroups.get(run.taskId) || [];
      group.push(run);
      taskRunGroups.set(run.taskId, group);
    }
    for (const [, runs] of taskRunGroups) {
      // Sort by finishedAt desc (most recent first), fallback to claimedAt
      runs.sort((a, b) => {
        const at = new Date(a.finishedAt || a.claimedAt).getTime();
        const bt = new Date(b.finishedAt || b.claimedAt).getTime();
        return bt - at;
      });
      for (let i = 0; i < Math.min(keepPerTask, runs.length); i++) {
        perTaskKept.add(runs[i].id);
      }
    }

    // --- Determine which runs to remove ---
    const runsToRemove: string[] = [];
    let protectedActive = 0;
    let protectedCurrentRun = 0;
    let protectedPerTask = 0;

    for (const run of data.taskRuns) {
      if (activeRunIds.has(run.id)) {
        protectedActive++;
        continue;
      }
      if (currentRunIds.has(run.id)) {
        protectedCurrentRun++;
        continue;
      }
      if (perTaskKept.has(run.id)) {
        protectedPerTask++;
        continue;
      }

      // Only remove if older than cutoff
      const runTime = new Date(run.finishedAt || run.claimedAt).getTime();
      if (runTime < cutoffMs) {
        runsToRemove.push(run.id);
      }
    }

    const removedRunIdSet = new Set(runsToRemove);

    // --- Determine which activities to remove ---
    // Sort activities by timestamp desc for keepMinActivities protection
    const sortedActivities = [...data.taskActivities].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const recentProtectedIds = new Set(
      sortedActivities.slice(0, keepMinActivities).map((a) => a.id)
    );

    const activitiesToRemove: string[] = [];
    let protectedRecent = 0;

    for (const activity of data.taskActivities) {
      if (recentProtectedIds.has(activity.id)) {
        protectedRecent++;
        continue;
      }

      const actTime = new Date(activity.timestamp).getTime();
      const linkedToRemovedRun = activity.runId && removedRunIdSet.has(activity.runId);

      if (actTime < cutoffMs || linkedToRemovedRun) {
        activitiesToRemove.push(activity.id);
      }
    }

    const removedActivityIdSet = new Set(activitiesToRemove);

    const result: CleanupResult = {
      dryRun,
      policy: { olderThanDays, keepPerTask, keepMinActivities, cutoff },
      runs: {
        total: data.taskRuns.length,
        removed: runsToRemove.length,
        kept: data.taskRuns.length - runsToRemove.length,
        protectedActive,
        protectedCurrentRun,
        protectedPerTask,
        removedIds: runsToRemove,
      },
      activities: {
        total: data.taskActivities.length,
        removed: activitiesToRemove.length,
        kept: data.taskActivities.length - activitiesToRemove.length,
        protectedRecent,
        removedIds: activitiesToRemove,
      },
    };

    if (!dryRun && (runsToRemove.length > 0 || activitiesToRemove.length > 0)) {
      data.taskRuns = data.taskRuns.filter((r) => !removedRunIdSet.has(r.id));
      data.taskActivities = data.taskActivities.filter((a) => !removedActivityIdSet.has(a.id));

      // Log cleanup as an admin audit activity
      const auditEntry: TaskActivityEntry = {
        id: generateId(),
        taskId: "system",
        taskTitle: "Admin cleanup",
        action: "reconciled",
        actor: "system",
        details: `Cleanup removed ${runsToRemove.length} run(s) and ${activitiesToRemove.length} activity/ies older than ${olderThanDays}d`,
        timestamp: new Date().toISOString(),
      };
      data.taskActivities.unshift(auditEntry);
      data.taskActivities = data.taskActivities.slice(0, 100);

      await saveData(data);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    logError("POST /api/admin/cleanup", err);
    return NextResponse.json({ error: "Failed to run cleanup" }, { status: 500 });
  }
}
