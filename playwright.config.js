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
    toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css" }
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
  webServer: {
    command: "node tests/support/serve.js " + PORT,
    url: "http://127.0.0.1:" + PORT + "/index.html",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore"
  }
});
