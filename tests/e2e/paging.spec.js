// Desktop pages (v3.0.0): every way to flip, what must not happen while flipping, focus, resizing, reduced motion
// and modals. Page counts at the target sizes are in layout.spec.js; these tests use sizes measured to have more
// than one page:
//   1024×400 desktop: 6 columns × 2 rows, 2 pages (the widget and 8 apps, then 3)
//   320×568 phone:    4 columns × 3 rows, 2 pages (the widget and 8 apps, then 3)
//   667×375 phone on its side: 4 columns × 1 row, 3 pages (no widget: 4, 4, 3 apps)
const { test, expect, boot, win, openFromDesktop, emptyDesktopPoint } = require("../support/fixtures");

// The page on screen (0-based), from the dots, after checking the track really shows it.
async function current(page){
  return page.evaluate(() => {
    const dots = [...document.querySelectorAll("#pager .pg")];
    const i = Math.max(0, dots.findIndex((d) => d.getAttribute("aria-current") === "true"));
    const list = document.getElementById("deskIcons");
    const shown = [...list.children].filter((c) => !c.hidden && +c.dataset.page === i);
    const W = document.getElementById("desktop").clientWidth;
    // Every cell of that page lies inside the screen once any animation is done.
    const inside = shown.every((c) => { const r = c.getBoundingClientRect(); return r.left >= -0.5 && r.right <= W + 0.5; });
    return inside ? i : "page " + i + " not on screen";
  });
}
const pageOf = (page, id) => page.locator(`#desktop .dicon[data-open="${id}"]`).evaluate((b) => +b.closest("li").dataset.page);

// A real touch swipe (CDP), dx pixels sideways from (x, y). pause: ms between moves (slow drags are not flicks).
async function swipe(page, x, y, dx, opts){
  opts = Object.assign({ steps: 10, pause: 0 }, opts);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= opts.steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * i / opts.steps, y }] });
    if (opts.pause) await page.waitForTimeout(opts.pause);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

async function iconCentre(page, id){
  const b = await page.locator(`#desktop .dicon[data-open="${id}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test.describe("phone 320×568: touch", () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("two pages, two dots; a swipe left goes to page 2 and right comes back; nothing opens", async ({ page }) => {
    await expect(page.locator("#pager .pg")).toHaveCount(2);
    expect(await current(page)).toBe(0);
    const p = await iconCentre(page, "busan");                 // the swipe starts on an icon
    await swipe(page, p.x, p.y, -160);
    await expect.poll(() => current(page)).toBe(1);
    await expect(page.locator("#pageLive")).toHaveText("第 2 頁");
    const q = await iconCentre(page, "trace");
    await swipe(page, q.x, q.y, 160);
    await expect.poll(() => current(page)).toBe(0);
    await expect(page.locator("section.win")).toHaveCount(0);
  });

  test("a short, slow drag springs back; past the first page it only stretches", async ({ page }) => {
    const p = await iconCentre(page, "busan");
    await swipe(page, p.x, p.y, -30, { steps: 10, pause: 25 });
    expect(await current(page)).toBe(0);
    await swipe(page, p.x, p.y, 200);                           // right on page 1: nowhere to go
    expect(await current(page)).toBe(0);
    await expect(page.locator("section.win")).toHaveCount(0);
  });

  test("a quick flick under 40px still flips", async ({ page }) => {
    // CDP touch events arrive about 30ms apart, too slow for a flick, so this one is touch PointerEvents sent 5ms
    // apart: 30px in 15ms.
    const p = await iconCentre(page, "busan");
    await page.evaluate(async ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      const send = (type, dx) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: "touch", isPrimary: true, button: type === "pointermove" ? -1 : 0, clientX: x + dx, clientY: y, bubbles: true, cancelable: true }));
      const wait = () => new Promise((r) => setTimeout(r, 5));
      send("pointerdown", 0);
      for (const dx of [-10, -20, -30]) { await wait(); send("pointermove", dx); }
      send("pointerup", -30);
    }, p);
    await expect.poll(() => current(page)).toBe(1);
    await expect(page.locator("section.win")).toHaveCount(0);
  });

  test("the page follows the finger during the swipe", async ({ page }) => {
    const p = await iconCentre(page, "busan");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
    for (let i = 1; i <= 5; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p.x - i * 20, y: p.y }] });
    // Pointer moves are delivered once per frame, so wait for the last one.
    await expect.poll(() => page.locator("#deskIcons").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)).toBe(-100);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => current(page)).toBe(1);
  });

  test("a tap still opens the icon, on either page", async ({ page }) => {
    await page.locator('#desktop .dicon[data-open="busan"]').tap();
    await expect(win(page, "busan")).toHaveClass(/\bfocused\b/);
    await win(page, "busan").locator(".tl-close").tap();
    await page.locator("#pager .pg").nth(1).tap();
    await page.locator('#desktop .dicon[data-open="nightmarket"]').tap();
    await expect(win(page, "nightmarket")).toHaveClass(/\bfocused\b/);
  });
});

test.describe("phone on its side 667×375", () => {
  test.use({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true });
  test("three pages of one row, no widget; swipes walk through them and stop at the last", async ({ page }) => {
    await boot(page);
    await expect(page.locator("#pager .pg")).toHaveCount(3);
    await expect(page.locator(".wg-cell")).toBeHidden();
    for (const want of [1, 2, 2]) {
      await swipe(page, 400, 120, -200);
      await expect.poll(() => current(page)).toBe(want);
    }
  });
});

test.describe("desktop 1024×400", () => {
  test.use({ viewport: { width: 1024, height: 400 } });
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("two pages: the widget and 8 apps, then 3", async ({ page }) => {
    const ids = await page.locator("#deskIcons > li:not([hidden])").evaluateAll((els) => els.map((e) => [e.querySelector("[data-open], .wg").dataset.open || "widget", +e.dataset.page]));
    expect(ids).toEqual([["widget", 0], ["fukuoka", 0], ["busan", 0], ["yangmingshan", 0], ["wordtrailer", 0], ["pockettrip", 0],
      ["averlyn", 0], ["dayday", 0], ["blocks", 0], ["trace", 1], ["shachiku", 1], ["nightmarket", 1]]);
  });

  test("trackpad: a horizontal scroll flips one page, then waits for the gesture to end", async ({ page }) => {
    const p = await emptyDesktopPoint(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(80, 0);
    await expect.poll(() => current(page)).toBe(1);
    await page.mouse.wheel(-80, 0);                            // momentum of the same gesture: ignored
    expect(await current(page)).toBe(0 + 1);
    await page.waitForTimeout(300);                            // 200ms quiet ends the gesture
    await page.mouse.wheel(-30, 0);
    expect(await current(page)).toBe(1);                       // under 50px: not yet
    await page.mouse.wheel(-30, 0);
    await expect.poll(() => current(page)).toBe(0);
  });

  test("trackpad: pinch-zoom (ctrlKey) and vertical scrolling do not flip", async ({ page }) => {
    await page.evaluate(() => document.getElementById("desktop").dispatchEvent(new WheelEvent("wheel", { deltaX: 200, ctrlKey: true, bubbles: true })));
    const p = await emptyDesktopPoint(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(50);
    expect(await current(page)).toBe(0);
  });

  test("mouse: dragging empty desktop flips; a drag that starts on an icon does not", async ({ page }) => {
    const p = await emptyDesktopPoint(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x - 150, p.y, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => current(page)).toBe(1);
    await expect(page.locator("section.win")).toHaveCount(0);
    const q = await iconCentre(page, "trace");
    await page.mouse.move(q.x, q.y);
    await page.mouse.down();
    await page.mouse.move(q.x + 200, q.y, { steps: 6 });
    await page.mouse.up();
    expect(await current(page)).toBe(1);
    await expect(page.locator("section.win")).toHaveCount(0);
  });

  test("dots: a click jumps to its page; labels and aria-current follow; announced", async ({ page }) => {
    const dots = page.locator("#pager .pg");
    await expect(dots).toHaveCount(2);
    await expect(dots.nth(0)).toHaveAttribute("aria-label", "第 1 頁，共 2 頁");
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
    await dots.nth(1).click();
    expect(await current(page)).toBe(1);
    await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
    await expect(dots.nth(0)).not.toHaveAttribute("aria-current", /.*/);
    await expect(page.locator("#pageLive")).toHaveText("第 2 頁");
    await page.locator("#btnEn").click();
    await expect(dots.nth(1)).toHaveAttribute("aria-label", "Page 2 of 2");
    await expect(page.locator("#deskIcons")).toHaveAttribute("aria-label", "Desktop apps");
  });

  test("← → flip while the desktop has focus, and not while a window is in front", async ({ page }) => {
    await page.keyboard.press("ArrowRight");
    expect(await current(page)).toBe(1);
    await page.keyboard.press("ArrowRight");                   // no page 3
    expect(await current(page)).toBe(1);
    await page.keyboard.press("ArrowLeft");
    expect(await current(page)).toBe(0);
    // Focus on an icon: it moves to the first icon of the new page.
    await page.locator('#desktop .dicon[data-open="busan"]').focus();
    await page.keyboard.press("ArrowRight");
    expect(await current(page)).toBe(1);
    await expect(page.locator('#desktop .dicon[data-open="trace"]')).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    expect(await current(page)).toBe(0);
    await expect(page.locator("#wgHol")).toBeFocused();                                  // the widget starts page 1
    // A window in front keeps the arrows.
    await page.locator('#dock .dk[data-open="calc"]').click();
    await page.keyboard.press("ArrowRight");
    expect(await current(page)).toBe(0);
  });

  test("focus on an icon of another page flips to it (Tab, and Shift+Tab back from the Dock)", async ({ page }) => {
    expect(await pageOf(page, "trace")).toBe(1);
    await page.locator('#desktop .dicon[data-open="blocks"]').focus();
    await page.keyboard.press("Tab");
    await expect(page.locator('#desktop .dicon[data-open="trace"]')).toBeFocused();
    await expect.poll(() => current(page)).toBe(1);
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => current(page)).toBe(0);
    // Tab order: icons, then the dots, then the Dock. Back from the Dock: the dots, then the last icon.
    await page.locator('#dock .dk[data-open="readme"]').focus();
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("#pager .pg").nth(1)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("#pager .pg").nth(0)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator('#desktop .dicon[data-open="nightmarket"]')).toBeFocused();
    await expect.poll(() => current(page)).toBe(1);
    // The browser did not scroll anything to reach it: the track's transform alone shows the page.
    expect(await page.evaluate(() => [document.getElementById("desktop").scrollLeft, document.scrollingElement.scrollLeft])).toEqual([0, 0]);
  });

  test("opening an app on page 2 from Spotlight or the launcher does not flip", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.locator("#spIn").fill("今晚出攤");
    await page.keyboard.press("Enter");
    await expect(win(page, "nightmarket")).toHaveClass(/\bfocused\b/);
    expect(await current(page)).toBe(0);
    await page.locator("#btnLaunch").click();
    await page.locator('#launcher .ln-app[data-open="trace"]').click();
    await expect(win(page, "trace")).toHaveClass(/\bfocused\b/);
    expect(await current(page)).toBe(0);
  });

  test("a minimized app on page 2 comes back with one click on its icon", async ({ page }) => {
    const w = await openFromDesktop(page, "shachiku");
    expect(await current(page)).toBe(1);
    await w.locator(".tl-min").click();
    await expect(w).toHaveClass(/\bminimized\b/);
    await page.locator('#desktop .dicon[data-open="shachiku"]').click();
    await expect(w).not.toHaveClass(/\bminimized\b/);
    await expect(w).toHaveClass(/\bfocused\b/);
  });

  test("a reload starts on page 1 again", async ({ page }) => {
    await page.locator("#pager .pg").nth(1).click();
    expect(await current(page)).toBe(1);
    await boot(page);
    expect(await current(page)).toBe(0);
  });

  test("the App Launcher and Spotlight make the dots unreachable: no Tab, no click", async ({ page }) => {
    const dot = page.locator("#pager .pg").nth(1);
    const b = await dot.boundingBox();
    const hit = () => page.evaluate(([x, y]) => document.elementFromPoint(x, y).closest(".pg") !== null, [b.x + b.width / 2, b.y + b.height / 2]);
    expect(await hit()).toBe(true);
    for (const open of [async () => page.locator("#btnLaunch").click(), async () => page.keyboard.press("Control+k")]) {
      await open();
      expect(await page.evaluate(() => document.getElementById("desktop").hasAttribute("inert"))).toBe(true);
      expect(await hit()).toBe(false);
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => !!document.activeElement.closest("#pager"))).toBe(false);
      }
      await page.keyboard.press("Escape");
    }
    expect(await current(page)).toBe(0);
  });
});

test.describe("resizing", () => {
  test.use({ viewport: { width: 1024, height: 400 } });

  test("the page that holds the first item of the current page stays on screen", async ({ page }) => {
    await boot(page);
    await page.locator("#pager .pg").nth(1).click();          // page 2 starts with Request 的一生 (trace)
    // Taller: everything fits on one page, which now holds trace.
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator("#pager")).toBeHidden();
    expect(await current(page)).toBe(0);
    // Very short: one row of 6, no widget. Pages: fukuoka…averlyn, dayday…nightmarket.
    await page.setViewportSize({ width: 1024, height: 330 });
    await expect(page.locator("#pager .pg")).toHaveCount(2);
    await page.locator("#pager .pg").nth(1).click();              // page 2 starts with DayDay
    expect(await pageOf(page, "dayday")).toBe(1);
    await page.setViewportSize({ width: 1024, height: 400 });    // back: DayDay is on page 1 here
    await expect.poll(() => current(page)).toBe(0);
    expect(await pageOf(page, "dayday")).toBe(0);
    await page.locator("#pager .pg").nth(1).click();              // page 2 starts with trace…
    await page.setViewportSize({ width: 1024, height: 330 });    // …which is on page 2 of the short grid too
    await expect.poll(() => pageOf(page, "trace")).toBe(1);
    expect(await current(page)).toBe(1);
  });

  test("with focus in a text field, a height-only change (a phone keyboard) keeps the grid", async ({ page }) => {
    await boot(page);
    await page.keyboard.press("Control+k");
    await expect(page.locator("#spIn")).toBeFocused();
    const before = await page.locator("#deskIcons").evaluate((el) => el.dataset.rows);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(100);                             // resize events are async
    expect(await page.locator("#deskIcons").evaluate((el) => el.dataset.rows)).toBe(before);
    await page.setViewportSize({ width: 1000, height: 768 });    // the width changed: recomputed
    await expect.poll(() => page.locator("#deskIcons").evaluate((el) => el.dataset.rows)).toBe("5");
  });
});

test.describe("reduced motion", () => {
  test.use({ viewport: { width: 1024, height: 400 } });

  test("on (the test default): dots and keys flip at once, with no transition", async ({ page }) => {
    await boot(page);
    await page.locator("#pager .pg").nth(1).click();
    const s = await page.locator("#deskIcons").evaluate((el) => ({ anim: el.classList.contains("anim"), x: new DOMMatrix(getComputedStyle(el).transform).m41, w: document.getElementById("desktop").clientWidth }));
    expect(s.anim).toBe(false);
    expect(s.x).toBe(-s.w);
  });

  test.describe("off", () => {
    test.use({ reducedMotion: "no-preference" });
    test("dots slide the track over (a transform transition)", async ({ page }) => {
      await boot(page);
      await page.locator("#pager .pg").nth(1).click();
      const s = await page.locator("#deskIcons").evaluate((el) => ({ anim: el.classList.contains("anim"), prop: getComputedStyle(el).transitionProperty }));
      expect(s).toEqual({ anim: true, prop: "transform" });
      await expect.poll(() => current(page)).toBe(1);
    });

    test("Settings › reduced motion makes it instant again", async ({ page }) => {
      await page.addInitScript(() => { try { localStorage.setItem("ui2.motion", "reduced"); } catch (e) {} });
      await boot(page);
      await page.keyboard.press("ArrowRight");
      expect(await page.locator("#deskIcons").evaluate((el) => el.classList.contains("anim"))).toBe(false);
      expect(await current(page)).toBe(1);
    });
  });
});
