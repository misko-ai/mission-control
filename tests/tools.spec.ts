import { test, expect } from "@playwright/test";

test.describe("Tools page", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up all tools
    const toolsRes = await page.request.get("/api/tools");
    const toolsData = await toolsRes.json();
    for (const tool of toolsData.tools || []) {
      await page.request.delete(`/api/tools?id=${tool.id}`);
    }
  });

  test("renders page heading and empty state", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.locator("h2")).toHaveText("Tools");
    await expect(page.locator("text=No tools yet")).toBeVisible();
    await expect(
      page.locator("text=Create your first tool to get started")
    ).toBeVisible();
  });

  test("can create a tool with name and description", async ({ page }) => {
    await page.goto("/tools");
    await page.getByRole("button", { name: "New Tool" }).click();

    await page.fill('input[placeholder="My Awesome Tool"]', "Deploy Script");
    await page.fill(
      'textarea[placeholder="What does this tool do?"]',
      "Deploys code to production"
    );

    await page.getByRole("button", { name: "Create Tool" }).click();

    await expect(page.locator("h4", { hasText: "Deploy Script" })).toBeVisible();
    await expect(
      page.locator("text=Deploys code to production")
    ).toBeVisible();
    await expect(page.locator("text=1 tool registered")).toBeVisible();
  });

  test("can execute a tool and usage count increments", async ({ page }) => {
    await page.request.post("/api/tools", {
      data: {
        name: "RunCountTool",
        description: "Counts executions",
      },
    });
    await page.goto("/tools");

    // Verify initial usage count is 0
    await expect(page.locator("text=0 runs")).toBeVisible();

    // Click the Run button
    await page.getByRole("button", { name: "Run" }).click();

    // Usage count should increment to 1
    await expect(page.locator("text=1 run")).toBeVisible();
  });

  test("can delete a tool with confirmation", async ({ page }) => {
    await page.request.post("/api/tools", {
      data: {
        name: "DeleteMeTool",
        description: "Will be deleted",
      },
    });
    await page.goto("/tools");

    await expect(
      page.locator("h4", { hasText: "DeleteMeTool" })
    ).toBeVisible();

    // Click the trash icon button (title="Delete tool")
    await page.locator('button[title="Delete tool"]').click();

    // Confirm deletion — inline confirm shows a "Delete" button with check icon
    await expect(
      page.locator("button", { hasText: "Delete" })
    ).toBeVisible();
    await page.locator("button", { hasText: "Delete" }).click();

    // Tool should be gone, empty state returns
    await expect(
      page.locator("h4", { hasText: "DeleteMeTool" })
    ).not.toBeVisible();
  });

  test("empty state shows when no tools exist", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.locator("text=No tools yet")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create First Tool" })
    ).toBeVisible();
  });
});
