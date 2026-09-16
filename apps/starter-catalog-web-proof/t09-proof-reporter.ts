import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  STARTER_T09_BROWSER_PROOF_ASSERTION_NAMES,
  STARTER_T09_BROWSER_PROOF_ASSERTION_OWNERS,
  STARTER_T09_BROWSER_PROOF_TEST_TITLES,
} from "./t09-proof-contract.js";

import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

interface ProofReporterOptions {
  readonly outputFile: string;
}

const expectedTitles: readonly string[] = Object.freeze(
  Object.values(STARTER_T09_BROWSER_PROOF_TEST_TITLES).sort(),
);

/** Emits a bounded M10A-T09 claim receipt from exact Playwright case completions. */
export default class StarterT09ProofReporter implements Reporter {
  readonly #outputFile: string;
  readonly #results = new Map<string, "PASS" | "FAIL">();
  #observedTests = 0;

  public constructor(options: ProofReporterOptions) {
    this.#outputFile = options.outputFile;
  }

  public onTestEnd(test: TestCase, result: TestResult): void {
    this.#observedTests += 1;
    if (expectedTitles.includes(test.title)) {
      this.#results.set(test.title, result.status === "passed" ? "PASS" : "FAIL");
    }
  }

  public onEnd(result: FullResult): void {
    const exactInventory =
      this.#observedTests === expectedTitles.length &&
      this.#results.size === expectedTitles.length &&
      expectedTitles.every((title) => this.#results.has(title));
    const passed =
      result.status === "passed" &&
      exactInventory &&
      expectedTitles.every((title) => this.#results.get(title) === "PASS");
    const assertions = Object.fromEntries(
      STARTER_T09_BROWSER_PROOF_ASSERTION_NAMES.map((name) => [
        name,
        this.#results.get(STARTER_T09_BROWSER_PROOF_ASSERTION_OWNERS[name]) === "PASS",
      ]),
    );
    const receipt = Object.freeze({
      profile: "desen.m10a-t09.browser-proof.v1",
      result: passed ? "PASS" : "FAIL",
      tests: expectedTitles.map((title) =>
        Object.freeze({ title, result: this.#results.get(title) ?? "MISSING" }),
      ),
      graphReceipts: Object.freeze(["authoring", "host"]),
      assertions,
    });
    mkdirSync(dirname(this.#outputFile), { recursive: true });
    writeFileSync(this.#outputFile, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  }
}
