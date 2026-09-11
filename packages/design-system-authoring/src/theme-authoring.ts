import {
  DESIGN_TOKEN_PROFILE,
  getDesignTokenValueFamily,
  getDtcgAliasTarget,
  isDtcgTokenAlias,
  resolveDesignTokens,
} from "@desen/design-system-core";
import { canonicalizeJson, canonicalizeJsonBytes } from "@desen/protocol";

import {
  AUTHORING_JSON_LIMITS,
  InertJsonError,
  asJsonObject,
  captureInertJson,
  parseInertJsonText,
} from "./inert-json.js";
import { projectReviewedDtcgCompatibility } from "./reviewed-dtcg-compatibility.js";

import type {
  DesignSystemJsonObject,
  DesignSystemJsonValue,
  DesignTokenValueFamily,
  DtcgDiagnostic,
  DtcgLiteralValueByType,
  DtcgNodeMetadata,
  DtcgTokenDocument,
  DtcgTokenLiteral,
  DtcgTokenType,
  DtcgTokenValue,
  ResolvedDesignToken,
} from "@desen/design-system-core";
import type { ThemeAuthoringCompatibilityFeatureId } from "./reviewed-dtcg-compatibility.js";

/** Exact discriminator for an App-owned theme-authoring document. */
export const THEME_AUTHORING_KIND = "desen.theme-authoring" as const;

/** Current and only admitted theme-authoring schema version. */
export const THEME_AUTHORING_SCHEMA_VERSION = 1 as const;

/** Finite theme, mode, label, import, and in-memory undo limits. */
export const THEME_AUTHORING_LIMITS = Object.freeze({
  maxHistoryEntries: 100,
  maxIdentifierCodeUnits: 128,
  maxImportBytes: AUTHORING_JSON_LIMITS.maxCanonicalBytes,
  maxLabelCodeUnits: 512,
  maxModesPerTheme: DESIGN_TOKEN_PROFILE.limits.maxModesAsSources,
  maxThemes: 16,
  maxUnsupportedFeaturesPerOverlay: 64,
});

const SESSION_KIND = "desen.theme-authoring-session" as const;
const IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const TOKEN_TYPES = new Set<string>(DESIGN_TOKEN_PROFILE.tokenTypes);
const SESSION_PROVENANCE = new WeakSet<object>();

/** One editable DTCG source used as a theme base or mode overlay. */
export interface ThemeAuthoringTokenSource {
  /** Stable document-local identity used in resolution provenance. */
  readonly id: string;
  /** Complete inert DTCG document, including safely preserved closed-matrix standard data. */
  readonly document: DtcgTokenDocument;
  /** Optional author-facing description. */
  readonly description?: string;
  /** Namespaced inert metadata preserved without interpretation. */
  readonly extensions?: DesignSystemJsonObject;
}

/** One named mode whose source overlays its owning theme base. */
export interface ThemeAuthoringMode {
  /** Stable theme-local mode identity. */
  readonly id: string;
  /** Human-facing mode name. */
  readonly name: string;
  /** Ordered overlay source selected after the theme base. */
  readonly source: ThemeAuthoringTokenSource;
  /** Namespaced inert metadata preserved without interpretation. */
  readonly extensions?: DesignSystemJsonObject;
}

/** One editable theme with a shared base and explicit mode overlays. */
export interface ThemeAuthoringTheme {
  /** Stable document-local theme identity. */
  readonly id: string;
  /** Human-facing theme name. */
  readonly name: string;
  /** Shared source resolved before the selected mode source. */
  readonly base: ThemeAuthoringTokenSource;
  /** Non-empty ordered mode inventory. */
  readonly modes: readonly ThemeAuthoringMode[];
  /** Namespaced inert metadata preserved without interpretation. */
  readonly extensions?: DesignSystemJsonObject;
}

/** Version 1 of the editable theme/token authoring document. */
export interface ThemeAuthoringDocumentV1 {
  /** App-owned format discriminator; this is not a DESEN protocol document. */
  readonly kind: typeof THEME_AUTHORING_KIND;
  /** Exact admitted authoring schema version. */
  readonly schemaVersion: typeof THEME_AUTHORING_SCHEMA_VERSION;
  /** Non-empty ordered theme inventory. */
  readonly themes: readonly ThemeAuthoringTheme[];
  /** Namespaced inert document metadata preserved without interpretation. */
  readonly extensions?: DesignSystemJsonObject;
}

/** Every theme-authoring schema currently admitted by this package. */
export type ThemeAuthoringDocument = ThemeAuthoringDocumentV1;

/** Stable diagnostic codes produced by the authoring boundary. */
export type ThemeAuthoringDiagnosticCode =
  | "DTCG_REJECTED"
  | "HISTORY_EMPTY"
  | "IMPORT_JSON_INVALID"
  | "INVALID_EDIT"
  | "INVALID_SELECTION"
  | "INVALID_THEME_DOCUMENT"
  | "REVISION_LIMIT_EXCEEDED"
  | "THEME_LIMIT_EXCEEDED"
  | "TOKEN_EDIT_REJECTED"
  | "UNSAFE_THEME_VALUE"
  | "UNSUPPORTED_FEATURE_LIMIT_EXCEEDED"
  | "UNSUPPORTED_THEME_VERSION";

/** One immutable, location-bearing authoring diagnostic. */
export interface ThemeAuthoringDiagnostic {
  /** Stable code suitable for machine branching. */
  readonly code: ThemeAuthoringDiagnosticCode;
  /** Bounded human-readable explanation. */
  readonly message: string;
  /** JSON Pointer-like location of the rejected value. */
  readonly pointer: string;
  /** Exact DTCG cause when token admission or resolution rejected the value. */
  readonly cause?: DtcgDiagnostic;
  /** Owning theme when the diagnostic is context-specific. */
  readonly themeId?: string;
  /** Owning mode when the diagnostic is context-specific. */
  readonly modeId?: string;
}

/** One validated closed-matrix standard feature retained in the editable document. */
export interface ThemeAuthoringUnsupportedFeature {
  /** Exact DTCG diagnostic that prevents a resolved preview. */
  readonly diagnostic: DtcgDiagnostic;
  /** Frozen SC-01 compatibility family that explains why the data remains inert. */
  readonly featureId: ThemeAuthoringCompatibilityFeatureId;
  /** Mode in whose selected overlay the feature was observed. */
  readonly modeId: string;
  /** Confirms the safely captured source remains in the admitted document. */
  readonly preserved: true;
  /** Source that contains the unsupported data. */
  readonly sourceId: string;
  /** Owning theme. */
  readonly themeId: string;
}

/** One declared transfer loss; the current preserve-or-reject profile emits none. */
export interface ThemeAuthoringTransferLoss {
  /** Human-readable reason that data could not be retained. */
  readonly reason: string;
  /** JSON Pointer-like location of the lost value. */
  readonly pointer: string;
}

/** Deterministic import/export disclosure for a complete authoring document. */
export interface ThemeAuthoringTransferReport {
  /** RFC 8785 canonical JSON byte length of the complete retained document. */
  readonly canonicalBytes: number;
  /** Current preserve-or-reject boundary never silently drops data. */
  readonly losses: readonly ThemeAuthoringTransferLoss[];
  /** Validated closed-matrix features outside the T02 profile, retained exactly. */
  readonly preservedUnsupportedFeatures: readonly ThemeAuthoringUnsupportedFeature[];
}

/** Successful complete theme-document admission. */
export interface ThemeAuthoringAdmissionSuccess {
  readonly document: ThemeAuthoringDocument;
  readonly diagnostics: readonly [];
  readonly ok: true;
  readonly report: ThemeAuthoringTransferReport;
}

/** Rejected theme document with no partially admitted replacement. */
export interface ThemeAuthoringAdmissionFailure {
  readonly diagnostics: readonly [ThemeAuthoringDiagnostic];
  readonly ok: false;
}

/** Result of admitting unknown input as a complete theme-authoring document. */
export type ThemeAuthoringAdmissionResult =
  ThemeAuthoringAdmissionFailure | ThemeAuthoringAdmissionSuccess;

/** Currently selected theme and mode in one local authoring session. */
export interface ThemeAuthoringSelection {
  readonly themeId: string;
  readonly modeId: string;
}

/** One schema-driven ordinary control for a resolved editable token. */
export interface ThemeAuthoringControl {
  readonly aliasTarget?: string;
  readonly family: DesignTokenValueFamily;
  readonly kind: "alias" | "literal";
  readonly metadata: DtcgNodeMetadata;
  readonly path: string;
  readonly resolvedValue: DtcgTokenLiteral;
  readonly sourceId: string;
  readonly type: DtcgTokenType;
  readonly value: DtcgTokenValue;
}

/** Successful live preview for one selected theme/mode pair. */
export interface ThemeAuthoringPreviewSuccess {
  readonly controls: readonly ThemeAuthoringControl[];
  readonly modeId: string;
  readonly ok: true;
  readonly sourceIds: readonly string[];
  readonly themeId: string;
  readonly tokenPaths: readonly string[];
  readonly tokens: Readonly<Record<string, ResolvedDesignToken>>;
}

/** Explicit preview failure with no partial token or control map. */
export interface ThemeAuthoringPreviewFailure {
  readonly diagnostics: readonly [DtcgDiagnostic];
  readonly modeId: string;
  readonly ok: false;
  readonly themeId: string;
}

/** Complete live-preview state for a selected theme and mode. */
export type ThemeAuthoringPreview = ThemeAuthoringPreviewFailure | ThemeAuthoringPreviewSuccess;

/** Immutable in-memory authoring session with bounded document history. */
export interface ThemeAuthoringHistoryEntry {
  readonly document: ThemeAuthoringDocument;
  /** Restores this exact selection when the document transition itself changed selection. */
  readonly restoreSelection: boolean;
  readonly selection: ThemeAuthoringSelection;
}

/** Immutable in-memory authoring session with bounded document and selection history. */
export interface ThemeAuthoringSession {
  readonly document: ThemeAuthoringDocument;
  readonly future: readonly ThemeAuthoringHistoryEntry[];
  readonly kind: typeof SESSION_KIND;
  readonly past: readonly ThemeAuthoringHistoryEntry[];
  readonly preview: ThemeAuthoringPreview;
  readonly revision: number;
  readonly selection: ThemeAuthoringSelection;
}

/** A type-correlated literal edit for any capability-supported DTCG value. */
export type ThemeAuthoringLiteralEdit = {
  readonly [Type in DtcgTokenType]: {
    readonly kind: "set-literal";
    readonly path: string;
    readonly sourceId: string;
    readonly themeId: string;
    readonly type: Type;
    readonly value: DtcgLiteralValueByType[Type];
  };
}[DtcgTokenType];

/** A whole-token alias edit; property aliases remain outside the T02 profile. */
export interface ThemeAuthoringAliasEdit {
  readonly kind: "set-alias";
  readonly path: string;
  readonly sourceId: string;
  readonly targetPath: string;
  readonly themeId: string;
  readonly type: DtcgTokenType;
}

/** A type-correlated operation that creates a new literal token declaration. */
export type ThemeAuthoringCreateLiteralEdit = {
  readonly [Type in DtcgTokenType]: {
    readonly kind: "create-literal";
    readonly path: string;
    readonly sourceId: string;
    readonly themeId: string;
    readonly type: Type;
    readonly value: DtcgLiteralValueByType[Type];
  };
}[DtcgTokenType];

/** Create a new whole-token alias declaration. */
export interface ThemeAuthoringCreateAliasEdit {
  readonly kind: "create-alias";
  readonly path: string;
  readonly sourceId: string;
  readonly targetPath: string;
  readonly themeId: string;
  readonly type: DtcgTokenType;
}

/** Duplicate an admitted theme and give every copied source a fresh deterministic identity. */
export interface ThemeAuthoringDuplicateThemeEdit {
  readonly fromThemeId: string;
  readonly kind: "duplicate-theme";
  readonly name: string;
  readonly themeId: string;
}

/** Rename one theme without changing its stable identity. */
export interface ThemeAuthoringRenameThemeEdit {
  readonly kind: "rename-theme";
  readonly name: string;
  readonly themeId: string;
}

/** Delete one theme; admission rejects deletion of the final theme. */
export interface ThemeAuthoringDeleteThemeEdit {
  readonly kind: "delete-theme";
  readonly themeId: string;
}

/** Duplicate an admitted mode and give its copied source a fresh deterministic identity. */
export interface ThemeAuthoringDuplicateModeEdit {
  readonly fromModeId: string;
  readonly kind: "duplicate-mode";
  readonly modeId: string;
  readonly name: string;
  readonly themeId: string;
}

/** Rename one mode without changing its stable identity. */
export interface ThemeAuthoringRenameModeEdit {
  readonly kind: "rename-mode";
  readonly modeId: string;
  readonly name: string;
  readonly themeId: string;
}

/** Delete one mode; admission rejects deletion of the final mode. */
export interface ThemeAuthoringDeleteModeEdit {
  readonly kind: "delete-mode";
  readonly modeId: string;
  readonly themeId: string;
}

/** Delete an existing token or whole-token alias declaration. */
export interface ThemeAuthoringDeleteTokenEdit {
  readonly kind: "delete-token";
  readonly path: string;
  readonly sourceId: string;
  readonly themeId: string;
}

/** Finite theme, mode, token, literal, and alias operations supported by the workbench. */
export type ThemeAuthoringEdit =
  | ThemeAuthoringAliasEdit
  | ThemeAuthoringCreateAliasEdit
  | ThemeAuthoringCreateLiteralEdit
  | ThemeAuthoringDeleteModeEdit
  | ThemeAuthoringDeleteThemeEdit
  | ThemeAuthoringDeleteTokenEdit
  | ThemeAuthoringDuplicateModeEdit
  | ThemeAuthoringDuplicateThemeEdit
  | ThemeAuthoringLiteralEdit
  | ThemeAuthoringRenameModeEdit
  | ThemeAuthoringRenameThemeEdit;

/** Successful creation of a local authoring session. */
export interface ThemeAuthoringSessionSuccess {
  readonly ok: true;
  readonly session: ThemeAuthoringSession;
}

/** Rejected session creation. */
export interface ThemeAuthoringSessionFailure {
  readonly diagnostics: readonly [ThemeAuthoringDiagnostic];
  readonly ok: false;
}

/** Complete result of creating a local authoring session. */
export type ThemeAuthoringSessionResult =
  ThemeAuthoringSessionFailure | ThemeAuthoringSessionSuccess;

/** Successful atomic state transition. */
export interface ThemeAuthoringTransitionSuccess {
  readonly changed: boolean;
  readonly ok: true;
  readonly session: ThemeAuthoringSession;
}

/** Rejected transition retaining the exact prior session object. */
export interface ThemeAuthoringTransitionFailure {
  readonly diagnostics: readonly [ThemeAuthoringDiagnostic];
  readonly ok: false;
  readonly session: ThemeAuthoringSession;
}

/** Complete result of an authoring edit, selection, history action, or import. */
export type ThemeAuthoringTransitionResult =
  ThemeAuthoringTransitionFailure | ThemeAuthoringTransitionSuccess;

/** Deterministic, loss-disclosing export of the complete authoring document. */
export interface ThemeAuthoringExport {
  readonly report: ThemeAuthoringTransferReport;
  readonly text: string;
}

function deepFreeze<Value>(value: Value): Value {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactKeys(
  value: DesignSystemJsonObject,
  required: readonly string[],
  optional: readonly string[],
): boolean {
  const accepted = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => accepted.has(key));
}

function diagnostic(
  code: ThemeAuthoringDiagnosticCode,
  message: string,
  pointer: string,
  context?: {
    readonly cause?: DtcgDiagnostic;
    readonly modeId?: string;
    readonly themeId?: string;
  },
): ThemeAuthoringDiagnostic {
  const output: {
    code: ThemeAuthoringDiagnosticCode;
    message: string;
    pointer: string;
    cause?: DtcgDiagnostic;
    modeId?: string;
    themeId?: string;
  } = { code, message, pointer };
  if (context?.cause !== undefined) output.cause = context.cause;
  if (context?.modeId !== undefined) output.modeId = context.modeId;
  if (context?.themeId !== undefined) output.themeId = context.themeId;
  return deepFreeze(output);
}

function admissionFailure(issue: ThemeAuthoringDiagnostic): ThemeAuthoringAdmissionFailure {
  return deepFreeze({ diagnostics: [issue] as const, ok: false as const });
}

function validIdentifier(value: DesignSystemJsonValue | undefined): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function validLabel(value: DesignSystemJsonValue | undefined): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= THEME_AUTHORING_LIMITS.maxLabelCodeUnits
  );
}

function validTokenPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length > DESIGN_TOKEN_PROFILE.limits.maxTokenPathLength) {
    return false;
  }
  const segments = value.split(".");
  return (
    segments.length <= DESIGN_TOKEN_PROFILE.limits.maxTokenPathSegments &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        !segment.startsWith("$") &&
        !/[.{}]/u.test(segment) &&
        ![...segment].some((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return codePoint <= 31 || codePoint === 127;
        }),
    )
  );
}

function optionalExtensions(
  value: DesignSystemJsonValue | undefined,
): value is DesignSystemJsonObject | undefined {
  return value === undefined || asJsonObject(value) !== undefined;
}

function parseSource(
  value: DesignSystemJsonValue | undefined,
  pointer: string,
): ThemeAuthoringTokenSource | ThemeAuthoringDiagnostic {
  const object = value === undefined ? undefined : asJsonObject(value);
  if (
    object === undefined ||
    !exactKeys(object, ["document", "id"], ["description", "extensions"]) ||
    !validIdentifier(object.id) ||
    asJsonObject(object.document as DesignSystemJsonValue) === undefined ||
    (object.description !== undefined && !validLabel(object.description)) ||
    !optionalExtensions(object.extensions)
  ) {
    return diagnostic(
      "INVALID_THEME_DOCUMENT",
      "Token sources require an id and a complete inert DTCG document.",
      pointer,
    );
  }
  const output: {
    id: string;
    document: DtcgTokenDocument;
    description?: string;
    extensions?: DesignSystemJsonObject;
  } = { id: object.id, document: object.document as DtcgTokenDocument };
  if (typeof object.description === "string") output.description = object.description;
  if (object.extensions !== undefined)
    output.extensions = object.extensions as DesignSystemJsonObject;
  return deepFreeze(output);
}

function parseMode(
  value: DesignSystemJsonValue,
  pointer: string,
): ThemeAuthoringMode | ThemeAuthoringDiagnostic {
  const object = asJsonObject(value);
  if (
    object === undefined ||
    !exactKeys(object, ["id", "name", "source"], ["extensions"]) ||
    !validIdentifier(object.id) ||
    !validLabel(object.name) ||
    !optionalExtensions(object.extensions)
  ) {
    return diagnostic(
      "INVALID_THEME_DOCUMENT",
      "Theme modes require a stable id, name, and token source.",
      pointer,
    );
  }
  const source = parseSource(object.source, `${pointer}/source`);
  if ("code" in source) return source;
  const output: {
    id: string;
    name: string;
    source: ThemeAuthoringTokenSource;
    extensions?: DesignSystemJsonObject;
  } = {
    id: object.id,
    name: object.name,
    source,
  };
  if (object.extensions !== undefined)
    output.extensions = object.extensions as DesignSystemJsonObject;
  return deepFreeze(output);
}

function parseTheme(
  value: DesignSystemJsonValue,
  pointer: string,
): ThemeAuthoringTheme | ThemeAuthoringDiagnostic {
  const object = asJsonObject(value);
  if (
    object === undefined ||
    !exactKeys(object, ["base", "id", "modes", "name"], ["extensions"]) ||
    !validIdentifier(object.id) ||
    !validLabel(object.name) ||
    !Array.isArray(object.modes) ||
    object.modes.length === 0 ||
    object.modes.length > THEME_AUTHORING_LIMITS.maxModesPerTheme ||
    !optionalExtensions(object.extensions)
  ) {
    return diagnostic(
      "INVALID_THEME_DOCUMENT",
      "Themes require a stable id, name, base, and 1–16 modes.",
      pointer,
    );
  }
  const base = parseSource(object.base, `${pointer}/base`);
  if ("code" in base) return base;
  const modes: ThemeAuthoringMode[] = [];
  const modeIds = new Set<string>();
  for (const [index, rawMode] of object.modes.entries()) {
    const mode = parseMode(rawMode, `${pointer}/modes/${index}`);
    if ("code" in mode) return mode;
    if (modeIds.has(mode.id)) {
      return diagnostic(
        "INVALID_THEME_DOCUMENT",
        `Duplicate mode id ${JSON.stringify(mode.id)}.`,
        `${pointer}/modes/${index}/id`,
      );
    }
    modeIds.add(mode.id);
    modes.push(mode);
  }
  const output: {
    base: ThemeAuthoringTokenSource;
    id: string;
    modes: ThemeAuthoringMode[];
    name: string;
    extensions?: DesignSystemJsonObject;
  } = {
    base,
    id: object.id,
    modes,
    name: object.name,
  };
  if (object.extensions !== undefined)
    output.extensions = object.extensions as DesignSystemJsonObject;
  return deepFreeze(output);
}

function selectedSources(theme: ThemeAuthoringTheme, mode: ThemeAuthoringMode) {
  return [
    {
      id: theme.base.id,
      document: theme.base.document,
      ...(theme.base.description === undefined ? {} : { description: theme.base.description }),
      ...(theme.base.extensions === undefined ? {} : { extensions: theme.base.extensions }),
    },
    {
      id: mode.source.id,
      document: mode.source.document,
      ...(mode.source.description === undefined ? {} : { description: mode.source.description }),
      ...(mode.source.extensions === undefined ? {} : { extensions: mode.source.extensions }),
    },
  ] as const;
}

function unsupportedFeature(
  theme: ThemeAuthoringTheme,
  mode: ThemeAuthoringMode,
  cause: DtcgDiagnostic,
  sourceId: string,
  featureId: ThemeAuthoringCompatibilityFeatureId,
): ThemeAuthoringUnsupportedFeature {
  return deepFreeze({
    diagnostic: cause,
    featureId,
    modeId: mode.id,
    preserved: true as const,
    sourceId,
    themeId: theme.id,
  });
}

function featureKey(feature: ThemeAuthoringUnsupportedFeature): string {
  return [
    feature.themeId,
    feature.modeId,
    feature.sourceId,
    feature.featureId,
    feature.diagnostic.code,
    feature.diagnostic.pointer,
  ].join("\u0000");
}

function compatibilityFeatureId(cause: DtcgDiagnostic): ThemeAuthoringCompatibilityFeatureId {
  if (cause.code === "UNSUPPORTED_COLOR_SPACE") return "ADDITIONAL_COLOR_SPACES";
  if (cause.code === "UNSUPPORTED_DTCG_TYPE" || cause.code === "UNSUPPORTED_STROKE_STYLE") {
    return "ADDITIONAL_TOKEN_TYPES";
  }
  if (cause.code === "UNSUPPORTED_PROPERTY_ALIAS") return "PROPERTY_LEVEL_REF";
  const segments = pointerSegments(cause.pointer);
  if (segments?.at(-1) === "$root") return "ROOT_GROUP_TOKEN";
  if (segments?.at(-2) === "components") return "NONE_COLOR_COMPONENTS";
  return "EXTENSIONS";
}

type MutableJsonContainer = Record<string, unknown> | unknown[];

function pointerSegments(pointer: string): readonly string[] | undefined {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) return undefined;
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function childContainer(
  container: MutableJsonContainer,
  segment: string,
): MutableJsonContainer | undefined {
  const value = Array.isArray(container)
    ? Number.isSafeInteger(Number(segment))
      ? container[Number(segment)]
      : undefined
    : container[segment];
  return value !== null && typeof value === "object" ? (value as MutableJsonContainer) : undefined;
}

function setPointerValue(root: Record<string, unknown>, pointer: string, value: unknown): boolean {
  const segments = pointerSegments(pointer);
  if (segments === undefined || segments.length === 0) return false;
  let container: MutableJsonContainer = root;
  for (const segment of segments.slice(0, -1)) {
    const child = childContainer(container, segment);
    if (child === undefined) return false;
    container = child;
  }
  const key = segments.at(-1);
  if (key === undefined) return false;
  if (Array.isArray(container)) {
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= container.length) return false;
    container[index] = value;
  } else if (Object.hasOwn(container, key)) container[key] = value;
  else return false;
  return true;
}

function effectiveTypeAtPath(
  document: Record<string, unknown>,
  path: string,
): DtcgTokenType | undefined {
  let node: Record<string, unknown> | undefined = document;
  let effective: DtcgTokenType | undefined;
  for (const segment of path.split(".")) {
    if (typeof node.$type === "string" && TOKEN_TYPES.has(node.$type)) {
      effective = node.$type as DtcgTokenType;
    }
    node = mutableObject(node[segment]);
    if (node === undefined) return effective;
  }
  if (typeof node.$type === "string" && TOKEN_TYPES.has(node.$type)) {
    effective = node.$type as DtcgTokenType;
  }
  return effective;
}

function objectAtPointer(
  root: Record<string, unknown>,
  pointer: string,
): Record<string, unknown> | undefined {
  const segments = pointerSegments(pointer);
  if (segments === undefined) return undefined;
  let current: MutableJsonContainer = root;
  for (const segment of segments) {
    const child = childContainer(current, segment);
    if (child === undefined) return undefined;
    current = child;
  }
  return Array.isArray(current) ? undefined : current;
}

interface DiagnosticProjectionOrigin {
  readonly originalPointer: string;
  readonly originalTokenPath?: string;
  readonly probePointer: string;
  readonly probeTokenPath: string;
}

type ProjectionOrigins = Map<object, DiagnosticProjectionOrigin[]>;
type ProjectionPaths = Map<string, string>;

function pointerFromSegments(segments: readonly string[]): string {
  return segments.length === 0
    ? ""
    : `/${segments
        .map((segment) => segment.replaceAll("~", "~0").replaceAll("/", "~1"))
        .join("/")}`;
}

function uniqueProjectionChild(
  parentSegments: readonly string[],
  workingSources: readonly { readonly document: unknown }[],
): string {
  const parentPointer = pointerFromSegments(parentSegments);
  const unavailablePaths = new Set<string>();
  function collectAliasTargets(value: unknown): void {
    if (isDtcgTokenAlias(value)) {
      unavailablePaths.add(getDtcgAliasTarget(value));
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const child of Object.values(value)) collectAliasTargets(child);
  }
  for (const source of workingSources) {
    collectAliasTargets(source.document);
    const candidateDocument = mutableObject(source.document);
    const parent =
      candidateDocument === undefined
        ? undefined
        : objectAtPointer(candidateDocument, parentPointer);
    if (parent === undefined) continue;
    for (const key of Object.keys(parent)) {
      unavailablePaths.add([...parentSegments, key].join("."));
    }
  }
  for (let attempt = 0; attempt <= unavailablePaths.size; attempt += 1) {
    const probe = attempt === 0 ? "authoring-proof" : `authoring-proof-${attempt + 1}`;
    if (!unavailablePaths.has([...parentSegments, probe].join("."))) return probe;
  }
  throw new TypeError("A bounded validation projection path could not be allocated.");
}

function stableProjectionPath(
  logicalSegments: readonly string[],
  workingSources: readonly { readonly document: unknown }[],
  projectionPaths: ProjectionPaths,
): string {
  const logicalPath = pointerFromSegments(logicalSegments);
  const existing = projectionPaths.get(logicalPath);
  if (existing !== undefined) return existing;
  const probe = uniqueProjectionChild([], workingSources);
  projectionPaths.set(logicalPath, probe);
  return probe;
}

function rewriteWholeAliasTargets(
  workingSources: readonly { readonly document: unknown }[],
  fromPath: string,
  toPath: string,
): void {
  function visit(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    const object = value as Record<string, unknown>;
    if (isDtcgTokenAlias(object.$value) && getDtcgAliasTarget(object.$value) === fromPath) {
      object.$value = `{${toPath}}`;
    }
    for (const child of Object.values(object)) visit(child);
  }
  for (const source of workingSources) visit(source.document);
}

function recordProjectionOrigin(
  source: object,
  origin: DiagnosticProjectionOrigin,
  projectionOrigins: ProjectionOrigins,
): void {
  projectionOrigins.set(source, [...(projectionOrigins.get(source) ?? []), origin]);
}

function neutralizeRootMember(
  source: { document: unknown },
  document: Record<string, unknown>,
  issue: DtcgDiagnostic,
  workingSources: { document: unknown }[],
  projectionPaths: ProjectionPaths,
  projectionOrigins: ProjectionOrigins,
): boolean {
  const segments = pointerSegments(issue.pointer);
  if (segments?.at(-1) !== "$root") return false;
  const parentSegments = segments.slice(0, -1);
  const parent = objectAtPointer(document, pointerFromSegments(parentSegments));
  const root = parent === undefined ? undefined : mutableObject(parent.$root);
  if (
    parent === undefined ||
    root === undefined ||
    !Object.hasOwn(root, "$value") ||
    Object.hasOwn(parent, "$value")
  )
    return false;
  if (
    !Object.hasOwn(root, "$type") &&
    Object.hasOwn(root, "$value") &&
    !isDtcgTokenAlias(root.$value)
  ) {
    const inheritedType =
      parentSegments.length === 0
        ? typeof document.$type === "string" && TOKEN_TYPES.has(document.$type)
          ? (document.$type as DtcgTokenType)
          : undefined
        : effectiveTypeAtPath(document, parentSegments.join("."));
    if (inheritedType !== undefined) root.$type = inheritedType;
  }
  delete parent.$root;
  const logicalSegments = [...parentSegments, "$root"];
  const logicalTokenPath = logicalSegments.join(".");
  const probe = stableProjectionPath(logicalSegments, workingSources, projectionPaths);
  document[probe] = root;
  recordProjectionOrigin(
    source,
    {
      originalPointer: issue.pointer,
      originalTokenPath: logicalTokenPath,
      probePointer: `/${probe}`,
      probeTokenPath: probe,
    },
    projectionOrigins,
  );
  if (parentSegments.length > 0) {
    rewriteWholeAliasTargets(workingSources, logicalTokenPath, probe);
    pruneEmptyProjectedGroups(source, document, issue.pointer, workingSources);
  } else {
    rewriteWholeAliasTargets(workingSources, logicalTokenPath, probe);
  }
  return true;
}

function pruneEmptyProjectedGroups(
  source: { document: unknown },
  document: Record<string, unknown>,
  memberPointer: string,
  workingSources: { document: unknown }[],
): void {
  const segments = pointerSegments(memberPointer);
  if (segments === undefined) return;
  let groupSegments = segments.slice(0, -1);
  const metadataKeys = new Set(["$deprecated", "$description", "$extensions", "$type"]);
  while (true) {
    const group = objectAtPointer(document, pointerFromSegments(groupSegments));
    if (
      group === undefined ||
      Object.hasOwn(group, "$value") ||
      Object.keys(group).some((key) => !metadataKeys.has(key))
    ) {
      return;
    }
    if (groupSegments.length === 0) {
      const index = workingSources.indexOf(source);
      if (index >= 0) workingSources.splice(index, 1);
      return;
    }
    const parentSegments = groupSegments.slice(0, -1);
    const parent = objectAtPointer(document, pointerFromSegments(parentSegments));
    const key = groupSegments.at(-1);
    if (parent === undefined || key === undefined || !Reflect.deleteProperty(parent, key)) return;
    groupSegments = parentSegments;
  }
}

type StandardColorComponentRange = readonly [
  minimum: number,
  maximum: number,
  maximumExclusive?: true,
];

const UNIT_COLOR_COMPONENTS = [
  [0, 1],
  [0, 1],
  [0, 1],
] as const satisfies readonly StandardColorComponentRange[];
const DTCG_COLOR_COMPONENT_RANGES: Readonly<
  Record<string, readonly StandardColorComponentRange[]>
> = Object.freeze({
  "a98-rgb": UNIT_COLOR_COMPONENTS,
  "display-p3": UNIT_COLOR_COMPONENTS,
  hsl: [
    [0, 360, true],
    [0, 100],
    [0, 100],
  ],
  hwb: [
    [0, 360, true],
    [0, 100],
    [0, 100],
  ],
  lab: [
    [0, 100],
    [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
  ],
  lch: [
    [0, 100],
    [0, Number.POSITIVE_INFINITY],
    [0, 360, true],
  ],
  oklab: [
    [0, 1],
    [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
  ],
  oklch: [
    [0, 1],
    [0, Number.POSITIVE_INFINITY],
    [0, 360, true],
  ],
  "prophoto-rgb": UNIT_COLOR_COMPONENTS,
  rec2020: UNIT_COLOR_COMPONENTS,
  "srgb-linear": UNIT_COLOR_COMPONENTS,
  "xyz-d50": UNIT_COLOR_COMPONENTS,
  "xyz-d65": UNIT_COLOR_COMPONENTS,
});

function validStandardColorComponents(
  colorSpace: string,
  components: unknown,
): components is readonly ("none" | number)[] {
  const ranges = DTCG_COLOR_COMPONENT_RANGES[colorSpace];
  if (!Array.isArray(components) || components.length !== 3 || ranges === undefined) return false;
  return components.every((component, index) => {
    if (component === "none") return true;
    const range = ranges[index];
    if (typeof component !== "number" || !Number.isFinite(component) || range === undefined) {
      return false;
    }
    const [minimum, maximum, maximumExclusive] = range;
    return (
      component >= minimum &&
      (maximumExclusive === true ? component < maximum : component <= maximum)
    );
  });
}

function neutralizeUnsupportedSource(
  source: { document: unknown },
  issue: DtcgDiagnostic,
  workingSources: { document: unknown }[],
  projectionPaths: ProjectionPaths,
  projectionOrigins: ProjectionOrigins,
): boolean {
  const document = mutableObject(source.document);
  if (document === undefined) return false;
  if (issue.code === "UNSUPPORTED_COLOR_SPACE") {
    const segments = pointerSegments(issue.pointer);
    if (segments?.at(-1) !== "colorSpace") return false;
    const valuePointer = `/${segments
      .slice(0, -1)
      .map((segment) => segment.replaceAll("~", "~0").replaceAll("/", "~1"))
      .join("/")}`;
    const color = objectAtPointer(document, valuePointer === "/" ? "" : valuePointer);
    const components = color?.components;
    if (
      color === undefined ||
      typeof color.colorSpace !== "string" ||
      !validStandardColorComponents(color.colorSpace, components)
    ) {
      return false;
    }
    color.colorSpace = "srgb";
    color.components = components.map((component) => (component === "none" ? component : 0));
    return true;
  }
  if (
    issue.code === "UNSUPPORTED_STROKE_STYLE" ||
    issue.code === "UNSUPPORTED_DTCG_TYPE" ||
    issue.code === "UNSUPPORTED_PROPERTY_ALIAS"
  )
    return false;
  if (issue.code === "UNSUPPORTED_DTCG_MEMBER") {
    const segments = pointerSegments(issue.pointer);
    const finalSegment = segments?.at(-1);
    if (finalSegment === "$root") {
      return neutralizeRootMember(
        source,
        document,
        issue,
        workingSources,
        projectionPaths,
        projectionOrigins,
      );
    }
    if (segments?.at(-2) === "components") return setPointerValue(document, issue.pointer, 0);
  }
  return false;
}

function remapProjectionDiagnostic(
  issue: DtcgDiagnostic,
  source: object | undefined,
  projectionOrigins: ProjectionOrigins,
): DtcgDiagnostic {
  if (source === undefined) return issue;
  const origin = projectionOrigins
    .get(source)
    ?.toSorted((left, right) => right.probePointer.length - left.probePointer.length)
    .find(
      (candidate) =>
        issue.pointer === candidate.probePointer ||
        issue.pointer.startsWith(`${candidate.probePointer}/`),
    );
  const replacements = new Map<string, string>();
  for (const origins of projectionOrigins.values()) {
    for (const candidate of origins) {
      replacements.set(candidate.probeTokenPath, candidate.originalTokenPath ?? "root token");
    }
  }
  let message = issue.message;
  for (const prefix of [
    "Alias cycle detected while inferring a token type: ",
    "Alias cycle detected: ",
  ]) {
    if (!message.startsWith(prefix) || !message.endsWith(".")) continue;
    const cycle = message
      .slice(prefix.length, -1)
      .split(" -> ")
      .map((path) => replacements.get(path) ?? path)
      .join(" -> ");
    message = `${prefix}${cycle}.`;
    break;
  }
  for (const [probeTokenPath, originalTokenPath] of replacements) {
    message = message
      .replaceAll(JSON.stringify(`{${probeTokenPath}}`), JSON.stringify(`{${originalTokenPath}}`))
      .replaceAll(JSON.stringify(probeTokenPath), JSON.stringify(originalTokenPath));
  }
  if (origin === undefined) {
    return message === issue.message ? issue : deepFreeze({ ...issue, message });
  }
  const pointer = `${origin.originalPointer}${issue.pointer.slice(origin.probePointer.length)}`;
  const tokenPath =
    issue.tokenPath === origin.probeTokenPath
      ? origin.originalTokenPath
      : issue.tokenPath?.startsWith(`${origin.probeTokenPath}.`)
        ? [origin.originalTokenPath, issue.tokenPath.slice(origin.probeTokenPath.length + 1)]
            .filter((segment) => segment !== undefined && segment.length > 0)
            .join(".") || undefined
        : issue.tokenPath;
  if (pointer === issue.pointer && tokenPath === issue.tokenPath && message === issue.message)
    return issue;
  return deepFreeze({
    classification: issue.classification,
    code: issue.code,
    message,
    pointer,
    ...(issue.sourceId === undefined ? {} : { sourceId: issue.sourceId }),
    ...(tokenPath === undefined ? {} : { tokenPath }),
  });
}

function normalizeRootMemberDiagnostic(issue: DtcgDiagnostic): DtcgDiagnostic {
  const segments = pointerSegments(issue.pointer);
  if (segments?.at(-1) !== "$root") return issue;
  const tokenPath = segments.join(".");
  if (issue.tokenPath === tokenPath) return issue;
  return deepFreeze({ ...issue, tokenPath });
}

interface RawTypeDeclaration {
  readonly path: string;
  readonly pointer: string;
  readonly sourceId: string;
  readonly type?: string;
  readonly value: unknown;
}

function jsonPointerTokenAlias(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("#/")) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value.slice(2));
  } catch {
    return undefined;
  }
  if (/~(?:[^01]|$)/u.test(decoded)) return undefined;
  const segments = decoded
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (segments.pop() !== "$value" || segments.length === 0) return undefined;
  const path = segments.join(".");
  return path.length <= DESIGN_TOKEN_PROFILE.limits.maxTokenPathLength ? `{${path}}` : undefined;
}

function collectRawTypeDeclarations(
  document: unknown,
  sourceId: string,
): ReadonlyMap<string, RawTypeDeclaration> {
  const declarations = new Map<string, RawTypeDeclaration>();
  const root = mutableObject(document);
  if (root === undefined) return declarations;
  function visit(
    node: Record<string, unknown>,
    path: readonly string[],
    inheritedType: string | undefined,
  ): void {
    const ownType = typeof node.$type === "string" ? node.$type : undefined;
    const effectiveType = ownType ?? inheritedType;
    if (Object.hasOwn(node, "$value") || Object.hasOwn(node, "$ref")) {
      const tokenPath = path.join(".");
      const value = Object.hasOwn(node, "$value")
        ? node.$value
        : (jsonPointerTokenAlias(node.$ref) ?? node.$ref);
      const type = isDtcgTokenAlias(value) || Object.hasOwn(node, "$ref") ? ownType : effectiveType;
      declarations.set(tokenPath, {
        path: tokenPath,
        pointer: pointerFromSegments(path),
        sourceId,
        ...(type === undefined ? {} : { type }),
        value,
      });
      return;
    }
    const rootToken = mutableObject(node.$root);
    if (
      rootToken !== undefined &&
      (Object.hasOwn(rootToken, "$value") || Object.hasOwn(rootToken, "$ref"))
    ) {
      const ownRootType = typeof rootToken.$type === "string" ? rootToken.$type : undefined;
      const value = Object.hasOwn(rootToken, "$value")
        ? rootToken.$value
        : (jsonPointerTokenAlias(rootToken.$ref) ?? rootToken.$ref);
      const type =
        isDtcgTokenAlias(value) || Object.hasOwn(rootToken, "$ref")
          ? ownRootType
          : (ownRootType ?? effectiveType);
      const tokenPath = [...path, "$root"].join(".");
      declarations.set(tokenPath, {
        path: tokenPath,
        pointer: `${pointerFromSegments(path)}/$root`,
        sourceId,
        ...(type === undefined ? {} : { type }),
        value,
      });
    }
    for (const [name, child] of Object.entries(node)) {
      if (name.startsWith("$")) continue;
      const childNode = mutableObject(child);
      if (childNode !== undefined) visit(childNode, [...path, name], effectiveType);
    }
  }
  visit(root, [], undefined);
  return declarations;
}

function rawTypeConsistencyIssue(
  sources: readonly { readonly document: unknown; readonly id: string }[],
): DtcgDiagnostic | undefined {
  const finalDeclarations = new Map<string, RawTypeDeclaration>();
  const occurrences: RawTypeDeclaration[] = [];
  const transitions: {
    readonly next: RawTypeDeclaration;
    readonly prior: RawTypeDeclaration;
  }[] = [];
  for (const source of sources) {
    for (const declaration of collectRawTypeDeclarations(source.document, source.id).values()) {
      const prior = finalDeclarations.get(declaration.path);
      if (prior !== undefined) transitions.push({ next: declaration, prior });
      finalDeclarations.set(declaration.path, declaration);
      occurrences.push(declaration);
    }
  }

  const inferredTypes = new Map<string, string | null>();
  let inferenceSteps = 0;
  function inferFinalType(path: string, active: readonly string[] = []): string | undefined {
    if (inferredTypes.has(path)) return inferredTypes.get(path) ?? undefined;
    const declaration = finalDeclarations.get(path);
    if (
      declaration === undefined ||
      active.includes(path) ||
      active.length >= DESIGN_TOKEN_PROFILE.limits.maxAliasDepth
    ) {
      return undefined;
    }
    inferenceSteps += 1;
    if (inferenceSteps > DESIGN_TOKEN_PROFILE.limits.maxResolutionSteps) return undefined;
    if (declaration.type !== undefined) {
      inferredTypes.set(path, declaration.type);
      return declaration.type;
    }
    if (!isDtcgTokenAlias(declaration.value)) {
      inferredTypes.set(path, null);
      return undefined;
    }
    const type = inferFinalType(getDtcgAliasTarget(declaration.value), [...active, path]);
    inferredTypes.set(path, type ?? null);
    return type;
  }

  function inferOccurrenceType(declaration: RawTypeDeclaration): string | undefined {
    if (declaration.type !== undefined) return declaration.type;
    return isDtcgTokenAlias(declaration.value)
      ? inferFinalType(getDtcgAliasTarget(declaration.value))
      : undefined;
  }

  for (const declaration of occurrences) {
    if (!isDtcgTokenAlias(declaration.value) || declaration.type === undefined) continue;
    const targetPath = getDtcgAliasTarget(declaration.value);
    const targetType = inferFinalType(targetPath);
    if (targetType !== undefined && targetType !== declaration.type) {
      return deepFreeze({
        classification: "INVALID_DTCG" as const,
        code: "ALIAS_TYPE_MISMATCH" as const,
        message: `Alias ${JSON.stringify(declaration.path)} changes type from ${JSON.stringify(declaration.type)} to ${JSON.stringify(targetType)}.`,
        pointer: `${declaration.pointer}/$value`,
        sourceId: declaration.sourceId,
        ...(declaration.path.length === 0 ? {} : { tokenPath: declaration.path }),
      });
    }
  }

  for (const { next, prior } of transitions) {
    const priorType = inferOccurrenceType(prior);
    const nextType = inferOccurrenceType(next);
    if (priorType !== undefined && nextType !== undefined && priorType !== nextType) {
      return deepFreeze({
        classification: "INVALID_DTCG" as const,
        code: "SOURCE_TYPE_MISMATCH" as const,
        message: `Token ${JSON.stringify(next.path || "root token")} changes type across ordered sources.`,
        pointer: next.pointer,
        sourceId: next.sourceId,
        ...(next.path.length === 0 ? {} : { tokenPath: next.path }),
      });
    }
  }
  return undefined;
}

type OverlayValidation =
  | { readonly features: readonly ThemeAuthoringUnsupportedFeature[]; readonly ok: true }
  | { readonly cause: DtcgDiagnostic; readonly ok: false }
  | { readonly limitExceeded: true; readonly ok: false };

function validateCompleteOverlay(
  theme: ThemeAuthoringTheme,
  mode: ThemeAuthoringMode,
): OverlayValidation {
  const workingSources = JSON.parse(canonicalizeJson(selectedSources(theme, mode))) as {
    description?: string;
    document: unknown;
    extensions?: DesignSystemJsonObject;
    id: string;
  }[];
  const rawTypeIssue = rawTypeConsistencyIssue(workingSources);
  if (rawTypeIssue !== undefined) return deepFreeze({ cause: rawTypeIssue, ok: false as const });
  const features = new Map<string, ThemeAuthoringUnsupportedFeature>();
  for (const source of [...workingSources]) {
    const projection = projectReviewedDtcgCompatibility(source.document, source.id);
    if (!projection.ok) return deepFreeze({ cause: projection.cause, ok: false as const });
    for (const projectedFeature of projection.features) {
      const feature = unsupportedFeature(
        theme,
        mode,
        projectedFeature.diagnostic,
        source.id,
        projectedFeature.featureId,
      );
      features.set(featureKey(feature), feature);
    }
    if (projection.omitSource) workingSources.splice(workingSources.indexOf(source), 1);
  }
  if (features.size > THEME_AUTHORING_LIMITS.maxUnsupportedFeaturesPerOverlay) {
    return deepFreeze({ limitExceeded: true as const, ok: false as const });
  }
  const projectedTypeIssue = rawTypeConsistencyIssue(workingSources);
  if (projectedTypeIssue !== undefined) {
    return deepFreeze({ cause: projectedTypeIssue, ok: false as const });
  }
  const projectionPaths: ProjectionPaths = new Map();
  const projectionOrigins: ProjectionOrigins = new Map();
  const seenDiagnostics = new Set<string>();
  for (
    let step = features.size;
    step < THEME_AUTHORING_LIMITS.maxUnsupportedFeaturesPerOverlay;
    step += 1
  ) {
    if (workingSources.length === 0) {
      return deepFreeze({ features: [...features.values()], ok: true as const });
    }
    const resolution = resolveDesignTokens({ sources: workingSources });
    if (resolution.ok) return deepFreeze({ features: [...features.values()], ok: true as const });
    const cause = resolution.diagnostics[0];
    const source =
      resolution.rejectedSource === undefined
        ? undefined
        : workingSources[resolution.rejectedSource.index];
    const reportedCause = normalizeRootMemberDiagnostic(
      remapProjectionDiagnostic(cause, source, projectionOrigins),
    );
    if (
      cause.classification !== "UNSUPPORTED_DTCG_FEATURE" ||
      resolution.rejectedSource === undefined
    ) {
      return deepFreeze({ cause: reportedCause, ok: false as const });
    }
    const feature = unsupportedFeature(
      theme,
      mode,
      reportedCause,
      resolution.rejectedSource.id,
      compatibilityFeatureId(reportedCause),
    );
    features.set(featureKey(feature), feature);
    const fingerprint = [
      resolution.rejectedSource.id,
      cause.code,
      cause.pointer,
      cause.tokenPath ?? "",
    ].join("\u0000");
    if (
      source === undefined ||
      seenDiagnostics.has(fingerprint) ||
      !neutralizeUnsupportedSource(
        source,
        cause,
        workingSources,
        projectionPaths,
        projectionOrigins,
      )
    ) {
      return deepFreeze({ cause: reportedCause, ok: false as const });
    }
    seenDiagnostics.add(fingerprint);
  }
  if (workingSources.length === 0) {
    return deepFreeze({ features: [...features.values()], ok: true as const });
  }
  const final = resolveDesignTokens({ sources: workingSources });
  if (!final.ok) {
    const source =
      final.rejectedSource === undefined ? undefined : workingSources[final.rejectedSource.index];
    const cause = remapProjectionDiagnostic(final.diagnostics[0], source, projectionOrigins);
    return final.diagnostics[0].classification === "UNSUPPORTED_DTCG_FEATURE"
      ? deepFreeze({ limitExceeded: true as const, ok: false as const })
      : deepFreeze({ cause, ok: false as const });
  }
  return deepFreeze({ features: [...features.values()], ok: true as const });
}

/**
 * Admit an unknown value as a complete, detached, loss-disclosing authoring document.
 *
 * @remarks Every theme/mode overlay is resolved against the frozen T02 DTCG profile. Invalid data
 * is rejected atomically. Safely captured data in the closed preservation matrix is retained and
 * disclosed but never promoted to a partial preview.
 */
export function admitThemeAuthoringDocument(input: unknown): ThemeAuthoringAdmissionResult {
  let captured: DesignSystemJsonValue;
  try {
    captured = captureInertJson(input);
  } catch (error) {
    return admissionFailure(
      diagnostic(
        "UNSAFE_THEME_VALUE",
        error instanceof Error ? error.message : "Theme input could not be captured safely.",
        error instanceof InertJsonError ? error.pointer : "",
      ),
    );
  }
  const object = asJsonObject(captured);
  if (
    object === undefined ||
    !exactKeys(object, ["kind", "schemaVersion", "themes"], ["extensions"]) ||
    object.kind !== THEME_AUTHORING_KIND ||
    !optionalExtensions(object.extensions)
  ) {
    return admissionFailure(
      diagnostic(
        "INVALID_THEME_DOCUMENT",
        "Expected one exact theme-authoring document envelope.",
        "",
      ),
    );
  }
  if (object.schemaVersion !== THEME_AUTHORING_SCHEMA_VERSION) {
    return admissionFailure(
      diagnostic(
        "UNSUPPORTED_THEME_VERSION",
        `Only theme-authoring schema version ${THEME_AUTHORING_SCHEMA_VERSION} is supported.`,
        "/schemaVersion",
      ),
    );
  }
  if (
    !Array.isArray(object.themes) ||
    object.themes.length === 0 ||
    object.themes.length > THEME_AUTHORING_LIMITS.maxThemes
  ) {
    return admissionFailure(
      diagnostic(
        "THEME_LIMIT_EXCEEDED",
        `Theme documents require 1–${THEME_AUTHORING_LIMITS.maxThemes} themes.`,
        "/themes",
      ),
    );
  }

  const themes: ThemeAuthoringTheme[] = [];
  const themeIds = new Set<string>();
  const sourceIds = new Set<string>();
  for (const [index, rawTheme] of object.themes.entries()) {
    const theme = parseTheme(rawTheme, `/themes/${index}`);
    if ("code" in theme) return admissionFailure(theme);
    if (themeIds.has(theme.id)) {
      return admissionFailure(
        diagnostic(
          "INVALID_THEME_DOCUMENT",
          `Duplicate theme id ${JSON.stringify(theme.id)}.`,
          `/themes/${index}/id`,
        ),
      );
    }
    themeIds.add(theme.id);
    for (const [sourceIndex, source] of [
      theme.base,
      ...theme.modes.map((mode) => mode.source),
    ].entries()) {
      if (sourceIds.has(source.id)) {
        return admissionFailure(
          diagnostic(
            "INVALID_THEME_DOCUMENT",
            `Duplicate document-local token source id ${JSON.stringify(source.id)}.`,
            `/themes/${index}/${sourceIndex === 0 ? "base" : `modes/${sourceIndex - 1}/source`}/id`,
          ),
        );
      }
      sourceIds.add(source.id);
    }
    themes.push(theme);
  }

  const documentOutput: {
    kind: typeof THEME_AUTHORING_KIND;
    schemaVersion: typeof THEME_AUTHORING_SCHEMA_VERSION;
    themes: readonly ThemeAuthoringTheme[];
    extensions?: DesignSystemJsonObject;
  } = {
    kind: THEME_AUTHORING_KIND,
    schemaVersion: THEME_AUTHORING_SCHEMA_VERSION,
    themes,
  };
  if (object.extensions !== undefined)
    documentOutput.extensions = object.extensions as DesignSystemJsonObject;
  const document = deepFreeze(documentOutput) as ThemeAuthoringDocument;

  const features = new Map<string, ThemeAuthoringUnsupportedFeature>();
  for (const [themeIndex, theme] of document.themes.entries()) {
    for (const [modeIndex, mode] of theme.modes.entries()) {
      const validation = validateCompleteOverlay(theme, mode);
      if (!validation.ok) {
        if ("limitExceeded" in validation) {
          return admissionFailure(
            diagnostic(
              "UNSUPPORTED_FEATURE_LIMIT_EXCEEDED",
              `A theme/mode overlay can preserve at most ${THEME_AUTHORING_LIMITS.maxUnsupportedFeaturesPerOverlay} validated closed-matrix features.`,
              `/themes/${themeIndex}/modes/${modeIndex}`,
              { modeId: mode.id, themeId: theme.id },
            ),
          );
        }
        return admissionFailure(
          diagnostic(
            "DTCG_REJECTED",
            "The complete theme/mode overlay does not satisfy the frozen T02 DTCG profile.",
            `/themes/${themeIndex}/modes/${modeIndex}`,
            { cause: validation.cause, modeId: mode.id, themeId: theme.id },
          ),
        );
      }
      for (const feature of validation.features) features.set(featureKey(feature), feature);
    }
  }

  const report = deepFreeze({
    canonicalBytes: canonicalizeJsonBytes(document).byteLength,
    losses: [] as const,
    preservedUnsupportedFeatures: [...features.values()].toSorted((left, right) => {
      const leftKey = featureKey(left);
      const rightKey = featureKey(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    }),
  });
  return deepFreeze({ document, diagnostics: [] as const, ok: true as const, report });
}

function findTheme(
  document: ThemeAuthoringDocument,
  themeId: string,
): ThemeAuthoringTheme | undefined {
  return document.themes.find((theme) => theme.id === themeId);
}

function findMode(theme: ThemeAuthoringTheme, modeId: string): ThemeAuthoringMode | undefined {
  return theme.modes.find((mode) => mode.id === modeId);
}

function selectionDiagnostic(): ThemeAuthoringDiagnostic {
  return diagnostic(
    "INVALID_SELECTION",
    "The selected theme and mode must identify one admitted mode.",
    "/selection",
  );
}

function captureSelection(input: unknown): ThemeAuthoringSelection | undefined {
  let value: DesignSystemJsonValue;
  try {
    value = captureInertJson(input);
  } catch {
    return undefined;
  }
  const object = asJsonObject(value);
  if (
    object === undefined ||
    !exactKeys(object, ["modeId", "themeId"], []) ||
    !validIdentifier(object.modeId) ||
    !validIdentifier(object.themeId)
  ) {
    return undefined;
  }
  return deepFreeze({ modeId: object.modeId, themeId: object.themeId });
}

function validSelection(
  document: ThemeAuthoringDocument,
  selection: ThemeAuthoringSelection,
): boolean {
  const theme = findTheme(document, selection.themeId);
  return theme !== undefined && findMode(theme, selection.modeId) !== undefined;
}

function defaultSelection(document: ThemeAuthoringDocument): ThemeAuthoringSelection {
  const theme = document.themes[0];
  const mode = theme?.modes[0];
  if (theme === undefined || mode === undefined)
    throw new TypeError("Admitted documents have a mode.");
  return deepFreeze({ modeId: mode.id, themeId: theme.id });
}

function tokenNodeAtPath(
  document: DtcgTokenDocument,
  path: string,
): DesignSystemJsonObject | undefined {
  let current: DesignSystemJsonValue = document;
  for (const segment of path.split(".")) {
    const object = asJsonObject(current);
    const next = object?.[segment];
    if (next === undefined) return undefined;
    current = next;
  }
  const node = asJsonObject(current);
  return node !== undefined && Object.hasOwn(node, "$value") ? node : undefined;
}

function tokenMetadata(node: DesignSystemJsonObject): DtcgNodeMetadata {
  const output: {
    $deprecated?: boolean | string;
    $description?: string;
    $extensions?: DesignSystemJsonObject;
  } = {};
  if (typeof node.$deprecated === "boolean" || typeof node.$deprecated === "string")
    output.$deprecated = node.$deprecated;
  if (typeof node.$description === "string") output.$description = node.$description;
  if (asJsonObject(node.$extensions as DesignSystemJsonValue) !== undefined) {
    output.$extensions = node.$extensions as DesignSystemJsonObject;
  }
  return deepFreeze(output);
}

function controlsFor(
  resolution: Extract<ReturnType<typeof resolveDesignTokens>, { readonly ok: true }>,
  sources: ReturnType<typeof selectedSources>,
): readonly ThemeAuthoringControl[] {
  return deepFreeze(
    resolution.tokenPaths.map((path) => {
      const resolved = resolution.tokens[path];
      if (resolved === undefined || resolved.origin.kind !== "source") {
        throw new TypeError("Theme previews contain source-backed resolved tokens only.");
      }
      const source = sources[resolved.origin.sourceIndex];
      const node = source === undefined ? undefined : tokenNodeAtPath(source.document, path);
      if (source === undefined || node === undefined || node.$value === undefined) {
        throw new TypeError("Resolved token provenance must identify an editable declaration.");
      }
      const value = node.$value as DtcgTokenValue;
      const alias = isDtcgTokenAlias(value);
      const control: {
        aliasTarget?: string;
        family: DesignTokenValueFamily;
        kind: "alias" | "literal";
        metadata: DtcgNodeMetadata;
        path: string;
        resolvedValue: DtcgTokenLiteral;
        sourceId: string;
        type: DtcgTokenType;
        value: DtcgTokenValue;
      } = {
        family: getDesignTokenValueFamily(resolved.type),
        kind: alias ? "alias" : "literal",
        metadata: tokenMetadata(node),
        path,
        resolvedValue: resolved.value,
        sourceId: source.id,
        type: resolved.type,
        value,
      };
      if (alias) control.aliasTarget = getDtcgAliasTarget(value);
      return deepFreeze(control);
    }),
  );
}

function previewFor(
  document: ThemeAuthoringDocument,
  selection: ThemeAuthoringSelection,
): ThemeAuthoringPreview {
  const theme = findTheme(document, selection.themeId);
  const mode = theme === undefined ? undefined : findMode(theme, selection.modeId);
  if (theme === undefined || mode === undefined)
    throw new TypeError("Expected a validated selection.");
  const validation = validateCompleteOverlay(theme, mode);
  const firstUnsupportedFeature = validation.ok ? validation.features[0] : undefined;
  if (firstUnsupportedFeature !== undefined) {
    return deepFreeze({
      diagnostics: [firstUnsupportedFeature.diagnostic] as const,
      modeId: mode.id,
      ok: false as const,
      themeId: theme.id,
    });
  }
  const sources = selectedSources(theme, mode);
  const resolution = resolveDesignTokens({ sources });
  if (!resolution.ok) {
    return deepFreeze({
      diagnostics: resolution.diagnostics,
      modeId: mode.id,
      ok: false as const,
      themeId: theme.id,
    });
  }
  return deepFreeze({
    controls: controlsFor(resolution, sources),
    modeId: mode.id,
    ok: true as const,
    sourceIds: resolution.sourceIds,
    themeId: theme.id,
    tokenPaths: resolution.tokenPaths,
    tokens: resolution.tokens,
  });
}

function makeSession(
  document: ThemeAuthoringDocument,
  selection: ThemeAuthoringSelection,
  revision: number,
  past: readonly ThemeAuthoringHistoryEntry[],
  future: readonly ThemeAuthoringHistoryEntry[],
): ThemeAuthoringSession {
  const session = deepFreeze({
    document,
    future: [...future],
    kind: SESSION_KIND,
    past: [...past],
    preview: previewFor(document, selection),
    revision,
    selection,
  });
  SESSION_PROVENANCE.add(session);
  return session;
}

function historyEntry(
  session: ThemeAuthoringSession,
  restoreSelection: boolean,
): ThemeAuthoringHistoryEntry {
  return deepFreeze({ document: session.document, restoreSelection, selection: session.selection });
}

/** Create a bounded local authoring session around one admitted document. */
export function createThemeAuthoringSession(
  input: unknown,
  requestedSelection?: unknown,
): ThemeAuthoringSessionResult {
  const admission = admitThemeAuthoringDocument(input);
  if (!admission.ok) return admission;
  const selection =
    requestedSelection === undefined
      ? defaultSelection(admission.document)
      : captureSelection(requestedSelection);
  if (selection === undefined || !validSelection(admission.document, selection)) {
    return deepFreeze({ diagnostics: [selectionDiagnostic()] as const, ok: false as const });
  }
  return deepFreeze({
    ok: true as const,
    session: makeSession(admission.document, selection, 0, [], []),
  });
}

function transitionFailure(
  session: ThemeAuthoringSession,
  issue: ThemeAuthoringDiagnostic,
): ThemeAuthoringTransitionFailure {
  return deepFreeze({ diagnostics: [issue] as const, ok: false as const, session });
}

function unchanged(session: ThemeAuthoringSession): ThemeAuthoringTransitionSuccess {
  return deepFreeze({ changed: false, ok: true as const, session });
}

function nextRevision(session: ThemeAuthoringSession): number | undefined {
  return Number.isSafeInteger(session.revision) && session.revision < Number.MAX_SAFE_INTEGER
    ? session.revision + 1
    : undefined;
}

function checkedSessionRevision(
  session: ThemeAuthoringSession,
): number | ThemeAuthoringTransitionFailure {
  const revision = nextRevision(session);
  return (
    revision ??
    transitionFailure(
      session,
      diagnostic(
        "REVISION_LIMIT_EXCEEDED",
        "The bounded session revision limit was reached.",
        "/revision",
      ),
    )
  );
}

function assertSession(session: ThemeAuthoringSession): void {
  if (!SESSION_PROVENANCE.has(session)) {
    throw new TypeError("Theme authoring operations require a session created by this package.");
  }
}

/** Select another admitted mode without changing document history. */
export function selectThemeAuthoringMode(
  session: ThemeAuthoringSession,
  requestedSelection: unknown,
): ThemeAuthoringTransitionResult {
  assertSession(session);
  const selection = captureSelection(requestedSelection);
  if (selection === undefined || !validSelection(session.document, selection)) {
    return transitionFailure(session, selectionDiagnostic());
  }
  if (
    selection.themeId === session.selection.themeId &&
    selection.modeId === session.selection.modeId
  ) {
    return unchanged(session);
  }
  const revision = checkedSessionRevision(session);
  if (typeof revision !== "number") return revision;
  return deepFreeze({
    changed: true,
    ok: true as const,
    session: makeSession(session.document, selection, revision, session.past, session.future),
  });
}

function captureEdit(input: unknown): ThemeAuthoringEdit | undefined {
  let captured: DesignSystemJsonValue;
  try {
    captured = captureInertJson(input);
  } catch {
    return undefined;
  }
  const object = asJsonObject(captured);
  if (object === undefined || typeof object.kind !== "string") return undefined;
  if (object.kind === "set-literal" || object.kind === "create-literal") {
    if (
      !exactKeys(object, ["kind", "path", "sourceId", "themeId", "type", "value"], []) ||
      !validIdentifier(object.themeId) ||
      !validIdentifier(object.sourceId) ||
      typeof object.path !== "string" ||
      !validTokenPath(object.path) ||
      typeof object.type !== "string" ||
      !TOKEN_TYPES.has(object.type)
    ) {
      return undefined;
    }
    return deepFreeze({
      kind: object.kind,
      path: object.path,
      sourceId: object.sourceId,
      themeId: object.themeId,
      type: object.type as DtcgTokenType,
      value: object.value as DtcgTokenLiteral,
    }) as ThemeAuthoringEdit;
  }
  if (object.kind === "set-alias" || object.kind === "create-alias") {
    if (
      !exactKeys(object, ["kind", "path", "sourceId", "targetPath", "themeId", "type"], []) ||
      !validIdentifier(object.themeId) ||
      !validIdentifier(object.sourceId) ||
      typeof object.path !== "string" ||
      !validTokenPath(object.path) ||
      typeof object.targetPath !== "string" ||
      !validTokenPath(object.targetPath) ||
      typeof object.type !== "string" ||
      !TOKEN_TYPES.has(object.type)
    ) {
      return undefined;
    }
    return deepFreeze({
      kind: object.kind,
      path: object.path,
      sourceId: object.sourceId,
      targetPath: object.targetPath,
      themeId: object.themeId,
      type: object.type as DtcgTokenType,
    });
  }
  if (object.kind === "delete-token") {
    return exactKeys(object, ["kind", "path", "sourceId", "themeId"], []) &&
      validIdentifier(object.themeId) &&
      validIdentifier(object.sourceId) &&
      typeof object.path === "string" &&
      validTokenPath(object.path)
      ? deepFreeze({
          kind: object.kind,
          path: object.path,
          sourceId: object.sourceId,
          themeId: object.themeId,
        })
      : undefined;
  }
  if (object.kind === "duplicate-theme") {
    return exactKeys(object, ["fromThemeId", "kind", "name", "themeId"], []) &&
      validIdentifier(object.fromThemeId) &&
      validIdentifier(object.themeId) &&
      validLabel(object.name)
      ? deepFreeze({
          fromThemeId: object.fromThemeId,
          kind: object.kind,
          name: object.name,
          themeId: object.themeId,
        })
      : undefined;
  }
  if (object.kind === "rename-theme") {
    return exactKeys(object, ["kind", "name", "themeId"], []) &&
      validIdentifier(object.themeId) &&
      validLabel(object.name)
      ? deepFreeze({ kind: object.kind, name: object.name, themeId: object.themeId })
      : undefined;
  }
  if (object.kind === "delete-theme") {
    return exactKeys(object, ["kind", "themeId"], []) && validIdentifier(object.themeId)
      ? deepFreeze({ kind: object.kind, themeId: object.themeId })
      : undefined;
  }
  if (object.kind === "duplicate-mode") {
    return exactKeys(object, ["fromModeId", "kind", "modeId", "name", "themeId"], []) &&
      validIdentifier(object.fromModeId) &&
      validIdentifier(object.modeId) &&
      validIdentifier(object.themeId) &&
      validLabel(object.name)
      ? deepFreeze({
          fromModeId: object.fromModeId,
          kind: object.kind,
          modeId: object.modeId,
          name: object.name,
          themeId: object.themeId,
        })
      : undefined;
  }
  if (object.kind === "rename-mode") {
    return exactKeys(object, ["kind", "modeId", "name", "themeId"], []) &&
      validIdentifier(object.modeId) &&
      validIdentifier(object.themeId) &&
      validLabel(object.name)
      ? deepFreeze({
          kind: object.kind,
          modeId: object.modeId,
          name: object.name,
          themeId: object.themeId,
        })
      : undefined;
  }
  if (object.kind === "delete-mode") {
    return exactKeys(object, ["kind", "modeId", "themeId"], []) &&
      validIdentifier(object.modeId) &&
      validIdentifier(object.themeId)
      ? deepFreeze({ kind: object.kind, modeId: object.modeId, themeId: object.themeId })
      : undefined;
  }
  return undefined;
}

function mutableObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function mutableSource(
  candidate: Record<string, unknown>,
  themeId: string,
  sourceId: string,
): Record<string, unknown> | undefined {
  const themes = candidate.themes;
  if (!Array.isArray(themes)) return undefined;
  const theme = themes.map(mutableObject).find((item) => item?.id === themeId);
  if (theme === undefined) return undefined;
  const base = mutableObject(theme.base);
  if (base?.id === sourceId) return base;
  const modes = theme.modes;
  if (!Array.isArray(modes)) return undefined;
  for (const rawMode of modes) {
    const mode = mutableObject(rawMode);
    const source = mutableObject(mode?.source);
    if (source?.id === sourceId) return source;
  }
  return undefined;
}

function mutableTheme(
  candidate: Record<string, unknown>,
  themeId: string,
): Record<string, unknown> | undefined {
  const themes = candidate.themes;
  if (!Array.isArray(themes)) return undefined;
  return themes.map(mutableObject).find((theme) => theme?.id === themeId);
}

function mutableMode(
  theme: Record<string, unknown>,
  modeId: string,
): Record<string, unknown> | undefined {
  const modes = theme.modes;
  if (!Array.isArray(modes)) return undefined;
  return modes.map(mutableObject).find((mode) => mode?.id === modeId);
}

function documentSourceIds(document: ThemeAuthoringDocument): Set<string> {
  const sourceIds = new Set<string>();
  for (const theme of document.themes) {
    sourceIds.add(theme.base.id);
    for (const mode of theme.modes) sourceIds.add(mode.source.id);
  }
  return sourceIds;
}

function allocateDuplicateSourceId(stem: string, reserved: Set<string>): string {
  const limit = THEME_AUTHORING_LIMITS.maxIdentifierCodeUnits;
  for (let attempt = 0; attempt <= reserved.size; attempt += 1) {
    const suffix = attempt === 0 ? "" : `:${attempt + 1}`;
    const candidate = `${stem.slice(0, limit - suffix.length)}${suffix}`;
    if (!reserved.has(candidate) && IDENTIFIER.test(candidate)) {
      reserved.add(candidate);
      return candidate;
    }
  }
  throw new TypeError("A bounded fresh source identity could not be allocated.");
}

function mutableTokenNode(
  source: Record<string, unknown>,
  path: string,
): Record<string, unknown> | undefined {
  let current = mutableObject(source.document);
  if (current === undefined) return undefined;
  for (const segment of path.split(".")) {
    current = mutableObject(current[segment]);
    if (current === undefined) return undefined;
  }
  return Object.hasOwn(current, "$value") ? current : undefined;
}

function createMutableTokenNode(
  source: Record<string, unknown>,
  path: string,
): Record<string, unknown> | undefined {
  let current = mutableObject(source.document);
  if (current === undefined) return undefined;
  const segments = path.split(".");
  for (const segment of segments.slice(0, -1)) {
    if (Object.hasOwn(current, "$value")) return undefined;
    if (!Object.hasOwn(current, segment)) {
      Object.defineProperty(current, segment, {
        configurable: true,
        enumerable: true,
        value: {},
        writable: true,
      });
    }
    current = mutableObject(current[segment]);
    if (current === undefined) return undefined;
  }
  const finalSegment = segments.at(-1);
  if (finalSegment === undefined || Object.hasOwn(current, finalSegment)) return undefined;
  const node: Record<string, unknown> = {};
  Object.defineProperty(current, finalSegment, {
    configurable: true,
    enumerable: true,
    value: node,
    writable: true,
  });
  return node;
}

function deleteMutableTokenNode(source: Record<string, unknown>, path: string): boolean {
  let current = mutableObject(source.document);
  if (current === undefined) return false;
  const segments = path.split(".");
  const ancestors: { readonly key: string; readonly parent: Record<string, unknown> }[] = [];
  for (const segment of segments.slice(0, -1)) {
    if (!Object.hasOwn(current, segment)) return false;
    ancestors.push({ key: segment, parent: current });
    current = mutableObject(current[segment]);
    if (current === undefined) return false;
  }
  const finalSegment = segments.at(-1);
  if (finalSegment === undefined || !Object.hasOwn(current, finalSegment)) return false;
  const node = mutableObject(current[finalSegment]);
  if (
    node === undefined ||
    !Object.hasOwn(node, "$value") ||
    !Reflect.deleteProperty(current, finalSegment)
  ) {
    return false;
  }
  for (const { key, parent } of ancestors.toReversed()) {
    const group = mutableObject(parent[key]);
    if (group === undefined || Object.keys(group).length > 0) break;
    if (!Reflect.deleteProperty(parent, key)) break;
  }
  return true;
}

function validateLiteralEdit(
  edit: ThemeAuthoringCreateLiteralEdit | ThemeAuthoringLiteralEdit,
): DtcgDiagnostic | undefined {
  const result = resolveDesignTokens({
    sources: [
      {
        document: { probe: { $type: edit.type, $value: edit.value } },
        id: "authoring.literal-probe",
      },
    ],
  });
  return result.ok ? undefined : result.diagnostics[0];
}

function commitAuthoringCandidate(
  session: ThemeAuthoringSession,
  candidate: unknown,
  preferredSelection: ThemeAuthoringSelection | undefined,
  tokenOperation: boolean,
): ThemeAuthoringTransitionResult {
  const admission = admitThemeAuthoringDocument(candidate);
  if (!admission.ok) {
    if (!tokenOperation) return transitionFailure(session, admission.diagnostics[0]);
    const cause = admission.diagnostics[0].cause;
    return transitionFailure(
      session,
      diagnostic(
        "TOKEN_EDIT_REJECTED",
        "The token operation would invalidate at least one complete theme/mode overlay.",
        "/edit",
        { ...(cause === undefined ? {} : { cause }) },
      ),
    );
  }
  if (canonicalizeJson(admission.document) === canonicalizeJson(session.document)) {
    return unchanged(session);
  }
  const revision = checkedSessionRevision(session);
  if (typeof revision !== "number") return revision;
  const selection =
    preferredSelection !== undefined && validSelection(admission.document, preferredSelection)
      ? preferredSelection
      : validSelection(admission.document, session.selection)
        ? session.selection
        : defaultSelection(admission.document);
  const restoreSelection =
    selection.themeId !== session.selection.themeId ||
    selection.modeId !== session.selection.modeId;
  const past = [...session.past, historyEntry(session, restoreSelection)].slice(
    -THEME_AUTHORING_LIMITS.maxHistoryEntries,
  );
  return deepFreeze({
    changed: true,
    ok: true as const,
    session: makeSession(admission.document, selection, revision, past, []),
  });
}

/** Apply one finite theme, mode, literal, or alias edit as an all-mode atomic transaction. */
export function applyThemeAuthoringEdit(
  session: ThemeAuthoringSession,
  input: unknown,
): ThemeAuthoringTransitionResult {
  assertSession(session);
  const edit = captureEdit(input);
  if (edit === undefined) {
    return transitionFailure(
      session,
      diagnostic(
        "INVALID_EDIT",
        "Expected one bounded theme, mode, literal, or whole-token alias edit.",
        "/edit",
      ),
    );
  }
  if (edit.kind === "set-literal" || edit.kind === "create-literal") {
    const cause = validateLiteralEdit(edit);
    if (cause !== undefined) {
      return transitionFailure(
        session,
        diagnostic(
          "TOKEN_EDIT_REJECTED",
          "The literal is outside the frozen T02 DTCG profile.",
          "/edit/value",
          {
            cause,
            themeId: edit.themeId,
          },
        ),
      );
    }
  }

  const candidate = JSON.parse(canonicalizeJson(session.document)) as unknown;
  const root = mutableObject(candidate);
  if (root === undefined) throw new TypeError("Package-created documents are objects.");

  if (edit.kind === "duplicate-theme") {
    const themes = root.themes;
    const sourceTheme = mutableTheme(root, edit.fromThemeId);
    if (!Array.isArray(themes) || sourceTheme === undefined) {
      return transitionFailure(
        session,
        diagnostic("INVALID_EDIT", "The theme to duplicate does not exist.", "/edit/fromThemeId"),
      );
    }
    const duplicate = JSON.parse(canonicalizeJson(sourceTheme)) as Record<string, unknown>;
    duplicate.id = edit.themeId;
    duplicate.name = edit.name;
    const base = mutableObject(duplicate.base);
    const modes = duplicate.modes;
    if (base === undefined || !Array.isArray(modes)) {
      throw new TypeError("Admitted themes contain a base and modes.");
    }
    const reservedSourceIds = documentSourceIds(session.document);
    base.id = allocateDuplicateSourceId(`${edit.themeId}:base-source`, reservedSourceIds);
    for (const rawMode of modes) {
      const mode = mutableObject(rawMode);
      const source = mutableObject(mode?.source);
      if (mode === undefined || source === undefined || typeof mode.id !== "string") {
        throw new TypeError("Admitted modes contain a source.");
      }
      source.id = allocateDuplicateSourceId(`${edit.themeId}:mode:${mode.id}`, reservedSourceIds);
    }
    themes.push(duplicate);
    const preferredMode =
      session.selection.themeId === edit.fromThemeId &&
      modes.some((rawMode) => mutableObject(rawMode)?.id === session.selection.modeId)
        ? session.selection.modeId
        : (mutableObject(modes[0])?.id as string | undefined);
    return commitAuthoringCandidate(
      session,
      candidate,
      preferredMode === undefined ? undefined : { modeId: preferredMode, themeId: edit.themeId },
      false,
    );
  }

  const theme = mutableTheme(root, edit.themeId);
  if (theme === undefined) {
    return transitionFailure(
      session,
      diagnostic("INVALID_EDIT", "The edit theme does not exist.", "/edit/themeId"),
    );
  }

  if (edit.kind === "rename-theme") {
    theme.name = edit.name;
    return commitAuthoringCandidate(session, candidate, undefined, false);
  }
  if (edit.kind === "delete-theme") {
    const themes = root.themes;
    if (!Array.isArray(themes)) throw new TypeError("Admitted documents contain themes.");
    const index = themes.findIndex((rawTheme) => mutableObject(rawTheme)?.id === edit.themeId);
    if (index < 0) {
      return transitionFailure(
        session,
        diagnostic("INVALID_EDIT", "The theme to delete does not exist.", "/edit/themeId"),
      );
    }
    themes.splice(index, 1);
    return commitAuthoringCandidate(session, candidate, undefined, false);
  }
  if (edit.kind === "duplicate-mode") {
    const modes = theme.modes;
    const sourceMode = mutableMode(theme, edit.fromModeId);
    if (!Array.isArray(modes) || sourceMode === undefined) {
      return transitionFailure(
        session,
        diagnostic("INVALID_EDIT", "The mode to duplicate does not exist.", "/edit/fromModeId"),
      );
    }
    const duplicate = JSON.parse(canonicalizeJson(sourceMode)) as Record<string, unknown>;
    duplicate.id = edit.modeId;
    duplicate.name = edit.name;
    const source = mutableObject(duplicate.source);
    if (source === undefined) throw new TypeError("Admitted modes contain a source.");
    source.id = allocateDuplicateSourceId(
      `${edit.themeId}:mode:${edit.modeId}`,
      documentSourceIds(session.document),
    );
    modes.push(duplicate);
    return commitAuthoringCandidate(
      session,
      candidate,
      { modeId: edit.modeId, themeId: edit.themeId },
      false,
    );
  }
  if (edit.kind === "rename-mode") {
    const mode = mutableMode(theme, edit.modeId);
    if (mode === undefined) {
      return transitionFailure(
        session,
        diagnostic("INVALID_EDIT", "The mode to rename does not exist.", "/edit/modeId"),
      );
    }
    mode.name = edit.name;
    return commitAuthoringCandidate(session, candidate, undefined, false);
  }
  if (edit.kind === "delete-mode") {
    const modes = theme.modes;
    if (!Array.isArray(modes)) throw new TypeError("Admitted themes contain modes.");
    const index = modes.findIndex((rawMode) => mutableObject(rawMode)?.id === edit.modeId);
    if (index < 0) {
      return transitionFailure(
        session,
        diagnostic("INVALID_EDIT", "The mode to delete does not exist.", "/edit/modeId"),
      );
    }
    modes.splice(index, 1);
    const firstRemainingMode = mutableObject(modes[0])?.id;
    const deletedSelectedMode =
      session.selection.themeId === edit.themeId && session.selection.modeId === edit.modeId;
    return commitAuthoringCandidate(
      session,
      candidate,
      deletedSelectedMode && typeof firstRemainingMode === "string"
        ? { modeId: firstRemainingMode, themeId: edit.themeId }
        : undefined,
      false,
    );
  }

  const source = mutableSource(root, edit.themeId, edit.sourceId);
  if (source === undefined) {
    return transitionFailure(
      session,
      diagnostic(
        "INVALID_EDIT",
        "The edit source does not belong to the selected theme.",
        "/edit/sourceId",
      ),
    );
  }
  if (edit.kind === "delete-token") {
    if (!deleteMutableTokenNode(source, edit.path)) {
      return transitionFailure(
        session,
        diagnostic(
          "INVALID_EDIT",
          "The edit path must identify one existing token declaration.",
          "/edit/path",
        ),
      );
    }
    return commitAuthoringCandidate(session, candidate, undefined, true);
  }
  const creating = edit.kind === "create-alias" || edit.kind === "create-literal";
  const node = creating
    ? createMutableTokenNode(source, edit.path)
    : mutableTokenNode(source, edit.path);
  if (node === undefined) {
    return transitionFailure(
      session,
      diagnostic(
        "INVALID_EDIT",
        creating
          ? "The new token path must not already exist or descend from a token."
          : "The edit path must identify one existing token declaration.",
        "/edit/path",
      ),
    );
  }
  node.$type = edit.type;
  node.$value =
    edit.kind === "set-alias" || edit.kind === "create-alias" ? `{${edit.targetPath}}` : edit.value;
  return commitAuthoringCandidate(session, candidate, undefined, true);
}

/** Undo the most recent successful document edit or import in bounded memory. */
export function undoThemeAuthoringEdit(
  session: ThemeAuthoringSession,
): ThemeAuthoringTransitionResult {
  assertSession(session);
  const priorEntry = session.past.at(-1);
  if (priorEntry === undefined) {
    return transitionFailure(
      session,
      diagnostic("HISTORY_EMPTY", "There is no document edit to undo.", "/past"),
    );
  }
  const revision = checkedSessionRevision(session);
  if (typeof revision !== "number") return revision;
  return deepFreeze({
    changed: true,
    ok: true as const,
    session: makeSession(
      priorEntry.document,
      !priorEntry.restoreSelection && validSelection(priorEntry.document, session.selection)
        ? session.selection
        : priorEntry.selection,
      revision,
      session.past.slice(0, -1),
      [historyEntry(session, priorEntry.restoreSelection), ...session.future],
    ),
  });
}

/** Redo the next previously undone document transition in bounded memory. */
export function redoThemeAuthoringEdit(
  session: ThemeAuthoringSession,
): ThemeAuthoringTransitionResult {
  assertSession(session);
  const nextEntry = session.future[0];
  if (nextEntry === undefined) {
    return transitionFailure(
      session,
      diagnostic("HISTORY_EMPTY", "There is no document edit to redo.", "/future"),
    );
  }
  const revision = checkedSessionRevision(session);
  if (typeof revision !== "number") return revision;
  const past = [...session.past, historyEntry(session, nextEntry.restoreSelection)].slice(
    -THEME_AUTHORING_LIMITS.maxHistoryEntries,
  );
  return deepFreeze({
    changed: true,
    ok: true as const,
    session: makeSession(
      nextEntry.document,
      !nextEntry.restoreSelection && validSelection(nextEntry.document, session.selection)
        ? session.selection
        : nextEntry.selection,
      revision,
      past,
      session.future.slice(1),
    ),
  });
}

/** Export the complete authoring document as deterministic canonical JSON. */
export function exportThemeAuthoringDocument(session: ThemeAuthoringSession): ThemeAuthoringExport {
  assertSession(session);
  const admission = admitThemeAuthoringDocument(session.document);
  if (!admission.ok)
    throw new TypeError("A package-created session must contain an admitted document.");
  return deepFreeze({ report: admission.report, text: canonicalizeJson(admission.document) });
}

/**
 * Import a complete theme document atomically while preserving the exact current session on error.
 *
 * @remarks Duplicate keys, invalid Unicode, excessive input, malformed authoring structure and
 * invalid DTCG all fail without changing document, preview, selection, revision, or history.
 */
export function importThemeAuthoringDocument(
  session: ThemeAuthoringSession,
  text: unknown,
): ThemeAuthoringTransitionResult {
  assertSession(session);
  const parsed = parseInertJsonText(text);
  if (!parsed.ok) {
    return transitionFailure(
      session,
      diagnostic("IMPORT_JSON_INVALID", `Theme import rejected: ${parsed.issue}.`, "/import"),
    );
  }
  const admission = admitThemeAuthoringDocument(parsed.value);
  if (!admission.ok) return transitionFailure(session, admission.diagnostics[0]);
  if (canonicalizeJson(admission.document) === canonicalizeJson(session.document))
    return unchanged(session);
  const revision = checkedSessionRevision(session);
  if (typeof revision !== "number") return revision;
  const selection = validSelection(admission.document, session.selection)
    ? session.selection
    : defaultSelection(admission.document);
  const restoreSelection =
    selection.themeId !== session.selection.themeId ||
    selection.modeId !== session.selection.modeId;
  const past = [...session.past, historyEntry(session, restoreSelection)].slice(
    -THEME_AUTHORING_LIMITS.maxHistoryEntries,
  );
  return deepFreeze({
    changed: true,
    ok: true as const,
    session: makeSession(admission.document, selection, revision, past, []),
  });
}
