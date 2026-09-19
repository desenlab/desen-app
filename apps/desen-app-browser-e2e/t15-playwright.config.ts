import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const PACKAGE_ROOT = import.meta.dirname;
const APP_ORIGIN = "http://127.0.0.1:4175";

export default defineConfig({
  testDir: ".",
  testMatch: "t15-masters-instances.pw.ts",
  outputDir: resolve(PACKAGE_ROOT, "test-results/m10a-t15"),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: APP_ORIGIN,
    colorScheme: "light",
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "UTC",
    // Keep useful action frames, but never retain the temporary control-plane credentials.
    trace: {
      mode: "retain-on-failure",
      screenshots: true,
      snapshots: false,
      sources: false,
      attachments: false,
    },
    video: "retain-on-failure",
    viewport: { height: 1_000, width: 1_600 },
  },
  projects: [{ name: "m10a-t15-chromium" }],
  webServer: {
    command: "exec node apps/desen-app-browser-e2e/product-proof-server.mjs",
    cwd: resolve(PACKAGE_ROOT, "../.."),
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    reuseExistingServer: false,
    timeout: 120_000,
    url: APP_ORIGIN,
  },
});
