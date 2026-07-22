import { appendJsonPointer, canonicalizeJson, createCoreDiagnostic } from "@desen/protocol";

import {
  validateBundle as generatedValidateBundle,
  validateCatalog as generatedValidateCatalog,
  validateDraft202012 as generatedValidateDraft202012,
  validateSource as generatedValidateSource,
} from "./generated/0.1.0/structural-validators.js";
import { validateEmbeddedSchemas } from "./embedded-schema-validation.js";
import {
  diagnosticFromAjvError,
  normalizeDiagnostics,
  unsupportedProtocolDiagnostic,
} from "./structural-diagnostics.js";
import { isJsonObject, ROOT_POINTER } from "./validation-internals.js";

import type { DesenBundle, DesenCatalog, DesenCoreDiagnostic, DesenSource } from "@desen/protocol";
import type { StructuralDiagnosticCode } from "./structural-diagnostics.js";
import type { GeneratedValidator, JsonObject, JsonValue } from "./validation-internals.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

/** A DESEN 0.1.0 document kind accepted by structural validation. */
export type DesenStructuralTarget = "source" | "bundle" | "catalog";

/** The frozen protocol document type associated with a structural-validation target. */
export type DesenDocumentForTarget<Target extends DesenStructuralTarget> = Target extends "source"
  ? DesenSource
  : Target extends "bundle"
    ? DesenBundle
    : DesenCatalog;

/** Recursively read-only JSON data returned after successful structural validation. */
export type ImmutableJson<Value> = Value extends null | boolean | number | string
  ? Value
  : Value extends readonly (infer Item)[]
    ? readonly ImmutableJson<Item>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: ImmutableJson<Value[Key]> }
      : never;

/** The exact core diagnostic codes that the M02-T06 structural layer may emit. */
export type DesenStructuralDiagnosticCode = StructuralDiagnosticCode;

/** A frozen, JSON-serializable diagnostic emitted by structural validation. */
export type DesenStructuralDiagnostic = Readonly<
  DesenCoreDiagnostic<DesenStructuralDiagnosticCode>
>;

/** Successful validation with an inert, recursively frozen document snapshot. */
export interface DesenStructuralValidationSuccess<Target extends DesenStructuralTarget> {
  /** Confirms that root and embedded-schema structure passed. */
  readonly valid: true;
  /** Identifies which frozen root schema was applied. */
  readonly target: Target;
  /** An independent immutable JSON snapshot; the caller's input is never retained. */
  readonly value: ImmutableJson<DesenDocumentForTarget<Target>>;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
}

/** Failed validation with deterministic protocol diagnostics and no trusted value. */
export interface DesenStructuralValidationFailure<Target extends DesenStructuralTarget> {
  /** Confirms that no validated document value is available. */
  readonly valid: false;
  /** Identifies which frozen root schema was applied. */
  readonly target: Target;
  /** Sorted, de-duplicated structural diagnostics. */
  readonly diagnostics: readonly DesenStructuralDiagnostic[];
}

/** Discriminated result of DESEN root and embedded-schema structural validation. */
export type DesenStructuralValidationResult<Target extends DesenStructuralTarget> =
  DesenStructuralValidationSuccess<Target> | DesenStructuralValidationFailure<Target>;

const ROOT_VALIDATORS: Readonly<Record<DesenStructuralTarget, GeneratedValidator>> = Object.freeze({
  source: generatedValidateSource as GeneratedValidator,
  bundle: generatedValidateBundle as GeneratedValidator,
  catalog: generatedValidateCatalog as GeneratedValidator,
});
const META_SCHEMA_VALIDATOR = generatedValidateDraft202012 as GeneratedValidator;

function deepFreezeJson(value: JsonValue): JsonValue {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreezeJson(item));
  } else if (isJsonObject(value)) {
    Object.keys(value).forEach((key) => deepFreezeJson(value[key] as JsonValue));
  }
  return Object.freeze(value);
}

function inertSnapshot(input: unknown): JsonValue | undefined {
  try {
    return deepFreezeJson(JSON.parse(canonicalizeJson(input)) as JsonValue);
  } catch {
    return undefined;
  }
}

function invalidInputResult<Target extends DesenStructuralTarget>(
  target: Target,
): DesenStructuralValidationFailure<Target> {
  return Object.freeze({
    valid: false,
    target,
    diagnostics: Object.freeze([
      createCoreDiagnostic({
        code: "SCHEMA_INVALID",
        message: "Input must be inert RFC 8785-compatible JSON data.",
        pointer: ROOT_POINTER,
      }),
    ]),
  });
}

function validationFailure<Target extends DesenStructuralTarget>(
  target: Target,
  diagnostics: readonly DesenStructuralDiagnostic[],
): DesenStructuralValidationFailure<Target> {
  return Object.freeze({ valid: false, target, diagnostics });
}

function validationSuccess<Target extends DesenStructuralTarget>(
  target: Target,
  snapshot: JsonValue,
): DesenStructuralValidationSuccess<Target> {
  return Object.freeze({
    valid: true,
    target,
    value: snapshot as ImmutableJson<DesenDocumentForTarget<Target>>,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function assertTarget(target: string): asserts target is DesenStructuralTarget {
  if (target !== "source" && target !== "bundle" && target !== "catalog") {
    throw new TypeError("DESEN structural target must be `source`, `bundle`, or `catalog`.");
  }
}

function hasUnsupportedProtocolVersion(snapshot: JsonValue): boolean {
  return (
    isJsonObject(snapshot) &&
    Object.hasOwn(snapshot, "desen") &&
    typeof snapshot.desen === "string" &&
    snapshot.desen !== "0.1.0"
  );
}

/**
 * Validates unknown input against one exact DESEN 0.1.0 root schema and every embedded schema.
 *
 * @remarks Validation is platform-neutral and side-effect free. The input is copied through RFC
 * 8785 canonical JSON before generated validators inspect it. This task validates schema structure
 * only; identity, catalog resolution, references, digest integrity, and runtime values remain owned
 * by later validation stages.
 *
 * @throws TypeError only when `target` is not one of the three public target literals.
 */
export function validateDesenStructure<Target extends DesenStructuralTarget>(
  target: Target,
  input: unknown,
): DesenStructuralValidationResult<Target> {
  assertTarget(target);
  const snapshot = inertSnapshot(input);
  if (snapshot === undefined) return invalidInputResult(target);

  try {
    const rootValidator = ROOT_VALIDATORS[target];
    if (!rootValidator(snapshot)) {
      const unsupportedProtocol = hasUnsupportedProtocolVersion(snapshot);
      const rootDiagnostics = (rootValidator.errors ?? [])
        .filter(
          (error) =>
            !(unsupportedProtocol && error.keyword === "const" && error.instancePath === "/desen"),
        )
        .map((error) => diagnosticFromAjvError(error, ROOT_POINTER, "root"));
      if (unsupportedProtocol) {
        rootDiagnostics.push(
          unsupportedProtocolDiagnostic(appendJsonPointer(ROOT_POINTER, "desen")),
        );
      }
      const diagnostics = normalizeDiagnostics(rootDiagnostics);
      return validationFailure(target, diagnostics);
    }

    if (!isJsonObject(snapshot)) {
      // The generated root schemas require an object, so this is defensive against artifact drift.
      return invalidInputResult(target);
    }

    const embeddedDiagnostics = normalizeDiagnostics(
      validateEmbeddedSchemas(target, snapshot as JsonObject, META_SCHEMA_VALIDATOR),
    );
    return embeddedDiagnostics.length === 0
      ? validationSuccess(target, snapshot)
      : validationFailure(target, embeddedDiagnostics);
  } catch (error) {
    if (error instanceof RangeError) return invalidInputResult(target);
    throw error;
  }
}

/** Validates unknown input as a DESEN 0.1.0 editable Source document. */
export function validateDesenSource(input: unknown): DesenStructuralValidationResult<"source"> {
  return validateDesenStructure("source", input);
}

/** Validates unknown input as a DESEN 0.1.0 published Bundle document. */
export function validateDesenBundle(input: unknown): DesenStructuralValidationResult<"bundle"> {
  return validateDesenStructure("bundle", input);
}

/** Validates unknown input as a DESEN 0.1.0 capability Catalog document. */
export function validateDesenCatalog(input: unknown): DesenStructuralValidationResult<"catalog"> {
  return validateDesenStructure("catalog", input);
}
