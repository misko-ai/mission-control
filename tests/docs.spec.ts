import { test, expect } from "@playwright/test";

test.describe("Docs page", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up all docs before each test
    const res = await page.request.get("/api/docs");
    const data = await res.json();
    for (const doc of data.docs || []) {
      await page.request.delete(`/api/docs?id=${doc.id}`);
    }
  });

  test("is accessible from sidebar navigation", async ({ page }) => {
    await page.goto("/");
    const docsLink = page.locator('nav a[href="/docs"]');
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toContainText("Docs");
  });

  test("renders page heading and empty state", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.locator("h2")).toHaveText("Docs");
    await expect(page.locator("text=No docs yet")).toBeVisible();
  });

  test("shows category filter tabs", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.locator("button", { hasText: "all" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "planning" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "technical" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "research" }).first()).toBeVisible();
  });

  test("can open and close the create form", async ({ page }) => {
    await page.goto("/docs");
    await page.click("text=+ New Doc");
    await expect(
      page.locator('input[placeholder="Document title..."]')
    ).toBeVisible();
    await page.locator("form button:has-text('Cancel')").click();
    await expect(
      page.locator('input[placeholder="Document title..."]')
    ).not.toBeVisible();
  });

  test("can create a document", async ({ page }) => {
    await page.goto("/docs");
    await page.click("text=+ New Doc");
    await page.fill('input[placeholder="Document title..."]', "API Architecture");
    await page.fill(
      'textarea[placeholder="Document content..."]',
      "# Overview\nREST API design for v2"
    );
    await page.locator("form select").first().selectOption("technical");
    await page.locator("form select").nth(1).selectOption("markdown");
    await page.click("text=Save Doc");

    await expect(page.locator("text=API Architecture")).toBeVisible();
    await expect(page.locator("text=technical").first()).toBeVisible();
    await expect(page.locator("text=markdown").first()).toBeVisible();
  });

  test("can expand a document to read full content", async ({ page }) => {
    await page.request.post("/api/docs", {
      data: {
        title: "Expandable doc",
        content: "Full document content here",
        category: "research",
        format: "plain text",
      },
    });
    await page.goto("/docs");

    // Content should not be visible before expanding
    await expect(page.locator("text=Full document content here")).not.toBeVisible();

    // Click to expand
    await page.locator("button", { hasText: "Expandable doc" }).click();
    await expect(page.locator("text=Full document content here")).toBeVisible();

    // Click again to collapse
    await page.locator("button", { hasText: "Expandable doc" }).click();
    await expect(page.locator("text=Full document content here")).not.toBeVisible();
  });

  test("can edit a document", async ({ page }) => {
    await page.request.post("/api/docs", {
      data: {
        title: "Edit me doc",
        content: "Original content",
        category: "draft",
        format: "plain text",
      },
    });
    await page.goto("/docs");

    // Expand first to access edit button
    await page.locator("button", { hasText: "Edit me doc" }).click();
    await page.locator("button:has-text('Edit')", { hasText: /^Edit$/ }).click();

    const titleInput = page.locator('input[value="Edit me doc"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill("Renamed doc");
    await page.locator("button:has-text('Save')", { hasText: /^Save$/ }).click();

    await expect(page.locator("text=Renamed doc")).toBeVisible();
  });

  test("can delete a document with confirmation", async ({ page }) => {
    await page.request.post("/api/docs", {
      data: {
        title: "Delete me doc",
        content: "Temporary",
        category: "other",
      },
    });
    await page.goto("/docs");

    // Expand to access delete button
    await page.locator("button", { hasText: "Delete me doc" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: "Confirm", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();

    await expect(page.locator("text=Delete me doc")).not.toBeVisible();
  });

  test("search filters documents by keyword", async ({ page }) => {
    await page.request.post("/api/docs", {
      data: { title: "React component guide", content: "How to build components" },
    });
    await page.request.post("/api/docs", {
      data: { title: "Database migration plan", content: "PostgreSQL upgrade steps" },
    });
    await page.goto("/docs");

    await page.fill('input[placeholder="Search docs..."]', "React");
    await expect(page.locator("text=React component guide")).toBeVisible();
    await expect(page.locator("text=Database migration plan")).not.toBeVisible();
  });

  test("category filter works", async ({ page }) => {
    await page.request.post("/api/docs", {
      data: {
        title: "Sprint plan",
        content: "Week 1 goals",
        category: "planning",
      },
    });
    await page.request.post("/api/docs", {
      data: {
        title: "API spec",
        content: "Endpoint definitions",
        category: "technical",
      },
    });
    await page.goto("/docs");

    await page.locator("button", { hasText: "planning" }).first().click();
    await expect(page.locator("text=Sprint plan")).toBeVisible();
    await expect(page.locator("text=API spec")).not.toBeVisible();
  });

  test("displays format and category badges", async ({ page }) => {
    await page.request.post("/api/docs", {
      data: {
        title: "Badged doc",
        content: "Content here",
        category: "newsletter",
        format: "markdown",
      },
    });
    await page.goto("/docs");

    await expect(page.locator("text=newsletter").first()).toBeVisible();
    await expect(page.locator("text=markdown").first()).toBeVisible();
  });
});
