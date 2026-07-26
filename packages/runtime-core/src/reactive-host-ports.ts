/* eslint-disable @typescript-eslint/no-invalid-void-type -- The host boundary deliberately
 * requires receiver-independent callbacks through TypeScript's explicit `this: void` contract. */
import { createRuntimeHostPorts } from "./host-ports.js";
import { snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";

import type {
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeOperationRequest,
  RuntimeResourceRequest,
} from "./host-ports.js";

declare const RUNTIME_REACTIVE_HOST_PORTS_TYPE_BRAND: unique symbol;

type SettlementCallback<Request> = (
  this: void,
  request: Request,
) => RuntimeHostCallResult | PromiseLike<RuntimeHostCallResult>;

interface OwnDataRead {
  readonly valid: boolean;
  readonly present: boolean;
  readonly value?: unknown;
}

/**
 * Captured host aggregate whose resource and operation settlements cross the M04-T15 stale-safe
 * boundary before any lifecycle manager can observe them.
 *
 * @remarks The compile-time marker is paired with private `WeakSet` authority. A structural cast
 * cannot make an arbitrary host aggregate eligible for reactive composition.
 */
export interface RuntimeReactiveHostPorts extends RuntimeHostPorts {
  readonly [RUNTIME_REACTIVE_HOST_PORTS_TYPE_BRAND]: true;
}

const REACTIVE_HOST_PORTS = new WeakSet<object>();

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
  if (typeof value !== "object" || value === null) return false;
  try {
    if (Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
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

function sanitizeSettlement(candidate: unknown): RuntimeHostCallResult | undefined {
  if (!isPlainRecord(candidate)) return undefined;

  const status = ownDataValue(candidate, "status");
  if (!status.valid || !status.present || typeof status.value !== "string") return undefined;

  if (status.value === "denied") {
    return hasExactOwnKeys(candidate, ["status"]) ? Object.freeze({ status: "denied" }) : undefined;
  }

  if (status.value === "failed") {
    if (!hasExactOwnKeys(candidate, ["status", "errorCode"])) return undefined;
    const errorCode = ownDataValue(candidate, "errorCode");
    if (!errorCode.valid || !errorCode.present) return undefined;
    const detached = snapshotRuntimeJsonValue(errorCode.value);
    return typeof detached === "string"
      ? Object.freeze({ status: "failed", errorCode: detached })
      : undefined;
  }

  if (status.value === "succeeded") {
    if (!hasExactOwnKeys(candidate, ["status", "value"])) return undefined;
    const value = ownDataValue(candidate, "value");
    if (!value.valid || !value.present) return undefined;
    const detached = snapshotRuntimeJsonValue(value.value);
    return detached === undefined
      ? undefined
      : Object.freeze({ status: "succeeded", value: detached });
  }

  return undefined;
}

function sanitizedSettlement<Request>(
  callback: SettlementCallback<Request>,
  request: Request,
): Promise<RuntimeHostCallResult> {
  let candidate: RuntimeHostCallResult | PromiseLike<RuntimeHostCallResult>;
  try {
    candidate = Reflect.apply(callback, undefined, [request]);
  } catch {
    return Promise.reject();
  }

  return Promise.resolve(candidate).then(
    (settlement) => {
      try {
        const sanitized = sanitizeSettlement(settlement);
        return sanitized === undefined ? Promise.reject() : sanitized;
      } catch {
        return Promise.reject();
      }
    },
    () => Promise.reject(),
  );
}

/**
 * Captures host ports and inserts a detached settlement boundary before resource and operation
 * lifecycle managers observe host results.
 *
 * @remarks The wrapper is intended to be created before M04 resource and operation managers are
 * mounted. It preserves every non-settlement callback by identity, invokes each settlement
 * callback receiver-independently exactly once, adopts synchronous and promise-like results into
 * a native Promise, and exposes only an exact recursively immutable {@link RuntimeHostCallResult}.
 *
 * Host throws, rejections, accessors, reflection failures, malformed envelopes, cycles, and
 * values outside the shared runtime JSON limit become a rejection with no retained reason. A
 * hostile getter or Proxy may reenter while this boundary is copying a result, but the older
 * result cannot reach a lifecycle manager until copying finishes. The manager's existing current
 * attempt check therefore observes any replacement created by that reentry before it considers
 * the now-inert result.
 *
 * The function never freezes or mutates caller-owned requests, results, promises, or port
 * objects. It introduces no timer, cancellation primitive, framework value, or platform global.
 * A trusted composition root must pass this exact aggregate to the resource and operation
 * managers it later joins; those earlier public managers intentionally do not reveal their
 * captured host-port identity. M04-T16 owns proof of that complete authenticated composition.
 *
 * @throws TypeError when {@link createRuntimeHostPorts} rejects the original aggregate.
 */
export function createRuntimeReactiveHostPorts(input: RuntimeHostPorts): RuntimeReactiveHostPorts {
  const captured = createRuntimeHostPorts(input);
  const invoke = captured.operations.invoke;
  const load = captured.resources.load;

  const operations = Object.freeze({
    invoke: (request: RuntimeOperationRequest) => sanitizedSettlement(invoke, request),
  });
  const resources = Object.freeze({
    load: (request: RuntimeResourceRequest) => sanitizedSettlement(load, request),
  });

  const reactive = Object.freeze({
    navigation: captured.navigation,
    storage: captured.storage,
    operations,
    resources,
    tokens: captured.tokens,
    context: captured.context,
    environment: captured.environment,
    clock: captured.clock,
    diagnostics: captured.diagnostics,
  });
  REACTIVE_HOST_PORTS.add(reactive);
  return reactive as unknown as RuntimeReactiveHostPorts;
}

/** Package-private authenticity check used by the reactive coordinator composition boundary. */
export function isRuntimeReactiveHostPorts(input: unknown): input is RuntimeReactiveHostPorts {
  return typeof input === "object" && input !== null && REACTIVE_HOST_PORTS.has(input);
}
