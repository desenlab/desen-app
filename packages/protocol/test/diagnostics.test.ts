import { describe, expect, it } from "vitest";

import {
  CORE_DIAGNOSTIC_REGISTRY,
  appendJsonPointer,
  createCoreDiagnostic,
  createJsonPointer,
  escapeJsonPointerToken,
  getCoreDiagnosticDefinition,
  isCoreDiagnosticCode,
  isJsonPointer,
  parseJsonPointer,
  unescapeJsonPointerToken,
} from "../src/index.js";

import type { CoreDiagnosticCode, DesenDiagnostic, JsonPointer } from "../src/index.js";

const CORE_CODES = [
  "SCHEMA_INVALID",
  "UNKNOWN_CORE_FIELD",
  "DUPLICATE_SURFACE_ID",
  "DUPLICATE_NODE_ID",
  "ENTRY_NOT_FOUND",
  "UNKNOWN_CAPABILITY",
  "AMBIGUOUS_CAPABILITY",
  "UNKNOWN_PROP",
  "PROP_TYPE_MISMATCH",
  "UNKNOWN_SLOT",
  "SLOT_CARDINALITY",
  "SLOT_CHILD_REJECTED",
  "UNKNOWN_EVENT",
  "EVENT_PAYLOAD_INVALID",
  "UNKNOWN_COMMAND",
  "COMMAND_INPUT_INVALID",
  "BEHAVIOR_ATTACHMENT_INVALID",
  "BEHAVIOR_CONFLICT",
  "STATE_WRITE_INVALID",
  "REFERENCE_UNRESOLVED",
  "PREDICATE_TYPE_MISMATCH",
  "REPEAT_ITEMS_INVALID",
  "REPEAT_KEY_INVALID",
  "OPERATION_INPUT_INVALID",
  "OPERATION_OUTPUT_INVALID",
  "OPERATION_DENIED",
  "RESOURCE_INPUT_INVALID",
  "RESOURCE_OUTPUT_INVALID",
  "ACTION_LIMIT_EXCEEDED",
  "REVISION_MISMATCH",
  "SOURCE_DIGEST_MISMATCH",
  "CATALOG_DIGEST_MISMATCH",
  "CATALOG_VERSION_UNAVAILABLE",
  "UNSUPPORTED_PROTOCOL",
  "BUNDLE_LIMIT_EXCEEDED",
  "ADAPTER_FAILURE",
] as const satisfies readonly CoreDiagnosticCode[];

describe("DESEN 0.1.0 core diagnostic registry", () => {
  it("contains the exact 36 Appendix B codes once and in normative order", () => {
    expect(CORE_DIAGNOSTIC_REGISTRY.map(({ code }) => code)).toEqual(CORE_CODES);
    expect(new Set(CORE_CODES).size).toBe(36);
    expect(CORE_DIAGNOSTIC_REGISTRY).toHaveLength(36);
  });

  it("preserves exact classifications and immutable canonical meanings", () => {
    const classificationCounts = Object.fromEntries(
      [
        "schema",
        "semantic",
        "catalog",
        "catalog/runtime",
        "runtime",
        "integrity",
        "activation",
      ].map((classification) => [
        classification,
        CORE_DIAGNOSTIC_REGISTRY.filter(
          (definition) => definition.classification === classification,
        ).length,
      ]),
    );

    expect(classificationCounts).toEqual({
      schema: 2,
      semantic: 3,
      catalog: 10,
      "catalog/runtime": 1,
      runtime: 14,
      integrity: 2,
      activation: 4,
    });
    expect(getCoreDiagnosticDefinition("PROP_TYPE_MISMATCH")).toEqual({
      code: "PROP_TYPE_MISMATCH",
      classification: "catalog/runtime",
      meaning: "Resolved property is invalid for its schema",
    });
    expect(getCoreDiagnosticDefinition("REVISION_MISMATCH")?.meaning).toBe(
      "Bundle revision does not match canonical content",
    );
    expect(Object.isFrozen(CORE_DIAGNOSTIC_REGISTRY)).toBe(true);
    expect(CORE_DIAGNOSTIC_REGISTRY.every(Object.isFrozen)).toBe(true);
  });

  it("recognizes only exact core codes without prototype-property false positives", () => {
    for (const code of CORE_CODES) expect(isCoreDiagnosticCode(code), code).toBe(true);
    for (const value of [
      "schema_invalid",
      "SCHEMA_INVALID ",
      "com.example.validator/SCHEMA_INVALID",
      "toString",
      "constructor",
      "__proto__",
      "",
      null,
      1,
    ]) {
      expect(isCoreDiagnosticCode(value)).toBe(false);
      expect(getCoreDiagnosticDefinition(value)).toBeUndefined();
    }
  });
});

describe("shared diagnostic data model", () => {
  it("derives classification and preserves complete stable source context", () => {
    const pointer = createJsonPointer(["surfaces", "sign-in", "root", "props", "label/text"]);
    const diagnostic = createCoreDiagnostic({
      code: "UNKNOWN_PROP",
      message: "Property label/text is not declared by the component contract.",
      pointer,
      context: {
        documentId: "com.example/sign-in",
        surfaceId: "sign-in",
        subject: { kind: "node", id: "submit" },
        capabilityId: "com.example.ui/Button",
      },
    });

    expect(diagnostic).toEqual({
      code: "UNKNOWN_PROP",
      classification: "catalog",
      message: "Property label/text is not declared by the component contract.",
      pointer: "/surfaces/sign-in/root/props/label~1text",
      context: {
        documentId: "com.example/sign-in",
        surfaceId: "sign-in",
        subject: { kind: "node", id: "submit" },
        capabilityId: "com.example.ui/Button",
      },
    });
    expect(Object.isFrozen(diagnostic)).toBe(true);
    expect(Object.isFrozen(diagnostic.context)).toBe(true);
    expect(Object.isFrozen(diagnostic.context?.subject)).toBe(true);
    expect(JSON.parse(JSON.stringify(diagnostic))).toEqual(diagnostic);
  });

  it("distinguishes an unavailable pointer from the known document root", () => {
    const unavailable = createCoreDiagnostic({ code: "SCHEMA_INVALID", message: "Invalid JSON." });
    const root = createCoreDiagnostic({
      code: "SCHEMA_INVALID",
      message: "The document root must be an object.",
      pointer: createJsonPointer(),
    });

    expect("pointer" in unavailable).toBe(false);
    expect(root.pointer).toBe("");
    expect(JSON.stringify(root)).toContain('"pointer":""');
  });

  it("keeps implementation-defined namespaced codes lossless without redefining their grammar", () => {
    const extension: DesenDiagnostic<"com.example.validator/REMOTE_TIMEOUT"> = {
      code: "com.example.validator/REMOTE_TIMEOUT",
      message: "The external validation service timed out.",
      pointer: createJsonPointer(["catalogs", 0]),
    };

    expect(JSON.parse(JSON.stringify(extension))).toEqual(extension);

    const assertDefaultCoreType = (): void => {
      const core: DesenDiagnostic = { code: "SCHEMA_INVALID", message: "Invalid." };
      // @ts-expect-error Unknown unnamespaced strings are not accepted by the default core model.
      const typo: DesenDiagnostic = { code: "SCHEMA_INAVLID", message: "Typo." };
      void core;
      void typo;
    };
    expect(assertDefaultCoreType).toBeTypeOf("function");
  });

  it("rejects malformed factory inputs without retaining caller-owned objects", () => {
    expect(() => createCoreDiagnostic({ code: "UNKNOWN_PROP", message: "   " })).toThrow(TypeError);
    expect(() =>
      createCoreDiagnostic({
        code: "UNKNOWN_PROP",
        message: "Invalid pointer.",
        pointer: "/bad~2escape" as JsonPointer,
      }),
    ).toThrow(TypeError);
    expect(() =>
      createCoreDiagnostic({
        code: "UNKNOWN_PROP",
        message: "Empty context.",
        context: {},
      }),
    ).toThrow(TypeError);
    expect(() =>
      createCoreDiagnostic({
        code: "UNKNOWN_PROP",
        message: "Invalid subject.",
        context: {
          // @ts-expect-error Runtime JavaScript callers still receive an explicit failure.
          subject: { kind: "surface", id: "main" },
        },
      }),
    ).toThrow(TypeError);
    expect(() =>
      createCoreDiagnostic({
        code: "NOT_A_CORE_CODE" as CoreDiagnosticCode,
        message: "Invalid code.",
      }),
    ).toThrow(TypeError);
  });

  it("snapshots caller data and rejects accessors without invoking them", () => {
    const context = {
      documentId: "com.example/original",
      subject: { kind: "node" as const, id: "original-node" },
    };
    const diagnostic = createCoreDiagnostic({
      code: "UNKNOWN_PROP",
      message: "Unknown property.",
      context,
    });
    context.documentId = "com.example/changed";
    context.subject.id = "changed-node";

    expect(diagnostic.context).toEqual({
      documentId: "com.example/original",
      subject: { kind: "node", id: "original-node" },
    });

    let codeGetterInvoked = false;
    const accessorInput = Object.defineProperty({}, "code", {
      get() {
        codeGetterInvoked = true;
        return "UNKNOWN_PROP";
      },
    });
    expect(() => (createCoreDiagnostic as (input: unknown) => unknown)(accessorInput)).toThrow(
      TypeError,
    );
    expect(codeGetterInvoked).toBe(false);

    let pointerGetterInvoked = false;
    const pointerAccessorInput = {
      code: "UNKNOWN_PROP",
      message: "Unknown property.",
    };
    Object.defineProperty(pointerAccessorInput, "pointer", {
      get() {
        pointerGetterInvoked = true;
        return "/bad~2escape";
      },
    });
    expect(() =>
      (createCoreDiagnostic as (input: unknown) => unknown)(pointerAccessorInput),
    ).toThrow(TypeError);
    expect(pointerGetterInvoked).toBe(false);

    let subjectGetterInvoked = false;
    const contextWithAccessor = Object.defineProperty({}, "subject", {
      get() {
        subjectGetterInvoked = true;
        return { kind: "node", id: "hidden" };
      },
    });
    expect(() =>
      (createCoreDiagnostic as (input: unknown) => unknown)({
        code: "UNKNOWN_PROP",
        message: "Unknown property.",
        context: contextWithAccessor,
      }),
    ).toThrow(TypeError);
    expect(subjectGetterInvoked).toBe(false);
  });
});

describe("RFC 6901 JSON Pointer", () => {
  it("distinguishes root, empty tokens, and ordinary nested paths", () => {
    expect(createJsonPointer()).toBe("");
    expect(createJsonPointer([])).toBe("");
    expect(createJsonPointer([""])).toBe("/");
    expect(createJsonPointer(["", ""])).toBe("//");
    expect(createJsonPointer(["foo", 0])).toBe("/foo/0");

    expect(parseJsonPointer("")).toEqual([]);
    expect(parseJsonPointer("/")).toEqual([""]);
    expect(parseJsonPointer("//")).toEqual(["", ""]);
    expect(parseJsonPointer("/foo/0")).toEqual(["foo", "0"]);
    expect(Object.isFrozen(parseJsonPointer("/foo"))).toBe(true);
  });

  it("matches all 12 RFC 6901 Section 5 JSON-string examples", () => {
    const vectors = [
      { segments: [], pointer: "", tokens: [] },
      { segments: ["foo"], pointer: "/foo", tokens: ["foo"] },
      { segments: ["foo", "0"], pointer: "/foo/0", tokens: ["foo", "0"] },
      { segments: [""], pointer: "/", tokens: [""] },
      { segments: ["a/b"], pointer: "/a~1b", tokens: ["a/b"] },
      { segments: ["c%d"], pointer: "/c%d", tokens: ["c%d"] },
      { segments: ["e^f"], pointer: "/e^f", tokens: ["e^f"] },
      { segments: ["g|h"], pointer: "/g|h", tokens: ["g|h"] },
      { segments: ["i\\j"], pointer: "/i\\j", tokens: ["i\\j"] },
      { segments: ['k"l'], pointer: '/k"l', tokens: ['k"l'] },
      { segments: [" "], pointer: "/ ", tokens: [" "] },
      { segments: ["m~n"], pointer: "/m~0n", tokens: ["m~n"] },
    ] as const;

    for (const vector of vectors) {
      expect(createJsonPointer(vector.segments), vector.pointer).toBe(vector.pointer);
      expect(parseJsonPointer(vector.pointer), vector.pointer).toEqual(vector.tokens);
    }
  });

  it("matches RFC token escaping and the required decode order", () => {
    expect(escapeJsonPointerToken("a/b")).toBe("a~1b");
    expect(escapeJsonPointerToken("m~n")).toBe("m~0n");
    expect(escapeJsonPointerToken("a~b/c")).toBe("a~0b~1c");
    expect(unescapeJsonPointerToken("a~1b")).toBe("a/b");
    expect(unescapeJsonPointerToken("m~0n")).toBe("m~n");
    expect(unescapeJsonPointerToken("~01")).toBe("~1");
    expect(parseJsonPointer("/a~1b/m~0n/~01")).toEqual(["a/b", "m~n", "~1"]);
  });

  it("preserves Unicode spelling, percent signs, NUL, quotes, and backslashes", () => {
    const segments = ["é", "e\u0301", "😀", "c%d", "\u0000", 'k"l', "i\\j"];
    const pointer = createJsonPointer(segments);

    expect(parseJsonPointer(pointer)).toEqual(segments);
    expect(parseJsonPointer(pointer)[0]).not.toBe(parseJsonPointer(pointer)[1]);
    expect(pointer).toContain("c%d");
  });

  it("appends safely to root and escaped nested locations", () => {
    const root = createJsonPointer();
    const surfaces = appendJsonPointer(root, "surfaces");
    const keyed = appendJsonPointer(surfaces, "main/admin");
    const indexed = appendJsonPointer(keyed, 2);

    expect(surfaces).toBe("/surfaces");
    expect(keyed).toBe("/surfaces/main~1admin");
    expect(indexed).toBe("/surfaces/main~1admin/2");
    expect(parseJsonPointer(indexed)).toEqual(["surfaces", "main/admin", "2"]);
  });

  it("accepts syntax-only array-like tokens without interpreting a document", () => {
    for (const pointer of ["/0", "/01", "/-", "/999999999999999999999999999"]) {
      expect(isJsonPointer(pointer), pointer).toBe(true);
    }
    expect(createJsonPointer([Number.MAX_SAFE_INTEGER])).toBe(`/${Number.MAX_SAFE_INTEGER}`);
  });

  it("rejects relative, fragment, malformed escape, invalid Unicode, and numeric inputs", () => {
    for (const pointer of ["foo", "#/foo", "/bad~", "/bad~2escape", "\ud800", "/\udc00"]) {
      expect(isJsonPointer(pointer), JSON.stringify(pointer)).toBe(false);
      expect(() => parseJsonPointer(pointer)).toThrow(TypeError);
    }
    for (const token of ["~", "~2", "a/b"]) {
      expect(() => unescapeJsonPointerToken(token)).toThrow(TypeError);
    }
    for (const numeric of [-1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => createJsonPointer([numeric])).toThrow(TypeError);
    }
    expect(() => createJsonPointer(["\ud800"])).toThrow(TypeError);
    expect(() => (createJsonPointer as (segments: unknown) => JsonPointer)("not-an-array")).toThrow(
      TypeError,
    );
  });

  it("rejects sparse and accessor slots without calling caller-owned array hooks", () => {
    expect(() => createJsonPointer(new Array(1))).toThrow(TypeError);

    let indexGetterInvoked = false;
    const accessorSegments = ["safe"];
    Object.defineProperty(accessorSegments, "0", {
      get() {
        indexGetterInvoked = true;
        return "hidden";
      },
    });
    expect(() => createJsonPointer(accessorSegments)).toThrow(TypeError);
    expect(indexGetterInvoked).toBe(false);

    let mapInvoked = false;
    const hookedSegments = ["safe"];
    Object.defineProperty(hookedSegments, "map", {
      value() {
        mapInvoked = true;
        return ["bad~2escape"];
      },
    });
    expect(createJsonPointer(hookedSegments)).toBe("/safe");
    expect(mapInvoked).toBe(false);
  });

  it("round-trips a deterministic cross-product of difficult tokens", () => {
    const tokens = ["", "plain", "a/b", "m~n", "~1", "%2F", "0", "01", "-", "é", "e\u0301", "😀"];
    for (const first of tokens) {
      for (const second of tokens) {
        const segments = [first, second] as const;
        const pointer = createJsonPointer(segments);
        expect(parseJsonPointer(pointer), pointer).toEqual(segments);
        expect(createJsonPointer(parseJsonPointer(pointer)), pointer).toBe(pointer);
      }
    }
  });
});
