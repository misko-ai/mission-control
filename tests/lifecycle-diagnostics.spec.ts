import { test, expect } from "@playwright/test";

test.describe("Lifecycle diagnostics payloads", () => {
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
      (a: { name: string }) => a.name === "diag-test-agent"
    );
    if (existing) {
      agentId = existing.id;
    } else {
      const createRes = await page.request.post("/api/team/agents", {
        data: {
          name: "diag-test-agent",
          role: "worker",
          description: "Agent for diagnostics tests",
          model: "test-model",
        },
      });
      const created = await createRes.json();
      agentId = created.agent.id;
    }
  });

  test("claim activity includes runId, agentId, and attempt", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Diag claim test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const actRes = await page.request.get("/api/tasks/activities");
    const { activities } = await actRes.json();
    const claimActivity = activities.find(
      (a: { taskId: string; action: string }) =>
        a.taskId === task.id && a.action === "picked-up"
    );
    expect(claimActivity).toBeTruthy();
    expect(claimActivity.runId).toBe(run.id);
    expect(claimActivity.agentId).toBe(agentId);
    expect(claimActivity.attempt).toBe(1);
    expect(claimActivity.summary).toContain("picked-up");
    expect(claimActivity.summary).toContain("attempt #1");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("finalize sets reasonCode, durationMs on run and propagates to activity", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Diag finalize test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const finalizeRes = await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run.id, agentId, outcome: "success" },
    });
    const finalizeData = await finalizeRes.json();
    expect(finalizeData.run.reasonCode).toBe("success");
    expect(typeof finalizeData.run.durationMs).toBe("number");
    expect(finalizeData.run.durationMs).toBeGreaterThanOrEqual(0);

    // Verify run via GET includes summary
    const runRes = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    const runData = await runRes.json();
    expect(runData.run.summary).toContain("Success");
    expect(runData.run.summary).toContain("attempt #1");
    expect(runData.run.summary).toContain("completed successfully");

    // Verify activity has diagnostics
    const actRes = await page.request.get("/api/tasks/activities");
    const { activities } = await actRes.json();
    const completedAct = activities.find(
      (a: { taskId: string; action: string }) =>
        a.taskId === task.id && a.action === "completed"
    );
    expect(completedAct.runId).toBe(run.id);
    expect(completedAct.agentId).toBe(agentId);
    expect(completedAct.attempt).toBe(1);
    expect(completedAct.reasonCode).toBe("success");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("failure finalize uses correct reason code", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Diag failure test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const finalizeRes = await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run.id, agentId, outcome: "failure", reason: "out of memory" },
    });
    const data = await finalizeRes.json();
    expect(data.run.reasonCode).toBe("failure");
    expect(data.run.terminalReason).toBe("out of memory");

    const runRes = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    const runData = await runRes.json();
    expect(runData.run.summary).toContain("Failure");
    expect(runData.run.summary).toContain("agent reported failure");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("timeout via reconciler sets timeout-heartbeat reason code", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Diag timeout test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    await page.request.post("/api/tasks/lifecycle/reconcile", {
      data: { thresholdMs: 0 },
    });

    // Verify run diagnostics
    const runRes = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    const runData = await runRes.json();
    expect(runData.run.reasonCode).toBe("timeout-heartbeat");
    expect(typeof runData.run.durationMs).toBe("number");
    expect(runData.run.summary).toContain("Timeout");
    expect(runData.run.summary).toContain("heartbeat expired");

    // Verify reconcile activity has structured diagnostics
    const actRes = await page.request.get("/api/tasks/activities");
    const { activities } = await actRes.json();
    const reconAct = activities.find(
      (a: { taskId: string; action: string }) =>
        a.taskId === task.id && a.action === "reconciled"
    );
    expect(reconAct.reasonCode).toBe("timeout-heartbeat");
    expect(reconAct.runId).toBe(run.id);
    expect(reconAct.agentId).toBe(agentId);
    expect(reconAct.attempt).toBe(1);

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("emergency override sets emergency-override reason code", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Diag emergency test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    await page.request.post("/api/tasks/move", {
      data: { taskId: task.id, toColumn: "blocked", actor: "user" },
    });

    const runRes = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    const runData = await runRes.json();
    expect(runData.run.reasonCode).toBe("emergency-override");
    expect(typeof runData.run.durationMs).toBe("number");
    expect(runData.run.summary).toContain("Cancelled");
    expect(runData.run.summary).toContain("operator emergency override");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("task deletion sets deleted reason code", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Diag delete test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    await page.request.delete(`/api/tasks?id=${task.id}`);

    const runRes = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    const runData = await runRes.json();
    expect(runData.run.reasonCode).toBe("deleted");
    expect(typeof runData.run.durationMs).toBe("number");
  });

  test("active run has summary with timing info", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Diag active test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const runRes = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    const runData = await runRes.json();
    expect(runData.run.summary).toContain("Active");
    expect(runData.run.summary).toContain("attempt #1");
    expect(runData.run.summary).toContain("claimed");
    expect(runData.run.summary).toContain("last heartbeat");
    // Active runs should not have reasonCode or durationMs
    expect(runData.run.reasonCode).toBeUndefined();
    expect(runData.run.durationMs).toBeUndefined();

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("run summary includes artifact count when present", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Diag artifact summary", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const bugRes = await page.request.post("/api/bugs", {
      data: { title: "Summary bug", screen: "Test", severity: "low" },
    });
    const { bug } = await bugRes.json();

    await page.request.post("/api/tasks/runs/link-artifacts", {
      data: { runId: run.id, bugIds: [bug.id] },
    });

    const runRes = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    const runData = await runRes.json();
    expect(runData.run.summary).toContain("1 linked artifact");

    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/bugs?id=${bug.id}`);
  });

  test("activities GET returns summary for all entries", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Diag activity summary", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const actRes = await page.request.get("/api/tasks/activities");
    const { activities } = await actRes.json();
    const createAct = activities.find(
      (a: { taskId: string; action: string }) =>
        a.taskId === task.id && a.action === "created"
    );
    expect(createAct).toBeTruthy();
    expect(typeof createAct.summary).toBe("string");
    expect(createAct.summary).toContain("[created]");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });
});
