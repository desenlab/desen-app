import { useEffect, useMemo, useRef, useState } from "react";

import { disposeRuntimeHeadlessSession, mountRuntimeHeadlessSession } from "@desen/runtime-core";
import {
  RuntimeReactSurfaceBoundary,
  renderRuntimeReactSurface,
  useRuntimeReactSurface,
} from "@desen/runtime-react";

import { projectAuthoringDiagnostics } from "./authoring-diagnostics.js";
import { projectAuthoringSelection } from "./authoring-selection.js";
import styles from "./application.module.css";

import type { RuntimeHostPorts } from "@desen/runtime-core";
import type { DesenEditorContinuousValidationReport } from "@desen/editor-core";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactLiveSurfaceInput,
  RuntimeReactSurfaceFailureRenderer,
} from "@desen/runtime-react";
import type { DesenValidatedInteractionCatalogSet } from "@desen/validator";
import type { CSSProperties, RefObject } from "react";
import type {
  AuthoringComponentSelection,
  AuthoringSelectionProjection,
} from "./authoring-selection.js";
import type { CatalogAuthoringModel } from "./authoring-data.js";
import type {
  AuthoringDiagnosticOccurrence,
  AuthoringDiagnosticsSnapshotIdentity,
  AuthoringDiagnosticView,
} from "./authoring-diagnostics.js";

interface RouteIdentity {
  readonly projectId: string;
  readonly surfaceId: string;
}

interface ReadyCanvasState {
  readonly status: "ready";
  readonly routeIdentity: RouteIdentity;
  readonly previewRevision: string;
  readonly bundle: unknown;
  readonly catalogs: DesenValidatedInteractionCatalogSet;
  readonly documentId: string;
  readonly hostPorts: RuntimeHostPorts;
  readonly registry: RuntimeReactAdapterRegistryHandle;
  readonly input: RuntimeReactLiveSurfaceInput;
}

interface FailedCanvasState {
  readonly status: "failed";
  readonly routeIdentity: RouteIdentity;
  readonly previewRevision: string;
  readonly bundle: unknown;
  readonly catalogs: DesenValidatedInteractionCatalogSet;
  readonly documentId: string;
  readonly hostPorts: RuntimeHostPorts;
  readonly registry: RuntimeReactAdapterRegistryHandle;
}

type AdapterCanvasState = ReadyCanvasState | FailedCanvasState | undefined;

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

function DiagnosticPlaceholderOverlay({
  diagnostic,
  occurrence,
  placeholderRef,
}: Readonly<{
  readonly diagnostic: AuthoringDiagnosticView;
  readonly occurrence: AuthoringDiagnosticOccurrence;
  readonly placeholderRef: RefObject<HTMLDivElement | null>;
}>) {
  const instanceCount = occurrence.runtimeNodeIds.length;
  return (
    <div
      aria-label={`Invalid change placeholder for ${occurrence.kind} ${occurrence.subjectId}`}
      className={styles.diagnosticPlaceholder}
      data-diagnostic-placeholder="source-identity"
      data-materialized={occurrence.previewStatus === "materialized" ? "true" : "false"}
      ref={placeholderRef}
      role="status"
      tabIndex={-1}
    >
      <span className={styles.diagnosticPlaceholderLabel}>Invalid change</span>
      <span className={styles.diagnosticPlaceholderIdentity}>
        <strong>{occurrence.kind === "node" ? "Component" : "Behavior"}</strong>
        <code>{occurrence.subjectId}</code>
      </span>
      <span className={styles.diagnosticPlaceholderMessage}>{diagnostic.message}</span>
      <span className={styles.diagnosticPlaceholderStatus}>
        {occurrence.previewStatus === "materialized"
          ? `Current preview preserved · ${instanceCount} matching ${instanceCount === 1 ? "instance" : "instances"}`
          : "Invalid draft is not rendered · current preview preserved"}
      </span>
    </div>
  );
}

/** Snapshot-bound rejected-candidate diagnostics shown only by App-owned Design chrome. */
export interface DesenAdapterCanvasDiagnostics {
  readonly report: DesenEditorContinuousValidationReport;
  readonly snapshot: AuthoringDiagnosticsSnapshotIdentity;
  readonly selectedSelectionKey: string | null;
  readonly focusRequestId: number;
}

function ManagedAdapterSurface({
  authoringModel,
  diagnostics,
  input,
  mode,
  projectId,
  selection,
  showDesignChrome,
  surfaceId,
  tokenCssProperties,
}: Readonly<{
  readonly authoringModel: CatalogAuthoringModel;
  readonly diagnostics: DesenAdapterCanvasDiagnostics | null;
  readonly input: RuntimeReactLiveSurfaceInput;
  readonly mode: DesenAdapterCanvasMode;
  readonly projectId: string;
  readonly selection: AuthoringComponentSelection | null;
  /** The embedding host may re-home presentation into its own durable chrome. */
  readonly showDesignChrome: boolean;
  readonly surfaceId: string;
  readonly tokenCssProperties: Readonly<Record<`--${string}`, string>>;
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
  const diagnosticsProjection =
    diagnostics === null
      ? null
      : projectAuthoringDiagnostics(
          diagnostics.report,
          diagnostics.snapshot,
          result.status === "rendered"
            ? Object.freeze({
                projectId,
                surfaceId,
                diagnosticIndex: result.surface.diagnosticIndex,
              })
            : undefined,
        );
  const selectedDiagnostic =
    diagnosticsProjection?.status === "ready" && diagnostics?.selectedSelectionKey !== null
      ? diagnosticsProjection.model.diagnostics
          .flatMap((diagnostic) =>
            diagnostic.occurrences.map((occurrence) => ({ diagnostic, occurrence })),
          )
          .find(({ occurrence }) => occurrence.selectionKey === diagnostics?.selectedSelectionKey)
      : undefined;
  const diagnosticPlaceholderRef = useRef<HTMLDivElement>(null);
  const handledFocusRequest = useRef(0);

  useEffect(() => {
    const requestId = diagnostics?.focusRequestId ?? 0;
    if (requestId <= handledFocusRequest.current) return;
    handledFocusRequest.current = requestId;
    if (showDesignChrome && mode === "design" && selectedDiagnostic !== undefined) {
      diagnosticPlaceholderRef.current?.focus({ preventScroll: true });
    }
  }, [diagnostics?.focusRequestId, mode, selectedDiagnostic, showDesignChrome]);

  return (
    <>
      <fieldset
        className={styles.adapterCanvasManaged}
        data-adapter-canvas-mode={mode}
        data-adapter-interactions={mode === "run" ? "enabled" : "disabled"}
        data-managed-capability-frame="true"
        disabled={mode === "design"}
        style={tokenCssProperties as CSSProperties}
      >
        <legend className={styles.adapterCanvasLegend}>Managed {surfaceId} canvas</legend>
        <div className={styles.adapterCanvasSurface} data-managed-capability-subtree="true">
          <RuntimeReactSurfaceBoundary renderFailure={renderManagedFailure} result={result} />
        </div>
      </fieldset>
      {showDesignChrome && mode === "design" && selectedDiagnostic !== undefined ? (
        <DiagnosticPlaceholderOverlay
          diagnostic={selectedDiagnostic.diagnostic}
          occurrence={selectedDiagnostic.occurrence}
          placeholderRef={diagnosticPlaceholderRef}
        />
      ) : showDesignChrome && mode === "design" ? (
        <SelectionOverlay projection={projection} />
      ) : null}
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

/** Closed interaction mode for the exact controlled React-adapter canvas. */
export type DesenAdapterCanvasMode = "design" | "run";

/** Exact React-adapter canvas for one explicitly composed project workspace. */
export interface DesenAdapterCanvasProps {
  /** Current validated authoring projection used only for Source-identity overlay admission. */
  readonly authoringModel: CatalogAuthoringModel;
  /** Current immutable preview Bundle admitted by the composed workspace profile. */
  readonly bundle: unknown;
  /** Complete validated Catalog set used to mount this exact Bundle. */
  readonly catalogs: DesenValidatedInteractionCatalogSet;
  /** Exact DESEN Source document identity authorized by the workspace profile. */
  readonly documentId: string;
  /** Rejected-candidate diagnostics that remain outside Runtime and persistence authority. */
  readonly diagnostics?: DesenAdapterCanvasDiagnostics | null;
  /** Interaction presentation; omission keeps the safe interaction-disabled Design default. */
  readonly mode?: DesenAdapterCanvasMode;
  /** Whether App-owned selection and diagnostic cards are rendered on the adapter frame. */
  readonly showDesignChrome?: boolean;
  /** Whether the host-owned Design/Run status is rendered directly above the exact adapter output. */
  readonly showStatus?: boolean;
  /** App-owned Runtime ports selected by trusted workspace composition. */
  readonly hostPorts: RuntimeHostPorts;
  /** Exact App project route identity. */
  readonly projectId: string;
  /** Optional App-owned Source selection containing no runtime or platform authority. */
  readonly selection?: AuthoringComponentSelection | null;
  /** Factory-authenticated executable React adapter registry selected by the host. */
  readonly registry: RuntimeReactAdapterRegistryHandle;
  /** Exact Source surface identity. */
  readonly surfaceId: string;
  /** Detached host-owned token CSS custom properties for the managed canvas boundary. */
  readonly tokenCssProperties: Readonly<Record<`--${string}`, string>>;
}

/**
 * Mounts a validated preview Bundle through explicitly composed Catalog and runtime authorities.
 *
 * @remarks The App supplies no managed component tree. Design and Run share one Bundle/session
 * lifetime; changing presentation mode cannot remount Runtime authority. Document, surface,
 * Catalog, registry, ports and token authorities are mandatory and never inferred from examples.
 */
export function DesenAdapterCanvas({
  authoringModel,
  bundle,
  catalogs,
  diagnostics = null,
  documentId,
  hostPorts,
  mode = "design",
  projectId,
  registry,
  selection = null,
  showDesignChrome = true,
  showStatus = true,
  surfaceId,
  tokenCssProperties,
}: DesenAdapterCanvasProps) {
  const routeIdentity = useMemo(
    () => Object.freeze({ projectId, surfaceId }),
    [projectId, surfaceId],
  );
  const [state, setState] = useState<AdapterCanvasState>();
  const previewRevision = readPreviewRevision(bundle);

  useEffect(() => {
    if (previewRevision === undefined) return;
    const identity = Object.freeze({
      routeIdentity,
      previewRevision,
      bundle,
      catalogs,
      documentId,
      hostPorts,
      registry,
    });

    const mounted = mountRuntimeHeadlessSession({
      bundle,
      catalogs,
      hostPorts,
    });
    if (mounted.status !== "mounted") {
      setState(Object.freeze({ status: "failed", ...identity }));
      return;
    }

    const session = mounted.handle;
    if (
      mounted.snapshot.documentId !== documentId ||
      mounted.snapshot.surfaceId !== surfaceId ||
      mounted.snapshot.revision !== previewRevision
    ) {
      disposeRuntimeHeadlessSession(session);
      setState(Object.freeze({ status: "failed", ...identity }));
      return;
    }

    const input = Object.freeze({
      registry,
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
      preflight.surface.documentId !== documentId ||
      preflight.surface.surfaceId !== surfaceId
    ) {
      disposeRuntimeHeadlessSession(session);
      setState(Object.freeze({ status: "failed", ...identity }));
      return;
    }

    setState(Object.freeze({ status: "ready", ...identity, input }));
    return () => {
      disposeRuntimeHeadlessSession(session);
    };
  }, [
    bundle,
    catalogs,
    documentId,
    hostPorts,
    previewRevision,
    registry,
    routeIdentity,
    surfaceId,
  ]);

  if (previewRevision === undefined) return <CanvasUnavailable />;
  if (
    state === undefined ||
    state.routeIdentity !== routeIdentity ||
    state.previewRevision !== previewRevision ||
    state.bundle !== bundle ||
    state.catalogs !== catalogs ||
    state.documentId !== documentId ||
    state.hostPorts !== hostPorts ||
    state.registry !== registry
  ) {
    return <CanvasLoading />;
  }
  if (state.status === "failed") return <CanvasUnavailable />;

  return (
    <div
      className={styles.adapterCanvas}
      data-adapter-canvas-mode={mode}
      data-adapter-interactions={mode === "run" ? "enabled" : "disabled"}
    >
      {showStatus ? (
        <p className={styles.adapterCanvasNote} data-adapter-canvas-status={mode}>
          {mode === "design"
            ? "Design preview · controls are disabled."
            : "Run preview · real adapter controls use the selected synthetic fixture."}
        </p>
      ) : null}
      <div className={styles.adapterCanvasViewport}>
        <ManagedAdapterSurface
          authoringModel={authoringModel}
          diagnostics={diagnostics}
          input={state.input}
          mode={mode}
          projectId={projectId}
          selection={selection}
          showDesignChrome={showDesignChrome}
          surfaceId={surfaceId}
          tokenCssProperties={tokenCssProperties}
        />
      </div>
    </div>
  );
}
