// Playwright regression tests for TankOS. See README "Tests".
// Determinism: reduced motion (TankOS then skips its open/close/lock animations), a fixed clock and time zone,
// and every network request outside the local server mocked in tests/support/fixtures.js.
const { defineConfig } = require("@playwright/test");

const PORT = 4321;

module.exports = defineConfig({
  testDir: "tests/e2e",
  // Baselines are only comparable inside the pinned Playwright image (fonts and rendering), so the path has no
  // platform suffix; visual.spec.js skips itself unless TANKOS_VISUAL=1 (set by `npm run test:docker` and CI).
  snapshotPathTemplate: "tests/__screenshots__/{testFileName}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a test that needs one is flaky, and that should show up as a failure.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : [["list"]],
  expect: {
    // threshold 0.01 (default 0.2): rendering in the pinned image is exact, and both 0.2 and 0.05 let a 6%
    // see-through change (ghost text of the window below) pass as "unchanged"; 0.01 catches it.
    toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css", threshold: 0.01 }
  },
  use: {
    baseURL: "http://127.0.0.1:" + PORT,
    browserName: "chromium",
    viewport: { width: 1366, height: 768 },
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "off"
  },
  projects: [
    // Today's UI: every test, including the visual baselines.
    { name: "default" },
    // The same behaviour tests with the TankOS 2.0 flag on: the new theme must not change how anything works.
    {
      name: "ui2",
      testMatch: ["window-manager.spec.js", "dock-and-apps.spec.js", "layout.spec.js"],
      use: { tankUi: "2" }
    }
  ],
  webServer: {
    command: "node tests/support/serve.js " + PORT,
    url: "http://127.0.0.1:" + PORT + "/index.html",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore"
  }
});
