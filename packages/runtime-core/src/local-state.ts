import {
  appendJsonPointer,
  canonicalizeJson,
  createJsonPointer,
  isJsonPointer,
  parseJsonPointer,
} from "@desen/protocol";
import { applySchemaContract, validateSchemaContractGraph } from "@desen/validator/schema-contract";
import { validateDraft202012 } from "@desen/validator/schema-contract-syntax";

import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";

import type { JsonPointer } from "@desen/protocol";
import type {
  SchemaContractGraphIssue,
  SchemaContractIssue,
} from "@desen/validator/schema-contract";
import type {
  Draft202012SyntaxError,
  Draft202012SyntaxValidator,
} from "@desen/validator/schema-contract-syntax";
import type { RuntimeJsonObject, RuntimeJsonValue } from "./host-ports.js";

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const DRAFT_2020_12_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const ROOT_POINTER = createJsonPointer();
const STATE_HANDLE_BRAND = new WeakSet<object>();
const STATE_SNAPSHOT_BRAND = new WeakSet<object>();
declare const RUNTIME_SURFACE_STATE_HANDLE_TYPE_BRAND: unique symbol;
declare const RUNTIME_SURFACE_STATE_SNAPSHOT_TYPE_BRAND: unique symbol;

/** One protocol state declaration accepted when a surface state instance is mounted. */
export interface RuntimeSurfaceStateEntrySpec {
  /** Draft 2020-12 schema object prepared by the validator layer. */
  readonly schema: RuntimeJsonObject;
  /** Resolved JSON value used for every fresh mount. */
  readonly initial: RuntimeJsonValue;
  /** Opaque protocol extension data that this runtime primitive does not interpret. */
  readonly extensions?: RuntimeJsonObject;
}

/** Complete input used to create a fresh surface-local state instance. */
export interface RuntimeSurfaceStateMountInput {
  /** Exact protocol surface identifier that owns the state lifetime. */
  readonly surfaceId: string;
  /** State declarations keyed by their exact protocol names. */
  readonly state: Readonly<Record<string, RuntimeSurfaceStateEntrySpec>>;
}

/**
 * Opaque authority for one mounted surface-local state lifetime.
 *
 * @remarks Values are intentionally absent from the handle. Use
 * {@link readRuntimeSurfaceState} to obtain an immutable snapshot. Runtime operations reject
 * forged handles, and disposal removes the live values and schemas held behind this authority.
 */
export interface RuntimeSurfaceStateHandle {
  /** Compile-time opaque marker; the corresponding runtime brand is held outside the value. */
  readonly [RUNTIME_SURFACE_STATE_HANDLE_TYPE_BRAND]: true;
  /** Exact surface identifier associated with this lifetime. */
  readonly surfaceId: string;
}

/**
 * Detached, recursively immutable values from one surface-state generation.
 *
 * @remarks Historical snapshots may remain readable when retained by a caller, but they cannot be
 * used as mutation authority. `values` can be supplied directly as the `state` namespace of
 * {@link createRuntimeResolutionSnapshot}.
 */
export interface RuntimeSurfaceStateSnapshot {
  /** Compile-time opaque marker; the corresponding runtime brand is held outside the value. */
  readonly [RUNTIME_SURFACE_STATE_SNAPSHOT_TYPE_BRAND]: true;
  /** Exact owning surface identifier. */
  readonly surfaceId: string;
  /** Zero-based generation incremented only by an observable accepted write. */
  readonly generation: number;
  /** Complete state-entry values keyed by exact declaration name. */
  readonly values: RuntimeJsonObject;
}

/** One deterministic schema failure relative to a complete state entry. */
export interface RuntimeSurfaceStateIssue {
  /** Separates syntax, runtime-profile, graph, and instance-validation failures. */
  readonly kind: "graph" | "mismatch" | "profile" | "syntax" | "unknown-property";
  /** RFC 6901 JSON Pointer relative to the schema or complete state value. */
  readonly pointer: JsonPointer;
  /** Draft keyword or bounded-profile rule responsible for rejection. */
  readonly keyword: string;
}

/** Stable reason why a complete surface state could not be mounted. */
export type RuntimeSurfaceStateMountInvalidReason =
  | "unsafe-or-unbounded-input"
  | "malformed-surface-id"
  | "malformed-state-entry"
  | "invalid-state-schema"
  | "invalid-initial-value";

/** Failed all-or-nothing state initialization with no handle or partial values. */
export interface RuntimeSurfaceStateMountInvalid {
  /** Discriminates initialization failure from a mounted state. */
  readonly status: "invalid";
  /** Stable failure classification. */
  readonly reason: RuntimeSurfaceStateMountInvalidReason;
  /** Exact failing entry, or `null` when no entry can be identified safely. */
  readonly entryName: string | null;
  /** Input-relative location of the failure. */
  readonly pointer: JsonPointer;
  /** Deterministically ordered schema details, empty for structural failures. */
  readonly issues: readonly RuntimeSurfaceStateIssue[];
}

/** Complete outcome of creating a fresh surface-local state lifetime. */
export type RuntimeSurfaceStateMountResult =
  | Readonly<{
      /** Confirms that all declarations and initials were accepted atomically. */
      status: "mounted";
      /** Opaque authority used for later reads, writes, and disposal. */
      handle: RuntimeSurfaceStateHandle;
      /** Generation-zero values detached from the protocol document. */
      snapshot: RuntimeSurfaceStateSnapshot;
    }>
  | RuntimeSurfaceStateMountInvalid;

/** Complete outcome of reading one surface-state handle. */
export type RuntimeSurfaceStateReadResult =
  | Readonly<{
      /** The handle is active and yielded its current immutable snapshot. */
      status: "active";
      /** Current state generation. */
      snapshot: RuntimeSurfaceStateSnapshot;
    }>
  | Readonly<{
      /** The handle was valid but its lifetime has ended. */
      status: "disposed";
      /** Exact former owning surface. */
      surfaceId: string;
    }>
  | Readonly<{
      /** The supplied value was not created by the mount factory. */
      status: "invalid";
      /** Stable rejection classification. */
      reason: "forged-handle";
    }>;

/** One already-resolved state write request; action dispatch and ValueSpec evaluation are separate. */
export interface RuntimeSurfaceStateWriteInput {
  /** Protocol action path whose first dot-delimited segment is the complete state entry name. */
  readonly path: string;
  /** Resolved inert JSON value to install at the root or selected object property. */
  readonly value: RuntimeJsonValue;
}

/** Stable reason why an active state write was rejected atomically. */
export type RuntimeSurfaceStateWriteRejectedReason =
  | "unsafe-or-unbounded-value"
  | "malformed-request"
  | "malformed-path"
  | "unknown-state"
  | "missing-parent"
  | "non-object-parent"
  | "schema-mismatch";

/** Protocol-classified state-write rejection carrying no candidate or partial state. */
export interface RuntimeSurfaceStateWriteRejected {
  /** Discriminates a rejected write from an update, no-op, or inactive handle. */
  readonly status: "rejected";
  /** Frozen protocol diagnostic assigned to invalid runtime state writes. */
  readonly code: "STATE_WRITE_INVALID";
  /** Stable runtime classification of the rejection. */
  readonly reason: RuntimeSurfaceStateWriteRejectedReason;
  /** Exact path when safely captured, otherwise `null`. */
  readonly path: string | null;
  /** Complete-entry-relative schema failures, empty for path and safety failures. */
  readonly issues: readonly RuntimeSurfaceStateIssue[];
}

/** Complete outcome of one resolved JSON write against a surface-local state handle. */
export type RuntimeSurfaceStateWriteResult =
  | Readonly<{
      /** The candidate differed, validated, and became the next atomic generation. */
      status: "updated";
      /** New current immutable snapshot. */
      snapshot: RuntimeSurfaceStateSnapshot;
    }>
  | Readonly<{
      /** The candidate was canonically identical, validated, and caused no generation change. */
      status: "unchanged";
      /** Existing current immutable snapshot. */
      snapshot: RuntimeSurfaceStateSnapshot;
    }>
  | RuntimeSurfaceStateWriteRejected
  | Readonly<{
      /** The handle was valid but its lifetime had already ended. */
      status: "disposed";
      /** Exact former owning surface. */
      surfaceId: string;
    }>
  | Readonly<{
      /** The supplied handle was not created by the mount factory. */
      status: "invalid";
      /** Stable rejection classification. */
      reason: "forged-handle";
    }>;

/** Complete idempotent outcome of ending a surface-state lifetime. */
export type RuntimeSurfaceStateDisposeResult =
  | Readonly<{
      /** The live values and schemas were released by this call. */
      status: "disposed";
      /** Exact former owning surface. */
      surfaceId: string;
    }>
  | Readonly<{
      /** The valid handle was already terminal. */
      status: "already-disposed";
      /** Exact former owning surface. */
      surfaceId: string;
    }>
  | Readonly<{
      /** The supplied handle was not created by the mount factory. */
      status: "invalid";
      /** Stable rejection classification. */
      reason: "forged-handle";
    }>;

interface ActiveSurfaceState {
  readonly status: "active";
  readonly schemas: Readonly<Record<string, RuntimeJsonObject>>;
  snapshot: RuntimeSurfaceStateSnapshot;
}

interface DisposedSurfaceState {
  readonly status: "disposed";
  readonly surfaceId: string;
}

type SurfaceStateAuthority = ActiveSurfaceState | DisposedSurfaceState;

const STATE_AUTHORITIES = new WeakMap<object, SurfaceStateAuthority>();

const SCHEMA_SYNTAX_VALIDATOR: Draft202012SyntaxValidator = validateDraft202012;
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
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
] as const);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hasExactKeys(value: RuntimeJsonObject, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort(compareText);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function prefixPointer(base: JsonPointer, relative: JsonPointer): JsonPointer {
  let pointer = base;
  for (const segment of parseJsonPointer(relative)) {
    pointer = appendJsonPointer(pointer, segment);
  }
  return pointer;
}

function entryPointer(entryName: string, member?: "initial" | "schema"): JsonPointer {
  let pointer = appendJsonPointer(appendJsonPointer(ROOT_POINTER, "state"), entryName);
  if (member !== undefined) pointer = appendJsonPointer(pointer, member);
  return pointer;
}

function graphIssues(
  issues: readonly SchemaContractGraphIssue[],
): readonly RuntimeSurfaceStateIssue[] {
  return Object.freeze(
    issues.map((issue) =>
      Object.freeze({
        kind: "graph" as const,
        pointer: issue.pointer,
        keyword: issue.keyword,
      }),
    ),
  );
}

function schemaSyntaxPointer(error: Draft202012SyntaxError): JsonPointer {
  let pointer =
    typeof error.instancePath === "string" && isJsonPointer(error.instancePath)
      ? (error.instancePath as JsonPointer)
      : ROOT_POINTER;
  if (typeof error.propertyName === "string") {
    return appendJsonPointer(pointer, error.propertyName);
  }
  if (typeof error.params === "object" && error.params !== null) {
    for (const field of ["additionalProperty", "missingProperty", "propertyName"]) {
      const value = (error.params as Readonly<Record<string, unknown>>)[field];
      if (typeof value === "string") {
        pointer = appendJsonPointer(pointer, value);
        break;
      }
    }
  }
  return pointer;
}

function schemaProfileIssues(schema: RuntimeJsonObject): readonly RuntimeSurfaceStateIssue[] {
  const issues: RuntimeSurfaceStateIssue[] = [];
  const pending: Readonly<{ pointer: JsonPointer; schema: RuntimeJsonObject }>[] = [
    { pointer: ROOT_POINTER, schema },
  ];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (
      typeof current.schema.$schema === "string" &&
      current.schema.$schema !== DRAFT_2020_12_DIALECT
    ) {
      issues.push(
        Object.freeze({
          kind: "syntax",
          pointer: appendJsonPointer(current.pointer, "$schema"),
          keyword: "$schema",
        }),
      );
    }
    if (Object.hasOwn(current.schema, "$vocabulary")) {
      issues.push(
        Object.freeze({
          kind: "profile",
          pointer: appendJsonPointer(current.pointer, "$vocabulary"),
          keyword: "$vocabulary",
        }),
      );
    }
    for (const keyword of SINGLE_SCHEMA_KEYWORDS) {
      const child = current.schema[keyword];
      if (isRuntimeJsonObject(child)) {
        pending.push({
          pointer: appendJsonPointer(current.pointer, keyword),
          schema: child,
        });
      }
    }
    for (const keyword of ARRAY_SCHEMA_KEYWORDS) {
      const children = current.schema[keyword];
      if (!Array.isArray(children)) continue;
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (isRuntimeJsonObject(child)) {
          pending.push({
            pointer: appendJsonPointer(appendJsonPointer(current.pointer, keyword), index),
            schema: child,
          });
        }
      }
    }
    for (const keyword of MAP_SCHEMA_KEYWORDS) {
      const children = current.schema[keyword];
      if (!isRuntimeJsonObject(children)) continue;
      for (const name of Object.keys(children).sort(compareText).reverse()) {
        const child = children[name];
        if (isRuntimeJsonObject(child)) {
          pending.push({
            pointer: appendJsonPointer(appendJsonPointer(current.pointer, keyword), name),
            schema: child,
          });
        }
      }
    }
  }
  return Object.freeze(
    issues.sort((left, right) => {
      const pointerOrder = compareText(left.pointer, right.pointer);
      return pointerOrder !== 0 ? pointerOrder : compareText(left.keyword, right.keyword);
    }),
  );
}

function syntaxIssues(schema: RuntimeJsonObject): readonly RuntimeSurfaceStateIssue[] {
  let valid: boolean;
  try {
    valid = SCHEMA_SYNTAX_VALIDATOR(schema);
  } catch {
    return Object.freeze([
      Object.freeze({
        kind: "syntax" as const,
        pointer: ROOT_POINTER,
        keyword: "schema",
      }),
    ]);
  }
  const issues: RuntimeSurfaceStateIssue[] = valid
    ? []
    : (SCHEMA_SYNTAX_VALIDATOR.errors ?? []).map((error) =>
        Object.freeze({
          kind: "syntax" as const,
          pointer: schemaSyntaxPointer(error),
          keyword: typeof error.keyword === "string" ? error.keyword : "schema",
        }),
      );
  issues.push(...schemaProfileIssues(schema));
  if (!valid && issues.length === 0) {
    issues.push(
      Object.freeze({
        kind: "syntax",
        pointer: ROOT_POINTER,
        keyword: "schema",
      }),
    );
  }
  return Object.freeze(
    issues
      .sort((left, right) => {
        const pointerOrder = compareText(left.pointer, right.pointer);
        return pointerOrder !== 0 ? pointerOrder : compareText(left.keyword, right.keyword);
      })
      .filter(
        (issue, index, ordered) =>
          index === 0 ||
          issue.pointer !== ordered[index - 1]?.pointer ||
          issue.keyword !== ordered[index - 1]?.keyword,
      ),
  );
}

function contractIssues(
  issues: readonly SchemaContractIssue[],
): readonly RuntimeSurfaceStateIssue[] {
  return Object.freeze(
    issues.map((issue) =>
      Object.freeze({
        kind: issue.kind,
        pointer: issue.pointer,
        keyword: issue.keyword,
      }),
    ),
  );
}

function invalidMount(
  reason: RuntimeSurfaceStateMountInvalidReason,
  entryName: string | null,
  pointer: JsonPointer,
  issues: readonly RuntimeSurfaceStateIssue[] = Object.freeze([]),
): RuntimeSurfaceStateMountInvalid {
  return Object.freeze({ status: "invalid", reason, entryName, pointer, issues });
}

function createStateSnapshot(
  surfaceId: string,
  generation: number,
  values: RuntimeJsonObject,
): RuntimeSurfaceStateSnapshot {
  const snapshot = Object.freeze({ surfaceId, generation, values });
  STATE_SNAPSHOT_BRAND.add(snapshot);
  return snapshot as unknown as RuntimeSurfaceStateSnapshot;
}

function rejectedWrite(
  reason: RuntimeSurfaceStateWriteRejectedReason,
  path: string | null,
  issues: readonly RuntimeSurfaceStateIssue[] = Object.freeze([]),
): RuntimeSurfaceStateWriteRejected {
  return Object.freeze({
    status: "rejected",
    code: "STATE_WRITE_INVALID",
    reason,
    path,
    issues,
  });
}

function replaceNestedObjectProperty(
  root: RuntimeJsonValue,
  segments: readonly string[],
  value: RuntimeJsonValue,
):
  | Readonly<{ status: "replaced"; value: RuntimeJsonValue }>
  | Readonly<{ status: "rejected"; reason: "missing-parent" | "non-object-parent" }> {
  const parents: RuntimeJsonObject[] = [];
  let cursor = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (!isRuntimeJsonObject(cursor)) {
      return Object.freeze({ status: "rejected", reason: "non-object-parent" });
    }
    const segment = segments[index] as string;
    if (!Object.hasOwn(cursor, segment)) {
      return Object.freeze({ status: "rejected", reason: "missing-parent" });
    }
    parents.push(cursor);
    cursor = cursor[segment] as RuntimeJsonValue;
  }
  if (!isRuntimeJsonObject(cursor)) {
    return Object.freeze({ status: "rejected", reason: "non-object-parent" });
  }
  parents.push(cursor);

  let replacement: RuntimeJsonValue = value;
  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const parent = parents[index] as RuntimeJsonObject;
    const copy = Object.create(null) as Record<string, RuntimeJsonValue>;
    for (const key of Object.keys(parent).sort(compareText)) {
      copy[key] = parent[key] as RuntimeJsonValue;
    }
    copy[segments[index] as string] = replacement;
    replacement = copy;
  }
  return Object.freeze({ status: "replaced", value: replacement });
}

/**
 * Creates fresh, detached surface-local state after validating every initial value completely.
 *
 * @remarks The operation is all-or-nothing, performs no host effects, writes nothing to the
 * Source or Bundle, and does not restore data from a prior mount. Schemas pass Draft 2020-12
 * syntax, fail-closed vocabulary-profile, and graph checks before use. ValueSpec-looking property
 * names inside initials are ordinary resolved JSON.
 */
export function mountRuntimeSurfaceState(
  input: RuntimeSurfaceStateMountInput,
): RuntimeSurfaceStateMountResult {
  const captured = snapshotRuntimeJsonValue(input);
  if (captured === undefined || !isRuntimeJsonObject(captured)) {
    return invalidMount("unsafe-or-unbounded-input", null, ROOT_POINTER);
  }
  if (!hasExactKeys(captured, ["state", "surfaceId"])) {
    return invalidMount("unsafe-or-unbounded-input", null, ROOT_POINTER);
  }
  if (typeof captured.surfaceId !== "string" || !IDENTIFIER_PATTERN.test(captured.surfaceId)) {
    return invalidMount("malformed-surface-id", null, appendJsonPointer(ROOT_POINTER, "surfaceId"));
  }
  if (!isRuntimeJsonObject(captured.state)) {
    return invalidMount(
      "unsafe-or-unbounded-input",
      null,
      appendJsonPointer(ROOT_POINTER, "state"),
    );
  }

  const values = Object.create(null) as Record<string, RuntimeJsonValue>;
  const schemas = Object.create(null) as Record<string, RuntimeJsonObject>;
  for (const entryName of Object.keys(captured.state).sort(compareText)) {
    const entry = captured.state[entryName] as RuntimeJsonValue;
    if (!IDENTIFIER_PATTERN.test(entryName) || !isRuntimeJsonObject(entry)) {
      return invalidMount("malformed-state-entry", entryName, entryPointer(entryName));
    }
    const keys = Object.hasOwn(entry, "extensions")
      ? ["extensions", "initial", "schema"]
      : ["initial", "schema"];
    if (
      !hasExactKeys(entry, keys) ||
      !isRuntimeJsonObject(entry.schema) ||
      (Object.hasOwn(entry, "extensions") &&
        !isRuntimeJsonObject(entry.extensions as RuntimeJsonValue))
    ) {
      return invalidMount("malformed-state-entry", entryName, entryPointer(entryName));
    }

    const schema = entry.schema;
    const syntaxFailures = syntaxIssues(schema);
    if (syntaxFailures.length > 0) {
      return invalidMount(
        "invalid-state-schema",
        entryName,
        prefixPointer(
          entryPointer(entryName, "schema"),
          syntaxFailures[0]?.pointer ?? ROOT_POINTER,
        ),
        syntaxFailures,
      );
    }
    const schemaFailures = validateSchemaContractGraph(schema);
    if (schemaFailures.length > 0) {
      const issues = graphIssues(schemaFailures);
      return invalidMount(
        "invalid-state-schema",
        entryName,
        prefixPointer(entryPointer(entryName, "schema"), issues[0]?.pointer ?? ROOT_POINTER),
        issues,
      );
    }

    let validation: ReturnType<typeof applySchemaContract>;
    try {
      validation = applySchemaContract(schema, entry.initial, "complete", "resolved-value");
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return invalidMount("invalid-initial-value", entryName, entryPointer(entryName, "initial"));
    }
    if (validation.issues.length > 0 || validation.obligations.length > 0) {
      const issues = contractIssues(validation.issues);
      return invalidMount(
        "invalid-initial-value",
        entryName,
        prefixPointer(entryPointer(entryName, "initial"), issues[0]?.pointer ?? ROOT_POINTER),
        issues,
      );
    }

    schemas[entryName] = schema;
    values[entryName] = entry.initial as RuntimeJsonValue;
  }

  const capturedValues = snapshotRuntimeJsonValue(values);
  if (capturedValues === undefined || !isRuntimeJsonObject(capturedValues)) {
    return invalidMount(
      "unsafe-or-unbounded-input",
      null,
      appendJsonPointer(ROOT_POINTER, "state"),
    );
  }
  const snapshot = createStateSnapshot(captured.surfaceId, 0, capturedValues);
  const handle = Object.freeze({ surfaceId: captured.surfaceId });
  STATE_HANDLE_BRAND.add(handle);
  STATE_AUTHORITIES.set(handle, {
    status: "active",
    schemas: Object.freeze(schemas),
    snapshot,
  });
  return Object.freeze({
    status: "mounted",
    handle: handle as unknown as RuntimeSurfaceStateHandle,
    snapshot,
  });
}

/**
 * Reads the current immutable state generation without granting mutation authority to the values.
 */
export function readRuntimeSurfaceState(
  handle: RuntimeSurfaceStateHandle,
): RuntimeSurfaceStateReadResult {
  if (typeof handle !== "object" || handle === null || !STATE_HANDLE_BRAND.has(handle)) {
    return Object.freeze({ status: "invalid", reason: "forged-handle" });
  }
  const authority = STATE_AUTHORITIES.get(handle);
  if (authority === undefined) {
    return Object.freeze({ status: "invalid", reason: "forged-handle" });
  }
  return authority.status === "active"
    ? Object.freeze({ status: "active", snapshot: authority.snapshot })
    : Object.freeze({ status: "disposed", surfaceId: authority.surfaceId });
}

/**
 * Applies one resolved JSON root replacement or object-property write atomically.
 *
 * @remarks The first substring before `.` is the complete state entry name; longest-prefix lookup
 * is never attempted. Missing intermediate objects are not invented and arrays are never traversed.
 * A missing final property may be created only if the complete post-write entry validates. The
 * primitive does not evaluate `when`, ValueSpecs, toggles, navigation, or action arrays.
 */
export function writeRuntimeSurfaceState(
  handle: RuntimeSurfaceStateHandle,
  input: RuntimeSurfaceStateWriteInput,
): RuntimeSurfaceStateWriteResult {
  if (typeof handle !== "object" || handle === null || !STATE_HANDLE_BRAND.has(handle)) {
    return Object.freeze({ status: "invalid", reason: "forged-handle" });
  }
  const authority = STATE_AUTHORITIES.get(handle);
  if (authority === undefined) {
    return Object.freeze({ status: "invalid", reason: "forged-handle" });
  }
  if (authority.status === "disposed") {
    return Object.freeze({ status: "disposed", surfaceId: authority.surfaceId });
  }

  const capturedInput = snapshotRuntimeJsonValue(input);
  if (capturedInput === undefined) {
    return rejectedWrite("unsafe-or-unbounded-value", null);
  }
  if (
    !isRuntimeJsonObject(capturedInput) ||
    !hasExactKeys(capturedInput, ["path", "value"]) ||
    typeof capturedInput.path !== "string"
  ) {
    return rejectedWrite("malformed-request", null);
  }
  const path = capturedInput.path;
  const segments = path.split(".");
  if (!IDENTIFIER_PATTERN.test(path) || segments.some((segment) => segment.length === 0)) {
    return rejectedWrite("malformed-path", path);
  }

  const entryName = segments[0] as string;
  if (!Object.hasOwn(authority.schemas, entryName)) {
    return rejectedWrite("unknown-state", path);
  }
  const currentEntry = authority.snapshot.values[entryName] as RuntimeJsonValue;
  const nestedSegments = segments.slice(1);
  let candidateEntry = capturedInput.value as RuntimeJsonValue;
  if (nestedSegments.length > 0) {
    const nested = replaceNestedObjectProperty(
      currentEntry,
      nestedSegments,
      capturedInput.value as RuntimeJsonValue,
    );
    if (nested.status === "rejected") {
      return rejectedWrite(nested.reason, path);
    }
    candidateEntry = nested.value;
  }

  let validation: ReturnType<typeof applySchemaContract>;
  try {
    validation = applySchemaContract(
      authority.schemas[entryName],
      candidateEntry,
      "complete",
      "resolved-value",
    );
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return rejectedWrite("schema-mismatch", path);
  }
  if (validation.issues.length > 0 || validation.obligations.length > 0) {
    return rejectedWrite("schema-mismatch", path, contractIssues(validation.issues));
  }

  const nextValuesInput = Object.create(null) as Record<string, RuntimeJsonValue>;
  for (const name of Object.keys(authority.snapshot.values).sort(compareText)) {
    nextValuesInput[name] =
      name === entryName ? candidateEntry : (authority.snapshot.values[name] as RuntimeJsonValue);
  }
  const capturedValues = snapshotRuntimeJsonValue(nextValuesInput);
  if (capturedValues === undefined || !isRuntimeJsonObject(capturedValues)) {
    return rejectedWrite("unsafe-or-unbounded-value", path);
  }
  const nextEntry = capturedValues[entryName] as RuntimeJsonValue;
  if (canonicalizeJson(nextEntry) === canonicalizeJson(currentEntry)) {
    return Object.freeze({ status: "unchanged", snapshot: authority.snapshot });
  }

  const snapshot = createStateSnapshot(
    authority.snapshot.surfaceId,
    authority.snapshot.generation + 1,
    capturedValues,
  );
  authority.snapshot = snapshot;
  return Object.freeze({ status: "updated", snapshot });
}

/**
 * Ends one surface-state lifetime and releases its live schemas and current values idempotently.
 *
 * @remarks Previously returned immutable snapshots are historical caller-owned observations, not
 * live state and not mutation authority. Secure erasure of those retained copies is not claimed.
 */
export function disposeRuntimeSurfaceState(
  handle: RuntimeSurfaceStateHandle,
): RuntimeSurfaceStateDisposeResult {
  if (typeof handle !== "object" || handle === null || !STATE_HANDLE_BRAND.has(handle)) {
    return Object.freeze({ status: "invalid", reason: "forged-handle" });
  }
  const authority = STATE_AUTHORITIES.get(handle);
  if (authority === undefined) {
    return Object.freeze({ status: "invalid", reason: "forged-handle" });
  }
  if (authority.status === "disposed") {
    return Object.freeze({ status: "already-disposed", surfaceId: authority.surfaceId });
  }
  const surfaceId = authority.snapshot.surfaceId;
  STATE_AUTHORITIES.set(handle, { status: "disposed", surfaceId });
  return Object.freeze({ status: "disposed", surfaceId });
}
