import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { describe, expect, it } from "vitest";

import {
  AUTHORING_SOURCE_SCENARIO_VALUE,
  prepareAuthoringScenarioModel,
  prepareAuthoringScenarioPreview,
} from "../src/authoring-scenarios.js";
import { REFERENCE_AUTHORING_MODEL } from "../src/authoring-data.js";
import {
  prepareAuthoringPreviewBundle,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/authoring-preview.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { CatalogAuthoringModel } from "../src/authoring-data.js";
import type { AuthoringPreviewBundleSuccess } from "../src/authoring-preview.js";
import type { AuthoringComponentSelection } from "../src/authoring-selection.js";

const ROUTE = Object.freeze({ projectId: "account-app", surfaceId: "sign-in" });
type MutableJsonObject = Record<string, unknown>;

function selection(
  sourceNodeId = "sign-in.email",
  capabilityId = "com.example.ui/TextField",
  displayName = "Text field",
  conditional = false,
): AuthoringComponentSelection {
  return createAuthoringComponentSelection({
    ...ROUTE,
    sourceNodeId,
    capabilityId,
    displayName,
    conditional,
  });
}

function currentPreview(): AuthoringPreviewBundleSuccess {
  const preview = prepareAuthoringPreviewBundle(REFERENCE_EDITOR_DOCUMENT);
  expect(preview.ok).toBe(true);
  if (!preview.ok) throw new Error(`Expected the current preview, received ${preview.reason}.`);
  return preview;
}

function copyJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function mutableObject(value: unknown, path: string): MutableJsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value as MutableJsonObject;
}

function mutableTextFieldScenario(catalog: unknown, scenarioId: string): MutableJsonObject {
  const root = mutableObject(catalog, "catalog");
  const components = mutableObject(root.components, "catalog.components");
  const textField = mutableObject(
    components["com.example.ui/TextField"],
    "catalog.components.TextField",
  );
  const authoring = mutableObject(textField.authoring, "TextField.authoring");
  const scenarios = mutableObject(authoring.scenarios, "TextField.authoring.scenarios");
  return mutableObject(scenarios[scenarioId], `TextField scenario ${scenarioId}`);
}

function modelWithCatalog(catalog: unknown): CatalogAuthoringModel {
  return Object.freeze({
    ...REFERENCE_AUTHORING_MODEL,
    validationCatalogs: Object.freeze([catalog]),
  });
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

describe("Desen App authoring-only scenarios", () => {
  it("exposes the authored sentinel and exact Catalog scenarios in stable order", () => {
    const email = prepareAuthoringScenarioModel(REFERENCE_AUTHORING_MODEL, ROUTE, selection());
    expect(email).toEqual({
      status: "ready",
      route: ROUTE,
      selection: selection(),
      options: [
        {
          kind: "source",
          value: AUTHORING_SOURCE_SCENARIO_VALUE,
          scenarioId: null,
          label: "Source values",
          description: "Current authored component properties.",
        },
        {
          kind: "catalog",
          value: "catalog:default",
          scenarioId: "default",
          label: "default",
          description: undefined,
        },
        {
          kind: "catalog",
          value: "catalog:invalid",
          scenarioId: "invalid",
          label: "invalid",
          description: undefined,
        },
      ],
    });
    expectDeeplyFrozen(email);

    const button = prepareAuthoringScenarioModel(
      REFERENCE_AUTHORING_MODEL,
      ROUTE,
      selection("sign-in.submit", "com.example.ui/Button", "Button"),
    );
    expect(button.status === "ready" && button.options.map(({ value }) => value)).toEqual([
      "source",
      "catalog:default",
      "catalog:loading",
    ]);

    const text = prepareAuthoringScenarioModel(
      REFERENCE_AUTHORING_MODEL,
      ROUTE,
      selection("sign-in.title", "com.example.ui/Text", "Text"),
    );
    expect(text.status === "ready" && text.options.map(({ value }) => value)).toEqual(["source"]);
  });

  it("returns an honest idle state and rejects stale route or capability authority", () => {
    expect(prepareAuthoringScenarioModel(REFERENCE_AUTHORING_MODEL, ROUTE, null)).toEqual({
      status: "idle",
    });
    expect(
      prepareAuthoringScenarioModel(
        REFERENCE_AUTHORING_MODEL,
        { projectId: "other", surfaceId: "sign-in" },
        selection(),
      ),
    ).toEqual({ status: "rejected", reason: "route-invalid" });
    expect(
      prepareAuthoringScenarioModel(
        REFERENCE_AUTHORING_MODEL,
        { projectId: "forged", surfaceId: "sign-in" },
        createAuthoringComponentSelection({
          projectId: "forged",
          surfaceId: "sign-in",
          sourceNodeId: "sign-in.email",
          capabilityId: "com.example.ui/TextField",
          displayName: "Text field",
          conditional: false,
        }),
      ),
    ).toEqual({ status: "rejected", reason: "route-invalid" });
    expect(
      prepareAuthoringScenarioModel(
        REFERENCE_AUTHORING_MODEL,
        ROUTE,
        selection("sign-in.email", "com.example.ui/Text", "Text"),
      ),
    ).toEqual({ status: "rejected", reason: "selection-invalid" });
  });

  it("prepares a shallow transient props overlay and leaves session Source/preview untouched", () => {
    const document = REFERENCE_EDITOR_DOCUMENT;
    const preview = currentPreview();
    const documentBytes = JSON.stringify(document);
    const previewBytes = JSON.stringify(preview);

    const result = prepareAuthoringScenarioPreview(
      document,
      preview,
      REFERENCE_AUTHORING_MODEL,
      ROUTE,
      selection(),
      "catalog:invalid",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected a scenario preview, received ${result.reason}.`);
    expect(result.scenarioDocument).not.toBe(document);
    expect(result.preview).not.toBe(preview);
    expect(result.preview.revision).not.toBe(preview.revision);
    const email = result.scenarioDocument.surfaces["sign-in"]?.root.slots?.default?.[1];
    expect(email?.props).toEqual({ label: "Email", value: "bad", invalid: true });
    expect(email?.on).toEqual(document.surfaces["sign-in"]?.root.slots?.default?.[1]?.on);
    expect(result.preview.bundle.surfaces["sign-in"]?.root.slots?.default?.[1]?.props).toEqual({
      label: "Email",
      value: "bad",
      invalid: true,
    });
    expect(JSON.stringify(document)).toBe(documentBytes);
    expect(JSON.stringify(preview)).toBe(previewBytes);
    expect(result).not.toHaveProperty("authoredDocument");
    expect(result).not.toHaveProperty("currentPreview");
    expectDeeplyFrozen(result);
  });

  it("restores authored values by exact identity without fabricating another session snapshot", () => {
    const document = REFERENCE_EDITOR_DOCUMENT;
    const preview = currentPreview();
    const result = prepareAuthoringScenarioPreview(
      document,
      preview,
      REFERENCE_AUTHORING_MODEL,
      ROUTE,
      selection(),
      "source",
    );

    expect(result).toEqual({ ok: true, scenarioDocument: document, preview });
    expect(result.ok && result.scenarioDocument).toBe(document);
    expect(result.ok && result.preview).toBe(preview);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects missing, unprefixed, and stale-preview scenario requests without partial output", () => {
    const preview = currentPreview();
    expect(
      prepareAuthoringScenarioPreview(
        REFERENCE_EDITOR_DOCUMENT,
        preview,
        REFERENCE_AUTHORING_MODEL,
        ROUTE,
        selection(),
        "catalog:missing",
      ),
    ).toEqual({ ok: false, reason: "scenario-invalid" });
    expect(
      prepareAuthoringScenarioPreview(
        REFERENCE_EDITOR_DOCUMENT,
        preview,
        REFERENCE_AUTHORING_MODEL,
        ROUTE,
        selection(),
        "default" as never,
      ),
    ).toEqual({ ok: false, reason: "scenario-invalid" });
    expect(
      prepareAuthoringScenarioPreview(
        REFERENCE_EDITOR_DOCUMENT,
        Object.freeze({ ...preview, revision: "sha256:stale" }),
        REFERENCE_AUTHORING_MODEL,
        ROUTE,
        selection(),
        "catalog:default",
      ),
    ).toEqual({ ok: false, reason: "preview-unavailable" });
    expect(
      prepareAuthoringScenarioPreview(
        Object.freeze({}) as DesenEditorDocument,
        preview,
        REFERENCE_AUTHORING_MODEL,
        ROUTE,
        selection(),
        "catalog:default",
      ),
    ).toEqual({ ok: false, reason: "document-invalid" });
  });

  it("fails closed for scenario state or fixtures instead of partially applying props", () => {
    for (const unsupported of ["state", "fixtures"] as const) {
      const catalog: unknown = copyJson(referenceCatalog);
      mutableTextFieldScenario(catalog, "default")[unsupported] = {};
      const result = prepareAuthoringScenarioModel(modelWithCatalog(catalog), ROUTE, selection());
      expect(result).toEqual({ status: "rejected", reason: "scenario-unsupported" });
      expect(Object.isFrozen(result)).toBe(true);
      expect(result).not.toHaveProperty("options");
    }
  });

  it("does not invoke hostile route, selection, or scenario-prop accessors", () => {
    let accessorCalls = 0;
    const route = Object.defineProperty({ surfaceId: "sign-in" }, "projectId", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return "account-app";
      },
    });
    expect(
      prepareAuthoringScenarioModel(REFERENCE_AUTHORING_MODEL, route as typeof ROUTE, selection()),
    ).toEqual({ status: "rejected", reason: "route-invalid" });

    const forgedSelection = Object.defineProperty(
      { ...selection(), sourceNodeId: undefined },
      "sourceNodeId",
      {
        enumerable: true,
        get() {
          accessorCalls += 1;
          return "sign-in.email";
        },
      },
    );
    expect(
      prepareAuthoringScenarioModel(
        REFERENCE_AUTHORING_MODEL,
        ROUTE,
        forgedSelection as unknown as AuthoringComponentSelection,
      ),
    ).toEqual({ status: "rejected", reason: "selection-invalid" });

    const catalog: unknown = copyJson(referenceCatalog);
    const props = Object.defineProperty({}, "label", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return "Hostile";
      },
    });
    mutableTextFieldScenario(catalog, "default").props = props;
    expect(prepareAuthoringScenarioModel(modelWithCatalog(catalog), ROUTE, selection())).toEqual({
      status: "rejected",
      reason: "catalog-invalid",
    });
    expect(accessorCalls).toBe(0);
  });
});
