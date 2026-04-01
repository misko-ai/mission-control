import { test, expect } from "@playwright/test";

test.describe("Search modal", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up tasks
    const tasksRes = await page.request.get("/api/tasks");
    const tasksData = await tasksRes.json();
    for (const task of tasksData.tasks || []) {
      await page.request.delete(`/api/tasks?id=${task.id}`);
    }

    // Clean up docs
    const docsRes = await page.request.get("/api/docs");
    const docsData = await docsRes.json();
    for (const doc of docsData.docs || []) {
      await page.request.delete(`/api/docs?id=${doc.id}`);
    }

    // Clean up bugs
    const bugsRes = await page.request.get("/api/bugs");
    const bugsData = await bugsRes.json();
    for (const bug of bugsData.bugs || []) {
      await page.request.delete(`/api/bugs?id=${bug.id}`);
    }

    // Seed data with a shared keyword
    await page.request.post("/api/tasks", {
      data: {
        title: "Fix zyphor alignment issue",
        description: "The zyphor module is misaligned",
        assignee: "user",
      },
    });
    await page.request.post("/api/docs", {
      data: {
        title: "Zyphor integration guide",
        content: "How to integrate the zyphor system",
      },
    });
    await page.request.post("/api/bugs", {
      data: {
        title: "Zyphor crashes on startup",
        screen: "Dashboard",
        severity: "high",
      },
    });
  });

  test("Ctrl+K opens the search modal and Escape closes it", async ({
    page,
  }) => {
    await page.goto("/");

    // Modal should not be visible initially
    await expect(
      page.locator(
        'input[placeholder="Search across tasks, docs, memories, bugs, projects..."]'
      )
    ).not.toBeVisible();

    // Open with Ctrl+K
    await page.keyboard.press("Control+k");
    await expect(
      page.locator(
        'input[placeholder="Search across tasks, docs, memories, bugs, projects..."]'
      )
    ).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(
      page.locator(
        'input[placeholder="Search across tasks, docs, memories, bugs, projects..."]'
      )
    ).not.toBeVisible();
  });

  test("typing fewer than 2 characters shows no results", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");

    const input = page.locator(
      'input[placeholder="Search across tasks, docs, memories, bugs, projects..."]'
    );
    await expect(input).toBeVisible();

    // Type a single character
    await input.fill("z");

    // The hint text should still be visible (fewer than 2 chars)
    await expect(
      page.getByText("Type at least 2 characters to search")
    ).toBeVisible();
  });

  test("searching returns results across categories", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");

    const input = page.locator(
      'input[placeholder="Search across tasks, docs, memories, bugs, projects..."]'
    );
    await input.fill("zyphor");

    // Scope assertions to the search modal overlay
    const modal = page.locator('[style*="position: fixed"]');

    // Wait for debounced results to appear
    await expect(modal.getByText("Tasks").first()).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText("Docs").first()).toBeVisible();
    await expect(modal.getByText("Bugs").first()).toBeVisible();

    // Verify individual result titles appear
    await expect(
      modal.getByText("Fix zyphor alignment issue").first()
    ).toBeVisible();
    await expect(
      modal.getByText("Zyphor integration guide").first()
    ).toBeVisible();
    await expect(
      modal.getByText("Zyphor crashes on startup").first()
    ).toBeVisible();
  });

  test("shows no results message for unmatched queries", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");

    const input = page.locator(
      'input[placeholder="Search across tasks, docs, memories, bugs, projects..."]'
    );
    await input.fill("xqvwplmnk");

    // Wait for the no-results message
    await expect(
      page.getByText('No results found for')
    ).toBeVisible({ timeout: 5000 });
  });

  test("clicking the overlay background closes the modal", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");

    const input = page.locator(
      'input[placeholder="Search across tasks, docs, memories, bugs, projects..."]'
    );
    await expect(input).toBeVisible();

    // Click the overlay (top-left corner, outside the centered dialog)
    await page.mouse.click(5, 5);

    await expect(input).not.toBeVisible();
  });
});
