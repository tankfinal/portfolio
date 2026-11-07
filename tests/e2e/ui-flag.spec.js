// TankOS 2.0 feature flag (<head> script in index.html) and the Nocturne design tokens (:root[data-ui="2"]).
// The flag must default to off, be applied before anything renders, and only ever change colours through tokens.
const { test, expect, boot, win, openFromDesktop } = require("../support/fixtures");

// The DS v1 tokens (TankOS-Design-System-v1, tankos-tokens.css) plus the TankOS additions, exactly as authored.
const TOKENS = {
  "--tank-bg": "#0b1020", "--tank-surface": "#111a33", "--tank-surface-elevated": "#1a264a",
  "--tank-primary": "#8b7cff", "--tank-accent": "#c58aff", "--tank-brand": "#d62828", "--tank-brand-text": "#ff5a4e",
  "--tank-success": "#4ade80", "--tank-warning": "#fbbf24", "--tank-danger": "#fb7171",
  "--tank-text": "#f2f4ff", "--tank-text-secondary": "#bcc6e2", "--tank-text-muted": "#95a3c4",
  "--tank-border": "rgba(204,197,255,.18)", "--tank-border-focus": "rgba(178,151,255,.8)",
  "--tank-glass": "rgba(21,29,61,.88)", "--tank-glass-strong": "rgba(18,25,53,.94)", "--tank-glass-blur": "24px",
  "--tank-radius-sm": "8px", "--tank-radius-md": "12px", "--tank-radius-lg": "16px", "--tank-radius-xl": "20px",
  "--tank-radius-pill": "999px",
  "--tank-space-1": "4px", "--tank-space-2": "8px", "--tank-space-3": "12px", "--tank-space-4": "16px",
  "--tank-space-5": "24px", "--tank-space-6": "32px", "--tank-space-7": "48px",
  "--tank-font-size-xs": "12px", "--tank-font-size-sm": "13px", "--tank-font-size-md": "14px",
  "--tank-font-size-lg": "18px", "--tank-font-size-xl": "24px",
  "--tank-menubar-height": "36px", "--tank-window-titlebar-height": "44px",
  "--tank-dock-icon-size": "48px", "--tank-dock-height": "72px",
  "--tank-z-desktop": "0", "--tank-z-window": "100", "--tank-z-dock": "1000", "--tank-z-menubar": "1050",
  "--tank-z-menu": "1100", "--tank-z-dialog": "1200", "--tank-z-toast": "1300", "--tank-z-drag": "1350",
  "--tank-z-lock": "1400",
  "--tank-motion-fast": "120ms", "--tank-motion-normal": "200ms", "--tank-motion-slow": "280ms",
  "--tank-ease": "cubic-bezier(.2,.8,.2,1)"
};

// v2.4 variables and what they resolve to under the flag (custom properties resolve var() when computed).
const COMPAT = {
  "--win-bg": "#111a33", "--win-bar": "#1a264a", "--win-side": "#0b1020", "--win-fg": "#f2f4ff",
  "--win-soft": "#bcc6e2", "--win-mute": "#95a3c4", "--win-line": "rgba(204,197,255,.18)", "--accent": "#ff5a4e",
  "--sel": "#8b7cff", "--win-shadow": "0 24px 72px rgba(2,4,17,.52),0 0 28px rgba(133,105,239,.12)"
};

const TODAY_LIGHT = { "--win-bg": "#ffffff", "--win-fg": "#1d1d1f", "--accent": "#d62828", "--sel": "#0a64d8" };
const TODAY_DARK = { "--win-bg": "#1f1f22", "--win-fg": "#f2f2f4", "--accent": "#ff4b3e", "--sel": "#0a64d8" };

function vars(page, names){
  return page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const n of names) out[n] = cs.getPropertyValue(n).trim().toLowerCase().replace(/\s*,\s*/g, ",");
    return out;
  }, names);
}

async function flag(page){
  return page.evaluate(() => ({
    attr: document.documentElement.getAttribute("data-ui"),
    stored: localStorage.getItem("ui"),
    themeColor: document.querySelector('meta[name="theme-color"]').content.toLowerCase(),
    scheme: getComputedStyle(document.documentElement).colorScheme
  }));
}

test.describe("default (flag off): exactly v2.4", () => {
  test("no data-ui, no 2.0 tokens, today's colours", async ({ page }) => {
    await boot(page);
    expect(await flag(page)).toEqual({ attr: null, stored: null, themeColor: "#0a1238", scheme: "normal" });
    const t = await vars(page, Object.keys(TOKENS));
    for (const k of Object.keys(TOKENS)) expect(t[k], k).toBe("");
    expect(await vars(page, Object.keys(TODAY_LIGHT))).toEqual(TODAY_LIGHT);
    await expect(win(page, "readme")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });

  test.describe("with a dark OS", () => {
    test.use({ colorScheme: "dark" });
    test("today's dark theme is untouched", async ({ page }) => {
      await boot(page);
      expect((await flag(page)).attr).toBeNull();
      expect(await vars(page, Object.keys(TODAY_DARK))).toEqual(TODAY_DARK);
    });
  });

  test("an unknown ?ui value is ignored", async ({ page }) => {
    await boot(page, { path: "/?ui=3" });
    expect(await flag(page)).toMatchObject({ attr: null, stored: null });
  });
});

test.describe("?ui=2 (Nocturne preview)", () => {
  test("turns the flag on, remembers it, and sets the dark browser chrome", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    expect(await flag(page)).toEqual({ attr: "2", stored: "2", themeColor: "#0b1020", scheme: "dark" });
  });

  test("defines every design token with its exact value", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    expect(await vars(page, Object.keys(TOKENS))).toEqual(TOKENS);
    // Fonts reuse today's stacks (no webfont).
    const f = await vars(page, ["--tank-font-ui", "--sys", "--tank-font-code", "--mono"]);
    expect(f["--tank-font-ui"]).toBe(f["--sys"]);
    expect(f["--tank-font-code"]).toBe(f["--mono"]);
  });

  test("the v2.4 --win-* variables keep their names and resolve to Nocturne", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    expect(await vars(page, Object.keys(COMPAT))).toEqual(COMPAT);
    // Real elements pick it up through the old names.
    // (Window chrome itself is PR-4's: see window-chrome.spec.js. Here only what reads --win-* directly.)
    const readme = win(page, "readme");
    await expect(readme.locator(".doc h2")).toHaveCSS("color", "rgb(242, 244, 255)");
    await expect(readme.locator(".doc .md").first()).toHaveCSS("color", "rgb(255, 90, 78)");
    await expect(readme.locator(".doc .sub")).toHaveCSS("color", "rgb(149, 163, 196)");
  });

  test("apps/trace.js, which only knows --win-*, follows the theme", async ({ page }) => {
    await boot(page, { path: "/?ui=2" });
    const w = await openFromDesktop(page, "trace");
    await expect(w.locator(".app-load")).toHaveCount(0);
    await expect(w.locator(".tr-lede").first()).toHaveCSS("color", "rgb(188, 198, 226)");
  });

  for (const scheme of ["light", "dark"]) {
    test.describe(`with a ${scheme} OS`, () => {
      test.use({ colorScheme: scheme });
      test("2.0 is always Nocturne (dark only, decision D1)", async ({ page }) => {
        await boot(page, { path: "/?ui=2" });
        expect(await vars(page, Object.keys(COMPAT))).toEqual(COMPAT);
      });
    });
  }

  test("layout is v2.4's: same sizes and columns, the Dock untouched; only the taller 2.0 menu bar moves things down", async ({ page }) => {
    const read = () => page.evaluate(() => ({
      bar: document.querySelector(".menubar").getBoundingClientRect().height,
      dock: [...document.querySelectorAll("#dock .dk")].map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(","); }),
      icons: [...document.querySelectorAll(".dicon")].map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); }),
      wins: [...document.querySelectorAll("section.win")].map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); })
    }));
    await boot(page);
    const before = await read();
    await boot(page, { path: "/?ui=2" });
    const after = await read();
    expect(before.bar).toBe(28);
    expect(after.bar).toBe(36);                       // --tank-menubar-height (PR-5)
    expect(after.dock).toEqual(before.dock);          // the Dock does not move
    const shift = after.bar - before.bar;
    // Desktop icons: same x, width, height; y moved down by exactly the extra menu-bar height.
    expect(after.icons).toEqual(before.icons.map(([x, y, w, h]) => [x, y + shift, w, h]));
    // Windows: same x and width, moved down the same; open() fits the height to the space above the Dock, which is
    // now `shift` shorter, so a window that filled it is `shift` shorter too (README at 1366×768: 642 → 634).
    expect(after.wins.map(([x, y, w]) => [x, y, w])).toEqual(before.wins.map(([x, y, w]) => [x, y + shift, w]));
    after.wins.forEach(([, , , h], i) => expect([before.wins[i][3], before.wins[i][3] - shift]).toContain(h));
  });
});

// Precedence: ?ui= in the URL  >  the saved choice (localStorage.ui)  >  DEFAULT_UI.
// Run against today's DEFAULT_UI ("1") and the planned v2.5.0 one ("2"). For "2" the page is served with only that
// literal changed, so this checks the real script, not a copy of its logic.
const FLAG_LITERAL = 'var DEFAULT_UI = "1";';

async function useDefault(page, def){
  if (def === "1") return;
  await page.route(/127\.0\.0\.1:4321\/(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    const html = await res.text();
    if (html.split(FLAG_LITERAL).length !== 2) throw new Error("DEFAULT_UI literal not found exactly once in index.html");
    await route.fulfill({ response: res, body: html.replace(FLAG_LITERAL, 'var DEFAULT_UI = "' + def + '";') });
  });
}

// What the visitor gets: "2" when data-ui="2" is set, otherwise "1"; plus what is saved.
async function load(page, path){
  await page.goto(path);
  return page.evaluate(() => {
    let stored;
    try { stored = localStorage.getItem("ui"); } catch (e) { stored = "blocked"; }
    return { ui: document.documentElement.getAttribute("data-ui") === "2" ? "2" : "1", stored };
  });
}

test("the DEFAULT_UI simulation rewrites the real script", async ({ page }) => {
  await useDefault(page, "2");
  expect(await load(page, "/")).toEqual({ ui: "2", stored: null });
});

for (const def of ["1", "2"]) {
  const other = def === "1" ? "2" : "1";

  test.describe(`flag precedence with DEFAULT_UI = "${def}"`, () => {
    test.beforeEach(async ({ page }) => { await useDefault(page, def); });

    test("no choice: the default, and nothing is saved", async ({ page }) => {
      expect(await load(page, "/")).toEqual({ ui: def, stored: null });
      expect(await load(page, "/?lang=en")).toEqual({ ui: def, stored: null });   // other parameters do nothing
    });

    for (const pick of ["1", "2"]) {
      test(`?ui=${pick} wins over the default and survives reloads`, async ({ page }) => {
        expect(await load(page, `/?ui=${pick}`)).toEqual({ ui: pick, stored: pick });
        expect(await load(page, "/")).toEqual({ ui: pick, stored: pick });
        await page.reload();
        expect(await page.evaluate(() => document.documentElement.getAttribute("data-ui") === "2" ? "2" : "1")).toBe(pick);
      });
    }

    test("the URL beats the saved choice, and replaces it", async ({ page }) => {
      expect(await load(page, `/?ui=${other}`)).toEqual({ ui: other, stored: other });
      expect(await load(page, `/?ui=${def}`)).toEqual({ ui: def, stored: def });
      // Saved "same as default" is still a saved choice: it outlives a later change of the default.
      expect(await load(page, "/")).toEqual({ ui: def, stored: def });
      expect(await load(page, `/?ui=${other}&x=1`)).toEqual({ ui: other, stored: other });
      expect(await load(page, "/")).toEqual({ ui: other, stored: other });
    });

    test("invalid values are ignored: unknown ?ui=, junk in storage", async ({ page }) => {
      expect(await load(page, "/?ui=3")).toEqual({ ui: def, stored: null });
      expect(await load(page, "/?ui=")).toEqual({ ui: def, stored: null });
      expect(await load(page, `/?ui=${other}`)).toEqual({ ui: other, stored: other });
      expect(await load(page, "/?ui=banana")).toEqual({ ui: other, stored: other });   // keeps the saved choice
      await page.evaluate(() => localStorage.setItem("ui", "banana"));
      expect(await load(page, "/")).toEqual({ ui: def, stored: "banana" });
    });

    test("with storage blocked, ?ui= decides that load and the page still works", async ({ page }) => {
      await page.addInitScript(() => {
        const no = () => { throw new DOMException("blocked", "SecurityError"); };
        Storage.prototype.getItem = no; Storage.prototype.setItem = no; Storage.prototype.removeItem = no;
      });
      for (const pick of ["1", "2"]) {
        expect(await load(page, `/?ui=${pick}`)).toEqual({ ui: pick, stored: "blocked" });
        await page.keyboard.press("Space");
        await expect(page.locator("#lock")).toHaveCount(0);
        await expect(win(page, "readme").locator(".doc h2")).toHaveCSS("color", pick === "2" ? "rgb(242, 244, 255)" : "rgb(29, 29, 31)");
      }
      expect(await load(page, "/")).toEqual({ ui: def, stored: "blocked" });   // nothing to remember it with
    });
  });
}

test.describe("no flash of the old theme", () => {
  test("data-ui is set before <body> exists and before any stylesheet is parsed", async ({ page }) => {
    await page.addInitScript(() => {
      window.__uiSeen = null;
      new MutationObserver((list, obs) => {
        for (const m of list) {
          if (m.attributeName === "data-ui") {
            window.__uiSeen = { body: !!document.body, sheets: document.styleSheets.length };
            obs.disconnect();
          }
        }
      // Init scripts run before <html> exists, so watch the whole document for the attribute.
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-ui"] });
    });
    await page.goto("/?ui=2");
    // MutationObserver callbacks are microtasks, so the snapshot is taken right after the <head> script ran.
    expect(await page.evaluate(() => window.__uiSeen)).toEqual({ body: false, sheets: 0 });
  });

  test("the flag script is the first script in <head>, ahead of every <style>", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const head = html.slice(0, html.indexOf("</head>"));
    const script = head.indexOf("<script>"), style = head.indexOf("<style>");
    expect(script).toBeGreaterThan(-1);
    expect(script).toBeLessThan(style);
    expect(head.slice(script, head.indexOf("</script>", script))).toContain('setAttribute("data-ui", "2")');
  });
});

test.describe("everything else is scoped to the flag", () => {
  test("every rule that mentions --tank-* or data-ui lives under :root[data-ui=\"2\"] or :where() of it", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>")).replace(/\/\*[\s\S]*?\*\//g, "");
    // Split into top-level rules: "selector{ ... }" (no nested at-rules use these yet).
    const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
    const offenders = rules.filter((r) => /--tank-|data-ui/.test(r))
      .map((r) => r.slice(0, r.indexOf("{")).trim())
      // Either form: :root[data-ui="2"] (tokens) or :where(:root[data-ui="2"]) (PR-4's zero-specificity restyles).
      .filter((sel) => !sel.split(/,(?![^(]*\))/).every((s) => /^(:root\[data-ui="2"\]|:where\(:root\[data-ui="2"\]\))/.test(s.trim())));
    expect(offenders).toEqual([]);
  });
});
