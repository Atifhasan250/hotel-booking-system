import { expect, test } from "@playwright/test";

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
})) {
  test(`${name} homepage preserves the approved public design without fake content or hotlinks`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page).toHaveTitle("Book My Room — Stays across Bangladesh");
    await expect(page.getByRole("heading", { name: /Find your\s*Bangladesh sanctuary/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Check availability" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verified reviews, when earned" })).toBeVisible();
    await expect(page.getByText("No sample identities, avatars, quotes or ratings are published.")).toBeVisible();

    const remoteReferenceImages = page.locator('img[src*="bookmyroom.site/wp-content"], img[src*="pravatar"]');
    await expect(remoteReferenceImages).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}

test("homepage submits date, destination, guest and room search inputs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Location\s*Dhaka/i }).click();
  await page.getByRole("dialog", { name: "Booking options" }).getByRole("button", { name: /Sylhet/i }).click();
  await Promise.all([
    page.waitForURL(/\/search\?/),
    page.getByRole("button", { name: "Check availability" }).click(),
  ]);
  expect(page.url()).toContain("destination=Sylhet");
  expect(page.url()).toContain("adults=2");
  expect(page.url()).toContain("rooms=1");
});

