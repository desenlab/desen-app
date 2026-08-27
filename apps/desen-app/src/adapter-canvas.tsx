import { useEffect, useMemo, useState } from "react";

import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT } from "@desen/reference-catalog-web/react-adapters";
import { REFERENCE_WEB_TOKEN_CSS_PROPERTIES } from "@desen/reference-catalog-web/tokens";
import {
  createRuntimeHostPorts,
  disposeRuntimeHeadlessSession,
  mountRuntimeHeadlessSession,
} from "@desen/runtime-core";
import {
  RuntimeReactSurfaceBoundary,
  createRuntimeReactAdapterRegistry,
  renderRuntimeReactSurface,
  useRuntimeReactSurface,
} from "@desen/runtime-react";

import officialDerivedSignInBundle from "../../../examples/sign-in/official-derived.bundle.desen.json";
import styles from "./application.module.css";

import type { RuntimeHostPorts, RuntimeJsonObject } from "@desen/runtime-core";
import type {
  RuntimeReactLiveSurfaceInput,
  RuntimeReactSurfaceFailureRenderer,
} from "@desen/runtime-react";

const SUPPORTED_PROJECT_ID = "account-app";
const SUPPORTED_SURFACE_ID = "sign-in";
const EXPECTED_DOCUMENT_ID = "com.example.account-app";
const EXPECTED_REVISION = "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb";

const EMPTY_RUNTIME_JSON = Object.freeze({}) satisfies RuntimeJsonObject;
const WEB_RUNTIME_ENVIRONMENT = Object.freeze({ platform: "web" }) satisfies RuntimeJsonObject;

const ADAPTER_CANVAS_HOST_PORTS = createRuntimeHostPorts({
  navigation: { navigate: () => ({ status: "denied" }) },
  storage: {
    getBundle: () => ({ status: "missing" }),
    putBundle: () => ({ status: "conflict" }),
    readActivation: () => ({ status: "missing" }),
    commitActivation: () => ({ status: "conflict", generation: null }),
  },
  operations: { invoke: () => ({ status: "denied" }) },
  resources: { load: () => ({ status: "denied" }) },
  tokens: { resolve: () => ({ status: "missing" }) },
  context: {
    getSnapshot: () => EMPTY_RUNTIME_JSON,
    subscribe: () => () => undefined,
  },
  environment: {
    getSnapshot: () => WEB_RUNTIME_ENVIRONMENT,
    subscribe: () => () => undefined,
  },
  clock: { now: () => 1 },
  diagnostics: { report: () => undefined },
} satisfies RuntimeHostPorts);

const ADAPTER_CANVAS_REGISTRY = createRuntimeReactAdapterRegistry(
  REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT,
);

interface RouteIdentity {
  readonly projectId: string;
  readonly surfaceId: string;
}

interface ReadyCanvasState {
  readonly status: "ready";
  readonly routeIdentity: RouteIdentity;
  readonly input: RuntimeReactLiveSurfaceInput;
}

interface FailedCanvasState {
  readonly status: "failed";
  readonly routeIdentity: RouteIdentity;
}

type AdapterCanvasState = ReadyCanvasState | FailedCanvasState | undefined;

function isSupportedRoute(routeIdentity: RouteIdentity): boolean {
  return (
    routeIdentity.projectId === SUPPORTED_PROJECT_ID &&
    routeIdentity.surfaceId === SUPPORTED_SURFACE_ID
  );
}

const renderManagedFailure: RuntimeReactSurfaceFailureRenderer = () => (
  <div aria-live="polite" className={styles.adapterCanvasStatus}>
    The exact adapter preview is unavailable.
  </div>
);

function ManagedAdapterSurface({
  input,
}: Readonly<{ readonly input: RuntimeReactLiveSurfaceInput }>) {
  const result = useRuntimeReactSurface(input);

  return <RuntimeReactSurfaceBoundary renderFailure={renderManagedFailure} result={result} />;
}

function CanvasUnavailable() {
  return (
    <div aria-live="polite" className={styles.adapterCanvasStatus}>
      No exact adapter preview is available for this surface.
    </div>
  );
}

function CanvasLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className={styles.adapterCanvasStatus}>
      Preparing the exact adapter preview…
    </div>
  );
}

/** Exact read-only React-adapter canvas for the controlled account sign-in fixture. */
export interface DesenAdapterCanvasProps {
  readonly projectId: string;
  readonly surfaceId: string;
}

/**
 * Mounts the official-derived sign-in Bundle through the shared public reference adapter registry.
 *
 * @remarks The App supplies no managed component tree and accepts only the exact controlled route.
 * Other project/surface tuples fail closed without mounting or substituting the sign-in surface.
 */
export function DesenAdapterCanvas({ projectId, surfaceId }: DesenAdapterCanvasProps) {
  const routeIdentity = useMemo(
    () => Object.freeze({ projectId, surfaceId }),
    [projectId, surfaceId],
  );
  const [state, setState] = useState<AdapterCanvasState>();
  const supported = isSupportedRoute(routeIdentity);

  useEffect(() => {
    if (!supported) return;

    if (ADAPTER_CANVAS_REGISTRY.status !== "created") {
      setState(Object.freeze({ status: "failed", routeIdentity }));
      return;
    }

    const mounted = mountRuntimeHeadlessSession({
      bundle: officialDerivedSignInBundle,
      catalogs: [referenceCatalog],
      hostPorts: ADAPTER_CANVAS_HOST_PORTS,
    });
    if (mounted.status !== "mounted") {
      setState(Object.freeze({ status: "failed", routeIdentity }));
      return;
    }

    const session = mounted.handle;
    if (
      mounted.snapshot.documentId !== EXPECTED_DOCUMENT_ID ||
      mounted.snapshot.surfaceId !== SUPPORTED_SURFACE_ID ||
      mounted.snapshot.revision !== EXPECTED_REVISION
    ) {
      disposeRuntimeHeadlessSession(session);
      setState(Object.freeze({ status: "failed", routeIdentity }));
      return;
    }

    const input = Object.freeze({
      registry: ADAPTER_CANVAS_REGISTRY.handle,
      session,
      serverSnapshot: mounted.snapshot,
      catalogSet: mounted.catalogSet,
    }) satisfies RuntimeReactLiveSurfaceInput;
    const preflight = renderRuntimeReactSurface({
      registry: input.registry,
      session: input.session,
      snapshot: input.serverSnapshot,
      catalogSet: input.catalogSet,
    });
    if (
      preflight.status !== "rendered" ||
      preflight.surface.documentId !== EXPECTED_DOCUMENT_ID ||
      preflight.surface.surfaceId !== SUPPORTED_SURFACE_ID
    ) {
      disposeRuntimeHeadlessSession(session);
      setState(Object.freeze({ status: "failed", routeIdentity }));
      return;
    }

    setState(Object.freeze({ status: "ready", routeIdentity, input }));
    return () => {
      disposeRuntimeHeadlessSession(session);
    };
  }, [routeIdentity, supported]);

  if (!supported) return <CanvasUnavailable />;
  if (state === undefined || state.routeIdentity !== routeIdentity) return <CanvasLoading />;
  if (state.status === "failed") return <CanvasUnavailable />;

  return (
    <fieldset className={styles.adapterCanvas} disabled style={REFERENCE_WEB_TOKEN_CSS_PROPERTIES}>
      <legend className={styles.adapterCanvasLegend}>Sign-in adapter canvas</legend>
      <p className={styles.adapterCanvasNote}>Design preview · controls are disabled.</p>
      <div className={styles.adapterCanvasSurface}>
        <ManagedAdapterSurface input={state.input} />
      </div>
    </fieldset>
  );
}
