import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as DesenProtocol from "@desen/protocol";
import type * as DesenValidator from "@desen/validator";
import type * as CatalogPinning from "../src/catalog-pinning.js";

const events = vi.hoisted(() => [] as string[]);

const protocolProbe = vi.hoisted(() => ({
  canonicalBundleCalls: 0,
  canonicalReturnByCall: new Map<number, unknown>(),
  canonicalThrowAt: undefined as number | undefined,
  revisionCalls: 0,
  revisionModeByCall: new Map<number, "invalid" | "mismatch" | "throw">(),
}));

const pinningProbe = vi.hoisted(() => ({
  calls: [] as unknown[][],
  lastResult: undefined as unknown,
  throwOnCall: false,
  transform: undefined as undefined | ((result: unknown) => unknown),
}));

const validatorProbe = vi.hoisted(() => ({
  calls: [] as unknown[][],
  lastResult: undefined as unknown,
  transform: undefined as undefined | ((result: unknown) => unknown),
  throwOnCall: false,
}));

vi.mock("@desen/protocol", async (importOriginal) => {
  const protocol = await importOriginal<typeof DesenProtocol>();
  return {
    ...protocol,
    calculateDesenBundleRevision(bundle: unknown): string {
      protocolProbe.revisionCalls += 1;
      events.push(`revision:${protocolProbe.revisionCalls}`);
      const mode = protocolProbe.revisionModeByCall.get(protocolProbe.revisionCalls);
      if (mode === "throw") throw new TypeError("Injected Bundle revision failure.");
      if (mode === "invalid") return "invalid";
      if (mode === "mismatch") return `sha256:${"9".repeat(64)}`;
      return protocol.calculateDesenBundleRevision(bundle);
    },
    canonicalizeJsonBytes(value: unknown): Uint8Array {
      const isBundle =
        typeof value === "object" &&
        value !== null &&
        Object.getOwnPropertyDescriptor(value, "revision") !== undefined;
      if (isBundle) {
        protocolProbe.canonicalBundleCalls += 1;
        events.push(`canonical:${protocolProbe.canonicalBundleCalls}`);
        if (protocolProbe.canonicalThrowAt === protocolProbe.canonicalBundleCalls) {
          throw new TypeError("Injected Bundle canonicalization failure.");
        }
        if (protocolProbe.canonicalReturnByCall.has(protocolProbe.canonicalBundleCalls)) {
          return protocolProbe.canonicalReturnByCall.get(
            protocolProbe.canonicalBundleCalls,
          ) as Uint8Array;
        }
      }
      return protocol.canonicalizeJsonBytes(value);
    },
  };
});

vi.mock("../src/catalog-pinning.js", async (importOriginal) => {
  const pinning = await importOriginal<typeof CatalogPinning>();
  return {
    ...pinning,
    preflightPublishCatalogPinning(
      ...args: Parameters<typeof pinning.preflightPublishCatalogPinning>
    ): ReturnType<typeof pinning.preflightPublishCatalogPinning> {
      events.push("pinning");
      pinningProbe.calls.push(args);
      if (pinningProbe.throwOnCall) {
        throw new TypeError("Injected Catalog-pinning failure.");
      }
      const result = pinning.preflightPublishCatalogPinning(...args);
      pinningProbe.lastResult = result;
      return (pinningProbe.transform?.(result) ?? result) as ReturnType<
        typeof pinning.preflightPublishCatalogPinning
      >;
    },
  };
});

vi.mock("@desen/validator", async (importOriginal) => {
  const validator = await importOriginal<typeof DesenValidator>();
  return {
    ...validator,
    validateDesenBundleExecutionContracts(
      ...args: Parameters<typeof validator.validateDesenBundleExecutionContracts>
    ): ReturnType<typeof validator.validateDesenBundleExecutionContracts> {
      events.push("validator");
      validatorProbe.calls.push(args);
      if (validatorProbe.throwOnCall) {
        throw new TypeError("Injected Validator failure.");
      }
      const result = validator.validateDesenBundleExecutionContracts(...args);
      validatorProbe.lastResult = result;
      return (validatorProbe.transform?.(result) ?? result) as ReturnType<
        typeof validator.validateDesenBundleExecutionContracts
      >;
    },
  };
});

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  calculateDesenBundleRevision,
  canonicalizeJson,
  canonicalizeJsonBytes,
  createCoreDiagnostic,
  createJsonPointer,
} from "@desen/protocol";

import {
  PUBLISH_BUNDLE_PUBLICATION_LIMITS,
  normalizePublishBundlePublicationLimits,
  publishDesenSourceWithLimits,
  type PublishBundlePublicationLimits,
} from "../src/bundle-publication.js";
import * as publicPublisher from "../src/index.js";
import { publishDesenSource } from "../src/index.js";
import type { PublishFailure, PublishResult, PublishSuccess } from "../src/publish-result.js";

type MutableRecord = Record<string, unknown>;

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown, label = "test fixture"): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as MutableRecord;
}

function candidate(catalog: unknown = clone(validCatalog)): MutableRecord {
  const identity = record(catalog, "Catalog");
  return {
    id: identity.id,
    version: identity.version,
    target: identity.target,
    observedPackageDigest: identity.packageDigest,
    catalog,
  };
}

function profile(maxBundleCanonicalBytes: number): Readonly<PublishBundlePublicationLimits> {
  return Object.freeze({
    catalogPinning: PUBLISH_BUNDLE_PUBLICATION_LIMITS.catalogPinning,
    maxBundleCanonicalBytes,
  });
}

function publish(
  source: unknown = clone(validSource),
  catalog: unknown = clone(validCatalog),
  limits?: Readonly<PublishBundlePublicationLimits>,
): PublishResult {
  const sourceText = typeof source === "string" ? source : JSON.stringify(source);
  return limits === undefined
    ? publishDesenSource(sourceText, [candidate(catalog)] as never)
    : publishDesenSourceWithLimits(sourceText, [candidate(catalog)], limits);
}

function isSuccess(result: PublishResult): result is PublishSuccess {
  return Object.getOwnPropertyDescriptor(result, "ok")?.value === true;
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key !== "length" && "value" in descriptor) pending.push(descriptor.value);
    }
  }
}

function expectFailure(
  result: PublishResult,
  expected: Readonly<{ stage: PublishFailure["stage"]; code: string; pointer: string }>,
): asserts result is PublishFailure {
  expect(isSuccess(result)).toBe(false);
  if (isSuccess(result)) throw new TypeError("Expected publication to fail.");
  expect(Object.keys(result).sort()).toEqual(["diagnostics", "ok", "stage"]);
  expect(result).toMatchObject({ ok: false, stage: expected.stage });
  expect(result.diagnostics[0]).toMatchObject({
    code: expected.code,
    pointer: expected.pointer,
    severity: "error",
    stage: expected.stage,
  });
  for (const key of [
    "bundle",
    "value",
    "source",
    "catalogSet",
    "packages",
    "obligations",
    "pinnedDocument",
    "sourceDigest",
    "revision",
    "publication",
  ]) {
    expect(Object.hasOwn(result, key)).toBe(false);
  }
  expectDeepFrozen(result);
}

function deepFreeze<Value>(root: Value): Value {
  const pending: object[] = typeof root === "object" && root !== null ? [root as object] : [];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === undefined || visited.has(value)) continue;
    visited.add(value);
    for (const child of Object.values(value)) {
      if (typeof child === "object" && child !== null) pending.push(child);
    }
    Object.freeze(value);
  }
  return root;
}

describe("M06-T09 Bundle publication", () => {
  beforeEach(() => {
    events.length = 0;
    protocolProbe.canonicalBundleCalls = 0;
    protocolProbe.canonicalReturnByCall = new Map();
    protocolProbe.canonicalThrowAt = undefined;
    protocolProbe.revisionCalls = 0;
    protocolProbe.revisionModeByCall = new Map();
    pinningProbe.calls = [];
    pinningProbe.lastResult = undefined;
    pinningProbe.throwOnCall = false;
    pinningProbe.transform = undefined;
    validatorProbe.calls = [];
    validatorProbe.lastResult = undefined;
    validatorProbe.transform = undefined;
    validatorProbe.throwOnCall = false;
  });

  it("returns only the exact Validator snapshot and inherited warnings on success", () => {
    const result = publish();

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected publication success.");
    const validatorResult = validatorProbe.lastResult as { value: unknown };
    const pinningResult = pinningProbe.lastResult as { diagnostics: unknown };
    expect(Object.keys(result).sort()).toEqual(["bundle", "diagnostics", "ok"]);
    expect(result.bundle).toBe(validatorResult.value);
    expect(result.diagnostics).toBe(pinningResult.diagnostics);
    expect(result.bundle).not.toBe(validatorProbe.calls[0]?.[0]);
    expect(result.bundle.revision).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(calculateDesenBundleRevision(result.bundle)).toBe(result.bundle.revision);
    expectDeepFrozen(result);
  });

  it("executes T08, revision bootstrap, complete measurement, Validator, and closure once in order", () => {
    const result = publish();

    expect(isSuccess(result)).toBe(true);
    expect(pinningProbe.calls).toHaveLength(1);
    expect(validatorProbe.calls).toHaveLength(1);
    expect(events).toEqual([
      "pinning",
      "revision:1",
      "canonical:1",
      "validator",
      "canonical:2",
      "revision:2",
    ]);
  });

  it("produces a complete revision-closed Bundle inside the terminal byte envelope", () => {
    const result = publish();
    if (!isSuccess(result)) throw new TypeError("Expected complete publication success.");

    const bytes = canonicalizeJsonBytes(result.bundle);
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(bytes.byteLength).toBeLessThanOrEqual(
      PUBLISH_BUNDLE_PUBLICATION_LIMITS.maxBundleCanonicalBytes,
    );
    expect(result.bundle.kind).toBe("desen.bundle");
    expect(calculateDesenBundleRevision(result.bundle)).toBe(result.bundle.revision);
    expect(Object.hasOwn(result.bundle, "publication")).toBe(false);
  });

  it("is independent of root authoring while retaining no authoring member", () => {
    const firstSource = clone(validSource) as unknown;
    const secondSource = clone(validSource) as unknown;
    record(firstSource).authoring = { editor: "alpha", selection: [1] };
    record(secondSource).authoring = { editor: "beta", selection: [2, 3] };

    const first = publish(firstSource);
    const second = publish(secondSource);
    expect(isSuccess(first) && isSuccess(second)).toBe(true);
    if (!isSuccess(first) || !isSuccess(second)) throw new TypeError("Expected two successes.");
    expect(canonicalizeJson(first.bundle)).toBe(canonicalizeJson(second.bundle));
    expect(Object.hasOwn(first.bundle, "authoring")).toBe(false);
  });

  it("keeps semantic extensions revision-sensitive", () => {
    const firstSource = clone(validSource) as unknown;
    const secondSource = clone(validSource) as unknown;
    record(firstSource).extensions = { "dev.desen.test/value": "alpha" };
    record(secondSource).extensions = { "dev.desen.test/value": "beta" };

    const first = publish(firstSource);
    const second = publish(secondSource);
    expect(isSuccess(first) && isSuccess(second)).toBe(true);
    if (!isSuccess(first) || !isSuccess(second)) throw new TypeError("Expected two successes.");
    expect(first.bundle.revision).not.toBe(second.bundle.revision);
    expect(first.bundle.sourceDigest).not.toBe(second.bundle.sourceDigest);
  });

  it("adopts an explicit package digest change without changing Source digest", () => {
    const changedCatalog = clone(validCatalog) as unknown;
    record(changedCatalog).packageDigest = `sha256:${"c".repeat(64)}`;

    const baseline = publish();
    const changed = publish(clone(validSource), changedCatalog);
    expect(isSuccess(baseline) && isSuccess(changed)).toBe(true);
    if (!isSuccess(baseline) || !isSuccess(changed)) throw new TypeError("Expected two successes.");
    expect(changed.bundle.sourceDigest).toBe(baseline.bundle.sourceDigest);
    expect(changed.bundle.revision).not.toBe(baseline.bundle.revision);
    expect(changed.bundle.requires.catalogs[0]?.digest).toBe(record(changedCatalog).packageDigest);
  });

  it("admits the exact complete canonical-byte ceiling", () => {
    const baseline = publish();
    expect(isSuccess(baseline)).toBe(true);
    if (!isSuccess(baseline)) throw new TypeError("Expected baseline success.");
    const bytes = canonicalizeJsonBytes(baseline.bundle).byteLength;

    const exact = publish(clone(validSource), clone(validCatalog), profile(bytes));
    expect(isSuccess(exact)).toBe(true);
  });

  it("rejects one byte above the complete canonical-byte ceiling before Validator work", () => {
    const baseline = publish();
    expect(isSuccess(baseline)).toBe(true);
    if (!isSuccess(baseline)) throw new TypeError("Expected baseline success.");
    const bytes = canonicalizeJsonBytes(baseline.bundle).byteLength;
    validatorProbe.calls = [];

    const result = publish(clone(validSource), clone(validCatalog), profile(bytes - 1));
    expectFailure(result, {
      stage: "bundle-validation",
      code: "BUNDLE_LIMIT_EXCEEDED",
      pointer: "",
    });
    expect(validatorProbe.calls).toHaveLength(0);
  });

  it("measures multibyte canonical UTF-8 rather than JavaScript code units", () => {
    const source = clone(validSource) as unknown;
    record(source).extensions = { "dev.desen.test/emoji": "😀".repeat(16) };
    const baseline = publish(source);
    expect(isSuccess(baseline)).toBe(true);
    if (!isSuccess(baseline)) throw new TypeError("Expected multibyte baseline success.");
    const codeUnits = canonicalizeJson(baseline.bundle).length;
    expect(canonicalizeJsonBytes(baseline.bundle).byteLength).toBeGreaterThan(codeUnits);

    const result = publish(source, clone(validCatalog), profile(codeUnits));
    expectFailure(result, {
      stage: "bundle-validation",
      code: "BUNDLE_LIMIT_EXCEEDED",
      pointer: "",
    });
  });

  it("passes an authenticated predecessor failure through by exact identity", () => {
    const expected = publish("{");
    expectFailure(expected, {
      stage: "json-parse",
      code: "run.desen.publisher/INVALID_SOURCE_JSON",
      pointer: "",
    });
    pinningProbe.transform = () => expected;
    pinningProbe.calls = [];
    validatorProbe.calls = [];

    const result = publish();
    expect(result).toBe(expected);
    expect(pinningProbe.calls).toHaveLength(1);
    expect(validatorProbe.calls).toHaveLength(0);
    expect(protocolProbe.revisionCalls).toBe(0);
  });

  it("contains a thrown predecessor without a partial Bundle", () => {
    pinningProbe.throwOnCall = true;
    expectFailure(publish(), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
    expect(pinningProbe.calls).toHaveLength(1);
    expect(protocolProbe.revisionCalls).toBe(0);
    expect(validatorProbe.calls).toHaveLength(0);
  });

  it("rejects a malformed predecessor shell as validation-authority failure", () => {
    pinningProbe.transform = () => Object.freeze({ catalogsPinned: true });
    const result = publish();
    expectFailure(result, {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
  });

  it("rejects malformed predecessor failure diagnostics instead of passing them through", () => {
    pinningProbe.transform = () =>
      Object.freeze({
        ok: false,
        stage: "source-schema",
        diagnostics: Object.freeze([
          Object.freeze({
            code: "run.desen.publisher/UNKNOWN_FORGED_CODE",
            message: "Forged predecessor diagnostic.",
            pointer: "",
            severity: "error",
            stage: "source-schema",
          }),
        ]),
      });
    expectFailure(publish(), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
  });

  it("rejects mutable or non-warning predecessor success diagnostics", () => {
    const mutations = [
      (result: MutableRecord) => ({
        ...result,
        diagnostics: Object.freeze([
          {
            code: "run.desen.publisher/DEPRECATED_CAPABILITY",
            message: "Source data uses a deprecated Catalog capability.",
            pointer: "",
            context: Object.freeze({ documentId: "com.example.sign-in" }),
            severity: "warning",
            stage: "capability-contracts",
          },
        ]),
      }),
      (result: MutableRecord) => ({
        ...result,
        diagnostics: Object.freeze([
          Object.freeze({
            code: "SCHEMA_INVALID",
            classification: "Error",
            message: "Forged error in a predecessor success.",
            pointer: "",
            severity: "error",
            stage: "source-schema",
          }),
        ]),
      }),
    ];
    for (const mutate of mutations) {
      pinningProbe.transform = (value) => Object.freeze(mutate(record(value)));
      expectFailure(publish(), {
        stage: "bundle-validation",
        code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
        pointer: "",
      });
    }
  });

  it("rejects mutable nested predecessor authority and decorated diagnostic arrays", () => {
    pinningProbe.transform = (value) => {
      const success = record(value);
      const pinnedDocument = record(success.pinnedDocument);
      return Object.freeze({
        ...success,
        pinnedDocument: Object.freeze({
          ...pinnedDocument,
          surfaces: clone(pinnedDocument.surfaces),
        }),
      });
    };
    expectFailure(publish(), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });

    pinningProbe.transform = (value) => {
      const success = record(value);
      const diagnostics = [...(success.diagnostics as readonly unknown[])];
      Object.setPrototypeOf(diagnostics, Object.freeze({ every: () => true }));
      Object.freeze(diagnostics);
      return Object.freeze({ ...success, diagnostics });
    };
    expectFailure(publish(), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
  });

  it("maps provisional revision throws and malformed digests to bundle-revision", () => {
    protocolProbe.revisionModeByCall.set(1, "throw");
    expectFailure(publish(), {
      stage: "bundle-revision",
      code: "REVISION_MISMATCH",
      pointer: "/revision",
    });

    protocolProbe.revisionCalls = 0;
    protocolProbe.revisionModeByCall = new Map([[1, "invalid"]]);
    expectFailure(publish(), {
      stage: "bundle-revision",
      code: "REVISION_MISMATCH",
      pointer: "/revision",
    });
  });

  it("contains candidate canonicalization failure without invoking Validator", () => {
    protocolProbe.canonicalThrowAt = 1;
    const result = publish();
    expectFailure(result, {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
    expect(validatorProbe.calls).toHaveLength(0);
  });

  it("rejects non-byte canonicalization authority at both complete measurements", () => {
    for (const call of [1, 2]) {
      protocolProbe.canonicalBundleCalls = 0;
      protocolProbe.canonicalReturnByCall = new Map([[call, "not canonical bytes"]]);
      expectFailure(publish(), {
        stage: "bundle-validation",
        code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
        pointer: "",
      });
    }
  });

  it("relays exact Validator diagnostics at bundle-validation and never obligations", () => {
    const diagnostic = createCoreDiagnostic({
      code: "ENTRY_NOT_FOUND",
      message: "Injected complete Bundle failure.",
      pointer: createJsonPointer(["entry"]),
    });
    validatorProbe.transform = () =>
      Object.freeze({
        valid: false,
        target: "bundle",
        diagnostics: Object.freeze([diagnostic]),
        obligations: Object.freeze([{ secret: "must-not-leak" }]),
      });

    const result = publish();
    expectFailure(result, {
      stage: "bundle-validation",
      code: "ENTRY_NOT_FOUND",
      pointer: "/entry",
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
  });

  it("contains malformed Validator diagnostic context without throwing", () => {
    const diagnostic = createCoreDiagnostic({
      code: "ENTRY_NOT_FOUND",
      message: "Injected malformed diagnostic context.",
      pointer: createJsonPointer(["entry"]),
    });
    for (const context of [
      null,
      Object.freeze({}),
      Object.freeze({ documentId: "   " }),
      Object.freeze({ subject: null }),
      Object.freeze({ subject: Object.freeze({ kind: "node", id: "" }) }),
      Object.freeze({ subject: Object.freeze({ kind: "unknown", id: "node" }) }),
    ]) {
      validatorProbe.transform = () =>
        Object.freeze({
          valid: false,
          target: "bundle",
          diagnostics: Object.freeze([
            Object.freeze({
              ...diagnostic,
              context,
            }),
          ]),
          obligations: Object.freeze([]),
        });
      expectFailure(publish(), {
        stage: "bundle-validation",
        code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
        pointer: "",
      });
    }
  });

  it("contains a thrown Validator as validation-authority failure", () => {
    validatorProbe.throwOnCall = true;
    expectFailure(publish(), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
  });

  it("rejects forged Validator discriminators, targets, and nonempty success diagnostics", () => {
    const diagnostic = createCoreDiagnostic({
      code: "SCHEMA_INVALID",
      message: "Injected forged diagnostic.",
      pointer: createJsonPointer(),
    });
    const mutations = [
      (result: MutableRecord) => ({ ...result, valid: "true" }),
      (result: MutableRecord) => ({ ...result, target: "source" }),
      (result: MutableRecord) => ({ ...result, diagnostics: Object.freeze([diagnostic]) }),
    ];
    for (const mutate of mutations) {
      validatorProbe.transform = (value) => Object.freeze(mutate(record(value)));
      const result = publish();
      expectFailure(result, {
        stage: "bundle-validation",
        code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
        pointer: "",
      });
    }
  });

  it("rejects a mutable Validator snapshot", () => {
    validatorProbe.transform = (value) => {
      const success = record(value);
      return Object.freeze({
        ...success,
        value: clone(success.value),
      });
    };
    expectFailure(publish(), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
  });

  it("rejects canonical drift instead of returning a plausible Validator clone", () => {
    validatorProbe.transform = (value) => {
      const success = record(value);
      const changed = clone(success.value) as unknown;
      record(changed).id = "com.example.forged";
      return Object.freeze({ ...success, value: deepFreeze(changed) });
    };
    expectFailure(publish(), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
  });

  it("rejects a Validator snapshot that aliases candidate authority", () => {
    validatorProbe.transform = (value) => {
      const success = record(value);
      return Object.freeze({ ...success, value: validatorProbe.calls.at(-1)?.[0] });
    };
    expectFailure(publish(), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });

    validatorProbe.transform = (value) => {
      const success = record(value);
      const snapshot = clone(success.value) as unknown;
      record(snapshot).requires = record(validatorProbe.calls.at(-1)?.[0]).requires;
      return Object.freeze({ ...success, value: deepFreeze(snapshot) });
    };
    expectFailure(publish(), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
  });

  it("detects shared authority beneath an ordinary extension key named length", () => {
    const source = clone(validSource) as unknown;
    record(source).extensions = {
      "dev.desen.test/length": { length: { marker: "semantic" } },
    };
    validatorProbe.transform = (value) => {
      const success = record(value);
      const candidateBundle = record(validatorProbe.calls.at(-1)?.[0]);
      const snapshot = clone(success.value) as unknown;
      const candidateExtensions = record(candidateBundle.extensions);
      const snapshotExtensions = record(record(snapshot).extensions);
      record(snapshotExtensions["dev.desen.test/length"]).length = record(
        candidateExtensions["dev.desen.test/length"],
      ).length;
      return Object.freeze({ ...success, value: deepFreeze(snapshot) });
    };

    expectFailure(publish(source), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
  });

  it("contains Validator-snapshot canonicalization failure", () => {
    protocolProbe.canonicalThrowAt = 2;
    expectFailure(publish(), {
      stage: "bundle-validation",
      code: "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
      pointer: "",
    });
  });

  it("rejects closure helper throws, malformed values, and mismatches", () => {
    for (const mode of ["throw", "invalid", "mismatch"] as const) {
      protocolProbe.revisionCalls = 0;
      protocolProbe.revisionModeByCall = new Map([[2, mode]]);
      const result = publish();
      expectFailure(result, {
        stage: "bundle-revision",
        code: "REVISION_MISMATCH",
        pointer: "/revision",
      });
    }
  });

  it("retains deprecation warnings only on complete success", () => {
    const deprecatedCatalog = clone(validCatalog) as unknown;
    const components = record(record(deprecatedCatalog).components);
    components["com.example.ui/Stack"] = {
      ...record(components["com.example.ui/Stack"]),
      deprecated: true,
    };
    const success = publish(clone(validSource), deprecatedCatalog);
    expect(isSuccess(success)).toBe(true);
    if (!isSuccess(success)) throw new TypeError("Expected deprecated use to publish.");
    expect(success.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "run.desen.publisher/DEPRECATED_CAPABILITY",
        severity: "warning",
      }),
    );

    protocolProbe.revisionCalls = 0;
    protocolProbe.revisionModeByCall = new Map([[2, "mismatch"]]);
    const failed = publish(clone(validSource), deprecatedCatalog);
    expectFailure(failed, {
      stage: "bundle-revision",
      code: "REVISION_MISMATCH",
      pointer: "/revision",
    });
    expect(failed.diagnostics).not.toContainEqual(expect.objectContaining({ severity: "warning" }));
  });

  it("keeps publication and every intermediate authority absent from terminal success", () => {
    const result = publish();
    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected terminal success.");
    for (const key of [
      "stage",
      "source",
      "catalogSet",
      "packages",
      "obligations",
      "pinnedDocument",
      "sourceDigest",
      "revision",
      "publication",
    ]) {
      expect(Object.hasOwn(result, key)).toBe(false);
    }
    expect(Object.hasOwn(result.bundle, "publication")).toBe(false);
    expect(Object.hasOwn(result.bundle, "authoring")).toBe(false);
  });

  it("normalizes hostile limit profiles before Source or package observation", () => {
    let invoked = false;
    const profileInput = Object.create(null) as MutableRecord;
    Object.defineProperty(profileInput, "catalogPinning", {
      enumerable: true,
      get() {
        invoked = true;
        return PUBLISH_BUNDLE_PUBLICATION_LIMITS.catalogPinning;
      },
    });
    Object.defineProperty(profileInput, "maxBundleCanonicalBytes", {
      enumerable: true,
      value: 2_097_152,
    });

    expect(() =>
      publishDesenSourceWithLimits(
        JSON.stringify(validSource),
        [candidate()],
        profileInput as never,
      ),
    ).toThrow(TypeError);
    expect(invoked).toBe(false);
    expect(pinningProbe.calls).toHaveLength(0);
  });

  it("publishes through the package root while keeping limits and private stages hidden", () => {
    expect(publicPublisher.publishDesenSource).toBe(publishDesenSource);
    expect(Object.hasOwn(publicPublisher, "publishDesenSourceWithLimits")).toBe(false);
    expect(Object.hasOwn(publicPublisher, "PUBLISH_BUNDLE_PUBLICATION_LIMITS")).toBe(false);
    expect(Object.hasOwn(publicPublisher, "preflightPublishCatalogPinning")).toBe(false);
    expect(Object.hasOwn(publicPublisher, "BUNDLE_VALIDATION_AUTHORITY_INVALID_CODE")).toBe(false);
    expect(publish()).toMatchObject({ ok: true });
  });

  it("captures the exact finite profile without retaining the caller object", () => {
    const input = {
      catalogPinning: PUBLISH_BUNDLE_PUBLICATION_LIMITS.catalogPinning,
      maxBundleCanonicalBytes: 2_097_152,
    };
    const captured = normalizePublishBundlePublicationLimits(input);
    expect(captured).not.toBe(input);
    expect(captured).toEqual(PUBLISH_BUNDLE_PUBLICATION_LIMITS);
    expectDeepFrozen(captured);
  });
});
