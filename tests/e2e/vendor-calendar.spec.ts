import { test, expect } from "@playwright/test";

test("Vendor can view and manage calendar and rates", async ({ page }) => {
  await page.goto("/vendor/calendar");
  
  // Verify UI elements
  await expect(page.locator("text=Calendar & Rates").first()).toBeVisible();
  await expect(page.locator("text=Bulk Update")).toBeVisible();
  
  // Verify calendar grid rendering mock data
  await expect(page.locator("text=Rooms to sell")).toBeVisible();
  await expect(page.locator("text=Net Price")).toBeVisible();
  await expect(page.locator("text=Stop Sell").first()).toBeVisible();
});
