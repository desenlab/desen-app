import { calculateDesenBundleRevision } from "@desen/protocol";
import { createRuntimeHostPorts, mountRuntimeHeadlessSession } from "@desen/runtime-core";

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

export function createRuntimeReactSessionFixture(
  options: RuntimeReactSessionFixtureOptions = {},
): RuntimeReactSessionFixture {
  const catalog = cloneJson(frozenWebCatalog) as unknown as MutableJsonRecord;
  options.mutateCatalog?.(catalog);

  const bundle = cloneJson(frozenSignInBundle) as unknown as MutableJsonRecord;
  options.mutateBundle?.(bundle);
  bundle.revision = calculateDesenBundleRevision(bundle);
  const mounted = mountRuntimeHeadlessSession({
    bundle,
    catalogs: [catalog],
    hostPorts: inertHostPorts(
      options.context ?? Object.freeze({}),
      options.environment ?? Object.freeze({ platform: "web" }),
    ),
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

export function rootNode(bundle: MutableJsonRecord): MutableJsonRecord {
  const surfaces = bundle.surfaces as MutableJsonRecord;
  const signIn = surfaces["sign-in"] as MutableJsonRecord;
  return signIn.root as MutableJsonRecord;
}

export function catalogComponents(catalog: MutableJsonRecord): MutableJsonRecord {
  return catalog.components as MutableJsonRecord;
}
