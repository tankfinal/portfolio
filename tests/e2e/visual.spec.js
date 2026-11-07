// Baseline screenshots of v2.4.0, the "before" for the 2.0 restyle.
//
// Pixels only match inside the pinned Playwright image (same Chromium, same fonts), so this file runs only with
// TANKOS_VISUAL=1, which `npm run test:docker` and CI set. To accept a deliberate visual change:
//   npm run test:docker:update     (then review the PNG diff in the PR)
const { test, expect, boot, win, openFromDesktop } = require("../support/fixtures");

test.skip(!process.env.TANKOS_VISUAL, "visual baselines run only in the pinned Playwright image (npm run test:docker)");

test.describe("1366×657", () => {
  test.use({ viewport: { width: 1366, height: 657 } });

  test("lock screen", async ({ page }) => {
    await boot(page, { locked: true });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("lock-1366.png");
  });

  test("desktop with README", async ({ page }) => {
    await boot(page);
    await expect(page).toHaveScreenshot("desktop-1366.png");
  });

  test("two windows, one unfocused", async ({ page }) => {
    await boot(page);
    await openFromDesktop(page, "calc");
    await expect(page).toHaveScreenshot("windows-1366.png");
  });
});

test.describe("1024×768", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("desktop with README", async ({ page }) => {
    await boot(page);
    await expect(page).toHaveScreenshot("desktop-1024.png");
  });
});

test.describe("390×844", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("home", async ({ page }) => {
    await boot(page);
    await expect(page).toHaveScreenshot("home-390.png");
  });

  test("app open full screen", async ({ page }) => {
    await boot(page);
    await page.locator('.desktop .dicon[data-open="contact"]').tap();
    await expect(win(page, "contact")).toHaveClass(/\bfocused\b/);
    await expect(page).toHaveScreenshot("app-390.png");
  });
});
