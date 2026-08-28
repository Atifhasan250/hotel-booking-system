import { expect, test } from "@playwright/test";

test("customer search remains truthful, private to crawlers, and usable without catalog connectivity", async ({ page }) => {
  await page.goto("/search");

  await expect(page).toHaveTitle("Search stays | Book My Room");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await expect(page.getByRole("heading", { name: "Find a stay that fits the journey." })).toBeVisible();
  await expect(page.getByLabel("Destination or district")).toBeVisible();
  await expect(page.getByLabel("Check in")).toBeVisible();
  await expect(page.getByLabel("Check out")).toBeVisible();
  await expect(page.getByLabel("Property type")).toContainText("Eco Resort");
  await expect(page.locator('select[name="sort"]')).toContainText("Newest listings");
  await expect(page.locator('select[name="sort"]')).not.toContainText("Top rated");
  await expect(page.locator('select[name="sort"]')).not.toContainText("Most booked");
  await expect(page.getByRole("button", { name: "Search approved stays" })).toBeVisible();

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("Hotel 4");
  expect(bodyText).not.toContain("৳0");
});

test("invalid date ranges render a clear server-side error state", async ({ page }) => {
  await page.goto("/search?checkIn=2026-10-10&checkOut=2026-10-09");
  await expect(page.getByRole("alert").filter({ hasText: "Check-out must follow check-in." })).toBeVisible();
});
