// PR-8 audit findings, one test each (see the PR for how each was found and measured). All under ?ui=2; v2.4 is
// only checked to be unchanged.
const { test, expect, boot, win } = require("../support/fixtures");

// WCAG contrast of an element's text against its real stacked background, with whatever is under the top-most
// translucent layer taken as `under` (default: white, the worst case).
function contrast(locator, under){
  return locator.evaluate((el, under) => {
    const rgba = (c) => { const m = (c.match(/[\d.]+/g) || []).map(Number); return m.length ? [m[0], m[1], m[2], m.length > 3 ? m[3] : 1] : null; };
    const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
    const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const chain = []; for (let p = el; p; p = p.parentElement) chain.unshift(p);
    let bg = under || [255, 255, 255];
    for (const p of chain) { const c = rgba(getComputedStyle(p).backgroundColor); if (c && c[3] > 0) bg = over(c, bg); }
    const fg = rgba(getComputedStyle(el).color); let op = 1; for (const p of chain) op *= +getComputedStyle(p).opacity;
    const f = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const [a, b] = [lum(f), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  }, under);
}
const inert = (page) => page.evaluate(() => [".menubar", "#desktop", "#windows", "#dock"].map((s) => document.querySelector(s).hasAttribute("inert")));

test.describe("P2-1 Spotlight is a real modal under ?ui=2", () => {
  test.beforeEach(async ({ page }) => { await boot(page, { path: "/?ui=2" }); });

  test("background inert while open, and only then", async ({ page }) => {
    expect(await inert(page)).toEqual([false, false, false, false]);
    await page.locator("#btnSpot").click();
    expect(await inert(page)).toEqual([true, true, true, true]);
    await page.keyboard.press("Escape");
    expect(await inert(page)).toEqual([false, false, false, false]);
  });

  test("Tab and Shift+Tab stay in the search field", async ({ page }) => {
    await page.keyboard.press("Control+k");
    for (const k of ["Tab", "Tab", "Shift+Tab", "Tab"]) {
      await page.keyboard.press(k);
      await expect(page.locator("#spIn")).toBeFocused();
    }
  });

  test("Esc and a click outside return focus to where it was", async ({ page }) => {
    await page.locator("#btnSpot").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#spIn")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#btnSpot")).toBeFocused();
    await page.locator('#dock .dk[data-open="terminal"]').focus();
    await page.keyboard.press("Control+k");
    await page.mouse.click(20, 400);                         // the backdrop
    await expect(page.locator("#spot")).toBeHidden();
    await expect(page.locator('#dock .dk[data-open="terminal"]')).toBeFocused();
  });

  test("picking an app hands focus to its window; a non-app action returns it", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.locator("#spIn").fill("計算機");
    await page.keyboard.press("Enter");
    const calc = win(page, "calc");
    await expect(calc).toHaveClass(/\bfocused\b/);
    expect(await calc.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))).toBe(true);
    expect(await inert(page)).toEqual([false, false, false, false]);
  });

  test("opened from inside the launcher, closing it falls back to the Spotlight button", async ({ page }) => {
    await page.locator("#btnLaunch").click();
    await page.keyboard.press("Control+k");
    await page.keyboard.press("Escape");
    await expect(page.locator("#btnSpot")).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  });
});

test.describe("P2-1 v2.4 Spotlight keeps its original behaviour", () => {
  test("?ui=1: no inert background (unchanged)", async ({ page }) => {
    await boot(page, { path: "/?ui=1" });
    await page.keyboard.press("Control+k");
    await expect(page.locator("#spot")).toBeVisible();
    expect(await inert(page)).toEqual([false, false, false, false]);
  });
});

test.describe("P2-2 the sidebar's primary button", () => {
  test("?ui=2: violet with dark text, at least 4.5:1 (was white on light red, 3.08:1)", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    await page.locator('#dock .dk[data-open="fukuoka"]').click();
    const b = win(page, "fukuoka").locator(".links a.primary");
    await expect(b).toHaveCSS("background-color", "rgb(139, 124, 255)");
    expect(await contrast(b)).toBeGreaterThanOrEqual(4.5);
  });

  test("?ui=1: still white on brand red", async ({ page }) => {
    await boot(page, { path: "/?ui=1" });
    await page.locator('#dock .dk[data-open="fukuoka"]').click();
    await expect(win(page, "fukuoka").locator(".links a.primary")).toHaveCSS("background-color", "rgb(214, 40, 40)");
  });
});

test.describe("P2-3 the long-weekend widget", () => {
  for (const wall of ["pixelverse", "komezuka"]) {
    test(`?ui=2 (${wall}): Nocturne glass; every line at least 4.5:1 even with white behind the glass`, async ({ page }) => {
      await page.addInitScript((w) => { try { localStorage.setItem("ui2.wallpaper", w); } catch (e) {} }, wall);
      await boot(page, { path: "/?ui=2" });
      const wg = page.locator("#wgHol");
      await expect(wg).toHaveCSS("background-color", "rgba(21, 29, 61, 0.88)");
      for (const sel of [".wg-k", ".wg-n", ".wg-name", ".wg-name small", ".wg-when"]) {
        expect(await contrast(wg.locator(sel).first()), sel).toBeGreaterThanOrEqual(4.5);
      }
      await page.locator("#wgHol").click();                  // still opens the calendar
      await expect(win(page, "calendar")).toHaveClass(/\bfocused\b/);
    });
  }
});

test.describe("P2-4 phone icon grid", () => {
  for (const [w, h] of [[320, 568], [360, 740], [390, 844]]) {
    test.describe(`${w}×${h}`, () => {
      test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      test("?ui=2: every icon fully on screen, labels inside their own column, none overlapping", async ({ page }) => {
        await boot(page, { path: "/?ui=2" });
        const r = await page.evaluate(() => {
          const icons = [...document.querySelectorAll(".desktop .dicon")].filter((e) => e.getClientRects().length);
          const out = { cut: [], overlaps: [], wider: [] };
          for (const i of icons) {
            const b = i.getBoundingClientRect(), l = i.querySelector(".lbl").getBoundingClientRect();
            if (b.left < 0 || b.right > innerWidth) out.cut.push(i.dataset.open);
            // A label never sticks out of its own column ("陽明山慶生旅遊" at 320 did by ~4px each side).
            const col = i.parentElement.getBoundingClientRect();
            if (l.left < col.left - 0.5 || l.right > col.right + 0.5) out.wider.push(i.dataset.open);
          }
          const labels = icons.map((i) => ({ id: i.dataset.open, r: i.querySelector(".lbl").getBoundingClientRect() }));
          for (let a = 0; a < labels.length; a++) for (let b = a + 1; b < labels.length; b++) {
            const x = labels[a].r, y = labels[b].r;
            if (x.left < y.right - 0.5 && y.left < x.right - 0.5 && x.top < y.bottom - 0.5 && y.top < x.bottom - 0.5) out.overlaps.push(labels[a].id + "/" + labels[b].id);
          }
          return out;
        });
        expect(r).toEqual({ cut: [], overlaps: [], wider: [] });
      });
    });
  }
});

test.describe("P2-5 calendar reds", () => {
  test("?ui=2: weekends and holidays use the text red, at least 4.5:1 on the window surfaces", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    await page.locator("#btnLaunch").click();
    await page.locator('#launcher .ln-app[data-open="calendar"]').click();
    const off = win(page, "calendar").locator(".cal-day.off:not(.today) span").first();
    await expect(off).toHaveCSS("color", "rgb(255, 90, 78)");
    for (const under of [[17, 26, 51], [11, 16, 32]]) {           // focused glass over the dark art / the plain surface
      expect(await contrast(off, under)).toBeGreaterThanOrEqual(4.5);
    }
    // Today keeps the filled brand-red circle with white text.
    await expect(win(page, "calendar").locator(".cal-day.today span")).toHaveCSS("background-color", "rgb(214, 40, 40)");
  });
});

test.describe("P3-1 menu bar at 320px", () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  test("?ui=2: the app name is not cut off and nothing leaves the screen", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    const m = await page.evaluate(() => {
      const a = document.getElementById("mbApp");
      return { cut: a.scrollWidth > a.clientWidth, right: document.querySelector(".menubar .mb-r").getBoundingClientRect().right };
    });
    expect(m.cut).toBe(false);
    expect(m.right).toBeLessThanOrEqual(320);
  });
});

test.describe("P3-2 one set of hover / pressed states", () => {
  test("?ui=2: title-bar buttons hover like the rest; launcher items show a pressed state", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    await page.locator('#dock .dk[data-open="fukuoka"]').click();
    const side = win(page, "fukuoka").locator('[data-act="side"]');
    await side.hover();
    await expect(side).toHaveCSS("background-color", "rgba(255, 255, 255, 0.1)");
    await page.locator("#btnLaunch").click();
    const item = page.locator('#launcher .ln-app[data-open="calc"]');
    const b = await item.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(item).toHaveCSS("background-color", "rgba(139, 124, 255, 0.34)");
    await page.mouse.up();
  });
});

test.describe("performance guards", () => {
  test("?ui=2: opening and closing the launcher, Spotlight and Settings 15 times adds no event listeners", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const listeners = async () => { await cdp.send("HeapProfiler.collectGarbage"); const { metrics } = await cdp.send("Performance.getMetrics"); return metrics.find((m) => m.name === "JSEventListeners").value; };
    // Warm up once (the launcher builds its list on first open).
    await page.locator("#btnLaunch").click(); await page.keyboard.press("Escape");
    const before = await listeners();
    for (let i = 0; i < 15; i++) {
      await page.locator("#btnLaunch").click(); await page.keyboard.press("Escape");
      await page.keyboard.press("Control+k"); await page.keyboard.press("Escape");
      await page.locator('#dock .dk[data-open="settings"]').click(); await win(page, "settings").locator(".tl-close").click();
    }
    expect(await listeners()).toBe(before);
  });

  test("?ui=2: no layout shift on load, and only the WebP wallpaper is fetched", async ({ page }) => {
    const seen = [];
    page.on("request", (q) => { const m = q.url().match(/images\/(wallpaper[^?]+)/); if (m) seen.push(m[1]); });
    await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: "layout-shift", buffered: true }); });
    await boot(page, { path: "/?ui=2" });
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.01);
    expect(seen).toEqual(["wallpaper-pixelverse-lakeside-night.webp"]);
  });
});
