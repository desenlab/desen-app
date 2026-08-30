import { setDesenEditorOwnerProp } from "@desen/editor-core";
import { describe, expect, it } from "vitest";

import officialSignInBundle from "../../../examples/sign-in/official-derived.bundle.desen.json";
import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import {
  prepareAuthoringPreviewBundle,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/authoring-preview.js";

import type { DesenEditorDocument } from "@desen/editor-core";

const BASELINE_REVISION = "sha256:6e539a76ddd0bc9b4eff82e73508b62a3980ae5dbc73dd85ccf0c1cae6957e13";
const EDITED_REVISION = "sha256:582b95347becd2bfe8ee7de4421ab7fbea950861e079875ede270e5c94326d86";
const { publication: omittedFixturePublication, ...SESSION_LOCAL_BASELINE_BUNDLE } =
  officialSignInBundle;
void omittedFixturePublication;

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

describe("Desen App session-local authoring preview publication", () => {
  it("admits the official-derived Source as the frozen direct reference editor document", () => {
    expect(REFERENCE_EDITOR_DOCUMENT).toEqual(officialSignInSource);
    expectDeeplyFrozen(REFERENCE_EDITOR_DOCUMENT);
  });

  it("reproduces the exact session-local baseline Bundle and official revision", () => {
    const result = prepareAuthoringPreviewBundle(REFERENCE_EDITOR_DOCUMENT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected preview publication, received ${result.reason}.`);
    expect(result.revision).toBe(BASELINE_REVISION);
    expect(result.bundle.revision).toBe(result.revision);
    expect(result.bundle).toEqual(SESSION_LOCAL_BASELINE_BUNDLE);
    expect(result.bundle).not.toHaveProperty("publication");
    expectDeeplyFrozen(result);
  });

  it("publishes a valid primitive prop edit as a fresh exact Bundle revision", () => {
    const edited = setDesenEditorOwnerProp(REFERENCE_EDITOR_DOCUMENT, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      name: "text",
      value: "Welcome back",
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) throw new Error("Expected a valid editor-core prop mutation.");

    const result = prepareAuthoringPreviewBundle(edited.document);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected preview publication, received ${result.reason}.`);
    expect(result.revision).toBe(EDITED_REVISION);
    expect(result.revision).not.toBe(BASELINE_REVISION);
    expect(result.bundle.surfaces["sign-in"]?.root.slots?.default?.[0]?.props?.text).toBe(
      "Welcome back",
    );
    expect(result.bundle).not.toEqual(officialSignInBundle);
    expectDeeplyFrozen(result);
  });

  it("rejects a runtime-cast non-Source without throwing or exposing a partial Bundle", () => {
    const invalid = {
      kind: "desen.bundle",
      desen: "0.1.0",
      id: "forged",
    } as unknown as DesenEditorDocument;

    expect(prepareAuthoringPreviewBundle(invalid)).toEqual({
      ok: false,
      reason: "editor-document-invalid",
    });
    const result = prepareAuthoringPreviewBundle(invalid);
    expect(Object.isFrozen(result)).toBe(true);
    expect("bundle" in result).toBe(false);
  });

  it("rejects a structurally valid but Catalog-invalid prop edit without a partial Bundle", () => {
    const edited = setDesenEditorOwnerProp(REFERENCE_EDITOR_DOCUMENT, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      name: "text",
      value: 42,
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) throw new Error("Expected structural editor-core admission.");

    const result = prepareAuthoringPreviewBundle(edited.document);
    expect(result).toEqual({ ok: false, reason: "publication-rejected" });
    expect(Object.isFrozen(result)).toBe(true);
    expect("bundle" in result).toBe(false);
  });
});
