import { createImmutableJsonSnapshot } from "./inert-json.js";

import type { DesenCatalog } from "@desen/protocol";
import type { BehaviorManifestInput } from "./behavior-registration.js";
import type { ComponentManifestInput } from "./component-registration.js";
import type { ImmutableJson, JsonInput } from "./inert-json.js";
import type { OperationManifestInput } from "./operation-registration.js";
import type { ExactManifest } from "./registration-core.js";
import type { ResourceManifestInput } from "./resource-registration.js";

type RegistrationShape<Manifest> = Readonly<{
  readonly id: string;
  readonly manifest: Manifest;
}>;

/** Input accepted by {@link createCatalogManifest}. */
export interface CreateCatalogManifestInput {
  /** Immutable capability-package identifier. */
  readonly id: DesenCatalog["id"];
  /** Exact package Semantic Version text; the validator checks its grammar. */
  readonly version: DesenCatalog["version"];
  /** Exact target identifier such as `web-react`. */
  readonly target: DesenCatalog["target"];
  /** Caller-supplied package digest; digest construction belongs to M03-T04. */
  readonly packageDigest: DesenCatalog["packageDigest"];
  /** Optional package description. */
  readonly description?: NonNullable<DesenCatalog["description"]>;
  /** Component registrations to expose through the authoritative Catalog map. */
  readonly components: readonly RegistrationShape<ComponentManifestInput>[];
  /** Optional behavior registrations; omission preserves the component-only builder behavior. */
  readonly behaviors?: readonly RegistrationShape<BehaviorManifestInput>[];
  /** Optional operation registrations whose implementations remain host-owned. */
  readonly operations?: readonly RegistrationShape<OperationManifestInput>[];
  /** Optional resource registrations whose implementations remain host-owned. */
  readonly resources?: readonly RegistrationShape<ResourceManifestInput>[];
  /** Optional open authoring metadata from the Catalog schema. */
  readonly authoring?: JsonInput<NonNullable<DesenCatalog["authoring"]>>;
  /** Optional opaque Catalog extensions. */
  readonly extensions?: JsonInput<NonNullable<DesenCatalog["extensions"]>>;
}

const REQUIRED_INPUT_KEYS = Object.freeze([
  "components",
  "id",
  "packageDigest",
  "target",
  "version",
]);
const OPTIONAL_INPUT_KEYS = Object.freeze([
  "authoring",
  "behaviors",
  "description",
  "extensions",
  "operations",
  "resources",
]);
const REGISTRATION_KEYS = Object.freeze(["id", "manifest"]);

type ExactRegistration<Input, Manifest> =
  Input extends RegistrationShape<Manifest>
    ? Input &
        Record<Exclude<keyof Input, keyof RegistrationShape<Manifest>>, never> &
        Readonly<{ manifest: ExactManifest<Input["manifest"], Manifest> }>
    : never;

type ExactRegistrationList<Input, Manifest> = Input extends readonly RegistrationShape<Manifest>[]
  ? {
      readonly [Key in keyof Input]: Input[Key] extends RegistrationShape<Manifest>
        ? ExactRegistration<Input[Key], Manifest>
        : Input[Key];
    }
  : never;

type PresentRegistrationConstraint<
  Input,
  Key extends "behaviors" | "operations" | "resources",
  Manifest,
> =
  Input extends Readonly<Record<Key, infer List>>
    ? Readonly<Record<Key, List & ExactRegistrationList<List, Manifest>>>
    : unknown;

type ExactComponentList<Input extends readonly RegistrationShape<ComponentManifestInput>[]> = {
  readonly [Key in keyof Input]: Input[Key] extends RegistrationShape<ComponentManifestInput>
    ? ExactRegistration<Input[Key], ComponentManifestInput>
    : Input[Key];
};

type CatalogManifestConstraints<Input extends CreateCatalogManifestInput> =
  Input extends CreateCatalogManifestInput
    ? JsonInput<Input> &
        Record<Exclude<keyof Input, keyof CreateCatalogManifestInput>, never> &
        Readonly<{
          components: Input["components"] & ExactComponentList<Input["components"]>;
        }> &
        PresentRegistrationConstraint<Input, "behaviors", BehaviorManifestInput> &
        PresentRegistrationConstraint<Input, "operations", OperationManifestInput> &
        PresentRegistrationConstraint<Input, "resources", ResourceManifestInput>
    : never;

function fail(path: string, message: string): never {
  throw new TypeError(`Invalid Catalog manifest input at ${path}: ${message}`);
}

function assertJsonRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "expected a JSON object");
  }
}

function assertExactInputKeys(value: Record<string, unknown>): void {
  const keys = Object.keys(value);
  for (const key of REQUIRED_INPUT_KEYS) {
    if (!Object.hasOwn(value, key)) fail("/", `missing required field ${key}`);
  }
  for (const key of keys) {
    if (!REQUIRED_INPUT_KEYS.includes(key) && !OPTIONAL_INPUT_KEYS.includes(key)) {
      fail(`/${key}`, "unknown registration field");
    }
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") fail(path, "expected a string");
}

function assertOptionalRecord(value: Record<string, unknown>, key: string): void {
  if (Object.hasOwn(value, key)) assertJsonRecord(value[key], `/${key}`);
}

function assertRegistration(
  value: unknown,
  category: "components" | "behaviors" | "operations" | "resources",
  index: number,
): asserts value is { readonly id: string; readonly manifest: Record<string, unknown> } {
  const path = `/${category}/${index}`;
  assertJsonRecord(value, path);
  const keys = Object.keys(value);
  if (
    keys.length !== REGISTRATION_KEYS.length ||
    REGISTRATION_KEYS.some((key, keyIndex) => keys[keyIndex] !== key)
  ) {
    fail(path, "expected only id and manifest");
  }
  assertString(value.id, `${path}/id`);
  assertJsonRecord(value.manifest, `${path}/manifest`);
}

function composeRegistrationMap(
  input: Record<string, unknown>,
  category: "components" | "behaviors" | "operations" | "resources",
  capabilityOwners: Record<string, string>,
): Record<string, unknown> {
  const registrations = Object.hasOwn(input, category) ? input[category] : [];
  if (!Array.isArray(registrations)) fail(`/${category}`, "expected an array");

  const map: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [index, registration] of registrations.entries()) {
    assertRegistration(registration, category, index);
    if (Object.hasOwn(map, registration.id)) {
      fail(
        `/${category}/${index}/id`,
        `duplicate ${category.slice(0, -1)} id ${JSON.stringify(registration.id)}`,
      );
    }
    if (Object.hasOwn(capabilityOwners, registration.id)) {
      fail(
        `/${category}/${index}/id`,
        `duplicate capability id ${JSON.stringify(registration.id)} already registered in ${capabilityOwners[registration.id]}`,
      );
    }
    map[registration.id] = registration.manifest;
    capabilityOwners[registration.id] = category;
  }
  return map;
}

/**
 * Builds one complete DESEN 0.1.0 Catalog manifest from inert capability registrations.
 *
 * @remarks Protocol identity constants are injected rather than caller-selected. Capability ids
 * share one exact, case-sensitive namespace across all four maps, so duplicates fail instead of
 * producing a Catalog that the semantic validator must reject. Omitted later-category lists
 * preserve the M03-T01 component-only call shape and emit empty maps. The result is detached,
 * canonical-key-ordered, recursively frozen JSON data.
 *
 * @throws TypeError when the input is non-JSON, has an unknown wrapper field, contains a malformed
 * registration record, or repeats a capability identifier.
 */
export function createCatalogManifest<const Input extends CreateCatalogManifestInput>(
  input: Input & CatalogManifestConstraints<NoInfer<Input>>,
): ImmutableJson<DesenCatalog> {
  const snapshot = createImmutableJsonSnapshot(input) as unknown;
  assertJsonRecord(snapshot, "/");
  assertExactInputKeys(snapshot);

  assertString(snapshot.id, "/id");
  assertString(snapshot.version, "/version");
  assertString(snapshot.target, "/target");
  assertString(snapshot.packageDigest, "/packageDigest");
  if (Object.hasOwn(snapshot, "description")) {
    assertString(snapshot.description, "/description");
  }
  assertOptionalRecord(snapshot, "authoring");
  assertOptionalRecord(snapshot, "extensions");
  const capabilityOwners: Record<string, string> = Object.create(null) as Record<string, string>;
  const componentMap = composeRegistrationMap(snapshot, "components", capabilityOwners);
  const behaviorMap = composeRegistrationMap(snapshot, "behaviors", capabilityOwners);
  const operationMap = composeRegistrationMap(snapshot, "operations", capabilityOwners);
  const resourceMap = composeRegistrationMap(snapshot, "resources", capabilityOwners);

  const catalog: Record<string, unknown> = {
    kind: "desen.catalog",
    desen: "0.1.0",
    id: snapshot.id,
    version: snapshot.version,
    target: snapshot.target,
    packageDigest: snapshot.packageDigest,
    components: componentMap,
    behaviors: behaviorMap,
    operations: operationMap,
    resources: resourceMap,
  };
  if (Object.hasOwn(snapshot, "description")) catalog.description = snapshot.description;
  if (Object.hasOwn(snapshot, "authoring")) catalog.authoring = snapshot.authoring;
  if (Object.hasOwn(snapshot, "extensions")) catalog.extensions = snapshot.extensions;

  return createImmutableJsonSnapshot(catalog) as unknown as ImmutableJson<DesenCatalog>;
}
