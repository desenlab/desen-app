import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { describe, expect, it } from "vitest";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import { prepareCatalogAuthoringModel, REFERENCE_AUTHORING_MODEL } from "../src/authoring-data.js";

function copyJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function requirePrepared(
  result: ReturnType<typeof prepareCatalogAuthoringModel>,
): typeof REFERENCE_AUTHORING_MODEL {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected an authoring model, received ${result.reason}.`);
  return result.model;
}

describe("Desen App catalog authoring read model", () => {
  it("projects the exact Catalog library and official Source surface trees", () => {
    const model = REFERENCE_AUTHORING_MODEL;

    expect(model.catalog).toEqual({
      id: "run.desen.reference.sign-in",
      target: "web-react",
      version: "0.1.0",
    });
    expect(model.components.map((component) => component.id)).toEqual([
      "com.example.ui/Alert",
      "com.example.ui/Button",
      "com.example.ui/Stack",
      "com.example.ui/Text",
      "com.example.ui/TextField",
    ]);
    expect(model.components.map((component) => component.displayName)).toEqual([
      "Alert",
      "Button",
      "Stack",
      "Text",
      "Text field",
    ]);
    expect(model.surfaces.map((surface) => surface.id)).toEqual(["home", "sign-in"]);

    const signIn = model.surfaces.find((surface) => surface.id === "sign-in");
    expect(signIn?.root.id).toBe("sign-in.layout");
    expect(signIn?.root.displayName).toBe("Stack");
    expect(signIn?.root.slots.map((slot) => slot.name)).toEqual(["default"]);
    expect(signIn?.root.slots[0]?.children.map((child) => child.id)).toEqual([
      "sign-in.title",
      "sign-in.email",
      "sign-in.password",
      "sign-in.error",
      "sign-in.submit",
    ]);
    expect(
      signIn?.root.slots[0]?.children.find((child) => child.id === "sign-in.error")?.conditional,
    ).toBe(true);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(signIn?.root.slots[0]?.children)).toBe(true);
  });

  it("fails closed before projecting malformed Catalog or unresolved Source data", () => {
    const invalidCatalog = { ...copyJson(referenceCatalog), kind: "not-a-catalog" };
    expect(prepareCatalogAuthoringModel(invalidCatalog, officialSignInSource)).toEqual({
      ok: false,
      reason: "catalog-invalid",
    });

    const invalidSource = copyJson(officialSignInSource);
    invalidSource.surfaces["sign-in"].root.use = "com.example.ui/Unknown";
    expect(prepareCatalogAuthoringModel(referenceCatalog, invalidSource)).toEqual({
      ok: false,
      reason: "source-invalid",
    });
  });

  it("accepts optional authoring metadata and falls back only to exact inert contract fields", () => {
    const catalog = copyJson(referenceCatalog);
    delete (catalog.components["com.example.ui/Text"] as { authoring?: unknown }).authoring;

    const model = requirePrepared(prepareCatalogAuthoringModel(catalog, officialSignInSource));
    const text = model.components.find((component) => component.id === "com.example.ui/Text");
    expect(text).toMatchObject({
      authoringCategory: "content",
      description: "Text content.",
      displayName: "com.example.ui/Text",
      id: "com.example.ui/Text",
      semanticCategory: "content",
    });
    expect(text?.inspector.controls.map(({ kind, property }) => [property, kind])).toEqual([
      ["role", "enum"],
      ["text", "string"],
    ]);
    expect(
      model.surfaces.find((surface) => surface.id === "sign-in")?.root.slots[0]?.children[0]
        ?.displayName,
    ).toBe("com.example.ui/Text");
  });

  it("preserves absent slots, own empty slots, and Source child-array order", () => {
    const absentSource = copyJson(officialSignInSource);
    delete (absentSource.surfaces["sign-in"].root as { slots?: unknown }).slots;
    const absentModel = requirePrepared(
      prepareCatalogAuthoringModel(referenceCatalog, absentSource),
    );
    expect(absentModel.surfaces.find((surface) => surface.id === "sign-in")?.root.slots).toEqual(
      [],
    );

    const emptySource = copyJson(officialSignInSource);
    emptySource.surfaces["sign-in"].root.slots.default = [];
    const emptyModel = requirePrepared(prepareCatalogAuthoringModel(referenceCatalog, emptySource));
    expect(emptyModel.surfaces.find((surface) => surface.id === "sign-in")?.root.slots).toEqual([
      { children: [], name: "default" },
    ]);

    const reversedSource = copyJson(officialSignInSource);
    reversedSource.surfaces["sign-in"].root.slots.default.reverse();
    const reversedModel = requirePrepared(
      prepareCatalogAuthoringModel(referenceCatalog, reversedSource),
    );
    expect(
      reversedModel.surfaces
        .find((surface) => surface.id === "sign-in")
        ?.root.slots[0]?.children.map((child) => child.id),
    ).toEqual([
      "sign-in.submit",
      "sign-in.error",
      "sign-in.password",
      "sign-in.email",
      "sign-in.title",
    ]);
  });

  it("rejects a valid but over-depth Source atomically at the authoring projection boundary", () => {
    const source = copyJson(officialSignInSource);
    let nested: Record<string, unknown> = {
      id: "depth.text",
      props: { text: "Depth" },
      use: "com.example.ui/Text",
    };
    for (let depth = 65; depth >= 0; depth -= 1) {
      nested = {
        id: `depth.stack.${depth}`,
        slots: { default: [nested] },
        use: "com.example.ui/Stack",
      };
    }
    source.surfaces["sign-in"].root = nested as (typeof source.surfaces)["sign-in"]["root"];

    expect(prepareCatalogAuthoringModel(referenceCatalog, source)).toEqual({
      ok: false,
      reason: "projection-limit",
    });
  });

  it("rejects a valid but over-width Source before its pending authoring work can exceed the occurrence budget", () => {
    const source = copyJson(officialSignInSource);
    source.surfaces["sign-in"].root.slots.default = Array.from({ length: 25_000 }, (_, index) => ({
      id: `width.text.${index}`,
      props: { text: `Width ${index}` },
      use: "com.example.ui/Text",
    })) as unknown as (typeof source.surfaces)["sign-in"]["root"]["slots"]["default"];

    expect(prepareCatalogAuthoringModel(referenceCatalog, source)).toEqual({
      ok: false,
      reason: "projection-limit",
    });
  });
});
