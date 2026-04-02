import { getData, saveData, generateId } from "./db";
import type { Task, TaskRun, TaskActivityEntry, Agent } from "./types";

export const HEARTBEAT_INTERVAL_MS = 30_000;
export const STALE_THRESHOLD_MS = 120_000;
const RECONCILE_COOLDOWN_MS = 60_000;

let lastReconcileAt = 0;

type ClaimCheck = { ok: true } | { ok: false; reason: string };

export function canClaim(task: Task, agentId: string, agents: Agent[]): ClaimCheck {
  if (task.assignee !== "agent") {
    return { ok: false, reason: "Task is not assigned to an agent" };
  }
  if (task.column !== "backlog" && task.column !== "blocked") {
    return { ok: false, reason: `Task is in "${task.column}", must be in backlog or blocked` };
  }
  if (task.currentRunId) {
    return { ok: false, reason: "Task already has an active run" };
  }
  if (!agents.some((a) => a.id === agentId)) {
    return { ok: false, reason: "Agent not found" };
  }
  return { ok: true };
}

export function canFinalize(
  task: Task,
  run: TaskRun,
  agentId: string
): ClaimCheck {
  if (run.status !== "active") {
    return { ok: false, reason: "Run is already terminal" };
  }
  if (run.agentId !== agentId) {
    return { ok: false, reason: "Agent does not own this run" };
  }
  if (task.currentRunId !== run.id) {
    return { ok: false, reason: "Run is not the current run for this task" };
  }
  return { ok: true };
}

export function isStale(run: TaskRun): boolean {
  if (run.status !== "active") return false;
  return Date.now() - new Date(run.heartbeatAt).getTime() > STALE_THRESHOLD_MS;
}

export interface ReconcileRepair {
  taskId: string;
  runId: string | null;
  reason: string;
}

export async function reconcileStaleRuns(opts?: {
  force?: boolean;
  thresholdMs?: number;
}): Promise<{ repairs: ReconcileRepair[] }> {
  const now = Date.now();
  if (!opts?.force && now - lastReconcileAt < RECONCILE_COOLDOWN_MS) {
    return { repairs: [] };
  }
  lastReconcileAt = now;

  const data = await getData();
  const threshold = opts?.thresholdMs ?? STALE_THRESHOLD_MS;
  const repairs: ReconcileRepair[] = [];
  const nowIso = new Date().toISOString();

  for (const task of data.tasks) {
    if (task.column !== "in-progress" || task.assignee !== "agent") continue;

    if (task.currentRunId) {
      // Has a run — check if stale
      const run = data.taskRuns.find((r) => r.id === task.currentRunId);
      if (!run) {
        // Orphan: currentRunId points to nonexistent run
        task.column = "blocked";
        task.blockReason = "Auto-reconciled: run record missing (data inconsistency)";
        task.currentRunId = undefined;
        task.updatedAt = nowIso;
        repairs.push({ taskId: task.id, runId: null, reason: "orphaned run pointer" });
      } else if (run.status === "active" && now - new Date(run.heartbeatAt).getTime() > threshold) {
        // Stale heartbeat
        run.status = "timeout";
        run.finishedAt = nowIso;
        run.terminalReason = "heartbeat expired";
        task.column = "blocked";
        task.blockReason = `Auto-reconciled: agent heartbeat expired (last: ${run.heartbeatAt})`;
        task.currentRunId = undefined;
        task.updatedAt = nowIso;
        repairs.push({ taskId: task.id, runId: run.id, reason: "heartbeat expired" });
      }
    } else {
      // Legacy: in-progress with no run record — check updatedAt age
      if (now - new Date(task.updatedAt).getTime() > threshold) {
        task.column = "blocked";
        task.blockReason = `Auto-reconciled: no active run (legacy task, last updated: ${task.updatedAt})`;
        task.updatedAt = nowIso;
        repairs.push({ taskId: task.id, runId: null, reason: "legacy task without run" });
      }
    }
  }

  if (repairs.length > 0) {
    // Log activities for each repair
    for (const repair of repairs) {
      const task = data.tasks.find((t) => t.id === repair.taskId);
      if (!task) continue;
      const activity: TaskActivityEntry = {
        id: generateId(),
        taskId: repair.taskId,
        taskTitle: task.title,
        action: "reconciled",
        fromColumn: "in-progress",
        toColumn: "blocked",
        actor: "system",
        details: `"${task.title}" auto-reconciled: ${repair.reason}`,
        timestamp: nowIso,
      };
      data.taskActivities.unshift(activity);
    }
    data.taskActivities = data.taskActivities.slice(0, 100);
    await saveData(data);
  }

  return { repairs };
}
