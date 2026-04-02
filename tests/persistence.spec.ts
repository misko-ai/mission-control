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
