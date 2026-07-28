import { createCoreDiagnostic, createJsonPointer } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import {
  getPublisherDiagnosticDefinition,
  INVALID_SOURCE_JSON_CODE,
  isPublisherDiagnosticCode,
  PUBLISH_PIPELINE_STAGES,
  PUBLISH_SOURCE_JSON_LIMITS,
  PUBLISHER_DIAGNOSTIC_REGISTRY,
  SOURCE_LIMIT_EXCEEDED_CODE,
} from "../src/index.js";
import {
  annotatePublishErrorDiagnostic,
  createPublishFailure,
  normalizePublishDiagnostics,
} from "../src/publish-diagnostics.js";
import { parseSourceJson } from "../src/source-json.js";

import type { DesenDiagnostic } from "@desen/protocol";
import type { PublishSourceJsonLimits } from "../src/source-json.js";

function limits(
  override: Partial<PublishSourceJsonLimits> = {},
): Readonly<PublishSourceJsonLimits> {
  return {
    maxSourceUtf8Bytes: 1_024,
    maxJsonDepth: 32,
    maxJsonValueOccurrences: 128,
    maxDecodedStringCodeUnits: 512,
    maxNumberTokenCodeUnits: 64,
    ...override,
  };
}

describe("Publisher result and diagnostics contract", () => {
  it("pins the sixteen required publication stages in normative order", () => {
    expect(PUBLISH_PIPELINE_STAGES).toEqual([
      "json-parse",
      "source-schema",
      "embedded-schema",
      "source-semantics",
      "catalog-resolution",
      "catalog-integrity",
      "namespace-conflicts",
      "capability-contracts",
      "state-and-control-flow",
      "binding-compatibility",
      "source-digest",
      "authoring-removal",
      "normalization",
      "catalog-pinning",
      "bundle-validation",
      "bundle-revision",
    ]);
    expect(Object.isFrozen(PUBLISH_PIPELINE_STAGES)).toBe(true);
  });

  it("exposes a frozen, collision-resistant Publisher diagnostic registry", () => {
    expect(PUBLISHER_DIAGNOSTIC_REGISTRY).toEqual([
      {
        code: INVALID_SOURCE_JSON_CODE,
        meaning: "Raw Source input is not interoperable JSON.",
        defaultStage: "json-parse",
        defaultSeverity: "error",
      },
      {
        code: SOURCE_LIMIT_EXCEEDED_CODE,
        meaning: "Raw Source parsing exceeded the finite Publisher profile.",
        defaultStage: "json-parse",
        defaultSeverity: "error",
      },
    ]);
    expect(Object.isFrozen(PUBLISHER_DIAGNOSTIC_REGISTRY)).toBe(true);
    PUBLISHER_DIAGNOSTIC_REGISTRY.forEach((definition) =>
      expect(Object.isFrozen(definition)).toBe(true),
    );

    expect(isPublisherDiagnosticCode(INVALID_SOURCE_JSON_CODE)).toBe(true);
    expect(isPublisherDiagnosticCode(SOURCE_LIMIT_EXCEEDED_CODE)).toBe(true);
    expect(isPublisherDiagnosticCode("SCHEMA_INVALID")).toBe(false);
    expect(isPublisherDiagnosticCode("run.desen.publisher/UNKNOWN")).toBe(false);
    expect(getPublisherDiagnosticDefinition(INVALID_SOURCE_JSON_CODE)).toBe(
      PUBLISHER_DIAGNOSTIC_REGISTRY[0],
    );
    expect(getPublisherDiagnosticDefinition("unknown")).toBeUndefined();
  });

  it("keeps core classification while sorting and de-duplicating diagnostics deterministically", () => {
    const later = annotatePublishErrorDiagnostic(
      createCoreDiagnostic({
        code: "ENTRY_NOT_FOUND",
        message: "The entry surface does not exist.",
        pointer: createJsonPointer(["entry"]),
        context: { documentId: "com.example.app" },
      }),
      "source-semantics",
    );
    const earlier = annotatePublishErrorDiagnostic(
      createCoreDiagnostic({
        code: "SCHEMA_INVALID",
        message: "The parsed Source failed its normative schema.",
        pointer: createJsonPointer(),
      }),
      "source-schema",
    );

    const normalized = normalizePublishDiagnostics([later, earlier, later]);
    expect(normalized).toEqual([earlier, later]);
    expect(normalized[0]).toMatchObject({
      code: "SCHEMA_INVALID",
      classification: "schema",
      severity: "error",
      stage: "source-schema",
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized[0])).toBe(true);
  });

  it("derives one closed failure stage and rejects empty or cross-stage error collections", () => {
    const parseError = annotatePublishErrorDiagnostic(
      Object.freeze({
        code: INVALID_SOURCE_JSON_CODE,
        message: "Source input is not interoperable JSON.",
        pointer: createJsonPointer(),
      }) satisfies Readonly<DesenDiagnostic<typeof INVALID_SOURCE_JSON_CODE>>,
      "json-parse",
    );
    const schemaError = annotatePublishErrorDiagnostic(
      createCoreDiagnostic({
        code: "SCHEMA_INVALID",
        message: "The parsed Source failed its normative schema.",
        pointer: createJsonPointer(),
      }),
      "source-schema",
    );
    const failure = createPublishFailure([parseError, parseError]);

    expect(failure).toEqual({
      ok: false,
      stage: "json-parse",
      diagnostics: [parseError],
    });
    expect(Object.hasOwn(failure, "bundle")).toBe(false);
    expect(Object.isFrozen(failure)).toBe(true);
    expect(Object.isFrozen(failure.diagnostics)).toBe(true);
    expect(() => createPublishFailure([])).toThrow(
      "A rejected publication requires at least one blocking diagnostic.",
    );
    expect(() => createPublishFailure([schemaError, parseError])).toThrow(
      "A rejected publication cannot combine errors from different stages.",
    );
  });
});

describe("strict package-private Source JSON stage", () => {
  it("returns a detached, recursively frozen JSON snapshot without exposing a Bundle", () => {
    const result = parseSourceJson(
      '{"kind":"desen.source","nested":{"items":[true,null,1]},"__proto__":{"safe":true}}',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected Source JSON parsing to succeed");

    expect(result.diagnostics).toEqual([]);
    expect(Object.hasOwn(result, "bundle")).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.value)).toBe(true);
    const value = result.value as {
      readonly nested: { readonly items: readonly unknown[] };
      readonly __proto__: { readonly safe: boolean };
    };
    expect(Object.isFrozen(value.nested)).toBe(true);
    expect(Object.isFrozen(value.nested.items)).toBe(true);
    expect(Object.hasOwn(value, "__proto__")).toBe(true);
    expect(value.__proto__).toEqual({ safe: true });
  });

  it("rejects malformed or non-string input with one redacted staged diagnostic and no Bundle", () => {
    const secret = "private-source-fragment";
    const malformed = parseSourceJson(`{"id":"${secret}",`);
    const nonString = parseSourceJson({ id: secret });

    for (const result of [malformed, nonString]) {
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected Source JSON parsing to fail");
      expect(result.stage).toBe("json-parse");
      expect(Object.hasOwn(result, "bundle")).toBe(false);
      expect(Object.hasOwn(result, "value")).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toEqual({
        code: INVALID_SOURCE_JSON_CODE,
        message: "Source input is not interoperable JSON.",
        pointer: "",
        stage: "json-parse",
        severity: "error",
      });
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.diagnostics)).toBe(true);
      expect(Object.isFrozen(result.diagnostics[0])).toBe(true);
    }
  });

  it("rejects duplicate decoded member names before value-based canonicalization", () => {
    const direct = parseSourceJson('{"a":1,"a":2}');
    const escaped = parseSourceJson('{"nested":{"a":1,"\\u0061":2}}');

    expect(direct.ok).toBe(false);
    expect(escaped.ok).toBe(false);
    if (direct.ok || escaped.ok) throw new Error("expected duplicate members to fail");
    expect(direct.diagnostics[0]).toMatchObject({
      code: INVALID_SOURCE_JSON_CODE,
      pointer: "/a",
      message: "Source JSON contains a duplicate decoded object member name.",
    });
    expect(escaped.diagnostics[0]).toMatchObject({
      code: INVALID_SOURCE_JSON_CODE,
      pointer: "/nested/a",
      message: "Source JSON contains a duplicate decoded object member name.",
    });
  });

  it("rejects invalid Unicode and non-finite JSON numbers as non-interoperable input", () => {
    const escapedSurrogate = parseSourceJson('{"value":"\\ud800"}');
    const literalSurrogate = parseSourceJson(`{"value":"${String.fromCharCode(0xd800)}"}`);
    const nonFinite = parseSourceJson('{"value":1e400}');

    for (const result of [escapedSurrogate, literalSurrogate, nonFinite]) {
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected non-interoperable JSON to fail");
      expect(result.diagnostics[0].code).toBe(INVALID_SOURCE_JSON_CODE);
      expect(Object.hasOwn(result, "value")).toBe(false);
    }
    if (!escapedSurrogate.ok) expect(escapedSurrogate.diagnostics[0].pointer).toBe("/value");
    if (!nonFinite.ok) expect(nonFinite.diagnostics[0].pointer).toBe("/value");

    const scalarPair = parseSourceJson('{"value":"\\ud83d\\ude00"}');
    expect(scalarPair.ok).toBe(true);
  });

  it("enforces every finite parser budget at its exact boundary", () => {
    expect(parseSourceJson('"é"', limits({ maxSourceUtf8Bytes: 4 })).ok).toBe(true);
    expect(parseSourceJson('"é"', limits({ maxSourceUtf8Bytes: 3 })).ok).toBe(false);

    expect(parseSourceJson("[[]]", limits({ maxJsonDepth: 2 })).ok).toBe(true);
    expect(parseSourceJson("[[]]", limits({ maxJsonDepth: 1 })).ok).toBe(false);

    expect(parseSourceJson("[0,1]", limits({ maxJsonValueOccurrences: 3 })).ok).toBe(true);
    expect(parseSourceJson("[0,1]", limits({ maxJsonValueOccurrences: 2 })).ok).toBe(false);

    expect(parseSourceJson('{"a":"bc"}', limits({ maxDecodedStringCodeUnits: 3 })).ok).toBe(true);
    expect(parseSourceJson('{"a":"bc"}', limits({ maxDecodedStringCodeUnits: 2 })).ok).toBe(false);

    expect(parseSourceJson("123", limits({ maxNumberTokenCodeUnits: 3 })).ok).toBe(true);
    expect(parseSourceJson("123", limits({ maxNumberTokenCodeUnits: 2 })).ok).toBe(false);

    const failures = [
      parseSourceJson('"é"', limits({ maxSourceUtf8Bytes: 3 })),
      parseSourceJson("[[]]", limits({ maxJsonDepth: 1 })),
      parseSourceJson("[0,1]", limits({ maxJsonValueOccurrences: 2 })),
      parseSourceJson('{"a":"bc"}', limits({ maxDecodedStringCodeUnits: 2 })),
      parseSourceJson("123", limits({ maxNumberTokenCodeUnits: 2 })),
    ];
    failures.forEach((result) => {
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected finite limit to fail");
      expect(result.diagnostics[0].code).toBe(SOURCE_LIMIT_EXCEEDED_CODE);
      expect(Object.hasOwn(result, "bundle")).toBe(false);
      expect(Object.hasOwn(result, "value")).toBe(false);
    });
  });

  it("rejects malformed or adversarial limit profiles without invoking accessors", () => {
    let getterInvocations = 0;
    const accessorProfile = Object.defineProperty({ ...limits() }, "maxSourceUtf8Bytes", {
      enumerable: true,
      get() {
        getterInvocations += 1;
        return 1_024;
      },
    });
    const { proxy, revoke } = Proxy.revocable({ ...limits() }, {});
    revoke();

    const invalidProfiles: readonly unknown[] = [
      { ...limits(), maxSourceUtf8Bytes: Number.POSITIVE_INFINITY },
      { ...limits(), maxJsonDepth: Number.NaN },
      { ...limits(), maxJsonValueOccurrences: -1 },
      { ...limits(), maxDecodedStringCodeUnits: 1.5 },
      { maxSourceUtf8Bytes: 1_024 },
      { ...limits(), unexpected: 1 },
      accessorProfile,
      proxy,
    ];

    for (const profile of invalidProfiles) {
      expect(() => parseSourceJson("{}", profile)).not.toThrow();
      const result = parseSourceJson("{}", profile);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected invalid limits to fail closed");
      expect(result).toMatchObject({
        stage: "json-parse",
        diagnostics: [
          {
            code: SOURCE_LIMIT_EXCEEDED_CODE,
            pointer: "",
            severity: "error",
          },
        ],
      });
      expect(Object.hasOwn(result, "bundle")).toBe(false);
      expect(Object.hasOwn(result, "value")).toBe(false);
    }
    expect(getterInvocations).toBe(0);
  });

  it("accepts many siblings beneath a long ancestor key without rebuilding full pointers", () => {
    const ancestor = "a".repeat(1_000_000);
    const siblings = Array.from({ length: 5_000 }, (_, index) => index);
    const result = parseSourceJson(JSON.stringify({ [ancestor]: siblings }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected bounded long-path input to parse");
    const parsed = result.value as Readonly<Record<string, readonly number[]>>;
    expect(parsed[ancestor]).toHaveLength(5_000);
    expect(parsed[ancestor]?.[4_999]).toBe(4_999);
  }, 10_000);

  it("publishes the exact frozen default parsing profile without mutable configuration", () => {
    expect(PUBLISH_SOURCE_JSON_LIMITS).toEqual({
      maxSourceUtf8Bytes: 8_388_608,
      maxJsonDepth: 256,
      maxJsonValueOccurrences: 262_144,
      maxDecodedStringCodeUnits: 4_194_304,
      maxNumberTokenCodeUnits: 1_024,
    });
    expect(Object.isFrozen(PUBLISH_SOURCE_JSON_LIMITS)).toBe(true);
  });

  it("produces byte-identical controlled failures across repeated independent parses", () => {
    const source = '{"x":1,"\\u0078":2}';
    const first = parseSourceJson(source);
    const second = parseSourceJson(source);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
