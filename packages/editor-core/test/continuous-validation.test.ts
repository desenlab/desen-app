import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

import { createDesenEditorContinuousValidator, createDesenEditorDocument } from "../src/index.js";

import type { DesenEditorDocument } from "../src/index.js";

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

function admit(input: unknown = clone(validSource)): DesenEditorDocument {
  const result = createDesenEditorDocument(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError("Expected the Source fixture to be admitted.");
  return result.document;
}

function createValidator(catalogs: unknown = [clone(validCatalog)]) {
  const result = createDesenEditorContinuousValidator(catalogs);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError("Expected the Catalog fixture to be admitted.");
  return result.validator;
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

function signInRoot(input: unknown): MutableRecord {
  return record(record(record(record(input).surfaces)["sign-in"]).root);
}

function signInDefaultChildren(input: unknown): MutableRecord[] {
  const children = record(signInRoot(input).slots).default;
  if (!Array.isArray(children)) throw new TypeError("Expected the sign-in default slot array.");
  return children as MutableRecord[];
}

function emptySecondCatalog(): MutableRecord {
  const catalog = clone(validCatalog) as unknown;
  const result = record(catalog);
  result.id = "com.example.empty-catalog";
  result.description = "An empty second Catalog used to prove ordered snapshot identity.";
  result.components = {};
  result.behaviors = {};
  result.operations = {};
  result.resources = {};
  return result;
}

describe("createDesenEditorContinuousValidator", () => {
  it("returns controlled frozen Catalog diagnostics without a partial validator", () => {
    const result = createDesenEditorContinuousValidator([{ kind: "desen.catalog" }]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected the malformed Catalog set to fail.");
    expect(Reflect.ownKeys(result)).toEqual(["ok", "diagnostics"]);
    expect(result.diagnostics[0]?.code).toBe("SCHEMA_INVALID");
    expect(Object.hasOwn(result, "validator")).toBe(false);
    expectDeepFrozen(result);

    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("SECRET_CATALOG_TRAP");
        },
      },
    );
    const hostileResult = createDesenEditorContinuousValidator(hostile);
    expect(hostileResult.ok).toBe(false);
    expect(JSON.stringify(hostileResult)).not.toContain("SECRET_CATALOG_TRAP");
    expectDeepFrozen(hostileResult);
  });

  it("captures a detached immutable Catalog snapshot and ignores later caller mutation", () => {
    const callerCatalog = clone(validCatalog) as unknown;
    const expectedFingerprint = createValidator().catalogSetFingerprint;
    const validator = createValidator([callerCatalog]);

    record(callerCatalog).components = {};
    record(callerCatalog).id = "caller-mutated";

    const report = validator.validate(admit());
    expect(validator.catalogSetFingerprint).toBe(expectedFingerprint);
    expect(report.catalogSetFingerprint).toBe(expectedFingerprint);
    expect(report.valid).toBe(true);
    expectDeepFrozen(validator);
    expectDeepFrozen(report);
  });

  it("makes Catalog-set fingerprints order-sensitive while validation traversal stays deterministic", () => {
    const first = createValidator([clone(validCatalog), emptySecondCatalog()]);
    const second = createValidator([emptySecondCatalog(), clone(validCatalog)]);
    const document = admit();

    expect(first.catalogSetFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(second.catalogSetFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(first.catalogSetFingerprint).not.toBe(second.catalogSetFingerprint);
    expect(first.validate(document)).toEqual(first.validate(document));
  });
});

describe("DesenEditorContinuousValidator.validate", () => {
  it("keeps a Source valid when complete dynamic obligations remain", () => {
    const report = createValidator().validate(admit());

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.obligations.length).toBeGreaterThan(0);
    expect(report.invalidSubjects).toEqual([]);
    expect(report.unmappedDiagnosticIndexes).toEqual([]);
    expect(report.documentFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Reflect.ownKeys(report)).toEqual([
      "valid",
      "documentFingerprint",
      "catalogSetFingerprint",
      "diagnostics",
      "obligations",
      "invalidSubjects",
      "unmappedDiagnosticIndexes",
    ]);
    expect(Object.hasOwn(report, "document")).toBe(false);
    expect(Object.hasOwn(report, "value")).toBe(false);
    expectDeepFrozen(report);
  });

  it("fingerprints the complete Source including root authoring metadata", () => {
    const first = clone(validSource) as unknown;
    const second = clone(validSource) as unknown;
    record(first).authoring = { selection: { surfaceId: "sign-in", nodeId: "sign-in.email" } };
    record(second).authoring = {
      selection: { surfaceId: "sign-in", nodeId: "sign-in.password" },
    };
    const validator = createValidator();
    const firstReport = validator.validate(admit(first));
    const secondReport = validator.validate(admit(second));

    expect(firstReport.valid).toBe(true);
    expect(secondReport.valid).toBe(true);
    expect(firstReport.documentFingerprint).not.toBe(secondReport.documentFingerprint);
  });

  it("maps a diagnostic only from its explicit surface and node subject context", () => {
    const input = clone(validSource) as unknown;
    signInRoot(input).use = "com.example.unresolved/Unknown";
    const report = createValidator().validate(admit(input));

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "UNKNOWN_CAPABILITY",
        pointer: "/surfaces/sign-in/root/use",
        context: expect.objectContaining({
          surfaceId: "sign-in",
          subject: { kind: "node", id: "sign-in.layout" },
        }),
      }),
    ]);
    expect(report.invalidSubjects).toEqual([
      {
        surfaceId: "sign-in",
        subject: { kind: "node", id: "sign-in.layout" },
        diagnosticIndexes: [0],
        occurrencePointers: ["/surfaces/sign-in/root"],
      },
    ]);
    expect(report.unmappedDiagnosticIndexes).toEqual([]);
    expect(report.documentFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("maps invalid command input to the explicit target node instead of the action actor", () => {
    const catalog = clone(validCatalog) as unknown;
    const components = record(record(catalog).components);
    const textField = record(components["com.example.ui/TextField"]);
    const commands = record(textField.commands);
    const focus = record(commands.focus);
    focus.inputSchema = {
      type: "object",
      additionalProperties: false,
      required: ["selectAll"],
      properties: { selectAll: { type: "boolean" } },
    };

    const input = clone(validSource) as unknown;
    const submit = signInDefaultChildren(input)[4];
    if (submit === undefined) throw new TypeError("Expected the submit node.");
    const press = record(submit.on).press;
    if (!Array.isArray(press)) throw new TypeError("Expected the submit press action array.");
    press.push({
      type: "component.command",
      target: "sign-in.email",
      command: "focus",
      input: { selectAll: "yes" },
    });

    const report = createValidator([catalog]).validate(admit(input));
    const commandDiagnosticIndex = report.diagnostics.findIndex(
      (diagnostic) => diagnostic.code === "COMMAND_INPUT_INVALID",
    );
    const targetMapping = report.invalidSubjects.find(
      (mapping) => mapping.subject.kind === "node" && mapping.subject.id === "sign-in.email",
    );

    expect(commandDiagnosticIndex).toBeGreaterThanOrEqual(0);
    expect(report.diagnostics[commandDiagnosticIndex]).toEqual(
      expect.objectContaining({
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/1/input/selectAll",
        context: expect.objectContaining({
          surfaceId: "sign-in",
          subject: { kind: "node", id: "sign-in.email" },
        }),
      }),
    );
    expect(targetMapping?.diagnosticIndexes).toContain(commandDiagnosticIndex);
    expect(targetMapping?.occurrencePointers).toEqual(["/surfaces/sign-in/root/slots/default/1"]);
    expect(targetMapping?.occurrencePointers).not.toContain(
      "/surfaces/sign-in/root/slots/default/4",
    );
  });

  it("maps a rejected slot child to the explicit slot-owner subject instead of the child pointer", () => {
    const catalog = clone(validCatalog) as unknown;
    const components = record(record(catalog).components);
    const stack = record(components["com.example.ui/Stack"]);
    const defaultSlot = record(record(stack.slots).default);
    defaultSlot.accepts = [];
    defaultSlot.acceptsCategories = ["action"];

    const report = createValidator([catalog]).validate(admit());
    const childDiagnosticIndex = report.diagnostics.findIndex(
      (diagnostic) =>
        diagnostic.code === "SLOT_CHILD_REJECTED" &&
        diagnostic.pointer === "/surfaces/sign-in/root/slots/default/0/use",
    );
    const ownerMapping = report.invalidSubjects.find(
      (mapping) =>
        mapping.surfaceId === "sign-in" &&
        mapping.subject.kind === "node" &&
        mapping.subject.id === "sign-in.layout",
    );

    expect(childDiagnosticIndex).toBeGreaterThanOrEqual(0);
    expect(report.diagnostics[childDiagnosticIndex]?.context).toEqual(
      expect.objectContaining({
        surfaceId: "sign-in",
        subject: { kind: "node", id: "sign-in.layout" },
      }),
    );
    expect(ownerMapping?.diagnosticIndexes).toContain(childDiagnosticIndex);
    expect(ownerMapping?.occurrencePointers).toEqual(["/surfaces/sign-in/root"]);
    expect(ownerMapping?.occurrencePointers).not.toContain(
      "/surfaces/sign-in/root/slots/default/0",
    );
  });

  it("returns every duplicate occurrence while keeping node and behavior identities separate", () => {
    const duplicateNodes = clone(validSource) as unknown;
    const firstChild = signInDefaultChildren(duplicateNodes)[0];
    if (firstChild === undefined) throw new TypeError("Expected the first sign-in child.");
    firstChild.id = "sign-in.email";
    const duplicateReport = createValidator().validate(admit(duplicateNodes));

    expect(duplicateReport.valid).toBe(false);
    expect(duplicateReport.invalidSubjects).toContainEqual({
      surfaceId: "sign-in",
      subject: { kind: "node", id: "sign-in.email" },
      diagnosticIndexes: [0],
      occurrencePointers: [
        "/surfaces/sign-in/root/slots/default/0",
        "/surfaces/sign-in/root/slots/default/1",
      ],
    });

    const crossKind = clone(validSource) as unknown;
    signInRoot(crossKind).behaviors = [
      {
        id: "sign-in.layout",
        use: "com.example.interactions/Sortable",
        props: { axis: "vertical" },
      },
    ];
    const crossKindReport = createValidator().validate(admit(crossKind));
    const duplicateMapping = crossKindReport.invalidSubjects.find((mapping) =>
      mapping.diagnosticIndexes.some(
        (index) => crossKindReport.diagnostics[index]?.code === "DUPLICATE_NODE_ID",
      ),
    );

    expect(duplicateMapping).toEqual({
      surfaceId: "sign-in",
      subject: { kind: "behavior", id: "sign-in.layout" },
      diagnosticIndexes: expect.any(Array),
      occurrencePointers: ["/surfaces/sign-in/root/behaviors/0"],
    });
    expect(duplicateMapping?.occurrencePointers).not.toContain("/surfaces/sign-in/root");
  });

  it("leaves diagnostics without an explicit subject unmapped instead of guessing from pointers", () => {
    const input = clone(validSource) as unknown;
    record(record(record(input).surfaces)["sign-in"]).id = "different-surface-id";
    const report = createValidator().validate(admit(input));
    const mismatchIndex = report.diagnostics.findIndex(
      (diagnostic) => diagnostic.code === "DUPLICATE_SURFACE_ID",
    );

    expect(mismatchIndex).toBeGreaterThanOrEqual(0);
    expect(report.diagnostics[mismatchIndex]?.context).toEqual({
      documentId: validSource.id,
      surfaceId: "sign-in",
    });
    expect(report.unmappedDiagnosticIndexes).toContain(mismatchIndex);
    expect(report.invalidSubjects.flatMap((mapping) => mapping.diagnosticIndexes)).not.toContain(
      mismatchIndex,
    );
  });

  it("groups every diagnostic for one exact subject without changing Validator order", () => {
    const input = clone(validSource) as unknown;
    const root = signInRoot(input);
    root.props = { direction: "invalid", maxWidth: -1 };
    const validator = createValidator();
    const first = validator.validate(admit(input));
    const second = validator.validate(admit(input));

    expect(first).toEqual(second);
    expect(first.invalidSubjects).toHaveLength(1);
    expect(first.diagnostics.length).toBeGreaterThan(1);
    expect(first.invalidSubjects[0]?.diagnosticIndexes.length).toBe(first.diagnostics.length);
    expect(first.invalidSubjects[0]?.occurrencePointers).toEqual(["/surfaces/sign-in/root"]);
  });

  it("contains hostile runtime casts as controlled stale-input reports without leaking trap details", () => {
    let trapCalls = 0;
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          trapCalls += 1;
          throw new Error("SECRET_PROXY_DETAIL");
        },
      },
    );
    const validator = createValidator();
    const report = validator.validate(hostile as DesenEditorDocument);

    expect(trapCalls).toBeGreaterThan(0);
    expect(report.valid).toBe(false);
    expect(report.documentFingerprint).toBeNull();
    expect(report.diagnostics[0]?.code).toBe("SCHEMA_INVALID");
    expect(report.obligations).toEqual([]);
    expect(report.invalidSubjects).toEqual([]);
    expect(report.unmappedDiagnosticIndexes).toEqual(report.diagnostics.map((_, index) => index));
    expect(JSON.stringify(report)).not.toContain("SECRET_PROXY_DETAIL");
    expectDeepFrozen(report);
  });
});
