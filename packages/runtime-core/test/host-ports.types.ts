import { createRuntimeHostPorts } from "../src/index.js";

import type {
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeJsonValue,
  RuntimeNavigationResult,
  RuntimeTokenResolution,
} from "../src/index.js";

const jsonValue: RuntimeJsonValue = {
  primitive: "value",
  nested: [{ count: 1, enabled: true }, null],
};
const jsonObject: RuntimeJsonObject = { value: jsonValue };
void jsonObject;

// @ts-expect-error functions cannot cross the JSON value boundary
const functionValue: RuntimeJsonValue = () => "executable";
void functionValue;

// @ts-expect-error undefined is not a JSON value
const undefinedValue: RuntimeJsonValue = undefined;
void undefinedValue;

// @ts-expect-error bigint is not a JSON number
const bigintValue: RuntimeJsonValue = 1n;
void bigintValue;

const success: RuntimeHostCallResult = { status: "succeeded", value: { ok: true } };
const failure: RuntimeHostCallResult = { status: "failed", errorCode: "publicCode" };
const denial: RuntimeHostCallResult = { status: "denied" };
void [success, failure, denial];

// @ts-expect-error a declared failure must carry its public error code
const missingFailureCode: RuntimeHostCallResult = { status: "failed" };
void missingFailureCode;

// @ts-expect-error denial cannot smuggle a success value
const falseDenial: RuntimeHostCallResult = { status: "denied", value: true };
void falseDenial;

const navigationSuccess: RuntimeNavigationResult = { status: "succeeded" };
const navigationDenial: RuntimeNavigationResult = { status: "denied" };
void [navigationSuccess, navigationDenial];

// @ts-expect-error navigation has no protocol-defined public failure payload
const navigationLeak: RuntimeNavigationResult = { status: "denied", message: "secret" };
void navigationLeak;

const tokenValue: RuntimeTokenResolution = { status: "resolved", value: "#fff" };
const missingToken: RuntimeTokenResolution = { status: "missing" };
void [tokenValue, missingToken];

// @ts-expect-error missing tokens cannot carry guessed fallback data
const guessedToken: RuntimeTokenResolution = { status: "missing", value: "#000" };
void guessedToken;

declare const validPorts: RuntimeHostPorts;
createRuntimeHostPorts(validPorts);

const receiverDependentClock = {
  now(this: { readonly value: number }): number {
    return this.value;
  },
};

// @ts-expect-error host callbacks must be receiver-independent or pre-bound
createRuntimeHostPorts({ ...validPorts, clock: receiverDependentClock });

// @ts-expect-error every host boundary is explicit, including diagnostics
createRuntimeHostPorts({
  navigation: validPorts.navigation,
  storage: validPorts.storage,
  operations: validPorts.operations,
  resources: validPorts.resources,
  tokens: validPorts.tokens,
  context: validPorts.context,
  environment: validPorts.environment,
  clock: validPorts.clock,
});
