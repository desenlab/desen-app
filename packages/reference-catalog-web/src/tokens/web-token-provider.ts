import { REFERENCE_TOKEN_DOCUMENT } from "./reference-token-document.js";

import type { CSSProperties } from "react";
import type {
  DtcgReferenceAlias,
  DtcgReferenceColorValue,
  DtcgReferenceDimensionValue,
  DtcgReferenceTokenValue,
} from "./reference-token-document.js";

const TOKEN_TO_CSS_PROPERTY = Object.freeze({
  "color.action.primary": "--desen-color-action-primary",
  "color.border.default": "--desen-color-border",
  "color.border.strong": "--desen-color-border-strong",
  "color.content.onAction": "--desen-color-on-action",
  "color.content.onCritical": "--desen-color-on-critical",
  "color.critical.base": "--desen-color-critical",
  "color.critical.surface": "--desen-color-critical-surface",
  "color.critical.text": "--desen-color-critical-text",
  "color.info.base": "--desen-color-info",
  "color.info.surface": "--desen-color-info-surface",
  "color.info.text": "--desen-color-info-text",
  "color.success.base": "--desen-color-success",
  "color.success.surface": "--desen-color-success-surface",
  "color.success.text": "--desen-color-success-text",
  "color.surface.default": "--desen-color-surface",
  "color.surface.disabled": "--desen-color-surface-disabled",
  "color.text.default": "--desen-color-text",
  "color.warning.base": "--desen-color-warning",
  "color.warning.surface": "--desen-color-warning-surface",
  "color.warning.text": "--desen-color-warning-text",
  "radius.control": "--desen-radius-control",
  "space.lg": "--desen-space-lg",
  "space.md": "--desen-space-md",
  "space.sm": "--desen-space-sm",
  "space.xl": "--desen-space-xl",
  "space.xs": "--desen-space-xs",
} as const);

/** Exact token paths supplied by the reference Web token provider. */
export type ReferenceWebTokenPath = keyof typeof TOKEN_TO_CSS_PROPERTY;

/** Exact CSS custom properties supplied by the reference Web token provider. */
export type ReferenceWebTokenCssProperty = (typeof TOKEN_TO_CSS_PROPERTY)[ReferenceWebTokenPath];

/** A CSS `var()` reference with its DTCG-derived independent-render fallback. */
export type ReferenceWebTokenCssReference = `var(${ReferenceWebTokenCssProperty}, ${string})`;

/** Immutable custom-property map assignable to an existing React host root's `style` property. */
export type ReferenceWebTokenCssProperties = Readonly<
  CSSProperties & Record<ReferenceWebTokenCssProperty, string>
>;

/** A successful immutable reference-token lookup. */
export interface ReferenceWebTokenResolutionSuccess {
  readonly ok: true;
  readonly token: ReferenceWebTokenPath;
  readonly value: string;
  readonly cssProperty: ReferenceWebTokenCssProperty;
  readonly cssReference: ReferenceWebTokenCssReference;
}

/** An explicit immutable failure for a token outside the reference document. */
export interface ReferenceWebTokenResolutionFailure {
  readonly ok: false;
  readonly code: "UNKNOWN_TOKEN";
  readonly token: string;
}

/** Result returned by the target-specific reference token provider. */
export type ReferenceWebTokenResolution =
  ReferenceWebTokenResolutionFailure | ReferenceWebTokenResolutionSuccess;

/**
 * Immutable, DOM-free Web projection derived from the reference DTCG document.
 *
 * @remarks `cssProperties` can be applied to an existing host root. The provider deliberately
 * renders no wrapper and owns no generic DESEN runtime `$token` resolution policy.
 */
export interface ReferenceWebTokenProvider {
  readonly tokenPaths: readonly ReferenceWebTokenPath[];
  readonly values: Readonly<Record<ReferenceWebTokenPath, string>>;
  readonly cssProperties: ReferenceWebTokenCssProperties;
  readonly cssReferences: Readonly<Record<ReferenceWebTokenPath, ReferenceWebTokenCssReference>>;
  readonly resolve: (token: string) => ReferenceWebTokenResolution;
}

type EffectiveTokenType = "color" | "dimension";

interface ParsedToken {
  readonly type: EffectiveTokenType;
  readonly value: DtcgReferenceTokenValue;
}

function fail(path: string, message: string): never {
  throw new TypeError(`Invalid reference DTCG token document at ${path}: ${message}`);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sortedKeys(value: Readonly<Record<string, unknown>>): string[] {
  return Object.keys(value).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const actual = sortedKeys(value);
  const sortedExpected = [...expected].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function assertTokenName(name: string, path: string): void {
  if (name.length === 0 || name.startsWith("$") || /[.{}]/u.test(name)) {
    fail(path, `invalid DTCG token or group name ${JSON.stringify(name)}`);
  }
}

function assertDescription(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== "string") {
    fail(path, "$description must be a string");
  }
}

function isAlias(value: unknown): value is DtcgReferenceAlias {
  return typeof value === "string" && /^\{[^.{}]+(?:\.[^.{}]+)+\}$/u.test(value);
}

function assertColorValue(value: unknown, path: string): asserts value is DtcgReferenceColorValue {
  if (!isRecord(value) || !exactKeys(value, ["alpha", "colorSpace", "components", "hex"])) {
    fail(path, "color values must contain exactly colorSpace, components, alpha, and hex");
  }
  if (value.colorSpace !== "srgb") fail(path, "only the srgb color space is supported");
  if (
    !Array.isArray(value.components) ||
    value.components.length !== 3 ||
    value.components.some(
      (component) =>
        typeof component !== "number" ||
        !Number.isFinite(component) ||
        component < 0 ||
        component > 1,
    )
  ) {
    fail(path, "sRGB components must be three finite numbers between zero and one");
  }
  if (
    typeof value.alpha !== "number" ||
    !Number.isFinite(value.alpha) ||
    value.alpha < 0 ||
    value.alpha > 1
  ) {
    fail(path, "alpha must be a finite number between zero and one");
  }
  if (typeof value.hex !== "string" || !/^#[0-9a-f]{6}$/u.test(value.hex)) {
    fail(path, "hex must be lowercase six-digit CSS notation");
  }

  const expectedHex = `#${value.components
    .map((component) =>
      Math.round(component * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
  if (value.hex !== expectedHex) fail(path, "hex must describe the supplied sRGB components");
}

function assertDimensionValue(
  value: unknown,
  path: string,
): asserts value is DtcgReferenceDimensionValue {
  if (!isRecord(value) || !exactKeys(value, ["unit", "value"])) {
    fail(path, "dimension values must contain exactly value and unit");
  }
  if (typeof value.value !== "number" || !Number.isFinite(value.value)) {
    fail(path, "dimension value must be finite");
  }
  if (value.unit !== "px" && value.unit !== "rem") {
    fail(path, "dimension unit must be px or rem");
  }
}

function collectTokens(
  node: unknown,
  path: readonly string[],
  inheritedType: EffectiveTokenType | undefined,
  output: Map<string, ParsedToken>,
): void {
  const pointer = path.length === 0 ? "/" : path.join(".");
  if (!isRecord(node)) fail(pointer, "groups and tokens must be objects");
  assertDescription(node.$description, pointer);

  if (Object.hasOwn(node, "$value")) {
    const allowedKeys = ["$description", "$type", "$value"].filter((key) =>
      Object.hasOwn(node, key),
    );
    if (!exactKeys(node, allowedKeys)) fail(pointer, "tokens cannot contain child groups");

    const ownType = node.$type;
    if (ownType !== undefined && ownType !== "color" && ownType !== "dimension") {
      fail(pointer, "$type must be color or dimension");
    }
    const effectiveType = (ownType ?? inheritedType) as EffectiveTokenType | undefined;
    if (effectiveType === undefined) fail(pointer, "token type cannot be inferred");

    const tokenValue = node.$value;
    if (!isAlias(tokenValue)) {
      if (effectiveType === "color") assertColorValue(tokenValue, `${pointer}.$value`);
      else assertDimensionValue(tokenValue, `${pointer}.$value`);
    }

    output.set(pointer, Object.freeze({ type: effectiveType, value: tokenValue }));
    return;
  }

  const ownType = node.$type;
  if (ownType !== undefined && ownType !== "color" && ownType !== "dimension") {
    fail(pointer, "$type must be color or dimension");
  }
  const effectiveType = (ownType ?? inheritedType) as EffectiveTokenType | undefined;
  const childKeys = sortedKeys(node).filter((key) => !key.startsWith("$"));
  if (childKeys.length === 0) fail(pointer, "empty groups are not part of the reference subset");

  for (const key of sortedKeys(node).filter((candidate) => candidate.startsWith("$"))) {
    if (key !== "$description" && key !== "$type") fail(pointer, `unsupported group member ${key}`);
  }
  for (const key of childKeys) {
    assertTokenName(key, pointer);
    collectTokens(node[key], [...path, key], effectiveType, output);
  }
}

function resolveParsedToken(
  path: string,
  tokens: ReadonlyMap<string, ParsedToken>,
  active: Set<string>,
): Readonly<{
  readonly type: EffectiveTokenType;
  readonly value: Exclude<DtcgReferenceTokenValue, DtcgReferenceAlias>;
}> {
  const token = tokens.get(path);
  if (token === undefined) fail(path, "alias target does not exist");
  if (active.has(path)) fail(path, "alias cycle detected");

  if (!isAlias(token.value)) {
    return Object.freeze({ type: token.type, value: token.value });
  }

  active.add(path);
  const targetPath = token.value.slice(1, -1);
  const resolved = resolveParsedToken(targetPath, tokens, active);
  active.delete(path);
  if (resolved.type !== token.type) fail(path, "alias target has a different effective type");
  return resolved;
}

function toCssValue(
  resolved: Readonly<{
    readonly type: EffectiveTokenType;
    readonly value: Exclude<DtcgReferenceTokenValue, DtcgReferenceAlias>;
  }>,
): string {
  if (resolved.type === "dimension") {
    const dimension = resolved.value as DtcgReferenceDimensionValue;
    return `${dimension.value}${dimension.unit}`;
  }

  const color = resolved.value as DtcgReferenceColorValue;
  if (color.alpha === 1) return color.hex;
  return `color(srgb ${color.components.join(" ")} / ${color.alpha})`;
}

function createProvider(): ReferenceWebTokenProvider {
  const tokens = new Map<string, ParsedToken>();
  collectTokens(REFERENCE_TOKEN_DOCUMENT, [], undefined, tokens);

  const tokenPaths = Object.keys(TOKEN_TO_CSS_PROPERTY).sort() as ReferenceWebTokenPath[];
  const documentPaths = [...tokens.keys()].sort();
  if (
    tokenPaths.length !== documentPaths.length ||
    tokenPaths.some((path, index) => path !== documentPaths[index])
  ) {
    fail("/", "the DTCG leaf inventory and Web CSS mapping must match exactly");
  }

  const values = Object.create(null) as Record<ReferenceWebTokenPath, string>;
  // React DOM's style boundary calls `hasOwnProperty`; this host-facing map therefore needs the
  // ordinary Object prototype even though the two internal lookup maps remain null-prototype.
  const cssProperties = {} as ReferenceWebTokenCssProperties;
  const cssReferences = Object.create(null) as Record<
    ReferenceWebTokenPath,
    ReferenceWebTokenCssReference
  >;
  const successes = new Map<ReferenceWebTokenPath, ReferenceWebTokenResolutionSuccess>();

  for (const tokenPath of tokenPaths) {
    const cssProperty = TOKEN_TO_CSS_PROPERTY[tokenPath];
    const value = toCssValue(resolveParsedToken(tokenPath, tokens, new Set()));
    const cssReference = `var(${cssProperty}, ${value})` as ReferenceWebTokenCssReference;
    values[tokenPath] = value;
    (cssProperties as Record<ReferenceWebTokenCssProperty, string>)[cssProperty] = value;
    cssReferences[tokenPath] = cssReference;
    successes.set(
      tokenPath,
      Object.freeze({
        ok: true,
        token: tokenPath,
        value,
        cssProperty,
        cssReference,
      }),
    );
  }

  Object.freeze(values);
  Object.freeze(cssProperties);
  Object.freeze(cssReferences);
  Object.freeze(tokenPaths);

  return Object.freeze({
    tokenPaths,
    values,
    cssProperties,
    cssReferences,
    resolve: (token: string): ReferenceWebTokenResolution => {
      if (typeof token !== "string") {
        throw new TypeError("Reference Web token names must be strings");
      }
      const success = successes.get(token as ReferenceWebTokenPath);
      return (
        success ??
        Object.freeze({
          ok: false,
          code: "UNKNOWN_TOKEN",
          token,
        })
      );
    },
  });
}

/**
 * Immutable target-specific provider derived from {@link REFERENCE_TOKEN_DOCUMENT}.
 *
 * @remarks The provider covers the exact 26 CSS custom properties consumed by the current
 * reference components. It has no DOM wrapper, global stylesheet side effect, external lookup, or
 * generic runtime fallback behavior.
 */
export const REFERENCE_WEB_TOKEN_PROVIDER = createProvider();

/** Frozen token-path to resolved Web value map derived from the reference DTCG document. */
export const REFERENCE_WEB_TOKEN_VALUES = REFERENCE_WEB_TOKEN_PROVIDER.values;

/** Frozen CSS custom-property map suitable for an existing host root's `style` property. */
export const REFERENCE_WEB_TOKEN_CSS_PROPERTIES = REFERENCE_WEB_TOKEN_PROVIDER.cssProperties;

/**
 * Frozen token-path to CSS `var()` reference map used by Web capability implementations.
 *
 * @remarks Every reference includes the DTCG-derived value as a fallback so an individual
 * component keeps its deterministic appearance when rendered outside a provider root.
 */
export const REFERENCE_WEB_TOKEN_CSS_REFERENCES = REFERENCE_WEB_TOKEN_PROVIDER.cssReferences;

/**
 * Resolves one known reference Web token or returns an explicit `UNKNOWN_TOKEN` failure.
 *
 * @remarks This target-specific lookup does not implement the generic DESEN `$token` resolution
 * and receiving-schema validation assigned to the framework-neutral runtime.
 *
 * @throws TypeError when a JavaScript caller supplies a non-string token name.
 */
export function resolveReferenceWebToken(token: string): ReferenceWebTokenResolution {
  return REFERENCE_WEB_TOKEN_PROVIDER.resolve(token);
}
