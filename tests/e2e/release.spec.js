// v2.5.0: TankOS 2.0 becomes the default. These tests start as a new visitor (nothing saved) unless they say
// otherwise, and check who gets which UI, that explicit choices are never overwritten, and that the way back works.
const { test, expect, boot, win, settle } = require("../support/fixtures");
test.use({ tankUi: null });

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

test.describe("who gets which UI", () => {
  test("a new visitor gets TankOS 2.0, and nothing is saved for them", async ({ page }) => {
    const seen = wallpapers(page);
    await boot(page);
    expect(await state(page)).toEqual({ ui: "2", stored: null, ver: "v2.6.4" });
    expect(seen).toEqual(["wallpaper-pixelverse-lakeside-night.webp"]);   // not the v2.4 photo
    // Nothing saved: a later change of the default (or a rollback) reaches them too.
    await boot(page);
    expect((await state(page)).stored).toBeNull();
  });

  test("2.0 is set before the first paint for a new visitor (no flash of v2.4)", async ({ page }) => {
    await page.addInitScript(() => {
      window.__uiSeen = null;
      new MutationObserver((list, obs) => {
        for (const m of list) if (m.attributeName === "data-ui") { window.__uiSeen = { body: !!document.body, sheets: document.styleSheets.length }; obs.disconnect(); }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-ui"] });
    });
    await page.goto("/");
    expect(await page.evaluate(() => window.__uiSeen)).toEqual({ body: false, sheets: 0 });
  });

  for (const saved of ["1", "2"]) {
    test(`a returning visitor who chose ${saved === "1" ? "v2.4" : "2.0"} keeps it; the new default never overwrites it`, async ({ page }) => {
      await page.addInitScript((v) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("ui", v); sessionStorage.setItem("seeded", "1"); } }, saved);
      await boot(page);
      expect(await state(page)).toMatchObject({ ui: saved, stored: saved });
      await boot(page);
      expect(await state(page)).toMatchObject({ ui: saved, stored: saved });
    });
  }

  test("a v2.4-era visitor (language saved, no UI choice) gets 2.0 in their language", async ({ page }) => {
    await page.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("lang", "en"); sessionStorage.setItem("seeded", "1"); } });
    await boot(page);
    expect(await state(page)).toMatchObject({ ui: "2", stored: null });
    await expect(page.locator('.desktop .dicon[data-open="calc"] .lbl')).toHaveText("Calculator");
  });
});

test.describe("?ui=1 and ?ui=2 both work, and stick", () => {
  test("?ui=1 → v2.4, remembered; ?ui=2 → back to 2.0, remembered", async ({ page }) => {
    await boot(page, { path: "/?ui=1" });
    expect(await state(page)).toMatchObject({ ui: "1", stored: "1" });
    await expect(page.locator("#btnLaunch")).toBeHidden();               // the v2.4 Dock
    await boot(page);
    expect(await state(page)).toMatchObject({ ui: "1", stored: "1" });
    await boot(page, { path: "/?ui=2" });
    expect(await state(page)).toMatchObject({ ui: "2", stored: "2" });
    await boot(page);
    expect(await state(page)).toMatchObject({ ui: "2", stored: "2" });
  });

  test("with storage blocked: the default is 2.0, and ?ui=1 still works for that load", async ({ page }) => {
    await page.addInitScript(() => {
      const no = () => { throw new DOMException("blocked", "SecurityError"); };
      Storage.prototype.getItem = no; Storage.prototype.setItem = no; Storage.prototype.removeItem = no;
    });
    for (const [path, ui] of [["/", "2"], ["/?ui=1", "1"], ["/?ui=2", "2"], ["/", "2"]]) {
      await page.goto(path);
      expect(await state(page), path).toMatchObject({ ui, stored: "blocked" });
    }
  });
});

test.describe("the way back from Settings", () => {
  test("Settings › Switch back to v2.4 lands on v2.4 and stays there; ?ui=2 returns", async ({ page }) => {
    await boot(page);
    await page.locator('#dock .dk[data-open="settings"]').click();
    const s = win(page, "settings");
    await expect(s).toHaveClass(/\bfocused\b/);
    await Promise.all([page.waitForURL(/\?ui=1$/), s.locator('[data-act="v1"]').click()]);
    expect(await state(page)).toMatchObject({ ui: "1", stored: "1" });
    await boot(page);
    expect(await state(page)).toMatchObject({ ui: "1", stored: "1" });
    await boot(page, { path: "/?ui=2" });
    expect(await state(page)).toMatchObject({ ui: "2", stored: "2" });
  });
});

test.describe("2.0 preferences on the default UI", () => {
  test("wallpaper, transparency and motion chosen without ?ui=2 survive a reload", async ({ page }) => {
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

test.describe("main flows on the default UI", () => {
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

test.describe("v2.4 is still all there", () => {
  test("its wallpapers and pages are still served", async ({ request }) => {
    for (const f of ["/images/wallpaper-komezuka.jpg", "/images/wallpaper-komezuka-sm.jpg", "/classic/", "/os/", "/apps/trace.js"]) {
      expect((await request.get(f)).status(), f).toBe(200);
    }
  });
});

// Guard for the test setup itself: the v24 project must really test v2.4 now that the site's default is 2.0.
test.describe("test setup", () => {
  test.use({ tankUi: "1" });
  test("a visitor who chose v2.4 (the v24 project's setup) gets v2.4 on the plain address", async ({ page }) => {
    await boot(page);
    expect(await state(page)).toMatchObject({ ui: "1", stored: "1" });
    await expect(page.locator("#btnLaunch")).toBeHidden();
  });
});
