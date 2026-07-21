import { appendJsonPointer } from "@desen/protocol";

import { diagnosticFromAjvError, schemaDiagnostic } from "./structural-diagnostics.js";
import { isAbsoluteUri, isUriReference } from "./uri-reference.js";
import { isJsonObject, ROOT_POINTER, sortedEntries } from "./validation-internals.js";

import type { JsonPointer } from "@desen/protocol";
import type { StructuralDiagnostic } from "./structural-diagnostics.js";
import type { GeneratedValidator, JsonObject, JsonValue } from "./validation-internals.js";

const DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema";
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

interface EmbeddedSchemaLocation {
  readonly pointer: JsonPointer;
  readonly schema: JsonObject;
}

function childPointer(parent: JsonPointer, ...segments: readonly string[]): JsonPointer {
  return segments.reduce<JsonPointer>(
    (pointer, segment) => appendJsonPointer(pointer, segment),
    parent,
  );
}

function pushEmbeddedSchema(
  locations: EmbeddedSchemaLocation[],
  schema: JsonValue | undefined,
  pointer: JsonPointer,
): void {
  if (isJsonObject(schema)) locations.push({ pointer, schema });
}

function locateStateSchemas(document: JsonObject): readonly EmbeddedSchemaLocation[] {
  const locations: EmbeddedSchemaLocation[] = [];
  const surfaces = document.surfaces;
  if (!isJsonObject(surfaces)) return locations;

  for (const [surfaceId, surfaceValue] of sortedEntries(surfaces)) {
    if (!isJsonObject(surfaceValue) || !isJsonObject(surfaceValue.state)) continue;
    for (const [stateId, stateValue] of sortedEntries(surfaceValue.state)) {
      if (!isJsonObject(stateValue)) continue;
      pushEmbeddedSchema(
        locations,
        stateValue.schema,
        childPointer(ROOT_POINTER, "surfaces", surfaceId, "state", stateId, "schema"),
      );
    }
  }
  return locations;
}

function locateNamedSchema(
  locations: EmbeddedSchemaLocation[],
  owner: JsonObject,
  ownerPointer: JsonPointer,
  field: string,
): void {
  pushEmbeddedSchema(locations, owner[field], childPointer(ownerPointer, field));
}

function locateRecordSchemas(
  locations: EmbeddedSchemaLocation[],
  owner: JsonObject,
  ownerPointer: JsonPointer,
  recordName: string,
  schemaName: string,
): void {
  const record = owner[recordName];
  if (!isJsonObject(record)) return;
  for (const [entryName, entryValue] of sortedEntries(record)) {
    if (!isJsonObject(entryValue)) continue;
    locateNamedSchema(
      locations,
      entryValue,
      childPointer(ownerPointer, recordName, entryName),
      schemaName,
    );
  }
}

function locateComponentLikeSchemas(
  document: JsonObject,
  groupName: "components" | "behaviors",
  locations: EmbeddedSchemaLocation[],
): void {
  const group = document[groupName];
  if (!isJsonObject(group)) return;
  for (const [capabilityId, capabilityValue] of sortedEntries(group)) {
    if (!isJsonObject(capabilityValue)) continue;
    const capabilityPointer = childPointer(ROOT_POINTER, groupName, capabilityId);
    locateNamedSchema(locations, capabilityValue, capabilityPointer, "propsSchema");
    locateRecordSchemas(locations, capabilityValue, capabilityPointer, "events", "payloadSchema");
    locateRecordSchemas(locations, capabilityValue, capabilityPointer, "commands", "inputSchema");
    locateRecordSchemas(
      locations,
      capabilityValue,
      capabilityPointer,
      "styleParts",
      "propertiesSchema",
    );
  }
}

function locateInputOutputSchemas(
  document: JsonObject,
  groupName: "operations" | "resources",
  locations: EmbeddedSchemaLocation[],
): void {
  const group = document[groupName];
  if (!isJsonObject(group)) return;
  for (const [capabilityId, capabilityValue] of sortedEntries(group)) {
    if (!isJsonObject(capabilityValue)) continue;
    const capabilityPointer = childPointer(ROOT_POINTER, groupName, capabilityId);
    locateNamedSchema(locations, capabilityValue, capabilityPointer, "inputSchema");
    locateNamedSchema(locations, capabilityValue, capabilityPointer, "outputSchema");
  }
}

function locateCatalogSchemas(document: JsonObject): readonly EmbeddedSchemaLocation[] {
  const locations: EmbeddedSchemaLocation[] = [];
  locateComponentLikeSchemas(document, "components", locations);
  locateComponentLikeSchemas(document, "behaviors", locations);
  locateInputOutputSchemas(document, "operations", locations);
  locateInputOutputSchemas(document, "resources", locations);
  return locations;
}

function isLocalReference(reference: string): boolean {
  return reference === "" || reference.startsWith("#");
}

function checkRegularExpression(
  pattern: string,
  pointer: JsonPointer,
  diagnostics: StructuralDiagnostic[],
): void {
  try {
    // JSON Schema Draft 2020-12 regular expressions use the ECMA-262 Unicode-aware grammar.
    new RegExp(pattern, "u");
  } catch {
    diagnostics.push(
      schemaDiagnostic("An embedded schema contains an invalid regular expression.", pointer),
    );
  }
}

function walkSchema(
  schema: JsonValue,
  pointer: JsonPointer,
  diagnostics: StructuralDiagnostic[],
): void {
  if (typeof schema === "boolean" || !isJsonObject(schema)) return;

  const dialect = schema.$schema;
  if (typeof dialect === "string" && dialect !== DRAFT_2020_12) {
    diagnostics.push(
      schemaDiagnostic(
        "Embedded schemas must use the DESEN Draft 2020-12 dialect.",
        childPointer(pointer, "$schema"),
      ),
    );
  }

  const identifier = schema.$id;
  if (
    typeof identifier === "string" &&
    (!isUriReference(identifier) ||
      identifier === "" ||
      (identifier.includes("#") && !identifier.endsWith("#")))
  ) {
    diagnostics.push(
      schemaDiagnostic(
        "An embedded schema $id must be a valid non-empty URI reference without a non-empty fragment.",
        childPointer(pointer, "$id"),
      ),
    );
  }

  for (const referenceKeyword of ["$ref", "$dynamicRef"] as const) {
    const reference = schema[referenceKeyword];
    if (typeof reference === "string") {
      if (!isUriReference(reference)) {
        diagnostics.push(
          schemaDiagnostic(
            "An embedded schema reference must use valid RFC 3986 URI-reference syntax.",
            childPointer(pointer, referenceKeyword),
          ),
        );
      } else if (!isLocalReference(reference)) {
        diagnostics.push(
          schemaDiagnostic(
            "Embedded schemas may use only document-local references.",
            childPointer(pointer, referenceKeyword),
          ),
        );
      }
    }
  }

  const vocabulary = schema.$vocabulary;
  if (isJsonObject(vocabulary)) {
    for (const [vocabularyId] of sortedEntries(vocabulary)) {
      if (!isAbsoluteUri(vocabularyId)) {
        diagnostics.push(
          schemaDiagnostic(
            "An embedded schema vocabulary identifier must be a valid absolute URI.",
            childPointer(pointer, "$vocabulary", vocabularyId),
          ),
        );
      }
    }
  }

  if (typeof schema.pattern === "string") {
    checkRegularExpression(schema.pattern, childPointer(pointer, "pattern"), diagnostics);
  }

  const patternProperties = schema.patternProperties;
  if (isJsonObject(patternProperties)) {
    for (const [pattern, childSchema] of sortedEntries(patternProperties)) {
      checkRegularExpression(
        pattern,
        childPointer(pointer, "patternProperties", pattern),
        diagnostics,
      );
      walkSchema(childSchema, childPointer(pointer, "patternProperties", pattern), diagnostics);
    }
  }

  for (const keyword of SINGLE_SCHEMA_KEYWORDS) {
    const childSchema = schema[keyword];
    if (childSchema !== undefined) {
      walkSchema(childSchema, childPointer(pointer, keyword), diagnostics);
    }
  }

  for (const keyword of ARRAY_SCHEMA_KEYWORDS) {
    const childSchemas = schema[keyword];
    if (!Array.isArray(childSchemas)) continue;
    childSchemas.forEach((childSchema, index) => {
      walkSchema(childSchema, childPointer(pointer, keyword, String(index)), diagnostics);
    });
  }

  for (const keyword of MAP_SCHEMA_KEYWORDS) {
    if (keyword === "patternProperties") continue;
    const childSchemas = schema[keyword];
    if (!isJsonObject(childSchemas)) continue;
    for (const [name, childSchema] of sortedEntries(childSchemas)) {
      walkSchema(childSchema, childPointer(pointer, keyword, name), diagnostics);
    }
  }
}

function validateOneEmbeddedSchema(
  location: EmbeddedSchemaLocation,
  metaValidator: GeneratedValidator,
  diagnostics: StructuralDiagnostic[],
): void {
  if (!metaValidator(location.schema)) {
    for (const error of metaValidator.errors ?? []) {
      diagnostics.push(diagnosticFromAjvError(error, location.pointer, "embedded"));
    }
  }
  walkSchema(location.schema, location.pointer, diagnostics);
}

/** Validates every protocol-defined embedded-schema location without applying it to instance data. */
export function validateEmbeddedSchemas(
  target: "source" | "bundle" | "catalog",
  document: JsonObject,
  metaValidator: GeneratedValidator,
): readonly StructuralDiagnostic[] {
  const locations =
    target === "catalog" ? locateCatalogSchemas(document) : locateStateSchemas(document);
  const diagnostics: StructuralDiagnostic[] = [];
  for (const location of locations) {
    validateOneEmbeddedSchema(location, metaValidator, diagnostics);
  }
  return diagnostics;
}
