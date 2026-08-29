import { signInOperationRegistration } from "@desen/reference-catalog-web/operations";
import {
  createSyntheticFixtureSnapshot,
  lookupSyntheticOperationError,
  lookupSyntheticOperationSuccess,
  SYNTHETIC_FIXTURE_CONTEXT,
} from "@desen/testkit";

import type {
  RuntimeHostCallResult,
  RuntimeOperationPort,
  RuntimeOperationRequest,
} from "@desen/runtime-core";
import type { SyntheticFixtureValue } from "@desen/testkit";

const SIGN_IN_INVOCATION_ALIAS = "signIn";
const SIGN_IN_CAPABILITY_ID = signInOperationRegistration.id;
const SIGN_IN_EFFECT = signInOperationRegistration.manifest.effect;

function deepFreezeProjection<const Value>(value: Value): Value {
  if (value === null || typeof value !== "object") return value;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      deepFreezeProjection(descriptor.value);
    }
  }
  return Object.freeze(value);
}

const SIGN_IN_FIXTURE_SNAPSHOT = createSyntheticFixtureSnapshot({
  context: SYNTHETIC_FIXTURE_CONTEXT,
  operations: [signInOperationRegistration],
  resources: [],
});

const SUCCESS_LOOKUP = lookupSyntheticOperationSuccess(
  SIGN_IN_FIXTURE_SNAPSHOT,
  SIGN_IN_CAPABILITY_ID,
);
const INVALID_CREDENTIALS_LOOKUP = lookupSyntheticOperationError(
  SIGN_IN_FIXTURE_SNAPSHOT,
  SIGN_IN_CAPABILITY_ID,
  "invalidCredentials",
);
const UNAVAILABLE_LOOKUP = lookupSyntheticOperationError(
  SIGN_IN_FIXTURE_SNAPSHOT,
  SIGN_IN_CAPABILITY_ID,
  "unavailable",
);

function isExactSuccessFixture(value: SyntheticFixtureValue): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== "userId") return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, "userId");
  return descriptor?.enumerable === true && "value" in descriptor && descriptor.value === "user-1";
}

function isExactEmptyFixture(value: SyntheticFixtureValue): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Reflect.ownKeys(value).length === 0
  );
}

if (
  SUCCESS_LOOKUP.status !== "found" ||
  !isExactSuccessFixture(SUCCESS_LOOKUP.value) ||
  INVALID_CREDENTIALS_LOOKUP.status !== "found" ||
  !isExactEmptyFixture(INVALID_CREDENTIALS_LOOKUP.value) ||
  UNAVAILABLE_LOOKUP.status !== "missing" ||
  Object.hasOwn(SIGN_IN_FIXTURE_SNAPSHOT.operations[SIGN_IN_CAPABILITY_ID] ?? {}, "pending")
) {
  throw new TypeError("The controlled sign-in fixture inventory does not match the App profile.");
}

/** Closed execution-context identifiers shown by the authoring fixture controls. */
export type AuthoringFixtureContextId = "synthetic" | "integration" | "production";

/** One visible execution context in the App-owned fixture disclosure. */
export interface AuthoringFixtureContextOption {
  /** Stable context identifier used only by App UI. */
  readonly id: AuthoringFixtureContextId;
  /** Short visible context label. */
  readonly label: string;
  /** Whether this context can execute in the current authoring preview. */
  readonly availability: "active" | "unavailable";
  /** Visible explanation of the context's current authority. */
  readonly description: string;
}

/** Complete visible context model for the fixture-only authoring preview. */
export interface AuthoringFixtureContextModel {
  /** The only active execution context. */
  readonly activeId: "synthetic";
  /** Persistent disclosure that distinguishes fixtures from real integrations. */
  readonly disclosure: string;
  /** Synthetic, integration, and production contexts in display order. */
  readonly options: readonly AuthoringFixtureContextOption[];
}

/**
 * Visible fixture context disclosure for M09 authoring previews.
 *
 * @remarks Integration and production remain represented so the UI never implies that synthetic
 * Catalog data is a real host binding. Neither unavailable context is selectable or executable.
 */
export const AUTHORING_FIXTURE_CONTEXT_MODEL: AuthoringFixtureContextModel = deepFreezeProjection({
  activeId: "synthetic",
  disclosure: "Synthetic Catalog data. Integration and production calls are off.",
  options: [
    {
      id: "synthetic",
      label: "Synthetic",
      availability: "active",
      description: "Uses inert authoring fixtures from the authenticated Catalog manifest.",
    },
    {
      id: "integration",
      label: "Integration",
      availability: "unavailable",
      description: "No integration binding is connected in this authoring preview.",
    },
    {
      id: "production",
      label: "Production",
      availability: "unavailable",
      description: "Production calls are off in this authoring preview.",
    },
  ],
});

/** Exact selectable sign-in fixture outcome identifiers. */
export type AuthoringSignInFixtureOutcomeId = "success" | "invalidCredentials";

/** One inert, selectable outcome projected from the sign-in operation manifest. */
export interface AuthoringSignInFixtureOutcome {
  /** Stable selection value for the App-owned control. */
  readonly id: AuthoringSignInFixtureOutcomeId;
  /** Visible outcome label. */
  readonly label: string;
  /** Whether the fixture represents a successful output or declared public error. */
  readonly kind: "success" | "error";
  /** Exact operation capability that owns the fixture. */
  readonly capabilityId: typeof SIGN_IN_CAPABILITY_ID;
  /** Detached synthetic payload projected by `@desen/testkit`. */
  readonly fixtureValue: SyntheticFixtureValue;
}

/**
 * Complete selectable sign-in fixture inventory.
 *
 * @remarks `pending` is absent because it is a real Runtime lifecycle state. The declared
 * `unavailable` error is absent because the manifest supplies no fixture for it.
 */
export const AUTHORING_SIGN_IN_FIXTURE_OUTCOMES: readonly AuthoringSignInFixtureOutcome[] =
  deepFreezeProjection([
    {
      id: "success",
      label: "Success · user-1",
      kind: "success",
      capabilityId: SIGN_IN_CAPABILITY_ID,
      fixtureValue: SUCCESS_LOOKUP.value,
    },
    {
      id: "invalidCredentials",
      label: "Invalid credentials",
      kind: "error",
      capabilityId: SIGN_IN_CAPABILITY_ID,
      fixtureValue: INVALID_CREDENTIALS_LOOKUP.value,
    },
  ]);

/** Observable lifecycle of the App-owned sign-in fixture controller. */
export type AuthoringSignInFixtureStatus = "idle" | "pending" | "succeeded" | "failed" | "disposed";

/** Inert controller state suitable for visible Run controls. */
export interface AuthoringSignInFixtureControllerSnapshot {
  /** Current authoring-only operation lifecycle. */
  readonly status: AuthoringSignInFixtureStatus;
  /** Outcome captured by the next or currently pending invocation. */
  readonly selectedOutcomeId: AuthoringSignInFixtureOutcomeId;
  /** Terminal outcome, or `null` before completion and after a new selection. */
  readonly completedOutcomeId: AuthoringSignInFixtureOutcomeId | null;
}

/** Listener notified with detached, deeply frozen fixture-controller state. */
export type AuthoringSignInFixtureControllerListener = (
  snapshot: AuthoringSignInFixtureControllerSnapshot,
) => void;

/** Controlled result of selecting the next synthetic outcome. */
export type AuthoringSignInFixtureSelectionResult =
  | Readonly<{
      readonly status: "selected";
      readonly snapshot: AuthoringSignInFixtureControllerSnapshot;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason: "disposed" | "inactive" | "pending" | "unknown-outcome";
    }>;

/** Controlled result of explicitly settling the current pending fixture invocation. */
export type AuthoringSignInFixtureCompletionResult =
  | Readonly<{
      readonly status: "completed";
      readonly outcomeId: AuthoringSignInFixtureOutcomeId;
    }>
  | Readonly<{
      readonly status: "ignored";
      readonly reason: "disposed" | "inactive" | "not-pending";
    }>;

/** App-owned synthetic sign-in operation controller and its stable Runtime host port. */
export interface AuthoringSignInFixtureController {
  /** Stable operation-port identity retained across outcome changes. */
  readonly operationPort: RuntimeOperationPort;
  /** Reads the current immutable, credential-free controller state. */
  readonly read: () => AuthoringSignInFixtureControllerSnapshot;
  /** Subscribes to lifecycle changes and returns an idempotent unsubscribe callback. */
  readonly subscribe: (listener: AuthoringSignInFixtureControllerListener) => () => void;
  /** Selects the next exact fixture outcome while no invocation is pending. */
  readonly selectOutcome: (
    outcomeId: AuthoringSignInFixtureOutcomeId,
  ) => AuthoringSignInFixtureSelectionResult;
  /** Completes the current real pending Promise with its captured synthetic outcome. */
  readonly completePending: () => AuthoringSignInFixtureCompletionResult;
  /** Reopens the same controller after a development-only effect replay. */
  readonly activate: () => void;
  /** Immediately rejects new calls and revokes pending work before terminal disposal. */
  readonly deactivate: () => void;
  /** Revokes pending work and terminally disables this controller lifetime. */
  readonly dispose: () => void;
}

/** Exact Runtime identity that one fixture-controller lifetime is authorized to serve. */
export interface AuthoringSignInFixtureExpectedContext {
  /** Active Bundle document identifier. */
  readonly documentId: string;
  /** Exact active preview Bundle revision. */
  readonly revision: string;
  /** Surface that owns this controller lifetime. */
  readonly surfaceId: string;
}

interface PendingInvocation {
  readonly outcomeId: AuthoringSignInFixtureOutcomeId;
  readonly resolve: (result: RuntimeHostCallResult) => void;
}

const DENIED_RESULT = deepFreezeProjection({ status: "denied" } satisfies RuntimeHostCallResult);
const SUCCESS_RESULT = deepFreezeProjection({
  status: "succeeded",
  value: SUCCESS_LOOKUP.value,
} satisfies RuntimeHostCallResult);
const INVALID_CREDENTIALS_RESULT = deepFreezeProjection({
  status: "failed",
  errorCode: "invalidCredentials",
} satisfies RuntimeHostCallResult);

function controllerSnapshot(
  status: AuthoringSignInFixtureStatus,
  selectedOutcomeId: AuthoringSignInFixtureOutcomeId,
  completedOutcomeId: AuthoringSignInFixtureOutcomeId | null = null,
): AuthoringSignInFixtureControllerSnapshot {
  return deepFreezeProjection({ status, selectedOutcomeId, completedOutcomeId });
}

function readOwnDataString(request: RuntimeOperationRequest, key: string): string | undefined {
  if (typeof request !== "object" || request === null || Array.isArray(request)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(request, key);
  return descriptor?.enumerable === true &&
    "value" in descriptor &&
    typeof descriptor.value === "string"
    ? descriptor.value
    : undefined;
}

function readExactExpectedContext(
  value: AuthoringSignInFixtureExpectedContext,
): AuthoringSignInFixtureExpectedContext {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Fixture expected context must be an exact data object.");
  }
  const expectedKeys = ["documentId", "revision", "surfaceId"] as const;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key as never))
  ) {
    throw new TypeError(
      "Fixture expected context must contain only documentId, revision, surfaceId.",
    );
  }

  const projected = Object.create(null) as Record<(typeof expectedKeys)[number], string>;
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor?.enumerable !== true ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      descriptor.value.length === 0
    ) {
      throw new TypeError(`Fixture expected context ${key} must be a non-empty own data string.`);
    }
    projected[key] = descriptor.value;
  }
  return deepFreezeProjection({
    documentId: projected.documentId,
    revision: projected.revision,
    surfaceId: projected.surfaceId,
  });
}

function hasAuthorizedRequestContext(
  request: RuntimeOperationRequest,
  expectedContext: AuthoringSignInFixtureExpectedContext,
): boolean {
  if (typeof request !== "object" || request === null || Array.isArray(request)) return false;
  const contextDescriptor = Object.getOwnPropertyDescriptor(request, "context");
  if (
    contextDescriptor?.enumerable !== true ||
    !("value" in contextDescriptor) ||
    typeof contextDescriptor.value !== "object" ||
    contextDescriptor.value === null ||
    Array.isArray(contextDescriptor.value)
  ) {
    return false;
  }

  const context = contextDescriptor.value as object;
  const expectedKeys = ["documentId", "revision", "surfaceId", "requestId"] as const;
  const keys = Reflect.ownKeys(context);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key as never))
  ) {
    return false;
  }

  const readContextString = (key: (typeof expectedKeys)[number]): string | undefined => {
    const descriptor = Object.getOwnPropertyDescriptor(context, key);
    return descriptor?.enumerable === true &&
      "value" in descriptor &&
      typeof descriptor.value === "string" &&
      descriptor.value.length > 0
      ? descriptor.value
      : undefined;
  };
  return (
    readContextString("documentId") === expectedContext.documentId &&
    readContextString("revision") === expectedContext.revision &&
    readContextString("surfaceId") === expectedContext.surfaceId &&
    readContextString("requestId") !== undefined
  );
}

function isAuthorizedSignInRequest(
  request: RuntimeOperationRequest,
  expectedContext: AuthoringSignInFixtureExpectedContext,
): boolean {
  return (
    readOwnDataString(request, "capabilityId") === SIGN_IN_CAPABILITY_ID &&
    readOwnDataString(request, "invocationAlias") === SIGN_IN_INVOCATION_ALIAS &&
    readOwnDataString(request, "effect") === SIGN_IN_EFFECT &&
    hasAuthorizedRequestContext(request, expectedContext)
  );
}

function outcomeResult(outcomeId: AuthoringSignInFixtureOutcomeId): RuntimeHostCallResult {
  return outcomeId === "success" ? SUCCESS_RESULT : INVALID_CREDENTIALS_RESULT;
}

function isOutcomeId(value: unknown): value is AuthoringSignInFixtureOutcomeId {
  return value === "success" || value === "invalidCredentials";
}

/**
 * Creates one App-owned deferred sign-in fixture lifetime bound to an exact preview identity.
 *
 * @remarks The stable host port authorizes only the exact Catalog capability, `signIn` alias, and
 * `network` effect. It deliberately never reads or retains the request input. An authorized call
 * returns a real pending Promise that settles only through `completePending`. Changing the
 * selection does not replace the port. Deactivation synchronously closes request admission and
 * revokes pending transport before effect cleanup can yield; activation exists only so React
 * StrictMode may replay the same mounted lifetime. Disposal terminally clears listeners and makes
 * late completion attempts inert. This controller performs no fetch and contains no real host
 * binding.
 *
 * @throws TypeError when the expected context is not an exact own-data object containing three
 * non-empty string identities.
 */
export function createAuthoringSignInFixtureController(
  expectedContextInput: AuthoringSignInFixtureExpectedContext,
): AuthoringSignInFixtureController {
  const expectedContext = readExactExpectedContext(expectedContextInput);
  let selectedOutcomeId: AuthoringSignInFixtureOutcomeId = "success";
  let snapshot = controllerSnapshot("idle", selectedOutcomeId);
  let pending: PendingInvocation | undefined;
  let active = true;
  let disposed = false;
  const listeners = new Set<AuthoringSignInFixtureControllerListener>();

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener(snapshot);
      } catch {
        // A view listener cannot change fixture settlement or prevent sibling notifications.
      }
    }
  };

  const invoke = (
    request: RuntimeOperationRequest,
  ): Promise<RuntimeHostCallResult> | RuntimeHostCallResult => {
    if (disposed || !active || !isAuthorizedSignInRequest(request, expectedContext)) {
      return DENIED_RESULT;
    }

    const replaced = pending;
    let resolvePending!: (result: RuntimeHostCallResult) => void;
    const promise = new Promise<RuntimeHostCallResult>((resolve) => {
      resolvePending = resolve;
    });
    pending = Object.freeze({ outcomeId: selectedOutcomeId, resolve: resolvePending });
    snapshot = controllerSnapshot("pending", selectedOutcomeId);
    replaced?.resolve(DENIED_RESULT);
    notify();
    return promise;
  };

  const operationPort = Object.freeze({ invoke }) satisfies RuntimeOperationPort;

  const read = (): AuthoringSignInFixtureControllerSnapshot => snapshot;

  const subscribe = (listener: AuthoringSignInFixtureControllerListener): (() => void) => {
    if (typeof listener !== "function" || disposed) return () => undefined;
    listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      listeners.delete(listener);
    };
  };

  const selectOutcome = (
    outcomeId: AuthoringSignInFixtureOutcomeId,
  ): AuthoringSignInFixtureSelectionResult => {
    if (disposed) return Object.freeze({ status: "rejected", reason: "disposed" });
    if (!active) return Object.freeze({ status: "rejected", reason: "inactive" });
    if (!isOutcomeId(outcomeId)) {
      return Object.freeze({ status: "rejected", reason: "unknown-outcome" });
    }
    if (pending !== undefined) return Object.freeze({ status: "rejected", reason: "pending" });

    selectedOutcomeId = outcomeId;
    snapshot = controllerSnapshot("idle", selectedOutcomeId);
    notify();
    return Object.freeze({ status: "selected", snapshot });
  };

  const completePending = (): AuthoringSignInFixtureCompletionResult => {
    if (disposed) return Object.freeze({ status: "ignored", reason: "disposed" });
    if (!active) return Object.freeze({ status: "ignored", reason: "inactive" });
    const current = pending;
    if (current === undefined) {
      return Object.freeze({ status: "ignored", reason: "not-pending" });
    }

    pending = undefined;
    snapshot = controllerSnapshot(
      current.outcomeId === "success" ? "succeeded" : "failed",
      selectedOutcomeId,
      current.outcomeId,
    );
    current.resolve(outcomeResult(current.outcomeId));
    notify();
    return Object.freeze({ status: "completed", outcomeId: current.outcomeId });
  };

  const activate = (): void => {
    if (disposed || active) return;
    active = true;
  };

  const deactivate = (): void => {
    if (disposed || !active) return;
    active = false;
    const revoked = pending;
    pending = undefined;
    if (revoked === undefined) return;
    snapshot = controllerSnapshot("idle", selectedOutcomeId);
    revoked.resolve(DENIED_RESULT);
    notify();
  };

  const dispose = (): void => {
    if (disposed) return;
    active = false;
    disposed = true;
    const revoked = pending;
    pending = undefined;
    snapshot = controllerSnapshot("disposed", selectedOutcomeId);
    revoked?.resolve(DENIED_RESULT);
    notify();
    listeners.clear();
  };

  return Object.freeze({
    operationPort,
    read,
    subscribe,
    selectOutcome,
    completePending,
    activate,
    deactivate,
    dispose,
  });
}
