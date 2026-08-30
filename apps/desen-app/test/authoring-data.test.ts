import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { describe, expect, it } from "vitest";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import {
  AUTHORING_CANVAS_FRAME_LIMITS,
  prepareCatalogAuthoringModel,
  projectAuthoringCanvasFrame,
  REFERENCE_AUTHORING_MODEL,
} from "../src/authoring-data.js";

import type { DesenEditorDocument } from "@desen/editor-core";

type MutableRecord = Record<string, unknown>;

function copyJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function requireRecord(value: unknown, path: string): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value as MutableRecord;
}

function authoringCanvas(source: MutableRecord): MutableRecord {
  return requireRecord(requireRecord(source.authoring, "authoring").canvas, "authoring.canvas");
}

function asEditorDocument(source: unknown): DesenEditorDocument {
  return source as DesenEditorDocument;
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
    const stack = model.components.find((component) => component.id === "com.example.ui/Stack");
    expect(stack?.defaultProps).toEqual({ direction: "vertical", gap: "md" });
    expect(stack?.slotContracts).toEqual([
      {
        acceptedCapabilityIds: [],
        acceptedCategories: ["layout", "content", "input", "action", "feedback", "complex"],
        constrainsChildren: true,
        description: undefined,
        maximum: null,
        minimum: 0,
        name: "default",
        required: false,
      },
    ]);
    expect(model.surfaces.map((surface) => surface.id)).toEqual(["home", "sign-in"]);

    const signIn = model.surfaces.find((surface) => surface.id === "sign-in");
    expect(signIn?.root.id).toBe("sign-in.layout");
    expect(signIn?.root.displayName).toBe("Stack");
    expect(signIn?.root.slotContracts).toEqual(stack?.slotContracts);
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
    expect(Object.isFrozen(stack?.defaultProps)).toBe(true);
    expect(Object.isFrozen(stack?.slotContracts)).toBe(true);
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

describe("Desen App active authoring canvas frame projection", () => {
  it("projects the exact Sign-in frame without exposing Source-space placement", () => {
    const result = projectAuthoringCanvasFrame(asEditorDocument(officialSignInSource), "sign-in");

    expect(result).toEqual({
      status: "ready",
      frame: { width: 420, height: 720, label: "420 × 720 px" },
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status !== "ready") throw new Error("Expected the Sign-in frame to be ready.");
    expect(Object.isFrozen(result.frame)).toBe(true);
    expect(result.frame).not.toHaveProperty("x");
    expect(result.frame).not.toHaveProperty("y");

    const moved = copyJson(officialSignInSource) as unknown as MutableRecord;
    authoringCanvas(moved)["sign-in"] = {
      x: -999_999,
      y: 999_999,
      width: 420,
      height: 720,
    };
    expect(projectAuthoringCanvasFrame(asEditorDocument(moved), "sign-in")).toEqual(result);
  });

  it("never fabricates a frame for a missing surface or missing authoring metadata", () => {
    const withoutFrame = copyJson(officialSignInSource) as unknown as MutableRecord;
    delete authoringCanvas(withoutFrame)["sign-in"];
    expect(projectAuthoringCanvasFrame(asEditorDocument(withoutFrame), "sign-in")).toEqual({
      status: "rejected",
      reason: "frame-missing",
    });
    expect(projectAuthoringCanvasFrame(asEditorDocument(officialSignInSource), "settings")).toEqual(
      { status: "rejected", reason: "surface-missing" },
    );

    const withoutAuthoring = copyJson(officialSignInSource) as unknown as MutableRecord;
    delete withoutAuthoring.authoring;
    expect(projectAuthoringCanvasFrame(asEditorDocument(withoutAuthoring), "sign-in")).toEqual({
      status: "rejected",
      reason: "authoring-missing",
    });

    const withoutCanvas = copyJson(officialSignInSource) as unknown as MutableRecord;
    delete requireRecord(withoutCanvas.authoring, "authoring").canvas;
    expect(projectAuthoringCanvasFrame(asEditorDocument(withoutCanvas), "sign-in")).toEqual({
      status: "rejected",
      reason: "canvas-missing",
    });
  });

  it("rejects malformed or unbounded frame metadata before it can influence layout", () => {
    const malformedCanvas = copyJson(officialSignInSource) as unknown as MutableRecord;
    requireRecord(malformedCanvas.authoring, "authoring").canvas = [];
    expect(projectAuthoringCanvasFrame(asEditorDocument(malformedCanvas), "sign-in")).toEqual({
      status: "rejected",
      reason: "canvas-invalid",
    });

    const zeroWidth = copyJson(officialSignInSource) as unknown as MutableRecord;
    authoringCanvas(zeroWidth)["sign-in"] = { x: 0, y: 0, width: 0, height: 720 };
    expect(projectAuthoringCanvasFrame(asEditorDocument(zeroWidth), "sign-in")).toEqual({
      status: "rejected",
      reason: "frame-invalid",
    });

    const hugeHeight = copyJson(officialSignInSource) as unknown as MutableRecord;
    authoringCanvas(hugeHeight)["sign-in"] = {
      x: 0,
      y: 0,
      width: 420,
      height: AUTHORING_CANVAS_FRAME_LIMITS.maxHeight + 1,
    };
    expect(projectAuthoringCanvasFrame(asEditorDocument(hugeHeight), "sign-in")).toEqual({
      status: "rejected",
      reason: "frame-invalid",
    });

    const fractionalCoordinate = copyJson(officialSignInSource) as unknown as MutableRecord;
    authoringCanvas(fractionalCoordinate)["sign-in"] = {
      x: 0.5,
      y: 0,
      width: 420,
      height: 720,
    };
    expect(projectAuthoringCanvasFrame(asEditorDocument(fractionalCoordinate), "sign-in")).toEqual({
      status: "rejected",
      reason: "frame-invalid",
    });
  });

  it("rejects invalid documents, surface identities, and accessor metadata", () => {
    const forged = { kind: "desen.bundle", desen: "0.1.0", id: "forged" };
    expect(projectAuthoringCanvasFrame(asEditorDocument(forged), "sign-in")).toEqual({
      status: "rejected",
      reason: "document-invalid",
    });
    expect(
      projectAuthoringCanvasFrame(asEditorDocument(officialSignInSource), "__proto__"),
    ).toEqual({ status: "rejected", reason: "surface-id-invalid" });

    const hostile = copyJson(officialSignInSource) as unknown as MutableRecord;
    const frame = requireRecord(authoringCanvas(hostile)["sign-in"], "authoring.canvas.sign-in");
    Object.defineProperty(frame, "width", {
      configurable: true,
      enumerable: true,
      get(): never {
        throw new Error("Authoring metadata must stay inert.");
      },
    });
    expect(projectAuthoringCanvasFrame(asEditorDocument(hostile), "sign-in")).toEqual({
      status: "rejected",
      reason: "document-invalid",
    });
  });
});
