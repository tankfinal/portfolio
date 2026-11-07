// TankOS 2.0 window system (index.html, "TankOS 2.0 window system" at the end of <style>): glass windows with a
// 16px radius, a lavender/violet edge, a 44px title bar with the app's icon, focused/unfocused states, an opaque
// fallback, and blur only where it is cheap. ?ui=1 must stay exactly v2.4. Behaviour (drag, resize, min/max, focus,
// close) is covered by the "ui2" project re-running window-manager / dock-and-apps / layout with the flag on.
const { test, expect, boot, win, openFromDesktop } = require("../support/fixtures");

const GLASS = "rgba(21, 29, 61, 0.88)";          // --tank-glass, focused
const SURFACE = "rgb(17, 26, 51)";               // --tank-surface: unfocused windows and the opaque fallbacks
const EDGE = "rgba(204, 197, 255, 0.18)";        // --tank-border
const EDGE_FOCUS = "rgba(139, 124, 255, 0.45)";
const BLUR = "blur(24px) saturate(1.4)";

function chrome(locator){
  return locator.evaluate((el) => {
    const s = getComputedStyle(el), bar = el.querySelector(".bar"), ic = el.querySelector(".bar-ic");
    return {
      bg: s.backgroundColor, radius: s.borderRadius, border: s.borderTopWidth + " " + s.borderTopStyle,
      edge: s.borderTopColor, shadow: s.boxShadow, blur: s.backdropFilter || s.webkitBackdropFilter || "none",
      bar: bar.getBoundingClientRect().height, icon: getComputedStyle(ic).display
    };
  });
}

test.describe("?ui=1: exactly the v2.4 window", () => {
  test("40px bar, 12px radius, no edge, no blur, no title icon", async ({ page }) => {
    await boot(page, { path: "/?ui=1" });
    const c = await chrome(win(page, "readme"));
    expect(c).toMatchObject({ bg: "rgb(255, 255, 255)", radius: "12px", border: "0px none", blur: "none", bar: 40, icon: "none" });
    await expect(page.getByRole("dialog", { name: "README.md" })).toHaveCount(1);
  });
});

test.describe("?ui=2 Nocturne windows (desktop)", () => {
  test.beforeEach(async ({ page }) => { await boot(page, { path: "/?ui=2" }); });

  test("focused: glass, 16px radius, violet edge, glow shadow, 24px blur, 44px bar", async ({ page }) => {
    const c = await chrome(win(page, "readme"));
    expect(c).toMatchObject({ bg: GLASS, radius: "16px", border: "1px solid", edge: EDGE_FOCUS, blur: BLUR, bar: 44, icon: "block" });
    expect(c.shadow).toContain("rgba(133, 105, 239, 0.12)");
  });

  test("unfocused: opaque (no ghosting of the window below), plain edge, no blur, dimmed icon; text keeps full contrast", async ({ page }) => {
    await openFromDesktop(page, "contact");
    const readme = win(page, "readme");
    const c = await chrome(readme);
    expect(c).toMatchObject({ bg: SURFACE, radius: "16px", edge: EDGE, blur: "none" });
    expect(c.shadow).not.toContain("133, 105, 239");
    await expect(readme.locator(".bar-ic")).toHaveCSS("opacity", "0.55");
    await expect(readme.locator(".title")).toHaveCSS("color", "rgb(149, 163, 196)");   // --tank-text-muted
    await expect(readme.locator(".doc h2")).toHaveCSS("color", "rgb(242, 244, 255)");  // body text not dimmed
  });

  test("only the focused window is blurred, however many are open", async ({ page }) => {
    for (const id of ["contact", "calendar", "fukuoka"]) await openFromDesktop(page, id);
    const blurred = () => page.evaluate(() => [...document.querySelectorAll("section.win")]
      .filter((w) => getComputedStyle(w).backdropFilter !== "none").map((w) => w.querySelector(".title").id));
    expect(await blurred()).toEqual(["wt-fukuoka"]);
    await page.locator('#dock .dk[data-open="readme"]').click();
    expect(await blurred()).toEqual(["wt-readme"]);
  });

  test("no blur while a window is being dragged; it comes back on release", async ({ page }) => {
    const readme = win(page, "readme");
    const t = await readme.locator(".title").boundingBox();
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width / 2 + 40, t.y + 30, { steps: 3 });
    await expect(page.locator("body")).toHaveClass(/\bdragging\b/);
    expect((await chrome(readme)).blur).toBe("none");
    await page.mouse.up();
    expect((await chrome(readme)).blur).toBe(BLUR);
  });

  for (const [id, cls, opener] of [
    ["readme", "ic-readme", null], ["calc", "ic-calc", "desktop"], ["fukuoka", "ic-fukuoka", "desktop"],
    ["trace", "ic-trace", "desktop"], ["calendar", "ic-cal", "desktop"], ["about", "ic-about", "menubar"]
  ]) {
    test(`title bar shows the ${id} icon (18px, hidden from screen readers)`, async ({ page }) => {
      if (opener === "desktop") await openFromDesktop(page, id);
      if (opener === "menubar") await page.locator("#btnAbout").click();
      const w = win(page, id);
      const ic = w.locator(".bar-ic > .ic");
      await expect(ic).toHaveClass(new RegExp("\\b" + cls + "\\b"));
      const b = await ic.boundingBox();
      expect([b.width, b.height]).toEqual([18, 18]);
      await expect(w.locator(".bar-ic")).toHaveAttribute("aria-hidden", "true");
      // The window's accessible name is still just the app name.
      const name = (await w.locator(".title-t").textContent()).trim();
      await expect(page.getByRole("dialog", { name, exact: true })).toHaveCount(1);
    });
  }

  test("a language switch translates the title and keeps the icon", async ({ page }) => {
    const calc = await openFromDesktop(page, "calc");
    await page.locator("#btnEn").click();
    await expect(calc.locator(".title-t")).toHaveText("Calculator");
    await expect(calc.locator(".bar-ic > .ic-calc")).toHaveCount(1);
  });

  test("apps that colour their own window keep it, inside the 2.0 shape", async ({ page }) => {
    const term = await openFromDesktop(page, "terminal");
    await expect(term).toHaveCSS("background-color", "rgb(27, 27, 29)");
    await expect(term.locator(".bar")).toHaveCSS("background-color", "rgb(42, 42, 44)");
    await expect(term).toHaveCSS("border-top-left-radius", "16px");
    const calc = await openFromDesktop(page, "calc");
    await expect(calc).toHaveCSS("background-color", "rgb(28, 28, 30)");
    await expect(calc).toHaveCSS("border-top-left-radius", "16px");
  });

  test("a maximized window keeps v2.4's square corners and still fills the space above the Dock", async ({ page }) => {
    const readme = win(page, "readme");
    await readme.locator(".tl-max").click();
    await expect(readme).toHaveCSS("border-top-left-radius", "0px");
  });

  test("apps/trace.js opens in the new chrome and its content follows the tokens", async ({ page }) => {
    const w = await openFromDesktop(page, "trace");
    await expect(w.locator(".app-load")).toHaveCount(0);
    expect((await chrome(w)).bar).toBe(44);
    await expect(w.locator(".tr-lede").first()).toHaveCSS("color", "rgb(188, 198, 226)");
  });
});

test.describe("?ui=2 opaque fallbacks", () => {
  test("prefers-reduced-transparency: every window opaque, no blur", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    await boot(page, { path: "/?ui=2" });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches)).toBe(true);
    await openFromDesktop(page, "contact");
    for (const id of ["readme", "contact"]) expect(await chrome(win(page, id))).toMatchObject({ bg: SURFACE, blur: "none" });
  });

  test("browsers without backdrop-filter get the opaque surface (the @supports not rule)", async ({ page }) => {
    // Chromium supports backdrop-filter, so check the rule itself in the CSSOM.
    await boot(page, { path: "/?ui=2" });
    const rules = await page.evaluate(() => {
      const out = [];
      for (const sheet of document.styleSheets) for (const r of sheet.cssRules) {
        if (r instanceof CSSSupportsRule && /^not /.test(r.conditionText) && /backdrop-filter/.test(r.conditionText)) {
          for (const inner of r.cssRules) out.push(inner.cssText);
        }
      }
      return out;
    });
    expect(rules).toContain(':where(:root[data-ui="2"]) .win { background: var(--tank-surface); }');
  });
});

test.describe("?ui=2 on phones and tablets", () => {
  for (const [w, h] of [[390, 844], [768, 1024]]) {
    test.describe(`${w}×${h}`, () => {
      test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      test("full-screen window: opaque, no blur, rounded bottom corners, 44px bar with icon", async ({ page }) => {
        await boot(page, { path: "/?ui=2" });
        await page.locator('.desktop .dicon[data-open="contact"]').tap();
        const contact = win(page, "contact");
        await expect(contact).toHaveClass(/\bfocused\b/);
        const c = await chrome(contact);
        expect(c).toMatchObject({ bg: SURFACE, blur: "none", radius: "0px 0px 16px 16px", border: "0px solid", bar: 44, icon: "block" });
      });
    });
  }

  test.describe("1024×768 tablet landscape", () => {
    test.use({ viewport: { width: 1024, height: 768 } });
    test("desktop windows: the focused one is glass with blur", async ({ page }) => {
      await boot(page, { path: "/?ui=2" });
      expect(await chrome(win(page, "readme"))).toMatchObject({ bg: GLASS, blur: BLUR, radius: "16px" });
    });
  });
});

test.describe("motion", () => {
  for (const motion of ["no-preference", "reduce"]) {
    test.describe(`prefers-reduced-motion: ${motion}`, () => {
      test.use({ reducedMotion: motion });
      test("2.0 adds no animation or transition of its own", async ({ page }) => {
        const read = () => win(page, "readme").evaluate((el) => {
          const s = getComputedStyle(el);
          return { anim: s.animationName, prop: s.transitionProperty, dur: s.transitionDuration };
        });
        await boot(page, { path: "/?ui=1" });
        const v1 = await read();
        await boot(page, { path: "/?ui=2" });
        expect(await read()).toEqual(v1);
        if (motion === "reduce") expect(v1).toMatchObject({ anim: "none", dur: "0s" });
      });
    });
  }
});
