import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import { recipeDefinitionDigest } from "../src/master-instance-materialization.js";
import { admitEditableProjectRecord } from "../src/project-record.js";
import { migrateEditableProjectRecord } from "../src/project-migrations.js";
import {
  createEditableProjectHistory,
  recordEditableProjectHistory,
  undoEditableProjectHistory,
  redoEditableProjectHistory,
} from "../src/project-history.js";
import { prepareEditableProjectRecipeTransaction } from "../src/recipe-transactions.js";

import type {
  EditableProjectMasterDefinition,
  EditableProjectRecipeNode,
} from "../src/master-instance-types.js";
import type { EditableProjectRecord } from "../src/project-record.js";
import type { MutableRecipeJson } from "../src/recipe-source.js";
import type { EditableProjectRecipeTransactionDiagnosticCode } from "../src/recipe-transaction-types.js";

function clone<Value>(value: Value): MutableRecipeJson<Value> {
  return JSON.parse(JSON.stringify(value)) as MutableRecipeJson<Value>;
}

function fixture(): EditableProjectRecord {
  const result = admitEditableProjectRecord({
    kind: "desen.editable-project",
    schemaVersion: 2,
    id: "project.recipes",
    source: validSource,
    designSystem: {
      tokenSources: [],
      recipes: [{ id: "legacy", name: "Inert" }],
      assets: [],
      recipeGraph: { definitions: [], instances: [] },
    },
    connectionIntents: [],
    extensions: { "test.inert": { text: "state.notAReference" } },
  });
  if (!result.ok) throw new Error("Invalid test fixture.");
  return result.record;
}

function run(record: EditableProjectRecord, operation: Record<string, unknown>) {
  const before = canonicalizeJson(record);
  const result = prepareEditableProjectRecipeTransaction(
    record,
    { expectedProjectDigest: digestCanonicalJson(record), ...operation },
    [validCatalog],
  );
  expect(result.ok, JSON.stringify(result)).toBe(true);
  expect(canonicalizeJson(record)).toBe(before);
  if (!result.ok) throw new Error("Recipe transaction rejected.");
  expect(result.previousDigest).toBe(digestCanonicalJson(record));
  expect(result.digest).toBe(digestCanonicalJson(result.record));
  expect(Object.isFrozen(result.record)).toBe(true);
  expect(Object.isFrozen(result.record.designSystem.recipeGraph)).toBe(true);
  expect(Object.isFrozen(result.affectedInstanceIds)).toBe(true);
  return result;
}

function rejected(
  record: EditableProjectRecord,
  operation: Record<string, unknown>,
  code?: EditableProjectRecipeTransactionDiagnosticCode,
) {
  const before = canonicalizeJson(record);
  const result = prepareEditableProjectRecipeTransaction(
    record,
    { expectedProjectDigest: digestCanonicalJson(record), ...operation },
    [validCatalog],
  );
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected atomic rejection.");
  if (code !== undefined) expect(result.diagnostics[0].code).toBe(code);
  expect(Object.hasOwn(result, "record")).toBe(false);
  expect(Object.hasOwn(result, "digest")).toBe(false);
  expect(canonicalizeJson(record)).toBe(before);
  return result;
}

function textMaster(text = "Master", id = "master.title"): EditableProjectMasterDefinition {
  return {
    id,
    name: "Reusable title",
    root: { kind: "node", id: "title", use: "com.example.ui/Text", props: { text } },
    state: {},
    resources: {},
  };
}

function instance(record: EditableProjectRecord, id: string) {
  const value = record.designSystem.recipeGraph.instances.find((item) => item.id === id);
  if (value === undefined) throw new Error("Expected linked instance.");
  return value;
}

function sourceNode(record: EditableProjectRecord, surfaceId: string, id: string) {
  type Node = EditableProjectRecord["source"]["surfaces"][string]["root"];
  function find(node: Node): Node | undefined {
    if (node.id === id) return node;
    const children = [
      ...Object.values(node.slots ?? {}).flat(),
      ...(node.behaviors ?? []).flatMap((behavior) => Object.values(behavior.slots ?? {}).flat()),
    ];
    for (const child of children) {
      const match = find(child);
      if (match !== undefined) return match;
    }
    return undefined;
  }
  const surface = record.source.surfaces[surfaceId];
  const value = surface === undefined ? undefined : find(surface.root);
  if (value === undefined) throw new Error("Expected materialized node.");
  return value;
}

function linkedNode(record: EditableProjectRecord, id: string) {
  const value = instance(record, id);
  return sourceNode(record, value.surfaceId, value.rootId);
}

function insert(
  record: EditableProjectRecord,
  id: string,
  masterId = "master.title",
  surfaceId = "home",
) {
  return run(record, {
    type: "instance.insert",
    instanceId: id,
    masterId,
    destination: { surfaceId, parentId: `${surfaceId}.layout`, slot: "default", index: 0 },
  }).record;
}

function update(record: EditableProjectRecord, definition: EditableProjectMasterDefinition) {
  return run(record, {
    type: "master.update",
    definition,
    expectedDefinitionDigest: recipeDefinitionDigest(
      record.designSystem.recipeGraph,
      definition.id,
    ),
  });
}

function address(definitionId = "master.title", path: readonly string[] = [], id = "title") {
  return { path, definitionId, kind: "node", id } as const;
}

describe("atomic recipe transaction preparation", () => {
  it("creates, captures and deletes definitions without changing unrelated Source or inert metadata", () => {
    const original = fixture();
    const created = run(original, { type: "master.create", definition: textMaster() });
    expect(created.record.source).toEqual(original.source);
    expect(created.affectedInstanceIds).toEqual([]);
    expect(created.record.designSystem.recipes).toEqual(original.designSystem.recipes);
    const deleted = run(created.record, { type: "master.delete", masterId: "master.title" });
    expect(deleted.record).toEqual(original);

    const captured = run(original, {
      type: "master.capture",
      masterId: "master.form",
      name: "Sign in",
      surfaceId: "sign-in",
      nodeId: "sign-in.layout",
      instanceId: "form.original",
    });
    expect(canonicalizeJson(captured.record.source)).toBe(canonicalizeJson(original.source));
    expect(captured.record.designSystem.recipeGraph.definitions[0]?.state).toEqual(
      original.source.surfaces["sign-in"]?.state,
    );
    const mapped = instance(captured.record, "form.original").mapping;
    expect(
      mapped.find(({ owner }) => owner.kind === "node" && owner.id === "sign-in.email")?.sourceId,
    ).toBe("sign-in.email");
    expect(
      mapped.find(({ owner }) => owner.kind === "state" && owner.id === "email")?.sourceId,
    ).toBe("email");
    expect(
      mapped.find(({ owner }) => owner.kind === "operation" && owner.id === "signIn")?.sourceId,
    ).toBe("signIn");
  });

  it("updates two linked instances, preserves an override, detaches a third, and restores whole history/reopen", () => {
    let record = run(fixture(), { type: "master.create", definition: textMaster() }).record;
    for (const id of ["first", "second", "third"]) record = insert(record, id);
    record = run(record, {
      type: "instance.override",
      instanceId: "second",
      override: {
        owner: address(),
        property: { kind: "prop", name: "text" },
        value: "Local",
      },
    }).record;
    const beforeDetach = record;
    const detachedRoot = instance(record, "third").rootId;
    record = run(record, { type: "instance.detach", instanceId: "third" }).record;
    expect(record.source).toEqual(beforeDetach.source);
    const afterDetach = record;
    const previousMappings = record.designSystem.recipeGraph.instances.map(
      ({ mapping }) => mapping,
    );
    const result = update(record, textMaster("Updated"));
    record = result.record;
    expect(result.affectedInstanceIds).toEqual(["first", "second"]);
    expect(record.designSystem.recipeGraph.instances.map(({ mapping }) => mapping)).toEqual(
      previousMappings,
    );
    expect(linkedNode(record, "first").props?.text).toBe("Updated");
    expect(linkedNode(record, "second").props?.text).toBe("Local");
    expect(sourceNode(record, "home", detachedRoot).props?.text).toBe("Master");
    const reset = run(record, {
      type: "instance.reset",
      instanceId: "second",
      owner: address(),
      property: { kind: "prop", name: "text" },
    });
    expect(linkedNode(reset.record, "second").props?.text).toBe("Updated");
    expect(instance(reset.record, "second").overrides).toEqual([]);

    const history = createEditableProjectHistory(beforeDetach);
    if (history === undefined) throw new Error("Expected history.");
    const detachEntry = recordEditableProjectHistory(history, afterDetach);
    const updateEntry = recordEditableProjectHistory(detachEntry.history, record);
    const undoUpdate = undoEditableProjectHistory(updateEntry.history);
    const undoDetach = undoEditableProjectHistory(undoUpdate.history);
    expect(undoUpdate.history.record).toEqual(afterDetach);
    expect(undoDetach.history.record).toEqual(beforeDetach);
    expect(redoEditableProjectHistory(undoDetach.history).history.record).toEqual(afterDetach);
    const reopened = migrateEditableProjectRecord(JSON.parse(canonicalizeJson(record)));
    expect(reopened.ok).toBe(true);
    if (reopened.ok) expect(reopened.digest).toBe(result.digest);
  });

  it("updates transitive nested definitions on multiple surfaces and keeps unaffected nested overrides", () => {
    let record = run(fixture(), { type: "master.create", definition: textMaster() }).record;
    const outer: EditableProjectMasterDefinition = {
      id: "master.pair",
      name: "Pair",
      state: {},
      resources: {},
      root: {
        kind: "node",
        id: "row",
        use: "com.example.ui/Stack",
        props: { direction: "horizontal" },
        slots: {
          default: ["left", "right"].map((id) => ({
            kind: "instance",
            id,
            masterId: "master.title",
            overrides: [],
          })),
        },
      },
    };
    record = run(record, { type: "master.create", definition: outer }).record;
    record = insert(record, "pair.home", "master.pair");
    record = insert(record, "pair.signIn", "master.pair", "sign-in");
    record = run(record, {
      type: "instance.override",
      instanceId: "pair.home",
      override: {
        owner: address("master.title", ["left"]),
        property: { kind: "prop", name: "text" },
        value: "Left local",
      },
    }).record;
    const ids = record.designSystem.recipeGraph.instances.map(({ mapping }) => mapping);
    const updated = update(record, textMaster("Everywhere"));
    expect(updated.affectedInstanceIds).toEqual(["pair.home", "pair.signIn"]);
    expect(updated.record.designSystem.recipeGraph.instances.map(({ mapping }) => mapping)).toEqual(
      ids,
    );
    expect(
      linkedNode(updated.record, "pair.home").slots?.default?.map((node) => node.props?.text),
    ).toEqual(["Left local", "Everywhere"]);
    expect(
      linkedNode(updated.record, "pair.signIn").slots?.default?.map((node) => node.props?.text),
    ).toEqual(["Everywhere", "Everywhere"]);
  });

  it("captures nested managed compositions as occurrences instead of flattening relationships", () => {
    let record = run(fixture(), { type: "master.create", definition: textMaster() }).record;
    record = insert(record, "nested.original");
    const before = record;
    record = run(record, {
      type: "master.capture",
      masterId: "master.page",
      name: "Page",
      surfaceId: "home",
      nodeId: "home.layout",
      instanceId: "page.original",
    }).record;
    expect(record.source).toEqual(before.source);
    expect(record.designSystem.recipeGraph.instances.map(({ id }) => id)).toEqual([
      "page.original",
    ]);
    const page = record.designSystem.recipeGraph.definitions.find(({ id }) => id === "master.page");
    if (page?.root.kind !== "node") throw new Error("Expected captured page.");
    expect(page.root.slots?.default?.[0]).toMatchObject({
      kind: "instance",
      masterId: "master.title",
    });
    const updated = update(record, textMaster("Still linked"));
    expect(updated.affectedInstanceIds).toEqual(["page.original"]);
    const formerRoot = instance(before, "nested.original").rootId;
    expect(sourceNode(updated.record, "home", formerRoot).props?.text).toBe("Still linked");
  });

  it("preserves valid equal-spelling identities across distinct Source namespaces during capture", () => {
    const mutable = clone(fixture());
    const field = mutable.source.surfaces["sign-in"]?.root.slots?.default?.find(
      ({ id }) => id === "sign-in.email",
    );
    if (field === undefined) throw new Error("Expected input.");
    field.id = "email";
    const captured = run(mutable, {
      type: "master.capture",
      masterId: "master.form",
      name: "Form",
      surfaceId: "sign-in",
      nodeId: "sign-in.layout",
      instanceId: "form",
    }).record;
    expect(captured.source).toEqual(mutable.source);
    expect(
      instance(captured, "form")
        .mapping.filter(({ sourceId }) => sourceId === "email")
        .map(({ owner }) => owner.kind)
        .sort(),
    ).toEqual(["node", "state"]);
  });

  it("retains mapping identities across safe structural additions, removals and reorder", () => {
    const title = textMaster().root;
    const definition: EditableProjectMasterDefinition = {
      id: "master.stack",
      name: "Stack",
      state: {},
      resources: {},
      root: {
        kind: "node",
        id: "stack",
        use: "com.example.ui/Stack",
        props: { direction: "vertical" },
        slots: { default: [title] },
      },
    };
    let record = run(fixture(), { type: "master.create", definition }).record;
    record = insert(record, "stack", definition.id);
    const originalTitle = instance(record, "stack").mapping.find(
      ({ owner }) => owner.id === "title",
    )?.sourceId;
    const root = definition.root as EditableProjectRecipeNode;
    record = update(record, {
      ...definition,
      root: {
        ...root,
        slots: {
          default: [
            { kind: "node", id: "subtitle", use: "com.example.ui/Text", props: { text: "New" } },
            title,
          ],
        },
      },
    }).record;
    expect(linkedNode(record, "stack").slots?.default?.[1]?.id).toBe(originalTitle);
    record = update(record, definition).record;
    expect(linkedNode(record, "stack").slots?.default).toHaveLength(1);
    expect(linkedNode(record, "stack").slots?.default?.[0]?.id).toBe(originalTitle);
  });

  it("treats repeated same-value overrides and reset-without-override as complete canonical no-ops", () => {
    let record = run(fixture(), { type: "master.create", definition: textMaster() }).record;
    record = insert(record, "title");
    const reset = {
      type: "instance.reset",
      instanceId: "title",
      owner: address(),
      property: { kind: "prop", name: "text" },
    };
    expect(run(record, reset).changed).toBe(false);
    const text = {
      type: "instance.override",
      instanceId: "title",
      override: { owner: address(), property: { kind: "prop", name: "text" }, value: "Local" },
    };
    record = run(record, text).record;
    record = run(record, {
      type: "instance.override",
      instanceId: "title",
      override: {
        owner: address(),
        property: { kind: "prop", name: "role" },
        value: "heading",
      },
    }).record;
    const before = canonicalizeJson(record);
    const repeated = run(record, text);
    expect(repeated.changed).toBe(false);
    expect(canonicalizeJson(repeated.record)).toBe(before);
    expect(repeated.affectedInstanceIds).toEqual([]);
  });

  it("rejects stale projects and definitions, unknown commands and duplicate identities", () => {
    const record = run(fixture(), { type: "master.create", definition: textMaster() }).record;
    rejected(
      record,
      {
        type: "master.delete",
        masterId: "master.title",
        expectedProjectDigest: digestCanonicalJson(fixture()),
      },
      "RECIPE_PROJECT_STALE",
    );
    rejected(
      record,
      {
        type: "master.update",
        definition: textMaster("New"),
        expectedDefinitionDigest: digestCanonicalJson({ stale: true }),
      },
      "RECIPE_DEFINITION_STALE",
    );
    rejected(
      record,
      { type: "master.create", definition: textMaster() },
      "RECIPE_IDENTITY_CONFLICT",
    );
    rejected(record, { type: "unknown" }, "RECIPE_TRANSACTION_INVALID");
    rejected(record, { type: "master.delete", masterId: "missing" }, "RECIPE_TARGET_INVALID");
    rejected(
      record,
      { type: "master.delete", masterId: "master.title", ignored: true },
      "RECIPE_TRANSACTION_INVALID",
    );
    const linked = insert(record, "existing");
    rejected(
      linked,
      {
        type: "instance.insert",
        instanceId: "existing",
        masterId: "master.title",
        destination: { surfaceId: "home", parentId: "home.layout", slot: "default", index: 0 },
      },
      "RECIPE_IDENTITY_CONFLICT",
    );
    rejected(
      linked,
      { type: "master.delete", masterId: "master.title" },
      "RECIPE_REFERENCE_CONFLICT",
    );
  });

  it("rejects recursive masters, unknown capabilities and invalid overrides even when structurally valid", () => {
    const record = fixture();
    rejected(
      record,
      {
        type: "master.create",
        definition: {
          ...textMaster(),
          root: { kind: "instance", id: "self", masterId: "master.title", overrides: [] },
        },
      },
      "RECIPE_MATERIALIZATION_REJECTED",
    );
    rejected(
      record,
      {
        type: "master.create",
        definition: { ...textMaster(), root: { ...textMaster().root, use: "com.foreign/Widget" } },
      },
      "RECIPE_SEMANTIC_INVALID",
    );
    const linked = insert(
      run(record, { type: "master.create", definition: textMaster() }).record,
      "title",
    );
    for (const property of [
      { kind: "prop", name: "missing" },
      { kind: "style", state: "default", part: "private", name: "color" },
    ]) {
      rejected(
        linked,
        {
          type: "instance.override",
          instanceId: "title",
          override: { owner: address(), property, value: "invalid" },
        },
        "RECIPE_SEMANTIC_INVALID",
      );
    }
    rejected(
      linked,
      {
        type: "instance.override",
        instanceId: "title",
        override: { owner: address(), property: { kind: "prop", name: "text" }, value: 42 },
      },
      "RECIPE_SEMANTIC_INVALID",
    );
    rejected(
      linked,
      {
        type: "instance.reset",
        instanceId: "title",
        owner: address("master.missing"),
        property: { kind: "prop", name: "text" },
      },
      "RECIPE_TARGET_INVALID",
    );
  });

  it("rejects a structural master edit that removes an override target without changing either instance", () => {
    let record = insert(
      run(fixture(), { type: "master.create", definition: textMaster() }).record,
      "first",
    );
    record = insert(record, "second");
    record = run(record, {
      type: "instance.override",
      instanceId: "second",
      override: { owner: address(), property: { kind: "prop", name: "text" }, value: "Local" },
    }).record;
    rejected(
      record,
      {
        type: "master.update",
        expectedDefinitionDigest: recipeDefinitionDigest(
          record.designSystem.recipeGraph,
          "master.title",
        ),
        definition: { ...textMaster(), root: { ...textMaster().root, id: "replacement" } },
      },
      "RECIPE_MATERIALIZATION_REJECTED",
    );
  });

  it("rejects deleting an instance with surviving external state wiring but permits detached deletion", () => {
    const original = fixture();
    const captured = run(original, {
      type: "master.capture",
      masterId: "master.email",
      name: "Email",
      surfaceId: "sign-in",
      nodeId: "sign-in.email",
      instanceId: "email",
    }).record;
    // The ordinary sign-in submit still reads the selected field's state.email.
    rejected(
      captured,
      { type: "instance.delete", instanceId: "email" },
      "RECIPE_REFERENCE_CONFLICT",
    );
    const detached = run(captured, { type: "instance.detach", instanceId: "email" }).record;
    expect(detached.source).toEqual(original.source);
    const deletedMaster = run(detached, { type: "master.delete", masterId: "master.email" }).record;
    expect(deletedMaster).toEqual(original);
  });

  it("deletes an unreferenced instance and then its unused master atomically", () => {
    const original = fixture();
    const linked = insert(
      run(original, { type: "master.create", definition: textMaster() }).record,
      "title",
    );
    const removed = run(linked, { type: "instance.delete", instanceId: "title" });
    expect(removed.affectedInstanceIds).toEqual(["title"]);
    expect(removed.record.source).toEqual(original.source);
    expect(run(removed.record, { type: "master.delete", masterId: "master.title" }).record).toEqual(
      original,
    );
  });

  it.each(["node", "resource", "operation"] as const)(
    "rejects deleting a managed %s identity still referenced by an ordinary outside owner",
    (kind) => {
      const root: EditableProjectRecipeNode =
        kind === "node"
          ? {
              kind: "node",
              id: "control",
              use: "com.example.ui/TextField",
              props: { label: "Input", value: "" },
            }
          : {
              kind: "node",
              id: "control",
              use: "com.example.ui/Button",
              props: { label: "Action" },
              on: {
                press:
                  kind === "resource"
                    ? [{ type: "resource.refresh", resource: "items" }]
                    : [
                        {
                          type: "operation.invoke",
                          operation: "com.example.auth/signIn",
                          as: "request",
                          input: { email: "user@example.test", password: "local" },
                        },
                      ],
              },
            };
      const definition: EditableProjectMasterDefinition = {
        id: "master.control",
        name: "Control",
        root,
        state: {},
        resources:
          kind === "resource"
            ? { items: { use: "com.example.tasks/list", input: {}, policy: "manual" } }
            : {},
      };
      const linked = insert(
        run(fixture(), { type: "master.create", definition }).record,
        "control",
        definition.id,
      );
      const target = instance(linked, "control").mapping.find(
        ({ owner }) => owner.kind === kind,
      )?.sourceId;
      if (target === undefined) throw new Error("Expected mapped target.");
      const mutable = clone(linked);
      const children = mutable.source.surfaces.home?.root.slots?.default;
      if (children === undefined) throw new Error("Expected ordinary slot.");
      children.push({
        id: "outside.observer",
        use: "com.example.ui/Button",
        props: {
          label: "Observe",
          ...(kind === "operation" ? { loading: { $ref: `operation.${target}.pending` } } : {}),
        },
        ...(kind === "operation"
          ? {}
          : {
              on: {
                press:
                  kind === "node"
                    ? [{ type: "component.command", target, command: "focus", input: {} }]
                    : [{ type: "resource.refresh", resource: target }],
              },
            }),
      });
      // Prove this is valid starting wiring rather than an already-invalid candidate.
      const before = run(mutable, {
        type: "instance.reset",
        instanceId: "control",
        owner: address(definition.id, [], "control"),
        property: { kind: "prop", name: "label" },
      });
      expect(before.changed).toBe(false);
      rejected(
        before.record,
        { type: "instance.delete", instanceId: "control" },
        "RECIPE_REFERENCE_CONFLICT",
      );
    },
  );

  it("does not mistake opaque reference-shaped extensions for surviving wiring", () => {
    const linked = insert(
      run(fixture(), { type: "master.create", definition: textMaster() }).record,
      "title",
    );
    const target = instance(linked, "title").rootId;
    const mutable = clone(linked);
    const root = mutable.source.surfaces.home?.root;
    if (root === undefined) throw new Error("Expected surface.");
    root.extensions = {
      "test.opaque": { type: "component.command", target, $ref: `state.${target}` },
    };
    const deleted = run(mutable, { type: "instance.delete", instanceId: "title" });
    expect(deleted.record.source.surfaces.home?.root.extensions).toEqual(root.extensions);
  });

  it("allocates around an existing unmanaged identity deterministically instead of overwriting it", () => {
    const created = run(fixture(), { type: "master.create", definition: textMaster() }).record;
    const firstAllocation = instance(insert(created, "new"), "new").rootId;
    const mutable = clone(created);
    mutable.source.surfaces.home?.root.slots?.default?.push({
      id: firstAllocation,
      use: "com.example.ui/Text",
      props: { text: "Existing ordinary content" },
    });
    const left = insert(mutable, "new");
    const right = insert(mutable, "new");
    expect(left).toEqual(right);
    expect(instance(left, "new").rootId).not.toBe(firstAllocation);
    expect(sourceNode(left, "home", firstAllocation).props?.text).toBe("Existing ordinary content");
  });

  it("rejects managed insertion, internal capture, missing destinations and direct surface-root deletion", () => {
    const captured = run(fixture(), {
      type: "master.capture",
      masterId: "master.form",
      name: "Form",
      surfaceId: "sign-in",
      nodeId: "sign-in.layout",
      instanceId: "form",
    }).record;
    rejected(
      captured,
      {
        type: "instance.insert",
        instanceId: "nested",
        masterId: "master.form",
        destination: {
          surfaceId: "sign-in",
          parentId: "sign-in.layout",
          slot: "default",
          index: 0,
        },
      },
      "RECIPE_REFERENCE_CONFLICT",
    );
    rejected(
      captured,
      {
        type: "master.capture",
        masterId: "master.internal",
        name: "Internal",
        surfaceId: "sign-in",
        nodeId: "sign-in.email",
        instanceId: "internal",
      },
      "RECIPE_MATERIALIZATION_REJECTED",
    );
    rejected(captured, { type: "instance.delete", instanceId: "form" }, "RECIPE_TARGET_INVALID");
    rejected(
      captured,
      {
        type: "instance.insert",
        instanceId: "missing",
        masterId: "master.form",
        destination: { surfaceId: "missing", parentId: "missing", slot: "default", index: 0 },
      },
      "RECIPE_TARGET_INVALID",
    );
  });

  it("rejects hostile command values without invoking accessors and exposes no partial candidate", () => {
    let called = 0;
    const hostile = Object.defineProperty({}, "type", {
      enumerable: true,
      get() {
        called++;
        return "master.delete";
      },
    });
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const value of [
      hostile,
      revoked.proxy,
      null,
      {
        type: "master.delete",
        expectedProjectDigest: digestCanonicalJson(fixture()),
        masterId: "master.title",
        callback: () => {
          called++;
        },
      },
    ]) {
      const result = prepareEditableProjectRecipeTransaction(fixture(), value, [validCatalog]);
      expect(result.ok).toBe(false);
      expect(Object.hasOwn(result, "record")).toBe(false);
    }
    expect(called).toBe(0);
    const invalidCatalog = prepareEditableProjectRecipeTransaction(
      fixture(),
      {
        type: "master.create",
        definition: textMaster(),
        expectedProjectDigest: digestCanonicalJson(fixture()),
      },
      [{}],
    );
    expect(invalidCatalog).toMatchObject({
      ok: false,
      diagnostics: [{ code: "RECIPE_CATALOG_INVALID" }],
    });
  });
});
