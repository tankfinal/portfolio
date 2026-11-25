// Layout: the desktop grid (v3.0.0) at the sizes the paging spec targets, in Chinese and English, and the Dock on
// every phone and tablet width.
//
// The desktop is one grid between the menu bar and the page dots above the Dock: at most 6 columns on a computer,
// centred; 4 on phones (768px and under). Items in order: the long-weekend widget (2×2, hidden below 2 rows or
// columns), then the projects and games. Full pages continue to the right. The page counts below are measured on
// this layout; adding an app or changing the cell size changes them on purpose.
//
// If a layout bug is found, record it as a test.fail() test that asserts the correct layout, plus a "reproduces"
// twin that asserts the bug as measured, so the expected failure cannot pass for an unrelated reason.
const { test, expect, boot, win, box } = require("../support/fixtures");

const ORDER = ["wgHol", "fukuoka", "busan", "yangmingshan", "wordtrailer", "pockettrip", "averlyn", "dayday",
  "blocks", "trace", "shachiku", "nightmarket"];

// [width, height, phone, columns, rows, pages]
const SIZES = [
  [1440, 900, 0, 6, 6, 1],
  [1366, 657, 0, 6, 4, 1],
  [1024, 768, 0, 6, 5, 1],
  [768, 1024, 1, 4, 7, 1],
  [390, 844, 1, 4, 5, 1],
  [667, 375, 1, 4, 1, 3],   // phone on its side: one row, so no widget
  [320, 568, 1, 4, 3, 2]
];

async function grid(page){
  return page.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; };
    const list = document.getElementById("deskIcons");
    const W = document.getElementById("desktop").clientWidth;
    const cur = Math.max(0, [...document.querySelectorAll("#pager .pg")].findIndex((d) => d.getAttribute("aria-current") === "true"));
    const cells = [...list.children].filter((c) => !c.hidden).map((c) => {
      const p = +c.dataset.page;
      const r = rect(c);
      // Where the cell sits on its own page: pages lie side by side, one desktop width apart.
      const shift = (p - cur) * W;
      const item = c.querySelector(".dicon, .wg");
      const lbl = c.querySelector(".lbl");
      return {
        id: item.dataset.open || item.id, page: p, wg: item.id === "wgHol",
        x: r.x - shift, y: r.y, right: r.right - shift, bottom: r.bottom, w: r.w, h: r.h,
        lbl: lbl ? (() => { const l = rect(lbl); return { inside: l.x >= r.x - 0.5 && l.right <= r.right + 0.5 && l.bottom <= r.bottom + 0.5, clipped: lbl.scrollHeight > lbl.clientHeight + 1 }; })() : null
      };
    });
    return {
      vw: innerWidth, vh: innerHeight, scrollW: document.documentElement.scrollWidth,
      cols: +list.dataset.cols, rows: +list.dataset.rows, pages: +list.dataset.pages,
      wgShown: !document.getElementById("wgHol").parentElement.hidden,
      menu: rect(document.querySelector(".menubar")), dock: rect(document.getElementById("dock")),
      pager: rect(document.getElementById("pager")), pagerHidden: document.getElementById("pager").hidden,
      dots: document.querySelectorAll("#pager .pg").length,
      cells
    };
  });
}

for (const lang of ["zh", "en"]) {
  for (const [w, h, phone, cols, rows, pages] of SIZES) {
    test.describe(`desktop grid ${w}×${h} (${lang})`, () => {
      test.use({ viewport: { width: w, height: h }, isMobile: !!phone, hasTouch: !!phone });
      test(`${cols} columns × ${rows} rows, ${pages} page${pages > 1 ? "s" : ""}; centred, clear of the menu bar, dots and Dock; labels inside their cells`, async ({ page }) => {
        await page.addInitScript((l) => { try { if (!sessionStorage.getItem("pw.lang")) { localStorage.setItem("lang", l); sessionStorage.setItem("pw.lang", "1"); } } catch (e) {} }, lang);
        await boot(page);
        const g = await grid(page);
        expect([g.cols, g.rows, g.pages]).toEqual([cols, rows, pages]);
        expect(g.cols).toBeLessThanOrEqual(phone ? 4 : 6);
        if (phone) expect(g.cols).toBe(4);
        expect(g.scrollW).toBeLessThanOrEqual(w);

        // Every item once, in order, page by page.
        const order = ORDER.filter((id) => id !== "wgHol" || g.wgShown);
        expect(g.cells.map((c) => c.id)).toEqual(order);
        const byPage = [...g.cells].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x).map((c) => c.id);
        expect(byPage).toEqual(order);
        expect(Math.max(...g.cells.map((c) => c.page)) + 1).toBe(pages);

        // The widget: first, 2×2, on page 1, or not shown at all with fewer than 2 rows or columns.
        if (rows >= 2 && cols >= 2) {
          const wg = g.cells[0];
          expect(wg.wg).toBe(true);
          expect(wg.page).toBe(0);
          const one = g.cells[1];
          expect(Math.round(wg.h)).toBeGreaterThan(Math.round(one.h) * 2 - 1);
          expect(Math.round(wg.w)).toBeGreaterThan(Math.round(one.w) * 2 - 1);
        } else {
          expect(g.wgShown).toBe(false);
        }

        // Every page: inside the screen, under the menu bar, above the dots (whose row is kept even when hidden)
        // and the Dock, centred left to right.
        const dotsTop = g.dock.y - 6 - 24;
        for (let p = 0; p < pages; p++) {
          const on = g.cells.filter((c) => c.page === p);
          for (const c of on) {
            expect(c.x, c.id).toBeGreaterThanOrEqual(0);
            expect(c.right, c.id).toBeLessThanOrEqual(w);
            expect(c.y, c.id).toBeGreaterThanOrEqual(g.menu.bottom);
            expect(c.bottom, c.id).toBeLessThanOrEqual(dotsTop);
            expect(c.lbl ? c.lbl.inside : true, c.id + " label inside its cell").toBe(true);
            expect(c.lbl ? c.lbl.clipped : false, c.id + " label fits in two lines").toBe(false);
          }
        }
        const first = g.cells.filter((c) => c.page === 0);
        const left = Math.min(...first.map((c) => c.x));
        // The widest row decides the grid width: a full page, or for one page the columns the grid has.
        const pitch = (() => { const xs = [...new Set(g.cells.filter((c) => !c.wg).map((c) => Math.round(c.x)))].sort((a, b) => a - b); return xs.length > 1 ? xs[1] - xs[0] : 0; })();
        const cellW = g.cells.find((c) => !c.wg).w;
        const gridW = (cols - 1) * pitch + cellW;
        expect(Math.abs(left - (w - gridW) / 2)).toBeLessThanOrEqual(1);

        // Dots: only with more than one page, one per page, between the grid and the Dock.
        expect(g.pagerHidden).toBe(pages < 2);
        if (pages > 1) {
          expect(g.dots).toBe(pages);
          expect(g.pager.bottom).toBeLessThanOrEqual(g.dock.y);
          expect(g.pager.y).toBeGreaterThanOrEqual(Math.max(...g.cells.map((c) => c.bottom)));
          expect(Math.abs(g.pager.x + g.pager.w / 2 - w / 2)).toBeLessThanOrEqual(1);
        }
      });
    });
  }
}

// ---------- the Dock ----------
async function measure(page){
  return page.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; };
    return {
      vw: innerWidth, vh: innerHeight,
      scrollW: document.documentElement.scrollWidth,
      dock: rect(document.getElementById("dock")),
      // Only the Dock items actually shown: the phone Dock shows only its pinned apps.
      dockIcons: [...document.querySelectorAll("#dock .dk")].filter((e) => getComputedStyle(e).display !== "none").map(rect)
    };
  });
}

// Every Dock icon fully on screen, with a small margin.
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

  test("no window opens on boot; no horizontal overflow; the Dock is fully on screen at full size", async ({ page }) => {
    await expect(page.locator("section.win")).toHaveCount(0);
    const m = await measure(page);
    expect(m.scrollW).toBeLessThanOrEqual(m.vw);
    expectDockFits(m);
    expect(m.dockIcons).toHaveLength(9);
    expect(m.dockIcons[0].w).toBe(48);   // --tank-dock-icon-size
  });
});

test.describe("1024×768 small laptop / tablet landscape", () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("windows open at the usual centred position", async ({ page }) => {
    await page.locator('#dock .dk[data-open="contact"]').click();
    const c = await box(win(page, "contact"));
    const layer = await box(page.locator("#windows"));
    const dock = await box(page.locator("#dock"));
    const L = layer.w, T = layer.h - (768 - dock.y + 8);
    const off = 0;   // first window opened: cascade step 0
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
    expect(m.dockIcons[0].w).toBe(48);
  });

  test("a tap opens an app full width above the Dock", async ({ page }) => {
    await page.locator('#desktop .dicon[data-open="blocks"]').tap();
    const b = await box(win(page, "blocks"));
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

  test("the Dock fits inside the screen: the four pinned buttons at 48px", async ({ page }) => {
    const m = await measure(page);
    expectDockFits(m);
    expect(m.dockIcons).toHaveLength(4);
    for (const ic of m.dockIcons) expect([ic.w, ic.h]).toEqual([48, 48]);
  });

  test("every Dock button still opens its app; the tools open from the launcher", async ({ page }) => {
    await page.locator("#btnLaunch").tap();
    await page.locator('#launcher .ln-app[data-open="terminal"]').tap();
    await expect(win(page, "terminal")).toHaveClass(/\bfocused\b/);
    await page.locator('#dock .dk[data-open="readme"]').tap();
    await expect(win(page, "readme")).toHaveClass(/\bfocused\b/);
    await expect(page.locator("#dock .dk.run")).toHaveCount(2);           // terminal runs too...
    await expect(page.locator("#dock .dk.run:visible")).toHaveCount(1);   // ...but is not shown in the phone Dock
  });

  test("a tap opens an app full width above the Dock; it cannot be dragged or zoomed", async ({ page }) => {
    await page.locator('#desktop .dicon[data-open="blocks"]').tap();
    const w = win(page, "blocks");
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
    await page.locator('#desktop .dicon[data-open="busan"]').tap();
    await expect(win(page, "busan")).toHaveClass(/\bnoside\b/);
  });
});

// The Dock must fit on every phone and tablet width, and on the narrowest desktop width.
for (const [w, h, m] of [[320, 568, 1], [360, 740, 1], [375, 667, 1], [390, 844, 1], [414, 896, 1], [430, 932, 1], [600, 960, 1], [768, 1024, 1], [769, 900, 0]]) {
  test.describe(`Dock fits at ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h }, isMobile: !!m, hasTouch: !!m });
    test("all Dock icons on screen, no horizontal overflow", async ({ page }) => {
      await boot(page);
      const r = await measure(page);
      expect(r.scrollW).toBeLessThanOrEqual(r.vw);
      expectDockFits(r);
    });
  });
}
