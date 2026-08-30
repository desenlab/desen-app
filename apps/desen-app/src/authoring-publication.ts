/* eslint-disable @typescript-eslint/no-invalid-void-type -- The controller is a React-free
 * external-store boundary whose trusted-host callbacks are deliberately receiver-independent. */
import { createDesenEditorDocument } from "@desen/editor-core";
import { canonicalizeJson, canonicalizeJsonBytes, isSha256Digest } from "@desen/protocol";

import { prepareAuthoringPreviewBundle } from "./authoring-preview.js";

import type { DesenEditorDocument } from "@desen/editor-core";

const AUTHORIZED_PROJECT_ID = "account-app";
const AUTHORIZED_SURFACE_ID = "sign-in";
const AUTHORIZED_DOCUMENT_ID = "com.example.account-app";
const CONFIGURATION_KEYS = Object.freeze(["publicationPort", "route", "snapshot"]);
const PORT_KEYS = Object.freeze(["activateReferenceHost", "publishBundleToChannel"]);
const SNAPSHOT_KEYS = Object.freeze([
  "document",
  "persistenceAuthority",
  "previewRevision",
  "savedDocument",
  "sourceGeneration",
]);

/** The only mutable discovery channel selected by this reviewed App slice. */
export const AUTHORING_PUBLICATION_CHANNEL = "preview" as const;

type PublicationPendingStage = "control-plane" | "reference-host";
type PublicationOperationToken = Readonly<Record<never, never>>;

/** Exact App route admitted by the sign-in publication profile. */
export interface AuthoringPublicationRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** App projection of whether the persisted Source can authorize a publication attempt. */
export type AuthoringPublicationPersistenceAuthority =
  "ready" | "pending" | "reopen-required" | "unavailable";

/**
 * Publication-relevant authored-session snapshot.
 *
 * @remarks There is deliberately no scenario, effective-preview, fixture, operation-input, or
 * diagnostic-candidate field. Exact-own-data capture rejects attempts to add one.
 */
export interface AuthoringPublicationSnapshot {
  readonly document: DesenEditorDocument;
  readonly savedDocument: DesenEditorDocument | null;
  readonly sourceGeneration: number | null;
  readonly persistenceAuthority: AuthoringPublicationPersistenceAuthority;
  readonly previewRevision: string;
}

/** Exact immutable Bundle request handed to the trusted control-plane adapter. */
export interface AuthoringControlPlanePublicationRequest {
  readonly bundleBytes: Readonly<Uint8Array>;
  readonly revision: string;
}

/** Closed control-plane settlement after immutable storage and fixed-channel CAS. */
export type AuthoringControlPlanePublicationSettlement =
  | Readonly<{
      readonly status: "published";
      readonly channelName: typeof AUTHORING_PUBLICATION_CHANNEL;
      readonly revision: string;
      readonly bundleStatus: "stored" | "unchanged";
      readonly channelStatus: "created" | "updated" | "unchanged";
      readonly channelGeneration: number;
    }>
  | Readonly<{
      readonly status: "conflict";
      readonly revision: string;
      readonly bundleStatus: "stored" | "unchanged";
      readonly currentGeneration: number | null;
    }>
  | Readonly<{
      readonly status: "indeterminate";
      readonly phase: "bundle-write";
      readonly revision: string;
    }>
  | Readonly<{
      readonly status: "indeterminate";
      readonly phase: "channel-write";
      readonly revision: string;
      readonly bundleStatus: "stored" | "unchanged";
    }>
  | Readonly<{
      readonly status: "failed";
      readonly phase: "request" | "channel-read" | "bundle-write";
      readonly reason: AuthoringControlPlanePublicationFailureReason;
    }>
  | Readonly<{
      readonly status: "failed";
      readonly phase: "channel-write";
      readonly reason: AuthoringControlPlanePublicationFailureReason;
      readonly revision: string;
      readonly bundleStatus: "stored" | "unchanged";
    }>;

/** Redacted failure vocabulary structurally shared with the local fixed-channel adapter. */
export type AuthoringControlPlanePublicationFailureReason =
  | "access-denied"
  | "authentication-required"
  | "bundle-bytes-conflict"
  | "bundle-invalid"
  | "bundle-limit-exceeded"
  | "bundle-missing"
  | "channel-invalid"
  | "generation-exhausted"
  | "storage-busy"
  | "storage-corrupt"
  | "storage-unavailable"
  | "unsafe-storage";

/** Exact request to make the server-owned reference host consume the fixed channel. */
export interface AuthoringReferenceHostActivationRequest {
  readonly channelName: typeof AUTHORING_PUBLICATION_CHANNEL;
  readonly channelGeneration: number;
  readonly revision: string;
}

/** Closed durable-active observation returned by the trusted reference-host adapter. */
export type AuthoringReferenceHostActivationSettlement =
  | Readonly<{
      readonly status: "active";
      readonly relationship: "activated" | "preserved" | "recovered";
      readonly activeRevision: string;
      readonly activationGeneration: number;
    }>
  | Readonly<{ readonly status: "unavailable" }>
  | Readonly<{ readonly status: "failed" }>
  | Readonly<{ readonly status: "indeterminate" }>;

/**
 * Trusted-host publication edge captured as two exact receiver-independent methods.
 *
 * @remarks The first method owns real control-plane Bundle storage and fixed-channel CAS. The
 * second owns reference-host refresh/activation. Neither method receives Source, scenario,
 * fixture, password, Catalog, executable adapter, filesystem, token, or host-selection data.
 */
export interface AuthoringPublicationPort {
  readonly publishBundleToChannel: (
    this: void,
    request: AuthoringControlPlanePublicationRequest,
  ) => Promise<AuthoringControlPlanePublicationSettlement>;
  readonly activateReferenceHost: (
    this: void,
    request: AuthoringReferenceHostActivationRequest,
  ) => Promise<AuthoringReferenceHostActivationSettlement>;
}

/** Stable controlled reason why the exact current authored session was not published. */
export type AuthoringPublicationFailureReason =
  | "control-plane-conflict"
  | "control-plane-failed"
  | "channel-revision-mismatch"
  | "disposed"
  | "operation-in-progress"
  | "persistence-not-ready"
  | "preview-revision-stale"
  | "publisher-rejected"
  | "reference-host-failed"
  | "reference-host-revision-mismatch"
  | "reference-host-unavailable"
  | "source-dirty"
  | "source-not-saved"
  | "stale-operation";

/** Terminal successful publication with distinct channel and durable activation generations. */
export interface AuthoringPublicationSuccess {
  readonly status: "published";
  readonly relationship: "activated" | "preserved" | "recovered";
  readonly channelName: typeof AUTHORING_PUBLICATION_CHANNEL;
  readonly revision: string;
  readonly sourceGeneration: number;
  readonly channelGeneration: number;
  readonly activationGeneration: number;
}

/** Controlled definite rejection that never presents the candidate as active. */
export interface AuthoringPublicationFailure {
  readonly status: "failed";
  readonly reason: AuthoringPublicationFailureReason;
  readonly lastKnownGoodPreserved: boolean;
  readonly revision?: string;
  readonly sourceGeneration?: number;
  readonly channelGeneration?: number;
  readonly currentChannelGeneration?: number | null;
  readonly activeRevision?: string;
  readonly activationGeneration?: number;
}

/** Unknown commit/activation outcome caused only by a thrown or malformed host settlement. */
export interface AuthoringPublicationIndeterminate {
  readonly status: "indeterminate";
  readonly stage: PublicationPendingStage;
  readonly revision: string;
  readonly sourceGeneration: number;
  readonly channelGeneration?: number;
}

/** Closed result of one publication attempt. */
export type AuthoringPublicationResult =
  AuthoringPublicationSuccess | AuthoringPublicationFailure | AuthoringPublicationIndeterminate;

/** Immutable external-store state for future publication UI consumption. */
export interface AuthoringPublicationState {
  readonly route: AuthoringPublicationRoute;
  readonly channelName: typeof AUTHORING_PUBLICATION_CHANNEL;
  readonly snapshot: AuthoringPublicationSnapshot;
  readonly pending: PublicationPendingStage | null;
  readonly result: AuthoringPublicationResult | null;
  readonly disposed: boolean;
}

/** Stable failure while replacing the current authored/persisted publication snapshot. */
export type AuthoringPublicationSnapshotFailureReason =
  | "disposed"
  | "document-invalid"
  | "persistence-authority-invalid"
  | "preview-revision-invalid"
  | "saved-document-invalid"
  | "snapshot-invalid"
  | "source-generation-invalid";

/** Result of replacing only the controller's exact publication-relevant snapshot. */
export type AuthoringPublicationSnapshotReplacementResult =
  | Readonly<{ readonly ok: true; readonly snapshot: AuthoringPublicationSnapshot }>
  | Readonly<{
      readonly ok: false;
      readonly reason: AuthoringPublicationSnapshotFailureReason;
    }>;

/** Receiver-independent React-free publication state machine. */
export interface AuthoringPublicationController {
  readonly read: (this: void) => AuthoringPublicationState;
  readonly subscribe: (this: void, listener: () => void) => () => void;
  readonly replaceSnapshot: (
    this: void,
    snapshot: AuthoringPublicationSnapshot,
  ) => AuthoringPublicationSnapshotReplacementResult;
  readonly publish: (this: void) => Promise<AuthoringPublicationResult>;
  readonly dispose: (this: void) => void;
}

/** Exact trusted inputs captured by one route-bound publication controller. */
export interface AuthoringPublicationControllerOptions {
  readonly route: AuthoringPublicationRoute;
  readonly snapshot: AuthoringPublicationSnapshot;
  readonly publicationPort: AuthoringPublicationPort;
}

/** Fail-closed result of creating the publication controller. */
export type AuthoringPublicationControllerCreationResult =
  | Readonly<{ readonly ok: true; readonly controller: AuthoringPublicationController }>
  | Readonly<{
      readonly ok: false;
      readonly reason:
        | "document-invalid"
        | "persistence-authority-invalid"
        | "port-invalid"
        | "preview-revision-invalid"
        | "route-invalid"
        | "saved-document-invalid"
        | "snapshot-invalid"
        | "source-generation-invalid";
    }>;

interface CapturedPublicationPort {
  readonly publishBundleToChannel: AuthoringPublicationPort["publishBundleToChannel"];
  readonly activateReferenceHost: AuthoringPublicationPort["activateReferenceHost"];
}

interface CapturedDocument {
  readonly document: DesenEditorDocument;
  readonly canonical: string;
}

interface CapturedSnapshot {
  readonly snapshot: AuthoringPublicationSnapshot;
  readonly canonicalDocument: string;
  readonly canonicalSavedDocument: string | null;
}

type SnapshotCaptureResult =
  | Readonly<{ readonly ok: true; readonly captured: CapturedSnapshot }>
  | Readonly<{
      readonly ok: false;
      readonly reason: Exclude<AuthoringPublicationSnapshotFailureReason, "disposed">;
    }>;

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

function captureRoute(route: unknown): AuthoringPublicationRoute | undefined {
  const values = exactOwnData(route, ["projectId", "surfaceId"]);
  if (
    values === undefined ||
    values.projectId !== AUTHORIZED_PROJECT_ID ||
    values.surfaceId !== AUTHORIZED_SURFACE_ID
  ) {
    return undefined;
  }
  return Object.freeze({
    projectId: AUTHORIZED_PROJECT_ID,
    surfaceId: AUTHORIZED_SURFACE_ID,
  });
}

function capturePublicationPort(port: unknown): CapturedPublicationPort | undefined {
  const values = exactOwnData(port, PORT_KEYS);
  if (
    values === undefined ||
    typeof values.publishBundleToChannel !== "function" ||
    typeof values.activateReferenceHost !== "function"
  ) {
    return undefined;
  }
  return Object.freeze({
    publishBundleToChannel:
      values.publishBundleToChannel as AuthoringPublicationPort["publishBundleToChannel"],
    activateReferenceHost:
      values.activateReferenceHost as AuthoringPublicationPort["activateReferenceHost"],
  });
}

function positiveGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function activationGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function bundleStatus(value: unknown): value is "stored" | "unchanged" {
  return value === "stored" || value === "unchanged";
}

function channelStatus(value: unknown): value is "created" | "updated" | "unchanged" {
  return value === "created" || value === "updated" || value === "unchanged";
}

function controlPlaneFailureReason(
  value: unknown,
): value is AuthoringControlPlanePublicationFailureReason {
  return (
    value === "access-denied" ||
    value === "authentication-required" ||
    value === "bundle-bytes-conflict" ||
    value === "bundle-invalid" ||
    value === "bundle-limit-exceeded" ||
    value === "bundle-missing" ||
    value === "channel-invalid" ||
    value === "generation-exhausted" ||
    value === "storage-busy" ||
    value === "storage-corrupt" ||
    value === "storage-unavailable" ||
    value === "unsafe-storage"
  );
}

function captureDocument(input: unknown): CapturedDocument | undefined {
  try {
    const admitted = createDesenEditorDocument(input);
    if (
      !admitted.ok ||
      admitted.document.id !== AUTHORIZED_DOCUMENT_ID ||
      !Object.hasOwn(admitted.document.surfaces, AUTHORIZED_SURFACE_ID)
    ) {
      return undefined;
    }
    return Object.freeze({
      document: admitted.document,
      canonical: canonicalizeJson(admitted.document),
    });
  } catch {
    return undefined;
  }
}

function captureSnapshot(input: unknown): SnapshotCaptureResult {
  const values = exactOwnData(input, SNAPSHOT_KEYS);
  if (values === undefined) {
    return Object.freeze({ ok: false, reason: "snapshot-invalid" });
  }
  const document = captureDocument(values.document);
  if (document === undefined) {
    return Object.freeze({ ok: false, reason: "document-invalid" });
  }
  const savedDocument =
    values.savedDocument === null ? null : captureDocument(values.savedDocument);
  if (values.savedDocument !== null && savedDocument === undefined) {
    return Object.freeze({ ok: false, reason: "saved-document-invalid" });
  }
  if (
    values.persistenceAuthority !== "ready" &&
    values.persistenceAuthority !== "pending" &&
    values.persistenceAuthority !== "reopen-required" &&
    values.persistenceAuthority !== "unavailable"
  ) {
    return Object.freeze({ ok: false, reason: "persistence-authority-invalid" });
  }
  if (typeof values.previewRevision !== "string" || !isSha256Digest(values.previewRevision)) {
    return Object.freeze({ ok: false, reason: "preview-revision-invalid" });
  }
  if (!(values.sourceGeneration === null || positiveGeneration(values.sourceGeneration))) {
    return Object.freeze({ ok: false, reason: "source-generation-invalid" });
  }
  if ((savedDocument === null) !== (values.sourceGeneration === null)) {
    return Object.freeze({ ok: false, reason: "source-generation-invalid" });
  }
  const snapshot = Object.freeze({
    document: document.document,
    savedDocument: savedDocument?.document ?? null,
    sourceGeneration: values.sourceGeneration,
    persistenceAuthority: values.persistenceAuthority,
    previewRevision: values.previewRevision,
  }) satisfies AuthoringPublicationSnapshot;
  return Object.freeze({
    ok: true,
    captured: Object.freeze({
      snapshot,
      canonicalDocument: document.canonical,
      canonicalSavedDocument: savedDocument?.canonical ?? null,
    }),
  });
}

function captureControlPlaneSettlement(
  input: unknown,
): AuthoringControlPlanePublicationSettlement | undefined {
  const success = exactOwnData(input, [
    "bundleStatus",
    "channelGeneration",
    "channelName",
    "channelStatus",
    "revision",
    "status",
  ]);
  if (
    success?.status === "published" &&
    success.channelName === AUTHORING_PUBLICATION_CHANNEL &&
    typeof success.revision === "string" &&
    isSha256Digest(success.revision) &&
    bundleStatus(success.bundleStatus) &&
    channelStatus(success.channelStatus) &&
    positiveGeneration(success.channelGeneration)
  ) {
    return Object.freeze({
      status: "published",
      channelName: AUTHORING_PUBLICATION_CHANNEL,
      revision: success.revision,
      bundleStatus: success.bundleStatus,
      channelStatus: success.channelStatus,
      channelGeneration: success.channelGeneration,
    });
  }

  const conflict = exactOwnData(input, ["bundleStatus", "currentGeneration", "revision", "status"]);
  if (
    conflict?.status === "conflict" &&
    typeof conflict.revision === "string" &&
    isSha256Digest(conflict.revision) &&
    bundleStatus(conflict.bundleStatus) &&
    (conflict.currentGeneration === null || positiveGeneration(conflict.currentGeneration))
  ) {
    return Object.freeze({
      status: "conflict",
      revision: conflict.revision,
      bundleStatus: conflict.bundleStatus,
      currentGeneration: conflict.currentGeneration,
    });
  }

  const bundleIndeterminate = exactOwnData(input, ["phase", "revision", "status"]);
  if (
    bundleIndeterminate?.status === "indeterminate" &&
    bundleIndeterminate.phase === "bundle-write" &&
    typeof bundleIndeterminate.revision === "string" &&
    isSha256Digest(bundleIndeterminate.revision)
  ) {
    return Object.freeze({
      status: "indeterminate",
      phase: "bundle-write",
      revision: bundleIndeterminate.revision,
    });
  }

  const channelIndeterminate = exactOwnData(input, ["bundleStatus", "phase", "revision", "status"]);
  if (
    channelIndeterminate?.status === "indeterminate" &&
    channelIndeterminate.phase === "channel-write" &&
    typeof channelIndeterminate.revision === "string" &&
    isSha256Digest(channelIndeterminate.revision) &&
    bundleStatus(channelIndeterminate.bundleStatus)
  ) {
    return Object.freeze({
      status: "indeterminate",
      phase: "channel-write",
      revision: channelIndeterminate.revision,
      bundleStatus: channelIndeterminate.bundleStatus,
    });
  }

  const failure = exactOwnData(input, ["phase", "reason", "status"]);
  if (
    failure?.status === "failed" &&
    (failure.phase === "request" ||
      failure.phase === "channel-read" ||
      failure.phase === "bundle-write") &&
    controlPlaneFailureReason(failure.reason)
  ) {
    return Object.freeze({ status: "failed", phase: failure.phase, reason: failure.reason });
  }

  const channelFailure = exactOwnData(input, [
    "bundleStatus",
    "phase",
    "reason",
    "revision",
    "status",
  ]);
  if (
    channelFailure?.status === "failed" &&
    channelFailure.phase === "channel-write" &&
    controlPlaneFailureReason(channelFailure.reason) &&
    typeof channelFailure.revision === "string" &&
    isSha256Digest(channelFailure.revision) &&
    bundleStatus(channelFailure.bundleStatus)
  ) {
    return Object.freeze({
      status: "failed",
      phase: "channel-write",
      reason: channelFailure.reason,
      revision: channelFailure.revision,
      bundleStatus: channelFailure.bundleStatus,
    });
  }
  return undefined;
}

function captureActivationSettlement(
  input: unknown,
): AuthoringReferenceHostActivationSettlement | undefined {
  const active = exactOwnData(input, [
    "activationGeneration",
    "activeRevision",
    "relationship",
    "status",
  ]);
  if (
    active?.status === "active" &&
    (active.relationship === "activated" ||
      active.relationship === "preserved" ||
      active.relationship === "recovered") &&
    typeof active.activeRevision === "string" &&
    isSha256Digest(active.activeRevision) &&
    activationGeneration(active.activationGeneration)
  ) {
    return Object.freeze({
      status: "active",
      relationship: active.relationship,
      activeRevision: active.activeRevision,
      activationGeneration: active.activationGeneration,
    });
  }
  const statusOnly = exactOwnData(input, ["status"]);
  return statusOnly?.status === "unavailable" ||
    statusOnly?.status === "failed" ||
    statusOnly?.status === "indeterminate"
    ? Object.freeze({ status: statusOnly.status })
    : undefined;
}

function publicationFailure(
  reason: AuthoringPublicationFailureReason,
  lastKnownGoodPreserved = false,
  receipts?: Readonly<{
    readonly candidate?: Readonly<{
      readonly revision: string;
      readonly sourceGeneration: number;
    }>;
    readonly published?: Readonly<{
      readonly revision: string;
      readonly sourceGeneration: number;
      readonly channelGeneration: number;
    }>;
    readonly currentChannelGeneration?: number | null;
    readonly active?: Readonly<{ readonly revision: string; readonly generation: number }>;
  }>,
): AuthoringPublicationFailure {
  return Object.freeze({
    status: "failed",
    reason,
    lastKnownGoodPreserved,
    ...(receipts?.candidate === undefined
      ? {}
      : {
          revision: receipts.candidate.revision,
          sourceGeneration: receipts.candidate.sourceGeneration,
        }),
    ...(receipts?.published === undefined
      ? {}
      : {
          revision: receipts.published.revision,
          sourceGeneration: receipts.published.sourceGeneration,
          channelGeneration: receipts.published.channelGeneration,
        }),
    ...(receipts === undefined || !("currentChannelGeneration" in receipts)
      ? {}
      : { currentChannelGeneration: receipts.currentChannelGeneration }),
    ...(receipts?.active === undefined
      ? {}
      : {
          activeRevision: receipts.active.revision,
          activationGeneration: receipts.active.generation,
        }),
  });
}

function publicationIndeterminate(
  stage: PublicationPendingStage,
  revision: string,
  sourceGeneration: number,
  channelGeneration?: number,
): AuthoringPublicationIndeterminate {
  return Object.freeze({
    status: "indeterminate",
    stage,
    revision,
    sourceGeneration,
    ...(channelGeneration === undefined ? {} : { channelGeneration }),
  });
}

function freezeState(state: AuthoringPublicationState): AuthoringPublicationState {
  return Object.freeze(state);
}

function operationToken(): PublicationOperationToken {
  return Object.freeze({});
}

function sameSnapshot(left: CapturedSnapshot, right: CapturedSnapshot): boolean {
  return (
    left.canonicalDocument === right.canonicalDocument &&
    left.canonicalSavedDocument === right.canonicalSavedDocument &&
    left.snapshot.sourceGeneration === right.snapshot.sourceGeneration &&
    left.snapshot.persistenceAuthority === right.snapshot.persistenceAuthority &&
    left.snapshot.previewRevision === right.snapshot.previewRevision
  );
}

/**
 * Creates one App-owned Source-to-control-plane-to-reference-host publication state machine.
 *
 * @remarks Publication is admitted only for the exact current authored Source when its canonical
 * content equals the last successful saved document, its Source generation is positive, and its
 * persistence authority is ready. The Source is republished through the existing public Publisher
 * helper; the fresh revision must equal the current session-preview revision before canonical
 * Bundle bytes cross the host port. A channel update never counts as activation: success is
 * visible only after the reference host returns the same durable active revision.
 */
export function createAuthoringPublicationController(
  options: AuthoringPublicationControllerOptions,
): AuthoringPublicationControllerCreationResult {
  const values = exactOwnData(options, CONFIGURATION_KEYS);
  if (values === undefined) return Object.freeze({ ok: false, reason: "route-invalid" });
  const route = captureRoute(values.route);
  if (route === undefined) return Object.freeze({ ok: false, reason: "route-invalid" });
  const port = capturePublicationPort(values.publicationPort);
  if (port === undefined) return Object.freeze({ ok: false, reason: "port-invalid" });
  const initial = captureSnapshot(values.snapshot);
  if (!initial.ok) return initial;

  const publishBundleToChannel = port.publishBundleToChannel;
  const activateReferenceHost = port.activateReferenceHost;
  const listeners = new Set<() => void>();
  let capturedSnapshot = initial.captured;
  let snapshotVersion = 0;
  let currentOperation: PublicationOperationToken | null = null;
  let state = freezeState({
    route,
    channelName: AUTHORING_PUBLICATION_CHANNEL,
    snapshot: capturedSnapshot.snapshot,
    pending: null,
    result: null,
    disposed: false,
  });

  function emit(next: AuthoringPublicationState): void {
    state = freezeState(next);
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // One UI observer cannot suppress the remaining external-store subscribers.
      }
    }
  }

  function emitResult(result: AuthoringPublicationResult): void {
    emit({ ...state, pending: null, result });
  }

  function operationIsCurrent(token: PublicationOperationToken, version: number): boolean {
    return !state.disposed && currentOperation === token && snapshotVersion === version;
  }

  const read: AuthoringPublicationController["read"] = () => state;

  const subscribe: AuthoringPublicationController["subscribe"] = (listener) => {
    if (typeof listener !== "function" || state.disposed) return () => undefined;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const replaceSnapshot: AuthoringPublicationController["replaceSnapshot"] = (snapshot) => {
    if (state.disposed) return Object.freeze({ ok: false, reason: "disposed" });
    const replacement = captureSnapshot(snapshot);
    if (!replacement.ok) return replacement;
    if (sameSnapshot(capturedSnapshot, replacement.captured)) {
      return Object.freeze({ ok: true, snapshot: state.snapshot });
    }

    snapshotVersion += 1;
    currentOperation = null;
    capturedSnapshot = replacement.captured;
    emit({
      ...state,
      snapshot: capturedSnapshot.snapshot,
      pending: null,
      result: null,
    });
    return Object.freeze({ ok: true, snapshot: capturedSnapshot.snapshot });
  };

  const publish: AuthoringPublicationController["publish"] = async () => {
    if (state.disposed) return publicationFailure("disposed");
    if (state.pending !== null) return publicationFailure("operation-in-progress");
    if (capturedSnapshot.snapshot.persistenceAuthority !== "ready") {
      const result = publicationFailure("persistence-not-ready");
      emitResult(result);
      return result;
    }
    if (
      capturedSnapshot.snapshot.savedDocument === null ||
      capturedSnapshot.canonicalSavedDocument === null ||
      capturedSnapshot.snapshot.sourceGeneration === null
    ) {
      const result = publicationFailure("source-not-saved");
      emitResult(result);
      return result;
    }
    if (capturedSnapshot.canonicalDocument !== capturedSnapshot.canonicalSavedDocument) {
      const result = publicationFailure("source-dirty");
      emitResult(result);
      return result;
    }

    const freshPreview = prepareAuthoringPreviewBundle(capturedSnapshot.snapshot.document);
    if (!freshPreview.ok) {
      const result = publicationFailure("publisher-rejected");
      emitResult(result);
      return result;
    }
    if (freshPreview.revision !== capturedSnapshot.snapshot.previewRevision) {
      const result = publicationFailure("preview-revision-stale");
      emitResult(result);
      return result;
    }

    let bundleBytes: Uint8Array;
    try {
      bundleBytes = canonicalizeJsonBytes(freshPreview.bundle);
    } catch {
      const result = publicationFailure("publisher-rejected");
      emitResult(result);
      return result;
    }

    const token = operationToken();
    const version = snapshotVersion;
    const revision = freshPreview.revision;
    const sourceGeneration = capturedSnapshot.snapshot.sourceGeneration;
    currentOperation = token;
    emit({ ...state, pending: "control-plane", result: null });
    if (!operationIsCurrent(token, version)) {
      return publicationFailure(state.disposed ? "disposed" : "stale-operation");
    }

    let rawControlPlaneSettlement: unknown;
    try {
      rawControlPlaneSettlement = await publishBundleToChannel(
        Object.freeze({
          bundleBytes,
          revision,
        }),
      );
    } catch {
      if (!operationIsCurrent(token, version)) {
        return publicationFailure(state.disposed ? "disposed" : "stale-operation");
      }
      currentOperation = null;
      const result = publicationIndeterminate("control-plane", revision, sourceGeneration);
      emitResult(result);
      return result;
    }

    if (!operationIsCurrent(token, version)) {
      return publicationFailure(state.disposed ? "disposed" : "stale-operation");
    }
    const controlPlaneSettlement = captureControlPlaneSettlement(rawControlPlaneSettlement);
    if (!operationIsCurrent(token, version)) {
      return publicationFailure(state.disposed ? "disposed" : "stale-operation");
    }
    if (controlPlaneSettlement === undefined || controlPlaneSettlement.status === "indeterminate") {
      currentOperation = null;
      const result = publicationIndeterminate("control-plane", revision, sourceGeneration);
      emitResult(result);
      return result;
    }
    if (controlPlaneSettlement.status === "conflict") {
      currentOperation = null;
      if (controlPlaneSettlement.revision !== revision) {
        const result = publicationIndeterminate("control-plane", revision, sourceGeneration);
        emitResult(result);
        return result;
      }
      const result = publicationFailure(
        "control-plane-conflict",
        false,
        Object.freeze({
          candidate: Object.freeze({ revision, sourceGeneration }),
          currentChannelGeneration: controlPlaneSettlement.currentGeneration,
        }),
      );
      emitResult(result);
      return result;
    }
    if (controlPlaneSettlement.status === "failed") {
      currentOperation = null;
      if (
        controlPlaneSettlement.phase === "channel-write" &&
        controlPlaneSettlement.revision !== revision
      ) {
        const result = publicationIndeterminate("control-plane", revision, sourceGeneration);
        emitResult(result);
        return result;
      }
      const result = publicationFailure("control-plane-failed");
      emitResult(result);
      return result;
    }
    if (controlPlaneSettlement.revision !== revision) {
      currentOperation = null;
      const result = publicationFailure("channel-revision-mismatch");
      emitResult(result);
      return result;
    }

    const channelGeneration = controlPlaneSettlement.channelGeneration;
    emit({ ...state, pending: "reference-host", result: null });
    if (!operationIsCurrent(token, version)) {
      return publicationFailure(state.disposed ? "disposed" : "stale-operation");
    }
    let rawActivationSettlement: unknown;
    try {
      rawActivationSettlement = await activateReferenceHost(
        Object.freeze({
          channelName: AUTHORING_PUBLICATION_CHANNEL,
          channelGeneration,
          revision,
        }),
      );
    } catch {
      if (!operationIsCurrent(token, version)) {
        return publicationFailure(state.disposed ? "disposed" : "stale-operation");
      }
      currentOperation = null;
      const result = publicationIndeterminate(
        "reference-host",
        revision,
        sourceGeneration,
        channelGeneration,
      );
      emitResult(result);
      return result;
    }

    if (!operationIsCurrent(token, version)) {
      return publicationFailure(state.disposed ? "disposed" : "stale-operation");
    }
    const activationSettlement = captureActivationSettlement(rawActivationSettlement);
    if (!operationIsCurrent(token, version)) {
      return publicationFailure(state.disposed ? "disposed" : "stale-operation");
    }
    currentOperation = null;
    if (activationSettlement === undefined || activationSettlement.status === "indeterminate") {
      const result = publicationIndeterminate(
        "reference-host",
        revision,
        sourceGeneration,
        channelGeneration,
      );
      emitResult(result);
      return result;
    }
    if (activationSettlement.status === "unavailable") {
      const result = publicationFailure(
        "reference-host-unavailable",
        true,
        Object.freeze({
          published: Object.freeze({ revision, sourceGeneration, channelGeneration }),
        }),
      );
      emitResult(result);
      return result;
    }
    if (activationSettlement.status === "failed") {
      const result = publicationFailure(
        "reference-host-failed",
        true,
        Object.freeze({
          published: Object.freeze({ revision, sourceGeneration, channelGeneration }),
        }),
      );
      emitResult(result);
      return result;
    }
    if (activationSettlement.activeRevision !== revision) {
      const result = publicationFailure(
        "reference-host-revision-mismatch",
        true,
        Object.freeze({
          published: Object.freeze({ revision, sourceGeneration, channelGeneration }),
          active: Object.freeze({
            revision: activationSettlement.activeRevision,
            generation: activationSettlement.activationGeneration,
          }),
        }),
      );
      emitResult(result);
      return result;
    }

    const result = Object.freeze({
      status: "published" as const,
      relationship: activationSettlement.relationship,
      channelName: AUTHORING_PUBLICATION_CHANNEL,
      revision,
      sourceGeneration,
      channelGeneration,
      activationGeneration: activationSettlement.activationGeneration,
    });
    emitResult(result);
    return result;
  };

  const dispose: AuthoringPublicationController["dispose"] = () => {
    if (state.disposed) return;
    snapshotVersion += 1;
    currentOperation = null;
    emit({ ...state, pending: null, result: null, disposed: true });
    listeners.clear();
  };

  return Object.freeze({
    ok: true,
    controller: Object.freeze({ read, subscribe, replaceSnapshot, publish, dispose }),
  });
}
