import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const PACKAGE_ROOT = import.meta.dirname;

export default defineConfig({
  testDir: ".",
  testMatch: "restart-recovery.pw.ts",
  outputDir: resolve(PACKAGE_ROOT, "test-results/restart-recovery"),
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
            outputFolder: resolve(PACKAGE_ROOT, "playwright-report/restart-recovery"),
          },
        ],
      ]
    : "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4179",
    colorScheme: "light",
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "UTC",
    // Playwright couples network recording to snapshots. Preserve action/screenshot evidence
    // without recording the normal local App's ephemeral authorization headers or bundle config.
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
  projects: [{ name: "restart-recovery-chromium" }],
  // The typed test fixture owns a real IPC child so it can await complete process exit and
  // cold-start every service against the same private root without a privileged HTTP test API.
});
