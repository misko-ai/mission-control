import { test, expect } from "@playwright/test";

test.describe("Persistence: data survives cache clear (simulated restart)", () => {
  test("task persists after cache clear", async ({ page }) => {
    // Create
    const createRes = await page.request.post("/api/tasks", {
      data: {
        title: "Persistence test task",
        description: "Should survive restart",
        assignee: "user",
        priority: "medium",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { task } = await createRes.json();

    // Verify exists
    const beforeRes = await page.request.get("/api/tasks");
    const beforeData = await beforeRes.json();
    expect(beforeData.tasks.some((t: { id: string }) => t.id === task.id)).toBeTruthy();

    // Clear in-memory cache (simulates restart)
    await page.request.post("/api/debug/clear-cache");

    // Verify still exists after cache clear
    const afterRes = await page.request.get("/api/tasks");
    const afterData = await afterRes.json();
    expect(afterData.tasks.some((t: { id: string }) => t.id === task.id)).toBeTruthy();

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
  });

  test("doc persists after cache clear", async ({ page }) => {
    const createRes = await page.request.post("/api/docs", {
      data: {
        title: "Persistence test doc",
        content: "Should survive restart",
        category: "other",
        format: "plain text",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { doc } = await createRes.json();

    await page.request.post("/api/debug/clear-cache");

    const afterRes = await page.request.get("/api/docs");
    const afterData = await afterRes.json();
    expect(afterData.docs.some((d: { id: string }) => d.id === doc.id)).toBeTruthy();

    await page.request.delete(`/api/docs?id=${doc.id}`);
  });

  test("bug persists after cache clear", async ({ page }) => {
    const createRes = await page.request.post("/api/bugs", {
      data: {
        title: "Persistence test bug",
        screen: "TestScreen",
        severity: "medium",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { bug } = await createRes.json();

    await page.request.post("/api/debug/clear-cache");

    const afterRes = await page.request.get("/api/bugs");
    const afterData = await afterRes.json();
    expect(afterData.bugs.some((b: { id: string }) => b.id === bug.id)).toBeTruthy();

    await page.request.delete(`/api/bugs?id=${bug.id}`);
  });

  test("conversation memory persists after cache clear", async ({ page }) => {
    const createRes = await page.request.post("/api/memories/conversation", {
      data: {
        date: "2026-04-02",
        title: "Persistence test memory",
        content: "Should survive restart",
        tags: ["test"],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { memory } = await createRes.json();

    await page.request.post("/api/debug/clear-cache");

    const afterRes = await page.request.get("/api/memories/conversation");
    const afterData = await afterRes.json();
    expect(afterData.memories.some((m: { id: string }) => m.id === memory.id)).toBeTruthy();

    await page.request.delete(`/api/memories/conversation?id=${memory.id}`);
  });

  test("project persists after cache clear", async ({ page }) => {
    const createRes = await page.request.post("/api/projects", {
      data: {
        name: "Persistence test project",
        description: "Should survive restart",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { project } = await createRes.json();

    await page.request.post("/api/debug/clear-cache");

    const afterRes = await page.request.get("/api/projects");
    const afterData = await afterRes.json();
    expect(afterData.projects.some((p: { id: string }) => p.id === project.id)).toBeTruthy();

    await page.request.delete(`/api/projects?id=${project.id}`);
  });

  test("calendar event persists after cache clear", async ({ page }) => {
    const createRes = await page.request.post("/api/calendar", {
      data: {
        name: "Persistence test event",
        description: "Should survive restart",
        scheduleType: "one-time",
        schedule: "2026-04-10",
        eventType: "reminder",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { event } = await createRes.json();

    await page.request.post("/api/debug/clear-cache");

    const afterRes = await page.request.get("/api/calendar");
    const afterData = await afterRes.json();
    expect(afterData.events.some((e: { id: string }) => e.id === event.id)).toBeTruthy();

    await page.request.delete(`/api/calendar?id=${event.id}`);
  });

  test("bug, project, and doc around a task run persist with IDs, content, and cross-links", async ({ page }) => {
    // Ensure a test agent exists
    const agentsRes = await page.request.get("/api/team/agents");
    const agentsData = await agentsRes.json();
    let agentId: string;
    const existing = (agentsData.agents || []).find(
      (a: { name: string }) => a.name === "persistence-test-agent"
    );
    if (existing) {
      agentId = existing.id;
    } else {
      const agentRes = await page.request.post("/api/team/agents", {
        data: {
          name: "persistence-test-agent",
          role: "worker",
          description: "Agent for persistence regression test",
          model: "test-model",
        },
      });
      const agentCreated = await agentRes.json();
      agentId = agentCreated.agent.id;
    }

    // 1. Create a task and claim it (creates a TaskRun)
    const taskRes = await page.request.post("/api/tasks", {
      data: {
        title: "Persistence lifecycle task",
        description: "Task for cross-entity persistence test",
        assignee: "agent",
        priority: "high",
      },
    });
    expect(taskRes.ok()).toBeTruthy();
    const { task } = await taskRes.json();

    const claimRes = await page.request.post("/api/tasks/lifecycle/claim", {
      data: { taskId: task.id, agentId },
    });
    expect(claimRes.ok()).toBeTruthy();
    const claimData = await claimRes.json();
    const runId = claimData.run.id;

    // 2. Create a bug report
    const bugRes = await page.request.post("/api/bugs", {
      data: {
        title: "Persistence regression bug",
        screen: "TaskBoard",
        severity: "high",
        stepsToReproduce: "Run lifecycle flow and restart",
      },
    });
    expect(bugRes.ok()).toBeTruthy();
    const { bug } = await bugRes.json();

    // 3. Create a doc
    const docRes = await page.request.post("/api/docs", {
      data: {
        title: "Persistence design note",
        content: "Design notes for the lifecycle persistence test",
        category: "planning",
        format: "markdown",
      },
    });
    expect(docRes.ok()).toBeTruthy();
    const { doc } = await docRes.json();

    // 4. Create a project
    const projectRes = await page.request.post("/api/projects", {
      data: {
        name: "Persistence test project",
        description: "Project grouping lifecycle artifacts",
      },
    });
    expect(projectRes.ok()).toBeTruthy();
    const { project } = await projectRes.json();

    // 5. Link all artifacts to the project
    const linkTaskRes = await page.request.post("/api/projects/tasks", {
      data: { projectId: project.id, taskId: task.id },
    });
    expect(linkTaskRes.ok()).toBeTruthy();

    const linkBugRes = await page.request.post("/api/projects/bugs", {
      data: { projectId: project.id, bugId: bug.id },
    });
    expect(linkBugRes.ok()).toBeTruthy();

    const linkDocRes = await page.request.post("/api/projects/docs", {
      data: { projectId: project.id, docId: doc.id },
    });
    expect(linkDocRes.ok()).toBeTruthy();

    // 6. Clear in-memory cache (simulates restart)
    await page.request.post("/api/debug/clear-cache");

    // 7. Verify all records still exist with same IDs and content
    const tasksAfter = await (await page.request.get("/api/tasks")).json();
    const taskAfter = tasksAfter.tasks.find((t: { id: string }) => t.id === task.id);
    expect(taskAfter).toBeTruthy();
    expect(taskAfter.title).toBe("Persistence lifecycle task");
    expect(taskAfter.description).toBe("Task for cross-entity persistence test");
    expect(taskAfter.column).toBe("in-progress");
    expect(taskAfter.currentRunId).toBe(runId);

    const bugsAfter = await (await page.request.get("/api/bugs")).json();
    const bugAfter = bugsAfter.bugs.find((b: { id: string }) => b.id === bug.id);
    expect(bugAfter).toBeTruthy();
    expect(bugAfter.title).toBe("Persistence regression bug");
    expect(bugAfter.screen).toBe("TaskBoard");
    expect(bugAfter.severity).toBe("high");
    expect(bugAfter.stepsToReproduce).toBe("Run lifecycle flow and restart");

    const docsAfter = await (await page.request.get("/api/docs")).json();
    const docAfter = docsAfter.docs.find((d: { id: string }) => d.id === doc.id);
    expect(docAfter).toBeTruthy();
    expect(docAfter.title).toBe("Persistence design note");
    expect(docAfter.content).toBe("Design notes for the lifecycle persistence test");
    expect(docAfter.category).toBe("planning");

    const projectsAfter = await (await page.request.get("/api/projects")).json();
    const projectAfter = projectsAfter.projects.find((p: { id: string }) => p.id === project.id);
    expect(projectAfter).toBeTruthy();
    expect(projectAfter.name).toBe("Persistence test project");
    expect(projectAfter.description).toBe("Project grouping lifecycle artifacts");
    expect(projectAfter.linkedTaskIds).toContain(task.id);
    expect(projectAfter.linkedBugIds).toContain(bug.id);
    expect(projectAfter.linkedDocIds).toContain(doc.id);

    // Cleanup
    await page.request.delete(`/api/tasks?id=${task.id}`);
    await page.request.delete(`/api/bugs?id=${bug.id}`);
    await page.request.delete(`/api/docs?id=${doc.id}`);
    await page.request.delete(`/api/projects?id=${project.id}`);
  });

  test("health endpoint reports correct state", async ({ page }) => {
    const res = await page.request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.status).toBe("ok");
    expect(data.storeFile).toBe(true);
    expect(typeof data.recordCounts.tasks).toBe("number");
    expect(typeof data.recordCounts.projects).toBe("number");
    expect(typeof data.recordCounts.docs).toBe("number");
    expect(typeof data.recordCounts.bugs).toBe("number");
  });
});
