import { test, expect } from "@playwright/test";

test.describe("Memories page", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up all memories before each test
    const convRes = await page.request.get("/api/memories/conversation");
    const convData = await convRes.json();
    for (const memory of convData.memories || []) {
      await page.request.delete(`/api/memories/conversation?id=${memory.id}`);
    }
    const ltRes = await page.request.get("/api/memories/longterm");
    const ltData = await ltRes.json();
    for (const memory of ltData.memories || []) {
      await page.request.delete(`/api/memories/longterm?id=${memory.id}`);
    }
  });

  test("is accessible from sidebar navigation", async ({ page }) => {
    await page.goto("/");
    const memoriesLink = page.locator('nav a[href="/memories"]');
    await expect(memoriesLink).toBeVisible();
    await expect(memoriesLink).toContainText("Memories");
  });

  test("renders page heading and empty state", async ({ page }) => {
    await page.goto("/memories");
    await expect(page.locator("h2")).toHaveText("Memories");
    await expect(page.locator("text=No memories yet")).toBeVisible();
  });

  test("shows tab switcher with Conversations and Long-Term tabs", async ({
    page,
  }) => {
    await page.goto("/memories");
    await expect(
      page.locator("button", { hasText: "Conversations" })
    ).toBeVisible();
    await expect(
      page.locator("button", { hasText: "Long-Term" })
    ).toBeVisible();
  });

  test("can open and close the conversation memory create form", async ({
    page,
  }) => {
    await page.goto("/memories");
    await page.click("text=+ New Memory");
    await expect(
      page.locator('input[placeholder="What was discussed..."]')
    ).toBeVisible();
    // Use the Cancel button inside the form
    await page.locator("form button:has-text('Cancel')").click();
    await expect(
      page.locator('input[placeholder="What was discussed..."]')
    ).not.toBeVisible();
  });

  test("can create a conversation memory", async ({ page }) => {
    await page.goto("/memories");
    await page.click("text=+ New Memory");
    await page.fill(
      'input[placeholder="What was discussed..."]',
      "API Design Review"
    );
    await page.fill(
      'textarea[placeholder="Details and notes..."]',
      "Decided to use REST over GraphQL"
    );
    await page.fill(
      'input[placeholder="architecture, decision, preference"]',
      "api, decision"
    );
    await page.click("text=Save Memory");

    await expect(page.locator("text=API Design Review")).toBeVisible();
    await expect(
      page.locator("text=Decided to use REST over GraphQL")
    ).toBeVisible();
  });

  test("can edit a conversation memory inline", async ({ page }) => {
    await page.request.post("/api/memories/conversation", {
      data: { title: "Edit me memory", content: "Original content" },
    });
    await page.goto("/memories");

    const card = page
      .locator(".rounded-lg", { hasText: "Edit me memory" })
      .first();
    await expect(card).toBeVisible();
    await card.locator("button:has-text('Edit')").click();

    const titleInput = page.locator('input[value="Edit me memory"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill("Renamed memory");
    await page.locator("button:has-text('Save')").click();

    await expect(page.locator("text=Renamed memory")).toBeVisible();
  });

  test("can delete a conversation memory with confirmation", async ({
    page,
  }) => {
    await page.request.post("/api/memories/conversation", {
      data: { title: "Delete me memory", content: "Temporary" },
    });
    await page.goto("/memories");

    const card = page
      .locator(".rounded-lg", { hasText: "Delete me memory" })
      .first();
    await expect(card).toBeVisible();
    await card.locator("button:has-text('Delete')").click();
    await expect(card.locator("button:has-text('Confirm')")).toBeVisible();
    await card.locator("button:has-text('Confirm')").click();

    await expect(page.locator("text=Delete me memory")).not.toBeVisible();
  });

  test("conversation memories display tags as badges", async ({ page }) => {
    await page.request.post("/api/memories/conversation", {
      data: {
        title: "Tagged memory",
        content: "Has tags",
        tags: ["architecture", "frontend"],
      },
    });
    await page.goto("/memories");

    await expect(page.locator("text=architecture")).toBeVisible();
    await expect(page.locator("text=frontend")).toBeVisible();
  });

  test("search filters conversation memories by keyword", async ({ page }) => {
    await page.request.post("/api/memories/conversation", {
      data: {
        title: "React hooks discussion",
        content: "useState and useEffect",
      },
    });
    await page.request.post("/api/memories/conversation", {
      data: { title: "Database schema", content: "PostgreSQL design" },
    });
    await page.goto("/memories");

    await page.fill('input[placeholder="Search memories..."]', "React");
    await expect(page.locator("text=React hooks discussion")).toBeVisible();
    await expect(page.locator("text=Database schema")).not.toBeVisible();
  });

  test("can switch to Long-Term tab and see empty state", async ({ page }) => {
    await page.goto("/memories");
    await page.click("button:has-text('Long-Term')");
    await expect(page.locator("text=No memories yet")).toBeVisible();
  });

  test("can create a long-term memory", async ({ page }) => {
    await page.goto("/memories");
    await page.click("button:has-text('Long-Term')");
    await page.click("text=+ New Memory");
    await page.fill(
      'input[placeholder="Important fact or preference..."]',
      "Prefers TypeScript"
    );
    await page.fill(
      'textarea[placeholder="Details..."]',
      "Always use TypeScript with strict mode"
    );
    await page.click("text=Save Memory");

    await expect(page.locator("text=Prefers TypeScript")).toBeVisible();
  });

  test("can delete a long-term memory", async ({ page }) => {
    await page.request.post("/api/memories/longterm", {
      data: { title: "Delete LT memory", content: "Temporary", category: "fact" },
    });
    await page.goto("/memories");
    await page.click("button:has-text('Long-Term')");

    const card = page
      .locator(".rounded-lg", { hasText: "Delete LT memory" })
      .first();
    await card.locator("button:has-text('Delete')").click();
    await card.locator("button:has-text('Confirm')").click();

    await expect(page.locator("text=Delete LT memory")).not.toBeVisible();
  });

  test("category filter works for long-term memories", async ({ page }) => {
    await page.request.post("/api/memories/longterm", {
      data: {
        title: "A preference",
        content: "Likes dark mode",
        category: "preference",
      },
    });
    await page.request.post("/api/memories/longterm", {
      data: {
        title: "A decision",
        content: "Use Next.js",
        category: "decision",
      },
    });
    await page.goto("/memories");
    await page.click("button:has-text('Long-Term')");

    await page.locator("button", { hasText: "preference" }).first().click();
    await expect(page.locator("text=A preference")).toBeVisible();
    await expect(page.locator("text=A decision")).not.toBeVisible();
  });
});
