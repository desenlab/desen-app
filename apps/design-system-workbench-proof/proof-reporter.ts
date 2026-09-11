import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  WORKBENCH_BROWSER_PROOF_ASSERTIONS_BY_TEST_TITLE,
  WORKBENCH_BROWSER_PROOF_ASSERTION_NAMES,
  WORKBENCH_BROWSER_PROOF_TEST_TITLES,
} from "./proof-contract.js";

import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

interface ProofReporterOptions {
  readonly outputFile: string;
}

const expectedTitles: readonly string[] = Object.freeze(
  Object.values(WORKBENCH_BROWSER_PROOF_TEST_TITLES).sort(),
);
const assertionOwners = new Map<string, string>();

for (const [title, assertions] of Object.entries(
  WORKBENCH_BROWSER_PROOF_ASSERTIONS_BY_TEST_TITLE,
)) {
  for (const assertion of assertions) {
    if (assertionOwners.has(assertion)) {
      throw new TypeError(`Browser assertion ${assertion} has more than one owning test.`);
    }
    assertionOwners.set(assertion, title);
  }
}
if (
  assertionOwners.size !== WORKBENCH_BROWSER_PROOF_ASSERTION_NAMES.length ||
  WORKBENCH_BROWSER_PROOF_ASSERTION_NAMES.some((name) => !assertionOwners.has(name))
) {
  throw new TypeError("Browser proof assertion ownership is incomplete or widened.");
}

/** Emits a bounded receipt from the exact reviewed browser case inventory. */
export default class WorkbenchProofReporter implements Reporter {
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
      WORKBENCH_BROWSER_PROOF_ASSERTION_NAMES.map((name) => [
        name,
        this.#results.get(assertionOwners.get(name) ?? "") === "PASS",
      ]),
    );
    const receipt = Object.freeze({
      profile: "desen.m10a-t03.browser-proof.v1",
      result: passed ? "PASS" : "FAIL",
      tests: expectedTitles.map((title) =>
        Object.freeze({ title, result: this.#results.get(title) ?? "MISSING" }),
      ),
      graphReceipts: Object.freeze(["theme-workbench"]),
      assertions,
    });
    mkdirSync(dirname(this.#outputFile), { recursive: true });
    writeFileSync(this.#outputFile, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  }
}
