import { test, expect } from "@playwright/test";

test.describe("Task lifecycle reliability", () => {
  let agentId: string;

  test.beforeEach(async ({ page }) => {
    // Clean up tasks
    const res = await page.request.get("/api/tasks");
    const data = await res.json();
    for (const task of data.tasks || []) {
      await page.request.delete(`/api/tasks?id=${task.id}`);
    }

    // Ensure a test agent exists
    const agentsRes = await page.request.get("/api/team/agents");
    const agentsData = await agentsRes.json();
    const existing = (agentsData.agents || []).find(
      (a: { name: string }) => a.name === "lifecycle-test-agent"
    );
    if (existing) {
      agentId = existing.id;
    } else {
      const createRes = await page.request.post("/api/team/agents", {
        data: {
          name: "lifecycle-test-agent",
          role: "worker",
          description: "Test agent for lifecycle tests",
          model: "test-model",
        },
      });
      const created = await createRes.json();
      agentId = created.agent.id;
    }
  });

  test("reconciler moves stale in-progress task to blocked", async ({ page }) => {
    // Create agent task and claim it via lifecycle API
    const createRes = await page.request.post("/api/tasks", {
      data: { title: "Stale lifecycle task", description: "Should be reconciled", assignee: "agent" },
    });
    const { task } = await createRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    expect(claimRes.ok()).toBe(true);

    // Reconcile with thresholdMs=0 to treat any heartbeat as stale
    const reconcileRes = await page.request.post("/api/tasks/lifecycle/reconcile", {
      data: { thresholdMs: 0 },
    });
    const result = await reconcileRes.json();
    expect(result.repairedCount).toBeGreaterThanOrEqual(1);
    expect(result.repairs.some((r: { taskId: string }) => r.taskId === task.id)).toBe(true);

    // Verify task is now blocked
    const tasksRes = await page.request.get("/api/tasks");
    const tasks = await tasksRes.json();
    const updated = tasks.tasks.find((t: { id: string }) => t.id === task.id);
    expect(updated.column).toBe("blocked");
    expect(updated.blockReason).toContain("Auto-reconciled");
  });

  test("reconciler ignores healthy in-progress tasks", async ({ page }) => {
    // Claim task via lifecycle API
    const createRes = await page.request.post("/api/tasks", {
      data: { title: "Healthy lifecycle task", description: "Should not be reconciled", assignee: "agent" },
    });
    const { task } = await createRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    expect(claimRes.ok()).toBe(true);

    // Reconcile immediately — heartbeat is fresh
    const reconcileRes = await page.request.post("/api/tasks/lifecycle/reconcile");
    const result = await reconcileRes.json();
    expect(result.repairs.some((r: { taskId: string }) => r.taskId === task.id)).toBe(false);

    // Task still in-progress
    const tasksRes = await page.request.get("/api/tasks");
    const tasks = await tasksRes.json();
    const updated = tasks.tasks.find((t: { id: string }) => t.id === task.id);
    expect(updated.column).toBe("in-progress");
  });

  test("reconciler is idempotent", async ({ page }) => {
    const createRes = await page.request.post("/api/tasks", {
      data: { title: "Idempotent test task", description: "Test idempotency", assignee: "agent" },
    });
    const { task } = await createRes.json();

    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });

    // First reconcile with thresholdMs=0
    const res1 = await page.request.post("/api/tasks/lifecycle/reconcile", {
      data: { thresholdMs: 0 },
    });
    const result1 = await res1.json();
    expect(result1.repairedCount).toBeGreaterThanOrEqual(1);

    // Second reconcile — should find nothing (task is now blocked)
    const res2 = await page.request.post("/api/tasks/lifecycle/reconcile", {
      data: { thresholdMs: 0 },
    });
    const result2 = await res2.json();
    const sameTask = result2.repairs.filter((r: { taskId: string }) => r.taskId === task.id);
    expect(sameTask).toHaveLength(0);
  });

  test("reconciler ignores user-assigned in-progress tasks", async ({ page }) => {
    const createRes = await page.request.post("/api/tasks", {
      data: { title: "User task", description: "Should stay", assignee: "user" },
    });
    const { task } = await createRes.json();

    await page.request.post("/api/tasks/move", {
      data: { taskId: task.id, toColumn: "in-progress", actor: "user" },
    });

    const reconcileRes = await page.request.post("/api/tasks/lifecycle/reconcile", {
      data: { thresholdMs: 0 },
    });
    const result = await reconcileRes.json();
    expect(result.repairs.some((r: { taskId: string }) => r.taskId === task.id)).toBe(false);

    const tasksRes = await page.request.get("/api/tasks");
    const tasks = await tasksRes.json();
    const updated = tasks.tasks.find((t: { id: string }) => t.id === task.id);
    expect(updated.column).toBe("in-progress");
  });

  test("reconciler handles legacy tasks without run", async ({ page }) => {
    const createRes = await page.request.post("/api/tasks", {
      data: { title: "Legacy stuck task", description: "No run record", assignee: "agent" },
    });
    const { task } = await createRes.json();

    // Move to in-progress without using lifecycle (simulates legacy behavior)
    await page.request.post("/api/tasks/move", {
      data: { taskId: task.id, toColumn: "in-progress", actor: "agent" },
    });

    // Use thresholdMs=0 to treat any updatedAt as stale
    const reconcileRes = await page.request.post("/api/tasks/lifecycle/reconcile", {
      data: { thresholdMs: 0 },
    });
    const result = await reconcileRes.json();
    expect(result.repairs.some((r: { taskId: string }) => r.taskId === task.id)).toBe(true);

    const tasksRes = await page.request.get("/api/tasks");
    const tasks = await tasksRes.json();
    const updated = tasks.tasks.find((t: { id: string }) => t.id === task.id);
    expect(updated.column).toBe("blocked");
    expect(updated.blockReason).toContain("legacy task");
  });

  test("reconcile activity appears in activity feed", async ({ page }) => {
    const createRes = await page.request.post("/api/tasks", {
      data: { title: "Activity feed test", description: "Check activity", assignee: "agent" },
    });
    const { task } = await createRes.json();

    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });

    await page.request.post("/api/tasks/lifecycle/reconcile", {
      data: { thresholdMs: 0 },
    });

    const activitiesRes = await page.request.get("/api/tasks/activities");
    const { activities } = await activitiesRes.json();
    const reconcileActivity = activities.find(
      (a: { taskId: string; action: string }) => a.taskId === task.id && a.action === "reconciled"
    );
    expect(reconcileActivity).toBeTruthy();
    expect(reconcileActivity.actor).toBe("system");
    expect(reconcileActivity.details).toContain("auto-reconciled");
  });

  test("claim and finalize lifecycle round-trip", async ({ page }) => {
    const createRes = await page.request.post("/api/tasks", {
      data: { title: "Lifecycle round-trip", description: "Full cycle", assignee: "agent" },
    });
    const { task } = await createRes.json();

    // Claim
    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    expect(claimRes.ok()).toBe(true);
    const claimData = await claimRes.json();
    expect(claimData.task.column).toBe("in-progress");
    expect(claimData.run.status).toBe("active");
    const runId = claimData.run.id;

    // Heartbeat
    const hbRes = await page.request.post("/api/tasks/lifecycle/heartbeat", {
      data: { runId, agentId },
    });
    expect(hbRes.ok()).toBe(true);

    // Finalize success
    const finalizeRes = await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId, agentId, outcome: "success" },
    });
    expect(finalizeRes.ok()).toBe(true);
    const finalizeData = await finalizeRes.json();
    expect(finalizeData.task.column).toBe("review");
    expect(finalizeData.run.status).toBe("success");

    // Verify via GET (use poll to handle any caching/timing)
    await expect.poll(async () => {
      const tasksRes = await page.request.get("/api/tasks");
      const tasks = await tasksRes.json();
      const t = tasks.tasks.find((t: { id: string }) => t.id === task.id);
      return t?.column;
    }, { timeout: 5000 }).toBe("review");
  });
});
