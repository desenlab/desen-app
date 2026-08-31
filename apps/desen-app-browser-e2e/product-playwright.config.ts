import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const APP_ORIGIN = "http://127.0.0.1:4175";
const PACKAGE_ROOT = import.meta.dirname;
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");

export default defineConfig({
  testDir: ".",
  testMatch: "user-created-blank-project.pw.ts",
  outputDir: resolve(PACKAGE_ROOT, "test-results/product"),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [
        ["line"],
        [
          "html",
          {
            open: "never",
            outputFolder: resolve(PACKAGE_ROOT, "playwright-report/product"),
          },
        ],
      ]
    : "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: APP_ORIGIN,
    colorScheme: "light",
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    viewport: { height: 1_000, width: 1_600 },
  },
  projects: [
    {
      name: "product-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { height: 1_000, width: 1_600 },
      },
    },
  ],
  webServer: {
    command: "exec node apps/desen-app-browser-e2e/product-proof-server.mjs",
    cwd: WORKSPACE_ROOT,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    reuseExistingServer: false,
    timeout: 120_000,
    url: APP_ORIGIN,
  },
});
