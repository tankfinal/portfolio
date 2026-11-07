// Baseline screenshots of v2.4.0, the "before" for the 2.0 restyle.
//
// Pixels only match inside the pinned Playwright image (same Chromium, same fonts), so this file runs only with
// TANKOS_VISUAL=1, which `npm run test:docker` and CI set. To accept a deliberate visual change:
//   npm run test:docker:update     (then review the PNG diff in the PR)
const { test, expect, boot, win, openFromDesktop } = require("../support/fixtures");

test.skip(!process.env.TANKOS_VISUAL, "visual baselines run only in the pinned Playwright image (npm run test:docker)");

// The version in the menu bar changes on every release; mask it so a version bump alone never touches a baseline.
function shot(page, name){
  return expect(page).toHaveScreenshot(name, { mask: [page.locator(".mb-ver")], maskColor: "#FF00FF" });
}

test.describe("1366×657", () => {
  test.use({ viewport: { width: 1366, height: 657 } });

  test("lock screen", async ({ page }) => {
    await boot(page, { locked: true });
    await page.evaluate(() => document.fonts.ready);
    await shot(page, "lock-1366.png");
  });

  test("desktop with README", async ({ page }) => {
    await boot(page);
    await shot(page, "desktop-1366.png");
  });

  test("two windows, one unfocused", async ({ page }) => {
    await boot(page);
    await openFromDesktop(page, "calc");
    await shot(page, "windows-1366.png");
  });
});

test.describe("1024×768", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("desktop with README", async ({ page }) => {
    await boot(page);
    await shot(page, "desktop-1024.png");
  });
});

test.describe("768×1024 tablet portrait", () => {
  test.use({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true });

  test("home", async ({ page }) => {
    await boot(page);
    await shot(page, "home-768.png");
  });
});

test.describe("390×844", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("home", async ({ page }) => {
    await boot(page);
    await shot(page, "home-390.png");
  });

  test("app open full screen", async ({ page }) => {
    await boot(page);
    await page.locator('.desktop .dicon[data-open="contact"]').tap();
    await expect(win(page, "contact")).toHaveClass(/\bfocused\b/);
    await shot(page, "app-390.png");
  });
});
