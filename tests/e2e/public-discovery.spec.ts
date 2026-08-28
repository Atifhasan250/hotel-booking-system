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
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(1);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /bookmyroom-dark-no-bg\.png/);

    const remoteReferenceImages = page.locator('img[src*="bookmyroom.site/wp-content"], img[src*="pravatar"]');
    await expect(remoteReferenceImages).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}

test("public pages reuse the same primary navigation", async ({ page }) => {
  for (const path of ["/", "/search", "/properties/hotel-1", "/destinations/dhaka"]) {
    await page.goto(path);
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(navigation).toHaveCount(1);
    await expect(navigation.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
    await expect(navigation.getByRole("link", { name: "Hotels" })).toHaveAttribute("href", "/#stays");
    await expect(page.getByRole("link", { name: "Book My Room home" })).toHaveCount(1);
  }
});

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

test("leaving the homepage does not surface a discovery cleanup error", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto("/");
  await page.goto("/auth");
  expect(runtimeErrors).toEqual([]);
});

