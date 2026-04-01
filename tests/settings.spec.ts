import { test, expect } from "@playwright/test";

test.describe("Settings page", () => {
  test.beforeEach(async ({ page }) => {
    // Reset settings to defaults
    await page.request.patch("/api/settings", {
      data: {
        settings: { theme: "light", autoSave: true, logLevel: "normal" },
      },
    });
  });

  test("renders heading and all sections", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h2")).toHaveText("Settings");
    await expect(
      page.getByText("Configure Mission Control")
    ).toBeVisible();

    // Section headings
    await expect(page.getByText("Appearance")).toBeVisible();
    await expect(page.getByText("Behavior")).toBeVisible();
    await expect(page.getByText("Data")).toBeVisible();
    await expect(page.getByText("About")).toBeVisible();
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
    await page.goto("/settings");

    // Default is light
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // Click Dark button
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Click Light button to switch back
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("auto-save toggle works", async ({ page }) => {
    await page.goto("/settings");

    // Auto-save checkbox (styled as toggle switch - click the label/container)
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();

    // "Save Settings" button should not be visible when auto-save is on
    await expect(
      page.getByRole("button", { name: "Save Settings" })
    ).not.toBeVisible();

    // Click the toggle label to turn off auto-save (the checkbox itself is hidden behind a styled div)
    await checkbox.click({ force: true });
    await expect(checkbox).not.toBeChecked();

    // "Save Settings" button should appear
    await expect(
      page.getByRole("button", { name: "Save Settings" })
    ).toBeVisible();

    // Turn it back on
    await checkbox.click({ force: true });
    await expect(checkbox).toBeChecked();
    await expect(
      page.getByRole("button", { name: "Save Settings" })
    ).not.toBeVisible();
  });

  test("log level dropdown changes", async ({ page }) => {
    await page.goto("/settings");

    const select = page.locator("select");
    await expect(select).toHaveValue("normal");

    await select.selectOption("verbose");
    await expect(select).toHaveValue("verbose");

    // Verify it persisted via API (auto-save is on by default)
    await expect.poll(async () => {
      const res = await page.request.get("/api/settings");
      const data = await res.json();
      return data.settings.logLevel;
    }, { timeout: 5000 }).toBe("verbose");
  });

  test("about section shows version info", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByText("Version")).toBeVisible();
    await expect(page.getByText("1.0.0")).toBeVisible();
    await expect(page.getByText("Next.js + Tailwind")).toBeVisible();
    await expect(page.getByRole("main").getByText("Misko & Marko")).toBeVisible();
  });
});
