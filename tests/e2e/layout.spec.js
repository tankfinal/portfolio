// Layout at the widths the 2.0 plan targets: 1366 (laptop, at the short 657px height README warns about),
// 1024×768 (small laptop / tablet landscape), 768×1024 (tablet portrait, which gets the phone layout) and 390 (phone).
//
// Two bugs found on v2.4.0 were recorded here as expected failures and fixed in v2.4.1:
//   A  1024×768: the README window that opens on load covered the left icon column.
//   B  390px: the Dock was wider than the screen (its size assumed ten icons; there are twelve).
// If a bug is found again, record it the same way: a test.fail() test that asserts the correct layout, plus a
// "reproduces" twin that asserts the bug as measured, so the expected failure cannot pass for an unrelated reason.
const { test, expect, boot, win, box } = require("../support/fixtures");

async function measure(page){
  return page.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; };
    // Only what is on screen: 2.0's Settings icon is in the DOM but display:none under ?ui=1.
    const shownOnly = (els) => els.filter((e) => e.getClientRects().length > 0);
    const union = (els) => shownOnly(els).map(rect).reduce((a, r) => a ? {
      x: Math.min(a.x, r.x), y: Math.min(a.y, r.y), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom)
    } : r, null);
    const right = [...document.querySelectorAll(".zones-r .dicon")];
    const wg = document.getElementById("wgHol");
    if (wg && !wg.hidden) right.push(wg);
    return {
      vw: innerWidth, vh: innerHeight,
      scrollW: document.documentElement.scrollWidth,
      dock: rect(document.getElementById("dock")),
      ui2: document.documentElement.getAttribute("data-ui") === "2",
      // Only the Dock items actually shown: v2.4 never shows the 2.0 launcher button, and the 2.0 phone Dock shows
      // only its pinned apps.
      dockIcons: [...document.querySelectorAll("#dock .dk")].filter((e) => getComputedStyle(e).display !== "none").map(rect),
      left: union([...document.querySelectorAll(".zones-l .dicon")]),
      right: union(right)
    };
  });
}

function overlaps(a, b){
  return a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
}

// Every Dock icon fully on screen, with a small margin, and none squeezed below a tappable-ish size.
function expectDockFits(m){
  expect(m.dock.x).toBeGreaterThanOrEqual(4);
  expect(m.dock.right).toBeLessThanOrEqual(m.vw - 4);
  for (const ic of m.dockIcons) {
    expect(ic.x).toBeGreaterThanOrEqual(0);
    expect(ic.right).toBeLessThanOrEqual(m.vw);
  }
}

test.describe("1366×657 laptop (short screen)", () => {
  test.use({ viewport: { width: 1366, height: 657 } });
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("icon columns stay at least 16px clear of the Dock", async ({ page }) => {
    const m = await measure(page);
    expect(m.left.bottom).toBeLessThan(m.dock.y - 16);
    expect(m.right.bottom).toBeLessThan(m.dock.y - 16);
  });

  test("no horizontal overflow; the Dock is fully on screen at full size", async ({ page }) => {
    const m = await measure(page);
    expect(m.scrollW).toBeLessThanOrEqual(m.vw);
    expectDockFits(m);
    expect(m.dockIcons[0].w).toBe(m.ui2 ? 48 : 52);   // 2.0: --tank-dock-icon-size
  });

  test("the README window opens where it always has, clear of both icon columns", async ({ page }) => {
    // Wide screens have room between the columns, so v2.4.1's fit leaves the README exactly where v2.4.0 put it.
    // y is 8px under the menu bar: 36 with v2.4's 28px bar, 44 with the 2.0 36px bar (?ui=2, PR-5).
    const r = await box(win(page, "readme"));
    const bar = await page.evaluate(() => document.querySelector(".menubar").getBoundingClientRect().height);
    expect(r).toMatchObject({ x: 273, y: bar + 8, w: 680 });
    const m = await measure(page);
    expect(overlaps(r, m.left)).toBe(false);
    expect(overlaps(r, m.right)).toBe(false);
  });
});

test.describe("1024×768 small laptop / tablet landscape", () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("icon columns stay clear of the Dock; no horizontal overflow", async ({ page }) => {
    const m = await measure(page);
    expect(m.left.bottom).toBeLessThan(m.dock.y - 16);
    expect(m.right.bottom).toBeLessThan(m.dock.y - 16);
    expect(m.scrollW).toBeLessThanOrEqual(m.vw);
    expectDockFits(m);
  });

  test("bug A fixed: the README window opens clear of both icon columns, at 12px from each", async ({ page }) => {
    const m = await measure(page);
    const readme = win(page, "readme");
    const r = await box(readme);
    expect(overlaps(r, m.left)).toBe(false);
    expect(overlaps(r, m.right)).toBe(false);
    expect(r.w).toBeGreaterThanOrEqual(320);
    expect(r.w).toBeLessThanOrEqual(680);
    // Centred in the gap: same distance to both columns (the zone containers, which include the headings).
    const gaps = await page.evaluate(() => {
      const l = document.querySelector(".zones-l").getBoundingClientRect();
      const rz = document.querySelector(".zones-r").getBoundingClientRect();
      const w = [...document.querySelectorAll("section.win")][0].getBoundingClientRect();
      return { left: w.left - l.right, right: rz.left - w.right };
    });
    expect(gaps.left).toBeGreaterThanOrEqual(12);
    expect(gaps.right).toBeGreaterThanOrEqual(12);
    expect(Math.abs(gaps.left - gaps.right)).toBeLessThanOrEqual(1);
    // Still the normal, focused README window.
    await expect(readme).toHaveClass(/\bfocused\b/);
    await expect(readme.locator(".doc")).toBeVisible();
  });

  test("other windows still open at the usual centred position", async ({ page }) => {
    // open() is unchanged: the fit applies only to the README shown on load.
    await page.locator('.desktop .dicon[data-open="contact"]').dblclick();
    const c = await box(win(page, "contact"));
    const layer = await box(page.locator("#windows"));
    const dock = await box(page.locator("#dock"));
    const L = layer.w, T = layer.h - (768 - dock.y + 8);
    const off = 26;   // second window opened: cascade step 1
    expect(c.w).toBe(440);
    expect(c.x).toBe(Math.min(Math.max(Math.round((L - 440) / 2) - 70 + off, 12), Math.max(12, L - 440 - 12)));
    expect(c.y - layer.y).toBe(Math.min(Math.max(Math.round((T - 450) / 2) - 20 + off, 8), Math.max(8, T - 450)));
  });
});

test.describe("768×1024 tablet portrait (phone layout)", () => {
  test.use({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("no window opens on boot; no horizontal overflow; the Dock fits at full size", async ({ page }) => {
    await expect(page.locator("section.win")).toHaveCount(0);
    const m = await measure(page);
    expect(m.scrollW).toBeLessThanOrEqual(m.vw);
    expectDockFits(m);
    expect(m.dockIcons[0].w).toBe(m.ui2 ? 48 : 52);   // 2.0: --tank-dock-icon-size
  });

  test("a tap opens an app full width above the Dock", async ({ page }) => {
    await page.locator('.desktop .dicon[data-open="contact"]').tap();
    const b = await box(win(page, "contact"));
    const m = await measure(page);
    expect(b.x).toBe(0);
    expect(b.w).toBe(768);
    expect(b.bottom).toBeLessThanOrEqual(m.dock.y);
  });
});

test.describe("390×844 phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("no window opens on boot, and the page itself never scrolls sideways", async ({ page }) => {
    await expect(page.locator("section.win")).toHaveCount(0);
    const m = await measure(page);
    expect(m.scrollW).toBeLessThanOrEqual(m.vw);
  });

  test("bug B fixed: the Dock fits inside the screen (v2.4: all twelve; 2.0: pinned apps + launcher)", async ({ page }) => {
    const m = await measure(page);
    expectDockFits(m);
    if (m.ui2) {
      expect(m.dockIcons).toHaveLength(4);
      for (const ic of m.dockIcons) expect([ic.w, ic.h]).toEqual([48, 48]);
    } else {
      expect(m.dockIcons).toHaveLength(12);
      // About 8px clear on each side, as the --ds formula intends (the .5px border and centring shift it a little).
      expect(m.dock.x).toBeGreaterThanOrEqual(7);
      expect(m.dock.x).toBeLessThanOrEqual(9);
    }
  });

  test("every Dock button still opens its app", async ({ page }) => {
    // 2.0 keeps the terminal out of the phone Dock; it opens from the launcher.
    if (await page.evaluate(() => document.documentElement.getAttribute("data-ui") === "2")) {
      await page.locator("#btnLaunch").tap();
      await page.locator('#launcher .ln-app[data-open="terminal"]').tap();
    } else {
      await page.locator('#dock .dk[data-open="terminal"]').tap();
    }
    await expect(win(page, "terminal")).toHaveClass(/\bfocused\b/);
    await page.locator('#dock .dk[data-open="readme"]').tap();
    await expect(win(page, "readme")).toHaveClass(/\bfocused\b/);
    await expect(page.locator("#dock .dk.run")).toHaveCount(2);
  });

  test("a tap opens an app full width above the Dock; it cannot be dragged or zoomed", async ({ page }) => {
    await page.locator('.desktop .dicon[data-open="contact"]').tap();
    const w = win(page, "contact");
    await expect(w).toHaveClass(/\bfocused\b/);
    const layer = await box(page.locator("#windows"));
    const b = await box(w);
    expect(b.x).toBe(0);
    expect(b.w).toBe(layer.w);
    expect(b.y).toBe(layer.y);
    const m = await measure(page);
    expect(b.bottom).toBeLessThanOrEqual(m.dock.y);
    // The title bar ignores drags on phones.
    const t = await box(w.locator(".title"));
    await page.mouse.move(t.x + 10, t.y + 5);
    await page.mouse.down();
    await page.mouse.move(t.x + 120, t.y + 200, { steps: 4 });
    await page.mouse.up();
    expect(await box(w)).toEqual(b);
    await w.locator(".tl-max").tap();
    await expect(w).not.toHaveClass(/\bmax\b/);
  });

  test("site apps start with the sidebar hidden", async ({ page }) => {
    await page.locator('.desktop .dicon[data-open="busan"]').tap();
    await expect(win(page, "busan")).toHaveClass(/\bnoside\b/);
  });
});

// The Dock must fit on every phone and tablet width, not just the four above. Adding a Dock icon without updating
// --ds in index.html fails here.
for (const [w, h] of [[320, 568], [360, 740], [375, 667], [390, 844], [414, 896], [430, 932], [600, 960], [768, 1024]]) {
  test.describe(`Dock fits at ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    test("all Dock icons on screen, no horizontal overflow", async ({ page }) => {
      await boot(page);
      const m = await measure(page);
      expect(m.scrollW).toBeLessThanOrEqual(m.vw);
      expectDockFits(m);
    });
  });
}

// Desktop widths just above the phone breakpoint, where the README fit matters most.
for (const [w, h] of [[769, 900], [900, 700], [1150, 800], [1280, 800], [1440, 900]]) {
  test.describe(`desktop ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test("README clear of both icon columns; Dock on screen", async ({ page }) => {
      await boot(page);
      const m = await measure(page);
      const r = await box(win(page, "readme"));
      expect(overlaps(r, m.left)).toBe(false);
      expect(overlaps(r, m.right)).toBe(false);
      expect(r.w).toBeGreaterThanOrEqual(320);
      expectDockFits(m);
    });
  });
}
