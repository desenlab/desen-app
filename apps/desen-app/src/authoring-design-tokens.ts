/* eslint-disable @typescript-eslint/no-invalid-void-type -- Runtime token callbacks deliberately
 * have receiver-independent `this: void` signatures. */
import { resolveDesignTokens } from "@desen/design-system-core";
import { canonicalizeJson } from "@desen/protocol";

import type { EditableProjectRecord, ResolvedDesignToken } from "@desen/design-system-core";
import type { JsonValue } from "@desen/catalog-sdk";
import type { RuntimeTokenResolution } from "@desen/runtime-core";
import type { AuthoringResolvedStyleToken, AuthoringStyleTokenType } from "./authoring-styles.js";

/**
 * The finite design-token value families whose literal values can be used by the T12 visual
 * style controls. Motion-only DTCG values deliberately remain unavailable here: no generic CSS
 * property or implicit serialization is introduced by the App.
 */
const AUTHORING_STYLE_TOKEN_TYPES = Object.freeze([
  "border",
  "color",
  "dimension",
  "number",
  "shadow",
  "typography",
] as const satisfies readonly AuthoringStyleTokenType[]);

/** An immutable token projection derived only from an admitted T02 project envelope. */
export interface AuthoringDesignTokenResolution {
  readonly status: "resolved";
  /** Explicit typed choices for the authoring Style panel. */
  readonly styleTokens: readonly AuthoringResolvedStyleToken[];
  /** A runtime-compatible lookup over exactly the same resolved values. */
  readonly resolveRuntimeToken: (this: void, token: string) => RuntimeTokenResolution;
}

/** A controlled failure with no partial token choices or runtime lookup authority. */
export interface AuthoringDesignTokenResolutionFailure {
  readonly status: "rejected";
}

/** Result of resolving the persisted project's ordered DTCG source selection. */
export type AuthoringDesignTokenResolutionResult =
  AuthoringDesignTokenResolution | AuthoringDesignTokenResolutionFailure;

function isAuthoringStyleTokenType(value: unknown): value is AuthoringStyleTokenType {
  return (
    typeof value === "string" && (AUTHORING_STYLE_TOKEN_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Captures one resolved DTCG literal as ordinary immutable JSON before it crosses into the
 * Catalog or Runtime boundary. This preserves structured DTCG values (including `rem` dimensions
 * and sRGB colors) instead of degrading them to an arbitrary CSS string.
 */
function captureJsonLiteral(value: unknown): JsonValue | undefined {
  try {
    return freezeJsonValue(JSON.parse(canonicalizeJson(value)) as JsonValue);
  } catch {
    return undefined;
  }
}

/** Deep-freezes the canonical clone shared by the Style panel and Runtime token port. */
function freezeJsonValue(value: JsonValue): JsonValue {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    for (const child of value) freezeJsonValue(child);
  } else {
    for (const key of Object.keys(value)) {
      freezeJsonValue((value as Readonly<Record<string, JsonValue>>)[key] as JsonValue);
    }
  }
  return Object.freeze(value);
}

function projectToken(token: ResolvedDesignToken): AuthoringResolvedStyleToken | undefined {
  if (!isAuthoringStyleTokenType(token.type)) return undefined;
  const resolvedValue = captureJsonLiteral(token.value);
  return resolvedValue === undefined
    ? undefined
    : Object.freeze({ path: token.path, type: token.type, resolvedValue });
}

/**
 * Resolves authoring tokens from the exact persisted editable-project envelope.
 *
 * @remarks This module intentionally receives a T02 project record rather than a profile default,
 * CSS custom-property map, or Source extension. The Style UI and Runtime token port therefore
 * observe one ordered `designSystem.tokenSources` selection, including alias and mode overlays.
 */
export function resolveAuthoringDesignTokens(
  project: EditableProjectRecord,
): AuthoringDesignTokenResolutionResult {
  try {
    const resolved = resolveDesignTokens({ sources: project.designSystem.tokenSources });
    if (!resolved.ok) return Object.freeze({ status: "rejected" });

    const styleTokens: AuthoringResolvedStyleToken[] = [];
    const runtimeValues = new Map<string, JsonValue>();
    for (const path of resolved.tokenPaths) {
      const token = resolved.tokens[path];
      if (token === undefined) return Object.freeze({ status: "rejected" });
      const projected = projectToken(token);
      if (projected === undefined) continue;
      styleTokens.push(projected);
      runtimeValues.set(projected.path, projected.resolvedValue);
    }
    const frozenTokens = Object.freeze(styleTokens);
    return Object.freeze({
      status: "resolved" as const,
      styleTokens: frozenTokens,
      resolveRuntimeToken: (token: string): RuntimeTokenResolution => {
        if (typeof token !== "string" || token.length === 0)
          return Object.freeze({ status: "missing" });
        const value = runtimeValues.get(token);
        return value === undefined
          ? Object.freeze({ status: "missing" })
          : Object.freeze({ status: "resolved", value });
      },
    });
  } catch {
    return Object.freeze({ status: "rejected" });
  }
}
