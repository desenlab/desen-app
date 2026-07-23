import { registerOperation } from "@desen/catalog-sdk";

import type { JsonSchemaValue } from "@desen/catalog-sdk";

/**
 * Exact sign-in capability identifier from the frozen DESEN 0.1.0 Web Catalog example.
 *
 * @remarks A design may reference this identifier, but it cannot select the implementation
 * behind it. The trusted host supplies that implementation through a separate package subpath.
 */
export const SIGN_IN_OPERATION_ID = "com.example.auth/signIn";

/**
 * Immutable, data-only registration for the reference sign-in operation.
 *
 * @remarks The complete manifest mirrors the frozen DESEN 0.1.0 Web Catalog example. Its
 * authoring fixtures contain only a synthetic successful output and an empty public-error
 * payload. They contain no credential input, endpoint, implementation, authorization decision,
 * or production data.
 */
export const signInOperationRegistration = registerOperation({
  id: SIGN_IN_OPERATION_ID,
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

/**
 * Exact authoring-only fixture object owned by {@link signInOperationRegistration}.
 *
 * @remarks This is the same recursively frozen object held by the manifest, not a second fixture
 * authority. `pending` is intentionally absent because it is operation lifecycle state produced
 * by the future runtime, not a static fixture payload.
 */
export const signInOperationFixtures = signInOperationRegistration.manifest.authoring.fixtures;

/** Resolved sign-in input derived from the authoritative Catalog input schema. */
export type SignInOperationInput = JsonSchemaValue<
  typeof signInOperationRegistration.manifest.inputSchema
>;

/** Resolved successful sign-in output derived from the authoritative Catalog output schema. */
export type SignInOperationOutput = JsonSchemaValue<
  typeof signInOperationRegistration.manifest.outputSchema
>;

/** Public error code declared by the authoritative sign-in operation manifest. */
export type SignInOperationErrorCode =
  (typeof signInOperationRegistration.manifest.errors)[number]["code"];

/** Public error code for which the authoritative manifest provides a synthetic fixture. */
export type SignInOperationFixtureErrorCode = keyof typeof signInOperationFixtures.errors;
