import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import source from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import catalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  createEditableProjectMasterDraft,
  prepareEditableProjectMasterDraftUpdate,
} from "../src/master-edit.js";
import { admitEditableProjectRecord } from "../src/project-record.js";
import { prepareEditableProjectRecipeTransaction } from "../src/recipe-transactions.js";
import { cloneRecipeJson, indexRecipeSource } from "../src/recipe-source.js";

import type { EditableProjectMasterDraft } from "../src/master-edit-types.js";
import type {
  EditableProjectMasterDefinition,
  EditableProjectRecipeNode,
} from "../src/master-instance-types.js";
import type { EditableProjectRecord } from "../src/project-record.js";

const text: EditableProjectMasterDefinition = {
  id: "master.text",
  name: "Text",
  root: {
    kind: "node",
    id: "text",
    use: "com.example.ui/Text",
    props: { text: "Master", role: "heading" },
  },
  state: {},
  resources: {},
};

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error("Expected a complete test fixture member.");
  return value;
}

function fixture(): EditableProjectRecord {
  const result = admitEditableProjectRecord({
    kind: "desen.editable-project",
    schemaVersion: 2,
    id: "project.master-edit",
    source,
    designSystem: {
      tokenSources: [],
      recipes: [],
      assets: [],
      recipeGraph: { definitions: [], instances: [] },
    },
    connectionIntents: [],
  });
  if (!result.ok) throw new Error("Invalid test fixture.");
  return result.record;
}

function command(
  record: EditableProjectRecord,
  request: Record<string, unknown>,
): EditableProjectRecord {
  const result = prepareEditableProjectRecipeTransaction(
    record,
    { ...request, expectedProjectDigest: digestCanonicalJson(record) },
    [catalog],
  );
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error("Expected a valid recipe command.");
  return result.record;
}

function create(definition = text, record = fixture()): EditableProjectRecord {
  return command(record, { type: "master.create", definition });
}

function insert(
  record: EditableProjectRecord,
  instanceId: string,
  masterId = text.id,
  parentId = "home.layout",
): EditableProjectRecord {
  return command(record, {
    type: "instance.insert",
    masterId,
    instanceId,
    destination: { surfaceId: "home", parentId, slot: "default", index: 0 },
  });
}

function open(record: EditableProjectRecord, masterId = text.id): EditableProjectMasterDraft {
  const before = canonicalizeJson(record);
  const result = createEditableProjectMasterDraft(
    record,
    { masterId, surfaceId: "home", expectedProjectDigest: digestCanonicalJson(record) },
    [catalog],
  );
  expect(result.ok, JSON.stringify(result)).toBe(true);
  expect(canonicalizeJson(record)).toBe(before);
  if (!result.ok) throw new Error("Expected a valid master projection.");
  expect(Object.isFrozen(result.draft)).toBe(true);
  expect(Object.isFrozen(result.draft.record.source)).toBe(true);
  return result.draft;
}

function apply(
  record: EditableProjectRecord,
  draft: EditableProjectMasterDraft,
  edited = draft.record,
) {
  const before = canonicalizeJson(record);
  const draftBefore = canonicalizeJson(edited);
  const result = prepareEditableProjectMasterDraftUpdate(record, draft, edited, [catalog]);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  expect(canonicalizeJson(record)).toBe(before);
  expect(canonicalizeJson(edited)).toBe(draftBefore);
  if (!result.ok) throw new Error("Expected a valid master update.");
  return result;
}

function rejected(record: EditableProjectRecord, draft: unknown, edited: unknown, code?: string) {
  const before = canonicalizeJson(record);
  const result = prepareEditableProjectMasterDraftUpdate(record, draft, edited, [catalog]);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected atomic draft rejection.");
  if (code !== undefined) expect(result.diagnostics[0].code).toBe(code);
  expect(Object.hasOwn(result, "record")).toBe(false);
  expect(canonicalizeJson(record)).toBe(before);
}

describe("isolated visual master editing", () => {
  it("opens unused master defaults and round-trips canonically without changing the live Source", () => {
    const record = create();
    const draft = open(record);
    expect(draft.record.source.surfaces.home?.root).toEqual({
      id: "text",
      use: "com.example.ui/Text",
      props: { text: "Master", role: "heading" },
    });
    expect(draft.record.designSystem.recipeGraph.instances).toEqual([]);
    expect(apply(record, draft).changed).toBe(false);
    expect(apply(record, draft).record).toEqual(record);
  });

  it("updates two linked instances, preserves local overrides and leaves a detached third untouched", () => {
    let record = create();
    for (const id of ["first", "second", "third"]) record = insert(record, id);
    record = command(record, {
      type: "instance.override",
      instanceId: "second",
      override: {
        owner: { path: [], definitionId: text.id, kind: "node", id: "text" },
        property: { kind: "prop", name: "text" },
        value: "Local",
      },
    });
    const originalInstances = record.designSystem.recipeGraph.instances;
    record = command(record, { type: "instance.detach", instanceId: "third" });
    const draft = open(record);
    expect(draft.record.source.surfaces.home?.root.props?.text).toBe("Master");
    const edit = cloneRecipeJson(draft.record);
    required(edit.source.surfaces.home).root.props = { text: "Updated", role: "body" };
    const result = apply(record, draft, edit);
    expect(result.affectedInstanceIds).toEqual(["first", "second"]);
    const nodes = indexRecipeSource(
      cloneRecipeJson(required(result.record.source.surfaces.home)),
    ).nodes;
    for (const instance of originalInstances) {
      const props = nodes.get(instance.rootId)?.node.props;
      expect(props).toEqual(
        instance.id === "third"
          ? { text: "Master", role: "heading" }
          : { text: instance.id === "second" ? "Local" : "Updated", role: "body" },
      );
      const current = result.record.designSystem.recipeGraph.instances.find(
        (item) => item.id === instance.id,
      );
      if (current !== undefined) expect(current.mapping).toEqual(instance.mapping);
    }
    expect(result.record.source.surfaces["sign-in"]).toEqual(record.source.surfaces["sign-in"]);
  });

  it("preserves local state, actions, navigation and unused declarations through an ordinary visual edit", () => {
    const captured = command(fixture(), {
      type: "master.capture",
      masterId: "master.form",
      name: "Form",
      surfaceId: "sign-in",
      nodeId: "sign-in.layout",
      instanceId: "form",
    });
    const baseDefinition = required(captured.designSystem.recipeGraph.definitions[0]);
    const record = create({
      ...baseDefinition,
      state: { ...baseDefinition.state, unused: { schema: { type: "string" }, initial: "Keep" } },
    });
    const draft = open(record, "master.form");
    expect(draft.record.source.surfaces.home?.state).toEqual(
      record.designSystem.recipeGraph.definitions[0]?.state,
    );
    expect(apply(record, draft).record).toEqual(record);
    const edit = cloneRecipeJson(draft.record);
    const title = required(
      indexRecipeSource(required(edit.source.surfaces.home)).nodes.get("sign-in.title"),
    ).node;
    title.props = { ...title.props, text: "New form title" };
    const result = apply(record, draft, edit);
    const definition = required(result.record.designSystem.recipeGraph.definitions[0]);
    expect(definition.state).toEqual(record.designSystem.recipeGraph.definitions[0]?.state);
    const root = definition.root as EditableProjectRecipeNode;
    const originalRoot = baseDefinition.root as EditableProjectRecipeNode;
    expect(root.slots?.default?.slice(1)).toEqual(originalRoot.slots?.default?.slice(1));
  });

  it("retains nested occurrence identities, defaults and repeat occurrences through reordering", () => {
    const nested = {
      kind: "instance",
      id: "firstOccurrence",
      masterId: text.id,
      overrides: [
        {
          owner: { path: [], definitionId: text.id, kind: "node", id: "text" },
          property: { kind: "prop", name: "text" },
          value: "Nested default",
        },
      ],
    } as const;
    const parent: EditableProjectMasterDefinition = {
      id: "master.parent",
      name: "Parent",
      root: {
        kind: "node",
        id: "parent",
        use: "com.example.ui/Stack",
        props: { direction: "vertical" },
        slots: { default: [nested, { ...nested, id: "secondOccurrence", overrides: [] }] },
      },
      state: {},
      resources: {},
    };
    const record = insert(create(parent, create()), "parent-instance", parent.id);
    const draft = open(record, parent.id);
    expect(draft.record.designSystem.recipeGraph.instances.map((item) => item.rootId)).toEqual([
      "firstOccurrence",
      "secondOccurrence",
    ]);
    expect(apply(record, draft).record).toEqual(record);
    const edit = cloneRecipeJson(draft.record);
    required(edit.source.surfaces.home?.root.slots?.default).reverse();
    const changed = command(draft.record, { type: "source.apply", source: edit.source });
    const result = apply(record, draft, changed);
    expect(result.record.designSystem.recipeGraph.instances[0]?.mapping).toEqual(
      record.designSystem.recipeGraph.instances[0]?.mapping,
    );
    const root = required(
      result.record.designSystem.recipeGraph.definitions.find((item) => item.id === parent.id),
    ).root as EditableProjectRecipeNode;
    expect(root.slots?.default).toEqual([
      parent.root.kind === "node" ? parent.root.slots?.default?.[1] : undefined,
      nested,
    ]);
  });

  it("round-trips masters whose root is a chain of linked occurrences", () => {
    const alias: EditableProjectMasterDefinition = {
      ...text,
      id: "master.alias",
      root: { kind: "instance", id: "alias", masterId: text.id, overrides: [] },
    };
    const outer: EditableProjectMasterDefinition = {
      ...alias,
      id: "master.outer",
      root: { kind: "instance", id: "outer", masterId: alias.id, overrides: [] },
    };
    const record = create(outer, create(alias, create()));
    const draft = open(record, outer.id);
    expect(draft.record.source.surfaces.home?.root.id).toBe("outer");
    expect(apply(record, draft).record).toEqual(record);
  });

  it("keeps nested edits as occurrence overrides and explicit detach as ordinary parent-owned content", () => {
    const parent: EditableProjectMasterDefinition = {
      ...text,
      id: "master.parent",
      root: { kind: "instance", id: "nested", masterId: text.id, overrides: [] },
    };
    const record = create(parent, create());
    const draft = open(record, parent.id);
    const edited = cloneRecipeJson(draft.record.source);
    required(edited.surfaces.home?.root.props).text = "Parent default";
    const candidate = command(draft.record, { type: "source.apply", source: edited });
    const result = apply(record, draft, candidate);
    expect(
      result.record.designSystem.recipeGraph.definitions.find((item) => item.id === text.id),
    ).toEqual(text);
    const root = required(
      result.record.designSystem.recipeGraph.definitions.find((item) => item.id === parent.id),
    ).root;
    expect(root.kind).toBe("instance");
    if (root.kind !== "instance") throw new Error("Expected preserved nesting.");
    expect(root.overrides[0]?.value).toBe("Parent default");
    const detached = command(candidate, {
      type: "instance.detach",
      instanceId: required(candidate.designSystem.recipeGraph.instances[0]).id,
    });
    const detachedResult = apply(record, draft, detached);
    expect(
      detachedResult.record.designSystem.recipeGraph.definitions.find(
        (item) => item.id === parent.id,
      )?.root.kind,
    ).toBe("node");
  });

  it("rejects a structural update that would destroy an existing instance override", () => {
    let record = insert(create(), "first");
    record = command(record, {
      type: "instance.override",
      instanceId: "first",
      override: {
        owner: { path: [], definitionId: text.id, kind: "node", id: "text" },
        property: { kind: "prop", name: "text" },
        value: "Local",
      },
    });
    const draft = open(record);
    const edited = cloneRecipeJson(draft.record);
    required(edited.source.surfaces.home).root.id = "replacement";
    rejected(record, draft, edited, "RECIPE_MATERIALIZATION_REJECTED");
  });

  it("rejects recursive nested insertion without losing the isolated draft or live project", () => {
    const parent: EditableProjectMasterDefinition = {
      ...text,
      root: {
        kind: "node",
        id: "parent",
        use: "com.example.ui/Stack",
        props: { direction: "vertical" },
      },
    };
    const record = create(parent);
    const draft = open(record);
    const edited = insert(draft.record, "self", text.id, "parent");
    const before = canonicalizeJson(edited);
    rejected(record, draft, edited, "RECIPE_MATERIALIZATION_REJECTED");
    expect(canonicalizeJson(edited)).toBe(before);
  });

  it("rejects stale or forged handles without evaluating caller-owned getters", () => {
    const record = create();
    const draft = open(record);
    rejected(insert(record, "new"), draft, draft.record, "RECIPE_PROJECT_STALE");
    rejected(record, { ...draft }, draft.record, "RECIPE_TRANSACTION_INVALID");
    rejected(
      record,
      new Proxy(
        {},
        {
          get() {
            throw new Error("Must not read forged handle.");
          },
        },
      ),
      draft.record,
      "RECIPE_TRANSACTION_INVALID",
    );
    const invalid = createEditableProjectMasterDraft(
      record,
      {
        masterId: text.id,
        surfaceId: "home",
        expectedProjectDigest: digestCanonicalJson(fixture()),
      },
      [catalog],
    );
    expect(invalid.ok).toBe(false);
  });

  it("preserves namespace-equal state/resource aliases, unused resources and opaque extensions", () => {
    const definition: EditableProjectMasterDefinition = {
      ...text,
      state: { text: { schema: { type: "string" }, initial: "Keep local state" } },
      resources: { text: { use: "com.example.tasks/list", input: {}, policy: "manual" } },
      root: {
        ...text.root,
        extensions: {
          "test.opaque": { $ref: "state.text", type: "component.command", target: "unchanged" },
        },
      } as EditableProjectRecipeNode,
    };
    const record = create(definition);
    const draft = open(record);
    expect(draft.record.source.surfaces.home?.state).toEqual(definition.state);
    expect(draft.record.source.surfaces.home?.resources).toEqual(definition.resources);
    expect(apply(record, draft).record).toEqual(record);
    const edit = cloneRecipeJson(draft.record);
    required(edit.source.surfaces.home?.root.props).text = "Changed text";
    const updated = apply(record, draft, edit).record.designSystem.recipeGraph.definitions[0];
    expect(updated?.state).toEqual(definition.state);
    expect(updated?.resources).toEqual(definition.resources);
    expect(updated?.root).toMatchObject({
      extensions: (definition.root as EditableProjectRecipeNode).extensions,
    });
  });

  it("retains parent commands to nested roots and behavior-owned occurrence slots", () => {
    const field: EditableProjectMasterDefinition = {
      ...text,
      id: "master.field",
      root: {
        kind: "node",
        id: "field",
        use: "com.example.ui/TextField",
        props: { label: "Input", value: { $ref: "state.value" } },
        on: { change: [{ type: "state.set", path: "value", value: { $ref: "event.value" } }] },
      },
      state: { value: { schema: { type: "string" }, initial: "" } },
    };
    const parent: EditableProjectMasterDefinition = {
      ...text,
      id: "master.parent",
      root: {
        kind: "node",
        id: "parent",
        use: "com.example.ui/Stack",
        props: { direction: "vertical" },
        slots: {
          default: [
            { kind: "instance", id: "nested", masterId: field.id, overrides: [] },
            {
              kind: "node",
              id: "focus",
              use: "com.example.ui/Button",
              props: { label: "Focus" },
              on: {
                press: [
                  { type: "component.command", target: "nested", command: "focus", input: {} },
                ],
              },
            },
          ],
        },
        behaviors: [
          {
            id: "sort",
            use: "com.example.interactions/Sortable",
            props: { axis: "vertical" },
            slots: {
              dragPreview: [{ kind: "instance", id: "preview", masterId: text.id, overrides: [] }],
            },
          },
        ],
      },
    };
    const record = insert(create(parent, create(field, create())), "parent", parent.id);
    const draft = open(record, parent.id);
    expect(apply(record, draft).record).toEqual(record);
    const edit = cloneRecipeJson(draft.record);
    const button = required(
      indexRecipeSource(required(edit.source.surfaces.home)).nodes.get("focus"),
    ).node;
    required(button.props).label = "Focus the field";
    const result = apply(record, draft, edit).record;
    expect(result.designSystem.recipeGraph.instances[0]?.mapping).toEqual(
      record.designSystem.recipeGraph.instances[0]?.mapping,
    );
    const definition = required(
      result.designSystem.recipeGraph.definitions.find((item) => item.id === parent.id),
    );
    const root = definition.root as EditableProjectRecipeNode;
    const previousRoot = parent.root as EditableProjectRecipeNode;
    expect(root.behaviors).toEqual(previousRoot.behaviors);
    expect(root.slots?.default?.[0]).toEqual(previousRoot.slots?.default?.[0]);
    expect((root.slots?.default?.[1] as EditableProjectRecipeNode).on).toEqual(
      (previousRoot.slots?.default?.[1] as EditableProjectRecipeNode).on,
    );
  });

  it("rejects changed Catalog authority and malformed draft-open requests", () => {
    const record = create();
    const draft = open(record);
    const changedCatalog = cloneRecipeJson(catalog);
    changedCatalog.components["com.example.ui/Text"].description =
      "Another admitted Catalog identity";
    const changed = prepareEditableProjectMasterDraftUpdate(record, draft, draft.record, [
      changedCatalog,
    ]);
    expect(changed.ok).toBe(false);
    if (changed.ok) throw new Error("Expected a Catalog fence.");
    expect(changed.diagnostics[0].code).toBe("RECIPE_CATALOG_INVALID");
    const request = {
      masterId: text.id,
      surfaceId: "home",
      expectedProjectDigest: digestCanonicalJson(record),
    };
    let getterCalls = 0;
    const hostile = Object.defineProperty({ ...request }, "masterId", {
      get() {
        getterCalls++;
        return text.id;
      },
    });
    for (const invalid of [
      null,
      [],
      {},
      { ...request, extra: true },
      { ...request, masterId: "missing" },
      { ...request, surfaceId: "missing" },
      { ...request, expectedProjectDigest: null },
      hostile,
    ]) {
      expect(createEditableProjectMasterDraft(record, invalid, [catalog]).ok).toBe(false);
    }
    expect(getterCalls).toBe(0);
  });

  it.each(["other-surface", "definition", "metadata", "surface-metadata"])(
    "rejects out-of-scope %s edits",
    (target) => {
      const record = create();
      const draft = open(record);
      const edit = cloneRecipeJson(draft.record);
      if (target === "other-surface")
        required(edit.source.surfaces["sign-in"]?.root.props).gap = "lg";
      if (target === "definition")
        required(edit.designSystem.recipeGraph.definitions[0]).name = "Changed elsewhere";
      if (target === "metadata") edit.extensions = { "test.foreign": true };
      if (target === "surface-metadata")
        required(edit.source.surfaces.home).extensions = { "test.foreign": true };
      rejected(record, draft, edit, "RECIPE_REFERENCE_CONFLICT");
    },
  );
});
