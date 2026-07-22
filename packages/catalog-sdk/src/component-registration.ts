import { createImmutableJsonSnapshot } from "./inert-json.js";

import type { DesenCatalog } from "@desen/protocol";
import type { ImmutableJson, JsonInput, JsonPrimitive } from "./inert-json.js";

/**
 * The complete JSON contract for one DESEN component capability.
 *
 * @remarks The type is projected directly from the frozen Catalog schema root. It is not an
 * independent contract and does not replace runtime Catalog validation.
 */
export type ComponentManifest = DesenCatalog["components"][string];

export type ComponentManifestInput = JsonInput<ComponentManifest>;

type RegistrationShape = Readonly<{
  id: string;
  manifest: ComponentManifestInput;
}>;

type RegistrationConstraints<Input extends RegistrationShape> = Input extends RegistrationShape
  ? Record<Exclude<keyof Input, keyof RegistrationShape>, never> &
      RegisterComponentInput<Input["id"], Input["manifest"]>
  : never;

type ExactOpenRecord<Input extends object, Shape extends object> =
  Shape extends Record<string, infer Value>
    ? [NonNullable<Value>] extends [object]
      ? { readonly [Key in keyof Input]: ExactJsonShape<Input[Key], NonNullable<Value>> }
      : Input
    : Input;

type ExactClosedObject<Input extends object, Shape extends object> = Input &
  Record<Exclude<keyof Input, keyof Shape>, never> & {
    readonly [Key in keyof Input]: Key extends keyof Shape
      ? ExactJsonShape<Input[Key], NonNullable<Shape[Key]>>
      : never;
  };

type ExactJsonShape<Input, Shape> = [NonNullable<Shape>] extends [JsonPrimitive]
  ? Input
  : [NonNullable<Shape>] extends [readonly unknown[]]
    ? Input
    : [NonNullable<Shape>] extends [object]
      ? Input extends object
        ? string extends keyof NonNullable<Shape>
          ? ExactOpenRecord<Input, NonNullable<Shape>>
          : ExactClosedObject<Input, NonNullable<Shape>>
        : never
      : Input;

/** Schema-authoritative, exact, inert input view used by catalog composition internals. */
export type ExactComponentManifest<Input> = Input extends ComponentManifestInput
  ? ComponentManifestInput extends Input
    ? ComponentManifestInput & Input & JsonInput<Input>
    : ComponentManifestInput &
        Input &
        JsonInput<Input> &
        ExactJsonShape<Input, ComponentManifestInput>
  : never;

/** Input accepted by {@link registerComponent}. */
export interface RegisterComponentInput<
  Id extends string = string,
  Manifest = ComponentManifestInput,
> {
  /** Fully qualified capability identifier used as the Catalog map key. */
  readonly id: Id;
  /** Authoritative JSON component contract; executable adapters never belong here. */
  readonly manifest: ExactComponentManifest<Manifest>;
}

/**
 * Detached JSON registration for one component contract.
 *
 * @remarks The record is recursively frozen and contains only the identifier plus the authoritative
 * manifest. Renderer implementations are registered by target-specific runtime packages.
 */
export type RegisteredComponent<
  Id extends string = string,
  Manifest extends ComponentManifestInput = ComponentManifestInput,
> = ImmutableJson<{
  readonly id: Id;
  readonly manifest: Manifest;
}>;

function assertJsonRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Invalid component registration at ${path}: expected a JSON object`);
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || expected.some((key, index) => actual[index] !== key)) {
    throw new TypeError(
      `Invalid component registration at /: expected only ${expected.join(", ")}`,
    );
  }
}

/**
 * Registers one component manifest as detached, immutable JSON data.
 *
 * @remarks This function is pure and writes no global registry. Canonical snapshotting makes equal
 * JSON inputs independent of object insertion order while preserving array order. Full identifier,
 * JSON Schema, and cross-contract validation remains the validator/publisher boundary.
 *
 * @throws TypeError when the wrapper shape is wrong or any nested value is not inert JSON data.
 */
export function registerComponent<const Input extends RegistrationShape>(
  input: Input & RegistrationConstraints<NoInfer<Input>>,
): RegisteredComponent<Input["id"], Input["manifest"]> {
  const snapshot = createImmutableJsonSnapshot(input) as unknown;
  assertJsonRecord(snapshot, "/");
  assertExactKeys(snapshot, ["id", "manifest"]);

  if (typeof snapshot.id !== "string") {
    throw new TypeError("Invalid component registration at /id: expected a string");
  }
  assertJsonRecord(snapshot.manifest, "/manifest");

  return snapshot as RegisteredComponent<Input["id"], Input["manifest"]>;
}
