import {
  createRuntimeResolutionSnapshot,
  evaluateRuntimeConditionalPresence,
  evaluateRuntimePredicate,
} from "../src/index.js";

import type {
  RuntimeConditionalPresence,
  RuntimePredicateArgument,
  RuntimePredicateDeferred,
  RuntimePredicateEvaluated,
  RuntimePredicateEvaluation,
  RuntimePredicateInvalid,
  RuntimePredicateInvalidReason,
  RuntimePredicateOperator,
  RuntimePredicateSpec,
  RuntimePredicateTypeMismatch,
} from "../src/index.js";

const snapshot = createRuntimeResolutionSnapshot({
  state: { enabled: true },
  context: {},
  resource: {},
  operation: {},
  event: { status: "unavailable" },
  item: {},
  env: {},
});

const operators = [
  "all",
  "any",
  "not",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "contains",
  "exists",
  "truthy",
] as const satisfies readonly RuntimePredicateOperator[];
void operators;

const nested: RuntimePredicateSpec = {
  op: "all",
  args: [true, { op: "eq", args: [{ $ref: "state.enabled" }, true] }],
};
const argument: RuntimePredicateArgument = nested;
void argument;

const result: RuntimePredicateEvaluation = evaluateRuntimePredicate(nested, snapshot);
if (result.status === "evaluated") {
  const value: boolean = result.value;
  const diagnostics: readonly RuntimePredicateTypeMismatch[] = result.diagnostics;
  void [value, diagnostics];
  // @ts-expect-error evaluated predicates do not expose deferred forms
  void result.form;
} else if (result.status === "deferred") {
  const form: "token" | "format" = result.form;
  void form;
  // @ts-expect-error deferred predicates never expose a guessed boolean
  void result.value;
} else {
  const reason: RuntimePredicateInvalidReason = result.reason;
  void reason;
  // @ts-expect-error invalid predicates never expose partial diagnostics
  void result.diagnostics;
}

const presence: RuntimeConditionalPresence = evaluateRuntimeConditionalPresence(
  undefined,
  snapshot,
);
if (presence.status === "evaluated") {
  const present: boolean = presence.present;
  const diagnostics: readonly RuntimePredicateTypeMismatch[] = presence.diagnostics;
  void [present, diagnostics];
} else {
  const absent: false = presence.present;
  void absent;
  // @ts-expect-error fail-closed presence outcomes carry no partial diagnostics
  void presence.diagnostics;
}

const evaluated: RuntimePredicateEvaluated = {
  status: "evaluated",
  value: true,
  diagnostics: [],
};
const deferred: RuntimePredicateDeferred = {
  status: "deferred",
  form: "token",
  pointer: "/args/0/$token" as never,
};
const invalid: RuntimePredicateInvalid = {
  status: "invalid",
  pointer: "/op" as never,
  reason: "malformed-predicate",
};
void [evaluated, deferred, invalid];

// @ts-expect-error the operator vocabulary is closed
const executableOperator: RuntimePredicateOperator = "javascript";
void executableOperator;

const executablePredicate: RuntimePredicateSpec = {
  // @ts-expect-error root predicates cannot select arbitrary executable operators
  op: "eval",
  args: ["state.enabled"],
};
void executablePredicate;

// @ts-expect-error functions are not inert predicate arguments
const executableArgument: RuntimePredicateArgument = () => true;
void executableArgument;

// @ts-expect-error predicate specifications are immutable
nested.op = "any";

// @ts-expect-error predicate argument arrays are immutable
nested.args.push(false);

// @ts-expect-error predicate evaluation requires an atomic snapshot
evaluateRuntimePredicate(nested);

// @ts-expect-error package-internal preparation is not a root public API
import { prepareRuntimePredicateEvaluation } from "../src/index.js";
void prepareRuntimePredicateEvaluation;

// @ts-expect-error package-internal resolution is not a root public API
import { resolveRuntimePredicateOperands } from "../src/index.js";
void resolveRuntimePredicateOperands;

// @ts-expect-error package-internal evaluation is not a root public API
import { evaluatePreparedRuntimePredicate } from "../src/index.js";
void evaluatePreparedRuntimePredicate;
