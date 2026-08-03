import { appendJsonPointer, createJsonPointer, parseJsonPointer } from "@desen/protocol";

import {
  validateBundleGuard,
  validateDraft202012Guard,
  validateSourceGuard,
} from "./generated/0.1.0/bundle-verification-guards.js";

import type { JsonPointer } from "@desen/protocol";

interface JsonObject {
  readonly [key: string]: JsonValue;
}
type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;

interface GeneratedGuardError {
  readonly instancePath?: unknown;
  readonly keyword?: unknown;
  readonly params?: unknown;
  readonly propertyName?: unknown;
}

interface GeneratedGuard {
  (value: unknown): boolean;
  readonly errors?: readonly GeneratedGuardError[] | null;
}

export type BundleVerificationStructuralGuardResult =
  | Readonly<{ readonly valid: true }>
  | Readonly<{
      readonly valid: false;
      readonly code: "SCHEMA_INVALID" | "UNKNOWN_CORE_FIELD";
      readonly pointer: JsonPointer;
    }>;

const ROOT_POINTER = createJsonPointer();
const DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema";
const URI_REFERENCE_PATTERN =
  /^(?:([A-Za-z][A-Za-z0-9+.-]*):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/u;
const SUB_DELIMITERS = "!$&'()*+,;=";
const SINGLE_SCHEMA_KEYWORDS = Object.freeze([
  "additionalProperties",
  "contains",
  "contentSchema",
  "else",
  "if",
  "items",
  "not",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
] as const);
const ARRAY_SCHEMA_KEYWORDS = Object.freeze(["allOf", "anyOf", "oneOf", "prefixItems"] as const);
const MAP_SCHEMA_KEYWORDS = Object.freeze([
  "$defs",
  "dependentSchemas",
  "patternProperties",
  "properties",
] as const);
const VALID_GUARD_RESULT = Object.freeze({
  valid: true,
}) as BundleVerificationStructuralGuardResult;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function childPointer(parent: JsonPointer, ...segments: readonly string[]): JsonPointer {
  return segments.reduce<JsonPointer>(
    (pointer, segment) => appendJsonPointer(pointer, segment),
    parent,
  );
}

function invalid(
  pointer: JsonPointer,
  code: "SCHEMA_INVALID" | "UNKNOWN_CORE_FIELD" = "SCHEMA_INVALID",
): BundleVerificationStructuralGuardResult {
  return Object.freeze({ valid: false, code, pointer });
}

function sortedKeys(value: JsonObject): readonly string[] {
  return Object.keys(value).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function firstGeneratedError(guard: GeneratedGuard): GeneratedGuardError | undefined {
  return guard.errors?.[0];
}

function generatedErrorPointer(
  base: JsonPointer,
  error: GeneratedGuardError | undefined,
): JsonPointer {
  if (error === undefined || typeof error.instancePath !== "string") return base;
  let pointer = base;
  try {
    for (const segment of parseJsonPointer(error.instancePath)) {
      pointer = appendJsonPointer(pointer, segment);
    }
  } catch {
    return base;
  }
  const params = isJsonObject(error.params) ? error.params : undefined;
  const offendingProperty =
    typeof error.propertyName === "string"
      ? error.propertyName
      : typeof params?.additionalProperty === "string"
        ? params.additionalProperty
        : typeof params?.missingProperty === "string"
          ? params.missingProperty
          : typeof params?.propertyName === "string"
            ? params.propertyName
            : undefined;
  if (offendingProperty !== undefined) {
    pointer = appendJsonPointer(pointer, offendingProperty);
  }
  return pointer;
}

function isHexadecimal(character: string | undefined): boolean {
  return character !== undefined && /^[0-9A-Fa-f]$/u.test(character);
}

function isUnreserved(character: string): boolean {
  return /^[A-Za-z0-9._~-]$/u.test(character);
}

function validEncodedComponent(value: string, additionalCharacters: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] as string;
    if (character === "%") {
      if (!isHexadecimal(value[index + 1]) || !isHexadecimal(value[index + 2])) return false;
      index += 2;
      continue;
    }
    if (
      character.charCodeAt(0) > 0x7f ||
      (!isUnreserved(character) &&
        !SUB_DELIMITERS.includes(character) &&
        !additionalCharacters.includes(character))
    ) {
      return false;
    }
  }
  return true;
}

function isIpv4Address(value: string): boolean {
  const octets = value.split(".");
  return (
    octets.length === 4 &&
    octets.every(
      (octet) =>
        /^(?:0|[1-9][0-9]{0,2})$/u.test(octet) && Number(octet) >= 0 && Number(octet) <= 255,
    )
  );
}

function ipv6GroupCount(groups: readonly string[], allowIpv4Tail: boolean): number | undefined {
  let count = 0;
  for (const [index, group] of groups.entries()) {
    if (group.includes(".")) {
      if (!allowIpv4Tail || index !== groups.length - 1 || !isIpv4Address(group)) return undefined;
      count += 2;
    } else {
      if (!/^[0-9A-Fa-f]{1,4}$/u.test(group)) return undefined;
      count += 1;
    }
  }
  return count;
}

function isIpv6Address(value: string): boolean {
  const compression = value.indexOf("::");
  if (compression >= 0 && compression !== value.lastIndexOf("::")) return false;
  if (compression < 0) return ipv6GroupCount(value.split(":"), true) === 8;
  const leftText = value.slice(0, compression);
  const rightText = value.slice(compression + 2);
  const leftCount = ipv6GroupCount(leftText === "" ? [] : leftText.split(":"), false);
  const rightCount = ipv6GroupCount(rightText === "" ? [] : rightText.split(":"), true);
  return leftCount !== undefined && rightCount !== undefined && leftCount + rightCount < 8;
}

function isIpLiteral(value: string): boolean {
  if (isIpv6Address(value)) return true;
  const future = value.match(/^v([0-9A-Fa-f]+)\.(.+)$/iu);
  return (
    future !== null &&
    validEncodedComponent(future[2] as string, ":") &&
    !(future[2] as string).includes("%")
  );
}

function isAuthority(value: string): boolean {
  const at = value.lastIndexOf("@");
  if (at >= 0) {
    if (value.indexOf("@") !== at || !validEncodedComponent(value.slice(0, at), ":")) return false;
    value = value.slice(at + 1);
  }
  if (value.startsWith("[")) {
    const closing = value.indexOf("]");
    if (closing < 0 || value.indexOf("[", 1) >= 0 || value.indexOf("]", closing + 1) >= 0) {
      return false;
    }
    const suffix = value.slice(closing + 1);
    return isIpLiteral(value.slice(1, closing)) && (suffix === "" || /^:[0-9]*$/u.test(suffix));
  }
  if (value.includes("[") || value.includes("]")) return false;
  const colon = value.lastIndexOf(":");
  const host = colon < 0 ? value : value.slice(0, colon);
  const port = colon < 0 ? undefined : value.slice(colon + 1);
  if (host.includes(":")) return false;
  return validEncodedComponent(host, "") && (port === undefined || /^[0-9]*$/u.test(port));
}

function parseUriReference(value: string): Readonly<{ readonly scheme?: string }> | undefined {
  const match = value.match(URI_REFERENCE_PATTERN);
  if (match === null) return undefined;
  const [, scheme, authority, path, query, fragment] = match;
  if (path === undefined || !validEncodedComponent(path, ":@/")) return undefined;
  if (query !== undefined && !validEncodedComponent(query, ":@/?")) return undefined;
  if (fragment !== undefined && !validEncodedComponent(fragment, ":@/?")) return undefined;
  if (
    authority !== undefined &&
    (!isAuthority(authority) || (path !== "" && !path.startsWith("/")))
  ) {
    return undefined;
  }
  if (
    scheme === undefined &&
    authority === undefined &&
    (path.split("/", 1)[0] as string).includes(":")
  ) {
    return undefined;
  }
  return { ...(scheme === undefined ? {} : { scheme }) };
}

function isUriReference(value: string): boolean {
  return parseUriReference(value) !== undefined;
}

function isAbsoluteUri(value: string): boolean {
  return parseUriReference(value)?.scheme !== undefined;
}

function invalidRegularExpression(pattern: string): boolean {
  try {
    new RegExp(pattern, "u");
    return false;
  } catch {
    return true;
  }
}

function customProfileFailure(schema: JsonValue, pointer: JsonPointer): JsonPointer | undefined {
  if (typeof schema === "boolean" || !isJsonObject(schema)) return undefined;
  if (typeof schema.$schema === "string" && schema.$schema !== DRAFT_2020_12) {
    return childPointer(pointer, "$schema");
  }
  if (
    typeof schema.$id === "string" &&
    (!isUriReference(schema.$id) ||
      schema.$id === "" ||
      (schema.$id.includes("#") && !schema.$id.endsWith("#")))
  ) {
    return childPointer(pointer, "$id");
  }
  for (const keyword of ["$ref", "$dynamicRef"] as const) {
    const reference = schema[keyword];
    if (
      typeof reference === "string" &&
      (!isUriReference(reference) || (reference !== "" && !reference.startsWith("#")))
    ) {
      return childPointer(pointer, keyword);
    }
  }
  if (isJsonObject(schema.$vocabulary)) {
    for (const vocabularyId of sortedKeys(schema.$vocabulary)) {
      if (!isAbsoluteUri(vocabularyId)) {
        return childPointer(pointer, "$vocabulary", vocabularyId);
      }
    }
  }
  if (typeof schema.pattern === "string" && invalidRegularExpression(schema.pattern)) {
    return childPointer(pointer, "pattern");
  }
  if (isJsonObject(schema.patternProperties)) {
    for (const pattern of sortedKeys(schema.patternProperties)) {
      if (invalidRegularExpression(pattern)) {
        return childPointer(pointer, "patternProperties", pattern);
      }
      const childFailure = customProfileFailure(
        schema.patternProperties[pattern] as JsonValue,
        childPointer(pointer, "patternProperties", pattern),
      );
      if (childFailure !== undefined) return childFailure;
    }
  }
  for (const keyword of SINGLE_SCHEMA_KEYWORDS) {
    if (schema[keyword] === undefined) continue;
    const childFailure = customProfileFailure(
      schema[keyword] as JsonValue,
      childPointer(pointer, keyword),
    );
    if (childFailure !== undefined) return childFailure;
  }
  for (const keyword of ARRAY_SCHEMA_KEYWORDS) {
    const children = schema[keyword];
    if (!Array.isArray(children)) continue;
    for (const [index, child] of children.entries()) {
      const childFailure = customProfileFailure(
        child,
        childPointer(pointer, keyword, String(index)),
      );
      if (childFailure !== undefined) return childFailure;
    }
  }
  for (const keyword of MAP_SCHEMA_KEYWORDS) {
    if (keyword === "patternProperties" || !isJsonObject(schema[keyword])) continue;
    const children = schema[keyword] as JsonObject;
    for (const name of sortedKeys(children)) {
      const childFailure = customProfileFailure(
        children[name] as JsonValue,
        childPointer(pointer, keyword, name),
      );
      if (childFailure !== undefined) return childFailure;
    }
  }
  return undefined;
}

function embeddedSchemaFailure(
  document: JsonObject,
  metaGuard: GeneratedGuard,
): BundleVerificationStructuralGuardResult | undefined {
  if (!isJsonObject(document.surfaces)) return undefined;
  for (const surfaceId of sortedKeys(document.surfaces)) {
    const surface = document.surfaces[surfaceId];
    if (!isJsonObject(surface) || !isJsonObject(surface.state)) continue;
    for (const stateId of sortedKeys(surface.state)) {
      const state = surface.state[stateId];
      if (!isJsonObject(state) || !isJsonObject(state.schema)) continue;
      const pointer = childPointer(ROOT_POINTER, "surfaces", surfaceId, "state", stateId, "schema");
      if (!metaGuard(state.schema)) {
        return invalid(generatedErrorPointer(pointer, firstGeneratedError(metaGuard)));
      }
      const customFailure = customProfileFailure(state.schema, pointer);
      if (customFailure !== undefined) return invalid(customFailure);
    }
  }
  return undefined;
}

/**
 * Fail-fast structural admission before the historical exhaustive validator consistency fence.
 *
 * @internal The generated roots and Draft meta-schema use the exact frozen DESEN 0.1.0 schemas
 * with Ajv `allErrors: false`. The local walk mirrors the validator's embedded-schema dialect,
 * identifier, local-reference, vocabulary, and Unicode-regex profile but returns at the first
 * failure. No runtime schema compilation, dynamic loading, filesystem access, or network access is
 * present in this path.
 */
export function guardBundleVerificationStructure(
  target: "bundle" | "source",
  value: JsonValue,
): BundleVerificationStructuralGuardResult {
  const rootGuard = (
    target === "bundle" ? validateBundleGuard : validateSourceGuard
  ) as GeneratedGuard;
  if (!rootGuard(value)) {
    const error = firstGeneratedError(rootGuard);
    return invalid(
      generatedErrorPointer(ROOT_POINTER, error),
      error?.keyword === "additionalProperties" ? "UNKNOWN_CORE_FIELD" : "SCHEMA_INVALID",
    );
  }
  if (!isJsonObject(value)) return invalid(ROOT_POINTER);

  const metaGuard = validateDraft202012Guard as GeneratedGuard;
  return embeddedSchemaFailure(value, metaGuard) ?? VALID_GUARD_RESULT;
}
