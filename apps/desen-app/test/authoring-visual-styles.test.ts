import { createCatalogManifest, registerComponent } from "@desen/catalog-sdk";
import { createDesenEditorDocument } from "@desen/editor-core";
import { describe, expect, it } from "vitest";

import { prepareCatalogAuthoringModel } from "../src/authoring-data.js";
import {
  applyAuthoringStyleEdit,
  prepareAuthoringStyleModel,
  prepareAuthoringStylePreviewDocument,
} from "../src/authoring-styles.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";

const CATALOG_ID = "run.desen.test.authoring-visual-styles";
const COMPONENT_ID = "com.example.test/VisualStyleFixture";
const ROUTE = Object.freeze({ projectId: "visual-style-fixture", surfaceId: "fixture" });
const TOKENS = Object.freeze([
  Object.freeze({ path: "brand.primary", type: "color" as const, resolvedValue: "#123456" }),
]);

function fixture(initialVariants: readonly unknown[] = [], style: unknown = undefined) {
  const component = registerComponent({
    id: COMPONENT_ID,
    manifest: {
      authoring: { category: "Tests", displayName: "Visual Style Fixture" },
      category: "layout",
      propsSchema: { type: "object", additionalProperties: false },
      styleParts: {
        root: {
          propertiesSchema: {
            type: "object",
            additionalProperties: false,
            properties: { color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" } },
          },
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
  const root: Record<string, unknown> = { id: "fixture.root", use: COMPONENT_ID };
  if (style !== undefined) root.style = style;
  if (initialVariants.length > 0) root.variants = initialVariants;
  const created = createDesenEditorDocument({
    catalogs: [{ id: CATALOG_ID, target: "web-react", version: "1.0.0" }],
    desen: "0.1.0",
    entry: "fixture",
    id: "com.example.visual-style-fixture",
    kind: "desen.source",
    surfaces: {
      fixture: { id: "fixture", resources: {}, root, state: {} },
    },
  });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error("Expected a valid visual style fixture.");
  const prepared = prepareCatalogAuthoringModel(catalog, created.document);
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) throw new Error("Expected Catalog authoring model.");
  const node = prepared.model.surfaces[0]?.root;
  if (node === undefined) throw new Error("Expected fixture root.");
  const selection = createAuthoringComponentSelection({
    projectId: ROUTE.projectId,
    surfaceId: ROUTE.surfaceId,
    sourceNodeId: node.id,
    capabilityId: node.capabilityId,
    displayName: node.displayName,
    conditional: node.conditional,
  });
  return Object.freeze({ catalog, document: created.document, model: prepared.model, selection });
}

function node(document: ReturnType<typeof fixture>["document"]) {
  const root = document.surfaces.fixture?.root;
  if (root === undefined) throw new Error("Expected fixture root.");
  return root;
}

describe("Desen App declared visual-state and named-variant styles", () => {
  it("authors only declared visual-state leaves and previews them without changing Source", () => {
    const input = fixture([], { hover: { root: { color: "#111111" } } });
    const model = prepareAuthoringStyleModel(input.model, ROUTE, input.selection, TOKENS);
    expect(model.status).toBe("ready");
    if (model.status !== "ready") return;
    const color = model.parts
      .find(({ name }) => name === "root")
      ?.controls.find(({ property }) => property === "color");
    expect(color?.visualStates?.map(({ state }) => state)).toEqual(["hover", "focus"]);
    expect(color?.visualStates?.[0]?.value).toMatchObject({ kind: "literal", value: "#111111" });

    const changed = applyAuthoringStyleEdit(
      input.document,
      input.catalog,
      ROUTE,
      input.selection,
      TOKENS,
      {
        kind: "set-literal",
        target: { kind: "visual-state", state: "hover" },
        part: "root",
        property: "color",
        value: "#abcdef",
      },
    );
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(node(changed.document).style?.hover?.root?.color).toBe("#abcdef");
    expect(
      applyAuthoringStyleEdit(input.document, input.catalog, ROUTE, input.selection, TOKENS, {
        kind: "set-literal",
        target: { kind: "visual-state", state: "not-declared" },
        part: "root",
        property: "color",
        value: "#abcdef",
      }),
    ).toMatchObject({ ok: false, reason: "control-unavailable" });

    const preview = prepareAuthoringStylePreviewDocument(input.document, ROUTE, input.selection, {
      kind: "visual-state",
      state: "hover",
    });
    expect(preview).not.toBe(input.document);
    expect(node(preview).style?.base?.root?.color).toBe("#111111");
    expect(node(input.document).style?.base).toBeUndefined();
  });

  it("edits a named variant style without permitting an unmarked protocol variant", () => {
    const input = fixture([
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
    const changed = applyAuthoringStyleEdit(
      input.document,
      input.catalog,
      ROUTE,
      input.selection,
      TOKENS,
      {
        kind: "set-literal",
        target: { kind: "variant", index: 0 },
        part: "root",
        property: "color",
        value: "#abcdef",
      },
    );
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(node(changed.document).variants?.[0]?.style?.base?.root?.color).toBe("#abcdef");
    expect(
      applyAuthoringStyleEdit(input.document, input.catalog, ROUTE, input.selection, TOKENS, {
        kind: "set-literal",
        target: { kind: "variant", index: 1 },
        part: "root",
        property: "color",
        value: "#abcdef",
      }),
    ).toMatchObject({ ok: false, reason: "edit-rejected" });
  });
});
