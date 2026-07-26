/* eslint-disable @typescript-eslint/no-invalid-void-type -- TypeScript's `this: void` is the
 * deliberate receiver-independent callback contract at this host boundary. */
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { RUNTIME_VALUE_SAFETY_LIMITS } from "./value-resolution.js";

import type { RuntimeJsonObject, RuntimeRequestContext } from "./host-ports.js";

declare const RUNTIME_COMMAND_EVENT_HOST_PORTS_TYPE_BRAND: unique symbol;

/** Detached command request addressed only by runtime-owned component identity. */
export interface RuntimeComponentCommandHostRequest {
  readonly context: RuntimeRequestContext;
  readonly sourceNodeId: string;
  readonly runtimeInstanceId: string;
  readonly capabilityId: string;
  readonly command: string;
  readonly input: RuntimeJsonObject;
}

/** Detached application-shell event request bound to one allowlisted host contract. */
export interface RuntimeHostEventRequest {
  readonly context: RuntimeRequestContext;
  readonly name: string;
  readonly contractId: string;
  readonly payload: RuntimeJsonObject;
}

/** Closed synchronous outcome for a prevalidated component command. */
export type RuntimeComponentCommandHostResult =
  Readonly<{ readonly status: "succeeded" }> | Readonly<{ readonly status: "denied" }>;

/** Closed synchronous outcome for host-profile payload contract validation. */
export type RuntimeHostEventValidationResult =
  Readonly<{ readonly status: "valid" }> | Readonly<{ readonly status: "invalid" }>;

/** Closed synchronous outcome for an allowlisted, contract-valid host event. */
export type RuntimeHostEventEmissionResult =
  Readonly<{ readonly status: "succeeded" }> | Readonly<{ readonly status: "denied" }>;

/** Host-owned generic component-command dispatcher. */
export interface RuntimeComponentCommandHostPort {
  readonly invoke: (
    this: void,
    request: RuntimeComponentCommandHostRequest,
  ) => RuntimeComponentCommandHostResult;
}

/** Host-owned application-shell event contract and emission boundary. */
export interface RuntimeHostEventPort {
  readonly validate: (
    this: void,
    request: RuntimeHostEventRequest,
  ) => RuntimeHostEventValidationResult;
  readonly emit: (this: void, request: RuntimeHostEventRequest) => RuntimeHostEventEmissionResult;
}

/** Caller-owned callbacks captured by the command/event port factory. */
export interface RuntimeCommandEventHostPortsInput {
  readonly commands: RuntimeComponentCommandHostPort;
  readonly events: RuntimeHostEventPort;
}

/** Opaque receiver-independent synchronous command/event host boundary. */
export interface RuntimeCommandEventHostPorts {
  readonly [RUNTIME_COMMAND_EVENT_HOST_PORTS_TYPE_BRAND]: true;
}

/** Controlled package-internal command call outcome. */
export type RuntimeComponentCommandPortCallResult =
  | RuntimeComponentCommandHostResult
  | Readonly<{ readonly status: "adapter-failed" }>
  | Readonly<{ readonly status: "invalid-ports" }>;

/** Controlled package-internal event validation call outcome. */
export type RuntimeHostEventValidationCallResult =
  | RuntimeHostEventValidationResult
  | Readonly<{ readonly status: "adapter-failed" }>
  | Readonly<{ readonly status: "invalid-ports" }>;

/** Controlled package-internal event emission call outcome. */
export type RuntimeHostEventEmissionCallResult =
  | RuntimeHostEventEmissionResult
  | Readonly<{ readonly status: "adapter-failed" }>
  | Readonly<{ readonly status: "invalid-ports" }>;

interface RuntimeCommandEventHostPortsAuthority {
  readonly invokeCommand: RuntimeComponentCommandHostPort["invoke"];
  readonly validateEvent: RuntimeHostEventPort["validate"];
  readonly emitEvent: RuntimeHostEventPort["emit"];
}

const PORT_AUTHORITIES = new WeakMap<object, RuntimeCommandEventHostPortsAuthority>();

/** @internal Probes only factory authority and never invokes a host callback. */
export function isRuntimeCommandEventHostPorts(ports: RuntimeCommandEventHostPorts): boolean {
  return typeof ports === "object" && ports !== null && PORT_AUTHORITIES.has(ports);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownDataValue(object: object, key: string): unknown | undefined {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor !== undefined && "value" in descriptor && descriptor.enumerable
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function exactKeys(object: object, required: readonly string[]): boolean {
  try {
    const keys = Reflect.ownKeys(object);
    return (
      keys.length === required.length &&
      keys.every((key) => typeof key === "string" && required.includes(key)) &&
      required.every((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
      })
    );
  } catch {
    return false;
  }
}

function captureExactDataRecord(
  input: unknown,
  required: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (!isPlainRecord(input)) return undefined;
  const values = Object.create(null) as Record<string, unknown>;
  try {
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== required.length ||
      keys.some((key) => typeof key !== "string" || !required.includes(key))
    ) {
      return undefined;
    }
    for (const key of required) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      values[key] = descriptor.value;
    }
  } catch {
    return undefined;
  }
  return Object.freeze(values);
}

function captureCallback(
  input: unknown,
  key: string,
): ((this: void, request: never) => unknown) | undefined {
  if (!isPlainRecord(input) || !exactKeys(input, [key])) return undefined;
  const callback = ownDataValue(input, key);
  return typeof callback === "function"
    ? (callback as (this: void, request: never) => unknown)
    : undefined;
}

function closedStatus<Value extends string>(
  input: unknown,
  allowed: readonly Value[],
): Value | undefined {
  if (!isPlainRecord(input) || !exactKeys(input, ["status"])) return undefined;
  const status = ownDataValue(input, "status");
  return typeof status === "string" && allowed.includes(status as Value)
    ? (status as Value)
    : undefined;
}

function capturedRequestContext(input: unknown): RuntimeRequestContext | undefined {
  const captured = captureExactDataRecord(input, [
    "documentId",
    "requestId",
    "revision",
    "surfaceId",
  ]);
  if (captured === undefined) return undefined;
  const documentId = capturedJsonString(captured.documentId);
  const requestId = capturedJsonString(captured.requestId);
  const revision = capturedJsonString(captured.revision);
  const surfaceId = capturedJsonString(captured.surfaceId);
  if (
    documentId === undefined ||
    requestId === undefined ||
    revision === undefined ||
    surfaceId === undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    documentId,
    requestId,
    revision,
    surfaceId,
  });
}

function capturedJsonString(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  if (input.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits) return undefined;
  for (let index = 0; index < input.length; index += 1) {
    const unit = input.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= input.length) return undefined;
      const next = input.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return undefined;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return undefined;
    }
  }
  return input;
}

function capturedCommandRequest(
  input: RuntimeComponentCommandHostRequest,
): RuntimeComponentCommandHostRequest | undefined {
  const captured = captureExactDataRecord(input, [
    "capabilityId",
    "command",
    "context",
    "input",
    "runtimeInstanceId",
    "sourceNodeId",
  ]);
  if (captured === undefined) return undefined;
  const context = capturedRequestContext(captured.context);
  const sourceNodeId = capturedJsonString(captured.sourceNodeId);
  const runtimeInstanceId = capturedJsonString(captured.runtimeInstanceId);
  const capabilityId = capturedJsonString(captured.capabilityId);
  const command = capturedJsonString(captured.command);
  const detachedInput = snapshotRuntimeJsonValue(captured.input);
  return context === undefined ||
    sourceNodeId === undefined ||
    runtimeInstanceId === undefined ||
    capabilityId === undefined ||
    command === undefined ||
    !isRuntimeJsonObject(detachedInput)
    ? undefined
    : Object.freeze({
        context,
        sourceNodeId,
        runtimeInstanceId,
        capabilityId,
        command,
        input: detachedInput,
      });
}

function capturedEventRequest(input: RuntimeHostEventRequest): RuntimeHostEventRequest | undefined {
  const captured = captureExactDataRecord(input, ["context", "contractId", "name", "payload"]);
  if (captured === undefined) return undefined;
  const context = capturedRequestContext(captured.context);
  const name = capturedJsonString(captured.name);
  const contractId = capturedJsonString(captured.contractId);
  const payload = snapshotRuntimeJsonValue(captured.payload);
  return context === undefined ||
    name === undefined ||
    contractId === undefined ||
    !isRuntimeJsonObject(payload)
    ? undefined
    : Object.freeze({
        context,
        name,
        contractId,
        payload,
      });
}

/**
 * Captures exact synchronous receiver-independent command and application-event callbacks.
 *
 * @throws {TypeError} When the input is not the exact closed data-and-function shape.
 */
export function createRuntimeCommandEventHostPorts(
  input: RuntimeCommandEventHostPortsInput,
): RuntimeCommandEventHostPorts {
  if (!isPlainRecord(input) || !exactKeys(input, ["commands", "events"])) {
    throw new TypeError("Invalid command/event host ports.");
  }
  const commands = ownDataValue(input, "commands");
  const events = ownDataValue(input, "events");
  const invokeCommand = captureCallback(commands, "invoke");
  if (!isPlainRecord(events) || !exactKeys(events, ["emit", "validate"])) {
    throw new TypeError("Invalid command/event host ports.");
  }
  const validateEvent = ownDataValue(events, "validate");
  const emitEvent = ownDataValue(events, "emit");
  if (
    invokeCommand === undefined ||
    typeof validateEvent !== "function" ||
    typeof emitEvent !== "function"
  ) {
    throw new TypeError("Invalid command/event host ports.");
  }
  const handle = Object.freeze({}) as RuntimeCommandEventHostPorts;
  PORT_AUTHORITIES.set(handle, {
    invokeCommand: invokeCommand as RuntimeComponentCommandHostPort["invoke"],
    validateEvent: validateEvent as RuntimeHostEventPort["validate"],
    emitEvent: emitEvent as RuntimeHostEventPort["emit"],
  });
  return handle;
}

/** @internal Invokes one detached command through the normalized synchronous boundary. */
export function invokeRuntimeComponentCommandHostPort(
  ports: RuntimeCommandEventHostPorts,
  request: RuntimeComponentCommandHostRequest,
): RuntimeComponentCommandPortCallResult {
  const authority =
    typeof ports === "object" && ports !== null ? PORT_AUTHORITIES.get(ports) : undefined;
  if (authority === undefined) return Object.freeze({ status: "invalid-ports" });
  const captured = capturedCommandRequest(request);
  if (captured === undefined) return Object.freeze({ status: "adapter-failed" });
  let raw: unknown;
  try {
    raw = Reflect.apply(authority.invokeCommand, undefined, [captured]);
  } catch {
    return Object.freeze({ status: "adapter-failed" });
  }
  const status = closedStatus(raw, ["succeeded", "denied"]);
  return status === undefined
    ? Object.freeze({ status: "adapter-failed" })
    : Object.freeze({ status });
}

/** @internal Validates one detached event against its exact host-profile contract. */
export function validateRuntimeHostEventHostPort(
  ports: RuntimeCommandEventHostPorts,
  request: RuntimeHostEventRequest,
): RuntimeHostEventValidationCallResult {
  const authority =
    typeof ports === "object" && ports !== null ? PORT_AUTHORITIES.get(ports) : undefined;
  if (authority === undefined) return Object.freeze({ status: "invalid-ports" });
  const captured = capturedEventRequest(request);
  if (captured === undefined) return Object.freeze({ status: "adapter-failed" });
  let raw: unknown;
  try {
    raw = Reflect.apply(authority.validateEvent, undefined, [captured]);
  } catch {
    return Object.freeze({ status: "adapter-failed" });
  }
  const status = closedStatus(raw, ["valid", "invalid"]);
  return status === undefined
    ? Object.freeze({ status: "adapter-failed" })
    : Object.freeze({ status });
}

/** @internal Emits one detached event only after its host-profile contract accepted it. */
export function emitRuntimeHostEventHostPort(
  ports: RuntimeCommandEventHostPorts,
  request: RuntimeHostEventRequest,
): RuntimeHostEventEmissionCallResult {
  const authority =
    typeof ports === "object" && ports !== null ? PORT_AUTHORITIES.get(ports) : undefined;
  if (authority === undefined) return Object.freeze({ status: "invalid-ports" });
  const captured = capturedEventRequest(request);
  if (captured === undefined) return Object.freeze({ status: "adapter-failed" });
  let raw: unknown;
  try {
    raw = Reflect.apply(authority.emitEvent, undefined, [captured]);
  } catch {
    return Object.freeze({ status: "adapter-failed" });
  }
  const status = closedStatus(raw, ["succeeded", "denied"]);
  return status === undefined
    ? Object.freeze({ status: "adapter-failed" })
    : Object.freeze({ status });
}
