import { test, expect } from "@playwright/test";

test.describe("Taskboard page", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up tasks
    const res = await page.request.get("/api/tasks");
    const data = await res.json();
    for (const task of data.tasks || []) {
      await page.request.delete(`/api/tasks?id=${task.id}`);
    }
  });

  test("is accessible from sidebar navigation", async ({ page }) => {
    await page.goto("/");
    const link = page.locator('nav a[href="/taskboard"]');
    await expect(link).toBeVisible();
    await expect(link).toContainText("Taskboard");
  });

  test("renders all columns including blocked", async ({ page }) => {
    await page.goto("/taskboard");
    await expect(page.locator("h2")).toHaveText("Taskboard");
    // Column headers are uppercase
    await expect(page.getByText("BACKLOG")).toBeVisible();
    await expect(page.getByText("IN PROGRESS")).toBeVisible();
    await expect(page.getByText("BLOCKED")).toBeVisible();
    await expect(page.getByText("REVIEW")).toBeVisible();
    await expect(page.getByText("DONE")).toBeVisible();
  });

  test("can create a task", async ({ page }) => {
    await page.goto("/taskboard");
    await page.getByRole("button", { name: "New Task" }).click();
    await page.fill('input[placeholder="Task title"]', "Unique create test xyz");
    await page.fill(
      'textarea[placeholder="What needs to be done?"]',
      "A unique test description abc"
    );
    await page.getByRole("button", { name: "Create Task" }).click();

    await expect(
      page.locator("h4", { hasText: "Unique create test xyz" })
    ).toBeVisible();
  });

  test("can edit a task inline", async ({ page }) => {
    await page.request.post("/api/tasks", {
      data: {
        title: "EditableXYZ",
        description: "Original desc",
        assignee: "user",
      },
    });
    await page.goto("/taskboard");

    // Find the task card heading and its parent card
    const heading = page.locator("h4", { hasText: "EditableXYZ" });
    await expect(heading).toBeVisible();

    // Click the edit button on this card
    const card = heading.locator("..").locator("..");
    await card.locator('button[title="Edit"]').click();

    // Edit form should appear with input pre-filled
    const titleInput = page.locator('input[value="EditableXYZ"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill("RenamedXYZ");

    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.locator("h4", { hasText: "RenamedXYZ" })).toBeVisible();
  });

  test("can cancel editing a task", async ({ page }) => {
    await page.request.post("/api/tasks", {
      data: {
        title: "CancelEditXYZ",
        description: "Should not change",
        assignee: "user",
      },
    });
    await page.goto("/taskboard");

    const heading = page.locator("h4", { hasText: "CancelEditXYZ" });
    await expect(heading).toBeVisible();
    const card = heading.locator("..").locator("..");
    await card.locator('button[title="Edit"]').click();

    const titleInput = page.locator('input[value="CancelEditXYZ"]');
    await titleInput.fill("Changed");

    await page.getByRole("button", { name: "Cancel", exact: true }).first().click();

    await expect(
      page.locator("h4", { hasText: "CancelEditXYZ" })
    ).toBeVisible();
  });

  test("can move a task to blocked via API", async ({ page }) => {
    const createRes = await page.request.post("/api/tasks", {
      data: {
        title: "BlockMeXYZ",
        description: "Will be blocked",
        assignee: "agent",
      },
    });
    const created = await createRes.json();

    await page.request.post("/api/tasks/move", {
      data: { taskId: created.task.id, toColumn: "blocked" },
    });

    const getRes = await page.request.get("/api/tasks");
    const getData = await getRes.json();
    const task = getData.tasks.find(
      (t: { id: string }) => t.id === created.task.id
    );
    expect(task.column).toBe("blocked");
  });

  test("blocked tasks show block reason", async ({ page }) => {
    const res = await page.request.post("/api/tasks", {
      data: {
        title: "BlockedReasonXYZ",
        description: "Has a reason",
        assignee: "agent",
      },
    });
    const taskData = await res.json();

    await page.request.post("/api/tasks/move", {
      data: { taskId: taskData.task.id, toColumn: "blocked" },
    });
    await page.request.put("/api/tasks", {
      data: {
        id: taskData.task.id,
        blockReason: "API endpoint returned 500 error",
      },
    });

    await page.goto("/taskboard");
    await expect(
      page.locator("text=API endpoint returned 500 error")
    ).toBeVisible();
  });

  test("can delete a task via API", async ({ page }) => {
    const createRes = await page.request.post("/api/tasks", {
      data: {
        title: "DeleteMeXYZ",
        description: "Temporary",
        assignee: "user",
      },
    });
    const created = await createRes.json();

    const delRes = await page.request.delete(
      `/api/tasks?id=${created.task.id}`
    );
    const delData = await delRes.json();
    expect(delData.success).toBe(true);

    const getRes = await page.request.get("/api/tasks");
    const getData = await getRes.json();
    const found = getData.tasks.find(
      (t: { id: string }) => t.id === created.task.id
    );
    expect(found).toBeUndefined();
  });

  test("PUT endpoint updates task fields", async ({ page }) => {
    const createRes = await page.request.post("/api/tasks", {
      data: {
        title: "API update test",
        description: "Before update",
        assignee: "user",
      },
    });
    const created = await createRes.json();

    const putRes = await page.request.put("/api/tasks", {
      data: {
        id: created.task.id,
        title: "API updated title",
        description: "After update",
      },
    });
    const putData = await putRes.json();
    expect(putData.success).toBe(true);

    const getRes = await page.request.get("/api/tasks");
    const getData = await getRes.json();
    const task = getData.tasks.find(
      (t: { id: string }) => t.id === created.task.id
    );
    expect(task.title).toBe("API updated title");
    expect(task.description).toBe("After update");
  });
});
