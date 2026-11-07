// Shared setup for every TankOS test.
//
// Nothing leaves the machine:
//   - /api/* (presence, scores, trace) answers with fixed JSON, so no test touches the real D1.
//   - Every other origin (the iframed live sites, Activity Monitor probes, the GitHub API) gets a fixed stub.
// Time is fixed (Asia/Taipei, Saturday 2026-11-07 10:30), so the clock, the lock screen, the calendar icon and the
// long-weekend widget always render the same. Timers still run, so TankOS behaves normally.
const base = require("@playwright/test");
const { expect } = base;

const ORIGIN = "http://127.0.0.1:4321";
const NOW = new Date("2026-11-07T10:30:00+08:00");

const STUB_HTML = "<!doctype html><meta charset=utf-8><title>stub</title>" +
  "<body style='margin:0;background:#fff;font:14px sans-serif'><p style='padding:16px'>stub page (tests)</p></body>";

function json(route, body, status){
  return route.fulfill({ status: status || 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockApi(route){
  const req = route.request();
  const url = new URL(req.url());
  const p = url.pathname;
  if (p === "/api/presence/leave") return route.fulfill({ status: 204 });
  if (p === "/api/presence") {
    return json(route, { me: "a1b2", total: 1,
      online: [{ tag: "a1b2", city: "Taipei", country: "TW", app: "desktop", since: NOW.toISOString() }] });
  }
  if (p === "/api/scores") {
    if (req.method() === "POST") return json(route, { top: [], me: { name: "test", score: 0, rank: 1 } });
    return json(route, { top: [] });
  }
  if (p === "/api/trace") {
    return json(route, { edge: "TPE", client: { city: "Taipei", country: "TW", rtt: 5 }, d1: { ms: 1, sqlMs: 0 } });
  }
  return json(route, { error: "not mocked" }, 404);
}

async function mockExternal(route){
  const req = route.request();
  const url = new URL(req.url());
  if (url.hostname === "api.github.com") return json(route, []);
  if (req.resourceType() === "document" || req.resourceType() === "fetch" || req.resourceType() === "xhr") {
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: STUB_HTML });
  }
  return route.fulfill({ status: 204 });
}

const test = base.test.extend({
  // TankOS 2.0 feature flag for the whole test: "2" stores localStorage.ui = "2" before the page loads, the same
  // state a visitor has after opening ?ui=2 once. The "ui2" project in playwright.config.js sets it.
  tankUi: [null, { option: true }],
  context: async ({ context, tankUi }, use) => {
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
      if (url.startsWith(ORIGIN + "/api/")) return mockApi(route);
      if (url.startsWith(ORIGIN + "/")) return route.continue();
      return mockExternal(route);
    });
    // A fixed language unless a test sets its own. TankOS reads localStorage.lang on boot.
    await context.addInitScript(() => {
      try { if (!localStorage.getItem("lang")) localStorage.setItem("lang", "zh"); } catch (e) {}
    });
    if (tankUi === "2") {
      await context.addInitScript(() => {
        try { if (!sessionStorage.getItem("pw.ui.set")) { localStorage.setItem("ui", "2"); sessionStorage.setItem("pw.ui.set", "1"); } } catch (e) {}
      });
    }
    await use(context);
  },
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(NOW);
    await use(page);
  }
});

// Load TankOS, unlock it (any key) and wait until it has settled.
async function boot(page, opts){
  opts = opts || {};
  await page.goto(opts.path || "/");
  await expect(page.locator("#lock")).toBeVisible();
  if (opts.locked) return;
  await page.keyboard.press("Space");
  // Reduced motion: TankOS removes the lock screen at once instead of sliding it away.
  await expect(page.locator("#lock")).toHaveCount(0);
  await settle(page);
}

// Fonts and the wallpaper decoded, and the (mocked) online count painted: nothing left to pop in.
async function settle(page){
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Wait for the wallpaper this page actually shows (v2.4's photo, or the 2.0 art under ?ui=2), so the test
    // itself never downloads the other one.
    const small = matchMedia("(max-width: 768px)").matches;
    const img = new Image();
    img.src = document.documentElement.getAttribute("data-ui") === "2"
      ? "images/wallpaper-pixelverse-lakeside-night.png"
      : small ? "images/wallpaper-komezuka-sm.jpg" : "images/wallpaper-komezuka.jpg";
    await img.decode();
  });
  await expect(page.locator("#mbWho")).toBeVisible();
}

// Windows carry no id of their own; their title does (wt-<app id>).
function win(page, id){
  return page.locator("section.win", { has: page.locator("#wt-" + id) });
}

async function openFromDesktop(page, id){
  await page.locator('.desktop .dicon[data-open="' + id + '"]').dblclick();
  await expect(win(page, id)).toBeVisible();
  return win(page, id);
}

async function box(locator){
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  });
}

// The z-index TankOS gives each window (inline style), keyed by app id.
async function zOrder(page){
  return page.evaluate(() => {
    const out = {};
    document.querySelectorAll("section.win").forEach((el) => {
      out[el.querySelector(".title").id.replace(/^wt-/, "")] = +el.style.zIndex;
    });
    return out;
  });
}

// A point where the bare desktop (not an icon, widget, window or the Dock) is what the pointer would hit.
async function emptyDesktopPoint(page){
  const p = await page.evaluate(() => {
    for (let y = window.innerHeight - 120; y > 60; y -= 17) {
      for (let x = window.innerWidth - 20; x > 20; x -= 23) {
        const el = document.elementFromPoint(x, y);
        if (el && el.id === "desktop") return { x, y };
      }
    }
    return null;
  });
  expect(p, "an empty spot on the desktop").not.toBeNull();
  return p;
}

module.exports = { test, expect, boot, settle, win, openFromDesktop, box, zOrder, emptyDesktopPoint, NOW };
