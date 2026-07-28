/* eslint-disable @typescript-eslint/no-invalid-void-type -- `this: void` is the deliberate
 * receiver-independent callback contract at the browser platform boundary. */
import type {
  RuntimeClockPort,
  RuntimeEnvironmentPort,
  RuntimeJsonObject,
  RuntimeJsonValue,
} from "@desen/runtime-core";

declare const RUNTIME_WEB_BROWSER_PLATFORM_HANDLE_BRAND: unique symbol;

const EMPTY_ENVIRONMENT = Object.freeze({}) as RuntimeJsonObject;
const MAX_ENVIRONMENT_DEPTH = 32;
const MAX_ENVIRONMENT_NODES = 65_536;
const MAX_ENVIRONMENT_STRING_CODE_UNITS = 1_048_576;
const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);

/** Trusted browser callbacks captured by {@link createRuntimeWebBrowserPlatform}. */
export interface RuntimeWebBrowserPlatformCreateInput {
  /**
   * Browser-owned environment observation and invalidation callbacks.
   *
   * @remarks The snapshot may use the protocol-reserved environment paths and additional
   * profile-defined JSON paths. This package does not invent environment enums.
   */
  readonly environment: RuntimeEnvironmentPort;
  /** Browser-owned Unix-epoch millisecond observation. */
  readonly clock: RuntimeClockPort;
}

/** Opaque factory-authenticated browser platform authority. */
export interface RuntimeWebBrowserPlatformHandle {
  readonly [RUNTIME_WEB_BROWSER_PLATFORM_HANDLE_BRAND]: true;
}

/** Controlled browser-platform construction result. */
export type RuntimeWebBrowserPlatformCreateResult =
  | Readonly<{
      readonly status: "created";
      readonly handle: RuntimeWebBrowserPlatformHandle;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason: "malformed-input";
    }>;

/** @internal Captured browser callbacks available only to authenticated runtime-web composition. */
export interface RuntimeWebBrowserPlatformAuthority {
  readonly getEnvironmentSnapshot: RuntimeEnvironmentPort["getSnapshot"];
  readonly subscribeEnvironment: RuntimeEnvironmentPort["subscribe"];
  readonly now: RuntimeClockPort["now"];
}

const BROWSER_PLATFORM_AUTHORITIES = new WeakMap<
  RuntimeWebBrowserPlatformHandle,
  RuntimeWebBrowserPlatformAuthority
>();

interface OwnDataRead {
  readonly valid: boolean;
  readonly present: boolean;
  readonly value?: unknown;
}

interface JsonSnapshotVisit {
  readonly kind: "visit";
  readonly source: unknown;
  readonly depth: number;
  readonly assign: (value: RuntimeJsonValue) => void;
}

interface JsonSnapshotLeave {
  readonly kind: "leave";
  readonly source: object;
}

type JsonSnapshotWork = JsonSnapshotLeave | JsonSnapshotVisit;

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

function capturedMethod(
  owner: object,
  key: string,
): ((this: void, ...arguments_: never[]) => unknown) | undefined {
  const method = ownDataValue(owner, key);
  return method.valid && method.present && typeof method.value === "function"
    ? (method.value as (this: void, ...arguments_: never[]) => unknown)
    : undefined;
}

function enumerableDataValue(
  owner: object,
  key: PropertyKey,
): { readonly valid: true; readonly value: unknown } | { readonly valid: false } {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
      ? { valid: true, value: descriptor.value }
      : { valid: false };
  } catch {
    return { valid: false };
  }
}

function isJsonObjectPrototype(value: object): boolean {
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

function freezeJsonSnapshot(value: RuntimeJsonValue): RuntimeJsonValue {
  const pending: RuntimeJsonValue[] = [value];
  const containers: (RuntimeJsonObject | readonly RuntimeJsonValue[])[] = [];
  while (pending.length > 0) {
    const current = pending.pop() as RuntimeJsonValue;
    if (typeof current !== "object" || current === null) continue;
    containers.push(current);
    pending.push(...(Array.isArray(current) ? current : Object.values(current)));
  }
  for (let index = containers.length - 1; index >= 0; index -= 1) {
    Object.freeze(containers[index]);
  }
  return value;
}

/**
 * Copies one browser environment observation into bounded inert JSON.
 *
 * @remarks The copier rejects accessors, symbols, sparse arrays, exotic prototypes, cycles,
 * non-finite numbers, and reflection-hostile proxies without exposing their failures.
 */
export function snapshotRuntimeWebEnvironment(input: unknown): RuntimeJsonObject | undefined {
  const root: { value?: RuntimeJsonValue } = {};
  const activeContainers = new WeakSet<object>();
  const pending: JsonSnapshotWork[] = [
    {
      kind: "visit",
      source: input,
      depth: 0,
      assign(value) {
        root.value = value;
      },
    },
  ];
  let discoveredNodes = 1;
  let stringCodeUnits = 0;

  try {
    while (pending.length > 0) {
      const work = pending.pop() as JsonSnapshotWork;
      if (work.kind === "leave") {
        activeContainers.delete(work.source);
        continue;
      }
      if (work.depth > MAX_ENVIRONMENT_DEPTH) return undefined;

      const { source } = work;
      if (source === null || typeof source === "boolean") {
        work.assign(source);
        continue;
      }
      if (typeof source === "number") {
        if (!Number.isFinite(source)) return undefined;
        work.assign(source);
        continue;
      }
      if (typeof source === "string") {
        stringCodeUnits += source.length;
        if (stringCodeUnits > MAX_ENVIRONMENT_STRING_CODE_UNITS) return undefined;
        work.assign(source);
        continue;
      }
      if (typeof source !== "object" || activeContainers.has(source)) return undefined;

      activeContainers.add(source);
      pending.push({ kind: "leave", source });

      if (Array.isArray(source)) {
        const length = ownDataValue(source, "length");
        if (
          !length.valid ||
          !length.present ||
          typeof length.value !== "number" ||
          !Number.isSafeInteger(length.value) ||
          length.value < 0 ||
          length.value > MAX_ENVIRONMENT_NODES - discoveredNodes ||
          (length.value > 0 && work.depth >= MAX_ENVIRONMENT_DEPTH)
        ) {
          return undefined;
        }
        const ownKeys = Reflect.ownKeys(source);
        if (
          ownKeys.length !== length.value + 1 ||
          ownKeys.some((key) => typeof key === "symbol") ||
          !ownKeys.includes("length")
        ) {
          return undefined;
        }
        discoveredNodes += length.value;
        const destination: RuntimeJsonValue[] = new Array<RuntimeJsonValue>(length.value);
        work.assign(destination);
        for (let index = length.value - 1; index >= 0; index -= 1) {
          const element = enumerableDataValue(source, String(index));
          if (!element.valid) return undefined;
          pending.push({
            kind: "visit",
            source: element.value,
            depth: work.depth + 1,
            assign(value) {
              destination[index] = value;
            },
          });
        }
        continue;
      }

      if (!isJsonObjectPrototype(source)) return undefined;
      const ownKeys = Reflect.ownKeys(source);
      if (
        ownKeys.length > MAX_ENVIRONMENT_NODES - discoveredNodes ||
        (ownKeys.length > 0 && work.depth >= MAX_ENVIRONMENT_DEPTH) ||
        ownKeys.some((key) => typeof key === "symbol")
      ) {
        return undefined;
      }
      discoveredNodes += ownKeys.length;
      const keys = (ownKeys as string[]).sort();
      const destination = Object.create(null) as Record<string, RuntimeJsonValue>;
      work.assign(destination);
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index] as string;
        stringCodeUnits += key.length;
        if (stringCodeUnits > MAX_ENVIRONMENT_STRING_CODE_UNITS) return undefined;
        const property = enumerableDataValue(source, key);
        if (!property.valid) return undefined;
        pending.push({
          kind: "visit",
          source: property.value,
          depth: work.depth + 1,
          assign(value) {
            destination[key] = value;
          },
        });
      }
    }
  } catch {
    return undefined;
  }

  const snapshot = root.value;
  return snapshot !== undefined && typeof snapshot === "object" && snapshot !== null
    ? (freezeJsonSnapshot(snapshot) as RuntimeJsonObject)
    : undefined;
}

/**
 * Captures browser-owned environment and epoch-clock callbacks without invoking them.
 *
 * @remarks The input, both nested ports, and every callback must be exact own data. This factory
 * neither reads an environment snapshot nor samples time, so composition has no browser effect.
 */
export function createRuntimeWebBrowserPlatform(
  input: RuntimeWebBrowserPlatformCreateInput,
): RuntimeWebBrowserPlatformCreateResult {
  if (!isPlainRecord(input) || !hasExactOwnKeys(input, ["environment", "clock"])) {
    return Object.freeze({ status: "rejected", reason: "malformed-input" });
  }

  const environment = ownDataValue(input, "environment");
  const clock = ownDataValue(input, "clock");
  if (
    !environment.valid ||
    !environment.present ||
    !isPlainRecord(environment.value) ||
    !hasExactOwnKeys(environment.value, ["getSnapshot", "subscribe"]) ||
    !clock.valid ||
    !clock.present ||
    !isPlainRecord(clock.value) ||
    !hasExactOwnKeys(clock.value, ["now"])
  ) {
    return Object.freeze({ status: "rejected", reason: "malformed-input" });
  }

  const getEnvironmentSnapshot = capturedMethod(environment.value, "getSnapshot");
  const subscribeEnvironment = capturedMethod(environment.value, "subscribe");
  const now = capturedMethod(clock.value, "now");
  if (
    getEnvironmentSnapshot === undefined ||
    subscribeEnvironment === undefined ||
    now === undefined
  ) {
    return Object.freeze({ status: "rejected", reason: "malformed-input" });
  }

  const handle = Object.freeze({}) as RuntimeWebBrowserPlatformHandle;
  BROWSER_PLATFORM_AUTHORITIES.set(
    handle,
    Object.freeze({
      getEnvironmentSnapshot: getEnvironmentSnapshot as RuntimeEnvironmentPort["getSnapshot"],
      subscribeEnvironment: subscribeEnvironment as RuntimeEnvironmentPort["subscribe"],
      now: now as RuntimeClockPort["now"],
    }),
  );
  return Object.freeze({ status: "created", handle });
}

/** @internal Authenticates one browser platform handle without reflecting over caller data. */
export function readRuntimeWebBrowserPlatformAuthority(
  handle: RuntimeWebBrowserPlatformHandle,
): RuntimeWebBrowserPlatformAuthority | undefined {
  return typeof handle === "object" && handle !== null
    ? BROWSER_PLATFORM_AUTHORITIES.get(handle)
    : undefined;
}

/** @internal Shared immutable fallback used before the first valid browser observation. */
export function emptyRuntimeWebEnvironment(): RuntimeJsonObject {
  return EMPTY_ENVIRONMENT;
}
