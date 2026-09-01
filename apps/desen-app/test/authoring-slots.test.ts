import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createCatalogManifest, registerBehavior, registerComponent } from "@desen/catalog-sdk";
import { createDesenEditorDocument, type DesenEditorDocument } from "@desen/editor-core";
import { canonicalizeJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import {
  prepareCatalogAuthoringModel,
  type CatalogAuthoringModel,
  type CatalogComponentSummary,
} from "../src/authoring-data.js";
import { REFERENCE_AUTHORING_MODEL } from "../src/reference-authoring-profile.js";
import {
  createAuthoringComponentSelection,
  type AuthoringComponentSelection,
} from "../src/authoring-selection.js";
import {
  applyAuthoringNodeDelete,
  applyAuthoringSlotEdit,
  createAuthoringSlotSelection,
  evaluateAuthoringNodeDeletion,
  evaluateAuthoringSlotComponent,
  evaluateAuthoringSlotInsertion,
  evaluateAuthoringSlotPlacement,
  isSameAuthoringSlotSelection,
  projectAuthoringSlotSelection,
  type AuthoringSlotEditResult,
  type AuthoringSlotRoute,
  type AuthoringSlotSelection,
} from "../src/authoring-slots.js";

const REFERENCE_ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "sign-in",
}) satisfies AuthoringSlotRoute;

const ROOT_CAPABILITY = "com.example.ui/SlotRoot";
const EXACT_CAPABILITY = "com.example.ui/Exact";
const CATEGORY_CAPABILITY = "com.example.ui/Category";
const REJECTED_CAPABILITY = "com.example.ui/Rejected";
const INVALID_DEFAULT_CAPABILITY = "com.example.ui/InvalidDefault";
const WIDE_DEFAULT_CAPABILITY = "com.example.ui/WideDefault";
const BEHAVIOR_CAPABILITY = "com.example.interactions/SlotOwner";
const FIXTURE_CATALOG_ID = "run.desen.test.slots";

const FIXTURE_ROUTE = Object.freeze({
  projectId: "slot-fixture",
  surfaceId: "main",
}) satisfies AuthoringSlotRoute;

type MutableJsonObject = Record<string, unknown>;

function copyJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canonical(value: unknown): string {
  return canonicalizeJson(value);
}

function record(value: unknown, path: string): MutableJsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value as MutableJsonObject;
}

function requireDocument(source: unknown): DesenEditorDocument {
  const result = createDesenEditorDocument(copyJson(source));
  if (!result.ok) {
    throw new Error(
      `Expected valid Source: ${result.diagnostics
        .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
        .join(" | ")}`,
    );
  }
  expect(result.ok).toBe(true);
  return result.document;
}

function requireModel(catalog: unknown, document: DesenEditorDocument): CatalogAuthoringModel {
  const result = prepareCatalogAuthoringModel(catalog, document);
  if (!result.ok) {
    throw new Error(`Expected validator-admitted Catalog and Source: ${result.reason}`);
  }
  expect(result.ok).toBe(true);
  return result.model;
}

function requireSuccess(result: AuthoringSlotEditResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected slot edit success, received ${result.reason}`);
  }
  return result;
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectDeeplyFrozen(child);
  }
}

function referenceSelection(): AuthoringSlotSelection {
  return createAuthoringSlotSelection({
    projectId: REFERENCE_ROUTE.projectId,
    surfaceId: REFERENCE_ROUTE.surfaceId,
    ownerKind: "component",
    ownerId: "sign-in.layout",
    ownerCapabilityId: "com.example.ui/Stack",
    slot: "default",
  });
}

function fixtureSelection(
  slot: string,
  owner: "component" | "behavior" = "component",
): AuthoringSlotSelection {
  return createAuthoringSlotSelection({
    projectId: FIXTURE_ROUTE.projectId,
    surfaceId: FIXTURE_ROUTE.surfaceId,
    ownerKind: owner,
    ownerId: owner === "component" ? "fixture.root" : "fixture.behavior",
    ownerCapabilityId: owner === "component" ? ROOT_CAPABILITY : BEHAVIOR_CAPABILITY,
    slot,
  });
}

function findNode(document: DesenEditorDocument, surfaceId: string, nodeId: string) {
  const root = document.surfaces[surfaceId]?.root;
  const visit = (node: typeof root): typeof root | undefined => {
    if (node === undefined) {
      return undefined;
    }
    if (node.id === nodeId) {
      return node;
    }
    for (const children of Object.values(node.slots ?? {})) {
      for (const child of children) {
        const found = visit(child);
        if (found !== undefined) {
          return found;
        }
      }
    }
    for (const behavior of node.behaviors ?? []) {
      for (const children of Object.values(behavior.slots ?? {})) {
        for (const child of children) {
          const found = visit(child);
          if (found !== undefined) {
            return found;
          }
        }
      }
    }
    return undefined;
  };
  return visit(root);
}

function rootSlotIds(
  document: DesenEditorDocument,
  surfaceId: string,
  slot: string,
): readonly string[] {
  return document.surfaces[surfaceId]?.root.slots?.[slot]?.map((node) => node.id) ?? [];
}

function behaviorSlotIds(
  document: DesenEditorDocument,
  surfaceId: string,
  behaviorId: string,
  slot: string,
): readonly string[] {
  const behavior = document.surfaces[surfaceId]?.root.behaviors?.find(
    (candidate) => candidate.id === behaviorId,
  );
  return behavior?.slots?.[slot]?.map((node) => node.id) ?? [];
}

function requireComponent(
  model: CatalogAuthoringModel,
  capabilityId: string,
): CatalogComponentSummary {
  const component = model.components.find((candidate) => candidate.id === capabilityId);
  expect(component).toBeDefined();
  if (component === undefined) {
    throw new Error(`Missing component ${capabilityId}`);
  }
  return component;
}

function createFixtureCatalog(): unknown {
  const root = registerComponent({
    id: ROOT_CAPABILITY,
    manifest: {
      category: "layout",
      propsSchema: { type: "object", additionalProperties: false },
      slots: {
        absent: {
          description: "Declared but intentionally absent from Source.",
          minItems: 2,
        },
        idOrCategory: {
          accepts: [EXACT_CAPABILITY],
          acceptsCategories: ["content"],
          maxItems: 3,
        },
        unrestricted: {},
        rejectAll: { accepts: [] },
        requiredSource: {
          required: true,
          minItems: 1,
        },
        movable: {},
        full: { maxItems: 1 },
      },
      authoring: {
        displayName: "Slot root",
        category: "Layout",
        defaultProps: {},
      },
    },
  });
  const exact = registerComponent({
    id: EXACT_CAPABILITY,
    manifest: {
      category: "action",
      propsSchema: { type: "object", additionalProperties: false },
      authoring: {
        displayName: "Exact",
        category: "Fixture",
        defaultProps: {},
      },
    },
  });
  const category = registerComponent({
    id: CATEGORY_CAPABILITY,
    manifest: {
      category: "content",
      propsSchema: { type: "object", additionalProperties: false },
      authoring: {
        displayName: "Category",
        category: "Fixture",
        defaultProps: {},
      },
    },
  });
  const rejected = registerComponent({
    id: REJECTED_CAPABILITY,
    manifest: {
      category: "feedback",
      propsSchema: { type: "object", additionalProperties: false },
      authoring: {
        displayName: "Rejected",
        category: "Fixture",
        defaultProps: {},
      },
    },
  });
  const invalidDefault = registerComponent({
    id: INVALID_DEFAULT_CAPABILITY,
    manifest: {
      category: "content",
      propsSchema: {
        type: "object",
        required: ["label"],
        properties: { label: { type: "string" } },
        additionalProperties: false,
      },
      authoring: {
        displayName: "Invalid default",
        category: "Fixture",
        defaultProps: { label: 42 },
      },
    },
  });
  const wideDefault = registerComponent({
    id: WIDE_DEFAULT_CAPABILITY,
    manifest: {
      category: "content",
      propsSchema: { type: "object" },
      authoring: {
        displayName: "Wide default",
        category: "Fixture",
        defaultProps: Object.fromEntries(
          Array.from({ length: 257 }, (_, index) => [`property${index}`, index]),
        ),
      },
    },
  });
  const behavior = registerBehavior({
    id: BEHAVIOR_CAPABILITY,
    manifest: {
      category: "interaction",
      propsSchema: { type: "object", additionalProperties: false },
      attachTo: { capabilities: [ROOT_CAPABILITY] },
      slots: {
        behaviorDrop: {
          acceptsCategories: ["content"],
          maxItems: 2,
        },
      },
    },
  });

  return createCatalogManifest({
    id: FIXTURE_CATALOG_ID,
    version: "1.0.0",
    target: "web-react",
    packageDigest: `sha256:${"0".repeat(64)}`,
    components: [root, exact, category, rejected, invalidDefault, wideDefault],
    behaviors: [behavior],
  });
}

function createFixtureSource(movableWidth?: number): unknown {
  const movable =
    movableWidth === undefined
      ? [
          { id: "move.category", use: CATEGORY_CAPABILITY },
          { id: "move.exact", use: EXACT_CAPABILITY },
        ]
      : Array.from({ length: movableWidth }, (_, index) => ({
          id: `wide.${index}`,
          use: CATEGORY_CAPABILITY,
        }));
  return {
    kind: "desen.source",
    desen: "0.1.0",
    id: "com.example.slot-fixture",
    catalogs: [
      {
        id: FIXTURE_CATALOG_ID,
        version: "1.0.0",
        target: "web-react",
      },
    ],
    entry: "main",
    surfaces: {
      main: {
        id: "main",
        state: {},
        resources: {},
        root: {
          id: "fixture.root",
          use: ROOT_CAPABILITY,
          slots: {
            idOrCategory: [],
            unrestricted: [],
            rejectAll: [],
            requiredSource: [{ id: "required.only", use: EXACT_CAPABILITY }],
            movable,
            full: [{ id: "full.existing", use: REJECTED_CAPABILITY }],
          },
          behaviors: [
            {
              id: "fixture.behavior",
              use: BEHAVIOR_CAPABILITY,
              slots: { behaviorDrop: [] },
            },
          ],
        },
      },
    },
  };
}

describe("named-slot authoring with the reference Catalog", () => {
  it("projects the selected slot and captures an exact frozen selection", () => {
    const selection = referenceSelection();
    const projection = projectAuthoringSlotSelection(
      selection,
      REFERENCE_ROUTE,
      REFERENCE_AUTHORING_MODEL,
    );

    expect(Object.isFrozen(selection)).toBe(true);
    expect(isSameAuthoringSlotSelection(selection, referenceSelection())).toBe(true);
    expect(projection).toMatchObject({
      status: "ready",
      selection,
      slot: {
        name: "default",
        present: true,
        contract: {
          minimum: 0,
          maximum: null,
          constrainsChildren: true,
          acceptedCategories: ["layout", "content", "input", "action", "feedback", "complex"],
        },
      },
    });
    if (projection.status === "ready") {
      expect(projection.slot.children.map((node) => node.id)).toEqual([
        "sign-in.title",
        "sign-in.email",
        "sign-in.password",
        "sign-in.error",
        "sign-in.submit",
      ]);
      expectDeeplyFrozen(projection);
    }
  });

  it("inserts reference components with exact defaults and deterministic collision IDs", () => {
    const document = requireDocument(officialSignInSource);
    const before = canonical(document);
    const first = requireSuccess(
      applyAuthoringSlotEdit(document, referenceCatalog, REFERENCE_ROUTE, referenceSelection(), {
        kind: "insert",
        componentId: "com.example.ui/Text",
        index: 1,
      }),
    );

    expect(first.operation).toBe("insert");
    expect(first.nodeId).toBe("node.text");
    expect(canonical(document)).toBe(before);
    expect(first.document).not.toBe(document);
    expect(rootSlotIds(first.document, "sign-in", "default")).toEqual([
      "sign-in.title",
      "node.text",
      "sign-in.email",
      "sign-in.password",
      "sign-in.error",
      "sign-in.submit",
    ]);
    expect(findNode(first.document, "sign-in", first.nodeId)).toEqual({
      id: "node.text",
      use: "com.example.ui/Text",
      props: { role: "body", text: "Text" },
    });
    expectDeeplyFrozen(first.document);

    const second = requireSuccess(
      applyAuthoringSlotEdit(
        first.document,
        referenceCatalog,
        REFERENCE_ROUTE,
        referenceSelection(),
        { kind: "insert", componentId: "com.example.ui/Text", index: 2 },
      ),
    );
    expect(second.nodeId).toBe("node.text-2");
    expect(findNode(second.document, "sign-in", second.nodeId)).toEqual({
      id: "node.text-2",
      use: "com.example.ui/Text",
      props: { role: "body", text: "Text" },
    });

    const repeated = requireSuccess(
      applyAuthoringSlotEdit(
        requireDocument(officialSignInSource),
        referenceCatalog,
        REFERENCE_ROUTE,
        referenceSelection(),
        { kind: "insert", componentId: "com.example.ui/Text", index: 1 },
      ),
    );
    expect(canonical(repeated.document)).toBe(canonical(first.document));
  });

  it("removes a newly inserted nested subtree and preserves the owning slot plus prior siblings", () => {
    const document = requireDocument(officialSignInSource);
    const insertedParent = requireSuccess(
      applyAuthoringSlotEdit(document, referenceCatalog, REFERENCE_ROUTE, referenceSelection(), {
        kind: "insert",
        componentId: "com.example.ui/Stack",
        index: 1,
      }),
    );
    const nestedSlot = createAuthoringSlotSelection({
      projectId: REFERENCE_ROUTE.projectId,
      surfaceId: REFERENCE_ROUTE.surfaceId,
      ownerKind: "component",
      ownerId: insertedParent.nodeId,
      ownerCapabilityId: "com.example.ui/Stack",
      slot: "default",
    });
    const insertedChild = requireSuccess(
      applyAuthoringSlotEdit(
        insertedParent.document,
        referenceCatalog,
        REFERENCE_ROUTE,
        nestedSlot,
        { kind: "insert", componentId: "com.example.ui/Text", index: 0 },
      ),
    );
    const selection = createAuthoringComponentSelection({
      projectId: REFERENCE_ROUTE.projectId,
      surfaceId: REFERENCE_ROUTE.surfaceId,
      sourceNodeId: insertedParent.nodeId,
      capabilityId: "com.example.ui/Stack",
      displayName: "Stack",
      conditional: false,
    });
    const model = requireModel(referenceCatalog, insertedChild.document);

    expect(evaluateAuthoringNodeDeletion(REFERENCE_ROUTE, model, selection)).toEqual({
      accepted: true,
      reason: "accepted",
    });
    const removed = requireSuccess(
      applyAuthoringNodeDelete(
        insertedChild.document,
        referenceCatalog,
        REFERENCE_ROUTE,
        selection,
      ),
    );

    expect(removed.operation).toBe("delete");
    expect(removed.nodeId).toBe(insertedParent.nodeId);
    expect(findNode(removed.document, "sign-in", insertedParent.nodeId)).toBeUndefined();
    expect(findNode(removed.document, "sign-in", insertedChild.nodeId)).toBeUndefined();
    expect(rootSlotIds(removed.document, "sign-in", "default")).toEqual([
      "sign-in.title",
      "sign-in.email",
      "sign-in.password",
      "sign-in.error",
      "sign-in.submit",
    ]);
    expect(Object.hasOwn(removed.document.surfaces["sign-in"]?.root.slots ?? {}, "default")).toBe(
      true,
    );
    expectDeeplyFrozen(removed.document);
  });

  it("keeps dry-run inert but returns the exact report when deletion creates a semantic failure", () => {
    const source = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    const surfaces = record(source.surfaces, "source.surfaces");
    const signIn = record(surfaces["sign-in"], "source.surfaces.sign-in");
    const root = record(signIn.root, "sign-in.root");
    const slots = record(root.slots, "sign-in.root.slots");
    const children = slots.default as MutableJsonObject[];
    const submit = children.find(({ id }) => id === "sign-in.submit");
    if (submit === undefined) throw new Error("Missing sign-in submit node.");
    const handlers = record(submit.on, "sign-in.submit.on");
    const press = handlers.press as unknown[];
    press.push({
      type: "component.command",
      target: "sign-in.email",
      command: "focus",
      input: {},
    });
    const document = requireDocument(source);
    const model = requireModel(referenceCatalog, document);
    const before = canonical(document);
    const selection = createAuthoringComponentSelection({
      projectId: REFERENCE_ROUTE.projectId,
      surfaceId: REFERENCE_ROUTE.surfaceId,
      sourceNodeId: "sign-in.email",
      capabilityId: "com.example.ui/TextField",
      displayName: "Text field",
      conditional: false,
    });

    expect(evaluateAuthoringNodeDeletion(REFERENCE_ROUTE, model, selection)).toEqual({
      accepted: false,
      reason: "target-invalid",
    });
    const rejected = applyAuthoringNodeDelete(
      document,
      referenceCatalog,
      REFERENCE_ROUTE,
      selection,
    );
    expect(rejected).toMatchObject({
      ok: false,
      reason: "source-invalid",
      validationReport: { valid: false },
    });
    if (rejected.ok || rejected.validationReport === undefined) {
      throw new Error("Expected rejected deletion diagnostics.");
    }
    expect(Object.isFrozen(rejected)).toBe(true);
    expect(Object.isFrozen(rejected.validationReport)).toBe(true);
    expect(Object.hasOwn(rejected, "document")).toBe(false);
    expect(canonical(document)).toBe(before);
  });

  it.each([
    {
      label: "translates a forward end boundary after removal",
      nodeId: "sign-in.title",
      index: 5,
      finalIndex: 4,
      changesSource: true,
      expected: [
        "sign-in.email",
        "sign-in.password",
        "sign-in.error",
        "sign-in.submit",
        "sign-in.title",
      ],
    },
    {
      label: "keeps a backward boundary in pre-removal coordinates",
      nodeId: "sign-in.submit",
      index: 0,
      finalIndex: 0,
      changesSource: true,
      expected: [
        "sign-in.submit",
        "sign-in.title",
        "sign-in.email",
        "sign-in.password",
        "sign-in.error",
      ],
    },
    {
      label: "normalizes an adjacent forward boundary to a no-op",
      nodeId: "sign-in.email",
      index: 2,
      finalIndex: 1,
      changesSource: false,
      expected: [
        "sign-in.title",
        "sign-in.email",
        "sign-in.password",
        "sign-in.error",
        "sign-in.submit",
      ],
    },
  ])("$label", ({ nodeId, index, finalIndex, changesSource, expected }) => {
    const document = requireDocument(officialSignInSource);
    const before = canonical(document);
    expect(
      evaluateAuthoringSlotPlacement(
        REFERENCE_ROUTE,
        REFERENCE_AUTHORING_MODEL,
        referenceSelection(),
        nodeId,
        index,
      ),
    ).toEqual({ accepted: true, operation: "reorder", finalIndex, changesSource });
    const result = requireSuccess(
      applyAuthoringSlotEdit(document, referenceCatalog, REFERENCE_ROUTE, referenceSelection(), {
        kind: "place",
        nodeId,
        index,
      }),
    );

    expect(result.operation).toBe("reorder");
    expect(rootSlotIds(result.document, "sign-in", "default")).toEqual(expected);
    expect(canonical(document)).toBe(before);
    expectDeeplyFrozen(result.document);
    if (nodeId === "sign-in.email") {
      expect(canonical(result.document)).toBe(before);
      expect(result.document).not.toBe(document);
    }
  });

  it("preflights and rejects a move into the moving node's descendant slot", () => {
    const document = requireDocument(officialSignInSource);
    const first = requireSuccess(
      applyAuthoringSlotEdit(document, referenceCatalog, REFERENCE_ROUTE, referenceSelection(), {
        kind: "insert",
        componentId: "com.example.ui/Stack",
        index: 5,
      }),
    );
    const parentSlot = createAuthoringSlotSelection({
      projectId: REFERENCE_ROUTE.projectId,
      surfaceId: REFERENCE_ROUTE.surfaceId,
      ownerKind: "component",
      ownerId: first.nodeId,
      ownerCapabilityId: "com.example.ui/Stack",
      slot: "default",
    });
    const second = requireSuccess(
      applyAuthoringSlotEdit(first.document, referenceCatalog, REFERENCE_ROUTE, parentSlot, {
        kind: "insert",
        componentId: "com.example.ui/Stack",
        index: 0,
      }),
    );
    const descendantSlot = createAuthoringSlotSelection({
      projectId: REFERENCE_ROUTE.projectId,
      surfaceId: REFERENCE_ROUTE.surfaceId,
      ownerKind: "component",
      ownerId: second.nodeId,
      ownerCapabilityId: "com.example.ui/Stack",
      slot: "default",
    });
    const model = requireModel(referenceCatalog, second.document);
    const before = canonical(second.document);

    expect(
      evaluateAuthoringSlotPlacement(REFERENCE_ROUTE, model, descendantSlot, first.nodeId, 0),
    ).toEqual({ accepted: false, reason: "cycle-rejected" });
    expect(
      applyAuthoringSlotEdit(second.document, referenceCatalog, REFERENCE_ROUTE, descendantSlot, {
        kind: "place",
        nodeId: first.nodeId,
        index: 0,
      }),
    ).toMatchObject({ ok: false });
    expect(canonical(second.document)).toBe(before);
  });
});

describe("validator-admitted synthetic slot contracts", () => {
  it("projects a declared-but-absent slot with effective min/max semantics", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const model = requireModel(catalog, document);
    const absent = projectAuthoringSlotSelection(fixtureSelection("absent"), FIXTURE_ROUTE, model);
    const required = projectAuthoringSlotSelection(
      fixtureSelection("requiredSource"),
      FIXTURE_ROUTE,
      model,
    );
    const full = projectAuthoringSlotSelection(fixtureSelection("full"), FIXTURE_ROUTE, model);

    expect(absent).toMatchObject({
      status: "ready",
      slot: {
        name: "absent",
        present: false,
        children: [],
        contract: { minimum: 2, maximum: null },
      },
    });
    expect(required).toMatchObject({
      status: "ready",
      slot: {
        present: true,
        contract: { required: true, minimum: 1, maximum: null },
      },
    });
    expect(full).toMatchObject({
      status: "ready",
      slot: { contract: { minimum: 0, maximum: 1 } },
    });
  });

  it("implements ID/category OR, unrestricted, explicit-empty, and max acceptance", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const model = requireModel(catalog, document);
    const idOrCategory = projectAuthoringSlotSelection(
      fixtureSelection("idOrCategory"),
      FIXTURE_ROUTE,
      model,
    );
    const unrestricted = projectAuthoringSlotSelection(
      fixtureSelection("unrestricted"),
      FIXTURE_ROUTE,
      model,
    );
    const rejectAll = projectAuthoringSlotSelection(
      fixtureSelection("rejectAll"),
      FIXTURE_ROUTE,
      model,
    );
    const full = projectAuthoringSlotSelection(fixtureSelection("full"), FIXTURE_ROUTE, model);
    if (
      idOrCategory.status !== "ready" ||
      unrestricted.status !== "ready" ||
      rejectAll.status !== "ready" ||
      full.status !== "ready"
    ) {
      throw new Error("Expected all synthetic slot projections to be ready");
    }
    const exact = requireComponent(model, EXACT_CAPABILITY);
    const category = requireComponent(model, CATEGORY_CAPABILITY);
    const rejected = requireComponent(model, REJECTED_CAPABILITY);

    expect(evaluateAuthoringSlotComponent(idOrCategory.slot, exact)).toEqual({
      accepted: true,
      reason: "accepted",
    });
    expect(
      evaluateAuthoringSlotInsertion(
        FIXTURE_ROUTE,
        model,
        fixtureSelection("idOrCategory"),
        exact.id,
        0,
      ),
    ).toEqual({ accepted: true, reason: "accepted" });
    expect(evaluateAuthoringSlotComponent(idOrCategory.slot, category)).toEqual({
      accepted: true,
      reason: "accepted",
    });
    expect(evaluateAuthoringSlotComponent(idOrCategory.slot, rejected)).toEqual({
      accepted: false,
      reason: "contract-rejected",
    });
    expect(evaluateAuthoringSlotComponent(unrestricted.slot, rejected)).toEqual({
      accepted: true,
      reason: "accepted",
    });
    expect(evaluateAuthoringSlotComponent(rejectAll.slot, exact)).toEqual({
      accepted: false,
      reason: "contract-rejected",
    });
    expect(evaluateAuthoringSlotComponent(full.slot, exact)).toEqual({
      accepted: false,
      reason: "maximum-reached",
    });

    expect(
      requireSuccess(
        applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, fixtureSelection("idOrCategory"), {
          kind: "insert",
          componentId: EXACT_CAPABILITY,
          index: 0,
        }),
      ).operation,
    ).toBe("insert");
    expect(
      requireSuccess(
        applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, fixtureSelection("idOrCategory"), {
          kind: "insert",
          componentId: CATEGORY_CAPABILITY,
          index: 0,
        }),
      ).operation,
    ).toBe("insert");
    expect(
      applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, fixtureSelection("rejectAll"), {
        kind: "insert",
        componentId: EXACT_CAPABILITY,
        index: 0,
      }),
    ).toMatchObject({ ok: false, reason: "acceptance-rejected" });
  });

  it("disables inserts whose Catalog defaults fail schema or bounded transition admission", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const model = requireModel(catalog, document);
    const target = fixtureSelection("unrestricted");

    expect(
      evaluateAuthoringSlotInsertion(FIXTURE_ROUTE, model, target, INVALID_DEFAULT_CAPABILITY, 0),
    ).toEqual({ accepted: false, reason: "defaults-invalid" });
    expect(
      evaluateAuthoringSlotInsertion(FIXTURE_ROUTE, model, target, WIDE_DEFAULT_CAPABILITY, 0),
    ).toEqual({ accepted: false, reason: "default-profile-exceeded" });
    const invalidDefaults = applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, target, {
      kind: "insert",
      componentId: INVALID_DEFAULT_CAPABILITY,
      index: 0,
    });
    expect(invalidDefaults).toMatchObject({
      ok: false,
      reason: "defaults-invalid",
      validationReport: {
        valid: false,
        invalidSubjects: [
          expect.objectContaining({
            surfaceId: "main",
            subject: { kind: "node", id: "node.invaliddefault" },
          }),
        ],
      },
    });
    if (invalidDefaults.ok || invalidDefaults.validationReport === undefined) {
      throw new Error("Expected rejected default diagnostics.");
    }
    expect(Object.isFrozen(invalidDefaults)).toBe(true);
    expect(Object.isFrozen(invalidDefaults.validationReport)).toBe(true);
    expect(Object.hasOwn(invalidDefaults, "document")).toBe(false);
    expect(
      applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, target, {
        kind: "insert",
        componentId: WIDE_DEFAULT_CAPABILITY,
        index: 0,
      }),
    ).toEqual({ ok: false, reason: "defaults-invalid" });
  });

  it("moves across component and behavior owners without changing the node", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const model = requireModel(catalog, document);
    const before = canonical(document);
    const originalNode = copyJson(findNode(document, "main", "move.category"));
    expect(
      evaluateAuthoringSlotPlacement(
        FIXTURE_ROUTE,
        model,
        fixtureSelection("behaviorDrop", "behavior"),
        "move.category",
        0,
      ),
    ).toEqual({
      accepted: true,
      operation: "move",
      finalIndex: 0,
      changesSource: true,
    });
    const result = requireSuccess(
      applyAuthoringSlotEdit(
        document,
        catalog,
        FIXTURE_ROUTE,
        fixtureSelection("behaviorDrop", "behavior"),
        { kind: "place", nodeId: "move.category", index: 0 },
      ),
    );

    expect(result.operation).toBe("move");
    expect(result.nodeId).toBe("move.category");
    expect(rootSlotIds(result.document, "main", "movable")).toEqual(["move.exact"]);
    expect(behaviorSlotIds(result.document, "main", "fixture.behavior", "behaviorDrop")).toEqual([
      "move.category",
    ]);
    expect(findNode(result.document, "main", "move.category")).toEqual(originalNode);
    expect(canonical(document)).toBe(before);
    expectDeeplyFrozen(result.document);
  });

  it("deletes from a behavior-owned slot and retains its own empty slot key", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const moved = requireSuccess(
      applyAuthoringSlotEdit(
        document,
        catalog,
        FIXTURE_ROUTE,
        fixtureSelection("behaviorDrop", "behavior"),
        { kind: "place", nodeId: "move.category", index: 0 },
      ),
    );
    const selection = createAuthoringComponentSelection({
      projectId: FIXTURE_ROUTE.projectId,
      surfaceId: FIXTURE_ROUTE.surfaceId,
      sourceNodeId: "move.category",
      capabilityId: CATEGORY_CAPABILITY,
      displayName: "Category",
      conditional: false,
    });
    const removed = requireSuccess(
      applyAuthoringNodeDelete(moved.document, catalog, FIXTURE_ROUTE, selection),
    );
    const behavior = removed.document.surfaces.main?.root.behaviors?.find(
      ({ id }) => id === "fixture.behavior",
    );

    expect(removed.operation).toBe("delete");
    expect(findNode(removed.document, "main", "move.category")).toBeUndefined();
    expect(behaviorSlotIds(removed.document, "main", "fixture.behavior", "behaviorDrop")).toEqual(
      [],
    );
    expect(Object.hasOwn(behavior?.slots ?? {}, "behaviorDrop")).toBe(true);
  });

  it("rejects crossing a source minimum or destination maximum atomically", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const model = requireModel(catalog, document);
    const before = canonical(document);

    expect(
      evaluateAuthoringSlotPlacement(
        FIXTURE_ROUTE,
        model,
        fixtureSelection("unrestricted"),
        "required.only",
        0,
      ),
    ).toEqual({ accepted: false, reason: "cardinality-rejected" });
    expect(
      evaluateAuthoringSlotPlacement(
        FIXTURE_ROUTE,
        model,
        fixtureSelection("full"),
        "move.category",
        1,
      ),
    ).toEqual({ accepted: false, reason: "cardinality-rejected" });

    expect(
      applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, fixtureSelection("unrestricted"), {
        kind: "place",
        nodeId: "required.only",
        index: 0,
      }),
    ).toMatchObject({ ok: false, reason: "cardinality-rejected" });
    expect(
      applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, fixtureSelection("full"), {
        kind: "place",
        nodeId: "move.category",
        index: 1,
      }),
    ).toMatchObject({ ok: false, reason: "cardinality-rejected" });
    expect(canonical(document)).toBe(before);
  });

  it("disables root deletion and deletion across the owning slot minimum", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const model = requireModel(catalog, document);
    const before = canonical(document);
    const requiredSelection = createAuthoringComponentSelection({
      projectId: FIXTURE_ROUTE.projectId,
      surfaceId: FIXTURE_ROUTE.surfaceId,
      sourceNodeId: "required.only",
      capabilityId: EXACT_CAPABILITY,
      displayName: "Exact",
      conditional: false,
    });
    const rootSelection = createAuthoringComponentSelection({
      projectId: FIXTURE_ROUTE.projectId,
      surfaceId: FIXTURE_ROUTE.surfaceId,
      sourceNodeId: "fixture.root",
      capabilityId: ROOT_CAPABILITY,
      displayName: "Slot root",
      conditional: false,
    });

    expect(evaluateAuthoringNodeDeletion(FIXTURE_ROUTE, model, requiredSelection)).toEqual({
      accepted: false,
      reason: "cardinality-rejected",
    });
    expect(evaluateAuthoringNodeDeletion(FIXTURE_ROUTE, model, rootSelection)).toEqual({
      accepted: false,
      reason: "target-invalid",
    });
    expect(applyAuthoringNodeDelete(document, catalog, FIXTURE_ROUTE, requiredSelection)).toEqual({
      ok: false,
      reason: "cardinality-rejected",
    });
    expect(applyAuthoringNodeDelete(document, catalog, FIXTURE_ROUTE, rootSelection)).toEqual({
      ok: false,
      reason: "target-invalid",
    });
    expect(canonical(document)).toBe(before);
  });

  it("rejects one insert or move into an absent optional minItems:2 slot", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const model = requireModel(catalog, document);
    const before = canonical(document);
    const absent = projectAuthoringSlotSelection(fixtureSelection("absent"), FIXTURE_ROUTE, model);
    if (absent.status !== "ready") throw new Error("Expected absent slot projection");

    expect(
      evaluateAuthoringSlotInsertion(
        FIXTURE_ROUTE,
        model,
        fixtureSelection("absent"),
        requireComponent(model, CATEGORY_CAPABILITY).id,
        0,
      ),
    ).toEqual({ accepted: false, reason: "minimum-unreachable" });
    expect(
      evaluateAuthoringSlotPlacement(
        FIXTURE_ROUTE,
        model,
        fixtureSelection("absent"),
        "move.category",
        0,
      ),
    ).toEqual({ accepted: false, reason: "cardinality-rejected" });

    expect(
      applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, fixtureSelection("absent"), {
        kind: "insert",
        componentId: CATEGORY_CAPABILITY,
        index: 0,
      }),
    ).toEqual({ ok: false, reason: "cardinality-rejected" });
    expect(
      applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, fixtureSelection("absent"), {
        kind: "place",
        nodeId: "move.category",
        index: 0,
      }),
    ).toEqual({ ok: false, reason: "cardinality-rejected" });
    expect(canonical(document)).toBe(before);
  });

  it("fails closed when a minimal insert cannot materialize the component's own required slot", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const model = requireModel(catalog, document);
    const before = canonical(document);
    const unrestricted = projectAuthoringSlotSelection(
      fixtureSelection("unrestricted"),
      FIXTURE_ROUTE,
      model,
    );
    if (unrestricted.status !== "ready") throw new Error("Expected unrestricted slot projection");

    expect(
      evaluateAuthoringSlotInsertion(
        FIXTURE_ROUTE,
        model,
        fixtureSelection("unrestricted"),
        requireComponent(model, ROOT_CAPABILITY).id,
        0,
      ),
    ).toEqual({ accepted: false, reason: "component-template-unavailable" });

    expect(
      applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, fixtureSelection("unrestricted"), {
        kind: "insert",
        componentId: ROOT_CAPABILITY,
        index: 0,
      }),
    ).toEqual({ ok: false, reason: "defaults-invalid" });
    expect(canonical(document)).toBe(before);
  });

  it("finishes a cross-owner move across 1,024 sibling nodes", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource(1_024));
    const model = requireModel(catalog, document);
    const source = projectAuthoringSlotSelection(fixtureSelection("movable"), FIXTURE_ROUTE, model);
    expect(source).toMatchObject({
      status: "ready",
      slot: { children: { length: 1_024 } },
    });
    const reorderBoundaries = Array.from({ length: 1_025 }, (_, index) =>
      evaluateAuthoringSlotPlacement(
        FIXTURE_ROUTE,
        model,
        fixtureSelection("movable"),
        "wide.1023",
        index,
      ),
    );
    expect(reorderBoundaries.every(({ accepted }) => accepted)).toBe(true);
    expect(
      reorderBoundaries.filter(
        (compatibility) => compatibility.accepted && !compatibility.changesSource,
      ),
    ).toHaveLength(2);

    const result = requireSuccess(
      applyAuthoringSlotEdit(
        document,
        catalog,
        FIXTURE_ROUTE,
        fixtureSelection("behaviorDrop", "behavior"),
        { kind: "place", nodeId: "wide.1023", index: 0 },
      ),
    );
    expect(result.operation).toBe("move");
    expect(rootSlotIds(result.document, "main", "movable")).toHaveLength(1_023);
    expect(behaviorSlotIds(result.document, "main", "fixture.behavior", "behaviorDrop")).toEqual([
      "wide.1023",
    ]);
  });

  it("deletes the final node from a 1,024-sibling slot within the bounded profile", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource(1_024));
    const selection = createAuthoringComponentSelection({
      projectId: FIXTURE_ROUTE.projectId,
      surfaceId: FIXTURE_ROUTE.surfaceId,
      sourceNodeId: "wide.1023",
      capabilityId: CATEGORY_CAPABILITY,
      displayName: "Category",
      conditional: false,
    });
    const model = requireModel(catalog, document);

    expect(evaluateAuthoringNodeDeletion(FIXTURE_ROUTE, model, selection)).toEqual({
      accepted: true,
      reason: "accepted",
    });
    const removed = requireSuccess(
      applyAuthoringNodeDelete(document, catalog, FIXTURE_ROUTE, selection),
    );
    expect(rootSlotIds(removed.document, "main", "movable")).toHaveLength(1_023);
    expect(findNode(removed.document, "main", "wide.1023")).toBeUndefined();
  });
});

describe("hostile slot routes, selections, and edits", () => {
  it("rejects stale and forged selections without mutating Source", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const before = canonical(document);
    const stale = {
      ...fixtureSelection("unrestricted"),
      ownerId: "fixture.removed",
    } satisfies AuthoringSlotSelection;
    const forged = {
      ...fixtureSelection("unrestricted"),
      ownerCapabilityId: CATEGORY_CAPABILITY,
    } satisfies AuthoringSlotSelection;

    expect(
      applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, stale, {
        kind: "insert",
        componentId: EXACT_CAPABILITY,
        index: 0,
      }),
    ).toMatchObject({ ok: false, reason: "target-invalid" });
    expect(
      applyAuthoringSlotEdit(document, catalog, FIXTURE_ROUTE, forged, {
        kind: "insert",
        componentId: EXACT_CAPABILITY,
        index: 0,
      }),
    ).toMatchObject({ ok: false, reason: "target-invalid" });
    expect(canonical(document)).toBe(before);
  });

  it("rejects cross-route and extra-field inputs", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const before = canonical(document);
    const crossRoute = {
      projectId: "another-project",
      surfaceId: FIXTURE_ROUTE.surfaceId,
    } satisfies AuthoringSlotRoute;
    const extraEdit = {
      kind: "insert",
      componentId: EXACT_CAPABILITY,
      index: 0,
      unexpected: true,
    } as const;

    expect(
      applyAuthoringSlotEdit(document, catalog, crossRoute, fixtureSelection("unrestricted"), {
        kind: "insert",
        componentId: EXACT_CAPABILITY,
        index: 0,
      }),
    ).toMatchObject({ ok: false, reason: "edit-rejected" });
    expect(
      applyAuthoringSlotEdit(
        document,
        catalog,
        FIXTURE_ROUTE,
        fixtureSelection("unrestricted"),
        extraEdit,
      ),
    ).toMatchObject({ ok: false, reason: "edit-rejected" });
    expect(canonical(document)).toBe(before);
  });

  it("never invokes accessors on hostile selection or edit objects", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    let selectionReads = 0;
    let editReads = 0;
    const accessorSelection = {
      ...fixtureSelection("unrestricted"),
    } as Record<string, unknown>;
    Object.defineProperty(accessorSelection, "ownerId", {
      enumerable: true,
      get() {
        selectionReads += 1;
        return "fixture.root";
      },
    });
    const accessorEdit: Record<string, unknown> = {
      kind: "insert",
      componentId: EXACT_CAPABILITY,
    };
    Object.defineProperty(accessorEdit, "index", {
      enumerable: true,
      get() {
        editReads += 1;
        return 0;
      },
    });

    expect(
      applyAuthoringSlotEdit(
        document,
        catalog,
        FIXTURE_ROUTE,
        accessorSelection as unknown as AuthoringSlotSelection,
        { kind: "insert", componentId: EXACT_CAPABILITY, index: 0 },
      ),
    ).toMatchObject({ ok: false, reason: "edit-rejected" });
    expect(
      applyAuthoringSlotEdit(
        document,
        catalog,
        FIXTURE_ROUTE,
        fixtureSelection("unrestricted"),
        accessorEdit as unknown as Parameters<typeof applyAuthoringSlotEdit>[4],
      ),
    ).toMatchObject({ ok: false, reason: "edit-rejected" });
    expect(selectionReads).toBe(0);
    expect(editReads).toBe(0);
  });

  it("captures deletion selections as exact own data and rejects cross-route authority", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const before = canonical(document);
    let reads = 0;
    const accessorSelection = {
      kind: "component",
      projectId: FIXTURE_ROUTE.projectId,
      surfaceId: FIXTURE_ROUTE.surfaceId,
      sourceNodeId: "move.category",
      capabilityId: CATEGORY_CAPABILITY,
      displayName: "Category",
      conditional: false,
    } as Record<string, unknown>;
    Object.defineProperty(accessorSelection, "sourceNodeId", {
      enumerable: true,
      get() {
        reads += 1;
        return "move.category";
      },
    });
    const crossRoute = createAuthoringComponentSelection({
      projectId: "another-project",
      surfaceId: FIXTURE_ROUTE.surfaceId,
      sourceNodeId: "move.category",
      capabilityId: CATEGORY_CAPABILITY,
      displayName: "Category",
      conditional: false,
    });
    const extraSelection = {
      ...crossRoute,
      projectId: FIXTURE_ROUTE.projectId,
      unexpected: true,
    } as unknown as AuthoringComponentSelection;

    expect(
      applyAuthoringNodeDelete(
        document,
        catalog,
        FIXTURE_ROUTE,
        accessorSelection as unknown as AuthoringComponentSelection,
      ),
    ).toEqual({ ok: false, reason: "edit-rejected" });
    expect(applyAuthoringNodeDelete(document, catalog, FIXTURE_ROUTE, crossRoute)).toEqual({
      ok: false,
      reason: "edit-rejected",
    });
    expect(applyAuthoringNodeDelete(document, catalog, FIXTURE_ROUTE, extraSelection)).toEqual({
      ok: false,
      reason: "edit-rejected",
    });
    expect(reads).toBe(0);
    expect(canonical(document)).toBe(before);
  });

  it.each([
    ["missing identity", { sourceNodeId: "missing.node" }],
    ["stale capability", { capabilityId: EXACT_CAPABILITY }],
    ["stale display name", { displayName: "Renamed elsewhere" }],
    ["stale conditional state", { conditional: true }],
  ])("rejects deletion with a %s", (_label, changed) => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const before = canonical(document);
    const selection = {
      ...createAuthoringComponentSelection({
        projectId: FIXTURE_ROUTE.projectId,
        surfaceId: FIXTURE_ROUTE.surfaceId,
        sourceNodeId: "move.category",
        capabilityId: CATEGORY_CAPABILITY,
        displayName: "Category",
        conditional: false,
      }),
      ...changed,
    } as AuthoringComponentSelection;
    const model = requireModel(catalog, document);

    expect(evaluateAuthoringNodeDeletion(FIXTURE_ROUTE, model, selection)).toEqual({
      accepted: false,
      reason: "target-invalid",
    });
    expect(applyAuthoringNodeDelete(document, catalog, FIXTURE_ROUTE, selection)).toEqual({
      ok: false,
      reason: "target-invalid",
    });
    expect(canonical(document)).toBe(before);
  });

  it("captures every edit Proxy own descriptor exactly once", () => {
    const catalog = createFixtureCatalog();
    const document = requireDocument(createFixtureSource());
    const descriptorReads = new Map<PropertyKey, number>();
    let directReads = 0;
    let ownKeyReads = 0;
    const edit = new Proxy(
      {
        kind: "insert" as const,
        componentId: CATEGORY_CAPABILITY,
        index: 0,
      },
      {
        get(target, property, receiver) {
          directReads += 1;
          return Reflect.get(target, property, receiver);
        },
        getOwnPropertyDescriptor(target, property) {
          descriptorReads.set(property, (descriptorReads.get(property) ?? 0) + 1);
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
        ownKeys(target) {
          ownKeyReads += 1;
          return Reflect.ownKeys(target);
        },
      },
    );

    const result = requireSuccess(
      applyAuthoringSlotEdit(
        document,
        catalog,
        FIXTURE_ROUTE,
        fixtureSelection("unrestricted"),
        edit,
      ),
    );
    expect(result.operation).toBe("insert");
    expect(ownKeyReads).toBe(1);
    expect(directReads).toBe(0);
    expect(Object.fromEntries(descriptorReads)).toEqual({
      componentId: 1,
      index: 1,
      kind: 1,
    });
  });
});
