import { describe, expect, it } from "vitest";

import {
  createAuthoringComponentSelection,
  isSameAuthoringComponentSelection,
  projectAuthoringSelection,
} from "../src/authoring-selection.js";
import { REFERENCE_AUTHORING_MODEL } from "../src/authoring-data.js";

import type {
  RuntimeReactDiagnosticIndex,
  RuntimeReactDiagnosticIndexEntry,
} from "@desen/runtime-react";

function frozenLookup<T>(entries: readonly (readonly [string, T])[]): Readonly<Record<string, T>> {
  const output: Record<string, T> = Object.create(null) as Record<string, T>;
  for (const [key, value] of entries) output[key] = value;
  return Object.freeze(output);
}

function diagnosticIndex(capabilityId = "com.example.ui/TextField"): RuntimeReactDiagnosticIndex {
  return Object.freeze({
    byRuntimeNodeId: frozenLookup<RuntimeReactDiagnosticIndexEntry>([
      [
        "sign-in.email#0",
        Object.freeze({
          kind: "component" as const,
          runtimeNodeId: "sign-in.email#0",
          sourceNodeId: "sign-in.email",
          capabilityId,
        }),
      ],
      [
        "sign-in.email#1",
        Object.freeze({
          kind: "component" as const,
          runtimeNodeId: "sign-in.email#1",
          sourceNodeId: "sign-in.email",
          capabilityId,
        }),
      ],
      [
        "sign-in.email:validation#0",
        Object.freeze({
          kind: "behavior" as const,
          runtimeNodeId: "sign-in.email:validation#0",
          sourceNodeId: "sign-in.email",
          capabilityId: "com.example.behavior/Validation",
          behaviorId: "sign-in.email.validation",
          ownerRuntimeNodeId: "sign-in.email#0",
        }),
      ],
    ]),
    runtimeNodeIdsBySourceNodeId: frozenLookup<readonly string[]>([
      [
        "sign-in.email",
        Object.freeze(["sign-in.email#0", "sign-in.email#1", "sign-in.email:validation#0"]),
      ],
    ]),
    runtimeNodeIdsByBehaviorId: frozenLookup<readonly string[]>([
      ["sign-in.email.validation", Object.freeze(["sign-in.email:validation#0"])],
    ]),
  });
}

const ROUTE = Object.freeze({ projectId: "account-app", surfaceId: "sign-in" });

function emailSelection() {
  return createAuthoringComponentSelection({
    projectId: ROUTE.projectId,
    surfaceId: ROUTE.surfaceId,
    sourceNodeId: "sign-in.email",
    capabilityId: "com.example.ui/TextField",
    displayName: "Text field",
    conditional: false,
  });
}

describe("Desen App authoring selection projection", () => {
  it("creates only a frozen inert route and Source identity", () => {
    const selection = emailSelection();

    expect(selection).toEqual({
      kind: "component",
      projectId: "account-app",
      surfaceId: "sign-in",
      sourceNodeId: "sign-in.email",
      capabilityId: "com.example.ui/TextField",
      displayName: "Text field",
      conditional: false,
    });
    expect(Object.isFrozen(selection)).toBe(true);
    expect(Object.keys(selection).sort()).toEqual([
      "capabilityId",
      "conditional",
      "displayName",
      "kind",
      "projectId",
      "sourceNodeId",
      "surfaceId",
    ]);
    expect(isSameAuthoringComponentSelection(selection, emailSelection())).toBe(true);

    const extraInput = {
      ...selection,
      kind: "forged",
      callback: () => undefined,
    } as unknown as Parameters<typeof createAuthoringComponentSelection>[0];
    const recaptured = createAuthoringComponentSelection(extraInput);
    expect(recaptured.kind).toBe("component");
    expect(Object.hasOwn(recaptured, "callback")).toBe(false);
  });

  it("keeps idle and pre-render states explicit without inventing a runtime target", () => {
    expect(projectAuthoringSelection(null, ROUTE, REFERENCE_AUTHORING_MODEL, undefined)).toEqual({
      status: "idle",
    });
    expect(
      projectAuthoringSelection(emailSelection(), ROUTE, REFERENCE_AUTHORING_MODEL, undefined),
    ).toEqual({
      status: "unavailable",
      selection: emailSelection(),
    });
  });

  it("projects repeated component instances while excluding attached behavior identities", () => {
    const index = diagnosticIndex();
    const before = JSON.stringify(index);
    const projection = projectAuthoringSelection(
      emailSelection(),
      ROUTE,
      REFERENCE_AUTHORING_MODEL,
      {
        surfaceId: "sign-in",
        diagnosticIndex: index,
      },
    );

    expect(projection).toEqual({
      status: "materialized",
      selection: emailSelection(),
      runtimeNodeIds: ["sign-in.email#0", "sign-in.email#1"],
    });
    expect(projection.status === "materialized" && Object.isFrozen(projection.runtimeNodeIds)).toBe(
      true,
    );
    expect(Object.isFrozen(projection)).toBe(true);
    expect(JSON.stringify(index)).toBe(before);
  });

  it("reports a conditional Source component honestly when no runtime instance exists", () => {
    const selection = createAuthoringComponentSelection({
      projectId: "account-app",
      surfaceId: "sign-in",
      sourceNodeId: "sign-in.error",
      capabilityId: "com.example.ui/Alert",
      displayName: "Alert",
      conditional: true,
    });

    expect(
      projectAuthoringSelection(selection, ROUTE, REFERENCE_AUTHORING_MODEL, {
        surfaceId: "sign-in",
        diagnosticIndex: diagnosticIndex(),
      }),
    ).toEqual({ status: "not-materialized", selection });
  });

  it("rejects cross-route, cross-surface, and stale-capability identities closed", () => {
    const selection = emailSelection();
    const index = diagnosticIndex("com.example.ui/Text");

    expect(
      projectAuthoringSelection(
        selection,
        { projectId: "other", surfaceId: "sign-in" },
        REFERENCE_AUTHORING_MODEL,
        undefined,
      ),
    ).toEqual({ status: "rejected" });
    expect(
      projectAuthoringSelection(selection, ROUTE, REFERENCE_AUTHORING_MODEL, {
        surfaceId: "profile",
        diagnosticIndex: index,
      }),
    ).toEqual({ status: "rejected" });
    expect(
      projectAuthoringSelection(selection, ROUTE, REFERENCE_AUTHORING_MODEL, {
        surfaceId: "sign-in",
        diagnosticIndex: index,
      }),
    ).toEqual({ status: "rejected" });
  });

  it("rejects a forged same-route Source identity instead of treating it as conditional", () => {
    const forged = createAuthoringComponentSelection({
      projectId: "account-app",
      surfaceId: "sign-in",
      sourceNodeId: "sign-in.forged",
      capabilityId: "com.example.ui/Alert",
      displayName: "Forged",
      conditional: true,
    });

    expect(
      projectAuthoringSelection(forged, ROUTE, REFERENCE_AUTHORING_MODEL, {
        surfaceId: "sign-in",
        diagnosticIndex: diagnosticIndex(),
      }),
    ).toEqual({ status: "rejected" });
  });
});
