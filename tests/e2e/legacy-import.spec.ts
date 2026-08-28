import { expect, test } from "@playwright/test";

test("published legacy hotels and ImageKit media reach the public homepage API", async ({ request }) => {
  const response = await request.get("/api/v1/catalog/public-home");
  expect(response.ok()).toBe(true);
  const data = await response.json() as {
    stays: Array<{ name: string; slug: string; startingPriceMinorUnits: number | null; image: { url: string } | null }>;
    destinations: Array<{ name: string; image: { url: string } | null }>;
  };

  expect(data.stays).toHaveLength(4);
  expect(data.stays.map(({ name }) => name).sort()).toEqual(["Hotel 1", "Hotel 2", "Hotel 3", "Hotel 4"]);
  expect(Object.fromEntries(data.stays.map(({ slug, startingPriceMinorUnits }) => [slug, startingPriceMinorUnits]))).toEqual({
    "hotel-1": 299800,
    "hotel-1-copy": 199900,
    "hotel-1-copy-copy": 100000,
    "hotel-4": 0,
  });
  expect(data.stays.every(({ image }) => image?.url.startsWith("https://ik.imagekit.io/") === true)).toBe(true);
  expect(data.destinations).toHaveLength(8);
  expect(data.destinations.filter(({ image }) => image).length).toBeGreaterThanOrEqual(5);
});

test("published hotel cards and a property gallery render real ImageKit images", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const discoveryResponse = page.waitForResponse((response) => response.url().endsWith("/api/v1/catalog/public-home") && response.status() === 200);
  await page.goto("/");
  await discoveryResponse;

  const heroImage = page.locator(".hero-image");
  await expect(heroImage).toHaveAttribute("src", /bookmyroom-hero\.jpg/);
  await expect.poll(() => heroImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

  const hotelCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Hotel 1" }) });
  await expect(hotelCard).toBeVisible({ timeout: 15_000 });
  const cardImage = hotelCard.locator("img");
  await expect(cardImage).toHaveAttribute("src", /ik\.imagekit\.io/);
  await expect.poll(() => cardImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

  await hotelCard.getByRole("link", { name: "Hotel 1" }).click();
  await expect(page).toHaveURL(/\/properties\/hotel-1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hotel 1" })).toBeVisible();
  await expect(page.getByText("From BDT 2,998 per night")).toBeVisible();
  const galleryImage = page.getByRole("region", { name: "Hotel 1 gallery" }).locator("img").first();
  await expect(galleryImage).toHaveAttribute("src", /ik\.imagekit\.io/);
  await expect.poll(() => galleryImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(runtimeErrors).toEqual([]);
});
