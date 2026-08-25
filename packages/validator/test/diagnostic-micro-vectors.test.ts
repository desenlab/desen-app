import { describe, expect, it } from "vitest";

import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import * as validatorApi from "../src/index.js";
import { runValidatorDiagnosticMicroVectorSuite } from "./diagnostic-micro-vector-suite.js";

const fixtures = Object.freeze({ validCatalog, validSource });

describe("M02-T13 validator-owned diagnostic micro-vectors", () => {
  it("passes one positive and one negative vector for all 28 core and 6 extension codes", () => {
    const transcript = runValidatorDiagnosticMicroVectorSuite(validatorApi, fixtures);

    expect(transcript.summary).toEqual({
      diagnosticCodes: 34,
      core: 28,
      extensions: 6,
      positiveVectors: 34,
      negativeVectors: 34,
      passingPairs: 34,
      pass: true,
    });
    expect(transcript.cases.every(({ positive }) => positive.valid)).toBe(true);
    expect(transcript.cases.every(({ negative }) => !negative.valid)).toBe(true);
  }, 10_000);

  it("covers the exact M02-T13 core trace ledger and excludes later-owner diagnostics", () => {
    const transcript = runValidatorDiagnosticMicroVectorSuite(validatorApi, fixtures);

    expect(
      transcript.cases.flatMap(({ traceId }) => (traceId === undefined ? [] : [traceId])),
    ).toEqual([
      "D-001",
      "D-002",
      "D-003",
      "D-004",
      "D-005",
      "D-006",
      "D-007",
      "D-008",
      "D-009",
      "D-010",
      "D-011",
      "D-012",
      "D-013",
      "D-014",
      "D-015",
      "D-016",
      "D-017",
      "D-018",
      "D-019",
      "D-020",
      "D-021",
      "D-022",
      "D-023",
      "D-024",
      "D-025",
      "D-027",
      "D-028",
      "D-034",
    ]);
    expect(transcript.excludedCoreDiagnostics).toEqual([
      "OPERATION_DENIED",
      "ACTION_LIMIT_EXCEEDED",
      "REVISION_MISMATCH",
      "SOURCE_DIGEST_MISMATCH",
      "CATALOG_DIGEST_MISMATCH",
      "CATALOG_VERSION_UNAVAILABLE",
      "BUNDLE_LIMIT_EXCEEDED",
      "ADAPTER_FAILURE",
    ]);
  });

  it("retains exact code, classification, and pointer contracts", () => {
    const transcript = runValidatorDiagnosticMicroVectorSuite(validatorApi, fixtures);

    for (const vector of transcript.cases) {
      expect(vector.positive.diagnostics, vector.id).toEqual([]);
      expect(vector.negative.diagnostics, vector.id).toEqual([vector.expected]);
      if (vector.scope === "extension") {
        expect(vector.expected, vector.id).not.toHaveProperty("classification");
      }
    }
  });

  it("is byte-repeatable, deeply frozen, and isolated from caller-owned inputs", () => {
    const first = runValidatorDiagnosticMicroVectorSuite(validatorApi, fixtures);
    const second = runValidatorDiagnosticMicroVectorSuite(validatorApi, fixtures);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(
      first.cases.every(
        ({ positive, negative }) =>
          positive.deepFrozen &&
          negative.deepFrozen &&
          positive.inputUnchanged &&
          negative.inputUnchanged &&
          positive.repeatable &&
          negative.repeatable,
      ),
    ).toBe(true);
  }, 20_000);
});
