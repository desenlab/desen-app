/* eslint-disable @typescript-eslint/no-invalid-void-type -- The controller is an external-store
 * boundary whose callbacks are deliberately receiver-independent. */
import { prepareCatalogAuthoringModel } from "./authoring-data.js";
import { prepareAuthoringPreviewBundle } from "./authoring-preview.js";
import {
  admitProjectWorkspaceDocument,
  readProjectWorkspaceProfileAuthority,
} from "./project-workspace-profile.js";
import { canonicalizeJson, isJsonPointer } from "@desen/protocol";

import type {
  DesenEditorDocument,
  DesenEditorPersistenceDiagnostic,
  DesenEditorPersistenceDiagnosticCode,
  DesenEditorPersistencePort,
} from "@desen/editor-core";
import type { DesenDiagnosticContext, DesenDiagnosticSubject } from "@desen/protocol";
import type { CatalogAuthoringModel } from "./authoring-data.js";
import type { AuthoringPreviewBundleSuccess } from "./authoring-preview.js";
import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";
import type { PublishCatalogPackageCandidate } from "@desen/publisher";
import type { DesenValidatedInteractionCatalogSet } from "@desen/validator";

const MAX_GENERATION = Number.MAX_SAFE_INTEGER;
const CONFIGURATION_KEYS = Object.freeze(["document", "persistencePort", "profile", "route"]);
const PERSISTENCE_PORT_KEYS = Object.freeze(["openSource", "saveSource"]);
const PERSISTENCE_DIAGNOSTIC_CODES = Object.freeze([
  "run.desen.editor/PERSISTENCE_ADAPTER_FAILURE",
  "run.desen.editor/PERSISTENCE_ADAPTER_RESULT_INVALID",
  "run.desen.editor/PERSISTENCE_AUTHENTICATION_REQUIRED",
  "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
  "run.desen.editor/PERSISTENCE_DOCUMENT_INVALID",
  "run.desen.editor/PERSISTENCE_LIMIT_EXCEEDED",
  "run.desen.editor/PERSISTENCE_REQUEST_INVALID",
  "run.desen.editor/PERSISTENCE_SOURCE_INVALID",
  "run.desen.editor/PERSISTENCE_SOURCE_LIMIT_EXCEEDED",
  "run.desen.editor/PERSISTENCE_STORAGE_BUSY",
  "run.desen.editor/PERSISTENCE_STORAGE_CORRUPT",
  "run.desen.editor/PERSISTENCE_STORAGE_UNAVAILABLE",
  "run.desen.editor/PERSISTENCE_UNSAFE_STORAGE",
] satisfies readonly DesenEditorPersistenceDiagnosticCode[]);

type PersistencePendingOperation = "opening" | "saving";
type OperationToken = Readonly<Record<never, never>>;

/** Exact App route that selects one project-owned persistence identity and surface admission. */
export interface AuthoringPersistenceRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** Atomically admitted authored Source and its matching publishable preview. */
export interface AuthoringPersistenceSession {
  readonly document: DesenEditorDocument;
  readonly preview: AuthoringPreviewBundleSuccess;
}

/** Stable local reason why an authored Source could not cross the App persistence boundary. */
export type AuthoringPersistenceFailureReason =
  | "catalog-invalid"
  | "disposed"
  | "document-invalid"
  | "document-mismatch"
  | "operation-in-progress"
  | "persistence-failed"
  | "port-invalid"
  | "preview-unavailable"
  | "profile-invalid"
  | "projection-limit"
  | "reopen-required"
  | "route-invalid"
  | "stale-operation";

/** Controlled open failure with an optional redacted Editor Core persistence diagnostic. */
export interface AuthoringPersistenceOpenFailure {
  readonly status: "failed";
  readonly reason: AuthoringPersistenceFailureReason;
  readonly diagnostic: DesenEditorPersistenceDiagnostic | null;
}

/** Exact successful open after route, document, Catalog, and preview admission. */
export interface AuthoringPersistenceOpenSuccess {
  readonly status: "opened";
  readonly generation: number;
  readonly session: AuthoringPersistenceSession;
}

/** Open outcome kept distinct from every save settlement. */
export type AuthoringPersistenceOpenResult =
  | AuthoringPersistenceOpenSuccess
  | Readonly<{ readonly status: "missing" }>
  | AuthoringPersistenceOpenFailure;

/** Controlled save failure with an optional redacted Editor Core persistence diagnostic. */
export interface AuthoringPersistenceSaveFailure {
  readonly status: "failed";
  readonly reason: AuthoringPersistenceFailureReason;
  readonly diagnostic: DesenEditorPersistenceDiagnostic | null;
}

/** App-owned save settlement retaining every distinct Editor Core persistence outcome. */
export type AuthoringPersistenceSaveResult =
  | Readonly<{ readonly status: "created"; readonly generation: 1 }>
  | Readonly<{ readonly status: "updated"; readonly generation: number }>
  | Readonly<{ readonly status: "unchanged"; readonly generation: number }>
  | Readonly<{ readonly status: "conflict"; readonly currentGeneration: number | null }>
  | Readonly<{ readonly status: "generation-exhausted"; readonly generation: number }>
  | Readonly<{
      readonly status: "indeterminate";
      readonly diagnostic: DesenEditorPersistenceDiagnostic;
    }>
  | AuthoringPersistenceSaveFailure;

/** Immutable external-store snapshot for authored Source persistence UI. */
export interface AuthoringPersistenceState {
  readonly route: AuthoringPersistenceRoute;
  readonly sourceKey: string;
  readonly session: AuthoringPersistenceSession;
  readonly generation: number | null;
  readonly savedDocument: DesenEditorDocument | null;
  readonly dirty: boolean;
  readonly reopenRequired: boolean;
  readonly pending: PersistencePendingOperation | null;
  readonly openResult: AuthoringPersistenceOpenResult | null;
  readonly saveResult: AuthoringPersistenceSaveResult | null;
  readonly disposed: boolean;
}

/** Result of replacing only the controller's authored Source session. */
export type AuthoringPersistenceDocumentReplacementResult =
  | Readonly<{ readonly ok: true; readonly session: AuthoringPersistenceSession }>
  | Readonly<{
      readonly ok: false;
      readonly reason: Extract<
        AuthoringPersistenceFailureReason,
        | "catalog-invalid"
        | "disposed"
        | "document-invalid"
        | "document-mismatch"
        | "preview-unavailable"
        | "projection-limit"
      >;
    }>;

/** Receiver-independent, React-free controller suitable for `useSyncExternalStore`. */
export interface AuthoringPersistenceController {
  readonly read: (this: void) => AuthoringPersistenceState;
  readonly subscribe: (this: void, listener: () => void) => () => void;
  readonly replaceAuthoredDocument: (
    this: void,
    document: DesenEditorDocument,
  ) => AuthoringPersistenceDocumentReplacementResult;
  readonly open: (this: void) => Promise<AuthoringPersistenceOpenResult>;
  readonly save: (this: void) => Promise<AuthoringPersistenceSaveResult>;
  readonly dispose: (this: void) => void;
}

const PERSISTENCE_CONTROLLER_PROFILES = new WeakMap<
  AuthoringPersistenceController,
  ProjectWorkspaceProfileHandle
>();

/** Closed identity check for a factory-created controller and its exact workspace profile. */
export type AuthoringPersistenceControllerAuthenticationResult =
  | Readonly<{ readonly status: "authenticated" }>
  | Readonly<{ readonly status: "invalid-controller" | "profile-mismatch" }>;

/**
 * Authenticates that a prepared controller was created for the exact same opaque profile handle.
 *
 * @remarks Structural controller compatibility cannot transfer Source CAS state, saved-document
 * authority, or generation receipts between product profiles.
 */
export function authenticateAuthoringPersistenceControllerProfile(
  controller: AuthoringPersistenceController,
  profile: ProjectWorkspaceProfileHandle,
): AuthoringPersistenceControllerAuthenticationResult {
  if (typeof controller !== "object" || controller === null) {
    return Object.freeze({ status: "invalid-controller" });
  }
  const capturedProfile = PERSISTENCE_CONTROLLER_PROFILES.get(controller);
  return capturedProfile === undefined
    ? Object.freeze({ status: "invalid-controller" })
    : capturedProfile === profile
      ? Object.freeze({ status: "authenticated" })
      : Object.freeze({ status: "profile-mismatch" });
}

/** Exact trusted inputs captured by the App-owned persistence controller. */
export interface AuthoringPersistenceControllerOptions {
  readonly route: AuthoringPersistenceRoute;
  readonly document: DesenEditorDocument;
  readonly profile: ProjectWorkspaceProfileHandle;
  readonly persistencePort: DesenEditorPersistencePort;
}

/** Fail-closed result of creating one route-bound persistence controller. */
export type AuthoringPersistenceControllerCreationResult =
  | Readonly<{ readonly ok: true; readonly controller: AuthoringPersistenceController }>
  | Readonly<{
      readonly ok: false;
      readonly reason: Extract<
        AuthoringPersistenceFailureReason,
        | "catalog-invalid"
        | "document-invalid"
        | "document-mismatch"
        | "port-invalid"
        | "preview-unavailable"
        | "profile-invalid"
        | "projection-limit"
        | "route-invalid"
      >;
    }>;

interface CapturedPersistencePort {
  readonly openSource: DesenEditorPersistencePort["openSource"];
  readonly saveSource: DesenEditorPersistencePort["saveSource"];
}

type CapturedOpenSettlement =
  | Readonly<{ readonly status: "missing" }>
  | Readonly<{
      readonly status: "opened";
      readonly generation: number;
      readonly document: unknown;
    }>
  | Readonly<{
      readonly status: "failed";
      readonly diagnostic: DesenEditorPersistenceDiagnostic;
    }>;

interface AdmissionSuccess {
  readonly ok: true;
  readonly canonicalDocument: string;
  readonly model: CatalogAuthoringModel;
  readonly session: AuthoringPersistenceSession;
}

interface AdmissionFailure {
  readonly ok: false;
  readonly reason: Extract<
    AuthoringPersistenceFailureReason,
    | "catalog-invalid"
    | "document-invalid"
    | "document-mismatch"
    | "preview-unavailable"
    | "projection-limit"
  >;
}

type AdmissionResult = AdmissionFailure | AdmissionSuccess;

function exactOwnData(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
      output[key] = descriptor.value;
    }
    return Object.freeze(output);
  } catch {
    return undefined;
  }
}

function allowedOwnData(
  input: unknown,
  allowedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
      return undefined;
    }
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
      output[key] = descriptor.value;
    }
    return Object.freeze(output);
  } catch {
    return undefined;
  }
}

function captureRoute(
  route: unknown,
  projectId: string,
  sourceSurfaceIds: ReadonlySet<string>,
): AuthoringPersistenceRoute | undefined {
  const values = exactOwnData(route, ["projectId", "surfaceId"]);
  if (
    values === undefined ||
    values.projectId !== projectId ||
    typeof values.surfaceId !== "string" ||
    !sourceSurfaceIds.has(values.surfaceId)
  ) {
    return undefined;
  }
  return Object.freeze({
    projectId,
    surfaceId: values.surfaceId,
  });
}

function capturePersistencePort(port: unknown): CapturedPersistencePort | undefined {
  const values = exactOwnData(port, PERSISTENCE_PORT_KEYS);
  if (
    values === undefined ||
    typeof values.openSource !== "function" ||
    typeof values.saveSource !== "function"
  ) {
    return undefined;
  }
  return Object.freeze({
    openSource: values.openSource as DesenEditorPersistencePort["openSource"],
    saveSource: values.saveSource as DesenEditorPersistencePort["saveSource"],
  });
}

function positiveGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function wellFormedNonemptyString(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function persistenceDiagnosticCode(value: unknown): value is DesenEditorPersistenceDiagnosticCode {
  return (
    typeof value === "string" &&
    PERSISTENCE_DIAGNOSTIC_CODES.some((candidate) => candidate === value)
  );
}

function captureDiagnosticSubject(input: unknown): Readonly<DesenDiagnosticSubject> | undefined {
  const values = exactOwnData(input, ["id", "kind"]);
  if (
    values === undefined ||
    (values.kind !== "node" && values.kind !== "behavior") ||
    !wellFormedNonemptyString(values.id)
  ) {
    return undefined;
  }
  return Object.freeze({ kind: values.kind, id: values.id });
}

function captureDiagnosticContext(input: unknown): Readonly<DesenDiagnosticContext> | undefined {
  const values = allowedOwnData(input, ["capabilityId", "documentId", "subject", "surfaceId"]);
  if (values === undefined) return undefined;
  const output: {
    capabilityId?: string;
    documentId?: string;
    subject?: Readonly<DesenDiagnosticSubject>;
    surfaceId?: string;
  } = {};
  if (values.documentId !== undefined) {
    if (!wellFormedNonemptyString(values.documentId)) return undefined;
    output.documentId = values.documentId;
  }
  if (values.surfaceId !== undefined) {
    if (!wellFormedNonemptyString(values.surfaceId)) return undefined;
    output.surfaceId = values.surfaceId;
  }
  if (values.subject !== undefined) {
    const subject = captureDiagnosticSubject(values.subject);
    if (subject === undefined) return undefined;
    output.subject = subject;
  }
  if (values.capabilityId !== undefined) {
    if (!wellFormedNonemptyString(values.capabilityId)) return undefined;
    output.capabilityId = values.capabilityId;
  }
  return Object.keys(output).length === 0 ? undefined : Object.freeze(output);
}

function capturePersistenceDiagnostic(
  input: unknown,
): DesenEditorPersistenceDiagnostic | undefined {
  const values = allowedOwnData(input, ["code", "context", "message", "pointer"]);
  if (
    values === undefined ||
    !persistenceDiagnosticCode(values.code) ||
    !wellFormedNonemptyString(values.message)
  ) {
    return undefined;
  }
  if (values.pointer !== undefined && !isJsonPointer(values.pointer)) return undefined;
  const context =
    values.context === undefined ? undefined : captureDiagnosticContext(values.context);
  if (values.context !== undefined && context === undefined) return undefined;
  return Object.freeze({
    code: values.code,
    message: values.message,
    ...(values.pointer !== undefined ? { pointer: values.pointer } : {}),
    ...(context !== undefined ? { context } : {}),
  });
}

function captureOpenSettlement(input: unknown): CapturedOpenSettlement | undefined {
  const missing = exactOwnData(input, ["status"]);
  if (missing?.status === "missing") return Object.freeze({ status: "missing" });

  const opened = exactOwnData(input, ["document", "generation", "status"]);
  if (opened?.status === "opened" && positiveGeneration(opened.generation)) {
    return Object.freeze({
      status: "opened",
      generation: opened.generation,
      document: opened.document,
    });
  }

  const failed = exactOwnData(input, ["diagnostic", "status"]);
  if (failed?.status !== "failed") return undefined;
  const diagnostic = capturePersistenceDiagnostic(failed.diagnostic);
  return diagnostic === undefined ? undefined : Object.freeze({ status: "failed", diagnostic });
}

function captureSaveSettlement(
  input: unknown,
  expectedGeneration: number | null,
): AuthoringPersistenceSaveResult | undefined {
  const generated = exactOwnData(input, ["generation", "status"]);
  if (generated?.status === "created") {
    return expectedGeneration === null && generated.generation === 1
      ? Object.freeze({ status: "created", generation: 1 })
      : undefined;
  }
  if (generated?.status === "updated") {
    return expectedGeneration !== null &&
      expectedGeneration < MAX_GENERATION &&
      generated.generation === expectedGeneration + 1
      ? Object.freeze({ status: "updated", generation: expectedGeneration + 1 })
      : undefined;
  }
  if (generated?.status === "unchanged") {
    return expectedGeneration !== null && generated.generation === expectedGeneration
      ? Object.freeze({ status: "unchanged", generation: expectedGeneration })
      : undefined;
  }
  if (generated?.status === "generation-exhausted") {
    return expectedGeneration === MAX_GENERATION && generated.generation === MAX_GENERATION
      ? Object.freeze({ status: "generation-exhausted", generation: MAX_GENERATION })
      : undefined;
  }

  const conflict = exactOwnData(input, ["currentGeneration", "status"]);
  if (conflict?.status === "conflict") {
    const currentGeneration = conflict.currentGeneration;
    if (!(currentGeneration === null || positiveGeneration(currentGeneration))) return undefined;
    if (
      expectedGeneration === null
        ? currentGeneration === null
        : currentGeneration === expectedGeneration
    ) {
      return undefined;
    }
    return Object.freeze({ status: "conflict", currentGeneration });
  }

  const diagnosed = exactOwnData(input, ["diagnostic", "status"]);
  if (diagnosed?.status !== "indeterminate" && diagnosed?.status !== "failed") return undefined;
  const diagnostic = capturePersistenceDiagnostic(diagnosed.diagnostic);
  if (diagnostic === undefined) return undefined;
  return diagnosed.status === "indeterminate"
    ? Object.freeze({ status: "indeterminate", diagnostic })
    : saveFailure("persistence-failed", diagnostic);
}

function admissionFailure(reason: AdmissionFailure["reason"]): AdmissionFailure {
  return Object.freeze({ ok: false, reason });
}

function admitSession(
  profileHandle: ProjectWorkspaceProfileHandle,
  catalogs: DesenValidatedInteractionCatalogSet,
  catalogPackages: readonly PublishCatalogPackageCandidate[],
  surfaceId: string,
  document: unknown,
): AdmissionResult {
  const workspaceAdmission = admitProjectWorkspaceDocument(profileHandle, document);
  if (workspaceAdmission.status !== "admitted") {
    return admissionFailure(
      workspaceAdmission.reason === "catalog-document-mismatch"
        ? "catalog-invalid"
        : workspaceAdmission.reason === "document-mismatch" ||
            workspaceAdmission.reason === "profile-invalid"
          ? "document-mismatch"
          : "document-invalid",
    );
  }
  let prepared: ReturnType<typeof prepareCatalogAuthoringModel>;
  try {
    prepared = prepareCatalogAuthoringModel(catalogs, workspaceAdmission.document);
  } catch {
    return admissionFailure("document-invalid");
  }
  if (!prepared.ok) {
    return admissionFailure(
      prepared.reason === "catalog-invalid"
        ? "catalog-invalid"
        : prepared.reason === "projection-limit"
          ? "projection-limit"
          : "document-invalid",
    );
  }
  if (!prepared.model.surfaces.some(({ id }) => id === surfaceId)) {
    return admissionFailure("document-mismatch");
  }
  let canonicalDocument: string;
  try {
    canonicalDocument = canonicalizeJson(prepared.model.validationDocument);
  } catch {
    return admissionFailure("document-invalid");
  }
  const preview = prepareAuthoringPreviewBundle(prepared.model.validationDocument, catalogPackages);
  if (!preview.ok) return admissionFailure("preview-unavailable");
  return Object.freeze({
    ok: true,
    canonicalDocument,
    model: prepared.model,
    session: Object.freeze({
      document: prepared.model.validationDocument,
      preview,
    }),
  });
}

function openFailure(
  reason: AuthoringPersistenceOpenFailure["reason"],
  diagnostic: DesenEditorPersistenceDiagnostic | null = null,
): AuthoringPersistenceOpenFailure {
  return Object.freeze({ status: "failed", reason, diagnostic });
}

function saveFailure(
  reason: AuthoringPersistenceSaveFailure["reason"],
  diagnostic: DesenEditorPersistenceDiagnostic | null = null,
): AuthoringPersistenceSaveFailure {
  return Object.freeze({ status: "failed", reason, diagnostic });
}

function unexpectedSaveIndeterminate(): Extract<
  AuthoringPersistenceSaveResult,
  { readonly status: "indeterminate" }
> {
  return Object.freeze({
    status: "indeterminate",
    diagnostic: Object.freeze({
      code: "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
      message: "The editor Source may have committed; reopen it before another save.",
    }),
  });
}

function freezeState(state: AuthoringPersistenceState): AuthoringPersistenceState {
  return Object.freeze(state);
}

function createOperationToken(): OperationToken {
  return Object.freeze({});
}

/**
 * Resolves the one reviewed project-scoped local Source key.
 *
 * @remarks The key is derived only from the exact App route. It deliberately ignores both the
 * selected surface and `Source.id`, so all surfaces in this project share one complete Source CAS
 * identity. Unknown projects and surfaces fail closed instead of inventing storage aliases.
 */
export function deriveAuthoringPersistenceSourceKey(
  route: AuthoringPersistenceRoute,
  profile: ProjectWorkspaceProfileHandle,
): string | null {
  const authority = readProjectWorkspaceProfileAuthority(profile);
  if (authority.status !== "read") return null;
  const sourceSurfaceIds = new Set(
    authority.profile.project.surfaces.map((surface) => surface.sourceId),
  );
  return captureRoute(route, authority.profile.project.id, sourceSurfaceIds) === undefined
    ? null
    : authority.profile.sourceKey;
}

/**
 * Creates one App-owned persistence state machine over the public Editor Core port.
 *
 * @remarks Only the controller's authored `session.document` is ever sent to `saveSource`; no
 * alternate presentation input is accepted. A successful open is published only after exact
 * route, document-id, Catalog, surface, and preview admission. Conflict and indeterminate
 * settlements require an explicit successful or missing reopen; they are never retried or merged.
 * Every dispatched async operation owns a private lifetime token, and disposal or an authored edit
 * during open prevents a stale settlement from replacing the current session.
 */
export function createAuthoringPersistenceController(
  options: AuthoringPersistenceControllerOptions,
): AuthoringPersistenceControllerCreationResult {
  const values = exactOwnData(options, CONFIGURATION_KEYS);
  if (values === undefined) return Object.freeze({ ok: false, reason: "route-invalid" });
  const authority = readProjectWorkspaceProfileAuthority(
    values.profile as ProjectWorkspaceProfileHandle,
  );
  if (authority.status !== "read") {
    return Object.freeze({ ok: false, reason: "profile-invalid" });
  }
  const profile = authority.profile;
  const profileHandle = values.profile as ProjectWorkspaceProfileHandle;
  const sourceSurfaceIds = new Set(profile.project.surfaces.map((surface) => surface.sourceId));
  const route = captureRoute(values.route, profile.project.id, sourceSurfaceIds);
  if (route === undefined) return Object.freeze({ ok: false, reason: "route-invalid" });
  const persistencePort = capturePersistencePort(values.persistencePort);
  if (persistencePort === undefined) return Object.freeze({ ok: false, reason: "port-invalid" });

  const initialAdmission = admitSession(
    profileHandle,
    profile.catalogs,
    profile.catalogPackages,
    route.surfaceId,
    values.document as DesenEditorDocument,
  );
  if (!initialAdmission.ok) return initialAdmission;
  const capturedCatalogs = profile.catalogs;
  const capturedCatalogPackages = profile.catalogPackages;

  const sourceKey = profile.sourceKey;
  const openSource = persistencePort.openSource;
  const saveSource = persistencePort.saveSource;
  const listeners = new Set<() => void>();
  let documentVersion = 0;
  let currentDocumentCanonical = initialAdmission.canonicalDocument;
  let savedDocumentCanonical: string | null = null;
  let currentOperation: OperationToken | null = null;
  let state = freezeState({
    route,
    sourceKey,
    session: initialAdmission.session,
    generation: null,
    savedDocument: null,
    dirty: true,
    reopenRequired: false,
    pending: null,
    openResult: null,
    saveResult: null,
    disposed: false,
  });

  function publish(next: AuthoringPersistenceState): void {
    state = freezeState(next);
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // One UI observer cannot suppress delivery to the remaining external-store subscribers.
      }
    }
  }

  function publishOpenResult(result: AuthoringPersistenceOpenResult): void {
    publish({ ...state, pending: null, openResult: result });
  }

  function publishSaveResult(result: AuthoringPersistenceSaveResult): void {
    publish({ ...state, pending: null, saveResult: result });
  }

  const read: AuthoringPersistenceController["read"] = () => state;

  const subscribe: AuthoringPersistenceController["subscribe"] = (listener) => {
    if (typeof listener !== "function" || state.disposed) return () => undefined;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const replaceAuthoredDocument: AuthoringPersistenceController["replaceAuthoredDocument"] = (
    document,
  ) => {
    if (state.disposed) return Object.freeze({ ok: false, reason: "disposed" });
    if (document === state.session.document) {
      return Object.freeze({ ok: true, session: state.session });
    }
    const admitted = admitSession(
      profileHandle,
      capturedCatalogs,
      capturedCatalogPackages,
      route.surfaceId,
      document,
    );
    if (!admitted.ok) return admitted;
    if (admitted.canonicalDocument === currentDocumentCanonical) {
      return Object.freeze({ ok: true, session: state.session });
    }

    documentVersion += 1;
    currentDocumentCanonical = admitted.canonicalDocument;
    const dirty =
      state.reopenRequired ||
      savedDocumentCanonical === null ||
      currentDocumentCanonical !== savedDocumentCanonical;
    if (state.pending === "opening") {
      currentOperation = null;
      const stale = openFailure("stale-operation");
      publish({
        ...state,
        session: admitted.session,
        dirty,
        pending: null,
        openResult: stale,
        saveResult: null,
      });
    } else {
      publish({
        ...state,
        session: admitted.session,
        dirty,
        openResult: null,
        saveResult: null,
      });
    }
    return Object.freeze({ ok: true, session: admitted.session });
  };

  const open: AuthoringPersistenceController["open"] = async () => {
    if (state.disposed) return openFailure("disposed");
    if (state.pending !== null) return openFailure("operation-in-progress");

    const token = createOperationToken();
    const openedAtDocumentVersion = documentVersion;
    currentOperation = token;
    publish({ ...state, pending: "opening", openResult: null, saveResult: null });

    let rawPortResult: unknown;
    try {
      rawPortResult = await openSource(sourceKey);
    } catch {
      if (state.disposed || currentOperation !== token) {
        return openFailure(state.disposed ? "disposed" : "stale-operation");
      }
      currentOperation = null;
      const result = openFailure("persistence-failed");
      publishOpenResult(result);
      return result;
    }

    if (
      state.disposed ||
      currentOperation !== token ||
      documentVersion !== openedAtDocumentVersion
    ) {
      return openFailure(state.disposed ? "disposed" : "stale-operation");
    }
    const portResult = captureOpenSettlement(rawPortResult);
    if (
      state.disposed ||
      currentOperation !== token ||
      documentVersion !== openedAtDocumentVersion
    ) {
      return openFailure(state.disposed ? "disposed" : "stale-operation");
    }

    if (portResult === undefined) {
      currentOperation = null;
      const result = openFailure("persistence-failed");
      publishOpenResult(result);
      return result;
    }

    if (portResult.status === "missing") {
      currentOperation = null;
      const result = Object.freeze({ status: "missing" as const });
      savedDocumentCanonical = null;
      publish({
        ...state,
        generation: null,
        savedDocument: null,
        dirty: true,
        reopenRequired: false,
        pending: null,
        openResult: result,
        saveResult: null,
      });
      return result;
    }
    if (portResult.status === "failed") {
      currentOperation = null;
      const result = openFailure("persistence-failed", portResult.diagnostic);
      publishOpenResult(result);
      return result;
    }

    const admitted = admitSession(
      profileHandle,
      capturedCatalogs,
      capturedCatalogPackages,
      route.surfaceId,
      portResult.document,
    );
    if (
      state.disposed ||
      currentOperation !== token ||
      documentVersion !== openedAtDocumentVersion
    ) {
      return openFailure(state.disposed ? "disposed" : "stale-operation");
    }
    currentOperation = null;
    if (!admitted.ok) {
      const result = openFailure(admitted.reason);
      publishOpenResult(result);
      return result;
    }
    documentVersion += 1;
    currentDocumentCanonical = admitted.canonicalDocument;
    savedDocumentCanonical = admitted.canonicalDocument;
    const result = Object.freeze({
      status: "opened" as const,
      generation: portResult.generation,
      session: admitted.session,
    });
    publish({
      ...state,
      session: admitted.session,
      generation: portResult.generation,
      savedDocument: admitted.session.document,
      dirty: false,
      reopenRequired: false,
      pending: null,
      openResult: result,
      saveResult: null,
    });
    return result;
  };

  const save: AuthoringPersistenceController["save"] = async () => {
    if (state.disposed) return saveFailure("disposed");
    if (state.pending !== null) return saveFailure("operation-in-progress");
    if (state.reopenRequired) {
      const result = saveFailure("reopen-required");
      publishSaveResult(result);
      return result;
    }

    const token = createOperationToken();
    const snapshotDocument = state.session.document;
    const snapshotDocumentCanonical = currentDocumentCanonical;
    const expectedGeneration = state.generation;
    currentOperation = token;
    publish({ ...state, pending: "saving", openResult: null, saveResult: null });

    let rawPortResult: unknown;
    try {
      rawPortResult = await saveSource(
        Object.freeze({ sourceKey, expectedGeneration, document: snapshotDocument }),
      );
    } catch {
      if (state.disposed || currentOperation !== token) {
        return saveFailure(state.disposed ? "disposed" : "stale-operation");
      }
      currentOperation = null;
      const result = unexpectedSaveIndeterminate();
      publish({
        ...state,
        dirty: true,
        reopenRequired: true,
        pending: null,
        saveResult: result,
      });
      return result;
    }

    if (state.disposed || currentOperation !== token) {
      return saveFailure(state.disposed ? "disposed" : "stale-operation");
    }
    const result = captureSaveSettlement(rawPortResult, expectedGeneration);
    if (state.disposed || currentOperation !== token) {
      return saveFailure(state.disposed ? "disposed" : "stale-operation");
    }
    currentOperation = null;

    if (result === undefined) {
      const indeterminate = unexpectedSaveIndeterminate();
      publish({
        ...state,
        dirty: true,
        reopenRequired: true,
        pending: null,
        saveResult: indeterminate,
      });
      return indeterminate;
    }

    if (
      result.status === "created" ||
      result.status === "updated" ||
      result.status === "unchanged"
    ) {
      savedDocumentCanonical = snapshotDocumentCanonical;
      publish({
        ...state,
        generation: result.generation,
        savedDocument: snapshotDocument,
        dirty: currentDocumentCanonical !== snapshotDocumentCanonical,
        reopenRequired: false,
        pending: null,
        saveResult: result,
      });
      return result;
    }
    if (
      result.status === "conflict" ||
      result.status === "generation-exhausted" ||
      result.status === "indeterminate"
    ) {
      publish({
        ...state,
        dirty: true,
        reopenRequired: true,
        pending: null,
        saveResult: result,
      });
      return result;
    }
    publishSaveResult(result);
    return result;
  };

  const dispose: AuthoringPersistenceController["dispose"] = () => {
    if (state.disposed) return;
    currentOperation = null;
    publish({ ...state, pending: null, disposed: true });
    listeners.clear();
  };

  const controller: AuthoringPersistenceController = Object.freeze({
    read,
    subscribe,
    replaceAuthoredDocument,
    open,
    save,
    dispose,
  });
  PERSISTENCE_CONTROLLER_PROFILES.set(controller, profileHandle);
  return Object.freeze({ ok: true, controller });
}
