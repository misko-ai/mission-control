# Mission Control — Lifecycle Operations Runbook

Quick reference for inspecting task runs, finding related artifacts, verifying agent status, and running cleanup.

---

## Inspect a task run

**Find the current or most recent run for a task:**

```
GET /api/tasks/runs?taskId=<taskId>
```

Each run includes:
- `status` — active, success, failure, timeout, cancelled
- `reasonCode` — standardized reason (success, failure, cancelled, timeout-heartbeat, timeout-orphan, timeout-legacy, deleted, emergency-override)
- `durationMs` — how long the run lasted (terminal runs only)
- `attempt` — attempt number (increments on retry)
- `summary` — human-readable one-line description
- `claimedAt`, `heartbeatAt`, `finishedAt` — timestamps

**Get a specific run by ID:**

```
GET /api/tasks/runs?runId=<runId>
```

**List only active runs (across all tasks):**

```
GET /api/tasks/runs?active=true
```

**List failed/timed-out runs for an agent:**

```
GET /api/tasks/runs?agentId=<agentId>&terminal=true&status=failure
```

---

## Find related artifacts

Runs can have linked bugs, projects, and docs. These appear in the run payload:

```json
{
  "linkedBugIds": ["bug-1"],
  "linkedProjectIds": ["proj-1"],
  "linkedDocIds": ["doc-1"]
}
```

**To see what artifacts a run produced:**

```
GET /api/tasks/runs?runId=<runId>
→ check linkedBugIds, linkedProjectIds, linkedDocIds
```

**To fetch the artifacts themselves:**

```
GET /api/bugs          → find by ID in response
GET /api/projects      → find by ID in response
GET /api/docs          → find by ID in response
```

**Artifacts can also be linked during finalize:**

```
POST /api/tasks/lifecycle/finalize
{ "runId": "...", "agentId": "...", "outcome": "success",
  "linkedBugIds": ["..."], "linkedDocIds": ["..."] }
```

**Or linked after the fact:**

```
POST /api/tasks/runs/link-artifacts
{ "runId": "...", "bugIds": ["..."], "projectIds": ["..."], "docIds": ["..."] }
```

---

## Verify agent status projection

Agent status is **auto-synced** from active runs. No manual status changes are needed.

**Rules:**
- Agent has any active run → status = `running`
- Agent has no active runs → status = `idle`
- `offline` is a manual override; lifecycle events will correct it if the agent is demonstrably active

**Check an agent's current status:**

```
GET /api/team/agents
→ each agent has { status: "running" | "idle" | "offline" }
```

**Diagnose a stuck "running" agent:**

1. Check if the agent has active runs:
   ```
   GET /api/tasks/runs?agentId=<agentId>&active=true
   ```
2. If runs exist but heartbeat is stale, force reconciliation:
   ```
   POST /api/tasks/lifecycle/reconcile
   { "thresholdMs": 0 }
   ```
   This will time out stale runs and set the agent to idle.

3. If no active runs but agent shows "running", any lifecycle event (claim, heartbeat, finalize) will correct it. Or force a reconcile as above.

**Diagnose an agent stuck "idle" that should be working:**

1. Check if the agent's task is still in backlog:
   ```
   GET /api/tasks
   → find tasks assigned to agent, check column
   ```
2. Check recent activities for the agent:
   ```
   GET /api/tasks/activities?agentId=<agentId>&limit=10
   ```

---

## Review activity history

**All activities for a task (creation, moves, claims, completions, reconciliation):**

```
GET /api/tasks/activities?taskId=<taskId>
```

**System reconciliation events:**

```
GET /api/tasks/activities?action=reconciled
```

**Agent-specific activity (what did this agent do?):**

```
GET /api/tasks/activities?agentId=<agentId>&actor=agent
```

**Activities with a specific outcome:**

```
GET /api/tasks/activities?reasonCode=timeout-heartbeat
```

Each activity includes a `summary` field for quick scanning.

---

## Run cleanup safely

Cleanup removes old terminal runs and activities while protecting active state.

**Step 1 — Always dry-run first:**

```
POST /api/admin/cleanup
{ "dryRun": true, "olderThanDays": 14 }
```

Review the response:
- `runs.removed` / `runs.kept` — how many runs would be deleted vs kept
- `runs.protectedActive` — active runs that are safe
- `runs.protectedPerTask` — recent runs per task that are preserved
- `runs.removedIds` — exact IDs that would be deleted
- `activities.removed` / `activities.kept` — same for activities

**Step 2 — Execute if satisfied:**

```
POST /api/admin/cleanup
{ "dryRun": false, "olderThanDays": 14 }
```

**Safety guarantees (always enforced):**
- Active runs are never deleted
- Runs referenced by `task.currentRunId` are never deleted
- The N most recent terminal runs per task are kept (default: 3)
- The N most recent activities are kept regardless of age (default: 20)
- Cleanup is logged as an audit activity entry

**Configurable params:**

| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `olderThanDays` | 7 | 1–365 | Age threshold for removal |
| `keepPerTask` | 3 | 1–50 | Recent terminal runs to keep per task |
| `keepMinActivities` | 20 | 5–100 | Recent activities to always keep |

**To verify cleanup worked:**

```
GET /api/tasks/runs?terminal=true
→ old runs should be gone

GET /api/tasks/activities?action=reconciled&actor=system
→ look for "Cleanup removed N run(s) and M activity/ies" entry
```

---

## Quick diagnostic checklist

| Symptom | Check | Fix |
|---------|-------|-----|
| Task stuck in-progress | `GET /api/tasks/runs?taskId=<id>&active=true` | Force reconcile: `POST /api/tasks/lifecycle/reconcile { "thresholdMs": 0 }` |
| Agent stuck running | `GET /api/tasks/runs?agentId=<id>&active=true` | Force reconcile (same as above) |
| Run shows no reason | `GET /api/tasks/runs?runId=<id>` — check `reasonCode` | Old runs may lack `reasonCode`; backfill happens on restart |
| Missing artifact links | `GET /api/tasks/runs?runId=<id>` — check linked arrays | Link manually: `POST /api/tasks/runs/link-artifacts` |
| Activities disappeared | `GET /api/tasks/activities?limit=100` | Check if cleanup ran: filter `?action=reconciled&actor=system` |
| Data looks stale | `POST /api/debug/clear-cache` (dev only) | Forces reload from disk |
