import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const APP_ORIGIN = "http://127.0.0.1:4192";
const PACKAGE_ROOT = import.meta.dirname;
const configuredProofTemp = process.env.DESEN_M10A_T09_PROOF_TEMP;
const proofTemp = configuredProofTemp ?? mkdtempSync(`${tmpdir()}/desen-m10a-t09-playwright-`);
if (!isAbsolute(proofTemp) || resolve(proofTemp) !== proofTemp) {
  throw new TypeError("DESEN_M10A_T09_PROOF_TEMP must be an absolute runner-owned temp directory.");
}
const browserProofPath = resolve(proofTemp, "browser-proof.json");
rmSync(browserProofPath, { force: true });

export default defineConfig({
  testDir: PACKAGE_ROOT,
  testMatch: "starter-catalog-web-t09.pw.ts",
  outputDir: resolve(proofTemp, "playwright-artifacts"),
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["line"],
    ["json", { outputFile: resolve(proofTemp, "browser-report.json") }],
    [resolve(PACKAGE_ROOT, "t09-proof-reporter.ts"), { outputFile: browserProofPath }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: APP_ORIGIN,
    colorScheme: "light",
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    video: "off",
    viewport: { height: 1_100, width: 1_440 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/serve-t09-proof.mjs",
    cwd: PACKAGE_ROOT,
    reuseExistingServer: false,
    timeout: 30_000,
    url: `${APP_ORIGIN}/t09-authoring.html`,
  },
});
