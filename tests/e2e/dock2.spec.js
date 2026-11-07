// TankOS 2.0 Dock and App Launcher (PR-6), only under ?ui=2. ?ui=1 keeps the v2.4 Dock exactly (also pixel for
// pixel in the visual baselines). Window/Dock behaviour in 2.0 is also re-run by the "ui2" project.
const { test, expect, boot, win } = require("../support/fixtures");

const GLASS = "rgba(21, 29, 61, 0.88)";
const FOCUS_RING = "rgba(178, 151, 255, 0.8)";
const PRIMARY = "rgb(139, 124, 255)";

// The launcher's groups and items, in order, in the language on screen.
const GROUPS_ZH = ["作品", "遊戲區", "小工具", "關於我", "其他"];
const GROUPS_EN = ["Projects", "Games", "Utilities", "About me", "More"];
const APP_IDS = ["fukuoka", "busan", "yangmingshan", "wordtrailer", "pockettrip", "averlyn",
  "blocks", "trace", "shachiku", "nightmarket", "terminal", "activity", "calc", "calendar", "settings", "readme", "contact",
  "about", "private"];

function shown(page){
  return page.evaluate(() => [...document.querySelectorAll("#dock > .dk")]
    .filter((e) => getComputedStyle(e).display !== "none")
    .map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.open || e.getAttribute("href") || e.id, x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; }));
}

function after(page, sel){
  return page.locator(sel).evaluate((e) => {
    const s = getComputedStyle(e, "::after");
    return { content: s.content, w: s.width, bg: s.backgroundColor };
  });
}

async function openLauncher(page, tap){
  if (tap) await page.locator("#btnLaunch").tap(); else await page.locator("#btnLaunch").click();
  await expect(page.locator("#launcher")).toBeVisible();
}

test.describe("?ui=1: the v2.4 Dock, unchanged", () => {
  test("twelve items, 52px, no launcher button, the old dot", async ({ page }) => {
    await boot(page, { path: "/?ui=1" });
    const items = await shown(page);
    expect(items.map((i) => i.id)).toEqual(["fukuoka", "busan", "yangmingshan", "wordtrailer", "pockettrip", "averlyn",
      "shachiku", "nightmarket", "readme", "terminal", "contact", "classic/"]);
    expect(items[0].w).toBe(52);
    await expect(page.locator("#btnLaunch")).toBeHidden();
    await expect(page.locator("#launcher")).toBeHidden();
    expect(await after(page, '#dock .dk[data-open="readme"]')).toMatchObject({ w: "4px", bg: "rgba(255, 255, 255, 0.9)" });
  });

  test.describe("with motion", () => {
    test.use({ reducedMotion: "no-preference" });
    test("v2.4 hover still spreads the neighbours (kept as it was)", async ({ page }) => {
      await boot(page, { path: "/?ui=1" });
      await page.locator('#dock .dk[data-open="busan"]').hover();
      await expect(page.locator('#dock .dk[data-open="busan"]')).toHaveCSS("margin-left", "10px");
    });
  });
});

test.describe("?ui=2 desktop Dock (1366×768)", () => {
  test.beforeEach(async ({ page }) => { await boot(page, { path: "/?ui=2" }); });

  test("glass, tokens, the existing icons at 48px, plus the launcher at the end", async ({ page }) => {
    const dock = page.locator("#dock");
    await expect(dock).toHaveCSS("background-color", GLASS);
    await expect(dock).toHaveCSS("border-top-left-radius", "20px");
    await expect(dock).toHaveCSS("border-top-width", "1px");
    const items = await shown(page);
    expect(items).toHaveLength(14);
    expect(items.slice(-3).map((i) => i.id)).toEqual(["settings", "classic/", "btnLaunch"]);   // after the separator
    for (const i of items) expect([i.w, i.h]).toEqual([48, 48]);
    // The same icon elements as v2.4 (nothing regenerated).
    await expect(page.locator('#dock .dk[data-open="fukuoka"] .ic.ic-fukuoka svg use')).toHaveAttribute("href", "#g-torii");
  });

  test("running is a dot, the app in front a violet bar; it follows focus", async ({ page }) => {
    expect(await after(page, '#dock .dk[data-open="readme"]')).toMatchObject({ w: "14px", bg: PRIMARY });   // README in front
    await page.locator('#dock .dk[data-open="contact"]').click();
    expect(await after(page, '#dock .dk[data-open="contact"]')).toMatchObject({ w: "14px", bg: PRIMARY });
    expect(await after(page, '#dock .dk[data-open="readme"]')).toMatchObject({ w: "5px", bg: "rgb(188, 198, 226)" });
    expect((await after(page, '#dock .dk[data-open="terminal"]')).content).toBe("none");   // pinned, not running
    // Minimized is still running, no longer in front.
    await win(page, "contact").locator(".tl-min").click();
    expect(await after(page, '#dock .dk[data-open="contact"]')).toMatchObject({ w: "5px" });
  });

  test("keyboard focus: a violet ring on the icon and the name shown", async ({ page }) => {
    const b = page.locator('#dock .dk[data-open="busan"]');
    await page.locator('#dock .dk[data-open="fukuoka"]').focus();
    await page.keyboard.press("Tab");
    await expect(b).toBeFocused();
    await expect(b.locator(".ic")).toHaveCSS("outline", FOCUS_RING + " solid 2px");
    await expect(b.locator(".tip")).toHaveCSS("opacity", "1");
    await page.keyboard.press("Enter");
    await expect(win(page, "busan")).toHaveClass(/\bfocused\b/);
  });

  test("the classic site is still a plain link in the Dock", async ({ page }) => {
    await expect(page.locator("#dock a.dk")).toHaveAttribute("href", "classic/");
    await expect(page.locator("#dock a.dk")).not.toHaveAttribute("target", /.+/);
  });

  test("prefers-reduced-transparency: opaque Dock", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    await boot(page, { path: "/?ui=2" });
    await expect(page.locator("#dock")).toHaveCSS("background-color", "rgb(17, 26, 51)");
  });
});

test.describe("?ui=2 Dock hover", () => {
  test.use({ reducedMotion: "no-preference" });
  test("only the hovered icon grows; no other item moves", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    const before = await shown(page);
    await page.locator('#dock .dk[data-open="busan"]').hover();
    await expect(page.locator('#dock .dk[data-open="busan"] .tip')).toHaveCSS("opacity", "1");
    await page.waitForTimeout(250);   // let the 160ms transform transition finish
    const during = await shown(page);
    expect(during.map((i) => [i.x, i.w])).toEqual(before.map((i) => [i.x, i.w]));   // button boxes do not move
    const t = await page.locator('#dock .dk[data-open="busan"] .ic').evaluate((e) => getComputedStyle(e).transform);
    expect(t).not.toBe("none");
    for (const n of ["fukuoka", "yangmingshan"]) {
      expect(await page.locator(`#dock .dk[data-open="${n}"] .ic`).evaluate((e) => getComputedStyle(e).transform)).toBe("none");
    }
  });
});

test.describe("?ui=2 Dock hover, reduced motion", () => {
  test("no magnification at all", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    await page.locator('#dock .dk[data-open="busan"]').hover();
    expect(await page.locator('#dock .dk[data-open="busan"] .ic').evaluate((e) => getComputedStyle(e).transform)).toBe("none");
  });
});

test.describe("?ui=2 App Launcher (desktop)", () => {
  test.beforeEach(async ({ page }) => { await boot(page, { path: "/?ui=2" }); });

  test("opens as a modal dialog with every app, grouped like the desktop", async ({ page }) => {
    await openLauncher(page);
    await expect(page.locator("#btnLaunch")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("dialog", { name: "所有 App" })).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("#launcher .ln-group h3")).toHaveText(GROUPS_ZH);
    const ids = await page.locator("#launcher .ln-app[data-open]").evaluateAll((els) => els.map((e) => e.dataset.open));
    expect(ids).toEqual(APP_IDS);
    await expect(page.locator('#launcher a.ln-app[href="classic/"]')).toHaveCount(1);
    // Short names, as on the desktop; the running app is marked (and said, for screen readers).
    await expect(page.locator('#launcher .ln-app[data-open="fukuoka"] .ln-name')).toHaveText("福岡自駕旅遊");
    await expect(page.locator('#launcher .ln-app[data-open="readme"]')).toHaveClass(/\bcur\b/);
    await expect(page.getByRole("button", { name: "README.md, 執行中" })).toHaveCount(1);
    // Focus starts on the first app.
    await expect(page.locator('#launcher .ln-app[data-open="fukuoka"]')).toBeFocused();
  });

  for (const id of APP_IDS.filter((x) => x !== "private")) {
    test(`opens ${id}`, async ({ page }) => {
      if (id === "readme") await win(page, "readme").locator(".tl-close").click();
      await openLauncher(page);
      await page.locator(`#launcher .ln-app[data-open="${id}"]`).click();
      await expect(page.locator("#launcher")).toBeHidden();
      await expect(win(page, id)).toHaveClass(/\bfocused\b/);
    });
  }

  test("the private link opens in a new tab, as from Spotlight", async ({ page }) => {
    await openLauncher(page);
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.locator('#launcher .ln-app[data-open="private"]').click()]);
    expect(popup.url()).toContain("portfolio-private.xarenvich.com");
    await expect(page.locator("#launcher")).toBeHidden();
  });

  test("Esc, the close button and a click outside all close it; focus returns to the Dock button", async ({ page }) => {
    await openLauncher(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#launcher")).toBeHidden();
    await expect(page.locator("#btnLaunch")).toBeFocused();
    await expect(page.locator("#btnLaunch")).toHaveAttribute("aria-expanded", "false");
    await openLauncher(page);
    await page.locator("#lnClose").click();
    await expect(page.locator("#launcher")).toBeHidden();
    await openLauncher(page);
    await page.mouse.click(20, 640);   // the dimmed backdrop
    await expect(page.locator("#launcher")).toBeHidden();
  });

  test("keyboard: Tab stays inside, arrows move between apps, Enter opens", async ({ page }) => {
    await openLauncher(page);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('#launcher .ln-app[data-open="busan"]')).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('#launcher .ln-app[data-open="trace"]')).toBeFocused();   // same column, next row
    await page.keyboard.press("End");
    await expect(page.locator('#launcher a.ln-app[href="classic/"]')).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#lnClose")).toBeFocused();                              // wraps to the first control
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator('#launcher a.ln-app[href="classic/"]')).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await expect(win(page, "fukuoka")).toHaveClass(/\bfocused\b/);
  });

  test("Chinese / English: groups and names follow the language", async ({ page }) => {
    await page.locator("#btnEn").click();
    await openLauncher(page);
    await expect(page.locator("#launcher .ln-group h3")).toHaveText(GROUPS_EN);
    await expect(page.locator('#launcher .ln-app[data-open="calc"] .ln-name')).toHaveText("Calculator");
    await expect(page.getByRole("dialog", { name: "All apps" })).toHaveCount(1);
    await expect(page.locator("#btnLaunch .tip")).toHaveText("All apps");
  });

  test("layers: the backdrop covers the menu bar, the windows and the Dock; Spotlight replaces it", async ({ page }) => {
    await openLauncher(page);
    const hit = await page.evaluate(() => ({
      menu: document.elementFromPoint(683, 10).id,
      dock: document.elementFromPoint(683, 735).id
    }));
    expect(hit).toEqual({ menu: "launcher", dock: "launcher" });
    await page.keyboard.press("Control+k");
    await expect(page.locator("#spot")).toBeVisible();
    await expect(page.locator("#launcher")).toBeHidden();
  });
});

// ---------- the launcher as a true modal dialog (review P2) ----------
const BEHIND = [".menubar", "#desktop", "#windows", "#dock"];
function inertState(page){
  return page.evaluate((sels) => sels.map((s) => document.querySelector(s).hasAttribute("inert")), BEHIND);
}
// Every element that is a visible, open modal dialog right now.
function openModals(page){
  return page.evaluate(() => [...document.querySelectorAll('[aria-modal="true"]')]
    .filter((d) => d.getClientRects().length > 0).map((d) => d.getAttribute("aria-label") || d.getAttribute("aria-labelledby")));
}

test.describe("?ui=2 App Launcher is a true modal", () => {
  test.beforeEach(async ({ page }) => { await boot(page, { path: "/?ui=2" }); });

  test("the menu bar, desktop, windows and Dock are inert while it is open, and only then", async ({ page }) => {
    expect(await inertState(page)).toEqual([false, false, false, false]);
    await openLauncher(page);
    expect(await inertState(page)).toEqual([true, true, true, true]);
    await page.keyboard.press("Escape");
    expect(await inertState(page)).toEqual([false, false, false, false]);
  });

  test("Tab and Shift+Tab never leave it (40 presses each way)", async ({ page }) => {
    await openLauncher(page);
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press(key);
        expect(await page.evaluate(() => document.getElementById("launcher").contains(document.activeElement)), `${key} #${i}`).toBe(true);
      }
    }
  });

  test("the background is out of the accessibility tree while it is open (Chromium's real AX tree)", async ({ page }) => {
    // Read the browser's own accessibility tree over CDP: Playwright's ariaSnapshot() does not apply inert.
    const cdp = await page.context().newCDPSession(page);
    const names = async () => {
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      return nodes.filter((n) => !n.ignored && n.name && n.name.value).map((n) => n.role.value + ":" + n.name.value);
    };
    const before = await names();
    expect(before).toContain("navigation:Dock");
    expect(before).toContain("button:EN");                    // menu bar
    expect(before).toContain("dialog:README.md");             // window
    await openLauncher(page);
    const during = await names();
    expect(during).toContain("dialog:所有 App");
    expect(during).not.toContain("navigation:Dock");
    expect(during).not.toContain("button:EN");
    expect(during).not.toContain("dialog:README.md");
    await page.keyboard.press("Escape");
    expect(await names()).toContain("navigation:Dock");
  });

  for (const how of ["Escape", "close button", "backdrop"]) {
    test(`closing with ${how} returns focus to the launcher button`, async ({ page }) => {
      await openLauncher(page);
      await page.keyboard.press("ArrowRight");
      if (how === "Escape") await page.keyboard.press("Escape");
      if (how === "close button") await page.locator("#lnClose").click();
      if (how === "backdrop") await page.mouse.click(20, 640);
      await expect(page.locator("#launcher")).toBeHidden();
      await expect(page.locator("#btnLaunch")).toBeFocused();
    });
  }

  test("opening an app hands focus to its window (keyboard)", async ({ page }) => {
    await page.locator("#btnLaunch").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#launcher")).toBeVisible();
    await page.keyboard.press("ArrowRight");                          // 釜山旅遊
    await page.keyboard.press("Enter");
    await expect(page.locator("#launcher")).toBeHidden();
    const w = win(page, "busan");
    await expect(w).toHaveClass(/\bfocused\b/);
    expect(await w.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))).toBe(true);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
    // Tab moves on into the window, not back into the hidden launcher.
    await page.keyboard.press("Tab");
    expect(await w.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  });

  test("the terminal still focuses its own prompt", async ({ page }) => {
    await openLauncher(page);
    await page.locator('#launcher .ln-app[data-open="terminal"]').click();
    await expect(win(page, "terminal").locator("input")).toBeFocused();
  });

  test("an app that is already open but minimized comes back and gets focus", async ({ page }) => {
    await win(page, "readme").locator(".tl-min").click();
    await openLauncher(page);
    await page.locator('#launcher .ln-app[data-open="readme"]').click();
    const w = win(page, "readme");
    await expect(w).not.toHaveClass(/\bminimized\b/);
    expect(await w.evaluate((el) => el === document.activeElement)).toBe(true);
  });

  test("the private link opens a new tab and focus returns to the launcher button", async ({ page }) => {
    await openLauncher(page);
    await Promise.all([page.waitForEvent("popup"), page.locator('#launcher .ln-app[data-open="private"]').click()]);
    await expect(page.locator("#btnLaunch")).toBeFocused();
    expect(await inertState(page)).toEqual([false, false, false, false]);
  });

  test("a language change while open keeps focus on the same item, never on <body>", async ({ page }) => {
    await openLauncher(page);
    const calc = page.locator('#launcher .ln-app[data-open="calc"]');
    await calc.focus();
    // The menu bar is inert now, so the change comes from code (as any future language source would).
    await page.evaluate(() => document.getElementById("btnEn").click());
    await expect(page.locator("#launcher .ln-group h3")).toHaveText(GROUPS_EN);
    await expect(calc).toBeFocused();
    await expect(calc.locator(".ln-name")).toHaveText("Calculator");
    // The close button and the classic link keep focus too.
    await page.locator("#lnClose").focus();
    await page.evaluate(() => document.getElementById("btnZh").click());
    await expect(page.locator("#lnClose")).toBeFocused();
    await page.locator('#launcher a.ln-app[href="classic/"]').focus();
    await page.evaluate(() => document.getElementById("btnEn").click());
    await expect(page.locator('#launcher a.ln-app[href="classic/"]')).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  });

  test("Spotlight and the launcher are never open together", async ({ page }) => {
    await openLauncher(page);
    expect(await openModals(page)).toEqual(["lnTitle"]);
    await page.keyboard.press("Control+k");                  // Spotlight from inside the launcher
    await expect(page.locator("#spot")).toBeVisible();
    expect(await openModals(page)).toEqual(["Spotlight"]);
    // Spotlight is a real modal too since PR-8: the background stays inert, now for Spotlight.
    expect(await inertState(page)).toEqual([true, true, true, true]);
    await expect(page.locator("#spIn")).toBeFocused();
    await page.keyboard.press("Escape");
    await openLauncher(page);                                // and the launcher closes Spotlight
    await page.keyboard.press("/");
    await expect(page.locator("#spot")).toBeVisible();
    await expect(page.locator("#launcher")).toBeHidden();
    expect(await openModals(page)).toEqual(["Spotlight"]);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await expect(page.locator("#spot")).toBeVisible();
    await page.evaluate(() => document.getElementById("btnLaunch").click());   // launcher while Spotlight is up
    await expect(page.locator("#spot")).toBeHidden();
    expect(await openModals(page)).toEqual(["lnTitle"]);
  });
});

// Phones: a short Dock (pinned apps + launcher) with 44px+ targets; every width from 320 to 430, plus a tablet.
for (const [w, h] of [[320, 568], [360, 740], [375, 667], [390, 844], [414, 896], [430, 932], [768, 1024]]) {
  test.describe(`?ui=2 phone Dock ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });

    test("README, Contact, Classic and the launcher; every target at least 44×44; nothing overflows", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      const items = await shown(page);
      expect(items.map((i) => i.id)).toEqual(["readme", "contact", "classic/", "btnLaunch"]);
      for (const i of items) {
        expect(i.w).toBeGreaterThanOrEqual(44);
        expect(i.h).toBeGreaterThanOrEqual(44);
        expect(i.x).toBeGreaterThanOrEqual(8);
        expect(i.right).toBeLessThanOrEqual(w - 8);
      }
      const d = await page.locator("#dock").boundingBox();
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x + d.width).toBeLessThanOrEqual(w);
      expect(d.y + d.height).toBeLessThanOrEqual(h - 10);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
    });

    test("the launcher sheet fits, its targets are 44×44+, and a tap opens the app full screen", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await openLauncher(page, true);
      const box = await page.locator("#launcher .ln-box").boundingBox();
      expect(box.x).toBe(0);
      expect(box.width).toBe(w);
      const sizes = await page.locator("#launcher .ln-app").evaluateAll((els) => els.map((e) => [e.offsetWidth, e.offsetHeight]));
      for (const [bw, bh] of sizes) { expect(bw).toBeGreaterThanOrEqual(44); expect(bh).toBeGreaterThanOrEqual(44); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
      const calc = page.locator('#launcher .ln-app[data-open="calc"]');
      await calc.scrollIntoViewIfNeeded();
      await calc.tap();
      await expect(page.locator("#launcher")).toBeHidden();
      const c = await win(page, "calc").boundingBox();
      expect(c.x).toBe(0);
      expect(c.width).toBe(w);
    });
  });
}

test.describe("?ui=2 phone: switching between apps", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("an app opened from the launcher shows as running there; the Dock still opens pinned apps", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    await openLauncher(page, true);
    await page.locator('#launcher .ln-app[data-open="terminal"]').tap();
    await page.locator('#dock .dk[data-open="contact"]').tap();
    await expect(win(page, "contact")).toHaveClass(/\bfocused\b/);
    await openLauncher(page, true);
    await expect(page.locator('#launcher .ln-app[data-open="terminal"]')).toHaveClass(/\brun\b/);
    await expect(page.locator('#launcher .ln-app[data-open="contact"]')).toHaveClass(/\bcur\b/);
    await page.locator('#launcher .ln-app[data-open="terminal"]').tap();
    await expect(win(page, "terminal")).toHaveClass(/\bfocused\b/);
  });
});
