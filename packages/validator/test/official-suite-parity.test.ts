import { calculateDesenBundleRevision } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import manifest from "../../protocol/upstream/0.1.0/snapshot/conformance/vectors.json";
import bundleCatalogDigestMismatch from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/bundle-catalog-digest-mismatch.json";
import bundleRevisionMismatch from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/bundle-revision-mismatch.json";
import sourceDuplicateNodeId from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-duplicate-node-id.json";
import sourceUnknownCapability from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-capability.json";
import sourceUnknownCoreField from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-core-field.json";
import sourceUnknownEvent from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-event.json";
import validBundle from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import exampleCatalog from "../../protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json";
import exampleBundle from "../../protocol/upstream/0.1.0/snapshot/examples/sign-in.bundle.desen.json";
import exampleSource from "../../protocol/upstream/0.1.0/snapshot/examples/sign-in.source.desen.json";
import exampleSortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import exampleStoreMapSource from "../../protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json";
import {
  validateDesenBundleExecutionContracts,
  validateDesenExecutionCatalogSet,
  validateDesenSourceExecutionContracts,
} from "../src/index.js";

type SuiteTarget = "bundle" | "catalog" | "source";
type SuiteInvalidOutcome =
  "activation_error" | "catalog_error" | "integrity_error" | "schema_error" | "semantic_error";

type SuiteExpectation =
  | Readonly<{ readonly outcome: "valid" }>
  | Readonly<{ readonly code: string; readonly outcome: SuiteInvalidOutcome }>;

interface SuiteDiagnostic {
  readonly code: string;
  readonly pointer?: string;
  readonly suiteOutcome?: SuiteInvalidOutcome;
}

interface SuiteCase {
  readonly origin: "example" | "vector";
  readonly file: string;
  readonly target: SuiteTarget;
  readonly catalog: string | null;
  readonly document: unknown;
  readonly catalogs: readonly unknown[];
  readonly expected: SuiteExpectation;
}

interface SuiteCaseResult {
  readonly origin: SuiteCase["origin"];
  readonly file: string;
  readonly target: SuiteTarget;
  readonly catalog: string | null;
  readonly expected: SuiteExpectation;
  readonly received: readonly SuiteDiagnostic[];
  readonly pass: boolean;
}

interface DiagnosticLike {
  readonly code: string;
  readonly pointer?: string;
  readonly classification?: string;
  readonly suiteOutcome?: SuiteInvalidOutcome;
}

interface BundleForSupplements {
  readonly revision: string;
  readonly requires: Readonly<{
    readonly catalogs: readonly Readonly<{
      readonly id: string;
      readonly version: string;
      readonly target: string;
      readonly digest: string;
    }>[];
  }>;
}

interface CatalogForSupplements {
  readonly id: string;
  readonly version: string;
  readonly target: string;
  readonly packageDigest: string;
}

const VECTOR_DOCUMENTS = Object.freeze({
  "invalid/bundle-catalog-digest-mismatch.json": bundleCatalogDigestMismatch,
  "invalid/bundle-revision-mismatch.json": bundleRevisionMismatch,
  "invalid/source-duplicate-node-id.json": sourceDuplicateNodeId,
  "invalid/source-unknown-capability.json": sourceUnknownCapability,
  "invalid/source-unknown-core-field.json": sourceUnknownCoreField,
  "invalid/source-unknown-event.json": sourceUnknownEvent,
  "valid/sign-in.bundle.json": validBundle,
  "valid/sign-in.source.json": validSource,
  "valid/web.catalog.json": validCatalog,
} satisfies Readonly<Record<string, unknown>>);

const EMPTY_CATALOGS = Object.freeze([]) as readonly unknown[];
const CONFORMANCE_CATALOGS = Object.freeze([validCatalog]) as readonly unknown[];
const EXAMPLE_CATALOGS = Object.freeze([exampleCatalog]) as readonly unknown[];
const VALID_EXPECTATION = Object.freeze({ outcome: "valid" as const });

function exampleCase(file: string, target: SuiteTarget, document: unknown): SuiteCase {
  const needsCatalog = target !== "catalog";
  return Object.freeze({
    origin: "example",
    file,
    target,
    catalog: needsCatalog ? "catalog.web.example.json" : null,
    document,
    catalogs: needsCatalog ? EXAMPLE_CATALOGS : EMPTY_CATALOGS,
    expected: VALID_EXPECTATION,
  });
}

const EXAMPLE_CASES: readonly SuiteCase[] = Object.freeze([
  exampleCase("catalog.web.example.json", "catalog", exampleCatalog),
  exampleCase("sign-in.source.desen.json", "source", exampleSource),
  exampleCase("sign-in.bundle.desen.json", "bundle", exampleBundle),
  exampleCase("store-map.source.desen.json", "source", exampleStoreMapSource),
  exampleCase("sortable-list.source.desen.json", "source", exampleSortableSource),
]);

function target(value: string): SuiteTarget {
  if (value === "bundle" || value === "catalog" || value === "source") return value;
  throw new TypeError(`Unknown official-suite target: ${value}`);
}

function invalidOutcome(value: string): SuiteInvalidOutcome {
  switch (value) {
    case "activation_error":
    case "catalog_error":
    case "integrity_error":
    case "schema_error":
    case "semantic_error":
      return value;
    default:
      throw new TypeError(`Unknown official-suite outcome: ${value}`);
  }
}

function expectation(outcome: string, code: string | undefined): SuiteExpectation {
  if (outcome === "valid") return VALID_EXPECTATION;
  if (code === undefined) throw new TypeError(`Official invalid outcome ${outcome} has no code.`);
  return Object.freeze({ outcome: invalidOutcome(outcome), code });
}

function requiredVectorDocument(file: string): unknown {
  if (!Object.hasOwn(VECTOR_DOCUMENTS, file)) {
    throw new TypeError(`Official vector fixture is not statically routed: ${file}`);
  }
  return VECTOR_DOCUMENTS[file as keyof typeof VECTOR_DOCUMENTS];
}

function officialCases(): readonly SuiteCase[] {
  const vectors = manifest.vectors.map((vector): SuiteCase => {
    const vectorTarget = target(vector.target);
    return Object.freeze({
      origin: "vector",
      file: vector.file,
      target: vectorTarget,
      catalog: vectorTarget === "catalog" ? null : manifest.catalog,
      document: requiredVectorDocument(vector.file),
      catalogs: vectorTarget === "catalog" ? EMPTY_CATALOGS : CONFORMANCE_CATALOGS,
      expected: expectation(vector.expect, vector.code),
    });
  });
  return Object.freeze([...vectors, ...EXAMPLE_CASES]);
}

/** Maps validator diagnostics only when code and Appendix B classification agree. */
function suiteOutcomeForDiagnostic(diagnostic: DiagnosticLike): SuiteInvalidOutcome | undefined {
  switch (diagnostic.code) {
    case "UNKNOWN_CORE_FIELD":
      return diagnostic.classification === "schema" ? "schema_error" : undefined;
    case "DUPLICATE_NODE_ID":
      return diagnostic.classification === "semantic" ? "semantic_error" : undefined;
    case "UNKNOWN_CAPABILITY":
    case "UNKNOWN_EVENT":
      return diagnostic.classification === "catalog" ? "catalog_error" : undefined;
    default:
      return undefined;
  }
}

function normalizeDiagnostics(diagnostics: readonly DiagnosticLike[]): readonly SuiteDiagnostic[] {
  const normalized = diagnostics.map((diagnostic): SuiteDiagnostic => {
    const suiteOutcome = diagnostic.suiteOutcome ?? suiteOutcomeForDiagnostic(diagnostic);
    return Object.freeze({
      code: diagnostic.code,
      ...(diagnostic.pointer === undefined ? {} : { pointer: diagnostic.pointer }),
      ...(suiteOutcome === undefined ? {} : { suiteOutcome }),
    });
  });
  normalized.sort((left, right) => {
    const pointerOrder = compareText(left.pointer ?? "", right.pointer ?? "");
    if (pointerOrder !== 0) return pointerOrder;
    return compareText(left.code, right.code);
  });
  return Object.freeze(normalized);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function bundleSupplements(
  bundle: BundleForSupplements,
  catalogs: readonly CatalogForSupplements[],
): readonly DiagnosticLike[] {
  const diagnostics: DiagnosticLike[] = [];
  if (bundle.revision !== calculateDesenBundleRevision(bundle)) {
    diagnostics.push(
      Object.freeze({
        code: "REVISION_MISMATCH",
        pointer: "/revision",
        suiteOutcome: "integrity_error",
      }),
    );
  }

  bundle.requires.catalogs.forEach((requirement, index) => {
    const installed = catalogs.find(
      (catalog) =>
        catalog.id === requirement.id &&
        catalog.version === requirement.version &&
        catalog.target === requirement.target,
    );
    if (installed !== undefined && installed.packageDigest !== requirement.digest) {
      diagnostics.push(
        Object.freeze({
          code: "CATALOG_DIGEST_MISMATCH",
          pointer: `/requires/catalogs/${index}/digest`,
          suiteOutcome: "activation_error",
        }),
      );
    }
  });
  return Object.freeze(diagnostics);
}

function validateCase(suiteCase: SuiteCase): readonly SuiteDiagnostic[] {
  if (suiteCase.target === "catalog") {
    return normalizeDiagnostics(validateDesenExecutionCatalogSet([suiteCase.document]).diagnostics);
  }

  const catalogs = validateDesenExecutionCatalogSet(suiteCase.catalogs);
  if (!catalogs.valid) return normalizeDiagnostics(catalogs.diagnostics);
  if (suiteCase.target === "source") {
    return normalizeDiagnostics(
      validateDesenSourceExecutionContracts(suiteCase.document, catalogs.value).diagnostics,
    );
  }

  const result = validateDesenBundleExecutionContracts(suiteCase.document, catalogs.value);
  if (!result.valid) return normalizeDiagnostics(result.diagnostics);
  return normalizeDiagnostics([
    ...result.diagnostics,
    ...bundleSupplements(result.value, catalogs.value),
  ]);
}

function matchesExpectation(
  expected: SuiteExpectation,
  received: readonly SuiteDiagnostic[],
): boolean {
  if (expected.outcome === "valid") return received.length === 0;
  return received.some(
    (diagnostic) =>
      diagnostic.code === expected.code && diagnostic.suiteOutcome === expected.outcome,
  );
}

function runOfficialSuite(cases = officialCases()) {
  const results = cases.map((suiteCase): SuiteCaseResult => {
    const received = validateCase(suiteCase);
    return Object.freeze({
      origin: suiteCase.origin,
      file: suiteCase.file,
      target: suiteCase.target,
      catalog: suiteCase.catalog,
      expected: suiteCase.expected,
      received,
      pass: matchesExpectation(suiteCase.expected, received),
    });
  });
  const passed = results.filter((result) => result.pass).length;
  return Object.freeze({
    status: passed === results.length ? ("PASS" as const) : ("FAIL" as const),
    summary: Object.freeze({ total: results.length, vectors: 9, examples: 5, passed }),
    cases: Object.freeze(results),
  });
}

function fixtureSnapshot(): string {
  return JSON.stringify({
    manifest,
    VECTOR_DOCUMENTS,
    exampleCatalog,
    exampleBundle,
    exampleSource,
    exampleSortableSource,
    exampleStoreMapSource,
  });
}

function isDeepFrozen(root: unknown): boolean {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    if (!Object.isFrozen(value)) return false;
    pending.push(...Object.values(value));
  }
  return true;
}

describe("DESEN 0.1.0 official TypeScript suite parity", () => {
  it("routes the exact 9 manifest vectors followed by the 5 public examples", () => {
    expect({ version: manifest.version, catalog: manifest.catalog }).toEqual({
      version: "0.1.0",
      catalog: "valid/web.catalog.json",
    });
    expect(
      officialCases().map((suiteCase) => [
        suiteCase.origin,
        suiteCase.file,
        suiteCase.target,
        suiteCase.catalog,
        suiteCase.expected.outcome,
        "code" in suiteCase.expected ? suiteCase.expected.code : null,
      ]),
    ).toEqual([
      ["vector", "valid/sign-in.source.json", "source", "valid/web.catalog.json", "valid", null],
      ["vector", "valid/sign-in.bundle.json", "bundle", "valid/web.catalog.json", "valid", null],
      ["vector", "valid/web.catalog.json", "catalog", null, "valid", null],
      [
        "vector",
        "invalid/source-unknown-core-field.json",
        "source",
        "valid/web.catalog.json",
        "schema_error",
        "UNKNOWN_CORE_FIELD",
      ],
      [
        "vector",
        "invalid/source-duplicate-node-id.json",
        "source",
        "valid/web.catalog.json",
        "semantic_error",
        "DUPLICATE_NODE_ID",
      ],
      [
        "vector",
        "invalid/source-unknown-capability.json",
        "source",
        "valid/web.catalog.json",
        "catalog_error",
        "UNKNOWN_CAPABILITY",
      ],
      [
        "vector",
        "invalid/source-unknown-event.json",
        "source",
        "valid/web.catalog.json",
        "catalog_error",
        "UNKNOWN_EVENT",
      ],
      [
        "vector",
        "invalid/bundle-revision-mismatch.json",
        "bundle",
        "valid/web.catalog.json",
        "integrity_error",
        "REVISION_MISMATCH",
      ],
      [
        "vector",
        "invalid/bundle-catalog-digest-mismatch.json",
        "bundle",
        "valid/web.catalog.json",
        "activation_error",
        "CATALOG_DIGEST_MISMATCH",
      ],
      ["example", "catalog.web.example.json", "catalog", null, "valid", null],
      ["example", "sign-in.source.desen.json", "source", "catalog.web.example.json", "valid", null],
      ["example", "sign-in.bundle.desen.json", "bundle", "catalog.web.example.json", "valid", null],
      [
        "example",
        "store-map.source.desen.json",
        "source",
        "catalog.web.example.json",
        "valid",
        null,
      ],
      [
        "example",
        "sortable-list.source.desen.json",
        "source",
        "catalog.web.example.json",
        "valid",
        null,
      ],
    ]);
  });

  it("passes all 14 cases with the exact received diagnostic identities", () => {
    const result = runOfficialSuite();
    expect(result.status).toBe("PASS");
    expect(result.summary).toEqual({ total: 14, vectors: 9, examples: 5, passed: 14 });
    expect(
      result.cases.map(({ file, received }) => [
        file,
        received.map(({ code, pointer, suiteOutcome }) => [
          code,
          pointer ?? null,
          suiteOutcome ?? null,
        ]),
      ]),
    ).toEqual([
      ["valid/sign-in.source.json", []],
      ["valid/sign-in.bundle.json", []],
      ["valid/web.catalog.json", []],
      [
        "invalid/source-unknown-core-field.json",
        [["UNKNOWN_CORE_FIELD", "/script", "schema_error"]],
      ],
      [
        "invalid/source-duplicate-node-id.json",
        [["DUPLICATE_NODE_ID", "/surfaces/home/root/slots/default/1/id", "semantic_error"]],
      ],
      [
        "invalid/source-unknown-capability.json",
        [["UNKNOWN_CAPABILITY", "/surfaces/home/root/slots/default/0/use", "catalog_error"]],
      ],
      [
        "invalid/source-unknown-event.json",
        [["UNKNOWN_EVENT", "/surfaces/home/root/slots/default/0/on/teleport", "catalog_error"]],
      ],
      [
        "invalid/bundle-revision-mismatch.json",
        [["REVISION_MISMATCH", "/revision", "integrity_error"]],
      ],
      [
        "invalid/bundle-catalog-digest-mismatch.json",
        [["CATALOG_DIGEST_MISMATCH", "/requires/catalogs/0/digest", "activation_error"]],
      ],
      ["catalog.web.example.json", []],
      ["sign-in.source.desen.json", []],
      ["sign-in.bundle.desen.json", []],
      ["store-map.source.desen.json", []],
      ["sortable-list.source.desen.json", []],
    ]);
  });

  it("uses the official membership rule and keeps revision/digest checks outside T11", () => {
    const expected: SuiteExpectation = Object.freeze({
      outcome: "integrity_error",
      code: "REVISION_MISMATCH",
    });
    expect(
      matchesExpectation(expected, [
        Object.freeze({ code: "UNEXPECTED" }),
        Object.freeze({ code: "REVISION_MISMATCH", suiteOutcome: "integrity_error" }),
      ]),
    ).toBe(true);
    expect(
      matchesExpectation(Object.freeze({ outcome: "valid" }), [Object.freeze({ code: "EXTRA" })]),
    ).toBe(false);

    const wronglyClassified = normalizeDiagnostics([
      Object.freeze({
        code: "UNKNOWN_CORE_FIELD",
        classification: "semantic",
        pointer: "/script",
      }),
    ]);
    expect(wronglyClassified).toEqual([{ code: "UNKNOWN_CORE_FIELD", pointer: "/script" }]);
    expect(
      matchesExpectation(
        Object.freeze({ outcome: "schema_error", code: "UNKNOWN_CORE_FIELD" }),
        wronglyClassified,
      ),
    ).toBe(false);

    const catalogs = validateDesenExecutionCatalogSet([validCatalog]);
    expect(catalogs.valid).toBe(true);
    if (!catalogs.valid) throw new TypeError("Expected the frozen conformance catalog to pass.");
    expect(
      validateDesenBundleExecutionContracts(bundleRevisionMismatch, catalogs.value).valid,
    ).toBe(true);
    expect(
      validateDesenBundleExecutionContracts(bundleCatalogDigestMismatch, catalogs.value).valid,
    ).toBe(true);
    expect(bundleSupplements(bundleRevisionMismatch, catalogs.value)).toEqual([
      { code: "REVISION_MISMATCH", pointer: "/revision", suiteOutcome: "integrity_error" },
    ]);
    expect(bundleSupplements(bundleCatalogDigestMismatch, catalogs.value)).toEqual([
      {
        code: "CATALOG_DIGEST_MISMATCH",
        pointer: "/requires/catalogs/0/digest",
        suiteOutcome: "activation_error",
      },
    ]);
  });

  it("is recursively immutable, non-mutating, JSON-portable, and repeat deterministic", () => {
    const before = fixtureSnapshot();
    const first = runOfficialSuite();
    const second = runOfficialSuite();
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(fixtureSnapshot()).toBe(before);
    expect(isDeepFrozen(first)).toBe(true);
    expect(() => JSON.stringify(first)).not.toThrow();
  });
});
