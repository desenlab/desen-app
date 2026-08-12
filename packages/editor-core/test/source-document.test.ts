import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import { createDesenEditorDocument } from "../src/index.js";

type MutableRecord = Record<string, unknown>;

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a test-fixture object.");
  }
  return value as MutableRecord;
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    pending.push(...Object.values(value));
  }
}

describe("createDesenEditorDocument", () => {
  it("admits the official Source directly without a hidden document wrapper", () => {
    const input = clone(validSource) as MutableRecord;
    input.authoring = { selection: { surfaceId: "sign-in", nodeId: "email" } };
    const result = createDesenEditorDocument(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected the official Source to be admitted.");

    expect(result.document).toEqual(input);
    expect(Object.keys(result.document).sort()).toEqual(Object.keys(input).sort());
    expect(Object.hasOwn(result.document, "source")).toBe(false);
    expect(Object.hasOwn(result.document, "nodes")).toBe(false);
    expect(JSON.parse(JSON.stringify(result.document))).toEqual(input);
    expect(result.document.authoring).toEqual({
      selection: { surfaceId: "sign-in", nodeId: "email" },
    });
    expect(result.diagnostics).toEqual([]);
    expectDeepFrozen(result);
  });

  it("detaches independent snapshots without freezing or retaining caller input", () => {
    const firstInput = clone(validSource);
    const secondInput = clone(validSource);
    const first = createDesenEditorDocument(firstInput);
    const second = createDesenEditorDocument(secondInput);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new TypeError("Expected valid Source snapshots.");

    expect(first.document).not.toBe(firstInput);
    expect(first.document).not.toBe(second.document);
    expect(first.document.surfaces).not.toBe(record(firstInput).surfaces);
    expect(Object.isFrozen(firstInput)).toBe(false);
    expect(Object.isFrozen(record(firstInput).surfaces)).toBe(false);

    record(firstInput).id = "caller-mutated";
    record(record(firstInput).surfaces).extra = clone(
      record(record(firstInput).surfaces)["sign-in"],
    );

    expect(first.document.id).toBe(validSource.id);
    expect(first.document.surfaces).toEqual(validSource.surfaces);
    expect(second.document).toEqual(validSource);
  });

  it("admits structurally valid unresolved semantics for later continuous validation", () => {
    const input = clone(validSource);
    const surfaces = record(record(input).surfaces);
    const surface = record(surfaces["sign-in"]);
    const root = record(surface.root);
    root.use = "com.example.unresolved/Unknown";

    const result = createDesenEditorDocument(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected structural editor admission to succeed.");
    const admittedSurface = result.document.surfaces["sign-in"];
    expect(admittedSurface?.root.use).toBe("com.example.unresolved/Unknown");
  });

  it("rejects invalid Source structure with frozen diagnostics and no partial document", () => {
    const input = clone(validSource);
    record(input).kind = "desen.bundle";

    const result = createDesenEditorDocument(input);

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected an invalid Source to be rejected.");
    expect(Object.keys(result).sort()).toEqual(["diagnostics", "ok"]);
    expect(Object.hasOwn(result, "document")).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_INVALID", pointer: "/kind" }),
    );
    expectDeepFrozen(result);
  });

  it("rejects an invalid embedded schema instead of admitting a root-only Source", () => {
    const input = clone(validSource);
    const surfaces = record(record(input).surfaces);
    const signIn = record(surfaces["sign-in"]);
    const state = record(signIn.state);
    const email = record(state.email);
    email.schema = { type: "string", pattern: "[" };

    const result = createDesenEditorDocument(input);

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected the invalid embedded schema to be rejected.");
    expect(Object.hasOwn(result, "document")).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "SCHEMA_INVALID",
        pointer: "/surfaces/sign-in/state/email/schema/pattern",
      }),
    ]);
    expectDeepFrozen(result);
  });

  it("rejects executable or non-JSON input before it can enter the document model", () => {
    const input = clone(validSource) as MutableRecord;
    input.authoring = { executable: () => "not data" };

    const result = createDesenEditorDocument(input);

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected non-JSON input to be rejected.");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "SCHEMA_INVALID", pointer: "" }),
    ]);
    expect(Object.hasOwn(result, "document")).toBe(false);
  });
});
