import { getData, saveData, generateId } from "./db";
import type { AppData, Task, TaskRun, TaskActivityEntry, Agent, ReasonCode } from "./types";

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

/**
 * Derive agent status from authoritative run state.
 * - Any active run → "running"
 * - No active runs → "idle"
 * Operates on the in-memory data object; caller is responsible for saveData().
 */
export function syncAgentStatus(agentId: string, data: AppData): void {
  const agent = data.team.agents.find((a) => a.id === agentId);
  if (!agent) return;

  const hasActiveRun = data.taskRuns.some(
    (r) => r.agentId === agentId && r.status === "active"
  );
  const derived = hasActiveRun ? "running" : "idle";

  if (agent.status !== derived) {
    agent.status = derived;
    agent.updatedAt = new Date().toISOString();
  }
}

export interface ReconcileRepair {
  taskId: string;
  runId: string | null;
  agentId: string | null;
  reason: string;
  reasonCode: ReasonCode;
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
        repairs.push({ taskId: task.id, runId: null, agentId: null, reason: "orphaned run pointer", reasonCode: "timeout-orphan" });
      } else if (run.status === "active" && now - new Date(run.heartbeatAt).getTime() > threshold) {
        // Stale heartbeat
        run.status = "timeout";
        run.finishedAt = nowIso;
        run.terminalReason = "heartbeat expired";
        run.reasonCode = "timeout-heartbeat";
        run.durationMs = new Date(nowIso).getTime() - new Date(run.claimedAt).getTime();
        task.column = "blocked";
        task.blockReason = `Auto-reconciled: agent heartbeat expired (last: ${run.heartbeatAt})`;
        task.currentRunId = undefined;
        task.updatedAt = nowIso;
        repairs.push({ taskId: task.id, runId: run.id, agentId: run.agentId, reason: "heartbeat expired", reasonCode: "timeout-heartbeat" });
      }
    } else {
      // Legacy: in-progress with no run record — check updatedAt age
      if (now - new Date(task.updatedAt).getTime() > threshold) {
        task.column = "blocked";
        task.blockReason = `Auto-reconciled: no active run (legacy task, last updated: ${task.updatedAt})`;
        task.updatedAt = nowIso;
        repairs.push({ taskId: task.id, runId: null, agentId: null, reason: "legacy task without run", reasonCode: "timeout-legacy" });
      }
    }
  }

  if (repairs.length > 0) {
    // Sync agent statuses for all affected agents
    const affectedAgentIds = new Set<string>();
    for (const repair of repairs) {
      const run = repair.runId ? data.taskRuns.find((r) => r.id === repair.runId) : null;
      if (run) affectedAgentIds.add(run.agentId);
    }
    for (const aid of affectedAgentIds) {
      syncAgentStatus(aid, data);
    }

    // Log activities for each repair
    for (const repair of repairs) {
      const task = data.tasks.find((t) => t.id === repair.taskId);
      if (!task) continue;
      const run = repair.runId ? data.taskRuns.find((r) => r.id === repair.runId) : null;
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
        runId: repair.runId ?? undefined,
        agentId: repair.agentId ?? undefined,
        attempt: run?.attempt,
        reasonCode: repair.reasonCode,
      };
      data.taskActivities.unshift(activity);
    }
    data.taskActivities = data.taskActivities.slice(0, 100);
    await saveData(data);
  }

  return { repairs };
}
