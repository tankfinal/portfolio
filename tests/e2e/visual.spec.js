// Baseline screenshots of v2.4.0, the "before" for the 2.0 restyle.
//
// Pixels only match inside the pinned Playwright image (same Chromium, same fonts), so this file runs only with
// TANKOS_VISUAL=1, which `npm run test:docker` and CI set. To accept a deliberate visual change:
//   npm run test:docker:update     (then review the PNG diff in the PR)
const { test, expect, boot, win, openFromDesktop } = require("../support/fixtures");

test.skip(!process.env.TANKOS_VISUAL, "visual baselines run only in the pinned Playwright image (npm run test:docker)");

// The version in the menu bar changes on every release; mask it so a version bump alone never touches a baseline.
function shot(page, name, extra){
  return expect(page).toHaveScreenshot(name, Object.assign({ mask: [page.locator(".mb-ver")], maskColor: "#FF00FF" }, extra));
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

// TankOS 2.0 preview (?ui=2): the same screens with the Nocturne tokens. Only colours differ from the ones above.
test.describe("?ui=2 Nocturne preview", () => {
  test.describe("1366×657", () => {
    test.use({ viewport: { width: 1366, height: 657 } });

    test("lock screen", async ({ page }) => {
      await boot(page, { path: "/?ui=2", locked: true });
      await page.evaluate(async () => {
        await document.fonts.ready;
        const i = new Image(); i.src = "images/wallpaper-pixelverse-lakeside-night.webp"; await i.decode();
      });
      await shot(page, "lock-1366-ui2.png");
    });

    test("desktop with README", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await shot(page, "desktop-1366-ui2.png");
    });

    test("App Launcher open", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await page.locator("#btnLaunch").click();
      await expect(page.locator("#launcher")).toBeVisible();
      await shot(page, "launcher-1366-ui2.png");
    });

    test("Settings window", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await page.locator('#dock .dk[data-open="settings"]').click();
      await expect(win(page, "settings")).toHaveClass(/\bfocused\b/);
      await page.evaluate(async () => {   // the two wallpaper thumbnails
        await Promise.all(["images/wallpaper-pixelverse-lakeside-night.webp", "images/wallpaper-komezuka-sm.jpg"].map((u) => { const i = new Image(); i.src = u; return i.decode(); }));
      });
      await shot(page, "settings-1366-ui2.png");
    });

    test("bare desktop with the Komezuka wallpaper chosen in Settings", async ({ page }) => {
      await page.addInitScript(() => { try { localStorage.setItem("ui2.wallpaper", "komezuka"); } catch (e) {} });
      await boot(page, { path: "/?ui=2" });
      await page.evaluate(async () => { const i = new Image(); i.src = "images/wallpaper-komezuka.jpg"; await i.decode(); });
      await win(page, "readme").locator(".tl-close").click();
      await shot(page, "kome-1366-ui2.png");
    });

    test("bare desktop: wallpaper, menu bar, icons", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await win(page, "readme").locator(".tl-close").click();
      await shot(page, "bare-1366-ui2.png");
    });

    test("two windows, one unfocused", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await openFromDesktop(page, "calc");
      await shot(page, "windows-1366-ui2.png");
    });

    test("apps that keep their own window colours, plus a file app", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await win(page, "readme").locator(".tl-close").click();
      await openFromDesktop(page, "terminal");
      const trace = await openFromDesktop(page, "trace");
      await expect(trace.locator(".app-load")).toHaveCount(0);
      await openFromDesktop(page, "calc");
      // This one screen (three windows, the focused one blurred over the other two) rasterises a few pixels at two
      // desktop icons' rounded corners differently from run to run: 9–20 px, measured on main before PR-7 too.
      // 40 px absorbs that and nothing real: the see-through regression this suite caught in PR-4 was 36,070 px.
      await shot(page, "apps-1366-ui2.png", { maxDiffPixels: 40 });
    });
  });

  test.describe("1024×768", () => {
    test.use({ viewport: { width: 1024, height: 768 } });

    test("desktop with README", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await shot(page, "desktop-1024-ui2.png");
    });
  });

  test.describe("768×1024 tablet portrait", () => {
    test.use({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true });

    test("home", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await shot(page, "home-768-ui2.png");
    });
  });

  test.describe("390×844", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("home", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await shot(page, "home-390-ui2.png");
    });

    test("Settings full screen", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await page.locator("#btnLaunch").tap();
      await page.locator('#launcher .ln-app[data-open="settings"]').tap();
      await expect(win(page, "settings")).toHaveClass(/\bfocused\b/);
      await page.evaluate(async () => {
        await Promise.all(["images/wallpaper-pixelverse-lakeside-night.webp", "images/wallpaper-komezuka-sm.jpg"].map((u) => { const i = new Image(); i.src = u; return i.decode(); }));
      });
      await shot(page, "settings-390-ui2.png");
    });

    test("App Launcher sheet", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await page.locator("#btnLaunch").tap();
      await expect(page.locator("#launcher")).toBeVisible();
      await shot(page, "launcher-390-ui2.png");
    });

    test("app open full screen", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await page.locator('.desktop .dicon[data-open="contact"]').tap();
      await expect(win(page, "contact")).toHaveClass(/\bfocused\b/);
      await shot(page, "app-390-ui2.png");
    });
  });
});
