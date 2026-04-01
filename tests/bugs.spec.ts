import { test, expect } from "@playwright/test";

test.describe("Bug Reports page", () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request.get("/api/bugs");
    const data = await res.json();
    for (const bug of data.bugs || []) {
      await page.request.delete(`/api/bugs?id=${bug.id}`);
    }
  });

  test("is accessible from sidebar navigation", async ({ page }) => {
    await page.goto("/");
    const bugsLink = page.locator('nav a[href="/bugs"]');
    await expect(bugsLink).toBeVisible();
    await expect(bugsLink).toContainText("Bugs");
  });

  test("renders page heading and empty state", async ({ page }) => {
    await page.goto("/bugs");
    await expect(page.locator("h2")).toHaveText("Bug Reports");
    await expect(page.locator("text=No bugs reported")).toBeVisible();
  });

  test("shows status and severity filter tabs", async ({ page }) => {
    await page.goto("/bugs");
    await expect(page.locator("button", { hasText: "open" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "resolved" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "critical" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "low" }).first()).toBeVisible();
  });

  test("can open and close the create form", async ({ page }) => {
    await page.goto("/bugs");
    await page.click("text=+ Report Bug");
    await expect(
      page.locator('input[placeholder="Short bug description..."]')
    ).toBeVisible();
    await page.locator("form button:has-text('Cancel')").click();
    await expect(
      page.locator('input[placeholder="Short bug description..."]')
    ).not.toBeVisible();
  });

  test("can create a bug report", async ({ page }) => {
    await page.goto("/bugs");
    await page.click("text=+ Report Bug");
    await page.fill(
      'input[placeholder="Short bug description..."]',
      "Calendar events overlap"
    );
    await page.fill(
      'input[placeholder="e.g. Taskboard, Calendar..."]',
      "Calendar"
    );
    await page.locator("form select").first().selectOption("high");
    await page.fill(
      'textarea[placeholder="How was this bug found..."]',
      "Create two events at the same time"
    );
    await page.click("text=Submit Bug");

    await expect(page.locator("text=Calendar events overlap")).toBeVisible();
    await expect(page.locator("text=high").first()).toBeVisible();
    await expect(page.locator("text=Calendar").first()).toBeVisible();
  });

  test("can expand a bug to see details", async ({ page }) => {
    await page.request.post("/api/bugs", {
      data: {
        title: "Expandable bug",
        screen: "Dashboard",
        severity: "medium",
        stepsToReproduce: "Click the refresh button twice",
      },
    });
    await page.goto("/bugs");

    // Steps not visible before expanding
    await expect(
      page.locator("text=Click the refresh button twice")
    ).not.toBeVisible();

    await page.locator("button", { hasText: "Expandable bug" }).click();
    await expect(
      page.locator("text=Click the refresh button twice")
    ).toBeVisible();
    await expect(page.locator("text=Steps to Reproduce")).toBeVisible();
  });

  test("can update bug status to resolved", async ({ page }) => {
    await page.request.post("/api/bugs", {
      data: {
        title: "Status test bug",
        screen: "Tools",
        severity: "low",
      },
    });
    await page.goto("/bugs");

    await page.locator("button", { hasText: "Status test bug" }).click();
    await page.getByRole("button", { name: "Mark Resolved", exact: true }).click();

    await expect(page.getByText("resolved", { exact: true }).first()).toBeVisible();
  });

  test("can reopen a resolved bug", async ({ page }) => {
    await page.request.post("/api/bugs", {
      data: {
        title: "Reopen test bug",
        screen: "Settings",
        severity: "medium",
        status: "resolved",
      },
    });
    await page.goto("/bugs");

    await page.locator("button", { hasText: "Reopen test bug" }).click();
    await page.getByRole("button", { name: "Reopen", exact: true }).click();

    await expect(page.getByText("open", { exact: true }).first()).toBeVisible();
  });

  test("can add a note to a bug", async ({ page }) => {
    const createRes = await page.request.post("/api/bugs", {
      data: {
        title: "Note test bug",
        screen: "Taskboard",
        severity: "high",
      },
    });
    const createData = await createRes.json();
    expect(createData.success).toBe(true);

    // Verify the bug exists via GET before navigating
    const verifyRes = await page.request.get("/api/bugs");
    const verifyData = await verifyRes.json();
    expect(verifyData.bugs.length).toBeGreaterThan(0);

    await page.goto("/bugs");
    // Wait for page to fully load and show the bug
    await expect(page.locator("h2")).toHaveText("Bug Reports");

    const bugButton = page.locator("button", { hasText: "Note test bug" });
    await expect(bugButton).toBeVisible({ timeout: 10000 });
    await bugButton.click();

    const noteInput = page.locator('input[placeholder="Add a note..."]');
    await expect(noteInput).toBeVisible();
    await noteInput.fill("This only happens on refresh");
    const addBtn = page.getByRole("button", { name: "Add Note", exact: true });
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    // Wait for note to appear after the API call and re-fetch
    await expect(
      page.locator("text=This only happens on refresh")
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("user", { exact: true }).first()).toBeVisible();
  });

  test("can delete a bug with confirmation", async ({ page }) => {
    await page.request.post("/api/bugs", {
      data: {
        title: "Delete me bug",
        screen: "Projects",
        severity: "low",
      },
    });
    await page.goto("/bugs");

    await page.locator("button", { hasText: "Delete me bug" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Confirm Delete", exact: true })
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Confirm Delete", exact: true })
      .click();

    await expect(page.locator("text=Delete me bug")).not.toBeVisible();
  });

  test("severity filter works", async ({ page }) => {
    await page.request.post("/api/bugs", {
      data: { title: "Critical bug", screen: "API", severity: "critical" },
    });
    await page.request.post("/api/bugs", {
      data: { title: "Low bug", screen: "UI", severity: "low" },
    });
    await page.goto("/bugs");

    await page.locator("button", { hasText: "critical" }).first().click();
    await expect(page.locator("text=Critical bug")).toBeVisible();
    await expect(page.locator("text=Low bug")).not.toBeVisible();
  });

  test("status filter works", async ({ page }) => {
    await page.request.post("/api/bugs", {
      data: {
        title: "Open bug",
        screen: "Dash",
        severity: "medium",
        status: "open",
      },
    });
    await page.request.post("/api/bugs", {
      data: {
        title: "Resolved bug",
        screen: "Dash",
        severity: "medium",
        status: "resolved",
      },
    });
    await page.goto("/bugs");

    await page.locator("button", { hasText: "resolved" }).first().click();
    await expect(page.locator("text=Resolved bug")).toBeVisible();
    await expect(page.locator("text=Open bug")).not.toBeVisible();
  });

  test("displays severity and status badges", async ({ page }) => {
    await page.request.post("/api/bugs", {
      data: {
        title: "Badge test bug",
        screen: "Calendar",
        severity: "critical",
        status: "open",
      },
    });
    await page.goto("/bugs");

    await expect(page.getByText("critical", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("open", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Calendar").first()).toBeVisible();
  });
});
