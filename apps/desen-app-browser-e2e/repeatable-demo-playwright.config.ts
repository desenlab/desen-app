import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const PACKAGE_ROOT = import.meta.dirname;

export default defineConfig({
  testDir: ".",
  testMatch: "repeatable-demo.pw.ts",
  outputDir: resolve(PACKAGE_ROOT, "test-results/repeatable-demo"),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [
        ["line"],
        [
          "html",
          {
            open: "never",
            outputFolder: resolve(PACKAGE_ROOT, "playwright-report/repeatable-demo"),
          },
        ],
      ]
    : "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5173",
    colorScheme: "light",
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "UTC",
    // Network/DOM snapshots include launcher-owned credentials. The action timeline and
    // screenshot frames are sufficient here; raw transport observations stay in memory.
    trace: {
      mode: "retain-on-failure",
      snapshots: false,
      screenshots: true,
      sources: false,
      attachments: false,
    },
    video: "retain-on-failure",
    viewport: { height: 1_000, width: 1_600 },
  },
  projects: [{ name: "repeatable-demo-chromium" }],
  // The fixture serializes the real CLI lifecycle: close its own child before the same reset
  // path starts a new normal 5173 composition. A busy unrelated server is never reused or killed.
});
