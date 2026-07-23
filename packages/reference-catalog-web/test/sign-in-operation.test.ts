import { registerOperation } from "@desen/catalog-sdk";
import { describe, expect, it } from "vitest";

import { bindReferenceSignInHostOperation } from "../src/host-operations/index.js";
import {
  SIGN_IN_OPERATION_ID,
  signInOperationFixtures,
  signInOperationRegistration,
} from "../src/operations/index.js";

import type { SignInHostOperationHandler } from "../src/host-operations/index.js";

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

describe("reference sign-in operation and trusted host binding", () => {
  it("registers the exact inert sign-in contract and controlled authoring fixtures", () => {
    expect(SIGN_IN_OPERATION_ID).toBe("com.example.auth/signIn");
    expect(signInOperationRegistration).toEqual({
      id: "com.example.auth/signIn",
      manifest: {
        description: "Authenticate with email and password.",
        inputSchema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          additionalProperties: false,
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
            },
            password: {
              type: "string",
              minLength: 1,
            },
          },
        },
        outputSchema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          additionalProperties: false,
          required: ["userId"],
          properties: {
            userId: {
              type: "string",
            },
          },
        },
        errors: [
          {
            code: "invalidCredentials",
            description: "Credentials are not accepted.",
          },
          {
            code: "unavailable",
            description: "Authentication service unavailable.",
          },
        ],
        effect: "network",
        authoring: {
          fixtures: {
            success: {
              userId: "user-1",
            },
            errors: {
              invalidCredentials: {},
            },
          },
        },
      },
    });
    expect(signInOperationFixtures).toBe(signInOperationRegistration.manifest.authoring.fixtures);
    expect(Object.keys(signInOperationFixtures).sort()).toEqual(["errors", "success"]);
    expect(Object.keys(signInOperationFixtures.errors)).toEqual(["invalidCredentials"]);
    expect(signInOperationFixtures).not.toHaveProperty("pending");
    expect(JSON.stringify(signInOperationFixtures)).not.toContain("email");
    expect(JSON.stringify(signInOperationFixtures)).not.toContain("password");
    expectDeeplyFrozen(signInOperationRegistration);
  });

  it("binds the fixed capability to the exact handler without eager execution or wrapping", () => {
    let calls = 0;
    const opaqueHostResult = Object.freeze({ hostOwned: "opaque-result" });
    const handler: SignInHostOperationHandler = (input) => {
      calls += 1;
      expect(input).toEqual({
        email: "synthetic@example.invalid",
        password: "synthetic-password",
      });
      return opaqueHostResult;
    };

    const binding = bindReferenceSignInHostOperation(handler);

    expect(calls).toBe(0);
    expect(binding.operationId).toBe(SIGN_IN_OPERATION_ID);
    expect(binding.invoke).toBe(handler);
    expect(Reflect.ownKeys(binding)).toEqual(["operationId", "invoke"]);
    expect(Object.isFrozen(binding)).toBe(true);

    expect(
      binding.invoke({
        email: "synthetic@example.invalid",
        password: "synthetic-password",
      }),
    ).toBe(opaqueHostResult);
    expect(calls).toBe(1);
  });

  it("rejects non-functions and cannot pass an executable binding through manifest registration", () => {
    expect(() =>
      bindReferenceSignInHostOperation(null as unknown as SignInHostOperationHandler),
    ).toThrowError(new TypeError("Reference sign-in host operation handler must be a function"));

    const binding = bindReferenceSignInHostOperation(() => undefined);
    expect(() =>
      registerOperation(binding as unknown as Parameters<typeof registerOperation>[0]),
    ).toThrow(TypeError);
  });
});
