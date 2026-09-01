import { registerOperation } from "@desen/catalog-sdk";
import { createSyntheticFixtureSnapshot, SYNTHETIC_FIXTURE_CONTEXT } from "@desen/testkit";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";

import type { OperationManifest, RegisteredOperation } from "@desen/catalog-sdk";
import type {
  RuntimeHostCallResult,
  RuntimeOperationEffect,
  RuntimeOperationPort,
  RuntimeOperationRequest,
} from "@desen/runtime-core";
import type { SyntheticFixtureValue, SyntheticOperationFixtures } from "@desen/testkit";

type JsonObject = Readonly<Record<string, unknown>>;

const AUTHORING_OPERATION_LIMITS = Object.freeze({
  maxActionDepth: 64,
  maxActionOccurrences: 25_000,
  maxOwnerDepth: 64,
  maxOwnerOccurrences: 25_000,
});
const PREPARED_FIXTURE_MODELS = new WeakSet<object>();

function deepFreezeProjection<const Value>(value: Value): Value {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) deepFreezeProjection(descriptor.value);
  }
  return Object.freeze(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

class FixtureProjectionError extends Error {
  readonly reason: AuthoringOperationFixtureModelRejectionReason;

  constructor(reason: AuthoringOperationFixtureModelRejectionReason) {
    super(reason);
    this.reason = reason;
  }
}

function readDataObject(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new FixtureProjectionError("projection-invalid");
  }
  return value as JsonObject;
}

function readOwnDataValue(record: JsonObject, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor?.enumerable === true && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    throw new FixtureProjectionError("projection-invalid");
  }
}

function readOwnDataEntries(record: JsonObject): readonly (readonly [string, unknown])[] {
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(record);
  } catch {
    throw new FixtureProjectionError("projection-invalid");
  }
  const entries: (readonly [string, unknown])[] = [];
  for (const key of keys) {
    if (typeof key !== "string") throw new FixtureProjectionError("projection-invalid");
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor?.enumerable !== true || !("value" in descriptor)) {
      throw new FixtureProjectionError("projection-invalid");
    }
    entries.push(Object.freeze([key, descriptor.value] as const));
  }
  return entries;
}

function operationManifest(
  catalogs: readonly unknown[],
  capabilityId: string,
): OperationManifest | undefined {
  const matches: OperationManifest[] = [];
  for (const catalogValue of catalogs) {
    const catalog = readDataObject(catalogValue);
    const operations = readDataObject(readOwnDataValue(catalog, "operations"));
    const manifestValue = readOwnDataValue(operations, capabilityId);
    if (manifestValue !== undefined) {
      matches.push(readDataObject(manifestValue) as OperationManifest);
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

function readDataArray(
  value: unknown,
  maximumLength: number = AUTHORING_OPERATION_LIMITS.maxOwnerOccurrences,
): readonly unknown[] {
  if (!Array.isArray(value)) throw new FixtureProjectionError("projection-invalid");
  let length: number;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !Number.isSafeInteger(descriptor.value) ||
      descriptor.value < 0
    ) {
      throw new FixtureProjectionError("projection-invalid");
    }
    length = descriptor.value as number;
  } catch (error) {
    if (error instanceof FixtureProjectionError) throw error;
    throw new FixtureProjectionError("projection-invalid");
  }
  if (length > maximumLength) throw new FixtureProjectionError("projection-limit");
  const items: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor?.enumerable !== true || !("value" in descriptor)) {
      throw new FixtureProjectionError("projection-invalid");
    }
    items.push(descriptor.value);
  }
  return items;
}

function readNonEmptyString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new FixtureProjectionError("projection-invalid");
  }
  return value;
}

function optionalNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Closed execution-context identifiers shown by the authoring fixture controls. */
export type AuthoringFixtureContextId = "synthetic" | "integration" | "production";

/** One visible execution context in the App-owned fixture disclosure. */
export interface AuthoringFixtureContextOption {
  /** Stable context identifier used only by App UI. */
  readonly id: AuthoringFixtureContextId;
  /** Short visible context label. */
  readonly label: string;
  /** Whether this context can execute in the current authoring preview. */
  readonly availability: "active" | "unavailable";
  /** Visible explanation of the context's current authority. */
  readonly description: string;
}

/** Complete visible context model for the fixture-only authoring preview. */
export interface AuthoringFixtureContextModel {
  /** The only active execution context. */
  readonly activeId: "synthetic";
  /** Persistent disclosure that distinguishes fixtures from real integrations. */
  readonly disclosure: string;
  /** Synthetic, integration, and production contexts in display order. */
  readonly options: readonly AuthoringFixtureContextOption[];
}

/** Visible execution-context disclosure for fixture-only authoring previews. */
export const AUTHORING_FIXTURE_CONTEXT_MODEL: AuthoringFixtureContextModel = deepFreezeProjection({
  activeId: "synthetic",
  disclosure: "Synthetic Catalog data. Integration and production calls are off.",
  options: [
    {
      id: "synthetic",
      label: "Synthetic",
      availability: "active",
      description: "Uses inert authoring fixtures from the authenticated Catalog manifest.",
    },
    {
      id: "integration",
      label: "Integration",
      availability: "unavailable",
      description: "No integration binding is connected in this authoring preview.",
    },
    {
      id: "production",
      label: "Production",
      availability: "unavailable",
      description: "Production calls are off in this authoring preview.",
    },
  ],
});

/** Stable identifier for one Catalog-declared synthetic operation outcome. */
export type AuthoringOperationFixtureOutcomeId = "success" | `error:${string}`;

/** One inert outcome projected from authenticated Catalog authoring fixtures. */
export interface AuthoringOperationFixtureOutcome {
  /** Stable selection identifier scoped to the owning invocation alias. */
  readonly id: AuthoringOperationFixtureOutcomeId;
  /** Generic visible label derived without inspecting the fixture payload. */
  readonly label: string;
  /** Whether the outcome is a successful output or a declared public error. */
  readonly kind: "success" | "error";
  /** Declared public error code, or `null` for success. */
  readonly errorCode: string | null;
  /** Optional Catalog-authored public description. */
  readonly description: string | undefined;
  /** Detached synthetic payload projected by `@desen/testkit`. */
  readonly fixtureValue: SyntheticFixtureValue;
}

/** One exact Source invocation alias and its Catalog-authenticated fixture inventory. */
export interface AuthoringOperationFixtureDefinition {
  /** Surface-scoped alias declared by `operation.invoke.as`. */
  readonly alias: string;
  /** Exact Catalog operation capability invoked by this alias. */
  readonly capabilityId: string;
  /** Optional Catalog-authored operation description. */
  readonly description: string | undefined;
  /** Exact Catalog effect required at the Runtime host boundary. */
  readonly effect: RuntimeOperationEffect;
  /** Only outcomes that have an authenticated Catalog fixture. */
  readonly outcomes: readonly AuthoringOperationFixtureOutcome[];
}

/** Stable reason why a generic operation-fixture model was not admitted. */
export type AuthoringOperationFixtureModelRejectionReason =
  | "alias-conflict"
  | "catalog-invalid"
  | "fixture-invalid"
  | "operation-missing"
  | "projection-invalid"
  | "projection-limit"
  | "source-invalid"
  | "surface-id-invalid"
  | "surface-missing";

/** Complete authenticated fixture model for one exact Source surface. */
export interface AuthoringOperationFixtureReadyModel {
  /** Success discriminator. */
  readonly status: "ready";
  /** Exact Source document identity that supplied the surface. */
  readonly documentId: string;
  /** Exact selected Source surface. */
  readonly surfaceId: string;
  /** Every distinct invocation alias used by the surface, in canonical alias order. */
  readonly operations: readonly AuthoringOperationFixtureDefinition[];
}

/** Fail-closed operation fixture projection with no partial authority. */
export interface AuthoringOperationFixtureRejectedModel {
  /** Rejection discriminator. */
  readonly status: "rejected";
  /** Stable rejection category. */
  readonly reason: AuthoringOperationFixtureModelRejectionReason;
}

/** Closed result of projecting generic operation fixtures for one Source surface. */
export type AuthoringOperationFixtureModelResult =
  AuthoringOperationFixtureReadyModel | AuthoringOperationFixtureRejectedModel;

interface OwnerWork {
  readonly depth: number;
  readonly value: unknown;
}

interface ActionWork {
  readonly depth: number;
  readonly value: unknown;
}

function collectSurfaceOperationInvocations(
  documentValue: unknown,
  surfaceId: string,
): ReadonlyMap<string, string> {
  const document = readDataObject(documentValue);
  const surfaces = readDataObject(readOwnDataValue(document, "surfaces"));
  const surfaceValue = readOwnDataValue(surfaces, surfaceId);
  if (surfaceValue === undefined) throw new FixtureProjectionError("surface-missing");
  const surface = readDataObject(surfaceValue);
  const owners: OwnerWork[] = [
    Object.freeze({ depth: 0, value: readOwnDataValue(surface, "root") }),
  ];
  const actions: ActionWork[] = [];
  const invocations = new Map<string, string>();
  let ownerOccurrences = 0;
  let ownerOccurrencesScheduled = 1;
  let actionOccurrences = 0;

  const scheduleActions = (value: unknown, depth: number): void => {
    if (depth > AUTHORING_OPERATION_LIMITS.maxActionDepth) {
      throw new FixtureProjectionError("projection-limit");
    }
    const remaining = AUTHORING_OPERATION_LIMITS.maxActionOccurrences - actionOccurrences;
    for (const action of readDataArray(value, remaining)) {
      actionOccurrences += 1;
      if (actionOccurrences > AUTHORING_OPERATION_LIMITS.maxActionOccurrences) {
        throw new FixtureProjectionError("projection-limit");
      }
      actions.push(Object.freeze({ depth, value: action }));
    }
  };

  const scheduleOwners = (value: unknown, depth: number): void => {
    if (depth > AUTHORING_OPERATION_LIMITS.maxOwnerDepth) {
      throw new FixtureProjectionError("projection-limit");
    }
    const remaining = AUTHORING_OPERATION_LIMITS.maxOwnerOccurrences - ownerOccurrencesScheduled;
    for (const owner of readDataArray(value, remaining)) {
      ownerOccurrencesScheduled += 1;
      owners.push(Object.freeze({ depth, value: owner }));
    }
  };

  while (owners.length > 0) {
    const work = owners.pop();
    if (work === undefined) continue;
    ownerOccurrences += 1;
    if (
      work.depth > AUTHORING_OPERATION_LIMITS.maxOwnerDepth ||
      ownerOccurrences > AUTHORING_OPERATION_LIMITS.maxOwnerOccurrences
    ) {
      throw new FixtureProjectionError("projection-limit");
    }
    const owner = readDataObject(work.value);
    const onValue = readOwnDataValue(owner, "on");
    if (onValue !== undefined) {
      for (const [, actionList] of readOwnDataEntries(readDataObject(onValue))) {
        scheduleActions(actionList, 0);
      }
    }
    const slotsValue = readOwnDataValue(owner, "slots");
    if (slotsValue !== undefined) {
      for (const [, childrenValue] of readOwnDataEntries(readDataObject(slotsValue))) {
        scheduleOwners(childrenValue, work.depth + 1);
      }
    }
    const behaviorsValue = readOwnDataValue(owner, "behaviors");
    if (behaviorsValue !== undefined) {
      scheduleOwners(behaviorsValue, work.depth);
    }
  }

  while (actions.length > 0) {
    const work = actions.pop();
    if (work === undefined) continue;
    const action = readDataObject(work.value);
    if (readOwnDataValue(action, "type") !== "operation.invoke") continue;
    const alias = readNonEmptyString(readOwnDataValue(action, "as"));
    const capabilityId = readNonEmptyString(readOwnDataValue(action, "operation"));
    const previousCapability = invocations.get(alias);
    if (previousCapability !== undefined && previousCapability !== capabilityId) {
      throw new FixtureProjectionError("alias-conflict");
    }
    invocations.set(alias, capabilityId);
    const onSuccess = readOwnDataValue(action, "onSuccess");
    if (onSuccess !== undefined) scheduleActions(onSuccess, work.depth + 1);
    const onFailure = readOwnDataValue(action, "onFailure");
    if (onFailure !== undefined) scheduleActions(onFailure, work.depth + 1);
  }

  return invocations;
}

function rejectedModel(
  reason: AuthoringOperationFixtureModelRejectionReason,
): AuthoringOperationFixtureRejectedModel {
  return Object.freeze({ status: "rejected", reason });
}

/**
 * Projects the exact operation aliases used by one Source surface and their Catalog fixtures.
 *
 * @remarks The same Catalog-aware validator boundary used by the editor admits both inputs. Only
 * `operation.invoke` actions reachable from the selected surface create fixture authority. Fixture
 * payloads are detached by `@desen/testkit`; the projector never derives behavior from payload
 * contents. A surface with no invokes is a valid ready model with an empty operation inventory.
 */
export function prepareAuthoringOperationFixtureModel(
  catalogValue: unknown,
  documentValue: unknown,
  surfaceId: string,
): AuthoringOperationFixtureModelResult {
  if (typeof surfaceId !== "string" || surfaceId.length === 0) {
    return rejectedModel("surface-id-invalid");
  }
  let prepared: ReturnType<typeof prepareCatalogAuthoringModel>;
  try {
    prepared = prepareCatalogAuthoringModel(catalogValue, documentValue);
  } catch {
    return rejectedModel("projection-invalid");
  }
  if (!prepared.ok) return rejectedModel(prepared.reason);

  try {
    if (!prepared.model.surfaces.some((surface) => surface.id === surfaceId)) {
      return rejectedModel("surface-missing");
    }
    const invocations = collectSurfaceOperationInvocations(
      prepared.model.validationDocument,
      surfaceId,
    );
    const manifestByCapability = new Map<string, OperationManifest>();
    const registrations: RegisteredOperation[] = [];
    for (const capabilityId of [...new Set(invocations.values())].sort(compareText)) {
      const manifest = operationManifest(prepared.model.validationCatalogs, capabilityId);
      if (manifest === undefined) return rejectedModel("operation-missing");
      manifestByCapability.set(capabilityId, manifest);
      registrations.push(registerOperation({ id: capabilityId, manifest }));
    }

    const fixtureSnapshot = createSyntheticFixtureSnapshot({
      context: SYNTHETIC_FIXTURE_CONTEXT,
      operations: registrations,
      resources: [],
    });
    const operations = [...invocations.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([alias, capabilityId]): AuthoringOperationFixtureDefinition => {
        const manifest = manifestByCapability.get(capabilityId);
        if (manifest === undefined) throw new FixtureProjectionError("operation-missing");
        const fixtures: SyntheticOperationFixtures =
          fixtureSnapshot.operations[capabilityId] ?? Object.freeze({});
        const errorDescriptions = new Map(
          manifest.errors.map((error) => [error.code, error.description] as const),
        );
        const outcomes: AuthoringOperationFixtureOutcome[] = [];
        if (Object.hasOwn(fixtures, "success")) {
          outcomes.push(
            Object.freeze({
              id: "success",
              label: "Success",
              kind: "success",
              errorCode: null,
              description: "Catalog-declared synthetic success.",
              fixtureValue: fixtures.success as SyntheticFixtureValue,
            }),
          );
        }
        for (const errorCode of Object.keys(fixtures.errors ?? {}).sort(compareText)) {
          outcomes.push(
            Object.freeze({
              id: `error:${errorCode}`,
              label: `Error · ${errorCode}`,
              kind: "error",
              errorCode,
              description: errorDescriptions.get(errorCode),
              fixtureValue: (fixtures.errors as Readonly<Record<string, SyntheticFixtureValue>>)[
                errorCode
              ] as SyntheticFixtureValue,
            }),
          );
        }
        return Object.freeze({
          alias,
          capabilityId,
          description: optionalNonEmptyString(manifest.description),
          effect: manifest.effect,
          outcomes: Object.freeze(outcomes),
        });
      });
    const document = readDataObject(prepared.model.validationDocument);
    const model = deepFreezeProjection({
      status: "ready" as const,
      documentId: readNonEmptyString(readOwnDataValue(document, "id")),
      surfaceId,
      operations: Object.freeze(operations),
    });
    PREPARED_FIXTURE_MODELS.add(model);
    return model;
  } catch (error) {
    if (error instanceof FixtureProjectionError) return rejectedModel(error.reason);
    return rejectedModel("fixture-invalid");
  }
}

/** Observable lifecycle of one generic operation fixture. */
export type AuthoringOperationFixtureStatus =
  "disposed" | "failed" | "idle" | "pending" | "succeeded" | "unavailable";

/** Immutable lifecycle state for one explicit Source invocation alias. */
export interface AuthoringOperationFixtureSnapshot {
  /** Surface-scoped Source alias. */
  readonly alias: string;
  /** Exact Catalog capability authorized for this alias. */
  readonly capabilityId: string;
  /** Optional Catalog operation description. */
  readonly description: string | undefined;
  /** Exact Catalog effect authorized for this alias. */
  readonly effect: RuntimeOperationEffect;
  /** Catalog-authenticated selectable outcomes. */
  readonly outcomes: readonly AuthoringOperationFixtureOutcome[];
  /** Current fixture lifecycle. */
  readonly status: AuthoringOperationFixtureStatus;
  /** Outcome captured by the next or current invocation, or `null` when none exists. */
  readonly selectedOutcomeId: AuthoringOperationFixtureOutcomeId | null;
  /** Last explicitly completed outcome, or `null`. */
  readonly completedOutcomeId: AuthoringOperationFixtureOutcomeId | null;
}

/** Complete immutable state consumed by generic Run controls. */
export interface AuthoringOperationFixtureControllerSnapshot {
  /** Whether Source and Catalog preparation succeeded. */
  readonly modelStatus: "ready" | "rejected";
  /** Stable preparation rejection reason, or `null` for a ready model. */
  readonly rejectionReason: AuthoringOperationFixtureModelRejectionReason | null;
  /** Whether this controller lifetime has been terminally disposed. */
  readonly disposed: boolean;
  /** Every explicit invocation alias and its independent lifecycle. */
  readonly operations: readonly AuthoringOperationFixtureSnapshot[];
}

/** Listener notified with a detached, deeply frozen controller snapshot. */
export type AuthoringOperationFixtureControllerListener = (
  snapshot: AuthoringOperationFixtureControllerSnapshot,
) => void;

/** Controlled result of selecting one alias's next synthetic outcome. */
export type AuthoringOperationFixtureSelectionResult =
  | Readonly<{
      readonly status: "selected";
      readonly alias: string;
      readonly snapshot: AuthoringOperationFixtureControllerSnapshot;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        | "disposed"
        | "inactive"
        | "pending"
        | "unavailable"
        | "unknown-operation"
        | "unknown-outcome";
    }>;

/** Controlled result of explicitly settling one alias's current pending invocation. */
export type AuthoringOperationFixtureCompletionResult =
  | Readonly<{
      readonly status: "completed";
      readonly alias: string;
      readonly outcomeId: AuthoringOperationFixtureOutcomeId;
    }>
  | Readonly<{
      readonly status: "ignored";
      readonly reason: "disposed" | "inactive" | "not-pending" | "unknown-operation";
    }>;

/** Exact Runtime identity that one fixture-controller lifetime is authorized to serve. */
export interface AuthoringOperationFixtureExpectedContext {
  /** Active Bundle document identifier. */
  readonly documentId: string;
  /** Exact active preview Bundle revision. */
  readonly revision: string;
  /** Surface that owns this controller lifetime. */
  readonly surfaceId: string;
}

/** Generic synthetic operation controller and its stable Runtime host port. */
export interface AuthoringOperationFixtureController {
  /** Stable operation-port identity retained across all alias and outcome changes. */
  readonly operationPort: RuntimeOperationPort;
  /** Reads current immutable, input-free controller state. */
  readonly read: () => AuthoringOperationFixtureControllerSnapshot;
  /** Subscribes to lifecycle changes and returns an idempotent unsubscribe callback. */
  readonly subscribe: (listener: AuthoringOperationFixtureControllerListener) => () => void;
  /** Selects one explicit alias's next authenticated fixture outcome. */
  readonly selectOutcome: (
    alias: string,
    outcomeId: AuthoringOperationFixtureOutcomeId,
  ) => AuthoringOperationFixtureSelectionResult;
  /** Completes one explicit alias's current real pending Promise. */
  readonly completePending: (alias: string) => AuthoringOperationFixtureCompletionResult;
  /** Reopens the same controller after a development-only effect replay. */
  readonly activate: () => void;
  /** Synchronously closes admission and revokes pending work before effect cleanup can yield. */
  readonly deactivate: () => void;
  /** Revokes all pending work and terminally disables this controller lifetime. */
  readonly dispose: () => void;
}

interface InternalOperationState {
  readonly definition: AuthoringOperationFixtureDefinition;
  selectedOutcomeId: AuthoringOperationFixtureOutcomeId | null;
  completedOutcomeId: AuthoringOperationFixtureOutcomeId | null;
  status: Exclude<AuthoringOperationFixtureStatus, "disposed">;
  pending: PendingInvocation | undefined;
}

interface PendingInvocation {
  readonly outcome: AuthoringOperationFixtureOutcome;
  readonly resolve: (result: RuntimeHostCallResult) => void;
}

const DENIED_RESULT = deepFreezeProjection({ status: "denied" } satisfies RuntimeHostCallResult);

function readExactExpectedContext(
  value: AuthoringOperationFixtureExpectedContext,
): AuthoringOperationFixtureExpectedContext {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Fixture expected context must be an exact data object.");
  }
  const expectedKeys = ["documentId", "revision", "surfaceId"] as const;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    throw new TypeError("Fixture expected context must be inspectable inert data.");
  }
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key as never))
  ) {
    throw new TypeError(
      "Fixture expected context must contain only documentId, revision, surfaceId.",
    );
  }
  const projected = Object.create(null) as Record<(typeof expectedKeys)[number], string>;
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor?.enumerable !== true ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      descriptor.value.length === 0
    ) {
      throw new TypeError(`Fixture expected context ${key} must be a non-empty own data string.`);
    }
    projected[key] = descriptor.value;
  }
  return deepFreezeProjection({
    documentId: projected.documentId,
    revision: projected.revision,
    surfaceId: projected.surfaceId,
  });
}

function readOwnRequestString(request: RuntimeOperationRequest, key: string): string | undefined {
  if (typeof request !== "object" || request === null || Array.isArray(request)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(request, key);
    return descriptor?.enumerable === true &&
      "value" in descriptor &&
      typeof descriptor.value === "string"
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function hasAuthorizedRequestContext(
  request: RuntimeOperationRequest,
  expectedContext: AuthoringOperationFixtureExpectedContext,
): boolean {
  if (typeof request !== "object" || request === null || Array.isArray(request)) return false;
  let contextDescriptor: PropertyDescriptor | undefined;
  try {
    contextDescriptor = Object.getOwnPropertyDescriptor(request, "context");
  } catch {
    return false;
  }
  if (
    contextDescriptor?.enumerable !== true ||
    !("value" in contextDescriptor) ||
    typeof contextDescriptor.value !== "object" ||
    contextDescriptor.value === null ||
    Array.isArray(contextDescriptor.value)
  ) {
    return false;
  }
  const context = contextDescriptor.value as object;
  const expectedKeys = ["documentId", "revision", "surfaceId", "requestId"] as const;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(context);
  } catch {
    return false;
  }
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key as never))
  ) {
    return false;
  }
  const readContextString = (key: (typeof expectedKeys)[number]): string | undefined => {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(context, key);
      return descriptor?.enumerable === true &&
        "value" in descriptor &&
        typeof descriptor.value === "string" &&
        descriptor.value.length > 0
        ? descriptor.value
        : undefined;
    } catch {
      return undefined;
    }
  };
  return (
    readContextString("documentId") === expectedContext.documentId &&
    readContextString("revision") === expectedContext.revision &&
    readContextString("surfaceId") === expectedContext.surfaceId &&
    readContextString("requestId") !== undefined
  );
}

function operationOutcomeResult(outcome: AuthoringOperationFixtureOutcome): RuntimeHostCallResult {
  return outcome.kind === "success"
    ? deepFreezeProjection({ status: "succeeded", value: outcome.fixtureValue })
    : deepFreezeProjection({ status: "failed", errorCode: outcome.errorCode as string });
}

/**
 * Creates one generic deferred fixture lifetime from an authenticated fixture model result.
 *
 * @remarks A ready model must be the exact branded result returned by
 * {@link prepareAuthoringOperationFixtureModel}; casts cannot mint host authority. Each Runtime
 * request must match its Source alias, Catalog capability and effect, and exact preview identity.
 * Request input is deliberately never read or retained. Each authorized call remains a real
 * pending Promise until the corresponding alias is explicitly completed. Integration and
 * production bindings are never created here.
 *
 * @throws TypeError when a purported ready model is forged, the expected context is malformed, or
 * its document/surface identity does not match the prepared model.
 */
export function createAuthoringOperationFixtureController(
  modelResult: AuthoringOperationFixtureModelResult,
  expectedContextInput: AuthoringOperationFixtureExpectedContext,
): AuthoringOperationFixtureController {
  const expectedContext = readExactExpectedContext(expectedContextInput);
  if (modelResult.status === "ready" && !PREPARED_FIXTURE_MODELS.has(modelResult)) {
    throw new TypeError("Fixture controller requires a prepared operation fixture model.");
  }
  if (
    modelResult.status === "ready" &&
    (modelResult.documentId !== expectedContext.documentId ||
      modelResult.surfaceId !== expectedContext.surfaceId)
  ) {
    throw new TypeError("Fixture controller context must match the prepared Source identity.");
  }
  const operationStates = new Map<string, InternalOperationState>();
  if (modelResult.status === "ready") {
    for (const definition of modelResult.operations) {
      const selectedOutcomeId = definition.outcomes[0]?.id ?? null;
      operationStates.set(definition.alias, {
        definition,
        selectedOutcomeId,
        completedOutcomeId: null,
        status: selectedOutcomeId === null ? "unavailable" : "idle",
        pending: undefined,
      });
    }
  }

  let active = true;
  let disposed = false;
  let snapshot!: AuthoringOperationFixtureControllerSnapshot;
  const listeners = new Set<AuthoringOperationFixtureControllerListener>();
  const projectSnapshot = (): AuthoringOperationFixtureControllerSnapshot =>
    deepFreezeProjection({
      modelStatus: modelResult.status,
      rejectionReason: modelResult.status === "rejected" ? modelResult.reason : null,
      disposed,
      operations: [...operationStates.values()].map((state) => ({
        alias: state.definition.alias,
        capabilityId: state.definition.capabilityId,
        description: state.definition.description,
        effect: state.definition.effect,
        outcomes: state.definition.outcomes,
        status: disposed ? ("disposed" as const) : state.status,
        selectedOutcomeId: state.selectedOutcomeId,
        completedOutcomeId: state.completedOutcomeId,
      })),
    });
  snapshot = projectSnapshot();

  const notify = (): void => {
    snapshot = projectSnapshot();
    for (const listener of [...listeners]) {
      try {
        listener(snapshot);
      } catch {
        // A view listener cannot change fixture settlement or prevent sibling notifications.
      }
    }
  };
  const invoke = (
    request: RuntimeOperationRequest,
  ): Promise<RuntimeHostCallResult> | RuntimeHostCallResult => {
    if (disposed || !active || !hasAuthorizedRequestContext(request, expectedContext)) {
      return DENIED_RESULT;
    }
    const alias = readOwnRequestString(request, "invocationAlias");
    const state = alias === undefined ? undefined : operationStates.get(alias);
    if (
      state === undefined ||
      readOwnRequestString(request, "capabilityId") !== state.definition.capabilityId ||
      readOwnRequestString(request, "effect") !== state.definition.effect
    ) {
      return DENIED_RESULT;
    }
    const outcome = state.definition.outcomes.find(
      (candidate) => candidate.id === state.selectedOutcomeId,
    );
    if (outcome === undefined) return DENIED_RESULT;

    const replaced = state.pending;
    let resolvePending!: (result: RuntimeHostCallResult) => void;
    const promise = new Promise<RuntimeHostCallResult>((resolve) => {
      resolvePending = resolve;
    });
    state.pending = Object.freeze({ outcome, resolve: resolvePending });
    state.completedOutcomeId = null;
    state.status = "pending";
    replaced?.resolve(DENIED_RESULT);
    notify();
    return promise;
  };
  const operationPort = Object.freeze({ invoke }) satisfies RuntimeOperationPort;
  const read = (): AuthoringOperationFixtureControllerSnapshot => snapshot;
  const subscribe = (listener: AuthoringOperationFixtureControllerListener): (() => void) => {
    if (typeof listener !== "function" || disposed) return () => undefined;
    listeners.add(listener);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      listeners.delete(listener);
    };
  };
  const selectOutcome = (
    alias: string,
    outcomeId: AuthoringOperationFixtureOutcomeId,
  ): AuthoringOperationFixtureSelectionResult => {
    if (disposed) return Object.freeze({ status: "rejected", reason: "disposed" });
    if (!active) return Object.freeze({ status: "rejected", reason: "inactive" });
    const state = typeof alias === "string" ? operationStates.get(alias) : undefined;
    if (state === undefined) {
      return Object.freeze({ status: "rejected", reason: "unknown-operation" });
    }
    if (state.pending !== undefined) {
      return Object.freeze({ status: "rejected", reason: "pending" });
    }
    if (state.definition.outcomes.length === 0) {
      return Object.freeze({ status: "rejected", reason: "unavailable" });
    }
    if (!state.definition.outcomes.some((outcome) => outcome.id === outcomeId)) {
      return Object.freeze({ status: "rejected", reason: "unknown-outcome" });
    }
    state.selectedOutcomeId = outcomeId;
    state.completedOutcomeId = null;
    state.status = "idle";
    notify();
    return Object.freeze({ status: "selected", alias, snapshot });
  };
  const completePending = (alias: string): AuthoringOperationFixtureCompletionResult => {
    if (disposed) return Object.freeze({ status: "ignored", reason: "disposed" });
    if (!active) return Object.freeze({ status: "ignored", reason: "inactive" });
    const state = typeof alias === "string" ? operationStates.get(alias) : undefined;
    if (state === undefined) {
      return Object.freeze({ status: "ignored", reason: "unknown-operation" });
    }
    const current = state.pending;
    if (current === undefined) {
      return Object.freeze({ status: "ignored", reason: "not-pending" });
    }
    state.pending = undefined;
    state.completedOutcomeId = current.outcome.id;
    state.status = current.outcome.kind === "success" ? "succeeded" : "failed";
    current.resolve(operationOutcomeResult(current.outcome));
    notify();
    return Object.freeze({ status: "completed", alias, outcomeId: current.outcome.id });
  };
  const activate = (): void => {
    if (disposed || active) return;
    active = true;
  };
  const deactivate = (): void => {
    if (disposed || !active) return;
    active = false;
    let changed = false;
    for (const state of operationStates.values()) {
      const revoked = state.pending;
      if (revoked === undefined) continue;
      state.pending = undefined;
      state.completedOutcomeId = null;
      state.status = state.selectedOutcomeId === null ? "unavailable" : "idle";
      revoked.resolve(DENIED_RESULT);
      changed = true;
    }
    if (changed) notify();
  };
  const dispose = (): void => {
    if (disposed) return;
    active = false;
    disposed = true;
    for (const state of operationStates.values()) {
      state.pending?.resolve(DENIED_RESULT);
      state.pending = undefined;
      state.completedOutcomeId = null;
    }
    notify();
    listeners.clear();
  };

  return Object.freeze({
    operationPort,
    read,
    subscribe,
    selectOutcome,
    completePending,
    activate,
    deactivate,
    dispose,
  });
}
