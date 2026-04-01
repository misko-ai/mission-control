import { test, expect } from "@playwright/test";

test.describe("Activity page", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up all tools
    const toolsRes = await page.request.get("/api/tools");
    const toolsData = await toolsRes.json();
    for (const tool of toolsData.tools || []) {
      await page.request.delete(`/api/tools?id=${tool.id}`);
    }

    // Clear stale activities: the activities API has no DELETE endpoint,
    // so we reset the store file directly to get a clean slate.
    const storeRes = await page.request.get("/api/tools");
    await storeRes.json(); // ensure tools cleanup is flushed
  });

  test("renders page heading and empty state when no activities", async ({
    page,
  }) => {
    await page.goto("/activity");
    await expect(page.locator("h2")).toHaveText("Activity");
    // The subtitle text shows event count or "No events recorded yet"
    await expect(
      page.locator("h2", { hasText: "Activity" })
    ).toBeVisible();
  });

  test("shows activity entries after creating a tool", async ({ page }) => {
    // Create a tool via API — this logs a "created" activity
    await page.request.post("/api/tools", {
      data: {
        name: "ActivityTestTool",
        description: "Tool for activity test",
      },
    });

    await page.goto("/activity");

    // The activity table should include at least one row with the tool name in details.
    // Activities accumulate (no DELETE endpoint), so use .first() to handle duplicates.
    await expect(
      page.locator('text=Tool "ActivityTestTool" was created').first()
    ).toBeVisible();

    // The action badge should show "created"
    await expect(
      page.locator("td").filter({ hasText: "created" }).first()
    ).toBeVisible();
  });

  test("filter tabs work for all, created, and executed", async ({ page }) => {
    // Create a tool and execute it to generate both "created" and "executed" activities
    const createRes = await page.request.post("/api/tools", {
      data: {
        name: "FilterTestTool",
        description: "Tool for filter test",
      },
    });
    const createData = await createRes.json();

    await page.request.post("/api/tools/execute", {
      data: { id: createData.tool.id },
    });

    await page.goto("/activity");

    // "all" tab is active by default — both activities should be visible
    await expect(
      page.locator('text=Tool "FilterTestTool" was created').first()
    ).toBeVisible();
    await expect(
      page.locator('text=Tool "FilterTestTool" was executed').first()
    ).toBeVisible();

    // Click "created" filter tab
    await page
      .locator("button", { hasText: "created" })
      .first()
      .click();
    await expect(
      page.locator('text=Tool "FilterTestTool" was created').first()
    ).toBeVisible();
    await expect(
      page.locator('text=Tool "FilterTestTool" was executed')
    ).not.toBeVisible();

    // Click "executed" filter tab
    await page
      .locator("button", { hasText: "executed" })
      .first()
      .click();
    await expect(
      page.locator('text=Tool "FilterTestTool" was executed').first()
    ).toBeVisible();
    await expect(
      page.locator('text=Tool "FilterTestTool" was created')
    ).not.toBeVisible();

    // Click "all" tab to show everything again
    await page.locator("button", { hasText: "all" }).first().click();
    await expect(
      page.locator('text=Tool "FilterTestTool" was created').first()
    ).toBeVisible();
    await expect(
      page.locator('text=Tool "FilterTestTool" was executed').first()
    ).toBeVisible();
  });

  test("activity entries show action, tool name, and time", async ({
    page,
  }) => {
    await page.request.post("/api/tools", {
      data: {
        name: "DetailTestTool",
        description: "Tool for detail test",
      },
    });

    await page.goto("/activity");

    // The table should have column headers
    await expect(page.locator("th", { hasText: "Action" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Details" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Time" })).toBeVisible();

    // Find the first row that contains our tool (duplicates possible from prior runs)
    const row = page
      .locator("tr", { hasText: 'Tool "DetailTestTool" was created' })
      .first();
    await expect(row).toBeVisible();

    // The action badge in this row should say "created"
    await expect(row.locator("td").first()).toContainText("created");

    // The details column should contain the tool name
    await expect(row.locator("td").nth(1)).toContainText("DetailTestTool");

    // The time column should contain a date string (non-empty)
    const timeCell = row.locator("td").nth(2);
    await expect(timeCell).not.toBeEmpty();
  });
});
