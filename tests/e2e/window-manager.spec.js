// Window manager (index.html: open / close / focus / focusTop / minimize / zoom / place / wire).
// These pin today's behaviour so the 2.0 restyle can prove it changed the look and nothing else.
const { test, expect, boot, win, openFromDesktop, box, zOrder, emptyDesktopPoint } = require("../support/fixtures");

test.describe("window manager (desktop 1366×768)", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("boot: README opens focused and the menu bar names it", async ({ page }) => {
    const readme = win(page, "readme");
    await expect(readme).toHaveClass(/\bfocused\b/);
    await expect(page.locator("section.win")).toHaveCount(1);
    await expect(page.locator("#mbApp")).toHaveText("README.md");
    await expect(readme).toHaveAttribute("role", "dialog");
    await expect(readme).toHaveAttribute("aria-labelledby", "wt-readme");
  });

  test("opening an app focuses it and puts it on top", async ({ page }) => {
    const calc = await openFromDesktop(page, "calc");
    await expect(calc).toHaveClass(/\bfocused\b/);
    await expect(win(page, "readme")).not.toHaveClass(/\bfocused\b/);
    await expect(page.locator("section.win.focused")).toHaveCount(1);
    await expect(page.locator("#mbApp")).toHaveText("計算機");
    const z = await zOrder(page);
    expect(z.calc).toBeGreaterThan(z.readme);
  });

  test("pressing on a background window brings it to the front", async ({ page }) => {
    await openFromDesktop(page, "contact");
    const readme = win(page, "readme");
    // Contact (440 wide) opens over README's centre, so press on a part of README it does not cover.
    const r = await box(readme), c = await box(win(page, "contact"));
    const x = r.x + 30 < c.x ? r.x + 30 : r.right - 30;
    await page.mouse.click(x, r.bottom - 30);
    await expect(readme).toHaveClass(/\bfocused\b/);
    await expect(page.locator("#mbApp")).toHaveText("README.md");
    const z = await zOrder(page);
    expect(z.readme).toBeGreaterThan(z.contact);
  });

  test("pressing the bare desktop unfocuses every window", async ({ page }) => {
    const p = await emptyDesktopPoint(page);
    await page.mouse.click(p.x, p.y);
    await expect(page.locator("section.win.focused")).toHaveCount(0);
    await expect(page.locator("#mbApp")).toHaveText("TankOS");
  });

  test("opening an app that is already open reuses its one window", async ({ page }) => {
    await openFromDesktop(page, "calc");
    await page.locator('.desktop .dicon[data-open="calc"]').dblclick();
    await page.locator('#dock .dk[data-open="readme"]').click();
    await expect(win(page, "calc")).toHaveCount(1);
    await expect(win(page, "readme")).toHaveCount(1);
    await expect(win(page, "readme")).toHaveClass(/\bfocused\b/);
  });

  test("dragging the title bar moves the window by the pointer delta", async ({ page }) => {
    const readme = win(page, "readme");
    const before = await box(readme);
    const t = await box(readme.locator(".title"));
    const sx = t.x + t.w / 2, sy = t.y + t.h / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx - 60, sy + 20, { steps: 4 });
    // Iframes are muted while dragging, so they cannot swallow the pointer.
    await expect(page.locator("body")).toHaveClass(/\bdragging\b/);
    await page.mouse.move(sx - 100, sy + 50, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator("body")).not.toHaveClass(/\bdragging\b/);
    const after = await box(readme);
    expect(after.x - before.x).toBeCloseTo(-100, 0);
    expect(after.y - before.y).toBeCloseTo(50, 0);
  });

  test("a window cannot be dragged out of reach", async ({ page }) => {
    const readme = win(page, "readme");
    const layer = await box(page.locator("#windows"));
    const t = await box(readme.locator(".title"));
    const w = (await box(readme)).w;
    // Grab the part of the title bar that is on screen (after a clamp only 80px of it may be).
    const drag = async (dx, dy) => {
      const b = await box(readme.locator(".bar"));
      const vw = page.viewportSize().width;
      const gx = (Math.max(b.x, 0) + Math.min(b.right, vw)) / 2, gy = b.y + b.h / 2;   // clear of the traffic lights
      await page.mouse.move(gx, gy);
      await page.mouse.down();
      await page.mouse.move(gx + dx, gy + dy, { steps: 6 });
      await page.mouse.up();
    };
    expect(t.w).toBeGreaterThan(40);

    await drag(-5000, -5000);
    let pos = await readme.evaluate((el) => ({ left: el.offsetLeft, top: el.offsetTop }));
    expect(pos.left).toBe(80 - w);   // 80px stays on screen
    expect(pos.top).toBe(0);

    await drag(5000, 5000);
    pos = await readme.evaluate((el) => ({ left: el.offsetLeft, top: el.offsetTop }));
    expect(pos.left).toBe(Math.round(layer.w) - 80);
    expect(pos.top).toBe(Math.round(layer.h) - 48);
  });

  test("pressing a title-bar button does not start a drag", async ({ page }) => {
    const readme = win(page, "readme");
    const before = await box(readme);
    const b = await box(readme.locator(".tl-max"));
    await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + 200, b.y + 120, { steps: 5 });
    await page.mouse.up();
    expect(await box(readme)).toEqual(before);
    await expect(readme).not.toHaveClass(/\bmax\b/);
  });

  test("resizing stops at the 320×220 minimum", async ({ page }) => {
    const contact = await openFromDesktop(page, "contact");
    const style = await contact.evaluate((el) => {
      const s = getComputedStyle(el);
      return { resize: s.resize, minW: s.minWidth, minH: s.minHeight };
    });
    expect(style).toEqual({ resize: "both", minW: "320px", minH: "220px" });
    // Drag the native resize grip (bottom-right corner) far up and left.
    const r = await box(contact);
    await page.mouse.move(r.right - 3, r.bottom - 3);
    await page.mouse.down();
    await page.mouse.move(r.x - 300, r.y - 300, { steps: 8 });
    await page.mouse.up();
    const after = await box(contact);
    expect(after.w).toBe(320);
    expect(after.h).toBe(220);
  });

  test("zoom fills the area above the Dock and toggles back", async ({ page }) => {
    const readme = win(page, "readme");
    const before = await box(readme);
    await readme.locator(".tl-max").click();
    await expect(readme).toHaveClass(/\bmax\b/);
    const layer = await box(page.locator("#windows"));
    const dockSpace = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.height = "var(--dock-space)";
      document.body.appendChild(probe);
      const h = probe.getBoundingClientRect().height;
      probe.remove();
      return h;
    });
    const z = await box(readme);
    expect(z.x).toBe(0);
    expect(z.y).toBe(layer.y);
    expect(z.w).toBe(layer.w);
    expect(z.h).toBeCloseTo(layer.h - dockSpace, 0);
    expect(await readme.evaluate((el) => getComputedStyle(el).resize)).toBe("none");

    // Double-clicking the title bar is the same as the green button.
    await readme.locator(".title").dblclick();
    await expect(readme).not.toHaveClass(/\bmax\b/);
    expect(await box(readme)).toEqual(before);
  });

  test("double-clicking a title-bar button does not zoom", async ({ page }) => {
    const site = await openFromDesktop(page, "fukuoka");
    await site.locator('[data-act="side"]').dblclick();
    await expect(site).not.toHaveClass(/\bmax\b/);
    await expect(site).not.toHaveClass(/\bnoside\b/);   // toggled twice
    // The title text itself is not a button, so a double-click there does zoom.
    await site.locator(".title").dblclick();
    await expect(site).toHaveClass(/\bmax\b/);
  });

  test("shrinking the browser pulls windows back on screen", async ({ page }) => {
    const readme = win(page, "readme");
    const t = await box(readme.locator(".title"));
    await page.mouse.move(t.x + 20, t.y + t.h / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + 20 + 5000, t.y + t.h / 2, { steps: 6 });
    await page.mouse.up();
    await page.setViewportSize({ width: 1100, height: 700 });
    await expect.poll(() => readme.evaluate((el) => el.offsetLeft)).toBe(1100 - 80);
  });

  test("closing removes the window and focuses the one below", async ({ page }) => {
    await openFromDesktop(page, "calc");
    await openFromDesktop(page, "contact");
    await win(page, "contact").locator(".tl-close").click();
    await expect(win(page, "contact")).toHaveCount(0);
    await expect(win(page, "calc")).toHaveClass(/\bfocused\b/);
    await expect(page.locator("#mbApp")).toHaveText("計算機");
    // Closing the last window leaves the bare desktop.
    await win(page, "calc").locator(".tl-close").click();
    await win(page, "readme").locator(".tl-close").click();
    await expect(page.locator("section.win")).toHaveCount(0);
    await expect(page.locator("#mbApp")).toHaveText("TankOS");
  });

  test("minimize hides the window, focuses the next one, and reopening restores the same window", async ({ page }) => {
    const contact = await openFromDesktop(page, "contact");
    await contact.evaluate((el) => { el.__pwSame = true; });
    await contact.locator(".tl-min").click();
    await expect(contact).toHaveClass(/\bminimized\b/);
    await expect(contact).toHaveCSS("pointer-events", "none");
    await expect(contact).toHaveCSS("opacity", "0");
    await expect(win(page, "readme")).toHaveClass(/\bfocused\b/);

    await page.locator('#dock .dk[data-open="contact"]').click();
    await expect(contact).not.toHaveClass(/\bminimized\b/);
    await expect(contact).toHaveClass(/\bfocused\b/);
    expect(await contact.evaluate((el) => el.__pwSame === true)).toBe(true);   // not rebuilt
  });

  test("window position is not remembered across reloads (no stored window state today)", async ({ page }) => {
    const readme = win(page, "readme");
    const first = await box(readme);
    const t = await box(readme.locator(".title"));
    await page.mouse.move(t.x + 20, t.y + 10);
    await page.mouse.down();
    await page.mouse.move(t.x + 120, t.y + 90, { steps: 4 });
    await page.mouse.up();
    await boot(page);
    expect(await box(win(page, "readme"))).toEqual(first);
    await expect(page.locator("section.win")).toHaveCount(1);
  });
});
