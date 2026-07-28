/* eslint-disable @typescript-eslint/no-invalid-void-type -- `this: void` is the deliberate
 * receiver-independent callback contract at the runtime host boundary. */
import { createRuntimeHostPorts } from "@desen/runtime-core";

import {
  emptyRuntimeWebEnvironment,
  readRuntimeWebBrowserPlatformAuthority,
  snapshotRuntimeWebEnvironment,
} from "./browser-platform.js";

import type {
  RuntimeActivationCommitResult,
  RuntimeActivationReadResult,
  RuntimeBundleStoragePutResult,
  RuntimeBundleStorageReadResult,
  RuntimeContextPort,
  RuntimeDiagnosticsPort,
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeNavigationPort,
  RuntimeNavigationRequest,
  RuntimeNavigationResult,
  RuntimeOperationPort,
  RuntimeResourcePort,
  RuntimeStoragePort,
  RuntimeTokenPort,
  RuntimeTokenResolution,
} from "@desen/runtime-core";
import type {
  RuntimeWebBrowserPlatformAuthority,
  RuntimeWebBrowserPlatformHandle,
} from "./browser-platform.js";

declare const RUNTIME_WEB_HOST_AUTHORITY_HANDLE_BRAND: unique symbol;

const REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_DOCUMENT_ID_CODE_UNITS = 1_024;
const EMPTY_OBJECT = Object.freeze({}) as RuntimeJsonObject;
const NAVIGATION_DENIED = Object.freeze({ status: "denied" }) as RuntimeNavigationResult;
const HOST_CALL_DENIED = Object.freeze({ status: "denied" }) as RuntimeHostCallResult;
const STORAGE_MISSING = Object.freeze({ status: "missing" }) as
  RuntimeBundleStorageReadResult | RuntimeActivationReadResult;
const STORAGE_CONFLICT = Object.freeze({ status: "conflict" }) as RuntimeBundleStoragePutResult;
const ACTIVATION_CONFLICT = Object.freeze({
  status: "conflict",
  generation: null,
}) as RuntimeActivationCommitResult;
const TOKEN_MISSING = Object.freeze({ status: "missing" }) as RuntimeTokenResolution;
const NOOP_UNSUBSCRIBE = Object.freeze(() => undefined);
const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);

/** Complete trusted composition input for one browser runtime authority. */
export interface RuntimeWebHostAuthorityCreateInput {
  /** Factory-authenticated browser environment and epoch-clock authority. */
  readonly platform: RuntimeWebBrowserPlatformHandle;
  /** Exact active Bundle document identity asserted before host navigation. */
  readonly documentId: string;
  /** Exact active Bundle semantic revision asserted before host navigation. */
  readonly revision: string;
  /** Trusted application navigation policy. */
  readonly navigation: RuntimeNavigationPort;
  /** Trusted host-owned immutable Bundle and activation persistence. */
  readonly storage: RuntimeStoragePort;
  /** Trusted operation implementation dispatch. */
  readonly operations: RuntimeOperationPort;
  /** Trusted resource implementation dispatch. */
  readonly resources: RuntimeResourcePort;
  /** Trusted target token lookup. */
  readonly tokens: RuntimeTokenPort;
  /** Trusted non-secret application context. */
  readonly context: RuntimeContextPort;
  /** Trusted safe diagnostic observation. */
  readonly diagnostics: RuntimeDiagnosticsPort;
}

/** Opaque factory-authenticated lifetime for one captured browser host aggregate. */
export interface RuntimeWebHostAuthorityHandle {
  readonly [RUNTIME_WEB_HOST_AUTHORITY_HANDLE_BRAND]: true;
}

/** Controlled host-authority construction result. */
export type RuntimeWebHostAuthorityCreateResult =
  | Readonly<{
      readonly status: "created";
      readonly handle: RuntimeWebHostAuthorityHandle;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        | "invalid-browser-platform"
        | "invalid-document-identity"
        | "invalid-host-ports"
        | "malformed-input";
    }>;

/** Authenticated active host-port read or one non-authoritative terminal result. */
export type RuntimeWebHostAuthorityReadResult =
  | Readonly<{
      readonly status: "active";
      readonly hostPorts: RuntimeHostPorts;
    }>
  | Readonly<{ readonly status: "disposed" | "invalid-authority" }>;

/**
 * Exact caller-owned document identity to authenticate against one active Web host authority.
 */
export interface RuntimeWebHostDocumentAuthorityInput {
  /** Exact configured Bundle document identifier. */
  readonly documentId: string;
  /** Exact configured Bundle semantic revision. */
  readonly revision: string;
}

/**
 * Closed status-only result of authenticating a Web host's configured document identity.
 *
 * @remarks No result exposes host ports, captured delegates, platform callbacks, or any other
 * executable authority. Every variant is a frozen callback-free own-data record.
 */
export type RuntimeWebHostDocumentAuthorityResult =
  | Readonly<{
      /** The exact document and revision belong to this active host authority. */
      readonly status: "authenticated";
    }>
  | Readonly<{
      /** A valid supplied identity does not match the authority's configured pair. */
      readonly status: "mismatched-document-authority";
    }>
  | Readonly<{
      /** The host authority has terminally ended. */
      readonly status: "disposed";
    }>
  | Readonly<{
      /** The supplied handle was not created by the Web host-authority factory. */
      readonly status: "invalid-authority";
    }>
  | Readonly<{
      /** The request was not the exact valid two-member enumerable own-data envelope. */
      readonly status: "malformed-request";
    }>;

/** Controlled, idempotent terminal host-authority disposal result. */
export type RuntimeWebHostAuthorityDisposeResult =
  | Readonly<{
      readonly status: "disposed";
      readonly unsubscribed: number;
    }>
  | Readonly<{
      readonly status: "already-disposed" | "invalid-authority";
      readonly unsubscribed: 0;
    }>;

interface OwnDataRead {
  readonly valid: boolean;
  readonly present: boolean;
  readonly value?: unknown;
}

interface CapturedHostDelegates {
  readonly navigate: RuntimeNavigationPort["navigate"];
  readonly getBundle: RuntimeStoragePort["getBundle"];
  readonly putBundle: RuntimeStoragePort["putBundle"];
  readonly readActivation: RuntimeStoragePort["readActivation"];
  readonly commitActivation: RuntimeStoragePort["commitActivation"];
  readonly invoke: RuntimeOperationPort["invoke"];
  readonly load: RuntimeResourcePort["load"];
  readonly resolveToken: RuntimeTokenPort["resolve"];
  readonly getContextSnapshot: RuntimeContextPort["getSnapshot"];
  readonly subscribeContext: RuntimeContextPort["subscribe"];
  readonly reportDiagnostic: RuntimeDiagnosticsPort["report"];
}

interface CapturedHostDocumentAuthorityInput {
  readonly documentId: string;
  readonly revision: string;
}

interface RuntimeWebSubscription {
  active: boolean;
  unsubscribe: (() => void) | undefined;
}

interface RuntimeWebHostAuthority {
  status: "active" | "disposed";
  readonly documentId: string;
  readonly revision: string;
  delegates: CapturedHostDelegates | undefined;
  platform: RuntimeWebBrowserPlatformAuthority | undefined;
  hostPorts: RuntimeHostPorts | undefined;
  readonly subscriptions: Set<RuntimeWebSubscription>;
  environmentSnapshot: RuntimeJsonObject;
  lastEpochMilliseconds: number;
}

interface RuntimeWebHostAuthorityTombstone {
  readonly status: "disposed";
}

type RuntimeWebHostAuthorityEntry = RuntimeWebHostAuthority | RuntimeWebHostAuthorityTombstone;

const HOST_AUTHORITIES = new WeakMap<RuntimeWebHostAuthorityHandle, RuntimeWebHostAuthorityEntry>();
const DISPOSED_HOST_AUTHORITY = Object.freeze({
  status: "disposed",
}) as RuntimeWebHostAuthorityTombstone;

function ownDataValue(owner: object, key: PropertyKey): OwnDataRead {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    if (descriptor === undefined) return Object.freeze({ valid: true, present: false });
    return "value" in descriptor
      ? Object.freeze({ valid: true, present: true, value: descriptor.value })
      : Object.freeze({ valid: false, present: true });
  } catch {
    return Object.freeze({ valid: false, present: false });
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
    return (
      Object.getPrototypeOf(prototype) === null &&
      constructor !== undefined &&
      "value" in constructor &&
      typeof constructor.value === "function" &&
      Reflect.apply(FUNCTION_TO_STRING, constructor.value, []) === NATIVE_OBJECT_CONSTRUCTOR_SOURCE
    );
  } catch {
    return false;
  }
}

function hasExactOwnKeys(value: object, expected: readonly string[]): boolean {
  try {
    const keys = Reflect.ownKeys(value);
    return (
      keys.length === expected.length &&
      keys.every((key) => typeof key === "string" && expected.includes(key)) &&
      expected.every((key) => keys.includes(key))
    );
  } catch {
    return false;
  }
}

function validDocumentId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_DOCUMENT_ID_CODE_UNITS &&
    !value.includes("\u0000")
  );
}

function validRevision(value: unknown): value is string {
  return typeof value === "string" && REVISION_PATTERN.test(value);
}

function captureHostDocumentAuthorityInput(
  input: unknown,
): CapturedHostDocumentAuthorityInput | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Reflect.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== 2 ||
      !keys.includes("documentId") ||
      !keys.includes("revision") ||
      keys.some((key) => typeof key !== "string" || (key !== "documentId" && key !== "revision"))
    ) {
      return undefined;
    }
    const documentId = Reflect.getOwnPropertyDescriptor(input, "documentId");
    const revision = Reflect.getOwnPropertyDescriptor(input, "revision");
    if (
      documentId === undefined ||
      !documentId.enumerable ||
      !("value" in documentId) ||
      !validDocumentId(documentId.value) ||
      revision === undefined ||
      !revision.enumerable ||
      !("value" in revision) ||
      !validRevision(revision.value)
    ) {
      return undefined;
    }
    return Object.freeze({
      documentId: documentId.value,
      revision: revision.value,
    });
  } catch {
    return undefined;
  }
}

function captureExactPort(
  input: object,
  portName: string,
  methodNames: readonly string[],
): Readonly<Record<string, (this: void, ...arguments_: never[]) => unknown>> | undefined {
  const port = ownDataValue(input, portName);
  if (
    !port.valid ||
    !port.present ||
    !isPlainRecord(port.value) ||
    !hasExactOwnKeys(port.value, methodNames)
  ) {
    return undefined;
  }

  const methods: Record<string, (this: void, ...arguments_: never[]) => unknown> = {};
  for (const methodName of methodNames) {
    const method = ownDataValue(port.value, methodName);
    if (!method.valid || !method.present || typeof method.value !== "function") return undefined;
    methods[methodName] = method.value as (this: void, ...arguments_: never[]) => unknown;
  }
  return Object.freeze(methods);
}

function captureHostDelegates(input: object): CapturedHostDelegates | undefined {
  const navigation = captureExactPort(input, "navigation", ["navigate"]);
  const storage = captureExactPort(input, "storage", [
    "getBundle",
    "putBundle",
    "readActivation",
    "commitActivation",
  ]);
  const operations = captureExactPort(input, "operations", ["invoke"]);
  const resources = captureExactPort(input, "resources", ["load"]);
  const tokens = captureExactPort(input, "tokens", ["resolve"]);
  const context = captureExactPort(input, "context", ["getSnapshot", "subscribe"]);
  const diagnostics = captureExactPort(input, "diagnostics", ["report"]);
  if (
    navigation === undefined ||
    storage === undefined ||
    operations === undefined ||
    resources === undefined ||
    tokens === undefined ||
    context === undefined ||
    diagnostics === undefined
  ) {
    return undefined;
  }

  return Object.freeze({
    navigate: navigation.navigate as RuntimeNavigationPort["navigate"],
    getBundle: storage.getBundle as RuntimeStoragePort["getBundle"],
    putBundle: storage.putBundle as RuntimeStoragePort["putBundle"],
    readActivation: storage.readActivation as RuntimeStoragePort["readActivation"],
    commitActivation: storage.commitActivation as RuntimeStoragePort["commitActivation"],
    invoke: operations.invoke as RuntimeOperationPort["invoke"],
    load: resources.load as RuntimeResourcePort["load"],
    resolveToken: tokens.resolve as RuntimeTokenPort["resolve"],
    getContextSnapshot: context.getSnapshot as RuntimeContextPort["getSnapshot"],
    subscribeContext: context.subscribe as RuntimeContextPort["subscribe"],
    reportDiagnostic: diagnostics.report as RuntimeDiagnosticsPort["report"],
  });
}

function navigationMatchesAuthority(
  request: RuntimeNavigationRequest,
  authority: RuntimeWebHostAuthority,
): boolean {
  if (
    !isPlainRecord(request) ||
    !hasExactOwnKeys(request, ["context", "targetSurfaceId", "params"])
  ) {
    return false;
  }
  const context = ownDataValue(request, "context");
  if (
    !context.valid ||
    !context.present ||
    !isPlainRecord(context.value) ||
    !hasExactOwnKeys(context.value, ["documentId", "revision", "surfaceId", "requestId"])
  ) {
    return false;
  }
  const documentId = ownDataValue(context.value, "documentId");
  const revision = ownDataValue(context.value, "revision");
  return (
    documentId.valid &&
    documentId.present &&
    documentId.value === authority.documentId &&
    revision.valid &&
    revision.present &&
    revision.value === authority.revision
  );
}

function closeSubscription(
  authority: RuntimeWebHostAuthority,
  subscription: RuntimeWebSubscription,
): boolean {
  if (!subscription.active) return false;
  subscription.active = false;
  authority.subscriptions.delete(subscription);
  const unsubscribe = subscription.unsubscribe;
  subscription.unsubscribe = undefined;
  if (unsubscribe === undefined) return false;
  try {
    Reflect.apply(unsubscribe, undefined, []);
  } catch {
    // Disposal is a redacted terminal fence; platform cleanup failures never enter public data.
  }
  return true;
}

function subscribeWithFence(
  authority: RuntimeWebHostAuthority,
  subscribe: (this: void, listener: () => void) => () => void,
  listener: () => void,
): () => void {
  if (authority.status !== "active" || typeof listener !== "function") {
    return NOOP_UNSUBSCRIBE;
  }

  const subscription: RuntimeWebSubscription = {
    active: true,
    unsubscribe: undefined,
  };
  authority.subscriptions.add(subscription);
  const notice = () => {
    if (authority.status !== "active" || !subscription.active) return;
    try {
      Reflect.apply(listener, undefined, []);
    } catch {
      // Browser event delivery cannot expose a runtime listener exception to platform code.
    }
  };

  let unsubscribe: () => void;
  try {
    const candidate = Reflect.apply(subscribe, undefined, [notice]) as unknown;
    if (typeof candidate !== "function") {
      closeSubscription(authority, subscription);
      throw new TypeError("Runtime web subscription did not return an unsubscribe callback.");
    }
    unsubscribe = candidate as () => void;
  } catch {
    closeSubscription(authority, subscription);
    throw new TypeError("Runtime web subscription could not be established.");
  }

  subscription.unsubscribe = unsubscribe;
  if (authority.status !== "active" || !subscription.active) {
    subscription.unsubscribe = undefined;
    try {
      Reflect.apply(unsubscribe, undefined, []);
    } catch {
      // Reentrant disposal already terminalized the authority; the failure remains redacted.
    }
    return NOOP_UNSUBSCRIBE;
  }

  return () => {
    closeSubscription(authority, subscription);
  };
}

function activeDelegates(authority: RuntimeWebHostAuthority): CapturedHostDelegates | undefined {
  return authority.status === "active" ? authority.delegates : undefined;
}

function createFencedHostPorts(authority: RuntimeWebHostAuthority): RuntimeHostPorts | undefined {
  const rawPorts: RuntimeHostPorts = {
    navigation: {
      navigate: (request) => {
        const delegates = activeDelegates(authority);
        if (
          delegates === undefined ||
          !navigationMatchesAuthority(request, authority) ||
          activeDelegates(authority) !== delegates
        ) {
          return NAVIGATION_DENIED;
        }
        const result = Reflect.apply(delegates.navigate, undefined, [request]);
        return activeDelegates(authority) === delegates ? result : NAVIGATION_DENIED;
      },
    },
    storage: {
      getBundle: (revision) => {
        const delegates = activeDelegates(authority);
        if (delegates === undefined) return STORAGE_MISSING as RuntimeBundleStorageReadResult;
        const result = Reflect.apply(delegates.getBundle, undefined, [revision]);
        return activeDelegates(authority) === delegates
          ? result
          : (STORAGE_MISSING as RuntimeBundleStorageReadResult);
      },
      putBundle: (entry) => {
        const delegates = activeDelegates(authority);
        if (delegates === undefined) return STORAGE_CONFLICT;
        const result = Reflect.apply(delegates.putBundle, undefined, [entry]);
        return activeDelegates(authority) === delegates ? result : STORAGE_CONFLICT;
      },
      readActivation: () => {
        const delegates = activeDelegates(authority);
        if (delegates === undefined) return STORAGE_MISSING as RuntimeActivationReadResult;
        const result = Reflect.apply(delegates.readActivation, undefined, []);
        return activeDelegates(authority) === delegates
          ? result
          : (STORAGE_MISSING as RuntimeActivationReadResult);
      },
      commitActivation: (request) => {
        const delegates = activeDelegates(authority);
        if (delegates === undefined) return ACTIVATION_CONFLICT;
        const result = Reflect.apply(delegates.commitActivation, undefined, [request]);
        return activeDelegates(authority) === delegates ? result : ACTIVATION_CONFLICT;
      },
    },
    operations: {
      invoke: (request) => {
        const delegates = activeDelegates(authority);
        if (delegates === undefined) return HOST_CALL_DENIED;
        const result = Reflect.apply(delegates.invoke, undefined, [request]);
        return activeDelegates(authority) === delegates ? result : HOST_CALL_DENIED;
      },
    },
    resources: {
      load: (request) => {
        const delegates = activeDelegates(authority);
        if (delegates === undefined) return HOST_CALL_DENIED;
        const result = Reflect.apply(delegates.load, undefined, [request]);
        return activeDelegates(authority) === delegates ? result : HOST_CALL_DENIED;
      },
    },
    tokens: {
      resolve: (request) => {
        const delegates = activeDelegates(authority);
        if (delegates === undefined) return TOKEN_MISSING;
        const result = Reflect.apply(delegates.resolveToken, undefined, [request]);
        return activeDelegates(authority) === delegates ? result : TOKEN_MISSING;
      },
    },
    context: {
      getSnapshot: () => {
        const delegates = activeDelegates(authority);
        if (delegates === undefined) return EMPTY_OBJECT;
        const result = Reflect.apply(delegates.getContextSnapshot, undefined, []);
        return activeDelegates(authority) === delegates ? result : EMPTY_OBJECT;
      },
      subscribe: (listener) => {
        const delegates = activeDelegates(authority);
        return delegates === undefined
          ? NOOP_UNSUBSCRIBE
          : subscribeWithFence(authority, delegates.subscribeContext, listener);
      },
    },
    environment: {
      getSnapshot: () => {
        const platform = authority.status === "active" ? authority.platform : undefined;
        if (platform === undefined) return emptyRuntimeWebEnvironment();
        let candidate: unknown;
        try {
          candidate = Reflect.apply(platform.getEnvironmentSnapshot, undefined, []);
        } catch {
          return authority.environmentSnapshot;
        }
        const snapshot = snapshotRuntimeWebEnvironment(candidate);
        if (
          snapshot !== undefined &&
          authority.status === "active" &&
          authority.platform === platform
        ) {
          authority.environmentSnapshot = snapshot;
        }
        return authority.status === "active"
          ? authority.environmentSnapshot
          : emptyRuntimeWebEnvironment();
      },
      subscribe: (listener) => {
        const platform = authority.status === "active" ? authority.platform : undefined;
        return platform === undefined
          ? NOOP_UNSUBSCRIBE
          : subscribeWithFence(authority, platform.subscribeEnvironment, listener);
      },
    },
    clock: {
      now: () => {
        const platform = authority.status === "active" ? authority.platform : undefined;
        if (platform === undefined) return authority.lastEpochMilliseconds;
        let observed: unknown;
        try {
          observed = Reflect.apply(platform.now, undefined, []);
        } catch {
          return authority.lastEpochMilliseconds;
        }
        if (
          typeof observed === "number" &&
          Number.isFinite(observed) &&
          observed >= 0 &&
          observed >= authority.lastEpochMilliseconds &&
          authority.status === "active" &&
          authority.platform === platform
        ) {
          authority.lastEpochMilliseconds = observed;
        }
        return authority.lastEpochMilliseconds;
      },
    },
    diagnostics: {
      report: (diagnostic) => {
        const delegates = activeDelegates(authority);
        if (delegates !== undefined) {
          try {
            Reflect.apply(delegates.reportDiagnostic, undefined, [diagnostic]);
          } catch {
            // Diagnostics are observational and cannot alter the runtime result.
          }
        }
      },
    },
  };

  try {
    return createRuntimeHostPorts(rawPorts);
  } catch {
    return undefined;
  }
}

/**
 * Builds one factory-authenticated, terminally disposable browser host-port aggregate.
 *
 * @remarks All nine ports and fourteen callbacks are captured through
 * {@link createRuntimeHostPorts}. Construction invokes no platform or host callback. Every
 * published callback checks the shared authority lifetime before delegation; subscriptions add a
 * second late-notice fence and are removed exactly once during disposal. Navigation is delegated
 * only when its own-data request context names the exact configured document and revision.
 */
export function createRuntimeWebHostAuthority(
  input: RuntimeWebHostAuthorityCreateInput,
): RuntimeWebHostAuthorityCreateResult {
  if (
    !isPlainRecord(input) ||
    !hasExactOwnKeys(input, [
      "platform",
      "documentId",
      "revision",
      "navigation",
      "storage",
      "operations",
      "resources",
      "tokens",
      "context",
      "diagnostics",
    ])
  ) {
    return Object.freeze({ status: "rejected", reason: "malformed-input" });
  }

  const platformValue = ownDataValue(input, "platform");
  if (!platformValue.valid || !platformValue.present) {
    return Object.freeze({ status: "rejected", reason: "malformed-input" });
  }
  const platform = readRuntimeWebBrowserPlatformAuthority(
    platformValue.value as RuntimeWebBrowserPlatformHandle,
  );
  if (platform === undefined) {
    return Object.freeze({ status: "rejected", reason: "invalid-browser-platform" });
  }

  const documentIdValue = ownDataValue(input, "documentId");
  const revisionValue = ownDataValue(input, "revision");
  if (
    !documentIdValue.valid ||
    !documentIdValue.present ||
    !validDocumentId(documentIdValue.value) ||
    !revisionValue.valid ||
    !revisionValue.present ||
    !validRevision(revisionValue.value)
  ) {
    return Object.freeze({ status: "rejected", reason: "invalid-document-identity" });
  }

  const delegates = captureHostDelegates(input);
  if (delegates === undefined) {
    return Object.freeze({ status: "rejected", reason: "invalid-host-ports" });
  }

  const authority: RuntimeWebHostAuthority = {
    status: "active",
    documentId: documentIdValue.value,
    revision: revisionValue.value,
    delegates,
    platform,
    hostPorts: undefined,
    subscriptions: new Set(),
    environmentSnapshot: emptyRuntimeWebEnvironment(),
    lastEpochMilliseconds: 0,
  };
  const hostPorts = createFencedHostPorts(authority);
  if (hostPorts === undefined) {
    authority.status = "disposed";
    authority.delegates = undefined;
    authority.platform = undefined;
    return Object.freeze({ status: "rejected", reason: "invalid-host-ports" });
  }
  authority.hostPorts = hostPorts;

  const handle = Object.freeze({}) as RuntimeWebHostAuthorityHandle;
  HOST_AUTHORITIES.set(handle, authority);
  return Object.freeze({ status: "created", handle });
}

/**
 * Authenticates and reads the exact active host aggregate.
 *
 * @remarks A structural clone or cast cannot recover authority. A disposed handle never exposes
 * its prior host-port object, though already captured callbacks remain safe inert fences.
 */
export function readRuntimeWebHostAuthority(
  handle: RuntimeWebHostAuthorityHandle,
): RuntimeWebHostAuthorityReadResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-authority" });
  }
  const entry = HOST_AUTHORITIES.get(handle);
  if (entry === undefined) return Object.freeze({ status: "invalid-authority" });
  if (entry.status === "disposed") return Object.freeze({ status: "disposed" });
  const hostPorts = entry.hostPorts;
  return hostPorts === undefined
    ? Object.freeze({ status: "disposed" })
    : Object.freeze({ status: "active", hostPorts });
}

/**
 * Authenticates one active Web host authority against its exact configured document and revision.
 *
 * @remarks Handle authenticity and liveness are checked before caller input is reflected. The
 * function then captures only an exact two-member own-data envelope, validates both inert strings,
 * and rechecks the same live authority so reentrant disposal wins over an apparent match. It never
 * reads inside host ports or delegates and invokes no platform or application callback.
 */
export function authenticateRuntimeWebHostDocumentAuthority(
  handle: RuntimeWebHostAuthorityHandle,
  input: RuntimeWebHostDocumentAuthorityInput,
): RuntimeWebHostDocumentAuthorityResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-authority" });
  }
  const authority = HOST_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-authority" });
  if (authority.status !== "active") return Object.freeze({ status: "disposed" });

  const captured = captureHostDocumentAuthorityInput(input);
  const current = HOST_AUTHORITIES.get(handle);
  if (current !== authority || current.status !== "active") {
    return Object.freeze({ status: "disposed" });
  }
  if (captured === undefined) return Object.freeze({ status: "malformed-request" });
  if (captured.documentId !== current.documentId || captured.revision !== current.revision) {
    return Object.freeze({ status: "mismatched-document-authority" });
  }
  return Object.freeze({ status: "authenticated" });
}

/**
 * Revokes every callback and removes every active context/environment subscription.
 *
 * @remarks Disposal is terminal, idempotent, and redacted. Unsubscribe failures are caught
 * without exposing thrown values, stacks, causes, or platform objects in the public result.
 */
export function disposeRuntimeWebHostAuthority(
  handle: RuntimeWebHostAuthorityHandle,
): RuntimeWebHostAuthorityDisposeResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({
      status: "invalid-authority",
      unsubscribed: 0,
    });
  }
  const entry = HOST_AUTHORITIES.get(handle);
  if (entry === undefined) {
    return Object.freeze({
      status: "invalid-authority",
      unsubscribed: 0,
    });
  }
  if (entry.status === "disposed") {
    return Object.freeze({
      status: "already-disposed",
      unsubscribed: 0,
    });
  }

  entry.status = "disposed";
  entry.delegates = undefined;
  entry.platform = undefined;
  entry.hostPorts = undefined;
  let unsubscribed = 0;
  for (const subscription of [...entry.subscriptions]) {
    if (closeSubscription(entry, subscription)) unsubscribed += 1;
  }
  entry.environmentSnapshot = emptyRuntimeWebEnvironment();
  HOST_AUTHORITIES.set(handle, DISPOSED_HOST_AUTHORITY);
  return Object.freeze({ status: "disposed", unsubscribed });
}
