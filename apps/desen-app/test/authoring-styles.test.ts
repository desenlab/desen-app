import { createCatalogManifest, registerComponent } from "@desen/catalog-sdk";
import { createDesenEditorDocument } from "@desen/editor-core";
import { canonicalizeJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import { prepareCatalogAuthoringModel } from "../src/authoring-data.js";
import {
  applyAuthoringStyleEdit,
  prepareAuthoringStyleModel,
  prepareAuthoringStylePreviewDocument,
} from "../src/authoring-styles.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { CatalogAuthoringModel } from "../src/authoring-data.js";
import type {
  AuthoringResolvedStyleToken,
  AuthoringStyleEdit,
  AuthoringStyleEditResult,
  AuthoringStyleModelResult,
  AuthoringStyleReadyModel,
  AuthoringStyleRoute,
} from "../src/authoring-styles.js";
import type { AuthoringComponentSelection } from "../src/authoring-selection.js";

const CATALOG_ID = "run.desen.test.authoring-styles";
const COMPONENT_ID = "com.example.test/StyleFixture";
const ROUTE = Object.freeze({
  projectId: "style-fixture",
  surfaceId: "fixture",
}) satisfies AuthoringStyleRoute;

const RESOLVED_TOKENS: readonly AuthoringResolvedStyleToken[] = Object.freeze([
  Object.freeze({ path: "brand.primary", type: "color", resolvedValue: "#123456" }),
  Object.freeze({ path: "layout.compact", type: "dimension", resolvedValue: 24 }),
]);

type EditorNode = DesenEditorDocument["surfaces"][string]["root"];
type MutableRecord = Record<string, unknown>;

function requireEditorDocument(value: unknown): DesenEditorDocument {
  const created = createDesenEditorDocument(value);
  expect(created.ok).toBe(true);
  if (!created.ok)
    throw new Error("Expected the style fixture Source to be structurally admissible.");
  return created.document;
}

function requireModel(catalog: unknown, document: DesenEditorDocument): CatalogAuthoringModel {
  const prepared = prepareCatalogAuthoringModel(catalog, document);
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) throw new Error(`Expected a style model, received ${prepared.reason}.`);
  return prepared.model;
}

function requireStyleModel(result: AuthoringStyleModelResult): AuthoringStyleReadyModel {
  expect(result.status).toBe("ready");
  if (result.status !== "ready")
    throw new Error(`Expected ready style model, received ${result.status}.`);
  return result;
}

function requireEdit(result: AuthoringStyleEditResult): DesenEditorDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected a style edit, received ${result.reason}.`);
  return result.document;
}

function findNode(document: DesenEditorDocument, nodeId = "fixture.root"): EditorNode {
  const root = document.surfaces.fixture?.root;
  if (root === undefined) throw new Error("Expected fixture surface.");
  const pending: EditorNode[] = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === nodeId) return node;
    for (const children of Object.values(node.slots ?? {})) pending.push(...children);
    for (const behavior of node.behaviors ?? []) {
      for (const children of Object.values(behavior.slots ?? {})) pending.push(...children);
    }
  }
  throw new Error(`Expected node ${nodeId}.`);
}

function selectionFor(model: CatalogAuthoringModel): AuthoringComponentSelection {
  return selectionForRoute(model, ROUTE);
}

function selectionForRoute(
  model: CatalogAuthoringModel,
  route: AuthoringStyleRoute,
): AuthoringComponentSelection {
  const node = model.surfaces.find(({ id }) => id === route.surfaceId)?.root;
  if (node === undefined) throw new Error("Expected style fixture layer root.");
  return createAuthoringComponentSelection({
    projectId: route.projectId,
    surfaceId: route.surfaceId,
    sourceNodeId: node.id,
    capabilityId: node.capabilityId,
    displayName: node.displayName,
    conditional: node.conditional,
  });
}

function createFixture(initialVariants: readonly unknown[] = [], initialRootStyle?: unknown) {
  const component = registerComponent({
    id: COMPONENT_ID,
    manifest: {
      authoring: { category: "Tests", displayName: "Style Fixture" },
      category: "layout",
      propsSchema: { type: "object", additionalProperties: false },
      styleParts: {
        root: {
          description: "Safe container style controls.",
          propertiesSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            $defs: {
              color: {
                anyOf: [
                  { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
                  { type: "string", pattern: "^#[0-9A-Fa-f]{8}$" },
                ],
                description: "Resolved foreground color.",
              },
              opacity: { type: "number", minimum: 0, maximum: 1 },
              width: { type: "number", minimum: 0, maximum: 1_024 },
            },
            type: "object",
            additionalProperties: false,
            properties: {
              color: { $ref: "#/$defs/color" },
              opacity: { $ref: "#/$defs/opacity" },
              width: { $ref: "#/$defs/width" },
            },
          },
        },
        open: {
          description: "Intentionally open schema; it has no directly addressable controls.",
          propertiesSchema: { type: "object", additionalProperties: true },
        },
      },
      visualStates: ["hover", "focus"],
    },
  });
  const catalog = createCatalogManifest({
    components: [component],
    id: CATALOG_ID,
    packageDigest: `sha256:${"1".repeat(64)}`,
    target: "web-react",
    version: "1.0.0",
  });
  const source = {
    catalogs: [{ id: CATALOG_ID, target: "web-react", version: "1.0.0" }],
    desen: "0.1.0",
    entry: "fixture",
    id: "com.example.style-fixture",
    kind: "desen.source",
    surfaces: {
      fixture: {
        id: "fixture",
        resources: {},
        root: {
          id: "fixture.root",
          use: COMPONENT_ID,
          ...(initialRootStyle === undefined ? {} : { style: initialRootStyle }),
          ...(initialVariants.length === 0 ? {} : { variants: initialVariants }),
        },
        state: {},
      },
    },
  };
  const document = requireEditorDocument(source);
  const model = requireModel(catalog, document);
  return Object.freeze({ catalog, document, model, selection: selectionFor(model) });
}

function apply(
  fixture: ReturnType<typeof createFixture>,
  document: DesenEditorDocument,
  edit: AuthoringStyleEdit,
  tokens = RESOLVED_TOKENS,
): AuthoringStyleEditResult {
  return applyAuthoringStyleEdit(document, fixture.catalog, ROUTE, fixture.selection, tokens, edit);
}

function mutableRecord(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected object.");
  }
  return value as MutableRecord;
}

describe("Desen App Catalog-authorized style authoring", () => {
  it("rejects a known starter adapter-unprojectable DTCG literal without changing Source", () => {
    const component = registerComponent({
      id: "run.desen.starter/Stack",
      manifest: {
        authoring: { category: "Tests", displayName: "Starter Stack fixture" },
        category: "layout",
        propsSchema: { type: "object", additionalProperties: false },
        styleParts: {
          root: {
            propertiesSchema: {
              type: "object",
              additionalProperties: false,
              $defs: {
                radius: {
                  anyOf: [
                    { type: "number", minimum: 0, maximum: 128 },
                    {
                      type: "object",
                      additionalProperties: false,
                      required: ["value", "unit"],
                      properties: {
                        value: { type: "number", minimum: 0, maximum: 256 },
                        unit: { type: "string", enum: ["rem"] },
                      },
                    },
                  ],
                },
              },
              properties: { borderRadius: { $ref: "#/$defs/radius" } },
            },
          },
        },
      },
    });
    const catalog = createCatalogManifest({
      components: [component],
      id: CATALOG_ID,
      packageDigest: `sha256:${"2".repeat(64)}`,
      target: "web-react",
      version: "1.0.0",
    });
    const document = requireEditorDocument({
      catalogs: [{ id: CATALOG_ID, target: "web-react", version: "1.0.0" }],
      desen: "0.1.0",
      entry: "fixture",
      id: "com.example.starter-style-preflight",
      kind: "desen.source",
      surfaces: {
        fixture: {
          id: "fixture",
          resources: {},
          root: { id: "fixture.root", use: component.id },
          state: {},
        },
      },
    });
    const model = requireModel(catalog, document);
    const selection = selectionFor(model);
    const before = canonicalizeJson(document);

    const result = applyAuthoringStyleEdit(document, catalog, ROUTE, selection, [], {
      kind: "set-literal",
      target: { kind: "base" },
      part: "root",
      property: "borderRadius",
      value: { value: 9, unit: "rem" },
    });

    expect(result).toMatchObject({ ok: false, reason: "value-invalid" });
    expect(canonicalizeJson(document)).toBe(before);

    const tokenResult = applyAuthoringStyleEdit(
      document,
      catalog,
      ROUTE,
      selection,
      [
        Object.freeze({
          path: "radius.unsafe",
          type: "dimension" as const,
          resolvedValue: Object.freeze({ value: 9, unit: "rem" }),
        }),
      ],
      {
        kind: "set-token",
        target: { kind: "base" },
        part: "root",
        property: "borderRadius",
        token: "radius.unsafe",
      },
    );
    expect(tokenResult).toMatchObject({ ok: false, reason: "value-invalid" });
    expect(canonicalizeJson(document)).toBe(before);
  });

  it("retains exact declared parts, detached schemas, visual states, and only closed controls", () => {
    const fixture = createFixture();
    const component = fixture.model.components[0];
    expect(component?.styleParts.map(({ name }) => name)).toEqual(["open", "root"]);
    expect(component?.visualStates).toEqual(["hover", "focus"]);
    expect(Object.isFrozen(component?.styleParts)).toBe(true);
    expect(Object.isFrozen(component?.styleParts[1]?.propertiesSchema)).toBe(true);

    const styles = requireStyleModel(
      prepareAuthoringStyleModel(fixture.model, ROUTE, fixture.selection, RESOLVED_TOKENS),
    );
    const root = styles.parts.find(({ name }) => name === "root");
    const open = styles.parts.find(({ name }) => name === "open");
    expect(root?.controls.map(({ property }) => property)).toEqual(["color", "opacity", "width"]);
    expect(
      root?.controls.map(({ kind, property, tokenTypes }) => ({ kind, property, tokenTypes })),
    ).toEqual([
      { kind: "structured-json", property: "color", tokenTypes: ["color"] },
      { kind: "number", property: "opacity", tokenTypes: ["number"] },
      { kind: "number", property: "width", tokenTypes: ["dimension"] },
    ]);
    expect(root?.controls.every(({ base }) => base.kind === "absent")).toBe(true);
    expect(open).toMatchObject({ controls: [], controlsAvailable: false });
    expect(styles.unmanagedResponsiveVariants).toEqual([]);
  });

  it("sets only declared literal leaves, continuously validates them, and resets the exact base leaf", () => {
    const fixture = createFixture();
    const originalFingerprint = canonicalizeJson(fixture.document);
    const changed = requireEdit(
      apply(fixture, fixture.document, {
        kind: "set-literal",
        target: { kind: "base" },
        part: "root",
        property: "color",
        value: "#abcdef",
      }),
    );
    expect(findNode(changed).style?.base?.root?.color).toBe("#abcdef");
    expect(canonicalizeJson(fixture.document)).toBe(originalFingerprint);

    const invalid = apply(fixture, fixture.document, {
      kind: "set-literal",
      target: { kind: "base" },
      part: "root",
      property: "color",
      value: "red",
    });
    expect(invalid).toMatchObject({ ok: false, reason: "value-invalid" });
    expect(canonicalizeJson(fixture.document)).toBe(originalFingerprint);

    const undeclared = apply(fixture, fixture.document, {
      kind: "set-literal",
      target: { kind: "base" },
      part: "root",
      property: "arbitraryCss",
      value: "position: fixed",
    });
    expect(undeclared).toMatchObject({ ok: false, reason: "control-unavailable" });

    const reset = requireEdit(
      apply(fixture, changed, {
        kind: "reset",
        target: { kind: "base" },
        part: "root",
        property: "color",
      }),
    );
    expect(findNode(reset).style?.base?.root?.color).toBeUndefined();
  });

  it("authors only declared visual-state leaves and rejects unknown states", () => {
    const fixture = createFixture([], { hover: { root: { color: "#111111" } } });
    const model = requireStyleModel(
      prepareAuthoringStyleModel(fixture.model, ROUTE, fixture.selection, RESOLVED_TOKENS),
    );
    const color = model.parts
      .find(({ name }) => name === "root")
      ?.controls.find(({ property }) => property === "color");
    expect(color?.visualStates?.map(({ state }) => state)).toEqual(["hover", "focus"]);
    expect(color?.visualStates?.[0]?.value).toMatchObject({ kind: "literal", value: "#111111" });

    const changed = requireEdit(
      apply(fixture, fixture.document, {
        kind: "set-literal",
        target: { kind: "visual-state", state: "hover" },
        part: "root",
        property: "color",
        value: "#abcdef",
      }),
    );
    expect(findNode(changed).style?.hover?.root?.color).toBe("#abcdef");
    expect(
      apply(fixture, fixture.document, {
        kind: "set-literal",
        target: { kind: "visual-state", state: "not-declared" },
        part: "root",
        property: "color",
        value: "#abcdef",
      }),
    ).toMatchObject({ ok: false, reason: "control-unavailable" });
    const preview = prepareAuthoringStylePreviewDocument(
      fixture.document,
      ROUTE,
      fixture.selection,
      { kind: "visual-state", state: "hover" },
    );
    expect(preview).not.toBe(fixture.document);
    expect(findNode(preview).style?.base?.root?.color).toBe("#111111");
    expect(findNode(fixture.document).style?.base).toBeUndefined();
  });

  it("edits a named variant style without permitting an unmarked protocol variant", () => {
    const fixture = createFixture([
      {
        when: { op: "lte", args: [{ $ref: "env.viewport.width" }, 1024] },
        style: { base: { root: { color: "#111111" } } },
        extensions: {
          "run.desen.app/t16-variant": {
            version: 1,
            name: "Compact",
            axis: { name: "mode", value: "compact", reference: "env.viewport.width" },
          },
        },
      },
      {
        when: { op: "eq", args: [true, true] },
        style: { base: { root: { color: "#222222" } } },
      },
    ]);
    const changed = requireEdit(
      apply(fixture, fixture.document, {
        kind: "set-literal",
        target: { kind: "variant", index: 0 },
        part: "root",
        property: "color",
        value: "#abcdef",
      }),
    );
    expect(findNode(changed).variants?.[0]?.style?.base?.root?.color).toBe("#abcdef");
    expect(
      apply(fixture, fixture.document, {
        kind: "set-literal",
        target: { kind: "variant", index: 1 },
        part: "root",
        property: "color",
        value: "#abcdef",
      }),
    ).toMatchObject({ ok: false, reason: "edit-rejected" });
  });

  it("accepts only explicit compatible resolved tokens and stores only their token reference", () => {
    const fixture = createFixture();
    const changed = requireEdit(
      apply(fixture, fixture.document, {
        kind: "set-token",
        target: { kind: "base" },
        part: "root",
        property: "color",
        token: "brand.primary",
      }),
    );
    expect(findNode(changed).style?.base?.root?.color).toEqual({ $token: "brand.primary" });

    expect(
      apply(fixture, fixture.document, {
        kind: "set-token",
        target: { kind: "base" },
        part: "root",
        property: "color",
        token: "missing.token",
      }),
    ).toMatchObject({ ok: false, reason: "token-unknown" });
    expect(
      apply(fixture, fixture.document, {
        kind: "set-token",
        target: { kind: "base" },
        part: "root",
        property: "color",
        token: "layout.compact",
      }),
    ).toMatchObject({ ok: false, reason: "token-incompatible" });

    const invalidResolvedToken: readonly AuthoringResolvedStyleToken[] = Object.freeze([
      Object.freeze({ path: "bad.color", type: "color", resolvedValue: "not-a-color" }),
    ]);
    expect(
      apply(
        fixture,
        fixture.document,
        {
          kind: "set-token",
          target: { kind: "base" },
          part: "root",
          property: "color",
          token: "bad.color",
        },
        invalidResolvedToken,
      ),
    ).toMatchObject({ ok: false, reason: "value-invalid" });
  });

  it("creates, edits, and deletes only exact responsive node overrides without reordering existing variants", () => {
    const genericVariant = Object.freeze({
      when: { op: "lte", args: [{ $ref: "env.viewport.width" }, 600] },
      style: { base: { root: { opacity: 0.5 } } },
    });
    const fixture = createFixture([genericVariant]);
    const mobile = requireEdit(
      apply(fixture, fixture.document, {
        kind: "set-literal",
        target: { kind: "breakpoint", breakpoint: "mobile" },
        part: "root",
        property: "width",
        value: 320,
      }),
    );
    const tablet = requireEdit(
      apply(fixture, mobile, {
        kind: "set-literal",
        target: { kind: "breakpoint", breakpoint: "tablet" },
        part: "root",
        property: "width",
        value: 768,
      }),
    );
    const variants = findNode(tablet).variants;
    expect(variants).toHaveLength(3);
    expect(variants?.[0]).toEqual(genericVariant);
    expect(
      mutableRecord(mutableRecord(variants?.[1]).extensions)["run.desen.app/t12-responsive"],
    ).toEqual({ breakpoint: "tablet", version: 1 });
    expect(
      mutableRecord(mutableRecord(variants?.[2]).extensions)["run.desen.app/t12-responsive"],
    ).toEqual({ breakpoint: "mobile", version: 1 });
    expect(variants?.[1]?.when).toEqual({
      op: "lte",
      args: [{ $ref: "env.viewport.width" }, 1_024],
    });
    expect(variants?.[2]?.when).toEqual({
      op: "lte",
      args: [{ $ref: "env.viewport.width" }, 767],
    });

    const updatedMobile = requireEdit(
      apply(fixture, tablet, {
        kind: "set-literal",
        target: { kind: "breakpoint", breakpoint: "mobile" },
        part: "root",
        property: "width",
        value: 375,
      }),
    );
    expect(findNode(updatedMobile).variants?.[2]?.style?.base?.root?.width).toBe(375);
    const resetMobile = requireEdit(
      apply(fixture, updatedMobile, {
        kind: "reset",
        target: { kind: "breakpoint", breakpoint: "mobile" },
        part: "root",
        property: "width",
      }),
    );
    expect(findNode(resetMobile).variants).toHaveLength(2);
    expect(findNode(resetMobile).variants?.[0]).toEqual(genericVariant);
    expect(findNode(resetMobile).variants?.[1]?.style?.base?.root?.width).toBe(768);
  });

  it("fails closed when existing owned responsive variants cascade from mobile into tablet", () => {
    const fixture = createFixture([
      {
        when: { op: "lte", args: [{ $ref: "env.viewport.width" }, 767] },
        style: { base: { root: { width: 320 } } },
        extensions: {
          "run.desen.app/t12-responsive": { breakpoint: "mobile", version: 1 },
        },
      },
      {
        when: { op: "lte", args: [{ $ref: "env.viewport.width" }, 1_024] },
        style: { base: { root: { width: 768 } } },
        extensions: {
          "run.desen.app/t12-responsive": { breakpoint: "tablet", version: 1 },
        },
      },
    ]);
    const before = canonicalizeJson(fixture.document);
    const styles = requireStyleModel(
      prepareAuthoringStyleModel(fixture.model, ROUTE, fixture.selection, RESOLVED_TOKENS),
    );
    const width = styles.parts
      .find(({ name }) => name === "root")
      ?.controls.find(({ property }) => property === "width");
    expect(
      width?.responsive.map(({ breakpoint, variantIndex }) => ({
        breakpoint: breakpoint.id,
        variantIndex,
      })),
    ).toEqual([
      { breakpoint: "tablet", variantIndex: 1 },
      { breakpoint: "mobile", variantIndex: 0 },
    ]);

    for (const breakpoint of ["tablet", "mobile"] as const) {
      expect(
        apply(fixture, fixture.document, {
          kind: "set-literal",
          target: { kind: "breakpoint", breakpoint },
          part: "root",
          property: "width",
          value: breakpoint === "tablet" ? 800 : 375,
        }),
      ).toMatchObject({ ok: false, reason: "responsive-variant-invalid" });
    }
    expect(canonicalizeJson(fixture.document)).toBe(before);
  });

  it("refuses to guess through a malformed app-owned breakpoint marker", () => {
    const fixture = createFixture([
      {
        when: { op: "lte", args: [{ $ref: "env.viewport.width" }, 767] },
        style: { base: { root: { width: 320 } } },
        extensions: {
          "run.desen.app/t12-responsive": { breakpoint: "mobile", version: 99 },
        },
      },
    ]);
    expect(
      apply(fixture, fixture.document, {
        kind: "set-literal",
        target: { kind: "breakpoint", breakpoint: "mobile" },
        part: "root",
        property: "width",
        value: 375,
      }),
    ).toMatchObject({ ok: false, reason: "responsive-variant-invalid" });
  });

  it("keeps dynamic base and responsive leaves read-only for literal and token edits", () => {
    const dynamic = Object.freeze({ $ref: "env.viewport.width" });
    const baseFixture = createFixture([], { base: { root: { color: dynamic } } });
    const baseBefore = canonicalizeJson(baseFixture.document);
    for (const edit of [
      {
        kind: "set-literal" as const,
        target: { kind: "base" as const },
        part: "root",
        property: "color",
        value: "#abcdef",
      },
      {
        kind: "set-token" as const,
        target: { kind: "base" as const },
        part: "root",
        property: "color",
        token: "brand.primary",
      },
    ]) {
      expect(apply(baseFixture, baseFixture.document, edit)).toMatchObject({
        ok: false,
        reason: "control-unavailable",
      });
      expect(canonicalizeJson(baseFixture.document)).toBe(baseBefore);
    }

    const responsiveFixture = createFixture([
      {
        when: { op: "lte", args: [{ $ref: "env.viewport.width" }, 767] },
        style: { base: { root: { color: dynamic } } },
        extensions: {
          "run.desen.app/t12-responsive": { breakpoint: "mobile", version: 1 },
        },
      },
    ]);
    const responsiveBefore = canonicalizeJson(responsiveFixture.document);
    for (const edit of [
      {
        kind: "set-literal" as const,
        target: { kind: "breakpoint" as const, breakpoint: "mobile" as const },
        part: "root",
        property: "color",
        value: "#abcdef",
      },
      {
        kind: "set-token" as const,
        target: { kind: "breakpoint" as const, breakpoint: "mobile" as const },
        part: "root",
        property: "color",
        token: "brand.primary",
      },
    ]) {
      expect(apply(responsiveFixture, responsiveFixture.document, edit)).toMatchObject({
        ok: false,
        reason: "control-unavailable",
      });
      expect(canonicalizeJson(responsiveFixture.document)).toBe(responsiveBefore);
    }
  });

  it("rejects raw dynamic literals and unsealed breakpoint targets before Editor Core mutation", () => {
    const fixture = createFixture();
    const before = canonicalizeJson(fixture.document);
    const dynamicLiteral = apply(fixture, fixture.document, {
      kind: "set-literal",
      target: { kind: "base" },
      part: "root",
      property: "color",
      value: { $ref: "env.viewport.width" },
    });
    expect(dynamicLiteral).toMatchObject({ ok: false, reason: "edit-rejected" });
    const unsealedTarget = apply(fixture, fixture.document, {
      kind: "set-literal",
      target: {
        kind: "breakpoint",
        breakpoint: "mobile",
        when: { op: "gt", args: [{ $ref: "env.viewport.width" }, 0] },
      } as unknown as { readonly kind: "base" },
      part: "root",
      property: "width",
      value: 1,
    });
    expect(unsealedTarget).toMatchObject({ ok: false, reason: "edit-rejected" });
    expect(canonicalizeJson(fixture.document)).toBe(before);
  });
});
