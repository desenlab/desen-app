import { describe, expect, it, vi } from "vitest";

import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import officialSource from "../../../examples/sign-in/official-derived.source.desen.json";

import type { RuntimeOperationRequest } from "@desen/runtime-core";

import {
  AUTHORING_FIXTURE_CONTEXT_MODEL,
  createAuthoringOperationFixtureController,
  prepareAuthoringOperationFixtureModel,
} from "../src/authoring-fixtures.js";

const REVISION = `sha256:${"1".repeat(64)}`;
const EXPORT_OPERATION_ID = "com.example.reporting/exportReport";

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) expectDeeplyFrozen(descriptor.value);
  }
}

function sourceWithAliases(...aliases: string[]): unknown {
  const source = structuredClone(officialSource);
  const children = source.surfaces["sign-in"].root.slots.default;
  const submit = children.find((node) => node.id === "sign-in.submit");
  if (submit?.on?.press === undefined) throw new TypeError("Reference submit action is missing.");
  const invocation = submit.on.press[0];
  if (invocation?.type !== "operation.invoke") throw new TypeError("Reference invoke is missing.");
  submit.on.press = aliases.map((alias) => ({ ...structuredClone(invocation), as: alias }));
  return source;
}

function catalogWithExportOperation() {
  const catalog = structuredClone(referenceCatalog);
  const base = structuredClone(referenceCatalog.operations["com.example.auth/signIn"]);
  const operation = {
    ...base,
    authoring: {
      fixtures: {
        errors: { quotaExceeded: {} },
        success: { receiptId: "receipt-1" },
      },
    },
    description: "Export the current report.",
    effect: "external" as const,
    errors: [{ code: "quotaExceeded", description: "The export quota was exceeded." }],
    outputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      additionalProperties: false,
      properties: { receiptId: { type: "string" } },
      required: ["receiptId"],
      type: "object",
    },
  };
  (catalog.operations as Record<string, unknown>)[EXPORT_OPERATION_ID] = operation;
  return catalog;
}

function sourceWithExportInvocation(alias = "reportExport") {
  const source = structuredClone(officialSource);
  const submit = source.surfaces["sign-in"].root.slots.default.find(
    (node) => node.id === "sign-in.submit",
  );
  if (submit?.on?.press?.[0]?.type !== "operation.invoke") {
    throw new TypeError("Reference invoke is missing.");
  }
  submit.on.press[0] = {
    ...submit.on.press[0],
    as: alias,
    operation: EXPORT_OPERATION_ID,
  };
  return source;
}

function readyModel(...aliases: string[]) {
  const model = prepareAuthoringOperationFixtureModel(
    referenceCatalog,
    sourceWithAliases(...aliases),
    "sign-in",
  );
  expect(model.status).toBe("ready");
  if (model.status !== "ready") throw new TypeError(model.reason);
  return model;
}

function createController(...aliases: string[]) {
  return createAuthoringOperationFixtureController(readyModel(...aliases), {
    documentId: "com.example.account-app",
    revision: REVISION,
    surfaceId: "sign-in",
  });
}

function operationRequest(
  alias: string,
  overrides: Partial<RuntimeOperationRequest> = {},
): RuntimeOperationRequest {
  return {
    context: {
      documentId: "com.example.account-app",
      revision: REVISION,
      surfaceId: "sign-in",
      requestId: `operation:${alias}:1`,
    },
    capabilityId: "com.example.auth/signIn",
    invocationAlias: alias,
    input: { opaque: "fixture-secret" },
    effect: "network",
    ...overrides,
  };
}

describe("Desen App generic authoring fixture projection", () => {
  it("keeps synthetic explicit while integration and production remain unavailable", () => {
    expect(
      AUTHORING_FIXTURE_CONTEXT_MODEL.options.map(({ id, availability }) => [id, availability]),
    ).toEqual([
      ["synthetic", "active"],
      ["integration", "unavailable"],
      ["production", "unavailable"],
    ]);
    expectDeeplyFrozen(AUTHORING_FIXTURE_CONTEXT_MODEL);
  });

  it("derives every Source alias and only authenticated Catalog fixture outcomes", () => {
    const model = readyModel("primaryAuth", "backupAuth");

    expect(model.operations.map(({ alias }) => alias)).toEqual(["backupAuth", "primaryAuth"]);
    expect(model.operations[0]).toMatchObject({
      alias: "backupAuth",
      capabilityId: "com.example.auth/signIn",
      effect: "network",
      description: "Authenticate with email and password.",
      outcomes: [
        {
          id: "success",
          label: "Success",
          kind: "success",
          errorCode: null,
          fixtureValue: { userId: "user-1" },
        },
        {
          id: "error:invalidCredentials",
          label: "Error · invalidCredentials",
          kind: "error",
          errorCode: "invalidCredentials",
          fixtureValue: {},
        },
      ],
    });
    expect(JSON.stringify(model)).not.toContain("error:unavailable");
    expectDeeplyFrozen(model);
  });

  it("derives a non-auth operation, effect, and error inventory from Catalog authority", () => {
    const model = prepareAuthoringOperationFixtureModel(
      catalogWithExportOperation(),
      sourceWithExportInvocation(),
      "sign-in",
    );

    expect(model).toMatchObject({
      status: "ready",
      operations: [
        {
          alias: "reportExport",
          capabilityId: EXPORT_OPERATION_ID,
          description: "Export the current report.",
          effect: "external",
          outcomes: [
            {
              id: "success",
              fixtureValue: { receiptId: "receipt-1" },
            },
            {
              id: "error:quotaExceeded",
              errorCode: "quotaExceeded",
              fixtureValue: {},
            },
          ],
        },
      ],
    });
  });

  it("finds nested invokes and rejects one alias reused for different operations", () => {
    const catalog = catalogWithExportOperation();
    const nested = structuredClone(officialSource);
    const nestedSubmit = nested.surfaces["sign-in"].root.slots.default.find(
      (node) => node.id === "sign-in.submit",
    );
    const parent = nestedSubmit?.on?.press?.[0];
    if (parent?.type !== "operation.invoke") throw new TypeError("Reference invoke is missing.");
    (parent as unknown as { onFailure?: unknown[] }).onFailure = [
      {
        ...structuredClone(parent),
        as: "reportExport",
        operation: EXPORT_OPERATION_ID,
      },
    ];
    const nestedModel = prepareAuthoringOperationFixtureModel(catalog, nested, "sign-in");
    expect(nestedModel.status).toBe("ready");
    if (nestedModel.status === "ready") {
      expect(nestedModel.operations.map(({ alias }) => alias)).toEqual(["reportExport", "signIn"]);
    }

    const conflict = structuredClone(officialSource);
    const conflictSubmit = conflict.surfaces["sign-in"].root.slots.default.find(
      (node) => node.id === "sign-in.submit",
    );
    const conflictPress = conflictSubmit?.on?.press;
    const invocation = conflictPress?.[0];
    if (invocation?.type !== "operation.invoke" || conflictPress === undefined) {
      throw new TypeError("Reference invoke is missing.");
    }
    conflictPress.splice(
      0,
      conflictPress.length,
      { ...structuredClone(invocation), as: "shared" },
      { ...structuredClone(invocation), as: "shared", operation: EXPORT_OPERATION_ID },
    );
    expect(prepareAuthoringOperationFixtureModel(catalog, conflict, "sign-in")).toEqual({
      status: "rejected",
      reason: "alias-conflict",
    });
  });

  it("represents a surface with no operation action honestly instead of inventing a controller", () => {
    const model = prepareAuthoringOperationFixtureModel(referenceCatalog, officialSource, "home");
    expect(model).toMatchObject({ status: "ready", surfaceId: "home", operations: [] });
    const controller = createAuthoringOperationFixtureController(model, {
      documentId: "com.example.account-app",
      revision: REVISION,
      surfaceId: "home",
    });

    expect(controller.read()).toEqual({
      modelStatus: "ready",
      rejectionReason: null,
      disposed: false,
      operations: [],
    });
    expect(controller.operationPort.invoke(operationRequest("invented"))).toEqual({
      status: "denied",
    });
  });

  it("represents a used operation with no Catalog fixture as unavailable", () => {
    const catalog = structuredClone(referenceCatalog);
    delete (catalog.operations["com.example.auth/signIn"] as { authoring?: unknown }).authoring;
    const model = prepareAuthoringOperationFixtureModel(
      catalog,
      sourceWithAliases("authenticate"),
      "sign-in",
    );
    expect(model.status).toBe("ready");
    const controller = createAuthoringOperationFixtureController(model, {
      documentId: "com.example.account-app",
      revision: REVISION,
      surfaceId: "sign-in",
    });

    expect(controller.read().operations[0]).toMatchObject({
      alias: "authenticate",
      status: "unavailable",
      selectedOutcomeId: null,
      outcomes: [],
    });
    expect(controller.operationPort.invoke(operationRequest("authenticate"))).toEqual({
      status: "denied",
    });
    expect(controller.selectOutcome("authenticate", "success")).toEqual({
      status: "rejected",
      reason: "unavailable",
    });
  });

  it("fails closed for invalid source, missing surface, and rejected preparation", () => {
    expect(prepareAuthoringOperationFixtureModel(referenceCatalog, {}, "sign-in")).toEqual({
      status: "rejected",
      reason: "source-invalid",
    });
    const missing = prepareAuthoringOperationFixtureModel(
      referenceCatalog,
      officialSource,
      "missing",
    );
    expect(missing).toEqual({ status: "rejected", reason: "surface-missing" });
    const controller = createAuthoringOperationFixtureController(missing, {
      documentId: "com.example.account-app",
      revision: REVISION,
      surfaceId: "missing",
    });
    expect(controller.read()).toEqual({
      modelStatus: "rejected",
      rejectionReason: "surface-missing",
      disposed: false,
      operations: [],
    });
    expect(controller.operationPort.invoke(operationRequest("anything"))).toEqual({
      status: "denied",
    });
  });

  it("rejects an oversized action list before projecting or spreading its members", () => {
    const oversized = structuredClone(officialSource);
    const submit = oversized.surfaces["sign-in"].root.slots.default.find(
      (node) => node.id === "sign-in.submit",
    );
    const press = submit?.on?.press;
    const invocation = press?.[0];
    if (invocation?.type !== "operation.invoke" || press === undefined) {
      throw new TypeError("Reference invoke is missing.");
    }
    (submit?.on as unknown as { press: typeof press }).press = Array.from(
      { length: 25_001 },
      () => invocation,
    );

    let result: ReturnType<typeof prepareAuthoringOperationFixtureModel> | undefined;
    expect(() => {
      result = prepareAuthoringOperationFixtureModel(referenceCatalog, oversized, "sign-in");
    }).not.toThrow();
    expect(result).toEqual(expect.objectContaining({ status: "rejected" }));
  });
});

describe("Desen App generic deferred operation fixture controller", () => {
  it("keeps independent aliases pending and settles each captured Catalog outcome explicitly", async () => {
    const controller = createController("primaryAuth", "backupAuth");
    expect(controller.selectOutcome("primaryAuth", "error:invalidCredentials")).toMatchObject({
      status: "selected",
      alias: "primaryAuth",
    });

    const primary = controller.operationPort.invoke(operationRequest("primaryAuth"));
    const backup = controller.operationPort.invoke(operationRequest("backupAuth"));
    expect(controller.read().operations.map(({ alias, status }) => [alias, status])).toEqual([
      ["backupAuth", "pending"],
      ["primaryAuth", "pending"],
    ]);
    expect(controller.completePending("backupAuth")).toEqual({
      status: "completed",
      alias: "backupAuth",
      outcomeId: "success",
    });
    await expect(Promise.resolve(backup)).resolves.toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });
    expect(controller.completePending("primaryAuth")).toEqual({
      status: "completed",
      alias: "primaryAuth",
      outcomeId: "error:invalidCredentials",
    });
    await expect(Promise.resolve(primary)).resolves.toEqual({
      status: "failed",
      errorCode: "invalidCredentials",
    });
    expect(controller.read().operations.map(({ status }) => status)).toEqual([
      "succeeded",
      "failed",
    ]);
    expectDeeplyFrozen(controller.read());
  });

  it.each([
    ["wrong capability", { capabilityId: "com.example.auth/other" }],
    ["wrong alias", { invocationAlias: "other" }],
    ["wrong effect", { effect: "external" as const }],
  ])("denies %s without starting a lifecycle", async (_label, override) => {
    const controller = createController("authenticate");
    await expect(
      Promise.resolve(controller.operationPort.invoke(operationRequest("authenticate", override))),
    ).resolves.toEqual({ status: "denied" });
    expect(controller.read().operations[0]?.status).toBe("idle");
  });

  it.each([
    ["documentId", "com.example.other-app"],
    ["revision", `sha256:${"2".repeat(64)}`],
    ["surfaceId", "home"],
    ["requestId", ""],
  ])("denies a request with the wrong %s context", async (key, value) => {
    const controller = createController("authenticate");
    const request = operationRequest("authenticate");
    await expect(
      Promise.resolve(
        controller.operationPort.invoke(
          operationRequest("authenticate", {
            context: { ...request.context, [key]: value },
          }),
        ),
      ),
    ).resolves.toEqual({ status: "denied" });
  });

  it("never reads or retains operation input and rejects accessor authorization fields", async () => {
    const controller = createController("authenticate");
    const inputAccess = vi.fn(() => {
      throw new Error("input must remain opaque");
    });
    const request = operationRequest("authenticate");
    Object.defineProperty(request, "input", { enumerable: true, get: inputAccess });
    const invocation = controller.operationPort.invoke(request);
    expect(inputAccess).not.toHaveBeenCalled();
    expect(JSON.stringify(controller.read())).not.toContain("fixture-secret");
    controller.completePending("authenticate");
    await expect(Promise.resolve(invocation)).resolves.toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });
    expect(inputAccess).not.toHaveBeenCalled();

    const capabilityAccess = vi.fn(() => "com.example.auth/signIn");
    const accessorRequest = operationRequest("authenticate");
    Object.defineProperty(accessorRequest, "capabilityId", {
      enumerable: true,
      get: capabilityAccess,
    });
    expect(controller.operationPort.invoke(accessorRequest)).toEqual({ status: "denied" });
    expect(capabilityAccess).not.toHaveBeenCalled();
  });

  it("revokes pending work on deactivate, supports replay, and terminally disposes", async () => {
    const controller = createController("authenticate");
    const pending = controller.operationPort.invoke(operationRequest("authenticate"));
    controller.deactivate();
    await expect(Promise.resolve(pending)).resolves.toEqual({ status: "denied" });
    expect(controller.operationPort.invoke(operationRequest("authenticate"))).toEqual({
      status: "denied",
    });
    expect(controller.completePending("authenticate")).toEqual({
      status: "ignored",
      reason: "inactive",
    });

    controller.activate();
    const replay = controller.operationPort.invoke(operationRequest("authenticate"));
    controller.completePending("authenticate");
    await expect(Promise.resolve(replay)).resolves.toMatchObject({ status: "succeeded" });
    controller.dispose();
    controller.activate();
    expect(controller.read()).toMatchObject({ disposed: true });
    expect(controller.read().operations[0]?.status).toBe("disposed");
    expect(controller.operationPort.invoke(operationRequest("authenticate"))).toEqual({
      status: "denied",
    });
  });

  it("revokes a replaced transport while retaining one stable host port", async () => {
    const controller = createController("authenticate");
    const port = controller.operationPort;
    const first = port.invoke(operationRequest("authenticate"));
    const second = port.invoke(
      operationRequest("authenticate", {
        context: { ...operationRequest("authenticate").context, requestId: "replacement" },
      }),
    );
    await expect(Promise.resolve(first)).resolves.toEqual({ status: "denied" });
    expect(controller.operationPort).toBe(port);
    controller.completePending("authenticate");
    await expect(Promise.resolve(second)).resolves.toMatchObject({ status: "succeeded" });
  });

  it("rejects forged ready models and mismatched preview identity", () => {
    const model = readyModel("authenticate");
    expect(() =>
      createAuthoringOperationFixtureController(
        { ...model },
        { documentId: model.documentId, revision: REVISION, surfaceId: model.surfaceId },
      ),
    ).toThrow(TypeError);
    expect(() =>
      createAuthoringOperationFixtureController(model, {
        documentId: model.documentId,
        revision: REVISION,
        surfaceId: "home",
      }),
    ).toThrow(TypeError);
  });
});
