import { test, expect } from "@playwright/test";

test.describe("Office page", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up all agents before each test
    const res = await page.request.get("/api/team/agents");
    const data = await res.json();
    for (const agent of data.agents || []) {
      await page.request.delete(`/api/team/agents?id=${agent.id}`);
    }
  });

  test("is accessible from sidebar navigation", async ({ page }) => {
    await page.goto("/");
    const officeLink = page.locator('nav a[href="/office"]');
    await expect(officeLink).toBeVisible();
    await expect(officeLink).toContainText("Office");
  });

  test("renders page heading and empty state", async ({ page }) => {
    await page.goto("/office");
    await expect(page.locator("h2")).toHaveText("Office");
    await expect(page.locator("text=Office is empty")).toBeVisible();
    await expect(
      page.locator("text=Add agents on the Team page")
    ).toBeVisible();
  });

  test("shows running agent at their desk", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: {
        name: "DeskBot",
        role: "worker",
        description: "Processing tasks",
        model: "Claude Sonnet",
        status: "running",
      },
    });
    await page.goto("/office");

    // Agent name should be visible in the office
    await expect(page.locator("text=DeskBot")).toBeVisible();
    // Should have a status indicator
    const sprite = page.locator('[data-agent-name="DeskBot"]');
    await expect(sprite).toBeVisible();
    await expect(sprite).toHaveAttribute("data-agent-status", "running");
  });

  test("shows idle agent near water cooler", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: {
        name: "IdleBot",
        role: "specialist",
        description: "Waiting for work",
        status: "idle",
      },
    });
    await page.goto("/office");
    // Wait for loading to finish
    await expect(page.locator("h2", { hasText: "Office" })).toBeVisible();

    const sprite = page.locator('[data-agent-name="IdleBot"]');
    await expect(sprite).toBeVisible();
    await expect(sprite).toHaveAttribute("data-agent-status", "idle");
  });

  test("offline agents are not shown on the floor", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: {
        name: "OfflineBot",
        role: "worker",
        status: "offline",
      },
    });
    await page.goto("/office");

    // No sprite on the floor
    const sprite = page.locator('[data-agent-name="OfflineBot"]');
    await expect(sprite).not.toBeVisible();
    // But listed in the offline panel
    await expect(page.locator("text=Offline").first()).toBeVisible();
    await expect(page.locator("text=OfflineBot")).toBeVisible();
  });

  test("clicking an agent shows detail panel", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: {
        name: "ClickBot",
        role: "orchestrator",
        description: "Coordinating all tasks",
        model: "Claude Opus",
        status: "running",
      },
    });
    await page.goto("/office");

    // Click the agent sprite (force: animated elements aren't "stable")
    await page.locator('[data-agent-name="ClickBot"]').click({ force: true });

    // Detail panel should show agent details
    await expect(page.locator("text=Coordinating all tasks")).toBeVisible();
    await expect(page.locator("text=Claude Opus")).toBeVisible();
    await expect(page.getByText("orchestrator", { exact: true })).toBeVisible();
    await expect(page.getByText("At desk", { exact: true })).toBeVisible();
  });

  test("detail panel shows water cooler location for idle agent", async ({
    page,
  }) => {
    await page.request.post("/api/team/agents", {
      data: {
        name: "ChillBot",
        role: "worker",
        description: "On break",
        status: "idle",
      },
    });
    await page.goto("/office");

    await page.locator('[data-agent-name="ChillBot"]').click({ force: true });
    await expect(page.getByText("Water cooler", { exact: true })).toBeVisible();
  });

  test("dismiss button closes the detail panel", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: {
        name: "DismissBot",
        role: "worker",
        status: "running",
      },
    });
    await page.goto("/office");

    await page.locator('[data-agent-name="DismissBot"]').click({ force: true });
    await expect(page.getByText("running", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(page.locator("text=Click an agent to inspect")).toBeVisible();
  });

  test("shows legend with status and role colors", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: { name: "AnyBot", role: "worker", status: "running" },
    });
    await page.goto("/office");

    await expect(page.locator("text=Legend")).toBeVisible();
    await expect(
      page.locator("text=Running — at desk, working")
    ).toBeVisible();
    await expect(
      page.locator("text=Idle — at the water cooler")
    ).toBeVisible();
    await expect(page.locator("text=Offline — not in office")).toBeVisible();
    await expect(page.locator("text=Orchestrator")).toBeVisible();
    await expect(page.locator("text=Specialist")).toBeVisible();
    await expect(page.locator("text=Worker")).toBeVisible();
  });

  test("shows multiple agents simultaneously", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: { name: "AgentAlpha", role: "orchestrator", status: "running" },
    });
    await page.request.post("/api/team/agents", {
      data: { name: "AgentBeta", role: "worker", status: "running" },
    });
    await page.request.post("/api/team/agents", {
      data: { name: "AgentGamma", role: "specialist", status: "idle" },
    });

    // Verify all 3 agents exist before navigating
    const verifyRes = await page.request.get("/api/team/agents");
    const verifyData = await verifyRes.json();
    expect(verifyData.agents.length).toBe(3);

    await page.goto("/office");

    await expect(page.locator('[data-agent-name="AgentAlpha"]')).toBeVisible();
    await expect(page.locator('[data-agent-name="AgentBeta"]')).toBeVisible();
    await expect(page.locator('[data-agent-name="AgentGamma"]')).toBeVisible();
    // Header shows count
    await expect(page.locator("text=3 in office")).toBeVisible();
  });

  test("displays in-office vs offline count", async ({ page }) => {
    await page.request.post("/api/team/agents", {
      data: { name: "InBot", role: "worker", status: "running" },
    });
    await page.request.post("/api/team/agents", {
      data: { name: "OutBot", role: "worker", status: "offline" },
    });
    await page.goto("/office");

    await expect(page.locator("text=1 in office")).toBeVisible();
    await expect(page.locator("text=1 offline")).toBeVisible();
  });
});
