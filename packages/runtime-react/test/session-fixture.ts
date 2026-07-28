import { calculateDesenBundleRevision } from "@desen/protocol";
import {
  createRuntimeHostPorts,
  disposeRuntimeHeadlessSession,
  mountRuntimeHeadlessSession,
  readRuntimeHeadlessSession,
} from "@desen/runtime-core";

import frozenSignInBundle from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

import type {
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionSnapshot,
  RuntimeHostPorts,
  RuntimeJsonObject,
} from "@desen/runtime-core";
import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";

export type MutableJsonRecord = Record<string, unknown>;

export interface RuntimeReactSessionFixture {
  readonly session: RuntimeHeadlessSessionHandle;
  readonly snapshot: RuntimeHeadlessSessionSnapshot;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
}

export interface ReactiveRuntimeReactSessionFixture extends RuntimeReactSessionFixture {
  /**
   * Publishes one complete host-context replacement and returns the exact successor session
   * snapshot created by runtime-core.
   */
  readonly publishContext: (
    nextContext: RuntimeJsonObject,
  ) => Promise<RuntimeHeadlessSessionSnapshot>;
  /** Disposes the exact session authority and its host subscriptions idempotently. */
  readonly dispose: () => void;
}

export interface RuntimeReactSessionFixtureOptions {
  readonly mutateBundle?: (bundle: MutableJsonRecord) => void;
  readonly mutateCatalog?: (catalog: MutableJsonRecord) => void;
  readonly context?: RuntimeJsonObject;
  readonly environment?: RuntimeJsonObject;
}

export function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function inertHostPorts(
  context: RuntimeJsonObject,
  environment: RuntimeJsonObject,
): RuntimeHostPorts {
  return createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "succeeded" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: (request) => ({
        status: "committed",
        record: {
          activeRevision: request.activeRevision,
          previousGoodRevision: request.previousGoodRevision,
          generation: (request.expectedGeneration ?? -1) + 1,
        },
      }),
    },
    operations: { invoke: () => ({ status: "denied" }) },
    resources: { load: () => ({ status: "denied" }) },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => context,
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => environment,
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  });
}

function freezeJson<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) {
    freezeJson((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

function captureJsonObject(value: RuntimeJsonObject): RuntimeJsonObject {
  return freezeJson(cloneJson(value));
}

function readExactSnapshot(session: RuntimeHeadlessSessionHandle): RuntimeHeadlessSessionSnapshot {
  const result = readRuntimeHeadlessSession(session);
  if (result.status !== "read") {
    throw new TypeError(`Expected a live fixture session, received ${result.status}.`);
  }
  return result.snapshot;
}

function mountFixture(
  options: RuntimeReactSessionFixtureOptions,
  hostPorts: RuntimeHostPorts,
): RuntimeReactSessionFixture {
  const catalog = cloneJson(frozenWebCatalog) as unknown as MutableJsonRecord;
  options.mutateCatalog?.(catalog);

  const bundle = cloneJson(frozenSignInBundle) as unknown as MutableJsonRecord;
  options.mutateBundle?.(bundle);
  bundle.revision = calculateDesenBundleRevision(bundle);
  const mounted = mountRuntimeHeadlessSession({
    bundle,
    catalogs: [catalog],
    hostPorts,
  });
  if (mounted.status !== "mounted") {
    throw new TypeError(
      `Expected fixture session mount to pass: ${mounted.reason} ${JSON.stringify(
        mounted.diagnostics,
      )}`,
    );
  }
  return Object.freeze({
    session: mounted.handle,
    snapshot: mounted.snapshot,
    catalogSet: mounted.catalogSet,
  });
}

export function createRuntimeReactSessionFixture(
  options: RuntimeReactSessionFixtureOptions = {},
): RuntimeReactSessionFixture {
  return mountFixture(
    options,
    inertHostPorts(
      options.context ?? Object.freeze({}),
      options.environment ?? Object.freeze({ platform: "web" }),
    ),
  );
}

/**
 * Mounts a fixture whose context port can publish complete replacements into one stable session.
 *
 * @remarks The helper never fabricates snapshots. Each successful publication returns the exact
 * object read back from runtime-core after the host invalidation has produced a new generation.
 */
export function createReactiveRuntimeReactSessionFixture(
  options: RuntimeReactSessionFixtureOptions = {},
): ReactiveRuntimeReactSessionFixture {
  let currentContext = captureJsonObject(options.context ?? Object.freeze({}));
  const contextNotices = new Set<() => void>();
  const hostPorts = createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "succeeded" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: (request) => ({
        status: "committed",
        record: {
          activeRevision: request.activeRevision,
          previousGoodRevision: request.previousGoodRevision,
          generation: (request.expectedGeneration ?? -1) + 1,
        },
      }),
    },
    operations: { invoke: () => ({ status: "denied" }) },
    resources: { load: () => ({ status: "denied" }) },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => currentContext,
      subscribe: (notice) => {
        contextNotices.add(notice);
        let active = true;
        return () => {
          if (!active) return;
          active = false;
          contextNotices.delete(notice);
        };
      },
    },
    environment: {
      getSnapshot: () => options.environment ?? Object.freeze({ platform: "web" }),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  });
  const mounted = mountFixture(options, hostPorts);
  let disposed = false;

  const publishContext = async (
    nextContext: RuntimeJsonObject,
  ): Promise<RuntimeHeadlessSessionSnapshot> => {
    if (disposed) throw new TypeError("Cannot publish context to a disposed fixture session.");
    const previous = readExactSnapshot(mounted.session);
    currentContext = captureJsonObject(nextContext);
    for (const notice of [...contextNotices]) notice();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const successor = readExactSnapshot(mounted.session);
      if (successor !== previous) return successor;
      await Promise.resolve();
    }
    throw new TypeError("Expected the context publication to create a successor snapshot.");
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    disposeRuntimeHeadlessSession(mounted.session);
    contextNotices.clear();
  };

  return Object.freeze({
    ...mounted,
    publishContext,
    dispose,
  });
}

export function rootNode(bundle: MutableJsonRecord): MutableJsonRecord {
  const surfaces = bundle.surfaces as MutableJsonRecord;
  const signIn = surfaces["sign-in"] as MutableJsonRecord;
  return signIn.root as MutableJsonRecord;
}

export function catalogComponents(catalog: MutableJsonRecord): MutableJsonRecord {
  return catalog.components as MutableJsonRecord;
}
