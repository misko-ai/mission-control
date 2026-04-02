import type { TaskRun, TaskActivityEntry } from "./types";

const REASON_LABELS: Record<string, string> = {
  success: "completed successfully",
  failure: "agent reported failure",
  cancelled: "cancelled by agent",
  "timeout-heartbeat": "heartbeat expired (auto-reconciled)",
  "timeout-orphan": "orphaned run pointer (auto-reconciled)",
  "timeout-legacy": "legacy task without run (auto-reconciled)",
  deleted: "task was deleted",
  "emergency-override": "operator emergency override",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM ? `${h}h ${remM}m` : `${h}h`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  return `${formatDuration(ms)} ago`;
}

export function buildRunSummary(run: TaskRun): string {
  const parts: string[] = [];

  if (run.status === "active") {
    parts.push(`Active — attempt #${run.attempt}`);
    parts.push(`claimed ${timeAgo(run.claimedAt)}`);
    parts.push(`last heartbeat ${timeAgo(run.heartbeatAt)}`);
  } else {
    const label = run.status.charAt(0).toUpperCase() + run.status.slice(1);
    parts.push(`${label} — attempt #${run.attempt}`);
    if (run.durationMs != null) {
      parts.push(`ran for ${formatDuration(run.durationMs)}`);
    }
    if (run.reasonCode && REASON_LABELS[run.reasonCode]) {
      parts.push(REASON_LABELS[run.reasonCode]);
    } else if (run.terminalReason) {
      parts.push(run.terminalReason);
    }
  }

  const artifactCount =
    (run.linkedBugIds?.length ?? 0) +
    (run.linkedProjectIds?.length ?? 0) +
    (run.linkedDocIds?.length ?? 0);
  if (artifactCount > 0) {
    parts.push(`${artifactCount} linked artifact${artifactCount > 1 ? "s" : ""}`);
  }

  return parts.join(", ");
}

export function buildActivitySummary(entry: TaskActivityEntry): string {
  const parts: string[] = [];

  parts.push(`[${entry.action}]`);
  parts.push(`"${entry.taskTitle}"`);

  if (entry.fromColumn && entry.toColumn) {
    parts.push(`${entry.fromColumn} → ${entry.toColumn}`);
  } else if (entry.toColumn) {
    parts.push(`→ ${entry.toColumn}`);
  }

  if (entry.actor !== "user") {
    parts.push(`by ${entry.actor}`);
  }

  if (entry.attempt != null) {
    parts.push(`(attempt #${entry.attempt})`);
  }

  if (entry.reasonCode && REASON_LABELS[entry.reasonCode]) {
    parts.push(`— ${REASON_LABELS[entry.reasonCode]}`);
  }

  return parts.join(" ");
}
