import {
  appendJsonPointer,
  createJsonPointer,
  isJsonPointer,
  parseJsonPointer,
} from "@desen/protocol";

import type { JsonPointer } from "@desen/protocol";

/** JSON data after it has been copied through the protocol canonicalizer. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;

/** An inert JSON object with data-only properties. */
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/** The stable subset of an Ajv error consumed by the validator package. */
export interface AjvValidationError {
  readonly instancePath: string;
  readonly keyword: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly propertyName?: string;
}

/** Shape shared by the generated standalone root and meta-schema validators. */
export interface GeneratedValidator {
  (value: unknown): boolean;
  readonly errors?: readonly AjvValidationError[] | null;
}

/** The document-root JSON Pointer. */
export const ROOT_POINTER = createJsonPointer();

/** Narrows an inert JSON value to an object record. */
export function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns sorted object entries so traversal never depends on insertion order. */
export function sortedEntries(object: JsonObject): readonly (readonly [string, JsonValue])[] {
  return Object.keys(object)
    .sort(compareText)
    .map((key) => [key, object[key] as JsonValue] as const);
}

/** Provides one locale-independent ordering operation for machine-facing strings. */
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Appends a validator-produced RFC 6901 path to an already-known base pointer. */
export function appendInstancePath(base: JsonPointer, instancePath: string): JsonPointer {
  if (!isJsonPointer(instancePath)) return base;
  return parseJsonPointer(instancePath).reduce<JsonPointer>(
    (pointer, segment) => appendJsonPointer(pointer, segment),
    base,
  );
}

/** Reads a string-valued Ajv parameter without trusting its runtime shape. */
export function stringParameter(error: AjvValidationError, parameter: string): string | undefined {
  const value = error.params[parameter];
  return typeof value === "string" ? value : undefined;
}
