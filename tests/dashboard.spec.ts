import { test, expect } from "@playwright/test";

test.describe("Dashboard page", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up tasks
    const tasksRes = await page.request.get("/api/tasks");
    const tasksData = await tasksRes.json();
    for (const task of tasksData.tasks || []) {
      await page.request.delete(`/api/tasks?id=${task.id}`);
    }

    // Clean up bugs
    const bugsRes = await page.request.get("/api/bugs");
    const bugsData = await bugsRes.json();
    for (const bug of bugsData.bugs || []) {
      await page.request.delete(`/api/bugs?id=${bug.id}`);
    }

    // Clean up projects
    const projRes = await page.request.get("/api/projects");
    const projData = await projRes.json();
    for (const project of projData.projects || []) {
      await page.request.delete(`/api/projects?id=${project.id}`);
    }

    // Clean up agents
    const agentsRes = await page.request.get("/api/team/agents");
    const agentsData = await agentsRes.json();
    for (const agent of agentsData.agents || []) {
      await page.request.delete(`/api/team/agents?id=${agent.id}`);
    }
  });

  test("renders the Dashboard heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h2")).toHaveText("Dashboard");
  });

  test("quick stats show zero counts when no data exists", async ({ page }) => {
    await page.goto("/");

    // All four stat cards should show 0
    const statValues = page.locator("p.text-3xl");
    await expect(statValues).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(statValues.nth(i)).toHaveText("0");
    }
  });

  test("quick stats reflect created data after reload", async ({ page }) => {
    // Create 2 tasks
    await page.request.post("/api/tasks", {
      data: { title: "Task A", description: "desc", assignee: "user" },
    });
    await page.request.post("/api/tasks", {
      data: { title: "Task B", description: "desc", assignee: "agent" },
    });

    // Create 1 open bug
    await page.request.post("/api/bugs", {
      data: { title: "Bug X", screen: "Dash", severity: "high" },
    });

    // Create 1 active project
    await page.request.post("/api/projects", {
      data: { name: "Project Alpha" },
    });

    // Create 1 running agent
    await page.request.post("/api/team/agents", {
      data: { name: "AgentOne", role: "worker", status: "running" },
    });

    // Dashboard is a server component, so we must load the page after creating data
    await page.goto("/");

    // Verify: Total Tasks = 2, Open Bugs = 1, Active Projects = 1, Active Agents = 1
    const totalTasks = page.locator("a[href='/taskboard'] p.text-3xl");
    await expect(totalTasks).toHaveText("2");

    const openBugs = page.locator("a[href='/bugs'] p.text-3xl");
    await expect(openBugs).toHaveText("1");

    const activeProjects = page.locator("a[href='/projects'] p.text-3xl");
    await expect(activeProjects).toHaveText("1");

    const activeAgents = page.locator("a[href='/team'] p.text-3xl");
    await expect(activeAgents).toHaveText("1");
  });

  test("creating a task shows it in the task overview section", async ({ page }) => {
    await page.request.post("/api/tasks", {
      data: { title: "Overview Task", description: "test", assignee: "user" },
    });

    await page.goto("/");

    // The Task Overview section should show Backlog with count 1
    await expect(page.locator("text=Task Overview")).toBeVisible();
    // ColumnBar renders: label (span) | bar | count (span)
    // Backlog row has the label "Backlog" and count "1" in separate spans
    const backlogRow = page.locator("text=Backlog").locator("..");
    await expect(backlogRow.locator("text=1")).toBeVisible();
  });

  test("creating a bug shows it in the active bugs section", async ({ page }) => {
    await page.request.post("/api/bugs", {
      data: { title: "Active Bug", screen: "API", severity: "critical" },
    });

    await page.goto("/");

    // SeverityRow renders: dot | label | count
    await expect(page.locator("text=Active Bugs")).toBeVisible();
    const criticalRow = page.locator("text=Critical").locator("..");
    await expect(criticalRow.locator("text=1")).toBeVisible();
  });

  test("view board link navigates to taskboard", async ({ page }) => {
    await page.goto("/");
    await page.click("text=View board →");
    await expect(page).toHaveURL(/\/taskboard/);
  });

  test("view all bugs link navigates to bugs page", async ({ page }) => {
    // Need at least one open bug for the "View all" link to appear in Active Bugs
    await page.request.post("/api/bugs", {
      data: { title: "Link Bug", screen: "Dash", severity: "low" },
    });
    await page.goto("/");
    // The "View all" link in the Active Bugs section
    const activeBugsSection = page.locator("h3", { hasText: "Active Bugs" }).locator("..");
    await activeBugsSection.locator("text=View all →").click();
    await expect(page).toHaveURL(/\/bugs/);
  });

  test("quick stat card links navigate to correct pages", async ({ page }) => {
    await page.goto("/");

    // Total Tasks card links to /taskboard
    const taskCard = page.locator("a[href='/taskboard']").filter({ hasText: "Total Tasks" });
    await expect(taskCard).toBeVisible();

    // Open Bugs card links to /bugs
    const bugCard = page.locator("a[href='/bugs']").filter({ hasText: "Open Bugs" });
    await expect(bugCard).toBeVisible();

    // Active Projects card links to /projects
    const projectCard = page.locator("a[href='/projects']").filter({ hasText: "Active Projects" });
    await expect(projectCard).toBeVisible();

    // Active Agents card links to /team
    const agentCard = page.locator("a[href='/team']").filter({ hasText: "Active Agents" });
    await expect(agentCard).toBeVisible();
  });
});
