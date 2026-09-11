import {
  admitDtcgTokenDocument,
  collectDtcgTokenDocumentForResolution,
  getDtcgAliasTarget,
  isDtcgTokenPath,
  isDtcgTokenAlias,
  validateDtcgLiteralOverride,
} from "./token-document.js";
import { DESIGN_TOKEN_PROFILE, getDesignTokenValueFamily } from "./token-types.js";

import type { CollectedDtcgToken, DtcgTokenDocument } from "./token-document.js";
import type {
  AdmittedDtcgToken,
  DesignTokenValueFamily,
  DtcgDiagnostic,
  DtcgDiagnosticCode,
  DtcgFailureClassification,
  DtcgJsonObject,
  DtcgLiteralValueByType,
  DtcgTokenLiteral,
  DtcgTokenType,
} from "./token-types.js";

const SOURCE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;

/**
 * One ordered DTCG source selected from a project design system.
 *
 * @remarks The optional descriptive fields match the editable-project envelope but do not affect
 * resolution. A base source followed by explicit mode/context sources models selection outside the
 * DTCG documents themselves.
 */
export interface DesignTokenSource {
  readonly description?: string;
  readonly document: unknown;
  readonly extensions?: DtcgJsonObject;
  readonly id: string;
}

/** A final, non-aliased token value override applied after every selected source. */
export type DesignTokenLiteralOverride = {
  readonly [Type in DtcgTokenType]: {
    readonly path: string;
    readonly type: Type;
    readonly value: DtcgLiteralValueByType[Type];
  };
}[DtcgTokenType];

/** Complete input for deterministic project token resolution. */
export interface DesignTokenResolutionRequest {
  readonly literalOverrides?: readonly DesignTokenLiteralOverride[];
  readonly sources: readonly DesignTokenSource[];
}

/** Origin of a declaration selected from an ordered DTCG source. */
export interface DesignTokenSourceOrigin {
  readonly kind: "source";
  readonly sourceId: string;
  readonly sourceIndex: number;
}

/** Origin of a final explicit literal override. */
export interface DesignTokenLiteralOverrideOrigin {
  readonly kind: "literal-override";
  readonly overrideIndex: number;
}

/** Exact origin of the winning declaration for a resolved token. */
export type DesignTokenOrigin = DesignTokenLiteralOverrideOrigin | DesignTokenSourceOrigin;

/** One fully resolved token with deterministic origin and alias provenance. */
export interface ResolvedDesignToken {
  readonly aliasChain: readonly string[];
  readonly family: DesignTokenValueFamily;
  readonly metadata: AdmittedDtcgToken["metadata"];
  readonly origin: DesignTokenOrigin;
  readonly path: string;
  readonly type: DtcgTokenType;
  readonly value: DtcgTokenLiteral;
}

/** Successful deterministic resolution of an ordered source selection. */
export interface DesignTokenResolutionSuccess {
  readonly ok: true;
  readonly sourceIds: readonly string[];
  readonly tokenPaths: readonly string[];
  readonly tokens: Readonly<Record<string, ResolvedDesignToken>>;
}

/** Safely retained context for an unsupported or invalid selected source. */
export interface RejectedDesignTokenSource {
  readonly id: string;
  readonly index: number;
  readonly snapshot: DtcgTokenDocument;
}

/** Explicit rejection with no partial resolved token map. */
export interface DesignTokenResolutionFailure {
  readonly diagnostics: readonly [DtcgDiagnostic];
  readonly ok: false;
  readonly rejectedSource?: RejectedDesignTokenSource;
}

/** Result of deterministic project token resolution. */
export type DesignTokenResolutionResult =
  DesignTokenResolutionFailure | DesignTokenResolutionSuccess;

interface OverlayDeclaration {
  readonly metadata: AdmittedDtcgToken["metadata"];
  readonly origin: DesignTokenOrigin;
  readonly path: string;
  readonly type: DtcgTokenType;
  readonly value: AdmittedDtcgToken["value"];
}

interface PendingOverlayDeclaration extends CollectedDtcgToken {
  readonly origin: DesignTokenSourceOrigin;
}

interface PendingSourceTypeTransition {
  readonly next: PendingOverlayDeclaration;
  readonly prior: PendingOverlayDeclaration;
}

interface OverlayTypeState {
  readonly active: string[];
  readonly cache: Map<string, DtcgTokenType>;
  steps: number;
}

interface ResolveState {
  readonly active: string[];
  readonly cache: Map<string, ResolvedDesignToken>;
  steps: number;
}

function deepFreeze<Value>(value: Value): Value {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function escapePointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function pointer(...segments: readonly (number | string)[]): string {
  return segments.map((segment) => `/${escapePointerSegment(String(segment))}`).join("");
}

function issue(
  code: DtcgDiagnosticCode,
  message: string,
  location: string,
  classification: DtcgFailureClassification = "INVALID_DTCG",
  sourceId?: string,
  tokenPath?: string,
): DtcgDiagnostic {
  const output: {
    classification: DtcgFailureClassification;
    code: DtcgDiagnosticCode;
    message: string;
    pointer: string;
    sourceId?: string;
    tokenPath?: string;
  } = { classification, code, message, pointer: location };
  if (sourceId !== undefined) output.sourceId = sourceId;
  if (tokenPath !== undefined) output.tokenPath = tokenPath;
  return deepFreeze(output);
}

function failure(
  diagnostic: DtcgDiagnostic,
  rejectedSource?: RejectedDesignTokenSource,
): DesignTokenResolutionFailure {
  const output: {
    diagnostics: readonly [DtcgDiagnostic];
    ok: false;
    rejectedSource?: RejectedDesignTokenSource;
  } = { diagnostics: Object.freeze([diagnostic]), ok: false };
  if (rejectedSource !== undefined) output.rejectedSource = rejectedSource;
  return deepFreeze(output);
}

function inspectPlainDataObject(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (value === null || typeof value !== "object") return undefined;
  let isArray: boolean;
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let descriptors: PropertyDescriptorMap;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as PropertyDescriptorMap;
  } catch {
    return undefined;
  }
  if (
    isArray ||
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string")
  ) {
    return undefined;
  }
  const accepted = new Set([...requiredKeys, ...optionalKeys]);
  const stringKeys = keys as readonly string[];
  if (
    !requiredKeys.every((key) => stringKeys.includes(key)) ||
    stringKeys.some((key) => !accepted.has(key))
  ) {
    return undefined;
  }
  const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of stringKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      return undefined;
    }
    output[key] = descriptor.value;
  }
  return output;
}

function inspectDenseArray(value: unknown, maximum: number): readonly unknown[] | undefined {
  if (value === null || typeof value !== "object") return undefined;
  let isArray: boolean;
  let keys: readonly PropertyKey[];
  let descriptors: PropertyDescriptorMap;
  try {
    isArray = Array.isArray(value);
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as PropertyDescriptorMap;
  } catch {
    return undefined;
  }
  const lengthDescriptor = descriptors.length;
  if (
    !isArray ||
    lengthDescriptor === undefined ||
    lengthDescriptor.enumerable ||
    !Object.hasOwn(lengthDescriptor, "value") ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > maximum
  ) {
    return undefined;
  }
  const length = lengthDescriptor.value;
  if (
    keys.length !== length + 1 ||
    keys.some(
      (key, index) =>
        typeof key !== "string" || (index < length ? key !== String(index) : key !== "length"),
    )
  ) {
    return undefined;
  }
  const output: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      return undefined;
    }
    output.push(descriptor.value);
  }
  return output;
}

function validateSourceMetadata(source: Readonly<Record<string, unknown>>): boolean {
  if (
    source.description !== undefined &&
    (typeof source.description !== "string" || source.description.length > 512)
  ) {
    return false;
  }
  if (source.extensions !== undefined) {
    const extensionAdmission = admitDtcgTokenDocument({
      extensionProbe: {
        $type: "number",
        $value: 0,
        $extensions: source.extensions,
      },
    });
    if (!extensionAdmission.ok) return false;
  }
  return true;
}

function resolutionLimitDiagnostic(declaration: PendingOverlayDeclaration): DtcgDiagnostic {
  return issue(
    "RESOLUTION_LIMIT_EXCEEDED",
    `Resolution exceeds ${DESIGN_TOKEN_PROFILE.limits.maxResolutionSteps} bounded steps.`,
    declaration.pointer,
    "INVALID_DTCG",
    declaration.origin.sourceId,
    declaration.path,
  );
}

function inferPendingDeclarationType(
  declaration: PendingOverlayDeclaration,
  declarations: ReadonlyMap<string, PendingOverlayDeclaration>,
  state: OverlayTypeState,
): DtcgTokenType | DtcgDiagnostic {
  if (!isDtcgTokenAlias(declaration.value)) {
    return (
      declaration.declaredType ??
      issue(
        "MISSING_DTCG_TYPE",
        "A literal token must declare or inherit a supported $type.",
        declaration.pointer,
        "INVALID_DTCG",
        declaration.origin.sourceId,
        declaration.path,
      )
    );
  }
  const targetPath = getDtcgAliasTarget(declaration.value);
  if (!declarations.has(targetPath)) {
    return issue(
      "ALIAS_TARGET_MISSING",
      `Alias ${JSON.stringify(declaration.value)} targets a token absent from the final overlay.`,
      `${declaration.pointer}/$value`,
      "INVALID_DTCG",
      declaration.origin.sourceId,
      declaration.path,
    );
  }
  const targetType = inferOverlayPathType(targetPath, declarations, state);
  if (typeof targetType !== "string") return targetType;
  if (declaration.declaredType !== undefined && declaration.declaredType !== targetType) {
    return issue(
      "ALIAS_TYPE_MISMATCH",
      `Alias ${JSON.stringify(declaration.value)} resolves from ${declaration.declaredType} to ${targetType}.`,
      `${declaration.pointer}/$value`,
      "INVALID_DTCG",
      declaration.origin.sourceId,
      declaration.path,
    );
  }
  return declaration.declaredType ?? targetType;
}

function inferOverlayPathType(
  path: string,
  declarations: ReadonlyMap<string, PendingOverlayDeclaration>,
  state: OverlayTypeState,
): DtcgTokenType | DtcgDiagnostic {
  const cached = state.cache.get(path);
  if (cached !== undefined) return cached;
  const declaration = declarations.get(path);
  if (declaration === undefined) {
    return issue(
      "ALIAS_TARGET_MISSING",
      `Alias target ${JSON.stringify(path)} does not exist in the selected source overlay.`,
      "",
      "INVALID_DTCG",
      undefined,
      path,
    );
  }
  state.steps += 1;
  if (state.steps > DESIGN_TOKEN_PROFILE.limits.maxResolutionSteps) {
    return resolutionLimitDiagnostic(declaration);
  }
  const cycleIndex = state.active.indexOf(path);
  if (cycleIndex !== -1) {
    const cycle = [...state.active.slice(cycleIndex), path];
    return issue(
      "ALIAS_CYCLE",
      `Alias cycle detected while inferring a token type: ${cycle.join(" -> ")}.`,
      `${declaration.pointer}/$value`,
      "INVALID_DTCG",
      declaration.origin.sourceId,
      path,
    );
  }
  if (state.active.length >= DESIGN_TOKEN_PROFILE.limits.maxAliasDepth) {
    return issue(
      "RESOLUTION_LIMIT_EXCEEDED",
      `Alias depth exceeds ${DESIGN_TOKEN_PROFILE.limits.maxAliasDepth}.`,
      `${declaration.pointer}/$value`,
      "INVALID_DTCG",
      declaration.origin.sourceId,
      path,
    );
  }
  state.active.push(path);
  try {
    const inferred = inferPendingDeclarationType(declaration, declarations, state);
    if (typeof inferred === "string") state.cache.set(path, inferred);
    return inferred;
  } finally {
    state.active.pop();
  }
}

function inferDetachedDeclarationType(
  declaration: PendingOverlayDeclaration,
  declarations: ReadonlyMap<string, PendingOverlayDeclaration>,
  state: OverlayTypeState,
): DtcgTokenType | DtcgDiagnostic {
  state.steps += 1;
  if (state.steps > DESIGN_TOKEN_PROFILE.limits.maxResolutionSteps) {
    return resolutionLimitDiagnostic(declaration);
  }
  return inferPendingDeclarationType(declaration, declarations, state);
}

function failureWithSourceSnapshot(
  diagnostic: DtcgDiagnostic,
  sourceSnapshots: ReadonlyMap<string, RejectedDesignTokenSource>,
): DesignTokenResolutionFailure {
  const rejectedSource =
    diagnostic.sourceId === undefined ? undefined : sourceSnapshots.get(diagnostic.sourceId);
  return failure(diagnostic, rejectedSource);
}

function resolveOne(
  path: string,
  declarations: ReadonlyMap<string, OverlayDeclaration>,
  state: ResolveState,
): ResolvedDesignToken | DtcgDiagnostic {
  const cached = state.cache.get(path);
  if (cached !== undefined) return cached;
  state.steps += 1;
  if (state.steps > DESIGN_TOKEN_PROFILE.limits.maxResolutionSteps) {
    return issue(
      "RESOLUTION_LIMIT_EXCEEDED",
      `Resolution exceeds ${DESIGN_TOKEN_PROFILE.limits.maxResolutionSteps} bounded steps.`,
      "",
      "INVALID_DTCG",
      undefined,
      path,
    );
  }
  const declaration = declarations.get(path);
  if (declaration === undefined) {
    return issue(
      "ALIAS_TARGET_MISSING",
      `Alias target ${JSON.stringify(path)} does not exist in the selected source overlay.`,
      "",
      "INVALID_DTCG",
      undefined,
      path,
    );
  }
  const cycleIndex = state.active.indexOf(path);
  if (cycleIndex !== -1) {
    const cycle = [...state.active.slice(cycleIndex), path];
    return issue(
      "ALIAS_CYCLE",
      `Alias cycle detected: ${cycle.join(" -> ")}.`,
      "",
      "INVALID_DTCG",
      declaration.origin.kind === "source" ? declaration.origin.sourceId : undefined,
      path,
    );
  }
  if (state.active.length >= DESIGN_TOKEN_PROFILE.limits.maxAliasDepth) {
    return issue(
      "RESOLUTION_LIMIT_EXCEEDED",
      `Alias depth exceeds ${DESIGN_TOKEN_PROFILE.limits.maxAliasDepth}.`,
      "",
      "INVALID_DTCG",
      declaration.origin.kind === "source" ? declaration.origin.sourceId : undefined,
      path,
    );
  }

  if (!isDtcgTokenAlias(declaration.value)) {
    const resolved = deepFreeze({
      aliasChain: Object.freeze([]) as readonly string[],
      family: getDesignTokenValueFamily(declaration.type),
      metadata: declaration.metadata,
      origin: declaration.origin,
      path,
      type: declaration.type,
      value: declaration.value,
    });
    state.cache.set(path, resolved);
    return resolved;
  }

  const targetPath = getDtcgAliasTarget(declaration.value);
  const targetDeclaration = declarations.get(targetPath);
  if (targetDeclaration === undefined) {
    return issue(
      "ALIAS_TARGET_MISSING",
      `Alias ${JSON.stringify(declaration.value)} targets a token absent from the final overlay.`,
      "",
      "INVALID_DTCG",
      declaration.origin.kind === "source" ? declaration.origin.sourceId : undefined,
      path,
    );
  }
  if (targetDeclaration.type !== declaration.type) {
    return issue(
      "ALIAS_TYPE_MISMATCH",
      `Alias ${JSON.stringify(declaration.value)} resolves from ${declaration.type} to ${targetDeclaration.type}.`,
      "",
      "INVALID_DTCG",
      declaration.origin.kind === "source" ? declaration.origin.sourceId : undefined,
      path,
    );
  }

  state.active.push(path);
  const target = resolveOne(targetPath, declarations, state);
  state.active.pop();
  if (!("value" in target)) return target;

  const resolved = deepFreeze({
    aliasChain: Object.freeze([targetPath, ...target.aliasChain]),
    family: getDesignTokenValueFamily(declaration.type),
    metadata: declaration.metadata,
    origin: declaration.origin,
    path,
    type: declaration.type,
    value: target.value,
  });
  state.cache.set(path, resolved);
  return resolved;
}

/**
 * Resolve an explicit ordered selection of project DTCG sources plus final literal overrides.
 *
 * @remarks Later sources replace earlier declarations by token path. Alias traversal starts only
 * after the full overlay exists, so aliases observe the final selected context. Literal overrides
 * have final precedence, cannot introduce tokens, cannot change a token's type, and cannot alias.
 * The function performs no I/O and returns no partial token map on failure.
 */
export function resolveDesignTokens(
  input: DesignTokenResolutionRequest,
): DesignTokenResolutionResult {
  const request = inspectPlainDataObject(input, ["sources"], ["literalOverrides"]);
  if (request === undefined) {
    return failure(
      issue(
        "INVALID_SOURCE_DESCRIPTOR",
        "Token resolution input must contain only sources and optional literalOverrides.",
        "",
      ),
    );
  }
  const sources = inspectDenseArray(request.sources, DESIGN_TOKEN_PROFILE.limits.maxSources);
  if (sources === undefined) {
    return failure(
      issue(
        "INVALID_SOURCE_DESCRIPTOR",
        `sources must be a dense array with at most ${DESIGN_TOKEN_PROFILE.limits.maxSources} entries.`,
        "/sources",
      ),
    );
  }
  if (sources.length === 0) {
    return failure(
      issue("EMPTY_SOURCE_LIST", "At least one token source must be selected.", "/sources"),
    );
  }

  const pendingDeclarations = new Map<string, PendingOverlayDeclaration>();
  const sourceTypeTransitions: PendingSourceTypeTransition[] = [];
  const sourceSnapshots = new Map<string, RejectedDesignTokenSource>();
  const sourceIds: string[] = [];
  for (const [sourceIndex, candidate] of sources.entries()) {
    const source = inspectPlainDataObject(
      candidate,
      ["id", "document"],
      ["description", "extensions"],
    );
    const sourcePointer = pointer("sources", sourceIndex);
    if (
      source === undefined ||
      typeof source.id !== "string" ||
      !SOURCE_ID.test(source.id) ||
      !validateSourceMetadata(source)
    ) {
      return failure(
        issue(
          "INVALID_SOURCE_DESCRIPTOR",
          "Each source requires a unique bounded id, a document, and valid inert metadata.",
          sourcePointer,
        ),
      );
    }
    if (sourceIds.includes(source.id)) {
      return failure(
        issue(
          "DUPLICATE_SOURCE_ID",
          `Duplicate token source id ${JSON.stringify(source.id)}.`,
          pointer("sources", sourceIndex, "id"),
          "INVALID_DTCG",
          source.id,
        ),
      );
    }
    sourceIds.push(source.id);

    const collection = collectDtcgTokenDocumentForResolution(source.document, source.id);
    if (!collection.ok) {
      const rejectedSource =
        collection.snapshot === undefined
          ? undefined
          : deepFreeze({ id: source.id, index: sourceIndex, snapshot: collection.snapshot });
      return failure(collection.diagnostics[0], rejectedSource);
    }
    sourceSnapshots.set(
      source.id,
      deepFreeze({ id: source.id, index: sourceIndex, snapshot: collection.document }),
    );
    for (const tokenPath of collection.tokenPaths) {
      const token = collection.tokens[tokenPath];
      if (token === undefined) continue;
      const declaration = deepFreeze({
        ...token,
        origin: deepFreeze({ kind: "source" as const, sourceId: source.id, sourceIndex }),
      });
      const prior = pendingDeclarations.get(tokenPath);
      if (prior !== undefined) {
        sourceTypeTransitions.push(deepFreeze({ next: declaration, prior }));
      }
      pendingDeclarations.set(tokenPath, declaration);
    }
    if (pendingDeclarations.size > DESIGN_TOKEN_PROFILE.limits.maxTokenCount) {
      return failure(
        issue(
          "LIMIT_EXCEEDED",
          `The selected source overlay exceeds ${DESIGN_TOKEN_PROFILE.limits.maxTokenCount} token paths.`,
          "/sources",
        ),
      );
    }
  }

  const typeState: OverlayTypeState = { active: [], cache: new Map(), steps: 0 };
  const declarations = new Map<string, OverlayDeclaration>();
  const pendingTokenPaths = [...pendingDeclarations.keys()].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  for (const tokenPath of pendingTokenPaths) {
    const pending = pendingDeclarations.get(tokenPath);
    if (pending === undefined) continue;
    const type = inferOverlayPathType(tokenPath, pendingDeclarations, typeState);
    if (typeof type !== "string") return failureWithSourceSnapshot(type, sourceSnapshots);
    declarations.set(
      tokenPath,
      deepFreeze({
        metadata: pending.metadata,
        origin: pending.origin,
        path: tokenPath,
        type,
        value: pending.value,
      }),
    );
  }
  for (const transition of sourceTypeTransitions) {
    const priorType = inferDetachedDeclarationType(
      transition.prior,
      pendingDeclarations,
      typeState,
    );
    if (typeof priorType !== "string") {
      return failureWithSourceSnapshot(priorType, sourceSnapshots);
    }
    const finalDeclaration = pendingDeclarations.get(transition.next.path);
    const nextType =
      finalDeclaration === transition.next
        ? inferOverlayPathType(transition.next.path, pendingDeclarations, typeState)
        : inferDetachedDeclarationType(transition.next, pendingDeclarations, typeState);
    if (typeof nextType !== "string") {
      return failureWithSourceSnapshot(nextType, sourceSnapshots);
    }
    if (priorType !== nextType) {
      const diagnostic = issue(
        "SOURCE_TYPE_MISMATCH",
        `Source ${JSON.stringify(transition.next.origin.sourceId)} changes ${JSON.stringify(transition.next.path)} from ${priorType} to ${nextType}.`,
        pointer("sources", transition.next.origin.sourceIndex, "document"),
        "INVALID_DTCG",
        transition.next.origin.sourceId,
        transition.next.path,
      );
      return failureWithSourceSnapshot(diagnostic, sourceSnapshots);
    }
  }

  if (request.literalOverrides !== undefined) {
    const overrides = inspectDenseArray(
      request.literalOverrides,
      DESIGN_TOKEN_PROFILE.limits.maxTokenCount,
    );
    if (overrides === undefined) {
      return failure(
        issue(
          "INVALID_LITERAL_OVERRIDE",
          "literalOverrides must be a bounded dense array.",
          "/literalOverrides",
        ),
      );
    }
    const overridden = new Set<string>();
    for (const [overrideIndex, candidate] of overrides.entries()) {
      const override = inspectPlainDataObject(candidate, ["path", "type", "value"], []);
      const overridePointer = pointer("literalOverrides", overrideIndex);
      if (
        override === undefined ||
        !isDtcgTokenPath(override.path) ||
        typeof override.type !== "string" ||
        !DESIGN_TOKEN_PROFILE.tokenTypes.includes(override.type as DtcgTokenType)
      ) {
        return failure(
          issue(
            "INVALID_LITERAL_OVERRIDE",
            "Every literal override requires an existing token path, supported type, and literal value.",
            overridePointer,
          ),
        );
      }
      if (overridden.has(override.path)) {
        return failure(
          issue(
            "DUPLICATE_LITERAL_OVERRIDE",
            `Duplicate literal override for ${JSON.stringify(override.path)}.`,
            pointer("literalOverrides", overrideIndex, "path"),
            "INVALID_DTCG",
            undefined,
            override.path,
          ),
        );
      }
      overridden.add(override.path);
      const prior = declarations.get(override.path);
      if (prior === undefined || prior.type !== override.type) {
        return failure(
          issue(
            "INVALID_LITERAL_OVERRIDE",
            prior === undefined
              ? `Literal override target ${JSON.stringify(override.path)} does not exist.`
              : `Literal override cannot change ${JSON.stringify(override.path)} from ${prior.type} to ${override.type}.`,
            overridePointer,
            "INVALID_DTCG",
            undefined,
            override.path,
          ),
        );
      }
      const validated = validateDtcgLiteralOverride(
        prior.type,
        override.value,
        pointer("literalOverrides", overrideIndex, "value"),
        override.path,
      );
      if (!validated.ok) return failure(validated.diagnostics[0]);
      declarations.set(
        override.path,
        deepFreeze({
          metadata: prior.metadata,
          origin: deepFreeze({ kind: "literal-override" as const, overrideIndex }),
          path: override.path,
          type: prior.type,
          value: validated.value,
        }),
      );
    }
  }

  const tokenPaths = Object.freeze(
    [...declarations.keys()].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
  );
  const state: ResolveState = { active: [], cache: new Map(), steps: typeState.steps };
  const tokens = Object.create(null) as Record<string, ResolvedDesignToken>;
  for (const path of tokenPaths) {
    const resolved = resolveOne(path, declarations, state);
    if (!("value" in resolved)) return failureWithSourceSnapshot(resolved, sourceSnapshots);
    tokens[path] = resolved;
  }
  return deepFreeze({
    ok: true as const,
    sourceIds: Object.freeze(sourceIds),
    tokenPaths,
    tokens,
  });
}
