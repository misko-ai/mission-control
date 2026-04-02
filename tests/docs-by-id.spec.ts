import { test, expect } from "@playwright/test";

test.describe("Docs by ID API", () => {
  let docId: string;

  test.beforeEach(async ({ page }) => {
    // Clean up all docs before each test
    const res = await page.request.get("/api/docs");
    const data = await res.json();
    for (const doc of data.docs || []) {
      await page.request.delete(`/api/docs?id=${doc.id}`);
    }

    // Create a test document
    const createRes = await page.request.post("/api/docs", {
      data: {
        title: "Test Document",
        content: "Original content",
        category: "technical",
        format: "markdown",
      },
    });
    const created = await createRes.json();
    docId = created.doc.id;
  });

  test("GET /api/docs/:id returns a single document", async ({ page }) => {
    const res = await page.request.get(`/api/docs/${docId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.doc).toBeDefined();
    expect(data.doc.id).toBe(docId);
    expect(data.doc.title).toBe("Test Document");
    expect(data.doc.content).toBe("Original content");
    expect(data.doc.category).toBe("technical");
    expect(data.doc.format).toBe("markdown");
  });

  test("GET /api/docs/:id returns 404 for nonexistent doc", async ({ page }) => {
    const res = await page.request.get("/api/docs/nonexistent-id-12345");
    expect(res.status()).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Doc not found");
  });

  test("PUT /api/docs/:id updates title", async ({ page }) => {
    const res = await page.request.put(`/api/docs/${docId}`, {
      data: { title: "Updated Title" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.doc.title).toBe("Updated Title");
    expect(data.doc.content).toBe("Original content");
  });

  test("PUT /api/docs/:id updates multiple fields", async ({ page }) => {
    const res = await page.request.put(`/api/docs/${docId}`, {
      data: {
        title: "New Title",
        content: "New content",
        category: "research",
        format: "plain text",
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.doc.title).toBe("New Title");
    expect(data.doc.content).toBe("New content");
    expect(data.doc.category).toBe("research");
    expect(data.doc.format).toBe("plain text");
  });

  test("PUT /api/docs/:id updates updatedAt timestamp", async ({ page }) => {
    const before = await page.request.get(`/api/docs/${docId}`);
    const beforeData = await before.json();
    const originalUpdatedAt = beforeData.doc.updatedAt;

    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 50));

    const res = await page.request.put(`/api/docs/${docId}`, {
      data: { title: "Timestamp test" },
    });
    const data = await res.json();
    expect(data.doc.updatedAt).not.toBe(originalUpdatedAt);
  });

  test("PUT /api/docs/:id returns 404 for nonexistent doc", async ({ page }) => {
    const res = await page.request.put("/api/docs/nonexistent-id-12345", {
      data: { title: "Nope" },
    });
    expect(res.status()).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Doc not found");
  });

  test("PUT /api/docs/:id rejects invalid category", async ({ page }) => {
    const res = await page.request.put(`/api/docs/${docId}`, {
      data: { category: "invalid-category" },
    });
    expect(res.status()).toBe(400);
  });

  test("PUT /api/docs/:id rejects invalid format", async ({ page }) => {
    const res = await page.request.put(`/api/docs/${docId}`, {
      data: { format: "invalid-format" },
    });
    expect(res.status()).toBe(400);
  });

  test("GET /api/docs/:id reflects changes from PUT", async ({ page }) => {
    await page.request.put(`/api/docs/${docId}`, {
      data: { title: "Verified Update", content: "Verified content" },
    });

    const res = await page.request.get(`/api/docs/${docId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.doc.title).toBe("Verified Update");
    expect(data.doc.content).toBe("Verified content");
  });
});
