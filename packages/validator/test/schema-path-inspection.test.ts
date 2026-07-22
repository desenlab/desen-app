import { describe, expect, it } from "vitest";

import {
  MAX_SCHEMA_GRAPH_DEPTH,
  inspectSchemaContractPath,
} from "../src/schema-instance-validation.js";

const ALL_JSON_TYPES = ["array", "boolean", "null", "number", "object", "string"];

describe("conservative schema path inspection", () => {
  it("handles boolean schemas and schema-proven scalar crossings", () => {
    expect(inspectSchemaContractPath(true, ["anything", "nested"])).toEqual({
      reachability: "possible",
      types: ALL_JSON_TYPES,
    });
    expect(inspectSchemaContractPath(false, [])).toEqual({
      reachability: "impossible",
      types: [],
    });
    expect(inspectSchemaContractPath({ type: "array" }, ["member"])).toEqual({
      reachability: "impossible",
      types: [],
    });
  });

  it("derives sorted JSON categories from type, const, and enum", () => {
    expect(inspectSchemaContractPath({ type: "integer" }, [])).toEqual({
      reachability: "possible",
      types: ["number"],
    });
    expect(
      inspectSchemaContractPath(
        {
          enum: [{ profile: { value: "ready" } }, { profile: { value: 1 } }, null],
        },
        ["profile", "value"],
      ),
    ).toEqual({ reachability: "possible", types: ["number", "string"] });
    expect(
      inspectSchemaContractPath({ const: { profile: { tags: [] } } }, ["profile", "tags", "x"]),
    ).toEqual({ reachability: "impossible", types: [] });
  });

  it("follows properties and the additional-properties contract", () => {
    const schema = {
      type: "object",
      required: ["profile"],
      properties: {
        profile: {
          type: "object",
          properties: { name: { type: "string" } },
          additionalProperties: false,
        },
      },
      additionalProperties: { type: "number" },
    };

    expect(inspectSchemaContractPath(schema, ["profile", "name"])).toEqual({
      reachability: "possible",
      types: ["string"],
    });
    expect(inspectSchemaContractPath(schema, ["profile", "missing"])).toEqual({
      reachability: "impossible",
      types: [],
    });
    expect(inspectSchemaContractPath(schema, ["other"])).toEqual({
      reachability: "possible",
      types: ["number"],
    });
  });

  it("resolves local references and intersects allOf constraints", () => {
    const schema = {
      $defs: {
        profile: {
          type: "object",
          properties: { score: { type: ["integer", "string"] } },
          additionalProperties: false,
        },
      },
      allOf: [{ $ref: "#/$defs/profile" }, { properties: { score: { type: "number" } } }],
    };

    expect(inspectSchemaContractPath(schema, ["score"])).toEqual({
      reachability: "possible",
      types: ["number"],
    });
    expect(
      inspectSchemaContractPath(
        {
          allOf: [
            { properties: { score: { type: "number" } } },
            { properties: { score: { type: "string" } } },
          ],
        },
        ["score"],
      ),
    ).toEqual({ reachability: "impossible", types: [] });
  });

  it("unions anyOf and conservatively marks overlapping oneOf branches", () => {
    const branches = [
      { type: "object", properties: { value: { type: "string" } } },
      { type: "object", properties: { value: { type: "number" } } },
    ];

    expect(inspectSchemaContractPath({ anyOf: branches }, ["value"])).toEqual({
      reachability: "possible",
      types: ["number", "string"],
    });
    expect(inspectSchemaContractPath({ oneOf: branches }, ["value"])).toEqual({
      reachability: "unknown",
      types: ["number", "string"],
    });
  });

  it("fails open for cycles, conditional constraints, unsafe graphs, and path budgets", () => {
    expect(inspectSchemaContractPath({ $ref: "#" }, ["value"])).toEqual({
      reachability: "unknown",
      types: ALL_JSON_TYPES,
    });
    expect(
      inspectSchemaContractPath(
        {
          if: { required: ["kind"] },
          then: { properties: { value: { type: "string" } } },
          else: { properties: { value: { type: "number" } } },
        },
        ["value"],
      ),
    ).toEqual({ reachability: "unknown", types: ALL_JSON_TYPES });
    expect(inspectSchemaContractPath({ $ref: "#missing" }, ["value"])).toEqual({
      reachability: "unknown",
      types: ALL_JSON_TYPES,
    });
    expect(
      inspectSchemaContractPath(
        true,
        Array.from({ length: MAX_SCHEMA_GRAPH_DEPTH + 1 }, () => "x"),
      ),
    ).toEqual({ reachability: "unknown", types: ALL_JSON_TYPES });
  });

  it("returns a deterministic recursively frozen result", () => {
    const result = inspectSchemaContractPath(
      { type: "object", properties: { value: { type: ["string", "null"] } } },
      ["value"],
    );

    expect(result).toEqual({ reachability: "possible", types: ["null", "string"] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.types)).toBe(true);
  });
});
