// TankOS is always 2.0 (v3.0.0 removed the v2.4 UI): the <head> script sets data-ui="2" before anything renders,
// whatever the URL or storage says, and clears the old saved choice (localStorage.ui). Every 2.0 rule is still
// scoped to :root[data-ui="2"], and the Nocturne design tokens live there.
const { test, expect, boot, win, openFromDesktop, settle } = require("../support/fixtures");

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

// The older --win-* variables and what they resolve to under 2.0 (custom properties resolve var() when computed).
const COMPAT = {
  "--win-bg": "#111a33", "--win-bar": "#1a264a", "--win-side": "#0b1020", "--win-fg": "#f2f4ff",
  "--win-soft": "#bcc6e2", "--win-mute": "#95a3c4", "--win-line": "rgba(204,197,255,.18)", "--accent": "#ff5a4e",
  "--sel": "#8b7cff", "--win-shadow": "0 24px 72px rgba(2,4,17,.52),0 0 28px rgba(133,105,239,.12)"
};


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

test.describe("always TankOS 2.0", () => {
  for (const path of ["/", "/?ui=1", "/?ui=2", "/?ui=3"]) {
    test(`${path}: 2.0, the dark browser chrome, and nothing saved`, async ({ page }) => {
      await boot(page, { path });
      expect(await flag(page)).toEqual({ attr: "2", stored: null, themeColor: "#0b1020", scheme: "dark" });
      expect(page.url()).toContain(path);                     // the address is left as it is
    });
  }

  for (const saved of ["1", "2"]) {
    test(`a visitor with localStorage.ui = "${saved}" gets 2.0 and the key is gone; their 2.0 settings stay`, async ({ page }) => {
      await page.addInitScript((v) => {
        if (sessionStorage.getItem("seeded")) return;
        localStorage.setItem("ui", v);
        localStorage.setItem("ui2.wallpaper", "komezuka");
        localStorage.setItem("ui2.transparency", "reduced");
        localStorage.setItem("ui2.motion", "normal");
        sessionStorage.setItem("seeded", "1");
      }, saved);
      await boot(page);
      expect(await flag(page)).toMatchObject({ attr: "2", stored: null });
      expect(await page.evaluate(() => ({
        wall: localStorage.getItem("ui2.wallpaper"), tr: localStorage.getItem("ui2.transparency"), mo: localStorage.getItem("ui2.motion"),
        attrs: ["data-wall", "data-transparency", "data-motion"].map((a) => document.documentElement.getAttribute(a))
      }))).toEqual({ wall: "komezuka", tr: "reduced", mo: "normal", attrs: ["komezuka", "reduced", "normal"] });
    });
  }

  test("with storage blocked: still 2.0, and the page works", async ({ page }) => {
    await page.addInitScript(() => {
      const no = () => { throw new DOMException("blocked", "SecurityError"); };
      Storage.prototype.getItem = no; Storage.prototype.setItem = no; Storage.prototype.removeItem = no;
    });
    await page.goto("/?ui=1");
    await page.keyboard.press("Space");
    await expect(page.locator("#lock")).toHaveCount(0);
    await settle(page);
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-ui"))).toBe("2");
    await page.locator('#dock .dk[data-open="readme"]').click();
    await expect(win(page, "readme").locator(".doc h2")).toHaveCSS("color", "rgb(242, 244, 255)");
  });
});

test.describe("Nocturne design tokens", () => {
  test("defines every design token with its exact value", async ({ page }) => {
    await boot(page);
    expect(await vars(page, Object.keys(TOKENS))).toEqual(TOKENS);
    // Fonts reuse today's stacks (no webfont).
    const f = await vars(page, ["--tank-font-ui", "--sys", "--tank-font-code", "--mono"]);
    expect(f["--tank-font-ui"]).toBe(f["--sys"]);
    expect(f["--tank-font-code"]).toBe(f["--mono"]);
  });

  test("the older --win-* variables keep their names and resolve to Nocturne", async ({ page }) => {
    await boot(page, { readme: true });
    expect(await vars(page, Object.keys(COMPAT))).toEqual(COMPAT);
    // Real elements pick it up through the old names.
    // (Window chrome itself is PR-4's: see window-chrome.spec.js. Here only what reads --win-* directly.)
    const readme = win(page, "readme");
    await expect(readme.locator(".doc h2")).toHaveCSS("color", "rgb(242, 244, 255)");
    await expect(readme.locator(".doc .md").first()).toHaveCSS("color", "rgb(255, 90, 78)");
    await expect(readme.locator(".doc .sub")).toHaveCSS("color", "rgb(149, 163, 196)");
  });

  test("apps/trace.js, which only knows --win-*, follows the theme", async ({ page }) => {
    await boot(page);
    const w = await openFromDesktop(page, "trace");
    await expect(w.locator(".app-load")).toHaveCount(0);
    await expect(w.locator(".tr-lede").first()).toHaveCSS("color", "rgb(188, 198, 226)");
  });

  for (const scheme of ["light", "dark"]) {
    test.describe(`with a ${scheme} OS`, () => {
      test.use({ colorScheme: scheme });
      test("2.0 is always Nocturne (dark only, decision D1)", async ({ page }) => {
        await boot(page);
        expect(await vars(page, Object.keys(COMPAT))).toEqual(COMPAT);
      });
    });
  }
});

test.describe("no flash without the 2.0 theme", () => {
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
    await page.goto("/");
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
      // Further attribute conditions on :root are fine (PR-7: [data-transparency="reduced"] etc.).
      .filter((sel) => !sel.split(/,(?![^(]*\))/).every((s) => /^(:root\[data-ui="2"\](\[[^\]]+\])*|:where\(:root\[data-ui="2"\](\[[^\]]+\])*\))/.test(s.trim())));
    expect(offenders).toEqual([]);
  });
});
