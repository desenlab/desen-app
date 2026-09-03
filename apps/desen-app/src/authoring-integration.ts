import { snapshotRuntimeJsonValue } from "@desen/runtime-core";

import { prepareAuthoringOperationFixtureModel } from "./authoring-fixtures.js";
import { prepareAuthoringSurfacePreviewBundle } from "./authoring-preview.js";
import {
  admitProjectWorkspaceDocument,
  readProjectWorkspaceProfileAuthority,
} from "./project-workspace-profile.js";

import type {
  RuntimeAwaitable,
  RuntimeHostCallResult,
  RuntimeJsonObject,
  RuntimeOperationEffect,
  RuntimeOperationPort,
  RuntimeOperationRequest,
} from "@desen/runtime-core";
import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";

const MAX_OPERATIONS = 1_024;
const MAX_INVOCATIONS = 10_000;
const MAX_ID_CODE_UNITS = 512;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DENIED: RuntimeHostCallResult = Object.freeze({ status: "denied" });

declare const AUTHORING_INTEGRATION_BINDING_BRAND: unique symbol;

/** Opaque identity for one explicit trusted integration composition, never Source data. */
export interface AuthoringIntegrationBindingHandle {
  readonly [AUTHORING_INTEGRATION_BINDING_BRAND]: true;
}

/** Exact Catalog operation and host implementation selected by trusted composition code. */
export interface AuthoringIntegrationOperationBinding {
  /** Complete Catalog operation identifier, not a URL or module name. */
  readonly capabilityId: string;
  /** Exact effect declared by the authenticated Catalog. */
  readonly effect: RuntimeOperationEffect;
  /** Host-owned implementation; Runtime retains output-schema and public-error authority. */
  readonly invoke: (
    request: RuntimeOperationRequest,
    signal: AbortSignal,
  ) => RuntimeAwaitable<RuntimeHostCallResult>;
}

/** Explicit integration input accepted only from the trusted App composition root. */
export interface AuthoringIntegrationBindingInput {
  /** Exact factory-created workspace authority that owns this binding. */
  readonly profile: ProjectWorkspaceProfileHandle;
  /** Bounded display identity; it cannot select executable code. */
  readonly bindingId: string;
  /** Short visible label for the connected integration. */
  readonly label: string;
  /** Public description that must contain no credentials or infrastructure secrets. */
  readonly description: string;
  /** Captured operations; this is never inherited from a workspace's ambient host ports. */
  readonly operations: readonly AuthoringIntegrationOperationBinding[];
}

/** Inert public disclosure with no executable callback or operation payload. */
export interface AuthoringIntegrationDescriptor {
  readonly bindingId: string;
  readonly label: string;
  readonly description: string;
}

/** Fail-closed result of capturing an explicit integration binding. */
export type AuthoringIntegrationBindingCreationResult =
  | Readonly<{ status: "created"; binding: AuthoringIntegrationBindingHandle }>
  | Readonly<{
      status: "rejected";
      reason: "input-invalid" | "profile-invalid" | "operation-invalid";
    }>;

/** Transport lifecycle only: a response is not a Runtime-validated success. */
export type AuthoringIntegrationOperationStatus = "idle" | "pending" | "responded" | "denied";

/** Input-free status of one alias authored on the selected Source surface. */
export interface AuthoringIntegrationOperationSnapshot {
  readonly alias: string;
  readonly capabilityId: string;
  readonly effect: RuntimeOperationEffect;
  readonly bound: boolean;
  readonly status: AuthoringIntegrationOperationStatus;
}

/** Immutable UI disclosure containing neither request data nor host output or failure details. */
export interface AuthoringIntegrationControllerSnapshot {
  readonly active: boolean;
  readonly disposed: boolean;
  readonly binding: AuthoringIntegrationDescriptor;
  readonly operations: readonly AuthoringIntegrationOperationSnapshot[];
}

/** Receives a public lifecycle snapshot and never receives an implementation error. */
export type AuthoringIntegrationControllerListener = (
  snapshot: AuthoringIntegrationControllerSnapshot,
) => void;

/** One initially inactive, exact-document Integration lifetime and its sole operation port. */
export interface AuthoringIntegrationController {
  readonly operationPort: RuntimeOperationPort;
  readonly read: () => AuthoringIntegrationControllerSnapshot;
  readonly subscribe: (listener: AuthoringIntegrationControllerListener) => () => void;
  /** Explicitly enables this Integration lifetime; terminal disposal cannot be reversed. */
  readonly activate: () => void;
  /** Revokes pending work synchronously; a development effect replay may reactivate it. */
  readonly deactivate: () => void;
  /** Permanently revokes this authority and all pending calls. */
  readonly dispose: () => void;
}

/** Exact authored preview for which trusted integration authority is requested. */
export interface AuthoringIntegrationControllerInput {
  readonly binding: AuthoringIntegrationBindingHandle;
  readonly profile: ProjectWorkspaceProfileHandle;
  readonly document: unknown;
  readonly surfaceId: string;
  readonly revision: string;
}

/** Closed controller admission; rejection never exposes a partial operation port. */
export type AuthoringIntegrationControllerCreationResult =
  | Readonly<{ status: "created"; controller: AuthoringIntegrationController }>
  | Readonly<{
      status: "rejected";
      reason:
        | "input-invalid"
        | "binding-invalid"
        | "document-invalid"
        | "preview-mismatch"
        | "operation-model-invalid";
    }>;

interface BindingAuthority {
  readonly profile: ProjectWorkspaceProfileHandle;
  readonly descriptor: AuthoringIntegrationDescriptor;
  readonly operations: ReadonlyMap<string, AuthoringIntegrationOperationBinding>;
}

interface PendingInvocation {
  readonly epoch: number;
  readonly abort: AbortController;
  readonly resolve: (result: RuntimeHostCallResult) => void;
  readonly reject: (reason: Error) => void;
}

interface OperationState {
  readonly alias: string;
  readonly capabilityId: string;
  readonly effect: RuntimeOperationEffect;
  readonly binding: AuthoringIntegrationOperationBinding | undefined;
  status: AuthoringIntegrationOperationStatus;
  pending: PendingInvocation | undefined;
}

const BINDING_AUTHORITIES = new WeakMap<object, BindingAuthority>();

function exactDataRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== null && prototype !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const captured = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

function boundedText(input: unknown, maximum = MAX_ID_CODE_UNITS): string | undefined {
  if (typeof input !== "string" || input.length > maximum || input.trim().length === 0) {
    return undefined;
  }
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code < 32 || code === 127) return undefined;
  }
  return input;
}

function captureOperations(input: unknown): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return undefined;
    const length = Object.getOwnPropertyDescriptor(input, "length");
    if (
      length === undefined ||
      !("value" in length) ||
      !Number.isSafeInteger(length.value) ||
      length.value < 1 ||
      length.value > MAX_OPERATIONS
    ) {
      return undefined;
    }
    const count = length.value as number;
    if (Reflect.ownKeys(input).length !== count + 1) return undefined;
    const captured: unknown[] = [];
    for (let index = 0; index < count; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
      captured.push(descriptor.value);
    }
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

function bindingAuthority(input: unknown): BindingAuthority | undefined {
  return typeof input === "object" && input !== null ? BINDING_AUTHORITIES.get(input) : undefined;
}

/**
 * Captures explicit host implementations against the exact authenticated profile Catalog set.
 *
 * @remarks Creation never calls a host implementation or a profile host port. Callbacks are
 * captured from exact own data records, so later caller mutation cannot retarget the binding.
 * Source documents, URLs, serialized lookalikes, and public profile ids grant no authority.
 */
export function createAuthoringIntegrationBinding(
  input: unknown,
): AuthoringIntegrationBindingCreationResult {
  const captured = exactDataRecord(input, [
    "profile",
    "bindingId",
    "label",
    "description",
    "operations",
  ]);
  if (captured === undefined) return Object.freeze({ status: "rejected", reason: "input-invalid" });
  const profileHandle = captured.profile as ProjectWorkspaceProfileHandle;
  const authority = readProjectWorkspaceProfileAuthority(profileHandle);
  if (authority.status !== "read") {
    return Object.freeze({ status: "rejected", reason: "profile-invalid" });
  }
  const bindingId = boundedText(captured.bindingId, 128);
  const label = boundedText(captured.label, 128);
  const description = boundedText(captured.description, 2_048);
  const candidates = captureOperations(captured.operations);
  if (bindingId === undefined || label === undefined || description === undefined) {
    return Object.freeze({ status: "rejected", reason: "input-invalid" });
  }
  if (candidates === undefined) {
    return Object.freeze({ status: "rejected", reason: "operation-invalid" });
  }
  const operations = new Map<string, AuthoringIntegrationOperationBinding>();
  for (const candidate of candidates) {
    const operation = exactDataRecord(candidate, ["capabilityId", "effect", "invoke"]);
    const capabilityId = boundedText(operation?.capabilityId);
    if (
      operation === undefined ||
      capabilityId === undefined ||
      operations.has(capabilityId) ||
      typeof operation.invoke !== "function"
    ) {
      return Object.freeze({ status: "rejected", reason: "operation-invalid" });
    }
    const manifests = authority.profile.catalogs
      .filter((catalog) => Object.hasOwn(catalog.operations, capabilityId))
      .map((catalog) => catalog.operations[capabilityId]);
    const manifest = manifests[0];
    if (manifests.length !== 1 || manifest === undefined || manifest.effect !== operation.effect) {
      return Object.freeze({ status: "rejected", reason: "operation-invalid" });
    }
    operations.set(
      capabilityId,
      Object.freeze({
        capabilityId,
        effect: manifest.effect,
        invoke: operation.invoke as AuthoringIntegrationOperationBinding["invoke"],
      }),
    );
  }
  const descriptor = Object.freeze({ bindingId, label, description });
  const binding = Object.freeze({}) as AuthoringIntegrationBindingHandle;
  BINDING_AUTHORITIES.set(binding, { profile: profileHandle, descriptor, operations });
  return Object.freeze({ status: "created", binding });
}

/** Reads only safe disclosure for the exact binding/profile pair, or `null` on any mismatch. */
export function readAuthoringIntegrationBinding(
  binding: unknown,
  profile: ProjectWorkspaceProfileHandle,
): AuthoringIntegrationDescriptor | null {
  const authority = bindingAuthority(binding);
  return authority?.profile === profile ? authority.descriptor : null;
}

function captureRequest(input: unknown): RuntimeOperationRequest | undefined {
  const request = exactDataRecord(input, [
    "context",
    "capabilityId",
    "invocationAlias",
    "input",
    "effect",
  ]);
  if (request === undefined) return undefined;
  const context = exactDataRecord(request.context, [
    "documentId",
    "revision",
    "surfaceId",
    "requestId",
  ]);
  if (context === undefined) return undefined;
  const documentId = boundedText(context.documentId);
  const revision = boundedText(context.revision);
  const surfaceId = boundedText(context.surfaceId);
  const requestId = boundedText(context.requestId);
  const capabilityId = boundedText(request.capabilityId);
  const invocationAlias = boundedText(request.invocationAlias);
  if (
    documentId === undefined ||
    revision === undefined ||
    surfaceId === undefined ||
    requestId === undefined ||
    capabilityId === undefined ||
    invocationAlias === undefined ||
    !["none", "local", "network", "external"].includes(request.effect as string)
  ) {
    return undefined;
  }
  const detached = snapshotRuntimeJsonValue(request.input);
  if (detached === null || typeof detached !== "object" || Array.isArray(detached))
    return undefined;
  return Object.freeze({
    context: Object.freeze({ documentId, revision, surfaceId, requestId }),
    capabilityId,
    invocationAlias,
    effect: request.effect as RuntimeOperationEffect,
    input: detached as RuntimeJsonObject,
  });
}

/**
 * Re-admits one Source and creates an initially inactive Integration operation lifetime.
 *
 * @remarks Both document identity and exact Publisher-produced preview revision are checked.
 * The internal Source/Catalog projector supplies aliases, capabilities and effects only; fixture
 * outcomes never choose or settle a real call. Per-alias admission and bounded request-id replay
 * protection apply for this controller's whole lifetime. A fresh Runtime session after user
 * activity requires a fresh controller because Runtime correlation ids may restart.
 */
export function createAuthoringIntegrationController(
  input: AuthoringIntegrationControllerInput,
): AuthoringIntegrationControllerCreationResult {
  const captured = exactDataRecord(input, [
    "binding",
    "profile",
    "document",
    "surfaceId",
    "revision",
  ]);
  const surfaceId = boundedText(captured?.surfaceId);
  const revision = boundedText(captured?.revision);
  if (
    captured === undefined ||
    surfaceId === undefined ||
    revision === undefined ||
    !SHA256_PATTERN.test(revision)
  ) {
    return Object.freeze({ status: "rejected", reason: "input-invalid" });
  }
  const authority = bindingAuthority(captured.binding);
  if (authority === undefined || authority.profile !== captured.profile) {
    return Object.freeze({ status: "rejected", reason: "binding-invalid" });
  }
  const profile = readProjectWorkspaceProfileAuthority(authority.profile);
  const admitted = admitProjectWorkspaceDocument(authority.profile, captured.document);
  if (profile.status !== "read" || admitted.status !== "admitted") {
    return Object.freeze({ status: "rejected", reason: "document-invalid" });
  }
  const preview = prepareAuthoringSurfacePreviewBundle(
    admitted.document,
    profile.profile.catalogPackages,
    surfaceId,
  );
  if (!preview.ok || preview.revision !== revision) {
    return Object.freeze({ status: "rejected", reason: "preview-mismatch" });
  }
  const model = prepareAuthoringOperationFixtureModel(
    profile.profile.catalogs,
    admitted.document,
    surfaceId,
  );
  if (model.status !== "ready") {
    return Object.freeze({ status: "rejected", reason: "operation-model-invalid" });
  }
  const states = new Map<string, OperationState>();
  for (const operation of model.operations) {
    const candidate = authority.operations.get(operation.capabilityId);
    states.set(operation.alias, {
      alias: operation.alias,
      capabilityId: operation.capabilityId,
      effect: operation.effect,
      binding: candidate?.effect === operation.effect ? candidate : undefined,
      status: "idle",
      pending: undefined,
    });
  }

  let active = false;
  let disposed = false;
  let epoch = 0;
  const seenRequestIds = new Set<string>();
  const listeners = new Set<AuthoringIntegrationControllerListener>();
  const projectSnapshot = (): AuthoringIntegrationControllerSnapshot =>
    Object.freeze({
      active,
      disposed,
      binding: authority.descriptor,
      operations: Object.freeze(
        [...states.values()].map((state) =>
          Object.freeze({
            alias: state.alias,
            capabilityId: state.capabilityId,
            effect: state.effect,
            bound: state.binding !== undefined,
            status: state.status,
          }),
        ),
      ),
    });
  let snapshot = projectSnapshot();
  const notify = (): void => {
    snapshot = projectSnapshot();
    for (const listener of [...listeners]) {
      try {
        listener(snapshot);
      } catch {
        // A UI listener cannot acquire, preserve, or settle an operation authority.
      }
    }
  };
  const stillPending = (state: OperationState, pending: PendingInvocation): boolean =>
    active && !disposed && epoch === pending.epoch && state.pending === pending;
  const invoke = (
    inputRequest: RuntimeOperationRequest,
  ): RuntimeAwaitable<RuntimeHostCallResult> => {
    if (!active || disposed) return DENIED;
    const requestEpoch = epoch;
    const request = captureRequest(inputRequest);
    if (
      !active ||
      disposed ||
      epoch !== requestEpoch ||
      request === undefined ||
      request.context.documentId !== admitted.document.id ||
      request.context.surfaceId !== surfaceId ||
      request.context.revision !== revision
    )
      return DENIED;
    const state = states.get(request.invocationAlias);
    if (
      state === undefined ||
      state.capabilityId !== request.capabilityId ||
      state.effect !== request.effect ||
      seenRequestIds.has(request.context.requestId) ||
      seenRequestIds.size >= MAX_INVOCATIONS
    )
      return DENIED;
    seenRequestIds.add(request.context.requestId);
    if (state.pending !== undefined) return DENIED;
    const callback = state.binding?.invoke;
    if (callback === undefined) {
      state.status = "denied";
      notify();
      return DENIED;
    }
    let resolve!: PendingInvocation["resolve"];
    let reject!: PendingInvocation["reject"];
    const result = new Promise<RuntimeHostCallResult>((resolveResult, rejectResult) => {
      resolve = resolveResult;
      reject = rejectResult;
    });
    const pending = Object.freeze({ epoch, abort: new AbortController(), resolve, reject });
    state.pending = pending;
    state.status = "pending";
    notify();
    // Disclosure listeners can synchronously deactivate the lifetime before the host effect starts.
    if (!stillPending(state, pending)) return result;
    const failed = (): void => {
      if (!stillPending(state, pending)) return;
      state.pending = undefined;
      state.status = "denied";
      pending.reject(new Error("Integration operation failed."));
      notify();
    };
    try {
      void Promise.resolve(callback(request, pending.abort.signal)).then((candidate) => {
        if (!stillPending(state, pending)) return;
        state.pending = undefined;
        state.status = "responded";
        // A response is still only a candidate; Runtime owns envelope, schema and public-error checks.
        pending.resolve(candidate);
        notify();
      }, failed);
    } catch {
      failed();
    }
    return result;
  };
  const revoke = (): void => {
    epoch += 1;
    active = false;
    for (const state of states.values()) {
      const pending = state.pending;
      if (pending === undefined) continue;
      state.pending = undefined;
      state.status = "denied";
      pending.resolve(DENIED);
      pending.abort.abort();
    }
  };
  const controller: AuthoringIntegrationController = Object.freeze({
    operationPort: Object.freeze({ invoke }),
    read: () => snapshot,
    subscribe: (listener: AuthoringIntegrationControllerListener) => {
      if (typeof listener !== "function" || disposed) return () => undefined;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    activate: () => {
      if (active || disposed) return;
      epoch += 1;
      active = true;
      notify();
    },
    deactivate: () => {
      if (!active || disposed) return;
      revoke();
      notify();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      revoke();
      notify();
      listeners.clear();
    },
  });
  return Object.freeze({ status: "created", controller });
}
