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

import {
  captureDesenEditorClipboard,
  createDesenEditorContinuousValidator,
  createDesenEditorHistory,
  pasteDesenEditorClipboard,
  readDesenEditorNodePlacement,
  recordDesenEditorHistory,
  redoDesenEditorHistory,
  undoDesenEditorHistory,
} from "@desen/editor-core";
import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";

import { prepareCatalogAuthoringModel, projectAuthoringCanvasFrame } from "./authoring-data.js";
import { prepareDesignSystemExplorer } from "./design-system-explorer.js";
import { useProjectAuthoringController } from "./project-authoring-context.js";
import { MasterInstancePanel } from "./master-instance-panel.js";
import { MasterDraftBanner } from "./master-draft-banner.js";
import { createProjectMasterDraftController } from "./project-master-draft-controller.js";
import type { ProjectMasterDraftController } from "./project-master-draft-controller.js";
import { projectAuthoringBehaviorControls } from "./authoring-behavior-projection.js";
import { projectAuthoringDiagnostics } from "./authoring-diagnostics.js";
import { DesenAdapterCanvas } from "./adapter-canvas.js";
import { CanvasManipulationControls } from "./canvas-manipulation-controls.js";
import { applyAuthoringConditionEdit } from "./authoring-conditions.js";
import {
  applyAuthoringInputConnection,
  applyAuthoringOperationTriggerConnection,
} from "./authoring-connections.js";
import {
  createAuthoringOperationFixtureController,
  prepareAuthoringOperationFixtureModel,
} from "./authoring-fixtures.js";
import {
  createAuthoringIntegrationController,
  readAuthoringIntegrationBinding,
} from "./authoring-integration.js";
import {
  createAuthoringRunHostPorts,
  createAuthoringRunNavigationController,
} from "./authoring-run-navigation.js";
import { resolveAuthoringDesignTokens } from "./authoring-design-tokens.js";
import {
  AUTHORING_STYLE_PREVIEW_VIEWPORTS,
  createAuthoringStylePreviewHostPorts,
} from "./authoring-style-preview-runtime.js";
import {
  applyAuthoringVariantEdit,
  applyAuthoringStyleEdit,
  prepareAuthoringStyleModel,
  prepareAuthoringStylePreviewDocument,
  prepareAuthoringVariantModel,
} from "./authoring-styles.js";
import {
  authenticateAuthoringPersistenceControllerProfile,
  createAuthoringPersistenceController,
} from "./authoring-persistence.js";
import {
  createAuthoringPublicationController,
  createFixedDestinationAuthoringPublicationPort,
  readAuthoringPublicationPortDestination,
} from "./authoring-publication.js";
import { DiagnosticsPanel } from "./diagnostics-panel.js";
import { reviewAuthoringSourceDraft } from "./authoring-source-draft.js";
import type { AuthoringSourceDraftFailure } from "./authoring-source-draft.js";
import { SourceDraftControls } from "./source-draft-controls.js";
import { formatStructuredJson } from "./structured-json.js";
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
  applyAuthoringSlotBatchPlacement,
  applyAuthoringNodeDelete,
  applyAuthoringSlotEdit,
  createAuthoringSlotSelection,
  evaluateAuthoringSlotBatchPlacement,
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
import {
  createAuthoringCanvasPreviewFrame,
  createAuthoringCanvasViewport,
  panAuthoringCanvasViewport,
  projectAuthoringDirectManipulationSelection,
  resizeAuthoringCanvasPreviewFrame,
  toggleAuthoringDirectManipulationSelection,
  zoomAuthoringCanvasViewport,
} from "./authoring-direct-manipulation.js";
import { InspectorPanel } from "./inspector-panel.js";
import {
  InputConnectionControl,
  OperationConnectionControl,
  VisibilityControl,
} from "./behavior-controls.js";
import { EventActionPanel } from "./event-action-panel.js";
import {
  AUTHORING_SOURCE_SCENARIO_VALUE,
  prepareAuthoringScenarioModel,
  prepareAuthoringScenarioPreview,
} from "./authoring-scenarios.js";
import { projectPreviewFidelity } from "./preview-fidelity.js";
import { PersistenceControls } from "./persistence-controls.js";
import { PublicationControls } from "./publication-controls.js";
import {
  PreviewContextDisclosure,
  RunControls,
  ScenarioPreviewControl,
} from "./preview-controls.js";
import { StatePanel } from "./state-panel.js";
import {
  prepareAuthoringPreviewBundle,
  prepareAuthoringSurfacePreviewBundle,
} from "./authoring-preview.js";
import {
  admitProjectWorkspaceDocument,
  readProjectWorkspaceProfileAuthority,
} from "./project-workspace-profile.js";
import {
  createDesenAppProjectPath,
  createDesenAppDesignSystemPath,
  installDesenAppNavigationGuard,
  navigateDesenApp,
  readDesenAppLocation,
  readDesenAppRoute,
  readDesenAppServerLocation,
  subscribeDesenAppNavigation,
} from "./project-navigation.js";
import {
  findDesenAppProject,
  findDesenAppSurface,
  projectWorkspaceProfileSummary,
} from "./project-data.js";
import { readProjectInventoryFixture } from "./project-inventory-fixture.js";
import breadcrumbSeparatorUrl from "./assets/breadcrumb-separator.svg";
import desenLogoUrl from "./assets/desen-logo.svg";
import plusUrl from "./assets/plus.svg";
import settingsUrl from "./assets/settings.svg";
import themeUrl from "./assets/theme.svg";
import styles from "./application.module.css";

import type { CSSProperties, DragEvent, MouseEvent, ReactNode } from "react";
import type { EditableProjectRecord } from "@desen/design-system-core";
import type {
  DesenEditorDocument,
  DesenEditorContinuousValidationReport,
  DesenEditorClipboardPayload,
  DesenEditorHistory,
  DesenEditorPersistencePort,
} from "@desen/editor-core";
import type { RuntimeHostPorts, RuntimeOperationPort, RuntimeTokenPort } from "@desen/runtime-core";
import type { AuthoringIntegrationBindingHandle } from "./authoring-integration.js";
import type { AuthoringRunDestination } from "./authoring-run-navigation.js";
import type {
  AuthoringStyleEdit,
  AuthoringStyleTarget,
  AuthoringVariantEdit,
  AuthoringVariantEditResult,
  AuthoringVariantModelResult,
} from "./authoring-styles.js";
import type { AuthoringStylePreviewViewportId } from "./authoring-style-preview-runtime.js";
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
  AuthoringPublicationController,
  AuthoringPublicationPort,
  AuthoringPublicationSnapshot,
  AuthoringPublicationState,
} from "./authoring-publication.js";
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
import type {
  AuthoringConditionEdit,
  AuthoringConditionEditResult,
} from "./authoring-conditions.js";
import type {
  AuthoringConnectionResult,
  AuthoringOperationTriggerConnectionRecipe,
} from "./authoring-connections.js";
import type { AuthoringScenarioValue } from "./authoring-scenarios.js";
import type {
  AuthoringSlotBatchPlacementResult,
  AuthoringSlotEdit,
  AuthoringSlotEditResult,
  AuthoringSlotProjection,
  AuthoringSlotRoute,
  AuthoringSlotSelection,
  AuthoringSlotState,
} from "./authoring-slots.js";
import type { DesignSystemExplorerModel } from "./design-system-explorer.js";
import type { DesenAppRoute } from "./project-navigation.js";
import type { DesenAppProjectSummary, DesenAppSurfaceSummary } from "./project-data.js";
import type { ProjectInventoryFixtureHandle } from "./project-inventory-fixture.js";
import type {
  ProjectWorkspaceProfileHandle,
  ProjectWorkspaceProfileSnapshot,
} from "./project-workspace-profile.js";
import type {
  PersistenceControlProjection,
  PersistenceControlStatus,
} from "./persistence-controls.js";
import type {
  PublicationControlProjection,
  PublicationControlStatus,
} from "./publication-controls.js";

function subscribeUnavailablePersistence(): () => void {
  return () => undefined;
}

function readUnavailablePersistence(): null {
  return null;
}

function subscribeUnavailablePublication(): () => void {
  return () => undefined;
}

function readUnavailablePublication(): null {
  return null;
}

interface AuthoringPublicationLifetimeFence {
  active: boolean;
}

function createLifetimeFencedPublicationPort(
  publicationPort: AuthoringPublicationPort,
  lifetime: AuthoringPublicationLifetimeFence,
): AuthoringPublicationPort {
  const destination = readAuthoringPublicationPortDestination(publicationPort);
  if (destination === null) {
    throw new TypeError("The publication port has no authenticated fixed destination.");
  }
  const publishBundleToChannel = publicationPort.publishBundleToChannel;
  const activatePublishedRevision = publicationPort.activatePublishedRevision;
  function requireActiveLifetime(): void {
    if (!lifetime.active) throw new TypeError("The publication lifetime is inactive.");
  }
  return createFixedDestinationAuthoringPublicationPort({
    channelName: destination.channelName,
    hostId: destination.hostId,
    async publishBundleToChannel(request) {
      requireActiveLifetime();
      const settlement = await publishBundleToChannel(
        Object.freeze({ ...request, channelName: destination.channelName }),
      );
      requireActiveLifetime();
      return settlement;
    },
    async activatePublishedRevision(request) {
      requireActiveLifetime();
      const settlement = await activatePublishedRevision(request);
      requireActiveLifetime();
      return settlement;
    },
  });
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

function publicationSnapshotIsSaved(snapshot: AuthoringPublicationSnapshot): boolean {
  if (
    snapshot.persistenceAuthority !== "ready" ||
    snapshot.savedDocument === null ||
    snapshot.sourceGeneration === null
  ) {
    return false;
  }
  try {
    return canonicalizeJson(snapshot.document) === canonicalizeJson(snapshot.savedDocument);
  } catch {
    return false;
  }
}

function projectPublicationControlStatus(
  state: AuthoringPublicationState | null,
): PublicationControlStatus {
  if (state === null || state.disposed) return Object.freeze({ state: "unavailable" });
  if (state.pending !== null) {
    return Object.freeze({
      state: "pending",
      stage: state.pending === "control-plane" ? "channel" : "activation",
      sourceGeneration: state.snapshot.sourceGeneration ?? 0,
      revision: state.pending === "control-plane" ? null : state.snapshot.previewRevision,
    });
  }

  const result = state.result;
  if (result?.status === "published") {
    return Object.freeze({
      state: "active",
      relationship: result.relationship,
      revision: result.revision,
      sourceGeneration: result.sourceGeneration,
      channelGeneration: result.channelGeneration,
      activationGeneration: result.activationGeneration,
    });
  }
  if (result?.status === "indeterminate") {
    return Object.freeze({
      state: "indeterminate",
      stage: result.stage === "control-plane" ? "channel" : "activation",
      sourceGeneration: result.sourceGeneration,
      revision: result.revision,
    });
  }
  if (result?.status === "failed") {
    if (result.reason === "control-plane-conflict") {
      return Object.freeze({
        state: "conflict",
        currentChannelGeneration: result.currentChannelGeneration ?? null,
        sourceGeneration: result.sourceGeneration ?? state.snapshot.sourceGeneration ?? 0,
        revision: result.revision ?? state.snapshot.previewRevision,
      });
    }
    if (
      result.reason === "host-activation-failed" ||
      result.reason === "host-activation-unavailable" ||
      result.reason === "host-activation-revision-mismatch"
    ) {
      if (
        result.revision !== undefined &&
        result.sourceGeneration !== undefined &&
        result.channelGeneration !== undefined
      ) {
        return Object.freeze({
          state: "preserved",
          activeRevision: result.activeRevision ?? null,
          publishedRevision: result.revision,
          sourceGeneration: result.sourceGeneration,
          channelGeneration: result.channelGeneration,
        });
      }
      return Object.freeze({
        state: "failed",
        stage: "activation",
        sourceGeneration: state.snapshot.sourceGeneration,
        revision: state.snapshot.previewRevision,
      });
    }
    if (
      result.reason === "source-dirty" ||
      result.reason === "source-not-saved" ||
      result.reason === "persistence-not-ready"
    ) {
      return Object.freeze({ state: "save-required" });
    }
    if (result.reason === "stale-operation") {
      return Object.freeze({
        state: "stale",
        sourceGeneration: result.sourceGeneration ?? state.snapshot.sourceGeneration ?? 0,
      });
    }
    if (result.reason === "disposed") return Object.freeze({ state: "unavailable" });
    return Object.freeze({
      state: "failed",
      stage:
        result.reason === "publisher-rejected" || result.reason === "preview-revision-stale"
          ? "publisher"
          : "channel",
      sourceGeneration: result.sourceGeneration ?? state.snapshot.sourceGeneration,
      revision: result.revision ?? state.snapshot.previewRevision,
    });
  }
  if (state.snapshot.persistenceAuthority === "unavailable") {
    return Object.freeze({ state: "unavailable" });
  }
  if (!publicationSnapshotIsSaved(state.snapshot)) {
    return Object.freeze({ state: "save-required" });
  }
  return Object.freeze({
    state: "ready",
    sourceGeneration: state.snapshot.sourceGeneration ?? 0,
  });
}

function projectPublicationControls(
  state: AuthoringPublicationState | null,
): PublicationControlProjection {
  return Object.freeze({
    channelName: state?.channelName ?? "Unavailable",
    status: projectPublicationControlStatus(state),
  });
}

const UNAVAILABLE_PREVIEW_REVISION = `sha256:${"0".repeat(64)}`;
const AUTHORING_STYLE_BASE_TARGET: AuthoringStyleTarget = Object.freeze({ kind: "base" });
const EMPTY_STYLE_TOKEN_OPTIONS = Object.freeze([]);
const resolveMissingAuthoringToken: RuntimeTokenPort["resolve"] = () =>
  Object.freeze({ status: "missing" as const });

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

function AppHeader({
  onRequestProjectCreation,
  projectCreationUnavailableMessage,
  projects,
  route,
}: Readonly<{
  readonly onRequestProjectCreation: (() => void) | null;
  readonly projectCreationUnavailableMessage: string;
  readonly projects: readonly DesenAppProjectSummary[];
  readonly route: DesenAppRoute;
}>) {
  const projectsActive = route.kind === "projects" || route.kind === "project";
  const project =
    route.kind === "project" || route.kind === "design-system"
      ? findDesenAppProject(route.projectId, projects)
      : undefined;
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
              <span className={styles.pathMuted}>Workspace</span>
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
                aria-describedby={
                  onRequestProjectCreation === null ? "new-project-unavailable" : undefined
                }
                aria-label="New project"
                className={styles.addButton}
                disabled={onRequestProjectCreation === null}
                onClick={onRequestProjectCreation ?? undefined}
                title={
                  onRequestProjectCreation === null
                    ? projectCreationUnavailableMessage
                    : "Create project"
                }
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
            {route.kind === "design-system" ? (
              <>
                <AppLink
                  className={styles.pathMutedLink}
                  href={createDesenAppProjectPath(project.id)}
                >
                  {project.name}
                </AppLink>
                <img alt="" height="12" src={breadcrumbSeparatorUrl} width="12" />
                <span aria-current="page" className={styles.pathCurrent}>
                  Design system
                </span>
              </>
            ) : surface === undefined ? (
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
          {project === undefined ? null : (
            <AppLink
              ariaCurrent={route.kind === "design-system" ? "page" : undefined}
              className={styles.utilityLink}
              href={createDesenAppDesignSystemPath(project.id)}
            >
              Design system
            </AppLink>
          )}
          <span className={styles.profileAvatar} aria-label="Workspace profile">
            WS
          </span>
        </div>
        {onRequestProjectCreation === null ? (
          <span className={styles.visuallyHidden} id="new-project-unavailable">
            {projectCreationUnavailableMessage}
          </span>
        ) : null}
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

function ProjectsHome({
  fixtures,
  onRequestProjectCreation,
  projects: projectInventory,
}: Readonly<{
  readonly fixtures: boolean;
  readonly onRequestProjectCreation: (() => void) | null;
  readonly projects: readonly DesenAppProjectSummary[];
}>) {
  const searchHelpId = useId();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const projects = projectInventory.filter((project) => {
    if (normalizedQuery === "") return true;
    const searchable = [
      project.name,
      project.description,
      project.catalog ?? "",
      ...project.surfaces.flatMap((surface) => [surface.name, surface.sourceId]),
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
            <p>
              {fixtures
                ? "Open a bounded product surface in this preview workspace."
                : "Create and reopen Sources stored by your local Desen workspace."}
            </p>
          </div>
          {fixtures ? <span className={styles.previewBadge}>Preview data</span> : null}
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

      {fixtures ? (
        <p className={styles.previewNotice} aria-label="Preview data boundary">
          Project names and metadata are inert examples. No Source, save, diagnostics, revision or
          publication state is being read.
        </p>
      ) : null}

      <div className={styles.resultsHeading}>
        <p aria-live="polite" role="status">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </p>
      </div>
      {projectInventory.length === 0 && normalizedQuery === "" ? (
        <div className={styles.emptyState} data-project-empty-state="true">
          <p>Your workspace is ready</p>
          <h3>Create the first project.</h3>
          <span>
            Start from the exact Catalog set, Source inventory, runtime target, and surface frames
            declared by the authenticated workspace profile.
          </span>
          <button
            className={styles.primaryButton}
            disabled={onRequestProjectCreation === null}
            onClick={onRequestProjectCreation ?? undefined}
            type="button"
          >
            Create project
          </button>
        </div>
      ) : projects.length > 0 ? (
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

function DesignSystemFoundationGroup({
  items,
  title,
}: Readonly<{
  readonly items: DesignSystemExplorerModel["foundations"]["colors"];
  readonly title: string;
}>) {
  return (
    <section
      aria-labelledby={`design-system-foundation-${title.toLocaleLowerCase()}`}
      className={styles.designSystemFoundationGroup}
    >
      <h3 id={`design-system-foundation-${title.toLocaleLowerCase()}`}>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={`${item.type}:${item.name}`}>
            <span
              aria-hidden="true"
              className={styles.designSystemTokenSwatch}
              data-token-type={item.type}
              style={item.type === "color" ? { background: item.value } : undefined}
            />
            <span>
              <strong>{item.name}</strong>
              <code>{item.value}</code>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DesignSystemComponentDetail({
  component,
}: Readonly<{
  readonly component: DesignSystemExplorerModel["components"][number];
}>) {
  return (
    <article
      aria-labelledby="design-system-component-detail-title"
      className={styles.designSystemDetail}
      data-component-detail={component.id}
    >
      <div className={styles.designSystemDetailHeading}>
        <div>
          <p className={styles.eyebrow}>{component.category}</p>
          <h2 id="design-system-component-detail-title">{component.displayName}</h2>
          <p>{component.description ?? "Catalog component with no additional description."}</p>
          <p className={styles.designSystemUsageGuidance}>{component.usageGuidance}</p>
        </div>
        <div className={styles.designSystemStatusStack}>
          <span
            className={
              component.adapterStatus === "ready"
                ? styles.designSystemReady
                : styles.designSystemWarning
            }
          >
            {component.adapterStatus === "ready" ? "Adapter ready" : "Adapter missing"}
          </span>
          <small>{component.usageCount} Source uses</small>
        </div>
      </div>

      {component.contractStatus === "mismatch" ? (
        <p className={styles.designSystemMismatch} role="alert">
          The Catalog summary and documentation contract do not match. Editing and preview are
          intentionally unavailable for this component until the contract is repaired.
        </p>
      ) : null}

      <div className={styles.designSystemDetailGrid}>
        <section aria-labelledby="design-system-props-title">
          <h3 id="design-system-props-title">Props and controls</h3>
          {component.props.length === 0 ? (
            <p className={styles.designSystemEmpty}>No props declared.</p>
          ) : (
            <ul className={styles.designSystemDefinitionList}>
              {component.props.map((prop) => (
                <li key={prop.name}>
                  <span>
                    <strong>{prop.name}</strong>
                    {prop.required ? <small>required</small> : null}
                  </span>
                  <code>
                    {prop.enumValues.length > 0 ? prop.enumValues.join(" · ") : prop.type}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="design-system-parts-title">
          <h3 id="design-system-parts-title">Slots and parts</h3>
          <ul className={styles.designSystemDefinitionList}>
            {component.slots.map((slot) => (
              <li key={`slot:${slot.name}`}>
                <span>
                  <strong>{slot.name}</strong>
                  <small>slot</small>
                </span>
                <code>
                  {slot.minimum}–{slot.maximum ?? "∞"} items
                </code>
              </li>
            ))}
            {component.parts.map((part) => (
              <li key={`part:${part.name}`}>
                <span>
                  <strong>{part.name}</strong>
                  <small>style part</small>
                </span>
                <code>declared schema</code>
              </li>
            ))}
          </ul>
          {component.slots.length === 0 && component.parts.length === 0 ? (
            <p className={styles.designSystemEmpty}>No named slots or style parts declared.</p>
          ) : null}
        </section>
        <section aria-labelledby="design-system-interactions-title">
          <h3 id="design-system-interactions-title">Events and commands</h3>
          <ul className={styles.designSystemDefinitionList}>
            {[
              ...component.events.map((item) => ({ ...item, kind: "event" })),
              ...component.commands.map((item) => ({ ...item, kind: "command" })),
            ].map((item) => (
              <li key={`${item.kind}:${item.name}`}>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.kind}</small>
                </span>
                <code>{item.payloadShape}</code>
              </li>
            ))}
          </ul>
          {component.events.length === 0 && component.commands.length === 0 ? (
            <p className={styles.designSystemEmpty}>No events or commands declared.</p>
          ) : null}
        </section>
        <section aria-labelledby="design-system-states-title">
          <h3 id="design-system-states-title">Visual states</h3>
          <div className={styles.designSystemStateList}>
            {component.visualStates.map((state) => (
              <span key={state}>{state}</span>
            ))}
          </div>
        </section>
      </div>

      <section
        aria-labelledby="design-system-scenarios-title"
        className={styles.designSystemScenarios}
      >
        <div className={styles.designSystemSectionHeading}>
          <div>
            <h3 id="design-system-scenarios-title">Documented scenarios</h3>
            <p>
              Inert Catalog examples. Props are shown as data; no story script or component code is
              executed.
            </p>
          </div>
          <span>{component.scenarios.length} examples</span>
        </div>
        {component.scenarios.length === 0 ? (
          <p className={styles.designSystemEmpty}>
            No scenarios declared by this Catalog contract.
          </p>
        ) : (
          <ul className={styles.designSystemScenarioList}>
            {component.scenarios.map((scenario) => (
              <li key={scenario.id} data-scenario-id={scenario.id}>
                <strong>{scenario.id}</strong>
                <pre>{scenario.propsText}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function DesignSystemArea({
  model,
  project,
}: Readonly<{
  readonly model: DesignSystemExplorerModel;
  readonly project: DesenAppProjectSummary;
}>) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(model.components[0]?.id ?? "");
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const visibleComponents = model.components.filter((component) => {
    if (normalizedQuery === "") return true;
    return [component.displayName, component.id, component.category, component.description ?? ""]
      .join(" ")
      .toLocaleLowerCase("en-US")
      .includes(normalizedQuery);
  });
  const selected = visibleComponents.find(({ id }) => id === selectedId) ?? visibleComponents[0];

  useEffect(() => {
    if (selected !== undefined && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  return (
    <section
      aria-labelledby="design-system-title"
      className={styles.designSystemArea}
      data-design-system="true"
    >
      <h1
        className={styles.visuallyHidden}
        data-route-heading
        id="design-system-title"
        tabIndex={-1}
      >
        Design system
      </h1>
      <header className={styles.designSystemHero}>
        <div>
          <p className={styles.eyebrow}>Design system · {project.name}</p>
          <h2>One Catalog, one source of truth.</h2>
          <p>
            Explore foundations, component contracts, documented states and safe scenarios generated
            from the installed Catalog and the current Source.
          </p>
        </div>
        <div className={styles.designSystemHeroMeta}>
          <strong>{model.catalog.id}</strong>
          <span>
            v{model.catalog.version} · {model.catalog.target}
          </span>
          <small>
            {model.components.length} components · {model.usageTotal} Source uses
          </small>
        </div>
      </header>

      {model.adapterMismatchCount > 0 ? (
        <p className={styles.designSystemMismatch} role="alert" data-design-system-mismatch="true">
          {model.adapterMismatchCount} component contract
          {model.adapterMismatchCount === 1 ? " is" : "s are"} missing a matching runtime adapter.
          Documentation remains visible, but those previews are blocked until the mismatch is
          repaired.
        </p>
      ) : null}

      <section
        aria-labelledby="design-system-foundations-title"
        className={styles.designSystemFoundations}
      >
        <div className={styles.designSystemSectionHeading}>
          <div>
            <h2 id="design-system-foundations-title">Foundations</h2>
            <p>
              DESEN Neutral defaults are editable through the existing token and style boundaries.
            </p>
          </div>
          <code data-source-fingerprint={model.sourceFingerprint}>
            {model.sourceFingerprint.slice(0, 12)}…
          </code>
        </div>
        <div className={styles.designSystemFoundationGrid}>
          <DesignSystemFoundationGroup items={model.foundations.colors} title="Colors" />
          <DesignSystemFoundationGroup items={model.foundations.spacing} title="Spacing" />
          <DesignSystemFoundationGroup items={model.foundations.typography} title="Type" />
          <DesignSystemFoundationGroup items={model.foundations.radii} title="Radii" />
        </div>
      </section>

      <div className={styles.designSystemExplorerLayout}>
        <aside aria-label="Design system components" className={styles.designSystemGallery}>
          <div className={styles.designSystemSectionHeading}>
            <div>
              <h2>Components</h2>
              <p>
                {visibleComponents.length} of {model.components.length} shown
              </p>
            </div>
          </div>
          <label className={styles.designSystemSearch}>
            <span className={styles.visuallyHidden}>Search design system components</span>
            <input
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search components"
              type="search"
              value={query}
            />
          </label>
          <ul className={styles.designSystemComponentList}>
            {visibleComponents.map((component) => (
              <li key={component.id}>
                <button
                  aria-current={component.id === selected?.id ? "true" : undefined}
                  onClick={() => setSelectedId(component.id)}
                  type="button"
                >
                  <span aria-hidden="true" className={styles.designSystemComponentGlyph}>
                    {component.displayName.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{component.displayName}</strong>
                    <small>
                      {component.category} · {component.usageCount} used
                    </small>
                  </span>
                  <span className={styles.designSystemComponentChevron} aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {visibleComponents.length === 0 ? (
            <p className={styles.designSystemEmpty}>No component matches this search.</p>
          ) : null}
        </aside>
        {selected === undefined ? (
          <div className={styles.designSystemDetailEmpty}>
            <strong>Select a component.</strong>
            <span>Its Catalog contract and scenarios will appear here.</span>
          </div>
        ) : (
          <DesignSystemComponentDetail component={selected} />
        )}
      </div>
    </section>
  );
}

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

interface AdvancedSourceDraft {
  readonly text: string;
  readonly baselineFingerprint: string;
  readonly failure: AuthoringSourceDraftFailure | null;
}

/** Ephemeral canvas chrome belongs to one currently previewed Source surface, never to Source. */
interface CanvasSurfacePresentation {
  readonly previewFrame: ReturnType<typeof createAuthoringCanvasPreviewFrame> | null;
  readonly viewport: ReturnType<typeof createAuthoringCanvasViewport>;
}

function createCanvasSurfacePresentation(): CanvasSurfacePresentation {
  return Object.freeze({
    previewFrame: null,
    viewport: createAuthoringCanvasViewport(),
  });
}

const LAYER_DROP_MIDPOINT_HYSTERESIS_PX = 4;
const WORKSPACE_PROFILE_MOUNT_IDENTITIES = new WeakMap<ProjectWorkspaceProfileHandle, string>();
let nextWorkspaceProfileMountIdentity = 1;

function workspaceProfileMountIdentity(profile: ProjectWorkspaceProfileHandle): string {
  const current = WORKSPACE_PROFILE_MOUNT_IDENTITIES.get(profile);
  if (current !== undefined) return current;
  if (!Number.isSafeInteger(nextWorkspaceProfileMountIdentity)) {
    throw new TypeError("The workspace profile mount identity space is exhausted.");
  }
  const created = `workspace-profile-${nextWorkspaceProfileMountIdentity}`;
  nextWorkspaceProfileMountIdentity += 1;
  WORKSPACE_PROFILE_MOUNT_IDENTITIES.set(profile, created);
  return created;
}

/**
 * Creates the synthetic authoring host boundary without inheriting product side-effect ports.
 *
 * @remarks Every host callback is replaced with a bounded inert implementation. Only the explicit
 * Catalog fixture operation controller can execute in Run preview; product navigation, storage,
 * resources, tokens, context, environment, clock and diagnostics never cross this boundary.
 */
export function createAuthoringFixtureHostPorts(
  _baseHostPorts: RuntimeHostPorts,
  operationPort: RuntimeOperationPort,
): RuntimeHostPorts {
  return createAuthoringRunHostPorts(operationPort, {
    navigate: () => Object.freeze({ status: "denied" }),
  });
}

type AuthoringDragIntent =
  | Readonly<{ readonly kind: "component"; readonly componentId: string }>
  | Readonly<{
      readonly kind: "node";
      readonly nodeId: string;
      readonly nodeIds: readonly string[];
    }>;

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
  readonly onToggleSelection: (node: AuthoringLayerNode, extend: boolean) => void;
  readonly route: AuthoringSlotRoute;
  readonly rootNodeId: string;
  readonly selectedSourceNodeId: string | null;
  readonly selectedSourceNodeIds: readonly string[];
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
    const compatibility = evaluateAuthoringSlotBatchPlacement(
      route,
      authoringModel,
      target,
      dragIntent.nodeIds,
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
  selectedSourceNodeIds,
  onBoundaryDragEnter,
  onBoundaryDragOver,
  onBoundaryDrop,
}: Readonly<
  Pick<
    LayerSelectionProps,
    | "activeSlot"
    | "authoringModel"
    | "dragIntent"
    | "onApplyIntent"
    | "route"
    | "selectedSourceNodeIds"
  > & {
    readonly index: number;
    readonly owner: AuthoringBehaviorLayer | AuthoringLayerNode;
    readonly slot: AuthoringSlotState;
    readonly dropHovered: boolean;
    readonly onBoundaryDragEnter: (event: DragEvent<HTMLLIElement>) => void;
    readonly onBoundaryDragOver: (event: DragEvent<HTMLLIElement>) => void;
    readonly onBoundaryDrop: (event: DragEvent<HTMLLIElement>) => void;
  }
>) {
  const target = slotTarget(route, owner, slot);
  // Preserve the complete selected group for preflight. In particular, a selected surface root
  // must reject the entire operation rather than being silently dropped while its siblings move.
  const selectedNodeIds = selectedSourceNodeIds;
  const singleSelectedPlacement =
    selectedNodeIds.length === 1
      ? evaluateAuthoringSlotPlacement(
          route,
          authoringModel,
          target,
          selectedNodeIds[0] ?? "",
          index,
        )
      : null;
  const selectedPlacement =
    singleSelectedPlacement ??
    (selectedNodeIds.length > 1
      ? evaluateAuthoringSlotBatchPlacement(route, authoringModel, target, selectedNodeIds, index)
      : null);
  const selectedMovable =
    selectedPlacement?.accepted === true && selectedPlacement.changesSource === true;
  const dragAdmission =
    dragIntent === null
      ? null
      : evaluateDragIntent(route, authoringModel, target, index, dragIntent);
  const dropReady = dragAdmission?.status === "accepted";

  const active = activeSlot !== null && isSameAuthoringSlotSelection(activeSlot, target);
  const position = index + 1;
  const placementLabel =
    selectedNodeIds.length <= 1
      ? (() => {
          const selectedNodeId = selectedNodeIds[0] ?? "selected layer";
          const selectedPosition =
            singleSelectedPlacement?.accepted === true
              ? singleSelectedPlacement.finalIndex + 1
              : position;
          return selectedPlacement?.accepted === true && !selectedPlacement.changesSource
            ? `Keep ${selectedNodeId} at its current position ${selectedPosition} in ${owner.displayName} ${owner.id} ${slot.name} slot`
            : `Move ${selectedNodeId} to ${owner.displayName} ${owner.id} ${slot.name} slot at position ${selectedPosition}`;
        })()
      : selectedPlacement?.accepted === true && !selectedPlacement.changesSource
        ? `Keep ${selectedNodeIds.length} selected layers at their current position in ${owner.displayName} ${owner.id} ${slot.name} slot`
        : `Move ${selectedNodeIds.length} selected layers to ${owner.displayName} ${owner.id} ${slot.name} slot at position ${position}`;

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
      onDragEnter={onBoundaryDragEnter}
      onDragOver={onBoundaryDragOver}
      onDrop={onBoundaryDrop}
    >
      <span
        aria-hidden="true"
        className={styles.slotBoundaryHitArea}
        data-slot-boundary-hit-area="true"
      />
      <span aria-hidden="true" className={styles.slotBoundaryLine} />
      <span aria-hidden="true" className={styles.slotBoundaryCue}>
        {dragAdmission?.status === "noop" ? "Current position" : "Drop here"}
      </span>
      <button
        aria-label={placementLabel}
        disabled={!selectedMovable}
        onClick={() => {
          const nodeId = selectedNodeIds[0];
          if (nodeId === undefined) return;
          onApplyIntent(
            target,
            index,
            Object.freeze({ kind: "node", nodeId, nodeIds: Object.freeze([...selectedNodeIds]) }),
          );
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
  const slotSurfaceRef = useRef<HTMLDivElement>(null);
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

  function scheduleEdgeScroll(
    event: DragEvent<HTMLElement>,
    list: HTMLUListElement,
    slotSurface: HTMLDivElement,
  ): void {
    const scrollSurface = slotSurface.closest<HTMLElement>('[data-authoring-pane-scroll="layers"]');
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
      slotSurface,
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

  function updateDropProjection(event: DragEvent<HTMLElement>): void {
    if (interaction.dragIntent === null) return;
    const list = listRef.current;
    const slotSurface = slotSurfaceRef.current;
    if (list === null || slotSurface === null) return;
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
    scheduleEdgeScroll(event, list, slotSurface);
  }

  function receiveDrop(event: DragEvent<HTMLElement>): void {
    if (interaction.dragIntent === null) return;
    const list = listRef.current;
    const slotSurface = slotSurfaceRef.current;
    if (list === null || slotSurface === null) return;
    event.stopPropagation();
    const currentBounds = slotSurface.getBoundingClientRect();
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
      ref={slotSurfaceRef}
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
          onBoundaryDragEnter={updateDropProjection}
          onBoundaryDragOver={updateDropProjection}
          onBoundaryDrop={receiveDrop}
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
              onBoundaryDragEnter={updateDropProjection}
              onBoundaryDragOver={updateDropProjection}
              onBoundaryDrop={receiveDrop}
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
  selectedSourceNodeIds,
}: Readonly<
  LayerSelectionProps & {
    readonly movable?: boolean;
    readonly node: AuthoringLayerNode;
  }
>) {
  const selected = selectedSourceNodeIds.includes(node.id);
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
    selectedSourceNodeIds,
  } satisfies LayerSelectionProps;

  return (
    <li className={styles.layerNode} data-layer-node="true">
      <div
        className={styles.layerRow}
        data-category={node.capabilityId.split("/").at(-1)}
        data-dragging={dragIntent?.kind === "node" && dragIntent.nodeIds.includes(node.id)}
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
              onStartDrag(
                Object.freeze({ kind: "node", nodeId: node.id, nodeIds: Object.freeze([node.id]) }),
              );
            }}
            title={`Drag ${node.displayName} layer`}
          />
        ) : null}
        <button
          aria-label={`${selected ? "Deselect" : "Select"} ${node.displayName} layer · ${node.id}${node.conditional ? " · Conditional" : ""}`}
          aria-pressed={selected}
          className={styles.layerSelectAction}
          data-layer-source-node-id={node.id}
          onClick={(event) =>
            onToggleSelection(node, event.shiftKey || event.metaKey || event.ctrlKey)
          }
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
  selectedSourceNodeIds,
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
    selectedSourceNodeIds,
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
  const surfaceTree = model.surfaces.find((surface) => surface.id === selectedSurface.sourceId);
  if (surfaceTree === undefined) {
    return (
      <div className={styles.panelEmptyState}>
        <span className={styles.emptyGlyph} aria-hidden="true" />
        <strong>No Source tree for {selectedSurface.name}</strong>
        <p>
          This preview surface has no exact Source tree. DESEN will not substitute another surface.
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
          <small>{selectedSurface.sourceId}</small>
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
          ? interaction.dragIntent.nodeIds.length === 1
            ? `Moving ${interaction.dragIntent.nodeId} · release when the wide highlighted gap locks in.`
            : `Moving ${interaction.dragIntent.nodeIds.length} selected layers · release when the wide highlighted gap locks in.`
          : "Drag the dotted grip; each row snaps to the gap above or below it. Place also works."}
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

  function enterComponentDrop(event: DragEvent<HTMLDivElement>): void {
    if (!componentDropReady) return;
    admitComponentDrop(event);
    panelDragEnterDepth.current += 1;
  }

  function leaveComponentDrop(event: DragEvent<HTMLDivElement>): void {
    if (!componentDropReady) return;
    event.stopPropagation();
    panelDragEnterDepth.current = Math.max(0, panelDragEnterDepth.current - 1);
    if (panelDragEnterDepth.current === 0) setPanelDragHovered(false);
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
  const catalogTargets = [...new Set(model.catalogs.map(({ target }) => target))];
  const catalogTitle =
    model.catalogs.length === 1 ? model.catalogs[0]?.id : `${model.catalogs.length} Catalogs`;
  const catalogBadge =
    model.catalogs.length === 1
      ? `v${model.catalogs[0]?.version ?? ""}`
      : `${model.catalogs.length} packages`;

  return (
    <div
      className={styles.componentsView}
      data-component-drag-active={dragIntent?.kind === "component"}
      data-drop-hovered={componentDropReady && panelDragHovered}
      onDragEnter={enterComponentDrop}
      onDragLeave={leaveComponentDrop}
      onDragOver={admitComponentDrop}
      onDrop={receiveComponentDrop}
    >
      <div className={styles.catalogSummary}>
        <span>
          <strong>{catalogTargets.join(" · ")}</strong>
          <small>{catalogTitle}</small>
        </span>
        <span className={styles.versionBadge}>{catalogBadge}</span>
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
        onDragEnter={enterComponentDrop}
        onDragLeave={leaveComponentDrop}
        onDragOver={admitComponentDrop}
        onDrop={receiveComponentDrop}
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
                  ? "Drop target"
                  : `Release to add ${draggedComponent.displayName}`}
              </span>
              <strong>
                {draggedComponent === undefined
                  ? `${readySlot.owner.displayName} · ${readySlot.slot.name}`
                  : `${readySlot.owner.displayName} · ${readySlot.slot.name}`}
              </strong>
              <small>
                {readySlot.owner.id} · {readySlot.slot.name} slot
                {draggedComponent === undefined
                  ? ` · position ${readySlot.slot.children.length + 1} · drag a dotted grip to this target, or click Add`
                  : ` · drop on this target or anywhere in Components · position ${readySlot.slot.children.length + 1}`}
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
                                title={`Drag ${component.displayName} to the highlighted drop target above`}
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
  hidden,
  masterControls,
  interactive,
  model,
  onBatchSlotPlacement,
  onDeleteSelection,
  onSlotEdit,
  onToggleSelection,
  route,
  selection,
  selectedSourceNodeId,
  selectedSourceNodeIds,
  selectedSurface,
}: Readonly<{
  readonly hidden: boolean;
  readonly masterControls?: ReactNode;
  readonly interactive: boolean;
  readonly model: CatalogAuthoringModel;
  readonly onBatchSlotPlacement: (
    target: AuthoringSlotSelection,
    index: number,
    nodeIds: readonly string[],
  ) => AuthoringSlotBatchPlacementResult;
  readonly onDeleteSelection: () => AuthoringSlotEditResult;
  readonly onSlotEdit: (
    target: AuthoringSlotSelection,
    edit: AuthoringSlotEdit,
  ) => AuthoringSlotEditResult;
  readonly onToggleSelection: (node: AuthoringLayerNode, extend: boolean) => void;
  readonly route: AuthoringSlotRoute;
  readonly selection: AuthoringComponentSelection | null;
  readonly selectedSourceNodeId: string | null;
  readonly selectedSourceNodeIds: readonly string[];
  readonly selectedSurface: DesenAppSurfaceSummary;
}>) {
  const [activeSlot, setActiveSlot] = useState<AuthoringSlotSelection | null>(null);
  const [activeDropProjection, setActiveDropProjection] = useState<AuthoringDropProjection | null>(
    null,
  );
  const [dragIntent, setDragIntent] = useState<AuthoringDragIntent | null>(null);
  const [dragNotice, setDragNotice] = useState("");
  const [notice, setNotice] = useState("");
  const panelId = useId();
  const authoringPanel = useRef<HTMLElement>(null);
  const componentsPane = useRef<HTMLDivElement>(null);
  const layersPane = useRef<HTMLDivElement>(null);
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
    model.surfaces.find(({ id }) => id === selectedSurface.sourceId)?.root.id ?? null;
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
    setDragNotice("");
    setNotice("The previous slot target is no longer current.");
  }, [model, resetDragSession, slotProjection?.status]);

  useEffect(() => {
    if (interactive) return;
    resetDragSession();
    setActiveDropProjection(null);
    setDragIntent(null);
    setDragNotice("");
  }, [interactive, resetDragSession]);

  useEffect(() => {
    resetDragSession();
    setActiveDropProjection(null);
    setDragIntent(null);
    setDragNotice("");
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
    componentsPane.current?.scrollTo?.({ behavior: "smooth", top: 0 });
    componentsPane.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    setNotice(`Choose a Catalog component for ${target.ownerId} · ${target.slot}.`);
  }

  function toggleLayer(node: AuthoringLayerNode, extend: boolean): void {
    if (!interactive) return;
    setDragNotice("");
    setNotice("");
    onToggleSelection(node, extend);
  }

  function applyIntent(
    target: AuthoringSlotSelection,
    index: number,
    intent: AuthoringDragIntent,
  ): void {
    if (!interactive) return;
    const targetProjection = projectAuthoringSlotSelection(target, route, model);
    const result =
      intent.kind === "component"
        ? onSlotEdit(target, { kind: "insert", componentId: intent.componentId, index })
        : intent.nodeIds.length > 1
          ? onBatchSlotPlacement(target, index, intent.nodeIds)
          : onSlotEdit(target, { kind: "place", nodeId: intent.nodeId, index });
    resetDragSession();
    setActiveDropProjection(null);
    setDragIntent(null);
    setDragNotice("");
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
                : result.reason === "cycle-rejected"
                  ? "A selected layer cannot move into its own subtree."
                  : result.reason === "target-invalid"
                    ? "The selected node or slot is no longer current."
                    : "The slot change was rejected safely.";
      setNotice(message);
      return;
    }
    const changedNodeIds = "nodeIds" in result ? result.nodeIds : Object.freeze([result.nodeId]);
    const changedNodeId = changedNodeIds.at(-1) ?? "selected layer";
    pendingLayerFocus.current = changedNodeIds.at(-1) ?? null;
    setNotice(
      result.operation === "insert"
        ? `Inserted ${model.components.find(({ id }) => id === (intent.kind === "component" ? intent.componentId : ""))?.displayName ?? changedNodeId} in ${targetProjection.status === "ready" ? `${targetProjection.owner.displayName} ${targetProjection.slot.name} slot at position ${index + 1}` : "the selected slot"}. Selected in Layers · use Remove layer above or press Delete/Backspace.`
        : "nodeIds" in result && result.nodeIds.length > 1
          ? `Moved ${result.nodeIds.length} selected layers together to ${targetProjection.status === "ready" ? `${targetProjection.owner.displayName} ${targetProjection.slot.name} slot` : "the selected slot"}.`
          : result.operation === "move"
            ? `Moved ${changedNodeId} to ${targetProjection.status === "ready" ? `${targetProjection.owner.displayName} ${targetProjection.slot.name} slot` : "the selected slot"}.`
            : `Reordered ${changedNodeId} in ${targetProjection.status === "ready" ? `${targetProjection.owner.displayName} ${targetProjection.slot.name} slot` : "the selected slot"}.`,
    );
  }

  function requestSlotChoice(): void {
    if (!interactive) return;
    layersPane.current?.focus({ preventScroll: true });
    layersPane.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    setNotice("Choose a named slot in Layers, then return to Components.");
  }

  function startDrag(intent: AuthoringDragIntent): void {
    if (!interactive) return;
    resetDragSession();
    setActiveDropProjection(null);
    const resolvedIntent =
      intent.kind === "node" && selectedSourceNodeIds.includes(intent.nodeId)
        ? Object.freeze({
            kind: "node" as const,
            nodeId: intent.nodeId,
            nodeIds: Object.freeze([...selectedSourceNodeIds]),
          })
        : intent;
    setDragIntent(resolvedIntent);
    setDragNotice(
      resolvedIntent.kind === "component"
        ? `Dragging ${model.components.find(({ id }) => id === resolvedIntent.componentId)?.displayName ?? "component"} · release on the highlighted drop target in Components.`
        : resolvedIntent.nodeIds.length === 1
          ? "Release when the wide highlighted Layers gap locks in."
          : `Dragging ${resolvedIntent.nodeIds.length} selected layers together · release when the wide highlighted Layers gap locks in.`,
    );
  }

  function clearDrag(): void {
    resetDragSession();
    setActiveDropProjection(null);
    setDragIntent(null);
    setDragNotice("");
  }

  const deleteSelection = useCallback((): void => {
    if (!interactive) return;
    if (selection === null || deletionCompatibility?.accepted !== true) return;
    const result = onDeleteSelection();
    resetDragSession();
    setDragIntent(null);
    setDragNotice("");
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
    layersPane.current?.focus({ preventScroll: true });
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
      data-authoring-layout="split"
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
      <section
        aria-labelledby={`${panelId}-components-heading`}
        className={styles.authoringPane}
        data-authoring-pane="components"
      >
        <div className={styles.authoringPaneHeader}>
          <span>
            <strong id={`${panelId}-components-heading`}>Components</strong>
            <small>Catalog library</small>
          </span>
        </div>
        <div
          className={styles.authoringPaneBody}
          data-authoring-pane-scroll="components"
          ref={componentsPane}
          tabIndex={-1}
        >
          {masterControls}
          <ComponentLibrary
            active
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
      </section>
      <section
        aria-labelledby={`${panelId}-layers-heading`}
        className={styles.authoringPane}
        data-authoring-pane="layers"
      >
        <div className={styles.authoringPaneHeader}>
          <span>
            <strong id={`${panelId}-layers-heading`}>Layers</strong>
            <small>Source tree</small>
          </span>
        </div>
        {selection === null ? null : (
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
          className={styles.authoringPaneBody}
          data-authoring-pane-scroll="layers"
          ref={layersPane}
          tabIndex={-1}
        >
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
            rootNodeId={
              model.surfaces.find(({ id }) => id === selectedSurface.sourceId)?.root.id ?? ""
            }
            route={route}
            selectedSourceNodeId={selectedSourceNodeId}
            selectedSourceNodeIds={selectedSourceNodeIds}
            selectedSurface={selectedSurface}
          />
        </div>
      </section>
      <p
        aria-atomic="true"
        aria-label="Authoring status"
        aria-live="polite"
        className={styles.authoringBoundary}
        data-authoring-boundary="true"
        role="status"
      >
        {dragNotice ||
          notice ||
          (selection === null
            ? slotProjection?.status === "ready"
              ? `Placement target · ${slotProjection.owner.displayName} ${slotProjection.owner.id} · ${slotProjection.slot.name} slot.`
              : "Choose a Source layer to inspect, move, or edit its properties."
            : `Selected · ${selection.displayName}${selection.conditional ? " · Conditional" : ""}`)}
      </p>
    </aside>
  );
}

function SurfaceEditor({
  authoringClipboard,
  authoringProjectRecord,
  initialDocument,
  integrationBinding,
  preparedPersistenceController,
  persistencePort,
  publicationPort,
  project,
  selectedSurface,
  workspaceProfile,
  workspaceSnapshot,
}: Readonly<{
  /** Project-scoped clipboard authority retained while admitted surfaces remount. */
  readonly authoringClipboard: { current: DesenEditorClipboardPayload | null };
  /** The current aggregate T02 record when this normal workspace persists one. */
  readonly authoringProjectRecord: EditableProjectRecord | null;
  readonly initialDocument: DesenEditorDocument;
  readonly integrationBinding: AuthoringIntegrationBindingHandle | null;
  readonly preparedPersistenceController: AuthoringPersistenceController | null | undefined;
  readonly persistencePort: DesenEditorPersistencePort | null;
  readonly publicationPort: AuthoringPublicationPort | null;
  readonly project: DesenAppProjectSummary;
  readonly selectedSurface: DesenAppSurfaceSummary;
  readonly workspaceProfile: ProjectWorkspaceProfileHandle;
  readonly workspaceSnapshot: ProjectWorkspaceProfileSnapshot;
}>) {
  const [mode, setMode] = useState<SurfaceEditorMode>("design");
  const projectController = useProjectAuthoringController(workspaceProfile);
  const liveProjectState = useSyncExternalStore(
    projectController?.subscribe ?? subscribeUnavailablePersistence,
    projectController?.read ?? readUnavailablePersistence,
    projectController?.read ?? readUnavailablePersistence,
  );
  const [masterController, setMasterController] = useState<ProjectMasterDraftController | null>(
    null,
  );
  const masterControllerRef = useRef<ProjectMasterDraftController | null>(null);
  const masterLifetime = useRef<ProjectMasterDraftController | null>(null);
  const masterState = useSyncExternalStore(
    masterController?.subscribe ?? subscribeUnavailablePersistence,
    masterController?.read ?? readUnavailablePersistence,
    masterController?.read ?? readUnavailablePersistence,
  );
  const editorProjectController = masterController ?? projectController;
  const projectState = masterState ?? liveProjectState;
  const [masterNotice, setMasterNotice] = useState("");
  useEffect(() => {
    masterLifetime.current = masterController;
    return () => {
      if (masterLifetime.current === masterController) masterLifetime.current = null;
      queueMicrotask(() => {
        if (masterLifetime.current !== masterController) masterController?.dispose();
      });
    };
  }, [masterController]);
  const [executionContext, setExecutionContext] = useState<"synthetic" | "integration">(
    "synthetic",
  );
  const [runDestination, setRunDestination] = useState<AuthoringRunDestination | null>(null);
  const [runEpoch, setRunEpoch] = useState(0);
  const previewSurfaceId = runDestination?.surfaceId ?? selectedSurface.sourceId;
  const previewSurface =
    project.surfaces.find(({ sourceId }) => sourceId === previewSurfaceId) ?? selectedSurface;
  const [selection, setSelection] = useState<AuthoringComponentSelection | null>(null);
  const [styleTarget, setStyleTarget] = useState<AuthoringStyleTarget>(AUTHORING_STYLE_BASE_TARGET);
  const stylePreviewViewportId: AuthoringStylePreviewViewportId =
    styleTarget.kind === "base" ||
    styleTarget.kind === "visual-state" ||
    styleTarget.kind === "variant"
      ? "desktop"
      : styleTarget.breakpoint;
  const stylePreviewViewport = AUTHORING_STYLE_PREVIEW_VIEWPORTS[stylePreviewViewportId];
  const [directSelections, setDirectSelections] = useState<readonly AuthoringComponentSelection[]>(
    Object.freeze([]),
  );
  const [canvasPresentations, setCanvasPresentations] = useState<
    Readonly<Record<string, CanvasSurfacePresentation>>
  >(() => Object.freeze({}));
  const canvasPresentation =
    canvasPresentations[previewSurfaceId] ?? createCanvasSurfacePresentation();
  const canvasPreviewFrame = canvasPresentation.previewFrame;
  const canvasViewport = canvasPresentation.viewport;

  function updateCanvasPresentation(
    update: (current: CanvasSurfacePresentation) => CanvasSurfacePresentation,
  ): void {
    setCanvasPresentations((current) => {
      const surfacePresentation = current[previewSurfaceId] ?? createCanvasSurfacePresentation();
      const nextPresentation = update(surfacePresentation);
      return Object.freeze({ ...current, [previewSurfaceId]: nextPresentation });
    });
  }

  function selectOne(next: AuthoringComponentSelection | null): void {
    setSelection(next);
    setDirectSelections(next === null ? Object.freeze([]) : Object.freeze([next]));
  }
  const [transientDiagnostics, setTransientDiagnostics] =
    useState<TransientAuthoringDiagnostics | null>(null);
  const [diagnosticSelection, setDiagnosticSelection] =
    useState<AuthoringDiagnosticSelection | null>(null);
  const diagnosticFocusRequest = useRef(0);
  const [sourceDraft, setSourceDraft] = useState<AdvancedSourceDraft | null>(null);
  const sourceDraftRef = useRef<AdvancedSourceDraft | null>(null);
  const [sourceDraftNotice, setSourceDraftNotice] = useState("");
  // A surface session owns one Source baseline. A parent must remount the keyed editor to open a
  // different Source; prop identity changes cannot replace only persistence/publication authority.
  const [mountedInitialDocument] = useState(() => initialDocument);
  const [initialDocumentCanonical] = useState(() => canonicalizeJson(mountedInitialDocument));
  const [localAuthoringSession, setAuthoringSession] = useState(() =>
    Object.freeze({
      document: mountedInitialDocument,
      preview: prepareAuthoringPreviewBundle(
        mountedInitialDocument,
        workspaceSnapshot.catalogPackages,
      ),
    }),
  );
  const authoringSession = projectState?.session ?? localAuthoringSession;
  const authoringHistory = useRef<DesenEditorHistory | null>(null);
  if (projectController === null && authoringHistory.current === null) {
    const createdHistory = createDesenEditorHistory(mountedInitialDocument);
    if (createdHistory === undefined)
      throw new TypeError("The bounded authoring history could not be created.");
    authoringHistory.current = createdHistory;
  }
  const [historyNotice, setHistoryNotice] = useState("");
  const [scenarioChoice, setScenarioChoice] = useState<
    Readonly<{ readonly ownerKey: string | null; readonly value: AuthoringScenarioValue }>
  >(() => Object.freeze({ ownerKey: null, value: AUTHORING_SOURCE_SCENARIO_VALUE }));
  const inMemoryBaselineCanonical = useRef(initialDocumentCanonical);
  const inMemoryCurrentCanonical = useRef(initialDocumentCanonical);
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
    () => Object.freeze({ projectId: project.id, surfaceId: selectedSurface.sourceId }),
    [project.id, selectedSurface.sourceId],
  );
  const authenticatedPreparedPersistenceController = useMemo(
    () =>
      preparedPersistenceController === undefined || preparedPersistenceController === null
        ? preparedPersistenceController
        : authenticateAuthoringPersistenceControllerProfile(
              preparedPersistenceController,
              workspaceProfile,
            ).status === "authenticated"
          ? preparedPersistenceController
          : null,
    [preparedPersistenceController, workspaceProfile],
  );
  const ownedPersistenceCreation = useMemo(
    () =>
      authenticatedPreparedPersistenceController !== undefined || persistencePort === null
        ? null
        : createAuthoringPersistenceController({
            route,
            document: mountedInitialDocument,
            profile: workspaceProfile,
            persistencePort,
          }),
    [
      mountedInitialDocument,
      persistencePort,
      authenticatedPreparedPersistenceController,
      route,
      workspaceProfile,
    ],
  );
  const persistenceController =
    authenticatedPreparedPersistenceController !== undefined
      ? authenticatedPreparedPersistenceController
      : ownedPersistenceCreation?.ok === true
        ? ownedPersistenceCreation.controller
        : null;
  const ownsPersistenceController = authenticatedPreparedPersistenceController === undefined;
  const persistenceState = useSyncExternalStore(
    persistenceController?.subscribe ?? subscribeUnavailablePersistence,
    persistenceController?.read ?? readUnavailablePersistence,
    persistenceController?.read ?? readUnavailablePersistence,
  );
  const persistenceControllerLifetime = useRef<AuthoringPersistenceController | null>(null);
  const persistenceProjection = useMemo(() => {
    const projection = projectPersistenceControls(persistenceState, inMemoryDirtyProjection);
    return projectState === null
      ? projection
      : Object.freeze({
          ...projection,
          dirty: projectState.dirty || (persistenceState?.dirty ?? false),
          reopenRequired: projectState.reopenRequired || projection.reopenRequired,
        });
  }, [inMemoryDirtyProjection, persistenceState, projectState]);
  const publicationBinding = useMemo(() => {
    if (publicationPort === null) return null;
    const initialPreview = prepareAuthoringPreviewBundle(
      mountedInitialDocument,
      workspaceSnapshot.catalogPackages,
    );
    if (!initialPreview.ok) return null;
    const lifetime: AuthoringPublicationLifetimeFence = { active: false };
    return Object.freeze({
      lifetime,
      creation: createAuthoringPublicationController({
        profile: workspaceProfile,
        route,
        snapshot: Object.freeze({
          document: mountedInitialDocument,
          savedDocument: null,
          sourceGeneration: null,
          persistenceAuthority: persistenceController === null ? "unavailable" : "ready",
          previewRevision: initialPreview.revision,
        }),
        publicationPort: createLifetimeFencedPublicationPort(publicationPort, lifetime),
      }),
    });
  }, [
    mountedInitialDocument,
    persistenceController,
    publicationPort,
    route,
    workspaceProfile,
    workspaceSnapshot.catalogPackages,
  ]);
  const publicationCreation = publicationBinding?.creation ?? null;
  const publicationController =
    publicationCreation?.ok === true ? publicationCreation.controller : null;
  const publicationState = useSyncExternalStore(
    publicationController?.subscribe ?? subscribeUnavailablePublication,
    publicationController?.read ?? readUnavailablePublication,
    publicationController?.read ?? readUnavailablePublication,
  );
  const publicationControllerLifetime = useRef<AuthoringPublicationController | null>(null);
  const publicationProjection = useMemo(
    () => projectPublicationControls(publicationState),
    [publicationState],
  );
  const publicationPending = publicationState !== null && publicationState.pending !== null;
  const readCurrentPublicationSnapshot = useCallback((): AuthoringPublicationSnapshot => {
    const livePersistence =
      persistenceController !== null &&
      persistenceControllerLifetime.current === persistenceController &&
      !persistenceController.read().disposed
        ? persistenceController.read()
        : null;
    const persistenceAuthority =
      livePersistence === null
        ? "unavailable"
        : livePersistence.pending !== null
          ? "pending"
          : livePersistence.reopenRequired
            ? "reopen-required"
            : "ready";
    // Publication always observes the live aggregate, never an isolated master projection.
    const liveSession = projectController?.read().session;
    const publicationPreview = liveSession?.preview ?? preview;
    return Object.freeze({
      document: liveSession?.document ?? document,
      savedDocument: livePersistence?.savedDocument ?? null,
      sourceGeneration: livePersistence?.generation ?? null,
      persistenceAuthority,
      previewRevision: publicationPreview.ok
        ? publicationPreview.revision
        : UNAVAILABLE_PREVIEW_REVISION,
    });
  }, [document, persistenceController, preview, projectController]);
  const preparedModel = useMemo(
    () => prepareCatalogAuthoringModel(workspaceSnapshot.catalogs, document),
    [document, workspaceSnapshot.catalogs],
  );
  const designTokenResolution = useMemo(
    () =>
      authoringProjectRecord === null ? null : resolveAuthoringDesignTokens(authoringProjectRecord),
    [authoringProjectRecord],
  );
  const styleTokenOptions =
    designTokenResolution?.status === "resolved"
      ? designTokenResolution.styleTokens
      : EMPTY_STYLE_TOKEN_OPTIONS;
  const resolveStyleToken: RuntimeTokenPort["resolve"] =
    designTokenResolution?.status === "resolved"
      ? (request) => designTokenResolution.resolveRuntimeToken(request.token)
      : resolveMissingAuthoringToken;
  const styleModel = useMemo(
    () =>
      preparedModel.ok
        ? prepareAuthoringStyleModel(preparedModel.model, route, selection, styleTokenOptions)
        : Object.freeze({ status: "rejected" as const }),
    [preparedModel, route, selection, styleTokenOptions],
  );
  const variantModel = useMemo<AuthoringVariantModelResult>(
    () =>
      preparedModel.ok
        ? prepareAuthoringVariantModel(preparedModel.model, route, selection)
        : Object.freeze({ status: "rejected" as const }),
    [preparedModel, route, selection],
  );
  const canvasFrame = useMemo(
    () => projectAuthoringCanvasFrame(document, previewSurfaceId, workspaceSnapshot.catalogs),
    [document, previewSurfaceId, workspaceSnapshot.catalogs],
  );
  const canvasFrameOrientation =
    canvasFrame.status !== "ready"
      ? null
      : canvasFrame.frame.height > canvasFrame.frame.width
        ? "Portrait"
        : canvasFrame.frame.height < canvasFrame.frame.width
          ? "Landscape"
          : "Square";
  const effectiveCanvasFrame =
    canvasFrame.status !== "ready"
      ? null
      : styleTarget.kind === "base" ||
          styleTarget.kind === "visual-state" ||
          styleTarget.kind === "variant"
        ? (canvasPreviewFrame ?? canvasFrame.frame)
        : Object.freeze({
            height: stylePreviewViewport.height as number,
            width: stylePreviewViewport.width as number,
          });
  const previewFrameIsResized =
    canvasFrame.status === "ready" &&
    (styleTarget.kind === "breakpoint" ||
      (canvasPreviewFrame !== null &&
        (canvasPreviewFrame.width !== canvasFrame.frame.width ||
          canvasPreviewFrame.height !== canvasFrame.frame.height)));
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
  const behaviorProjection = useMemo(
    () =>
      selection === null
        ? Object.freeze({ status: "rejected" as const })
        : projectAuthoringBehaviorControls(
            document,
            selectedSurface.sourceId,
            selection.sourceNodeId,
          ),
    [document, selectedSurface.sourceId, selection],
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
            workspaceSnapshot.catalogPackages,
          )
        : null,
    [
      activeScenarioValue,
      document,
      preparedModel,
      preview,
      route,
      selection,
      workspaceSnapshot.catalogPackages,
    ],
  );
  const baseEffectivePreview =
    activeScenarioValue === AUTHORING_SOURCE_SCENARIO_VALUE
      ? preview
      : scenarioPreview?.ok === true
        ? scenarioPreview.preview
        : null;
  const baseEffectivePreviewDocument =
    activeScenarioValue === AUTHORING_SOURCE_SCENARIO_VALUE
      ? document
      : scenarioPreview?.ok === true
        ? scenarioPreview.scenarioDocument
        : null;
  const effectivePreviewDocument =
    baseEffectivePreviewDocument === null
      ? null
      : prepareAuthoringStylePreviewDocument(
          baseEffectivePreviewDocument,
          route,
          selection,
          styleTarget,
        );
  const effectivePreview =
    effectivePreviewDocument === null
      ? null
      : effectivePreviewDocument === baseEffectivePreviewDocument
        ? baseEffectivePreview
        : prepareAuthoringPreviewBundle(
            effectivePreviewDocument,
            workspaceSnapshot.catalogPackages,
          );
  const surfacePreview = useMemo(
    () =>
      effectivePreviewDocument === null
        ? null
        : prepareAuthoringSurfacePreviewBundle(
            effectivePreviewDocument,
            workspaceSnapshot.catalogPackages,
            previewSurfaceId,
          ),
    [effectivePreviewDocument, previewSurfaceId, workspaceSnapshot.catalogPackages],
  );
  const fidelity = useMemo(
    () =>
      preparedModel.ok
        ? projectPreviewFidelity(preparedModel.model, route)
        : Object.freeze({ status: "rejected" as const }),
    [preparedModel, route],
  );
  const fixtureRevision = surfacePreview?.ok === true ? surfacePreview.revision : "unavailable";
  const fixtureModel = useMemo(
    () =>
      prepareAuthoringOperationFixtureModel(workspaceSnapshot.catalogs, document, previewSurfaceId),
    [document, previewSurfaceId, workspaceSnapshot.catalogs],
  );
  const fixtureController = useMemo(
    () =>
      createAuthoringOperationFixtureController(fixtureModel, {
        documentId: document.id,
        revision: fixtureRevision,
        surfaceId: previewSurfaceId,
      }),
    [document.id, fixtureModel, fixtureRevision, previewSurfaceId, runEpoch],
  );
  const integrationDescriptor = useMemo(
    () => readAuthoringIntegrationBinding(integrationBinding, workspaceProfile),
    [integrationBinding, workspaceProfile],
  );
  const integrationCreation = useMemo(
    () =>
      integrationBinding === null
        ? null
        : createAuthoringIntegrationController({
            binding: integrationBinding,
            profile: workspaceProfile,
            document: effectivePreviewDocument ?? document,
            surfaceId: previewSurfaceId,
            revision: fixtureRevision,
          }),
    [
      document,
      effectivePreviewDocument,
      fixtureRevision,
      integrationBinding,
      previewSurfaceId,
      runEpoch,
      workspaceProfile,
    ],
  );
  const integrationController =
    integrationCreation?.status === "created" ? integrationCreation.controller : null;
  const integrationSnapshot = useSyncExternalStore(
    integrationController?.subscribe ?? subscribeUnavailablePersistence,
    integrationController?.read ?? readUnavailablePersistence,
    integrationController?.read ?? readUnavailablePersistence,
  );
  const navigationController = useMemo(
    () =>
      createAuthoringRunNavigationController({
        document,
        revision: fixtureRevision,
        surfaceId: previewSurfaceId,
        isRunActive: () => modeRef.current === "run",
        onNavigate: (destination) => {
          setRunDestination(destination);
          setRunEpoch((current) => current + 1);
          return true;
        },
      }),
    [document, fixtureRevision, previewSurfaceId, runEpoch],
  );
  const runHostPorts = useMemo(
    () =>
      authoringProjectRecord === null
        ? createAuthoringRunHostPorts(
            executionContext === "integration"
              ? (integrationController?.operationPort ?? {
                  invoke: () => Object.freeze({ status: "denied" }),
                })
              : fixtureController.operationPort,
            navigationController.navigationPort,
            runDestination?.params,
          )
        : createAuthoringStylePreviewHostPorts(
            executionContext === "integration"
              ? (integrationController?.operationPort ?? {
                  invoke: () => Object.freeze({ status: "denied" }),
                })
              : fixtureController.operationPort,
            navigationController.navigationPort,
            runDestination?.params,
            resolveStyleToken,
            stylePreviewViewportId,
            styleTarget.kind === "breakpoint" ? undefined : (effectiveCanvasFrame ?? undefined),
          ),
    [
      authoringProjectRecord,
      executionContext,
      fixtureController,
      integrationController,
      navigationController,
      resolveStyleToken,
      runDestination?.params,
      effectiveCanvasFrame,
      stylePreviewViewportId,
      styleTarget.kind,
    ],
  );
  const navigationLifetime = useRef<typeof navigationController | null>(null);
  useEffect(() => {
    navigationController.activate();
    navigationLifetime.current = navigationController;
    return () => {
      navigationController.deactivate();
      if (navigationLifetime.current === navigationController) navigationLifetime.current = null;
      queueMicrotask(() => {
        if (navigationLifetime.current !== navigationController) navigationController.dispose();
      });
    };
  }, [navigationController]);
  const integrationLifetime = useRef<typeof integrationController>(null);
  useEffect(() => {
    if (integrationController === null) return;
    integrationLifetime.current = integrationController;
    if (mode === "run" && executionContext === "integration") integrationController.activate();
    else integrationController.deactivate();
    return () => {
      integrationController.deactivate();
      if (integrationLifetime.current === integrationController) integrationLifetime.current = null;
      queueMicrotask(() => {
        if (integrationLifetime.current !== integrationController) integrationController.dispose();
      });
    };
  }, [executionContext, integrationController, mode]);
  const fixtureControllerLifetime = useRef<ReturnType<
    typeof createAuthoringOperationFixtureController
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
        if (
          ownsPersistenceController &&
          persistenceControllerLifetime.current !== persistenceController
        ) {
          persistenceController.dispose();
        }
      });
    };
  }, [ownsPersistenceController, persistenceController]);

  useEffect(() => {
    if (publicationController === null || publicationBinding === null) return;
    publicationBinding.lifetime.active = true;
    publicationControllerLifetime.current = publicationController;
    return () => {
      publicationBinding.lifetime.active = false;
      if (publicationControllerLifetime.current === publicationController) {
        publicationControllerLifetime.current = null;
      }
      queueMicrotask(() => {
        if (publicationControllerLifetime.current !== publicationController) {
          publicationController.dispose();
        }
      });
    };
  }, [publicationBinding, publicationController]);

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
      !publicationPending &&
      masterController === null &&
      sourceDraft === null &&
      persistenceController !== null &&
      persistenceState?.pending === null &&
      !persistenceState.reopenRequired &&
      (persistenceState === null || persistenceState.disposed || !persistenceState.dirty)
    ) {
      return;
    }

    const hasCurrentUnsavedSource = () => {
      if (masterControllerRef.current !== null) return true;
      if (sourceDraftRef.current !== null) return true;
      if (projectController !== null) {
        const current = projectController.read();
        return current.disposed || current.unavailable ? null : current.dirty;
      }
      if (persistenceController === null) return inMemoryDraftDirty.current;
      if (persistenceControllerLifetime.current !== persistenceController) return null;
      const current = persistenceController.read();
      if (current.disposed) return null;
      return current.dirty;
    };
    const hasCurrentPublication = () => {
      if (publicationController === null) return false;
      if (publicationControllerLifetime.current !== publicationController) return null;
      const current = publicationController.read();
      if (current.disposed) return null;
      return current.pending !== null;
    };
    const hasCurrentPersistenceHazard = () => {
      if (persistenceController === null || ownsPersistenceController) return false;
      if (persistenceControllerLifetime.current !== persistenceController) return null;
      const current = persistenceController.read();
      if (current.disposed) return null;
      return current.pending !== null || current.reopenRequired;
    };
    const removeNavigationGuard = installDesenAppNavigationGuard((destination) => {
      if (masterControllerRef.current !== null) {
        setMasterNotice(
          "Apply or discard the master draft before leaving this editor. The project is unchanged.",
        );
        return false;
      }
      const publishing = hasCurrentPublication();
      if (publishing === null || publishing) return false;
      const persistenceHazard = hasCurrentPersistenceHazard();
      if (persistenceHazard === null || persistenceHazard) return false;
      const dirty = hasCurrentUnsavedSource();
      if (dirty === null) return false;
      const nextRoute = readDesenAppRoute(destination);
      if (
        projectController !== null &&
        sourceDraftRef.current === null &&
        nextRoute.kind === "project" &&
        nextRoute.projectId === project.id &&
        nextRoute.surfaceId !== undefined
      )
        return true;
      if (!dirty) return true;
      if (
        !window.confirm(
          projectController === null
            ? "Discard unsaved changes? Leaving this surface will permanently discard the current authored Source draft."
            : "Discard unsaved project changes? This includes masters, instances and all surface edits.",
        )
      ) {
        return false;
      }
      if (projectController !== null)
        return projectController.discard(projectController.read().session.digest).ok;
      if (persistenceController === null || ownsPersistenceController) return true;
      const current = persistenceController.read();
      if (current.disposed || current.savedDocument === null) return false;
      return persistenceController.replaceAuthoredDocument(current.savedDocument).ok;
    });
    const protectPageExit = (event: BeforeUnloadEvent) => {
      if (
        hasCurrentPublication() !== true &&
        hasCurrentPersistenceHazard() !== true &&
        hasCurrentUnsavedSource() !== true
      ) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectPageExit);
    return () => {
      removeNavigationGuard();
      window.removeEventListener("beforeunload", protectPageExit);
    };
  }, [
    ownsPersistenceController,
    persistenceController,
    persistenceState,
    publicationController,
    publicationPending,
    sourceDraft,
    projectController,
    project.id,
    masterController,
  ]);

  useEffect(() => {
    if (
      projectController !== null ||
      persistenceController === null ||
      persistenceController.read().disposed ||
      persistenceController.read().session.document === document
    ) {
      return;
    }
    persistenceController.replaceAuthoredDocument(document);
  }, [document, persistenceController, projectController]);

  useEffect(() => {
    if (publicationController === null || !preview.ok) return;
    publicationController.replaceSnapshot(readCurrentPublicationSnapshot());
  }, [persistenceState, preview, publicationController, readCurrentPublicationSnapshot]);

  function isDesignMode(allowSourceDraft = false): boolean {
    if (modeRef.current !== "design") return false;
    if (!allowSourceDraft && sourceDraftRef.current !== null) return false;
    if (projectController !== null) {
      const persistence = persistenceController?.read();
      if (persistence?.disposed === true || persistence?.pending != null) return false;
      const aggregate = projectController.read();
      if (aggregate.disposed || aggregate.unavailable || aggregate.pending !== null) return false;
      if (aggregate.reopenRequired) return false;
      const draft = masterControllerRef.current?.read();
      if (
        draft !== undefined &&
        (draft.disposed || draft.unavailable || draft.pending !== null || draft.reopenRequired)
      )
        return false;
    }
    if (publicationController === null) return true;
    if (publicationControllerLifetime.current !== publicationController) return false;
    const current = publicationController.read();
    return !current.disposed && current.pending === null;
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
    if (!isDesignMode(true) || diagnosticsProjection?.status !== "ready") return;
    const occurrence = diagnosticsProjection.model.diagnostics
      .flatMap((diagnostic) => diagnostic.occurrences)
      .find((candidate) => candidate.selectionKey === selectionKey);
    if (occurrence === undefined) return;
    diagnosticFocusRequest.current += 1;
    setDiagnosticSelection(
      Object.freeze({ selectionKey, focusRequestId: diagnosticFocusRequest.current }),
    );
    if (occurrence.kind === "node" && preparedModel.ok) {
      const pending = preparedModel.model.surfaces.flatMap((surface) =>
        surface.id === route.surfaceId ? [surface.root] : [],
      );
      while (pending.length > 0) {
        const node = pending.pop();
        if (node === undefined) break;
        if (node.id === occurrence.subjectId) {
          selectOne(
            createAuthoringComponentSelection({
              projectId: route.projectId,
              surfaceId: route.surfaceId,
              sourceNodeId: node.id,
              capabilityId: node.capabilityId,
              displayName: node.displayName,
              conditional: node.conditional,
            }),
          );
          break;
        }
        pending.push(
          ...node.slots.flatMap(({ children }) => children),
          ...node.behaviors.flatMap(({ slots }) => slots.flatMap(({ children }) => children)),
        );
      }
    }
  }

  function replaceSourceDraft(next: AdvancedSourceDraft | null): void {
    sourceDraftRef.current = next;
    setSourceDraft(next);
  }

  function sourceDraftReviewAvailable(): boolean {
    if (!isDesignMode(true)) return false;
    if (persistenceController === null) return true;
    if (persistenceControllerLifetime.current !== persistenceController) return false;
    const current = persistenceController.read();
    return !current.disposed && current.pending === null;
  }

  function openSourceDraft(): void {
    if (sourceDraftRef.current !== null || !sourceDraftReviewAvailable()) return;
    replaceSourceDraft(
      Object.freeze({
        text: formatStructuredJson(document),
        baselineFingerprint: committedDocumentFingerprint,
        failure: null,
      }),
    );
    setSourceDraftNotice("Edit this detached Source draft, then validate and apply it.");
  }

  function changeSourceDraft(text: string): void {
    const current = sourceDraftRef.current;
    if (!sourceDraftReviewAvailable() || current === null) return;
    replaceSourceDraft(Object.freeze({ ...current, text, failure: null }));
    clearTransientDiagnostics();
    setSourceDraftNotice("Unvalidated draft. Save and Publish remain paused.");
  }

  function discardSourceDraft(): void {
    if (!sourceDraftReviewAvailable()) return;
    replaceSourceDraft(null);
    clearTransientDiagnostics();
    setSourceDraftNotice("Source draft discarded. The current valid Source is unchanged.");
  }

  function applySourceDraft(): void {
    const current = sourceDraftRef.current;
    if (!sourceDraftReviewAvailable() || current === null) return;
    const result = reviewAuthoringSourceDraft(
      current.text,
      workspaceProfile,
      document,
      route,
      current.baselineFingerprint,
    );
    captureEditDiagnostics(result);
    if (!result.ok) {
      replaceSourceDraft(Object.freeze({ ...current, failure: result }));
      return;
    }
    if (
      !commitAuthoringSession(Object.freeze({ document: result.document, preview: result.preview }))
    ) {
      setSourceDraftNotice(
        "Source was not applied. Managed structure requires a master edit or explicit detach; the draft and current project are preserved.",
      );
      return;
    }
    replaceSourceDraft(null);
    selectOne(null);
    setScenarioChoice(Object.freeze({ ownerKey: null, value: AUTHORING_SOURCE_SCENARIO_VALUE }));
    setSourceDraftNotice(
      masterControllerRef.current === null
        ? "Source applied locally. Save source, then Publish to update the host."
        : "Source applied only to the master draft. Apply master changes to update the project.",
    );
  }

  function commitAuthoringSession(
    nextSession: typeof localAuthoringSession,
    establishesBaseline = false,
    resetsHistory = false,
  ): boolean {
    if (editorProjectController !== null && projectState !== null) {
      const result = editorProjectController.replaceSource(
        projectState.session.digest,
        nextSession.document,
      );
      if (!result.ok) {
        setHistoryNotice(
          `Project edit rejected (${result.reason}). Managed structure requires a master edit or explicit detach. The project and history are unchanged.`,
        );
        return false;
      }
      clearTransientDiagnostics();
      setHistoryNotice("");
      return true;
    }
    let nextHistory: DesenEditorHistory;
    const currentHistory = authoringHistory.current;
    if (resetsHistory || currentHistory === null) {
      const resetHistory = createDesenEditorHistory(nextSession.document);
      if (resetHistory === undefined)
        throw new TypeError("The bounded authoring history could not be reset.");
      nextHistory = resetHistory;
    } else {
      const recorded = recordDesenEditorHistory(currentHistory, nextSession.document);
      if (!recorded.ok)
        throw new TypeError("The bounded authoring history rejected an admitted document.");
      nextHistory = recorded.history;
    }
    const canonicalDocument = canonicalizeJson(nextSession.document);
    inMemoryCurrentCanonical.current = canonicalDocument;
    if (establishesBaseline) inMemoryBaselineCanonical.current = canonicalDocument;
    authoringHistory.current = nextHistory;
    updateInMemoryDirtyProjection();
    clearTransientDiagnostics();
    setHistoryNotice("");
    setAuthoringSession(nextSession);
    return true;
  }

  function chooseMode(nextMode: SurfaceEditorMode): void {
    if (
      masterControllerRef.current !== null ||
      sourceDraftRef.current !== null ||
      persistenceState?.pending === "opening" ||
      publicationPending
    )
      return;
    if (nextMode === "design") {
      integrationController?.deactivate();
      setExecutionContext("synthetic");
      if (runDestination !== null || executionContext === "integration") {
        navigationController.deactivate();
        setRunDestination(null);
        setRunEpoch((current) => current + 1);
      }
    }
    modeRef.current = nextMode;
    setMode(nextMode);
    (nextMode === "design" ? designModeButton : runModeButton).current?.focus({
      preventScroll: true,
    });
  }

  function openMasterDraft(masterId: string): void {
    if (
      !isDesignMode() ||
      projectController === null ||
      liveProjectState === null ||
      masterControllerRef.current !== null
    )
      return;
    const created = createProjectMasterDraftController(
      projectController,
      workspaceProfile,
      masterId,
      selectedSurface.sourceId,
      liveProjectState.session.digest,
    );
    if (!created.ok) {
      setHistoryNotice(
        `Master draft was not opened (${created.reason}). The project is unchanged.`,
      );
      return;
    }
    masterControllerRef.current = created.controller;
    setMasterController(created.controller);
    setMasterNotice("");
    selectOne(null);
    clearTransientDiagnostics();
    setScenarioChoice(Object.freeze({ ownerKey: null, value: AUTHORING_SOURCE_SCENARIO_VALUE }));
  }

  function closeMasterDraft(applied: boolean): void {
    const current = masterControllerRef.current;
    if (current === null) return;
    masterControllerRef.current = null;
    current.dispose();
    setMasterController(null);
    replaceSourceDraft(null);
    selectOne(null);
    clearTransientDiagnostics();
    setMasterNotice("");
    setHistoryNotice(
      applied
        ? "Master changes applied as one project edit. Save project to persist."
        : "Master draft discarded. The project and its history are unchanged.",
    );
    setScenarioChoice(Object.freeze({ ownerKey: null, value: AUTHORING_SOURCE_SCENARIO_VALUE }));
  }

  function applyMasterDraft(): void {
    if (
      !isDesignMode() ||
      masterController === null ||
      masterControllerRef.current !== masterController ||
      masterState === null
    )
      return;
    const result = masterController.apply(masterState.session.digest);
    if (!result.ok) {
      setMasterNotice(
        `Master changes were not applied (${result.reason}). The draft and project are preserved.`,
      );
      return;
    }
    closeMasterDraft(true);
  }

  function restartRun(context: "synthetic" | "integration" = executionContext): void {
    if (modeRef.current !== "run" || (context === "integration" && integrationDescriptor === null))
      return;
    navigationController.deactivate();
    fixtureController.deactivate();
    integrationController?.deactivate();
    setExecutionContext(context);
    setRunDestination(null);
    setRunEpoch((current) => current + 1);
  }

  function chooseScenario(value: AuthoringScenarioValue): void {
    if (!isDesignMode() || scenarioOwnerKey === null) return;
    setScenarioChoice(Object.freeze({ ownerKey: scenarioOwnerKey, value }));
  }

  async function openAuthoredSource(): Promise<void> {
    if (masterControllerRef.current !== null || !isDesignMode() || persistenceController === null)
      return;
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
    if (projectController === null && !commitAuthoringSession(result.session, true, true)) return;
    selectOne(null);
    setScenarioChoice(Object.freeze({ ownerKey: null, value: AUTHORING_SOURCE_SCENARIO_VALUE }));
  }

  function saveAuthoredSource(): void {
    if (masterControllerRef.current !== null || !isDesignMode() || persistenceController === null)
      return;
    void persistenceController.save();
  }

  function publishSavedSource(): void {
    if (
      masterControllerRef.current !== null ||
      !isDesignMode() ||
      publicationController === null ||
      publicationControllerLifetime.current !== publicationController ||
      !preview.ok
    ) {
      return;
    }
    const replacement = publicationController.replaceSnapshot(readCurrentPublicationSnapshot());
    if (!replacement.ok) return;
    void publicationController.publish();
  }

  function toggleSelection(node: AuthoringLayerNode, extend = false): void {
    if (!isDesignMode()) return;
    const candidate = createAuthoringComponentSelection({
      projectId: project.id,
      surfaceId: selectedSurface.sourceId,
      sourceNodeId: node.id,
      capabilityId: node.capabilityId,
      displayName: node.displayName,
      conditional: node.conditional,
    });
    const current =
      directSelections.length > 0
        ? directSelections
        : selection === null
          ? Object.freeze([])
          : Object.freeze([selection]);
    const next = extend
      ? toggleAuthoringDirectManipulationSelection(current, candidate, true)
      : isSameAuthoringComponentSelection(selection, candidate)
        ? Object.freeze([])
        : toggleAuthoringDirectManipulationSelection(current, candidate, false);
    setDirectSelections(next);
    setSelection(next.at(-1) ?? null);
  }

  function editSelectedProperty(edit: AuthoringInspectorEdit): AuthoringInspectorEditResult {
    if (!isDesignMode()) {
      return Object.freeze({ ok: false, reason: "edit-rejected" });
    }
    if (selection === null) return Object.freeze({ ok: false, reason: "selection-invalid" });
    const result = applyAuthoringInspectorEdit(
      document,
      workspaceSnapshot.catalogs,
      route,
      selection,
      edit,
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    return result;
  }

  function editSelectedStyle(edit: AuthoringStyleEdit) {
    if (!isDesignMode()) {
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    }
    if (selection === null) {
      return Object.freeze({ ok: false as const, reason: "selection-invalid" as const });
    }
    const result = applyAuthoringStyleEdit(
      document,
      workspaceSnapshot.catalogs,
      route,
      selection,
      styleTokenOptions,
      edit,
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false as const, reason: "source-invalid" as const });
    }
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    return result;
  }

  function editSelectedVariant(edit: AuthoringVariantEdit): AuthoringVariantEditResult {
    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" as const });
    if (selection === null)
      return Object.freeze({ ok: false, reason: "selection-invalid" as const });
    const result = applyAuthoringVariantEdit(
      document,
      workspaceSnapshot.catalogs,
      route,
      selection,
      edit,
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) return Object.freeze({ ok: false, reason: "source-invalid" as const });
    if (
      !commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))
    ) {
      return Object.freeze({ ok: false, reason: "edit-rejected" as const });
    }
    return result;
  }

  function editSelectedBinding(edit: AuthoringInspectorBindingEdit): AuthoringInspectorEditResult {
    if (!isDesignMode()) {
      return Object.freeze({ ok: false, reason: "edit-rejected" });
    }
    if (selection === null) return Object.freeze({ ok: false, reason: "selection-invalid" });
    const result = applyAuthoringInspectorBindingEdit(
      document,
      workspaceSnapshot.catalogs,
      route,
      selection,
      edit,
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    return result;
  }

  function connectSelectedInput(stateName: string): AuthoringConnectionResult {
    if (!isDesignMode() || selection === null) {
      return Object.freeze({ ok: false, reason: "selection-invalid" });
    }
    const result = applyAuthoringInputConnection(
      document,
      workspaceSnapshot.catalogs,
      route,
      selection,
      { stateName },
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) return Object.freeze({ ok: false, reason: "source-invalid" });
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    return result;
  }

  function connectSelectedOperation(
    recipe: AuthoringOperationTriggerConnectionRecipe,
  ): AuthoringConnectionResult {
    if (!isDesignMode() || selection === null) {
      return Object.freeze({ ok: false, reason: "selection-invalid" });
    }
    const result = applyAuthoringOperationTriggerConnection(
      document,
      workspaceSnapshot.catalogs,
      route,
      selection,
      recipe,
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) return Object.freeze({ ok: false, reason: "source-invalid" });
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    return result;
  }

  function editSelectedCondition(edit: AuthoringConditionEdit): AuthoringConditionEditResult {
    if (!isDesignMode() || selection === null) {
      return Object.freeze({ ok: false, reason: "selection-invalid" });
    }
    const result = applyAuthoringConditionEdit(
      document,
      workspaceSnapshot.catalogs,
      route,
      selection,
      edit,
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) return Object.freeze({ ok: false, reason: "source-invalid" });
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    selectOne(
      createAuthoringComponentSelection({
        projectId: selection.projectId,
        surfaceId: selection.surfaceId,
        sourceNodeId: selection.sourceNodeId,
        capabilityId: selection.capabilityId,
        displayName: selection.displayName,
        conditional: edit.kind === "set",
      }),
    );
    return result;
  }

  function editLocalState(edit: AuthoringStateEdit): AuthoringStateEditResult {
    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });
    const result = applyAuthoringStateEdit(document, workspaceSnapshot.catalogs, route, edit);
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    return result;
  }

  function editSelectedEventAction(edit: AuthoringEventActionEdit): AuthoringEventActionEditResult {
    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });
    if (eventOwnerSelection === null) {
      return Object.freeze({ ok: false, reason: "owner-invalid" });
    }
    const result = applyAuthoringEventActionEdit(
      document,
      workspaceSnapshot.catalogs,
      route,
      eventOwnerSelection,
      edit,
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    return result;
  }

  function editNamedSlot(
    target: AuthoringSlotSelection,
    edit: AuthoringSlotEdit,
  ): AuthoringSlotEditResult {
    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });
    const result = applyAuthoringSlotEdit(
      document,
      workspaceSnapshot.catalogs,
      route,
      target,
      edit,
    );
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    if (result.operation === "insert" && edit.kind === "insert" && preparedModel.ok) {
      const component = preparedModel.model.components.find(({ id }) => id === edit.componentId);
      if (component !== undefined) {
        selectOne(
          createAuthoringComponentSelection({
            projectId: project.id,
            surfaceId: selectedSurface.sourceId,
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

  function placeSelectedLayers(
    target: AuthoringSlotSelection,
    index: number,
    nodeIds: readonly string[],
  ): AuthoringSlotBatchPlacementResult {
    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });
    const result = applyAuthoringSlotBatchPlacement(
      document,
      workspaceSnapshot.catalogs,
      route,
      target,
      nodeIds,
      index,
    );
    captureEditDiagnostics(result);
    if (!result.ok || result.operation === "noop") return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    return result;
  }

  function deleteSelectedLayer(): AuthoringSlotEditResult {
    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });
    if (selection === null) return Object.freeze({ ok: false, reason: "edit-rejected" });
    const result = applyAuthoringNodeDelete(document, workspaceSnapshot.catalogs, route, selection);
    captureEditDiagnostics(result);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(
      result.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    if (!commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview })))
      return Object.freeze({ ok: false as const, reason: "edit-rejected" as const });
    selectOne(null);
    return result;
  }

  function selectedReuseNodeIds(): readonly string[] {
    const ids =
      selectedSourceNodeIds.length > 0
        ? selectedSourceNodeIds
        : selection === null
          ? []
          : [selection.sourceNodeId];
    return Object.freeze([...new Set(ids)]);
  }

  function validateReuseCandidate(
    candidate: DesenEditorDocument,
  ):
    | Readonly<{ readonly ok: true; readonly preview: typeof preview }>
    | Readonly<{ readonly ok: false }> {
    if (!preparedModel.ok || diagnosticsValidator?.ok !== true) {
      return Object.freeze({ ok: false as const });
    }
    const report = diagnosticsValidator.validator.validate(candidate);
    if (!report.valid) {
      captureEditDiagnostics(Object.freeze({ ok: false as const, validationReport: report }));
      return Object.freeze({ ok: false as const });
    }
    const nextPreview = prepareAuthoringPreviewBundle(candidate, workspaceSnapshot.catalogPackages);
    return nextPreview.ok
      ? Object.freeze({ ok: true as const, preview: nextPreview })
      : Object.freeze({ ok: false as const });
  }

  function copySelectedLayers(): DesenEditorClipboardPayload | null {
    if (!isDesignMode()) return null;
    const nodeIds = selectedReuseNodeIds();
    if (nodeIds.length === 0) {
      setHistoryNotice("Select at least one layer before copying.");
      return null;
    }
    const result = captureDesenEditorClipboard(document, selectedSurface.sourceId, nodeIds);
    if (!result.ok) {
      setHistoryNotice("Copy was rejected safely: the selection is no longer current.");
      return null;
    }
    authoringClipboard.current = result.payload;
    setHistoryNotice(
      `Copied ${result.payload.nodes.length} layer${result.payload.nodes.length === 1 ? "" : "s"}.`,
    );
    return result.payload;
  }

  function reuseTarget(): Readonly<{
    readonly parentId: string;
    readonly slot: string;
    readonly index: number;
  }> | null {
    const nodeIds = selectedReuseNodeIds();
    const anchorId = nodeIds.at(-1);
    if (anchorId === undefined) return null;
    const anchor = readDesenEditorNodePlacement(document, selectedSurface.sourceId, anchorId);
    if (
      anchor === null ||
      anchor.parentId === null ||
      anchor.slot === null ||
      anchor.index === null
    )
      return null;
    return Object.freeze({ parentId: anchor.parentId, slot: anchor.slot, index: anchor.index + 1 });
  }

  function pasteClipboardPayload(payload: DesenEditorClipboardPayload | null): void {
    if (!isDesignMode()) return;
    const target = reuseTarget();
    if (payload === null || target === null) {
      setHistoryNotice("Choose a current layer and an App-captured clipboard selection first.");
      return;
    }
    const result = pasteDesenEditorClipboard(document, {
      payload,
      surfaceId: selectedSurface.sourceId,
      parentId: target.parentId,
      slot: target.slot,
      index: target.index,
    });
    if (!result.ok) {
      setHistoryNotice("Paste was rejected safely; the authored Source is unchanged.");
      return;
    }
    const admitted = validateReuseCandidate(result.document);
    if (!admitted.ok) {
      setHistoryNotice(
        "Paste was rejected by the current Catalog contract; the Source is unchanged.",
      );
      return;
    }
    if (
      !commitAuthoringSession(
        Object.freeze({ document: result.document, preview: admitted.preview }),
      )
    )
      return;
    setHistoryNotice(
      `Pasted ${result.insertedNodeIds.length} fresh layer${result.insertedNodeIds.length === 1 ? "" : "s"}.${projectController === null ? "" : " Copies are detached; insert a master for a linked instance."}`,
    );
  }

  function pasteSelectedLayers(): void {
    pasteClipboardPayload(authoringClipboard.current);
  }

  function duplicateSelectedLayers(): void {
    const payload = copySelectedLayers();
    if (payload === null) return;
    pasteClipboardPayload(payload);
  }

  function transitionHistory(direction: "undo" | "redo"): void {
    if (!isDesignMode()) return;
    if (editorProjectController !== null && projectState !== null) {
      const result = editorProjectController[direction](projectState.session.digest);
      if (!result.ok) {
        setHistoryNotice(`Project history was not changed (${result.reason}).`);
        return;
      }
      clearTransientDiagnostics();
      selectOne(null);
      setHistoryNotice(
        masterController === null
          ? direction === "undo"
            ? "Last project edit undone."
            : "Project edit restored."
          : direction === "undo"
            ? "Last master draft edit undone."
            : "Master draft edit restored.",
      );
      return;
    }
    const current = authoringHistory.current;
    if (current === null) return;
    const result =
      direction === "undo" ? undoDesenEditorHistory(current) : redoDesenEditorHistory(current);
    if (!result.ok) {
      setHistoryNotice(direction === "undo" ? "Nothing to undo." : "Nothing to redo.");
      return;
    }
    const nextPreview = prepareAuthoringPreviewBundle(
      result.history.document,
      workspaceSnapshot.catalogPackages,
    );
    if (!nextPreview.ok) {
      setHistoryNotice(
        "History transition was rejected because the preview boundary is unavailable.",
      );
      return;
    }
    authoringHistory.current = result.history;
    inMemoryCurrentCanonical.current = canonicalizeJson(result.history.document);
    updateInMemoryDirtyProjection();
    clearTransientDiagnostics();
    selectOne(null);
    setAuthoringSession(Object.freeze({ document: result.history.document, preview: nextPreview }));
    setHistoryNotice(direction === "undo" ? "Last edit undone." : "Edit restored.");
  }

  useEffect(() => {
    function handleHistoryShortcut(event: globalThis.KeyboardEvent): void {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.contentEditable === "true"))
      )
        return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        transitionHistory(event.shiftKey ? "redo" : "undo");
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        transitionHistory("redo");
      }
    }
    globalThis.document.addEventListener("keydown", handleHistoryShortcut);
    return () => globalThis.document.removeEventListener("keydown", handleHistoryShortcut);
  });

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
  const directManipulationSelection = projectAuthoringDirectManipulationSelection(
    directSelections,
    route,
    model,
  );
  const selectedSourceNodeIds =
    directManipulationSelection.status === "ready"
      ? directManipulationSelection.selection.sourceNodeIds
      : selection === null
        ? Object.freeze([])
        : Object.freeze([selection.sourceNodeId]);
  // A Run navigation may preview another Source surface while the authoring selection remains
  // route-bound to its Design surface. Canvas chrome must never present that stale selection as
  // belonging to the destination surface.
  const canvasSelectedSourceNodeIds =
    mode === "design" && previewSurfaceId === selectedSurface.sourceId
      ? selectedSourceNodeIds
      : Object.freeze([]);
  const historyState = projectState?.history ?? authoringHistory.current;
  // Render availability from subscribed snapshots. Lifetime refs authenticate event handlers,
  // but their effect-time installation cannot leave first-render controls permanently disabled.
  const aggregateEditsBlocked =
    projectController !== null &&
    (liveProjectState === null ||
      liveProjectState.disposed ||
      liveProjectState.unavailable ||
      liveProjectState.reopenRequired ||
      liveProjectState.pending !== null ||
      persistenceState?.disposed === true ||
      persistenceState?.pending != null ||
      (masterState !== null &&
        (masterState.disposed ||
          masterState.unavailable ||
          masterState.reopenRequired ||
          masterState.pending !== null)));
  const designEditsAvailable =
    mode === "design" &&
    sourceDraft === null &&
    !publicationPending &&
    publicationState?.disposed !== true &&
    !aggregateEditsBlocked;
  const canUndo = designEditsAvailable && historyState !== null && historyState.past.length > 0;
  const canRedo = designEditsAvailable && historyState !== null && historyState.future.length > 0;
  const canReuseSelection = designEditsAvailable && selectedSourceNodeIds.length > 0;
  const canPaste = canReuseSelection && authoringClipboard.current !== null;

  return (
    <section aria-labelledby="workspace-title" className={styles.surfaceEditor} data-mode={mode}>
      <h1 className={styles.visuallyHidden} data-route-heading id="project-title" tabIndex={-1}>
        {project.name}
      </h1>

      <header
        aria-label="Workspace commands"
        className={styles.workspaceCommandBar}
        data-master-editing={masterController !== null}
      >
        {masterController !== null && masterState !== null && (
          <MasterDraftBanner
            name={
              masterState.session.record.designSystem.recipeGraph.definitions.find(
                ({ id }) => id === masterController.draft.masterId,
              )?.name ?? masterController.draft.masterId
            }
            dirty={masterState.dirty}
            blocked={!designEditsAvailable}
            notice={masterNotice}
            onApply={applyMasterDraft}
            onDiscard={() => closeMasterDraft(false)}
          />
        )}
        <div className={styles.workspaceIdentity}>
          <div className={styles.workspaceIdentityCopy}>
            <h2 id="workspace-title">{previewSurface.name}</h2>
            <small>
              {canvasFrame.status === "ready"
                ? `${canvasFrameOrientation} · ${canvasFrame.frame.label}`
                : "Canvas frame unavailable"}
            </small>
          </div>
          <SurfaceState state={selectedSurface.state} />
        </div>

        <div className={styles.workspaceCommands}>
          <span className={styles.workspacePreviewStatus} data-workspace-preview-status={mode}>
            {mode === "design"
              ? "Design preview · controls are disabled."
              : executionContext === "integration"
                ? "Run preview · connected host operations are enabled."
                : "Run preview · real adapter controls use the selected synthetic fixture."}
          </span>
          <span className={styles.workspaceSessionStatus}>
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
          </span>
          <div
            aria-label="Design and Run mode"
            className={styles.modeControl}
            data-preserve-inspector-draft="true"
            role="group"
          >
            <button
              aria-describedby={modeStatusId}
              aria-pressed={mode === "design"}
              disabled={
                sourceDraft !== null ||
                persistenceState?.pending === "opening" ||
                publicationPending
              }
              onClick={() => chooseMode("design")}
              ref={designModeButton}
              type="button"
            >
              Design
            </button>
            <button
              aria-describedby={modeStatusId}
              aria-pressed={mode === "run"}
              disabled={
                masterController !== null ||
                sourceDraft !== null ||
                persistenceState?.pending === "opening" ||
                publicationPending
              }
              onClick={() => chooseMode("run")}
              ref={runModeButton}
              type="button"
            >
              Run
            </button>
          </div>
          <div aria-label="Authoring history and reuse" className={styles.modeControl}>
            <button
              aria-label="Undo last authoring edit"
              data-history-action="undo"
              disabled={!canUndo || sourceDraft !== null || publicationPending}
              onClick={() => transitionHistory("undo")}
              type="button"
            >
              Undo
            </button>
            <button
              aria-label="Redo authoring edit"
              data-history-action="redo"
              disabled={!canRedo || sourceDraft !== null || publicationPending}
              onClick={() => transitionHistory("redo")}
              type="button"
            >
              Redo
            </button>
            <button
              aria-label="Copy selected layers"
              data-history-action="copy"
              disabled={!canReuseSelection || sourceDraft !== null || publicationPending}
              onClick={copySelectedLayers}
              type="button"
            >
              Copy
            </button>
            <button
              aria-label="Paste copied layers"
              data-history-action="paste"
              disabled={!canPaste || sourceDraft !== null || publicationPending}
              onClick={pasteSelectedLayers}
              type="button"
            >
              Paste
            </button>
            <button
              aria-label="Duplicate selected layers"
              data-history-action="duplicate"
              disabled={!canReuseSelection || sourceDraft !== null || publicationPending}
              onClick={duplicateSelectedLayers}
              type="button"
            >
              Duplicate
            </button>
          </div>
          <span aria-live="polite" className={styles.visuallyHidden} data-history-notice>
            {historyNotice}
          </span>
          <details className={styles.workspaceLifecycle}>
            <summary>
              <span>
                <strong>Source &amp; release</strong>
                <small>Open, save, and publish the exact Source</small>
              </span>
              <span aria-hidden="true" className={styles.workspaceLifecycleChevron} />
            </summary>
            <div className={styles.workspaceLifecycleBody}>
              <PersistenceControls
                aggregate={projectController !== null}
                busy={
                  masterController !== null ||
                  sourceDraft !== null ||
                  publicationPending ||
                  persistenceState?.pending === "opening" ||
                  persistenceState?.pending === "saving"
                }
                confirmationScope={projectState?.session ?? persistenceController}
                designMode={mode === "design"}
                onOpen={() => {
                  void openAuthoredSource();
                }}
                onSave={saveAuthoredSource}
                projection={persistenceProjection}
              />

              <PublicationControls
                busy={
                  masterController !== null ||
                  sourceDraft !== null ||
                  persistenceState?.pending === "opening" ||
                  persistenceState?.pending === "saving"
                }
                designMode={mode === "design"}
                onPublish={publishSavedSource}
                projection={publicationProjection}
              />
              <SourceDraftControls
                disabled={
                  mode !== "design" ||
                  publicationPending ||
                  persistenceState?.pending === "opening" ||
                  persistenceState?.pending === "saving"
                }
                text={sourceDraft?.text ?? null}
                failure={sourceDraft?.failure ?? null}
                notice={sourceDraftNotice}
                onOpen={openSourceDraft}
                onChange={changeSourceDraft}
                onApply={applySourceDraft}
                onDiscard={discardSourceDraft}
              />
            </div>
          </details>
          <details className={styles.workspaceBoundary}>
            <summary>
              <strong>{mode === "design" ? "Preview boundary" : "Runtime boundary"}</strong>
              <span>
                {mode === "design"
                  ? "Catalog fixture · no live calls"
                  : executionContext === "integration"
                    ? "Explicit host connection"
                    : "Synthetic fixture only"}
              </span>
            </summary>
            <p>
              {mode === "design"
                ? "Catalog-backed edits change only the authored Source and persist only through Save source. Scenarios are transient previews and never change the authored Source. Selection, placement, and Inspector chrome never enter the managed component tree."
                : executionContext === "integration"
                  ? "Only explicitly connected host operations can execute. Navigation stays within this authored Source. Storage, resources, publication, activation and production remain blocked; Run never saves inputs or results."
                  : "Controls use authenticated Catalog fixtures and local managed-surface navigation. Resources, storage, publication, activation, integration, and production calls remain blocked; Run never changes the authored Source."}
            </p>
          </details>
          <p
            aria-atomic="true"
            aria-label="Mode safety"
            aria-live="polite"
            className={styles.visuallyHidden}
            id={modeStatusId}
            role="status"
          >
            {mode === "design"
              ? "Design mode · managed controls are disabled; authored changes remain local until Save source succeeds."
              : executionContext === "integration"
                ? "Run mode · explicitly connected host operations are enabled; production remains blocked."
                : "Run mode · controls are interactive against synthetic fixtures; live effects remain blocked."}
          </p>
        </div>
      </header>

      <AuthoringPanel
        masterControls={
          projectController === null || projectState === null ? null : (
            <MasterInstancePanel
              state={projectState}
              model={model}
              surfaceId={selectedSurface.sourceId}
              selection={selection}
              disabled={!designEditsAvailable}
              {...(masterController === null
                ? { onEditMaster: openMasterDraft }
                : { editingMasterId: masterController.draft.masterId })}
              onCommand={(command) => {
                if (!isDesignMode())
                  return Object.freeze({ ok: false, reason: "operation-in-progress" });
                const result = (masterController ?? projectController).applyRecipe(command);
                if (result.ok) {
                  clearTransientDiagnostics();
                  setHistoryNotice("");
                }
                return result;
              }}
            />
          )
        }
        hidden={mode === "run"}
        interactive={designEditsAvailable}
        model={model}
        onBatchSlotPlacement={placeSelectedLayers}
        onDeleteSelection={deleteSelectedLayer}
        onSlotEdit={editNamedSlot}
        onToggleSelection={toggleSelection}
        route={route}
        selection={selection}
        selectedSourceNodeId={selection?.sourceNodeId ?? null}
        selectedSourceNodeIds={selectedSourceNodeIds}
        selectedSurface={selectedSurface}
      />

      <section
        aria-labelledby="workspace-title"
        className={styles.canvasWorkspace}
        data-canvas-workspace="true"
        data-mode={mode}
      >
        <div
          className={styles.canvasStage}
          data-canvas-ready={canvasFrame.status === "ready" ? "true" : "false"}
          data-canvas-workplane="true"
          style={
            canvasFrame.status === "ready"
              ? ({
                  "--desen-canvas-frame-height": `${effectiveCanvasFrame?.height ?? canvasFrame.frame.height}px`,
                  "--desen-canvas-frame-width": `${effectiveCanvasFrame?.width ?? canvasFrame.frame.width}px`,
                } as CSSProperties)
              : undefined
          }
        >
          <CanvasManipulationControls
            disabled={!designEditsAvailable}
            frame={effectiveCanvasFrame}
            onPan={(delta) => {
              if (!isDesignMode()) return;
              updateCanvasPresentation((current) =>
                Object.freeze({
                  ...current,
                  viewport: panAuthoringCanvasViewport(current.viewport, delta),
                }),
              );
            }}
            onReset={() => {
              if (!isDesignMode()) return;
              updateCanvasPresentation(() => createCanvasSurfacePresentation());
            }}
            onResize={(delta) => {
              if (
                !isDesignMode() ||
                canvasFrame.status !== "ready" ||
                styleTarget.kind === "breakpoint"
              )
                return;
              updateCanvasPresentation((current) =>
                Object.freeze({
                  ...current,
                  previewFrame: resizeAuthoringCanvasPreviewFrame(
                    current.previewFrame ?? createAuthoringCanvasPreviewFrame(canvasFrame.frame),
                    delta,
                  ),
                }),
              );
            }}
            onZoom={(direction) => {
              if (!isDesignMode()) return;
              updateCanvasPresentation((current) =>
                Object.freeze({
                  ...current,
                  viewport: zoomAuthoringCanvasViewport(current.viewport, direction),
                }),
              );
            }}
            selectedSourceNodeIds={canvasSelectedSourceNodeIds}
            viewport={canvasViewport}
          />
          <div className={styles.canvasPlane} data-canvas-plane="true">
            {canvasFrame.status === "ready" ? (
              <section
                aria-label={`${canvasFrameOrientation?.toLowerCase() ?? "declared"} page frame · ${effectiveCanvasFrame?.width ?? canvasFrame.frame.width} × ${effectiveCanvasFrame?.height ?? canvasFrame.frame.height} px${previewFrameIsResized ? " · preview only" : ""}`}
                className={styles.canvasFrame}
                data-canvas-frame={canvasFrameOrientation?.toLowerCase() ?? "declared"}
                data-canvas-frame-height={effectiveCanvasFrame?.height ?? canvasFrame.frame.height}
                data-canvas-frame-width={effectiveCanvasFrame?.width ?? canvasFrame.frame.width}
                data-canvas-preview-resized={previewFrameIsResized ? "true" : "false"}
                data-style-preview-viewport={stylePreviewViewportId}
                style={
                  {
                    "--desen-canvas-viewport-pan-x": `${canvasViewport.panX}px`,
                    "--desen-canvas-viewport-pan-y": `${canvasViewport.panY}px`,
                    "--desen-canvas-viewport-zoom": canvasViewport.zoom,
                  } as CSSProperties
                }
              >
                <DesenAdapterCanvas
                  authoringModel={model}
                  bundle={surfacePreview?.ok === true ? surfacePreview.bundle : null}
                  catalogs={workspaceSnapshot.catalogs}
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
                  documentId={workspaceSnapshot.documentId}
                  hostPorts={runHostPorts}
                  mode={mode}
                  projectId={project.id}
                  registry={workspaceSnapshot.runtime.registry}
                  selection={mode === "design" ? selection : null}
                  showDesignChrome={false}
                  showStatus={false}
                  surfaceId={previewSurfaceId}
                  tokenCssProperties={workspaceSnapshot.runtime.tokenCssProperties}
                />
              </section>
            ) : (
              <div className={styles.canvasFrameUnavailable} role="alert">
                This Source does not declare a usable authoring canvas frame.
              </div>
            )}
          </div>
        </div>
      </section>

      <InspectorPanel
        diagnosticsRevealKey={activeTransientDiagnostics?.snapshot.documentFingerprint}
        behaviorControls={
          inspector.status === "ready" && behaviorProjection.status === "ready" ? (
            <div className={styles.behaviorControls}>
              <InputConnectionControl
                connectedStateName={behaviorProjection.inputConnectionStateName}
                inspector={inspector}
                onConnect={connectSelectedInput}
              />
              <OperationConnectionControl
                inspector={inspector}
                model={eventActionModel}
                onConnect={connectSelectedOperation}
                operationAliases={behaviorProjection.operationAliases}
              />
              <VisibilityControl
                currentWhen={behaviorProjection.currentWhen}
                localStates={inspector.localStates}
                onEdit={editSelectedCondition}
                operationAliases={behaviorProjection.operationAliases}
                ownerId={inspector.selection.sourceNodeId}
              />
            </div>
          ) : undefined
        }
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
        eventActionControls={
          <EventActionPanel
            model={eventActionModel}
            onEdit={editSelectedEventAction}
            surfaceName={selectedSurface.name}
          />
        }
        hidden={mode === "run"}
        inspector={inspector}
        onBindingEdit={editSelectedBinding}
        onEdit={editSelectedProperty}
        onStyleEdit={editSelectedStyle}
        onStyleTargetChange={setStyleTarget}
        onVariantEdit={editSelectedVariant}
        previewControls={
          <>
            <ScenarioPreviewControl
              model={scenarioModel}
              onChange={chooseScenario}
              value={activeScenarioValue}
            />
            <PreviewContextDisclosure fidelity={fidelity} />
          </>
        }
        stateControls={
          <StatePanel
            model={stateModel}
            onEdit={editLocalState}
            surfaceName={selectedSurface.name}
          />
        }
        styleModel={styleModel}
        styleTarget={styleTarget}
        styleTokenOptions={styleTokenOptions}
        variantModel={variantModel}
      />

      {mode === "run" ? (
        <RunControls
          executionContext={executionContext}
          integration={integrationDescriptor}
          integrationSnapshot={integrationSnapshot}
          onContextChange={restartRun}
          onRestart={() => restartRun()}
          surfaceName={previewSurface.name}
          onComplete={(alias) => {
            fixtureController.completePending(alias);
          }}
          onSelectOutcome={(alias, outcomeId) => {
            fixtureController.selectOutcome(alias, outcomeId);
          }}
          snapshot={fixtureSnapshot}
        />
      ) : null}
    </section>
  );
}

function ProjectShell({
  authoringProjectRecord,
  fixtures,
  initialDocument,
  integrationBinding,
  preparedPersistenceController,
  persistencePort,
  publicationPort,
  project,
  selectedSurface,
  workspaceProfile,
  workspaceSnapshot,
}: Readonly<{
  readonly authoringProjectRecord: EditableProjectRecord | null;
  readonly fixtures: boolean;
  readonly initialDocument: DesenEditorDocument;
  readonly integrationBinding: AuthoringIntegrationBindingHandle | null;
  readonly preparedPersistenceController: AuthoringPersistenceController | null | undefined;
  readonly persistencePort: DesenEditorPersistencePort | null;
  readonly publicationPort: AuthoringPublicationPort | null;
  readonly project: DesenAppProjectSummary;
  readonly selectedSurface: DesenAppSurfaceSummary | undefined;
  readonly workspaceProfile: ProjectWorkspaceProfileHandle;
  readonly workspaceSnapshot: ProjectWorkspaceProfileSnapshot;
}>) {
  const clipboardAuthorityId = `${workspaceProfileMountIdentity(workspaceProfile)}:${project.id}`;
  const clipboardScope = useRef<{
    authorityId: string;
    store: { current: DesenEditorClipboardPayload | null };
  }>({ authorityId: clipboardAuthorityId, store: { current: null } });
  if (clipboardScope.current.authorityId !== clipboardAuthorityId) {
    clipboardScope.current = { authorityId: clipboardAuthorityId, store: { current: null } };
  }

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
            {fixtures ? <span className={styles.previewBadge}>Preview data</span> : null}
          </div>
          {!fixtures ? (
            <AppLink
              className={styles.secondaryButton}
              href={createDesenAppDesignSystemPath(project.id)}
            >
              Open Design System
            </AppLink>
          ) : null}
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
                        <small>{surface.sourceId}</small>
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
      authoringClipboard={clipboardScope.current.store}
      authoringProjectRecord={authoringProjectRecord}
      key={`${workspaceProfileMountIdentity(workspaceProfile)}:${project.id}:${selectedSurface.id}`}
      initialDocument={initialDocument}
      integrationBinding={integrationBinding}
      preparedPersistenceController={preparedPersistenceController}
      persistencePort={persistencePort}
      publicationPort={publicationPort}
      project={project}
      selectedSurface={selectedSurface}
      workspaceProfile={workspaceProfile}
      workspaceSnapshot={workspaceSnapshot}
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

function routeTitle(route: DesenAppRoute, projects: readonly DesenAppProjectSummary[]): string {
  if (route.kind === "projects") return "Projects · DESEN";
  if (route.kind === "not-found") return "Not found · DESEN";
  const project = findDesenAppProject(route.projectId, projects);
  if (project === undefined) return "Project not found · DESEN";
  if (route.kind === "design-system") return `Design system · ${project.name} · DESEN`;
  if (route.surfaceId === undefined) return `${project.name} · DESEN`;
  const surface = findDesenAppSurface(project, route.surfaceId);
  return surface === undefined
    ? `Surface not found · ${project.name} · DESEN`
    : `${surface.name} · ${project.name} · DESEN`;
}

/** Whether the current route has an admitted surface editor, rather than a gallery or error view. */
function hasResolvedSurfaceEditor(
  route: DesenAppRoute,
  projects: readonly DesenAppProjectSummary[],
  fixtures: boolean,
): boolean {
  if (fixtures) return false;
  if (route.kind !== "project" || route.surfaceId === undefined) return false;
  const project = findDesenAppProject(route.projectId, projects);
  return project !== undefined && findDesenAppSurface(project, route.surfaceId) !== undefined;
}

function RouteView({
  authoringProjectRecord,
  fixtures,
  initialDocument,
  integrationBinding,
  onRequestProjectCreation,
  preparedPersistenceController,
  persistencePort,
  projects,
  publicationPort,
  route,
  workspaceProfile,
  workspaceSnapshot,
}: Readonly<{
  readonly authoringProjectRecord: EditableProjectRecord | null;
  readonly fixtures: boolean;
  readonly initialDocument: DesenEditorDocument;
  readonly integrationBinding: AuthoringIntegrationBindingHandle | null;
  readonly onRequestProjectCreation: (() => void) | null;
  readonly preparedPersistenceController: AuthoringPersistenceController | null | undefined;
  readonly persistencePort: DesenEditorPersistencePort | null;
  readonly projects: readonly DesenAppProjectSummary[];
  readonly publicationPort: AuthoringPublicationPort | null;
  readonly route: DesenAppRoute;
  readonly workspaceProfile: ProjectWorkspaceProfileHandle;
  readonly workspaceSnapshot: ProjectWorkspaceProfileSnapshot;
}>) {
  if (route.kind === "projects")
    return (
      <ProjectsHome
        fixtures={fixtures}
        onRequestProjectCreation={onRequestProjectCreation}
        projects={projects}
      />
    );
  if (route.kind === "not-found") return <NotFound pathname={route.pathname} />;

  const project = findDesenAppProject(route.projectId, projects);
  if (project === undefined) {
    return (
      <NotFound
        context="That project is not present in this workspace. No similarly named project was substituted."
        pathname={route.pathname}
      />
    );
  }
  if (route.kind === "design-system") {
    const authoringResult = prepareCatalogAuthoringModel(
      workspaceSnapshot.catalogs,
      initialDocument,
    );
    if (!authoringResult.ok) {
      return (
        <section
          className={styles.surfaceGallery}
          aria-labelledby="design-system-unavailable-title"
        >
          <h1
            className={styles.visuallyHidden}
            data-route-heading
            id="design-system-unavailable-title"
            tabIndex={-1}
          >
            Design system unavailable
          </h1>
          <div className={styles.panelEmptyState} role="alert">
            <strong>The Design System contract could not be prepared.</strong>
            <p>
              DESEN kept the project unchanged because the admitted Catalog/Source pair was not
              complete.
            </p>
          </div>
        </section>
      );
    }
    const explorerResult = prepareDesignSystemExplorer(authoringResult.model, {
      adapterCapabilityIds: workspaceSnapshot.runtime.registrySnapshot.componentCapabilityIds,
      tokenCssProperties: workspaceSnapshot.runtime.tokenCssProperties,
    });
    if (!explorerResult.ok) {
      return (
        <section
          className={styles.surfaceGallery}
          aria-labelledby="design-system-unavailable-title"
        >
          <h1
            className={styles.visuallyHidden}
            data-route-heading
            id="design-system-unavailable-title"
            tabIndex={-1}
          >
            Design system unavailable
          </h1>
          <div className={styles.panelEmptyState} role="alert">
            <strong>The Design System documentation is unavailable.</strong>
            <p>DESEN refused to show partial documentation for this Catalog/Source contract.</p>
          </div>
        </section>
      );
    }
    return <DesignSystemArea model={explorerResult.model} project={project} />;
  }
  if (route.surfaceId === undefined)
    return (
      <ProjectShell
        authoringProjectRecord={authoringProjectRecord}
        fixtures={fixtures}
        initialDocument={initialDocument}
        integrationBinding={integrationBinding}
        preparedPersistenceController={preparedPersistenceController}
        persistencePort={persistencePort}
        publicationPort={publicationPort}
        project={project}
        selectedSurface={undefined}
        workspaceProfile={workspaceProfile}
        workspaceSnapshot={workspaceSnapshot}
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
  if (fixtures) {
    return (
      <section className={styles.surfaceGallery} aria-labelledby="fixture-surface-title">
        <h1 className={styles.visuallyHidden} data-route-heading tabIndex={-1}>
          {project.name}
        </h1>
        <div className={styles.collectionToolbar}>
          <div className={styles.collectionHeading}>
            <div>
              <h2 id="fixture-surface-title">{surface.name}</h2>
              <p>{surface.detail}</p>
            </div>
            <span className={styles.previewBadge}>Preview data</span>
          </div>
        </div>
        <p className={styles.previewNotice} aria-label="Inert surface boundary">
          This route is inert navigation data. It cannot open, edit, run, save, or publish a Source.
        </p>
      </section>
    );
  }
  return (
    <ProjectShell
      authoringProjectRecord={authoringProjectRecord}
      fixtures={fixtures}
      initialDocument={initialDocument}
      integrationBinding={integrationBinding}
      preparedPersistenceController={preparedPersistenceController}
      persistencePort={persistencePort}
      publicationPort={publicationPort}
      project={project}
      selectedSurface={surface}
      workspaceProfile={workspaceProfile}
      workspaceSnapshot={workspaceSnapshot}
    />
  );
}

/** Trusted host-owned capabilities injected into the App shell. */
export interface DesenAppApplicationProps {
  /** Current aggregate T02 project record for persisted-token style authoring, if installed. */
  readonly authoringProjectRecord?: EditableProjectRecord | null;
  /** Initial validated Source captured when a surface editor session mounts. */
  readonly initialDocument?: DesenEditorDocument;
  /** Optional, exact-profile-authenticated host operations; never inferred from Source or URL. */
  readonly integrationBinding?: AuthoringIntegrationBindingHandle | null;
  /** Explicit factory-authenticated inert route/gallery examples, never product authority. */
  readonly projectInventoryFixture?: ProjectInventoryFixtureHandle;
  /** May hide the profile project while storage reports it missing; cannot add another project. */
  readonly profileProjectVisible?: boolean;
  /** Product-owned request that opens the supported blank-project creation flow. */
  readonly onRequestProjectCreation?: (() => void) | null;
  /** Visible-accessibility explanation used only while project creation is unavailable. */
  readonly projectCreationUnavailableMessage?: string;
  /** Already opened persistence controller owned by an outer product composition. */
  readonly preparedPersistenceController?: AuthoringPersistenceController | null;
  /** Optional raw persistence port used by legacy/direct shell embeddings. */
  readonly persistencePort?: DesenEditorPersistencePort | null;
  /** Optional publication host boundary for the selected Source. */
  readonly publicationPort?: AuthoringPublicationPort | null;
  /** Factory-authenticated project, Source, Catalog, runtime and host composition authority. */
  readonly workspaceProfile: ProjectWorkspaceProfileHandle;
}

interface AuthenticatedDesenAppApplicationProps extends DesenAppApplicationProps {
  readonly fixtures: boolean;
  readonly initialDocument: DesenEditorDocument;
  readonly projects: readonly DesenAppProjectSummary[];
  readonly workspaceSnapshot: ProjectWorkspaceProfileSnapshot;
}

function AuthenticatedDesenAppApplication({
  authoringProjectRecord = null,
  fixtures,
  initialDocument,
  integrationBinding = null,
  onRequestProjectCreation = null,
  preparedPersistenceController,
  persistencePort = null,
  projectCreationUnavailableMessage = "Project creation unlocks with catalog setup.",
  projects,
  publicationPort = null,
  workspaceProfile,
  workspaceSnapshot,
}: AuthenticatedDesenAppApplicationProps) {
  const routeLocation = useSyncExternalStore(
    subscribeDesenAppNavigation,
    readDesenAppLocation,
    readDesenAppServerLocation,
  );
  const route = readDesenAppRoute(routeLocation);
  const surfaceEditorRoute = hasResolvedSurfaceEditor(route, projects, fixtures);
  const previousRouteLocation = useRef(routeLocation);

  useEffect(() => {
    document.title = routeTitle(route, projects);
    if (previousRouteLocation.current !== routeLocation) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelector<HTMLElement>("[data-route-heading]")?.focus({ preventScroll: true });
      previousRouteLocation.current = routeLocation;
    }
  }, [projects, routeLocation, route]);

  return (
    <div className={styles.app}>
      <SkipToMainContentLink />
      <AppHeader
        onRequestProjectCreation={onRequestProjectCreation}
        projectCreationUnavailableMessage={projectCreationUnavailableMessage}
        projects={projects}
        route={route}
      />
      <main
        className={styles.main}
        data-surface-editor={surfaceEditorRoute ? "true" : undefined}
        id="desen-app-content"
        tabIndex={-1}
      >
        <RouteView
          authoringProjectRecord={authoringProjectRecord}
          fixtures={fixtures}
          initialDocument={initialDocument}
          integrationBinding={integrationBinding}
          onRequestProjectCreation={onRequestProjectCreation}
          preparedPersistenceController={preparedPersistenceController}
          persistencePort={persistencePort}
          projects={projects}
          publicationPort={publicationPort}
          route={route}
          workspaceProfile={workspaceProfile}
          workspaceSnapshot={workspaceSnapshot}
        />
      </main>
    </div>
  );
}

function UnavailableWorkspace({ message }: Readonly<{ readonly message: string }>) {
  return (
    <div className={styles.app}>
      <main className={styles.main} id="desen-app-content" tabIndex={-1}>
        <section className={styles.notFound} role="alert">
          <p className={styles.eyebrow}>Workspace unavailable</p>
          <h1>The project composition was not authenticated.</h1>
          <p>{message}</p>
        </section>
      </main>
    </div>
  );
}

/** M09+ Desen App shell with exact routes and profile-authenticated composition authority. */
export function DesenAppApplication(props: DesenAppApplicationProps) {
  const authority = readProjectWorkspaceProfileAuthority(props.workspaceProfile);
  const workspaceSnapshot = authority.status === "read" ? authority.profile : null;
  // The profile admission walks the complete Catalog contract set. A lifecycle-only outer
  // rerender (for example, the aggregate record changing from missing to created) must not
  // re-admit the same immutable Source before the creation continuation can navigate. Keep the
  // admission tied to the actual authority and Source identities; a new opened Source still
  // receives the full boundary check.
  const documentCandidate = props.initialDocument ?? workspaceSnapshot?.initialDocument ?? null;
  const documentAdmission = useMemo(
    () =>
      workspaceSnapshot === null || documentCandidate === null
        ? null
        : admitProjectWorkspaceDocument(props.workspaceProfile, documentCandidate),
    [documentCandidate, props.workspaceProfile, workspaceSnapshot],
  );

  if (workspaceSnapshot === null) {
    return (
      <UnavailableWorkspace message="DESEN did not infer a Source, Catalog, runtime adapter, or host authority." />
    );
  }
  if (
    props.integrationBinding !== undefined &&
    props.integrationBinding !== null &&
    readAuthoringIntegrationBinding(props.integrationBinding, props.workspaceProfile) === null
  ) {
    return (
      <UnavailableWorkspace message="The integration connection is not authenticated for this exact workspace profile." />
    );
  }
  if (props.publicationPort !== undefined && props.publicationPort !== null) {
    const destination = readAuthoringPublicationPortDestination(props.publicationPort);
    if (
      workspaceSnapshot.publication === null ||
      destination === null ||
      destination.channelName !== workspaceSnapshot.publication.channelName ||
      destination.hostId !== workspaceSnapshot.publication.hostId
    ) {
      return (
        <UnavailableWorkspace message="The publication port is not bound to this workspace profile's exact destination." />
      );
    }
  }
  if (documentAdmission?.status !== "admitted") {
    return (
      <UnavailableWorkspace message="The current Source does not match this profile's document, entry, surface, or Catalog authority." />
    );
  }
  let fixtures = false;
  let projects: readonly DesenAppProjectSummary[];
  if (props.projectInventoryFixture === undefined) {
    projects =
      props.profileProjectVisible === false
        ? Object.freeze([])
        : Object.freeze([projectWorkspaceProfileSummary(workspaceSnapshot)]);
  } else {
    const fixture = readProjectInventoryFixture(props.projectInventoryFixture);
    if (fixture.status !== "read") {
      return (
        <UnavailableWorkspace message="The inert project inventory was not authenticated for this workspace profile." />
      );
    }
    if (
      props.authoringProjectRecord !== undefined ||
      props.initialDocument !== undefined ||
      props.preparedPersistenceController !== undefined ||
      props.persistencePort !== undefined ||
      props.publicationPort !== undefined ||
      props.integrationBinding !== undefined ||
      props.onRequestProjectCreation !== undefined
    ) {
      return (
        <UnavailableWorkspace message="Inert project inventory cannot be composed with Source, mutation, persistence, publication, or project-creation authority." />
      );
    }
    fixtures = true;
    projects = fixture.projects;
  }
  return (
    <AuthenticatedDesenAppApplication
      {...props}
      fixtures={fixtures}
      initialDocument={documentAdmission.document}
      projects={projects}
      workspaceSnapshot={workspaceSnapshot}
    />
  );
}
