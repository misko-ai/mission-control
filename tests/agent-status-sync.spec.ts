import { test, expect } from "@playwright/test";

test.describe("Agent status auto-sync from lifecycle state", () => {
  let agentId: string;

  test.beforeEach(async ({ page }) => {
    // Clean up tasks
    const res = await page.request.get("/api/tasks");
    const data = await res.json();
    for (const task of data.tasks || []) {
      await page.request.delete(`/api/tasks?id=${task.id}`);
    }

    // Ensure a test agent exists (starts idle)
    const agentsRes = await page.request.get("/api/team/agents");
    const agentsData = await agentsRes.json();
    const existing = (agentsData.agents || []).find(
      (a: { name: string }) => a.name === "status-sync-test-agent"
    );
    if (existing) {
      agentId = existing.id;
      // Reset to idle
      await page.request.put("/api/team/agents", {
        data: { id: agentId, status: "idle" },
      });
    } else {
      const createRes = await page.request.post("/api/team/agents", {
        data: {
          name: "status-sync-test-agent",
          role: "worker",
          description: "Agent for status sync tests",
          model: "test-model",
          status: "idle",
        },
      });
      const created = await createRes.json();
      agentId = created.agent.id;
    }
  });

  async function getAgentStatus(page: import("@playwright/test").Page): Promise<string> {
    const res = await page.request.get("/api/team/agents");
    const data = await res.json();
    const agent = data.agents.find((a: { id: string }) => a.id === agentId);
    return agent.status;
  }

  test("claim sets agent status to running", async ({ page }) => {
    expect(await getAgentStatus(page)).toBe("idle");

    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Status claim test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });

    expect(await getAgentStatus(page)).toBe("running");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("heartbeat keeps agent status as running", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Status heartbeat test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    await page.request.post("/api/tasks/lifecycle/heartbeat", {
      data: { runId: run.id, agentId },
    });

    expect(await getAgentStatus(page)).toBe("running");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("heartbeat restores running if agent was manually set to offline", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Offline override test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    // Manually set to offline while run is active
    await page.request.put("/api/team/agents", {
      data: { id: agentId, status: "offline" },
    });
    expect(await getAgentStatus(page)).toBe("offline");

    // Heartbeat should correct it back to running
    await page.request.post("/api/tasks/lifecycle/heartbeat", {
      data: { runId: run.id, agentId },
    });
    expect(await getAgentStatus(page)).toBe("running");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("finalize success sets agent status to idle", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Status finalize test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();
    expect(await getAgentStatus(page)).toBe("running");

    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run.id, agentId, outcome: "success" },
    });

    expect(await getAgentStatus(page)).toBe("idle");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("finalize failure sets agent status to idle", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Failure finalize test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run.id, agentId, outcome: "failure", reason: "test failure" },
    });

    expect(await getAgentStatus(page)).toBe("idle");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("timeout via reconciler sets agent status to idle", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Status timeout test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    expect(await getAgentStatus(page)).toBe("running");

    // Force reconcile with thresholdMs=0 to treat heartbeat as stale
    await page.request.post("/api/tasks/lifecycle/reconcile", {
      data: { thresholdMs: 0 },
    });

    expect(await getAgentStatus(page)).toBe("idle");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("agent stays running if it has other active runs after one finalizes", async ({ page }) => {
    // Create two tasks
    const task1Res = await page.request.post("/api/tasks", {
      data: { title: "Multi-run task 1", description: "Test", assignee: "agent" },
    });
    const { task: task1 } = await task1Res.json();

    const task2Res = await page.request.post("/api/tasks", {
      data: { title: "Multi-run task 2", description: "Test", assignee: "agent" },
    });
    const { task: task2 } = await task2Res.json();

    // Claim both
    const claim1Res = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task1.id, agentId },
    });
    const { run: run1 } = await claim1Res.json();

    const claim2Res = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task2.id, agentId },
    });
    await claim2Res.json();

    expect(await getAgentStatus(page)).toBe("running");

    // Finalize first run — agent should stay running (second run still active)
    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run1.id, agentId, outcome: "success" },
    });

    expect(await getAgentStatus(page)).toBe("running");

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task1.id}`);
    await page.request.delete(`/api/tasks?id=${task2.id}`);
  });

  test("emergency move to blocked sets agent status to idle", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Emergency cancel test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    expect(await getAgentStatus(page)).toBe("running");

    // Emergency override to blocked
    await page.request.post("/api/tasks/move", {
      data: { taskId: task.id, toColumn: "blocked", actor: "user" },
    });

    expect(await getAgentStatus(page)).toBe("idle");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("task deletion cancels run and sets agent to idle", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Delete cancel test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    expect(await getAgentStatus(page)).toBe("running");

    await page.request.delete(`/api/tasks?id=${task.id}`);

    expect(await getAgentStatus(page)).toBe("idle");
  });

  test("sync is idempotent — duplicate heartbeats do not cause issues", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Idempotent test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    // Send multiple heartbeats
    for (let i = 0; i < 3; i++) {
      const res = await page.request.post("/api/tasks/lifecycle/heartbeat", {
        data: { runId: run.id, agentId },
      });
      expect(res.ok()).toBeTruthy();
    }

    expect(await getAgentStatus(page)).toBe("running");

    await page.request.delete(`/api/tasks?id=${task.id}`);
  });
});
