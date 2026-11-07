// TankOS 2.0 Settings app (PR-7): wallpaper, transparency, motion, and the way back to v2.4. Only under ?ui=2.
// Preferences live in localStorage (ui2.wallpaper / ui2.transparency / ui2.motion) and become attributes on <html>
// (data-wall / data-transparency / data-motion) that only ever exist under ?ui=2.
// Note: playwright.config.js runs with prefers-reduced-motion: reduce, so the *system* default for motion here is
// "reduced" unless a test says otherwise.
const { test, expect, boot, win, openFromDesktop } = require("../support/fixtures");

const GLASS = "rgba(21, 29, 61, 0.88)";
const SURFACE = "rgb(17, 26, 51)";

function attrs(page){
  return page.evaluate(() => {
    const r = document.documentElement;
    return { ui: r.getAttribute("data-ui"), wall: r.getAttribute("data-wall"), tr: r.getAttribute("data-transparency"), mo: r.getAttribute("data-motion") };
  });
}
function saved(page){
  return page.evaluate(() => ({ wall: localStorage.getItem("ui2.wallpaper"), tr: localStorage.getItem("ui2.transparency"), mo: localStorage.getItem("ui2.motion") }));
}
function checked(page){
  return page.evaluate(() => {
    const v = (n) => (document.querySelector(`input[name="st-${n}"]:checked`) || {}).value || null;
    return { wall: v("wallpaper"), tr: v("transparency"), mo: v("motion") };
  });
}
async function openSettings(page){
  await page.locator('#dock .dk[data-open="settings"]').click();
  const w = win(page, "settings");
  await expect(w).toHaveClass(/\bfocused\b/);
  return w;
}
function wallImage(page){
  return page.evaluate(() => getComputedStyle(document.querySelector(".wall")).backgroundImage);
}
function wallpapers(page){
  const seen = [];
  page.on("request", (r) => { const m = r.url().match(/images\/(wallpaper-[^?]+)/); if (m) seen.push(m[1]); });
  return seen;
}

test.describe("?ui=1: v2.4 is untouched", () => {
  test("no Settings anywhere, and saved 2.0 preferences change nothing", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("ui2.wallpaper", "komezuka");
      localStorage.setItem("ui2.transparency", "reduced");
      localStorage.setItem("ui2.motion", "normal");
    });
    await boot(page, { path: "/?ui=1" });
    expect(await attrs(page)).toEqual({ ui: null, wall: null, tr: null, mo: null });
    await expect(page.locator('.desktop .dicon[data-open="settings"]')).toBeHidden();
    await expect(page.locator('#dock .dk[data-open="settings"]')).toBeHidden();
    await page.keyboard.press("Control+k");
    await page.locator("#spIn").fill("設定");
    await expect(page.locator("#spList li", { hasText: /^設定/ })).toHaveCount(0);
    // v2.4's own wallpaper with its white wash, as before.
    expect(await wallImage(page)).toContain("rgba(255, 255, 255, 0.3)");
  });
});

test.describe("?ui=2 Settings: where it lives", () => {
  test.beforeEach(async ({ page }) => { await boot(page, { path: "/?ui=2" }); });

  test("desktop icon (Utilities), Dock button, Spotlight and the launcher all open the same window", async ({ page }) => {
    await expect(page.locator('.zone-tools .dicon[data-open="settings"]')).toBeVisible();
    const w = await openFromDesktop(page, "settings");
    await expect(w.locator(".title-t")).toHaveText("設定");
    await expect(w.locator(".bar-ic .ic-settings")).toHaveCount(1);       // PR-4 title-bar icon, from iconOf()
    await w.locator(".tl-close").click();

    await page.locator('#dock .dk[data-open="settings"]').click();
    await expect(win(page, "settings")).toHaveClass(/\bfocused\b/);
    await expect(page.locator('#dock .dk[data-open="settings"]')).toHaveClass(/\brun\b/);
    await win(page, "settings").locator(".tl-close").click();

    await page.keyboard.press("Control+k");
    await page.locator("#spIn").fill("wallpaper");
    await expect(page.locator("#spList li").first()).toContainText("設定");
    await page.keyboard.press("Enter");
    await expect(win(page, "settings")).toHaveClass(/\bfocused\b/);
    await win(page, "settings").locator(".tl-close").click();

    await page.locator("#btnLaunch").click();
    await expect(page.locator('#launcher .ln-group', { hasText: "小工具" }).locator('.ln-app[data-open="settings"]')).toHaveCount(1);
    await page.locator('#launcher .ln-app[data-open="settings"]').click();
    const s = win(page, "settings");
    await expect(s).toHaveClass(/\bfocused\b/);
    expect(await s.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))).toBe(true);
  });

  test("Chinese / English", async ({ page }) => {
    const w = await openSettings(page);
    await page.locator("#btnEn").click();
    await expect(w.locator(".title-t")).toHaveText("Settings");
    await expect(w.locator("legend").first()).toHaveText("Wallpaper");
    await expect(w.locator('[data-act="v1"]')).toHaveText("Switch back to v2.4");
  });
});

test.describe("?ui=2 Settings: first use follows the system", () => {
  test("nothing saved: Pixelverse, normal transparency, reduced motion (the system here), marked as following the system", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    expect(await attrs(page)).toEqual({ ui: "2", wall: "pixelverse", tr: "normal", mo: "reduced" });
    const w = await openSettings(page);
    expect(await checked(page)).toEqual({ wall: "pixelverse", tr: "normal", mo: "reduced" });
    await expect(w.locator('.st-sys[data-pref="transparency"]')).toBeVisible();
    await expect(w.locator('.st-sys[data-pref="motion"]')).toBeVisible();
    expect(await saved(page)).toEqual({ wall: null, tr: null, mo: null });
  });

  test("invalid saved values are ignored", async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("ui2.motion", "banana"); localStorage.setItem("ui2.wallpaper", "../x"); });
    await boot(page, { path: "/?ui=2" });
    expect(await attrs(page)).toMatchObject({ wall: "pixelverse", mo: "reduced" });
  });
});

test.describe("?ui=2 Settings: changes apply at once and survive a reload", () => {
  test("wallpaper: desktop and lock screen switch together; only the chosen picture is downloaded after reload", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    const w = await openSettings(page);
    await w.locator('input[name="st-wallpaper"][value="komezuka"]').check();
    expect((await attrs(page)).wall).toBe("komezuka");
    expect(await wallImage(page)).toContain("wallpaper-komezuka.jpg");
    expect(await saved(page)).toMatchObject({ wall: "komezuka" });

    const seen = wallpapers(page);
    await boot(page, { path: "/?ui=2", locked: true });
    expect((await attrs(page)).wall).toBe("komezuka");
    expect(await page.evaluate(() => getComputedStyle(document.getElementById("lock"), "::before").backgroundImage)).toContain("wallpaper-komezuka.jpg");
    await page.keyboard.press("Space");
    expect(await wallImage(page)).toContain("wallpaper-komezuka.jpg");
    expect(seen.filter((f) => /pixelverse/.test(f))).toEqual([]);
    expect(seen).toContain("wallpaper-komezuka.jpg");

    // And back.
    const w2 = await openSettings(page);
    await w2.locator('input[name="st-wallpaper"][value="pixelverse"]').check();
    expect(await wallImage(page)).toContain("pixelverse-lakeside-night");
  });

  test("transparency: reduced makes windows, menu bar and Dock opaque; it persists", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    const w = await openSettings(page);
    await expect(w).toHaveCSS("background-color", GLASS);
    await w.locator('input[name="st-transparency"][value="reduced"]').check();
    await expect(w).toHaveCSS("background-color", SURFACE);
    await expect(page.locator(".menubar")).toHaveCSS("background-color", "rgb(11, 16, 32)");
    await expect(page.locator("#dock")).toHaveCSS("background-color", SURFACE);
    await expect(w.locator('.st-sys[data-pref="transparency"]')).toBeHidden();
    await boot(page, { path: "/?ui=2" });
    expect((await attrs(page)).tr).toBe("reduced");
    await expect(page.locator(".menubar")).toHaveCSS("background-color", "rgb(11, 16, 32)");
  });

  test("a choice of 'normal' wins over a system that asks for less transparency", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    await boot(page, { path: "/?ui=2" });
    expect((await attrs(page)).tr).toBe("reduced");                 // first use: the system
    const w = await openSettings(page);
    await w.locator('input[name="st-transparency"][value="normal"]').check();
    await expect(w).toHaveCSS("background-color", GLASS);
    await expect(page.locator(".menubar")).toHaveCSS("background-color", GLASS);
  });

  test("motion: a choice of 'normal' brings window animations back even when the system reduces motion", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });                             // system: reduce (config)
    const w = await openSettings(page);
    await expect(w).toHaveCSS("animation-name", "none");
    await w.locator('input[name="st-motion"][value="normal"]').check();
    expect((await attrs(page)).mo).toBe("normal");
    await w.locator(".tl-close").click();
    await page.locator('#dock .dk[data-open="contact"]').click();
    await expect(win(page, "contact")).toHaveCSS("animation-name", "win-in");
    await boot(page, { path: "/?ui=2" });
    expect((await attrs(page)).mo).toBe("normal");
  });
});

test.describe("?ui=2 Settings: reduced motion chosen on a system that allows motion", () => {
  test.use({ reducedMotion: "no-preference" });
  test("no window animation, no Dock magnification, no launcher animation, and JS sees it too", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    expect((await attrs(page)).mo).toBe("normal");
    await page.locator('#dock .dk[data-open="settings"]').click();
    const w = win(page, "settings");
    await w.locator('input[name="st-motion"][value="reduced"]').check();
    await page.locator('#dock .dk[data-open="contact"]').click();
    await expect(win(page, "contact")).toHaveCSS("animation-name", "none");
    await page.locator('#dock .dk[data-open="busan"]').hover();
    expect(await page.locator('#dock .dk[data-open="busan"] .ic').evaluate((e) => getComputedStyle(e).transform)).toBe("none");
    // Closing skips its animation when the motion setting is reduced (the window manager reads the same `still`).
    await win(page, "contact").locator(".tl-close").click();
    await expect(win(page, "contact")).toHaveCount(0, { timeout: 50 });
    await page.locator("#btnLaunch").click();
    await expect(page.locator("#launcher .ln-box")).toHaveCSS("animation-name", "none");
  });
});

test.describe("?ui=2 Settings: system preference changes while the page is open", () => {
  test("followed while nothing is chosen, ignored once something is", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    const w = await openSettings(page);
    expect((await attrs(page)).mo).toBe("reduced");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(async () => (await attrs(page)).mo).toBe("normal");
    expect((await checked(page)).mo).toBe("normal");                 // the open window follows
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(async () => (await attrs(page)).mo).toBe("reduced");
    // Choose, then the system changes: the choice stays.
    await w.locator('input[name="st-motion"][value="normal"]').check();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(100);
    expect((await attrs(page)).mo).toBe("normal");
  });

  test("Reset forgets every choice and goes back to the system", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    const w = await openSettings(page);
    await w.locator('input[name="st-wallpaper"][value="komezuka"]').check();
    await w.locator('input[name="st-transparency"][value="reduced"]').check();
    await w.locator('input[name="st-motion"][value="normal"]').check();
    await w.locator('[data-act="reset"]').click();
    expect(await saved(page)).toEqual({ wall: null, tr: null, mo: null });
    expect(await attrs(page)).toEqual({ ui: "2", wall: "pixelverse", tr: "normal", mo: "reduced" });
    expect(await checked(page)).toEqual({ wall: "pixelverse", tr: "normal", mo: "reduced" });
    await expect(w.locator('.st-sys[data-pref="motion"]')).toBeVisible();
  });
});

test.describe("?ui=2 Settings: storage unavailable", () => {
  test("choices still apply for this page, the window says they will not be kept, and nothing breaks", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const no = () => { throw new DOMException("blocked", "SecurityError"); };
      Storage.prototype.getItem = no; Storage.prototype.setItem = no; Storage.prototype.removeItem = no;
    });
    await page.goto("/?ui=2");
    await page.keyboard.press("Space");
    await expect(page.locator("#lock")).toHaveCount(0);
    expect(await attrs(page)).toMatchObject({ ui: "2", wall: "pixelverse", tr: "normal", mo: "reduced" });
    const w = await openSettings(page);
    await expect(w.locator(".st-mem")).toBeVisible();
    await w.locator('input[name="st-wallpaper"][value="komezuka"]').check();
    expect((await attrs(page)).wall).toBe("komezuka");
    expect((await checked(page)).wall).toBe("komezuka");
    await w.locator('[data-act="reset"]').click();
    expect((await attrs(page)).wall).toBe("pixelverse");
    await page.goto("/?ui=2");                                        // nothing could be kept
    expect((await attrs(page)).wall).toBe("pixelverse");
    expect(errors).toEqual([]);
  });
});

test.describe("?ui=2 Settings: back to v2.4", () => {
  test("the button switches to ?ui=1 and the choice sticks", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    const w = await openSettings(page);
    await Promise.all([page.waitForURL(/\?ui=1$/), w.locator('[data-act="v1"]').click()]);
    expect((await attrs(page)).ui).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("ui"))).toBe("1");
  });
});

test.describe("?ui=2 Settings: keyboard", () => {
  test("arrow keys move between options and apply them; focus is visible", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    const w = await openSettings(page);
    await w.locator('input[name="st-transparency"][value="normal"]').focus();
    await page.keyboard.press("ArrowRight");
    await expect(w.locator('input[name="st-transparency"][value="reduced"]')).toBeFocused();
    expect((await attrs(page)).tr).toBe("reduced");
    await expect(w.locator('input[name="st-transparency"][value="reduced"]')).toHaveCSS("outline-style", "solid");
  });
});

for (const [vw, vh] of [[320, 568], [390, 844]]) {
  test.describe(`?ui=2 Settings on a ${vw}px phone`, () => {
    test.use({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true });
    test("full screen, every control at least 44×44, nothing overflows, a tap changes the wallpaper", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      await page.locator("#btnLaunch").tap();
      await page.locator('#launcher .ln-app[data-open="settings"]').tap();
      const w = win(page, "settings");
      const b = await w.boundingBox();
      expect([b.x, b.width]).toEqual([0, vw]);
      const sizes = await w.locator(".st-opt, .st-btn").evaluateAll((els) => els.map((e) => [e.offsetWidth, e.offsetHeight]));
      expect(sizes.length).toBe(8);
      for (const [sw, sh] of sizes) { expect(sw).toBeGreaterThanOrEqual(44); expect(sh).toBeGreaterThanOrEqual(44); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
      await w.locator('.st-opt', { has: page.locator('input[value="komezuka"]') }).tap();
      expect((await attrs(page)).wall).toBe("komezuka");
      expect(await wallImage(page)).toContain("wallpaper-komezuka-sm.jpg");
    });
  });
}
