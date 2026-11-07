// Dock, app registry and app lifecycle: open, close, minimize, focus, running dots, Spotlight, language.
const { test, expect, boot, win, openFromDesktop } = require("../support/fixtures");

// Today's Dock, in order. Changing it is a product decision, so this list changes with it on purpose.
const DOCK = ["fukuoka", "busan", "yangmingshan", "wordtrailer", "pockettrip", "averlyn", "shachiku", "nightmarket",
  "readme", "terminal", "contact"];

// Every app with a desktop icon, and what kind of window it opens (see APPS in index.html).
const SITE = ["fukuoka", "busan", "yangmingshan", "wordtrailer", "pockettrip", "averlyn", "shachiku", "nightmarket"];
const TEMPLATE = ["blocks", "terminal", "activity", "calc", "calendar", "readme", "contact"];
const FILE = ["trace"];

async function runningIds(page){
  return page.locator("#dock .dk.run").evaluateAll((els) => els.map((e) => e.dataset.open));
}

test.describe("Dock", () => {
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("holds today's apps in order, then a separator and the classic site", async ({ page }) => {
    const ids = await page.locator("#dock button.dk").evaluateAll((els) => els.map((e) => e.dataset.open));
    expect(ids).toEqual(DOCK);
    await expect(page.locator("#dock")).toHaveAttribute("aria-label", "Dock");
    await expect(page.locator("#dock .dk-sep")).toHaveCount(1);
    await expect(page.locator("#dock a.dk").last()).toHaveAttribute("href", "classic/");
  });

  test("every Dock button has an accessible name", async ({ page }) => {
    await expect(page.locator("#dock").getByRole("button", { name: "終端機" })).toHaveCount(1);
    await expect(page.locator("#dock").getByRole("button", { name: "README.md" })).toHaveCount(1);
    for (const b of await page.locator("#dock .dk").all()) {
      expect((await b.textContent()).trim().length, await b.evaluate((e) => e.outerHTML.slice(0, 80))).toBeGreaterThan(0);
    }
  });

  test("the running dot follows the real window state", async ({ page }) => {
    expect(await runningIds(page)).toEqual(["readme"]);
    await page.locator('#dock .dk[data-open="terminal"]').click();
    await expect(win(page, "terminal")).toHaveClass(/\bfocused\b/);
    expect(await runningIds(page)).toEqual(["readme", "terminal"]);

    await win(page, "terminal").locator(".tl-min").click();      // minimized is still running
    expect(await runningIds(page)).toEqual(["readme", "terminal"]);

    await page.locator('#dock .dk[data-open="terminal"]').click();
    await win(page, "terminal").locator(".tl-close").click();
    expect(await runningIds(page)).toEqual(["readme"]);
    await win(page, "readme").locator(".tl-close").click();
    expect(await runningIds(page)).toEqual([]);
  });

  test("an app without a Dock icon gets no Dock entry while open (current behaviour)", async ({ page }) => {
    // Design-system plan R6 will show running-but-unpinned apps after the separator; update this test then.
    const before = await page.locator("#dock .dk").count();
    const calc = await openFromDesktop(page, "calc");
    await expect(page.locator("#dock .dk")).toHaveCount(before);
    // Minimized, it shrinks toward the middle of the Dock and comes back from its desktop icon.
    await calc.locator(".tl-min").click();
    await expect(calc).toHaveClass(/\bminimized\b/);
    await page.locator('.desktop .dicon[data-open="calc"]').dblclick();
    await expect(calc).not.toHaveClass(/\bminimized\b/);
    await expect(calc).toHaveClass(/\bfocused\b/);
  });

  test("Dock buttons work from the keyboard", async ({ page }) => {
    await page.locator('#dock .dk[data-open="contact"]').focus();
    await page.keyboard.press("Enter");
    await expect(win(page, "contact")).toHaveClass(/\bfocused\b/);
  });
});

test.describe("apps", () => {
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("the desktop lists every app that has an icon", async ({ page }) => {
    const ids = await page.locator(".desktop .dicon").evaluateAll((els) => els.map((e) => e.dataset.open));
    expect(ids.sort()).toEqual([...SITE, ...TEMPLATE, ...FILE].sort());
  });

  for (const id of SITE) {
    test(`site app "${id}" opens a sidebar and the live site in an iframe, then closes`, async ({ page }) => {
      const w = await openFromDesktop(page, id);
      await expect(w).toHaveClass(/\bsite\b/);
      await expect(w).toHaveClass(/\bfocused\b/);
      await expect(w.locator("aside.side h2")).not.toBeEmpty();
      await expect(w.locator(".side .links a.primary")).toHaveAttribute("href", /^https:\/\//);
      const src = await w.locator("iframe").getAttribute("src");
      await expect(w.locator(".side .links a.primary")).toHaveAttribute("href", src);
      await expect(w.locator("iframe")).toHaveClass(/\bready\b/);   // loaded (a stub page: no real site is hit)
      // The sidebar button hides and shows the sidebar.
      await w.locator('[data-act="side"]').click();
      await expect(w).toHaveClass(/\bnoside\b/);
      await w.locator(".tl-close").click();
      await expect(w).toHaveCount(0);
    });
  }

  for (const id of TEMPLATE) {
    test(`app "${id}" opens focused, minimizes, restores and closes`, async ({ page }) => {
      if (id === "readme") await win(page, "readme").locator(".tl-close").click();
      const w = await openFromDesktop(page, id);
      await expect(w).toHaveClass(/\bfocused\b/);
      await expect(w.locator(".body").first()).toBeVisible();
      await w.locator(".tl-min").click();
      await expect(w).toHaveClass(/\bminimized\b/);
      await page.locator('.desktop .dicon[data-open="' + id + '"]').dblclick();
      await expect(w).not.toHaveClass(/\bminimized\b/);
      await w.locator(".tl-close").click();
      await expect(w).toHaveCount(0);
    });
  }

  test('file app "trace" loads apps/trace.js and replaces the spinner', async ({ page }) => {
    const w = await openFromDesktop(page, "trace");
    await expect(w.locator(".app-load")).toHaveCount(0);
    await expect(w.locator(".body")).toBeVisible();
    await w.locator(".tl-close").click();
    await expect(w).toHaveCount(0);
  });

  test('file app "trace" shows Retry when its file fails, and Retry recovers', async ({ page }) => {
    let fail = true;
    await page.route(/\/apps\/trace\.js/, (route) => fail ? route.fulfill({ status: 404, body: "" }) : route.continue());
    const w = await openFromDesktop(page, "trace");
    await expect(w.locator(".app-load.app-fail")).toBeVisible();
    await expect(w.locator(".app-fail p")).toHaveText("這個 App 載入失敗，可能是網路斷了。");
    fail = false;
    await w.locator(".app-fail button").click();
    await expect(w.locator(".app-load")).toHaveCount(0);
  });

  test("a mouse click selects a desktop icon; a double-click opens it", async ({ page }) => {
    const icon = page.locator('.desktop .dicon[data-open="calendar"]');
    await icon.click();
    await expect(icon).toHaveClass(/\bsel\b/);
    await expect(win(page, "calendar")).toHaveCount(0);
    await icon.dblclick();
    await expect(win(page, "calendar")).toHaveClass(/\bfocused\b/);
  });

  test("keyboard activation of a desktop icon opens it at once", async ({ page }) => {
    await page.locator('.desktop .dicon[data-open="calendar"]').focus();
    await page.keyboard.press("Enter");
    await expect(win(page, "calendar")).toHaveClass(/\bfocused\b/);
  });

  test("the menu bar T opens About TankOS (GitHub API mocked)", async ({ page }) => {
    await page.locator("#btnAbout").click();
    await expect(win(page, "about")).toHaveClass(/\bfocused\b/);
    await expect(page.locator("#mbApp")).toHaveText("關於 TankOS");
  });

  test("Spotlight opens with Ctrl+K, finds an app by a Chinese alias, and opens it", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.locator("#spot")).toBeVisible();
    await page.locator("#spIn").fill("算數");
    await expect(page.locator("#spList li").first()).toContainText("計算機");
    await page.keyboard.press("Enter");
    await expect(page.locator("#spot")).toBeHidden();
    await expect(win(page, "calc")).toHaveClass(/\bfocused\b/);
  });

  test("Escape closes Spotlight", async ({ page }) => {
    await page.locator("#btnSpot").click();
    await expect(page.locator("#spot")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#spot")).toBeHidden();
  });

  test("the language choice applies everywhere and survives a reload", async ({ page }) => {
    await page.locator("#btnEn").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('.desktop .dicon[data-open="calc"] .lbl')).toHaveText("Calculator");
    expect(await page.evaluate(() => localStorage.getItem("lang"))).toBe("en");
    await boot(page);
    await expect(page.locator("#btnEn")).toHaveClass(/\bon\b/);
    await expect(page.locator('.desktop .dicon[data-open="calc"] .lbl')).toHaveText("Calculator");
  });

  test("window controls have screen-reader names (English-only today)", async ({ page }) => {
    // Design-system plan R3 translates these; update the expected names then.
    const bar = win(page, "readme").locator(".bar");
    await expect(bar.getByRole("button", { name: "Close" })).toHaveCount(1);
    await expect(bar.getByRole("button", { name: "Minimize" })).toHaveCount(1);
    await expect(bar.getByRole("button", { name: "Zoom" })).toHaveCount(1);
  });
});

test.describe("routes", () => {
  test("public pages are served from the repo root", async ({ request }) => {
    expect((await request.get("/")).status()).toBe(200);
    expect((await request.get("/classic/")).status()).toBe(200);
    expect((await request.get("/apps/trace.js")).status()).toBe(200);
    const os = await request.get("/os/");
    expect(os.status()).toBe(200);
    expect(await os.text()).toContain('<meta http-equiv="refresh" content="0; url=../">');
  });

  test("the lock screen shows the fixed test time and unlocks on a click", async ({ page }) => {
    await boot(page, { locked: true });
    await expect(page.locator("#lkTime")).toHaveText("10:30");
    await page.locator("#lock").click();
    await expect(page.locator("#lock")).toHaveCount(0);
  });
});
