import { canonicalizeJson } from "@desen/protocol";

import type { RegisteredOperation, RegisteredResource } from "@desen/catalog-sdk";

/** Recursively immutable inert JSON accepted as synthetic fixture data. */
export type SyntheticFixtureValue =
  | string
  | number
  | boolean
  | null
  | readonly SyntheticFixtureValue[]
  | { readonly [key: string]: SyntheticFixtureValue };

/**
 * The only execution context represented by this fixture infrastructure.
 *
 * @remarks The singleton deliberately has no production or integration alternative. Host
 * implementations, endpoints, credentials, and authorization remain outside `@desen/testkit`.
 */
export const SYNTHETIC_FIXTURE_CONTEXT = Object.freeze({
  kind: "synthetic-authoring-fixture",
  source: "manifest.authoring.fixtures",
} as const);

/** Explicit context required when deriving a synthetic fixture snapshot. */
export type SyntheticFixtureContext = typeof SYNTHETIC_FIXTURE_CONTEXT;

/** Exact public input accepted by {@link createSyntheticFixtureSnapshot}. */
export interface CreateSyntheticFixtureSnapshotInput {
  /** The fixed authoring-only context exported by this package. */
  readonly context: SyntheticFixtureContext;
  /** Public operation registrations whose manifest fixtures should be projected. */
  readonly operations: readonly RegisteredOperation[];
  /** Public resource registrations whose manifest fixtures should be projected. */
  readonly resources: readonly RegisteredResource[];
}

/** Authoring-only success and public-error fixtures for one operation capability. */
export interface SyntheticOperationFixtures {
  /** Synthetic operation output returned by the success path, when declared. */
  readonly success?: SyntheticFixtureValue;
  /** Synthetic public-error payloads keyed by a code declared in the operation manifest. */
  readonly errors?: Readonly<Record<string, SyntheticFixtureValue>>;
}

/** Detached immutable fixture projection for registered operation and resource capabilities. */
export interface SyntheticFixtureSnapshot {
  /** The fixed context recording the caller's authoring-only synthetic classification. */
  readonly context: SyntheticFixtureContext;
  /** Operation fixtures keyed by registered capability id. */
  readonly operations: Readonly<Record<string, SyntheticOperationFixtures>>;
  /** Named resource outputs keyed first by registered capability id and then fixture name. */
  readonly resources: Readonly<Record<string, Readonly<Record<string, SyntheticFixtureValue>>>>;
}

/** A deterministic lookup that never represents absence with `undefined`. */
export type SyntheticFixtureLookupResult =
  | Readonly<{
      /** The fixed authoring-only fixture context. */
      context: SyntheticFixtureContext;
      /** Discriminator for an available fixture value. */
      status: "found";
      /** A detached, recursively frozen fixture value. */
      value: SyntheticFixtureValue;
    }>
  | Readonly<{
      /** The fixed authoring-only fixture context. */
      context: SyntheticFixtureContext;
      /** Discriminator for an unavailable capability, path, or fixture value. */
      status: "missing";
    }>;

type ExactRegistrationArray<Input extends readonly unknown[], Shape> = {
  readonly [Key in keyof Input]: Key extends number | `${number}`
    ? Input[Key] extends Shape
      ? Input[Key] & Record<Exclude<keyof Input[Key], keyof Shape>, never>
      : never
    : Input[Key];
};

type ExactSnapshotInput<Input extends CreateSyntheticFixtureSnapshotInput> = Input &
  Record<Exclude<keyof Input, keyof CreateSyntheticFixtureSnapshotInput>, never> & {
    readonly operations: ExactRegistrationArray<Input["operations"], RegisteredOperation>;
    readonly resources: ExactRegistrationArray<Input["resources"], RegisteredResource>;
  };

type MutableJsonRecord = Record<string, unknown>;

const MAX_SYNTHETIC_FIXTURE_DEPTH = 64;
const MAX_SYNTHETIC_FIXTURE_NODES = 20_000;
const MAX_SYNTHETIC_FIXTURE_CANONICAL_BYTES = 1_048_576;
const CREATED_SYNTHETIC_FIXTURE_SNAPSHOTS = new WeakSet<object>();
const OPERATION_EFFECTS = new Set(["none", "local", "network", "external"]);
const RESOURCE_POLICIES = new Set(["mount", "manual", "once"]);
const HOST_BINDING_FIELDS = new Set([
  "binding",
  "endpoint",
  "execute",
  "handler",
  "implementation",
  "read",
]);

function fail(path: string, message: string): never {
  throw new TypeError(`Invalid synthetic fixture input at ${path}: ${message}`);
}

function assertRecord(value: unknown, path: string): asserts value is MutableJsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "expected an inert JSON object");
  }
}

function assertExactDataObject(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
): void {
  assertRecord(value, path);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) {
    fail(path, `expected only ${expectedKeys.join(", ")}`);
  }

  const actualKeys = keys as string[];
  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !actualKeys.includes(key))
  ) {
    fail(path, `expected only ${expectedKeys.join(", ")}`);
  }

  for (const key of actualKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(`${path}/${key}`, "expected an enumerable data property");
    }
  }
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    deepFreeze((value as MutableJsonRecord)[key]);
  }
  Object.freeze(value);
}

type PreflightFrame =
  | Readonly<{ kind: "enter"; value: unknown; depth: number; path: string }>
  | Readonly<{ kind: "leave"; value: object }>;

function childPath(parent: string, key: PropertyKey): string {
  const segment =
    typeof key === "symbol"
      ? key.toString()
      : String(key).replaceAll("~", "~0").replaceAll("/", "~1");
  return parent === "/" ? `/${segment}` : `${parent}/${segment}`;
}

/**
 * Bounds traversal before the recursive canonicalizer or freezer sees caller-owned data.
 *
 * The stack carries explicit leave frames so cycles fail without relying on the JavaScript call
 * stack. Shared acyclic values are traversed for every occurrence because canonical JSON repeats
 * them at every occurrence as well. Node slots are charged before enqueue, and raw string/key
 * bytes provide a conservative pre-canonicalization budget; the exact canonical byte check still
 * runs afterward because JSON escaping can only increase that size.
 */
function assertBoundedInertInput(value: unknown): void {
  const active = new WeakSet<object>();
  const pending: PreflightFrame[] = [{ kind: "enter", value, depth: 0, path: "/" }];
  let scheduledNodes = 1;
  let minimumCanonicalBytes = 0;
  let nodes = 0;

  while (pending.length > 0) {
    const frame = pending.pop();
    if (frame === undefined) break;
    if (frame.kind === "leave") {
      active.delete(frame.value);
      continue;
    }

    nodes += 1;
    if (nodes > MAX_SYNTHETIC_FIXTURE_NODES) {
      fail(frame.path, `exceeded the ${MAX_SYNTHETIC_FIXTURE_NODES}-node limit`);
    }
    if (frame.depth > MAX_SYNTHETIC_FIXTURE_DEPTH) {
      fail(frame.path, `exceeded the ${MAX_SYNTHETIC_FIXTURE_DEPTH}-level depth limit`);
    }
    if (typeof frame.value === "string") {
      minimumCanonicalBytes += utf8ByteLength(frame.value);
      if (minimumCanonicalBytes > MAX_SYNTHETIC_FIXTURE_CANONICAL_BYTES) {
        fail(
          frame.path,
          `exceeded the ${MAX_SYNTHETIC_FIXTURE_CANONICAL_BYTES}-byte canonical input limit`,
        );
      }
    }
    if (frame.value === null || typeof frame.value !== "object") continue;
    if (active.has(frame.value)) fail(frame.path, "cycles are not inert fixture data");

    active.add(frame.value);
    pending.push({ kind: "leave", value: frame.value });

    const isArray = Array.isArray(frame.value);
    if (isArray) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(frame.value, "length");
      if (
        lengthDescriptor === undefined ||
        !Object.hasOwn(lengthDescriptor, "value") ||
        typeof lengthDescriptor.value !== "number" ||
        lengthDescriptor.value > MAX_SYNTHETIC_FIXTURE_NODES
      ) {
        fail(frame.path, `exceeded the ${MAX_SYNTHETIC_FIXTURE_NODES}-node limit`);
      }
    }

    let keys: readonly PropertyKey[];
    try {
      keys = Reflect.ownKeys(frame.value);
    } catch {
      fail(frame.path, "could not inspect the fixture as inert data");
    }

    for (let keyIndex = keys.length - 1; keyIndex >= 0; keyIndex -= 1) {
      const key = keys[keyIndex];
      if (key === undefined || (isArray && key === "length")) continue;
      if (typeof key === "symbol") {
        fail(childPath(frame.path, key), "symbol properties are not inert fixture data");
      }
      if (!isArray) {
        minimumCanonicalBytes += utf8ByteLength(String(key));
        if (minimumCanonicalBytes > MAX_SYNTHETIC_FIXTURE_CANONICAL_BYTES) {
          fail(
            childPath(frame.path, key),
            `exceeded the ${MAX_SYNTHETIC_FIXTURE_CANONICAL_BYTES}-byte canonical input limit`,
          );
        }
      }

      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(frame.value, key);
      } catch {
        fail(childPath(frame.path, key), "could not inspect the fixture property safely");
      }
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !Object.hasOwn(descriptor, "value")
      ) {
        fail(childPath(frame.path, key), "expected an enumerable data property");
      }
      scheduledNodes += 1;
      if (scheduledNodes > MAX_SYNTHETIC_FIXTURE_NODES) {
        fail(childPath(frame.path, key), `exceeded the ${MAX_SYNTHETIC_FIXTURE_NODES}-node limit`);
      }
      pending.push({
        kind: "enter",
        value: descriptor.value,
        depth: frame.depth + 1,
        path: childPath(frame.path, key),
      });
    }
  }
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) bytes += 1;
    else if (codeUnit <= 0x7ff) bytes += 2;
    else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function createCanonicalSnapshot<Value>(value: Value): Value {
  assertBoundedInertInput(value);
  const canonical = canonicalizeJson(value);
  if (utf8ByteLength(canonical) > MAX_SYNTHETIC_FIXTURE_CANONICAL_BYTES) {
    fail("/", `exceeded the ${MAX_SYNTHETIC_FIXTURE_CANONICAL_BYTES}-byte canonical input limit`);
  }
  const snapshot = JSON.parse(canonical) as Value;
  deepFreeze(snapshot);
  return snapshot;
}

function readAuthoringFixtures(manifest: MutableJsonRecord, path: string): MutableJsonRecord {
  const authoring = manifest.authoring;
  if (authoring === undefined) return {};
  assertRecord(authoring, `${path}/authoring`);

  const fixtures = authoring.fixtures;
  if (fixtures === undefined) return {};
  assertRecord(fixtures, `${path}/authoring/fixtures`);
  return fixtures;
}

function readRegistration(
  value: unknown,
  category: "operation" | "resource",
  index: number,
): Readonly<{ id: string; manifest: MutableJsonRecord }> {
  const path = `/${category}s/${index}`;
  assertExactDataObject(value, path, ["id", "manifest"]);
  const registration = value as MutableJsonRecord;
  if (typeof registration.id !== "string") {
    fail(`${path}/id`, "expected a string");
  }
  assertRecord(registration.manifest, `${path}/manifest`);
  for (const key of Object.keys(registration.manifest)) {
    if (HOST_BINDING_FIELDS.has(key)) {
      fail(`${path}/manifest/${key}`, "host binding fields are forbidden in synthetic fixtures");
    }
  }
  assertRecord(registration.manifest.inputSchema, `${path}/manifest/inputSchema`);
  assertRecord(registration.manifest.outputSchema, `${path}/manifest/outputSchema`);
  if (!Array.isArray(registration.manifest.errors)) {
    fail(`${path}/manifest/errors`, "expected the required public-error array");
  }
  if (category === "operation") {
    if (
      typeof registration.manifest.effect !== "string" ||
      !OPERATION_EFFECTS.has(registration.manifest.effect)
    ) {
      fail(`${path}/manifest/effect`, "expected a declared operation effect");
    }
    if (Object.hasOwn(registration.manifest, "policies")) {
      fail(`${path}/manifest/policies`, "resource policies cannot identify an operation");
    }
  } else {
    const policies = registration.manifest.policies;
    if (
      !Array.isArray(policies) ||
      policies.length === 0 ||
      policies.some((policy) => typeof policy !== "string" || !RESOURCE_POLICIES.has(policy)) ||
      new Set(policies).size !== policies.length
    ) {
      fail(`${path}/manifest/policies`, "expected unique declared resource policies");
    }
    if (Object.hasOwn(registration.manifest, "effect")) {
      fail(`${path}/manifest/effect`, "an operation effect cannot identify a resource");
    }
  }
  return { id: registration.id, manifest: registration.manifest };
}

function projectOperationFixtures(
  registration: Readonly<{ id: string; manifest: MutableJsonRecord }>,
  index: number,
): SyntheticOperationFixtures {
  const manifestPath = `/operations/${index}/manifest`;
  const declaredErrors = registration.manifest.errors as unknown[];

  const declaredCodes = new Set<string>();
  for (const [errorIndex, error] of declaredErrors.entries()) {
    assertRecord(error, `${manifestPath}/errors/${errorIndex}`);
    if (typeof error.code !== "string") {
      fail(`${manifestPath}/errors/${errorIndex}/code`, "expected a string");
    }
    declaredCodes.add(error.code);
  }

  const fixtures = readAuthoringFixtures(registration.manifest, manifestPath);
  const fixtureKeys = Object.keys(fixtures);
  if (fixtureKeys.some((key) => key !== "success" && key !== "errors")) {
    fail(`${manifestPath}/authoring/fixtures`, "expected only success, errors");
  }

  const projected: {
    success?: SyntheticFixtureValue;
    errors?: Record<string, SyntheticFixtureValue>;
  } = {};
  if (Object.hasOwn(fixtures, "success")) {
    projected.success = fixtures.success as SyntheticFixtureValue;
  }

  if (Object.hasOwn(fixtures, "errors")) {
    assertRecord(fixtures.errors, `${manifestPath}/authoring/fixtures/errors`);
    const errors: Record<string, SyntheticFixtureValue> = Object.create(null) as Record<
      string,
      SyntheticFixtureValue
    >;
    for (const [code, payload] of Object.entries(fixtures.errors)) {
      if (!declaredCodes.has(code)) {
        fail(
          `${manifestPath}/authoring/fixtures/errors/${code}`,
          `error code ${JSON.stringify(code)} is not declared by the operation`,
        );
      }
      errors[code] = payload as SyntheticFixtureValue;
    }
    projected.errors = errors;
  }

  return projected;
}

/**
 * Projects operation and resource registrations into detached authoring-only fixture data.
 *
 * @remarks Only `manifest.authoring.fixtures` enters the returned capability maps. Operation
 * fixtures use the closed `{ success, errors }` convention and every error fixture key must match
 * a public error declared by the same manifest. Resource fixtures remain named synthetic outputs.
 * Object keys are canonicalized, arrays retain their declared order, and the complete result is
 * recursively frozen. The input must contain the exported context singleton by identity; the
 * returned context is its detached canonical JSON value. This function does not create a host
 * binding or offer integration or production execution modes. The synthetic context is an
 * explicit caller classification, not a secret or personal-data scanner.
 *
 * @throws TypeError when the wrapper is not exact, the context is not the exported singleton, a
 * registration or fixture is not inert JSON, ids are duplicated, an operation fixture has an
 * unsupported shape, an operation error fixture uses an undeclared public code, a registration is
 * placed in the wrong capability category, or the bounded fixture limits are exceeded.
 */
export function createSyntheticFixtureSnapshot<
  const Input extends CreateSyntheticFixtureSnapshotInput,
>(input: Input & ExactSnapshotInput<NoInfer<Input>>): SyntheticFixtureSnapshot {
  assertExactDataObject(input, "/", ["context", "operations", "resources"]);
  const contextDescriptor = Object.getOwnPropertyDescriptor(input, "context");
  if (
    contextDescriptor === undefined ||
    !("value" in contextDescriptor) ||
    contextDescriptor.value !== SYNTHETIC_FIXTURE_CONTEXT
  ) {
    fail("/context", "expected SYNTHETIC_FIXTURE_CONTEXT");
  }

  const safeInput = createCanonicalSnapshot(input) as unknown as {
    context: SyntheticFixtureContext;
    operations: unknown;
    resources: unknown;
  };
  if (!Array.isArray(safeInput.operations)) {
    fail("/operations", "expected an array");
  }
  if (!Array.isArray(safeInput.resources)) {
    fail("/resources", "expected an array");
  }

  const operations: Record<string, SyntheticOperationFixtures> = Object.create(null) as Record<
    string,
    SyntheticOperationFixtures
  >;
  for (const [index, value] of safeInput.operations.entries()) {
    const registration = readRegistration(value, "operation", index);
    if (Object.hasOwn(operations, registration.id)) {
      fail(`/operations/${index}/id`, `duplicate operation id ${JSON.stringify(registration.id)}`);
    }
    operations[registration.id] = projectOperationFixtures(registration, index);
  }

  const resources: Record<string, Record<string, SyntheticFixtureValue>> = Object.create(
    null,
  ) as Record<string, Record<string, SyntheticFixtureValue>>;
  for (const [index, value] of safeInput.resources.entries()) {
    const registration = readRegistration(value, "resource", index);
    if (Object.hasOwn(resources, registration.id)) {
      fail(`/resources/${index}/id`, `duplicate resource id ${JSON.stringify(registration.id)}`);
    }
    if (Object.hasOwn(operations, registration.id)) {
      fail(
        `/resources/${index}/id`,
        `capability id ${JSON.stringify(registration.id)} is already registered as an operation`,
      );
    }
    resources[registration.id] = readAuthoringFixtures(
      registration.manifest,
      `/resources/${index}/manifest`,
    ) as Record<string, SyntheticFixtureValue>;
  }

  const snapshot = createCanonicalSnapshot({
    context: SYNTHETIC_FIXTURE_CONTEXT,
    operations,
    resources,
  });
  CREATED_SYNTHETIC_FIXTURE_SNAPSHOTS.add(snapshot);
  return snapshot;
}

function assertCreatedSnapshot(
  snapshot: SyntheticFixtureSnapshot,
): asserts snapshot is SyntheticFixtureSnapshot {
  if (
    snapshot === null ||
    typeof snapshot !== "object" ||
    !CREATED_SYNTHETIC_FIXTURE_SNAPSHOTS.has(snapshot)
  ) {
    fail("/snapshot", "expected a snapshot created by createSyntheticFixtureSnapshot");
  }
}

function assertLookupName(value: string, path: string): void {
  if (typeof value !== "string") fail(path, "expected a string");
}

function missingResult(): SyntheticFixtureLookupResult {
  return createCanonicalSnapshot({
    context: SYNTHETIC_FIXTURE_CONTEXT,
    status: "missing" as const,
  });
}

function foundResult(value: SyntheticFixtureValue): SyntheticFixtureLookupResult {
  return createCanonicalSnapshot({
    context: SYNTHETIC_FIXTURE_CONTEXT,
    status: "found" as const,
    value,
  });
}

/**
 * Looks up the synthetic success output for one registered operation.
 *
 * @returns A frozen `found` result with a detached value, or an explicit frozen `missing` result.
 *
 * @throws TypeError when the snapshot was not created by {@link createSyntheticFixtureSnapshot}
 * or the JavaScript caller supplies a non-string operation id.
 */
export function lookupSyntheticOperationSuccess(
  snapshot: SyntheticFixtureSnapshot,
  operationId: string,
): SyntheticFixtureLookupResult {
  assertCreatedSnapshot(snapshot);
  assertLookupName(operationId, "/operationId");
  const fixtures = snapshot.operations[operationId];
  return fixtures !== undefined && Object.hasOwn(fixtures, "success")
    ? foundResult(fixtures.success as SyntheticFixtureValue)
    : missingResult();
}

/**
 * Looks up a synthetic public-error payload for one registered operation.
 *
 * @returns A frozen `found` result with a detached value, or an explicit frozen `missing` result.
 *
 * @throws TypeError when the snapshot was not created by {@link createSyntheticFixtureSnapshot}
 * or the JavaScript caller supplies a non-string operation id or error code.
 */
export function lookupSyntheticOperationError(
  snapshot: SyntheticFixtureSnapshot,
  operationId: string,
  errorCode: string,
): SyntheticFixtureLookupResult {
  assertCreatedSnapshot(snapshot);
  assertLookupName(operationId, "/operationId");
  assertLookupName(errorCode, "/errorCode");
  const errors = snapshot.operations[operationId]?.errors;
  return errors !== undefined && Object.hasOwn(errors, errorCode)
    ? foundResult(errors[errorCode] as SyntheticFixtureValue)
    : missingResult();
}

/**
 * Looks up one named synthetic output for a registered resource.
 *
 * @returns A frozen `found` result with a detached value, or an explicit frozen `missing` result.
 *
 * @throws TypeError when the snapshot was not created by {@link createSyntheticFixtureSnapshot}
 * or the JavaScript caller supplies a non-string resource id or fixture name.
 */
export function lookupSyntheticResourceFixture(
  snapshot: SyntheticFixtureSnapshot,
  resourceId: string,
  fixtureName: string,
): SyntheticFixtureLookupResult {
  assertCreatedSnapshot(snapshot);
  assertLookupName(resourceId, "/resourceId");
  assertLookupName(fixtureName, "/fixtureName");
  const fixtures = snapshot.resources[resourceId];
  return fixtures !== undefined && Object.hasOwn(fixtures, fixtureName)
    ? foundResult(fixtures[fixtureName] as SyntheticFixtureValue)
    : missingResult();
}
