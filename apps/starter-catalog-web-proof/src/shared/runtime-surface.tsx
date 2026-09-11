import { useMemo } from "react";

import {
  createRuntimeHostPorts,
  dispatchRuntimeHeadlessSessionEvent,
  disposeRuntimeHeadlessSession,
  mountRuntimeHeadlessSession,
  readRuntimeHeadlessSession,
} from "@desen/runtime-core";
import {
  RuntimeReactSurfaceBoundary,
  createRuntimeReactAdapterRegistry,
  useRuntimeReactSurface,
} from "@desen/runtime-react";
import {
  STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT,
  StarterSurfaceBoundary,
} from "@desen/starter-catalog-web/react-adapters";

import type {
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionSnapshot,
} from "@desen/runtime-core";
import type { RuntimeReactLiveSurfaceInput } from "@desen/runtime-react";

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
    getSnapshot: () => Object.freeze({}),
    subscribe: () => () => undefined,
  },
  environment: {
    getSnapshot: () => Object.freeze({ platform: "web" }),
    subscribe: () => () => undefined,
  },
  clock: { now: () => 1 },
  diagnostics: { report: () => undefined },
});

const registryResult = createRuntimeReactAdapterRegistry(STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT);
if (registryResult.status !== "created") {
  throw new TypeError("The reviewed starter adapter registry could not be created.");
}
const registry = registryResult.handle;

/** One exact mounted Runtime authority retained by the proof host, never by Bundle data. */
export interface MountedStarterProofSurface {
  readonly session: RuntimeHeadlessSessionHandle;
  readonly serverSnapshot: RuntimeHeadlessSessionSnapshot;
  readonly catalogSet: RuntimeReactLiveSurfaceInput["catalogSet"];
}

/** Mounts unknown Bundle/Catalog ingress only through Runtime Core's validating boundary. */
export function mountStarterProofSurface(
  bundle: unknown,
  catalog: unknown,
): MountedStarterProofSurface {
  const result = mountRuntimeHeadlessSession({ bundle, catalogs: [catalog], hostPorts });
  if (result.status !== "mounted") {
    throw new TypeError(`Starter proof Runtime mount rejected: ${result.reason}.`);
  }
  return Object.freeze({
    session: result.handle,
    serverSnapshot: result.snapshot,
    catalogSet: result.catalogSet,
  });
}

/** Revokes the exact proof session; repeated disposal remains safe. */
export function disposeStarterProofSurface(surface: MountedStarterProofSurface): void {
  disposeRuntimeHeadlessSession(surface.session);
}

/** Returns a detached state observation for browser assertions. */
export function readStarterProofState(
  surface: MountedStarterProofSurface,
): Readonly<Record<string, unknown>> | undefined {
  const result = readRuntimeHeadlessSession(surface.session);
  return result.status === "read" ? result.snapshot.state : undefined;
}

/**
 * Sends a deliberately malformed payload through the real authenticated interaction boundary.
 * This is trusted proof instrumentation; neither Source nor Bundle can select the payload.
 */
export function dispatchMalformedStarterEvent(
  surface: MountedStarterProofSurface,
  sourceNodeId: string,
  eventName: string,
): "rejected" | "unexpected" {
  const read = readRuntimeHeadlessSession(surface.session);
  if (read.status !== "read") return "unexpected";
  const binding = read.snapshot.bindings.find(
    (candidate) => candidate.kind === "component" && candidate.sourceNodeId === sourceNodeId,
  );
  if (binding === undefined) return "unexpected";
  const result = dispatchRuntimeHeadlessSessionEvent(surface.session, {
    snapshot: read.snapshot,
    runtimeInstanceId: binding.runtimeInstanceId,
    eventName,
    payload: { value: 7 },
  });
  return result.status === "rejected" ? "rejected" : "unexpected";
}

function ManagedStarterSurface({ input }: Readonly<{ input: RuntimeReactLiveSurfaceInput }>) {
  const result = useRuntimeReactSurface(input);
  return (
    <RuntimeReactSurfaceBoundary
      result={result}
      renderFailure={() => <p className="proof-error">Managed starter surface unavailable.</p>}
    />
  );
}

/**
 * Host-owned boundary around one fully Runtime-materialized starter surface. No managed component
 * tree is handwritten here; the authenticated render plan and static registry produce it.
 */
export function StarterProofSurface({
  mounted,
  rootNodeId,
  surfaceName,
}: Readonly<{
  mounted: MountedStarterProofSurface;
  rootNodeId: string;
  surfaceName: string;
}>) {
  const input = useMemo(
    () =>
      Object.freeze({
        registry,
        session: mounted.session,
        serverSnapshot: mounted.serverSnapshot,
        catalogSet: mounted.catalogSet,
      }) satisfies RuntimeReactLiveSurfaceInput,
    [mounted],
  );
  const binding = mounted.serverSnapshot.bindings.find(
    (candidate) => candidate.kind === "component" && candidate.sourceNodeId === rootNodeId,
  );
  return (
    <div
      data-proof-surface={surfaceName}
      data-runtime-instance-id={binding?.runtimeInstanceId ?? "missing"}
      data-source-node-id={rootNodeId}
    >
      <StarterSurfaceBoundary>
        <ManagedStarterSurface input={input} />
      </StarterSurfaceBoundary>
    </div>
  );
}
