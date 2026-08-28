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
import { REFERENCE_AUTHORING_MODEL } from "./authoring-data.js";
import { projectAuthoringSelection } from "./authoring-selection.js";
import styles from "./application.module.css";

import type { RuntimeHostPorts, RuntimeJsonObject } from "@desen/runtime-core";
import type {
  RuntimeReactLiveSurfaceInput,
  RuntimeReactSurfaceFailureRenderer,
} from "@desen/runtime-react";
import type {
  AuthoringComponentSelection,
  AuthoringSelectionProjection,
} from "./authoring-selection.js";
import type { CatalogAuthoringModel } from "./authoring-data.js";

const SUPPORTED_PROJECT_ID = "account-app";
const SUPPORTED_SURFACE_ID = "sign-in";
const EXPECTED_DOCUMENT_ID = "com.example.account-app";

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
  readonly previewRevision: string;
  readonly input: RuntimeReactLiveSurfaceInput;
}

interface FailedCanvasState {
  readonly status: "failed";
  readonly routeIdentity: RouteIdentity;
  readonly previewRevision: string;
}

type AdapterCanvasState = ReadyCanvasState | FailedCanvasState | undefined;

function isSupportedRoute(routeIdentity: RouteIdentity): boolean {
  return (
    routeIdentity.projectId === SUPPORTED_PROJECT_ID &&
    routeIdentity.surfaceId === SUPPORTED_SURFACE_ID
  );
}

function readPreviewRevision(bundle: unknown): string | undefined {
  if (typeof bundle !== "object" || bundle === null || Array.isArray(bundle)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(bundle, "revision");
  return descriptor?.enumerable === true &&
    "value" in descriptor &&
    typeof descriptor.value === "string"
    ? descriptor.value
    : undefined;
}

const renderManagedFailure: RuntimeReactSurfaceFailureRenderer = () => (
  <div aria-live="polite" className={styles.adapterCanvasStatus}>
    The exact adapter preview is unavailable.
  </div>
);

function SelectionOverlay({
  projection,
}: Readonly<{ readonly projection: AuthoringSelectionProjection }>) {
  if (projection.status !== "materialized" && projection.status !== "not-materialized") {
    return null;
  }

  const materialized = projection.status === "materialized";
  const instanceCount = materialized ? projection.runtimeNodeIds.length : 0;
  return (
    <div
      aria-label="Selected layer preview"
      className={styles.selectionOverlay}
      data-materialized={materialized ? "true" : "false"}
      data-selection-overlay="source-identity"
      role="status"
    >
      <span className={styles.selectionOverlayLabel}>Selected</span>
      <span className={styles.selectionOverlayIdentity}>
        <strong>{projection.selection.displayName}</strong>
        <code>{projection.selection.sourceNodeId}</code>
      </span>
      <span className={styles.selectionOverlayStatus}>
        {materialized
          ? instanceCount === 1
            ? "Visible in preview"
            : `${instanceCount} instances in preview`
          : "Hidden by condition"}
      </span>
    </div>
  );
}

function ManagedAdapterSurface({
  authoringModel,
  input,
  projectId,
  selection,
  surfaceId,
}: Readonly<{
  readonly authoringModel: CatalogAuthoringModel;
  readonly input: RuntimeReactLiveSurfaceInput;
  readonly projectId: string;
  readonly selection: AuthoringComponentSelection | null;
  readonly surfaceId: string;
}>) {
  const result = useRuntimeReactSurface(input);
  const renderedIdentity =
    result.status === "rendered"
      ? Object.freeze({
          surfaceId: result.surface.surfaceId,
          diagnosticIndex: result.surface.diagnosticIndex,
        })
      : undefined;
  const projection = projectAuthoringSelection(
    selection,
    Object.freeze({ projectId, surfaceId }),
    authoringModel,
    renderedIdentity,
  );

  return (
    <>
      <fieldset
        className={styles.adapterCanvasManaged}
        data-managed-capability-frame="true"
        disabled
        style={REFERENCE_WEB_TOKEN_CSS_PROPERTIES}
      >
        <legend className={styles.adapterCanvasLegend}>Sign-in adapter canvas</legend>
        <div className={styles.adapterCanvasSurface} data-managed-capability-subtree="true">
          <RuntimeReactSurfaceBoundary renderFailure={renderManagedFailure} result={result} />
        </div>
      </fieldset>
      <SelectionOverlay projection={projection} />
    </>
  );
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

/** Exact interaction-disabled React-adapter canvas for the controlled account sign-in draft. */
export interface DesenAdapterCanvasProps {
  /** Current validated authoring projection used only for Source-identity overlay admission. */
  readonly authoringModel?: CatalogAuthoringModel;
  /** Current immutable preview Bundle; omission preserves the controlled baseline fixture. */
  readonly bundle?: unknown;
  /** Exact App project route identity. */
  readonly projectId: string;
  /** Optional App-owned Source selection containing no runtime or platform authority. */
  readonly selection?: AuthoringComponentSelection | null;
  /** Exact App surface route identity. */
  readonly surfaceId: string;
}

/**
 * Mounts a validated sign-in preview Bundle through the shared public reference adapter registry.
 *
 * @remarks The App supplies no managed component tree and accepts only the exact controlled route.
 * Baseline callers may omit `bundle`; authoring callers pass a Publisher-produced session draft.
 * Other project/surface tuples fail closed without mounting or substituting the sign-in surface.
 */
export function DesenAdapterCanvas({
  authoringModel = REFERENCE_AUTHORING_MODEL,
  bundle = officialDerivedSignInBundle,
  projectId,
  selection = null,
  surfaceId,
}: DesenAdapterCanvasProps) {
  const routeIdentity = useMemo(
    () => Object.freeze({ projectId, surfaceId }),
    [projectId, surfaceId],
  );
  const [state, setState] = useState<AdapterCanvasState>();
  const supported = isSupportedRoute(routeIdentity);
  const previewRevision = readPreviewRevision(bundle);

  useEffect(() => {
    if (!supported || previewRevision === undefined) return;

    if (ADAPTER_CANVAS_REGISTRY.status !== "created") {
      setState(Object.freeze({ status: "failed", routeIdentity, previewRevision }));
      return;
    }

    const mounted = mountRuntimeHeadlessSession({
      bundle,
      catalogs: [referenceCatalog],
      hostPorts: ADAPTER_CANVAS_HOST_PORTS,
    });
    if (mounted.status !== "mounted") {
      setState(Object.freeze({ status: "failed", routeIdentity, previewRevision }));
      return;
    }

    const session = mounted.handle;
    if (
      mounted.snapshot.documentId !== EXPECTED_DOCUMENT_ID ||
      mounted.snapshot.surfaceId !== SUPPORTED_SURFACE_ID ||
      mounted.snapshot.revision !== previewRevision
    ) {
      disposeRuntimeHeadlessSession(session);
      setState(Object.freeze({ status: "failed", routeIdentity, previewRevision }));
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
      setState(Object.freeze({ status: "failed", routeIdentity, previewRevision }));
      return;
    }

    setState(Object.freeze({ status: "ready", routeIdentity, previewRevision, input }));
    return () => {
      disposeRuntimeHeadlessSession(session);
    };
  }, [bundle, previewRevision, routeIdentity, supported]);

  if (!supported) return <CanvasUnavailable />;
  if (previewRevision === undefined) return <CanvasUnavailable />;
  if (
    state === undefined ||
    state.routeIdentity !== routeIdentity ||
    state.previewRevision !== previewRevision
  ) {
    return <CanvasLoading />;
  }
  if (state.status === "failed") return <CanvasUnavailable />;

  return (
    <div className={styles.adapterCanvas}>
      <p className={styles.adapterCanvasNote}>Design preview · controls are disabled.</p>
      <div className={styles.adapterCanvasViewport}>
        <ManagedAdapterSurface
          authoringModel={authoringModel}
          input={state.input}
          projectId={projectId}
          selection={selection}
          surfaceId={surfaceId}
        />
      </div>
    </div>
  );
}
