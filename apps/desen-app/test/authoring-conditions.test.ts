import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createDesenEditorDocument } from "@desen/editor-core";
import { canonicalizeJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import { applyAuthoringConditionEdit } from "../src/authoring-conditions.js";
import { prepareCatalogAuthoringModel } from "../src/authoring-data.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { AuthoringConditionRoute } from "../src/authoring-conditions.js";
import type { AuthoringLayerNode, CatalogAuthoringModel } from "../src/authoring-data.js";
import type { AuthoringComponentSelection } from "../src/authoring-selection.js";

type EditorNode = DesenEditorDocument["surfaces"][string]["root"];

const ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "sign-in",
}) satisfies AuthoringConditionRoute;

function documentFrom(source: unknown = officialSignInSource): DesenEditorDocument {
  const admitted = createDesenEditorDocument(source);
  expect(admitted.ok).toBe(true);
  if (!admitted.ok) throw new Error("Expected an Editor Core document.");
  return admitted.document;
}

function modelFor(document: DesenEditorDocument): CatalogAuthoringModel {
  const prepared = prepareCatalogAuthoringModel(referenceCatalog, document);
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) throw new Error(`Expected a model, received ${prepared.reason}.`);
  return prepared.model;
}

function findLayer(model: CatalogAuthoringModel, nodeId: string): AuthoringLayerNode {
  const surface = model.surfaces.find(({ id }) => id === ROUTE.surfaceId);
  if (surface === undefined) throw new Error("Missing sign-in surface.");
  const pending = [surface.root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === nodeId) return node;
    for (const slot of node.slots) pending.push(...slot.children);
    for (const behavior of node.behaviors) {
      for (const slot of behavior.slots) pending.push(...slot.children);
    }
  }
  throw new Error(`Missing authoring node ${nodeId}.`);
}

function selectionFor(document: DesenEditorDocument, nodeId: string): AuthoringComponentSelection {
  const node = findLayer(modelFor(document), nodeId);
  return createAuthoringComponentSelection({
    projectId: ROUTE.projectId,
    surfaceId: ROUTE.surfaceId,
    sourceNodeId: node.id,
    capabilityId: node.capabilityId,
    displayName: node.displayName,
    conditional: node.conditional,
  });
}

function findNode(document: DesenEditorDocument, nodeId: string): EditorNode {
  const surface = document.surfaces[ROUTE.surfaceId];
  if (surface === undefined) throw new Error("Missing sign-in surface.");
  const pending = [surface.root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === nodeId) return node;
    for (const children of Object.values(node.slots ?? {})) pending.push(...children);
    for (const behavior of node.behaviors ?? []) {
      for (const children of Object.values(behavior.slots ?? {})) pending.push(...children);
    }
  }
  throw new Error(`Missing Editor node ${nodeId}.`);
}

describe("Desen App selected-component conditions", () => {
  it("sets, replaces, and clears a condition through complete continuous validation", () => {
    const original = documentFrom();
    const before = canonicalizeJson(original);
    const set = applyAuthoringConditionEdit(
      original,
      referenceCatalog,
      ROUTE,
      selectionFor(original, "sign-in.title"),
      {
        kind: "set",
        when: { op: "truthy", args: [{ $ref: "state.email" }] },
      },
    );
    expect(set.ok).toBe(true);
    if (!set.ok) throw new Error(`Expected condition set, received ${set.reason}.`);
    expect(set.operation).toBe("set");
    expect(findNode(set.document, "sign-in.title").when).toEqual({
      op: "truthy",
      args: [{ $ref: "state.email" }],
    });
    expect(canonicalizeJson(original)).toBe(before);
    expect(Object.isFrozen(set.document)).toBe(true);
    expect(modelFor(set.document).validationDocument).toEqual(set.document);

    const replaced = applyAuthoringConditionEdit(
      set.document,
      referenceCatalog,
      ROUTE,
      selectionFor(set.document, "sign-in.title"),
      {
        kind: "set",
        when: { op: "eq", args: [{ $ref: "state.email" }, "show"] },
      },
    );
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) throw new Error(`Expected replacement, received ${replaced.reason}.`);
    expect(findNode(replaced.document, "sign-in.title").when).toEqual({
      op: "eq",
      args: [{ $ref: "state.email" }, "show"],
    });

    const cleared = applyAuthoringConditionEdit(
      replaced.document,
      referenceCatalog,
      ROUTE,
      selectionFor(replaced.document, "sign-in.title"),
      { kind: "clear" },
    );
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) throw new Error(`Expected clear, received ${cleared.reason}.`);
    expect(cleared.operation).toBe("clear");
    expect(Object.hasOwn(findNode(cleared.document, "sign-in.title"), "when")).toBe(false);
    expect(modelFor(cleared.document).validationDocument).toEqual(cleared.document);
  });

  it("rejects stale clear, structurally invalid, and semantically invalid predicates atomically", () => {
    const document = documentFrom();
    const title = selectionFor(document, "sign-in.title");
    expect(
      applyAuthoringConditionEdit(document, referenceCatalog, ROUTE, title, { kind: "clear" }),
    ).toEqual({ ok: false, reason: "condition-absent" });

    const malformed = applyAuthoringConditionEdit(document, referenceCatalog, ROUTE, title, {
      kind: "set",
      when: { op: "unsupported", args: [true] },
    } as never);
    expect(malformed).toEqual({ ok: false, reason: "edit-rejected" });
    expect(malformed).not.toHaveProperty("document");

    const missingReference = applyAuthoringConditionEdit(document, referenceCatalog, ROUTE, title, {
      kind: "set",
      when: { op: "truthy", args: [{ $ref: "state.missing" }] },
    });
    expect(missingReference).toMatchObject({ ok: false, reason: "source-invalid" });
    expect(missingReference).not.toHaveProperty("document");
    expect(canonicalizeJson(document)).toBe(canonicalizeJson(documentFrom()));

    const alert = selectionFor(document, "sign-in.error");
    expect(alert.conditional).toBe(true);
    expect(
      applyAuthoringConditionEdit(
        document,
        referenceCatalog,
        ROUTE,
        {
          ...alert,
          conditional: false,
        },
        { kind: "clear" },
      ),
    ).toEqual({ ok: false, reason: "selection-invalid" });
  });

  it("contains accessor and extra-key condition requests without reading them", () => {
    const document = documentFrom();
    const selection = selectionFor(document, "sign-in.title");
    let reads = 0;
    const accessor = Object.defineProperty({ kind: "set" }, "when", {
      enumerable: true,
      get() {
        reads += 1;
        return { op: "truthy", args: [true] };
      },
    });
    expect(
      applyAuthoringConditionEdit(document, referenceCatalog, ROUTE, selection, accessor as never),
    ).toEqual({ ok: false, reason: "edit-rejected" });
    expect(reads).toBe(0);
    expect(
      applyAuthoringConditionEdit(document, referenceCatalog, ROUTE, selection, {
        kind: "clear",
        extra: true,
      } as never),
    ).toEqual({ ok: false, reason: "edit-rejected" });

    const hostile = new Proxy({ kind: "clear" } as const, {
      getOwnPropertyDescriptor() {
        throw new Error("hostile condition request");
      },
    });
    expect(
      applyAuthoringConditionEdit(document, referenceCatalog, ROUTE, selection, hostile),
    ).toEqual({ ok: false, reason: "edit-rejected" });
  });
});
