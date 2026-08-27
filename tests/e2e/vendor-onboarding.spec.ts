import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.name} vendor studio preserves the private responsive catalog workflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/vendor/onboarding");
    await expect(page).toHaveTitle("Vendor studio | Book My Room");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.getByRole("heading", { name: "Turn a beautiful stay into a trusted listing." })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create property draft/ })).toBeDisabled();

    const layout = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      controls: Array.from(document.querySelectorAll<HTMLElement>("a, button, input:not([type=checkbox]), select, textarea"), (control) => ({
        width: control.getBoundingClientRect().width,
        height: control.getBoundingClientRect().height,
        visible: control.getClientRects().length > 0,
      })),
    }));
    expect(layout.horizontalOverflow).toBe(false);
    expect(layout.controls.filter((item) => item.visible).every((item) => item.height >= 44 && item.width >= 44)).toBe(true);
  });
}

test("vendor onboarding keeps the approval gate server-driven and keyboard reachable", async ({ page }) => {
  let organizationStatus = "DRAFT";
  await page.route("**/api/v1/catalog/mutate", async (route) => {
    const request = route.request();
    const payload = request.postDataJSON();
    if (payload.action === "ONBOARD_VENDOR") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { vendor: { id: "vendor-e2e-1", status: "DRAFT" } } }) });
      return;
    }
    if (payload.action === "SUBMIT_VENDOR") {
      organizationStatus = "PENDING_REVIEW";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { vendorId: "vendor-e2e-1", status: organizationStatus } }) });
      return;
    }
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: { message: "Unexpected test mutation" } }) });
  });
  await page.route("**/api/v1/catalog/workspace?**", async (route) => {
    organizationStatus = "APPROVED";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { vendor: { id: "vendor-e2e-1", status: organizationStatus }, properties: [] } }) });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/vendor/onboarding");
  await page.getByLabel("Public business name").fill("Megh Bari");
  await page.getByLabel("Legal business name").fill("Megh Bari Ltd");
  await page.getByLabel("Contact email").fill("owner@example.test");
  await page.getByLabel("Bangladesh mobile").fill("+8801712345678");
  await page.getByRole("button", { name: /Save organization/ }).focus();
  await expect(page.getByRole("button", { name: /Save organization/ })).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page.getByText("vendor-e2e-1")).toBeVisible();

  await page.getByRole("button", { name: "Submit organization" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("PENDING_REVIEW")).toBeVisible();
  await expect(page.getByRole("button", { name: /Create property draft/ })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh approval" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Create property draft/ })).toBeEnabled();
});

test("admin catalog review exposes explicit location and media evidence gates", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/admin/catalog");
  await expect(page).toHaveTitle("Catalog review | Book My Room");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.getByLabel("Location evidence verified")).toBeVisible();
  await expect(page.getByLabel("Media rights and metadata approved")).toBeVisible();
  await expect(page.getByRole("button", { name: /Record property decision/ })).toBeVisible();
});
