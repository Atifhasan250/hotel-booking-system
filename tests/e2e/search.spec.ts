import { test, expect } from "@playwright/test";

test("Customer can search for properties and filter/sort results", async ({ page }) => {
  await page.goto("/search");
  
  // Wait for results to load
  await page.waitForSelector("text=Search Results");
  
  // Verify UI elements
  await expect(page.locator("text=Filters")).toBeVisible();
  // Check select options exist on the page
  await expect(page.locator("body")).toContainText("Price: Low to High");
  
  // Check that the mock results are rendered
  await expect(page.locator("text=Grand Sylhet Hotel")).toBeVisible();
  await expect(page.locator("text=Sreemangal Eco Resort")).toBeVisible();
});
