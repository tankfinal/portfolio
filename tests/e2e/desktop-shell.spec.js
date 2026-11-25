// TankOS 2.0 desktop shell (PR-5): the Nocturne menu bar and the Pixelverse wallpaper.
const { test, expect, boot, win } = require("../support/fixtures");

const GLASS = "rgba(21, 29, 61, 0.88)";        // --tank-glass
const FOCUS_RING = "rgba(178, 151, 255, 0.8)"; // --tank-border-focus

// Every item the menu bar has. Adding or dropping one is a product decision, so this list changes with it.
const ITEMS = ["#btnAbout", "#mbApp", ".mb-item", ".mb-ver", ".mb-priv", "#btnSpot", "#btnZh", "#btnEn", "#mbWho", "#clock"];

function bar(page){
  return page.evaluate(() => {
    const m = document.querySelector(".menubar"), s = getComputedStyle(m);
    return {
      h: m.getBoundingClientRect().height, bg: s.backgroundColor, blur: s.backdropFilter,
      line: s.borderBottomWidth + " " + s.borderBottomColor,
      desktopTop: document.getElementById("desktop").getBoundingClientRect().top,
      windowsTop: document.getElementById("windows").getBoundingClientRect().top
    };
  });
}

// WCAG contrast of an element's text against the bar, with the bar's glass composited over WHITE: the worst case,
// as if the brightest part of any wallpaper sat right under it.
function contrastOverWhite(page, sel){
  return page.evaluate((sel) => {
    const rgba = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const over = (fg, bg) => { const a = fg[3] == null ? 1 : fg[3]; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
    const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const el = document.querySelector(sel), s = getComputedStyle(el);
    let bg = over(rgba(getComputedStyle(document.querySelector(".menubar")).backgroundColor), [255, 255, 255]);
    const own = rgba(s.backgroundColor);
    if (own.length && own[3] !== 0) bg = over(own, bg);   // the item's own pill (selected language, 私人版)
    const fg = over(rgba(s.color).concat([+s.opacity]), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  }, sel);
}

test.describe("menu bar: Nocturne", () => {
  test.beforeEach(async ({ page }) => { await boot(page); });

  test("--tank-menubar-height (36px), window glass, lavender rule, blur; desktop and windows start under it", async ({ page }) => {
    const h = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tank-menubar-height").trim());
    expect(h).toBe("36px");
    expect(await bar(page)).toEqual({
      h: 36, bg: GLASS, blur: "blur(24px) saturate(1.4)", line: "1px rgba(204, 197, 255, 0.18)", desktopTop: 36, windowsTop: 36
    });
  });

  test("the same items as always, in order, and nothing new", async ({ page }) => {
    for (const sel of ITEMS) await expect(page.locator(".menubar " + sel)).toHaveCount(1);
    const order = await page.evaluate((sels) => sels.map((s) => document.querySelector(".menubar " + s))
      .every((el, i, all) => i === 0 || (all[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)), ITEMS);
    expect(order).toBe(true);
    // Elements in the bar with an id or a class (SVG elements count: their className is an object): 17, the same
    // as v2.7.0 had in both UIs.
    expect(await page.evaluate(() => [...document.querySelectorAll(".menubar *")].filter((e) => e.id || e.className).length)).toBe(17);
  });

  test("the T logo stays brand red (D2)", async ({ page }) => {
    await expect(page.locator("#btnAbout")).toHaveCSS("background-color", "rgb(214, 40, 40)");
    await expect(page.locator("#btnAbout")).toHaveCSS("width", "20px");
  });

  test("every label reads at WCAG AA even with the brightest wallpaper under the bar", async ({ page }) => {
    for (const sel of ["#mbApp", ".mb-item", ".mb-ver", ".mb-priv", "#btnZh", "#btnEn", "#mbWho span", "#clock"]) {
      expect(await contrastOverWhite(page, sel), sel).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("hover, active and keyboard focus are all visible", async ({ page }) => {
    const en = page.locator("#btnEn");                      // not the selected language
    await expect(en).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await en.hover();
    await expect(en).toHaveCSS("background-color", "rgba(255, 255, 255, 0.1)");
    const spot = page.locator("#btnSpot"), b = await spot.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(spot).toHaveCSS("background-color", "rgba(139, 124, 255, 0.34)");
    await page.mouse.up();
    await page.keyboard.press("Escape");                    // the click opened Spotlight
    // Keyboard focus: a 2px violet ring.
    await page.locator("#btnZh").focus();
    await page.keyboard.press("Tab");
    await expect(en).toBeFocused();
    await expect(en).toHaveCSS("outline", FOCUS_RING + " solid 2px");
  });

  test("the selected language is marked with a violet pill", async ({ page }) => {
    await expect(page.locator("#btnZh")).toHaveCSS("background-color", "rgba(139, 124, 255, 0.28)");
    await page.locator("#btnEn").click();
    await expect(page.locator("#btnEn")).toHaveCSS("background-color", "rgba(139, 124, 255, 0.28)");
    await expect(page.locator("#mbApp")).toHaveText("TankOS");
    await expect(page.locator("#clock")).toHaveText("Sat, Nov 7, 10:30 AM");
  });

  test("everything still works: About, Spotlight, language, online count, private link", async ({ page }) => {
    await page.locator("#btnAbout").click();
    await expect(win(page, "about")).toHaveClass(/\bfocused\b/);
    await page.locator("#btnSpot").click();
    await expect(page.locator("#spot")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator("#mbWho").click();
    await expect(win(page, "terminal")).toHaveClass(/\bfocused\b/);
    await expect(page.locator(".mb-priv")).toHaveAttribute("href", "https://portfolio-private.xarenvich.com/");
    await expect(page.locator(".mb-priv")).toHaveAttribute("target", "_blank");
  });

  test("prefers-reduced-transparency: an opaque bar", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    await boot(page);
    expect(await bar(page)).toMatchObject({ bg: "rgb(11, 16, 32)", blur: "none" });
  });
});

for (const [w, h] of [[390, 844], [360, 740]]) {
  test.describe(`menu bar on a ${w}px phone`, () => {
    test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    test("36px, the usual items hidden, and the app name is not cut off", async ({ page }) => {
      await boot(page);
      expect((await bar(page)).h).toBe(36);
      await expect(page.locator(".mb-item")).toBeHidden();
      await expect(page.locator(".mb-ver")).toBeHidden();
      await expect(page.locator(".mb-priv span")).toBeHidden();
      const app = await page.locator("#mbApp").evaluate((e) => [e.scrollWidth, e.clientWidth]);
      expect(app[0]).toBeLessThanOrEqual(app[1]);
      const right = await page.locator(".menubar .mb-r").evaluate((e) => e.getBoundingClientRect().right);
      expect(right).toBeLessThanOrEqual(w);
    });
  });
}

// ---------- wallpaper ----------
const PNG = "images/wallpaper-pixelverse-lakeside-night.png";
const WEBP = "images/wallpaper-pixelverse-lakeside-night.webp";
// SHA-256 of the approved artwork as delivered (TankOS-PR5-Pixelverse-Package.zip). The repo copy must stay byte
// for byte the same: re-exporting, cropping or "optimizing" it in place would fail here.
const PNG_SHA256 = "964e813727a9b6e894004f715978480d1f84542e0769d8edeb9d97cca5147cf4";

function wall(page){
  return page.evaluate(() => {
    const s = getComputedStyle(document.querySelector(".wall"));
    const lock = document.getElementById("lock");
    return {
      image: s.backgroundImage, size: s.backgroundSize, pos: s.backgroundPosition, color: s.backgroundColor,
      dim: getComputedStyle(document.querySelector(".wall-dim")).opacity,
      lock: lock ? getComputedStyle(lock, "::before").backgroundImage : null
    };
  });
}

// Every wallpaper file the page asks for.
function watchWallpapers(page){
  const seen = [];
  page.on("request", (r) => { const m = r.url().match(/images\/(wallpaper-[^?]+)/); if (m) seen.push(m[1]); });
  return seen;
}

test.describe("wallpaper", () => {
  test("the approved PNG is in the repo unchanged (1672×941), with a same-size WebP made from it", async ({ page, request }) => {
    const crypto = require("crypto"), fs = require("fs"), path = require("path");
    const buf = fs.readFileSync(path.join(__dirname, "..", "..", PNG));
    expect(crypto.createHash("sha256").update(buf).digest("hex")).toBe(PNG_SHA256);
    // The Komezuka photo is kept for a future wallpaper picker.
    for (const f of ["images/wallpaper-komezuka.jpg", "images/wallpaper-komezuka-sm.jpg", PNG, WEBP]) {
      expect((await request.get("/" + f)).status(), f).toBe(200);
    }
    await page.goto("/");
    const dims = await page.evaluate(async (srcs) => Promise.all(srcs.map(async (src) => {
      const i = new Image(); i.src = src; await i.decode(); return [i.naturalWidth, i.naturalHeight];
    })), [PNG, WEBP]);
    expect(dims).toEqual([[1672, 941], [1672, 941]]);
    expect(fs.statSync(path.join(__dirname, "..", "..", WEBP)).size).toBeLessThan(400 * 1024);
  });

  test("the Pixelverse art (WebP) under a light night overlay; the photo and the 2.2 MB PNG are not downloaded", async ({ page }) => {
    const seen = watchWallpapers(page);
    await boot(page);
    const w = await wall(page);
    expect(w.image).toContain("wallpaper-pixelverse-lakeside-night.webp");
    expect(w.image).toContain("wallpaper-pixelverse-lakeside-night.png");      // the image-set fallback
    expect(w.image).not.toContain("komezuka");
    // Two overlay layers, deep indigo-violet, never fully opaque.
    const layers = w.image.match(/linear-gradient\([^)]*\)[^)]*\)/g) || [];
    expect(w.image.match(/linear-gradient/g)).toHaveLength(2);
    const alphas = (w.image.match(/rgba\(16, 14, 48, ([\d.]+)\)/g) || []).map((m) => +m.match(/([\d.]+)\)$/)[1]);
    expect(alphas.length).toBeGreaterThan(0);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.45);
    expect(w).toMatchObject({ size: "auto, auto, cover", pos: "0px 0px, 0px 0px, 50% 55%", color: "rgb(11, 16, 32)", dim: "0" });
    expect(seen).toEqual(["wallpaper-pixelverse-lakeside-night.webp"]);
  });

  test("the PNG line comes first, so browsers without image-set() still get the art", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const block = html.slice(html.indexOf(':where(:root[data-ui="2"]) .wall{'));
    const png = block.indexOf("url(images/wallpaper-pixelverse-lakeside-night.png);");
    const set = block.indexOf("image-set(url(images/wallpaper-pixelverse-lakeside-night.webp)");
    expect(png).toBeGreaterThan(-1);
    expect(set).toBeGreaterThan(png);
  });

  test("the lock screen shows the new art too", async ({ page }) => {
    await boot(page, { locked: true });
    expect((await wall(page)).lock).toContain("pixelverse-lakeside-night.webp");
  });

  test("icon labels get the indigo halo", async ({ page }) => {
    await boot(page);
    const lbl = page.locator('.dicon[data-open="fukuoka"] .lbl');
    expect(await lbl.evaluate((e) => getComputedStyle(e).textShadow)).toContain("rgba(5, 7, 25, 0.95)");
  });

  for (const [w, h] of [[390, 844], [768, 1024]]) {
    test.describe(`portrait ${w}×${h}`, () => {
      test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      test("the crop keeps the camp in view (20% from the left); same WebP, no separate phone file", async ({ page }) => {
        const seen = watchWallpapers(page);
        await boot(page);
        expect((await wall(page)).pos).toBe("0px 0px, 0px 0px, 20% 50%");
        expect(seen).toEqual(["wallpaper-pixelverse-lakeside-night.webp"]);
      });
    });
  }
});
