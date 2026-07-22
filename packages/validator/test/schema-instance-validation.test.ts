import { describe, expect, it } from "vitest";

import {
  MAX_SCHEMA_GRAPH_DEPTH,
  applySchemaContract,
  validateSchemaContractGraph,
} from "../src/schema-instance-validation.js";
import { resolveUriReference } from "../src/uri-reference.js";

function expectDeepFrozen(value: unknown, visited = new Set<object>()): void {
  if (typeof value !== "object" || value === null || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach((child) => expectDeepFrozen(child, visited));
}

function fanOutSchema(level: number): Readonly<Record<string, unknown>> {
  const definitions: Record<string, unknown> = { leaf: true };
  for (let index = 0; index <= level; index += 1) {
    const target = index === 0 ? "leaf" : `level${index - 1}`;
    definitions[`level${index}`] = {
      allOf: [{ $ref: `#/$defs/${target}` }, { $ref: `#/$defs/${target}` }],
    };
  }
  return { $defs: definitions, $ref: `#/$defs/level${level}` };
}

function nestedNotSchema(depth: number): unknown {
  let schema: unknown = true;
  for (let index = 0; index < depth; index += 1) schema = { not: schema };
  return schema;
}

describe("complete schema contracts", () => {
  it("applies required and cross-property constraints", () => {
    const schema = {
      type: "object",
      required: ["kind", "name"],
      properties: {
        kind: { enum: ["person", "company"] },
        name: { type: "string" },
        taxId: { type: "string" },
        email: { type: "string" },
      },
      dependentRequired: { email: ["name"] },
      if: { properties: { kind: { const: "company" } }, required: ["kind"] },
      then: { required: ["taxId"] },
      additionalProperties: false,
    };

    expect(applySchemaContract(schema, { kind: "company", name: "Acme" }, "complete")).toEqual({
      issues: [{ kind: "mismatch", pointer: "/taxId", keyword: "required" }],
      obligations: [],
    });
    expect(applySchemaContract(schema, { kind: "person" }, "complete").issues).toEqual([
      { kind: "mismatch", pointer: "/name", keyword: "required" },
    ]);
  });

  it("distinguishes unknown properties and RFC 6901-escapes their pointers", () => {
    const result = applySchemaContract(
      {
        type: "object",
        properties: { known: { type: "string" } },
        additionalProperties: false,
      },
      { known: "yes", "future/part~name": true },
      "complete",
    );

    expect(result.issues).toEqual([
      {
        kind: "unknown-property",
        pointer: "/future~1part~0name",
        keyword: "additionalProperties",
      },
    ]);
  });

  it("reports nested mismatches at value-relative pointers", () => {
    const result = applySchemaContract(
      {
        type: "object",
        required: ["profile"],
        properties: {
          profile: {
            type: "object",
            required: ["postalCode"],
            properties: { postalCode: { type: "string", pattern: "^[0-9]{5}$" } },
            additionalProperties: false,
          },
        },
      },
      { profile: { postalCode: "bad" } },
      "complete",
    );

    expect(result.issues).toEqual([
      { kind: "mismatch", pointer: "/profile/postalCode", keyword: "pattern" },
    ]);
  });

  it("resolves local JSON Pointer and anchor references without fetching", () => {
    const result = applySchemaContract(
      {
        type: "object",
        $defs: {
          positive: { $anchor: "positive", type: "number", exclusiveMinimum: 0 },
        },
        properties: {
          first: { $ref: "#/$defs/positive" },
          second: { $ref: "#positive" },
        },
      },
      { first: 0, second: -1 },
      "complete",
    );

    expect(result.issues).toEqual([
      { kind: "mismatch", pointer: "/first", keyword: "exclusiveMinimum" },
      { kind: "mismatch", pointer: "/second", keyword: "exclusiveMinimum" },
    ]);
  });

  it("keeps embedded resource paths and dynamic anchors addressable by ordinary local refs", () => {
    expect(
      applySchemaContract(
        {
          $defs: {
            embedded: {
              $id: "embedded",
              $defs: { number: { type: "number" } },
            },
          },
          $ref: "#/$defs/embedded/$defs/number",
        },
        2,
        "complete",
      ).issues,
    ).toEqual([]);

    expect(
      applySchemaContract(
        {
          $defs: { number: { $dynamicAnchor: "number", type: "number" } },
          $ref: "#number",
        },
        "wrong",
        "complete",
      ).issues,
    ).toEqual([{ kind: "mismatch", pointer: "", keyword: "type" }]);
  });

  it("resolves dynamic refs against the outermost matching dynamic scope", () => {
    const result = applySchemaContract(
      {
        $dynamicAnchor: "node",
        $ref: "#/$defs/tree",
        unevaluatedProperties: false,
        $defs: {
          tree: {
            $id: "tree",
            $dynamicAnchor: "node",
            type: "object",
            properties: {
              children: { type: "array", items: { $dynamicRef: "#node" } },
            },
          },
        },
      },
      { children: [{ extra: 1 }] },
      "complete",
    );

    expect(result.issues).toEqual([
      {
        kind: "unknown-property",
        pointer: "/children/0/extra",
        keyword: "unevaluatedProperties",
      },
    ]);
  });

  it("normalizes nested ids against their parent resource and keeps `$id: '#'` local", () => {
    expect(
      applySchemaContract(
        {
          $defs: {
            sameResource: { $id: "#", $ref: "#value" },
            value: { $anchor: "value", type: "string" },
          },
          $ref: "#/$defs/sameResource",
        },
        42,
        "complete",
      ).issues,
    ).toEqual([{ kind: "mismatch", pointer: "", keyword: "type" }]);

    expect(
      validateSchemaContractGraph({
        $id: "https://example.com/schemas/root.json",
        $defs: {
          first: { $id: "parts/../shared" },
          second: { $id: "./shared#" },
        },
      }),
    ).toEqual([{ pointer: "/$defs/second/$id", keyword: "$id" }]);
  });

  it("supports allOf, anyOf, oneOf, not, and conditional applicators", () => {
    expect(
      applySchemaContract(
        { allOf: [{ type: "number", minimum: 1 }, { maximum: 3 }] },
        2,
        "complete",
      ).issues,
    ).toEqual([]);
    expect(
      applySchemaContract({ anyOf: [{ type: "string" }, { type: "number" }] }, true, "complete")
        .issues,
    ).toEqual([{ kind: "mismatch", pointer: "", keyword: "anyOf" }]);
    expect(
      applySchemaContract({ oneOf: [{ type: "number" }, { type: "integer" }] }, 2, "complete")
        .issues,
    ).toEqual([{ kind: "mismatch", pointer: "", keyword: "oneOf" }]);
    expect(applySchemaContract({ not: { type: "null" } }, null, "complete").issues).toEqual([
      { kind: "mismatch", pointer: "", keyword: "not" },
    ]);
  });

  it("applies object, array, string, and number validation keywords", () => {
    const result = applySchemaContract(
      {
        type: "object",
        minProperties: 4,
        propertyNames: { pattern: "^[a-z]+$" },
        properties: {
          title: { type: "string", minLength: 3, maxLength: 5, pattern: "^[A-Z]" },
          score: { type: "number", multipleOf: 0.5, minimum: 0, exclusiveMaximum: 10 },
          limit: { type: "number", exclusiveMaximum: 10 },
          tags: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            uniqueItems: true,
            items: { type: "string" },
          },
          samples: {
            type: "array",
            contains: { type: "integer", minimum: 10 },
            minContains: 2,
          },
        },
      },
      {
        Title: "ab",
        title: "ab",
        score: -0.3,
        limit: 10,
        tags: ["same", "same", 3],
        samples: [10, 2],
      },
      "complete",
    );

    expect(result.issues).toEqual([
      { kind: "mismatch", pointer: "/Title", keyword: "propertyNames" },
      { kind: "mismatch", pointer: "/limit", keyword: "exclusiveMaximum" },
      { kind: "mismatch", pointer: "/samples", keyword: "minContains" },
      { kind: "mismatch", pointer: "/score", keyword: "minimum" },
      { kind: "mismatch", pointer: "/score", keyword: "multipleOf" },
      { kind: "mismatch", pointer: "/tags/1", keyword: "uniqueItems" },
      { kind: "mismatch", pointer: "/tags/2", keyword: "type" },
      { kind: "mismatch", pointer: "/title", keyword: "minLength" },
      { kind: "mismatch", pointer: "/title", keyword: "pattern" },
    ]);
  });

  it("evaluates multipleOf exactly across large finite JSON numbers", () => {
    expect(
      applySchemaContract({ multipleOf: 1 }, 1_000_000_000_000_000.5, "complete").issues,
    ).toEqual([{ kind: "mismatch", pointer: "", keyword: "multipleOf" }]);
  });

  it("tracks evaluated properties and items across applicators", () => {
    const objectResult = applySchemaContract(
      {
        type: "object",
        allOf: [{ properties: { known: { type: "string" } } }],
        unevaluatedProperties: false,
      },
      { known: "yes", extra: true },
      "complete",
    );
    expect(objectResult.issues).toEqual([
      {
        kind: "unknown-property",
        pointer: "/extra",
        keyword: "unevaluatedProperties",
      },
    ]);

    const arrayResult = applySchemaContract(
      { prefixItems: [{ type: "string" }], unevaluatedItems: false },
      ["first", "extra"],
      "complete",
    );
    expect(arrayResult.issues).toEqual([
      { kind: "mismatch", pointer: "/1", keyword: "unevaluatedItems" },
    ]);

    expect(
      applySchemaContract(
        { if: { properties: { known: true } }, unevaluatedProperties: false },
        { known: "yes" },
        "complete",
      ).issues,
    ).toEqual([]);
  });

  it("treats default as an annotation and never mutates the value", () => {
    const value: Record<string, unknown> = {};
    const before = JSON.parse(JSON.stringify(value)) as unknown;
    const result = applySchemaContract(
      {
        type: "object",
        properties: { direction: { type: "string", default: "vertical" } },
      },
      value,
      "complete",
    );

    expect(result).toEqual({ issues: [], obligations: [] });
    expect(value).toEqual(before);
    expect(Object.hasOwn(value, "direction")).toBe(false);
  });
});

describe("dynamic values and patches", () => {
  it("treats ValueSpec-shaped adapter data as ordinary JSON in resolved-value mode", () => {
    const schema = {
      type: "object",
      required: ["$ref"],
      properties: { $ref: { const: "literal-value" } },
      additionalProperties: false,
    };

    expect(applySchemaContract(schema, { $ref: "wrong" }, "complete")).toEqual({
      issues: [],
      obligations: [{ pointer: "" }],
    });
    expect(applySchemaContract(schema, { $ref: "wrong" }, "complete", "resolved-value")).toEqual({
      issues: [{ kind: "mismatch", pointer: "/$ref", keyword: "const" }],
      obligations: [],
    });
    expect(
      applySchemaContract(schema, { $ref: "literal-value" }, "complete", "resolved-value"),
    ).toEqual({ issues: [], obligations: [] });
  });

  it("records nested dynamic roots while retaining definite static failures", () => {
    const result = applySchemaContract(
      {
        type: "object",
        required: ["profile", "label", "items"],
        properties: {
          profile: {
            type: "object",
            required: ["name", "age"],
            properties: { name: { type: "string" }, age: { type: "integer" } },
            additionalProperties: false,
          },
          label: { type: "string" },
          items: { type: "array", items: { type: "number" } },
        },
      },
      {
        profile: { name: { $ref: "state.name" }, age: "old" },
        label: { $format: { template: "Hello {name}", values: {} } },
        items: [1, { $token: "spacing.md" }],
      },
      "complete",
    );

    expect(result.issues).toEqual([{ kind: "mismatch", pointer: "/profile/age", keyword: "type" }]);
    expect(result.obligations).toEqual([
      { pointer: "/items/1" },
      { pointer: "/label" },
      { pointer: "/profile/name" },
    ]);
  });

  it("retains statically provable const and enum failures around nested dynamic values", () => {
    const value = { payload: { $ref: "state.payload" }, status: "wrong" };

    expect(
      applySchemaContract(
        { const: { payload: "resolved-later", status: "ready" } },
        value,
        "complete",
      ),
    ).toEqual({
      issues: [{ kind: "mismatch", pointer: "", keyword: "const" }],
      obligations: [{ pointer: "/payload" }],
    });
    expect(
      applySchemaContract(
        {
          enum: [
            { payload: 1, status: "ready" },
            { payload: 2, status: "pending" },
          ],
        },
        value,
        "complete",
      ),
    ).toEqual({
      issues: [{ kind: "mismatch", pointer: "", keyword: "enum" }],
      obligations: [{ pointer: "/payload" }],
    });
    expect(
      applySchemaContract(
        { const: { payload: "resolved-later", status: "wrong" } },
        value,
        "complete",
      ).issues,
    ).toEqual([]);
  });

  it("reports unresolved schema refs even when the instance root is dynamic", () => {
    expect(applySchemaContract({ $ref: "#missing" }, { $ref: "state.value" }, "complete")).toEqual({
      issues: [{ kind: "mismatch", pointer: "", keyword: "$ref" }],
      obligations: [{ pointer: "" }],
    });
  });

  it("does not guess a conditional branch selected by a dynamic value", () => {
    const result = applySchemaContract(
      {
        type: "object",
        properties: { kind: {}, companyId: { type: "string" } },
        if: { properties: { kind: { const: "company" } }, required: ["kind"] },
        then: { required: ["companyId"] },
        else: { not: { required: ["companyId"] } },
      },
      { kind: { $ref: "state.kind" } },
      "complete",
    );

    expect(result).toEqual({ issues: [], obligations: [{ pointer: "/kind" }] });
  });

  it("skips root completeness rules in patch mode and validates supplied values", () => {
    const schema = {
      type: "object",
      required: ["title"],
      minProperties: 2,
      properties: { title: { type: "string" }, count: { type: "integer" } },
      dependentRequired: { count: ["title"] },
      additionalProperties: false,
    };

    expect(applySchemaContract(schema, {}, "patch")).toEqual({ issues: [], obligations: [] });
    expect(applySchemaContract(schema, { count: "many" }, "patch").issues).toEqual([
      { kind: "mismatch", pointer: "/count", keyword: "type" },
    ]);
  });

  it("applies patch-relevant anyOf, oneOf, not, and conditional contracts", () => {
    const anyOfSchema = {
      anyOf: [{ properties: { x: { type: "string" } } }, { properties: { y: { type: "number" } } }],
      unevaluatedProperties: false,
    };
    expect(applySchemaContract(anyOfSchema, { x: "ok" }, "patch").issues).toEqual([]);

    const contradictoryAnyOf = {
      anyOf: [{ properties: { x: { type: "string" } } }, { properties: { x: { type: "number" } } }],
      unevaluatedProperties: false,
    };
    expect(applySchemaContract(contradictoryAnyOf, { x: true }, "patch").issues).toEqual([
      { kind: "mismatch", pointer: "", keyword: "anyOf" },
    ]);

    const contradictoryOneOf = {
      oneOf: [{ properties: { x: { type: "string" } } }, { properties: { x: { type: "number" } } }],
      unevaluatedProperties: false,
    };
    expect(applySchemaContract(contradictoryOneOf, { x: true }, "patch").issues).toEqual([
      { kind: "mismatch", pointer: "", keyword: "oneOf" },
    ]);

    expect(
      applySchemaContract({ not: { properties: { x: { type: "string" } } } }, { x: "ok" }, "patch")
        .issues,
    ).toEqual([{ kind: "mismatch", pointer: "", keyword: "not" }]);
    expect(
      applySchemaContract({ not: { properties: { x: { type: "string" } } } }, {}, "patch").issues,
    ).toEqual([]);

    expect(
      applySchemaContract(
        {
          anyOf: [{ required: ["a"] }, { properties: { x: { type: "string" } } }],
        },
        { x: 42 },
        "patch",
      ).issues,
    ).toEqual([]);

    const conditional = {
      if: { properties: { kind: { const: "a" } } },
      then: { properties: { value: { type: "string" } } },
      else: { properties: { value: { type: "number" } } },
      unevaluatedProperties: false,
    };
    expect(applySchemaContract(conditional, { value: "ok" }, "patch").issues).toEqual([]);
    expect(applySchemaContract(conditional, { value: true }, "patch").issues).toEqual([
      { kind: "mismatch", pointer: "", keyword: "if" },
    ]);
  });

  it("keeps unseen patch members and items unknown while retaining supplied failures", () => {
    expect(
      applySchemaContract(
        {
          not: {
            properties: { x: { type: "string" } },
            unevaluatedProperties: false,
          },
        },
        { x: "known" },
        "patch",
      ).issues,
    ).toEqual([]);
    expect(
      applySchemaContract(
        {
          properties: { x: { type: "string" } },
          unevaluatedProperties: false,
        },
        { x: "known", extra: true },
        "patch",
      ).issues,
    ).toEqual([
      {
        kind: "unknown-property",
        pointer: "/extra",
        keyword: "unevaluatedProperties",
      },
    ]);

    expect(
      applySchemaContract(
        { not: { prefixItems: [{ type: "string" }], unevaluatedItems: false } },
        ["known"],
        "patch",
      ).issues,
    ).toEqual([]);
    expect(
      applySchemaContract(
        { prefixItems: [{ type: "string" }], unevaluatedItems: false },
        ["known", 2],
        "patch",
      ).issues,
    ).toEqual([{ kind: "mismatch", pointer: "/1", keyword: "unevaluatedItems" }]);
  });
});

describe("bounded schema graph preparation", () => {
  it("resolves and syntax-normalizes RFC 3986 references without a host URL API", () => {
    expect(resolveUriReference("../shared", "https://Example.COM:443/a/b/root.json")).toBe(
      "https://example.com/a/shared",
    );
    expect(resolveUriReference("#", "https://example.com/a/root?x=1")).toBe(
      "https://example.com/a/root?x=1",
    );
    expect(
      resolveUriReference(
        "HTTPS://EXAMPLE.com:443/%7euser/%2f?q=%7e#fragment",
        "https://desen.invalid/root",
      ),
    ).toBe("https://example.com/~user/%2F?q=~#fragment");
    expect(resolveUriReference("http://[bad", "https://example.com/root")).toBeUndefined();
    expect(resolveUriReference("child", "relative/base")).toBeUndefined();
  });

  it("accepts forward local refs and cycles while rejecting unresolved graph edges", () => {
    expect(
      validateSchemaContractGraph({
        $defs: {
          first: { $ref: "#/$defs/second" },
          second: { $ref: "#/$defs/first" },
        },
        $ref: "#/$defs/first",
      }),
    ).toEqual([]);
    expect(validateSchemaContractGraph({ $ref: "#/$defs/missing" })).toEqual([
      { pointer: "/$ref", keyword: "$ref" },
    ]);
  });

  it("rejects duplicate plain-name anchors within the nearest resource, including cross-kind", () => {
    expect(
      validateSchemaContractGraph({
        $defs: {
          first: { $anchor: "same" },
          second: { $dynamicAnchor: "same" },
        },
      }),
    ).toEqual([{ pointer: "/$defs/second/$dynamicAnchor", keyword: "$dynamicAnchor" }]);

    expect(
      validateSchemaContractGraph({
        $defs: {
          first: { $anchor: "same" },
          embedded: { $id: "embedded", $anchor: "same" },
        },
      }),
    ).toEqual([]);
  });

  it("enforces the fail-closed host regex profile before native matching", () => {
    expect(
      validateSchemaContractGraph({
        pattern: "^[a-z]+$",
        patternProperties: { "^[A-Z]{2}$": true },
      }),
    ).toEqual([]);
    expect(validateSchemaContractGraph({ pattern: "^.*$" })).toEqual([]);
    expect(validateSchemaContractGraph({ pattern: "^[0-9]{5}$" })).toEqual([]);
    expect(validateSchemaContractGraph({ pattern: "[A-Z]" })).toEqual([]);
    expect(validateSchemaContractGraph({ pattern: "abcdefghijklmnop" })).toEqual([]);
    expect(validateSchemaContractGraph({ pattern: "^(a+)+$" })).toEqual([
      { pointer: "/pattern", keyword: "pattern" },
    ]);
    expect(validateSchemaContractGraph({ pattern: "^a+b+$" })).toEqual([
      { pointer: "/pattern", keyword: "pattern" },
    ]);
    expect(validateSchemaContractGraph({ pattern: "a+" })).toEqual([
      { pointer: "/pattern", keyword: "pattern" },
    ]);
    expect(validateSchemaContractGraph({ pattern: "^.*a$" })).toEqual([
      { pointer: "/pattern", keyword: "pattern" },
    ]);
    expect(validateSchemaContractGraph({ pattern: "^.*a{1024}a{1024}a{1024}$" })).toEqual([
      { pointer: "/pattern", keyword: "pattern" },
    ]);
    expect(
      applySchemaContract({ pattern: "^.*a{1024}a{1024}a{1024}$" }, "a".repeat(200_000), "complete")
        .issues,
    ).toEqual([{ kind: "mismatch", pointer: "", keyword: "pattern" }]);
    expect(validateSchemaContractGraph({ pattern: "a{17}" })).toEqual([
      { pointer: "/pattern", keyword: "pattern" },
    ]);
    expect(validateSchemaContractGraph({ patternProperties: { abcdefghijklmnopq: true } })).toEqual(
      [
        {
          pointer: "/patternProperties/abcdefghijklmnopq",
          keyword: "patternProperties",
        },
      ],
    );
    expect(validateSchemaContractGraph({ pattern: "^a{1024}b{1024}c{1024}d{1024}$" })).toEqual([]);
    expect(validateSchemaContractGraph({ pattern: "^a{1024}b{1024}c{1024}d{1024}e$" })).toEqual([
      { pointer: "/pattern", keyword: "pattern" },
    ]);
  });

  it("caps static combinator and ref fan-out at the runtime evaluation budget", () => {
    expect(validateSchemaContractGraph(fanOutSchema(12))).toEqual([]);
    expect(validateSchemaContractGraph(fanOutSchema(13))).toEqual([
      { pointer: "", keyword: "evaluationBudget" },
    ]);
    expect(applySchemaContract(fanOutSchema(13), null, "complete").issues).toContainEqual({
      kind: "mismatch",
      pointer: "",
      keyword: "evaluationBudget",
    });
  });

  it("fails closed at the exact schema-depth boundary without recursive overflow", () => {
    expect(validateSchemaContractGraph(nestedNotSchema(MAX_SCHEMA_GRAPH_DEPTH))).toEqual([]);
    const tooDeep = nestedNotSchema(MAX_SCHEMA_GRAPH_DEPTH + 1);
    const graphIssues = validateSchemaContractGraph(tooDeep);
    expect(graphIssues).toEqual([{ pointer: "", keyword: "schemaGraphDepth" }]);
    expectDeepFrozen(graphIssues);

    const result = applySchemaContract(nestedNotSchema(800), null, "complete");
    expect(result.issues).toEqual([{ kind: "mismatch", pointer: "", keyword: "schemaGraphDepth" }]);
    expectDeepFrozen(result);
  });
});

describe("deterministic immutable results", () => {
  it("sorts, de-duplicates, and recursively freezes issues and obligations", () => {
    const first = applySchemaContract(
      {
        type: "object",
        required: ["z", "a"],
        properties: { dynamic: { type: "string" } },
        additionalProperties: false,
      },
      { "x/y": true, dynamic: { $ref: "state.value" }, b: false },
      "complete",
    );
    const second = applySchemaContract(
      {
        additionalProperties: false,
        properties: { dynamic: { type: "string" } },
        required: ["a", "z"],
        type: "object",
      },
      { b: false, dynamic: { $ref: "state.value" }, "x/y": true },
      "complete",
    );

    expect(first).toEqual(second);
    expect(first.issues).toEqual([
      { kind: "mismatch", pointer: "/a", keyword: "required" },
      { kind: "unknown-property", pointer: "/b", keyword: "additionalProperties" },
      { kind: "unknown-property", pointer: "/x~1y", keyword: "additionalProperties" },
      { kind: "mismatch", pointer: "/z", keyword: "required" },
    ]);
    expect(first.obligations).toEqual([{ pointer: "/dynamic" }]);
    expectDeepFrozen(first);
  });
});
