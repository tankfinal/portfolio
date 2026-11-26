// Release checks for a visitor with nothing saved: the version, the wallpaper actually downloaded, settings that
// survive a reload, the main flows at four sizes, and the static files. (v3.0.0 removed the v2.4 UI: the flag
// itself is covered by ui-flag.spec.js.)
const { test, expect, boot, win, settle } = require("../support/fixtures");

async function state(page){
  return page.evaluate(() => {
    let stored; try { stored = localStorage.getItem("ui"); } catch (e) { stored = "blocked"; }
    return { ui: document.documentElement.getAttribute("data-ui") === "2" ? "2" : "1", stored, ver: document.querySelector(".mb-ver").textContent };
  });
}
function wallpapers(page){
  const seen = [];
  page.on("request", (r) => { const m = r.url().match(/images\/(wallpaper-[^?]+)/); if (m) seen.push(m[1]); });
  return seen;
}

test.describe("a new visitor", () => {
  test("gets TankOS 2.0 at v3.0.1, with only the Pixelverse WebP downloaded, and nothing saved", async ({ page }) => {
    const seen = wallpapers(page);
    await boot(page);
    expect(await state(page)).toEqual({ ui: "2", stored: null, ver: "v3.0.1" });
    expect(seen).toEqual(["wallpaper-pixelverse-lakeside-night.webp"]);   // not the Komezuka photo
    await boot(page);
    expect((await state(page)).stored).toBeNull();
  });

  test("2.0 is set before the first paint", async ({ page }) => {
    await page.addInitScript(() => {
      window.__uiSeen = null;
      new MutationObserver((list, obs) => {
        for (const m of list) if (m.attributeName === "data-ui") { window.__uiSeen = { body: !!document.body, sheets: document.styleSheets.length }; obs.disconnect(); }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-ui"] });
    });
    await page.goto("/");
    expect(await page.evaluate(() => window.__uiSeen)).toEqual({ body: false, sheets: 0 });
  });

  test("a returning visitor with a saved language gets 2.0 in their language", async ({ page }) => {
    await page.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("lang", "en"); sessionStorage.setItem("seeded", "1"); } });
    await boot(page);
    expect(await state(page)).toMatchObject({ ui: "2", stored: null });
    await expect(page.locator('#desktop .dicon[data-open="blocks"] .lbl')).toHaveText("Block Puzzle");
  });
});

test.describe("2.0 preferences", () => {
  test("wallpaper, transparency and motion survive a reload", async ({ page }) => {
    await boot(page);
    await page.locator('#dock .dk[data-open="settings"]').click();
    const s = win(page, "settings");
    await s.locator('input[name="st-wallpaper"][value="komezuka"]').check();
    await s.locator('input[name="st-transparency"][value="reduced"]').check();
    await s.locator('input[name="st-motion"][value="normal"]').check();
    const seen = wallpapers(page);
    await page.goto("/");
    await page.keyboard.press("Space");
    await settle(page);
    const a = await page.evaluate(() => {
      const r = document.documentElement;
      return { ui: r.getAttribute("data-ui"), wall: r.getAttribute("data-wall"), tr: r.getAttribute("data-transparency"), mo: r.getAttribute("data-motion") };
    });
    expect(a).toEqual({ ui: "2", wall: "komezuka", tr: "reduced", mo: "normal" });
    expect(seen.filter((f) => /pixelverse/.test(f))).toEqual([]);
  });
});

test.describe("main flows", () => {
  for (const [w, h, m] of [[1366, 657, 0], [1024, 768, 0], [768, 1024, 1], [390, 844, 1]]) {
    test.describe(`${w}×${h}`, () => {
      test.use({ viewport: { width: w, height: h }, isMobile: !!m, hasTouch: !!m });
      test("launcher → app, Spotlight → app, Settings, close; no horizontal overflow", async ({ page }) => {
        await boot(page);
        expect((await state(page)).ui).toBe("2");
        const tap = (loc) => (m ? loc.tap() : loc.click());
        await tap(page.locator("#btnLaunch"));
        await tap(page.locator('#launcher .ln-app[data-open="contact"]'));
        await expect(win(page, "contact")).toHaveClass(/\bfocused\b/);
        await page.keyboard.press("Control+k");
        await page.locator("#spIn").fill("計算機");
        await page.keyboard.press("Enter");
        await expect(win(page, "calc")).toHaveClass(/\bfocused\b/);
        await tap(page.locator("#btnLaunch"));
        await tap(page.locator('#launcher .ln-app[data-open="settings"]'));
        await expect(win(page, "settings")).toHaveClass(/\bfocused\b/);
        await tap(win(page, "settings").locator(".tl-close"));
        await expect(win(page, "settings")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
      });
    });
  }
});

test.describe("static files", () => {
  test("the Komezuka wallpapers (a Settings choice), the classic site, /os/ and apps/ are served", async ({ request }) => {
    for (const f of ["/images/wallpaper-komezuka.jpg", "/images/wallpaper-komezuka-sm.jpg", "/classic/", "/os/", "/apps/trace.js"]) {
      expect((await request.get(f)).status(), f).toBe(200);
    }
  });
});
