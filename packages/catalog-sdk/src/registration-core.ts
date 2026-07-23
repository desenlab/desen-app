import { createImmutableJsonSnapshot } from "./inert-json.js";

import type { ImmutableJson, JsonInput, JsonPrimitive } from "./inert-json.js";

type ExactArrayShape<
  Input extends readonly unknown[],
  Shape extends readonly unknown[],
> = Shape extends readonly (infer ShapeItem)[]
  ? {
      readonly [Key in keyof Input]: Key extends number | `${number}`
        ? ExactJsonShape<Input[Key], NonNullable<ShapeItem>>
        : Input[Key];
    }
  : Input;

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
    ? Input extends readonly unknown[]
      ? ExactArrayShape<Input, NonNullable<Shape>>
      : never
    : [NonNullable<Shape>] extends [object]
      ? Input extends object
        ? string extends keyof NonNullable<Shape>
          ? ExactOpenRecord<Input, NonNullable<Shape>>
          : ExactClosedObject<Input, NonNullable<Shape>>
        : never
      : Input;

/**
 * Schema-authoritative exact inert input view shared by manifest registration categories.
 *
 * @remarks Array elements are checked recursively so closed objects such as public error entries
 * cannot hide implementation-only fields inside named arrays or heterogeneous tuples.
 */
export type ExactManifest<Input, ManifestInput> = Input extends ManifestInput
  ? ManifestInput & Input & JsonInput<Input> & ExactJsonShape<Input, ManifestInput>
  : never;

/** Detached immutable `{ id, manifest }` snapshot used by category-specific public aliases. */
export type RegisteredManifest<Id extends string, Manifest> = ImmutableJson<{
  readonly id: Id;
  readonly manifest: Manifest;
}>;

function fail(category: string, path: string, message: string): never {
  throw new TypeError(`Invalid ${category} registration at ${path}: ${message}`);
}

function assertJsonRecord(
  value: unknown,
  category: string,
  path: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(category, path, "expected a JSON object");
  }
}

/**
 * Applies the shared runtime boundary for one category-specific registration function.
 *
 * The category wrappers retain distinct schema-derived TypeScript contracts. Runtime code checks
 * only the common wrapper because complete Catalog schema and semantic validation belongs to
 * `@desen/validator`.
 */
export function createRegisteredManifest(input: unknown, category: string): unknown {
  const snapshot = createImmutableJsonSnapshot(input) as unknown;
  assertJsonRecord(snapshot, category, "/");

  const keys = Object.keys(snapshot);
  if (keys.length !== 2 || keys[0] !== "id" || keys[1] !== "manifest") {
    fail(category, "/", "expected only id, manifest");
  }
  if (typeof snapshot.id !== "string") {
    fail(category, "/id", "expected a string");
  }
  assertJsonRecord(snapshot.manifest, category, "/manifest");

  return snapshot;
}
