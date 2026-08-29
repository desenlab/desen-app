import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createDesenEditorContinuousValidator } from "@desen/editor-core";
import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { createRuntimeHostPorts } from "@desen/runtime-core";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";
import { projectAuthoringDiagnostics } from "./authoring-diagnostics.js";
import { DesenAdapterCanvas } from "./adapter-canvas.js";
import { createAuthoringSignInFixtureController } from "./authoring-fixtures.js";
import { createAuthoringPersistenceController } from "./authoring-persistence.js";
import { DiagnosticsPanel } from "./diagnostics-panel.js";
import {
  applyAuthoringInspectorBindingEdit,
  applyAuthoringInspectorEdit,
  prepareAuthoringInspectorModel,
} from "./authoring-inspector.js";
import {
  applyAuthoringEventActionEdit,
  createAuthoringEventOwnerSelection,
  prepareAuthoringEventActionModel,
} from "./authoring-event-actions.js";
import { applyAuthoringStateEdit, prepareAuthoringStateModel } from "./authoring-state.js";
import {
  applyAuthoringNodeDelete,
  applyAuthoringSlotEdit,
  createAuthoringSlotSelection,
  evaluateAuthoringNodeDeletion,
  evaluateAuthoringSlotInsertion,
  evaluateAuthoringSlotPlacement,
  isSameAuthoringSlotSelection,
  projectAuthoringSlotSelection,
} from "./authoring-slots.js";
import {
  createAuthoringComponentSelection,
  isSameAuthoringComponentSelection,
} from "./authoring-selection.js";
import { InspectorPanel } from "./inspector-panel.js";
import { EventActionPanel } from "./event-action-panel.js";
import {
  AUTHORING_SOURCE_SCENARIO_VALUE,
  prepareAuthoringScenarioModel,
  prepareAuthoringScenarioPreview,
} from "./authoring-scenarios.js";
import { projectPreviewFidelity } from "./preview-fidelity.js";
import { PersistenceControls } from "./persistence-controls.js";
import {
  PreviewContextDisclosure,
  RunControls,
  ScenarioPreviewControl,
} from "./preview-controls.js";
import { StatePanel } from "./state-panel.js";
import { prepareAuthoringPreviewBundle, REFERENCE_EDITOR_DOCUMENT } from "./authoring-preview.js";
import {
  createDesenAppProjectPath,
  installDesenAppNavigationGuard,
  navigateDesenApp,
  readDesenAppLocation,
  readDesenAppRoute,
  readDesenAppServerLocation,
  subscribeDesenAppNavigation,
} from "./project-navigation.js";
import { DESEN_APP_PROJECTS, findDesenAppProject, findDesenAppSurface } from "./project-data.js";
import breadcrumbSeparatorUrl from "./assets/breadcrumb-separator.svg";
import desenLogoUrl from "./assets/desen-logo.svg";
import plusUrl from "./assets/plus.svg";
import settingsUrl from "./assets/settings.svg";
import themeUrl from "./assets/theme.svg";
import styles from "./application.module.css";

import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import type {
  DesenEditorContinuousValidationReport,
  DesenEditorPersistencePort,
} from "@desen/editor-core";
import type {
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeOperationPort,
} from "@desen/runtime-core";
import type {
  AuthoringBehaviorLayer,
  AuthoringLayerNode,
  AuthoringSlotContract,
  CatalogAuthoringModel,
  CatalogComponentSummary,
} from "./authoring-data.js";
import type {
  AuthoringPersistenceController,
  AuthoringPersistenceState,
} from "./authoring-persistence.js";
import type {
  AuthoringDiagnosticsSnapshotIdentity,
  AuthoringDiagnosticsViewModelResult,
} from "./authoring-diagnostics.js";
import type {
  AuthoringEventActionEdit,
  AuthoringEventActionEditResult,
  AuthoringEventActionModelResult,
  AuthoringEventOwnerSelection,
} from "./authoring-event-actions.js";
import type {
  AuthoringInspectorBindingEdit,
  AuthoringInspectorEdit,
  AuthoringInspectorEditResult,
} from "./authoring-inspector.js";
import type {
  AuthoringStateEdit,
  AuthoringStateEditResult,
  AuthoringStateModelResult,
} from "./authoring-state.js";
import type { AuthoringComponentSelection } from "./authoring-selection.js";
import type { AuthoringScenarioValue } from "./authoring-scenarios.js";
import type {
  AuthoringSlotEdit,
  AuthoringSlotEditResult,
  AuthoringSlotProjection,
  AuthoringSlotRoute,
  AuthoringSlotSelection,
  AuthoringSlotState,
} from "./authoring-slots.js";
import type { DesenAppRoute } from "./project-navigation.js";
import type { DesenAppProjectSummary, DesenAppSurfaceSummary } from "./project-data.js";
import type {
  PersistenceControlProjection,
  PersistenceControlStatus,
} from "./persistence-controls.js";

function subscribeUnavailablePersistence(): () => void {
  return () => undefined;
}

function readUnavailablePersistence(): null {
  return null;
}

function projectPersistenceControlStatus(
  state: AuthoringPersistenceState | null,
): PersistenceControlStatus {
  if (state === null || state.disposed) return Object.freeze({ state: "unavailable" });
  if (state.pending === "opening") return Object.freeze({ state: "opening" });
  if (state.pending === "saving") return Object.freeze({ state: "saving" });
  if (state.saveResult !== null) {
    if (
      state.saveResult.status === "created" ||
      state.saveResult.status === "updated" ||
      state.saveResult.status === "unchanged"
    ) {
      return Object.freeze({ state: "success", operation: "save" });
    }
    if (state.saveResult.status === "conflict") return Object.freeze({ state: "conflict" });
    if (state.saveResult.status === "indeterminate") {
      return Object.freeze({ state: "indeterminate" });
    }
    if (state.saveResult.status === "generation-exhausted") {
      return Object.freeze({ state: "exhausted" });
    }
    return Object.freeze({ state: "failed", operation: "save" });
  }
  if (state.openResult?.status === "opened") {
    return Object.freeze({ state: "success", operation: "open" });
  }
  if (state.openResult?.status === "missing") return Object.freeze({ state: "missing" });
  if (state.openResult?.status === "failed") {
    return Object.freeze({ state: "failed", operation: "open" });
  }
  return Object.freeze({ state: "ready" });
}

function projectPersistenceControls(
  state: AuthoringPersistenceState | null,
  inMemoryDirty: boolean,
): PersistenceControlProjection {
  return Object.freeze({
    generation: state?.generation ?? null,
    dirty: state?.dirty ?? inMemoryDirty,
    reopenRequired: state?.reopenRequired ?? false,
    status: projectPersistenceControlStatus(state),
  });
}

const REFERENCE_EDITOR_DOCUMENT_CANONICAL = canonicalizeJson(REFERENCE_EDITOR_DOCUMENT);

interface AppLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly ariaCurrent?: "page" | undefined;
}

function AppLink({ href, children, className, ariaCurrent }: AppLinkProps) {
  function followLink(event: MouseEvent<HTMLAnchorElement>): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigateDesenApp(href);
  }

  return (
    <a aria-current={ariaCurrent} className={className} href={href} onClick={followLink}>
      {children}
    </a>
  );
}

function SkipToMainContentLink() {
  function moveFocusToMain(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    document.getElementById("desen-app-content")?.focus();
  }

  return (
    <a className={styles.skipLink} href="#desen-app-content" onClick={moveFocusToMain}>
      Skip to main content
    </a>
  );
}

function AppHeader({ route }: Readonly<{ readonly route: DesenAppRoute }>) {
  const projectsActive = route.kind === "projects" || route.kind === "project";
  const project = route.kind === "project" ? findDesenAppProject(route.projectId) : undefined;
  const surface =
    project === undefined || route.kind !== "project" || route.surfaceId === undefined
      ? undefined
      : findDesenAppSurface(project, route.surfaceId);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <AppLink className={styles.brand} href="/projects">
          <img alt="" height="24" src={desenLogoUrl} width="24" />
          <span className={styles.visuallyHidden}>DESEN</span>
        </AppLink>

        {project === undefined ? (
          <div className={styles.pathCluster}>
            <nav aria-label="Primary" className={styles.pathDock}>
              <span className={styles.pathMuted}>OBSS Draft</span>
              <img alt="" height="12" src={breadcrumbSeparatorUrl} width="12" />
              <AppLink
                ariaCurrent={projectsActive ? "page" : undefined}
                className={styles.pathCurrent}
                href="/projects"
              >
                Projects
              </AppLink>
            </nav>
            {route.kind === "projects" ? (
              <button
                aria-describedby="new-project-unavailable"
                aria-label="New project"
                className={styles.addButton}
                disabled
                type="button"
              >
                <img alt="" height="12" src={plusUrl} width="12" />
              </button>
            ) : null}
          </div>
        ) : (
          <nav aria-label="Breadcrumb" className={styles.pathDock}>
            <AppLink className={styles.pathMutedLink} href="/projects">
              Projects
            </AppLink>
            <img alt="" height="12" src={breadcrumbSeparatorUrl} width="12" />
            {surface === undefined ? (
              <span aria-current="page" className={styles.pathCurrent}>
                {project.name}
              </span>
            ) : (
              <>
                <AppLink
                  className={styles.pathMutedLink}
                  href={createDesenAppProjectPath(project.id)}
                >
                  {project.name}
                </AppLink>
                <img alt="" height="12" src={breadcrumbSeparatorUrl} width="12" />
                <span aria-current="page" className={styles.pathCurrent}>
                  {surface.name}
                </span>
              </>
            )}
          </nav>
        )}

        <div className={styles.utilityDock} aria-label="Workspace utilities">
          <span aria-disabled="true" aria-label="Theme" className={styles.iconTool} title="Theme">
            <img alt="" height="24" src={themeUrl} width="24" />
          </span>
          <span
            aria-disabled="true"
            aria-label="Capability catalogs"
            className={styles.iconTool}
            title="Capability catalogs · read-only authoring panel is available on resolved surfaces"
          >
            <img alt="" height="24" src={settingsUrl} width="24" />
          </span>
          <span className={styles.profileAvatar} aria-label="Selman Ay">
            SA
          </span>
        </div>
        <span className={styles.visuallyHidden} id="new-project-unavailable">
          Project creation unlocks with catalog setup.
        </span>
      </div>
    </header>
  );
}

function SurfaceState({ state }: Readonly<{ readonly state: DesenAppSurfaceSummary["state"] }>) {
  const label = state === "navigable" ? "Navigable" : "Not configured";
  const stateClass =
    state === "navigable" ? styles.statePillNavigable : styles.statePillNotConfigured;
  return <span className={`${styles.statePill} ${stateClass}`}>{label}</span>;
}

function ProjectCard({ project }: Readonly<{ readonly project: DesenAppProjectSummary }>) {
  const destination = createDesenAppProjectPath(project.id);
  return (
    <article className={styles.projectCard}>
      <div aria-hidden="true" className={styles.projectPreview}>
        <div className={styles.previewTopline}>
          <span>{project.surfaces.length} surfaces</span>
          <span>Preview data</span>
        </div>
        <div className={styles.previewDiagram}>
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className={styles.projectCardFooter}>
        <div className={styles.projectCardTitle}>
          <h3>{project.name}</h3>
          <p>{project.catalog ?? "No catalog connected"}</p>
        </div>
        <AppLink className={styles.secondaryButton} href={destination}>
          {project.surfaces.length > 0 ? "Open project" : "Review setup"}
        </AppLink>
      </div>

      {project.surfaces.length > 0 ? (
        <ul aria-label={`${project.name} surfaces`} className={styles.surfaceChips}>
          {project.surfaces.map((surface) => (
            <li key={surface.id}>
              <AppLink href={createDesenAppProjectPath(project.id, surface.id)}>
                <span>{surface.name}</span>
                <small>{surface.detail}</small>
              </AppLink>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function ProjectsHome() {
  const searchHelpId = useId();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const projects = DESEN_APP_PROJECTS.filter((project) => {
    if (normalizedQuery === "") return true;
    const searchable = [
      project.name,
      project.description,
      project.catalog ?? "",
      ...project.surfaces.flatMap((surface) => [surface.name, surface.capabilityId]),
    ]
      .join(" ")
      .toLocaleLowerCase("en-US");
    return searchable.includes(normalizedQuery);
  });

  return (
    <section className={styles.projectsHome} aria-labelledby="projects-title">
      <h1 className={styles.visuallyHidden} data-route-heading id="projects-title" tabIndex={-1}>
        Projects
      </h1>

      <div className={styles.collectionToolbar}>
        <div className={styles.collectionHeading}>
          <div>
            <h2 id="all-projects-title">All projects</h2>
            <p>Open a bounded product surface in OBSS Draft.</p>
          </div>
          <span className={styles.previewBadge}>Preview data</span>
        </div>
        <div className={styles.heroActions}>
          <label className={styles.searchField}>
            <span className={styles.visuallyHidden}>Search projects</span>
            <input
              aria-describedby={searchHelpId}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search projects"
              type="search"
              value={query}
            />
          </label>
        </div>
        <p className={styles.visuallyHidden} id={searchHelpId}>
          Results update as you type.
        </p>
      </div>

      <p className={styles.previewNotice} aria-label="Preview data boundary">
        Project names and metadata are inert examples. No Source, save, diagnostics, revision or
        publication state is being read.
      </p>

      <div className={styles.resultsHeading}>
        <p aria-live="polite" role="status">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </p>
      </div>
      {projects.length > 0 ? (
        <div className={styles.projectList}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No matches</p>
          <h3>No project matches “{query.trim()}”.</h3>
          <span>Try a project, catalog or surface name.</span>
          <button className={styles.textButton} onClick={() => setQuery("")} type="button">
            Clear search
          </button>
        </div>
      )}
    </section>
  );
}

type AuthoringTab = "layers" | "components" | "state" | "actions";
type SurfaceEditorMode = "design" | "run";

interface TransientAuthoringDiagnostics {
  readonly ownerDocumentFingerprint: string;
  readonly report: DesenEditorContinuousValidationReport;
  readonly snapshot: AuthoringDiagnosticsSnapshotIdentity;
}

interface AuthoringDiagnosticSelection {
  readonly selectionKey: string;
  readonly focusRequestId: number;
}

interface AuthoringEditDiagnosticResult {
  readonly ok: boolean;
  readonly validationReport?: DesenEditorContinuousValidationReport;
}

const LAYER_DROP_MIDPOINT_HYSTERESIS_PX = 4;

const APP_FIXTURE_EMPTY_JSON = Object.freeze({}) satisfies RuntimeJsonObject;
const APP_FIXTURE_WEB_ENVIRONMENT = Object.freeze({
  platform: "web",
}) satisfies RuntimeJsonObject;

function createAuthoringFixtureHostPorts(operationPort: RuntimeOperationPort): RuntimeHostPorts {
  return createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "denied" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "conflict" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: () => ({ status: "conflict", generation: null }),
    },
    operations: operationPort,
    resources: { load: () => ({ status: "denied" }) },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => APP_FIXTURE_EMPTY_JSON,
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => APP_FIXTURE_WEB_ENVIRONMENT,
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  } satisfies RuntimeHostPorts);
}

type AuthoringDragIntent =
  | Readonly<{ readonly kind: "component"; readonly componentId: string }>
  | Readonly<{ readonly kind: "node"; readonly nodeId: string }>;

interface AuthoringDropProjection {
  readonly index: number;
  readonly target: AuthoringSlotSelection;
}

type AuthoringDropAdmission =
  | Readonly<{ readonly status: "accepted"; readonly projection: AuthoringDropProjection }>
  | Readonly<{ readonly status: "noop"; readonly projection: AuthoringDropProjection }>
  | Readonly<{ readonly status: "rejected" }>
  | Readonly<{ readonly status: "unavailable" }>;

interface AuthoringDragSession {
  activeProjection: AuthoringDropProjection | null;
  admission: AuthoringDropAdmission["status"];
  epoch: number;
  lastAcceptedProjection: AuthoringDropProjection | null;
  ownerKey: string | null;
  pendingScroll: Readonly<{
    readonly clientX: number;
    readonly clientY: number;
    readonly delta: number;
    readonly eventTarget: Element | null;
    readonly list: HTMLUListElement;
    readonly ownerKey: string;
    readonly scrollSurface: HTMLElement;
    readonly sessionEpoch: number;
    readonly slotSurface: HTMLDivElement;
  }> | null;
  scrollFrame: number | null;
}

interface AuthoringDragSessionRef {
  current: AuthoringDragSession;
}

interface LayerSelectionProps {
  readonly activeDropProjection: AuthoringDropProjection | null;
  readonly activeSlot: AuthoringSlotSelection | null;
  readonly authoringModel: CatalogAuthoringModel;
  readonly dragIntent: AuthoringDragIntent | null;
  readonly dragSession: AuthoringDragSessionRef;
  readonly onApplyIntent: (
    target: AuthoringSlotSelection,
    index: number,
    intent: AuthoringDragIntent,
  ) => void;
  readonly onChooseSlot: (target: AuthoringSlotSelection) => void;
  readonly onClearDrag: () => void;
  readonly onProjectDrop: (projection: AuthoringDropProjection | null) => void;
  readonly onStartDrag: (intent: AuthoringDragIntent) => void;
  readonly onToggleSelection: (node: AuthoringLayerNode) => void;
  readonly route: AuthoringSlotRoute;
  readonly rootNodeId: string;
  readonly selectedSourceNodeId: string | null;
}

function declaredSlotStates(
  owner: AuthoringBehaviorLayer | AuthoringLayerNode,
): readonly AuthoringSlotState[] {
  const slotsByName = new Map(owner.slots.map((slot) => [slot.name, slot]));
  return owner.slotContracts.map((contract) => {
    const sourceSlot = slotsByName.get(contract.name);
    return Object.freeze({
      name: contract.name,
      present: sourceSlot !== undefined,
      contract,
      children: sourceSlot?.children ?? Object.freeze([]),
    });
  });
}

function slotTarget(
  route: AuthoringSlotRoute,
  owner: AuthoringBehaviorLayer | AuthoringLayerNode,
  slot: AuthoringSlotState,
): AuthoringSlotSelection {
  return createAuthoringSlotSelection({
    projectId: route.projectId,
    surfaceId: route.surfaceId,
    ownerKind: owner.kind,
    ownerId: owner.id,
    ownerCapabilityId: owner.capabilityId,
    slot: slot.name,
  });
}

function defaultAuthoringSlotSelection(
  route: AuthoringSlotRoute,
  model: CatalogAuthoringModel,
): AuthoringSlotSelection | null {
  const surface = model.surfaces.find(({ id }) => id === route.surfaceId);
  if (surface === undefined) return null;

  for (const slot of declaredSlotStates(surface.root)) {
    const target = slotTarget(route, surface.root, slot);
    const acceptsCatalogComponent = model.components.some(
      ({ id }) =>
        evaluateAuthoringSlotInsertion(route, model, target, id, slot.children.length).accepted,
    );
    if (acceptsCatalogComponent) return target;
  }

  return null;
}

function slotCardinalityLabel(slot: AuthoringSlotState): string {
  const maximum =
    slot.contract.maximum === null ? "no maximum" : `maximum ${slot.contract.maximum}`;
  return `${slot.children.length} ${slot.children.length === 1 ? "item" : "items"} · minimum ${slot.contract.minimum} · ${maximum}`;
}

function slotAcceptanceLabel(contract: AuthoringSlotContract): string {
  if (!contract.constrainsChildren) return "Any component";
  const accepted = [...contract.acceptedCategories, ...contract.acceptedCapabilityIds];
  return accepted.length === 0 ? "Accepts none" : `Accepts ${accepted.join(", ")}`;
}

function prepareNativeDrag(event: DragEvent<HTMLElement>, effect: "copy" | "move"): void {
  event.dataTransfer.effectAllowed = effect;
  // The browser payload is deliberately an inert hint. Current React state plus the latest
  // validator-admitted Source and Catalog are the only authority used when a drop is applied.
  event.dataTransfer.setData("text/plain", "DESEN App authoring item");
}

function evaluateDragIntent(
  route: AuthoringSlotRoute,
  authoringModel: CatalogAuthoringModel,
  target: AuthoringSlotSelection,
  index: number,
  dragIntent: AuthoringDragIntent,
): AuthoringDropAdmission {
  if (dragIntent.kind === "node") {
    const compatibility = evaluateAuthoringSlotPlacement(
      route,
      authoringModel,
      target,
      dragIntent.nodeId,
      index,
    );
    if (!compatibility.accepted) return Object.freeze({ status: "rejected" });
    if (!compatibility.changesSource) {
      return Object.freeze({
        status: "noop",
        projection: Object.freeze({ index, target }),
      });
    }
    return Object.freeze({
      status: "accepted",
      projection: Object.freeze({ index, target }),
    });
  }

  const component = authoringModel.components.find(({ id }) => id === dragIntent.componentId);
  if (
    component === undefined ||
    !evaluateAuthoringSlotInsertion(route, authoringModel, target, component.id, index).accepted
  ) {
    return Object.freeze({ status: "rejected" });
  }
  return Object.freeze({
    status: "accepted",
    projection: Object.freeze({ index, target }),
  });
}

function requestAuthoringFrame(callback: FrameRequestCallback): number {
  return typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(() => callback(Date.now()), 16);
}

function cancelAuthoringFrame(frame: number): void {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(frame);
    return;
  }
  window.clearTimeout(frame);
}

function createAuthoringDragSession(epoch = 0): AuthoringDragSession {
  return {
    activeProjection: null,
    admission: "unavailable",
    epoch,
    lastAcceptedProjection: null,
    ownerKey: null,
    pendingScroll: null,
    scrollFrame: null,
  };
}

function SlotBoundary({
  index,
  owner,
  slot,
  activeSlot,
  authoringModel,
  dropHovered,
  dragIntent,
  onApplyIntent,
  route,
  rootNodeId,
  selectedSourceNodeId,
}: Readonly<
  Pick<
    LayerSelectionProps,
    | "activeSlot"
    | "authoringModel"
    | "dragIntent"
    | "onApplyIntent"
    | "route"
    | "rootNodeId"
    | "selectedSourceNodeId"
  > & {
    readonly index: number;
    readonly owner: AuthoringBehaviorLayer | AuthoringLayerNode;
    readonly slot: AuthoringSlotState;
    readonly dropHovered: boolean;
  }
>) {
  const target = slotTarget(route, owner, slot);
  const selectedPlacement =
    selectedSourceNodeId === null || selectedSourceNodeId === rootNodeId
      ? null
      : evaluateAuthoringSlotPlacement(route, authoringModel, target, selectedSourceNodeId, index);
  const selectedMovable =
    selectedPlacement?.accepted === true && selectedPlacement.changesSource === true;
  const dragAdmission =
    dragIntent === null
      ? null
      : evaluateDragIntent(route, authoringModel, target, index, dragIntent);
  const dropReady = dragAdmission?.status === "accepted";

  const active = activeSlot !== null && isSameAuthoringSlotSelection(activeSlot, target);
  const position = index + 1;
  const selectedPosition =
    selectedPlacement?.accepted === true ? selectedPlacement.finalIndex + 1 : position;
  const placementLabel =
    selectedPlacement?.accepted === true && !selectedPlacement.changesSource
      ? `Keep ${selectedSourceNodeId ?? "selected layer"} at its current position ${selectedPosition} in ${owner.displayName} ${owner.id} ${slot.name} slot`
      : `Move ${selectedSourceNodeId ?? "selected layer"} to ${owner.displayName} ${owner.id} ${slot.name} slot at position ${selectedPosition}`;

  return (
    <li
      aria-label={`${owner.displayName} ${owner.id} ${slot.name} slot insertion boundary at position ${position}`}
      className={styles.slotBoundary}
      data-active-slot={active}
      data-drop-hovered={dropReady && dropHovered}
      data-drop-noop={dragAdmission?.status === "noop"}
      data-drop-noop-hovered={dragAdmission?.status === "noop" && dropHovered}
      data-drop-ready={dropReady}
      data-slot-boundary-index={index}
    >
      <span aria-hidden="true" className={styles.slotBoundaryLine} />
      <span aria-hidden="true" className={styles.slotBoundaryCue}>
        {dragAdmission?.status === "noop" ? "Current position" : "Drop here"}
      </span>
      <button
        aria-label={placementLabel}
        disabled={!selectedMovable}
        onClick={() => {
          if (selectedSourceNodeId === null) return;
          onApplyIntent(target, index, { kind: "node", nodeId: selectedSourceNodeId });
        }}
        type="button"
      >
        Place
      </button>
    </li>
  );
}

function LayerSlot({
  owner,
  slot,
  ...interaction
}: Readonly<
  LayerSelectionProps & {
    readonly owner: AuthoringBehaviorLayer | AuthoringLayerNode;
    readonly slot: AuthoringSlotState;
  }
>) {
  const target = slotTarget(interaction.route, owner, slot);
  const active =
    interaction.activeSlot !== null && isSameAuthoringSlotSelection(interaction.activeSlot, target);
  const contractLabel = `${slot.contract.required ? "Required" : "Optional"} · ${slot.present ? "Present" : "Absent"} · ${slotCardinalityLabel(slot)} · ${slotAcceptanceLabel(slot.contract)}`;
  const listRef = useRef<HTMLUListElement>(null);
  const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot]);
  const activeDropIndex =
    interaction.activeDropProjection !== null &&
    isSameAuthoringSlotSelection(interaction.activeDropProjection.target, target)
      ? interaction.activeDropProjection.index
      : null;

  function publishAdmission(admission: AuthoringDropAdmission): void {
    const session = interaction.dragSession.current;
    if (session.ownerKey !== sessionOwnerKey && session.scrollFrame !== null) {
      cancelAuthoringFrame(session.scrollFrame);
      session.scrollFrame = null;
      session.pendingScroll = null;
    }
    if (session.ownerKey !== sessionOwnerKey) session.lastAcceptedProjection = null;
    session.ownerKey = sessionOwnerKey;
    session.admission = admission.status;
    if (admission.status === "accepted" || admission.status === "noop") {
      session.activeProjection = admission.projection;
      if (admission.status === "accepted") {
        session.lastAcceptedProjection = admission.projection;
      }
      interaction.onProjectDrop(admission.projection);
      return;
    }
    session.activeProjection = null;
    if (admission.status === "rejected" || admission.status === "unavailable") {
      session.lastAcceptedProjection = null;
    }
    interaction.onProjectDrop(null);
  }

  function projectNearestDrop(
    list: HTMLUListElement,
    clientY: number,
    eventTarget: EventTarget | null,
  ): AuthoringDropAdmission {
    if (interaction.dragIntent === null) return Object.freeze({ status: "unavailable" });

    const rows = Array.from(list.children).flatMap((child) => {
      if (!(child instanceof HTMLElement) || child.dataset.layerNode !== "true") return [];
      const row = child.querySelector<HTMLElement>("[data-layer-drop-row-node-id]");
      return row instanceof HTMLElement ? [row] : [];
    });
    let index: number;
    const eventElement = eventTarget instanceof Element ? eventTarget : null;
    const exactBoundary = eventElement?.closest<HTMLElement>("[data-slot-boundary-index]");
    if (exactBoundary?.parentElement === list) {
      index = Number(exactBoundary.dataset.slotBoundaryIndex);
      if (!Number.isInteger(index) || index < 0 || index > rows.length) {
        return Object.freeze({ status: "unavailable" });
      }
    } else if (!Number.isFinite(clientY)) {
      return Object.freeze({ status: "unavailable" });
    } else {
      const hoveredRowIndex =
        eventTarget instanceof Node ? rows.findIndex((row) => row.contains(eventTarget)) : -1;
      if (hoveredRowIndex >= 0) {
        const hoveredBounds = rows[hoveredRowIndex]?.getBoundingClientRect();
        const midpoint =
          hoveredBounds === undefined ? clientY : hoveredBounds.top + hoveredBounds.height / 2;
        const session = interaction.dragSession.current;
        const previousProjection =
          session.ownerKey === sessionOwnerKey ? session.activeProjection : null;
        const previousIndex =
          previousProjection !== null &&
          isSameAuthoringSlotSelection(previousProjection.target, target)
            ? previousProjection.index
            : undefined;
        index =
          previousIndex !== undefined &&
          Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX &&
          (previousIndex === hoveredRowIndex || previousIndex === hoveredRowIndex + 1)
            ? previousIndex
            : clientY < midpoint
              ? hoveredRowIndex
              : hoveredRowIndex + 1;
      } else {
        index = rows.length;
        for (const [rowIndex, row] of rows.entries()) {
          const bounds = row.getBoundingClientRect();
          if (clientY < bounds.top + bounds.height / 2) {
            index = rowIndex;
            break;
          }
        }
      }
    }

    return evaluateDragIntent(
      interaction.route,
      interaction.authoringModel,
      target,
      index,
      interaction.dragIntent,
    );
  }

  function scheduleEdgeScroll(event: DragEvent<HTMLDivElement>, list: HTMLUListElement): void {
    const scrollSurface = event.currentTarget.closest<HTMLElement>('[role="tabpanel"]');
    if (scrollSurface === null) return;
    const scrollBounds = scrollSurface.getBoundingClientRect();
    const edge = 32;
    const delta =
      event.clientY < scrollBounds.top + edge
        ? -12
        : event.clientY > scrollBounds.bottom - edge
          ? 12
          : 0;
    const session = interaction.dragSession.current;
    session.pendingScroll = Object.freeze({
      clientX: event.clientX,
      clientY: event.clientY,
      delta,
      eventTarget: event.target instanceof Element ? event.target : null,
      list,
      ownerKey: sessionOwnerKey,
      scrollSurface,
      sessionEpoch: session.epoch,
      slotSurface: event.currentTarget,
    });
    if (delta === 0) {
      if (session.scrollFrame !== null) cancelAuthoringFrame(session.scrollFrame);
      session.scrollFrame = null;
      session.pendingScroll = null;
      return;
    }
    if (session.scrollFrame !== null) return;

    function scrollStep(): void {
      const currentSession = interaction.dragSession.current;
      currentSession.scrollFrame = null;
      const pending = currentSession.pendingScroll;
      if (
        pending === null ||
        pending.delta === 0 ||
        pending.sessionEpoch !== currentSession.epoch ||
        pending.ownerKey !== currentSession.ownerKey
      ) {
        return;
      }
      if (
        !pending.list.isConnected ||
        !pending.slotSurface.isConnected ||
        !pending.scrollSurface.isConnected
      ) {
        publishAdmission(Object.freeze({ status: "unavailable" }));
        currentSession.pendingScroll = null;
        return;
      }
      const before = pending.scrollSurface.scrollTop;
      pending.scrollSurface.scrollTop += pending.delta;
      if (pending.scrollSurface.scrollTop === before) {
        currentSession.pendingScroll = null;
        return;
      }
      const hitTarget =
        typeof document.elementFromPoint === "function"
          ? document.elementFromPoint(pending.clientX, pending.clientY)
          : null;
      const hitSlotSurface = hitTarget?.closest<HTMLDivElement>('[data-layer-slot-surface="true"]');
      if (hitTarget !== null && hitSlotSurface !== pending.slotSurface) {
        publishAdmission(Object.freeze({ status: "unavailable" }));
        currentSession.pendingScroll = null;
        return;
      }
      const admission = projectNearestDrop(
        pending.list,
        pending.clientY,
        hitTarget ?? pending.eventTarget,
      );
      publishAdmission(admission);
      const nextSession = interaction.dragSession.current;
      if (
        nextSession.epoch === pending.sessionEpoch &&
        nextSession.ownerKey === pending.ownerKey &&
        nextSession.pendingScroll !== null
      ) {
        nextSession.scrollFrame = requestAuthoringFrame(scrollStep);
      }
    }

    session.scrollFrame = requestAuthoringFrame(scrollStep);
  }

  function updateDropProjection(event: DragEvent<HTMLDivElement>): void {
    if (interaction.dragIntent === null) return;
    const list = listRef.current;
    if (list === null) return;
    // The innermost named slot owns the pointer. A rejected nested slot must never bubble into an
    // outer owner and silently turn the same coordinates into a different placement target.
    event.stopPropagation();
    const admission = projectNearestDrop(list, event.clientY, event.target);
    if (admission.status === "rejected" || admission.status === "unavailable") {
      publishAdmission(admission);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect =
      admission.status === "noop"
        ? "none"
        : interaction.dragIntent.kind === "component"
          ? "copy"
          : "move";
    publishAdmission(admission);
    scheduleEdgeScroll(event, list);
  }

  function receiveDrop(event: DragEvent<HTMLDivElement>): void {
    if (interaction.dragIntent === null) return;
    const list = listRef.current;
    if (list === null) return;
    event.stopPropagation();
    const currentBounds = event.currentTarget.getBoundingClientRect();
    const hasCurrentCoordinates =
      Number.isFinite(event.clientY) &&
      event.clientY >= currentBounds.top &&
      event.clientY <= currentBounds.bottom &&
      currentBounds.height > 0;
    const releaseAdmission = hasCurrentCoordinates
      ? projectNearestDrop(list, event.clientY, event.target)
      : Object.freeze({ status: "unavailable" } as const);
    const projection =
      releaseAdmission.status === "accepted"
        ? releaseAdmission.projection
        : (releaseAdmission.status === "unavailable" || releaseAdmission.status === "rejected") &&
            interaction.dragSession.current.ownerKey === sessionOwnerKey &&
            interaction.dragSession.current.admission === "accepted"
          ? interaction.dragSession.current.lastAcceptedProjection
          : null;
    if (releaseAdmission.status === "noop") {
      event.preventDefault();
      publishAdmission(releaseAdmission);
      interaction.onClearDrag();
      return;
    }
    if (projection === null) return;
    event.preventDefault();
    interaction.onProjectDrop(null);
    interaction.onApplyIntent(projection.target, projection.index, interaction.dragIntent);
  }

  return (
    <div
      className={styles.layerSlot}
      data-layer-slot-surface="true"
      data-present={slot.present}
      onDragEnter={updateDropProjection}
      onDragOver={updateDropProjection}
      onDrop={receiveDrop}
    >
      <button
        aria-label={`Choose ${owner.displayName} ${owner.id} ${slot.name} slot · ${contractLabel}`}
        aria-pressed={active}
        className={styles.slotRow}
        onClick={() => interaction.onChooseSlot(target)}
        type="button"
      >
        <span aria-hidden="true" className={styles.slotGuide} />
        <span>
          <strong>{slot.name} slot</strong>
          <small>
            {slot.contract.required ? "Required" : "Optional"} ·{" "}
            {slot.present ? "Present" : "Absent"}
            {" · "}
            {slotCardinalityLabel(slot)} · {slotAcceptanceLabel(slot.contract)}
          </small>
        </span>
        <span aria-hidden="true" className={styles.slotAddMark}>
          +
        </span>
      </button>
      <ul data-layer-slot-list="true" ref={listRef}>
        <SlotBoundary
          dropHovered={activeDropIndex === 0}
          index={0}
          owner={owner}
          slot={slot}
          {...interaction}
        />
        {slot.children.map((child, index) => (
          <Fragment key={child.id}>
            <LayerNode node={child} movable {...interaction} />
            <SlotBoundary
              dropHovered={activeDropIndex === index + 1}
              index={index + 1}
              owner={owner}
              slot={slot}
              {...interaction}
            />
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

function LayerNode({
  activeDropProjection,
  activeSlot,
  authoringModel,
  dragIntent,
  dragSession,
  movable = false,
  node,
  onApplyIntent,
  onChooseSlot,
  onClearDrag,
  onProjectDrop,
  onStartDrag,
  onToggleSelection,
  route,
  rootNodeId,
  selectedSourceNodeId,
}: Readonly<
  LayerSelectionProps & {
    readonly movable?: boolean;
    readonly node: AuthoringLayerNode;
  }
>) {
  const selected = selectedSourceNodeId === node.id;
  const interaction = {
    activeDropProjection,
    activeSlot,
    authoringModel,
    dragIntent,
    dragSession,
    onApplyIntent,
    onChooseSlot,
    onClearDrag,
    onProjectDrop,
    onStartDrag,
    onToggleSelection,
    route,
    rootNodeId,
    selectedSourceNodeId,
  } satisfies LayerSelectionProps;

  return (
    <li className={styles.layerNode} data-layer-node="true">
      <div
        className={styles.layerRow}
        data-category={node.capabilityId.split("/").at(-1)}
        data-dragging={dragIntent?.kind === "node" && dragIntent.nodeId === node.id}
        data-layer-drop-row-node-id={node.id}
        data-selected={selected}
      >
        {movable ? (
          <span
            aria-hidden="true"
            className={styles.layerDragHandle}
            data-layer-drag-handle="true"
            draggable
            onDragEnd={onClearDrag}
            onDragStart={(event) => {
              prepareNativeDrag(event, "move");
              onStartDrag(Object.freeze({ kind: "node", nodeId: node.id }));
            }}
            title={`Drag ${node.displayName} layer`}
          />
        ) : null}
        <button
          aria-label={`${selected ? "Deselect" : "Select"} ${node.displayName} layer · ${node.id}${node.conditional ? " · Conditional" : ""}`}
          aria-pressed={selected}
          className={styles.layerSelectAction}
          data-layer-source-node-id={node.id}
          onClick={() => onToggleSelection(node)}
          type="button"
        >
          <span aria-hidden="true" className={styles.layerGlyph} />
          <span className={styles.layerIdentity}>
            <strong>{node.displayName}</strong>
            <small>{node.id}</small>
          </span>
          {node.conditional ? <span className={styles.conditionalBadge}>Conditional</span> : null}
        </button>
      </div>
      {node.behaviors.length > 0 ? (
        <ul aria-label={`${node.id} behaviors`} className={styles.behaviorList}>
          {node.behaviors.map((behavior) => (
            <BehaviorNode behavior={behavior} key={behavior.id} {...interaction} />
          ))}
        </ul>
      ) : null}
      {declaredSlotStates(node).map((slot) => (
        <LayerSlot key={slot.name} owner={node} slot={slot} {...interaction} />
      ))}
    </li>
  );
}

function BehaviorNode({
  activeDropProjection,
  activeSlot,
  authoringModel,
  behavior,
  dragIntent,
  dragSession,
  onApplyIntent,
  onChooseSlot,
  onClearDrag,
  onProjectDrop,
  onStartDrag,
  onToggleSelection,
  route,
  rootNodeId,
  selectedSourceNodeId,
}: Readonly<LayerSelectionProps & { readonly behavior: AuthoringBehaviorLayer }>) {
  const interaction = {
    activeDropProjection,
    activeSlot,
    authoringModel,
    dragIntent,
    dragSession,
    onApplyIntent,
    onChooseSlot,
    onClearDrag,
    onProjectDrop,
    onStartDrag,
    onToggleSelection,
    route,
    rootNodeId,
    selectedSourceNodeId,
  } satisfies LayerSelectionProps;
  return (
    <li className={styles.behaviorNode}>
      <div className={styles.layerRow} data-category="Behavior">
        <span aria-hidden="true" className={styles.behaviorGlyph} />
        <span className={styles.layerIdentity}>
          <strong>{behavior.displayName}</strong>
          <small>{behavior.id}</small>
        </span>
        <span className={styles.behaviorBadge}>behavior</span>
        {behavior.conditional ? <span className={styles.conditionalBadge}>Conditional</span> : null}
      </div>
      {declaredSlotStates(behavior).map((slot) => (
        <LayerSlot key={slot.name} owner={behavior} slot={slot} {...interaction} />
      ))}
    </li>
  );
}

function LayerTree({
  model,
  selectedSurface,
  ...interaction
}: Readonly<
  LayerSelectionProps & {
    readonly model: CatalogAuthoringModel;
    readonly selectedSurface: DesenAppSurfaceSummary;
  }
>) {
  const surfaceTree = model.surfaces.find((surface) => surface.id === selectedSurface.id);
  if (surfaceTree === undefined) {
    return (
      <div className={styles.panelEmptyState}>
        <span className={styles.emptyGlyph} aria-hidden="true" />
        <strong>No Source tree for {selectedSurface.name}</strong>
        <p>
          This preview surface has no exact Source fixture. DESEN will not substitute the sign-in
          tree.
        </p>
      </div>
    );
  }

  function clearUnclaimedDrop(): void {
    const session = interaction.dragSession.current;
    if (session.scrollFrame !== null) cancelAuthoringFrame(session.scrollFrame);
    session.activeProjection = null;
    session.admission = "rejected";
    session.lastAcceptedProjection = null;
    session.ownerKey = null;
    session.pendingScroll = null;
    session.scrollFrame = null;
    interaction.onProjectDrop(null);
  }

  return (
    <div className={styles.layersView}>
      <div className={styles.panelSectionHeading}>
        <span>Surface</span>
        <small>Session draft</small>
      </div>
      <div className={styles.surfaceSummary}>
        <span aria-hidden="true" className={styles.surfaceGlyph} />
        <span>
          <strong>{selectedSurface.name}</strong>
          <small>{surfaceTree.id}</small>
        </span>
      </div>
      <div className={styles.panelSectionHeading}>
        <span>DESEN node / slot tree</span>
      </div>
      <p
        aria-live="polite"
        className={styles.layerDragGuide}
        data-active={interaction.dragIntent?.kind === "node"}
      >
        {interaction.dragIntent?.kind === "node"
          ? `Moving ${interaction.dragIntent.nodeId} · release on a highlighted gap.`
          : "Drag a layer to reorder it, or select it and use Place."}
      </p>
      <section
        aria-label={`${selectedSurface.name} layer hierarchy`}
        data-drag-active={interaction.dragIntent?.kind === "node"}
        onDragEnter={(event) => {
          if (interaction.dragIntent !== null && !event.defaultPrevented) {
            clearUnclaimedDrop();
          }
        }}
        onDragLeave={(event) => {
          if (interaction.dragIntent === null) return;
          if (event.relatedTarget instanceof Node) {
            if (event.currentTarget.contains(event.relatedTarget)) return;
            clearUnclaimedDrop();
            return;
          }
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            Number.isFinite(event.clientX) &&
            Number.isFinite(event.clientY) &&
            event.clientX >= bounds.left &&
            event.clientX <= bounds.right &&
            event.clientY >= bounds.top &&
            event.clientY <= bounds.bottom
          ) {
            return;
          }
          clearUnclaimedDrop();
        }}
        onDragOver={(event) => {
          if (interaction.dragIntent !== null && !event.defaultPrevented) {
            clearUnclaimedDrop();
          }
        }}
      >
        <ul className={styles.layerTree}>
          <LayerNode node={surfaceTree.root} {...interaction} />
        </ul>
      </section>
    </div>
  );
}

function groupComponents(
  components: readonly CatalogComponentSummary[],
): readonly (readonly [string, readonly CatalogComponentSummary[]])[] {
  const groups = new Map<string, CatalogComponentSummary[]>();
  for (const component of components) {
    const items = groups.get(component.authoringCategory) ?? [];
    items.push(component);
    groups.set(component.authoringCategory, items);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([category, items]) => [category, Object.freeze(items)] as const);
}

const COMPONENT_PALETTE_RENDER_LIMIT = 24;

function ComponentLibrary({
  active,
  dragIntent,
  model,
  onApplyIntent,
  onClearDrag,
  onRequestSlotChoice,
  onStartDrag,
  route,
  slotProjection,
}: Readonly<{
  readonly active: boolean;
  readonly dragIntent: AuthoringDragIntent | null;
  readonly model: CatalogAuthoringModel;
  readonly onApplyIntent: (
    target: AuthoringSlotSelection,
    index: number,
    intent: AuthoringDragIntent,
  ) => void;
  readonly onClearDrag: () => void;
  readonly onRequestSlotChoice: () => void;
  readonly onStartDrag: (intent: AuthoringDragIntent) => void;
  readonly route: AuthoringSlotRoute;
  readonly slotProjection: AuthoringSlotProjection | null;
}>) {
  const [query, setQuery] = useState("");
  const [panelDragHovered, setPanelDragHovered] = useState(false);
  const panelDragEnterDepth = useRef(0);

  useEffect(() => {
    panelDragEnterDepth.current = 0;
    setPanelDragHovered(false);
  }, [dragIntent]);

  if (!active) return null;
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const components = model.components.filter((component) => {
    if (normalizedQuery === "") return true;
    return [component.displayName, component.id, component.authoringCategory, component.description]
      .join(" ")
      .toLocaleLowerCase("en-US")
      .includes(normalizedQuery);
  });
  const visibleComponents = components.slice(0, COMPONENT_PALETTE_RENDER_LIMIT);
  const groups = groupComponents(visibleComponents);
  const readySlot = slotProjection?.status === "ready" ? slotProjection : null;
  const draggedComponent =
    dragIntent?.kind === "component"
      ? model.components.find(({ id }) => id === dragIntent.componentId)
      : undefined;
  const draggedComponentAccepted =
    readySlot !== null &&
    draggedComponent !== undefined &&
    evaluateAuthoringSlotInsertion(
      route,
      model,
      readySlot.selection,
      draggedComponent.id,
      readySlot.slot.children.length,
    ).accepted;
  const componentDropReady = dragIntent?.kind === "component" && draggedComponentAccepted;

  function addComponent(componentId: string): void {
    if (readySlot === null) return;
    onApplyIntent(readySlot.selection, readySlot.slot.children.length, {
      kind: "component",
      componentId,
    });
  }

  function admitComponentDrop(event: DragEvent<HTMLDivElement>): void {
    if (!componentDropReady) return;
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setPanelDragHovered(true);
  }

  function receiveComponentDrop(event: DragEvent<HTMLDivElement>): void {
    if (!componentDropReady || dragIntent?.kind !== "component") return;
    event.stopPropagation();
    event.preventDefault();
    panelDragEnterDepth.current = 0;
    setPanelDragHovered(false);
    addComponent(dragIntent.componentId);
  }

  const targetName =
    readySlot === null
      ? "Placement target · choose a named slot"
      : `Placement target · ${readySlot.owner.displayName} ${readySlot.owner.id} ${readySlot.slot.name} slot · ${slotCardinalityLabel(readySlot.slot)}`;

  return (
    <div
      className={styles.componentsView}
      data-component-drag-active={dragIntent?.kind === "component"}
      data-drop-hovered={componentDropReady && panelDragHovered}
      onDragEnter={(event) => {
        if (!componentDropReady) return;
        admitComponentDrop(event);
        panelDragEnterDepth.current += 1;
      }}
      onDragLeave={() => {
        if (!componentDropReady) return;
        panelDragEnterDepth.current = Math.max(0, panelDragEnterDepth.current - 1);
        if (panelDragEnterDepth.current === 0) setPanelDragHovered(false);
      }}
      onDragOver={admitComponentDrop}
      onDrop={receiveComponentDrop}
    >
      <div className={styles.catalogSummary}>
        <span>
          <strong>{model.catalog.target}</strong>
          <small>{model.catalog.id}</small>
        </span>
        <span className={styles.versionBadge}>v{model.catalog.version}</span>
      </div>
      <label className={styles.componentSearch}>
        <span className={styles.visuallyHidden}>Search catalog components</span>
        <span aria-hidden="true" className={styles.searchGlyph} />
        <input
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search components"
          type="search"
          value={query}
        />
      </label>
      <p aria-live="polite" className={styles.componentCount} role="status">
        {visibleComponents.length === components.length
          ? `${components.length} of ${model.components.length} components`
          : `Showing ${visibleComponents.length} of ${components.length} matches · ${model.components.length} components total`}
      </p>

      <div
        aria-label={targetName}
        className={styles.componentSlotTarget}
        data-drag-active={dragIntent?.kind === "component"}
        data-drop-hovered={componentDropReady && panelDragHovered}
        data-drop-ready={componentDropReady}
        data-guide={readySlot === null}
        data-ready={readySlot !== null}
        role="group"
      >
        {readySlot === null ? (
          <>
            <span className={styles.componentTargetCopy}>
              <strong>No drop target selected</strong>
              <span>Choose a named slot in Layers before placing a component.</span>
            </span>
            <button
              className={styles.componentTargetAction}
              onClick={onRequestSlotChoice}
              type="button"
            >
              Choose slot in Layers
            </button>
          </>
        ) : (
          <>
            <span aria-hidden="true" className={styles.componentDropGlyph} />
            <span className={styles.componentTargetCopy}>
              <span className={styles.componentTargetEyebrow}>
                {draggedComponent === undefined
                  ? "Add to"
                  : `Drop ${draggedComponent.displayName} here`}
              </span>
              <strong>
                {draggedComponent === undefined
                  ? `${readySlot.owner.displayName} · ${readySlot.slot.name}`
                  : `${readySlot.owner.displayName} · ${readySlot.slot.name}`}
              </strong>
              <small>
                {readySlot.owner.id} · {readySlot.slot.name} slot
                {draggedComponent === undefined
                  ? ` · appends at position ${readySlot.slot.children.length + 1} · click Add or drag a component into this panel`
                  : ` · release anywhere in this panel to append at position ${readySlot.slot.children.length + 1}`}
              </small>
            </span>
            <span className={styles.componentTargetControls}>
              <span className={styles.slotContractBadge}>
                {readySlot.slot.children.length}{" "}
                {readySlot.slot.children.length === 1 ? "item" : "items"}
              </span>
              <button
                aria-label="Change target in Layers"
                className={styles.componentTargetAction}
                onClick={onRequestSlotChoice}
                type="button"
              >
                Change target
              </button>
            </span>
          </>
        )}
      </div>

      {groups.length > 0 ? (
        <div className={styles.componentGroups}>
          {groups.map(([category, items]) => (
            <section aria-labelledby={`component-category-${category}`} key={category}>
              <h3 id={`component-category-${category}`}>{category}</h3>
              <ul>
                {items.map((component) => (
                  <li key={component.id}>
                    {(() => {
                      const compatibility =
                        readySlot === null
                          ? null
                          : evaluateAuthoringSlotInsertion(
                              route,
                              model,
                              readySlot.selection,
                              component.id,
                              readySlot.slot.children.length,
                            );
                      const enabled = compatibility?.accepted === true;
                      const action =
                        readySlot === null
                          ? "Choose slot"
                          : enabled
                            ? "Insert"
                            : compatibility?.reason === "maximum-reached"
                              ? "Slot full"
                              : compatibility?.reason === "minimum-unreachable"
                                ? "Needs batch insert"
                                : compatibility?.reason === "component-template-unavailable"
                                  ? "Needs template"
                                  : compatibility?.reason === "default-profile-exceeded"
                                    ? "Defaults too large"
                                    : compatibility?.reason === "defaults-invalid"
                                      ? "Invalid defaults"
                                      : "Not accepted";
                      const insertLabel =
                        readySlot === null
                          ? `${component.displayName} · choose a named slot first`
                          : enabled
                            ? `Insert ${component.displayName} into ${readySlot.owner.displayName} ${readySlot.owner.id} ${readySlot.slot.name} slot at position ${readySlot.slot.children.length + 1}`
                            : `${action} · ${component.displayName} in ${readySlot.owner.displayName} ${readySlot.owner.id} ${readySlot.slot.name} slot`;
                      return (
                        <div
                          aria-label={`${component.displayName} component${enabled && readySlot !== null ? ` · drag to ${readySlot.owner.displayName} ${readySlot.owner.id} ${readySlot.slot.name} slot or use Add` : ` · ${action}`}`}
                          className={styles.componentItem}
                          data-component-card="true"
                          data-dragging={
                            dragIntent?.kind === "component" &&
                            dragIntent.componentId === component.id
                          }
                          data-enabled={enabled}
                          role="group"
                        >
                          <span
                            aria-hidden="true"
                            className={styles.componentGlyph}
                            data-category={component.semanticCategory}
                          >
                            {component.displayName.slice(0, 1)}
                          </span>
                          <span className={styles.componentIdentity}>
                            <strong>{component.displayName}</strong>
                            {component.description === undefined ? null : (
                              <small>{component.description}</small>
                            )}
                          </span>
                          <span className={styles.componentItemAction}>
                            {enabled ? (
                              <span
                                aria-hidden="true"
                                className={styles.componentDragHandle}
                                data-component-drag-handle="true"
                                draggable
                                onDragEnd={onClearDrag}
                                onDragStart={(event) => {
                                  prepareNativeDrag(event, "copy");
                                  onStartDrag(
                                    Object.freeze({
                                      kind: "component",
                                      componentId: component.id,
                                    }),
                                  );
                                }}
                                title={`Drag ${component.displayName} anywhere in this panel to add`}
                              />
                            ) : null}
                            <button
                              aria-label={insertLabel}
                              className={styles.componentAddAction}
                              disabled={!enabled}
                              draggable={false}
                              onClick={() => addComponent(component.id)}
                              onDragStart={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                              type="button"
                            >
                              {enabled ? "Add" : action}
                            </button>
                          </span>
                        </div>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.componentEmpty}>
          <strong>No catalog matches</strong>
          <span>Try a component, category, or contract ID.</span>
          <button onClick={() => setQuery("")} type="button">
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}

function AuthoringPanel({
  eventActionModel,
  hidden,
  interactive,
  model,
  onDeleteSelection,
  onEventActionEdit,
  onSlotEdit,
  onStateEdit,
  onToggleSelection,
  route,
  selection,
  selectedSourceNodeId,
  selectedSurface,
  stateModel,
}: Readonly<{
  readonly eventActionModel: AuthoringEventActionModelResult;
  readonly hidden: boolean;
  readonly interactive: boolean;
  readonly model: CatalogAuthoringModel;
  readonly onDeleteSelection: () => AuthoringSlotEditResult;
  readonly onEventActionEdit: (edit: AuthoringEventActionEdit) => AuthoringEventActionEditResult;
  readonly onSlotEdit: (
    target: AuthoringSlotSelection,
    edit: AuthoringSlotEdit,
  ) => AuthoringSlotEditResult;
  readonly onStateEdit: (edit: AuthoringStateEdit) => AuthoringStateEditResult;
  readonly onToggleSelection: (node: AuthoringLayerNode) => void;
  readonly route: AuthoringSlotRoute;
  readonly selection: AuthoringComponentSelection | null;
  readonly selectedSourceNodeId: string | null;
  readonly selectedSurface: DesenAppSurfaceSummary;
  readonly stateModel: AuthoringStateModelResult;
}>) {
  const [activeTab, setActiveTab] = useState<AuthoringTab>("layers");
  const [activeSlot, setActiveSlot] = useState<AuthoringSlotSelection | null>(null);
  const [activeDropProjection, setActiveDropProjection] = useState<AuthoringDropProjection | null>(
    null,
  );
  const [dragIntent, setDragIntent] = useState<AuthoringDragIntent | null>(null);
  const [notice, setNotice] = useState("");
  const panelId = useId();
  const layersTab = useRef<HTMLButtonElement>(null);
  const componentsTab = useRef<HTMLButtonElement>(null);
  const stateTab = useRef<HTMLButtonElement>(null);
  const actionsTab = useRef<HTMLButtonElement>(null);
  const authoringPanel = useRef<HTMLElement>(null);
  const pendingLayerFocus = useRef<string | null>(null);
  const dragSession = useRef<AuthoringDragSession>(createAuthoringDragSession());
  const resetDragSession = useCallback(() => {
    const current = dragSession.current;
    if (current.scrollFrame !== null) cancelAuthoringFrame(current.scrollFrame);
    dragSession.current = createAuthoringDragSession(current.epoch + 1);
  }, []);
  const defaultSlot = useMemo(() => defaultAuthoringSlotSelection(route, model), [model, route]);
  const resolvedActiveSlot = activeSlot ?? defaultSlot;
  const projectDrop = useCallback((next: AuthoringDropProjection | null) => {
    setActiveDropProjection((current) => {
      if (current === null || next === null) return current === next ? current : next;
      return current.index === next.index &&
        isSameAuthoringSlotSelection(current.target, next.target)
        ? current
        : next;
    });
  }, []);
  const slotProjection =
    resolvedActiveSlot === null
      ? null
      : projectAuthoringSlotSelection(resolvedActiveSlot, route, model);
  const surfaceRootNodeId =
    model.surfaces.find(({ id }) => id === selectedSurface.id)?.root.id ?? null;
  const deletionCompatibility =
    selection === null ? null : evaluateAuthoringNodeDeletion(route, model, selection);
  const deletionReason =
    selection === null || deletionCompatibility?.accepted === true
      ? "Deletes this layer and its nested Source subtree."
      : selection.sourceNodeId === surfaceRootNodeId
        ? "The surface root cannot be deleted."
        : deletionCompatibility?.reason === "cardinality-rejected"
          ? "The owning slot minimum requires this layer."
          : "This layer is no longer a current deletion target.";

  useEffect(() => {
    if (slotProjection?.status !== "rejected") return;
    resetDragSession();
    setActiveSlot(null);
    setActiveDropProjection(null);
    setDragIntent(null);
    setNotice("The previous slot target is no longer current.");
  }, [model, resetDragSession, slotProjection?.status]);

  useEffect(() => {
    if (interactive) return;
    resetDragSession();
    setActiveDropProjection(null);
    setDragIntent(null);
  }, [interactive, resetDragSession]);

  useEffect(() => {
    resetDragSession();
    setActiveDropProjection(null);
    setDragIntent(null);
    const pendingNodeId = pendingLayerFocus.current;
    if (pendingNodeId !== null) {
      const nextLayer = Array.from(
        authoringPanel.current?.querySelectorAll<HTMLElement>("[data-layer-source-node-id]") ?? [],
      ).find(({ dataset }) => dataset.layerSourceNodeId === pendingNodeId);
      if (nextLayer !== undefined) {
        nextLayer.focus();
        pendingLayerFocus.current = null;
      }
    }
  }, [model, resetDragSession, route.projectId, route.surfaceId]);

  useEffect(() => () => resetDragSession(), [resetDragSession]);

  function chooseSlot(target: AuthoringSlotSelection): void {
    if (!interactive) return;
    setActiveSlot((current) =>
      current !== null && isSameAuthoringSlotSelection(current, target) ? current : target,
    );
    setActiveTab("components");
    componentsTab.current?.focus();
    setNotice(`Choose a Catalog component for ${target.ownerId} · ${target.slot}.`);
  }

  function toggleLayer(node: AuthoringLayerNode): void {
    if (!interactive) return;
    setNotice("");
    onToggleSelection(node);
  }

  function applyIntent(
    target: AuthoringSlotSelection,
    index: number,
    intent: AuthoringDragIntent,
  ): void {
    if (!interactive) return;
    const targetProjection = projectAuthoringSlotSelection(target, route, model);
    const result = onSlotEdit(
      target,
      intent.kind === "component"
        ? { kind: "insert", componentId: intent.componentId, index }
        : { kind: "place", nodeId: intent.nodeId, index },
    );
    resetDragSession();
    setActiveDropProjection(null);
    setDragIntent(null);
    if (!result.ok) {
      const message =
        result.reason === "acceptance-rejected"
          ? "That component is not accepted by this slot."
          : result.reason === "cardinality-rejected"
            ? "This move would violate the slot item limits."
            : result.reason === "defaults-invalid"
              ? "The Catalog defaults cannot create a valid component here."
              : result.reason === "preview-unavailable"
                ? "The working preview could not accept this Source change."
                : result.reason === "target-invalid"
                  ? "The selected node or slot is no longer current."
                  : "The slot change was rejected safely.";
      setNotice(message);
      return;
    }
    pendingLayerFocus.current = result.nodeId;
    if (result.operation === "insert") setActiveTab("layers");
    setNotice(
      result.operation === "insert"
        ? `Inserted ${model.components.find(({ id }) => id === (intent.kind === "component" ? intent.componentId : ""))?.displayName ?? result.nodeId} in ${targetProjection.status === "ready" ? `${targetProjection.owner.displayName} ${targetProjection.slot.name} slot at position ${index + 1}` : "the selected slot"}. Selected in Layers · use Remove layer above or press Delete/Backspace.`
        : result.operation === "move"
          ? `Moved ${result.nodeId} to ${targetProjection.status === "ready" ? `${targetProjection.owner.displayName} ${targetProjection.slot.name} slot` : "the selected slot"}.`
          : `Reordered ${result.nodeId} in ${targetProjection.status === "ready" ? `${targetProjection.owner.displayName} ${targetProjection.slot.name} slot` : "the selected slot"}.`,
    );
  }

  function selectAdjacentTab(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs: readonly AuthoringTab[] = ["layers", "components", "state", "actions"];
    const currentIndex = tabs.indexOf(activeTab);
    const nextTab =
      event.key === "Home"
        ? "layers"
        : event.key === "End"
          ? "actions"
          : (tabs[
              (currentIndex + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length
            ] ?? "layers");
    setActiveTab(nextTab);
    (nextTab === "layers"
      ? layersTab
      : nextTab === "components"
        ? componentsTab
        : nextTab === "state"
          ? stateTab
          : actionsTab
    ).current?.focus();
  }

  function requestSlotChoice(): void {
    if (!interactive) return;
    setActiveTab("layers");
    layersTab.current?.focus();
    setNotice("Choose a named slot in Layers, then return to Components.");
  }

  function startDrag(intent: AuthoringDragIntent): void {
    if (!interactive) return;
    resetDragSession();
    setActiveDropProjection(null);
    setDragIntent(intent);
    setNotice(
      intent.kind === "component"
        ? "Release anywhere in Components to add to the highlighted target."
        : "Release on a highlighted Layers gap.",
    );
  }

  function clearDrag(): void {
    resetDragSession();
    setActiveDropProjection(null);
    setDragIntent(null);
  }

  const deleteSelection = useCallback((): void => {
    if (!interactive) return;
    if (selection === null || deletionCompatibility?.accepted !== true) return;
    const result = onDeleteSelection();
    resetDragSession();
    setDragIntent(null);
    if (!result.ok) {
      setNotice(
        result.reason === "cardinality-rejected"
          ? "The owning slot minimum requires this layer."
          : result.reason === "preview-unavailable"
            ? "The working preview could not accept this Source deletion."
            : result.reason === "target-invalid"
              ? "The selected layer is no longer a current deletion target."
              : "The layer deletion was rejected safely.",
      );
      return;
    }
    setActiveSlot(null);
    setActiveTab("layers");
    layersTab.current?.focus();
    setNotice(`Deleted ${selection.displayName} layer · ${result.nodeId}.`);
  }, [
    deletionCompatibility?.accepted,
    interactive,
    onDeleteSelection,
    resetDragSession,
    selection,
  ]);

  useEffect(() => {
    if (!interactive || selection === null || deletionCompatibility?.accepted !== true) return;

    function deleteSelectedLayerFromKeyboard(event: globalThis.KeyboardEvent): void {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (event.key !== "Delete" && event.key !== "Backspace")
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.contentEditable === "true"))
      ) {
        return;
      }

      event.preventDefault();
      deleteSelection();
    }

    document.addEventListener("keydown", deleteSelectedLayerFromKeyboard);
    return () => document.removeEventListener("keydown", deleteSelectedLayerFromKeyboard);
  }, [deleteSelection, deletionCompatibility?.accepted, interactive, selection]);

  return (
    <aside
      aria-label="Authoring panel"
      className={styles.authoringPanel}
      data-active-tab={activeTab}
      hidden={hidden}
      ref={authoringPanel}
    >
      <div className={styles.authoringHeader}>
        <span>
          <strong>Authoring</strong>
          <small>Catalog resolved</small>
        </span>
        <span
          aria-label="Catalog connected"
          className={styles.catalogStatus}
          title="Catalog connected"
        />
      </div>
      <div aria-label="Authoring views" className={styles.authoringTabs} role="tablist">
        <button
          aria-controls={`${panelId}-layers-panel`}
          aria-selected={activeTab === "layers"}
          id={`${panelId}-layers-tab`}
          onClick={() => setActiveTab("layers")}
          onKeyDown={selectAdjacentTab}
          ref={layersTab}
          role="tab"
          tabIndex={activeTab === "layers" ? 0 : -1}
          type="button"
        >
          Layers
        </button>
        <button
          aria-controls={`${panelId}-components-panel`}
          aria-selected={activeTab === "components"}
          id={`${panelId}-components-tab`}
          onClick={() => setActiveTab("components")}
          onKeyDown={selectAdjacentTab}
          ref={componentsTab}
          role="tab"
          tabIndex={activeTab === "components" ? 0 : -1}
          type="button"
        >
          Components
        </button>
        <button
          aria-controls={`${panelId}-state-panel`}
          aria-selected={activeTab === "state"}
          id={`${panelId}-state-tab`}
          onClick={() => setActiveTab("state")}
          onKeyDown={selectAdjacentTab}
          ref={stateTab}
          role="tab"
          tabIndex={activeTab === "state" ? 0 : -1}
          type="button"
        >
          State
        </button>
        <button
          aria-controls={`${panelId}-actions-panel`}
          aria-selected={activeTab === "actions"}
          id={`${panelId}-actions-tab`}
          onClick={() => setActiveTab("actions")}
          onKeyDown={selectAdjacentTab}
          ref={actionsTab}
          role="tab"
          tabIndex={activeTab === "actions" ? 0 : -1}
          type="button"
        >
          Actions
        </button>
      </div>
      {selection === null || activeTab === "state" || activeTab === "actions" ? null : (
        <div className={styles.authoringSelectionActions}>
          <span className={styles.selectedLayerSummary}>
            <span>Selected layer</span>
            <strong>{selection.displayName}</strong>
            <kbd aria-label="Delete or Backspace shortcut">⌫</kbd>
          </span>
          <button
            aria-describedby={`${panelId}-delete-layer-description`}
            aria-keyshortcuts="Delete Backspace"
            aria-label={`Delete ${selection.displayName} layer · ${selection.sourceNodeId}`}
            className={styles.deleteLayerAction}
            disabled={deletionCompatibility?.accepted !== true}
            onClick={deleteSelection}
            type="button"
          >
            <span aria-hidden="true" className={styles.deleteLayerGlyph} />
            Remove layer
          </button>
          <small id={`${panelId}-delete-layer-description`}>{deletionReason}</small>
        </div>
      )}
      <div
        aria-labelledby={`${panelId}-layers-tab`}
        className={styles.authoringTabPanel}
        hidden={activeTab !== "layers"}
        id={`${panelId}-layers-panel`}
        role="tabpanel"
        tabIndex={activeTab === "layers" ? 0 : -1}
      >
        {activeTab === "layers" ? (
          <LayerTree
            activeDropProjection={activeDropProjection}
            activeSlot={resolvedActiveSlot}
            authoringModel={model}
            dragIntent={dragIntent}
            dragSession={dragSession}
            model={model}
            onApplyIntent={applyIntent}
            onChooseSlot={chooseSlot}
            onClearDrag={clearDrag}
            onProjectDrop={projectDrop}
            onStartDrag={startDrag}
            onToggleSelection={toggleLayer}
            rootNodeId={model.surfaces.find(({ id }) => id === selectedSurface.id)?.root.id ?? ""}
            route={route}
            selectedSourceNodeId={selectedSourceNodeId}
            selectedSurface={selectedSurface}
          />
        ) : null}
      </div>
      <div
        aria-labelledby={`${panelId}-components-tab`}
        className={styles.authoringTabPanel}
        hidden={activeTab !== "components"}
        id={`${panelId}-components-panel`}
        role="tabpanel"
        tabIndex={activeTab === "components" ? 0 : -1}
      >
        <ComponentLibrary
          active={activeTab === "components"}
          dragIntent={dragIntent}
          model={model}
          onApplyIntent={applyIntent}
          onClearDrag={clearDrag}
          onRequestSlotChoice={requestSlotChoice}
          onStartDrag={startDrag}
          route={route}
          slotProjection={slotProjection}
        />
      </div>
      <div
        aria-labelledby={`${panelId}-state-tab`}
        className={styles.authoringTabPanel}
        hidden={activeTab !== "state"}
        id={`${panelId}-state-panel`}
        role="tabpanel"
        tabIndex={activeTab === "state" ? 0 : -1}
      >
        <StatePanel model={stateModel} onEdit={onStateEdit} surfaceName={selectedSurface.name} />
      </div>
      <div
        aria-labelledby={`${panelId}-actions-tab`}
        className={styles.authoringTabPanel}
        hidden={activeTab !== "actions"}
        id={`${panelId}-actions-panel`}
        role="tabpanel"
        tabIndex={activeTab === "actions" ? 0 : -1}
      >
        <EventActionPanel
          model={eventActionModel}
          onEdit={onEventActionEdit}
          surfaceName={selectedSurface.name}
        />
      </div>
      <p aria-atomic="true" aria-live="polite" className={styles.authoringBoundary} role="status">
        {notice ||
          (activeTab === "state"
            ? `Local state · ${selectedSurface.name}`
            : activeTab === "actions"
              ? `Events and actions · ${selectedSurface.name}`
              : activeTab === "components"
                ? slotProjection?.status === "ready"
                  ? `Placement target · ${slotProjection.owner.displayName} ${slotProjection.owner.id} · ${slotProjection.slot.name} slot.`
                  : "Choose a named slot in Layers before placing a component."
                : selection === null
                  ? "Choose a Source layer to inspect, move, or edit its properties."
                  : `Selected · ${selection.displayName}${selection.conditional ? " · Conditional" : ""}`)}
      </p>
    </aside>
  );
}

function SurfaceEditor({
  persistencePort,
  project,
  selectedSurface,
}: Readonly<{
  readonly persistencePort: DesenEditorPersistencePort | null;
  readonly project: DesenAppProjectSummary;
  readonly selectedSurface: DesenAppSurfaceSummary;
}>) {
  const [mode, setMode] = useState<SurfaceEditorMode>("design");
  const [selection, setSelection] = useState<AuthoringComponentSelection | null>(null);
  const [transientDiagnostics, setTransientDiagnostics] =
    useState<TransientAuthoringDiagnostics | null>(null);
  const [diagnosticSelection, setDiagnosticSelection] =
    useState<AuthoringDiagnosticSelection | null>(null);
  const diagnosticFocusRequest = useRef(0);
  const [authoringSession, setAuthoringSession] = useState(() =>
    Object.freeze({
      document: REFERENCE_EDITOR_DOCUMENT,
      preview: prepareAuthoringPreviewBundle(REFERENCE_EDITOR_DOCUMENT),
    }),
  );
  const [scenarioChoice, setScenarioChoice] = useState<
    Readonly<{ readonly ownerKey: string | null; readonly value: AuthoringScenarioValue }>
  >(() => Object.freeze({ ownerKey: null, value: AUTHORING_SOURCE_SCENARIO_VALUE }));
  const inMemoryBaselineCanonical = useRef(REFERENCE_EDITOR_DOCUMENT_CANONICAL);
  const inMemoryCurrentCanonical = useRef(REFERENCE_EDITOR_DOCUMENT_CANONICAL);
  const inMemoryDraftDirty = useRef(false);
  const [inMemoryDirtyProjection, setInMemoryDirtyProjection] = useState(false);
  const updateInMemoryDirtyProjection = useCallback(() => {
    const dirty = inMemoryCurrentCanonical.current !== inMemoryBaselineCanonical.current;
    inMemoryDraftDirty.current = dirty;
    setInMemoryDirtyProjection((current) => (current === dirty ? current : dirty));
  }, []);
  const modeRef = useRef<SurfaceEditorMode>("design");
  const designModeButton = useRef<HTMLButtonElement>(null);
  const runModeButton = useRef<HTMLButtonElement>(null);
  const modeStatusId = useId();
  const { document, preview } = authoringSession;
  const route = useMemo(
    () => Object.freeze({ projectId: project.id, surfaceId: selectedSurface.id }),
    [project.id, selectedSurface.id],
  );
  const persistenceCreation = useMemo(
    () =>
      persistencePort === null
        ? null
        : createAuthoringPersistenceController({
            route,
            document: REFERENCE_EDITOR_DOCUMENT,
            catalog: referenceCatalog,
            persistencePort,
          }),
    [persistencePort, route],
  );
  const persistenceController =
    persistenceCreation?.ok === true ? persistenceCreation.controller : null;
  const persistenceState = useSyncExternalStore(
    persistenceController?.subscribe ?? subscribeUnavailablePersistence,
    persistenceController?.read ?? readUnavailablePersistence,
    persistenceController?.read ?? readUnavailablePersistence,
  );
  const persistenceControllerLifetime = useRef<AuthoringPersistenceController | null>(null);
  const persistenceProjection = useMemo(
    () => projectPersistenceControls(persistenceState, inMemoryDirtyProjection),
    [inMemoryDirtyProjection, persistenceState],
  );
  const preparedModel = useMemo(
    () => prepareCatalogAuthoringModel(referenceCatalog, document),
    [document],
  );
  const committedDocumentFingerprint = useMemo(() => digestCanonicalJson(document), [document]);
  const diagnosticsValidator = useMemo(
    () =>
      preparedModel.ok
        ? createDesenEditorContinuousValidator(preparedModel.model.validationCatalogs)
        : null,
    [preparedModel],
  );
  const activeTransientDiagnostics =
    transientDiagnostics !== null &&
    transientDiagnostics.ownerDocumentFingerprint === committedDocumentFingerprint &&
    transientDiagnostics.snapshot.projectId === route.projectId &&
    transientDiagnostics.snapshot.surfaceId === route.surfaceId &&
    diagnosticsValidator?.ok === true &&
    transientDiagnostics.snapshot.catalogSetFingerprint ===
      diagnosticsValidator.validator.catalogSetFingerprint
      ? transientDiagnostics
      : null;
  const diagnosticsProjection = useMemo<AuthoringDiagnosticsViewModelResult | null>(
    () =>
      activeTransientDiagnostics === null
        ? null
        : projectAuthoringDiagnostics(
            activeTransientDiagnostics.report,
            activeTransientDiagnostics.snapshot,
          ),
    [activeTransientDiagnostics],
  );
  const inspector = useMemo(
    () =>
      preparedModel.ok
        ? prepareAuthoringInspectorModel(preparedModel.model, route, selection)
        : Object.freeze({ status: "rejected" as const }),
    [preparedModel, route, selection],
  );
  const stateModel = useMemo<AuthoringStateModelResult>(
    () =>
      preparedModel.ok
        ? prepareAuthoringStateModel(preparedModel.model, route)
        : Object.freeze({ status: "rejected", reason: "route-invalid" }),
    [preparedModel, route],
  );
  const eventOwnerSelection = useMemo<AuthoringEventOwnerSelection | null>(
    () =>
      selection === null
        ? null
        : createAuthoringEventOwnerSelection({
            projectId: selection.projectId,
            surfaceId: selection.surfaceId,
            ownerKind: "component",
            ownerId: selection.sourceNodeId,
            capabilityId: selection.capabilityId,
            displayName: selection.displayName,
            conditional: selection.conditional,
          }),
    [selection],
  );
  const eventActionModel = useMemo<AuthoringEventActionModelResult>(
    () =>
      preparedModel.ok
        ? prepareAuthoringEventActionModel(preparedModel.model, route, eventOwnerSelection)
        : Object.freeze({ status: "rejected", reason: "route-invalid" }),
    [eventOwnerSelection, preparedModel, route],
  );
  const scenarioOwnerKey =
    selection === null
      ? null
      : `${selection.projectId}/${selection.surfaceId}/${selection.sourceNodeId}/${selection.capabilityId}`;
  const scenarioModel = useMemo(
    () =>
      preparedModel.ok
        ? prepareAuthoringScenarioModel(preparedModel.model, route, selection)
        : Object.freeze({ status: "rejected" as const, reason: "catalog-invalid" as const }),
    [preparedModel, route, selection],
  );
  const activeScenarioValue =
    scenarioModel.status === "ready" &&
    scenarioChoice.ownerKey === scenarioOwnerKey &&
    scenarioModel.options.some(({ value }) => value === scenarioChoice.value)
      ? scenarioChoice.value
      : AUTHORING_SOURCE_SCENARIO_VALUE;
  const scenarioPreview = useMemo(
    () =>
      activeScenarioValue !== AUTHORING_SOURCE_SCENARIO_VALUE &&
      selection !== null &&
      preparedModel.ok
        ? prepareAuthoringScenarioPreview(
            document,
            preview,
            preparedModel.model,
            route,
            selection,
            activeScenarioValue,
          )
        : null,
    [activeScenarioValue, document, preparedModel, preview, route, selection],
  );
  const effectivePreview =
    activeScenarioValue === AUTHORING_SOURCE_SCENARIO_VALUE
      ? preview
      : scenarioPreview?.ok === true
        ? scenarioPreview.preview
        : null;
  const fidelity = useMemo(
    () =>
      preparedModel.ok
        ? projectPreviewFidelity(preparedModel.model, route)
        : Object.freeze({ status: "rejected" as const }),
    [preparedModel, route],
  );
  const fixtureRevision = effectivePreview?.ok === true ? effectivePreview.revision : "unavailable";
  const fixtureController = useMemo(
    () =>
      createAuthoringSignInFixtureController({
        documentId: REFERENCE_EDITOR_DOCUMENT.id,
        revision: fixtureRevision,
        surfaceId: selectedSurface.id,
      }),
    [fixtureRevision, selectedSurface.id],
  );
  const fixtureHostPorts = useMemo(
    () => createAuthoringFixtureHostPorts(fixtureController.operationPort),
    [fixtureController],
  );
  const fixtureControllerLifetime = useRef<ReturnType<
    typeof createAuthoringSignInFixtureController
  > | null>(null);
  const fixtureSnapshot = useSyncExternalStore(
    fixtureController.subscribe,
    fixtureController.read,
    fixtureController.read,
  );

  useEffect(() => {
    fixtureController.activate();
    fixtureControllerLifetime.current = fixtureController;
    return () => {
      fixtureController.deactivate();
      if (fixtureControllerLifetime.current === fixtureController) {
        fixtureControllerLifetime.current = null;
      }
      queueMicrotask(() => {
        if (fixtureControllerLifetime.current !== fixtureController) {
          fixtureController.dispose();
        }
      });
    };
  }, [fixtureController]);

  useEffect(() => {
    if (persistenceController === null) return;
    persistenceControllerLifetime.current = persistenceController;
    return () => {
      if (persistenceControllerLifetime.current === persistenceController) {
        persistenceControllerLifetime.current = null;
      }
      queueMicrotask(() => {
        if (persistenceControllerLifetime.current !== persistenceController) {
          persistenceController.dispose();
        }
      });
    };
  }, [persistenceController]);

  useEffect(() => {
    if (
      persistenceState === null ||
      persistenceState.disposed ||
      !(
        persistenceState.saveResult?.status === "created" ||
        persistenceState.saveResult?.status === "updated" ||
        persistenceState.saveResult?.status === "unchanged"
      ) ||
      persistenceState.savedDocument === null
    ) {
      return;
    }
    inMemoryBaselineCanonical.current = canonicalizeJson(persistenceState.savedDocument);
    updateInMemoryDirtyProjection();
  }, [persistenceState, updateInMemoryDirtyProjection]);

  useEffect(() => {
    if (
      persistenceController !== null &&
      (persistenceState === null || persistenceState.disposed || !persistenceState.dirty)
    ) {
      return;
    }

    const hasCurrentUnsavedSource = () => {
      if (persistenceController === null) return inMemoryDraftDirty.current;
      if (persistenceControllerLifetime.current !== persistenceController) return null;
      const current = persistenceController.read();
      if (current.disposed) return null;
      return current.dirty;
    };
    const removeNavigationGuard = installDesenAppNavigationGuard(() => {
      const dirty = hasCurrentUnsavedSource();
      if (dirty === null) return false;
      return (
        !dirty ||
        window.confirm(
          "Discard unsaved changes? Leaving this surface will permanently discard the current authored Source draft.",
        )
      );
    });
    const protectPageExit = (event: BeforeUnloadEvent) => {
      if (hasCurrentUnsavedSource() !== true) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectPageExit);
    return () => {
      removeNavigationGuard();
      window.removeEventListener("beforeunload", protectPageExit);
    };
  }, [persistenceController, persistenceState]);

  useEffect(() => {
    if (
      persistenceController === null ||
      persistenceController.read().disposed ||
      persistenceController.read().session.document === document
    ) {
      return;
    }
    persistenceController.replaceAuthoredDocument(document);
  }, [document, persistenceController]);

  function isDesignMode(): boolean {
    return modeRef.current === "design";
  }

  function clearTransientDiagnostics(): void {
    setTransientDiagnostics(null);
    setDiagnosticSelection(null);
  }

  function captureEditDiagnostics(result: AuthoringEditDiagnosticResult): void {
    const report = result.ok ? undefined : result.validationReport;
    if (
      report === undefined ||
      report.valid ||
      report.documentFingerprint === null ||
      diagnosticsValidator?.ok !== true ||
      report.catalogSetFingerprint !== diagnosticsValidator.validator.catalogSetFingerprint
    ) {
      clearTransientDiagnostics();
      return;
    }
    const snapshot = Object.freeze({
      projectId: route.projectId,
      surfaceId: route.surfaceId,
      documentFingerprint: report.documentFingerprint,
      catalogSetFingerprint: diagnosticsValidator.validator.catalogSetFingerprint,
    }) satisfies AuthoringDiagnosticsSnapshotIdentity;
    setTransientDiagnostics(
      Object.freeze({
        ownerDocumentFingerprint: committedDocumentFingerprint,
        report,
        snapshot,
      }),
    );
    setDiagnosticSelection(null);
  }

  function selectDiagnostic(selectionKey: string): void {
    if (!isDesignMode() || diagnosticsProjection?.status !== "ready") return;
    const occurrence = diagnosticsProjection.model.diagnostics
      .flatMap((diagnostic) => diagnostic.occurrences)
      .find((candidate) => candidate.selectionKey === selectionKey);
    if (occurrence === undefined) return;
    diagnosticFocusRequest.current += 1;
    setDiagnosticSelection(
      Object.freeze({ selectionKey, focusRequestId: diagnosticFocusRequest.current }),
    );
  }

  function commitAuthoringSession(
    nextSession: typeof authoringSession,
    establishesBaseline = false,
  ): void {
    const canonicalDocument = canonicalizeJson(nextSession.document);
    inMemoryCurrentCanonical.current = canonicalDocument;
    if (establishesBaseline) inMemoryBaselineCanonical.current = canonicalDocument;
    updateInMemoryDirtyProjection();
    clearTransientDiagnostics();
    setAuthoringSession(nextSession);
  }

  function chooseMode(nextMode: SurfaceEditorMode): void {
    if (persistenceState?.pending === "opening") return;
    modeRef.current = nextMode;
    setMode(nextMode);
    (nextMode === "design" ? designModeButton : runModeButton).current?.focus();
  }

  function chooseScenario(value: AuthoringScenarioValue): void {
    if (!isDesignMode() || scenarioOwnerKey === null) return;
    setScenarioChoice(Object.freeze({ ownerKey: scenarioOwnerKey, value }));
  }

  async function openAuthoredSource(): Promise<void> {
    if (!isDesignMode() || persistenceController === null) return;
    const result = await persistenceController.open();
    if (
      result.status !== "opened" ||
      !isDesignMode() ||
      persistenceControllerLifetime.current !== persistenceController ||
      persistenceController.read().disposed ||
      persistenceController.read().session !== result.session
    ) {
      return;
    }
    commitAuthoringSession(result.session, true);
    setSelection(null);
    setScenarioChoice(Object.freeze({ ownerKey: null, value: AUTHORING_SOURCE_SCENARIO_VALUE }));
  }

  function saveAuthoredSource(): void {
    if (!isDesignMode() || persistenceController === null) return;
    void persistenceController.save();
  }

  function toggleSelection(node: AuthoringLayerNode): void {
    if (!isDesignMode()) return;
    const candidate = createAuthoringComponentSelection({
      projectId: project.id,
      surfaceId: selectedSurface.id,
      sourceNodeId: node.id,
      capabilityId: node.capabilityId,
      displayName: node.displayName,
      conditional: node.conditional,
    });
    setSelection((current) =>
      isSameAuthoringComponentSelection(current, candidate) ? null : candidate,
    );
  }

  function editSelectedProperty(edit: AuthoringInspectorEdit): AuthoringInspectorEditResult {
    if (!isDesignMode()) {
      return Object.freeze({ ok: false, reason: "edit-rejected" });
    }
    if (selection === null) return Object.freeze({ ok: false, reason: "selection-invalid" });
    const result = applyAuthoringInspectorEdit(document, referenceCatalog, route, selection, edit);
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
    return result;
  }

  function editSelectedBinding(edit: AuthoringInspectorBindingEdit): AuthoringInspectorEditResult {
    if (!isDesignMode()) {
      return Object.freeze({ ok: false, reason: "edit-rejected" });
    }
    if (selection === null) return Object.freeze({ ok: false, reason: "selection-invalid" });
    const result = applyAuthoringInspectorBindingEdit(
      document,
      referenceCatalog,
      route,
      selection,
      edit,
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
    return result;
  }

  function editLocalState(edit: AuthoringStateEdit): AuthoringStateEditResult {
    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });
    const result = applyAuthoringStateEdit(document, referenceCatalog, route, edit);
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
    return result;
  }

  function editSelectedEventAction(edit: AuthoringEventActionEdit): AuthoringEventActionEditResult {
    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });
    if (eventOwnerSelection === null) {
      return Object.freeze({ ok: false, reason: "owner-invalid" });
    }
    const result = applyAuthoringEventActionEdit(
      document,
      referenceCatalog,
      route,
      eventOwnerSelection,
      edit,
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
    return result;
  }

  function editNamedSlot(
    target: AuthoringSlotSelection,
    edit: AuthoringSlotEdit,
  ): AuthoringSlotEditResult {
    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });
    const result = applyAuthoringSlotEdit(document, referenceCatalog, route, target, edit);
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
    if (result.operation === "insert" && edit.kind === "insert" && preparedModel.ok) {
      const component = preparedModel.model.components.find(({ id }) => id === edit.componentId);
      if (component !== undefined) {
        setSelection(
          createAuthoringComponentSelection({
            projectId: project.id,
            surfaceId: selectedSurface.id,
            sourceNodeId: result.nodeId,
            capabilityId: component.id,
            displayName: component.displayName,
            conditional: false,
          }),
        );
      }
    }
    return result;
  }

  function deleteSelectedLayer(): AuthoringSlotEditResult {
    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });
    if (selection === null) return Object.freeze({ ok: false, reason: "edit-rejected" });
    const result = applyAuthoringNodeDelete(document, referenceCatalog, route, selection);
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
    setSelection(null);
    return result;
  }

  if (!preparedModel.ok) {
    return (
      <section className={styles.surfaceEditor} aria-labelledby="workspace-title">
        <h1 className={styles.visuallyHidden} data-route-heading id="project-title" tabIndex={-1}>
          {project.name}
        </h1>
        <div className={styles.panelEmptyState} role="alert">
          <strong id="workspace-title">The session draft is unavailable.</strong>
          <p>DESEN preserved the previous Source and stopped authoring safely.</p>
        </div>
      </section>
    );
  }

  const model = preparedModel.model;

  return (
    <section aria-labelledby="workspace-title" className={styles.surfaceEditor} data-mode={mode}>
      <h1 className={styles.visuallyHidden} data-route-heading id="project-title" tabIndex={-1}>
        {project.name}
      </h1>

      <AuthoringPanel
        eventActionModel={eventActionModel}
        hidden={mode === "run"}
        interactive={mode === "design"}
        model={model}
        onDeleteSelection={deleteSelectedLayer}
        onEventActionEdit={editSelectedEventAction}
        onSlotEdit={editNamedSlot}
        onStateEdit={editLocalState}
        onToggleSelection={toggleSelection}
        route={route}
        selection={selection}
        selectedSourceNodeId={selection?.sourceNodeId ?? null}
        selectedSurface={selectedSurface}
        stateModel={stateModel}
      />

      <div className={styles.surfaceFrame} data-mode={mode}>
        <div className={styles.surfaceFrameHeader}>
          <div className={styles.surfaceIdentity}>
            <h2 id="workspace-title">{selectedSurface.name}</h2>
            <span>{selectedSurface.capabilityId}</span>
          </div>
          <div className={styles.surfaceFrameTools}>
            <div
              aria-label="Design and Run mode"
              className={styles.modeControl}
              data-preserve-inspector-draft="true"
              role="group"
            >
              <button
                aria-describedby={modeStatusId}
                aria-pressed={mode === "design"}
                disabled={persistenceState?.pending === "opening"}
                onClick={() => chooseMode("design")}
                ref={designModeButton}
                type="button"
              >
                Design
              </button>
              <button
                aria-describedby={modeStatusId}
                aria-pressed={mode === "run"}
                disabled={persistenceState?.pending === "opening"}
                onClick={() => chooseMode("run")}
                ref={runModeButton}
                type="button"
              >
                Run
              </button>
            </div>
            <SurfaceState state={selectedSurface.state} />
          </div>
        </div>

        <PersistenceControls
          busy={persistenceState?.pending === "opening" || persistenceState?.pending === "saving"}
          confirmationScope={persistenceController}
          designMode={mode === "design"}
          onOpen={() => {
            void openAuthoredSource();
          }}
          onSave={saveAuthoredSource}
          projection={persistenceProjection}
        />

        <p
          aria-atomic="true"
          aria-label="Mode safety"
          aria-live="polite"
          className={styles.modeSafety}
          id={modeStatusId}
          role="status"
        >
          {mode === "design"
            ? "Design mode · managed controls are disabled; authored changes remain local until Save source succeeds."
            : "Run mode · controls are interactive against synthetic fixtures; live effects remain blocked."}
        </p>

        <PreviewContextDisclosure fidelity={fidelity} />

        <div className={styles.surfaceFrameBody}>
          <DesenAdapterCanvas
            authoringModel={model}
            bundle={effectivePreview?.ok === true ? effectivePreview.bundle : null}
            diagnostics={
              mode === "design" &&
              activeTransientDiagnostics !== null &&
              diagnosticsProjection?.status === "ready"
                ? Object.freeze({
                    report: activeTransientDiagnostics.report,
                    snapshot: activeTransientDiagnostics.snapshot,
                    selectedSelectionKey: diagnosticSelection?.selectionKey ?? null,
                    focusRequestId: diagnosticSelection?.focusRequestId ?? 0,
                  })
                : null
            }
            hostPorts={fixtureHostPorts}
            mode={mode}
            projectId={project.id}
            selection={mode === "design" ? selection : null}
            surfaceId={selectedSurface.id}
          />
        </div>

        <div className={styles.boundaryNote}>
          <strong>{mode === "design" ? "Preview data" : "Runtime preview"}</strong>
          <span>
            {mode === "design"
              ? "Catalog-backed edits change only the authored Source and persist only through Save source. Scenarios are transient previews and never change the authored Source. Selection, placement, and Inspector chrome never enter the managed component tree."
              : "Controls are live against this in-memory preview. Only the exact synthetic sign-in fixture is available; navigation, resources, storage, publication, activation, integration, and production calls remain blocked."}
          </span>
        </div>
      </div>

      <InspectorPanel
        diagnosticsControls={
          diagnosticsProjection?.status === "ready" ? (
            <DiagnosticsPanel
              model={diagnosticsProjection.model}
              onDismiss={clearTransientDiagnostics}
              onSelect={selectDiagnostic}
              selectedSelectionKey={diagnosticSelection?.selectionKey ?? null}
            />
          ) : undefined
        }
        hidden={mode === "run"}
        inspector={inspector}
        onBindingEdit={editSelectedBinding}
        onEdit={editSelectedProperty}
        previewControls={
          <ScenarioPreviewControl
            model={scenarioModel}
            onChange={chooseScenario}
            value={activeScenarioValue}
          />
        }
      />

      {mode === "run" ? (
        <RunControls
          onComplete={() => {
            fixtureController.completePending();
          }}
          onSelectOutcome={(outcomeId) => {
            fixtureController.selectOutcome(outcomeId);
          }}
          snapshot={fixtureSnapshot}
        />
      ) : null}

      <div className={styles.editorStatus} hidden={mode === "run"}>
        <span>{project.navigationStatus}</span>
        <span aria-hidden="true">·</span>
        <span>
          {activeScenarioValue === AUTHORING_SOURCE_SCENARIO_VALUE
            ? preview.ok
              ? "Session draft"
              : "Preview unavailable"
            : effectivePreview?.ok === true
              ? "Scenario preview"
              : "Scenario unavailable"}
        </span>
      </div>
    </section>
  );
}

function ProjectShell({
  persistencePort,
  project,
  selectedSurface,
}: Readonly<{
  readonly persistencePort: DesenEditorPersistencePort | null;
  readonly project: DesenAppProjectSummary;
  readonly selectedSurface: DesenAppSurfaceSummary | undefined;
}>) {
  if (selectedSurface === undefined) {
    return (
      <section className={styles.surfaceGallery} aria-labelledby="surfaces-title">
        <h1 className={styles.visuallyHidden} data-route-heading id="project-title" tabIndex={-1}>
          {project.name}
        </h1>

        <div className={styles.collectionToolbar}>
          <div className={styles.collectionHeading}>
            <div>
              <h2 id="surfaces-title">All surfaces</h2>
              <p>{project.description}</p>
            </div>
            <span className={styles.previewBadge}>Preview data</span>
          </div>
        </div>

        {project.surfaces.length > 0 ? (
          <nav aria-label={`${project.name} surfaces`}>
            <ul className={styles.surfaceGalleryList}>
              {project.surfaces.map((surface) => (
                <li key={surface.id}>
                  <AppLink
                    className={styles.surfaceCard}
                    href={createDesenAppProjectPath(project.id, surface.id)}
                  >
                    <span aria-hidden="true" className={styles.surfacePreview}>
                      <span className={styles.surfacePreviewBar} />
                      <span className={styles.surfacePreviewField} />
                      <span className={styles.surfacePreviewField} />
                      <span className={styles.surfacePreviewAction} />
                    </span>
                    <span className={styles.surfaceCardFooter}>
                      <span>
                        <strong>{surface.name}</strong>
                        <small>{surface.capabilityId}</small>
                      </span>
                      <SurfaceState state={surface.state} />
                    </span>
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <div className={styles.setupEmpty}>
            <p>No surfaces yet.</p>
            <h2 id="workspace-title">Connect a capability catalog to begin.</h2>
            <span>
              A DESEN surface starts from an explicit, versioned capability—not an unrestricted
              blank canvas.
            </span>
            <button className={styles.primaryButton} disabled type="button">
              Connect catalog
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <SurfaceEditor
      key={`${project.id}:${selectedSurface.id}`}
      persistencePort={persistencePort}
      project={project}
      selectedSurface={selectedSurface}
    />
  );
}

function NotFound({
  pathname,
  context,
}: Readonly<{ readonly pathname: string; readonly context?: string }>) {
  return (
    <section className={styles.notFound} aria-labelledby="not-found-title">
      <p className={styles.eyebrow}>Navigation stopped safely</p>
      <h1 data-route-heading id="not-found-title" tabIndex={-1}>
        This workspace route does not exist.
      </h1>
      <p>{context ?? "DESEN did not guess a project or silently redirect you somewhere else."}</p>
      <code>{pathname}</code>
      <AppLink className={styles.primaryButtonLink} href="/projects">
        Return to projects
      </AppLink>
    </section>
  );
}

function routeTitle(route: DesenAppRoute): string {
  if (route.kind === "projects") return "Projects · DESEN";
  if (route.kind === "not-found") return "Not found · DESEN";
  const project = findDesenAppProject(route.projectId);
  if (project === undefined) return "Project not found · DESEN";
  if (route.surfaceId === undefined) return `${project.name} · DESEN`;
  const surface = findDesenAppSurface(project, route.surfaceId);
  return surface === undefined
    ? `Surface not found · ${project.name} · DESEN`
    : `${surface.name} · ${project.name} · DESEN`;
}

function RouteView({
  persistencePort,
  route,
}: Readonly<{
  readonly persistencePort: DesenEditorPersistencePort | null;
  readonly route: DesenAppRoute;
}>) {
  if (route.kind === "projects") return <ProjectsHome />;
  if (route.kind === "not-found") return <NotFound pathname={route.pathname} />;

  const project = findDesenAppProject(route.projectId);
  if (project === undefined) {
    return (
      <NotFound
        context="That project is not present in this workspace. No similarly named project was substituted."
        pathname={route.pathname}
      />
    );
  }
  if (route.surfaceId === undefined)
    return (
      <ProjectShell
        persistencePort={persistencePort}
        project={project}
        selectedSurface={undefined}
      />
    );

  const surface = findDesenAppSurface(project, route.surfaceId);
  if (surface === undefined) {
    return (
      <NotFound
        context={`“${project.name}” does not contain that surface. The project remains unchanged.`}
        pathname={route.pathname}
      />
    );
  }
  return (
    <ProjectShell persistencePort={persistencePort} project={project} selectedSurface={surface} />
  );
}

/** Trusted host-owned capabilities injected into the App shell. */
export interface DesenAppApplicationProps {
  readonly persistencePort?: DesenEditorPersistencePort | null;
}

/** M09 Desen App shell with exact routes, schema-driven Source editing, and adapter preview. */
export function DesenAppApplication({ persistencePort = null }: DesenAppApplicationProps = {}) {
  const routeLocation = useSyncExternalStore(
    subscribeDesenAppNavigation,
    readDesenAppLocation,
    readDesenAppServerLocation,
  );
  const route = readDesenAppRoute(routeLocation);
  const previousRouteLocation = useRef(routeLocation);

  useEffect(() => {
    document.title = routeTitle(route);
    if (previousRouteLocation.current !== routeLocation) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelector<HTMLElement>("[data-route-heading]")?.focus({ preventScroll: true });
      previousRouteLocation.current = routeLocation;
    }
  }, [routeLocation, route]);

  return (
    <div className={styles.app}>
      <SkipToMainContentLink />
      <AppHeader route={route} />
      <main className={styles.main} id="desen-app-content" tabIndex={-1}>
        <RouteView persistencePort={persistencePort} route={route} />
      </main>
    </div>
  );
}
