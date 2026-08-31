import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import referenceCatalog from "@desen/reference-catalog-web/catalog.json";

import { DesenAppApplication } from "./application.js";
import { createAuthoringPersistenceController } from "./authoring-persistence.js";
import { navigateDesenApp, readDesenAppLocation } from "./project-navigation.js";
import { DESEN_APP_LOCAL_PROJECTS } from "./project-data.js";
import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "./reference-empty-project.js";
import desenLogoUrl from "./assets/desen-logo.svg";
import styles from "./application.module.css";

import type { FormEvent } from "react";
import type { DesenEditorDocument, DesenEditorPersistencePort } from "@desen/editor-core";
import type {
  AuthoringPersistenceController,
  AuthoringPersistenceSaveResult,
} from "./authoring-persistence.js";

const PRODUCT_ROUTE = Object.freeze({ projectId: "account-app", surfaceId: "sign-in" });
const PRODUCT_SURFACE_PATH = "/projects/account-app/surfaces/sign-in";
const EMPTY_PROJECT_INVENTORY = Object.freeze([]);

type ProductBootstrapPhase = "failed" | "missing" | "opening" | "ready";

function isExactLocalProductDocument(document: DesenEditorDocument): boolean {
  const catalog = document.catalogs[0];
  return (
    document.id === "com.example.account-app" &&
    document.entry === "sign-in" &&
    document.catalogs.length === 1 &&
    catalog?.id === "run.desen.reference.sign-in" &&
    catalog.version === "0.1.0" &&
    catalog.target === "web-react" &&
    Object.keys(document.surfaces).length === 1 &&
    Object.hasOwn(document.surfaces, "sign-in")
  );
}

function phaseForController(controller: AuthoringPersistenceController): ProductBootstrapPhase {
  const state = controller.read();
  if (state.disposed) return "failed";
  if (state.pending === "opening") return "opening";
  if (state.generation !== null && !isExactLocalProductDocument(state.session.document)) {
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
  readonly reopenAvailable: boolean;
}

function BlankProjectDialog({
  error,
  onCancel,
  onCreate,
  onOpenStoredProject,
  open,
  pending,
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
            <span>1 supported profile</span>
          </div>
          <label className={styles.projectTemplateCard}>
            <input autoFocus checked name="template" readOnly type="radio" value="blank-sign-in" />
            <span aria-hidden="true" className={styles.projectTemplatePreview}>
              <span />
            </span>
            <span className={styles.projectTemplateCopy}>
              <strong>Blank sign-in project</strong>
              <small>
                Account app · web-react 0.1 · one empty Stack · 420 × 720 portrait frame
              </small>
            </span>
            <span className={styles.projectTemplateBadge}>Blank</span>
          </label>
          <p className={styles.projectTemplateBoundary}>
            This local profile creates the exact supported Account app project. It does not invent
            an arbitrary project identity or silently replace an existing Source.
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
}

/** Normal Desen App entry with visible blank-project creation and durable Source reopening. */
export function DesenAppProduct({ persistencePort }: DesenAppProductProps) {
  const creation = useMemo(
    () =>
      persistencePort === null
        ? null
        : createAuthoringPersistenceController({
            route: PRODUCT_ROUTE,
            document: EMPTY_REFERENCE_PROJECT_DOCUMENT,
            catalog: referenceCatalog,
            persistencePort,
          }),
    [persistencePort],
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
  const phase = controller === null ? "failed" : phaseForController(controller);

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
    navigateDesenApp(PRODUCT_SURFACE_PATH);
  }, [controller]);

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
    navigateDesenApp(PRODUCT_SURFACE_PATH);
  }, [controller]);

  if (phase === "opening" || phase === "failed") {
    return (
      <ProductStartup
        canRetry={controller !== null}
        failed={phase === "failed"}
        onRetry={retryOpen}
      />
    );
  }

  const projects = phase === "ready" ? DESEN_APP_LOCAL_PROJECTS : EMPTY_PROJECT_INVENTORY;
  const currentDocument = state?.session.document ?? EMPTY_REFERENCE_PROJECT_DOCUMENT;

  return (
    <>
      <DesenAppApplication
        initialDocument={currentDocument}
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
        projectInventoryIsFixture={false}
        projects={projects}
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
        reopenAvailable={reopenAvailable}
      />
    </>
  );
}
