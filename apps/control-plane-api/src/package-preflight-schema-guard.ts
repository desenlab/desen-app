import { appendJsonPointer, createJsonPointer, parseJsonPointer } from "@desen/protocol";

import { validateDraft202012Guard } from "./generated/0.1.0/bundle-verification-guards.js";
import { validatePackagePreflightCatalogGuard } from "./generated/0.1.0/package-preflight-catalog-guard.js";

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

/** @internal First-issue result from the deterministic M07-T03 Catalog admission guard. */
export type PackagePreflightCatalogGuardResult =
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
const VALID_GUARD_RESULT = Object.freeze({ valid: true }) as PackagePreflightCatalogGuardResult;

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
): PackagePreflightCatalogGuardResult {
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
  return offendingProperty === undefined ? pointer : appendJsonPointer(pointer, offendingProperty);
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
      if (!isAbsoluteUri(vocabularyId)) return childPointer(pointer, "$vocabulary", vocabularyId);
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
      const failure = customProfileFailure(
        schema.patternProperties[pattern] as JsonValue,
        childPointer(pointer, "patternProperties", pattern),
      );
      if (failure !== undefined) return failure;
    }
  }
  for (const keyword of SINGLE_SCHEMA_KEYWORDS) {
    if (schema[keyword] === undefined) continue;
    const failure = customProfileFailure(
      schema[keyword] as JsonValue,
      childPointer(pointer, keyword),
    );
    if (failure !== undefined) return failure;
  }
  for (const keyword of ARRAY_SCHEMA_KEYWORDS) {
    const children = schema[keyword];
    if (!Array.isArray(children)) continue;
    for (const [index, child] of children.entries()) {
      const failure = customProfileFailure(child, childPointer(pointer, keyword, String(index)));
      if (failure !== undefined) return failure;
    }
  }
  for (const keyword of MAP_SCHEMA_KEYWORDS) {
    if (keyword === "patternProperties" || !isJsonObject(schema[keyword])) continue;
    const children = schema[keyword] as JsonObject;
    for (const name of sortedKeys(children)) {
      const failure = customProfileFailure(
        children[name] as JsonValue,
        childPointer(pointer, keyword, name),
      );
      if (failure !== undefined) return failure;
    }
  }
  return undefined;
}

function embeddedSchemaFailure(
  schema: JsonValue | undefined,
  pointer: JsonPointer,
  metaGuard: GeneratedGuard,
): PackagePreflightCatalogGuardResult | undefined {
  if (!isJsonObject(schema)) return undefined;
  if (!metaGuard(schema)) {
    return invalid(generatedErrorPointer(pointer, firstGeneratedError(metaGuard)));
  }
  const customFailure = customProfileFailure(schema, pointer);
  return customFailure === undefined ? undefined : invalid(customFailure);
}

function namedSchemaFailure(
  owner: JsonObject,
  pointer: JsonPointer,
  field: string,
  metaGuard: GeneratedGuard,
): PackagePreflightCatalogGuardResult | undefined {
  return embeddedSchemaFailure(owner[field], childPointer(pointer, field), metaGuard);
}

function recordSchemaFailure(
  owner: JsonObject,
  pointer: JsonPointer,
  recordName: string,
  schemaName: string,
  metaGuard: GeneratedGuard,
): PackagePreflightCatalogGuardResult | undefined {
  const record = owner[recordName];
  if (!isJsonObject(record)) return undefined;
  for (const entryName of sortedKeys(record)) {
    const entry = record[entryName];
    if (!isJsonObject(entry)) continue;
    const failure = namedSchemaFailure(
      entry,
      childPointer(pointer, recordName, entryName),
      schemaName,
      metaGuard,
    );
    if (failure !== undefined) return failure;
  }
  return undefined;
}

function componentLikeSchemaFailure(
  catalog: JsonObject,
  groupName: "components" | "behaviors",
  metaGuard: GeneratedGuard,
): PackagePreflightCatalogGuardResult | undefined {
  const group = catalog[groupName];
  if (!isJsonObject(group)) return undefined;
  for (const capabilityId of sortedKeys(group)) {
    const capability = group[capabilityId];
    if (!isJsonObject(capability)) continue;
    const pointer = childPointer(ROOT_POINTER, groupName, capabilityId);
    const failure =
      namedSchemaFailure(capability, pointer, "propsSchema", metaGuard) ??
      recordSchemaFailure(capability, pointer, "events", "payloadSchema", metaGuard) ??
      recordSchemaFailure(capability, pointer, "commands", "inputSchema", metaGuard) ??
      recordSchemaFailure(capability, pointer, "styleParts", "propertiesSchema", metaGuard);
    if (failure !== undefined) return failure;
  }
  return undefined;
}

function inputOutputSchemaFailure(
  catalog: JsonObject,
  groupName: "operations" | "resources",
  metaGuard: GeneratedGuard,
): PackagePreflightCatalogGuardResult | undefined {
  const group = catalog[groupName];
  if (!isJsonObject(group)) return undefined;
  for (const capabilityId of sortedKeys(group)) {
    const capability = group[capabilityId];
    if (!isJsonObject(capability)) continue;
    const pointer = childPointer(ROOT_POINTER, groupName, capabilityId);
    for (const field of ["inputSchema", "outputSchema"]) {
      const failure = namedSchemaFailure(capability, pointer, field, metaGuard);
      if (failure !== undefined) return failure;
    }
  }
  return undefined;
}

/**
 * Runs deterministic fail-fast Catalog and embedded-schema admission before exhaustive validation.
 *
 * @internal Both generated validators are exact frozen-schema standalone output with
 * `allErrors: false`. The local sorted walk mirrors every Catalog embedded-schema location and the
 * Validator's dialect, local-reference, vocabulary, URI, and Unicode-regexp profile. Runtime code
 * performs no schema compilation, dynamic loading, filesystem resolution, or network access.
 */
export function guardPackagePreflightCatalogStructure(
  value: unknown,
): PackagePreflightCatalogGuardResult {
  const catalogGuard = validatePackagePreflightCatalogGuard as GeneratedGuard;
  if (!catalogGuard(value)) {
    const error = firstGeneratedError(catalogGuard);
    return invalid(
      generatedErrorPointer(ROOT_POINTER, error),
      error?.keyword === "additionalProperties" ? "UNKNOWN_CORE_FIELD" : "SCHEMA_INVALID",
    );
  }
  if (!isJsonObject(value)) return invalid(ROOT_POINTER);
  const metaGuard = validateDraft202012Guard as GeneratedGuard;
  return (
    componentLikeSchemaFailure(value, "components", metaGuard) ??
    componentLikeSchemaFailure(value, "behaviors", metaGuard) ??
    inputOutputSchemaFailure(value, "operations", metaGuard) ??
    inputOutputSchemaFailure(value, "resources", metaGuard) ??
    VALID_GUARD_RESULT
  );
}
