import { expect, test } from "@playwright/test";

test("customer search renders the published imported catalog truthfully and remains private to crawlers", async ({ page }) => {
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

  await expect(page.getByRole("heading", { name: "Published stays" })).toBeVisible();
  for (const hotelName of ["Hotel 1", "Hotel 2", "Hotel 3", "Hotel 4"]) {
    await expect(page.getByRole("heading", { name: hotelName })).toBeVisible();
  }

  const hotelCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Hotel 1" }) });
  const cardImage = hotelCard.locator("img");
  await expect(cardImage).toHaveAttribute("src", /ik\.imagekit\.io/);
  await expect.poll(() => cardImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

  await expect(page.getByText("Choose dates for price")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("৳0");
});

test("invalid date ranges render a clear server-side error state", async ({ page }) => {
  await page.goto("/search?checkIn=2026-10-10&checkOut=2026-10-09");
  await expect(page.getByRole("alert").filter({ hasText: "Check-out must follow check-in." })).toBeVisible();
});
