import { validateDesenExecutionCatalogSet } from "@desen/validator";
import { describe, expect, it, vi } from "vitest";

import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  createRuntimeHostPorts,
  createRuntimeResolutionSnapshot,
  disposeRuntimeSurfaceResources,
  mountRuntimeSurfaceResources,
  readRuntimeSurfaceResources,
  refreshRuntimeSurfaceResource,
  RUNTIME_RESOURCE_LIMITS,
  RUNTIME_VALUE_SAFETY_LIMITS,
  startRuntimeSurfaceResources,
} from "../src/index.js";

import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeLifecycleReferenceSnapshot,
  RuntimeResourceInitialStartEntry,
  RuntimeResourceLimitProfile,
  RuntimeResourceLoadStarted,
  RuntimeResourceRequest,
  RuntimeResourceSettlement,
  RuntimeSurfaceResourceSpec,
  RuntimeSurfaceResourcesHandle,
  RuntimeSurfaceResourcesMounted,
  RuntimeSurfaceResourcesSnapshot,
  RuntimeTokenPort,
} from "../src/index.js";

const DOCUMENT_ID = "com.example.runtime";
const REVISION = `sha256:${"a".repeat(64)}`;
const SURFACE_ID = "main";
const STORES = "com.example.stores/list";
const TASKS = "com.example.tasks/list";
const STORE_OUTPUT = Object.freeze({ items: Object.freeze([]), bounds: Object.freeze({}) });

type MutableRecord = Record<string, unknown>;

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
  readonly reject: (reason?: unknown) => void;
}

function deferred<Value>(): Deferred<Value> {
  let resolvePromise!: (value: Value) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return Object.freeze({ promise, resolve: resolvePromise, reject: rejectPromise });
}

function mutableRecord(value: unknown, label: string): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as MutableRecord;
}

function clonedCatalog(): MutableRecord {
  return mutableRecord(JSON.parse(JSON.stringify(frozenWebCatalog)), "catalog");
}

function resourceContract(catalog: MutableRecord, capabilityId: string): MutableRecord {
  return mutableRecord(
    mutableRecord(catalog.resources, "resources")[capabilityId],
    `resource ${capabilityId}`,
  );
}

function preparedCatalog(
  mutate?: (catalog: MutableRecord) => void,
): DesenValidatedExecutionCatalogSet {
  const catalog = clonedCatalog();
  mutate?.(catalog);
  const result = validateDesenExecutionCatalogSet([catalog]);
  expect(result.valid).toBe(true);
  if (!result.valid) throw new TypeError("Expected the test Catalog to pass preparation.");
  return result.value;
}

function hostPorts(
  load: (request: RuntimeResourceRequest) => unknown = () => ({
    status: "succeeded",
    value: STORE_OUTPUT,
  }),
  report: (diagnostic: Parameters<RuntimeHostPorts["diagnostics"]["report"]>[0]) => void = vi.fn(),
  resolveToken: RuntimeTokenPort["resolve"] = () => ({ status: "missing" }),
): RuntimeHostPorts {
  return createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "succeeded" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: () => ({
        status: "committed",
        record: {
          activeRevision: REVISION,
          previousGoodRevision: null,
          generation: 0,
        },
      }),
    },
    operations: {
      invoke: () => ({ status: "denied" }),
    },
    resources: {
      load: load as RuntimeHostPorts["resources"]["load"],
    },
    tokens: {
      resolve: resolveToken,
    },
    context: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    clock: {
      now: () => 1,
    },
    diagnostics: { report },
  });
}

function defaultResources(
  overrides: Readonly<Record<string, Partial<RuntimeSurfaceResourceSpec>>> = {},
): Readonly<Record<string, RuntimeSurfaceResourceSpec>> {
  const resources: Record<string, RuntimeSurfaceResourceSpec> = {
    stores: {
      use: STORES,
      input: {},
      policy: "mount",
    },
  };
  for (const [instanceId, override] of Object.entries(overrides)) {
    const base = resources[instanceId] ?? resources.stores;
    if (base === undefined) throw new TypeError("Expected the default resource fixture.");
    resources[instanceId] = { ...base, ...override };
  }
  return resources;
}

function mountedResources(
  options: Readonly<{
    resources?: Readonly<Record<string, RuntimeSurfaceResourceSpec>>;
    catalogSet?: DesenValidatedExecutionCatalogSet;
    limits?: RuntimeResourceLimitProfile;
    ports?: RuntimeHostPorts;
  }> = {},
): RuntimeSurfaceResourcesMounted {
  const result = mountRuntimeSurfaceResources({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    resources: options.resources ?? defaultResources(),
    catalogSet: options.catalogSet ?? preparedCatalog(),
    hostPorts: options.ports ?? hostPorts(),
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
  expect(result.status).toBe("mounted");
  if (result.status !== "mounted") throw new TypeError("Expected resource mount to succeed.");
  return result;
}

function resolutionSnapshot(
  snapshot: RuntimeSurfaceResourcesSnapshot,
  state: RuntimeJsonObject = Object.freeze({}),
  resource: Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>> = snapshot.lifecycles,
) {
  return createRuntimeResolutionSnapshot({
    state,
    context: Object.freeze({}),
    resource,
    operation: Object.freeze({}),
    event: Object.freeze({ status: "unavailable" }),
    item: Object.freeze({}),
    env: Object.freeze({}),
  });
}

function startedEntry(
  entries: readonly RuntimeResourceInitialStartEntry[],
  instanceId: string,
): RuntimeResourceLoadStarted {
  const entry = entries.find((candidate) => candidate.instanceId === instanceId);
  expect(entry?.status).toBe("started");
  if (entry?.status !== "started") throw new TypeError(`Expected ${instanceId} to start.`);
  return entry;
}

async function startOne(
  mounted: RuntimeSurfaceResourcesMounted,
): Promise<RuntimeResourceSettlement> {
  const started = startRuntimeSurfaceResources(
    mounted.handle,
    resolutionSnapshot(mounted.snapshot),
    mounted.snapshot,
  );
  expect(started.status).toBe("started");
  if (started.status !== "started") throw new TypeError("Expected initial start.");
  return startedEntry(started.entries, "stores").settlement;
}

describe("M04-T08 resource mount boundary", () => {
  it("mounts every declaration atomically as one frozen idle generation without calling the host", () => {
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const mounted = mountedResources({
      ports: hostPorts(load),
      resources: {
        zManual: { use: STORES, input: {}, policy: "manual" },
        aMount: { use: STORES, input: {}, policy: "mount" },
        mOnce: { use: STORES, input: {}, policy: "once" },
      },
    });

    expect(load).not.toHaveBeenCalled();
    expect(mounted.snapshot).toEqual({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      generation: 0,
      lifecycles: {
        aMount: { status: "idle", pending: false },
        mOnce: { status: "idle", pending: false },
        zManual: { status: "idle", pending: false },
      },
    });
    expect(Object.isFrozen(mounted.snapshot)).toBe(true);
    expect(Object.isFrozen(mounted.snapshot.lifecycles)).toBe(true);
  });

  it("preserves every non-empty frozen-schema document id without applying a local-id grammar", async () => {
    const documentId = `https://örnek.test/desen/${"uzun".repeat(40)}`;
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const result = mountRuntimeSurfaceResources({
      documentId,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      resources: defaultResources(),
      catalogSet: preparedCatalog(),
      hostPorts: hostPorts(load),
    });
    expect(result.status).toBe("mounted");
    if (result.status !== "mounted") throw new TypeError("Expected resource mount.");
    expect(result.snapshot.documentId).toBe(documentId);

    const started = startRuntimeSurfaceResources(
      result.handle,
      resolutionSnapshot(result.snapshot),
      result.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected start.");
    await startedEntry(started.entries, "stores").settlement;
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ documentId }),
      }),
    );
  });

  it("applies the shared finite string budget to an otherwise unrestricted document id", () => {
    const exact = "x".repeat(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits);
    expect(
      mountRuntimeSurfaceResources({
        documentId: exact,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        resources: {},
        catalogSet: preparedCatalog(),
        hostPorts: hostPorts(),
      }),
    ).toMatchObject({ status: "mounted", snapshot: { documentId: exact } });
    expect(
      mountRuntimeSurfaceResources({
        documentId: `${exact}x`,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        resources: {},
        catalogSet: preparedCatalog(),
        hostPorts: hostPorts(),
      }),
    ).toMatchObject({ status: "invalid", reason: "malformed-input" });
  });

  it("rejects one malformed declaration without exposing a partial handle", () => {
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const result = mountRuntimeSurfaceResources({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      resources: {
        good: { use: STORES, input: {}, policy: "mount" },
        bad: { use: STORES, input: {}, policy: "invalid" },
      } as unknown as Readonly<Record<string, RuntimeSurfaceResourceSpec>>,
      catalogSet: preparedCatalog(),
      hostPorts: hostPorts(load),
    });

    expect(result).toMatchObject({
      status: "invalid",
      reason: "malformed-input",
      instanceId: "bad",
    });
    expect("handle" in result).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("rejects malformed or hostile limit profiles without throwing or retaining accessors", () => {
    const base = {
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      resources: {},
      catalogSet: preparedCatalog(),
      hostPorts: hostPorts(),
    };
    for (const limits of [
      { maxActiveTransports: 0 },
      { maxActiveTransports: RUNTIME_RESOURCE_LIMITS.maxActiveTransports + 1 },
      { maxAttemptGeneration: -1 },
      { maxSnapshotGeneration: 1.5 },
      { unreviewed: 1 },
    ]) {
      expect(
        mountRuntimeSurfaceResources({
          ...base,
          limits: limits as RuntimeResourceLimitProfile,
        }),
      ).toMatchObject({ status: "invalid", reason: "malformed-input" });
    }

    let getterReads = 0;
    const accessorLimits = {};
    Object.defineProperty(accessorLimits, "maxSnapshotGeneration", {
      enumerable: true,
      get() {
        getterReads += 1;
        return 2;
      },
    });
    expect(
      mountRuntimeSurfaceResources({
        ...base,
        limits: accessorLimits,
      }),
    ).toMatchObject({ status: "invalid", reason: "malformed-input" });
    expect(getterReads).toBe(0);

    const hostile = new Proxy(
      { ...base, limits: {} },
      {
        getOwnPropertyDescriptor(target, property) {
          if (property === "limits") throw new Error("hostile descriptor");
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      },
    );
    expect(() => mountRuntimeSurfaceResources(hostile)).not.toThrow();
    expect(mountRuntimeSurfaceResources(hostile)).toMatchObject({
      status: "invalid",
      reason: "malformed-input",
    });
  });

  it("requires the exact factory-authenticated execution Catalog set", () => {
    const catalogSet = preparedCatalog();
    const serialized = JSON.parse(JSON.stringify(catalogSet));
    const result = mountRuntimeSurfaceResources({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      resources: defaultResources(),
      catalogSet: serialized as DesenValidatedExecutionCatalogSet,
      hostPorts: hostPorts(),
    });
    expect(result).toMatchObject({ status: "invalid", reason: "catalog-set-invalid" });
  });

  it("rejects unknown capabilities and policies absent from the exact capability contract", () => {
    const unknown = mountRuntimeSurfaceResources({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      resources: {
        missing: {
          use: "com.example.missing/resource",
          input: {},
          policy: "mount",
        },
      },
      catalogSet: preparedCatalog(),
      hostPorts: hostPorts(),
    });
    expect(unknown).toMatchObject({
      status: "invalid",
      reason: "unknown-capability",
      instanceId: "missing",
    });

    const manualOnly = preparedCatalog((catalog) => {
      resourceContract(catalog, STORES).policies = ["manual"];
    });
    const unsupported = mountRuntimeSurfaceResources({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      resources: defaultResources(),
      catalogSet: manualOnly,
      hostPorts: hostPorts(),
    });
    expect(unsupported).toMatchObject({
      status: "invalid",
      reason: "unsupported-policy",
      instanceId: "stores",
      diagnostics: [{ code: "RESOURCE_INPUT_INVALID", pointer: "/policy" }],
    });
  });

  it("detaches declarations and captures host callbacks without retaining caller objects", async () => {
    const originalLoad = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const ports = hostPorts(originalLoad);
    const resources = {
      stores: {
        use: STORES,
        input: {},
        policy: "mount" as const,
      },
    };
    const mounted = mountedResources({ resources, ports });
    resources.stores.input = { changed: true };
    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected start.");
    await startedEntry(started.entries, "stores").settlement;
    expect(originalLoad).toHaveBeenCalledWith(
      expect.objectContaining({ input: {}, capabilityId: STORES }),
    );
  });

  it("supports an empty resource set as a complete inert lifetime", () => {
    const mounted = mountedResources({ resources: {} });
    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(started).toMatchObject({
      status: "started",
      snapshot: { generation: 0, lifecycles: {} },
      entries: [],
    });
    if (started.status !== "started") throw new TypeError("Expected empty start.");
    expect(started.snapshot).toBe(mounted.snapshot);
  });
});

describe("M04-T08 initial start and input preparation", () => {
  it("starts mount and once in canonical instance order from one pre-start snapshot", () => {
    const load = vi.fn((request: RuntimeResourceRequest) => ({
      status: "succeeded" as const,
      value: request.capabilityId === TASKS ? [] : STORE_OUTPUT,
    }));
    const mounted = mountedResources({
      ports: hostPorts(load),
      resources: {
        zOnce: { use: TASKS, input: {}, policy: "once" },
        aMount: { use: STORES, input: {}, policy: "mount" },
        mManual: { use: STORES, input: {}, policy: "manual" },
      },
    });
    const result = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(result.status).toBe("started");
    if (result.status !== "started") throw new TypeError("Expected start.");

    expect(result.snapshot.generation).toBe(1);
    expect(result.snapshot.lifecycles).toEqual({
      aMount: { status: "pending", pending: true },
      mManual: { status: "idle", pending: false },
      zOnce: { status: "pending", pending: true },
    });
    expect(result.entries.map(({ instanceId, status }) => [instanceId, status])).toEqual([
      ["aMount", "started"],
      ["mManual", "manual"],
      ["zOnce", "started"],
    ]);
    expect(load.mock.calls.map(([request]) => request.instanceId)).toEqual(["aMount", "zOnce"]);
  });

  it("keeps a synchronous host result pending until a Promise microtask", async () => {
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const mounted = mountedResources({ ports: hostPorts(load) });
    const result = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(result.status).toBe("started");
    if (result.status !== "started") throw new TypeError("Expected start.");
    expect(readRuntimeSurfaceResources(mounted.handle)).toMatchObject({
      status: "read",
      snapshot: { lifecycles: { stores: { status: "pending", pending: true } } },
    });

    const settlement = await startedEntry(result.entries, "stores").settlement;
    expect(settlement).toMatchObject({
      status: "succeeded",
      snapshot: {
        generation: 2,
        lifecycles: {
          stores: { status: "succeeded", pending: false, value: STORE_OUTPUT },
        },
      },
    });
  });

  it("starts only once and rejects a lifecycle map that is not the exact current pre-start view", () => {
    const mounted = mountedResources();
    const mismatched = resolutionSnapshot(mounted.snapshot, {}, {});
    expect(
      startRuntimeSurfaceResources(mounted.handle, mismatched, mounted.snapshot),
    ).toMatchObject({
      status: "invalid-snapshot",
      snapshot: { generation: 0 },
    });

    const first = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(first.status).toBe("started");
    expect(
      startRuntimeSurfaceResources(
        mounted.handle,
        resolutionSnapshot(mounted.snapshot),
        mounted.snapshot,
      ),
    ).toMatchObject({ status: "already-started" });
  });

  it("publishes the one-shot start decision before a diagnostic sink can reenter it", async () => {
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const holder: { mounted?: RuntimeSurfaceResourcesMounted } = {};
    let reentrantStatus: string | undefined;
    const report = vi.fn(() => {
      const current = holder.mounted;
      if (current === undefined) throw new TypeError("Expected mounted resources.");
      reentrantStatus = startRuntimeSurfaceResources(
        current.handle,
        resolutionSnapshot(current.snapshot),
        current.snapshot,
      ).status;
    });
    const mounted = mountedResources({
      ports: hostPorts(load, report),
      resources: {
        invalid: {
          use: STORES,
          input: { missing: { $ref: "state.notThere" } },
          policy: "mount",
        },
        valid: { use: STORES, input: {}, policy: "mount" },
      },
    });
    holder.mounted = mounted;

    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected start.");
    expect(reentrantStatus).toBe("already-started");
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ instanceId: "valid" }));
    await expect(startedEntry(started.entries, "valid").settlement).resolves.toMatchObject({
      status: "succeeded",
    });
  });

  it("stops later diagnostic callbacks after a reentrant terminal disposal", () => {
    const holder: { mounted?: RuntimeSurfaceResourcesMounted } = {};
    const report = vi.fn(() => {
      const current = holder.mounted;
      if (current === undefined) throw new TypeError("Expected mounted resources.");
      disposeRuntimeSurfaceResources(current.handle);
    });
    const mounted = mountedResources({
      ports: hostPorts(() => ({ status: "succeeded", value: STORE_OUTPUT }), report),
      resources: {
        first: {
          use: STORES,
          input: { missing: { $ref: "state.first" } },
          policy: "mount",
        },
        second: {
          use: STORES,
          input: { missing: { $ref: "state.second" } },
          policy: "mount",
        },
      },
    });
    holder.mounted = mounted;

    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    expect(report).toHaveBeenCalledTimes(1);
    expect(readRuntimeSurfaceResources(mounted.handle)).toEqual({ status: "disposed" });
  });

  it("does not launch later batch entries after a host callback reentrantly disposes the surface", async () => {
    const holder: { mounted?: RuntimeSurfaceResourcesMounted } = {};
    const load = vi.fn((request: RuntimeResourceRequest) => {
      const current = holder.mounted;
      if (request.instanceId === "first" && current !== undefined) {
        disposeRuntimeSurfaceResources(current.handle);
      }
      return { status: "succeeded" as const, value: STORE_OUTPUT };
    });
    const mounted = mountedResources({
      ports: hostPorts(load),
      resources: {
        first: { use: STORES, input: {}, policy: "mount" },
        second: { use: STORES, input: {}, policy: "mount" },
      },
    });
    holder.mounted = mounted;

    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected start.");
    expect(load.mock.calls.map(([request]) => request.instanceId)).toEqual(["first"]);
    await expect(startedEntry(started.entries, "first").settlement).resolves.toMatchObject({
      status: "disposed",
    });
    await expect(startedEntry(started.entries, "second").settlement).resolves.toMatchObject({
      status: "disposed",
    });
  });

  it("reconstructs named input members so protocol-legal dollar-prefixed parameters stay data", async () => {
    const catalogSet = preparedCatalog((catalog) => {
      resourceContract(catalog, STORES).inputSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["region", "$select"],
        properties: {
          region: { type: "string" },
          $select: { type: "string" },
        },
      };
    });
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const mounted = mountedResources({
      catalogSet,
      ports: hostPorts(load),
      resources: {
        stores: {
          use: STORES,
          input: {
            region: { $ref: "state.filters.region" },
            $select: "all",
          },
          policy: "mount",
        },
      },
    });
    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot, { filters: { region: "eu" } }),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected start.");
    await startedEntry(started.entries, "stores").settlement;
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({ input: { $select: "all", region: "eu" } }),
    );
  });

  it("materializes token and format members atomically with one input-wide token cache", async () => {
    const catalogSet = preparedCatalog((catalog) => {
      resourceContract(catalog, STORES).inputSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["label", "region"],
        properties: {
          label: { type: "string" },
          region: { type: "string" },
        },
      };
    });
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const resolveToken = vi.fn(function (this: undefined) {
      expect(this).toBeUndefined();
      return { status: "resolved" as const, value: "eu" };
    });
    const mounted = mountedResources({
      catalogSet,
      ports: hostPorts(load, vi.fn(), resolveToken),
      resources: {
        stores: {
          use: STORES,
          input: {
            label: {
              $format: {
                template: "Store {region}",
                values: { region: { $token: "region.default" } },
              },
            },
            region: { $token: "region.default" },
          },
          policy: "mount",
        },
      },
    });
    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected start.");
    await startedEntry(started.entries, "stores").settlement;
    expect(resolveToken).toHaveBeenCalledTimes(1);
    expect(resolveToken).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "region.default",
        context: expect.objectContaining({ requestId: 'resource:["stores",0]' }),
      }),
    );
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({ input: { label: "Store eu", region: "eu" } }),
    );
  });

  it("rejects token-provider reentry while one resource transition is being prepared", async () => {
    const catalogSet = preparedCatalog((catalog) => {
      resourceContract(catalog, STORES).inputSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["region"],
        properties: { region: { type: "string" } },
      };
    });
    const holder: { mounted?: RuntimeSurfaceResourcesMounted } = {};
    let reentrantStatus: string | undefined;
    const resolveToken = vi.fn<RuntimeTokenPort["resolve"]>(() => {
      const current = holder.mounted;
      if (current === undefined) throw new TypeError("Expected mounted resources.");
      reentrantStatus = refreshRuntimeSurfaceResource(current.handle, {
        instanceId: "stores",
        resourceSnapshot: current.snapshot,
        snapshot: resolutionSnapshot(current.snapshot),
      }).status;
      return { status: "resolved", value: "eu" };
    });
    const mounted = mountedResources({
      catalogSet,
      ports: hostPorts(() => ({ status: "succeeded", value: STORE_OUTPUT }), vi.fn(), resolveToken),
      resources: {
        stores: {
          use: STORES,
          input: { region: { $token: "region.default" } },
          policy: "mount",
        },
      },
    });
    holder.mounted = mounted;
    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected start.");
    expect(reentrantStatus).toBe("busy");
    await expect(startedEntry(started.entries, "stores").settlement).resolves.toMatchObject({
      status: "succeeded",
    });
  });

  it("makes disposal stop later token-provider calls in the same atomic input", () => {
    const catalogSet = preparedCatalog((catalog) => {
      resourceContract(catalog, STORES).inputSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["first", "second"],
        properties: {
          first: { type: "string" },
          second: { type: "string" },
        },
      };
    });
    const holder: { mounted?: RuntimeSurfaceResourcesMounted } = {};
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const resolveToken = vi.fn<RuntimeTokenPort["resolve"]>(() => {
      const current = holder.mounted;
      if (current === undefined) throw new TypeError("Expected mounted resources.");
      disposeRuntimeSurfaceResources(current.handle);
      return { status: "resolved", value: "first" };
    });
    const mounted = mountedResources({
      catalogSet,
      ports: hostPorts(load, vi.fn(), resolveToken),
      resources: {
        stores: {
          use: STORES,
          input: {
            first: { $token: "token.first" },
            second: { $token: "token.second" },
          },
          policy: "mount",
        },
      },
    });
    holder.mounted = mounted;

    expect(
      startRuntimeSurfaceResources(
        mounted.handle,
        resolutionSnapshot(mounted.snapshot),
        mounted.snapshot,
      ),
    ).toEqual({ status: "disposed" });
    expect(resolveToken).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();
    expect(readRuntimeSurfaceResources(mounted.handle)).toEqual({ status: "disposed" });
  });

  it("contains a token provider failure before resource identity allocation or host loading", async () => {
    const catalogSet = preparedCatalog((catalog) => {
      resourceContract(catalog, STORES).inputSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["region"],
        properties: { region: { type: "string" } },
      };
    });
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const resolveToken = vi
      .fn<RuntimeTokenPort["resolve"]>()
      .mockImplementationOnce(() => {
        throw new Error("private token provider failure");
      })
      .mockReturnValue({ status: "resolved", value: "eu" });
    const mounted = mountedResources({
      catalogSet,
      ports: hostPorts(load, vi.fn(), resolveToken),
      resources: {
        stores: {
          use: STORES,
          input: { region: { $token: "region.default" } },
          policy: "mount",
        },
      },
    });
    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected start.");
    expect(started.entries[0]).toMatchObject({
      status: "input-rejected",
      reason: "resolution",
      resolution: { status: "failed", adapter: "token-provider" },
      diagnostics: [{ code: "ADAPTER_FAILURE", pointer: "/region/$token" }],
    });
    expect(load).not.toHaveBeenCalled();
    expect(JSON.stringify(started)).not.toContain("private token provider failure");

    const refreshed = refreshRuntimeSurfaceResource(mounted.handle, {
      instanceId: "stores",
      resourceSnapshot: mounted.snapshot,
      snapshot: resolutionSnapshot(mounted.snapshot),
    });
    expect(refreshed).toMatchObject({
      status: "started",
      requestId: 'resource:["stores",0]',
    });
    if (refreshed.status !== "started") throw new TypeError("Expected refresh.");
    await expect(refreshed.settlement).resolves.toMatchObject({ status: "succeeded" });
  });

  it.each([
    ["unresolved", { region: { $ref: "state.filters.region" } }, "resolution", "unresolved"],
    ["missing token", { region: { $token: "region.default" } }, "resolution", "unresolved"],
    ["malformed", { region: { $ref: "bad.path" } }, "resolution", "invalid"],
  ] as const)(
    "does not call the host for a %s input",
    async (_label, input, reason, resolutionStatus) => {
      const catalogSet = preparedCatalog((catalog) => {
        resourceContract(catalog, STORES).inputSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          additionalProperties: false,
          required: ["region"],
          properties: { region: { type: "string" } },
        };
      });
      const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
      const mounted = mountedResources({
        catalogSet,
        ports: hostPorts(load),
        resources: {
          stores: { use: STORES, input, policy: "mount" },
        },
      });
      const started = startRuntimeSurfaceResources(
        mounted.handle,
        resolutionSnapshot(mounted.snapshot),
        mounted.snapshot,
      );
      expect(started.status).toBe("started");
      if (started.status !== "started") throw new TypeError("Expected start.");
      expect(started.entries[0]).toMatchObject({
        status: "input-rejected",
        reason,
        resolution: { status: resolutionStatus },
      });
      expect(load).not.toHaveBeenCalled();
      expect(readRuntimeSurfaceResources(mounted.handle)).toMatchObject({
        status: "read",
        snapshot: { generation: 0, lifecycles: { stores: { status: "idle" } } },
      });
    },
  );

  it("schema-validates the complete resolved input before allocating or calling the host", () => {
    const catalogSet = preparedCatalog((catalog) => {
      resourceContract(catalog, STORES).inputSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["region"],
        properties: { region: { type: "string", minLength: 2 } },
      };
    });
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const mounted = mountedResources({
      catalogSet,
      ports: hostPorts(load),
      resources: {
        stores: { use: STORES, input: { region: "" }, policy: "mount" },
      },
    });
    const result = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(result.status).toBe("started");
    if (result.status !== "started") throw new TypeError("Expected start.");
    expect(result.entries[0]).toMatchObject({
      status: "input-rejected",
      reason: "schema",
      diagnostics: [{ code: "RESOURCE_INPUT_INVALID", pointer: "/region" }],
    });
    expect(load).not.toHaveBeenCalled();
  });
});

describe("M04-T08 settlement containment", () => {
  it("exposes only a schema-validated detached successful output", async () => {
    const candidate: { items: { id: string }[]; bounds: Record<string, never> } = {
      items: [],
      bounds: {},
    };
    const mounted = mountedResources({
      ports: hostPorts(() => ({ status: "succeeded", value: candidate })),
    });
    const settlement = await startOne(mounted);
    candidate.items.push({ id: "late" });

    expect(settlement).toMatchObject({
      status: "succeeded",
      snapshot: {
        lifecycles: {
          stores: { status: "succeeded", value: { items: [], bounds: {} } },
        },
      },
    });
    expect(Object.isFrozen(settlement)).toBe(true);
  });

  it("exposes an exact declared public failure code", async () => {
    const mounted = mountedResources({
      ports: hostPorts(() => ({ status: "failed", errorCode: "unavailable" })),
    });
    await expect(startOne(mounted)).resolves.toMatchObject({
      status: "failed",
      errorCode: "unavailable",
      snapshot: {
        lifecycles: {
          stores: {
            status: "failed",
            pending: false,
            error: { code: "unavailable" },
          },
        },
      },
    });
  });

  it.each([
    [
      "undeclared public failure",
      { status: "failed", errorCode: "privateBackendCode" },
      "adapter-failed",
      "ADAPTER_FAILURE",
    ],
    ["policy denial", { status: "denied" }, "denied", "run.desen.runtime/RESOURCE_DENIED"],
    [
      "invalid output",
      { status: "succeeded", value: { items: [] } },
      "invalid-output",
      "RESOURCE_OUTPUT_INVALID",
    ],
    [
      "malformed envelope",
      { status: "succeeded", value: STORE_OUTPUT, extra: true },
      "adapter-failed",
      "ADAPTER_FAILURE",
    ],
  ] as const)(
    "contains %s without inventing public lifecycle data",
    async (_label, hostResult, status, diagnosticCode) => {
      const report = vi.fn();
      const mounted = mountedResources({
        ports: hostPorts(() => hostResult, report),
      });
      const settlement = await startOne(mounted);
      expect(settlement).toMatchObject({
        status,
        diagnostics: [{ code: diagnosticCode }],
        snapshot: {
          lifecycles: { stores: { status: "idle", pending: false } },
        },
      });
      if (!("diagnostics" in settlement)) throw new TypeError("Expected diagnostics.");
      expect(Object.isFrozen(settlement.diagnostics)).toBe(true);
      expect(Object.isFrozen(settlement.diagnostics[0])).toBe(true);
      expect(report).toHaveBeenCalledWith(expect.objectContaining({ code: diagnosticCode }));
      expect(JSON.stringify(settlement)).not.toContain("privateBackendCode");
    },
  );

  it("classifies over-budget output as invalid output instead of an adapter envelope failure", async () => {
    const oversized = "x".repeat(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits + 1);
    const mounted = mountedResources({
      ports: hostPorts(() => ({ status: "succeeded", value: oversized })),
    });
    await expect(startOne(mounted)).resolves.toMatchObject({
      status: "invalid-output",
      diagnostics: [{ code: "RESOURCE_OUTPUT_INVALID", pointer: "" }],
    });
  });

  it("redacts attacker-controlled output members from invalid-output diagnostics", async () => {
    const privateMember = "private-server-field";
    const mounted = mountedResources({
      ports: hostPorts(() => ({
        status: "succeeded",
        value: { ...STORE_OUTPUT, [privateMember]: "secret payload" },
      })),
    });
    const settlement = await startOne(mounted);
    expect(settlement).toMatchObject({
      status: "invalid-output",
      diagnostics: [{ code: "RESOURCE_OUTPUT_INVALID", pointer: "" }],
    });
    expect(JSON.stringify(settlement)).not.toContain(privateMember);
    expect(JSON.stringify(settlement)).not.toContain("secret payload");
  });

  it.each(["throw", "reject"] as const)(
    "redacts a host %s as ADAPTER_FAILURE and never rejects settlement",
    async (mode) => {
      const mounted = mountedResources({
        ports: hostPorts(() => {
          if (mode === "throw") throw new Error("secret stack");
          return Promise.reject(new Error("secret stack"));
        }),
      });
      const settlement = await startOne(mounted);
      expect(settlement).toMatchObject({
        status: "adapter-failed",
        diagnostics: [{ code: "ADAPTER_FAILURE" }],
      });
      expect(JSON.stringify(settlement)).not.toContain("secret");
    },
  );

  it("makes a throwing diagnostic sink observational only", async () => {
    const mounted = mountedResources({
      ports: hostPorts(
        () => ({ status: "denied" }),
        () => {
          throw new Error("sink failure");
        },
      ),
    });
    await expect(startOne(mounted)).resolves.toMatchObject({
      status: "denied",
      snapshot: { lifecycles: { stores: { status: "idle" } } },
    });
  });

  it("invokes resource and diagnostic host callbacks without a receiver", async () => {
    const load = vi.fn(function (this: undefined) {
      expect(this).toBeUndefined();
      return { status: "denied" as const };
    });
    const report = vi.fn(function (this: undefined) {
      expect(this).toBeUndefined();
    });
    const mounted = mountedResources({ ports: hostPorts(load, report) });
    await expect(startOne(mounted)).resolves.toMatchObject({ status: "denied" });
    expect(load).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("rejects an individually valid output that would overflow the aggregate lifecycle map", async () => {
    const largeOutput = {
      items: Array.from({ length: 2_050 }, () => ({})),
      bounds: {},
    };
    const mounted = mountedResources({
      resources: {
        first: { use: STORES, input: {}, policy: "mount" },
        second: { use: STORES, input: {}, policy: "mount" },
      },
      ports: hostPorts(() => ({ status: "succeeded", value: largeOutput })),
    });
    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected start.");
    const settlements = await Promise.all(
      started.entries
        .filter((entry): entry is RuntimeResourceLoadStarted => entry.status === "started")
        .map(({ settlement }) => settlement),
    );
    expect(settlements.map(({ status }) => status)).toEqual(["succeeded", "invalid-output"]);
    expect(settlements[1]).toMatchObject({
      diagnostics: [{ code: "run.desen.runtime/RESOURCE_RETAINED_LIMIT_EXCEEDED" }],
      snapshot: {
        lifecycles: {
          first: { status: "succeeded" },
          second: { status: "idle" },
        },
      },
    });
  });
});

describe("M04-T08 refresh, supersession, and disposal", () => {
  it("reserves terminal snapshot capacity before accepting a pending request", async () => {
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const mounted = mountedResources({
      limits: { maxSnapshotGeneration: 2 },
      ports: hostPorts(load),
    });
    const initial = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(initial.status).toBe("started");
    if (initial.status !== "started") throw new TypeError("Expected start.");
    await expect(startedEntry(initial.entries, "stores").settlement).resolves.toMatchObject({
      status: "succeeded",
      snapshot: { generation: 2 },
    });
    const current = readRuntimeSurfaceResources(mounted.handle);
    if (current.status !== "read") throw new TypeError("Expected current resources.");
    const rejected = refreshRuntimeSurfaceResource(mounted.handle, {
      instanceId: "stores",
      resourceSnapshot: current.snapshot,
      snapshot: resolutionSnapshot(current.snapshot),
    });
    expect(rejected).toMatchObject({
      status: "snapshot-limit",
      diagnostics: [{ code: "run.desen.runtime/RESOURCE_SNAPSHOT_LIMIT_EXCEEDED" }],
    });
    if (rejected.status !== "snapshot-limit") throw new TypeError("Expected limit.");
    expect(Object.isFrozen(rejected.diagnostics)).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("applies a lowered inclusive attempt-generation ceiling without consuming rejected ids", async () => {
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const mounted = mountedResources({
      limits: { maxAttemptGeneration: 0 },
      ports: hostPorts(load),
    });
    const initial = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(initial.status).toBe("started");
    if (initial.status !== "started") throw new TypeError("Expected start.");
    expect(startedEntry(initial.entries, "stores").requestId).toBe('resource:["stores",0]');
    await startedEntry(initial.entries, "stores").settlement;
    const current = readRuntimeSurfaceResources(mounted.handle);
    if (current.status !== "read") throw new TypeError("Expected current resources.");
    expect(
      refreshRuntimeSurfaceResource(mounted.handle, {
        instanceId: "stores",
        resourceSnapshot: current.snapshot,
        snapshot: resolutionSnapshot(current.snapshot),
      }),
    ).toEqual({ status: "attempt-limit", instanceId: "stores" });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("queues host transports at the finite surface cap and promotes in source order", async () => {
    const first = deferred<RuntimeHostCallResult>();
    const load = vi
      .fn<(request: RuntimeResourceRequest) => unknown>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce({ status: "succeeded", value: STORE_OUTPUT });
    const mounted = mountedResources({
      limits: { maxActiveTransports: 1 },
      ports: hostPorts(load),
      resources: {
        first: { use: STORES, input: {}, policy: "mount" },
        second: { use: STORES, input: {}, policy: "mount" },
      },
    });
    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected start.");
    expect(load.mock.calls.map(([request]) => request.instanceId)).toEqual(["first"]);

    first.resolve({ status: "succeeded", value: STORE_OUTPUT });
    await startedEntry(started.entries, "first").settlement;
    expect(load.mock.calls.map(([request]) => request.instanceId)).toEqual(["first", "second"]);
    await expect(startedEntry(started.entries, "second").settlement).resolves.toMatchObject({
      status: "succeeded",
    });
  });

  it("replaces a queued refresh instead of retaining an unbounded stale queue", async () => {
    const first = deferred<RuntimeHostCallResult>();
    const load = vi
      .fn<(request: RuntimeResourceRequest) => unknown>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce({ status: "succeeded", value: STORE_OUTPUT });
    const mounted = mountedResources({
      limits: { maxActiveTransports: 1 },
      ports: hostPorts(load),
    });
    const initial = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(initial.status).toBe("started");
    if (initial.status !== "started") throw new TypeError("Expected start.");
    const original = startedEntry(initial.entries, "stores");

    const firstRefresh = refreshRuntimeSurfaceResource(mounted.handle, {
      instanceId: "stores",
      resourceSnapshot: initial.snapshot,
      snapshot: resolutionSnapshot(initial.snapshot),
    });
    expect(firstRefresh.status).toBe("started");
    if (firstRefresh.status !== "started") throw new TypeError("Expected refresh.");
    const secondRefresh = refreshRuntimeSurfaceResource(mounted.handle, {
      instanceId: "stores",
      resourceSnapshot: firstRefresh.snapshot,
      snapshot: resolutionSnapshot(firstRefresh.snapshot),
    });
    expect(secondRefresh.status).toBe("started");
    if (secondRefresh.status !== "started") throw new TypeError("Expected refresh.");
    await expect(original.settlement).resolves.toMatchObject({ status: "superseded" });
    await expect(firstRefresh.settlement).resolves.toMatchObject({ status: "superseded" });
    expect(load).toHaveBeenCalledTimes(1);

    first.resolve({ status: "succeeded", value: STORE_OUTPUT });
    await Promise.resolve();
    await Promise.resolve();
    expect(load.mock.calls.map(([request]) => request.context.requestId)).toEqual([
      'resource:["stores",0]',
      'resource:["stores",2]',
    ]);
    await expect(secondRefresh.settlement).resolves.toMatchObject({ status: "succeeded" });
  });

  it.each(["manual", "mount", "once"] as const)(
    "refreshes the %s policy explicitly",
    async (policy) => {
      const mounted = mountedResources({
        resources: { stores: { use: STORES, input: {}, policy } },
      });
      const initial = startRuntimeSurfaceResources(
        mounted.handle,
        resolutionSnapshot(mounted.snapshot),
        mounted.snapshot,
      );
      expect(initial.status).toBe("started");
      if (initial.status !== "started") throw new TypeError("Expected start.");
      if (policy !== "manual") await startedEntry(initial.entries, "stores").settlement;
      const current = readRuntimeSurfaceResources(mounted.handle);
      expect(current.status).toBe("read");
      if (current.status !== "read") throw new TypeError("Expected live resource state.");
      const refreshed = refreshRuntimeSurfaceResource(mounted.handle, {
        instanceId: "stores",
        resourceSnapshot: current.snapshot,
        snapshot: resolutionSnapshot(current.snapshot),
      });
      expect(refreshed.status).toBe("started");
      if (refreshed.status !== "started") throw new TypeError("Expected refresh.");
      await expect(refreshed.settlement).resolves.toMatchObject({ status: "succeeded" });
    },
  );

  it("re-evaluates refresh input from the newly supplied factory snapshot", async () => {
    const catalogSet = preparedCatalog((catalog) => {
      resourceContract(catalog, STORES).inputSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["region"],
        properties: { region: { type: "string" } },
      };
    });
    const load = vi.fn((request: RuntimeResourceRequest) => {
      void request;
      return {
        status: "succeeded" as const,
        value: STORE_OUTPUT,
      };
    });
    const mounted = mountedResources({
      catalogSet,
      ports: hostPorts(load),
      resources: {
        stores: {
          use: STORES,
          input: { region: { $ref: "state.region" } },
          policy: "mount",
        },
      },
    });
    const initial = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot, { region: "eu" }),
      mounted.snapshot,
    );
    expect(initial.status).toBe("started");
    if (initial.status !== "started") throw new TypeError("Expected start.");
    await startedEntry(initial.entries, "stores").settlement;
    const current = readRuntimeSurfaceResources(mounted.handle);
    if (current.status !== "read") throw new TypeError("Expected current resources.");

    const refreshed = refreshRuntimeSurfaceResource(mounted.handle, {
      instanceId: "stores",
      resourceSnapshot: current.snapshot,
      snapshot: resolutionSnapshot(current.snapshot, { region: "us" }),
    });
    expect(refreshed.status).toBe("started");
    if (refreshed.status !== "started") throw new TypeError("Expected refresh.");
    await refreshed.settlement;
    expect(load.mock.calls.map(([request]) => request.input)).toEqual([
      { region: "eu" },
      { region: "us" },
    ]);
  });

  it("valid refresh supersedes a pending attempt and ignores its stale settlement", async () => {
    const first = deferred<RuntimeHostCallResult>();
    const second = deferred<RuntimeHostCallResult>();
    const load = vi
      .fn<(request: RuntimeResourceRequest) => unknown>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const mounted = mountedResources({ ports: hostPorts(load) });
    const initial = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(initial.status).toBe("started");
    if (initial.status !== "started") throw new TypeError("Expected initial start.");
    const original = startedEntry(initial.entries, "stores");

    const refreshed = refreshRuntimeSurfaceResource(mounted.handle, {
      instanceId: "stores",
      resourceSnapshot: initial.snapshot,
      snapshot: resolutionSnapshot(initial.snapshot),
    });
    expect(refreshed.status).toBe("started");
    if (refreshed.status !== "started") throw new TypeError("Expected refresh.");
    await expect(original.settlement).resolves.toMatchObject({
      status: "superseded",
      snapshot: { lifecycles: { stores: { status: "pending" } } },
    });

    let hostileReads = 0;
    const hostile = { status: "succeeded" } as MutableRecord;
    Object.defineProperty(hostile, "value", {
      enumerable: true,
      get() {
        hostileReads += 1;
        return STORE_OUTPUT;
      },
    });
    first.resolve(hostile as unknown as RuntimeHostCallResult);
    await Promise.resolve();
    expect(hostileReads).toBe(0);
    expect(readRuntimeSurfaceResources(mounted.handle)).toMatchObject({
      status: "read",
      snapshot: { lifecycles: { stores: { status: "pending" } } },
    });

    second.resolve({ status: "succeeded", value: STORE_OUTPUT });
    await expect(refreshed.settlement).resolves.toMatchObject({ status: "succeeded" });
  });

  it("does not supersede a live attempt when refresh input is invalid", async () => {
    const pending = deferred<RuntimeHostCallResult>();
    const catalogSet = preparedCatalog((catalog) => {
      resourceContract(catalog, STORES).inputSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["region"],
        properties: { region: { type: "string" } },
      };
    });
    const mounted = mountedResources({
      catalogSet,
      ports: hostPorts(() => pending.promise),
      resources: {
        stores: {
          use: STORES,
          input: { region: { $ref: "state.filters.region" } },
          policy: "mount",
        },
      },
    });
    const initialSnapshot = resolutionSnapshot(mounted.snapshot, {
      filters: { region: "eu" },
    });
    const initial = startRuntimeSurfaceResources(mounted.handle, initialSnapshot, mounted.snapshot);
    expect(initial.status).toBe("started");
    if (initial.status !== "started") throw new TypeError("Expected start.");
    const original = startedEntry(initial.entries, "stores");

    const invalid = refreshRuntimeSurfaceResource(mounted.handle, {
      instanceId: "stores",
      resourceSnapshot: initial.snapshot,
      snapshot: resolutionSnapshot(initial.snapshot),
    });
    expect(invalid).toMatchObject({
      status: "input-rejected",
      reason: "resolution",
    });
    let originalSettled = false;
    void original.settlement.then(() => {
      originalSettled = true;
    });
    await Promise.resolve();
    expect(originalSettled).toBe(false);
    pending.resolve({ status: "succeeded", value: STORE_OUTPUT });
    await expect(original.settlement).resolves.toMatchObject({ status: "succeeded" });
  });

  it("allocates deterministic per-instance request ids only for accepted attempts", async () => {
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const mounted = mountedResources({ ports: hostPorts(load) });
    const initial = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(initial.status).toBe("started");
    if (initial.status !== "started") throw new TypeError("Expected start.");
    expect(startedEntry(initial.entries, "stores").requestId).toBe('resource:["stores",0]');
    await startedEntry(initial.entries, "stores").settlement;

    const current = readRuntimeSurfaceResources(mounted.handle);
    if (current.status !== "read") throw new TypeError("Expected read.");
    const refresh = refreshRuntimeSurfaceResource(mounted.handle, {
      instanceId: "stores",
      resourceSnapshot: current.snapshot,
      snapshot: resolutionSnapshot(current.snapshot),
    });
    expect(refresh).toMatchObject({
      status: "started",
      requestId: 'resource:["stores",1]',
    });
  });

  it("rejects stale snapshots and unknown instances without host effects", async () => {
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const mounted = mountedResources({ ports: hostPorts(load) });
    const initial = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(initial.status).toBe("started");
    if (initial.status !== "started") throw new TypeError("Expected start.");
    const stale = resolutionSnapshot(initial.snapshot);
    await startedEntry(initial.entries, "stores").settlement;
    const before = load.mock.calls.length;

    expect(
      refreshRuntimeSurfaceResource(mounted.handle, {
        instanceId: "stores",
        resourceSnapshot: initial.snapshot,
        snapshot: stale,
      }),
    ).toMatchObject({ status: "invalid-snapshot" });
    expect(
      refreshRuntimeSurfaceResource(mounted.handle, {
        instanceId: "missing",
        resourceSnapshot: initial.snapshot,
        snapshot: stale,
      }),
    ).toEqual({ status: "unknown-instance", instanceId: "missing" });
    expect(load).toHaveBeenCalledTimes(before);
  });

  it("rejects ABA-equal and foreign resource snapshot objects by manager identity", async () => {
    const load = vi.fn(() => ({ status: "denied" as const }));
    const mounted = mountedResources({ ports: hostPorts(load) });
    const foreign = mountedResources({ ports: hostPorts(load) });
    expect(
      startRuntimeSurfaceResources(
        mounted.handle,
        resolutionSnapshot(mounted.snapshot),
        foreign.snapshot,
      ),
    ).toMatchObject({ status: "invalid-snapshot" });

    const originalIdle = mounted.snapshot;
    const initial = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(originalIdle),
      originalIdle,
    );
    expect(initial.status).toBe("started");
    if (initial.status !== "started") throw new TypeError("Expected start.");
    await expect(startedEntry(initial.entries, "stores").settlement).resolves.toMatchObject({
      status: "denied",
      snapshot: { lifecycles: { stores: { status: "idle" } } },
    });
    const current = readRuntimeSurfaceResources(mounted.handle);
    if (current.status !== "read") throw new TypeError("Expected current resources.");
    expect(current.snapshot.lifecycles).toEqual(originalIdle.lifecycles);
    expect(current.snapshot).not.toBe(originalIdle);

    expect(
      refreshRuntimeSurfaceResource(mounted.handle, {
        instanceId: "stores",
        resourceSnapshot: originalIdle,
        snapshot: resolutionSnapshot(current.snapshot),
      }),
    ).toMatchObject({ status: "invalid-snapshot", snapshot: current.snapshot });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("disposes pending attempts terminally and ignores every later settlement", async () => {
    const pending = deferred<RuntimeHostCallResult>();
    const mounted = mountedResources({
      ports: hostPorts(() => pending.promise),
    });
    const initial = startRuntimeSurfaceResources(
      mounted.handle,
      resolutionSnapshot(mounted.snapshot),
      mounted.snapshot,
    );
    expect(initial.status).toBe("started");
    if (initial.status !== "started") throw new TypeError("Expected start.");
    const attempt = startedEntry(initial.entries, "stores");

    expect(disposeRuntimeSurfaceResources(mounted.handle)).toEqual({
      status: "disposed",
      disposedAttempts: 1,
    });
    await expect(attempt.settlement).resolves.toEqual({
      status: "disposed",
      instanceId: "stores",
      requestId: 'resource:["stores",0]',
    });
    pending.resolve({ status: "succeeded", value: STORE_OUTPUT });
    await Promise.resolve();
    expect(readRuntimeSurfaceResources(mounted.handle)).toEqual({ status: "disposed" });
    expect(disposeRuntimeSurfaceResources(mounted.handle)).toEqual({
      status: "already-disposed",
      disposedAttempts: 0,
    });
  });

  it("rejects forged handles and malformed refresh requests without throwing", () => {
    const forged = Object.freeze({}) as RuntimeSurfaceResourcesHandle;
    expect(readRuntimeSurfaceResources(forged)).toEqual({ status: "invalid-handle" });
    expect(disposeRuntimeSurfaceResources(forged)).toEqual({
      status: "invalid-handle",
      disposedAttempts: 0,
    });

    const mounted = mountedResources();
    expect(
      refreshRuntimeSurfaceResource(mounted.handle, {
        instanceId: "stores",
      } as unknown as Parameters<typeof refreshRuntimeSurfaceResource>[1]),
    ).toEqual({ status: "malformed-request" });

    const current = readRuntimeSurfaceResources(mounted.handle);
    if (current.status !== "read") throw new TypeError("Expected current resources.");
    for (const instanceId of ["x".repeat(129), "mağaza"]) {
      expect(
        refreshRuntimeSurfaceResource(mounted.handle, {
          instanceId,
          resourceSnapshot: current.snapshot,
          snapshot: resolutionSnapshot(current.snapshot),
        }),
      ).toEqual({ status: "malformed-request" });
    }

    let getterReads = 0;
    const hostileRequest = {
      resourceSnapshot: current.snapshot,
      snapshot: resolutionSnapshot(current.snapshot),
    } as MutableRecord;
    Object.defineProperty(hostileRequest, "instanceId", {
      enumerable: true,
      get() {
        getterReads += 1;
        return "stores";
      },
    });
    expect(
      refreshRuntimeSurfaceResource(
        mounted.handle,
        hostileRequest as unknown as Parameters<typeof refreshRuntimeSurfaceResource>[1],
      ),
    ).toEqual({ status: "malformed-request" });
    expect(getterReads).toBe(0);
  });
});
