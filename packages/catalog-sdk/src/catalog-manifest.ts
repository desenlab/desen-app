import { createImmutableJsonSnapshot } from "./inert-json.js";

import type { DesenCatalog } from "@desen/protocol";
import type { ComponentManifestInput, ExactComponentManifest } from "./component-registration.js";
import type { ImmutableJson, JsonInput } from "./inert-json.js";

type ComponentRegistrationShape = Readonly<{
  readonly id: string;
  readonly manifest: ComponentManifestInput;
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
  readonly components: readonly ComponentRegistrationShape[];
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
const OPTIONAL_INPUT_KEYS = Object.freeze(["authoring", "description", "extensions"]);
const REGISTRATION_KEYS = Object.freeze(["id", "manifest"]);

type ExactComponentRegistration<Input extends ComponentRegistrationShape> =
  Input extends ComponentRegistrationShape
    ? Input &
        Record<Exclude<keyof Input, keyof ComponentRegistrationShape>, never> &
        Readonly<{ manifest: ExactComponentManifest<Input["manifest"]> }>
    : never;

type ExactComponentList<Input extends readonly ComponentRegistrationShape[]> = {
  readonly [Key in keyof Input]: Input[Key] extends ComponentRegistrationShape
    ? ExactComponentRegistration<Input[Key]>
    : Input[Key];
};

type CatalogManifestConstraints<Input extends CreateCatalogManifestInput> =
  Input extends CreateCatalogManifestInput
    ? JsonInput<Input> &
        Record<Exclude<keyof Input, keyof CreateCatalogManifestInput>, never> &
        Readonly<{
          components: Input["components"] & ExactComponentList<Input["components"]>;
        }>
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
  index: number,
): asserts value is { readonly id: string; readonly manifest: Record<string, unknown> } {
  const path = `/components/${index}`;
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

/**
 * Builds one complete DESEN 0.1.0 Catalog manifest from component registrations.
 *
 * @remarks Protocol identity constants are injected rather than caller-selected. Component ids are
 * composed into the Catalog map exactly once; duplicate ids fail instead of using last-write-wins.
 * Behavior, operation, and resource registration deliberately remain empty until M03-T02. The
 * result is detached, canonical-key-ordered, recursively frozen JSON data.
 *
 * @throws TypeError when the input is non-JSON, has an unknown wrapper field, contains a malformed
 * registration record, or repeats a component identifier.
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
  if (!Array.isArray(snapshot.components)) fail("/components", "expected an array");

  const componentMap: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [index, registration] of snapshot.components.entries()) {
    assertRegistration(registration, index);
    if (Object.hasOwn(componentMap, registration.id)) {
      fail(`/components/${index}/id`, `duplicate component id ${JSON.stringify(registration.id)}`);
    }
    componentMap[registration.id] = registration.manifest;
  }

  const catalog: Record<string, unknown> = {
    kind: "desen.catalog",
    desen: "0.1.0",
    id: snapshot.id,
    version: snapshot.version,
    target: snapshot.target,
    packageDigest: snapshot.packageDigest,
    components: componentMap,
    behaviors: {},
    operations: {},
    resources: {},
  };
  if (Object.hasOwn(snapshot, "description")) catalog.description = snapshot.description;
  if (Object.hasOwn(snapshot, "authoring")) catalog.authoring = snapshot.authoring;
  if (Object.hasOwn(snapshot, "extensions")) catalog.extensions = snapshot.extensions;

  return createImmutableJsonSnapshot(catalog) as unknown as ImmutableJson<DesenCatalog>;
}
