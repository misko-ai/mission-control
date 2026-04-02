import { test, expect } from "@playwright/test";

test.describe("Task runs and activities public API", () => {
  let agentId: string;
  const createdTaskIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Clean up tasks
    const res = await page.request.get("/api/tasks");
    const data = await res.json();
    for (const task of data.tasks || []) {
      await page.request.delete(`/api/tasks?id=${task.id}`);
    }
    createdTaskIds.length = 0;

    // Ensure test agent
    const agentsRes = await page.request.get("/api/team/agents");
    const agentsData = await agentsRes.json();
    const existing = (agentsData.agents || []).find(
      (a: { name: string }) => a.name === "api-test-agent"
    );
    if (existing) {
      agentId = existing.id;
    } else {
      const createRes = await page.request.post("/api/team/agents", {
        data: {
          name: "api-test-agent",
          role: "worker",
          description: "Agent for API tests",
          model: "test-model",
        },
      });
      const created = await createRes.json();
      agentId = created.agent.id;
    }
  });

  async function createAndClaim(page: import("@playwright/test").Page, title: string) {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title, description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();
    createdTaskIds.push(task.id);

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();
    return { task, run };
  }

  // ===== RUNS API =====

  test("runs: returns total, limit, offset in response", async ({ page }) => {
    await createAndClaim(page, "Pagination meta test");

    const res = await page.request.get("/api/tasks/runs");
    const data = await res.json();

    expect(typeof data.total).toBe("number");
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(typeof data.limit).toBe("number");
    expect(typeof data.offset).toBe("number");
    expect(data.runs.length).toBeLessThanOrEqual(data.limit);
  });

  test("runs: filter by agentId", async ({ page }) => {
    await createAndClaim(page, "Agent filter test");

    const res = await page.request.get(`/api/tasks/runs?agentId=${agentId}`);
    const data = await res.json();

    expect(data.total).toBeGreaterThanOrEqual(1);
    for (const run of data.runs) {
      expect(run.agentId).toBe(agentId);
    }

    // Non-existent agent should return 0
    const emptyRes = await page.request.get("/api/tasks/runs?agentId=nonexistent");
    const emptyData = await emptyRes.json();
    expect(emptyData.total).toBe(0);
    expect(emptyData.runs).toHaveLength(0);
  });

  test("runs: filter by status", async ({ page }) => {
    const { run } = await createAndClaim(page, "Status filter test");

    // Active filter
    const activeRes = await page.request.get("/api/tasks/runs?status=active");
    const activeData = await activeRes.json();
    expect(activeData.runs.some((r: { id: string }) => r.id === run.id)).toBeTruthy();

    // Finalize it
    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run.id, agentId, outcome: "success" },
    });

    // Success filter
    const successRes = await page.request.get("/api/tasks/runs?status=success");
    const successData = await successRes.json();
    expect(successData.runs.some((r: { id: string }) => r.id === run.id)).toBeTruthy();

    // Active filter should no longer include it
    const activeRes2 = await page.request.get("/api/tasks/runs?status=active");
    const activeData2 = await activeRes2.json();
    expect(activeData2.runs.some((r: { id: string }) => r.id === run.id)).toBeFalsy();
  });

  test("runs: active=true and terminal=true shortcuts", async ({ page }) => {
    const { run: activeRun } = await createAndClaim(page, "Active shortcut");
    const { run: termRun } = await createAndClaim(page, "Terminal shortcut");

    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: termRun.id, agentId, outcome: "failure", reason: "test" },
    });

    const activeRes = await page.request.get("/api/tasks/runs?active=true");
    const activeData = await activeRes.json();
    expect(activeData.runs.some((r: { id: string }) => r.id === activeRun.id)).toBeTruthy();
    expect(activeData.runs.some((r: { id: string }) => r.id === termRun.id)).toBeFalsy();

    const termRes = await page.request.get("/api/tasks/runs?terminal=true");
    const termData = await termRes.json();
    expect(termData.runs.some((r: { id: string }) => r.id === termRun.id)).toBeTruthy();
    expect(termData.runs.some((r: { id: string }) => r.id === activeRun.id)).toBeFalsy();
  });

  test("runs: filter by time range (since/until)", async ({ page }) => {
    const before = new Date().toISOString();
    await createAndClaim(page, "Time range test");
    const after = new Date().toISOString();

    // since=before should include it
    const sinceRes = await page.request.get(`/api/tasks/runs?since=${before}`);
    const sinceData = await sinceRes.json();
    expect(sinceData.total).toBeGreaterThanOrEqual(1);

    // until=far-past should exclude it
    const untilRes = await page.request.get("/api/tasks/runs?until=2020-01-01T00:00:00Z");
    const untilData = await untilRes.json();
    expect(untilData.total).toBe(0);

    // Combined range
    const rangeRes = await page.request.get(`/api/tasks/runs?since=${before}&until=${after}`);
    const rangeData = await rangeRes.json();
    expect(rangeData.total).toBeGreaterThanOrEqual(1);
  });

  test("runs: pagination with limit and offset", async ({ page }) => {
    // Create 3 runs
    await createAndClaim(page, "Page run 1");
    await createAndClaim(page, "Page run 2");
    await createAndClaim(page, "Page run 3");

    const page1 = await (await page.request.get("/api/tasks/runs?limit=2&offset=0")).json();
    expect(page1.runs.length).toBe(2);
    expect(page1.total).toBeGreaterThanOrEqual(3);

    const page2 = await (await page.request.get("/api/tasks/runs?limit=2&offset=2")).json();
    expect(page2.runs.length).toBeGreaterThanOrEqual(1);

    // No overlap
    const ids1 = page1.runs.map((r: { id: string }) => r.id);
    const ids2 = page2.runs.map((r: { id: string }) => r.id);
    for (const id of ids2) {
      expect(ids1).not.toContain(id);
    }
  });

  test("runs: sort by attempt ascending", async ({ page }) => {
    const { task: t1 } = await createAndClaim(page, "Sort attempt test");

    // Finalize then re-claim for attempt #2
    const runsRes1 = await (await page.request.get(`/api/tasks/runs?taskId=${t1.id}`)).json();
    const run1 = runsRes1.runs[0];
    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run1.id, agentId, outcome: "failure", reason: "retry" },
    });
    await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: t1.id, agentId },
    });

    const res = await (await page.request.get(`/api/tasks/runs?taskId=${t1.id}&sort=attempt&order=asc`)).json();
    expect(res.runs.length).toBe(2);
    expect(res.runs[0].attempt).toBeLessThanOrEqual(res.runs[1].attempt);
  });

  test("runs: combined filters", async ({ page }) => {
    const { run } = await createAndClaim(page, "Combined filter test");

    const res = await page.request.get(
      `/api/tasks/runs?agentId=${agentId}&active=true&limit=5`
    );
    const data = await res.json();
    expect(data.runs.some((r: { id: string }) => r.id === run.id)).toBeTruthy();
    expect(data.limit).toBe(5);
    for (const r of data.runs) {
      expect(r.agentId).toBe(agentId);
      expect(r.status).toBe("active");
    }
  });

  // ===== ACTIVITIES API =====

  test("activities: returns total, limit, offset", async ({ page }) => {
    await page.request.post("/api/tasks", {
      data: { title: "Activity meta test", description: "Test", assignee: "user" },
    });

    const res = await page.request.get("/api/tasks/activities");
    const data = await res.json();

    expect(typeof data.total).toBe("number");
    expect(typeof data.limit).toBe("number");
    expect(typeof data.offset).toBe("number");
  });

  test("activities: filter by taskId", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Activity taskId filter", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();
    createdTaskIds.push(task.id);

    const res = await page.request.get(`/api/tasks/activities?taskId=${task.id}`);
    const data = await res.json();
    expect(data.total).toBeGreaterThanOrEqual(1);
    for (const a of data.activities) {
      expect(a.taskId).toBe(task.id);
    }
  });

  test("activities: filter by action", async ({ page }) => {
    await createAndClaim(page, "Activity action filter");

    const res = await page.request.get("/api/tasks/activities?action=picked-up");
    const data = await res.json();
    expect(data.total).toBeGreaterThanOrEqual(1);
    for (const a of data.activities) {
      expect(a.action).toBe("picked-up");
    }
  });

  test("activities: filter by actor", async ({ page }) => {
    await createAndClaim(page, "Activity actor filter");

    // "created" activities are logged with actor=user, "picked-up" with actor=agent
    const agentRes = await page.request.get("/api/tasks/activities?actor=agent");
    const agentData = await agentRes.json();
    for (const a of agentData.activities) {
      expect(a.actor).toBe("agent");
    }
  });

  test("activities: filter by agentId", async ({ page }) => {
    await createAndClaim(page, "Activity agentId filter");

    const res = await page.request.get(`/api/tasks/activities?agentId=${agentId}`);
    const data = await res.json();
    expect(data.total).toBeGreaterThanOrEqual(1);
    for (const a of data.activities) {
      expect(a.agentId).toBe(agentId);
    }
  });

  test("activities: filter by reasonCode", async ({ page }) => {
    const { run } = await createAndClaim(page, "Activity reason filter");
    await page.request.post("/api/tasks/lifecycle/finalize", {
      data: { runId: run.id, agentId, outcome: "success" },
    });

    const res = await page.request.get("/api/tasks/activities?reasonCode=success");
    const data = await res.json();
    expect(data.total).toBeGreaterThanOrEqual(1);
    for (const a of data.activities) {
      expect(a.reasonCode).toBe("success");
    }
  });

  test("activities: pagination", async ({ page }) => {
    // Create multiple activities
    await createAndClaim(page, "Act page 1");
    await createAndClaim(page, "Act page 2");
    await createAndClaim(page, "Act page 3");

    const page1 = await (await page.request.get("/api/tasks/activities?limit=2&offset=0")).json();
    expect(page1.runs ?? page1.activities).toBeTruthy();
    expect(page1.activities.length).toBeLessThanOrEqual(2);

    const page2 = await (await page.request.get(`/api/tasks/activities?limit=2&offset=2`)).json();
    // No overlap
    const ids1 = page1.activities.map((a: { id: string }) => a.id);
    const ids2 = page2.activities.map((a: { id: string }) => a.id);
    for (const id of ids2) {
      expect(ids1).not.toContain(id);
    }
  });

  test("activities: sort order asc", async ({ page }) => {
    await createAndClaim(page, "Act sort test");

    const res = await (await page.request.get("/api/tasks/activities?order=asc")).json();
    if (res.activities.length >= 2) {
      const t0 = new Date(res.activities[0].timestamp).getTime();
      const t1 = new Date(res.activities[1].timestamp).getTime();
      expect(t0).toBeLessThanOrEqual(t1);
    }
  });

  test("activities: time range filter", async ({ page }) => {
    const before = new Date().toISOString();
    await createAndClaim(page, "Act time range");

    const res = await (await page.request.get(`/api/tasks/activities?since=${before}`)).json();
    expect(res.total).toBeGreaterThanOrEqual(1);

    const emptyRes = await (await page.request.get("/api/tasks/activities?until=2020-01-01T00:00:00Z")).json();
    expect(emptyRes.total).toBe(0);
  });

  test("runs: invalid params use sensible defaults", async ({ page }) => {
    const res = await page.request.get("/api/tasks/runs?limit=abc&offset=-5&sort=bogus&order=sideways");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.limit).toBe(50); // default
    expect(data.offset).toBe(0); // clamped
  });

  test("runs: single run lookup still works", async ({ page }) => {
    const { run } = await createAndClaim(page, "Single lookup");

    const res = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    const data = await res.json();
    // Single lookup returns { run } not { runs }
    expect(data.run).toBeTruthy();
    expect(data.run.id).toBe(run.id);
    expect(data.run.summary).toBeTruthy();
  });

  test("runs: each run includes summary field", async ({ page }) => {
    await createAndClaim(page, "Summary field test");

    const res = await (await page.request.get("/api/tasks/runs")).json();
    for (const run of res.runs) {
      expect(typeof run.summary).toBe("string");
      expect(run.summary.length).toBeGreaterThan(0);
    }
  });

  test("activities: each activity includes summary field", async ({ page }) => {
    await createAndClaim(page, "Activity summary test");

    const res = await (await page.request.get("/api/tasks/activities")).json();
    for (const a of res.activities) {
      expect(typeof a.summary).toBe("string");
      expect(a.summary.length).toBeGreaterThan(0);
    }
  });
});
