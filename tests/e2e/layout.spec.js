// Layout at the three widths the 2.0 plan targets: 1366 (laptop, at the short 657px height README warns about),
// 1024 (tablet / small laptop) and 390 (phone).
//
// Known bugs are recorded as strict expected failures (test.fail): each asserts the CORRECT layout, so it fails today,
// and Playwright turns it red the moment it starts passing ("expected to fail, but passed"), which forces whoever
// fixes the bug to flip it into a normal test. Each one has a "reproduces" twin that asserts the bug as measured, so
// an expected failure can never be satisfied by some unrelated breakage (a renamed selector, a timeout).
const { test, expect, boot, win, box } = require("../support/fixtures");

async function measure(page){
  return page.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; };
    const union = (els) => els.map(rect).reduce((a, r) => a ? {
      x: Math.min(a.x, r.x), y: Math.min(a.y, r.y), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom)
    } : r, null);
    const right = [...document.querySelectorAll(".zones-r .dicon")];
    const wg = document.getElementById("wgHol");
    if (wg && !wg.hidden) right.push(wg);
    return {
      vw: innerWidth, vh: innerHeight,
      scrollW: document.documentElement.scrollWidth,
      dock: rect(document.getElementById("dock")),
      left: union([...document.querySelectorAll(".zones-l .dicon")]),
      right: union(right)
    };
  });
}

function overlaps(a, b){
  return a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
}

test.describe("1366×657 laptop (short screen)", () => {
  test.use({ viewport: { width: 1366, height: 657 } });
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("icon columns stay at least 16px clear of the Dock", async ({ page }) => {
    const m = await measure(page);
    expect(m.left.bottom).toBeLessThan(m.dock.y - 16);
    expect(m.right.bottom).toBeLessThan(m.dock.y - 16);
  });

  test("no horizontal overflow; the Dock is fully on screen", async ({ page }) => {
    const m = await measure(page);
    expect(m.scrollW).toBeLessThanOrEqual(m.vw);
    expect(m.dock.x).toBeGreaterThanOrEqual(0);
    expect(m.dock.right).toBeLessThanOrEqual(m.vw);
  });

  test("the README window opens clear of both icon columns", async ({ page }) => {
    const m = await measure(page);
    const r = await box(win(page, "readme"));
    expect(overlaps(r, m.left)).toBe(false);
    expect(overlaps(r, m.right)).toBe(false);
  });
});

test.describe("1024×768 tablet / small laptop", () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("icon columns stay clear of the Dock; no horizontal overflow", async ({ page }) => {
    const m = await measure(page);
    expect(m.left.bottom).toBeLessThan(m.dock.y - 16);
    expect(m.right.bottom).toBeLessThan(m.dock.y - 16);
    expect(m.scrollW).toBeLessThanOrEqual(m.vw);
    expect(m.dock.x).toBeGreaterThanOrEqual(0);
    expect(m.dock.right).toBeLessThanOrEqual(m.vw);
  });

  test("KNOWN BUG A reproduces: the README window covers the left icon column", async ({ page }) => {
    // Measured on v2.4.0: README 680px wide at left ≈102px, left column right edge ≈206px.
    const m = await measure(page);
    const r = await box(win(page, "readme"));
    expect(r.w).toBe(680);
    expect(r.x).toBeLessThan(m.left.right);
    expect(overlaps(r, m.left)).toBe(true);
  });

  test("KNOWN BUG A (expected to fail): the README window opens clear of the icon columns", async ({ page }) => {
    test.info().annotations.push({
      type: "known-bug",
      description: "1024×768: open('readme') centres a 680px window, which covers the left icon column. " +
        "Planned fix: PR-2 (v2.4.1). When fixed, remove test.fail() and the 'reproduces' twin."
    });
    test.fail();
    const m = await measure(page);
    const r = await box(win(page, "readme"));
    expect(overlaps(r, m.left)).toBe(false);
    expect(overlaps(r, m.right)).toBe(false);
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

  test("a tap opens an app full width above the Dock; it cannot be dragged or zoomed", async ({ page }) => {
    await page.locator('.desktop .dicon[data-open="contact"]').tap();
    const w = win(page, "contact");
    await expect(w).toHaveClass(/\bfocused\b/);
    const layer = await box(page.locator("#windows"));
    const b = await box(w);
    expect(b.x).toBe(0);
    expect(b.w).toBe(layer.w);
    expect(b.y).toBe(layer.y);
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

  test("KNOWN BUG B reproduces: the Dock is wider than the screen", async ({ page }) => {
    // Measured on v2.4.0: Dock 422px wide on a 390px screen. --ds assumes ten Dock icons; there are 11 apps + classic.
    await expect(page.locator("#dock .dk")).toHaveCount(12);
    const m = await measure(page);
    expect(m.dock.w).toBeGreaterThan(m.vw);
    expect(m.dock.x).toBeLessThan(0);
  });

  test("KNOWN BUG B (expected to fail): the Dock fits inside the screen", async ({ page }) => {
    test.info().annotations.push({
      type: "known-bug",
      description: "390px: the Dock overflows both edges (≈422px wide) because --ds in the ≤768px media query " +
        "divides by ten icons. Planned fix: PR-2 (v2.4.1). When fixed, remove test.fail() and the 'reproduces' twin."
    });
    test.fail();
    const m = await measure(page);
    expect(m.dock.x).toBeGreaterThanOrEqual(0);
    expect(m.dock.right).toBeLessThanOrEqual(m.vw);
  });
});
