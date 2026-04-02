import { test, expect } from "@playwright/test";

test.describe("Lifecycle UI readability", () => {
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
      (a: { name: string }) => a.name === "ui-test-agent"
    );
    if (existing) {
      agentId = existing.id;
    } else {
      const createRes = await page.request.post("/api/team/agents", {
        data: {
          name: "ui-test-agent",
          role: "worker",
          description: "Agent for UI lifecycle tests",
          model: "test-model",
        },
      });
      const created = await createRes.json();
      agentId = created.agent.id;
    }
  });

  test("GET /api/tasks enriches active runs with diagnostics", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Enrich active test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const tasksRes = await page.request.get("/api/tasks");
    const tasksData = await tasksRes.json();
    const enriched = tasksData.tasks.find((t: { id: string }) => t.id === task.id);

    expect(enriched.lastHeartbeat).toBeTruthy();
    expect(enriched.runAttempt).toBe(1);
    expect(enriched.runStatus).toBe("active");
    expect(enriched.runClaimedAt).toBe(run.claimedAt);

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("GET /api/tasks enriches terminal runs with last run diagnostics", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Enrich terminal test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run.id, agentId, outcome: "success" },
    });

    const tasksRes = await page.request.get("/api/tasks");
    const tasksData = await tasksRes.json();
    const enriched = tasksData.tasks.find((t: { id: string }) => t.id === task.id);

    expect(enriched.lastRunStatus).toBe("success");
    expect(enriched.lastRunReasonCode).toBe("success");
    expect(typeof enriched.lastRunDurationMs).toBe("number");
    expect(enriched.lastRunFinishedAt).toBeTruthy();
    expect(enriched.lastRunAttempt).toBe(1);
    // Should NOT have active run fields
    expect(enriched.runStatus).toBeUndefined();

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("GET /api/tasks includes artifact links on enriched runs", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Enrich artifacts test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const bugRes = await page.request.post("/api/bugs", {
      data: { title: "UI enrichment bug", screen: "Test", severity: "low" },
    });
    const { bug } = await bugRes.json();

    await page.request.post("/api/tasks/runs/link-artifacts", {
      data: { runId: run.id, bugIds: [bug.id] },
    });

    const tasksRes = await page.request.get("/api/tasks");
    const tasksData = await tasksRes.json();
    const enriched = tasksData.tasks.find((t: { id: string }) => t.id === task.id);

    expect(enriched.runLinkedBugIds).toContain(bug.id);

    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/bugs?id=${bug.id}`);
  });

  test("taskboard shows heartbeat indicator for active agent task", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "UI heartbeat test", description: "Test heartbeat display", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });

    await page.goto("/taskboard");
    await expect(page.getByRole("heading", { name: "UI heartbeat test" })).toBeVisible({ timeout: 10000 });

    // Should show attempt number on the task card
    await expect(page.locator("text=· #1").first()).toBeVisible();

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("taskboard shows terminal run status on completed task", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "UI terminal test", description: "Test terminal display", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run.id, agentId, outcome: "success" },
    });

    await page.goto("/taskboard");
    // Target the task card heading specifically
    await expect(page.getByRole("heading", { name: "UI terminal test" })).toBeVisible({ timeout: 10000 });

    // Should show success status on the task card
    await expect(page.locator(".text-success").filter({ hasText: "Success" }).first()).toBeVisible();

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("taskboard shows reason badge for reconciled activity", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "UI reconcile test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });

    await page.request.post("/api/tasks/lifecycle/reconcile", {
      data: { thresholdMs: 0 },
    });

    await page.goto("/taskboard");
    // Reason badge should appear in at least one activity feed entry or task card
    await expect(page.locator(".text-danger").filter({ hasText: "Timed out" }).first()).toBeVisible({ timeout: 10000 });

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("team page shows active run count for agent", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Team run count test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });

    await page.goto("/team");
    await expect(page.locator("text=ui-test-agent")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=1 active run")).toBeVisible({ timeout: 5000 });

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("dashboard shows active run count next to agent", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Dashboard run test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });

    await page.goto("/");
    await expect(page.locator("text=ui-test-agent")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=1 active run")).toBeVisible({ timeout: 5000 });

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });
});
