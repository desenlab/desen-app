import { describe, expect, it } from "vitest";

import { projectAuthoringBehaviorControls } from "../src/authoring-behavior-projection.js";
import { REFERENCE_EDITOR_DOCUMENT } from "../src/authoring-preview.js";

describe("Desen App behavior-control projection", () => {
  it("finds the selected condition and operation aliases from exact authored actions", () => {
    const result = projectAuthoringBehaviorControls(
      REFERENCE_EDITOR_DOCUMENT,
      "sign-in",
      "sign-in.error",
    );

    expect(result).toMatchObject({
      status: "ready",
      currentWhen: {
        op: "eq",
        args: [{ $ref: "operation.signIn.status" }, "failed"],
      },
      inputConnectionStateName: null,
      operationAliases: [{ alias: "signIn", operationId: "com.example.auth/signIn" }],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.status === "ready" && Object.isFrozen(result.operationAliases)).toBe(true);
  });

  it("reports an input connection only when value and its canonical change write agree", () => {
    const connected = projectAuthoringBehaviorControls(
      REFERENCE_EDITOR_DOCUMENT,
      "sign-in",
      "sign-in.email",
    );
    expect(connected).toMatchObject({
      status: "ready",
      inputConnectionStateName: "email",
    });

    const halfBound = structuredClone(REFERENCE_EDITOR_DOCUMENT);
    const email = halfBound.surfaces["sign-in"]?.root.slots?.default?.find(
      ({ id }) => id === "sign-in.email",
    );
    if (email === undefined) throw new Error("Expected email node.");
    delete (email as unknown as { on?: typeof email.on }).on;
    expect(projectAuthoringBehaviorControls(halfBound, "sign-in", "sign-in.email")).toMatchObject({
      status: "ready",
      inputConnectionStateName: null,
    });
  });

  it("does not report connected when the bound state has another noncanonical change write", () => {
    const conflicting = structuredClone(REFERENCE_EDITOR_DOCUMENT);
    const email = conflicting.surfaces["sign-in"]?.root.slots?.default?.find(
      ({ id }) => id === "sign-in.email",
    );
    const change = email?.on?.change;
    if (change === undefined) throw new Error("Expected email change actions.");
    (change as unknown as { type: "state.set"; path: string; value: string }[]).push({
      type: "state.set",
      path: "email",
      value: "",
    });

    expect(projectAuthoringBehaviorControls(conflicting, "sign-in", "sign-in.email")).toMatchObject(
      {
        status: "ready",
        inputConnectionStateName: null,
      },
    );
  });

  it("does not report a conditional state write as the canonical input connection", () => {
    const conditional = structuredClone(REFERENCE_EDITOR_DOCUMENT);
    const email = conditional.surfaces["sign-in"]?.root.slots?.default?.find(
      ({ id }) => id === "sign-in.email",
    );
    const write = email?.on?.change?.[0];
    if (write?.type !== "state.set") throw new Error("Expected email state write.");
    (write as unknown as { when: unknown }).when = {
      op: "truthy",
      args: [{ $ref: "state.email" }],
    };

    expect(projectAuthoringBehaviorControls(conditional, "sign-in", "sign-in.email")).toMatchObject(
      {
        status: "ready",
        inputConnectionStateName: null,
      },
    );
  });

  it("fails closed when the selected node is absent", () => {
    expect(
      projectAuthoringBehaviorControls(REFERENCE_EDITOR_DOCUMENT, "sign-in", "missing"),
    ).toEqual({ status: "rejected" });
  });

  it("rejects oversized action traversal without a bulk spread", () => {
    const oversized = structuredClone(REFERENCE_EDITOR_DOCUMENT);
    const surface = oversized.surfaces["sign-in"];
    if (surface === undefined) throw new Error("Expected sign-in surface.");
    const root = surface.root as unknown as {
      on?: Record<string, unknown[]>;
    };
    root.on = {
      overflow: Array.from({ length: 25_001 }, () => ({
        type: "state.set" as const,
        path: "email",
        value: "",
      })),
    };

    expect(projectAuthoringBehaviorControls(oversized, "sign-in", "sign-in.layout")).toEqual({
      status: "rejected",
    });
  });
});
