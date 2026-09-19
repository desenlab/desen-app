import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  equalRecipeMaterialization,
  materializeRecipeInstance,
  RecipeMaterializationError,
  recipeDefinitionDigest,
  recipeOwnerKey,
} from "../src/master-instance-materialization.js";

import type { RecipeMaterialization } from "../src/master-instance-materialization.js";
import type {
  EditableProjectInstanceOverride,
  EditableProjectMasterDefinition,
  EditableProjectRecipeChild,
  EditableProjectRecipeGraph,
  EditableProjectRecipeNode,
  EditableProjectRecipeOwner,
} from "../src/master-instance-types.js";

function node(
  id: string,
  fields: Partial<EditableProjectRecipeNode> = {},
): EditableProjectRecipeNode {
  return {
    kind: "node",
    id,
    use: "com.example.ui/Text",
    props: { text: "Master text" },
    ...fields,
  };
}

function master(
  id: string,
  root: EditableProjectRecipeChild = node("title"),
  fields: Partial<EditableProjectMasterDefinition> = {},
): EditableProjectMasterDefinition {
  return { id, name: id, root, state: {}, resources: {}, ...fields };
}

function graph(...definitions: EditableProjectMasterDefinition[]): EditableProjectRecipeGraph {
  return { definitions, instances: [] };
}

function owner(
  kind: EditableProjectRecipeOwner["kind"],
  id: string,
  definitionId = "master.card",
  path: readonly string[] = [],
): EditableProjectRecipeOwner {
  return { kind, id, definitionId, path };
}

function mapped(result: RecipeMaterialization, address: EditableProjectRecipeOwner): string {
  const entry = result.mapping.find(
    ({ owner: candidate }) => recipeOwnerKey(candidate) === recipeOwnerKey(address),
  );
  if (entry === undefined) throw new TypeError("Expected a complete conceptual-owner mapping.");
  return entry.sourceId;
}

function expectFailure(run: () => unknown, reason: string): void {
  let captured: unknown;
  try {
    run();
  } catch (error) {
    captured = error;
  }
  expect(captured).toBeInstanceOf(RecipeMaterializationError);
  expect(captured).toMatchObject({ reason });
}

function signInMaster(): EditableProjectMasterDefinition {
  function convert(raw: unknown): unknown {
    const value = raw as Record<string, unknown>;
    const slots = value.slots as Record<string, readonly unknown[]> | undefined;
    return {
      ...value,
      kind: "node",
      ...(slots === undefined
        ? {}
        : {
            slots: Object.fromEntries(
              Object.entries(slots).map(([name, children]) => [name, children.map(convert)]),
            ),
          }),
    };
  }
  return {
    id: "master.card",
    name: "Sign in",
    state: validSource.surfaces["sign-in"].state,
    resources: {},
    root: convert(validSource.surfaces["sign-in"].root),
  } as EditableProjectMasterDefinition;
}

describe("internal recipe materialization", () => {
  it("deterministically isolates two instances of a complete existing Source composition", () => {
    const input = graph(signInMaster());
    const before = canonicalizeJson(input);
    const first = materializeRecipeInstance(input, "master.card", "instance.first");
    const same = materializeRecipeInstance(input, "master.card", "instance.first");
    const second = materializeRecipeInstance(input, "master.card", "instance.second");

    expect(equalRecipeMaterialization(first, same)).toBe(true);
    expect(first.definitionDigest).toBe(second.definitionDigest);
    expect(first.materializedDigest).not.toBe(second.materializedDigest);
    const firstIds = new Set(first.mapping.map(({ sourceId }) => sourceId));
    expect(second.mapping.every(({ sourceId }) => !firstIds.has(sourceId))).toBe(true);
    expect(Object.keys(first.state).sort()).toEqual(
      [mapped(first, owner("state", "email")), mapped(first, owner("state", "password"))].sort(),
    );
    expect(first.root.slots?.default?.[1]?.props?.value).toEqual({
      $ref: `state.${mapped(first, owner("state", "email"))}`,
    });
    expect(first.root.slots?.default?.[4]?.on?.press?.[0]).toMatchObject({
      as: mapped(first, owner("operation", "signIn")),
      input: { email: { $ref: `state.${mapped(first, owner("state", "email"))}` } },
    });
    expect(
      first.mapping.every(({ sourceId }) => /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u.test(sourceId)),
    ).toBe(true);
    expect(first.materializedDigest).toBe(
      digestCanonicalJson({ root: first.root, state: first.state, resources: first.resources }),
    );
    expect(Object.isFrozen(first.root)).toBe(true);
    expect(Object.isFrozen(first.mapping)).toBe(true);
    expect(canonicalizeJson(input)).toBe(before);
  });

  it("qualifies repeated nested masters by occurrence path and keeps those IDs on reorder", () => {
    const leaf = master(
      "master.leaf",
      node("title", { props: { text: { $ref: "state.label" } } }),
      {
        state: { label: { schema: { type: "string" }, initial: "Nested" } },
      },
    );
    const left = { kind: "instance", id: "left", masterId: leaf.id, overrides: [] } as const;
    const right = { kind: "instance", id: "right", masterId: leaf.id, overrides: [] } as const;
    const outer = master(
      "master.card",
      node("container", {
        use: "com.example.ui/Stack",
        slots: { default: [left, right] },
      }),
    );
    const initial = materializeRecipeInstance(graph(outer, leaf), outer.id, "instance.card");
    const leftId = mapped(initial, owner("node", "title", leaf.id, ["left"]));
    const rightId = mapped(initial, owner("node", "title", leaf.id, ["right"]));
    expect(leftId).not.toBe(rightId);
    expect(initial.root.slots?.default?.map(({ id }) => id)).toEqual([leftId, rightId]);
    expect(initial.root.slots?.default?.[0]?.props?.text).toEqual({
      $ref: `state.${mapped(initial, owner("state", "label", leaf.id, ["left"]))}`,
    });
    expect(initial.root.slots?.default?.[1]?.props?.text).toEqual({
      $ref: `state.${mapped(initial, owner("state", "label", leaf.id, ["right"]))}`,
    });

    const reordered = master(
      outer.id,
      node("container", {
        use: "com.example.ui/Stack",
        slots: { default: [right, left] },
      }),
    );
    const updatedLeaf = {
      ...leaf,
      root: node("title", { props: { text: "Updated nested master" } }),
    };
    const changed = materializeRecipeInstance(
      graph(updatedLeaf, reordered),
      outer.id,
      "instance.card",
      initial.mapping,
    );
    expect(changed.mapping).toEqual(initial.mapping);
    expect(changed.root.slots?.default?.map(({ id }) => id)).toEqual([rightId, leftId]);
    expect(
      changed.root.slots?.default?.every(({ props }) => props?.text === "Updated nested master"),
    ).toBe(true);
    expect(changed.definitionDigest).not.toBe(initial.definitionDigest);
    expect(recipeDefinitionDigest(graph(leaf, outer), outer.id)).toBe(initial.definitionDigest);
  });

  it("applies nested defaults before an explicit local override and reset restores the updated master", () => {
    const leaf = master("master.leaf");
    const occurrenceOverride: EditableProjectInstanceOverride = {
      owner: owner("node", "title", leaf.id),
      property: { kind: "prop", name: "text" },
      value: "Occurrence text",
    };
    const outer = master("master.card", {
      kind: "instance",
      id: "child",
      masterId: leaf.id,
      overrides: [occurrenceOverride],
    });
    const local: EditableProjectInstanceOverride[] = [
      {
        ...occurrenceOverride,
        owner: owner("node", "title", leaf.id, ["child"]),
        value: "Instance text",
      },
      {
        owner: owner("node", "title", leaf.id, ["child"]),
        property: { kind: "style", state: "default", part: "root", name: "color" },
        value: "#333333",
      },
    ];
    const initial = materializeRecipeInstance(
      graph(outer, leaf),
      outer.id,
      "instance.card",
      [],
      local,
    );
    expect(initial.root.props?.text).toBe("Instance text");
    expect(initial.root.style).toEqual({ default: { root: { color: "#333333" } } });

    const updatedOuter = {
      ...outer,
      root: { ...outer.root, overrides: [] },
    } as EditableProjectMasterDefinition;
    const updatedLeaf = { ...leaf, root: node("title", { props: { text: "Updated master" } }) };
    const preserved = materializeRecipeInstance(
      graph(updatedOuter, updatedLeaf),
      outer.id,
      "instance.card",
      initial.mapping,
      local,
    );
    expect(preserved.root.id).toBe(initial.root.id);
    expect(preserved.root.props?.text).toBe("Instance text");
    const reset = materializeRecipeInstance(
      graph(updatedOuter, updatedLeaf),
      outer.id,
      "instance.card",
      preserved.mapping,
      [],
    );
    expect(reset.root.id).toBe(initial.root.id);
    expect(reset.root.props?.text).toBe("Updated master");
    expect(reset.root.style).toBeUndefined();
    const nestedDefault = materializeRecipeInstance(graph(outer, leaf), outer.id, "instance.card");
    expect(nestedDefault.root.props?.text).toBe("Occurrence text");
  });

  it("materializes attached behavior slot nodes and rewrites behavior-owned actions", () => {
    const definition = master(
      "master.card",
      node("container", {
        use: "com.example.ui/Stack",
        behaviors: [
          {
            id: "sort",
            use: "com.example.interactions/Sortable",
            props: { axis: "vertical" },
            slots: { dragPreview: [node("preview")] },
            on: { reorder: [{ type: "component.command", target: "preview", command: "focus" }] },
          },
        ],
      }),
    );
    const result = materializeRecipeInstance(graph(definition), definition.id, "instance.card");
    const behavior = result.root.behaviors?.[0];
    expect(behavior?.id).toBe(mapped(result, owner("behavior", "sort")));
    expect(behavior?.slots?.dragPreview?.[0]?.id).toBe(mapped(result, owner("node", "preview")));
    expect(behavior?.on?.reorder?.[0]).toEqual({
      type: "component.command",
      target: mapped(result, owner("node", "preview")),
      command: "focus",
    });
    expect(Object.hasOwn(result.root, "kind")).toBe(false);
    expect(Object.hasOwn(behavior ?? {}, "kind")).toBe(false);
  });

  it("resolves parent commands to nested occurrence roots through chained root occurrences", () => {
    const leaf = master("master.leaf");
    const relay = master("master.relay", {
      kind: "instance",
      id: "relayTarget",
      masterId: leaf.id,
      overrides: [],
    });
    const direct = { kind: "instance", id: "direct", masterId: leaf.id, overrides: [] } as const;
    const chained = { kind: "instance", id: "chained", masterId: relay.id, overrides: [] } as const;
    const outer = master(
      "master.card",
      node("container", {
        use: "com.example.ui/Stack",
        slots: { default: [direct, chained] },
        on: {
          activate: [
            { type: "component.command", target: "direct", command: "focus" },
            { type: "component.command", target: "chained", command: "focus" },
          ],
        },
      }),
    );
    const result = materializeRecipeInstance(graph(outer, relay, leaf), outer.id, "instance.card");
    const directId = mapped(result, owner("node", "title", leaf.id, ["direct"]));
    const chainedId = mapped(result, owner("node", "title", leaf.id, ["chained", "relayTarget"]));
    expect(directId).not.toBe(chainedId);
    expect(result.root.slots?.default?.map(({ id }) => id)).toEqual([directId, chainedId]);
    expect(result.root.on?.activate).toEqual([
      { type: "component.command", target: directId, command: "focus" },
      { type: "component.command", target: chainedId, command: "focus" },
    ]);
    expect(result.mapping).toHaveLength(3);
    const reordered = master(
      outer.id,
      node("container", {
        use: "com.example.ui/Stack",
        slots: { default: [chained, direct] },
        on: outer.root.kind === "node" ? (outer.root.on ?? {}) : {},
      }),
    );
    const changed = materializeRecipeInstance(
      graph(reordered, relay, leaf),
      outer.id,
      "instance.card",
      result.mapping,
    );
    expect(changed.root.slots?.default?.map(({ id }) => id)).toEqual([chainedId, directId]);
    expect(changed.root.on).toEqual(result.root.on);
    expect(changed.mapping).toEqual(result.mapping);
  });

  it("rewrites all admitted binding locations while preserving strings, tokens and opaque extensions", () => {
    const opaque = { state: "state.shared", $ref: "state.shared", target: "input" };
    const definition = master(
      "master.card",
      node("container", {
        use: "com.example.ui/Stack",
        slots: {
          default: [node("input", { use: "com.example.ui/TextField", props: { label: "Input" } })],
        },
        props: {
          text: { $ref: "resource.profile.value.name", fallback: { $ref: "state.shared.value" } },
          label: {
            $format: { template: "{name}", values: { name: { $ref: "state.shared.value" } } },
          },
          literal: "state.shared",
          object: {
            target: "input",
            state: "state.shared",
            nested: [{ $ref: "state.shared.value" }],
          },
          token: { $token: "state.shared" },
        },
        extensions: opaque,
        when: { op: "all", args: [{ op: "truthy", args: [{ $ref: "state.shared.enabled" }] }] },
        repeat: {
          items: { $ref: "resource.profile.value.rows" },
          as: "row",
          key: { $ref: "item.row.id" },
          extensions: opaque,
        },
        style: { default: { root: { color: { $ref: "state.shared.color" } } } },
        variants: [
          {
            when: { op: "truthy", args: [{ $ref: "operation.lookup.pending" }] },
            props: { text: { $ref: "state.shared.value" } },
            style: { default: { root: { color: { $ref: "state.shared.color" } } } },
          },
        ],
        on: {
          activate: [
            {
              type: "operation.invoke",
              operation: "com.example.auth/signIn",
              as: "lookup",
              input: {
                state: { $ref: "state.shared" },
                resource: { $ref: "resource.profile.value" },
              },
              onSuccess: [
                {
                  type: "state.set",
                  path: "shared.value",
                  value: { $ref: "operation.lookup.value.name" },
                },
                {
                  type: "operation.invoke",
                  operation: "com.example.auth/signIn",
                  as: "audit",
                  input: { prior: { $ref: "operation.lookup.status" } },
                  onSuccess: [
                    { type: "resource.refresh", resource: "profile" },
                    {
                      type: "component.command",
                      target: "input",
                      command: "focus",
                      input: { value: { $ref: "state.shared.value" } },
                    },
                  ],
                  onFailure: [
                    {
                      type: "state.toggle",
                      path: "shared.enabled",
                      when: { op: "eq", args: [{ $ref: "operation.audit.status" }, "failed"] },
                    },
                  ],
                },
              ],
              onFailure: [
                {
                  type: "navigate",
                  surface: "home",
                  params: { value: { $ref: "state.shared.value" } },
                },
              ],
            },
          ],
        },
      }),
      {
        state: {
          shared: {
            schema: { type: "object" },
            initial: { value: "initial", enabled: false, color: "#111111" },
          },
        },
        resources: {
          profile: {
            use: "com.example.data/profile",
            input: { owner: { $ref: "state.shared.value" } },
            policy: "manual",
            extensions: opaque,
          },
        },
      },
    );
    const result = materializeRecipeInstance(graph(definition), definition.id, "instance.card");
    const stateId = mapped(result, owner("state", "shared"));
    const resourceId = mapped(result, owner("resource", "profile"));
    const lookupId = mapped(result, owner("operation", "lookup"));
    const auditId = mapped(result, owner("operation", "audit"));
    const targetId = mapped(result, owner("node", "input"));
    expect(result.root.props).toEqual({
      text: {
        $ref: `resource.${resourceId}.value.name`,
        fallback: { $ref: `state.${stateId}.value` },
      },
      label: {
        $format: { template: "{name}", values: { name: { $ref: `state.${stateId}.value` } } },
      },
      literal: "state.shared",
      object: {
        target: "input",
        state: "state.shared",
        nested: [{ $ref: `state.${stateId}.value` }],
      },
      token: { $token: "state.shared" },
    });
    expect(result.root.extensions).toEqual(opaque);
    expect(result.root.when).toEqual({
      op: "all",
      args: [{ op: "truthy", args: [{ $ref: `state.${stateId}.enabled` }] }],
    });
    expect(result.root.repeat).toEqual({
      items: { $ref: `resource.${resourceId}.value.rows` },
      as: "row",
      key: { $ref: "item.row.id" },
      extensions: opaque,
    });
    expect(result.root.style).toEqual({
      default: { root: { color: { $ref: `state.${stateId}.color` } } },
    });
    expect(result.root.variants?.[0]).toEqual({
      when: { op: "truthy", args: [{ $ref: `operation.${lookupId}.pending` }] },
      props: { text: { $ref: `state.${stateId}.value` } },
      style: { default: { root: { color: { $ref: `state.${stateId}.color` } } } },
    });
    expect(result.root.on?.activate).toEqual([
      {
        type: "operation.invoke",
        operation: "com.example.auth/signIn",
        as: lookupId,
        input: {
          state: { $ref: `state.${stateId}` },
          resource: { $ref: `resource.${resourceId}.value` },
        },
        onSuccess: [
          {
            type: "state.set",
            path: `${stateId}.value`,
            value: { $ref: `operation.${lookupId}.value.name` },
          },
          {
            type: "operation.invoke",
            operation: "com.example.auth/signIn",
            as: auditId,
            input: { prior: { $ref: `operation.${lookupId}.status` } },
            onSuccess: [
              { type: "resource.refresh", resource: resourceId },
              {
                type: "component.command",
                target: targetId,
                command: "focus",
                input: { value: { $ref: `state.${stateId}.value` } },
              },
            ],
            onFailure: [
              {
                type: "state.toggle",
                path: `${stateId}.enabled`,
                when: { op: "eq", args: [{ $ref: `operation.${auditId}.status` }, "failed"] },
              },
            ],
          },
        ],
        onFailure: [
          {
            type: "navigate",
            surface: "home",
            params: { value: { $ref: `state.${stateId}.value` } },
          },
        ],
      },
    ]);
    expect(result.resources[resourceId]).toEqual({
      use: "com.example.data/profile",
      input: { owner: { $ref: `state.${stateId}.value` } },
      policy: "manual",
      extensions: opaque,
    });
    expect(result.state[stateId]?.initial).toEqual({
      value: "initial",
      enabled: false,
      color: "#111111",
    });
  });

  it("rejects recursive and missing definition closures without changing the input", () => {
    const recursive = graph(
      master("master.card", {
        kind: "instance",
        id: "loop",
        masterId: "master.card",
        overrides: [],
      }),
    );
    const missing = graph(
      master("master.card", {
        kind: "instance",
        id: "missing",
        masterId: "master.missing",
        overrides: [],
      }),
    );
    const before = canonicalizeJson(recursive);
    expectFailure(
      () => materializeRecipeInstance(recursive, "master.card", "instance.card"),
      "recursive-definition",
    );
    expectFailure(
      () => materializeRecipeInstance(missing, "master.card", "instance.card"),
      "missing-definition",
    );
    expectFailure(
      () => materializeRecipeInstance(graph(), "master.missing", "instance.card"),
      "missing-definition",
    );
    expect(canonicalizeJson(recursive)).toBe(before);
  });

  it.each(["state", "resource", "operation"] as const)("rejects unresolved %s bindings", (kind) => {
    const definition = master(
      "master.card",
      node("title", { props: { text: { $ref: `${kind}.missing.value` } } }),
    );
    expectFailure(
      () => materializeRecipeInstance(graph(definition), definition.id, "instance.card"),
      `unresolved-${kind}`,
    );
  });

  it("rejects external command targets and conflicting local operation aliases", () => {
    const command = master(
      "master.card",
      node("title", {
        on: { activate: [{ type: "component.command", target: "external", command: "focus" }] },
      }),
    );
    expectFailure(
      () => materializeRecipeInstance(graph(command), command.id, "instance.card"),
      "unresolved-node",
    );
    const conflict = master(
      "master.card",
      node("title", {
        on: {
          activate: [
            {
              type: "operation.invoke",
              operation: "com.example.auth/signIn",
              as: "shared",
              input: {},
            },
            {
              type: "operation.invoke",
              operation: "com.example.auth/signOut",
              as: "shared",
              input: {},
            },
          ],
        },
      }),
    );
    expectFailure(
      () => materializeRecipeInstance(graph(conflict), conflict.id, "instance.card"),
      "operation-alias-conflict",
    );
  });

  it("keeps boundary-length state.set and state.toggle paths within 128 code units", () => {
    const tail = "x".repeat(126);
    const definition = master(
      "master.card",
      node("title", {
        props: { text: { $ref: `state.s.${tail}` } },
        on: {
          activate: [
            { type: "state.set", path: `s.${tail}`, value: true },
            { type: "state.toggle", path: `s.${tail}` },
          ],
        },
      }),
      { state: { s: { schema: { type: "object" }, initial: { [tail]: false } } } },
    );
    const first = materializeRecipeInstance(graph(definition), definition.id, "instance.first");
    const stateId = mapped(first, owner("state", "s"));
    expect(stateId).toHaveLength(1);
    expect(first.root.on?.activate).toEqual([
      { type: "state.set", path: `${stateId}.${tail}`, value: true },
      { type: "state.toggle", path: `${stateId}.${tail}` },
    ]);
    expect(`${stateId}.${tail}`).toHaveLength(128);
    expect(first.root.props?.text).toEqual({ $ref: `state.${stateId}.${tail}` });
    const second = materializeRecipeInstance(
      graph(definition),
      definition.id,
      "instance.second",
      [],
      [],
      new Set(first.mapping.map(({ sourceId }) => sourceId)),
    );
    expect(mapped(second, owner("state", "s"))).toHaveLength(1);
    expect(mapped(second, owner("state", "s"))).not.toBe(stateId);
  });
});
