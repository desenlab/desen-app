import { PUBLISH_SOURCE_JSON_LIMITS } from "@desen/publisher";
import { describe, expect, it } from "vitest";

import { formatStructuredJson, parseStructuredJsonText } from "../src/structured-json.js";

import type { JsonValue } from "@desen/catalog-sdk";
import type { StructuredJsonParseFailureReason } from "../src/structured-json.js";

function expectFailure(text: unknown, reason: StructuredJsonParseFailureReason): void {
  const result = parseStructuredJsonText(text);
  expect(result).toEqual({ ok: false, reason });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.hasOwn(result, "value")).toBe(false);
}

function expectSuccess(text: string): JsonValue {
  const result = parseStructuredJsonText(text);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected structured JSON, received ${result.reason}.`);
  expect(Object.isFrozen(result)).toBe(true);
  return result.value;
}

describe("Desen App strict structured JSON", () => {
  it("returns a detached recursively frozen JSON value without prototype-name interpretation", () => {
    const text =
      '{"title":"Original","config":{"enabled":true,"items":[null,1,"value"]},"__proto__":{"safe":true}}';
    const value = expectSuccess(text) as Readonly<Record<string, JsonValue>>;

    expect(value.title).toBe("Original");
    expect(value.config).toEqual({ enabled: true, items: [null, 1, "value"] });
    expect(Object.hasOwn(value, "__proto__")).toBe(true);
    expect(value.__proto__).toEqual({ safe: true });
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.config)).toBe(true);
    const config = value.config as Readonly<Record<string, JsonValue>>;
    expect(Object.isFrozen(config.items)).toBe(true);

    const independent = expectSuccess(text);
    expect(independent).toEqual(value);
    expect(independent).not.toBe(value);
    expect((independent as Readonly<Record<string, JsonValue>>).config).not.toBe(value.config);
  });

  it("rejects malformed JSON and non-finite JSON numbers without exposing partial data", () => {
    const invalidInputs: readonly unknown[] = [
      undefined,
      null,
      { value: true },
      "",
      '{"value":',
      '{"value":1,}',
      "[1,]",
      "01",
      "1e",
      "1e9999",
      "true false",
      "\ufeff{}",
    ];

    invalidInputs.forEach((input) => expectFailure(input, "invalid-json"));
  });

  it("rejects duplicate decoded member names at every object level", () => {
    expectFailure('{"a":1,"a":2}', "duplicate-member");
    expectFailure('{"nested":{"a":1,"\\u0061":2}}', "duplicate-member");
    expectFailure('{"\\u0061":1,"a":2}', "duplicate-member");
  });

  it("rejects raw and escaped unpaired Unicode while accepting scalar pairs", () => {
    expectFailure(`"${String.fromCharCode(0xd800)}"`, "invalid-unicode");
    expectFailure('"\\ud800"', "invalid-unicode");
    expectFailure('{"\\udc00":true}', "invalid-unicode");

    expect(expectSuccess(`"${String.fromCodePoint(0x1f600)}"`)).toBe("😀");
    expect(expectSuccess('"\\ud83d\\ude00"')).toBe("😀");
  });

  it("keeps every decoded protocol-reserved object member behind M09-T08", () => {
    const dynamicInputs = [
      '{"$ref":"state.email"}',
      '{"nested":{"\\u0024token":"color.brand"}}',
      '[{"deep":{"$format":{"template":"{value}","values":{}}}}]',
    ];
    dynamicInputs.forEach((input) => expectFailure(input, "dynamic-value"));

    expect(expectSuccess('{"label":"$ref","cash$":"allowed"}')).toEqual({
      label: "$ref",
      cash$: "allowed",
    });
    expectFailure('{"$ref":', "invalid-json");
    expectFailure('{"$ref":1,"\\u0024ref":2}', "duplicate-member");
  });

  it("enforces Publisher depth, value-count, and number-token boundaries exactly", () => {
    const depth = PUBLISH_SOURCE_JSON_LIMITS.maxJsonDepth;
    expectSuccess(`${"[".repeat(depth)}0${"]".repeat(depth)}`);
    expectFailure(`${"[".repeat(depth + 1)}0${"]".repeat(depth + 1)}`, "limit-exceeded");

    const occurrenceLimit = PUBLISH_SOURCE_JSON_LIMITS.maxJsonValueOccurrences;
    expectSuccess(`[${"0,".repeat(occurrenceLimit - 2)}0]`);
    expectFailure(`[${"0,".repeat(occurrenceLimit - 1)}0]`, "limit-exceeded");

    const numberLimit = PUBLISH_SOURCE_JSON_LIMITS.maxNumberTokenCodeUnits;
    expect(expectSuccess(`1e${"0".repeat(numberLimit - 2)}`)).toBe(1);
    expectFailure(`1e${"0".repeat(numberLimit - 1)}`, "limit-exceeded");
  });

  it("enforces Publisher decoded-string and raw UTF-8 byte boundaries exactly", () => {
    const decodedLimit = PUBLISH_SOURCE_JSON_LIMITS.maxDecodedStringCodeUnits;
    expectSuccess(`"${"a".repeat(decodedLimit)}"`);
    expectFailure(`"${"a".repeat(decodedLimit + 1)}"`, "limit-exceeded");

    const exactTwoByteCharacters = (PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes - 2) / 2;
    expect(Number.isInteger(exactTwoByteCharacters)).toBe(true);
    expectSuccess(`"${"é".repeat(exactTwoByteCharacters)}"`);
    expectFailure(`"${"é".repeat(exactTwoByteCharacters + 1)}"`, "limit-exceeded");
  }, 20_000);

  it("formats objects canonically and arrays semantically before exact round trip", () => {
    const first = {
      zeta: [{ beta: 2, alpha: 1 }],
      "2": "two",
      "10": "ten",
      alpha: true,
    } satisfies JsonValue;
    const second = {
      alpha: true,
      "10": "ten",
      "2": "two",
      zeta: [{ alpha: 1, beta: 2 }],
    } satisfies JsonValue;
    const expected = [
      "{",
      '  "10": "ten",',
      '  "2": "two",',
      '  "alpha": true,',
      '  "zeta": [',
      "    {",
      '      "alpha": 1,',
      '      "beta": 2',
      "    }",
      "  ]",
      "}",
    ].join("\n");

    expect(formatStructuredJson(first)).toBe(expected);
    expect(formatStructuredJson(second)).toBe(expected);
    const reparsed = expectSuccess(expected);
    expect(reparsed).toEqual(first);
    expect(formatStructuredJson(reparsed)).toBe(expected);
  });

  it("keeps a deeply indented admitted value editable through compact fallback", () => {
    let value: JsonValue = Array.from({ length: 70_000 }, () => null);
    for (let depth = 1; depth < PUBLISH_SOURCE_JSON_LIMITS.maxJsonDepth; depth += 1) {
      value = [value];
    }

    const formatted = formatStructuredJson(value);

    expect(formatted.includes("\n")).toBe(false);
    expect(new TextEncoder().encode(formatted).byteLength).toBeLessThanOrEqual(
      PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes,
    );
    expect(expectSuccess(formatted)).toEqual(value);
  });
});
