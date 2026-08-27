import { expect, test, type Locator, type Page } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900, stacked: false },
  { name: "tablet", width: 768, height: 1024, stacked: true },
  { name: "mobile", width: 390, height: 844, stacked: true },
] as const;

async function tabTo(page: Page, locator: Locator) {
  await page.keyboard.press("Tab");
  await expect(locator).toBeFocused();
  await expect(locator).toHaveCSS("outline-style", "solid");
}

for (const viewport of viewports) {
  test(`${viewport.name} auth layout stays usable and private`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/auth");

    await expect(page).toHaveTitle("Sign in | Book My Room");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.getByRole("heading", { name: "Your Bangladesh stays, kept in one place." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in securely" })).toBeVisible();

    const layout = await page.evaluate(() => {
      const intro = document.querySelector<HTMLElement>(".auth-intro")!.getBoundingClientRect();
      const card = document.querySelector<HTMLElement>(".auth-card")!.getBoundingClientRect();
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(".auth-brand, .auth-card button, .auth-card input"),
        (control) => ({ height: control.getBoundingClientRect().height, width: control.getBoundingClientRect().width }),
      );

      return {
        intro: { left: intro.left, right: intro.right, top: intro.top, bottom: intro.bottom },
        card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom },
        controls,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    expect(layout.horizontalOverflow).toBe(false);
    expect(layout.card.left).toBeGreaterThanOrEqual(0);
    expect(layout.card.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(layout.controls.every((control) => control.height >= 44 && control.width >= 44)).toBe(true);

    if (viewport.stacked) {
      expect(layout.card.top).toBeGreaterThanOrEqual(layout.intro.bottom);
    } else {
      expect(layout.card.left).toBeGreaterThanOrEqual(layout.intro.right);
    }
  });
}

test("keyboard users can traverse every identity mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth");

  await tabTo(page, page.getByRole("link", { name: "Book My Room home" }));
  await tabTo(page, page.getByRole("button", { name: "Sign in", exact: true }));
  await tabTo(page, page.getByRole("button", { name: "Register" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeFocused();
  await tabTo(page, page.getByLabel("Full name"));
  await tabTo(page, page.getByLabel("Email address"));
  await tabTo(page, page.getByLabel("Password"));
  await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "12");
  await tabTo(page, page.getByRole("button", { name: "Create account" }));
  await tabTo(page, page.getByRole("button", { name: "I have a verification token" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Verify your contact" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify your contact" })).toBeFocused();
  await tabTo(page, page.getByLabel("Secure token"));
  await expect(page.getByLabel("Secure token")).toHaveAttribute("autocomplete", "one-time-code");
  await tabTo(page, page.getByRole("button", { name: "Verify contact" }));
  await tabTo(page, page.getByRole("button", { name: "Back to sign in" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeFocused();
  await tabTo(page, page.getByLabel("Email address"));
  await tabTo(page, page.getByLabel("Password"));
  await tabTo(page, page.getByRole("button", { name: "Sign in securely" }));
  await tabTo(page, page.getByRole("button", { name: "Forgot password?" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Recover access" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recover access" })).toBeFocused();
  await tabTo(page, page.getByLabel("Email address"));
  await tabTo(page, page.getByRole("button", { name: "Request recovery" }));
  await tabTo(page, page.getByRole("button", { name: "I have a recovery token" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeFocused();
  await tabTo(page, page.getByLabel("Secure token"));
  await tabTo(page, page.getByRole("textbox", { name: "New password", exact: true }));
  await tabTo(page, page.getByRole("button", { name: "Reset password" }));
  await tabTo(page, page.getByRole("button", { name: "Back to sign in" }));
});

test("recovery uses generic success messaging without a live identity provider", async ({ page }) => {
  await page.route("**/api/v1/auth/recover", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/auth");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email address").fill("browser-check@example.test");
  await page.getByRole("button", { name: "Request recovery" }).click();

  await expect(page.getByText("If the account is eligible, recovery has been queued.")).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue("");
});
