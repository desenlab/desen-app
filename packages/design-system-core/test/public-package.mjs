import assert from "node:assert/strict";
import test from "node:test";

import sourceFixture from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json" with { type: "json" };
import * as designSystemCore from "@desen/design-system-core";

const expectedExports = [
  "DESIGN_TOKEN_PROFILE",
  "EDITABLE_PROJECT_KIND",
  "EDITABLE_PROJECT_LIMITS",
  "EDITABLE_PROJECT_SCHEMA_VERSION",
  "SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS",
  "admitDtcgTokenDocument",
  "admitEditableProjectRecord",
  "getDesignTokenValueFamily",
  "getDtcgAliasTarget",
  "isDtcgTokenAlias",
  "migrateEditableProjectRecord",
  "resolveDesignTokens",
];

const baseTokens = {
  color: {
    $type: "color",
    action: { $value: "{color.brand}" },
    brand: { $value: { colorSpace: "srgb", components: [0, 0, 0] } },
  },
};

function projectInput() {
  return {
    kind: "desen.editable-project",
    schemaVersion: 1,
    id: "reference-project",
    source: JSON.parse(JSON.stringify(sourceFixture)),
    designSystem: {
      tokenSources: [{ id: "base", document: baseTokens }],
      recipes: [{ id: "button", name: "Button" }],
      assets: [{ id: "inter", name: "Inter", kind: "font" }],
    },
    connectionIntents: [
      { id: "submit-intent", status: "draft", surfaceId: "sign-in", nodeId: "sign-in.submit" },
    ],
  };
}

function assertDeepFrozen(root) {
  const pending = [root];
  const seen = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    assert.equal(Object.isFrozen(value), true);
    pending.push(...Object.values(value));
  }
}

test("the built package exposes only the reviewed public runtime surface", () => {
  assert.deepEqual(Object.keys(designSystemCore).sort(), expectedExports);
  assert.equal(designSystemCore.EDITABLE_PROJECT_KIND, "desen.editable-project");
  assert.equal(designSystemCore.DESIGN_TOKEN_PROFILE.formatVersion, "2025.10");
  assert.equal(designSystemCore.getDesignTokenValueFamily("transition"), "motion");
});

test("the built package composes project admission, migration and token resolution", () => {
  const admission = designSystemCore.admitEditableProjectRecord(projectInput());
  assert.equal(admission.ok, true);
  if (!admission.ok) throw new TypeError("Expected the public project candidate to be admitted.");
  assertDeepFrozen(admission);

  const migration = designSystemCore.migrateEditableProjectRecord(admission.record);
  assert.equal(migration.ok, true);
  if (!migration.ok) throw new TypeError("Expected the public v1 identity migration to succeed.");
  assert.equal(migration.migrated, false);
  assert.deepEqual(migration.losses, []);

  const tokenAdmission = designSystemCore.admitDtcgTokenDocument(baseTokens, "base");
  assert.equal(tokenAdmission.ok, true);
  const resolution = designSystemCore.resolveDesignTokens({
    sources: admission.record.designSystem.tokenSources,
    literalOverrides: [
      {
        path: "color.brand",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 1, 1] },
      },
    ],
  });
  assert.equal(resolution.ok, true);
  if (!resolution.ok) throw new TypeError("Expected public token resolution to succeed.");
  const actionColor = resolution.tokens["color.action"]?.value;
  assert.equal(actionColor?.colorSpace, "srgb");
  assert.deepEqual(actionColor?.components, [1, 1, 1]);
  assertDeepFrozen(resolution);

  const crossSourceResolution = designSystemCore.resolveDesignTokens({
    sources: [
      {
        id: "base",
        document: { semantic: { action: { $value: "{mode.brand}" } } },
      },
      {
        id: "mode.dark",
        document: {
          mode: {
            $type: "color",
            brand: { $value: { colorSpace: "srgb", components: [0.2, 0.3, 0.4] } },
          },
        },
      },
    ],
  });
  assert.equal(crossSourceResolution.ok, true);
  if (!crossSourceResolution.ok) {
    throw new TypeError("Expected the later source to close the base alias graph.");
  }
  assert.equal(crossSourceResolution.tokens["semantic.action"]?.type, "color");
  assert.deepEqual(crossSourceResolution.tokens["semantic.action"]?.aliasChain, ["mode.brand"]);
  assertDeepFrozen(crossSourceResolution);
});

test("unsupported DTCG remains visible but never becomes a partial resolved map", () => {
  const result = designSystemCore.resolveDesignTokens({
    sources: [
      {
        id: "wide-gamut",
        document: {
          brand: {
            $type: "color",
            $value: { colorSpace: "display-p3", components: [1, 0, 0] },
          },
        },
      },
    ],
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new TypeError("Expected unsupported color space rejection.");
  assert.equal(result.diagnostics[0].classification, "UNSUPPORTED_DTCG_FEATURE");
  assert.equal(Object.hasOwn(result, "tokens"), false);
  assert.equal(result.rejectedSource?.id, "wide-gamut");
});
