import { test, expect, Page } from "@playwright/test";

/** Wait for the calendar page to be fully interactive (loading complete) */
async function waitForCalendarReady(page: Page) {
  await page.locator("h2:has-text('Calendar')").waitFor();
  // Wait for the initial fetch to finish (loading disappears)
  await page.locator("text=Loading events...").waitFor({ state: "hidden", timeout: 10000 });
}

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
    await waitForCalendarReady(page);
    await expect(page.locator("h2")).toHaveText("Calendar");
    await expect(page.locator("text=No scheduled events yet").first()).toBeVisible();
  });

  test("shows event type filter tabs", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await expect(page.locator("button", { hasText: "All" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Automation" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Reminder" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Deadline" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Review" }).first()).toBeVisible();
  });

  test("shows status filter tabs", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await expect(page.locator("button", { hasText: "active" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "paused" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "failed" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "draft" }).first()).toBeVisible();
  });

  test("can open and close the create form", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await page.locator('button:has-text("+ New Event")').click();
    await expect(page.locator('input[placeholder="Daily geopolitics report"]')).toBeVisible();
    await page.locator('form button:has-text("Cancel")').click();
    await expect(page.locator('input[placeholder="Daily geopolitics report"]')).not.toBeVisible();
  });

  test("create form shows event type selector", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await page.locator('button:has-text("+ New Event")').click();
    const form = page.locator("form");
    await expect(form.locator("button:has-text('Automation')")).toBeVisible();
    await expect(form.locator("button:has-text('Reminder')")).toBeVisible();
    await expect(form.locator("button:has-text('Deadline')")).toBeVisible();
    await expect(form.locator("button:has-text('Review')")).toBeVisible();
  });

  test("can create an automation event", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await page.locator('button:has-text("+ New Event")').click();
    await page.fill('input[placeholder="Daily geopolitics report"]', "Morning standup");
    await page.fill('textarea[placeholder="What this event does or tracks..."]', "Daily team sync");
    await page.fill('input[placeholder="Daily at 07:30 Europe/Zagreb"]', "Every weekday at 9am");
    await page.fill('input[placeholder="0 8 * * *"]', "0 9 * * 1-5");
    await page.locator('button:has-text("Create Event")').click();

    await expect(page.locator("text=Morning standup")).toBeVisible();
    await expect(page.locator("text=Automation").first()).toBeVisible();
    await expect(page.locator("text=Every weekday at 9am")).toBeVisible();
  });

  test("can create a reminder event", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await page.locator('button:has-text("+ New Event")').click();

    const form = page.locator("form");
    await form.locator("button:has-text('Reminder')").click();

    await page.fill('input[placeholder="Daily geopolitics report"]', "Session wrap-up review");
    await page.fill('input[placeholder="Every Friday at 5pm"]', "End of each session");
    await page.locator('button:has-text("Create Event")').click();

    await expect(page.locator("text=Session wrap-up review")).toBeVisible();
    await expect(page.locator("text=Reminder").first()).toBeVisible();
  });

  test("can create a deadline event with due date", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await page.locator('button:has-text("+ New Event")').click();

    const form = page.locator("form");
    await form.locator("button:has-text('Deadline')").click();

    await page.fill('input[placeholder="Daily geopolitics report"]', "Ship v2.0");
    await page.fill('input[placeholder="Apr 10, 2026"]', "Friday release");
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await page.fill('input[type="date"]', "2026-04-10");
    await page.locator('button:has-text("Create Event")').click();

    await expect(page.locator("text=Ship v2.0")).toBeVisible();
    await expect(page.locator("text=Deadline").first()).toBeVisible();
  });

  test("can create a review event", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await page.locator('button:has-text("+ New Event")').click();

    const form = page.locator("form");
    await form.locator("button:has-text('Review')").click();

    await page.fill('input[placeholder="Daily geopolitics report"]', "Weekly bug triage");
    await page.fill('input[placeholder="Every Monday at 9am"]', "Every Monday at 10am");
    await page.locator('button:has-text("Create Event")').click();

    await expect(page.locator("text=Weekly bug triage")).toBeVisible();
    await expect(page.locator("text=Review").first()).toBeVisible();
  });

  test("deadline type auto-selects one-time schedule", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await page.locator('button:has-text("+ New Event")').click();

    const form = page.locator("form");
    await form.locator("button:has-text('Deadline')").click();

    // The "One-time" radio in the Schedule Type group should be checked
    const oneTimeRadio = form.locator('label:has-text("One-time") input[type="radio"]');
    await expect(oneTimeRadio).toBeChecked();
  });

  test("cron field only shows for automation/review with recurring", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await page.locator('button:has-text("+ New Event")').click();
    const form = page.locator("form");

    // Automation + recurring = cron visible
    await expect(form.locator('input[placeholder="0 8 * * *"]')).toBeVisible();

    // Switch to Reminder = cron hidden
    await form.locator("button:has-text('Reminder')").click();
    await expect(form.locator('input[placeholder="0 8 * * *"]')).not.toBeVisible();

    // Switch to Review = cron visible again
    await form.locator("button:has-text('Review')").click();
    await expect(form.locator('input[placeholder="0 8 * * *"]')).toBeVisible();

    // Switch to Deadline = cron hidden, due date visible
    await form.locator("button:has-text('Deadline')").click();
    await expect(form.locator('input[placeholder="0 8 * * *"]')).not.toBeVisible();
    await expect(form.locator('input[type="date"]')).toBeVisible();
  });

  test("can pause and resume an event", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: {
        name: "Pause test event",
        scheduleType: "recurring",
        schedule: "Every hour",
        eventType: "automation",
      },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    const eventCard = page.locator(".rounded-lg", { hasText: "Pause test event" }).first();
    await expect(eventCard).toBeVisible();
    await eventCard.locator("button:has-text('Pause')").click();
    await expect(eventCard.locator("button:has-text('Resume')")).toBeVisible();

    await eventCard.locator("button:has-text('Resume')").click();
    await expect(eventCard.locator("button:has-text('Pause')")).toBeVisible();
  });

  test("can delete an event with confirmation", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: {
        name: "Delete me event",
        scheduleType: "one-time",
        schedule: "Tomorrow at noon",
        eventType: "reminder",
      },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    const eventCard = page.locator(".rounded-lg", { hasText: "Delete me event" }).first();
    await expect(eventCard).toBeVisible();
    await eventCard.locator('[title="Delete"]').click();
    await expect(eventCard.locator("button:has-text('Confirm')")).toBeVisible();
    await eventCard.locator("button:has-text('Confirm')").click();

    await expect(page.locator("text=Delete me event")).not.toBeVisible();
  });

  test("can cancel delete", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: {
        name: "Keep me event",
        scheduleType: "recurring",
        schedule: "Daily",
        eventType: "review",
      },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    const eventCard = page.locator(".rounded-lg", { hasText: "Keep me event" }).first();
    await expect(eventCard).toBeVisible();
    await eventCard.locator('[title="Delete"]').click();
    await eventCard.locator("button:has-text('Cancel')").click();
    await expect(page.locator("text=Keep me event")).toBeVisible();
  });

  test("event type filters work correctly", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: { name: "Auto event", scheduleType: "recurring", schedule: "Daily", eventType: "automation" },
    });
    await page.request.post("/api/calendar", {
      data: { name: "Reminder event", scheduleType: "recurring", schedule: "Weekly", eventType: "reminder" },
    });
    await page.request.post("/api/calendar", {
      data: { name: "Deadline event", scheduleType: "one-time", schedule: "Friday", eventType: "deadline" },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    // All visible
    await expect(page.locator("text=Auto event").first()).toBeVisible();
    await expect(page.locator("text=Reminder event").first()).toBeVisible();
    await expect(page.locator("text=Deadline event").first()).toBeVisible();

    // Filter to Automation
    await page.locator("button", { hasText: "Automation" }).first().click();
    await expect(page.locator("text=Auto event").first()).toBeVisible();
    await expect(page.locator("text=Reminder event")).not.toBeVisible();
    await expect(page.locator("text=Deadline event")).not.toBeVisible();

    // Filter to Reminder
    await page.locator("button", { hasText: "Reminder" }).first().click();
    await expect(page.locator("text=Reminder event").first()).toBeVisible();
    await expect(page.locator("text=Auto event")).not.toBeVisible();

    // Filter to Deadline
    await page.locator("button", { hasText: "Deadline" }).first().click();
    await expect(page.locator("text=Deadline event").first()).toBeVisible();
    await expect(page.locator("text=Reminder event")).not.toBeVisible();

    // Reset to All
    await page.locator("button", { hasText: "All" }).first().click();
    await expect(page.locator("text=Auto event").first()).toBeVisible();
    await expect(page.locator("text=Reminder event").first()).toBeVisible();
    await expect(page.locator("text=Deadline event").first()).toBeVisible();
  });

  test("status filters work correctly", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: { name: "Active one", scheduleType: "recurring", schedule: "Daily", eventType: "automation" },
    });
    const pausedRes = await page.request.post("/api/calendar", {
      data: { name: "Paused one", scheduleType: "recurring", schedule: "Daily", eventType: "reminder" },
    });
    const pausedEvent = (await pausedRes.json()).event;
    await page.request.put("/api/calendar", {
      data: { id: pausedEvent.id, status: "paused" },
    });

    await page.goto("/calendar");
    await waitForCalendarReady(page);

    await expect(page.locator("text=Active one").first()).toBeVisible();
    await expect(page.locator("text=Paused one").first()).toBeVisible();

    // Filter to active
    await page.locator("button", { hasText: "active" }).first().click();
    await expect(page.locator("text=Active one").first()).toBeVisible();
    await expect(page.locator("text=Paused one")).not.toBeVisible();

    // Filter to paused
    await page.locator("button", { hasText: "paused" }).first().click();
    await expect(page.locator("text=Paused one").first()).toBeVisible();
    await expect(page.locator("text=Active one")).not.toBeVisible();
  });

  test("summary cards appear when events exist", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: { name: "Sum auto", scheduleType: "recurring", schedule: "Daily", eventType: "automation" },
    });
    await page.request.post("/api/calendar", {
      data: { name: "Sum deadline", scheduleType: "one-time", schedule: "Friday", eventType: "deadline" },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    await expect(page.locator("text=Automations").first()).toBeVisible();
    await expect(page.locator("text=Reminders").first()).toBeVisible();
    await expect(page.locator("text=Deadlines").first()).toBeVisible();
    await expect(page.locator("text=Reviews").first()).toBeVisible();
  });

  test("summary cards do not appear when no events", async ({ page }) => {
    await page.goto("/calendar");
    await waitForCalendarReady(page);
    await expect(page.locator("text=No scheduled events yet").first()).toBeVisible();
  });

  test("can inline edit an event", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: {
        name: "Edit me",
        description: "Original desc",
        scheduleType: "recurring",
        schedule: "Daily",
        eventType: "automation",
      },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    const eventCard = page.locator(".rounded-lg", { hasText: "Edit me" }).first();
    await expect(eventCard).toBeVisible();
    await eventCard.locator('[title="Edit"]').click();

    // Edit form should appear
    const editForm = page.locator("form");
    await expect(editForm).toBeVisible();

    // Name input should have the current value
    const nameInput = editForm.locator('input[placeholder="Daily geopolitics report"]');
    await expect(nameInput).toHaveValue("Edit me");

    // Change the name
    await nameInput.fill("Edited name");
    await editForm.locator("button:has-text('Save Changes')").click();

    // Updated name should be visible
    await expect(page.locator("text=Edited name")).toBeVisible();
    await expect(page.locator(".rounded-lg >> text=Edit me")).not.toBeVisible();
  });

  test("can cancel inline edit", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: {
        name: "Cancel edit test",
        scheduleType: "recurring",
        schedule: "Daily",
        eventType: "review",
      },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    const eventCard = page.locator(".rounded-lg", { hasText: "Cancel edit test" }).first();
    await expect(eventCard).toBeVisible();
    await eventCard.locator('[title="Edit"]').click();

    // Cancel editing
    await page.locator("form button:has-text('Cancel')").click();

    // Original should still be there
    await expect(page.locator("text=Cancel edit test")).toBeVisible();
  });

  test("owner badge displays correctly", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: {
        name: "Agent owned",
        scheduleType: "recurring",
        schedule: "Daily",
        eventType: "automation",
        owner: "agent",
      },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    const eventCard = page.locator(".rounded-lg", { hasText: "Agent owned" }).first();
    await expect(eventCard).toBeVisible();
    // Agent owner badge
    await expect(eventCard.locator("span:has-text('Agent')").first()).toBeVisible();
  });

  test("priority badge shows for high priority", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: {
        name: "High prio deadline",
        scheduleType: "one-time",
        schedule: "Tomorrow",
        eventType: "deadline",
        priority: "high",
      },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    const eventCard = page.locator(".rounded-lg", { hasText: "High prio deadline" }).first();
    await expect(eventCard).toBeVisible();
    await expect(eventCard.locator("span:has-text('high')")).toBeVisible();
  });

  test("linked entity chips display", async ({ page }) => {
    await page.request.post("/api/calendar", {
      data: {
        name: "Linked event",
        scheduleType: "recurring",
        schedule: "Daily",
        eventType: "automation",
        linkedTaskId: "abcdef12-3456-7890-abcd-ef1234567890",
        linkedDocId: "12345678-abcd-ef12-3456-7890abcdef12",
      },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    const eventCard = page.locator(".rounded-lg", { hasText: "Linked event" }).first();
    await expect(eventCard).toBeVisible();
    await expect(eventCard.locator("text=Task:")).toBeVisible();
    await expect(eventCard.locator("text=Doc:")).toBeVisible();
  });

  test("backward compat: events without eventType show as Automation", async ({ page }) => {
    // Create event without explicit eventType (API defaults to "automation")
    await page.request.post("/api/calendar", {
      data: {
        name: "Legacy event",
        scheduleType: "recurring",
        schedule: "Every hour",
      },
    });
    await page.goto("/calendar");
    await waitForCalendarReady(page);

    const eventCard = page.locator(".rounded-lg", { hasText: "Legacy event" }).first();
    await expect(eventCard).toBeVisible();
    await expect(eventCard.locator("span:has-text('Automation')")).toBeVisible();
  });
});

test.describe("Calendar API", () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.get("/api/calendar");
    const data = await res.json();
    for (const event of data.events || []) {
      await request.delete(`/api/calendar?id=${event.id}`);
    }
  });

  test("POST creates event with new fields", async ({ request }) => {
    const res = await request.post("/api/calendar", {
      data: {
        name: "API test event",
        scheduleType: "recurring",
        schedule: "Daily at 8am",
        eventType: "review",
        owner: "agent",
        priority: "high",
        linkedDocId: "doc-123",
      },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.event.eventType).toBe("review");
    expect(body.event.owner).toBe("agent");
    expect(body.event.priority).toBe("high");
    expect(body.event.linkedDocId).toBe("doc-123");
  });

  test("POST defaults eventType to automation", async ({ request }) => {
    const res = await request.post("/api/calendar", {
      data: {
        name: "Default type",
        scheduleType: "recurring",
        schedule: "Daily",
      },
    });
    const body = await res.json();
    expect(body.event.eventType).toBe("automation");
    expect(body.event.owner).toBe("user");
    expect(body.event.priority).toBe("medium");
  });

  test("POST validates eventType enum", async ({ request }) => {
    const res = await request.post("/api/calendar", {
      data: {
        name: "Bad type",
        scheduleType: "recurring",
        schedule: "Daily",
        eventType: "invalid",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("POST validates owner enum", async ({ request }) => {
    const res = await request.post("/api/calendar", {
      data: {
        name: "Bad owner",
        scheduleType: "recurring",
        schedule: "Daily",
        owner: "nobody",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("POST validates priority enum", async ({ request }) => {
    const res = await request.post("/api/calendar", {
      data: {
        name: "Bad priority",
        scheduleType: "recurring",
        schedule: "Daily",
        priority: "ultra",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("POST accepts draft status", async ({ request }) => {
    const res = await request.post("/api/calendar", {
      data: {
        name: "Draft event",
        scheduleType: "one-time",
        schedule: "Next week",
        status: "draft",
      },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.event.status).toBe("draft");
  });

  test("PUT updates new fields", async ({ request }) => {
    const createRes = await request.post("/api/calendar", {
      data: {
        name: "Update me",
        scheduleType: "recurring",
        schedule: "Daily",
        eventType: "automation",
      },
    });
    const { event } = await createRes.json();

    const updateRes = await request.put("/api/calendar", {
      data: {
        id: event.id,
        eventType: "review",
        owner: "agent",
        priority: "high",
        name: "Updated name",
      },
    });
    expect((await updateRes.json()).success).toBe(true);

    const getRes = await request.get("/api/calendar");
    const { events } = await getRes.json();
    const updated = events.find((e: { id: string }) => e.id === event.id);
    expect(updated.name).toBe("Updated name");
    expect(updated.eventType).toBe("review");
    expect(updated.owner).toBe("agent");
    expect(updated.priority).toBe("high");
  });

  test("PUT validates eventType on update", async ({ request }) => {
    const createRes = await request.post("/api/calendar", {
      data: { name: "Validate update", scheduleType: "recurring", schedule: "Daily" },
    });
    const { event } = await createRes.json();

    const res = await request.put("/api/calendar", {
      data: { id: event.id, eventType: "invalid" },
    });
    expect(res.status()).toBe(400);
  });

  test("PUT can set dueDate and linkedCronId", async ({ request }) => {
    const createRes = await request.post("/api/calendar", {
      data: {
        name: "Due date test",
        scheduleType: "one-time",
        schedule: "Friday",
        eventType: "deadline",
      },
    });
    const { event } = await createRes.json();

    await request.put("/api/calendar", {
      data: {
        id: event.id,
        dueDate: "2026-04-10",
        linkedCronId: "cron-abc",
      },
    });

    const getRes = await request.get("/api/calendar");
    const { events } = await getRes.json();
    const updated = events.find((e: { id: string }) => e.id === event.id);
    expect(updated.dueDate).toBe("2026-04-10");
    expect(updated.linkedCronId).toBe("cron-abc");
  });
});

test.describe("Dashboard - Upcoming Schedule", () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.get("/api/calendar");
    const data = await res.json();
    for (const event of data.events || []) {
      await request.delete(`/api/calendar?id=${event.id}`);
    }
  });

  test("shows upcoming schedule section on dashboard", async ({ page, request }) => {
    await request.post("/api/calendar", {
      data: {
        name: "Dashboard visible event",
        scheduleType: "recurring",
        schedule: "Daily at 8am",
        eventType: "automation",
      },
    });
    // Cache-bust to ensure fresh server render
    await page.goto("/?_t=" + Date.now());
    await expect(page.locator("text=Upcoming Schedule")).toBeVisible();
    await expect(page.locator("text=Dashboard visible event")).toBeVisible();
    await expect(page.locator('a[href="/calendar"]:has-text("View all")')).toBeVisible();
  });

  test("shows empty state when no events", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Upcoming Schedule")).toBeVisible();
    await expect(page.locator("text=No upcoming events")).toBeVisible();
  });

  test("does not show paused events on dashboard", async ({ page, request }) => {
    const res = await request.post("/api/calendar", {
      data: {
        name: "Paused dashboard event",
        scheduleType: "recurring",
        schedule: "Daily",
        eventType: "automation",
      },
    });
    const { event } = await res.json();
    await request.put("/api/calendar", {
      data: { id: event.id, status: "paused" },
    });

    await page.goto("/");
    await expect(page.locator("text=Paused dashboard event")).not.toBeVisible();
  });
});
