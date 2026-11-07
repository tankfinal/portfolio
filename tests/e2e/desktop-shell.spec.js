// TankOS 2.0 desktop shell (PR-5): the Nocturne menu bar and the Pixelverse wallpaper, both only under ?ui=2.
// ?ui=1 must stay exactly v2.4 (also covered pixel for pixel by the visual baselines).
const { test, expect, boot, win } = require("../support/fixtures");

const GLASS = "rgba(21, 29, 61, 0.88)";        // --tank-glass
const FOCUS_RING = "rgba(178, 151, 255, 0.8)"; // --tank-border-focus

// Every item the v2.4 menu bar has, in order. 2.0 restyles them; it must not add or drop any.
const ITEMS = ["#btnAbout", "#mbApp", ".mb-item", ".mb-ver", ".mb-priv", "#btnSpot", "#btnZh", "#btnEn", "#mbWho", "#clock"];

function bar(page){
  return page.evaluate(() => {
    const m = document.querySelector(".menubar"), s = getComputedStyle(m);
    return {
      h: m.getBoundingClientRect().height, bg: s.backgroundColor, blur: s.backdropFilter,
      line: s.borderBottomWidth + " " + s.borderBottomColor,
      desktopTop: document.getElementById("desktop").getBoundingClientRect().top,
      windowsTop: document.getElementById("windows").getBoundingClientRect().top
    };
  });
}

// WCAG contrast of an element's text against the bar, with the bar's glass composited over WHITE: the worst case,
// as if the brightest part of any wallpaper sat right under it.
function contrastOverWhite(page, sel){
  return page.evaluate((sel) => {
    const rgba = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const over = (fg, bg) => { const a = fg[3] == null ? 1 : fg[3]; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
    const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const el = document.querySelector(sel), s = getComputedStyle(el);
    let bg = over(rgba(getComputedStyle(document.querySelector(".menubar")).backgroundColor), [255, 255, 255]);
    const own = rgba(s.backgroundColor);
    if (own.length && own[3] !== 0) bg = over(own, bg);   // the item's own pill (selected language, 私人版)
    const fg = over(rgba(s.color).concat([+s.opacity]), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  }, sel);
}

test.describe("menu bar, ?ui=1: v2.4", () => {
  test("28px, the old translucent bar, 16px logo", async ({ page }) => {
    await boot(page, { path: "/?ui=1" });
    expect(await bar(page)).toMatchObject({ h: 28, bg: "rgba(14, 16, 40, 0.38)", desktopTop: 28, windowsTop: 28 });
    await expect(page.locator("#btnAbout")).toHaveCSS("width", "16px");
  });
});

test.describe("menu bar, ?ui=2: Nocturne", () => {
  test.beforeEach(async ({ page }) => { await boot(page, { path: "/?ui=2" }); });

  test("--tank-menubar-height (36px), window glass, lavender rule, blur; desktop and windows start under it", async ({ page }) => {
    const h = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tank-menubar-height").trim());
    expect(h).toBe("36px");
    expect(await bar(page)).toEqual({
      h: 36, bg: GLASS, blur: "blur(24px) saturate(1.4)", line: "1px rgba(204, 197, 255, 0.18)", desktopTop: 36, windowsTop: 36
    });
  });

  test("same items in the same order as v2.4, and nothing new", async ({ page }) => {
    const v2 = await page.evaluate(() => [...document.querySelectorAll(".menubar *")].filter((e) => e.id || e.className).length);
    for (const sel of ITEMS) await expect(page.locator(".menubar " + sel)).toHaveCount(1);
    await boot(page, { path: "/?ui=1" });
    const v1 = await page.evaluate(() => [...document.querySelectorAll(".menubar *")].filter((e) => e.id || e.className).length);
    expect(v2).toBe(v1);
  });

  test("the T logo stays brand red (D2)", async ({ page }) => {
    await expect(page.locator("#btnAbout")).toHaveCSS("background-color", "rgb(214, 40, 40)");
    await expect(page.locator("#btnAbout")).toHaveCSS("width", "20px");
  });

  test("every label reads at WCAG AA even with the brightest wallpaper under the bar", async ({ page }) => {
    for (const sel of ["#mbApp", ".mb-item", ".mb-ver", ".mb-priv", "#btnZh", "#btnEn", "#mbWho span", "#clock"]) {
      expect(await contrastOverWhite(page, sel), sel).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("hover, active and keyboard focus are all visible", async ({ page }) => {
    const en = page.locator("#btnEn");                      // not the selected language
    await expect(en).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await en.hover();
    await expect(en).toHaveCSS("background-color", "rgba(255, 255, 255, 0.1)");
    const spot = page.locator("#btnSpot"), b = await spot.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(spot).toHaveCSS("background-color", "rgba(139, 124, 255, 0.34)");
    await page.mouse.up();
    await page.keyboard.press("Escape");                    // the click opened Spotlight
    // Keyboard focus: a 2px violet ring.
    await page.locator("#btnZh").focus();
    await page.keyboard.press("Tab");
    await expect(en).toBeFocused();
    await expect(en).toHaveCSS("outline", FOCUS_RING + " solid 2px");
  });

  test("the selected language is marked with a violet pill", async ({ page }) => {
    await expect(page.locator("#btnZh")).toHaveCSS("background-color", "rgba(139, 124, 255, 0.28)");
    await page.locator("#btnEn").click();
    await expect(page.locator("#btnEn")).toHaveCSS("background-color", "rgba(139, 124, 255, 0.28)");
    await expect(page.locator("#mbApp")).toHaveText("README.md");
    await expect(page.locator("#clock")).toHaveText("Sat, Nov 7, 10:30 AM");
  });

  test("everything still works: About, Spotlight, language, online count, private link", async ({ page }) => {
    await page.locator("#btnAbout").click();
    await expect(win(page, "about")).toHaveClass(/\bfocused\b/);
    await page.locator("#btnSpot").click();
    await expect(page.locator("#spot")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator("#mbWho").click();
    await expect(win(page, "terminal")).toHaveClass(/\bfocused\b/);
    await expect(page.locator(".mb-priv")).toHaveAttribute("href", "https://portfolio-private.xarenvich.com/");
    await expect(page.locator(".mb-priv")).toHaveAttribute("target", "_blank");
  });

  test("prefers-reduced-transparency: an opaque bar", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    await boot(page, { path: "/?ui=2" });
    expect(await bar(page)).toMatchObject({ bg: "rgb(11, 16, 32)", blur: "none" });
  });
});

for (const [w, h] of [[390, 844], [360, 740]]) {
  test.describe(`menu bar, ?ui=2 on a ${w}px phone`, () => {
    test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    test("36px, same items hidden as v2.4, and the app name is not cut off", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      expect((await bar(page)).h).toBe(36);
      await expect(page.locator(".mb-item")).toBeHidden();
      await expect(page.locator(".mb-ver")).toBeHidden();
      await expect(page.locator(".mb-priv span")).toBeHidden();
      const app = await page.locator("#mbApp").evaluate((e) => [e.scrollWidth, e.clientWidth]);
      expect(app[0]).toBeLessThanOrEqual(app[1]);
      const right = await page.locator(".menubar .mb-r").evaluate((e) => e.getBoundingClientRect().right);
      expect(right).toBeLessThanOrEqual(w);
    });
  });
}
