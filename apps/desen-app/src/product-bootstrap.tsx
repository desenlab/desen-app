import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { DesenAppApplication } from "./application.js";
import { createAuthoringPersistenceController } from "./authoring-persistence.js";
import { navigateDesenApp, readDesenAppLocation } from "./project-navigation.js";
import { readProjectWorkspaceProfileAuthority } from "./project-workspace-profile.js";
import desenLogoUrl from "./assets/desen-logo.svg";
import styles from "./application.module.css";

import type { FormEvent } from "react";
import type { AuthoringIntegrationBindingHandle } from "./authoring-integration.js";
import type { DesenEditorDocument, DesenEditorPersistencePort } from "@desen/editor-core";
import type {
  AuthoringPersistenceController,
  AuthoringPersistenceSaveResult,
} from "./authoring-persistence.js";
import type {
  ProjectWorkspaceProfileHandle,
  ProjectWorkspaceProfileSnapshot,
} from "./project-workspace-profile.js";

type ProductBootstrapPhase = "failed" | "missing" | "opening" | "ready";

function matchesWorkspaceProfile(
  document: DesenEditorDocument,
  profile: ProjectWorkspaceProfileSnapshot,
): boolean {
  const documentSurfaceIds = Object.keys(document.surfaces).sort();
  const profileSurfaceIds = profile.project.surfaces.map((surface) => surface.sourceId).sort();
  return (
    document.id === profile.documentId &&
    document.entry === profile.initialDocument.entry &&
    documentSurfaceIds.length === profileSurfaceIds.length &&
    documentSurfaceIds.every((surfaceId, index) => surfaceId === profileSurfaceIds[index])
  );
}

function phaseForController(
  controller: AuthoringPersistenceController,
  profile: ProjectWorkspaceProfileSnapshot,
): ProductBootstrapPhase {
  const state = controller.read();
  if (state.disposed) return "failed";
  if (state.pending === "opening") return "opening";
  if (state.generation !== null && !matchesWorkspaceProfile(state.session.document, profile)) {
    return "failed";
  }
  if (
    state.generation !== null ||
    state.saveResult?.status === "created" ||
    state.saveResult?.status === "updated" ||
    state.saveResult?.status === "unchanged" ||
    state.openResult?.status === "opened"
  ) {
    return "ready";
  }
  if (state.pending === "saving" || state.saveResult !== null) return "missing";
  if (state.openResult === null) return "opening";
  if (state.openResult.status === "missing") return "missing";
  return "failed";
}

function createProjectFailureMessage(result: AuthoringPersistenceSaveResult): string | null {
  switch (result.status) {
    case "created":
    case "updated":
    case "unchanged":
      return null;
    case "conflict":
      return "Another window created this project first. Open the stored project to continue without overwriting it.";
    case "generation-exhausted":
      return "This project cannot advance to another storage generation. Nothing was overwritten.";
    case "indeterminate":
      return "The storage service could not confirm the create result. Reopen the workspace before trying again.";
    case "failed":
      return "The project could not be created. The workspace remains unchanged.";
  }
}

interface BlankProjectDialogProps {
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onCreate: () => void;
  readonly onOpenStoredProject: () => void;
  readonly open: boolean;
  readonly pending: boolean;
  readonly profile: ProjectWorkspaceProfileSnapshot;
  readonly reopenAvailable: boolean;
}

function BlankProjectDialog({
  error,
  onCancel,
  onCreate,
  onOpenStoredProject,
  open,
  pending,
  profile,
  reopenAvailable,
}: BlankProjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!pending) onCreate();
  }

  return (
    <dialog
      aria-labelledby="blank-project-title"
      className={styles.projectDialog}
      onCancel={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onCancel();
      }}
      ref={dialogRef}
    >
      <form className={styles.projectDialogForm} onSubmit={submit}>
        <header className={styles.projectDialogHeader}>
          <div>
            <p className={styles.eyebrow}>New project</p>
            <h2 id="blank-project-title">Create a project</h2>
          </div>
          <button
            aria-label="Close new project"
            className={styles.dialogCloseButton}
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </header>

        <section aria-labelledby="project-template-title" className={styles.projectTemplateSection}>
          <div className={styles.projectDialogSectionHeading}>
            <h3 id="project-template-title">Start from</h3>
            <span>Configured workspace profile</span>
          </div>
          <label className={styles.projectTemplateCard}>
            <input
              autoFocus
              checked
              name="template"
              readOnly
              type="radio"
              value={profile.profileId}
            />
            <span aria-hidden="true" className={styles.projectTemplatePreview}>
              <span />
            </span>
            <span className={styles.projectTemplateCopy}>
              <strong>Blank {profile.project.name} project</strong>
              <small>
                {profile.runtime.target} · {profile.catalogs.length}{" "}
                {profile.catalogs.length === 1 ? "Catalog" : "Catalogs"} ·{" "}
                {profile.project.surfaces.length}{" "}
                {profile.project.surfaces.length === 1 ? "surface" : "surfaces"}
              </small>
            </span>
            <span className={styles.projectTemplateBadge}>Blank</span>
          </label>
          <p className={styles.projectTemplateBoundary}>
            This workspace creates the exact authenticated {profile.project.name} Source. It does
            not invent a project identity or silently replace an existing Source.
          </p>
        </section>

        {error === null ? null : (
          <p aria-live="assertive" className={styles.projectDialogError} role="alert">
            {error}
          </p>
        )}

        <footer className={styles.projectDialogActions}>
          <button
            className={styles.secondaryButton}
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          {reopenAvailable ? (
            <button
              className={styles.secondaryButton}
              disabled={pending}
              onClick={onOpenStoredProject}
              type="button"
            >
              Open stored project
            </button>
          ) : null}
          <button className={styles.primaryButton} disabled={pending} type="submit">
            {pending ? "Creating…" : "Create project"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function ProductStartup({
  canRetry,
  failed,
  onRetry,
}: Readonly<{
  readonly canRetry: boolean;
  readonly failed: boolean;
  readonly onRetry: () => void;
}>) {
  return (
    <div className={styles.productStartup}>
      <header className={styles.productStartupHeader}>
        <img alt="" height="24" src={desenLogoUrl} width="24" />
        <span className={styles.visuallyHidden}>DESEN</span>
      </header>
      <main className={styles.productStartupCard}>
        <span aria-hidden="true" className={styles.productStartupMark} />
        <p className={styles.eyebrow}>{failed ? "Workspace unavailable" : "Local workspace"}</p>
        <h1>{failed ? "DESEN could not open this workspace." : "Opening your projects…"}</h1>
        <p>
          {failed
            ? "The stored Source was not accepted or the local persistence service is unavailable. No fixture project was substituted."
            : "Authenticating the local Source store before any editor session is mounted."}
        </p>
        {failed && canRetry ? (
          <button className={styles.primaryButton} onClick={onRetry} type="button">
            Retry
          </button>
        ) : failed ? (
          <span aria-live="polite" className={styles.productStartupStatus} role="status">
            Open DESEN with its local workspace service, then reload this page.
          </span>
        ) : (
          <span aria-live="polite" className={styles.productStartupStatus} role="status">
            Opening workspace
          </span>
        )}
      </main>
    </div>
  );
}

/** Trusted product composition that opens or creates the exact durable local blank project. */
export interface DesenAppProductProps {
  /** Host-provided Source persistence; `null` fails closed without mounting fixture content. */
  readonly persistencePort: DesenEditorPersistencePort | null;
  /** Factory-authenticated project, Catalog, runtime and publication composition. */
  readonly workspaceProfile: ProjectWorkspaceProfileHandle;
  /** Optional host-composed integration authority for this exact workspace; off until selected. */
  readonly integrationBinding?: AuthoringIntegrationBindingHandle | null;
}

/** Normal Desen App entry with visible blank-project creation and durable Source reopening. */
export function DesenAppProduct({
  persistencePort,
  workspaceProfile,
  integrationBinding = null,
}: DesenAppProductProps) {
  const authority = readProjectWorkspaceProfileAuthority(workspaceProfile);
  const profile = authority.status === "read" ? authority.profile : null;
  const creation = useMemo(
    () =>
      persistencePort === null || profile === null
        ? null
        : createAuthoringPersistenceController({
            route: {
              projectId: profile.project.id,
              surfaceId: profile.sourceSurfaceId,
            },
            document: profile.initialDocument,
            profile: workspaceProfile,
            persistencePort,
          }),
    [persistencePort, profile, workspaceProfile],
  );
  const controller = creation?.ok === true ? creation.controller : null;
  const state = useSyncExternalStore(
    controller?.subscribe ?? (() => () => undefined),
    controller?.read ?? (() => null),
    controller?.read ?? (() => null),
  );
  const controllerLifetime = useRef<AuthoringPersistenceController | null>(null);
  const createInFlight = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creationPending, setCreationPending] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [reopenAvailable, setReopenAvailable] = useState(false);
  const phase =
    controller === null || profile === null ? "failed" : phaseForController(controller, profile);

  useEffect(() => {
    if (controller === null) return;
    controllerLifetime.current = controller;
    const current = controller.read();
    if (current.openResult === null && current.pending === null) void controller.open();
    return () => {
      if (controllerLifetime.current === controller) controllerLifetime.current = null;
      queueMicrotask(() => {
        if (controllerLifetime.current !== controller) controller.dispose();
      });
    };
  }, [controller]);

  useEffect(() => {
    if (phase !== "missing" || readDesenAppLocation() === "/projects") return;
    navigateDesenApp("/projects", true);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ready") return;
    createInFlight.current = false;
    setDialogOpen(false);
    setCreationPending(false);
    setCreationError(null);
    setReopenAvailable(false);
  }, [phase]);

  const retryOpen = useCallback(() => {
    if (controller === null || controller.read().disposed || controller.read().pending !== null)
      return;
    void controller.open();
  }, [controller]);

  const createProject = useCallback(async () => {
    if (
      controller === null ||
      createInFlight.current ||
      controller.read().disposed ||
      controller.read().pending !== null
    ) {
      return;
    }
    createInFlight.current = true;
    setCreationPending(true);
    setCreationError(null);
    setReopenAvailable(false);
    const result = await controller.save();
    createInFlight.current = false;
    if (controllerLifetime.current !== controller || controller.read().disposed) {
      return;
    }
    setCreationPending(false);
    const message = createProjectFailureMessage(result);
    if (message !== null) {
      setCreationError(message);
      setReopenAvailable(
        result.status === "conflict" ||
          result.status === "indeterminate" ||
          (result.status === "failed" && controller.read().reopenRequired),
      );
      return;
    }
    setDialogOpen(false);
    if (profile !== null) navigateDesenApp(profile.surfacePath);
  }, [controller, profile]);

  const openStoredProject = useCallback(async () => {
    if (controller === null || controller.read().pending !== null) return;
    setCreationPending(true);
    setCreationError(null);
    const result = await controller.open();
    if (controllerLifetime.current !== controller || controller.read().disposed) {
      return;
    }
    setCreationPending(false);
    if (result.status !== "opened") {
      setCreationError("The stored project could not be reopened. Nothing was overwritten.");
      return;
    }
    setDialogOpen(false);
    if (profile !== null) navigateDesenApp(profile.surfacePath);
  }, [controller, profile]);

  if (phase === "opening" || phase === "failed") {
    return (
      <ProductStartup
        canRetry={controller !== null}
        failed={phase === "failed"}
        onRetry={retryOpen}
      />
    );
  }

  if (profile === null) {
    return <ProductStartup canRetry={false} failed onRetry={() => undefined} />;
  }

  const currentDocument = state?.session.document ?? profile.initialDocument;

  return (
    <>
      <DesenAppApplication
        initialDocument={currentDocument}
        integrationBinding={integrationBinding}
        onRequestProjectCreation={
          phase === "missing"
            ? () => {
                setCreationError(null);
                setReopenAvailable(false);
                setDialogOpen(true);
              }
            : null
        }
        preparedPersistenceController={controller}
        projectCreationUnavailableMessage="The supported local project already exists in this workspace."
        profileProjectVisible={phase === "ready"}
        workspaceProfile={workspaceProfile}
      />
      <BlankProjectDialog
        error={creationError}
        onCancel={() => {
          if (!creationPending) setDialogOpen(false);
        }}
        onCreate={() => {
          void createProject();
        }}
        onOpenStoredProject={() => {
          void openStoredProject();
        }}
        open={dialogOpen}
        pending={creationPending}
        profile={profile}
        reopenAvailable={reopenAvailable}
      />
    </>
  );
}
