import { validateDesenExecutionCatalogSet } from "@desen/validator";
import { describe, expect, it, vi } from "vitest";

import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import { createRuntimeHostPorts } from "../src/host-ports.js";
import {
  acknowledgeRuntimeOperationSettlement,
  disposeRuntimeSurfaceOperations,
  invokeRuntimeOperation,
  mountRuntimeSurfaceOperations,
  readRuntimeSurfaceOperations,
  RUNTIME_OPERATION_LIMITS,
} from "../src/operation-lifecycle.js";

import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeOperationRequest,
} from "../src/host-ports.js";
import type {
  RuntimeOperationInvokeResult,
  RuntimeOperationLimitProfile,
  RuntimeOperationSettlement,
  RuntimeOperationTerminalSettlement,
  RuntimeSurfaceOperationAliasSpec,
  RuntimeSurfaceOperationsMounted,
  RuntimeSurfaceOperationsSnapshot,
} from "../src/operation-lifecycle.js";

const DOCUMENT_ID = "com.example.runtime";
const REVISION = `sha256:${"a".repeat(64)}`;
const SURFACE_ID = "sign-in";
const SIGN_IN = "com.example.auth/signIn";
const REORDER = "com.example.tasks/reorder";
const VALID_INPUT = Object.freeze({ email: "person@example.com", password: "secret" });
const VALID_OUTPUT = Object.freeze({ userId: "user-1" });

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

function preparedCatalog(
  mutate?: (catalog: MutableRecord) => void,
): DesenValidatedExecutionCatalogSet {
  const catalog = mutableRecord(JSON.parse(JSON.stringify(frozenWebCatalog)), "catalog");
  mutate?.(catalog);
  const validation = validateDesenExecutionCatalogSet([catalog]);
  expect(validation.valid).toBe(true);
  if (!validation.valid) throw new TypeError("Expected a valid execution Catalog fixture.");
  return validation.value;
}

function hostPorts(
  invoke: (request: RuntimeOperationRequest) => unknown = () => ({
    status: "succeeded",
    value: VALID_OUTPUT,
  }),
  report: (diagnostic: Parameters<RuntimeHostPorts["diagnostics"]["report"]>[0]) => void = vi.fn(),
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
    operations: { invoke: invoke as RuntimeHostPorts["operations"]["invoke"] },
    resources: { load: () => ({ status: "denied" }) },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report },
  });
}

function mountedOperations(
  options: Readonly<{
    aliases?: Readonly<Record<string, RuntimeSurfaceOperationAliasSpec>>;
    catalogSet?: DesenValidatedExecutionCatalogSet;
    limits?: RuntimeOperationLimitProfile;
    ports?: RuntimeHostPorts;
  }> = {},
): RuntimeSurfaceOperationsMounted {
  const result = mountRuntimeSurfaceOperations({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    aliases: options.aliases ?? { signIn: { operation: SIGN_IN } },
    catalogSet: options.catalogSet ?? preparedCatalog(),
    hostPorts: options.ports ?? hostPorts(),
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
  expect(result.status).toBe("mounted");
  if (result.status !== "mounted") throw new TypeError("Expected operation mount to succeed.");
  return result;
}

function invoke(
  mounted: RuntimeSurfaceOperationsMounted,
  options: Readonly<{
    alias?: string;
    operation?: string;
    input?: RuntimeJsonObject;
    concurrency?: "queue" | "reject" | "replace";
    snapshot?: RuntimeSurfaceOperationsSnapshot;
  }> = {},
): RuntimeOperationInvokeResult {
  return invokeRuntimeOperation(mounted.handle, {
    alias: options.alias ?? "signIn",
    operation: options.operation ?? SIGN_IN,
    input: options.input ?? VALID_INPUT,
    operationSnapshot: options.snapshot ?? currentSnapshot(mounted),
    ...(options.concurrency === undefined ? {} : { concurrency: options.concurrency }),
  });
}

function currentSnapshot(
  mounted: RuntimeSurfaceOperationsMounted,
): RuntimeSurfaceOperationsSnapshot {
  const read = readRuntimeSurfaceOperations(mounted.handle);
  expect(read.status).toBe("read");
  if (read.status !== "read") throw new TypeError("Expected a live operation manager.");
  return read.snapshot;
}

function started(result: RuntimeOperationInvokeResult) {
  expect(result.status).toBe("started");
  if (result.status !== "started") throw new TypeError("Expected invocation to start.");
  return result;
}

function queued(result: RuntimeOperationInvokeResult) {
  expect(result.status).toBe("queued");
  if (result.status !== "queued") throw new TypeError("Expected invocation to queue.");
  return result;
}

function terminal(settlement: RuntimeOperationSettlement): RuntimeOperationTerminalSettlement {
  expect(["succeeded", "failed", "denied", "invalid-output", "adapter-failed"]).toContain(
    settlement.status,
  );
  if (settlement.status === "superseded" || settlement.status === "disposed") {
    throw new TypeError("Expected a terminal settlement with an acknowledgement lease.");
  }
  return settlement;
}

describe("M04-T09 operation mount and authority", () => {
  it("mounts the whole alias inventory atomically as one frozen idle generation without host calls", () => {
    const hostInvoke = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const mounted = mountedOperations({
      aliases: {
        reorder: { operation: REORDER },
        signIn: { operation: SIGN_IN },
      },
      ports: hostPorts(hostInvoke),
    });

    expect(mounted.snapshot).toEqual({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      generation: 0,
      lifecycles: {
        reorder: { status: "idle", pending: false },
        signIn: { status: "idle", pending: false },
      },
    });
    expect(Object.isFrozen(mounted.snapshot)).toBe(true);
    expect(Object.isFrozen(mounted.snapshot.lifecycles)).toBe(true);
    expect(hostInvoke).not.toHaveBeenCalled();
  });

  it("rejects the entire mount for an unknown capability or malformed alias without partial authority", () => {
    const catalogSet = preparedCatalog();
    const ports = hostPorts();
    const unknown = mountRuntimeSurfaceOperations({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      aliases: {
        good: { operation: SIGN_IN },
        bad: { operation: "com.example.unknown/missing" },
      },
      catalogSet,
      hostPorts: ports,
    });
    expect(unknown).toMatchObject({
      status: "invalid",
      reason: "unknown-capability",
      alias: "bad",
    });
    if (unknown.status === "invalid") {
      expect(unknown.diagnostics[0]?.code).toBe("UNKNOWN_CAPABILITY");
    }

    const malformed = mountRuntimeSurfaceOperations({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      aliases: { "9bad": { operation: SIGN_IN } },
      catalogSet,
      hostPorts: ports,
    });
    expect(malformed).toMatchObject({
      status: "invalid",
      reason: "malformed-input",
      alias: "9bad",
    });
  });

  it("requires a factory-authenticated Catalog and a closed accessor-free mount envelope", () => {
    const castCatalog = [frozenWebCatalog] as unknown as DesenValidatedExecutionCatalogSet;
    expect(
      mountRuntimeSurfaceOperations({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        aliases: { signIn: { operation: SIGN_IN } },
        catalogSet: castCatalog,
        hostPorts: hostPorts(),
      }),
    ).toMatchObject({ status: "invalid", reason: "catalog-set-invalid" });

    const input = {
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      aliases: { signIn: { operation: SIGN_IN } },
      catalogSet: preparedCatalog(),
      hostPorts: hostPorts(),
    };
    Object.defineProperty(input, "aliases", { get: () => ({}) });
    expect(
      mountRuntimeSurfaceOperations(
        input as unknown as Parameters<typeof mountRuntimeSurfaceOperations>[0],
      ),
    ).toMatchObject({ status: "invalid", reason: "malformed-input" });
  });

  it("accepts frozen-schema document identifiers and only downward, exact integer limits", () => {
    const base = {
      documentId: "https://desen.app/örnek/".repeat(4),
      revision: REVISION,
      surfaceId: SURFACE_ID,
      aliases: { signIn: { operation: SIGN_IN } },
      catalogSet: preparedCatalog(),
      hostPorts: hostPorts(),
    };
    expect(
      mountRuntimeSurfaceOperations({
        ...base,
        limits: {
          maxActiveTransports: 1,
          maxAttemptGeneration: 2,
          maxQueuedInvocations: 3,
          maxSnapshotGeneration: 9,
        },
      }).status,
    ).toBe("mounted");
    expect(
      mountRuntimeSurfaceOperations({
        ...base,
        limits: { maxQueuedInvocations: RUNTIME_OPERATION_LIMITS.maxQueuedInvocations + 1 },
      }),
    ).toMatchObject({ status: "invalid", reason: "malformed-input" });
    expect(
      mountRuntimeSurfaceOperations({
        ...base,
        limits: { maxActiveTransports: 0 },
      }),
    ).toMatchObject({ status: "invalid", reason: "malformed-input" });
  });

  it("captures host callbacks at mount instead of observing later caller mutation", async () => {
    const original = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const operations: { invoke: RuntimeHostPorts["operations"]["invoke"] } = {
      invoke: original,
    };
    const ports = { ...hostPorts(original), operations } as RuntimeHostPorts;
    const mounted = mountedOperations({ ports });
    operations.invoke = vi.fn(() => ({ status: "denied" as const }));

    const settlement = await started(invoke(mounted)).settlement;
    expect(settlement.status).toBe("succeeded");
    expect(original).toHaveBeenCalledOnce();
  });
});

describe("M04-T09 invocation identity, validation, and lifecycle", () => {
  it("enters pending synchronously and sends detached Catalog-owned effect/input/context", async () => {
    const pending = deferred<RuntimeHostCallResult>();
    const requests: RuntimeOperationRequest[] = [];
    const mounted = mountedOperations({
      ports: hostPorts((request) => {
        requests.push(request);
        return pending.promise;
      }),
    });
    const callerInput = { email: "person@example.com", password: "secret" };
    const invocation = started(invoke(mounted, { input: callerInput }));
    callerInput.email = "mutated@example.com";

    expect(invocation.requestId).toBe('operation:["signIn",0]');
    expect(invocation.snapshot.lifecycles.signIn).toEqual({
      status: "pending",
      pending: true,
    });
    expect(requests).toEqual([
      {
        context: {
          documentId: DOCUMENT_ID,
          revision: REVISION,
          surfaceId: SURFACE_ID,
          requestId: 'operation:["signIn",0]',
        },
        capabilityId: SIGN_IN,
        invocationAlias: "signIn",
        input: VALID_INPUT,
        effect: "network",
      },
    ]);
    expect(Object.isFrozen(requests[0]?.input)).toBe(true);

    pending.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const settlement = terminal(await invocation.settlement);
    expect(settlement.status).toBe("succeeded");
    expect(settlement.snapshot.lifecycles.signIn).toEqual({
      status: "succeeded",
      pending: false,
      value: VALID_OUTPUT,
    });
  });

  it("validates resolved input against the exact Catalog and invalid attempts consume no identity", async () => {
    const hostInvoke = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const mounted = mountedOperations({ ports: hostPorts(hostInvoke) });
    const invalid = invoke(mounted, { input: { email: "not-email", password: "" } });
    expect(invalid.status).toBe("input-rejected");
    if (invalid.status === "input-rejected") {
      expect(invalid.reason).toBe("schema");
      expect(invalid.diagnostics.some(({ code }) => code === "OPERATION_INPUT_INVALID")).toBe(true);
    }
    expect(currentSnapshot(mounted).generation).toBe(0);
    expect(hostInvoke).not.toHaveBeenCalled();

    const invocation = started(invoke(mounted));
    expect(invocation.requestId).toBe('operation:["signIn",0]');
    await invocation.settlement;
  });

  it("rejects unknown aliases and capability assertion mismatches without consuming identity", async () => {
    const hostInvoke = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const mounted = mountedOperations({ ports: hostPorts(hostInvoke) });
    expect(invoke(mounted, { alias: "missing" })).toMatchObject({
      status: "unknown-alias",
      alias: "missing",
    });
    const mismatch = invoke(mounted, { operation: REORDER });
    expect(mismatch).toMatchObject({
      status: "capability-mismatch",
      alias: "signIn",
    });
    if (mismatch.status === "capability-mismatch") {
      expect(mismatch.diagnostics[0]).toMatchObject({
        code: "run.desen.runtime/OPERATION_CAPABILITY_MISMATCH",
        context: { capabilityId: SIGN_IN },
      });
      expect(Object.isFrozen(mismatch.diagnostics)).toBe(true);
    }
    expect(hostInvoke).not.toHaveBeenCalled();
    expect(currentSnapshot(mounted).generation).toBe(0);
    expect(Object.keys(currentSnapshot(mounted).lifecycles)).toEqual(["signIn"]);

    const valid = started(invoke(mounted));
    expect(valid.requestId).toBe('operation:["signIn",0]');
    await valid.settlement;
  });

  it("rejects a live JS request missing its required operation assertion without consuming identity", async () => {
    const hostInvoke = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const mounted = mountedOperations({ ports: hostPorts(hostInvoke) });
    const malformed = invokeRuntimeOperation(mounted.handle, {
      alias: "signIn",
      input: VALID_INPUT,
      operationSnapshot: mounted.snapshot,
    } as never);

    expect(malformed).toEqual({ status: "malformed-request" });
    expect(hostInvoke).not.toHaveBeenCalled();
    expect(currentSnapshot(mounted)).toMatchObject({
      generation: 0,
      lifecycles: { signIn: { status: "idle", pending: false } },
    });

    const valid = started(invoke(mounted));
    expect(valid.requestId).toBe('operation:["signIn",0]');
    await valid.settlement;
  });

  it("requires the exact current manager snapshot and rejects stale, foreign, and ABA-equal copies", () => {
    const first = mountedOperations();
    const second = mountedOperations();
    const initial = first.snapshot;
    const startedFirst = started(invoke(first, { snapshot: initial }));

    expect(invoke(first, { snapshot: initial })).toMatchObject({ status: "invalid-snapshot" });
    expect(invoke(first, { snapshot: second.snapshot })).toMatchObject({
      status: "invalid-snapshot",
    });
    const equalCopy = JSON.parse(JSON.stringify(currentSnapshot(first)));
    expect(
      invoke(first, { snapshot: equalCopy as RuntimeSurfaceOperationsSnapshot }),
    ).toMatchObject({ status: "invalid-snapshot" });
    void startedFirst;
  });

  it("defaults omitted concurrency to reject and rejected attempts consume no generation", async () => {
    const firstHost = deferred<RuntimeHostCallResult>();
    const mounted = mountedOperations({ ports: hostPorts(() => firstHost.promise) });
    const first = started(invoke(mounted));
    expect(invoke(mounted)).toMatchObject({
      status: "rejected",
      reason: "pending",
      alias: "signIn",
    });
    firstHost.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const firstSettlement = terminal(await first.settlement);
    acknowledgeRuntimeOperationSettlement(mounted.handle, firstSettlement.lease);

    const next = started(invoke(mounted));
    expect(next.requestId).toBe('operation:["signIn",1]');
  });

  it("keeps synchronous host results asynchronous so pending is observable first", async () => {
    const mounted = mountedOperations();
    const invocation = started(invoke(mounted));
    expect(currentSnapshot(mounted).lifecycles.signIn?.status).toBe("pending");
    let settled = false;
    void invocation.settlement.then(() => {
      settled = true;
    });
    expect(settled).toBe(false);
    await Promise.resolve();
    await invocation.settlement;
    expect(settled).toBe(true);
  });

  it("invokes operation and diagnostic callbacks receiver-independently", async () => {
    const receivers: unknown[] = [];
    const reports: unknown[] = [];
    const operation = function (this: unknown) {
      receivers.push(this);
      return { status: "denied" as const };
    };
    const report = function (this: unknown) {
      reports.push(this);
    };
    const mounted = mountedOperations({ ports: hostPorts(operation, report) });
    const settlement = await started(invoke(mounted)).settlement;
    expect(settlement.status).toBe("denied");
    expect(receivers).toEqual([undefined]);
    expect(reports).toEqual([undefined]);
  });

  it("guards early diagnostic reporting against recursive runtime reentry", () => {
    const holder: { mounted?: RuntimeSurfaceOperationsMounted } = {};
    let reentrant: RuntimeOperationInvokeResult | undefined;
    const report = vi.fn(() => {
      if (holder.mounted === undefined) throw new TypeError("Expected mounted manager.");
      reentrant = invokeRuntimeOperation(holder.mounted.handle, {} as never);
    });
    const mounted = mountedOperations({ ports: hostPorts(undefined, report) });
    holder.mounted = mounted;

    expect(invoke(mounted, { alias: "missing" }).status).toBe("unknown-alias");
    expect(report).toHaveBeenCalledOnce();
    expect(reentrant).toEqual({ status: "busy" });
  });
});

describe("M04-T09 reject, replace, and queue concurrency", () => {
  it("serializes queue mode and requires terminal lease acknowledgement before promotion", async () => {
    const transports = [deferred<RuntimeHostCallResult>(), deferred<RuntimeHostCallResult>()];
    const hostInvoke = vi.fn(() => transports[hostInvoke.mock.calls.length - 1]?.promise);
    const mounted = mountedOperations({ ports: hostPorts(hostInvoke) });
    const first = started(invoke(mounted));
    const second = queued(invoke(mounted, { concurrency: "queue" }));
    expect(second.position).toBe(1);
    expect(hostInvoke).toHaveBeenCalledOnce();

    transports[0]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const firstSettlement = terminal(await first.settlement);
    expect(currentSnapshot(mounted).lifecycles.signIn?.status).toBe("succeeded");
    expect(hostInvoke).toHaveBeenCalledOnce();

    const acknowledged = acknowledgeRuntimeOperationSettlement(
      mounted.handle,
      firstSettlement.lease,
    );
    expect(acknowledged).toMatchObject({
      status: "acknowledged",
      promotedRequestId: second.requestId,
    });
    expect(
      acknowledged.status === "acknowledged" && acknowledged.snapshot.lifecycles.signIn,
    ).toEqual({ status: "pending", pending: true });
    expect(hostInvoke).toHaveBeenCalledTimes(2);

    transports[1]?.resolve({ status: "succeeded", value: { userId: "user-2" } });
    expect((await second.settlement).status).toBe("succeeded");
  });

  it("stages a settlement-handler invocation as pending but gates its host call until acknowledgement", async () => {
    const transports = [deferred<RuntimeHostCallResult>(), deferred<RuntimeHostCallResult>()];
    let calls = 0;
    const hostInvoke = vi.fn(() => transports[calls++]?.promise);
    const mounted = mountedOperations({ ports: hostPorts(hostInvoke) });
    const first = started(invoke(mounted));
    transports[0]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const firstSettlement = terminal(await first.settlement);
    expect(firstSettlement.snapshot.lifecycles.signIn?.status).toBe("succeeded");

    const nested = invoke(mounted);
    expect(nested.status).toBe("staged");
    if (nested.status !== "staged") throw new TypeError("Expected an ack-gated invocation.");
    expect(nested.snapshot.lifecycles.signIn).toEqual({ status: "pending", pending: true });
    expect(hostInvoke).toHaveBeenCalledOnce();

    expect(
      acknowledgeRuntimeOperationSettlement(mounted.handle, firstSettlement.lease),
    ).toMatchObject({ status: "acknowledged", promotedRequestId: nested.requestId });
    expect(hostInvoke).toHaveBeenCalledTimes(2);
    transports[1]?.resolve({ status: "succeeded", value: { userId: "nested" } });
    expect((await nested.settlement).status).toBe("succeeded");
  });

  it("lets ack-gated replace supersede the complete FIFO backlog before launching newest work", async () => {
    const transports = [deferred<RuntimeHostCallResult>(), deferred<RuntimeHostCallResult>()];
    let calls = 0;
    const mounted = mountedOperations({
      ports: hostPorts(() => transports[calls++]?.promise),
    });
    const first = started(invoke(mounted));
    const oldQueued = queued(invoke(mounted, { concurrency: "queue" }));
    transports[0]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const firstSettlement = terminal(await first.settlement);

    const replacement = invoke(mounted, { concurrency: "replace" });
    expect(replacement.status).toBe("staged");
    if (replacement.status !== "staged") throw new TypeError("Expected staged replacement.");
    await expect(oldQueued.settlement).resolves.toMatchObject({ status: "superseded" });
    expect(calls).toBe(1);

    acknowledgeRuntimeOperationSettlement(mounted.handle, firstSettlement.lease);
    expect(calls).toBe(2);
    transports[1]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    expect((await replacement.settlement).status).toBe("succeeded");
  });

  it("stages the existing FIFO head when a settlement handler appends more queue work", async () => {
    const transports = [
      deferred<RuntimeHostCallResult>(),
      deferred<RuntimeHostCallResult>(),
      deferred<RuntimeHostCallResult>(),
    ];
    let calls = 0;
    const mounted = mountedOperations({
      ports: hostPorts(() => transports[calls++]?.promise),
    });
    const first = started(invoke(mounted));
    const second = queued(invoke(mounted, { concurrency: "queue" }));
    transports[0]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const firstSettlement = terminal(await first.settlement);

    const nested = queued(invoke(mounted, { concurrency: "queue" }));
    expect(nested.snapshot.lifecycles.signIn).toEqual({ status: "pending", pending: true });
    expect(calls).toBe(1);
    acknowledgeRuntimeOperationSettlement(mounted.handle, firstSettlement.lease);
    expect(calls).toBe(2);

    transports[1]?.resolve({ status: "succeeded", value: { userId: "second" } });
    const secondSettlement = terminal(await second.settlement);
    expect(calls).toBe(2);
    acknowledgeRuntimeOperationSettlement(mounted.handle, secondSettlement.lease);
    expect(calls).toBe(3);

    transports[2]?.resolve({ status: "succeeded", value: { userId: "nested" } });
    expect((await nested.settlement).status).toBe("succeeded");
  });

  it("promotes queued invocations in accepted FIFO order one acknowledgement at a time", async () => {
    const transports = [
      deferred<RuntimeHostCallResult>(),
      deferred<RuntimeHostCallResult>(),
      deferred<RuntimeHostCallResult>(),
    ];
    let calls = 0;
    const mounted = mountedOperations({
      ports: hostPorts(() => transports[calls++]?.promise),
    });
    const first = started(invoke(mounted));
    const second = queued(invoke(mounted, { concurrency: "queue" }));
    const third = queued(invoke(mounted, { concurrency: "queue" }));
    expect([first.requestId, second.requestId, third.requestId]).toEqual([
      'operation:["signIn",0]',
      'operation:["signIn",1]',
      'operation:["signIn",2]',
    ]);

    transports[0]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const firstTerminal = terminal(await first.settlement);
    acknowledgeRuntimeOperationSettlement(mounted.handle, firstTerminal.lease);
    expect(calls).toBe(2);
    transports[1]?.resolve({ status: "failed", errorCode: "invalidCredentials" });
    const secondTerminal = terminal(await second.settlement);
    expect(calls).toBe(2);
    acknowledgeRuntimeOperationSettlement(mounted.handle, secondTerminal.lease);
    expect(calls).toBe(3);
    transports[2]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    expect((await third.settlement).status).toBe("succeeded");
  });

  it("bounds retained queues across the whole manager instead of multiplying the limit by aliases", () => {
    const mounted = mountedOperations({
      aliases: {
        first: { operation: SIGN_IN },
        second: { operation: SIGN_IN },
      },
      limits: { maxQueuedInvocations: 1 },
      ports: hostPorts(() => new Promise(() => undefined)),
    });
    started(invoke(mounted, { alias: "first" }));
    queued(invoke(mounted, { alias: "first", concurrency: "queue" }));
    started(invoke(mounted, { alias: "second" }));
    expect(invoke(mounted, { alias: "second", concurrency: "queue" })).toMatchObject({
      status: "queue-limit",
      alias: "second",
    });
  });

  it("replace supersedes the active and queued work only after the replacement input validates", async () => {
    const firstHost = deferred<unknown>();
    const replacementHost = deferred<RuntimeHostCallResult>();
    const hostInvoke = vi
      .fn<(request: RuntimeOperationRequest) => unknown>()
      .mockImplementationOnce(() => firstHost.promise)
      .mockImplementationOnce(() => replacementHost.promise);
    const mounted = mountedOperations({ ports: hostPorts(hostInvoke) });
    const first = started(invoke(mounted));
    const queuedOld = queued(invoke(mounted, { concurrency: "queue" }));

    expect(
      invoke(mounted, {
        concurrency: "replace",
        input: { email: "invalid", password: "" },
      }).status,
    ).toBe("input-rejected");
    expect(currentSnapshot(mounted).lifecycles.signIn?.status).toBe("pending");

    const replacement = started(invoke(mounted, { concurrency: "replace" }));
    await expect(first.settlement).resolves.toMatchObject({ status: "superseded" });
    await expect(queuedOld.settlement).resolves.toMatchObject({ status: "superseded" });
    expect(replacement.requestId).toBe('operation:["signIn",2]');

    let staleEnvelopeRead = false;
    firstHost.resolve(
      Object.defineProperty({}, "status", {
        get() {
          staleEnvelopeRead = true;
          throw new Error("stale envelope must remain opaque");
        },
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(staleEnvelopeRead).toBe(false);

    replacementHost.resolve({ status: "succeeded", value: VALID_OUTPUT });
    expect((await replacement.settlement).status).toBe("succeeded");
  });

  it("enforces the attempt ceiling after accepted queued identity while invalid/rejected work is free", async () => {
    const firstHost = deferred<RuntimeHostCallResult>();
    const mounted = mountedOperations({
      limits: { maxAttemptGeneration: 1 },
      ports: hostPorts(() => firstHost.promise),
    });
    expect(invoke(mounted, { input: { email: "bad", password: "" } }).status).toBe(
      "input-rejected",
    );
    const first = started(invoke(mounted));
    expect(invoke(mounted).status).toBe("rejected");
    queued(invoke(mounted, { concurrency: "queue" }));
    expect(invoke(mounted, { concurrency: "queue" })).toMatchObject({
      status: "attempt-limit",
    });
    firstHost.resolve({ status: "succeeded", value: VALID_OUTPUT });
    await first.settlement;
  });

  it("reserves pending and terminal generations for every accepted queued invocation", async () => {
    const firstHost = deferred<RuntimeHostCallResult>();
    const mounted = mountedOperations({
      limits: { maxQueuedInvocations: 8, maxSnapshotGeneration: 4 },
      ports: hostPorts(() => firstHost.promise),
    });
    const first = started(invoke(mounted));
    queued(invoke(mounted, { concurrency: "queue" }));
    expect(invoke(mounted, { concurrency: "queue" })).toMatchObject({
      status: "snapshot-limit",
    });
    firstHost.resolve({ status: "succeeded", value: VALID_OUTPUT });
    expect((await first.settlement).status).toBe("succeeded");
  });
});

describe("M04-T09 settlement containment", () => {
  it("exposes only declared public failures and publishes the closed failed lifecycle", async () => {
    const mounted = mountedOperations({
      ports: hostPorts(() => ({ status: "failed", errorCode: "invalidCredentials" })),
    });
    const settlement = terminal(await started(invoke(mounted)).settlement);
    expect(settlement).toMatchObject({
      status: "failed",
      errorCode: "invalidCredentials",
      snapshot: {
        lifecycles: {
          signIn: {
            status: "failed",
            pending: false,
            error: { code: "invalidCredentials" },
          },
        },
      },
    });
  });

  it("redacts undeclared errors, thrown/rejected adapters, and malformed envelopes", async () => {
    const cases: (() => unknown)[] = [
      () => ({ status: "failed", errorCode: "internal-secret" }),
      () => {
        throw new Error("database password");
      },
      () => Promise.reject(new Error("private stack")),
      () => ({ status: "succeeded", value: VALID_OUTPUT, extra: "secret" }),
    ];
    for (const implementation of cases) {
      const mounted = mountedOperations({ ports: hostPorts(implementation) });
      const settlement = terminal(await started(invoke(mounted)).settlement);
      expect(settlement.status).toBe("adapter-failed");
      if (settlement.status === "adapter-failed") {
        const serialized = JSON.stringify(settlement.diagnostics);
        expect(serialized).not.toMatch(
          /internal-secret|database password|private stack|extra|secret/u,
        );
        expect(settlement.snapshot.lifecycles.signIn).toEqual({
          status: "idle",
          pending: false,
        });
      }
    }
  });

  it("keeps policy denial technical and reports the exact frozen core diagnostic", async () => {
    const mounted = mountedOperations({ ports: hostPorts(() => ({ status: "denied" })) });
    const settlement = terminal(await started(invoke(mounted)).settlement);
    expect(settlement.status).toBe("denied");
    if (settlement.status === "denied") {
      expect(settlement.diagnostics[0]?.code).toBe("OPERATION_DENIED");
      expect(Object.isFrozen(settlement.diagnostics)).toBe(true);
      expect(settlement.snapshot.lifecycles.signIn).toEqual({
        status: "idle",
        pending: false,
      });
    }
  });

  it("validates output before exposure and never leaks attacker-controlled output member names", async () => {
    const output = Object.freeze({ secretAdminToken: "do-not-leak" });
    const mounted = mountedOperations({
      ports: hostPorts(() => ({ status: "succeeded", value: output })),
    });
    const settlement = terminal(await started(invoke(mounted)).settlement);
    expect(settlement.status).toBe("invalid-output");
    if (settlement.status === "invalid-output") {
      expect(settlement.diagnostics[0]?.code).toBe("OPERATION_OUTPUT_INVALID");
      expect(JSON.stringify(settlement.diagnostics)).not.toMatch(/secretAdminToken|do-not-leak/u);
      expect(settlement.snapshot.lifecycles.signIn).toEqual({
        status: "idle",
        pending: false,
      });
    }
  });

  it("detaches and recursively freezes successful output before publishing it", async () => {
    const candidate = { userId: "user-1" };
    const mounted = mountedOperations({
      ports: hostPorts(() => ({ status: "succeeded", value: candidate })),
    });
    const settlement = terminal(await started(invoke(mounted)).settlement);
    candidate.userId = "mutated";
    expect(settlement.snapshot.lifecycles.signIn).toEqual({
      status: "succeeded",
      pending: false,
      value: { userId: "user-1" },
    });
    expect(Object.isFrozen(settlement.snapshot.lifecycles.signIn)).toBe(true);
  });

  it("contains aggregate declared-failure and success expansion at the retained lifecycle boundary", async () => {
    const aliases = Object.fromEntries(
      Array.from({ length: 1_362 }, (_, index) => [`a${index}`, { operation: SIGN_IN }]),
    );
    const candidates: RuntimeHostCallResult[] = [
      { status: "failed", errorCode: "invalidCredentials" },
      { status: "succeeded", value: VALID_OUTPUT },
    ];

    for (const candidate of candidates) {
      const mounted = mountedOperations({
        aliases,
        limits: { maxSnapshotGeneration: 4 },
        ports: hostPorts(() => candidate),
      });
      const first = started(invoke(mounted, { alias: "a0" }));
      const firstSettlement = terminal(await first.settlement);
      expect(firstSettlement.status).toBe("invalid-output");
      if (firstSettlement.status !== "invalid-output") {
        throw new TypeError("Expected retained lifecycle containment.");
      }
      expect(firstSettlement.diagnostics[0]?.code).toBe(
        "run.desen.runtime/OPERATION_RETAINED_LIMIT_EXCEEDED",
      );
      expect(firstSettlement.snapshot.lifecycles.a0).toEqual({
        status: "idle",
        pending: false,
      });

      acknowledgeRuntimeOperationSettlement(mounted.handle, firstSettlement.lease);
      const second = started(invoke(mounted, { alias: "a0" }));
      expect(second.requestId).toBe('operation:["a0",1]');
      const secondSettlement = await second.settlement;
      expect(secondSettlement.status).toBe("invalid-output");
    }
  });

  it("rejects hostile settlement accessors as adapter failure without invoking them repeatedly", async () => {
    let reads = 0;
    const envelope = Object.defineProperty({}, "status", {
      get() {
        reads += 1;
        return "succeeded";
      },
    });
    const mounted = mountedOperations({ ports: hostPorts(() => envelope) });
    const settlement = await started(invoke(mounted)).settlement;
    expect(settlement.status).toBe("adapter-failed");
    expect(reads).toBe(0);
  });
});

describe("M04-T09 settlement leases, transports, and disposal", () => {
  it("makes settlement leases opaque, manager-bound, and one-shot", async () => {
    const first = mountedOperations();
    const second = mountedOperations();
    const settlement = terminal(await started(invoke(first)).settlement);
    expect(acknowledgeRuntimeOperationSettlement(second.handle, settlement.lease)).toMatchObject({
      status: "invalid-lease",
    });
    expect(
      acknowledgeRuntimeOperationSettlement(
        first.handle,
        {} as Parameters<typeof acknowledgeRuntimeOperationSettlement>[1],
      ),
    ).toMatchObject({ status: "invalid-lease" });
    expect(acknowledgeRuntimeOperationSettlement(first.handle, settlement.lease)).toMatchObject({
      status: "acknowledged",
    });
    expect(acknowledgeRuntimeOperationSettlement(second.handle, settlement.lease)).toMatchObject({
      status: "invalid-lease",
    });
    expect(acknowledgeRuntimeOperationSettlement(first.handle, settlement.lease)).toMatchObject({
      status: "already-acknowledged",
    });
  });

  it("caps underlying host transports while preserving independent alias pending lifecycles", async () => {
    const transports = [deferred<RuntimeHostCallResult>(), deferred<RuntimeHostCallResult>()];
    let calls = 0;
    const hostInvoke = vi.fn(() => transports[calls++]?.promise);
    const mounted = mountedOperations({
      aliases: {
        first: { operation: SIGN_IN },
        second: { operation: SIGN_IN },
      },
      limits: { maxActiveTransports: 1 },
      ports: hostPorts(hostInvoke),
    });
    const first = started(invoke(mounted, { alias: "first" }));
    const second = started(invoke(mounted, { alias: "second" }));
    expect(hostInvoke).toHaveBeenCalledOnce();
    expect(currentSnapshot(mounted).lifecycles).toMatchObject({
      first: { status: "pending" },
      second: { status: "pending" },
    });

    transports[0]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    await first.settlement;
    expect(hostInvoke).toHaveBeenCalledTimes(2);
    transports[1]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    await second.settlement;
  });

  it("returns busy for operation reentry while a host callback is being launched", async () => {
    const holder: { mounted?: RuntimeSurfaceOperationsMounted } = {};
    let reentrant: RuntimeOperationInvokeResult | undefined;
    const mounted = mountedOperations({
      ports: hostPorts(() => {
        if (holder.mounted === undefined) throw new TypeError("Expected mounted manager.");
        reentrant = invokeRuntimeOperation(holder.mounted.handle, {} as never);
        return { status: "succeeded", value: VALID_OUTPUT };
      }),
    });
    holder.mounted = mounted;
    await started(invoke(mounted)).settlement;
    expect(reentrant).toEqual({ status: "busy" });
  });

  it("lets reentrant disposal revoke accepted work and prevents late hostile settlement reads", async () => {
    const holder: { mounted?: RuntimeSurfaceOperationsMounted } = {};
    const hostile = deferred<unknown>();
    const mounted = mountedOperations({
      ports: hostPorts(() => {
        if (holder.mounted === undefined) throw new TypeError("Expected mounted manager.");
        disposeRuntimeSurfaceOperations(holder.mounted.handle);
        return hostile.promise;
      }),
    });
    holder.mounted = mounted;
    const invocation = started(invoke(mounted));
    await expect(invocation.settlement).resolves.toMatchObject({ status: "disposed" });
    let read = false;
    hostile.resolve(
      Object.defineProperty({}, "status", {
        get() {
          read = true;
          return "succeeded";
        },
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(read).toBe(false);
  });

  it("disposes active and queued invocations, invalidates leases, and remains idempotent", async () => {
    const hostSettlement = deferred<RuntimeHostCallResult>();
    const mounted = mountedOperations({ ports: hostPorts(() => hostSettlement.promise) });
    const active = started(invoke(mounted));
    const pendingQueue = queued(invoke(mounted, { concurrency: "queue" }));
    expect(disposeRuntimeSurfaceOperations(mounted.handle)).toEqual({
      status: "disposed",
      disposedInvocations: 2,
      invalidatedLeases: 0,
    });
    await expect(active.settlement).resolves.toMatchObject({ status: "disposed" });
    await expect(pendingQueue.settlement).resolves.toMatchObject({ status: "disposed" });
    expect(disposeRuntimeSurfaceOperations(mounted.handle)).toEqual({
      status: "already-disposed",
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
    expect(readRuntimeSurfaceOperations(mounted.handle)).toEqual({ status: "disposed" });

    const terminalManager = mountedOperations();
    const settlement = terminal(await started(invoke(terminalManager)).settlement);
    expect(disposeRuntimeSurfaceOperations(terminalManager.handle)).toMatchObject({
      status: "disposed",
      invalidatedLeases: 1,
    });
    expect(acknowledgeRuntimeOperationSettlement(terminalManager.handle, settlement.lease)).toEqual(
      { status: "disposed" },
    );
  });

  it("returns controlled outcomes for forged handles and cannot expose a partial authority", () => {
    const forged = {} as Parameters<typeof readRuntimeSurfaceOperations>[0];
    expect(readRuntimeSurfaceOperations(forged)).toEqual({ status: "invalid-handle" });
    expect(invokeRuntimeOperation(forged, {} as never)).toEqual({ status: "invalid-handle" });
    expect(disposeRuntimeSurfaceOperations(forged)).toEqual({
      status: "invalid-handle",
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
  });
});
