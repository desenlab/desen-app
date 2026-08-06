import { types as utilTypes } from "node:util";

import {
  calculateDesenBundleRevision,
  canonicalizeJson,
  createJsonPointer,
  isJsonPointer,
  sha256Digest,
} from "@desen/protocol";
import { prepareRuntimeActionProgram } from "@desen/runtime-core";
import {
  validateDesenBundleExecutionContracts,
  validateDesenExecutionCatalogSet,
} from "@desen/validator";

import { readBundlePackagePreflightAuthority } from "./package-preflight-internal.js";
import { calculateWebReactPackageDigest } from "./package-preflight-web-react.js";
import {
  BUNDLE_RUNTIME_STAGING_LIMITS,
  INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE,
  RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
  RUNTIME_STAGING_LIMIT_EXCEEDED_CODE,
  RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE,
} from "./runtime-staging-contract.js";

import type { DesenBundle, DesenCatalog, DesenDiagnostic } from "@desen/protocol";
import type {
  RuntimeActionTurnProgram,
  RuntimeActionTurnProgramPreparationResult,
} from "@desen/runtime-core";
import type {
  DesenExecutionCatalogSetValidationResult,
  DesenExecutionContractObligation,
  DesenExecutionContractValidationResult,
  DesenValidatedExecutionCatalogSet,
  ImmutableJson,
} from "@desen/validator";
import type { BundlePackagePreflightAuthority } from "./package-preflight-contract.js";
import type { BundlePackagePreflightAuthorityRecord } from "./package-preflight-internal.js";
import type {
  CalculatedWebReactPackageDigest,
  CapturedWebReactPackageArtifact,
} from "./package-preflight-web-react.js";
import type {
  BundleRuntimeStagingAuthority,
  BundleRuntimeStagingDiagnostic,
  BundleRuntimeStagingLimits,
  BundleRuntimeStagingResult,
  BundleRuntimeStagingStage,
  StagedRuntimePackageSummary,
  StagedRuntimeSurfaceSummary,
} from "./runtime-staging-contract.js";

type BundleSnapshot = ImmutableJson<DesenBundle>;
type CatalogSnapshot = ImmutableJson<DesenCatalog>;
type SurfaceSnapshot = BundleSnapshot["surfaces"][string];
type NodeSnapshot = SurfaceSnapshot["root"];
type BehaviorSnapshot = NonNullable<NodeSnapshot["behaviors"]>[number];
type ActionSnapshot = NonNullable<NodeSnapshot["on"]>[string][number];

interface StagedCapabilityIndexEntry {
  readonly packageIndex: number;
  readonly contract: unknown;
}

interface StagedRuntimeArtifactEntry {
  readonly path: string;
  readonly byteLength: number;
  readonly digest: string;
}

interface StagedRuntimePackageIndex {
  readonly packageIndex: number;
  readonly catalog: CatalogSnapshot;
  readonly artifacts: readonly StagedRuntimeArtifactEntry[];
  readonly artifactByPath: Readonly<Record<string, StagedRuntimeArtifactEntry>>;
}

interface StagedRuntimeNodeIndexEntry {
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly node: NodeSnapshot;
}

interface StagedRuntimeBehaviorIndexEntry {
  readonly sourceNodeId: string;
  readonly behaviorId: string;
  readonly capabilityId: string;
  readonly behavior: BehaviorSnapshot;
}

interface StagedRuntimeHandlerIndexEntry {
  readonly selector: string;
  readonly sourceNodeId: string;
  readonly behaviorId?: string;
  readonly eventName: string;
  readonly program: RuntimeActionTurnProgram;
}

interface StagedRuntimeResourceIndexEntry {
  readonly alias: string;
  readonly capabilityId: string;
  readonly spec: SurfaceSnapshot["resources"][string];
}

interface StagedRuntimeSurfaceIndex {
  readonly surface: SurfaceSnapshot;
  readonly nodes: Readonly<Record<string, StagedRuntimeNodeIndexEntry>>;
  readonly behaviors: Readonly<Record<string, StagedRuntimeBehaviorIndexEntry>>;
  readonly handlers: Readonly<Record<string, StagedRuntimeHandlerIndexEntry>>;
  readonly state: Readonly<Record<string, SurfaceSnapshot["state"][string]>>;
  readonly resources: Readonly<Record<string, StagedRuntimeResourceIndexEntry>>;
  readonly operationAliases: Readonly<Record<string, string>>;
  readonly summary: StagedRuntimeSurfaceSummary;
}

interface StagedRuntimeCapabilityIndexes {
  readonly components: Readonly<Record<string, StagedCapabilityIndexEntry>>;
  readonly behaviors: Readonly<Record<string, StagedCapabilityIndexEntry>>;
  readonly operations: Readonly<Record<string, StagedCapabilityIndexEntry>>;
  readonly resources: Readonly<Record<string, StagedCapabilityIndexEntry>>;
}

/** @internal Complete private M07-T06 authority retained for transactional activation composition. */
export interface BundleRuntimeStagingAuthorityRecord {
  readonly packageAuthority: BundlePackagePreflightAuthority;
  readonly packageRecord: BundlePackagePreflightAuthorityRecord;
  readonly bundle: BundleSnapshot;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly obligations: readonly DesenExecutionContractObligation[];
  readonly packages: readonly StagedRuntimePackageIndex[];
  readonly requirementPackageIndexes: readonly number[];
  readonly capabilities: StagedRuntimeCapabilityIndexes;
  readonly surfaces: Readonly<Record<string, StagedRuntimeSurfaceIndex>>;
  readonly entrySurface: StagedRuntimeSurfaceIndex;
}

/** @internal Pure staging ports replaceable only by focused same-package tests. */
export interface RuntimeStagingPorts {
  readonly validateExecutionCatalogSet: (
    input: unknown,
  ) => DesenExecutionCatalogSetValidationResult;
  readonly validateBundleExecutionContracts: (
    input: unknown,
    catalogSet: DesenValidatedExecutionCatalogSet,
  ) => DesenExecutionContractValidationResult<"bundle">;
  readonly prepareActionProgram: (
    actions: readonly unknown[],
  ) => RuntimeActionTurnProgramPreparationResult;
  readonly calculatePackageDigest: typeof calculateWebReactPackageDigest;
}

interface MutableStageCounts {
  artifacts: number;
  artifactBytes: number;
  capabilities: number;
  sourceNodes: number;
  stateEntries: number;
  behaviors: number;
  handlers: number;
  resources: number;
  operationAliases: number;
}

class StageFailure extends Error {
  constructor(
    readonly stage: Extract<BundleRuntimeStagingStage, "package-snapshots" | "runtime-indexes">,
    readonly reason: "internal" | "limit" | "snapshot",
  ) {
    super("Runtime staging failed.");
    this.name = "StageFailure";
  }
}

const ROOT_POINTER = createJsonPointer();
const AUTHORITIES = new WeakMap<
  BundleRuntimeStagingAuthority,
  BundleRuntimeStagingAuthorityRecord
>();
const ARTIFACT_BYTES = new WeakMap<StagedRuntimeArtifactEntry, Uint8Array>();
const DEFAULT_PORTS: RuntimeStagingPorts = Object.freeze({
  validateExecutionCatalogSet: validateDesenExecutionCatalogSet,
  validateBundleExecutionContracts: validateDesenBundleExecutionContracts,
  prepareActionProgram: prepareRuntimeActionProgram,
  calculatePackageDigest: calculateWebReactPackageDigest,
});
const EXECUTION_OBLIGATION_KINDS = new Set<DesenExecutionContractObligation["kind"]>([
  "behavior-prop",
  "behavior-style-part-property",
  "component-command-input",
  "component-prop",
  "operation-input",
  "resource-input",
  "state-write",
  "style-part-property",
]);
const INVALID_OWN_DATA = Symbol("invalid-own-data");
const MAX_PORT_JSON_NODES = 500_000;

interface CapturedExecutionCatalogSuccess {
  readonly valid: true;
  readonly value: DesenValidatedExecutionCatalogSet;
}

interface CapturedExecutionCatalogFailure {
  readonly valid: false;
  readonly diagnostics: unknown;
}

type CapturedExecutionCatalogResult =
  CapturedExecutionCatalogSuccess | CapturedExecutionCatalogFailure;

interface CapturedExecutionContractSuccess {
  readonly valid: true;
  readonly value: BundleSnapshot;
  readonly obligations: readonly DesenExecutionContractObligation[];
}

interface CapturedExecutionContractFailure {
  readonly valid: false;
  readonly diagnostics: unknown;
}

type CapturedExecutionContractResult =
  CapturedExecutionContractSuccess | CapturedExecutionContractFailure;

interface CapturedPreparedProgram {
  readonly program: RuntimeActionTurnProgram;
  readonly actionCount: number;
  readonly overflow: boolean;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function diagnostic(code: string, message: string): BundleRuntimeStagingDiagnostic {
  return Object.freeze({ code, message, pointer: ROOT_POINTER });
}

function rejection(
  stage: BundleRuntimeStagingStage,
  diagnostics: readonly BundleRuntimeStagingDiagnostic[],
): BundleRuntimeStagingResult {
  return Object.freeze({
    status: "rejected",
    stage,
    diagnostics: Object.freeze([...diagnostics]),
  });
}

function invalidAuthorityRejection(): BundleRuntimeStagingResult {
  return rejection("package-authority", [
    diagnostic(
      INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE,
      "Runtime staging requires an authentic installed-package authority.",
    ),
  ]);
}

function stageFailureRejection(failure: StageFailure): BundleRuntimeStagingResult {
  if (failure.reason === "limit") {
    return rejection(failure.stage, [
      diagnostic(
        RUNTIME_STAGING_LIMIT_EXCEEDED_CODE,
        "Runtime staging exceeded its fixed finite profile.",
      ),
    ]);
  }
  if (failure.reason === "snapshot") {
    return rejection(failure.stage, [
      diagnostic(
        RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE,
        "A verified package snapshot changed before runtime staging completed.",
      ),
    ]);
  }
  return rejection(failure.stage, [
    diagnostic(
      RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
      "Runtime staging could not complete its trusted implementation path.",
    ),
  ]);
}

function internalRejection(
  stage: BundleRuntimeStagingStage = "internal",
): BundleRuntimeStagingResult {
  return rejection(stage, [
    diagnostic(
      RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
      "Runtime staging could not complete its trusted implementation path.",
    ),
  ]);
}

function executionRejection(
  stage: "execution-catalogs" | "execution-contracts",
  diagnostics: unknown,
): BundleRuntimeStagingResult {
  const captured = captureArrayData(diagnostics, 4_096);
  const first = immutableExecutionDiagnostic(captured?.[0]);
  return first === undefined ? internalRejection(stage) : rejection(stage, [first]);
}

function ownDataValue(input: object, key: string): unknown | typeof INVALID_OWN_DATA {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined) return undefined;
  return "value" in descriptor && descriptor.enumerable ? descriptor.value : INVALID_OWN_DATA;
}

function captureOwnDataRecord(
  input: unknown,
  allowedKeys: ReadonlySet<string>,
): Readonly<Record<string, unknown>> | undefined {
  if (
    typeof input !== "object" ||
    input === null ||
    utilTypes.isProxy(input) ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    return undefined;
  }
  const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      typeof key !== "string" ||
      !allowedKeys.has(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      return undefined;
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function hasExactOwnKeys(
  input: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const observed = Object.keys(input).sort(compareText);
  return (
    observed.length === expected.length &&
    observed.every((key, index) => key === [...expected].sort(compareText)[index])
  );
}

function captureArrayData(input: unknown, maximumLength: number): readonly unknown[] | undefined {
  if (
    typeof input !== "object" ||
    input === null ||
    utilTypes.isProxy(input) ||
    !Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Array.prototype
  ) {
    return undefined;
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(input, "length");
  const length = lengthDescriptor?.value;
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maximumLength ||
    Reflect.ownKeys(input).length !== length + 1
  ) {
    return undefined;
  }
  const captured: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      return undefined;
    }
    captured.push(descriptor.value);
  }
  return Object.freeze(captured);
}

function isDeepFrozenInertJson(input: unknown): boolean {
  const pending: unknown[] = [input];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      continue;
    }
    if (typeof value !== "object" || utilTypes.isProxy(value) || seen.has(value)) return false;
    seen.add(value);
    if (seen.size > MAX_PORT_JSON_NODES || !Object.isFrozen(value)) return false;
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if ((array && prototype !== Array.prototype) || (!array && prototype !== Object.prototype)) {
      return false;
    }
    const keys = Reflect.ownKeys(value);
    if (array) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      const length = lengthDescriptor?.value;
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        typeof length !== "number" ||
        !Number.isSafeInteger(length) ||
        length < 0 ||
        keys.length !== length + 1
      ) {
        return false;
      }
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          return false;
        }
        pending.push(descriptor.value);
      }
      continue;
    }
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        typeof key !== "string" ||
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        return false;
      }
      pending.push(descriptor.value);
    }
  }
  return true;
}

function immutableObligationContext(
  input: unknown,
): DesenExecutionContractObligation["context"] | undefined {
  const context = captureOwnDataRecord(
    input,
    new Set(["capabilityId", "documentId", "subject", "surfaceId"]),
  );
  if (context === undefined) return undefined;
  const capabilityId = context.capabilityId;
  const documentId = context.documentId;
  const surfaceId = context.surfaceId;
  if (
    (capabilityId !== undefined && typeof capabilityId !== "string") ||
    (documentId !== undefined && typeof documentId !== "string") ||
    (surfaceId !== undefined && typeof surfaceId !== "string")
  ) {
    return undefined;
  }
  let subject: DesenExecutionContractObligation["context"]["subject"];
  if (context.subject !== undefined) {
    const capturedSubject = captureOwnDataRecord(context.subject, new Set(["id", "kind"]));
    if (
      capturedSubject === undefined ||
      !hasExactOwnKeys(capturedSubject, ["id", "kind"]) ||
      (capturedSubject.kind !== "node" && capturedSubject.kind !== "behavior") ||
      typeof capturedSubject.id !== "string"
    ) {
      return undefined;
    }
    subject = Object.freeze({ kind: capturedSubject.kind, id: capturedSubject.id });
  }
  return Object.freeze({
    ...(documentId === undefined ? {} : { documentId }),
    ...(surfaceId === undefined ? {} : { surfaceId }),
    ...(subject === undefined ? {} : { subject }),
    ...(capabilityId === undefined ? {} : { capabilityId }),
  });
}

function captureExecutionObligations(
  input: unknown,
  limits: Readonly<BundleRuntimeStagingLimits>,
): readonly DesenExecutionContractObligation[] | undefined {
  if (
    typeof input !== "object" ||
    input === null ||
    utilTypes.isProxy(input) ||
    !Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Array.prototype
  ) {
    return undefined;
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(input, "length");
  const length = lengthDescriptor?.value;
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0
  ) {
    return undefined;
  }
  if (length > limits.maxRuntimeValidationObligations) {
    throw new StageFailure("runtime-indexes", "limit");
  }
  const values = captureArrayData(input, limits.maxRuntimeValidationObligations);
  if (values === undefined) return undefined;
  const obligations: DesenExecutionContractObligation[] = [];
  for (const value of values) {
    const record = captureOwnDataRecord(value, new Set(["context", "kind", "pointer"]));
    if (
      record === undefined ||
      !hasExactOwnKeys(record, ["context", "kind", "pointer"]) ||
      typeof record.kind !== "string" ||
      !EXECUTION_OBLIGATION_KINDS.has(record.kind as DesenExecutionContractObligation["kind"]) ||
      !isJsonPointer(record.pointer)
    ) {
      return undefined;
    }
    const context = immutableObligationContext(record.context);
    if (context === undefined) return undefined;
    obligations.push(
      Object.freeze({
        kind: record.kind as DesenExecutionContractObligation["kind"],
        pointer: record.pointer,
        context,
      }),
    );
  }
  return Object.freeze(obligations);
}

function captureCalculatedPackageDigest(
  input: unknown,
): CalculatedWebReactPackageDigest | undefined {
  const record = captureOwnDataRecord(
    input,
    new Set(["artifactCount", "framedByteLength", "packageDigest"]),
  );
  if (
    record === undefined ||
    !hasExactOwnKeys(record, ["artifactCount", "framedByteLength", "packageDigest"]) ||
    typeof record.packageDigest !== "string" ||
    !Number.isSafeInteger(record.artifactCount) ||
    (record.artifactCount as number) < 0 ||
    !Number.isSafeInteger(record.framedByteLength) ||
    (record.framedByteLength as number) < 0
  ) {
    return undefined;
  }
  return Object.freeze({
    packageDigest: record.packageDigest,
    artifactCount: record.artifactCount as number,
    framedByteLength: record.framedByteLength as number,
  });
}

function captureExecutionCatalogResult(input: unknown): CapturedExecutionCatalogResult | undefined {
  const record = captureOwnDataRecord(input, new Set(["diagnostics", "target", "valid", "value"]));
  if (record === undefined || record.target !== "execution-catalog-set") return undefined;
  if (record.valid === false) {
    return hasExactOwnKeys(record, ["diagnostics", "target", "valid"])
      ? Object.freeze({ valid: false, diagnostics: record.diagnostics })
      : undefined;
  }
  if (
    record.valid !== true ||
    !hasExactOwnKeys(record, ["diagnostics", "target", "valid", "value"]) ||
    captureArrayData(record.diagnostics, 0)?.length !== 0 ||
    typeof record.value !== "object" ||
    record.value === null
  ) {
    return undefined;
  }
  return Object.freeze({
    valid: true,
    value: record.value as DesenValidatedExecutionCatalogSet,
  });
}

function captureExecutionContractResult(
  input: unknown,
  limits: Readonly<BundleRuntimeStagingLimits>,
): CapturedExecutionContractResult | undefined {
  const record = captureOwnDataRecord(
    input,
    new Set(["diagnostics", "obligations", "target", "valid", "value"]),
  );
  if (record === undefined || record.target !== "bundle") return undefined;
  if (record.valid === false) {
    return hasExactOwnKeys(record, ["diagnostics", "obligations", "target", "valid"])
      ? Object.freeze({ valid: false, diagnostics: record.diagnostics })
      : undefined;
  }
  if (
    record.valid !== true ||
    !hasExactOwnKeys(record, ["diagnostics", "obligations", "target", "valid", "value"]) ||
    captureArrayData(record.diagnostics, 0)?.length !== 0 ||
    typeof record.value !== "object" ||
    record.value === null ||
    utilTypes.isProxy(record.value) ||
    Array.isArray(record.value) ||
    !isDeepFrozenInertJson(record.value)
  ) {
    return undefined;
  }
  const obligations = captureExecutionObligations(record.obligations, limits);
  if (obligations === undefined) return undefined;
  return Object.freeze({ valid: true, value: record.value as BundleSnapshot, obligations });
}

function capturePreparedProgram(input: unknown): CapturedPreparedProgram | undefined {
  const record = captureOwnDataRecord(
    input,
    new Set(["actionCount", "overflow", "program", "status"]),
  );
  const program = record?.program;
  if (
    record === undefined ||
    record.status !== "prepared" ||
    !hasExactOwnKeys(record, ["actionCount", "overflow", "program", "status"]) ||
    !Number.isSafeInteger(record.actionCount) ||
    (record.actionCount as number) < 0 ||
    typeof record.overflow !== "boolean" ||
    typeof program !== "object" ||
    program === null ||
    utilTypes.isProxy(program) ||
    Array.isArray(program) ||
    Object.getPrototypeOf(program) !== Object.prototype ||
    !Object.isFrozen(program) ||
    Reflect.ownKeys(program).length !== 0
  ) {
    return undefined;
  }
  return Object.freeze({
    program: program as RuntimeActionTurnProgram,
    actionCount: record.actionCount as number,
    overflow: record.overflow,
  });
}

function immutableExecutionDiagnostic(input: unknown): BundleRuntimeStagingDiagnostic | undefined {
  if (
    typeof input !== "object" ||
    input === null ||
    utilTypes.isProxy(input) ||
    Array.isArray(input)
  ) {
    return undefined;
  }
  const code = ownDataValue(input, "code");
  const message = ownDataValue(input, "message");
  const pointer = ownDataValue(input, "pointer");
  const context = ownDataValue(input, "context");
  if (
    typeof code !== "string" ||
    code.length === 0 ||
    typeof message !== "string" ||
    message.length === 0 ||
    pointer === INVALID_OWN_DATA ||
    (pointer !== undefined && !isJsonPointer(pointer)) ||
    context === INVALID_OWN_DATA
  ) {
    return undefined;
  }

  let frozenContext: DesenDiagnostic<string>["context"];
  if (context !== undefined) {
    if (
      typeof context !== "object" ||
      context === null ||
      utilTypes.isProxy(context) ||
      Array.isArray(context)
    ) {
      return undefined;
    }
    const capabilityId = ownDataValue(context, "capabilityId");
    const documentId = ownDataValue(context, "documentId");
    const subject = ownDataValue(context, "subject");
    const surfaceId = ownDataValue(context, "surfaceId");
    if (
      capabilityId === INVALID_OWN_DATA ||
      documentId === INVALID_OWN_DATA ||
      subject === INVALID_OWN_DATA ||
      surfaceId === INVALID_OWN_DATA ||
      (capabilityId !== undefined && typeof capabilityId !== "string") ||
      (documentId !== undefined && typeof documentId !== "string") ||
      (surfaceId !== undefined && typeof surfaceId !== "string")
    ) {
      return undefined;
    }
    let frozenSubject: NonNullable<DesenDiagnostic<string>["context"]>["subject"];
    if (subject !== undefined) {
      if (
        typeof subject !== "object" ||
        subject === null ||
        utilTypes.isProxy(subject) ||
        Array.isArray(subject)
      ) {
        return undefined;
      }
      const kind = ownDataValue(subject, "kind");
      const id = ownDataValue(subject, "id");
      if ((kind !== "node" && kind !== "behavior") || typeof id !== "string") return undefined;
      frozenSubject = Object.freeze({ kind, id });
    }
    frozenContext = Object.freeze({
      ...(documentId === undefined ? {} : { documentId }),
      ...(surfaceId === undefined ? {} : { surfaceId }),
      ...(frozenSubject === undefined ? {} : { subject: frozenSubject }),
      ...(capabilityId === undefined ? {} : { capabilityId }),
    });
  }

  return Object.freeze({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    ...(frozenContext === undefined ? {} : { context: frozenContext }),
  });
}

function frozenRecord<Value>(
  entries: readonly (readonly [string, Value])[],
): Readonly<Record<string, Value>> {
  const record: Record<string, Value> = Object.create(null) as Record<string, Value>;
  for (const [key, value] of [...entries].sort(([left], [right]) => compareText(left, right))) {
    if (Object.hasOwn(record, key)) throw new StageFailure("runtime-indexes", "internal");
    Object.defineProperty(record, key, {
      configurable: false,
      enumerable: true,
      value,
      writable: false,
    });
  }
  return Object.freeze(record);
}

function obligationCodeUnits(obligation: DesenExecutionContractObligation): number {
  const context = obligation.context;
  return (
    obligation.kind.length +
    obligation.pointer.length +
    (context.documentId?.length ?? 0) +
    (context.surfaceId?.length ?? 0) +
    (context.subject?.kind.length ?? 0) +
    (context.subject?.id.length ?? 0) +
    (context.capabilityId?.length ?? 0)
  );
}

function compareObligations(
  left: DesenExecutionContractObligation,
  right: DesenExecutionContractObligation,
): number {
  for (const [leftValue, rightValue] of [
    [left.pointer, right.pointer],
    [left.kind, right.kind],
    [left.context.documentId, right.context.documentId],
    [left.context.surfaceId, right.context.surfaceId],
    [left.context.subject?.kind, right.context.subject?.kind],
    [left.context.subject?.id, right.context.subject?.id],
    [left.context.capabilityId, right.context.capabilityId],
  ] as const) {
    const order = compareText(leftValue ?? "", rightValue ?? "");
    if (order !== 0) return order;
  }
  return 0;
}

function validateObligations(
  obligations: readonly DesenExecutionContractObligation[],
  limits: Readonly<BundleRuntimeStagingLimits>,
): void {
  if (obligations.length > limits.maxRuntimeValidationObligations) {
    throw new StageFailure("runtime-indexes", "limit");
  }
  let aggregateCodeUnits = 0;
  let previous: DesenExecutionContractObligation | undefined;
  for (const obligation of obligations) {
    if (obligation.pointer.length > limits.maxRuntimeObligationPointerCodeUnits) {
      throw new StageFailure("runtime-indexes", "limit");
    }
    if (
      !EXECUTION_OBLIGATION_KINDS.has(obligation.kind) ||
      (previous !== undefined && compareObligations(previous, obligation) >= 0)
    ) {
      throw new StageFailure("runtime-indexes", "internal");
    }
    previous = obligation;
    aggregateCodeUnits += obligationCodeUnits(obligation);
    if (aggregateCodeUnits > limits.maxAggregateRuntimeObligationCodeUnits) {
      throw new StageFailure("runtime-indexes", "limit");
    }
  }
}

function copyArtifacts(
  source: readonly CapturedWebReactPackageArtifact[],
  counts: MutableStageCounts,
  limits: Readonly<BundleRuntimeStagingLimits>,
): readonly StagedRuntimeArtifactEntry[] {
  const entries = source.map((artifact) => {
    let byteLength: number;
    try {
      byteLength = artifact.bytes.byteLength;
    } catch {
      throw new StageFailure("package-snapshots", "snapshot");
    }
    counts.artifacts += 1;
    counts.artifactBytes += byteLength;
    if (
      counts.artifacts > limits.maxArtifactEntries ||
      counts.artifactBytes > limits.maxArtifactBytes
    ) {
      throw new StageFailure("package-snapshots", "limit");
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(artifact.bytes);
    } catch {
      throw new StageFailure("package-snapshots", "snapshot");
    }
    const entry = Object.freeze({
      path: artifact.path,
      byteLength: bytes.byteLength,
      digest: sha256Digest(bytes),
    });
    ARTIFACT_BYTES.set(entry, bytes);
    return entry;
  });
  entries.sort((left, right) => compareText(left.path, right.path));
  return Object.freeze(entries);
}

function stagePackages(
  record: BundlePackagePreflightAuthorityRecord,
  counts: MutableStageCounts,
  limits: Readonly<BundleRuntimeStagingLimits>,
  ports: RuntimeStagingPorts,
): Readonly<{
  readonly indexes: readonly StagedRuntimePackageIndex[];
  readonly summaries: readonly StagedRuntimePackageSummary[];
}> {
  if (record.packages.length > limits.maxPackages) {
    throw new StageFailure("package-snapshots", "limit");
  }
  const indexes: StagedRuntimePackageIndex[] = [];
  const summaries: StagedRuntimePackageSummary[] = [];
  for (let packageIndex = 0; packageIndex < record.packages.length; packageIndex += 1) {
    const source = record.packages[packageIndex];
    if (source === undefined || record.catalogSet[packageIndex] !== source.catalog) {
      throw new StageFailure("package-snapshots", "snapshot");
    }
    const artifacts = copyArtifacts(source.artifacts, counts, limits);
    const digestInput = artifacts.map((entry) => {
      const bytes = ARTIFACT_BYTES.get(entry);
      if (bytes === undefined) throw new StageFailure("package-snapshots", "internal");
      return Object.freeze({ path: entry.path, bytes });
    });
    const calculated = captureCalculatedPackageDigest(
      ports.calculatePackageDigest(source.catalog, digestInput, source.metadata.framedByteLength),
    );
    if (
      calculated === undefined ||
      calculated.packageDigest !== source.metadata.packageDigest ||
      calculated.artifactCount !== source.metadata.artifactCount ||
      calculated.framedByteLength !== source.metadata.framedByteLength
    ) {
      throw new StageFailure("package-snapshots", "snapshot");
    }
    const artifactByteLength = artifacts.reduce((total, entry) => total + entry.byteLength, 0);
    const catalog = source.catalog;
    const componentCount = Object.keys(catalog.components).length;
    const behaviorCount = Object.keys(catalog.behaviors).length;
    const operationCount = Object.keys(catalog.operations).length;
    const resourceCount = Object.keys(catalog.resources).length;
    counts.capabilities += componentCount + behaviorCount + operationCount + resourceCount;
    if (counts.capabilities > limits.maxCapabilityEntries) {
      throw new StageFailure("runtime-indexes", "limit");
    }
    indexes.push(
      Object.freeze({
        packageIndex,
        catalog,
        artifacts,
        artifactByPath: frozenRecord(artifacts.map((entry) => [entry.path, entry] as const)),
      }),
    );
    summaries.push(
      Object.freeze({
        id: source.metadata.id,
        version: source.metadata.version,
        target: source.metadata.target,
        packageDigest: calculated.packageDigest,
        artifactCount: artifacts.length,
        artifactByteLength,
        componentCount,
        behaviorCount,
        operationCount,
        resourceCount,
      }),
    );
  }
  return Object.freeze({ indexes: Object.freeze(indexes), summaries: Object.freeze(summaries) });
}

function capabilityIndexes(
  packages: readonly StagedRuntimePackageIndex[],
): StagedRuntimeCapabilityIndexes {
  const groups = {
    components: [] as (readonly [string, StagedCapabilityIndexEntry])[],
    behaviors: [] as (readonly [string, StagedCapabilityIndexEntry])[],
    operations: [] as (readonly [string, StagedCapabilityIndexEntry])[],
    resources: [] as (readonly [string, StagedCapabilityIndexEntry])[],
  };
  for (const stagedPackage of packages) {
    for (const group of Object.keys(groups) as (keyof typeof groups)[]) {
      for (const capabilityId of Object.keys(stagedPackage.catalog[group]).sort(compareText)) {
        const contract = stagedPackage.catalog[group][capabilityId];
        if (contract === undefined) throw new StageFailure("runtime-indexes", "internal");
        groups[group].push([
          capabilityId,
          Object.freeze({ packageIndex: stagedPackage.packageIndex, contract }),
        ]);
      }
    }
  }
  return Object.freeze({
    components: frozenRecord(groups.components),
    behaviors: frozenRecord(groups.behaviors),
    operations: frozenRecord(groups.operations),
    resources: frozenRecord(groups.resources),
  });
}

function componentSelector(sourceNodeId: string, eventName: string): string {
  return canonicalizeJson(["component", sourceNodeId, eventName]);
}

function behaviorSelector(sourceNodeId: string, behaviorId: string, eventName: string): string {
  return canonicalizeJson(["behavior", sourceNodeId, behaviorId, eventName]);
}

function collectOperationAliases(
  actions: readonly ActionSnapshot[],
  aliases: Map<string, string>,
  counts: MutableStageCounts,
  limits: Readonly<BundleRuntimeStagingLimits>,
): void {
  const pending: ActionSnapshot[] = [...actions];
  while (pending.length > 0) {
    const action = pending.pop();
    if (action === undefined || action.type !== "operation.invoke") continue;
    const hasAlias = aliases.has(action.as);
    const existing = aliases.get(action.as);
    if (hasAlias && existing !== action.operation) {
      throw new StageFailure("runtime-indexes", "internal");
    }
    if (!hasAlias) {
      if (counts.operationAliases >= limits.maxOperationAliases) {
        throw new StageFailure("runtime-indexes", "limit");
      }
      aliases.set(action.as, action.operation);
      counts.operationAliases += 1;
    }
    for (const branch of [action.onFailure, action.onSuccess]) {
      if (branch === undefined) continue;
      for (let index = branch.length - 1; index >= 0; index -= 1) {
        pending.push(branch[index] as ActionSnapshot);
      }
    }
  }
}

function prepareHandlers(
  handlers: NodeSnapshot["on"] | BehaviorSnapshot["on"],
  sourceNodeId: string,
  behaviorId: string | undefined,
  entries: (readonly [string, StagedRuntimeHandlerIndexEntry])[],
  aliases: Map<string, string>,
  counts: MutableStageCounts,
  limits: Readonly<BundleRuntimeStagingLimits>,
  ports: RuntimeStagingPorts,
): void {
  if (handlers === undefined) return;
  for (const eventName of Object.keys(handlers).sort(compareText)) {
    const actions = handlers[eventName];
    if (actions === undefined) throw new StageFailure("runtime-indexes", "internal");
    if (counts.handlers >= limits.maxHandlerPrograms) {
      throw new StageFailure("runtime-indexes", "limit");
    }
    const prepare = ports.prepareActionProgram;
    const reported = capturePreparedProgram(prepare(actions));
    if (reported === undefined || reported.overflow || reported.actionCount !== actions.length) {
      throw new StageFailure("runtime-indexes", "internal");
    }
    const prepared =
      prepare === prepareRuntimeActionProgram
        ? reported
        : capturePreparedProgram(prepareRuntimeActionProgram(actions));
    if (prepared === undefined || prepared.overflow || prepared.actionCount !== actions.length) {
      throw new StageFailure("runtime-indexes", "internal");
    }
    counts.handlers += 1;
    const selector =
      behaviorId === undefined
        ? componentSelector(sourceNodeId, eventName)
        : behaviorSelector(sourceNodeId, behaviorId, eventName);
    entries.push([
      selector,
      Object.freeze({
        selector,
        sourceNodeId,
        ...(behaviorId === undefined ? {} : { behaviorId }),
        eventName,
        program: prepared.program,
      }),
    ]);
    collectOperationAliases(actions, aliases, counts, limits);
  }
}

function orderedChildNodes(
  slots: NodeSnapshot["slots"] | BehaviorSnapshot["slots"],
): readonly NodeSnapshot[] {
  if (slots === undefined) return Object.freeze([]);
  const children: NodeSnapshot[] = [];
  for (const slotName of Object.keys(slots).sort(compareText)) {
    const slot = slots[slotName];
    if (slot === undefined) throw new StageFailure("runtime-indexes", "internal");
    for (const child of slot) children.push(child);
  }
  return children;
}

function stageSurface(
  surface: SurfaceSnapshot,
  counts: MutableStageCounts,
  limits: Readonly<BundleRuntimeStagingLimits>,
  ports: RuntimeStagingPorts,
): StagedRuntimeSurfaceIndex {
  const nodeEntries: (readonly [string, StagedRuntimeNodeIndexEntry])[] = [];
  const behaviorEntries: (readonly [string, StagedRuntimeBehaviorIndexEntry])[] = [];
  const handlerEntries: (readonly [string, StagedRuntimeHandlerIndexEntry])[] = [];
  const aliases = new Map<string, string>();
  const identities = new Set<string>();
  const pending: NodeSnapshot[] = [surface.root];
  let surfaceNodeCount = 0;
  let surfaceBehaviorCount = 0;
  let surfaceHandlerCount = 0;
  const stateEntries = Object.keys(surface.state);
  counts.stateEntries += stateEntries.length;
  if (counts.stateEntries > limits.maxStateEntries) {
    throw new StageFailure("runtime-indexes", "limit");
  }
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined || identities.has(node.id)) {
      throw new StageFailure("runtime-indexes", "internal");
    }
    identities.add(node.id);
    counts.sourceNodes += 1;
    surfaceNodeCount += 1;
    if (counts.sourceNodes > limits.maxSourceNodes) {
      throw new StageFailure("runtime-indexes", "limit");
    }
    nodeEntries.push([
      node.id,
      Object.freeze({ sourceNodeId: node.id, capabilityId: node.use, node }),
    ]);
    const handlersBefore = counts.handlers;
    prepareHandlers(node.on, node.id, undefined, handlerEntries, aliases, counts, limits, ports);
    surfaceHandlerCount += counts.handlers - handlersBefore;

    for (const behavior of node.behaviors ?? []) {
      if (identities.has(behavior.id)) throw new StageFailure("runtime-indexes", "internal");
      identities.add(behavior.id);
      counts.behaviors += 1;
      surfaceBehaviorCount += 1;
      if (counts.behaviors > limits.maxBehaviors) {
        throw new StageFailure("runtime-indexes", "limit");
      }
      const behaviorKey = canonicalizeJson([node.id, behavior.id]);
      behaviorEntries.push([
        behaviorKey,
        Object.freeze({
          sourceNodeId: node.id,
          behaviorId: behavior.id,
          capabilityId: behavior.use,
          behavior,
        }),
      ]);
      const behaviorHandlersBefore = counts.handlers;
      prepareHandlers(
        behavior.on,
        node.id,
        behavior.id,
        handlerEntries,
        aliases,
        counts,
        limits,
        ports,
      );
      surfaceHandlerCount += counts.handlers - behaviorHandlersBefore;
      const behaviorChildren = orderedChildNodes(behavior.slots);
      for (let index = behaviorChildren.length - 1; index >= 0; index -= 1) {
        pending.push(behaviorChildren[index] as NodeSnapshot);
      }
    }
    const nodeChildren = orderedChildNodes(node.slots);
    for (let index = nodeChildren.length - 1; index >= 0; index -= 1) {
      pending.push(nodeChildren[index] as NodeSnapshot);
    }
  }

  const resourceEntries = Object.keys(surface.resources)
    .sort(compareText)
    .map((alias) => {
      const spec = surface.resources[alias];
      if (spec === undefined) throw new StageFailure("runtime-indexes", "internal");
      counts.resources += 1;
      if (counts.resources > limits.maxResourceAliases) {
        throw new StageFailure("runtime-indexes", "limit");
      }
      return [alias, Object.freeze({ alias, capabilityId: spec.use, spec })] as const;
    });
  const summary = Object.freeze({
    id: surface.id,
    sourceNodeCount: surfaceNodeCount,
    behaviorCount: surfaceBehaviorCount,
    handlerProgramCount: surfaceHandlerCount,
    stateEntryCount: stateEntries.length,
    resourceAliasCount: resourceEntries.length,
    operationAliasCount: aliases.size,
  });
  return Object.freeze({
    surface,
    nodes: frozenRecord(nodeEntries),
    behaviors: frozenRecord(behaviorEntries),
    handlers: frozenRecord(handlerEntries),
    state: frozenRecord(
      stateEntries
        .sort(compareText)
        .map((key) => [key, surface.state[key] as SurfaceSnapshot["state"][string]] as const),
    ),
    resources: frozenRecord(resourceEntries),
    operationAliases: frozenRecord(
      [...aliases].map(([alias, operation]) => [alias, operation] as const),
    ),
    summary,
  });
}

function stageSurfaces(
  bundle: BundleSnapshot,
  counts: MutableStageCounts,
  limits: Readonly<BundleRuntimeStagingLimits>,
  ports: RuntimeStagingPorts,
): Readonly<{
  readonly indexes: Readonly<Record<string, StagedRuntimeSurfaceIndex>>;
  readonly summaries: readonly StagedRuntimeSurfaceSummary[];
  readonly entry: StagedRuntimeSurfaceIndex;
}> {
  const surfaceIds = Object.keys(bundle.surfaces).sort(compareText);
  if (surfaceIds.length > limits.maxSurfaces) {
    throw new StageFailure("runtime-indexes", "limit");
  }
  const entries = surfaceIds.map((surfaceId) => {
    const surface = bundle.surfaces[surfaceId];
    if (surface === undefined || surface.id !== surfaceId) {
      throw new StageFailure("runtime-indexes", "internal");
    }
    return [surfaceId, stageSurface(surface, counts, limits, ports)] as const;
  });
  const indexes = frozenRecord(entries);
  const entry = indexes[bundle.entry];
  if (entry === undefined) throw new StageFailure("runtime-indexes", "internal");
  return Object.freeze({
    indexes,
    summaries: Object.freeze(entries.map(([, index]) => index.summary)),
    entry,
  });
}

function createAuthority(
  packageAuthority: BundlePackagePreflightAuthority,
  packageRecord: BundlePackagePreflightAuthorityRecord,
  bundle: BundleSnapshot,
  catalogSet: DesenValidatedExecutionCatalogSet,
  obligations: readonly DesenExecutionContractObligation[],
  packages: readonly StagedRuntimePackageIndex[],
  packageSummaries: readonly StagedRuntimePackageSummary[],
  capabilities: StagedRuntimeCapabilityIndexes,
  surfaces: Readonly<Record<string, StagedRuntimeSurfaceIndex>>,
  surfaceSummaries: readonly StagedRuntimeSurfaceSummary[],
  entrySurface: StagedRuntimeSurfaceIndex,
): BundleRuntimeStagingResult {
  const authority = Object.freeze({
    profile: "desen.runtime-index-staging",
    profileVersion: 1,
    protocolVersion: "0.1.0",
    stagedRevision: packageRecord.integrityRecord.revision,
    documentId: bundle.id,
    entrySurfaceId: bundle.entry,
    packages: packageSummaries,
    surfaces: surfaceSummaries,
    runtimeObligationCount: obligations.length,
  }) as BundleRuntimeStagingAuthority;
  AUTHORITIES.set(
    authority,
    Object.freeze({
      packageAuthority,
      packageRecord,
      bundle,
      catalogSet,
      obligations,
      packages,
      requirementPackageIndexes: packageRecord.requirementPackageIndexes,
      capabilities,
      surfaces,
      entrySurface,
    }),
  );
  return Object.freeze({ status: "staged", authority });
}

/** @internal Authenticates and reads one exact live M07-T06 runtime-staging authority. */
export function readBundleRuntimeStagingAuthority(
  authority: unknown,
): BundleRuntimeStagingAuthorityRecord | undefined {
  return typeof authority === "object" && authority !== null
    ? AUTHORITIES.get(authority as BundleRuntimeStagingAuthority)
    : undefined;
}

/** @internal Returns whether a value is an exact live M07-T06 staging authority. */
export function isBundleRuntimeStagingAuthority(
  value: unknown,
): value is BundleRuntimeStagingAuthority {
  return readBundleRuntimeStagingAuthority(value) !== undefined;
}

/**
 * @internal Returns a fresh digest-authenticated copy of one exact staged artifact.
 *
 * @remarks The retained byte view never crosses this module boundary. A caller may mutate or
 * detach the returned copy without changing the staged candidate used by later trusted stages.
 */
export function readStagedRuntimeArtifactBytes(artifact: unknown): Uint8Array | undefined {
  if (typeof artifact !== "object" || artifact === null) return undefined;
  const entry = artifact as StagedRuntimeArtifactEntry;
  const retained = ARTIFACT_BYTES.get(entry);
  if (
    retained === undefined ||
    retained.byteLength !== entry.byteLength ||
    sha256Digest(retained) !== entry.digest
  ) {
    return undefined;
  }
  return new Uint8Array(retained);
}

/** @internal Package-private staging implementation with injectable pure verification ports. */
export function stageBundleRuntimeInternal(
  packageAuthority: BundlePackagePreflightAuthority,
  ports: RuntimeStagingPorts = DEFAULT_PORTS,
  limits: Readonly<BundleRuntimeStagingLimits> = BUNDLE_RUNTIME_STAGING_LIMITS,
): BundleRuntimeStagingResult {
  const packageRecord = readBundlePackagePreflightAuthority(packageAuthority);
  if (packageRecord === undefined) return invalidAuthorityRejection();

  try {
    const counts: MutableStageCounts = {
      artifacts: 0,
      artifactBytes: 0,
      capabilities: 0,
      sourceNodes: 0,
      stateEntries: 0,
      behaviors: 0,
      handlers: 0,
      resources: 0,
      operationAliases: 0,
    };
    const stagedPackages = stagePackages(packageRecord, counts, limits, ports);

    const executionCatalogs = captureExecutionCatalogResult(
      ports.validateExecutionCatalogSet(packageRecord.catalogSet),
    );
    if (executionCatalogs === undefined) {
      return internalRejection("execution-catalogs");
    }
    if (!executionCatalogs.valid) {
      return executionRejection("execution-catalogs", executionCatalogs.diagnostics);
    }
    if (executionCatalogs.value !== packageRecord.catalogSet) {
      return internalRejection("execution-catalogs");
    }

    const execution = captureExecutionContractResult(
      ports.validateBundleExecutionContracts(
        packageRecord.integrityRecord.bundle,
        executionCatalogs.value,
      ),
      limits,
    );
    if (execution === undefined) return internalRejection("execution-contracts");
    if (!execution.valid) {
      return executionRejection("execution-contracts", execution.diagnostics);
    }
    if (
      canonicalizeJson(execution.value) !==
        canonicalizeJson(packageRecord.integrityRecord.bundle) ||
      calculateDesenBundleRevision(execution.value) !== packageRecord.integrityRecord.revision
    ) {
      return internalRejection("execution-contracts");
    }
    validateObligations(execution.obligations, limits);

    const capabilities = capabilityIndexes(stagedPackages.indexes);
    const stagedSurfaces = stageSurfaces(execution.value, counts, limits, ports);
    return createAuthority(
      packageAuthority,
      packageRecord,
      execution.value,
      executionCatalogs.value,
      execution.obligations,
      stagedPackages.indexes,
      stagedPackages.summaries,
      capabilities,
      stagedSurfaces.indexes,
      stagedSurfaces.summaries,
      stagedSurfaces.entry,
    );
  } catch (error) {
    return error instanceof StageFailure ? stageFailureRejection(error) : internalRejection();
  }
}
