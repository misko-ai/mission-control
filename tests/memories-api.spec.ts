import { test, expect } from "@playwright/test";

test.describe("Unified /api/memories endpoint", () => {
  test.beforeEach(async ({ page }) => {
    // Clean all conversation memories
    const convRes = await page.request.get("/api/memories/conversation");
    const convData = await convRes.json();
    for (const m of convData.memories || []) {
      await page.request.delete(`/api/memories/conversation?id=${m.id}`);
    }
    // Clean all longterm memories
    const ltRes = await page.request.get("/api/memories/longterm");
    const ltData = await ltRes.json();
    for (const m of ltData.memories || []) {
      await page.request.delete(`/api/memories/longterm?id=${m.id}`);
    }
  });

  // --------------- helpers ---------------
  async function createConversation(
    page: import("@playwright/test").Page,
    title = "Conv Memory",
    content = "Conversation content"
  ) {
    const res = await page.request.post("/api/memories/conversation", {
      data: { title, content },
    });
    return (await res.json()).memory;
  }

  async function createLongterm(
    page: import("@playwright/test").Page,
    title = "LT Memory",
    content = "Long-term content",
    category = "other"
  ) {
    const res = await page.request.post("/api/memories/longterm", {
      data: { title, content, category },
    });
    return (await res.json()).memory;
  }

  // ===================================================================
  //  Category 1: GET — listing memories
  // ===================================================================

  test("GET returns empty arrays when no memories exist", async ({ page }) => {
    const res = await page.request.get("/api/memories");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.memories).toEqual([]);
    expect(data.conversationMemories).toEqual([]);
    expect(data.longTermMemories).toEqual([]);
  });

  test("GET returns conversation memories", async ({ page }) => {
    const mem = await createConversation(page);
    const res = await page.request.get("/api/memories");
    const data = await res.json();
    expect(data.memories.length).toBe(1);
    expect(data.conversationMemories.length).toBe(1);
    expect(data.longTermMemories.length).toBe(0);
    expect(data.memories[0].id).toBe(mem.id);
  });

  test("GET returns longterm memories", async ({ page }) => {
    const mem = await createLongterm(page);
    const res = await page.request.get("/api/memories");
    const data = await res.json();
    expect(data.memories.length).toBe(1);
    expect(data.longTermMemories.length).toBe(1);
    expect(data.conversationMemories.length).toBe(0);
    expect(data.memories[0].id).toBe(mem.id);
  });

  test("GET returns both types combined", async ({ page }) => {
    await createConversation(page);
    await createLongterm(page);
    const res = await page.request.get("/api/memories");
    const data = await res.json();
    expect(data.memories.length).toBe(2);
    expect(data.conversationMemories.length).toBe(1);
    expect(data.longTermMemories.length).toBe(1);
  });

  test("GET ?type=conversation filters to conversation only", async ({ page }) => {
    await createConversation(page);
    await createLongterm(page);
    const res = await page.request.get("/api/memories?type=conversation");
    const data = await res.json();
    expect(data.memories.length).toBe(1);
    expect(data.memories[0].tags).toBeDefined();
    expect(data.conversationMemories).toBeUndefined();
    expect(data.longTermMemories).toBeUndefined();
  });

  test("GET ?type=longterm filters to longterm only", async ({ page }) => {
    await createConversation(page);
    await createLongterm(page);
    const res = await page.request.get("/api/memories?type=longterm");
    const data = await res.json();
    expect(data.memories.length).toBe(1);
    expect(data.memories[0].category).toBeDefined();
    expect(data.conversationMemories).toBeUndefined();
    expect(data.longTermMemories).toBeUndefined();
  });

  test("GET ?type=invalid returns 400", async ({ page }) => {
    const res = await page.request.get("/api/memories?type=invalid");
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("type");
  });

  test("GET returns correct fields per type", async ({ page }) => {
    await createConversation(page);
    await createLongterm(page);
    const res = await page.request.get("/api/memories");
    const data = await res.json();
    const conv = data.conversationMemories[0];
    const lt = data.longTermMemories[0];
    // conversation fields
    expect(conv).toHaveProperty("date");
    expect(conv).toHaveProperty("tags");
    expect(conv).toHaveProperty("id");
    expect(conv).toHaveProperty("title");
    expect(conv).toHaveProperty("content");
    expect(conv).toHaveProperty("createdAt");
    expect(conv).toHaveProperty("updatedAt");
    // longterm fields
    expect(lt).toHaveProperty("category");
    expect(lt).toHaveProperty("id");
    expect(lt).toHaveProperty("title");
    expect(lt).toHaveProperty("content");
    expect(lt).toHaveProperty("createdAt");
    expect(lt).toHaveProperty("updatedAt");
  });

  // ===================================================================
  //  Category 2: POST — creating memories
  // ===================================================================

  test("POST creates a conversation memory", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: { type: "conversation", title: "Test Conv", content: "Body" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.memory.title).toBe("Test Conv");
    expect(data.memory.id).toBeTruthy();
    expect(data.memory.tags).toEqual([]);
    expect(data.memory.date).toBeTruthy();
  });

  test("POST creates conversation memory with optional fields", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: {
        type: "conversation",
        title: "With opts",
        content: "Body",
        date: "2026-01-15",
        tags: ["tag1", "tag2"],
      },
    });
    const data = await res.json();
    expect(data.memory.date).toBe("2026-01-15");
    expect(data.memory.tags).toEqual(["tag1", "tag2"]);
  });

  test("POST creates a longterm memory with default category", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: { type: "longterm", title: "LT Test", content: "Body" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.memory.category).toBe("other");
  });

  test("POST creates longterm memory with explicit category", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: { type: "longterm", title: "Pref", content: "Body", category: "preference" },
    });
    const data = await res.json();
    expect(data.memory.category).toBe("preference");
  });

  test("POST rejects missing type", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: { title: "No type", content: "Body" },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("type");
  });

  test("POST rejects invalid type", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: { type: "invalid", title: "Bad", content: "Body" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST validates title is required", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: { type: "conversation", content: "Body" },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.fields?.some((f: { field: string }) => f.field === "title")).toBe(true);
  });

  test("POST validates content is required", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: { type: "conversation", title: "Title" },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.fields?.some((f: { field: string }) => f.field === "content")).toBe(true);
  });

  test("POST validates title max length", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: { type: "conversation", title: "x".repeat(201), content: "Body" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST rejects invalid longterm category", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: { type: "longterm", title: "T", content: "C", category: "bogus" },
    });
    expect(res.status()).toBe(400);
  });

  // ===================================================================
  //  Category 3: PUT — updating memories
  // ===================================================================

  test("PUT updates a conversation memory", async ({ page }) => {
    const mem = await createConversation(page, "Original");
    const res = await page.request.put("/api/memories", {
      data: { type: "conversation", id: mem.id, title: "Updated" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);
    // verify via sub-route
    const check = await page.request.get("/api/memories/conversation");
    const items = (await check.json()).memories;
    expect(items.find((m: { id: string }) => m.id === mem.id).title).toBe("Updated");
  });

  test("PUT updates a longterm memory", async ({ page }) => {
    const mem = await createLongterm(page, "Original");
    const res = await page.request.put("/api/memories", {
      data: { type: "longterm", id: mem.id, content: "New content" },
    });
    expect(res.status()).toBe(200);
    const check = await page.request.get("/api/memories/longterm");
    const items = (await check.json()).memories;
    expect(items.find((m: { id: string }) => m.id === mem.id).content).toBe("New content");
  });

  test("PUT updates longterm category", async ({ page }) => {
    const mem = await createLongterm(page);
    const res = await page.request.put("/api/memories", {
      data: { type: "longterm", id: mem.id, category: "decision" },
    });
    expect(res.status()).toBe(200);
    const check = await page.request.get("/api/memories/longterm");
    const items = (await check.json()).memories;
    expect(items.find((m: { id: string }) => m.id === mem.id).category).toBe("decision");
  });

  test("PUT rejects missing type", async ({ page }) => {
    const res = await page.request.put("/api/memories", {
      data: { id: "some-id", title: "Updated" },
    });
    expect(res.status()).toBe(400);
  });

  test("PUT rejects invalid type", async ({ page }) => {
    const res = await page.request.put("/api/memories", {
      data: { type: "invalid", id: "some-id", title: "Updated" },
    });
    expect(res.status()).toBe(400);
  });

  test("PUT rejects missing id", async ({ page }) => {
    const res = await page.request.put("/api/memories", {
      data: { type: "conversation", title: "Updated" },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("ID");
  });

  test("PUT returns 404 for non-existent conversation id", async ({ page }) => {
    const res = await page.request.put("/api/memories", {
      data: { type: "conversation", id: "nonexistent-id", title: "Updated" },
    });
    expect(res.status()).toBe(404);
  });

  test("PUT returns 404 for non-existent longterm id", async ({ page }) => {
    const res = await page.request.put("/api/memories", {
      data: { type: "longterm", id: "nonexistent-id", title: "Updated" },
    });
    expect(res.status()).toBe(404);
  });

  test("PUT rejects invalid longterm category on update", async ({ page }) => {
    const mem = await createLongterm(page);
    const res = await page.request.put("/api/memories", {
      data: { type: "longterm", id: mem.id, category: "bogus" },
    });
    expect(res.status()).toBe(400);
  });

  // ===================================================================
  //  Category 4: DELETE — deleting memories
  // ===================================================================

  test("DELETE removes a conversation memory", async ({ page }) => {
    const mem = await createConversation(page);
    const res = await page.request.delete(
      `/api/memories?type=conversation&id=${mem.id}`
    );
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);
    // verify gone
    const check = await page.request.get("/api/memories/conversation");
    const items = (await check.json()).memories;
    expect(items.find((m: { id: string }) => m.id === mem.id)).toBeUndefined();
  });

  test("DELETE removes a longterm memory", async ({ page }) => {
    const mem = await createLongterm(page);
    const res = await page.request.delete(
      `/api/memories?type=longterm&id=${mem.id}`
    );
    expect(res.status()).toBe(200);
    const check = await page.request.get("/api/memories/longterm");
    const items = (await check.json()).memories;
    expect(items.find((m: { id: string }) => m.id === mem.id)).toBeUndefined();
  });

  test("DELETE rejects missing type", async ({ page }) => {
    const res = await page.request.delete("/api/memories?id=some-id");
    expect(res.status()).toBe(400);
  });

  test("DELETE rejects invalid type", async ({ page }) => {
    const res = await page.request.delete(
      "/api/memories?type=invalid&id=some-id"
    );
    expect(res.status()).toBe(400);
  });

  test("DELETE rejects missing id", async ({ page }) => {
    const res = await page.request.delete("/api/memories?type=conversation");
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("ID");
  });

  test("DELETE returns 404 for non-existent conversation id", async ({ page }) => {
    const res = await page.request.delete(
      "/api/memories?type=conversation&id=nonexistent-id"
    );
    expect(res.status()).toBe(404);
  });

  test("DELETE returns 404 for non-existent longterm id", async ({ page }) => {
    const res = await page.request.delete(
      "/api/memories?type=longterm&id=nonexistent-id"
    );
    expect(res.status()).toBe(404);
  });

  test("DELETE with empty query params returns 400", async ({ page }) => {
    const res = await page.request.delete("/api/memories");
    expect(res.status()).toBe(400);
  });

  // ===================================================================
  //  Category 5: Sub-route backward compatibility
  // ===================================================================

  test("sub-route GET /api/memories/conversation still works", async ({ page }) => {
    await createConversation(page, "Sub-route test");
    const res = await page.request.get("/api/memories/conversation");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.memories.length).toBe(1);
    expect(data.memories[0].title).toBe("Sub-route test");
  });

  test("sub-route GET /api/memories/longterm still works", async ({ page }) => {
    await createLongterm(page, "Sub-route LT");
    const res = await page.request.get("/api/memories/longterm");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.memories.length).toBe(1);
    expect(data.memories[0].title).toBe("Sub-route LT");
  });

  test("sub-route POST /api/memories/conversation still creates", async ({ page }) => {
    const res = await page.request.post("/api/memories/conversation", {
      data: { title: "Direct sub", content: "Content" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.memory.title).toBe("Direct sub");
  });

  test("sub-route DELETE /api/memories/longterm still deletes", async ({ page }) => {
    const mem = await createLongterm(page);
    const res = await page.request.delete(
      `/api/memories/longterm?id=${mem.id}`
    );
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  // ===================================================================
  //  Category 6: Cross-route consistency
  // ===================================================================

  test("memory created via unified POST appears in sub-route GET", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: { type: "conversation", title: "Unified", content: "Body" },
    });
    const { memory } = await res.json();
    const check = await page.request.get("/api/memories/conversation");
    const items = (await check.json()).memories;
    expect(items.find((m: { id: string }) => m.id === memory.id)).toBeTruthy();
  });

  test("memory created via sub-route POST appears in unified GET", async ({ page }) => {
    const mem = await createConversation(page, "Sub-created");
    const res = await page.request.get("/api/memories");
    const data = await res.json();
    expect(data.memories.find((m: { id: string }) => m.id === mem.id)).toBeTruthy();
  });

  test("memory deleted via unified DELETE is gone from sub-route GET", async ({ page }) => {
    const mem = await createLongterm(page);
    await page.request.delete(`/api/memories?type=longterm&id=${mem.id}`);
    const check = await page.request.get("/api/memories/longterm");
    const items = (await check.json()).memories;
    expect(items.find((m: { id: string }) => m.id === mem.id)).toBeUndefined();
  });

  // ===================================================================
  //  Category 7: Edge cases
  // ===================================================================

  test("POST with empty body returns 400", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("PUT with empty body returns 400", async ({ page }) => {
    const res = await page.request.put("/api/memories", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("POST with mixed fields uses type to disambiguate", async ({ page }) => {
    const res = await page.request.post("/api/memories", {
      data: {
        type: "conversation",
        title: "Mixed",
        content: "Body",
        category: "fact",
        tags: ["a"],
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    // created as conversation — has tags, no category
    expect(data.memory.tags).toEqual(["a"]);
    expect(data.memory.category).toBeUndefined();
  });

  test("multiple mixed-type memories all returned by GET", async ({ page }) => {
    await createConversation(page, "C1");
    await createConversation(page, "C2");
    await createConversation(page, "C3");
    await createLongterm(page, "L1");
    await createLongterm(page, "L2");
    const res = await page.request.get("/api/memories");
    const data = await res.json();
    expect(data.memories.length).toBe(5);
    expect(data.conversationMemories.length).toBe(3);
    expect(data.longTermMemories.length).toBe(2);
  });
});
