import { describe, expect, it } from "vitest";

import {
  type AuthoringBehaviorLayer,
  type AuthoringLayerNode,
  type CatalogAuthoringModel,
  type CatalogComponentSummary,
} from "../src/authoring-data.js";
import { REFERENCE_AUTHORING_MODEL } from "../src/reference-authoring-profile.js";
import type { AuthoringSlotRoute } from "../src/authoring-slots.js";
import { APPROXIMATE_FIDELITY_FALLBACK, projectPreviewFidelity } from "../src/preview-fidelity.js";

const REFERENCE_ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "sign-in",
}) satisfies AuthoringSlotRoute;

const FIXTURE_ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "main",
}) satisfies AuthoringSlotRoute;

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

function componentSummary(
  id: string,
  adapterFidelity?: unknown,
  differences?: unknown,
): CatalogComponentSummary {
  const template = REFERENCE_AUTHORING_MODEL.components[0];
  if (template === undefined) throw new Error("Expected a reference component template.");
  const authoring: Record<string, unknown> = {};
  if (adapterFidelity !== undefined) authoring.adapterFidelity = adapterFidelity;
  if (differences !== undefined) authoring.differences = differences;
  return {
    ...template,
    id,
    displayName: id,
    inspector: {
      ...template.inspector,
      authoring,
    },
  } as unknown as CatalogComponentSummary;
}

function componentNode(
  id: string,
  capabilityId: string,
  slots: AuthoringLayerNode[][] = [],
  behaviors: AuthoringBehaviorLayer[] = [],
): AuthoringLayerNode {
  return {
    kind: "component",
    id,
    capabilityId,
    displayName: capabilityId,
    conditional: false,
    props: Object.freeze({}),
    behaviors,
    slotContracts: Object.freeze([]),
    slots: slots.map((children, index) => ({ name: `slot-${index}`, children })),
  };
}

function behaviorLayer(id: string, slots: AuthoringLayerNode[][]): AuthoringBehaviorLayer {
  return {
    kind: "behavior",
    id,
    capabilityId: "test/behavior",
    displayName: "Test behavior",
    conditional: false,
    slotContracts: Object.freeze([]),
    slots: slots.map((children, index) => ({ name: `behavior-slot-${index}`, children })),
  };
}

function fixtureModel(
  components: CatalogComponentSummary[],
  root: AuthoringLayerNode,
): CatalogAuthoringModel {
  return {
    ...REFERENCE_AUTHORING_MODEL,
    components,
    surfaces: [{ id: FIXTURE_ROUTE.surfaceId, root }],
  };
}

describe("preview fidelity projection", () => {
  it("reports the current reference surface as same-fidelity", () => {
    const result = projectPreviewFidelity(REFERENCE_AUTHORING_MODEL, REFERENCE_ROUTE);

    expect(result.status).toBe("ready");
    if (result.status !== "ready")
      throw new Error("Expected the reference projection to be ready.");
    expect(result.kind).toBe("same");
    expect(result.entries.map((entry) => entry.capabilityId)).toEqual([
      "com.example.ui/Alert",
      "com.example.ui/Button",
      "com.example.ui/Stack",
      "com.example.ui/Text",
      "com.example.ui/TextField",
    ]);
    expect(result.entries.every((entry) => entry.kind === "same")).toBe(true);
    expect(result.entries.every((entry) => entry.differences.length === 0)).toBe(true);
    expectDeeplyFrozen(result);
  });

  it("uses approximate, undeclared, equivalent, same precedence over unique nested capabilities", () => {
    const same = componentSummary("test/Same", "same", ["A declared same-fidelity note."]);
    const equivalent = componentSummary("test/Equivalent", "equivalent", ["Controls differ."]);
    const undeclared = componentSummary("test/Undeclared");
    const approximate = componentSummary("test/Approximate", "approximate", ["Animation differs."]);
    const approximateInBehaviorSlot = componentNode("approx-behavior", approximate.id);
    const root = componentNode(
      "root",
      same.id,
      [
        [
          componentNode("equivalent", equivalent.id, [
            [componentNode("undeclared", undeclared.id)],
          ]),
          componentNode("approx-direct", approximate.id),
        ],
      ],
      [behaviorLayer("owner-behavior", [[approximateInBehaviorSlot]])],
    );

    const result = projectPreviewFidelity(
      fixtureModel([approximate, same, undeclared, equivalent], root),
      FIXTURE_ROUTE,
    );

    expect(result).toEqual({
      status: "ready",
      kind: "approximate",
      entries: [
        {
          capabilityId: "test/Approximate",
          displayName: "test/Approximate",
          kind: "approximate",
          differences: ["Animation differs."],
        },
        {
          capabilityId: "test/Equivalent",
          displayName: "test/Equivalent",
          kind: "equivalent",
          differences: ["Controls differ."],
        },
        {
          capabilityId: "test/Same",
          displayName: "test/Same",
          kind: "same",
          differences: ["A declared same-fidelity note."],
        },
        {
          capabilityId: "test/Undeclared",
          displayName: "test/Undeclared",
          kind: "undeclared",
          differences: [],
        },
      ],
    });
    expectDeeplyFrozen(result);
  });

  it("fails closed to undeclared for missing or invalid fidelity metadata", () => {
    const missing = componentSummary("test/Missing");
    const invalid = componentSummary("test/Invalid", "perfect", ["Unrecognized claim."]);
    const root = componentNode("root", missing.id, [[componentNode("invalid", invalid.id)]]);

    expect(projectPreviewFidelity(fixtureModel([invalid, missing], root), FIXTURE_ROUTE)).toEqual({
      status: "ready",
      kind: "undeclared",
      entries: [
        {
          capabilityId: "test/Invalid",
          displayName: "test/Invalid",
          kind: "undeclared",
          differences: ["Unrecognized claim."],
        },
        {
          capabilityId: "test/Missing",
          displayName: "test/Missing",
          kind: "undeclared",
          differences: [],
        },
      ],
    });
  });

  it("retains all approximate differences and supplies an explicit empty-declaration fallback", () => {
    const complete = componentSummary("test/Complete", "approximate", [
      "First complete difference.",
      "Second complete difference.",
    ]);
    const empty = componentSummary("test/Empty", "approximate", []);
    const root = componentNode("root", complete.id, [[componentNode("empty", empty.id)]]);

    expect(projectPreviewFidelity(fixtureModel([empty, complete], root), FIXTURE_ROUTE)).toEqual({
      status: "ready",
      kind: "approximate",
      entries: [
        {
          capabilityId: "test/Complete",
          displayName: "test/Complete",
          kind: "approximate",
          differences: ["First complete difference.", "Second complete difference."],
        },
        {
          capabilityId: "test/Empty",
          displayName: "test/Empty",
          kind: "approximate",
          differences: [APPROXIMATE_FIDELITY_FALLBACK],
        },
      ],
    });
  });

  it("uses structural App routes without coupling fidelity to one project identity", () => {
    expect(
      projectPreviewFidelity(REFERENCE_AUTHORING_MODEL, {
        projectId: REFERENCE_ROUTE.projectId,
        surfaceId: "missing",
      }),
    ).toEqual({ status: "rejected" });
    expect(
      projectPreviewFidelity(REFERENCE_AUTHORING_MODEL, {
        projectId: "other-project",
        surfaceId: REFERENCE_ROUTE.surfaceId,
      }).status,
    ).toBe("ready");
    expect(
      projectPreviewFidelity(REFERENCE_AUTHORING_MODEL, {
        projectId: "",
        surfaceId: REFERENCE_ROUTE.surfaceId,
      }),
    ).toEqual({ status: "rejected" });
    expect(
      projectPreviewFidelity(REFERENCE_AUTHORING_MODEL, {
        ...REFERENCE_ROUTE,
        extra: true,
      } as unknown as AuthoringSlotRoute),
    ).toEqual({ status: "rejected" });
  });

  it("deduplicates deterministically regardless of traversal and component-library order", () => {
    const alpha = componentSummary("test/Alpha", "same");
    const zulu = componentSummary("test/Zulu", "equivalent");
    const root = componentNode("root", zulu.id, [
      [componentNode("alpha-1", alpha.id), componentNode("zulu-2", zulu.id)],
      [componentNode("alpha-2", alpha.id)],
    ]);
    const model = fixtureModel([zulu, alpha], root);

    const first = projectPreviewFidelity(model, FIXTURE_ROUTE);
    const second = projectPreviewFidelity(model, FIXTURE_ROUTE);

    expect(first).toEqual(second);
    expect(first).toEqual({
      status: "ready",
      kind: "equivalent",
      entries: [
        {
          capabilityId: "test/Alpha",
          displayName: "test/Alpha",
          kind: "same",
          differences: [],
        },
        {
          capabilityId: "test/Zulu",
          displayName: "test/Zulu",
          kind: "equivalent",
          differences: [],
        },
      ],
    });
    expectDeeplyFrozen(first);
  });
});
