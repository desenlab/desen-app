import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import { admitEditableProjectRecord } from "../src/project-record.js";
import {
  prepareEditableProjectRecipeTransaction,
  getEditableProjectMasterDefinitionDigest,
} from "../src/recipe-transactions.js";
import { cloneRecipeJson, indexRecipeSource } from "../src/recipe-source.js";

import type { EditableProjectMasterDefinition } from "../src/master-instance-types.js";
import type { EditableProjectRecord } from "../src/project-record.js";

function initial(): EditableProjectRecord {
  const result = admitEditableProjectRecord({
    kind: "desen.editable-project",
    schemaVersion: 2,
    id: "source-edits",
    source: validSource,
    designSystem: {
      tokenSources: [],
      recipes: [],
      assets: [],
      recipeGraph: { definitions: [], instances: [] },
    },
    connectionIntents: [],
  });
  if (!result.ok) throw new Error("Invalid fixture.");
  return result.record;
}

function apply(record: EditableProjectRecord, operation: Record<string, unknown>) {
  const before = canonicalizeJson(record);
  const result = prepareEditableProjectRecipeTransaction(
    record,
    { ...operation, expectedProjectDigest: digestCanonicalJson(record) },
    [validCatalog],
  );
  expect(canonicalizeJson(record)).toBe(before);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error("Rejected operation.");
  return result;
}

function reject(record: EditableProjectRecord, source: unknown) {
  const before = canonicalizeJson(record);
  const candidateBefore = canonicalizeJson(source);
  const result = prepareEditableProjectRecipeTransaction(
    record,
    { type: "source.apply", source, expectedProjectDigest: digestCanonicalJson(record) },
    [validCatalog],
  );
  expect(result.ok).toBe(false);
  expect(Object.hasOwn(result, "record")).toBe(false);
  expect(canonicalizeJson(record)).toBe(before);
  expect(canonicalizeJson(source)).toBe(candidateBefore);
  return result;
}

function text(): EditableProjectMasterDefinition {
  return {
    id: "text",
    name: "Text",
    root: { kind: "node", id: "label", use: "com.example.ui/Text", props: { text: "Master" } },
    state: {},
    resources: {},
  };
}

function input(): EditableProjectMasterDefinition {
  return {
    id: "input",
    name: "Input",
    root: {
      kind: "node",
      id: "field",
      use: "com.example.ui/TextField",
      props: { label: "Field", value: "" },
    },
    state: { input: { schema: { type: "string" }, initial: "Seed" } },
    resources: {},
  };
}

function setup(definition = text()) {
  let record = apply(initial(), { type: "master.create", definition }).record;
  for (const instanceId of ["first", "second"])
    record = apply(record, {
      type: "instance.insert",
      instanceId,
      masterId: definition.id,
      destination: { surfaceId: "home", parentId: "home.layout", slot: "default", index: 0 },
    }).record;
  return record;
}

function instance(record: EditableProjectRecord, id = "first") {
  const result = record.designSystem.recipeGraph.instances.find((item) => item.id === id);
  if (result === undefined) throw new Error("Missing instance.");
  return result;
}

function edit(record: EditableProjectRecord, id = "first") {
  const source = cloneRecipeJson(record.source);
  const owner = instance(record, id);
  const surface = source.surfaces[owner.surfaceId];
  if (surface === undefined) throw new Error("Missing surface.");
  const index = indexRecipeSource(surface);
  const node = index.nodes.get(owner.rootId)?.node;
  if (node === undefined) throw new Error("Missing node.");
  return { source, surface, node, index };
}

describe("ordinary Source edits over managed instances", () => {
  it("records prop and style overrides while preserving the exact requested Source and all mappings", () => {
    const record = setup();
    const { source, node } = edit(record);
    node.props = { ...node.props, text: "Local", role: "caption" };
    node.style = { base: { text: { color: "#112233" } } };
    source.extensions = { note: "Unmanaged metadata survives the same transaction" };
    const result = apply(record, { type: "source.apply", source });
    expect(result.record.source).toEqual(source);
    expect(result.affectedInstanceIds).toEqual(["first"]);
    expect(instance(result.record).mapping).toEqual(instance(record).mapping);
    expect(instance(result.record).overrides).toHaveLength(3);
    expect(instance(result.record, "second")).toEqual(instance(record, "second"));
    const master = text();
    const updated = apply(result.record, {
      type: "master.update",
      definition: { ...master, root: { ...master.root, props: { text: "Next master" } } },
      expectedDefinitionDigest: getEditableProjectMasterDefinitionDigest(result.record, master.id),
    });
    expect(edit(updated.record).node.props?.text).toBe("Local");
    expect(edit(updated.record, "second").node.props?.text).toBe("Next master");
  });

  it("removes a genuinely added override without replacing inherited fields or empty container authority", () => {
    const record = setup();
    const candidate = edit(record);
    candidate.node.props = { ...candidate.node.props, role: "caption" };
    const added = apply(record, { type: "source.apply", source: candidate.source }).record;
    const removing = edit(added);
    if (removing.node.props !== undefined) delete removing.node.props.role;
    const reset = apply(added, { type: "source.apply", source: removing.source });
    expect(reset.record).toEqual(record);
    const inherited = edit(record);
    inherited.node.props = {};
    reject(record, inherited.source);
  });

  it("inverts a Source state alias into the instance's local override scope without aliasing another instance", () => {
    const record = setup(input());
    const { source, node } = edit(record);
    const mapped = instance(record).mapping.find(({ owner }) => owner.kind === "state");
    const other = instance(record, "second").mapping.find(({ owner }) => owner.kind === "state");
    if (mapped === undefined || other === undefined) throw new Error("Missing aliases.");
    node.props = {
      ...node.props,
      value: { $ref: `state.${mapped.sourceId}` },
      label: `state.${mapped.sourceId}`,
    };
    const result = apply(record, { type: "source.apply", source });
    expect(result.record.source).toEqual(source);
    const overrides = instance(result.record).overrides;
    expect(overrides.find(({ property }) => property.name === "value")?.value).toEqual({
      $ref: "state.input",
    });
    expect(overrides.find(({ property }) => property.name === "label")?.value).toBe(
      `state.${mapped.sourceId}`,
    );
    const crossInstance = edit(result.record);
    crossInstance.node.props = {
      ...crossInstance.node.props,
      value: { $ref: `state.${other.sourceId}` },
    };
    reject(result.record, crossInstance.source);
  });

  it("addresses nested occurrences by stable path and rejects cross-occurrence binding scope", () => {
    const leaf = input();
    let record = apply(initial(), { type: "master.create", definition: leaf }).record;
    const pair = {
      id: "pair",
      name: "Pair",
      state: {},
      resources: {},
      root: {
        kind: "node",
        id: "row",
        use: "com.example.ui/Stack",
        slots: {
          default: ["left", "right"].map((id) => ({
            kind: "instance",
            id,
            masterId: leaf.id,
            overrides: [],
          })),
        },
      },
    };
    record = apply(record, { type: "master.create", definition: pair }).record;
    record = apply(record, {
      type: "instance.insert",
      instanceId: "first",
      masterId: pair.id,
      destination: { surfaceId: "home", parentId: "home.layout", slot: "default", index: 0 },
    }).record;
    const { source, index } = edit(record);
    const mapping = instance(record).mapping;
    const rightOwner = mapping.find(
      ({ owner }) => owner.kind === "node" && owner.path[0] === "right",
    );
    const rightState = mapping.find(
      ({ owner }) => owner.kind === "state" && owner.path[0] === "right",
    );
    const leftState = mapping.find(
      ({ owner }) => owner.kind === "state" && owner.path[0] === "left",
    );
    const node = rightOwner === undefined ? undefined : index.nodes.get(rightOwner.sourceId)?.node;
    if (node === undefined || rightState === undefined || leftState === undefined)
      throw new Error("Missing nested scope.");
    node.props = { ...node.props, value: { $ref: `state.${rightState.sourceId}` } };
    const result = apply(record, { type: "source.apply", source });
    expect(instance(result.record).overrides[0]).toMatchObject({
      owner: { path: ["right"], definitionId: "input", id: "field" },
      value: { $ref: "state.input" },
    });
    node.props.value = { $ref: `state.${leftState.sourceId}` };
    reject(record, source);
  });

  it("inverts nested fallback and format bindings while preserving format templates", () => {
    const record = setup(input());
    const { source, node } = edit(record);
    const mapped = instance(record).mapping.find(({ owner }) => owner.kind === "state");
    if (mapped === undefined) throw new Error("Missing alias.");
    const formatted = {
      $format: {
        template: "Value: {value}",
        values: { value: { $ref: `state.${mapped.sourceId}` } },
      },
    };
    node.props = {
      ...node.props,
      value: { $ref: `state.${mapped.sourceId}`, fallback: formatted },
      label: formatted,
    };
    const result = apply(record, { type: "source.apply", source });
    expect(result.record.source).toEqual(source);
    const local = {
      $format: { template: "Value: {value}", values: { value: { $ref: "state.input" } } },
    };
    expect(
      instance(result.record).overrides.find(({ property }) => property.name === "value")?.value,
    ).toEqual({ $ref: "state.input", fallback: local });
    expect(
      instance(result.record).overrides.find(({ property }) => property.name === "label")?.value,
    ).toEqual(local);
  });

  it("deletes a whole instance and its owned declarations, but never a still-referenced target", () => {
    const record = setup(input());
    const candidate = edit(record);
    const owner = instance(record);
    const mapping = owner.mapping.find(({ owner }) => owner.kind === "state");
    if (mapping === undefined) throw new Error("Missing state.");
    candidate.surface.root.slots = {
      default: candidate.surface.root.slots?.default?.filter(({ id }) => id !== owner.rootId) ?? [],
    };
    const deleted = apply(record, { type: "source.apply", source: candidate.source });
    expect(deleted.record.designSystem.recipeGraph.instances).toHaveLength(1);
    expect(deleted.record.source.surfaces.home?.state).not.toHaveProperty(mapping.sourceId);
    expect(deleted.affectedInstanceIds).toEqual(["first"]);
    candidate.surface.root.slots.default?.push({
      id: "external",
      use: "com.example.ui/Text",
      props: { text: { $ref: `state.${mapping.sourceId}` } },
    });
    reject(record, candidate.source);
  });

  it("does not silently overwrite managed declarations or reuse a deleted instance's owned state", () => {
    const record = setup(input());
    const candidate = edit(record);
    const mapped = instance(record).mapping.find(({ owner }) => owner.kind === "state");
    if (mapped === undefined) throw new Error("Missing state.");
    candidate.surface.state[mapped.sourceId] = {
      schema: { type: "string" },
      initial: "Untracked edit",
    };
    candidate.node.props = { ...candidate.node.props, label: "Otherwise valid" };
    reject(record, candidate.source);
    candidate.surface.root.slots = {
      default:
        candidate.surface.root.slots?.default?.filter(({ id }) => id !== instance(record).rootId) ??
        [],
    };
    reject(record, candidate.source);
  });

  it("rejects a managed structural or handler edit without exposing a preceding valid override", () => {
    const record = setup();
    const candidate = edit(record);
    candidate.node.props = { ...candidate.node.props, text: "Would be valid" };
    const other = candidate.index.nodes.get(instance(record, "second").rootId)?.node;
    if (other === undefined) throw new Error("Missing other node.");
    other.use = "com.example.ui/Stack";
    reject(record, candidate.source);
    other.use = "com.example.ui/Text";
    other.on = {};
    reject(record, candidate.source);
  });

  it("allows intact instance movement and detached duplication without inventing a new relationship", () => {
    const record = setup();
    const candidate = edit(record);
    candidate.surface.root.slots?.default?.reverse();
    const moved = apply(record, { type: "source.apply", source: candidate.source });
    expect(moved.record.source).toEqual(candidate.source);
    expect(moved.record.designSystem.recipeGraph).toEqual(record.designSystem.recipeGraph);
    const duplicate = cloneRecipeJson(candidate.node);
    duplicate.id = "detached-copy";
    candidate.surface.root.slots?.default?.push(duplicate);
    const copied = apply(moved.record, { type: "source.apply", source: candidate.source });
    expect(copied.record.designSystem.recipeGraph.instances).toHaveLength(2);
    expect(copied.record.source).toEqual(candidate.source);
  });

  it("keeps a canonical Source no-op unchanged", () => {
    const record = setup();
    const result = apply(record, { type: "source.apply", source: record.source });
    expect(result.changed).toBe(false);
    expect(result.record).toEqual(record);
    expect(result.affectedInstanceIds).toEqual([]);
  });

  it("never turns a cross-surface move into an implicit detach", () => {
    const record = setup();
    const candidate = edit(record);
    const destination = candidate.source.surfaces["sign-in"];
    if (destination === undefined) throw new Error("Missing destination.");
    candidate.surface.root.slots = {
      default:
        candidate.surface.root.slots?.default?.filter(({ id }) => id !== candidate.node.id) ?? [],
    };
    destination.root.slots?.default?.push(candidate.node);
    reject(record, candidate.source);
    const detached = apply(record, { type: "instance.detach", instanceId: "first" }).record;
    const moved = apply(detached, { type: "source.apply", source: candidate.source });
    expect(moved.record.source).toEqual(candidate.source);
    expect(moved.record.designSystem.recipeGraph).toEqual(detached.designSystem.recipeGraph);
  });
});
