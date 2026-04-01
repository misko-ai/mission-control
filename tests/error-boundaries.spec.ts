import { test, expect } from "@playwright/test";

test.describe("Error pages", () => {
  test("navigating to a nonexistent page shows the 404 page", async ({ page }) => {
    await page.goto("/nonexistent-page");
    await expect(page.locator("text=404")).toBeVisible();
    await expect(page.locator("text=Page not found")).toBeVisible();
  });

  test("404 page has a link back to the dashboard", async ({ page }) => {
    await page.goto("/nonexistent-page");
    const backLink = page.locator("a", { hasText: "Back to Dashboard" });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/");
    await backLink.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("h2")).toHaveText("Dashboard");
  });
});
