import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createDesenEditorDocument, setDesenEditorOwnerProp } from "@desen/editor-core";
import { describe, expect, it } from "vitest";

import officialSignInBundle from "../../../examples/sign-in/official-derived.bundle.desen.json";
import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import {
  prepareAuthoringPreviewBundle,
  prepareAuthoringSurfacePreviewBundle,
} from "../src/authoring-preview.js";
import {
  prepareReferenceAuthoringPreviewBundle,
  REFERENCE_AUTHORING_CATALOG_PACKAGES,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/reference-authoring-profile.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { PublishCatalogPackageCandidate } from "@desen/publisher";

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

function createSplitCatalogPublicationProfile(): Readonly<{
  document: DesenEditorDocument;
  packages: readonly PublishCatalogPackageCandidate[];
}> {
  const foundation = copyJson(referenceCatalog) as unknown as MutableRecord;
  foundation.id = "com.example.foundation";
  foundation.packageDigest = `sha256:${"a".repeat(64)}`;
  foundation.operations = {};
  const foundationComponents = requireRecord(foundation.components, "foundation.components");
  foundation.components = {
    "com.example.ui/Stack": foundationComponents["com.example.ui/Stack"],
    "com.example.ui/Text": foundationComponents["com.example.ui/Text"],
    "com.example.ui/TextField": foundationComponents["com.example.ui/TextField"],
  };

  const interactions = copyJson(referenceCatalog) as unknown as MutableRecord;
  interactions.id = "com.example.interactions";
  interactions.packageDigest = `sha256:${"b".repeat(64)}`;
  const interactionComponents = requireRecord(interactions.components, "interactions.components");
  interactions.components = {
    "com.example.ui/Alert": interactionComponents["com.example.ui/Alert"],
    "com.example.ui/Button": interactionComponents["com.example.ui/Button"],
  };

  const source = copyJson(officialSignInSource) as unknown as MutableRecord;
  source.catalogs = [
    { id: foundation.id, version: foundation.version, target: foundation.target },
    { id: interactions.id, version: interactions.version, target: interactions.target },
  ];
  const admitted = createDesenEditorDocument(source);
  if (!admitted.ok) throw new TypeError("Expected the split-Catalog Source to be admitted.");

  const packages = [foundation, interactions].map((catalog) =>
    Object.freeze({
      id: String(catalog.id),
      version: String(catalog.version),
      target: String(catalog.target),
      observedPackageDigest: String(catalog.packageDigest),
      catalog,
    }),
  );
  return Object.freeze({ document: admitted.document, packages: Object.freeze(packages) });
}

describe("Desen App session-local authoring preview publication", () => {
  it("admits the official-derived Source as the frozen direct reference editor document", () => {
    expect(REFERENCE_EDITOR_DOCUMENT).toEqual(officialSignInSource);
    expectDeeplyFrozen(REFERENCE_EDITOR_DOCUMENT);
  });

  it("reproduces the exact session-local baseline Bundle and official revision", () => {
    const result = prepareAuthoringPreviewBundle(
      REFERENCE_EDITOR_DOCUMENT,
      REFERENCE_AUTHORING_CATALOG_PACKAGES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected preview publication, received ${result.reason}.`);
    expect(result.revision).toBe(BASELINE_REVISION);
    expect(result.bundle.revision).toBe(result.revision);
    expect(result.bundle).toEqual(SESSION_LOCAL_BASELINE_BUNDLE);
    expect(result.bundle).not.toHaveProperty("publication");
    expectDeeplyFrozen(result);
    expect(prepareReferenceAuthoringPreviewBundle(REFERENCE_EDITOR_DOCUMENT)).toEqual(result);
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

    const result = prepareAuthoringPreviewBundle(
      edited.document,
      REFERENCE_AUTHORING_CATALOG_PACKAGES,
    );
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

    expect(prepareAuthoringPreviewBundle(invalid, REFERENCE_AUTHORING_CATALOG_PACKAGES)).toEqual({
      ok: false,
      reason: "editor-document-invalid",
    });
    const result = prepareAuthoringPreviewBundle(invalid, REFERENCE_AUTHORING_CATALOG_PACKAGES);
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

    const result = prepareAuthoringPreviewBundle(
      edited.document,
      REFERENCE_AUTHORING_CATALOG_PACKAGES,
    );
    expect(result).toEqual({ ok: false, reason: "publication-rejected" });
    expect(Object.isFrozen(result)).toBe(true);
    expect("bundle" in result).toBe(false);
  });

  it("publishes a Source that resolves capabilities across two explicit Catalog packages", () => {
    const profile = createSplitCatalogPublicationProfile();
    const result = prepareAuthoringPreviewBundle(profile.document, profile.packages);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected preview publication, received ${result.reason}.`);
    expect(result.bundle.requires.catalogs.map(({ id }) => id)).toEqual([
      "com.example.foundation",
      "com.example.interactions",
    ]);
    expect(result.bundle.surfaces["sign-in"]?.root.use).toBe("com.example.ui/Stack");
    expect(result.bundle.surfaces["sign-in"]?.root.slots?.default?.map(({ use }) => use)).toEqual([
      "com.example.ui/Text",
      "com.example.ui/TextField",
      "com.example.ui/TextField",
      "com.example.ui/Alert",
      "com.example.ui/Button",
    ]);
    expectDeeplyFrozen(result);
  });

  it("publishes a non-entry surface as an isolated transient Runtime preview", () => {
    const baseline = prepareAuthoringPreviewBundle(
      REFERENCE_EDITOR_DOCUMENT,
      REFERENCE_AUTHORING_CATALOG_PACKAGES,
    );
    const selected = prepareAuthoringSurfacePreviewBundle(
      REFERENCE_EDITOR_DOCUMENT,
      REFERENCE_AUTHORING_CATALOG_PACKAGES,
      "home",
    );

    expect(baseline.ok).toBe(true);
    expect(selected.ok).toBe(true);
    if (!baseline.ok || !selected.ok) throw new Error("Expected both exact preview publications.");
    expect(REFERENCE_EDITOR_DOCUMENT.entry).toBe("sign-in");
    expect(baseline.bundle.entry).toBe("sign-in");
    expect(selected.bundle.entry).toBe("home");
    expect(selected.bundle.surfaces).toEqual(baseline.bundle.surfaces);
    expect(selected.revision).not.toBe(baseline.revision);
    expectDeeplyFrozen(selected);
  });

  it("rejects an unknown transient preview surface without altering the Source", () => {
    expect(
      prepareAuthoringSurfacePreviewBundle(
        REFERENCE_EDITOR_DOCUMENT,
        REFERENCE_AUTHORING_CATALOG_PACKAGES,
        "missing",
      ),
    ).toEqual({ ok: false, reason: "editor-document-invalid" });
    expect(
      prepareAuthoringSurfacePreviewBundle(
        null as unknown as DesenEditorDocument,
        REFERENCE_AUTHORING_CATALOG_PACKAGES,
        "home",
      ),
    ).toEqual({ ok: false, reason: "editor-document-invalid" });
    expect(REFERENCE_EDITOR_DOCUMENT.entry).toBe("sign-in");
  });

  it("rejects missing and incompatible package candidates without selecting a fallback Catalog", () => {
    const profile = createSplitCatalogPublicationProfile();
    expect(prepareAuthoringPreviewBundle(profile.document, profile.packages.slice(0, 1))).toEqual({
      ok: false,
      reason: "publication-rejected",
    });

    const incompatible = profile.packages.map((candidate, index) =>
      index === 1
        ? Object.freeze({ ...candidate, observedPackageDigest: `sha256:${"c".repeat(64)}` })
        : candidate,
    );
    const result = prepareAuthoringPreviewBundle(profile.document, incompatible);
    expect(result).toEqual({ ok: false, reason: "publication-rejected" });
    expect(Object.isFrozen(result)).toBe(true);
    expect("bundle" in result).toBe(false);
  });
});
