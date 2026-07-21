import { isJsonPointer } from "./json-pointer.ts";

import type { JsonPointer } from "./json-pointer.js";

const CORE_DIAGNOSTIC_DATA = [
  ["SCHEMA_INVALID", "schema", "Document failed its normative JSON Schema"],
  ["UNKNOWN_CORE_FIELD", "schema", "Closed core object contains an unknown field"],
  ["DUPLICATE_SURFACE_ID", "semantic", "Surface identity is duplicated or key/id differ"],
  ["DUPLICATE_NODE_ID", "semantic", "Node or behavior identity is duplicated in a surface"],
  ["ENTRY_NOT_FOUND", "semantic", "Entry surface does not exist"],
  ["UNKNOWN_CAPABILITY", "catalog", "Component, behavior, operation, or resource is undeclared"],
  ["AMBIGUOUS_CAPABILITY", "catalog", "Capability id resolves more than once"],
  ["UNKNOWN_PROP", "catalog", "Property is not accepted by the capability schema"],
  ["PROP_TYPE_MISMATCH", "catalog/runtime", "Resolved property is invalid for its schema"],
  ["UNKNOWN_SLOT", "catalog", "Slot is undeclared"],
  ["SLOT_CARDINALITY", "catalog", "Slot item count is invalid"],
  ["SLOT_CHILD_REJECTED", "catalog", "Child capability/category is not accepted"],
  ["UNKNOWN_EVENT", "catalog", "Event handler targets an undeclared event"],
  ["EVENT_PAYLOAD_INVALID", "runtime", "Adapter emitted invalid event payload"],
  ["UNKNOWN_COMMAND", "catalog", "Component command is undeclared"],
  ["COMMAND_INPUT_INVALID", "runtime", "Resolved command input is invalid"],
  ["BEHAVIOR_ATTACHMENT_INVALID", "catalog", "Behavior cannot attach to target component"],
  ["BEHAVIOR_CONFLICT", "catalog", "Attached behaviors have incompatible channels"],
  ["STATE_WRITE_INVALID", "runtime", "State write violates its state schema"],
  ["REFERENCE_UNRESOLVED", "runtime", "Required reference has no value or fallback"],
  ["PREDICATE_TYPE_MISMATCH", "runtime", "Predicate operands are incompatible"],
  ["REPEAT_ITEMS_INVALID", "runtime", "Repeat items are not an array"],
  ["REPEAT_KEY_INVALID", "runtime", "Repeat key is missing, invalid, or duplicated"],
  ["OPERATION_INPUT_INVALID", "runtime", "Operation input violates its schema"],
  ["OPERATION_OUTPUT_INVALID", "runtime", "Operation output violates its schema"],
  ["OPERATION_DENIED", "runtime", "Host policy denied an invocation"],
  ["RESOURCE_INPUT_INVALID", "runtime", "Resource input violates its schema"],
  ["RESOURCE_OUTPUT_INVALID", "runtime", "Resource output violates its schema"],
  ["ACTION_LIMIT_EXCEEDED", "runtime", "Action turn exceeded configured bound"],
  ["REVISION_MISMATCH", "integrity", "Bundle revision does not match canonical content"],
  ["SOURCE_DIGEST_MISMATCH", "integrity", "Bundle source digest does not match source"],
  [
    "CATALOG_DIGEST_MISMATCH",
    "activation",
    "Required package digest differs from installed package",
  ],
  ["CATALOG_VERSION_UNAVAILABLE", "activation", "Exact package tuple cannot be resolved"],
  ["UNSUPPORTED_PROTOCOL", "activation", "Runtime does not support the document version"],
  ["BUNDLE_LIMIT_EXCEEDED", "activation", "Bundle violates resource limits"],
  ["ADAPTER_FAILURE", "runtime", "Capability adapter failed unexpectedly"],
] as const;

/** A stable core diagnostic code defined by DESEN 0.1.0 Appendix B. */
export type CoreDiagnosticCode = (typeof CORE_DIAGNOSTIC_DATA)[number][0];

/**
 * The exact classification text assigned by DESEN 0.1.0 Appendix B.
 *
 * @remarks This metadata is not an emission phase or a conformance-suite outcome category.
 * `catalog/runtime` is deliberately preserved as the protocol's composite literal.
 */
export type CoreDiagnosticClassification = (typeof CORE_DIAGNOSTIC_DATA)[number][1];

/** A frozen entry in the DESEN 0.1.0 core diagnostic registry. */
export interface CoreDiagnosticDefinition {
  /** Stable machine-readable code. */
  readonly code: CoreDiagnosticCode;
  /** Exact Appendix B classification, independent of where an implementation detects the error. */
  readonly classification: CoreDiagnosticClassification;
  /** Canonical English meaning from Appendix B; instance messages may add safe context. */
  readonly meaning: string;
}

/** Identifies whether a diagnostic subject is a source node or a behavior instance. */
export interface DesenDiagnosticSubject {
  /** Kind of source identity referenced by the diagnostic. */
  readonly kind: "node" | "behavior";
  /** Stable node or behavior-instance identifier. */
  readonly id: string;
}

/**
 * Stable source context carried by a DESEN diagnostic when each value is available.
 *
 * @remarks Optionality reflects diagnostics that apply to a whole document or arise before a
 * deeper identity can be recovered. Property, slot, event, command, and action locations belong in
 * the diagnostic's JSON Pointer instead of a second path syntax.
 */
export interface DesenDiagnosticContext {
  /** Top-level Source or Bundle `id`. */
  readonly documentId?: string;
  /** Stable surface identifier. */
  readonly surfaceId?: string;
  /** Stable node or behavior identity. */
  readonly subject?: DesenDiagnosticSubject;
  /** Fully qualified capability identifier. */
  readonly capabilityId?: string;
}

/**
 * Plain, JSON-serializable diagnostic data shared by validators, publishers, runtimes, and tools.
 *
 * @typeParam Code Stable core code or an implementation-defined namespaced code. DESEN 0.1.0 does
 * not define the namespace grammar, so extensions must document their own collision-resistant
 * convention and must not reuse a core code.
 *
 * @remarks `code` and an available `pointer` are machine contracts; `message` is explanatory text
 * and is not a localization or compatibility key. The model intentionally excludes `Error`, stack,
 * cause, arbitrary details, and provider payloads so diagnostics stay portable and safe to serialize.
 */
export interface DesenDiagnostic<Code extends string = CoreDiagnosticCode> {
  /** Stable core or namespaced diagnostic identity. */
  readonly code: Code;
  /** Safe human-readable explanation; consumers must not branch on this text. */
  readonly message: string;
  /** Exact failing location, including `""` when the known location is the document root. */
  readonly pointer?: JsonPointer;
  /** Stable document and capability identities available at the point of detection. */
  readonly context?: DesenDiagnosticContext;
}

/**
 * A core diagnostic enriched with its exact Appendix B classification.
 *
 * @remarks The classification is registry metadata, not the stage at which the diagnostic was
 * emitted. Instances are created by {@link createCoreDiagnostic} so code and classification cannot
 * drift apart.
 */
export interface DesenCoreDiagnostic<
  Code extends CoreDiagnosticCode = CoreDiagnosticCode,
> extends DesenDiagnostic<Code> {
  /** Exact Appendix B classification derived from `code`. */
  readonly classification: (typeof CORE_DIAGNOSTIC_BY_CODE)[Code]["classification"];
}

/** Input accepted by {@link createCoreDiagnostic}. */
export interface CreateCoreDiagnosticInput<Code extends CoreDiagnosticCode = CoreDiagnosticCode> {
  /** Stable DESEN 0.1.0 core code. */
  readonly code: Code;
  /** Safe, non-empty human-readable explanation. */
  readonly message: string;
  /** Valid JSON Pointer when the failing location is available. */
  readonly pointer?: JsonPointer;
  /** Stable source identities available at the point of detection. */
  readonly context?: DesenDiagnosticContext;
}

type CoreDiagnosticByCode = {
  readonly [Code in CoreDiagnosticCode]: Readonly<{
    code: Code;
    classification: Extract<
      (typeof CORE_DIAGNOSTIC_DATA)[number],
      readonly [Code, string, string]
    >[1];
    meaning: string;
  }>;
};

const CORE_DIAGNOSTIC_BY_CODE = Object.freeze(
  Object.fromEntries(
    CORE_DIAGNOSTIC_DATA.map(([code, classification, meaning]) => [
      code,
      Object.freeze({ code, classification, meaning }),
    ]),
  ),
) as CoreDiagnosticByCode;

/**
 * Immutable DESEN 0.1.0 Appendix B registry in normative document order.
 *
 * @remarks The array and every definition are frozen for the process lifetime. It is metadata only:
 * later validator and runtime tasks own actual diagnostic emission.
 */
export const CORE_DIAGNOSTIC_REGISTRY: readonly CoreDiagnosticDefinition[] = Object.freeze(
  CORE_DIAGNOSTIC_DATA.map(([code]) => CORE_DIAGNOSTIC_BY_CODE[code]),
);

function diagnosticFailure(message: string): never {
  throw new TypeError(`Invalid DESEN diagnostic: ${message}`);
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    diagnosticFailure(`${label} must be a non-empty string`);
  }
  return value;
}

interface OwnDataProperty {
  readonly present: boolean;
  readonly value: unknown;
}

function ownDataProperty(object: object, key: PropertyKey, label: string): OwnDataProperty {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(object, key);
  } catch {
    diagnosticFailure(`${label} could not be read safely`);
  }
  if (descriptor === undefined) return { present: false, value: undefined };
  if (!("value" in descriptor)) {
    diagnosticFailure(`${label} must be an own data property`);
  }
  return { present: true, value: descriptor.value };
}

function normalizeContext(context: unknown): Readonly<DesenDiagnosticContext> | undefined {
  if (context === undefined) return undefined;
  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    diagnosticFailure("context must be an object when supplied");
  }

  const normalized: {
    documentId?: string;
    surfaceId?: string;
    subject?: Readonly<DesenDiagnosticSubject>;
    capabilityId?: string;
  } = {};
  const documentId = ownDataProperty(context, "documentId", "context.documentId");
  const surfaceId = ownDataProperty(context, "surfaceId", "context.surfaceId");
  const subject = ownDataProperty(context, "subject", "context.subject");
  const capabilityId = ownDataProperty(context, "capabilityId", "context.capabilityId");

  if (documentId.present && documentId.value !== undefined) {
    normalized.documentId = nonEmptyString(documentId.value, "context.documentId");
  }
  if (surfaceId.present && surfaceId.value !== undefined) {
    normalized.surfaceId = nonEmptyString(surfaceId.value, "context.surfaceId");
  }
  if (subject.present && subject.value !== undefined) {
    if (
      typeof subject.value !== "object" ||
      subject.value === null ||
      Array.isArray(subject.value)
    ) {
      diagnosticFailure("context.subject must be an object when supplied");
    }
    const kind = ownDataProperty(subject.value, "kind", "context.subject.kind");
    const id = ownDataProperty(subject.value, "id", "context.subject.id");
    if (kind.value !== "node" && kind.value !== "behavior") {
      diagnosticFailure("context.subject.kind must be `node` or `behavior`");
    }
    normalized.subject = Object.freeze({
      kind: kind.value,
      id: nonEmptyString(id.value, "context.subject.id"),
    });
  }
  if (capabilityId.present && capabilityId.value !== undefined) {
    normalized.capabilityId = nonEmptyString(capabilityId.value, "context.capabilityId");
  }
  if (Object.keys(normalized).length === 0) {
    diagnosticFailure("context must contain at least one stable identity");
  }
  return Object.freeze(normalized);
}

/**
 * Tests whether an unknown value is one of the 36 DESEN 0.1.0 core diagnostic codes.
 *
 * @remarks The check is exact and case-sensitive. Namespaced extension codes return `false`.
 */
export function isCoreDiagnosticCode(value: unknown): value is CoreDiagnosticCode {
  return typeof value === "string" && Object.hasOwn(CORE_DIAGNOSTIC_BY_CODE, value);
}

/**
 * Looks up immutable Appendix B metadata for a possible core diagnostic code.
 *
 * @remarks Unknown and namespaced codes return `undefined`; the registry is never mutated.
 */
export function getCoreDiagnosticDefinition(code: unknown): CoreDiagnosticDefinition | undefined {
  return isCoreDiagnosticCode(code) ? CORE_DIAGNOSTIC_BY_CODE[code] : undefined;
}

/**
 * Creates frozen, JSON-serializable data for one DESEN 0.1.0 core diagnostic.
 *
 * @remarks The Appendix B classification is derived from `code`; callers cannot provide a
 * conflicting value. Optional fields are omitted rather than serialized as `undefined`, while an
 * explicit root pointer `""` is preserved. Caller-owned values are copied into inert frozen data;
 * accessor properties are rejected without being invoked.
 *
 * @throws TypeError when the code, message, pointer, or supplied context is invalid.
 */
export function createCoreDiagnostic<Code extends CoreDiagnosticCode>(
  input: CreateCoreDiagnosticInput<Code>,
): Readonly<DesenCoreDiagnostic<Code>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    diagnosticFailure("input must be an object");
  }
  const code = ownDataProperty(input, "code", "code").value;
  const messageValue = ownDataProperty(input, "message", "message").value;
  const pointerValue = ownDataProperty(input, "pointer", "pointer").value;
  const contextValue = ownDataProperty(input, "context", "context").value;

  if (!isCoreDiagnosticCode(code)) diagnosticFailure("code is not a core diagnostic code");
  const message = nonEmptyString(messageValue, "message");
  if (pointerValue !== undefined && !isJsonPointer(pointerValue)) {
    diagnosticFailure("pointer must be a valid RFC 6901 JSON Pointer");
  }
  const pointer = pointerValue;
  const context = normalizeContext(contextValue);
  const definition = CORE_DIAGNOSTIC_BY_CODE[code];

  return Object.freeze({
    code,
    classification: definition.classification,
    message,
    ...(pointer !== undefined ? { pointer } : {}),
    ...(context !== undefined ? { context } : {}),
  }) as Readonly<DesenCoreDiagnostic<Code>>;
}
