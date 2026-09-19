import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import { materializeRecipeInstance } from "../src/master-instance-materialization.js";
import { EDITABLE_PROJECT_RECIPE_LIMITS } from "../src/master-instance-types.js";
import { admitEditableProjectRecord } from "../src/project-record.js";

import type { RecipeMaterialization } from "../src/master-instance-materialization.js";
import type {
  EditableProjectMasterDefinition,
  EditableProjectMasterInstance,
  EditableProjectRecipeChild,
  EditableProjectRecipeGraph,
} from "../src/master-instance-types.js";
import type { EditableProjectRecord } from "../src/project-record.js";

type Mutable<Value> = Value extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: Mutable<Value[Key]> }
    : Value;

type SourceNode = EditableProjectRecord["source"]["surfaces"][string]["root"];
type SourceAction = NonNullable<SourceNode["on"]>[string][number];

function clone<Value>(value: Value): Mutable<Value> {
  return JSON.parse(JSON.stringify(value)) as Mutable<Value>;
}

function definition(
  id = "master.card",
  root: EditableProjectRecipeChild = {
    kind: "node",
    id: "title",
    use: "com.example.ui/Text",
    props: { text: "Master text" },
  },
): EditableProjectMasterDefinition {
  return { id, name: "Reusable title", root, state: {}, resources: {} };
}

function fixture(graph: EditableProjectRecipeGraph): Mutable<EditableProjectRecord> {
  return clone({
    kind: "desen.editable-project",
    schemaVersion: 2,
    id: "project.recipes",
    source: validSource,
    designSystem: { tokenSources: [], recipes: [], assets: [], recipeGraph: graph },
    connectionIntents: [],
  } as unknown as EditableProjectRecord);
}

function instance(
  materialized: RecipeMaterialization,
  id = "instance.card",
  masterId = "master.card",
): EditableProjectMasterInstance {
  return {
    id,
    masterId,
    surfaceId: "sign-in",
    rootId: materialized.root.id,
    definitionDigest: materialized.definitionDigest,
    materializedDigest: materialized.materializedDigest,
    mapping: materialized.mapping,
    overrides: [],
  };
}

function managedFixture(): Mutable<EditableProjectRecord> {
  const master: EditableProjectMasterDefinition = {
    ...definition(),
    root: {
      kind: "node",
      id: "title",
      use: "com.example.ui/Text",
      props: { text: { $ref: "state.label" } },
    },
    state: { label: { schema: { type: "string" }, initial: "Linked title" } },
    resources: {
      profile: {
        use: "com.example.data/profile",
        input: { label: { $ref: "state.label" } },
        policy: "manual",
      },
    },
  };
  const graph = { definitions: [master], instances: [] };
  const materialized = materializeRecipeInstance(graph, master.id, "instance.card");
  const project = fixture({ ...graph, instances: [instance(materialized)] });
  project.source.surfaces["sign-in"] = clone({
    id: "sign-in",
    root: materialized.root,
    state: materialized.state,
    resources: materialized.resources,
  });
  return project;
}

function invocation(
  alias: string,
  operation = "com.example.auth/signIn",
): Extract<SourceAction, { type: "operation.invoke" }> {
  return {
    type: "operation.invoke",
    operation,
    as: alias,
    input: { email: "designer@example.test", password: "test-password" },
    concurrency: "replace",
  };
}

function managedOperationFixture(repeatedInvocations = false) {
  const master = definition("master.operation", {
    kind: "node",
    id: "submit",
    use: "com.example.ui/Button",
    props: {
      label: "Managed submit",
      loading: { $ref: "operation.request.pending", fallback: false },
    },
    on: {
      press: repeatedInvocations
        ? [
            invocation("request"),
            {
              ...invocation("request"),
              onSuccess: [invocation("request")],
              onFailure: [invocation("request")],
            },
          ]
        : [invocation("request")],
    },
    ...(repeatedInvocations
      ? {
          behaviors: [
            {
              id: "sort",
              use: "com.example.interactions/Sortable",
              on: { reorder: [invocation("request")] },
            },
          ],
        }
      : {}),
  });
  const graph = { definitions: [master], instances: [] };
  const materialized = materializeRecipeInstance(graph, master.id, "instance.operation");
  const project = fixture({
    ...graph,
    instances: [instance(materialized, "instance.operation", master.id)],
  });
  project.source.surfaces["sign-in"] = clone({
    id: "sign-in",
    root: materialized.root,
    state: materialized.state,
    resources: materialized.resources,
  });
  const alias = materialized.mapping.find(({ owner }) => owner.kind === "operation")?.sourceId;
  if (alias === undefined) throw new TypeError("Expected a managed operation alias.");
  return { project, alias };
}

function appendOrdinaryNode(project: Mutable<EditableProjectRecord>, node: SourceNode): void {
  const surface = project.source.surfaces["sign-in"];
  if (surface === undefined) throw new TypeError("Expected surface.");
  surface.root = clone({
    id: "outside.container",
    use: "com.example.ui/Stack",
    slots: { default: [surface.root, node] },
  });
}

function expectRejected(candidate: unknown, reason?: string): void {
  const result = admitEditableProjectRecord(candidate);
  expect(result.ok).toBe(false);
  if (result.ok) throw new TypeError("Expected recipe graph admission rejection.");
  expect(Object.hasOwn(result, "record")).toBe(false);
  expect(result.diagnostics.length).toBeGreaterThan(0);
  if (reason !== undefined) expect(result.diagnostics[0]?.message).toContain(reason);
}

function firstInstance(project: Mutable<EditableProjectRecord>) {
  const first = project.designSystem.recipeGraph.instances[0];
  if (first === undefined) throw new TypeError("Expected a linked instance fixture.");
  return first;
}

describe("recipe graph admission through the complete project", () => {
  it("admits an unused structurally valid definition without changing canonical Source", () => {
    const candidate = fixture({ definitions: [definition()], instances: [] });
    const result = admitEditableProjectRecord(candidate);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected an admitted unused definition.");
    expect(canonicalizeJson(result.record.source)).toBe(canonicalizeJson(validSource));
    expect(result.record.designSystem.recipeGraph).toEqual(candidate.designSystem.recipeGraph);
    expect(result.record.designSystem.recipeGraph).not.toBe(candidate.designSystem.recipeGraph);
    expect(Object.isFrozen(result.record.designSystem.recipeGraph.definitions[0]?.root)).toBe(true);
  });

  it("replays a materialized aggregate exactly after export and returns detached immutable graph data", () => {
    const candidate = managedFixture();
    const before = canonicalizeJson(candidate);
    const admitted = admitEditableProjectRecord(candidate);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) throw new TypeError("Expected exact managed-region admission.");
    expect(canonicalizeJson(admitted.record)).toBe(before);
    const reopened = admitEditableProjectRecord(JSON.parse(before) as unknown);
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) throw new TypeError("Expected exact reopened project admission.");
    expect(canonicalizeJson(reopened.record)).toBe(before);
    expect(reopened.record).not.toBe(admitted.record);
    expect(Object.isFrozen(admitted.record.designSystem.recipeGraph.instances[0]?.mapping)).toBe(
      true,
    );
    expect(
      Object.isFrozen(
        admitted.record.designSystem.recipeGraph.instances[0]?.mapping[0]?.owner.path,
      ),
    ).toBe(true);
    firstInstance(candidate).rootId = "caller.changed";
    expect(admitted.record.designSystem.recipeGraph.instances[0]?.rootId).not.toBe(
      "caller.changed",
    );
  });

  it("rejects missing, stale, duplicate and out-of-order durable mappings without repairing them", () => {
    const absent = managedFixture();
    firstInstance(absent).mapping = [];
    expectRejected(absent, "mapping-limit");

    const stale = managedFixture();
    const staleMapping = firstInstance(stale).mapping[0];
    if (staleMapping === undefined) throw new TypeError("Expected mapping.");
    staleMapping.owner.id = "missing";
    expectRejected(stale);

    const duplicate = managedFixture();
    const first = firstInstance(duplicate).mapping[0];
    if (first === undefined) throw new TypeError("Expected mapping.");
    firstInstance(duplicate).mapping.push(clone(first));
    expectRejected(duplicate, "duplicate-mapping");

    const reordered = managedFixture();
    firstInstance(reordered).mapping.reverse();
    const before = canonicalizeJson(reordered);
    expectRejected(reordered, "mapping-drift");
    expect(canonicalizeJson(reordered)).toBe(before);
  });

  it("rejects master changes and forged provenance digests until Source is updated atomically", () => {
    const changedMaster = managedFixture();
    const firstDefinition = changedMaster.designSystem.recipeGraph.definitions[0];
    if (firstDefinition === undefined) throw new TypeError("Expected definition.");
    firstDefinition.name = "Changed master";
    expectRejected(changedMaster, "stale-definition");

    const wrongDefinitionDigest = managedFixture();
    firstInstance(wrongDefinitionDigest).definitionDigest = digestCanonicalJson("wrong definition");
    expectRejected(wrongDefinitionDigest, "stale-definition");

    const wrongMaterializedDigest = managedFixture();
    firstInstance(wrongMaterializedDigest).materializedDigest = digestCanonicalJson("wrong Source");
    expectRejected(wrongMaterializedDigest, "managed-source-drift");

    const changedSource = managedFixture();
    const surface = changedSource.source.surfaces["sign-in"];
    if (surface === undefined) throw new TypeError("Expected surface.");
    surface.root.props = { text: "Out-of-band edit" };
    expectRejected(changedSource, "managed-source-drift");
  });

  it("rejects state/resource drift and orphaned surface/root identities", () => {
    const changedState = managedFixture();
    const stateSurface = changedState.source.surfaces["sign-in"];
    const stateDeclaration = Object.values(stateSurface?.state ?? {})[0];
    if (stateDeclaration === undefined) throw new TypeError("Expected state.");
    stateDeclaration.initial = "Out-of-band state";
    expectRejected(changedState, "managed-state-drift");

    const changedResource = managedFixture();
    const resourceSurface = changedResource.source.surfaces["sign-in"];
    const resource = Object.values(resourceSurface?.resources ?? {})[0];
    if (resource === undefined) throw new TypeError("Expected resource.");
    resource.input = { label: "Out-of-band resource" };
    expectRejected(changedResource, "managed-resource-drift");

    const missingSurface = managedFixture();
    firstInstance(missingSurface).surfaceId = "missing";
    expectRejected(missingSurface, "missing-instance-surface");
    const missingRoot = managedFixture();
    firstInstance(missingRoot).rootId = "missing";
    expectRejected(missingRoot, "missing-instance-root");
  });

  it("rejects two same-surface instances claiming the same ordinary identities", () => {
    const candidate = managedFixture();
    const second = clone(firstInstance(candidate));
    second.id = "instance.second";
    candidate.designSystem.recipeGraph.instances.push(second);
    expectRejected(candidate, "overlapping-instances");
  });

  it("rejects an ordinary same-surface node reusing a managed node identity", () => {
    const candidate = managedFixture();
    const surface = candidate.source.surfaces["sign-in"];
    if (surface === undefined) throw new TypeError("Expected surface.");
    surface.root = {
      id: "container",
      use: "com.example.ui/Stack",
      slots: {
        default: [
          surface.root,
          {
            id: surface.root.id,
            use: "com.example.ui/Text",
            props: { text: "Duplicate identity" },
          },
        ],
      },
    };
    expectRejected(candidate, "ambiguous-source-identity");
  });

  it.each([
    ["component handler", false, undefined],
    ["behavior handler", true, undefined],
    ["component success settlement", false, "onSuccess"],
    ["component failure settlement", false, "onFailure"],
    ["behavior success settlement", true, "onSuccess"],
    ["behavior failure settlement", true, "onFailure"],
  ] as const)(
    "rejects a same-capability operation declaration outside its instance in a %s",
    (_label, behaviorOwned, settlement) => {
      const { project, alias } = managedOperationFixture();
      const action: SourceAction =
        settlement === undefined
          ? invocation(alias)
          : {
              ...invocation("outside.request"),
              [settlement]: [
                {
                  ...invocation("outside.nested"),
                  [settlement]: [invocation(alias)],
                },
              ],
            };
      appendOrdinaryNode(project, {
        id: "outside.submit",
        use: "com.example.ui/Button",
        props: { label: "Ordinary submit" },
        ...(behaviorOwned
          ? {
              behaviors: [
                {
                  id: "outside.sort",
                  use: "com.example.interactions/Sortable",
                  on: { reorder: [action] },
                },
              ],
            }
          : { on: { press: [action] } }),
      });
      const before = canonicalizeJson(project);
      // The protocol allows sharing a same-capability alias, but its surface-wide lifecycle
      // would let an ordinary invocation replace the managed instance's pending operation.
      expectRejected(project, "operation-ownership-conflict");
      expect(canonicalizeJson(project)).toBe(before);
    },
  );

  it("rejects an outside declaration of a managed operation alias with a different capability", () => {
    const { project, alias } = managedOperationFixture();
    appendOrdinaryNode(project, {
      id: "outside.submit",
      use: "com.example.ui/Button",
      on: { press: [invocation(alias, "com.example.auth/signOut")] },
    });
    const before = canonicalizeJson(project);
    expectRejected(project, "operation-ownership-conflict");
    expect(canonicalizeJson(project)).toBe(before);
  });

  it("admits repeated same-operation declarations owned by one instance across handlers and settlements", () => {
    const { project } = managedOperationFixture(true);
    const before = canonicalizeJson(project);
    const result = admitEditableProjectRecord(project);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected instance-owned repeated operation admission.");
    expect(canonicalizeJson(result.record)).toBe(before);
    expect(
      firstInstance(project).mapping.filter(({ owner }) => owner.kind === "operation"),
    ).toHaveLength(1);
  });

  it("admits an ordinary declaration of the same operation alias on another surface", () => {
    const { project, alias } = managedOperationFixture();
    project.source.surfaces.independent = clone({
      id: "independent",
      state: {},
      resources: {},
      root: {
        id: "independent.submit",
        use: "com.example.ui/Button",
        on: { press: [invocation(alias)] },
      },
    });
    const before = canonicalizeJson(project);
    const result = admitEditableProjectRecord(project);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected surface-isolated operation alias admission.");
    expect(canonicalizeJson(result.record)).toBe(before);
  });

  it("admits external read-only observation of an instance-owned operation lifecycle", () => {
    const { project, alias } = managedOperationFixture();
    appendOrdinaryNode(project, {
      id: "outside.observer",
      use: "com.example.ui/Button",
      props: {
        label: "Operation observer",
        loading: { $ref: `operation.${alias}.pending`, fallback: false },
      },
    });
    const before = canonicalizeJson(project);
    const result = admitEditableProjectRecord(project);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected read-only operation reference admission.");
    expect(canonicalizeJson(result.record)).toBe(before);
  });

  it("rejects unused recursive or unresolved nested definitions", () => {
    const self = definition("master.card", {
      kind: "instance",
      id: "self",
      masterId: "master.card",
      overrides: [],
    });
    expectRejected(fixture({ definitions: [self], instances: [] }), "recursive-definition");
    const missing = definition("master.card", {
      kind: "instance",
      id: "missing",
      masterId: "master.missing",
      overrides: [],
    });
    expectRejected(fixture({ definitions: [missing], instances: [] }), "missing-definition");
    const first = definition("master.first", {
      kind: "instance",
      id: "second",
      masterId: "master.second",
      overrides: [],
    });
    const second = definition("master.second", {
      kind: "instance",
      id: "first",
      masterId: "master.first",
      overrides: [],
    });
    expectRejected(
      fixture({ definitions: [first, second], instances: [] }),
      "recursive-definition",
    );
  });

  it("bounds nested composition depth and repeated expansion before returning a project", () => {
    const deep: EditableProjectMasterDefinition[] = [definition("master.leaf")];
    for (let index = 0; index <= EDITABLE_PROJECT_RECIPE_LIMITS.maxCompositionDepth; index += 1) {
      const nestedId = deep[0]?.id;
      if (nestedId === undefined) throw new TypeError("Expected predecessor definition.");
      deep.unshift(
        definition(`master.depth${index}`, {
          kind: "instance",
          id: "nested",
          masterId: nestedId,
          overrides: [],
        }),
      );
    }
    const depthResult = admitEditableProjectRecord(fixture({ definitions: deep, instances: [] }));
    expect(depthResult.ok).toBe(false);
    if (depthResult.ok) throw new TypeError("Expected composition bound.");
    expect(depthResult.diagnostics[0]?.code).toBe("PROJECT_LIMIT_EXCEEDED");

    const wide: EditableProjectMasterDefinition[] = [definition("master.leaf")];
    for (let index = 0; index < 14; index += 1) {
      const nestedId = wide[0]?.id;
      if (nestedId === undefined) throw new TypeError("Expected predecessor definition.");
      wide.unshift(
        definition(`master.wide${index}`, {
          kind: "node",
          id: "container",
          use: "com.example.ui/Stack",
          slots: {
            default: [
              { kind: "instance", id: "left", masterId: nestedId, overrides: [] },
              { kind: "instance", id: "right", masterId: nestedId, overrides: [] },
            ],
          },
        }),
      );
    }
    const expansionResult = admitEditableProjectRecord(
      fixture({ definitions: wide, instances: [] }),
    );
    expect(expansionResult.ok).toBe(false);
    if (expansionResult.ok) throw new TypeError("Expected expansion bound.");
    expect(expansionResult.diagnostics[0]?.code).toBe("PROJECT_LIMIT_EXCEEDED");
    expect(expansionResult.diagnostics[0]?.message).toContain("expansion-limit");
  });

  it("rejects malformed graph collections, unknown members and invalid template data", () => {
    const invalidGraphs: unknown[] = [
      null,
      {},
      { definitions: [], instances: [], unexpected: true },
      { definitions: {}, instances: [] },
      { definitions: [], instances: {} },
      { definitions: [definition(), definition()], instances: [] },
      { definitions: [{ ...definition(), name: " " }], instances: [] },
      {
        definitions: [
          {
            ...definition(),
            root: { kind: "javascript", id: "active", use: "com.example.ui/Text" },
          },
        ],
        instances: [],
      },
      {
        definitions: [
          { ...definition(), root: { kind: "node", id: "title", use: "invalid capability" } },
        ],
        instances: [],
      },
      {
        definitions: [
          definition("master.card", {
            kind: "node",
            id: "same",
            use: "com.example.ui/Stack",
            slots: { default: [{ kind: "node", id: "same", use: "com.example.ui/Text" }] },
          }),
        ],
        instances: [],
      },
    ];
    for (const graph of invalidGraphs) {
      const candidate = fixture({ definitions: [], instances: [] });
      (candidate.designSystem as unknown as Record<string, unknown>).recipeGraph = graph;
      expectRejected(candidate);
    }
  });

  it.each(["state", "resource", "operation"] as const)(
    "rejects an invalid unused-definition %s identity before allocation can sanitize it",
    (kind) => {
      const candidate = clone(definition());
      if (kind === "state") {
        candidate.state = { "123 invalid": { schema: { type: "string" }, initial: "value" } };
      } else if (kind === "resource") {
        candidate.resources = {
          "123 invalid": { use: "com.example.data/profile", input: {}, policy: "manual" },
        };
      } else {
        candidate.root = {
          kind: "node",
          id: "title",
          use: "com.example.ui/Text",
          on: {
            activate: [
              {
                type: "operation.invoke",
                operation: "com.example.auth/signIn",
                as: "123 invalid",
                input: {},
              },
            ],
          },
        };
      }
      expectRejected(
        fixture({ definitions: [candidate], instances: [] }),
        "invalid-local-identity",
      );
    },
  );

  it("rejects hostile graph descriptors and proxies without invoking getters", () => {
    let getterCalls = 0;
    const graphWithGetter = { instances: [] };
    Object.defineProperty(graphWithGetter, "definitions", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return [];
      },
    });
    const hostileDefinition = clone(definition());
    Object.defineProperty(hostileDefinition, "root", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return definition().root;
      },
    });
    const revoked = Proxy.revocable({ definitions: [], instances: [] }, {});
    revoked.revoke();
    const throwing = new Proxy(
      { definitions: [], instances: [] },
      {
        ownKeys() {
          throw new Error("Hostile graph reflection.");
        },
      },
    );
    for (const graph of [
      graphWithGetter,
      { definitions: [hostileDefinition], instances: [] },
      revoked.proxy,
      throwing,
    ]) {
      const candidate = fixture({ definitions: [], instances: [] });
      (candidate.designSystem as unknown as Record<string, unknown>).recipeGraph = graph;
      expectRejected(candidate);
    }
    expect(getterCalls).toBe(0);
  });
});
