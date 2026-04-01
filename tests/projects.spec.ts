import { test, expect } from "@playwright/test";

test.describe("Projects page", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up all projects before each test
    const projRes = await page.request.get("/api/projects");
    const projData = await projRes.json();
    for (const project of projData.projects || []) {
      await page.request.delete(`/api/projects?id=${project.id}`);
    }
    // Clean up test tasks
    const taskRes = await page.request.get("/api/tasks");
    const taskData = await taskRes.json();
    for (const task of taskData.tasks || []) {
      if (task.title.includes("for progress") || task.title.includes("Linkable")) {
        await page.request.delete(`/api/tasks?id=${task.id}`);
      }
    }
  });

  test("is accessible from sidebar navigation", async ({ page }) => {
    await page.goto("/");
    const projectsLink = page.locator('nav a[href="/projects"]');
    await expect(projectsLink).toBeVisible();
    await expect(projectsLink).toContainText("Projects");
  });

  test("renders page heading and empty state", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.locator("h2")).toHaveText("Projects");
    await expect(page.locator("text=No projects yet")).toBeVisible();
  });

  test("shows status filter tabs", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.locator("button", { hasText: "all" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "active" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "completed" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "archived" }).first()).toBeVisible();
  });

  test("can open and close the create form", async ({ page }) => {
    await page.goto("/projects");
    await page.click("text=+ New Project");
    await expect(page.locator('input[placeholder="Website Redesign"]')).toBeVisible();
    await page.click("text=Cancel");
    await expect(page.locator('input[placeholder="Website Redesign"]')).not.toBeVisible();
  });

  test("can create a project", async ({ page }) => {
    await page.goto("/projects");
    await page.click("text=+ New Project");
    await page.fill('input[placeholder="Website Redesign"]', "API Migration");
    await page.fill(
      'textarea[placeholder="What is this project about..."]',
      "Migrate from REST to GraphQL"
    );
    await page.click("text=Create Project");

    await expect(page.locator("text=API Migration")).toBeVisible();
    await expect(page.locator("text=Migrate from REST to GraphQL")).toBeVisible();
    await expect(page.locator("text=active").first()).toBeVisible();
  });

  test("shows progress bar at 0% with no linked tasks", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Empty progress project", description: "No tasks yet" },
    });
    await page.goto("/projects");

    await expect(page.locator("text=Empty progress project")).toBeVisible();
    await expect(page.locator("text=0%")).toBeVisible();
  });

  test("can archive and restore a project", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Archive test project" },
    });
    await page.goto("/projects");

    const projectCard = page.locator(".rounded-lg", { hasText: "Archive test project" }).first();
    await expect(projectCard).toBeVisible();
    await projectCard.locator("button:has-text('Archive')").click();

    await expect(projectCard.locator("text=archived")).toBeVisible();

    await projectCard.locator("button:has-text('Restore')").click();
    await expect(projectCard.locator("text=active")).toBeVisible();
  });

  test("can delete a project with confirmation", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Delete me project" },
    });
    await page.goto("/projects");

    const projectCard = page.locator(".rounded-lg", { hasText: "Delete me project" }).first();
    await expect(projectCard).toBeVisible();
    await projectCard.locator("button:has-text('Delete')").click();
    await expect(projectCard.locator("button:has-text('Confirm')")).toBeVisible();
    await projectCard.locator("button:has-text('Confirm')").click();

    await expect(page.locator("text=Delete me project")).not.toBeVisible();
  });

  test("can edit a project inline", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Edit me project", description: "Original desc" },
    });
    await page.goto("/projects");

    const projectCard = page.locator(".rounded-lg", { hasText: "Edit me project" }).first();
    await expect(projectCard).toBeVisible();
    await projectCard.locator("button:has-text('Edit')").click();

    // After clicking Edit, card switches to edit mode with input fields
    const nameInput = page.locator('input[value="Edit me project"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Renamed project");
    await page.locator("button:has-text('Save')").click();

    await expect(page.locator("text=Renamed project")).toBeVisible();
  });

  test("can link tasks to a project", async ({ page }) => {
    await page.request.post("/api/tasks", {
      data: { title: "Linkable task", description: "A task to link", assignee: "user" },
    });
    await page.request.post("/api/projects", {
      data: { name: "Link test project" },
    });

    await page.goto("/projects");
    const projectCard = page.locator(".rounded-lg", { hasText: "Link test project" }).first();
    await expect(projectCard).toBeVisible();

    await projectCard.locator("text=+ Link task").click();
    await expect(projectCard.locator('input[placeholder="Search tasks to link..."]')).toBeVisible();

    // Click the task to link it
    await projectCard.locator("button", { hasText: "Linkable task" }).click();

    // Task should now appear as linked in the card
    await expect(projectCard.locator("text=Linkable task")).toBeVisible();
  });

  test("progress updates when tasks are linked", async ({ page }) => {
    // Create a done task and a backlog task
    const doneTask = await page.request.post("/api/tasks", {
      data: { title: "Done task for progress", description: "completed", assignee: "user" },
    });
    const doneTaskData = await doneTask.json();
    await page.request.post("/api/tasks/move", {
      data: { taskId: doneTaskData.task.id, toColumn: "done" },
    });

    const backlogTask = await page.request.post("/api/tasks", {
      data: { title: "Backlog task for progress", description: "pending", assignee: "user" },
    });
    const backlogTaskData = await backlogTask.json();

    // Create project with both tasks linked
    await page.request.post("/api/projects", {
      data: {
        name: "Progress test project",
        linkedTaskIds: [doneTaskData.task.id, backlogTaskData.task.id],
      },
    });

    await page.goto("/projects");
    const projectCard = page.locator(".rounded-lg", { hasText: "Progress test project" }).first();
    await expect(projectCard).toBeVisible();
    // 1 of 2 tasks done = 50%
    await expect(projectCard.locator("text=50%")).toBeVisible();
    await expect(projectCard.locator("text=(1/2)")).toBeVisible();
  });

  test("status filters work", async ({ page }) => {
    // Create active and archived projects
    await page.request.post("/api/projects", {
      data: { name: "Active filter project" },
    });
    const archiveRes = await page.request.post("/api/projects", {
      data: { name: "Archived filter project" },
    });
    const archiveData = await archiveRes.json();
    await page.request.put("/api/projects", {
      data: { id: archiveData.project.id, status: "archived" },
    });

    await page.goto("/projects");

    // Filter to active only
    await page.locator("button", { hasText: "active" }).first().click();
    await expect(page.locator("text=Active filter project").first()).toBeVisible();
    await expect(page.locator("text=Archived filter project")).not.toBeVisible();

    // Filter to archived only
    await page.locator("button", { hasText: "archived" }).first().click();
    await expect(page.locator("text=Archived filter project").first()).toBeVisible();
    await expect(page.locator("text=Active filter project")).not.toBeVisible();
  });
});
