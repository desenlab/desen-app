import { createCatalogManifest, registerComponent } from "@desen/catalog-sdk";
import { createDesenEditorDocument } from "@desen/editor-core";
import { describe, expect, it } from "vitest";

import { prepareCatalogAuthoringModel } from "../src/authoring-data.js";
import {
  applyAuthoringVariantEdit,
  prepareAuthoringVariantModel,
} from "../src/authoring-variants.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";

const CATALOG_ID = "run.desen.test.authoring-variants";
const COMPONENT_ID = "com.example.test/VariantFixture";
const ROUTE = Object.freeze({ projectId: "variant-fixture", surfaceId: "fixture" });

function fixture() {
  const component = registerComponent({
    id: COMPONENT_ID,
    manifest: {
      authoring: { category: "Tests", displayName: "Variant Fixture" },
      category: "layout",
      propsSchema: { type: "object", additionalProperties: false },
      styleParts: {
        root: { propertiesSchema: { type: "object", additionalProperties: false, properties: {} } },
      },
      visualStates: ["hover", "disabled"],
    },
  });
  const catalog = createCatalogManifest({
    components: [component],
    id: CATALOG_ID,
    packageDigest: `sha256:${"3".repeat(64)}`,
    target: "web-react",
    version: "1.0.0",
  });
  const created = createDesenEditorDocument({
    catalogs: [{ id: CATALOG_ID, target: "web-react", version: "1.0.0" }],
    desen: "0.1.0",
    entry: "fixture",
    id: "com.example.variant-fixture",
    kind: "desen.source",
    surfaces: {
      fixture: {
        id: "fixture",
        resources: {},
        root: { id: "fixture.root", use: COMPONENT_ID },
        state: { mode: { initial: "compact", schema: { type: "string" } } },
      },
    },
  });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error("Expected a valid variant fixture.");
  const model = prepareCatalogAuthoringModel(catalog, created.document);
  expect(model.ok).toBe(true);
  if (!model.ok) throw new Error("Expected Catalog model.");
  const selection = createAuthoringComponentSelection({
    projectId: ROUTE.projectId,
    surfaceId: ROUTE.surfaceId,
    sourceNodeId: "fixture.root",
    capabilityId: COMPONENT_ID,
    displayName: "Variant Fixture",
    conditional: false,
  });
  return { catalog, document: created.document, model: model.model, selection };
}

describe("Desen App named component variants", () => {
  it("creates and projects a named state-axis variant as conditional Source", () => {
    const input = fixture();
    const result = applyAuthoringVariantEdit(
      input.document,
      input.catalog,
      ROUTE,
      input.selection,
      {
        kind: "create",
        name: "Compact",
        axisName: "mode",
        axisValue: "compact",
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const nextModel = prepareCatalogAuthoringModel(input.catalog, result.document);
    expect(nextModel.ok).toBe(true);
    if (!nextModel.ok) return;
    const projected = prepareAuthoringVariantModel(nextModel.model, ROUTE, input.selection);
    expect(projected.status).toBe("ready");
    if (projected.status !== "ready") return;
    expect(projected.variants).toHaveLength(1);
    expect(projected.variants[0]?.name).toBe("Compact");
    expect(result.document.surfaces.fixture?.root.slots).toBeUndefined();
  });

  it("rejects undeclared axes and preserves the original Source", () => {
    const input = fixture();
    const result = applyAuthoringVariantEdit(
      input.document,
      input.catalog,
      ROUTE,
      input.selection,
      {
        kind: "create",
        name: "Unsafe",
        axisName: "notDeclared",
        axisValue: "x",
      },
    );
    expect(result).toEqual({ ok: false, reason: "state-invalid" });
    expect(input.document.surfaces.fixture?.root.variants).toBeUndefined();
  });

  it("renames and deletes only the app-owned variant without touching children", () => {
    const input = fixture();
    const created = applyAuthoringVariantEdit(
      input.document,
      input.catalog,
      ROUTE,
      input.selection,
      {
        kind: "create",
        name: "Compact",
        axisName: "mode",
        axisValue: "compact",
      },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const renamed = applyAuthoringVariantEdit(
      created.document,
      input.catalog,
      ROUTE,
      input.selection,
      {
        kind: "rename",
        index: 0,
        name: "Dense",
      },
    );
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    const deleted = applyAuthoringVariantEdit(
      renamed.document,
      input.catalog,
      ROUTE,
      input.selection,
      {
        kind: "delete",
        index: 0,
      },
    );
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.document.surfaces.fixture?.root.variants).toEqual([]);
  });
});
