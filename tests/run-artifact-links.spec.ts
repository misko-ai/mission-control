import { test, expect } from "@playwright/test";

test.describe("Task run artifact links", () => {
  let agentId: string;

  test.beforeEach(async ({ page }) => {
    // Clean up tasks (cascades to runs)
    const res = await page.request.get("/api/tasks");
    const data = await res.json();
    for (const task of data.tasks || []) {
      await page.request.delete(`/api/tasks?id=${task.id}`);
    }

    // Ensure a test agent exists
    const agentsRes = await page.request.get("/api/team/agents");
    const agentsData = await agentsRes.json();
    const existing = (agentsData.agents || []).find(
      (a: { name: string }) => a.name === "artifact-link-test-agent"
    );
    if (existing) {
      agentId = existing.id;
    } else {
      const createRes = await page.request.post("/api/team/agents", {
        data: {
          name: "artifact-link-test-agent",
          role: "worker",
          description: "Agent for artifact link tests",
          model: "test-model",
        },
      });
      const created = await createRes.json();
      agentId = created.agent.id;
    }
  });

  test("link-artifacts endpoint attaches bug, project, and doc IDs to a run", async ({ page }) => {
    // Create task and claim
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Link test task", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    // Create artifacts
    const bugRes = await page.request.post("/api/bugs", {
      data: { title: "Run-linked bug", screen: "Test", severity: "medium" },
    });
    const { bug } = await bugRes.json();

    const docRes = await page.request.post("/api/docs", {
      data: { title: "Run-linked doc", content: "Content", category: "other", format: "plain text" },
    });
    const { doc } = await docRes.json();

    const projRes = await page.request.post("/api/projects", {
      data: { name: "Run-linked project", description: "Test" },
    });
    const { project } = await projRes.json();

    // Link artifacts to run
    const linkRes = await page.request.post("/api/tasks/runs/link-artifacts", {
      data: {
        runId: run.id,
        bugIds: [bug.id],
        projectIds: [project.id],
        docIds: [doc.id],
      },
    });
    expect(linkRes.ok()).toBeTruthy();
    const linkData = await linkRes.json();
    expect(linkData.run.linkedBugIds).toContain(bug.id);
    expect(linkData.run.linkedProjectIds).toContain(project.id);
    expect(linkData.run.linkedDocIds).toContain(doc.id);

    // Verify via GET /api/tasks/runs?runId=
    const getRes = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    expect(getRes.ok()).toBeTruthy();
    const { run: fetched } = await getRes.json();
    expect(fetched.linkedBugIds).toContain(bug.id);
    expect(fetched.linkedProjectIds).toContain(project.id);
    expect(fetched.linkedDocIds).toContain(doc.id);

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/bugs?id=${bug.id}`);
    await page.request.delete(`/api/docs?id=${doc.id}`);
    await page.request.delete(`/api/projects?id=${project.id}`);
  });

  test("link-artifacts deduplicates IDs", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Dedup test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const bugRes = await page.request.post("/api/bugs", {
      data: { title: "Dup bug", screen: "Test", severity: "low" },
    });
    const { bug } = await bugRes.json();

    // Link same bug twice
    await page.request.post("/api/tasks/runs/link-artifacts", {
      data: { runId: run.id, bugIds: [bug.id] },
    });
    const linkRes = await page.request.post("/api/tasks/runs/link-artifacts", {
      data: { runId: run.id, bugIds: [bug.id] },
    });
    const { run: updated } = await linkRes.json();
    expect(updated.linkedBugIds.filter((id: string) => id === bug.id)).toHaveLength(1);

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/bugs?id=${bug.id}`);
  });

  test("finalize accepts artifact links and propagates to activity", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Finalize link test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    // Create artifacts
    const bugRes = await page.request.post("/api/bugs", {
      data: { title: "Finalize bug", screen: "Test", severity: "medium" },
    });
    const { bug } = await bugRes.json();

    const docRes = await page.request.post("/api/docs", {
      data: { title: "Finalize doc", content: "Notes", category: "other", format: "plain text" },
    });
    const { doc } = await docRes.json();

    // Finalize with artifact links
    const finalizeRes = await page.request.post("/api/tasks/lifecycle/finalize", {
      data: {
        runId: run.id,
        agentId,
        outcome: "success",
        linkedBugIds: [bug.id],
        linkedDocIds: [doc.id],
      },
    });
    expect(finalizeRes.ok()).toBeTruthy();
    const finalizeData = await finalizeRes.json();
    expect(finalizeData.run.linkedBugIds).toContain(bug.id);
    expect(finalizeData.run.linkedDocIds).toContain(doc.id);

    // Verify activity carries the links
    const actRes = await page.request.get("/api/tasks/activities");
    const { activities } = await actRes.json();
    const completedActivity = activities.find(
      (a: { taskId: string; action: string }) =>
        a.taskId === task.id && a.action === "completed"
    );
    expect(completedActivity).toBeTruthy();
    expect(completedActivity.linkedBugIds).toContain(bug.id);
    expect(completedActivity.linkedDocIds).toContain(doc.id);

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/bugs?id=${bug.id}`);
    await page.request.delete(`/api/docs?id=${doc.id}`);
  });

  test("GET /api/tasks/runs returns runs filterable by taskId", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Query runs test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    // Get all runs
    const allRes = await page.request.get("/api/tasks/runs");
    expect(allRes.ok()).toBeTruthy();
    const allData = await allRes.json();
    expect(allData.runs.some((r: { id: string }) => r.id === run.id)).toBeTruthy();

    // Filter by taskId
    const filteredRes = await page.request.get(`/api/tasks/runs?taskId=${task.id}`);
    const filteredData = await filteredRes.json();
    expect(filteredData.runs).toHaveLength(1);
    expect(filteredData.runs[0].id).toBe(run.id);

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("artifact links persist through cache clear", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Persist link test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const bugRes = await page.request.post("/api/bugs", {
      data: { title: "Persist bug", screen: "Test", severity: "low" },
    });
    const { bug } = await bugRes.json();

    await page.request.post("/api/tasks/runs/link-artifacts", {
      data: { runId: run.id, bugIds: [bug.id] },
    });

    // Clear cache (simulates restart)
    await page.request.post("/api/debug/clear-cache");

    // Verify links survive
    const getRes = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    const { run: fetched } = await getRes.json();
    expect(fetched.linkedBugIds).toContain(bug.id);

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/bugs?id=${bug.id}`);
  });

  test("backfill populates project links from existing project.linkedTaskIds", async ({ page }) => {
    // Create task, claim, create project linking to the task
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Backfill test", description: "Test", assignee: "agent" },
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

    // Link task to project
    await page.request.post("/api/projects/tasks", {
      data: { projectId: project.id, taskId: task.id },
    });

    // Clear cache — backfill runs during next getData() via applyDefaults
    await page.request.post("/api/debug/clear-cache");

    // Verify run now has project link from backfill
    const getRes = await page.request.get(`/api/tasks/runs?runId=${run.id}`);
    const { run: fetched } = await getRes.json();
    expect(fetched.linkedProjectIds).toContain(project.id);

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/projects?id=${project.id}`);
  });

  test("link-artifacts returns 400 with no artifact IDs", async ({ page }) => {
    const taskRes = await page.request.post("/api/tasks", {
      data: { title: "Validation test", description: "Test", assignee: "agent" },
    });
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    const { run } = await claimRes.json();

    const res = await page.request.post("/api/tasks/runs/link-artifacts", {
      data: { runId: run.id },
    });
    expect(res.status()).toBe(400);

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("link-artifacts returns 404 for unknown run", async ({ page }) => {
    const res = await page.request.post("/api/tasks/runs/link-artifacts", {
      data: { runId: "nonexistent", bugIds: ["some-id"] },
    });
    expect(res.status()).toBe(404);
  });
});
