import { bindReferenceSignInHostOperation } from "../src/host-operations/index.js";
import {
  SIGN_IN_OPERATION_ID,
  signInOperationFixtures,
  signInOperationRegistration,
} from "../src/operations/index.js";

import type { SignInHostOperationHandler } from "../src/host-operations/index.js";
import type {
  SignInOperationErrorCode,
  SignInOperationFixtureErrorCode,
  SignInOperationInput,
  SignInOperationOutput,
} from "../src/operations/index.js";

const input: SignInOperationInput = {
  email: "synthetic@example.invalid",
  password: "synthetic-password",
};
const output: SignInOperationOutput = { userId: "user-1" };
const publicError: SignInOperationErrorCode = "unavailable";
const fixtureError: SignInOperationFixtureErrorCode = "invalidCredentials";
const handler: SignInHostOperationHandler = () => ({ hostOwned: "opaque" });
const binding = bindReferenceSignInHostOperation(handler);
const exactId: "com.example.auth/signIn" = binding.operationId;

void exactId;
void fixtureError;
void input;
void output;
void publicError;
void signInOperationFixtures;
void signInOperationRegistration;
void SIGN_IN_OPERATION_ID;

// @ts-expect-error M03-T08-N01 Sign-in input requires a password.
const missingPassword: SignInOperationInput = { email: "synthetic@example.invalid" };

const extraInput: SignInOperationInput = {
  email: "synthetic@example.invalid",
  password: "synthetic-password",
  // @ts-expect-error M03-T08-N02 The closed input schema admits no additional properties.
  tenant: "production",
};

// @ts-expect-error M03-T08-N03 Successful output requires a userId.
const missingUserId: SignInOperationOutput = {};

const extraOutput: SignInOperationOutput = {
  userId: "user-1",
  // @ts-expect-error M03-T08-N04 The closed output schema admits no additional properties.
  accessToken: "synthetic-token",
};

// @ts-expect-error M03-T08-N05 Public error spelling derives from the exact manifest.
const unknownPublicError: SignInOperationErrorCode = "INVALID_CREDENTIALS";

// @ts-expect-error M03-T08-N06 Only invalidCredentials has an authoring fixture.
const unavailableFixture: SignInOperationFixtureErrorCode = "unavailable";

// @ts-expect-error M03-T08-N07 The handler input derives from the exact sign-in input schema.
const wrongInputHandler: SignInHostOperationHandler = (value: { email: number }) => value;

// @ts-expect-error M03-T08-N08 Host binding accepts only executable functions.
bindReferenceSignInHostOperation("not-a-function");

// @ts-expect-error M03-T08-N09 The fixed binding id is readonly.
binding.operationId = "com.example.auth/signIn";

// @ts-expect-error M03-T08-N10 The trusted handler reference is readonly.
binding.invoke = () => undefined;

void extraInput;
void extraOutput;
void missingPassword;
void missingUserId;
void unavailableFixture;
void unknownPublicError;
void wrongInputHandler;
