import { Fragment, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import referenceCatalog from "@desen/reference-catalog-web/catalog.json";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";
import { DesenAdapterCanvas } from "./adapter-canvas.js";
import {
  applyAuthoringInspectorBindingEdit,
  applyAuthoringInspectorEdit,
  prepareAuthoringInspectorModel,
} from "./authoring-inspector.js";
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
import { StatePanel } from "./state-panel.js";
import { prepareAuthoringPreviewBundle, REFERENCE_EDITOR_DOCUMENT } from "./authoring-preview.js";
import {
  createDesenAppProjectPath,
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
  AuthoringBehaviorLayer,
  AuthoringLayerNode,
  AuthoringSlotContract,
  CatalogAuthoringModel,
  CatalogComponentSummary,
} from "./authoring-data.js";
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
  AuthoringSlotEdit,
  AuthoringSlotEditResult,
  AuthoringSlotProjection,
  AuthoringSlotRoute,
  AuthoringSlotSelection,
  AuthoringSlotState,
} from "./authoring-slots.js";
import type { DesenAppRoute } from "./project-navigation.js";
import type { DesenAppProjectSummary, DesenAppSurfaceSummary } from "./project-data.js";

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

type AuthoringTab = "layers" | "components" | "state";

type AuthoringDragIntent =
  | Readonly<{ readonly kind: "component"; readonly componentId: string }>
  | Readonly<{ readonly kind: "node"; readonly nodeId: string }>;

interface LayerSelectionProps {
  readonly activeSlot: AuthoringSlotSelection | null;
  readonly authoringModel: CatalogAuthoringModel;
  readonly dragIntent: AuthoringDragIntent | null;
  readonly onApplyIntent: (
    target: AuthoringSlotSelection,
    index: number,
    intent: AuthoringDragIntent,
  ) => void;
  readonly onChooseSlot: (target: AuthoringSlotSelection) => void;
  readonly onClearDrag: () => void;
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

function acceptsDragIntent(
  route: AuthoringSlotRoute,
  authoringModel: CatalogAuthoringModel,
  target: AuthoringSlotSelection,
  index: number,
  dragIntent: AuthoringDragIntent,
): boolean {
  if (dragIntent.kind === "node") {
    const compatibility = evaluateAuthoringSlotPlacement(
      route,
      authoringModel,
      target,
      dragIntent.nodeId,
      index,
    );
    return compatibility.accepted && compatibility.changesSource;
  }

  const component = authoringModel.components.find(({ id }) => id === dragIntent.componentId);
  return (
    component !== undefined &&
    evaluateAuthoringSlotInsertion(route, authoringModel, target, component.id, index).accepted
  );
}

function SlotBoundary({
  index,
  owner,
  slot,
  activeSlot,
  authoringModel,
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
  }
>) {
  const target = slotTarget(route, owner, slot);
  const selectedPlacement =
    selectedSourceNodeId === null || selectedSourceNodeId === rootNodeId
      ? null
      : evaluateAuthoringSlotPlacement(route, authoringModel, target, selectedSourceNodeId, index);
  const selectedMovable =
    selectedPlacement?.accepted === true && selectedPlacement.changesSource === true;
  const dragAccepted =
    dragIntent !== null && acceptsDragIntent(route, authoringModel, target, index, dragIntent);
  const dropReady = dragIntent !== null && dragAccepted;
  const [dragHovered, setDragHovered] = useState(false);
  const dragEnterDepth = useRef(0);

  useEffect(() => {
    dragEnterDepth.current = 0;
    setDragHovered(false);
  }, [dragIntent]);

  const active = activeSlot !== null && isSameAuthoringSlotSelection(activeSlot, target);
  const position = index + 1;
  const selectedPosition =
    selectedPlacement?.accepted === true ? selectedPlacement.finalIndex + 1 : position;
  const placementLabel =
    selectedPlacement?.accepted === true && !selectedPlacement.changesSource
      ? `Keep ${selectedSourceNodeId ?? "selected layer"} at its current position ${selectedPosition} in ${owner.displayName} ${owner.id} ${slot.name} slot`
      : `Move ${selectedSourceNodeId ?? "selected layer"} to ${owner.displayName} ${owner.id} ${slot.name} slot at position ${selectedPosition}`;

  function receiveDrop(event: DragEvent<HTMLLIElement>): void {
    if (dragIntent === null || !dropReady) return;
    event.preventDefault();
    dragEnterDepth.current = 0;
    setDragHovered(false);
    onApplyIntent(target, index, dragIntent);
  }

  function admitNativeDrag(event: DragEvent<HTMLLIElement>): void {
    if (dragIntent === null || !dropReady) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = dragIntent.kind === "component" ? "copy" : "move";
  }

  return (
    <li
      aria-label={`${owner.displayName} ${owner.id} ${slot.name} slot insertion boundary at position ${position}`}
      className={styles.slotBoundary}
      data-active-slot={active}
      data-drop-hovered={dropReady && dragHovered}
      data-drop-ready={dropReady}
      onDragEnter={(event) => {
        if (!dropReady) return;
        admitNativeDrag(event);
        dragEnterDepth.current += 1;
        setDragHovered(true);
      }}
      onDragLeave={() => {
        if (!dropReady) return;
        dragEnterDepth.current = Math.max(0, dragEnterDepth.current - 1);
        if (dragEnterDepth.current === 0) setDragHovered(false);
      }}
      onDragOver={(event) => {
        admitNativeDrag(event);
        if (dropReady) setDragHovered(true);
      }}
      onDrop={receiveDrop}
    >
      <span aria-hidden="true" className={styles.slotBoundaryLine} />
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

  return (
    <div className={styles.layerSlot} data-present={slot.present}>
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
      <ul>
        <SlotBoundary index={0} owner={owner} slot={slot} {...interaction} />
        {slot.children.map((child, index) => (
          <Fragment key={child.id}>
            <LayerNode
              dropPlacement={Object.freeze({
                owner,
                slot,
                beforeIndex: index,
                afterIndex: index + 1,
              })}
              node={child}
              movable
              {...interaction}
            />
            <SlotBoundary index={index + 1} owner={owner} slot={slot} {...interaction} />
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

function LayerNode({
  activeSlot,
  authoringModel,
  dragIntent,
  dropPlacement,
  movable = false,
  node,
  onApplyIntent,
  onChooseSlot,
  onClearDrag,
  onStartDrag,
  onToggleSelection,
  route,
  rootNodeId,
  selectedSourceNodeId,
}: Readonly<
  LayerSelectionProps & {
    readonly dropPlacement?: Readonly<{
      readonly afterIndex: number;
      readonly beforeIndex: number;
      readonly owner: AuthoringBehaviorLayer | AuthoringLayerNode;
      readonly slot: AuthoringSlotState;
    }>;
    readonly movable?: boolean;
    readonly node: AuthoringLayerNode;
  }
>) {
  const selected = selectedSourceNodeId === node.id;
  const [rowDropPosition, setRowDropPosition] = useState<"after" | "before" | null>(null);
  const interaction = {
    activeSlot,
    authoringModel,
    dragIntent,
    onApplyIntent,
    onChooseSlot,
    onClearDrag,
    onStartDrag,
    onToggleSelection,
    route,
    rootNodeId,
    selectedSourceNodeId,
  } satisfies LayerSelectionProps;

  useEffect(() => {
    setRowDropPosition(null);
  }, [dragIntent]);

  function projectedRowDrop(event: DragEvent<HTMLButtonElement>): Readonly<{
    readonly index: number;
    readonly position: "after" | "before";
    readonly target: AuthoringSlotSelection;
  }> | null {
    if (dragIntent === null || dropPlacement === undefined) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    const index = position === "before" ? dropPlacement.beforeIndex : dropPlacement.afterIndex;
    const target = slotTarget(route, dropPlacement.owner, dropPlacement.slot);
    return acceptsDragIntent(route, authoringModel, target, index, dragIntent)
      ? Object.freeze({ index, position, target })
      : null;
  }

  return (
    <li className={styles.layerNode} data-row-drop-position={rowDropPosition ?? undefined}>
      <button
        aria-label={`${selected ? "Deselect" : "Select"} ${node.displayName} layer · ${node.id}${node.conditional ? " · Conditional" : ""}`}
        aria-pressed={selected}
        className={styles.layerRow}
        data-category={node.capabilityId.split("/").at(-1)}
        data-dragging={dragIntent?.kind === "node" && dragIntent.nodeId === node.id}
        draggable={movable}
        onDragEnd={() => {
          setRowDropPosition(null);
          onClearDrag();
        }}
        onDragLeave={(event) => {
          const relatedTarget = event.relatedTarget;
          if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
          setRowDropPosition(null);
        }}
        onDragOver={(event) => {
          const projected = projectedRowDrop(event);
          if (projected === null) {
            setRowDropPosition(null);
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = dragIntent?.kind === "component" ? "copy" : "move";
          setRowDropPosition(projected.position);
        }}
        onDragStart={(event) => {
          if (!movable) return;
          onStartDrag(Object.freeze({ kind: "node", nodeId: node.id }));
          prepareNativeDrag(event, "move");
        }}
        onDrop={(event) => {
          const projected = projectedRowDrop(event);
          if (projected === null || dragIntent === null) return;
          event.preventDefault();
          event.stopPropagation();
          setRowDropPosition(null);
          onApplyIntent(projected.target, projected.index, dragIntent);
        }}
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
  activeSlot,
  authoringModel,
  behavior,
  dragIntent,
  onApplyIntent,
  onChooseSlot,
  onClearDrag,
  onStartDrag,
  onToggleSelection,
  route,
  rootNodeId,
  selectedSourceNodeId,
}: Readonly<LayerSelectionProps & { readonly behavior: AuthoringBehaviorLayer }>) {
  const interaction = {
    activeSlot,
    authoringModel,
    dragIntent,
    onApplyIntent,
    onChooseSlot,
    onClearDrag,
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
      <section aria-label={`${selectedSurface.name} layer hierarchy`}>
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
  const [targetDragHovered, setTargetDragHovered] = useState(false);
  const targetDragEnterDepth = useRef(0);

  useEffect(() => {
    targetDragEnterDepth.current = 0;
    setTargetDragHovered(false);
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

  const targetName =
    readySlot === null
      ? "Placement target · choose a named slot"
      : `Placement target · ${readySlot.owner.displayName} ${readySlot.owner.id} ${readySlot.slot.name} slot · ${slotCardinalityLabel(readySlot.slot)}`;

  return (
    <div className={styles.componentsView}>
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
        data-drop-hovered={componentDropReady && targetDragHovered}
        data-drop-ready={componentDropReady}
        data-guide={readySlot === null}
        data-ready={readySlot !== null}
        role="group"
        onDragEnter={(event) => {
          if (!componentDropReady) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          targetDragEnterDepth.current += 1;
          setTargetDragHovered(true);
        }}
        onDragLeave={() => {
          if (!componentDropReady) return;
          targetDragEnterDepth.current = Math.max(0, targetDragEnterDepth.current - 1);
          if (targetDragEnterDepth.current === 0) setTargetDragHovered(false);
        }}
        onDragOver={(event) => {
          if (!componentDropReady) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setTargetDragHovered(true);
        }}
        onDrop={(event) => {
          if (!componentDropReady || dragIntent?.kind !== "component") return;
          event.preventDefault();
          targetDragEnterDepth.current = 0;
          setTargetDragHovered(false);
          addComponent(dragIntent.componentId);
        }}
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
              <strong>
                {draggedComponent === undefined
                  ? `Add to ${readySlot.owner.displayName}`
                  : `Drop ${draggedComponent.displayName} here`}
              </strong>
              <small>
                {readySlot.owner.id} · {readySlot.slot.name} slot
                {draggedComponent === undefined
                  ? " · Drop here or click a component below"
                  : ` · position ${readySlot.slot.children.length + 1}`}
              </small>
            </span>
            <span className={styles.slotContractBadge}>
              {readySlot.slot.children.length}{" "}
              {readySlot.slot.children.length === 1 ? "item" : "items"}
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
                      return (
                        <button
                          aria-label={
                            readySlot === null
                              ? `${component.displayName} · choose a named slot first`
                              : enabled
                                ? `Insert ${component.displayName} into ${readySlot.owner.displayName} ${readySlot.owner.id} ${readySlot.slot.name} slot at position ${readySlot.slot.children.length + 1}`
                                : `${action} · ${component.displayName} in ${readySlot.owner.displayName} ${readySlot.owner.id} ${readySlot.slot.name} slot`
                          }
                          className={styles.componentItem}
                          disabled={!enabled}
                          draggable={enabled}
                          onClick={() => addComponent(component.id)}
                          onDragEnd={onClearDrag}
                          onDragStart={(event) => {
                            if (!enabled) return;
                            onStartDrag(
                              Object.freeze({ kind: "component", componentId: component.id }),
                            );
                            prepareNativeDrag(event, "copy");
                          }}
                          type="button"
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
                                title="Drag to the placement target"
                              />
                            ) : null}
                            <span className={styles.componentMeta}>{action}</span>
                          </span>
                        </button>
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
  model,
  onDeleteSelection,
  onSlotEdit,
  onStateEdit,
  onToggleSelection,
  route,
  selection,
  selectedSourceNodeId,
  selectedSurface,
  stateModel,
}: Readonly<{
  readonly model: CatalogAuthoringModel;
  readonly onDeleteSelection: () => AuthoringSlotEditResult;
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
  const [dragIntent, setDragIntent] = useState<AuthoringDragIntent | null>(null);
  const [notice, setNotice] = useState("");
  const panelId = useId();
  const layersTab = useRef<HTMLButtonElement>(null);
  const componentsTab = useRef<HTMLButtonElement>(null);
  const stateTab = useRef<HTMLButtonElement>(null);
  const slotProjection =
    activeSlot === null ? null : projectAuthoringSlotSelection(activeSlot, route, model);
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
    setActiveSlot(null);
    setDragIntent(null);
    setNotice("The previous slot target is no longer current.");
  }, [model, slotProjection?.status]);

  function chooseSlot(target: AuthoringSlotSelection): void {
    setActiveSlot((current) =>
      current !== null && isSameAuthoringSlotSelection(current, target) ? current : target,
    );
    setActiveTab("components");
    componentsTab.current?.focus();
    setNotice(`Choose a Catalog component for ${target.ownerId} · ${target.slot}.`);
  }

  function toggleLayer(node: AuthoringLayerNode): void {
    setNotice("");
    onToggleSelection(node);
  }

  function applyIntent(
    target: AuthoringSlotSelection,
    index: number,
    intent: AuthoringDragIntent,
  ): void {
    const targetProjection = projectAuthoringSlotSelection(target, route, model);
    const result = onSlotEdit(
      target,
      intent.kind === "component"
        ? { kind: "insert", componentId: intent.componentId, index }
        : { kind: "place", nodeId: intent.nodeId, index },
    );
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
    setNotice(
      result.operation === "insert"
        ? `Inserted ${model.components.find(({ id }) => id === (intent.kind === "component" ? intent.componentId : ""))?.displayName ?? result.nodeId} in ${targetProjection.status === "ready" ? `${targetProjection.owner.displayName} ${targetProjection.slot.name} slot at position ${index + 1}` : "the selected slot"}.`
        : result.operation === "move"
          ? `Moved ${result.nodeId} to ${targetProjection.status === "ready" ? `${targetProjection.owner.displayName} ${targetProjection.slot.name} slot` : "the selected slot"}.`
          : `Reordered ${result.nodeId} in ${targetProjection.status === "ready" ? `${targetProjection.owner.displayName} ${targetProjection.slot.name} slot` : "the selected slot"}.`,
    );
  }

  function selectAdjacentTab(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs: readonly AuthoringTab[] = ["layers", "components", "state"];
    const currentIndex = tabs.indexOf(activeTab);
    const nextTab =
      event.key === "Home"
        ? "layers"
        : event.key === "End"
          ? "state"
          : (tabs[
              (currentIndex + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length
            ] ?? "layers");
    setActiveTab(nextTab);
    (nextTab === "layers"
      ? layersTab
      : nextTab === "components"
        ? componentsTab
        : stateTab
    ).current?.focus();
  }

  function requestSlotChoice(): void {
    setActiveTab("layers");
    layersTab.current?.focus();
    setNotice("Choose a named slot in Layers, then return to Components.");
  }

  function deleteSelection(): void {
    if (selection === null || deletionCompatibility?.accepted !== true) return;
    const result = onDeleteSelection();
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
  }

  return (
    <aside aria-label="Authoring panel" className={styles.authoringPanel}>
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
      </div>
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
            activeSlot={activeSlot}
            authoringModel={model}
            dragIntent={dragIntent}
            model={model}
            onApplyIntent={applyIntent}
            onChooseSlot={chooseSlot}
            onClearDrag={() => setDragIntent(null)}
            onStartDrag={setDragIntent}
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
          onClearDrag={() => setDragIntent(null)}
          onRequestSlotChoice={requestSlotChoice}
          onStartDrag={setDragIntent}
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
      {selection === null || activeTab === "state" ? null : (
        <div className={styles.authoringSelectionActions}>
          <button
            aria-describedby={`${panelId}-delete-layer-description`}
            aria-label={`Delete ${selection.displayName} layer · ${selection.sourceNodeId}`}
            className={styles.deleteLayerAction}
            disabled={deletionCompatibility?.accepted !== true}
            onClick={deleteSelection}
            type="button"
          >
            Delete layer
          </button>
          <small id={`${panelId}-delete-layer-description`}>{deletionReason}</small>
        </div>
      )}
      <p aria-atomic="true" aria-live="polite" className={styles.authoringBoundary} role="status">
        {notice ||
          (activeTab === "state"
            ? `Local state · ${selectedSurface.name}`
            : selection === null
              ? "Choose a Source layer to inspect, move, or edit its properties."
              : `Selected · ${selection.displayName}${selection.conditional ? " · Conditional" : ""}`)}
      </p>
    </aside>
  );
}

function SurfaceEditor({
  project,
  selectedSurface,
}: Readonly<{
  readonly project: DesenAppProjectSummary;
  readonly selectedSurface: DesenAppSurfaceSummary;
}>) {
  const [selection, setSelection] = useState<AuthoringComponentSelection | null>(null);
  const [authoringSession, setAuthoringSession] = useState(() =>
    Object.freeze({
      document: REFERENCE_EDITOR_DOCUMENT,
      preview: prepareAuthoringPreviewBundle(REFERENCE_EDITOR_DOCUMENT),
    }),
  );
  const { document, preview } = authoringSession;
  const route = useMemo(
    () => Object.freeze({ projectId: project.id, surfaceId: selectedSurface.id }),
    [project.id, selectedSurface.id],
  );
  const preparedModel = useMemo(
    () => prepareCatalogAuthoringModel(referenceCatalog, document),
    [document],
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

  function toggleSelection(node: AuthoringLayerNode): void {
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
    if (selection === null) return Object.freeze({ ok: false, reason: "selection-invalid" });
    const result = applyAuthoringInspectorEdit(document, referenceCatalog, route, selection, edit);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    setAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
    return result;
  }

  function editSelectedBinding(edit: AuthoringInspectorBindingEdit): AuthoringInspectorEditResult {
    if (selection === null) return Object.freeze({ ok: false, reason: "selection-invalid" });
    const result = applyAuthoringInspectorBindingEdit(
      document,
      referenceCatalog,
      route,
      selection,
      edit,
    );
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    setAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
    return result;
  }

  function editLocalState(edit: AuthoringStateEdit): AuthoringStateEditResult {
    const result = applyAuthoringStateEdit(document, referenceCatalog, route, edit);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    setAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
    return result;
  }

  function editNamedSlot(
    target: AuthoringSlotSelection,
    edit: AuthoringSlotEdit,
  ): AuthoringSlotEditResult {
    const result = applyAuthoringSlotEdit(document, referenceCatalog, route, target, edit);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    setAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
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
    if (selection === null) return Object.freeze({ ok: false, reason: "edit-rejected" });
    const result = applyAuthoringNodeDelete(document, referenceCatalog, route, selection);
    if (!result.ok) return result;
    const nextPreview = prepareAuthoringPreviewBundle(result.document);
    if (!nextPreview.ok) {
      return Object.freeze({ ok: false, reason: "preview-unavailable" });
    }
    setAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));
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
    <section className={styles.surfaceEditor} aria-labelledby="workspace-title">
      <h1 className={styles.visuallyHidden} data-route-heading id="project-title" tabIndex={-1}>
        {project.name}
      </h1>

      <AuthoringPanel
        model={model}
        onDeleteSelection={deleteSelectedLayer}
        onSlotEdit={editNamedSlot}
        onStateEdit={editLocalState}
        onToggleSelection={toggleSelection}
        route={route}
        selection={selection}
        selectedSourceNodeId={selection?.sourceNodeId ?? null}
        selectedSurface={selectedSurface}
        stateModel={stateModel}
      />

      <div className={styles.surfaceFrame}>
        <div className={styles.surfaceFrameHeader}>
          <div>
            <h2 id="workspace-title">{selectedSurface.name}</h2>
            <span>{selectedSurface.capabilityId}</span>
          </div>
          <SurfaceState state={selectedSurface.state} />
        </div>

        <div className={styles.surfaceFrameBody}>
          <DesenAdapterCanvas
            authoringModel={model}
            bundle={preview.ok ? preview.bundle : null}
            projectId={project.id}
            selection={selection}
            surfaceId={selectedSurface.id}
          />
        </div>

        <div className={styles.boundaryNote}>
          <strong>Preview data</strong>
          <span>
            Catalog-backed property and named-slot edits stay in this session and refresh the exact
            adapter preview. Selection, placement, and Inspector chrome never enter the managed
            component tree. Save, control-plane publication, and activation remain unavailable.
          </span>
        </div>
      </div>

      <InspectorPanel
        inspector={inspector}
        onBindingEdit={editSelectedBinding}
        onEdit={editSelectedProperty}
      />

      <div className={styles.editorStatus}>
        <span>{project.navigationStatus}</span>
        <span aria-hidden="true">·</span>
        <span>{preview.ok ? "Session draft" : "Preview unavailable"}</span>
      </div>
    </section>
  );
}

function ProjectShell({
  project,
  selectedSurface,
}: Readonly<{
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

function RouteView({ route }: Readonly<{ readonly route: DesenAppRoute }>) {
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
    return <ProjectShell project={project} selectedSurface={undefined} />;

  const surface = findDesenAppSurface(project, route.surfaceId);
  if (surface === undefined) {
    return (
      <NotFound
        context={`“${project.name}” does not contain that surface. The project remains unchanged.`}
        pathname={route.pathname}
      />
    );
  }
  return <ProjectShell project={project} selectedSurface={surface} />;
}

/** M09 Desen App shell with exact routes, schema-driven Source editing, and adapter preview. */
export function DesenAppApplication() {
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
        <RouteView route={route} />
      </main>
    </div>
  );
}
