import { test, expect } from "@playwright/test";

test.describe("Calendar page", () => {
  test.beforeEach(async ({ page }) => {
    // Clean up all calendar events before each test
    const res = await page.request.get("/api/calendar");
    const data = await res.json();
    for (const event of data.events || []) {
      await page.request.delete(`/api/calendar?id=${event.id}`);
    }
  });

  test("is accessible from sidebar navigation", async ({ page }) => {
    await page.goto("/");
    const calendarLink = page.locator('nav a[href="/calendar"]');
    await expect(calendarLink).toBeVisible();
    await expect(calendarLink).toContainText("Calendar");
  });

  test("renders page heading and empty state", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.locator("h2")).toHaveText("Calendar");
    await expect(page.locator("text=No scheduled events yet")).toBeVisible();
  });

  test("shows type filter tabs (All, Recurring, One-time)", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.locator("button", { hasText: "all" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "recurring" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "One-time" })).toBeVisible();
  });

  test("shows status filter tabs", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.locator("button", { hasText: "active" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "paused" }).first()).toBeVisible();
  });

  test("can open and close the create form", async ({ page }) => {
    await page.goto("/calendar");
    await page.click("text=+ New Event");
    await expect(page.locator('input[placeholder="Daily morning briefing"]')).toBeVisible();
    await page.click("text=Cancel");
    await expect(page.locator('input[placeholder="Daily morning briefing"]')).not.toBeVisible();
  });

  test("can create a recurring event", async ({ page }) => {
    await page.goto("/calendar");
    await page.click("text=+ New Event");
    await page.fill('input[placeholder="Daily morning briefing"]', "Morning standup");
    await page.fill(
      'textarea[placeholder="What this scheduled event does..."]',
      "Daily team sync"
    );
    await page.fill('input[placeholder="Every morning at 8am"]', "Every weekday at 9am");
    await page.fill('input[placeholder="0 8 * * *"]', "0 9 * * 1-5");
    await page.click("text=Create Event");

    await expect(page.locator("text=Morning standup")).toBeVisible();
    await expect(page.locator("text=Every weekday at 9am")).toBeVisible();
    await expect(page.locator("text=Recurring").first()).toBeVisible();
  });

  test("can create a one-time event", async ({ page }) => {
    await page.goto("/calendar");
    await page.click("text=+ New Event");
    await page.fill('input[placeholder="Daily morning briefing"]', "Deploy v2.0");
    await page.click("label:has-text('One-time')");
    await page.fill(
      'input[placeholder="Apr 5, 2026 at 3:00 PM"]',
      "Apr 10, 2026 at 2:00 PM"
    );
    await page.click("text=Create Event");

    await expect(page.locator("text=Deploy v2.0")).toBeVisible();
    await expect(page.locator("text=One-time").first()).toBeVisible();
  });

  test("can pause and resume an event", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: {
        name: "Pause test event",
        scheduleType: "recurring",
        schedule: "Every hour",
      },
    });
    await page.goto("/calendar");

    const eventCard = page.locator(".rounded-lg", { hasText: "Pause test event" }).first();
    await expect(eventCard).toBeVisible();
    await eventCard.locator("button:has-text('Pause')").click();
    await expect(eventCard.locator("button:has-text('Resume')")).toBeVisible();
  });

  test("can delete an event with confirmation", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: {
        name: "Delete me event",
        scheduleType: "one-time",
        schedule: "Tomorrow at noon",
      },
    });
    await page.goto("/calendar");

    const eventCard = page.locator(".rounded-lg", { hasText: "Delete me event" }).first();
    await expect(eventCard).toBeVisible();
    await eventCard.locator("button:has-text('Delete')").click();
    await expect(eventCard.locator("button:has-text('Confirm')")).toBeVisible();
    await eventCard.locator("button:has-text('Confirm')").click();

    await expect(page.locator("text=Delete me event")).not.toBeVisible();
  });

  test("filters work correctly", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: { name: "Filter recurring", scheduleType: "recurring", schedule: "Daily" },
    });
    await page.request.post("/api/calendar", {
      data: { name: "Filter onetime", scheduleType: "one-time", schedule: "Tomorrow" },
    });
    await page.goto("/calendar");

    // Click "Recurring" filter
    await page.locator("button", { hasText: "recurring" }).first().click();
    await expect(page.locator("text=Filter recurring").first()).toBeVisible();
    await expect(page.locator("text=Filter onetime")).not.toBeVisible();

    // Click "One-time" filter
    await page.locator("button", { hasText: "One-time" }).click();
    await expect(page.locator("text=Filter onetime").first()).toBeVisible();
    await expect(page.locator("text=Filter recurring")).not.toBeVisible();

    // Click "All" to reset
    await page.locator("button", { hasText: "all" }).first().click();
    await expect(page.locator("text=Filter recurring").first()).toBeVisible();
    await expect(page.locator("text=Filter onetime").first()).toBeVisible();
  });
});
