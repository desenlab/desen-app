import assert from "node:assert/strict";
import test from "node:test";
import { digestCanonicalJson } from "@desen/protocol";

import sourceFixture from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json" with { type: "json" };
import catalogFixture from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json" with { type: "json" };
import * as designSystemCore from "@desen/design-system-core";

const expectedExports = [
  "DESIGN_TOKEN_PROFILE",
  "EDITABLE_PROJECT_HISTORY_LIMITS",
  "EDITABLE_PROJECT_KIND",
  "EDITABLE_PROJECT_LIMITS",
  "EDITABLE_PROJECT_RECIPE_LIMITS",
  "EDITABLE_PROJECT_SCHEMA_VERSION",
  "SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS",
  "admitDtcgTokenDocument",
  "admitEditableProjectRecord",
  "createEditableProjectHistory",
  "createEditableProjectMasterDraft",
  "getDesignTokenValueFamily",
  "getDtcgAliasTarget",
  "getEditableProjectMasterDefinitionDigest",
  "isDtcgTokenAlias",
  "migrateEditableProjectRecord",
  "prepareEditableProjectMasterDraftUpdate",
  "prepareEditableProjectRecipeTransaction",
  "recordEditableProjectHistory",
  "redoEditableProjectHistory",
  "resolveDesignTokens",
  "undoEditableProjectHistory",
  "validateEditableProjectRecipeContracts",
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
    schemaVersion: 2,
    id: "reference-project",
    source: JSON.parse(JSON.stringify(sourceFixture)),
    designSystem: {
      tokenSources: [{ id: "base", document: baseTokens }],
      recipes: [{ id: "button", name: "Button" }],
      assets: [{ id: "inter", name: "Inter", kind: "font" }],
      recipeGraph: { definitions: [], instances: [] },
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
  assert.equal(designSystemCore.EDITABLE_PROJECT_SCHEMA_VERSION, 2);
  assert.deepEqual(designSystemCore.SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS, [1, 2]);
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
  if (!migration.ok) throw new TypeError("Expected the public v2 identity migration to succeed.");
  assert.equal(migration.migrated, false);
  assert.deepEqual(migration.losses, []);
  assert.deepEqual(migration.changes, []);

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

test("the public migration preserves legacy metadata and only adds the version-2 graph", () => {
  const legacy = projectInput();
  legacy.schemaVersion = 1;
  delete legacy.designSystem.recipeGraph;
  legacy.designSystem.recipes[0].extensions = {
    "run.desen.inert": { instanceOf: "never-promoted-to-a-relationship" },
  };
  assert.equal(designSystemCore.admitEditableProjectRecord(legacy).ok, false);
  const migration = designSystemCore.migrateEditableProjectRecord(legacy);
  assert.equal(migration.ok, true);
  if (!migration.ok) throw new TypeError("Expected public legacy migration.");
  assert.equal(migration.fromSchemaVersion, 1);
  assert.equal(migration.toSchemaVersion, 2);
  assert.equal(migration.migrated, true);
  assert.deepEqual(migration.record, {
    ...legacy,
    schemaVersion: 2,
    designSystem: { ...legacy.designSystem, recipeGraph: { definitions: [], instances: [] } },
  });
  assert.deepEqual(migration.losses, []);
  assert.deepEqual(
    migration.changes.map(({ pointer }) => pointer),
    ["/schemaVersion", "/designSystem/recipeGraph"],
  );
  assertDeepFrozen(migration);
});

test("the public history restores whole-project metadata, not only Source", () => {
  const original = projectInput();
  const history = designSystemCore.createEditableProjectHistory(original);
  assert.ok(history);
  const candidate = {
    ...original,
    designSystem: { ...original.designSystem, recipes: [] },
  };
  const recorded = designSystemCore.recordEditableProjectHistory(history, candidate);
  assert.equal(recorded.ok, true);
  assert.equal(recorded.changed, true);
  assert.deepEqual(recorded.history.record.source, original.source);
  assert.deepEqual(recorded.history.record.designSystem.recipes, []);
  const undone = designSystemCore.undoEditableProjectHistory(recorded.history);
  assert.equal(undone.ok, true);
  assert.deepEqual(undone.history.record, original);
  const redone = designSystemCore.redoEditableProjectHistory(undone.history);
  assert.equal(redone.ok, true);
  assert.deepEqual(redone.history.record, candidate);
  assertDeepFrozen(redone);
});

test("the public transaction validates and materializes a recipe with explicit Catalog authority", () => {
  const project = projectInput();
  const definition = {
    id: "master.title",
    name: "Title",
    state: {},
    resources: {},
    root: { kind: "node", id: "title", use: "com.example.ui/Text", props: { text: "Reusable" } },
  };
  const created = designSystemCore.prepareEditableProjectRecipeTransaction(
    project,
    {
      type: "master.create",
      expectedProjectDigest: digestCanonicalJson(project),
      definition,
    },
    [catalogFixture],
  );
  assert.equal(created.ok, true);
  assert.deepEqual(created.record.source, project.source);
  const definitionDigest = designSystemCore.getEditableProjectMasterDefinitionDigest(
    created.record,
    "master.title",
  );
  assert.match(definitionDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(
    designSystemCore.getEditableProjectMasterDefinitionDigest(created.record, "missing"),
    undefined,
  );
  const inserted = designSystemCore.prepareEditableProjectRecipeTransaction(
    created.record,
    {
      type: "instance.insert",
      expectedProjectDigest: created.digest,
      masterId: "master.title",
      instanceId: "title.instance",
      destination: { surfaceId: "home", parentId: "home.layout", slot: "default", index: 0 },
    },
    [catalogFixture],
  );
  assert.equal(inserted.ok, true);
  assert.equal(inserted.record.source.surfaces.home.root.slots.default[0].props.text, "Reusable");
  assert.equal(
    inserted.record.designSystem.recipeGraph.instances[0].definitionDigest,
    definitionDigest,
  );
  assertDeepFrozen(inserted);
  const visualSource = JSON.parse(JSON.stringify(inserted.record.source));
  visualSource.surfaces.home.root.slots.default[0].props.text = "Visual override";
  const visualEdit = designSystemCore.prepareEditableProjectRecipeTransaction(
    inserted.record,
    { type: "source.apply", expectedProjectDigest: inserted.digest, source: visualSource },
    [catalogFixture],
  );
  assert.equal(visualEdit.ok, true);
  assert.deepEqual(visualEdit.record.source, visualSource);
  assert.deepEqual(visualEdit.record.designSystem.recipeGraph.instances[0].overrides, [
    {
      owner: { path: [], definitionId: "master.title", kind: "node", id: "title" },
      property: { kind: "prop", name: "text" },
      value: "Visual override",
    },
  ]);
  assertDeepFrozen(visualEdit);
  const validated = designSystemCore.validateEditableProjectRecipeContracts(inserted.record, [
    catalogFixture,
  ]);
  assert.equal(validated.ok, true);
  assert.deepEqual(validated.record, inserted.record);
  assert.equal(validated.digest, inserted.digest);
  assert.equal(validated.catalogSetFingerprint, inserted.catalogSetFingerprint);
  const invalidUnused = JSON.parse(JSON.stringify(created.record));
  invalidUnused.designSystem.recipeGraph.definitions[0].root.use = "foreign.ui/Text";
  assert.equal(designSystemCore.admitEditableProjectRecord(invalidUnused).ok, true);
  const rejected = designSystemCore.validateEditableProjectRecipeContracts(invalidUnused, [
    catalogFixture,
  ]);
  assert.equal(rejected.ok, false);
  assert.equal(Object.hasOwn(rejected, "record"), false);
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

test("the public visual master draft applies only to its observed whole project", () => {
  const project = projectInput();
  const captured = designSystemCore.prepareEditableProjectRecipeTransaction(
    project,
    {
      type: "master.capture",
      expectedProjectDigest: digestCanonicalJson(project),
      masterId: "master.title",
      name: "Title",
      surfaceId: "home",
      nodeId: "home.title",
      instanceId: "title",
    },
    [catalogFixture],
  );
  assert.equal(captured.ok, true);
  const opened = designSystemCore.createEditableProjectMasterDraft(
    captured.record,
    {
      masterId: "master.title",
      surfaceId: "home",
      expectedProjectDigest: captured.digest,
    },
    [catalogFixture],
  );
  assert.equal(opened.ok, true);
  assertDeepFrozen(opened);
  const edited = JSON.parse(JSON.stringify(opened.draft.record));
  edited.source.surfaces.home.root.props.text = "Visual master edit";
  const updated = designSystemCore.prepareEditableProjectMasterDraftUpdate(
    captured.record,
    opened.draft,
    edited,
    [catalogFixture],
  );
  assert.equal(updated.ok, true);
  assert.equal(
    updated.record.source.surfaces.home.root.slots.default[0].props.text,
    "Visual master edit",
  );
  assertDeepFrozen(updated);
  assert.equal(
    designSystemCore.prepareEditableProjectMasterDraftUpdate(updated.record, opened.draft, edited, [
      catalogFixture,
    ]).ok,
    false,
  );
  assert.equal(
    designSystemCore.prepareEditableProjectMasterDraftUpdate(
      captured.record,
      { ...opened.draft },
      edited,
      [catalogFixture],
    ).ok,
    false,
  );
});
