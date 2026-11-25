// Dock, app registry and app lifecycle: open, close, minimize, focus, running dots, Spotlight, language.
const { test, expect, boot, win, openFromDesktop, openApp } = require("../support/fixtures");

// Today's Dock apps, in order (then the separator, the classic site and the launcher). Changing it is a product
// decision, so this list changes with it on purpose. Since v3.0.0 the Dock holds system apps only.
const DOCK = ["readme", "contact", "terminal", "activity", "calc", "calendar", "settings"];

// Every app with a window, and what kind of window it opens (see APPS in index.html).
const SITE = ["fukuoka", "busan", "yangmingshan", "wordtrailer", "pockettrip", "averlyn", "dayday", "shachiku", "nightmarket"];
const TEMPLATE = ["blocks", "terminal", "activity", "calc", "calendar", "readme", "contact"];
const FILE = ["trace"];
// On the desktop pages, in order: the projects and games.
const DESKTOP = ["fukuoka", "busan", "yangmingshan", "wordtrailer", "pockettrip", "averlyn", "dayday",
  "blocks", "trace", "shachiku", "nightmarket"];

async function runningIds(page){
  return page.locator("#dock .dk.run").evaluateAll((els) => els.map((e) => e.dataset.open));
}

test.describe("Dock", () => {
  test.beforeEach(async ({ page }) => { await boot(page, { readme: true }); });

  test("holds today's apps in order, then a separator, the classic site and the launcher", async ({ page }) => {
    const items = await page.locator("#dock > *").evaluateAll((els) => els.filter((e) => e.getClientRects().length)
      .map((e) => e.dataset.open || (e.classList.contains("dk-sep") ? "|" : e.getAttribute("href") || e.id)));
    expect(items).toEqual([...DOCK, "|", "classic/", "btnLaunch"]);
    await expect(page.locator("#dock")).toHaveAttribute("aria-label", "Dock");
    await expect(page.locator("#dock .dk-sep")).toHaveCount(1);
    await expect(page.locator("#dock a.dk").last()).toHaveAttribute("href", "classic/");
    // No project or game in the Dock.
    for (const id of DESKTOP) await expect(page.locator(`#dock [data-open="${id}"]`)).toHaveCount(0);
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

  test("a project gets no Dock entry while open; minimized, one click on its desktop icon brings it back", async ({ page }) => {
    // Accepted in v3.0.0: projects and games never show in the Dock, running or not.
    await win(page, "readme").locator(".tl-close").click();
    const before = await page.locator("#dock .dk").count();
    const site = await openFromDesktop(page, "fukuoka");
    await expect(page.locator("#dock .dk")).toHaveCount(before);
    await site.evaluate((el) => { el.__pwSame = true; });
    // Minimized, it shrinks toward the middle of the Dock and comes back from its desktop icon, with one click.
    await site.locator(".tl-min").click();
    await expect(site).toHaveClass(/\bminimized\b/);
    await page.locator('#desktop .dicon[data-open="fukuoka"]').click();
    await expect(site).not.toHaveClass(/\bminimized\b/);
    await expect(site).toHaveClass(/\bfocused\b/);
    expect(await site.evaluate((el) => el.__pwSame === true)).toBe(true);
  });

  test("Dock buttons work from the keyboard", async ({ page }) => {
    await page.locator('#dock .dk[data-open="contact"]').focus();
    await page.keyboard.press("Enter");
    await expect(win(page, "contact")).toHaveClass(/\bfocused\b/);
  });
});

test.describe("apps", () => {
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("the desktop holds the projects and games, in order", async ({ page }) => {
    const ids = await page.locator("#desktop .dicon").evaluateAll((els) => els.map((e) => e.dataset.open));
    expect(ids).toEqual(DESKTOP);
    expect([...SITE, ...FILE, "blocks"].sort()).toEqual([...DESKTOP].sort());
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
      const w = await openApp(page, id);
      await expect(w).toHaveClass(/\bfocused\b/);
      await expect(w.locator(".body").first()).toBeVisible();
      await w.locator(".tl-min").click();
      await expect(w).toHaveClass(/\bminimized\b/);
      await openApp(page, id);
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

  test("one mouse click on a desktop icon opens it (like an iPad)", async ({ page }) => {
    await page.locator('#desktop .dicon[data-open="blocks"]').click();
    await expect(win(page, "blocks")).toHaveClass(/\bfocused\b/);
    await expect(page.locator("section.win")).toHaveCount(1);
  });

  test("keyboard activation of a desktop icon opens it at once", async ({ page }) => {
    await page.locator('#desktop .dicon[data-open="blocks"]').focus();
    await page.keyboard.press("Enter");
    await expect(win(page, "blocks")).toHaveClass(/\bfocused\b/);
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
    await expect(page.locator('#desktop .dicon[data-open="blocks"] .lbl')).toHaveText("Block Puzzle");
    await expect(page.locator('#dock .dk[data-open="calc"] .tip')).toHaveText("Calculator");
    expect(await page.evaluate(() => localStorage.getItem("lang"))).toBe("en");
    await boot(page);
    await expect(page.locator("#btnEn")).toHaveClass(/\bon\b/);
    await expect(page.locator('#desktop .dicon[data-open="blocks"] .lbl')).toHaveText("Block Puzzle");
  });

  test("window controls have screen-reader names (English-only today)", async ({ page }) => {
    // Design-system plan R3 translates these; update the expected names then.
    const bar = (await openApp(page, "readme")).locator(".bar");
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
