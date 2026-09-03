import { describe, expect, it, vi } from "vitest";

import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createDesenEditorDocument } from "@desen/editor-core";

import {
  createAuthoringIntegrationBinding,
  createAuthoringIntegrationController,
  readAuthoringIntegrationBinding,
} from "../src/authoring-integration.js";
import { prepareAuthoringSurfacePreviewBundle } from "../src/authoring-preview.js";
import {
  createProjectWorkspaceProfile,
  readProjectWorkspaceProfileAuthority,
} from "../src/project-workspace-profile.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "../src/reference-sign-in-workspace-profile.js";

import type { RuntimeHostCallResult, RuntimeOperationRequest } from "@desen/runtime-core";
import type {
  AuthoringIntegrationBindingHandle,
  AuthoringIntegrationBindingInput,
  AuthoringIntegrationControllerInput,
  AuthoringIntegrationOperationBinding,
} from "../src/authoring-integration.js";
import type { ProjectWorkspaceProfileHandle } from "../src/project-workspace-profile.js";

const OPERATION_ID = "com.example.deliveries/dispatch";
const EXTRA_OPERATION_ID = "com.example.deliveries/cancel";
const DENIED = Object.freeze({ status: "denied" } as const);
const OUTPUT = Object.freeze({ status: "succeeded", value: { trackingId: "parcel-7" } } as const);

function deliveryCatalog(withFixtures = false) {
  const operation = {
    description: "Dispatch an authored parcel request.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      properties: { address: { type: "string" } },
      required: ["address"],
    },
    outputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      properties: { trackingId: { type: "string" } },
      required: ["trackingId"],
    },
    effect: "external" as const,
    errors: [{ code: "noCapacity", description: "Dispatch capacity is unavailable." }],
    authoring: withFixtures
      ? { fixtures: { success: { trackingId: "synthetic-only" }, errors: { noCapacity: {} } } }
      : {},
  };
  return {
    kind: "desen.catalog",
    desen: "0.1.0",
    id: "run.desen.example.deliveries",
    version: "0.1.0",
    target: "web-react",
    packageDigest: `sha256:${"3".repeat(64)}`,
    components: {},
    behaviors: {},
    operations: { [OPERATION_ID]: operation, [EXTRA_OPERATION_ID]: { ...operation } },
    resources: {},
    authoring: {},
    extensions: {},
  };
}

function deliveryDocument(catalog = deliveryCatalog()) {
  const requirements = [referenceCatalog, catalog].map(({ id, version, target }) => ({
    id,
    version,
    target,
  }));
  const admitted = createDesenEditorDocument({
    kind: "desen.source",
    desen: "0.1.0",
    id: "com.example.parcel-project",
    catalogs: requirements,
    entry: "dispatch-form",
    surfaces: {
      "dispatch-form": {
        id: "dispatch-form",
        state: {},
        resources: {},
        root: {
          id: "dispatch.layout",
          use: "com.example.ui/Stack",
          props: { direction: "vertical", gap: "md", maxWidth: 640 },
          slots: {
            default: ["dispatch", "retryDispatch"].map((alias) => ({
              id: `dispatch.${alias}`,
              use: "com.example.ui/Button",
              props: { label: alias },
              on: {
                press: [
                  {
                    type: "operation.invoke",
                    operation: OPERATION_ID,
                    as: alias,
                    input: { address: "Authored address" },
                    concurrency: "reject",
                  },
                ],
              },
            })),
          },
        },
      },
      "delivery-status": {
        id: "delivery-status",
        state: {},
        resources: {},
        root: {
          id: "status.layout",
          use: "com.example.ui/Stack",
          props: { direction: "vertical", gap: "md", maxWidth: 640 },
        },
      },
    },
    authoring: {
      canvas: {
        "dispatch-form": { x: 0, y: 0, width: 1024, height: 768 },
        "delivery-status": { x: 0, y: 0, width: 1024, height: 768 },
      },
    },
    extensions: {},
  });
  if (!admitted.ok) throw new TypeError("The delivery Source must be valid.");
  return admitted.document;
}

function createDomain(withFixtures = false) {
  const reference = readProjectWorkspaceProfileAuthority(REFERENCE_SIGN_IN_WORKSPACE_PROFILE);
  if (reference.status !== "read") throw new TypeError("The fixture registry must be admitted.");
  const catalog = deliveryCatalog(withFixtures);
  const catalogs = [referenceCatalog, catalog];
  const document = deliveryDocument(catalog);
  const ambientInvoke = vi.fn(() => OUTPUT);
  const created = createProjectWorkspaceProfile({
    profileId: "parcel-project-web",
    project: {
      id: "parcel-project",
      name: "Parcel project",
      description: "A non-authentication workspace.",
      surfaces: [
        {
          id: "form",
          sourceId: "dispatch-form",
          name: "Dispatch",
          description: "Request dispatch",
        },
        {
          id: "status",
          sourceId: "delivery-status",
          name: "Status",
          description: "Track delivery",
        },
      ],
    },
    route: { projectId: "parcel-project", surfaceId: "form" },
    sourceSurfaceId: "dispatch-form",
    documentId: "com.example.parcel-project",
    sourceKey: "parcel-project-source",
    initialDocument: document,
    catalogs,
    catalogPackages: catalogs.map((item) => ({
      id: item.id,
      version: item.version,
      target: item.target,
      observedPackageDigest: item.packageDigest,
      catalog: item,
    })),
    runtime: {
      target: "web-react",
      registry: reference.profile.runtime.registry,
      tokenCssProperties: reference.profile.runtime.tokenCssProperties,
      hostPorts: { ...reference.profile.runtime.hostPorts, operations: { invoke: ambientInvoke } },
    },
    publication: null,
  });
  if (!created.ok) throw new TypeError(`The delivery profile must be valid: ${created.reason}`);
  const preview = prepareAuthoringSurfacePreviewBundle(
    document,
    created.snapshot.catalogPackages,
    "dispatch-form",
  );
  if (!preview.ok) throw new TypeError("The delivery preview must publish.");
  return {
    profile: created.handle,
    profileSnapshot: created.snapshot,
    document,
    revision: preview.revision,
    ambientInvoke,
  };
}

function bindingInput(
  profile: ProjectWorkspaceProfileHandle,
  invoke: AuthoringIntegrationOperationBinding["invoke"] = () => OUTPUT,
): AuthoringIntegrationBindingInput {
  return {
    profile,
    bindingId: "local-deliveries",
    label: "Delivery service",
    description: "Explicit local delivery integration, not production.",
    operations: [{ capabilityId: OPERATION_ID, effect: "external", invoke }],
  };
}

function createBinding(input: AuthoringIntegrationBindingInput) {
  const result = createAuthoringIntegrationBinding(input);
  if (result.status !== "created")
    throw new TypeError(`Expected integration binding: ${result.reason}`);
  return result.binding;
}

function createController(
  domain: ReturnType<typeof createDomain>,
  binding: AuthoringIntegrationBindingHandle,
  overrides: Partial<AuthoringIntegrationControllerInput> = {},
) {
  const result = createAuthoringIntegrationController({
    binding,
    profile: domain.profile,
    document: domain.document,
    surfaceId: "dispatch-form",
    revision: domain.revision,
    ...overrides,
  });
  if (result.status !== "created") throw new TypeError(`Expected controller: ${result.reason}`);
  return result.controller;
}

function request(revision: string, requestId = "operation:dispatch:1"): RuntimeOperationRequest {
  return {
    context: {
      documentId: "com.example.parcel-project",
      surfaceId: "dispatch-form",
      revision,
      requestId,
    },
    capabilityId: OPERATION_ID,
    invocationAlias: "dispatch",
    input: { address: "Private customer address" },
    effect: "external",
  };
}

function deferred() {
  let resolve!: (result: RuntimeHostCallResult) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<RuntimeHostCallResult>((resolveResult, rejectResult) => {
    resolve = resolveResult;
    reject = rejectResult;
  });
  return { resolve, reject, promise };
}

function deeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) deeplyFrozen(child);
}

describe("authenticated authoring Integration bindings", () => {
  it("captures a generic non-auth binding without calling ambient or explicit implementations", () => {
    const domain = createDomain();
    const invoke = vi.fn(() => OUTPUT);
    const binding = createBinding(bindingInput(domain.profile, invoke));
    const descriptor = readAuthoringIntegrationBinding(binding, domain.profile);

    expect(descriptor).toEqual({
      bindingId: "local-deliveries",
      label: "Delivery service",
      description: "Explicit local delivery integration, not production.",
    });
    deeplyFrozen(descriptor);
    deeplyFrozen(binding);
    expect(invoke).not.toHaveBeenCalled();
    expect(domain.ambientInvoke).not.toHaveBeenCalled();
    expect(JSON.stringify(descriptor)).not.toContain("invoke");
  });

  it("rejects forged, serialized and same-metadata cross-profile authorities", () => {
    const domain = createDomain();
    const binding = createBinding(bindingInput(domain.profile));
    const otherDomain = createDomain();
    for (const forged of [
      {},
      { bindingId: "local-deliveries" },
      undefined,
      null,
      1,
      "local-deliveries",
    ]) {
      expect(readAuthoringIntegrationBinding(forged, domain.profile)).toBeNull();
    }
    expect(readAuthoringIntegrationBinding(binding, otherDomain.profile)).toBeNull();
    expect(
      createAuthoringIntegrationBinding({ ...bindingInput(domain.profile), profile: {} }),
    ).toEqual({ status: "rejected", reason: "profile-invalid" });
  });

  it("never evaluates accessors, inherited members, or revoked proxies during binding admission", () => {
    const domain = createDomain();
    const getter = vi.fn(() => "injected");
    const accessor = { ...bindingInput(domain.profile) };
    Object.defineProperty(accessor, "label", { enumerable: true, get: getter });
    expect(createAuthoringIntegrationBinding(accessor).status).toBe("rejected");
    const operation = { capabilityId: OPERATION_ID, effect: "external" };
    Object.defineProperty(operation, "invoke", { enumerable: true, get: getter });
    expect(
      createAuthoringIntegrationBinding({
        ...bindingInput(domain.profile),
        operations: [operation],
      }).status,
    ).toBe("rejected");
    expect(
      createAuthoringIntegrationBinding(Object.create(bindingInput(domain.profile))).status,
    ).toBe("rejected");
    const proxy = Proxy.revocable({}, {});
    proxy.revoke();
    expect(createAuthoringIntegrationBinding(proxy.proxy).status).toBe("rejected");
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([
    ["undeclared capability", { capabilityId: "com.example.unknown/execute" }],
    ["wrong effect", { effect: "network" }],
    ["not callable", { invoke: "https://example.invalid/run" }],
    ["extra authority", { endpoint: "https://example.invalid/run" }],
  ])("rejects %s instead of widening Catalog authority", (_name, change) => {
    const domain = createDomain();
    const input = bindingInput(domain.profile);
    expect(
      createAuthoringIntegrationBinding({
        ...input,
        operations: [{ ...input.operations[0], ...change }],
      }),
    ).toEqual({ status: "rejected", reason: "operation-invalid" });
  });

  it("bounds metadata and exact dense operation arrays and refuses duplicate bindings", () => {
    const domain = createDomain();
    const input = bindingInput(domain.profile);
    for (const change of [
      { bindingId: " " },
      { label: "x".repeat(129) },
      { description: "x".repeat(2049) },
      { description: "private\nmetadata" },
      { extra: true },
    ]) {
      expect(createAuthoringIntegrationBinding({ ...input, ...change }).status).toBe("rejected");
    }
    for (const operations of [
      [],
      new Array(1),
      Array(1025).fill(input.operations[0]),
      [input.operations[0], input.operations[0]],
      Object.assign([...input.operations], { extra: true }),
    ]) {
      expect(createAuthoringIntegrationBinding({ ...input, operations }).status).toBe("rejected");
    }
  });

  it("detaches captured callbacks and display data from later caller mutation", async () => {
    const domain = createDomain();
    const original = vi.fn<AuthoringIntegrationOperationBinding["invoke"]>(() => OUTPUT);
    const replacement = vi.fn<AuthoringIntegrationOperationBinding["invoke"]>(() => DENIED);
    const operation = { capabilityId: OPERATION_ID, effect: "external" as const, invoke: original };
    const input = { ...bindingInput(domain.profile), operations: [operation] };
    const binding = createBinding(input);
    input.label = "Changed";
    operation.invoke = replacement;
    const controller = createController(domain, binding);
    controller.activate();
    expect(await controller.operationPort.invoke(request(domain.revision))).toEqual(OUTPUT);
    expect(readAuthoringIntegrationBinding(binding, domain.profile)?.label).toBe(
      "Delivery service",
    );
    expect(original).toHaveBeenCalledOnce();
    expect(replacement).not.toHaveBeenCalled();
  });
});

describe("exact-document Integration operation lifetime", () => {
  it("requires explicit activation and uses no fixture outcomes or ambient profile ports", async () => {
    const domain = createDomain();
    const pending = deferred();
    const invoke = vi.fn(() => pending.promise);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    expect(controller.read().active).toBe(false);
    expect(await controller.operationPort.invoke(request(domain.revision))).toEqual(DENIED);
    expect(invoke).not.toHaveBeenCalled();
    controller.activate();
    const result = controller.operationPort.invoke(request(domain.revision));
    expect(controller.read().operations[0]).toEqual({
      alias: "dispatch",
      capabilityId: OPERATION_ID,
      effect: "external",
      bound: true,
      status: "pending",
    });
    pending.resolve(OUTPUT);
    expect(await result).toEqual(OUTPUT);
    expect(controller.read().operations[0]?.status).toBe("responded");
    expect(domain.ambientInvoke).not.toHaveBeenCalled();
    expect(JSON.stringify(controller.read())).not.toMatch(
      /address|trackingId|synthetic-only|outcomes|fixtureValue|password|errorCode/u,
    );
    deeplyFrozen(controller.read());
  });

  it("ignores Catalog fixture payloads even when they differ from the actual host response", async () => {
    const domain = createDomain(true);
    const invoke = vi.fn(() => OUTPUT);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    expect(await controller.operationPort.invoke(request(domain.revision))).toEqual(OUTPUT);
    expect(JSON.stringify(controller.read())).not.toContain("synthetic-only");
  });

  it("rejects document, surface, revision, binding and profile mismatches before I/O", () => {
    const domain = createDomain();
    const invoke = vi.fn(() => OUTPUT);
    const binding = createBinding(bindingInput(domain.profile, invoke));
    const input = {
      binding,
      profile: domain.profile,
      document: domain.document,
      surfaceId: "dispatch-form",
      revision: domain.revision,
    };
    for (const change of [
      { profile: createDomain().profile },
      { binding: {} },
      { revision: `sha256:${"0".repeat(64)}` },
      { surfaceId: "delivery-status" },
      { surfaceId: "unknown" },
      { document: { ...domain.document, id: "com.example.foreign" } },
      { document: { ...domain.document, entry: "delivery-status" } },
    ]) {
      expect(
        createAuthoringIntegrationController({
          ...input,
          ...change,
        } as AuthoringIntegrationControllerInput).status,
      ).toBe("rejected");
    }
    expect(invoke).not.toHaveBeenCalled();
  });

  it("recomputes content-bound revision instead of accepting a stale same-id document", () => {
    const domain = createDomain();
    const binding = createBinding(bindingInput(domain.profile));
    const changed = structuredClone(domain.document);
    const surfaces = changed.surfaces as Record<string, Record<string, unknown>>;
    surfaces["dispatch-form"] = {
      ...surfaces["dispatch-form"],
      state: { extra: { schema: { type: "string" }, initial: "fresh" } },
    };
    expect(
      createAuthoringIntegrationController({
        binding,
        profile: domain.profile,
        document: changed,
        surfaceId: "dispatch-form",
        revision: domain.revision,
      }),
    ).toEqual({ status: "rejected", reason: "preview-mismatch" });
  });

  it("allows an admitted non-entry surface with no operations without guessing a binding", async () => {
    const domain = createDomain();
    const preview = prepareAuthoringSurfacePreviewBundle(
      domain.document,
      domain.profileSnapshot.catalogPackages,
      "delivery-status",
    );
    if (!preview.ok) throw new TypeError("Expected status preview.");
    const invoke = vi.fn(() => OUTPUT);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
      { surfaceId: "delivery-status", revision: preview.revision },
    );
    controller.activate();
    expect(controller.read().operations).toEqual([]);
    expect(
      await controller.operationPort.invoke({
        ...request(preview.revision),
        context: { ...request(preview.revision).context, surfaceId: "delivery-status" },
      }),
    ).toEqual(DENIED);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("requires every request's exact authored alias, capability, effect and context", async () => {
    const domain = createDomain();
    const invoke = vi.fn(() => OUTPUT);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    const valid = request(domain.revision);
    const invalid = [
      { ...valid, invocationAlias: "notAuthored" },
      { ...valid, capabilityId: EXTRA_OPERATION_ID },
      { ...valid, effect: "network" },
      { ...valid, context: { ...valid.context, documentId: "com.example.foreign" } },
      { ...valid, context: { ...valid.context, surfaceId: "delivery-status" } },
      { ...valid, context: { ...valid.context, revision: `sha256:${"0".repeat(64)}` } },
      { ...valid, context: { ...valid.context, requestId: "" } },
      { ...valid, context: { ...valid.context, requestId: "x".repeat(513) } },
      { ...valid, extra: true },
      { ...valid, context: { ...valid.context, extra: true } },
    ];
    for (const candidate of invalid)
      expect(await controller.operationPort.invoke(candidate as RuntimeOperationRequest)).toEqual(
        DENIED,
      );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects accessor, cyclic, inherited and class-instance request inputs without reading getters", async () => {
    const domain = createDomain();
    const invoke = vi.fn(() => OUTPUT);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    const getter = vi.fn(() => "private");
    const valid = request(domain.revision);
    const accessorInput = {};
    Object.defineProperty(accessorInput, "address", { get: getter, enumerable: true });
    const accessorRequest = { ...valid };
    Object.defineProperty(accessorRequest, "context", { get: getter, enumerable: true });
    const cycle: Record<string, unknown> = {};
    cycle.cycle = cycle;
    const candidates = [
      accessorRequest,
      Object.create(valid),
      { ...valid, input: accessorInput },
      { ...valid, input: cycle },
      { ...valid, input: new Date() },
      { ...valid, input: undefined },
    ];
    for (const candidate of candidates)
      expect(await controller.operationPort.invoke(candidate as RuntimeOperationRequest)).toEqual(
        DENIED,
      );
    expect(getter).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("detaches and freezes resolved input before it crosses the explicit host callback", async () => {
    const domain = createDomain();
    const pending = deferred();
    const invoke = vi.fn<AuthoringIntegrationOperationBinding["invoke"]>(() => pending.promise);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    const input = { address: "Private address", metadata: { value: "original" } };
    const original = { ...request(domain.revision), input };
    const result = controller.operationPort.invoke(original);
    input.metadata.value = "changed";
    const forwarded = invoke.mock.calls[0]?.[0];
    expect(forwarded).not.toBe(original);
    expect(forwarded?.input).toEqual({
      address: "Private address",
      metadata: { value: "original" },
    });
    deeplyFrozen(forwarded);
    pending.resolve(OUTPUT);
    await result;
    expect(JSON.stringify(controller.read())).not.toContain("Private address");
  });

  it("blocks concurrent and replayed requests without replacing an admitted pending invocation", async () => {
    const domain = createDomain();
    const pending = deferred();
    const invoke = vi.fn(() => pending.promise);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    const valid = request(domain.revision);
    const result = controller.operationPort.invoke(valid);
    expect(await controller.operationPort.invoke(valid)).toEqual(DENIED);
    expect(await controller.operationPort.invoke(request(domain.revision, "concurrent"))).toEqual(
      DENIED,
    );
    expect(invoke).toHaveBeenCalledOnce();
    pending.resolve(OUTPUT);
    await result;
    expect(await controller.operationPort.invoke(valid)).toEqual(DENIED);
    expect(await controller.operationPort.invoke(request(domain.revision, "concurrent"))).toEqual(
      DENIED,
    );
    expect(invoke).toHaveBeenCalledOnce();
  });

  it("keeps aliases independently pending but never allows request-id reuse across them", async () => {
    const domain = createDomain();
    const first = deferred();
    const second = deferred();
    const invoke = vi
      .fn<AuthoringIntegrationOperationBinding["invoke"]>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    const resultOne = controller.operationPort.invoke(request(domain.revision));
    const otherAlias = { ...request(domain.revision), invocationAlias: "retryDispatch" };
    expect(await controller.operationPort.invoke(otherAlias)).toEqual(DENIED);
    const resultTwo = controller.operationPort.invoke({
      ...otherAlias,
      context: { ...otherAlias.context, requestId: "operation:retryDispatch:2" },
    });
    expect(controller.read().operations.every(({ status }) => status === "pending")).toBe(true);
    first.resolve(OUTPUT);
    await resultOne;
    expect(controller.read().operations[1]?.status).toBe("pending");
    second.resolve(DENIED);
    await resultTwo;
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("marks Source-used but unbound capabilities unavailable without falling back to ambient ports", async () => {
    const domain = createDomain();
    const invoke = vi.fn(() => OUTPUT);
    const binding = createBinding({
      ...bindingInput(domain.profile),
      operations: [{ capabilityId: EXTRA_OPERATION_ID, effect: "external", invoke }],
    });
    const controller = createController(domain, binding);
    controller.activate();
    expect(controller.read().operations.every(({ bound }) => !bound)).toBe(true);
    expect(await controller.operationPort.invoke(request(domain.revision))).toEqual(DENIED);
    expect(controller.read().operations[0]?.status).toBe("denied");
    expect(invoke).not.toHaveBeenCalled();
    expect(domain.ambientInvoke).not.toHaveBeenCalled();
  });

  it.each(["throw", "reject"] as const)(
    "sanitizes host %s without serializing error data or claiming Runtime success",
    async (kind) => {
      const domain = createDomain();
      const failure = new Error("private implementation credential");
      const invoke = vi.fn(() => {
        if (kind === "throw") throw failure;
        return Promise.reject(failure);
      });
      const controller = createController(
        domain,
        createBinding(bindingInput(domain.profile, invoke)),
      );
      controller.activate();
      await expect(controller.operationPort.invoke(request(domain.revision))).rejects.toThrow(
        "Integration operation failed.",
      );
      expect(controller.read().operations[0]?.status).toBe("denied");
      expect(JSON.stringify(controller.read())).not.toMatch(/credential|private|failed\./u);
    },
  );

  it("forwards unvalidated candidates only to Runtime and calls its own transport status responded", async () => {
    const domain = createDomain();
    const candidate = { status: "succeeded", value: { notTheDeclaredOutput: true } } as const;
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, () => candidate)),
    );
    controller.activate();
    expect(await controller.operationPort.invoke(request(domain.revision))).toBe(candidate);
    expect(controller.read().operations[0]?.status).toBe("responded");
    expect(JSON.stringify(controller.read())).not.toContain("notTheDeclaredOutput");
    expect(JSON.stringify(controller.read())).not.toContain("succeeded");
  });

  it("deactivates synchronously, aborts pending work and rejects old-epoch settlements after reactivation", async () => {
    const domain = createDomain();
    const old = deferred();
    const fresh = deferred();
    const invoke = vi
      .fn<AuthoringIntegrationOperationBinding["invoke"]>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    const oldResult = controller.operationPort.invoke(request(domain.revision));
    const signal = invoke.mock.calls[0]?.[1];
    expect(signal?.aborted).toBe(false);
    controller.deactivate();
    expect(signal?.aborted).toBe(true);
    expect(await oldResult).toEqual(DENIED);
    expect(await controller.operationPort.invoke(request(domain.revision, "inactive"))).toEqual(
      DENIED,
    );
    controller.activate();
    expect(await controller.operationPort.invoke(request(domain.revision))).toEqual(DENIED);
    const freshResult = controller.operationPort.invoke(request(domain.revision, "fresh"));
    old.resolve(OUTPUT);
    await Promise.resolve();
    expect(controller.read().operations[0]?.status).toBe("pending");
    fresh.resolve(OUTPUT);
    expect(await freshResult).toEqual(OUTPUT);
    expect(controller.read().operations[0]?.status).toBe("responded");
  });

  it("supports StrictMode activation replay before input and makes disposal terminal and idempotent", async () => {
    const domain = createDomain();
    const pending = deferred();
    const invoke = vi.fn<AuthoringIntegrationOperationBinding["invoke"]>(() => pending.promise);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    controller.deactivate();
    controller.activate();
    const result = controller.operationPort.invoke(request(domain.revision));
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.dispose();
    controller.dispose();
    controller.activate();
    expect(await result).toEqual(DENIED);
    expect(controller.read()).toMatchObject({ active: false, disposed: true });
    expect(invoke.mock.calls[0]?.[1].aborted).toBe(true);
    expect(await controller.operationPort.invoke(request(domain.revision, "new"))).toEqual(DENIED);
    pending.reject(new Error("stale private failure"));
    await Promise.resolve();
    expect(listener).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledOnce();
  });

  it("does not start host I/O if a pending disclosure synchronously revokes Integration", async () => {
    const domain = createDomain();
    const invoke = vi.fn(() => OUTPUT);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    controller.subscribe((snapshot) => {
      if (snapshot.operations.some(({ status }) => status === "pending")) controller.deactivate();
    });
    expect(await controller.operationPort.invoke(request(domain.revision))).toEqual(DENIED);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("fences reflection-time revocation before retaining a pending request", async () => {
    const domain = createDomain();
    const invoke = vi.fn(() => OUTPUT);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    const hostile = new Proxy(request(domain.revision), {
      ownKeys(target) {
        controller.deactivate();
        controller.activate();
        return Reflect.ownKeys(target);
      },
    });
    expect(await controller.operationPort.invoke(hostile)).toEqual(DENIED);
    expect(controller.read().operations[0]?.status).toBe("idle");
    expect(invoke).not.toHaveBeenCalled();
    expect(await controller.operationPort.invoke(request(domain.revision))).toEqual(OUTPUT);
  });

  it("denies a callback's settlement when that callback synchronously deactivates its lifetime", async () => {
    const domain = createDomain();
    let deactivate: () => void = () => undefined;
    const invoke = vi.fn(() => {
      deactivate();
      return OUTPUT;
    });
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    deactivate = controller.deactivate;
    controller.activate();
    expect(await controller.operationPort.invoke(request(domain.revision))).toEqual(DENIED);
    expect(controller.read().operations[0]?.status).toBe("denied");
    expect(controller.read().active).toBe(false);
  });

  it("isolates throwing subscribers and permits idempotent unsubscribe", async () => {
    const domain = createDomain();
    const controller = createController(domain, createBinding(bindingInput(domain.profile)));
    const listener = vi.fn();
    controller.subscribe(() => {
      throw new Error("UI failure");
    });
    const unsubscribe = controller.subscribe(listener);
    controller.activate();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    unsubscribe();
    expect(await controller.operationPort.invoke(request(domain.revision))).toEqual(OUTPUT);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("bounds the replay ledger and refuses additional effects after its lifetime budget", async () => {
    const domain = createDomain();
    const invoke = vi.fn(() => OUTPUT);
    const controller = createController(
      domain,
      createBinding(bindingInput(domain.profile, invoke)),
    );
    controller.activate();
    for (let index = 0; index < 10_000; index += 1) {
      expect(
        await controller.operationPort.invoke(request(domain.revision, `operation:${index}`)),
      ).toEqual(OUTPUT);
    }
    expect(await controller.operationPort.invoke(request(domain.revision, "overflow"))).toEqual(
      DENIED,
    );
    expect(invoke).toHaveBeenCalledTimes(10_000);
  });
});
