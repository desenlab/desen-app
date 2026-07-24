/* eslint-disable @typescript-eslint/no-invalid-void-type -- TypeScript's `this: void` is the
 * deliberate receiver-independent callback contract at this host boundary. */
import type { DesenDiagnostic } from "@desen/protocol";

/** A JSON primitive that may cross a framework-neutral runtime boundary. */
export type RuntimeJsonPrimitive = string | number | boolean | null;

/**
 * Recursively readonly JSON data accepted or returned by runtime host ports.
 *
 * @remarks Functions, class instances, binary platform objects, `undefined`, symbols, and
 * framework values are intentionally excluded. Later runtime stages validate and detach values
 * before they become protocol-observable state.
 */
export type RuntimeJsonValue =
  RuntimeJsonPrimitive | { readonly [key: string]: RuntimeJsonValue } | readonly RuntimeJsonValue[];

/** A string-keyed JSON object used for resolved inputs, context, environment, and parameters. */
export type RuntimeJsonObject = Readonly<Record<string, RuntimeJsonValue>>;

/** A synchronous result or platform-neutral promise-like settlement. */
export type RuntimeAwaitable<Result> = Result | PromiseLike<Result>;

/**
 * Stable identities supplied with every host effect request.
 *
 * @remarks `requestId` is allocated deterministically by the runtime. It is an observability and
 * stale-settlement correlation key, not an authorization token or a globally unique secret.
 */
export interface RuntimeRequestContext {
  /** Active Bundle document identifier. */
  readonly documentId: string;
  /** Exact active Bundle revision. */
  readonly revision: string;
  /** Surface that originated the request. */
  readonly surfaceId: string;
  /** Runtime-owned deterministic request identifier. */
  readonly requestId: string;
}

/** Side-effect classification declared by an operation capability. */
export type RuntimeOperationEffect = "none" | "local" | "network" | "external";

/**
 * Safe settlement envelope shared by operation and resource ports.
 *
 * @remarks A successful value is still untrusted until the runtime validates it against the exact
 * capability output schema. `errorCode` is likewise checked against declared public errors.
 * `denied` represents current host policy and must never be converted into success. A missing
 * trusted binding is an activation/preflight failure, while thrown or rejected implementation
 * errors remain adapter failures and must not be serialized through this envelope.
 */
export type RuntimeHostCallResult =
  | Readonly<{
      /** The host implementation completed and returned a candidate public value. */
      status: "succeeded";
      /** Candidate output that the runtime must detach and schema-validate. */
      value: RuntimeJsonValue;
    }>
  | Readonly<{
      /** The host implementation returned one declared public failure. */
      status: "failed";
      /** Candidate public code that the runtime must check against the capability contract. */
      errorCode: string;
    }>
  | Readonly<{
      /** Current host policy refused the otherwise valid request. */
      status: "denied";
    }>;

/** Fully resolved request sent to a trusted host operation implementation. */
export interface RuntimeOperationRequest {
  /** Runtime and active-Bundle identities for policy, tracing, and stale-result protection. */
  readonly context: RuntimeRequestContext;
  /** Exact operation capability identifier resolved from the active Catalog set. */
  readonly capabilityId: string;
  /** Surface-scoped lifecycle alias declared by `operation.invoke`. */
  readonly invocationAlias: string;
  /** Detached JSON input after reference resolution and schema validation. */
  readonly input: RuntimeJsonObject;
  /** Descriptive Catalog effect class; host authorization remains authoritative. */
  readonly effect: RuntimeOperationEffect;
}

/**
 * Trusted operation boundary implemented by the host application.
 *
 * @remarks The port owns application code, authentication, authorization, and infrastructure
 * binding. Runtime concurrency, pending state, output validation, public-error sanitization,
 * settlement actions, and stale-result handling remain in later M04 tasks.
 */
export interface RuntimeOperationPort {
  /** Invokes one already-resolved operation request without exposing host internals to DESEN data. */
  readonly invoke: (
    this: void,
    request: RuntimeOperationRequest,
  ) => RuntimeAwaitable<RuntimeHostCallResult>;
}

/** Fully resolved request sent to a trusted host resource implementation. */
export interface RuntimeResourceRequest {
  /** Runtime and active-Bundle identities for policy, tracing, and stale-result protection. */
  readonly context: RuntimeRequestContext;
  /** Surface-local resource instance name. */
  readonly instanceId: string;
  /** Exact resource capability identifier resolved from the active Catalog set. */
  readonly capabilityId: string;
  /** Detached JSON input after reference resolution and schema validation. */
  readonly input: RuntimeJsonObject;
}

/**
 * Trusted read-oriented resource boundary implemented by the host application.
 *
 * @remarks Mount, once, manual, refresh, pending, caching, output validation, and stale-result
 * semantics remain runtime responsibilities. Domain writes belong to operation capabilities.
 */
export interface RuntimeResourcePort {
  /** Loads one already-resolved resource request through host-approved implementation code. */
  readonly load: (
    this: void,
    request: RuntimeResourceRequest,
  ) => RuntimeAwaitable<RuntimeHostCallResult>;
}

/** Request delegated to the host after the runtime confirms a local managed-surface target. */
export interface RuntimeNavigationRequest {
  /** Runtime and active-Bundle identities used by host navigation policy. */
  readonly context: RuntimeRequestContext;
  /** Existing target surface in the active Bundle. */
  readonly targetSurfaceId: string;
  /** Detached, resolved navigation parameters supplied to host route context. */
  readonly params: RuntimeJsonObject;
}

/**
 * Controlled outcome returned by the host navigation integration.
 *
 * @remarks The runtime validates the target before delegation. A host denial is reported without
 * substituting another surface, while unexpected thrown or rejected errors become adapter
 * failures in the later action runtime.
 */
export type RuntimeNavigationResult =
  Readonly<{ status: "succeeded" }> | Readonly<{ status: "denied" }>;

/** Host integration for navigation between DESEN-managed surfaces. */
export interface RuntimeNavigationPort {
  /** Requests one prevalidated local navigation transition under current host policy. */
  readonly navigate: (this: void, request: RuntimeNavigationRequest) => RuntimeNavigationResult;
}

/** Token lookup request carrying the active runtime location. */
export interface RuntimeTokenRequest {
  /** Runtime and active-Bundle identities used by target-specific token policy. */
  readonly context: RuntimeRequestContext;
  /** Opaque token name from a DESEN `$token` reference. */
  readonly token: string;
}

/**
 * Target-specific token lookup outcome.
 *
 * @remarks DESEN does not own token storage. The resolved value remains a candidate until the
 * consuming prop or style-part schema validates its target-specific type.
 */
export type RuntimeTokenResolution =
  Readonly<{ status: "resolved"; value: RuntimeJsonValue }> | Readonly<{ status: "missing" }>;

/** Synchronous host-owned token provider used during deterministic value materialization. */
export interface RuntimeTokenPort {
  /** Resolves one opaque token name without exposing the host token document to DESEN data. */
  readonly resolve: (this: void, request: RuntimeTokenRequest) => RuntimeTokenResolution;
}

/**
 * Host application context available to `context.*` references.
 *
 * @remarks Snapshots may contain only non-secret JSON data approved for design bindings.
 * Subscription callbacks are invalidation notices: the runtime rereads a complete consistent
 * snapshot instead of trusting an event payload.
 */
export interface RuntimeContextPort {
  /** Returns the current profile-defined, non-secret context snapshot. */
  readonly getSnapshot: (this: void) => RuntimeJsonObject;
  /** Subscribes to context invalidation and returns an idempotent unsubscribe callback. */
  readonly subscribe: (this: void, onChange: () => void) => () => void;
}

/**
 * Runtime environment available to `env.*` references.
 *
 * @remarks The snapshot carries the reserved viewport, pointer, color scheme, reduced motion,
 * locale, and platform paths when supported, plus profile-defined paths. Changes are reported as
 * invalidations so a later runtime task can re-evaluate dependent values consistently.
 */
export interface RuntimeEnvironmentPort {
  /** Returns one current, internally consistent environment snapshot. */
  readonly getSnapshot: (this: void) => RuntimeJsonObject;
  /** Subscribes to environment invalidation and returns an idempotent unsubscribe callback. */
  readonly subscribe: (this: void, onChange: () => void) => () => void;
}

/** Exact immutable Bundle bytes stored under their verified semantic revision. */
export interface RuntimeBundleStorageEntry {
  /** Verified DESEN Bundle revision that addresses the byte sequence. */
  readonly revision: string;
  /** Exact UTF-8 Bundle bytes; both caller and adapter must retain independent copies. */
  readonly bytes: Readonly<Uint8Array>;
}

/** Controlled result of reading immutable Bundle bytes by revision. */
export type RuntimeBundleStorageReadResult =
  Readonly<{ status: "found"; entry: RuntimeBundleStorageEntry }> | Readonly<{ status: "missing" }>;

/** Controlled result of storing immutable Bundle bytes. */
export type RuntimeBundleStoragePutResult =
  | Readonly<{ status: "stored" }>
  | Readonly<{ status: "unchanged" }>
  | Readonly<{ status: "conflict" }>;

/**
 * Durable active-revision record committed as one indivisible value.
 *
 * @remarks `previousGoodRevision` and `activeRevision` are never written separately. `generation`
 * is the repository's compare-and-swap profile guard, not a field added to the frozen Bundle.
 */
export interface RuntimeActivationRecord {
  /** Revision currently authorized for production materialization. */
  readonly activeRevision: string;
  /** Prior compatible revision retained for last-known-good recovery, when one exists. */
  readonly previousGoodRevision: string | null;
  /** Non-negative generation advanced by each successful atomic commit. */
  readonly generation: number;
}

/** Controlled result of reading the one durable activation record. */
export type RuntimeActivationReadResult =
  Readonly<{ status: "found"; record: RuntimeActivationRecord }> | Readonly<{ status: "missing" }>;

/** Atomic activation transition requested from host-owned persistence. */
export interface RuntimeActivationCommitRequest {
  /** Generation observed by staging, or `null` when no activation record may exist. */
  readonly expectedGeneration: number | null;
  /** Next active revision already verified and durably stored as immutable Bundle bytes. */
  readonly activeRevision: string;
  /** Previous compatible revision committed in the same transaction. */
  readonly previousGoodRevision: string | null;
}

/** Controlled result of an atomic activation compare-and-swap. */
export type RuntimeActivationCommitResult =
  | Readonly<{ status: "committed"; record: RuntimeActivationRecord }>
  | Readonly<{ status: "conflict"; generation: number | null }>;

/**
 * Host-owned immutable Bundle and atomic activation persistence boundary.
 *
 * @remarks Bundle writes are content-addressed: `unchanged` means the same revision already owns
 * the same bytes, while `conflict` means an implementation observed different bytes under that
 * revision and must not overwrite them. Activation uses one compare-and-swap record. M07 owns the
 * implementation, byte verification, staging, fault injection, restart recovery, and exact
 * transition rules. DESEN 0.1.0 does not standardize user-input persistence, so this port cannot
 * store arbitrary surface state or accept design-selected keys.
 */
export interface RuntimeStoragePort {
  /** Reads exact immutable Bundle bytes by verified revision. */
  readonly getBundle: (
    this: void,
    revision: string,
  ) => RuntimeAwaitable<RuntimeBundleStorageReadResult>;
  /** Stores exact Bundle bytes without ever replacing different bytes under the same revision. */
  readonly putBundle: (
    this: void,
    entry: RuntimeBundleStorageEntry,
  ) => RuntimeAwaitable<RuntimeBundleStoragePutResult>;
  /** Reads the complete active/previous-good/generation record. */
  readonly readActivation: (this: void) => RuntimeAwaitable<RuntimeActivationReadResult>;
  /** Atomically commits active and previous-good revisions under a generation guard. */
  readonly commitActivation: (
    this: void,
    request: RuntimeActivationCommitRequest,
  ) => RuntimeAwaitable<RuntimeActivationCommitResult>;
}

/**
 * Deterministic time source supplied by the host.
 *
 * @remarks Values are Unix-epoch milliseconds. The consuming runtime must reject non-finite,
 * negative, or decreasing observations where its operation requires monotonic progress. Scheduling
 * and timeout policy are deliberately not introduced by M04-T01.
 */
export interface RuntimeClockPort {
  /** Returns the host's current Unix-epoch time in milliseconds without reading a platform global. */
  readonly now: (this: void) => number;
}

/**
 * Safe diagnostic sink owned by the host.
 *
 * @remarks Diagnostics are already portable inert data. The sink receives no `Error`, stack,
 * cause, provider response, credential, or arbitrary details object. Reporting must not decide
 * whether a runtime transition succeeds.
 */
export interface RuntimeDiagnosticsPort {
  /** Reports one core or documented namespaced diagnostic to host observability. */
  readonly report: (this: void, diagnostic: Readonly<DesenDiagnostic<string>>) => void;
}

/**
 * Framework-neutral host boundary defined by the M04-T01 runtime integration slice.
 *
 * @remarks Host implementations are trusted application code and remain outside every Source,
 * Bundle, Catalog, fixture, trace, and render plan. Empty context and environment providers are
 * still explicit so no platform global becomes an accidental fallback.
 */
export interface RuntimeHostPorts {
  /** DESEN-managed local navigation integration. */
  readonly navigation: RuntimeNavigationPort;
  /** Host-owned versioned runtime persistence. */
  readonly storage: RuntimeStoragePort;
  /** Trusted operation implementation dispatch. */
  readonly operations: RuntimeOperationPort;
  /** Trusted resource implementation dispatch. */
  readonly resources: RuntimeResourcePort;
  /** Host-owned target token resolution. */
  readonly tokens: RuntimeTokenPort;
  /** Profile-defined non-secret application context. */
  readonly context: RuntimeContextPort;
  /** Reserved and profile-defined runtime environment. */
  readonly environment: RuntimeEnvironmentPort;
  /** Injected deterministic time source. */
  readonly clock: RuntimeClockPort;
  /** Portable diagnostic observation sink. */
  readonly diagnostics: RuntimeDiagnosticsPort;
}

const PORT_METHODS = Object.freeze({
  navigation: Object.freeze(["navigate"]),
  storage: Object.freeze(["getBundle", "putBundle", "readActivation", "commitActivation"]),
  operations: Object.freeze(["invoke"]),
  resources: Object.freeze(["load"]),
  tokens: Object.freeze(["resolve"]),
  context: Object.freeze(["getSnapshot", "subscribe"]),
  environment: Object.freeze(["getSnapshot", "subscribe"]),
  clock: Object.freeze(["now"]),
  diagnostics: Object.freeze(["report"]),
} as const);

type RuntimeHostPortName = keyof typeof PORT_METHODS;

function fail(path: string, message: string): never {
  throw new TypeError(`Invalid runtime host ports at ${path}: ${message}`);
}

function ownDataValue(object: object, key: PropertyKey, path: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(object, key);
  } catch {
    return fail(path, "property descriptor could not be read safely");
  }
  if (descriptor === undefined) return fail(path, "required own property is missing");
  if (!("value" in descriptor)) return fail(path, "required property must be a data property");
  return descriptor.value;
}

function assertObject(value: unknown, path: string): asserts value is object {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "expected an object");
  }
}

function assertExactPortNames(input: object): void {
  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(input);
    symbols = Object.getOwnPropertySymbols(input);
  } catch {
    return fail("/", "own keys could not be read safely");
  }

  const expected = Object.keys(PORT_METHODS);
  if (
    symbols.length > 0 ||
    names.length !== expected.length ||
    expected.some((name) => !names.includes(name))
  ) {
    fail("/", `expected exactly ${expected.join(", ")}`);
  }
}

function capturePort(
  input: object,
  portName: RuntimeHostPortName,
): Readonly<Record<string, unknown>> {
  const portPath = `/${portName}`;
  const port = ownDataValue(input, portName, portPath);
  assertObject(port, portPath);

  const captured: Record<string, unknown> = {};
  for (const methodName of PORT_METHODS[portName]) {
    const methodPath = `${portPath}/${methodName}`;
    const method = ownDataValue(port, methodName, methodPath);
    if (typeof method !== "function") fail(methodPath, "expected a function");
    captured[methodName] = method;
  }
  return Object.freeze(captured);
}

/**
 * Captures one stable, immutable aggregate of trusted host callbacks.
 *
 * @remarks Required callbacks must be own data properties, preventing accessors or inherited
 * prototype changes from altering the boundary after composition. The function never invokes a
 * callback and never freezes or mutates caller-owned port objects. It snapshots only the required
 * callback identities, so host adapters must provide receiver-independent or pre-bound functions
 * matching the explicit `this: void` contract. Later runtime tasks own request construction,
 * settlement validation, exception containment, and effect execution.
 *
 * @throws TypeError when the aggregate has missing, extra, inherited, accessor-backed, or
 * non-function required entries, or when reflection cannot safely inspect the supplied value.
 */
export function createRuntimeHostPorts(input: RuntimeHostPorts): RuntimeHostPorts {
  assertObject(input, "/");
  assertExactPortNames(input);

  return Object.freeze({
    navigation: capturePort(input, "navigation"),
    storage: capturePort(input, "storage"),
    operations: capturePort(input, "operations"),
    resources: capturePort(input, "resources"),
    tokens: capturePort(input, "tokens"),
    context: capturePort(input, "context"),
    environment: capturePort(input, "environment"),
    clock: capturePort(input, "clock"),
    diagnostics: capturePort(input, "diagnostics"),
  }) as unknown as RuntimeHostPorts;
}
