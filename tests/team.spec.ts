import { test, expect } from "@playwright/test";

test.describe("Team page", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up all agents before each test
    const res = await page.request.get("/api/team/agents");
    const data = await res.json();
    for (const agent of data.agents || []) {
      await page.request.delete(`/api/team/agents?id=${agent.id}`);
    }
    // Reset mission statement
    await page.request.put("/api/team/mission", {
      data: { missionStatement: "" },
    });
  });

  test("is accessible from sidebar navigation", async ({ page }) => {
    await page.goto("/");
    const teamLink = page.locator('nav a[href="/team"]');
    await expect(teamLink).toBeVisible();
    await expect(teamLink).toContainText("Team");
  });

  test("renders page heading and empty state", async ({ page }) => {
    await page.goto("/team");
    await expect(page.locator("h2")).toHaveText("Team");
    await expect(page.locator("text=No agents yet")).toBeVisible();
  });

  test("shows mission statement section", async ({ page }) => {
    await page.goto("/team");
    await expect(
      page.getByRole("heading", { name: "Mission Statement" })
    ).toBeVisible();
    await expect(
      page.locator("text=No mission statement set")
    ).toBeVisible();
  });

  test("can set and edit the mission statement", async ({ page }) => {
    await page.goto("/team");
    await page.getByRole("button", { name: "Set Mission", exact: true }).click();
    await page.fill(
      'textarea[placeholder="Define the north star every agent works toward..."]',
      "Build the best AI-powered productivity system"
    );
    await page.getByRole("button", { name: "Save", exact: true }).first().click();

    await expect(
      page.locator("text=Build the best AI-powered productivity system")
    ).toBeVisible();

    // Edit it
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    const textarea = page.locator("textarea");
    await textarea.fill("Updated mission: ship fast, ship well");
    await page.getByRole("button", { name: "Save", exact: true }).first().click();

    await expect(
      page.locator("text=Updated mission: ship fast, ship well")
    ).toBeVisible();
  });

  test("can open and close the create agent form", async ({ page }) => {
    await page.goto("/team");
    await page.click("text=+ Add Agent");
    await expect(
      page.locator('input[placeholder="Agent name..."]')
    ).toBeVisible();
    await page.locator("form button:has-text('Cancel')").click();
    await expect(
      page.locator('input[placeholder="Agent name..."]')
    ).not.toBeVisible();
  });

  test("can create an agent", async ({ page }) => {
    await page.goto("/team");
    await page.click("text=+ Add Agent");
    await page.fill('input[placeholder="Agent name..."]', "Misko");
    await page.locator("form select").first().selectOption("orchestrator");
    await page.fill(
      'input[placeholder="What does this agent do..."]',
      "Coordinates all sub-agents"
    );
    await page.fill('input[placeholder="e.g. Claude Opus 4"]', "Claude Opus 4");
    await page.click("text=Add Agent");

    await expect(page.locator("text=Misko")).toBeVisible();
    await expect(page.locator("text=orchestrator").first()).toBeVisible();
    await expect(page.locator("text=Coordinates all sub-agents")).toBeVisible();
    await expect(page.locator("text=Claude Opus 4")).toBeVisible();
  });

  test("can edit an agent", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: {
        name: "Edit Agent",
        role: "worker",
        description: "Original desc",
        model: "GPT-4",
      },
    });
    await page.goto("/team");

    // Wait for agent data to load
    const card = page
      .locator(".rounded-lg", { hasText: "Edit Agent" })
      .first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.getByRole("button", { name: "Edit", exact: true }).click();

    const nameInput = page.locator('input[value="Edit Agent"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Renamed Agent");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.locator("text=Renamed Agent")).toBeVisible();
  });

  test("can delete an agent with confirmation", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: { name: "Delete Me Agent", role: "worker" },
    });
    await page.goto("/team");

    const card = page
      .locator(".rounded-lg", { hasText: "Delete Me Agent" })
      .first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(
      card.getByRole("button", { name: "Confirm", exact: true })
    ).toBeVisible();
    await card.getByRole("button", { name: "Confirm", exact: true }).click();

    await expect(page.locator("text=Delete Me Agent")).not.toBeVisible();
  });

  test("displays role and status badges", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: {
        name: "Badge Agent",
        role: "specialist",
        status: "running",
        model: "Claude Sonnet",
      },
    });
    await page.goto("/team");

    await expect(page.locator("text=specialist").first()).toBeVisible();
    await expect(page.locator("text=Running")).toBeVisible();
    await expect(page.locator("text=Claude Sonnet")).toBeVisible();
  });

  test("shows hierarchy with parent-child agents", async ({ page }) => {
    // Create parent
    const parentRes = await page.request.post("/api/team/agents", {
      data: {
        name: "Lead Orchestrator",
        role: "orchestrator",
        description: "Top-level coordinator",
      },
    });
    const parentData = await parentRes.json();

    // Create child
    await page.request.post("/api/team/agents", {
      data: {
        name: "Worker Bot",
        role: "worker",
        description: "Handles tasks",
        parentId: parentData.agent.id,
      },
    });

    await page.goto("/team");

    await expect(page.locator("text=Lead Orchestrator")).toBeVisible();
    await expect(page.locator("text=Worker Bot")).toBeVisible();
    // Child should be indented (rendered after parent in the DOM)
    const allCards = page.locator(".rounded-lg", { hasText: /Lead Orchestrator|Worker Bot/ });
    await expect(allCards).toHaveCount(2);
  });

  test("shows org structure heading", async ({ page }) => {
    await page.goto("/team");
    await expect(page.locator("text=Org Structure")).toBeVisible();
  });
});
