import { bindReferenceSignInHostOperation } from "@desen/reference-catalog-web/host-operations";
import {
  SIGN_IN_OPERATION_ID,
  signInOperationRegistration,
} from "@desen/reference-catalog-web/operations";
import { describe, expect, it } from "vitest";

import {
  createSyntheticFixtureSnapshot,
  lookupSyntheticOperationError,
  lookupSyntheticOperationSuccess,
  SYNTHETIC_FIXTURE_CONTEXT,
} from "../src/index.js";

import type { RegisteredOperation } from "@desen/catalog-sdk";

function expectInertDeeplyFrozenJson(value: unknown): void {
  if (value === null || typeof value !== "object") {
    expect(["string", "number", "boolean"].includes(typeof value) || value === null).toBe(true);
    return;
  }

  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") continue;
    expect(typeof key).toBe("string");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    expect(descriptor?.enumerable).toBe(true);
    expect(descriptor).toHaveProperty("value");
    expectInertDeeplyFrozenJson(descriptor?.value);
  }
}

describe("reference sign-in synthetic fixtures", () => {
  it("projects the controlled success and invalid-credentials outcomes without host data", () => {
    const snapshot = createSyntheticFixtureSnapshot({
      context: SYNTHETIC_FIXTURE_CONTEXT,
      operations: [signInOperationRegistration],
      resources: [],
    });

    expect(lookupSyntheticOperationSuccess(snapshot, SIGN_IN_OPERATION_ID)).toEqual({
      context: SYNTHETIC_FIXTURE_CONTEXT,
      status: "found",
      value: { userId: "user-1" },
    });
    expect(
      lookupSyntheticOperationError(snapshot, SIGN_IN_OPERATION_ID, "invalidCredentials"),
    ).toEqual({
      context: SYNTHETIC_FIXTURE_CONTEXT,
      status: "found",
      value: {},
    });
    expect(lookupSyntheticOperationError(snapshot, SIGN_IN_OPERATION_ID, "unavailable")).toEqual({
      context: SYNTHETIC_FIXTURE_CONTEXT,
      status: "missing",
    });
    expect(snapshot.operations[SIGN_IN_OPERATION_ID]).not.toHaveProperty("pending");
    expect(JSON.stringify(snapshot)).not.toContain("email");
    expect(JSON.stringify(snapshot)).not.toContain("password");
    expect(JSON.stringify(snapshot)).not.toContain("invoke");
    expect(snapshot.operations[SIGN_IN_OPERATION_ID]?.success).not.toBe(
      signInOperationRegistration.manifest.authoring.fixtures.success,
    );
    expectInertDeeplyFrozenJson(snapshot);
  });

  it("rejects the trusted host binding as synthetic operation data", () => {
    const binding = bindReferenceSignInHostOperation(() => undefined);

    expect(() =>
      createSyntheticFixtureSnapshot({
        context: SYNTHETIC_FIXTURE_CONTEXT,
        operations: [binding as unknown as RegisteredOperation],
        resources: [],
      }),
    ).toThrow(TypeError);
  });
});
