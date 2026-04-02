import { test, expect, Page } from "@playwright/test";

/** Wait for the projects page to fully hydrate and finish loading */
async function waitForPageReady(page: Page) {
  // Wait for the loading state to disappear — either shows projects, empty state, or filter counts
  await expect(page.locator("text=Loading projects...")).toBeHidden({ timeout: 20000 });
}

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
      if (
        task.title.includes("for progress") ||
        task.title.includes("Linkable") ||
        task.title.includes("Test task")
      ) {
        await page.request.delete(`/api/tasks?id=${task.id}`);
      }
    }
  });

  // --- Navigation and basic rendering ---

  test("is accessible from sidebar navigation", async ({ page }) => {
    await page.goto("/");
    const projectsLink = page.locator('nav a[href="/projects"]');
    await expect(projectsLink).toBeVisible();
    await expect(projectsLink).toContainText("Projects");
  });

  test("renders page heading and empty state", async ({ page }) => {
    await page.goto("/projects");
    await waitForPageReady(page);
    await expect(page.locator("h2")).toHaveText("Projects");
    await expect(page.locator("text=No projects yet").first()).toBeVisible();
  });

  test("shows all status filter tabs", async ({ page }) => {
    await page.goto("/projects");
    await waitForPageReady(page);
    for (const status of ["all", "idea", "planned", "active", "blocked", "completed", "archived", "canceled"]) {
      await expect(page.locator("button", { hasText: status }).first()).toBeVisible();
    }
  });

  // --- Create form ---

  test("can open and close the create form", async ({ page }) => {
    await page.goto("/projects");
    await waitForPageReady(page);
    await page.click("text=+ New Project");
    await expect(page.locator('input[placeholder="Project name"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="achieve"]')).toBeVisible();
    await page.click("text=Cancel");
    await expect(page.locator('input[placeholder="Project name"]')).not.toBeVisible();
  });

  test("can create a project with only name (minimal)", async ({ page }) => {
    await page.goto("/projects");
    await waitForPageReady(page);
    await page.click("text=+ New Project");
    await page.fill('input[placeholder="Project name"]', "Minimal Project");
    await page.click("text=Create Project");
    await expect(page.locator("text=Minimal Project")).toBeVisible();
  });

  test("new project defaults to idea status", async ({ page }) => {
    await page.goto("/projects");
    await waitForPageReady(page);
    await page.click("text=+ New Project");
    await page.fill('input[placeholder="Project name"]', "Status Test");
    await page.click("text=Create Project");
    const card = page.locator(".rounded-lg", { hasText: "Status Test" }).first();
    await expect(card.locator("text=idea")).toBeVisible();
  });

  test("can create project with goal, type, and priority", async ({ page }) => {
    await page.goto("/projects");
    await waitForPageReady(page);
    await page.click("text=+ New Project");
    await page.fill('input[placeholder="Project name"]', "Strategic Project");
    await page.fill('input[placeholder*="achieve"]', "Build a real operating system");
    await page.locator("select").nth(0).selectOption("initiative");
    await page.locator("select").nth(1).selectOption("high");
    await page.click("text=Create Project");

    const card = page.locator(".rounded-lg", { hasText: "Strategic Project" }).first();
    await expect(card).toBeVisible();
    await expect(card.locator("text=initiative")).toBeVisible();
    await expect(card.locator("text=high")).toBeVisible();
    await expect(card.locator("text=Build a real operating system")).toBeVisible();
  });

  // --- Badges ---

  test("displays type, status, and priority badges on card", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: {
        name: "Badge Test",
        type: "research",
        priority: "critical",
        status: "idea",
      },
    });
    await page.goto("/projects");
    await waitForPageReady(page);
    const card = page.locator(".rounded-lg", { hasText: "Badge Test" }).first();
    await expect(card.locator("text=research")).toBeVisible();
    await expect(card.locator("text=critical")).toBeVisible();
    await expect(card.locator("text=idea")).toBeVisible();
  });

  // --- Progress ---

  test("shows progress bar at 0% with no linked tasks", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Empty progress project" },
    });
    await page.goto("/projects");
    await waitForPageReady(page);
    await expect(page.locator("text=Empty progress project")).toBeVisible();
    await expect(page.locator("text=0%")).toBeVisible();
  });

  test("progress updates when tasks are linked", async ({ page }) => {
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

    await page.request.post("/api/projects", {
      data: {
        name: "Progress test project",
        linkedTaskIds: [doneTaskData.task.id, backlogTaskData.task.id],
      },
    });

    await page.goto("/projects");
    await waitForPageReady(page);
    const card = page.locator(".rounded-lg", { hasText: "Progress test project" }).first();
    await expect(card).toBeVisible();
    await expect(card.locator("text=50%")).toBeVisible();
    await expect(card.locator("text=(1/2)")).toBeVisible();
  });

  // --- Status workflow ---

  test("can transition project from idea to planned to active to completed", async ({ page }) => {
    const res = await page.request.post("/api/projects", {
      data: { name: "Workflow Test", status: "idea" },
    });
    const { project } = await res.json();
    await page.goto("/projects");
    await waitForPageReady(page);

    const card = page.locator(".rounded-lg", { hasText: "Workflow Test" }).first();
    await expect(card.locator("text=idea")).toBeVisible();

    // idea → planned
    await card.locator("button:has-text('Plan')").click();
    await expect(card.locator("text=planned")).toBeVisible();

    // planned → active
    await card.locator("button:has-text('Activate')").click();
    await expect(card.locator("text=active")).toBeVisible();

    // active → completed
    await card.locator("button:has-text('Complete')").click();
    await expect(card.locator("text=completed")).toBeVisible();
  });

  test("can mark project as blocked and unblock", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Block Test", status: "active" },
    });
    await page.goto("/projects");
    await waitForPageReady(page);

    const card = page.locator(".rounded-lg", { hasText: "Block Test" }).first();
    await card.locator("button:has-text('Block')").click();
    await expect(card.locator("text=blocked")).toBeVisible();

    await card.locator("button:has-text('Unblock')").click();
    await expect(card.locator("text=active")).toBeVisible();
  });

  test("can cancel a project", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Cancel Test", status: "active" },
    });
    await page.goto("/projects");
    await waitForPageReady(page);

    const card = page.locator(".rounded-lg", { hasText: "Cancel Test" }).first();
    // Cancel may be in expanded actions — click the card to expand first
    await card.locator("h3").click();
    await card.locator("button:has-text('Cancel')").first().click();
    await expect(card.locator("text=canceled")).toBeVisible();
  });

  test("can archive and restore a project", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Archive test project", status: "active" },
    });
    await page.goto("/projects");
    await waitForPageReady(page);

    const card = page.locator(".rounded-lg", { hasText: "Archive test project" }).first();
    await expect(card).toBeVisible();
    // Expand to see all actions
    await card.locator("h3").click();
    await card.locator("button:has-text('Archive')").first().click();
    await expect(card.locator("text=archived").first()).toBeVisible();

    await card.locator("button:has-text('Restore')").first().click();
    await expect(card.locator("text=active").first()).toBeVisible();
  });

  // --- Status filters ---

  test("status filters work for new statuses", async ({ page }) => {
    await page.request.post("/api/projects", { data: { name: "Idea project", status: "idea" } });
    await page.request.post("/api/projects", { data: { name: "Active project", status: "active" } });
    await page.request.post("/api/projects", { data: { name: "Planned project", status: "planned" } });

    await page.goto("/projects");
    await waitForPageReady(page);

    // Filter to idea
    await page.locator("button", { hasText: "idea" }).first().click();
    await expect(page.locator("text=Idea project").first()).toBeVisible();
    await expect(page.locator("text=Active project")).not.toBeVisible();

    // Filter to active
    await page.locator("button", { hasText: "active" }).first().click();
    await expect(page.locator("text=Active project").first()).toBeVisible();
    await expect(page.locator("text=Idea project")).not.toBeVisible();

    // Filter to planned
    await page.locator("button", { hasText: "planned" }).first().click();
    await expect(page.locator("text=Planned project").first()).toBeVisible();
    await expect(page.locator("text=Active project")).not.toBeVisible();

    // All shows everything
    await page.locator("button", { hasText: "all" }).first().click();
    await expect(page.locator("text=Idea project").first()).toBeVisible();
    await expect(page.locator("text=Active project").first()).toBeVisible();
    await expect(page.locator("text=Planned project").first()).toBeVisible();
  });

  // --- Delete ---

  test("can delete a project with confirmation", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Delete me project" },
    });
    await page.goto("/projects");
    await waitForPageReady(page);

    const card = page.locator(".rounded-lg", { hasText: "Delete me project" }).first();
    await expect(card).toBeVisible();
    await card.locator("button:has-text('Delete')").click();
    await expect(card.locator("button:has-text('Confirm')")).toBeVisible();
    await card.locator("button:has-text('Confirm')").click();

    await expect(page.locator("text=Delete me project")).not.toBeVisible();
  });

  // --- Edit (strategic fields) ---

  test("can edit project inline", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Edit me project", description: "Original desc", goal: "Original goal" },
    });
    await page.goto("/projects");
    await waitForPageReady(page);

    // Click Edit button on the project card
    await page.locator("button:has-text('Edit')").first().click();

    // Edit name - find the first textbox in edit mode (name field has autoFocus)
    const nameInput = page.locator('input[placeholder*="achieve"]').locator("..").locator("..").locator("input").first();
    await page.locator("text=Overview").first().waitFor();
    // Use the name input which is the first input in the edit form
    const firstInput = page.locator(".space-y-4 input").first();
    await firstInput.fill("Renamed project");

    // Edit goal
    const goalInput = page.locator('input[placeholder*="achieve"]');
    await goalInput.fill("New goal statement");

    await page.locator("button:has-text('Save')").click();

    await expect(page.locator("text=Renamed project")).toBeVisible();
    // Goal shows in collapsed view
    await expect(page.locator("text=New goal statement")).toBeVisible();
  });

  test("can edit success criteria in edit mode", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Criteria project", successCriteria: ["Existing criterion"] },
    });
    await page.goto("/projects");
    await waitForPageReady(page);

    await page.locator("button:has-text('Edit')").first().click();
    await page.locator("text=Overview").first().waitFor();

    // Existing criterion should be visible
    await expect(page.locator("text=Existing criterion")).toBeVisible();

    // Add new criterion
    const criterionInput = page.locator('input[placeholder="Add criterion..."]');
    await criterionInput.fill("New success criterion");
    await criterionInput.press("Enter");
    await expect(page.locator("text=New success criterion")).toBeVisible();

    await page.locator("button:has-text('Save')").click();

    // Verify in expanded view
    const card = page.locator(".rounded-lg", { hasText: "Criteria project" }).first();
    await card.locator("h3").click();
    await expect(page.locator("text=Existing criterion")).toBeVisible();
    await expect(page.locator("text=New success criterion")).toBeVisible();
  });

  test("can edit constraints in edit mode", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Constraints project" },
    });
    await page.goto("/projects");
    await waitForPageReady(page);

    await page.locator("button:has-text('Edit')").first().click();
    await page.locator("text=Overview").first().waitFor();

    const constraintInput = page.locator('input[placeholder="Add constraint..."]');
    await constraintInput.fill("Must stay under budget");
    await constraintInput.press("Enter");
    await expect(page.locator("text=Must stay under budget")).toBeVisible();

    await page.locator("button:has-text('Save')").click();

    // Verify persisted in expanded view
    const card = page.locator(".rounded-lg", { hasText: "Constraints project" }).first();
    await card.locator("h3").click();
    await expect(page.locator("text=Must stay under budget")).toBeVisible();
  });

  // --- Expanded detail view ---

  test("can expand project to see detail sections", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: {
        name: "Detail project",
        goal: "Test goal",
        desiredOutcome: "Test outcome",
        description: "Test description",
        successCriteria: ["Criterion 1"],
        constraints: ["Constraint 1"],
      },
    });
    await page.goto("/projects");
    await waitForPageReady(page);

    // Click project name to expand
    await page.locator("h3", { hasText: "Detail project" }).click();

    // Check sections appear
    await expect(page.locator("text=Overview").first()).toBeVisible();
    await expect(page.locator("text=Strategy").first()).toBeVisible();
    await expect(page.locator("text=Execution").first()).toBeVisible();
    await expect(page.locator("text=Knowledge").first()).toBeVisible();

    // Check content
    await expect(page.locator("text=Test goal").first()).toBeVisible();
    await expect(page.locator("text=Test outcome")).toBeVisible();
    await expect(page.locator("text=Criterion 1")).toBeVisible();
    await expect(page.locator("text=Constraint 1")).toBeVisible();
  });

  // --- Task linking ---

  test("can link tasks to a project", async ({ page }) => {
    await page.request.post("/api/tasks", {
      data: { title: "Linkable task", description: "A task to link", assignee: "user" },
    });
    await page.request.post("/api/projects", {
      data: { name: "Link test project" },
    });

    await page.goto("/projects");
    await waitForPageReady(page);
    const card = page.locator(".rounded-lg", { hasText: "Link test project" }).first();
    // Expand to see task linking
    await card.locator("h3").click();
    await card.locator("text=+ Link task").click();
    await expect(card.locator('input[placeholder="Search tasks to link..."]')).toBeVisible();
    await card.locator("button", { hasText: "Linkable task" }).click();
    await expect(card.locator("text=Linkable task")).toBeVisible();
  });

  // --- Milestones ---

  test("can add a milestone to a project", async ({ page }) => {
    const res = await page.request.post("/api/projects", {
      data: { name: "Milestone project" },
    });
    await page.goto("/projects");
    await waitForPageReady(page);

    const card = page.locator(".rounded-lg", { hasText: "Milestone project" }).first();
    await card.locator("h3").click();

    await card.locator("text=+ Add milestone").click();
    await card.locator('input[placeholder="Milestone title"]').fill("First milestone");
    await card.locator("button:has-text('Add')").click();

    await expect(card.locator("text=First milestone")).toBeVisible();
    await expect(card.locator("text=pending")).toBeVisible();
  });

  test("can update milestone status", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", {
      data: { name: "Milestone status project" },
    });
    const { project } = await projRes.json();

    // Add milestone via API
    await page.request.post("/api/projects/milestones", {
      data: { projectId: project.id, title: "Status milestone" },
    });

    await page.goto("/projects");
    await waitForPageReady(page);
    const card = page.locator(".rounded-lg", { hasText: "Milestone status project" }).first();
    await card.locator("h3").click();

    // Click status badge to toggle: pending → in-progress
    await card.locator("button:has-text('pending')").click();
    await expect(card.locator("text=in-progress")).toBeVisible();

    // Toggle again: in-progress → completed
    await card.locator("button:has-text('in-progress')").click();
    await expect(card.locator("button:has-text('completed')")).toBeVisible();
  });

  test("can delete a milestone", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", {
      data: { name: "Delete milestone project" },
    });
    const { project } = await projRes.json();

    const msRes = await page.request.post("/api/projects/milestones", {
      data: { projectId: project.id, title: "Deletable milestone" },
    });

    await page.goto("/projects");
    await waitForPageReady(page);
    const card = page.locator(".rounded-lg", { hasText: "Delete milestone project" }).first();
    await card.locator("h3").click();

    await expect(card.locator("text=Deletable milestone")).toBeVisible();

    // Hover to reveal delete button (the X icon)
    const milestoneRow = card.locator(".bg-background", { hasText: "Deletable milestone" });
    await milestoneRow.hover();
    await milestoneRow.locator("button").last().click();

    await expect(card.locator("text=Deletable milestone")).not.toBeVisible();
  });

  // --- Cross-entity linking (API level) ---

  test("can link and unlink a doc to a project via API", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", { data: { name: "Doc link project" } });
    const { project } = await projRes.json();

    const docRes = await page.request.post("/api/docs", {
      data: { title: "Test doc", content: "content", category: "planning", format: "markdown" },
    });
    const docData = await docRes.json();
    const docId = docData.doc.id;

    // Link
    const linkRes = await page.request.post("/api/projects/docs", {
      data: { projectId: project.id, docId },
    });
    expect(linkRes.ok()).toBeTruthy();

    // Verify
    const getRes = await page.request.get("/api/projects");
    const getData = await getRes.json();
    const updated = getData.projects.find((p: { id: string }) => p.id === project.id);
    expect(updated.linkedDocIds).toContain(docId);
    expect(updated.linkedDocs.length).toBe(1);

    // Unlink
    const unlinkRes = await page.request.delete(
      `/api/projects/docs?projectId=${project.id}&docId=${docId}`
    );
    expect(unlinkRes.ok()).toBeTruthy();

    const getRes2 = await page.request.get("/api/projects");
    const getData2 = await getRes2.json();
    const updated2 = getData2.projects.find((p: { id: string }) => p.id === project.id);
    expect(updated2.linkedDocIds).not.toContain(docId);
  });

  test("can link and unlink a bug to a project via API", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", { data: { name: "Bug link project" } });
    const { project } = await projRes.json();

    const bugRes = await page.request.post("/api/bugs", {
      data: { title: "Test bug", screen: "projects", severity: "medium", stepsToReproduce: "steps" },
    });
    const bugData = await bugRes.json();
    const bugId = bugData.bug.id;

    const linkRes = await page.request.post("/api/projects/bugs", {
      data: { projectId: project.id, bugId },
    });
    expect(linkRes.ok()).toBeTruthy();

    const getRes = await page.request.get("/api/projects");
    const getData = await getRes.json();
    const updated = getData.projects.find((p: { id: string }) => p.id === project.id);
    expect(updated.linkedBugIds).toContain(bugId);

    // Unlink
    await page.request.delete(`/api/projects/bugs?projectId=${project.id}&bugId=${bugId}`);
    const getRes2 = await page.request.get("/api/projects");
    const getData2 = await getRes2.json();
    const updated2 = getData2.projects.find((p: { id: string }) => p.id === project.id);
    expect(updated2.linkedBugIds).not.toContain(bugId);
  });

  test("can link and unlink a memory to a project via API", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", { data: { name: "Memory link project" } });
    const { project } = await projRes.json();

    const memRes = await page.request.post("/api/memories/longterm", {
      data: { title: "Test memory", content: "content", category: "decision" },
    });
    const memData = await memRes.json();
    const memoryId = memData.memory.id;

    const linkRes = await page.request.post("/api/projects/memories", {
      data: { projectId: project.id, memoryId },
    });
    expect(linkRes.ok()).toBeTruthy();

    const getRes = await page.request.get("/api/projects");
    const getData = await getRes.json();
    const updated = getData.projects.find((p: { id: string }) => p.id === project.id);
    expect(updated.linkedMemoryIds).toContain(memoryId);

    // Unlink
    await page.request.delete(`/api/projects/memories?projectId=${project.id}&memoryId=${memoryId}`);
    const getRes2 = await page.request.get("/api/projects");
    const getData2 = await getRes2.json();
    const updated2 = getData2.projects.find((p: { id: string }) => p.id === project.id);
    expect(updated2.linkedMemoryIds).not.toContain(memoryId);
  });

  test("can link and unlink a calendar event to a project via API", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", { data: { name: "Calendar link project" } });
    const { project } = await projRes.json();

    const eventRes = await page.request.post("/api/calendar", {
      data: {
        name: "Test event",
        description: "desc",
        scheduleType: "one-time",
        schedule: "2026-05-01",
        eventType: "deadline",
      },
    });
    const eventData = await eventRes.json();
    const eventId = eventData.event.id;

    const linkRes = await page.request.post("/api/projects/calendar", {
      data: { projectId: project.id, eventId },
    });
    expect(linkRes.ok()).toBeTruthy();

    const getRes = await page.request.get("/api/projects");
    const getData = await getRes.json();
    const updated = getData.projects.find((p: { id: string }) => p.id === project.id);
    expect(updated.linkedCalendarEventIds).toContain(eventId);

    // Unlink
    await page.request.delete(`/api/projects/calendar?projectId=${project.id}&eventId=${eventId}`);
    const getRes2 = await page.request.get("/api/projects");
    const getData2 = await getRes2.json();
    const updated2 = getData2.projects.find((p: { id: string }) => p.id === project.id);
    expect(updated2.linkedCalendarEventIds).not.toContain(eventId);
  });

  // --- Suggested tasks ---

  test("can add and manage suggested tasks via API", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", { data: { name: "Suggested tasks project" } });
    const { project } = await projRes.json();

    // Add suggested task
    const addRes = await page.request.post("/api/projects/suggested-tasks", {
      data: { projectId: project.id, title: "Suggested task 1", description: "Do something" },
    });
    expect(addRes.ok()).toBeTruthy();
    const addData = await addRes.json();
    expect(addData.suggestedTask.status).toBe("proposed");

    // Accept it
    const acceptRes = await page.request.put("/api/projects/suggested-tasks", {
      data: { projectId: project.id, taskId: addData.suggestedTask.id, status: "accepted" },
    });
    expect(acceptRes.ok()).toBeTruthy();

    // Verify
    const getRes = await page.request.get("/api/projects");
    const getData = await getRes.json();
    const updated = getData.projects.find((p: { id: string }) => p.id === project.id);
    expect(updated.suggestedTasks[0].status).toBe("accepted");
  });

  test("can reject a suggested task via API", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", { data: { name: "Reject task project" } });
    const { project } = await projRes.json();

    const addRes = await page.request.post("/api/projects/suggested-tasks", {
      data: { projectId: project.id, title: "Rejected task" },
    });
    const { suggestedTask } = await addRes.json();

    await page.request.put("/api/projects/suggested-tasks", {
      data: { projectId: project.id, taskId: suggestedTask.id, status: "rejected" },
    });

    const getRes = await page.request.get("/api/projects");
    const getData = await getRes.json();
    const updated = getData.projects.find((p: { id: string }) => p.id === project.id);
    expect(updated.suggestedTasks[0].status).toBe("rejected");
  });

  test("suggested tasks appear in expanded project view", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", { data: { name: "View suggested project" } });
    const { project } = await projRes.json();

    await page.request.post("/api/projects/suggested-tasks", {
      data: { projectId: project.id, title: "Visible suggestion" },
    });

    await page.goto("/projects");
    await waitForPageReady(page);
    const card = page.locator(".rounded-lg", { hasText: "View suggested project" }).first();
    await card.locator("h3").click();

    await expect(card.locator("text=Visible suggestion")).toBeVisible();
    await expect(card.locator("text=proposed")).toBeVisible();
    // Accept button visible
    await expect(card.locator("button:has-text('Accept')")).toBeVisible();
  });

  // --- Backward compatibility ---

  test("legacy project without v2 fields displays correctly", async ({ page }) => {
    // Simulate a legacy project by creating one with minimal fields via API
    // The applyDefaults in db.ts should fill in all v2 fields
    await page.request.post("/api/projects", {
      data: { name: "Legacy project", description: "Old style" },
    });

    await page.goto("/projects");
    await waitForPageReady(page);
    const card = page.locator(".rounded-lg", { hasText: "Legacy project" }).first();
    await expect(card).toBeVisible();
    // Should have default badges
    await expect(card.locator("text=idea")).toBeVisible();
    await expect(card.locator("text=medium")).toBeVisible();
    await expect(card.locator("text=other")).toBeVisible();
  });

  test("API returns correct defaults for new projects", async ({ page }) => {
    const res = await page.request.post("/api/projects", {
      data: { name: "Default check" },
    });
    const { project } = await res.json();

    expect(project.status).toBe("idea");
    expect(project.priority).toBe("medium");
    expect(project.type).toBe("other");
    expect(project.owner).toBe("user");
    expect(project.planningState).toBe("not-started");
    expect(project.executionMode).toBe("manual");
    expect(project.goal).toBe("");
    expect(project.successCriteria).toEqual([]);
    expect(project.constraints).toEqual([]);
    expect(project.assumptions).toEqual([]);
    expect(project.milestones).toEqual([]);
    expect(project.suggestedTasks).toEqual([]);
    expect(project.linkedDocIds).toEqual([]);
    expect(project.linkedBugIds).toEqual([]);
    expect(project.linkedMemoryIds).toEqual([]);
    expect(project.linkedCalendarEventIds).toEqual([]);
  });

  // --- API validation ---

  test("rejects invalid project status", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", { data: { name: "Valid project" } });
    const { project } = await projRes.json();

    const res = await page.request.put("/api/projects", {
      data: { id: project.id, status: "invalid-status" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects invalid priority", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", { data: { name: "Priority check" } });
    const { project } = await projRes.json();

    const res = await page.request.put("/api/projects", {
      data: { id: project.id, priority: "super-urgent" },
    });
    expect(res.status()).toBe(400);
  });

  test("milestone API validation works", async ({ page }) => {
    const projRes = await page.request.post("/api/projects", { data: { name: "MS validation" } });
    const { project } = await projRes.json();

    // Missing title
    const res = await page.request.post("/api/projects/milestones", {
      data: { projectId: project.id },
    });
    expect(res.status()).toBe(400);

    // Invalid project
    const res2 = await page.request.post("/api/projects/milestones", {
      data: { projectId: "nonexistent", title: "test" },
    });
    expect(res2.status()).toBe(404);
  });

  // --- Search ---

  test("projects are searchable by goal", async ({ page }) => {
    await page.request.post("/api/projects", {
      data: { name: "Searchable project", goal: "unique-search-term-xyz" },
    });

    const res = await page.request.get("/api/search?q=unique-search-term-xyz");
    const data = await res.json();
    expect(data.projects.length).toBeGreaterThan(0);
    expect(data.projects[0].title).toBe("Searchable project");
  });
});
