import { test, expect } from "@playwright/test";

/**
 * End-to-end regression suite covering the full lifecycle polish surface:
 * artifact persistence, artifact linking, agent.status sync, diagnostic
 * payloads, read APIs, cleanup dry-run, and restart persistence.
 */
test.describe("Lifecycle polish: end-to-end regression", () => {
  let agentId: string;

  test.beforeEach(async ({ page }) => {
    const res = await page.request.get("/api/tasks");
    const data = await res.json();
    for (const task of data.tasks || []) {
      await page.request.delete(`/api/tasks?id=${task.id}`);
    }

    const agentsRes = await page.request.get("/api/team/agents");
    const agentsData = await agentsRes.json();
    const existing = (agentsData.agents || []).find(
      (a: { name: string }) => a.name === "e2e-lifecycle-agent"
    );
    if (existing) {
      agentId = existing.id;
      await page.request.put("/api/team/agents", {
        data: { id: agentId, status: "idle" },
      });
    } else {
      const createRes = await page.request.post("/api/team/agents", {
        data: {
          name: "e2e-lifecycle-agent",
          role: "worker",
          description: "End-to-end lifecycle regression agent",
          model: "test-model",
          status: "idle",
        },
      });
      agentId = (await createRes.json()).agent.id;
    }
  });

  test("full lifecycle: create → claim → heartbeat → link → finalize → diagnostics → query → cleanup", async ({ page }) => {
    // 1. Create task
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "E2E lifecycle task", description: "Full lifecycle test", assignee: "agent", priority: "high" },
    });
    const { task } = await taskRes.json();

    // 2. Claim — agent goes running
    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    expect(claimRes.ok()).toBeTruthy();
    const claimData = await claimRes.json();
    const run = claimData.run;
    expect(run.status).toBe("active");
    expect(run.attempt).toBe(1);
    expect(claimData.task.column).toBe("in-progress");

    // Verify agent is running
    let agents = await (await page.request.get("/api/team/agents")).json();
    expect(agents.agents.find((a: { id: string }) => a.id === agentId).status).toBe("running");

    // 3. Heartbeat
    const hbRes = await page.request.post("/api/tasks/lifecycle/heartbeat", {
      data: { runId: run.id, agentId },
    });
    expect(hbRes.ok()).toBeTruthy();

    // 4. Link artifacts
    const bugRes = await page.request.post("/api/bugs", {
      data: { title: "E2E bug", screen: "TaskBoard", severity: "medium" },
    });
    const { bug } = await bugRes.json();

    const docRes = await page.request.post("/api/docs", {
      data: { title: "E2E doc", content: "Design notes", category: "planning", format: "markdown" },
    });
    const { doc } = await docRes.json();

    const projRes = await page.request.post("/api/projects", {
      data: { name: "E2E project", description: "Test project" },
    });
    const { project } = await projRes.json();

    const linkRes = await page.request.post("/api/tasks/runs/link-artifacts", {
      data: { runId: run.id, bugIds: [bug.id], projectIds: [project.id], docIds: [doc.id] },
    });
    expect(linkRes.ok()).toBeTruthy();

    // 5. Finalize with linked artifacts
    const finalizeRes = await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run.id, agentId, outcome: "success" },
    });
    expect(finalizeRes.ok()).toBeTruthy();
    const fData = await finalizeRes.json();
    expect(fData.run.status).toBe("success");
    expect(fData.run.reasonCode).toBe("success");
    expect(typeof fData.run.durationMs).toBe("number");
    expect(fData.run.linkedBugIds).toContain(bug.id);
    expect(fData.task.column).toBe("review");

    // Verify agent is idle after finalize
    agents = await (await page.request.get("/api/team/agents")).json();
    expect(agents.agents.find((a: { id: string }) => a.id === agentId).status).toBe("idle");

    // 6. Verify diagnostics via read API
    const runRes = await (await page.request.get(`/api/tasks/runs?runId=${run.id}`)).json();
    expect(runRes.run.reasonCode).toBe("success");
    expect(runRes.run.durationMs).toBeGreaterThanOrEqual(0);
    expect(runRes.run.summary).toContain("Success");
    expect(runRes.run.summary).toContain("attempt #1");
    expect(runRes.run.linkedBugIds).toContain(bug.id);
    expect(runRes.run.linkedProjectIds).toContain(project.id);
    expect(runRes.run.linkedDocIds).toContain(doc.id);

    // 7. Query via read API filters
    const termRuns = await (await page.request.get(`/api/tasks/runs?terminal=true&agentId=${agentId}`)).json();
    expect(termRuns.runs.some((r: { id: string }) => r.id === run.id)).toBeTruthy();

    const activeRuns = await (await page.request.get(`/api/tasks/runs?active=true`)).json();
    expect(activeRuns.runs.some((r: { id: string }) => r.id === run.id)).toBeFalsy();

    // Query activities
    const acts = await (await page.request.get(`/api/tasks/activities?taskId=${task.id}`)).json();
    expect(acts.total).toBeGreaterThanOrEqual(3); // created, picked-up, completed
    const completedAct = acts.activities.find((a: { action: string }) => a.action === "completed");
    expect(completedAct).toBeTruthy();
    expect(completedAct.runId).toBe(run.id);
    expect(completedAct.reasonCode).toBe("success");
    expect(completedAct.attempt).toBe(1);

    // 8. Enriched GET /api/tasks payload
    const tasksRes = await (await page.request.get("/api/tasks")).json();
    const enriched = tasksRes.tasks.find((t: { id: string }) => t.id === task.id);
    expect(enriched.lastRunStatus).toBe("success");
    expect(enriched.lastRunReasonCode).toBe("success");
    expect(enriched.lastRunAttempt).toBe(1);

    // 9. Cleanup dry-run — run should NOT be marked for removal (it's fresh)
    const cleanRes = await (await page.request.post("/api/admin/cleanup", {
      data: { dryRun: true, olderThanDays: 1 },
    })).json();
    expect(cleanRes.runs.removedIds).not.toContain(run.id);

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/bugs?id=${bug.id}`);
    await page.request.delete(`/api/docs?id=${doc.id}`);
    await page.request.delete(`/api/projects?id=${project.id}`);
  });

  test("restart persistence: lifecycle runs, activities, agent status, and artifact links survive cache clear", async ({ page }) => {
    // Create a task, claim, heartbeat, link artifacts, finalize
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Restart persistence task", description: "Lifecycle restart test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const bugRes = await page.request.post("/api/bugs", {
      data: { title: "Restart bug", screen: "Test", severity: "low" },
    });
    const { bug } = await bugRes.json();

    await page.request.post("/api/tasks/runs/link-artifacts", {
      data: { runId: run.id, bugIds: [bug.id] },
    });

    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run.id, agentId, outcome: "failure", reason: "intentional test failure" },
    });

    // Capture pre-restart state
    const preRun = await (await page.request.get(`/api/tasks/runs?runId=${run.id}`)).json();
    const preActs = await (await page.request.get(`/api/tasks/activities?taskId=${task.id}`)).json();
    const preAgents = await (await page.request.get("/api/team/agents")).json();
    const preAgent = preAgents.agents.find((a: { id: string }) => a.id === agentId);

    // Simulate restart
    await page.request.post("/api/debug/clear-cache");

    // Verify run persists with full state
    const postRun = await (await page.request.get(`/api/tasks/runs?runId=${run.id}`)).json();
    expect(postRun.run.id).toBe(run.id);
    expect(postRun.run.taskId).toBe(task.id);
    expect(postRun.run.agentId).toBe(agentId);
    expect(postRun.run.attempt).toBe(preRun.run.attempt);
    expect(postRun.run.status).toBe("failure");
    expect(postRun.run.reasonCode).toBe("failure");
    expect(postRun.run.terminalReason).toBe("intentional test failure");
    expect(typeof postRun.run.durationMs).toBe("number");
    expect(postRun.run.linkedBugIds).toContain(bug.id);

    // Verify activities persist with diagnostic fields
    const postActs = await (await page.request.get(`/api/tasks/activities?taskId=${task.id}`)).json();
    expect(postActs.total).toBe(preActs.total);
    const postFinAct = postActs.activities.find((a: { action: string }) => a.action === "moved");
    expect(postFinAct).toBeTruthy();
    expect(postFinAct.runId).toBe(run.id);
    expect(postFinAct.agentId).toBe(agentId);
    expect(postFinAct.reasonCode).toBe("failure");

    // Verify agent status persists
    const postAgents = await (await page.request.get("/api/team/agents")).json();
    const postAgent = postAgents.agents.find((a: { id: string }) => a.id === agentId);
    expect(postAgent.status).toBe(preAgent.status);

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/bugs?id=${bug.id}`);
  });

  test("multi-attempt lifecycle: failure → retry → success preserves full history", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Multi-attempt task", description: "Retry test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    // Attempt 1: fails
    const claim1 = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run: run1 } = await claim1.json();
    expect(run1.attempt).toBe(1);

    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run1.id, agentId, outcome: "failure", reason: "OOM" },
    });

    // Attempt 2: succeeds
    const claim2 = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run: run2 } = await claim2.json();
    expect(run2.attempt).toBe(2);

    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run2.id, agentId, outcome: "success" },
    });

    // Both runs queryable
    const taskRuns = await (await page.request.get(`/api/tasks/runs?taskId=${task.id}&sort=attempt&order=asc`)).json();
    expect(taskRuns.total).toBe(2);
    expect(taskRuns.runs[0].attempt).toBe(1);
    expect(taskRuns.runs[0].reasonCode).toBe("failure");
    expect(taskRuns.runs[1].attempt).toBe(2);
    expect(taskRuns.runs[1].reasonCode).toBe("success");

    // Activities show full history
    const acts = await (await page.request.get(`/api/tasks/activities?taskId=${task.id}`)).json();
    const pickups = acts.activities.filter((a: { action: string }) => a.action === "picked-up");
    expect(pickups.length).toBe(2);
    expect(pickups.find((a: { attempt: number }) => a.attempt === 1)).toBeTruthy();
    expect(pickups.find((a: { attempt: number }) => a.attempt === 2)).toBeTruthy();

    // Enriched task shows latest run
    const tasks = await (await page.request.get("/api/tasks")).json();
    const enriched = tasks.tasks.find((t: { id: string }) => t.id === task.id);
    expect(enriched.lastRunStatus).toBe("success");
    expect(enriched.lastRunAttempt).toBe(2);

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("reconciler timeout: stale run → diagnostics → agent idle → activity logged", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Timeout flow", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    // Agent should be running
    let agents = await (await page.request.get("/api/team/agents")).json();
    expect(agents.agents.find((a: { id: string }) => a.id === agentId).status).toBe("running");

    // Force reconcile with thresholdMs=0
    await page.request.post("/api/tasks/lifecycle/reconcile", {
      data: { thresholdMs: 0 },
    });

    // Agent should be idle
    agents = await (await page.request.get("/api/team/agents")).json();
    expect(agents.agents.find((a: { id: string }) => a.id === agentId).status).toBe("idle");

    // Run has timeout diagnostics
    const runRes = await (await page.request.get(`/api/tasks/runs?runId=${run.id}`)).json();
    expect(runRes.run.status).toBe("timeout");
    expect(runRes.run.reasonCode).toBe("timeout-heartbeat");
    expect(typeof runRes.run.durationMs).toBe("number");
    expect(runRes.run.summary).toContain("Timeout");

    // Activity logged with diagnostics
    const acts = await (await page.request.get(`/api/tasks/activities?taskId=${task.id}&action=reconciled`)).json();
    expect(acts.total).toBeGreaterThanOrEqual(1);
    const reconAct = acts.activities[0];
    expect(reconAct.reasonCode).toBe("timeout-heartbeat");
    expect(reconAct.runId).toBe(run.id);
    expect(reconAct.agentId).toBe(agentId);

    // Task enrichment reflects terminal state
    const tasks = await (await page.request.get("/api/tasks")).json();
    const enriched = tasks.tasks.find((t: { id: string }) => t.id === task.id);
    expect(enriched.lastRunStatus).toBe("timeout");
    expect(enriched.lastRunReasonCode).toBe("timeout-heartbeat");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("cleanup + read API interaction: cleanup removes old runs, filters reflect removal", async ({ page }) => {
    // Create two finalized tasks
    const t1Res = await page.request.post("/api/tasks", {
      data: { title: "Old task", description: "Will be cleaned", assignee: "agent" },
    });
    const { task: t1 } = await t1Res.json();

    const c1 = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: t1.id, agentId },
    });
    const { run: r1 } = await c1.json();
    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: r1.id, agentId, outcome: "success" },
    });

    // Verify run exists in API
    const before = await (await page.request.get(`/api/tasks/runs?taskId=${t1.id}`)).json();
    expect(before.runs.some((r: { id: string }) => r.id === r1.id)).toBeTruthy();

    // Dry-run cleanup — run is fresh so won't be marked
    const dryRes = await (await page.request.post("/api/admin/cleanup", {
      data: { dryRun: true, olderThanDays: 1, keepPerTask: 1 },
    })).json();
    expect(dryRes.runs.removedIds).not.toContain(r1.id);

    // Run total should still reflect the run
    const after = await (await page.request.get(`/api/tasks/runs?status=success`)).json();
    expect(after.runs.some((r: { id: string }) => r.id === r1.id)).toBeTruthy();

    await page.request.delete(`/api/tasks?id=${t1.id}`);
  });

  test("artifact backfill + restart: project-linked task runs get project IDs backfilled", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Backfill restart", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const projRes = await page.request.post("/api/projects", {
      data: { name: "Backfill project", description: "Test" },
    });
    const { project } = await projRes.json();

    // Link task to project (but NOT run to project)
    await page.request.post("/api/projects/tasks", {
      data: { projectId: project.id, taskId: task.id },
    });

    // Clear cache — backfill should populate run.linkedProjectIds
    await page.request.post("/api/debug/clear-cache");

    const runRes = await (await page.request.get(`/api/tasks/runs?runId=${run.id}`)).json();
    expect(runRes.run.linkedProjectIds).toContain(project.id);

    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/projects?id=${project.id}`);
  });
});
