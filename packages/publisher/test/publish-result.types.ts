import type { DesenBundle } from "@desen/protocol";
import type { ImmutableJson } from "@desen/validator";

import type {
  PublishDiagnostic,
  PublishErrorDiagnostic,
  PublishFailure,
  PublishPipelineStage,
  PublishResult,
  PublishSuccess,
  PublishWarningDiagnostic,
} from "../src/index.js";

declare const result: PublishResult;
declare const replacementBundle: PublishSuccess["bundle"];
declare const replacementStage: PublishPipelineStage;
declare const warningDiagnostic: PublishWarningDiagnostic;
declare const errorDiagnostic: PublishErrorDiagnostic;
declare const replacementDigest: string;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;

type Expect<Condition extends true> = Condition;

declare const contractAssertions: readonly [
  Expect<Equal<PublishResult, PublishSuccess | PublishFailure>>,
  Expect<Equal<PublishSuccess["ok"], true>>,
  Expect<Equal<PublishSuccess["bundle"], ImmutableJson<DesenBundle>>>,
  Expect<Equal<PublishSuccess["diagnostics"], readonly PublishWarningDiagnostic[]>>,
  Expect<Equal<PublishFailure["ok"], false>>,
  Expect<Equal<PublishFailure["stage"], PublishPipelineStage>>,
  Expect<
    Equal<PublishFailure["diagnostics"], readonly [PublishErrorDiagnostic, ...PublishDiagnostic[]]>
  >,
];

function expectType<Value>(value: Value): Value {
  return value;
}

expectType(contractAssertions);

if (result.ok) {
  const success: PublishSuccess = result;
  expectType(success.bundle);
  // @ts-expect-error The terminal discriminator is immutable.
  success.ok = true;
  success.diagnostics.forEach((diagnostic) => {
    const severity: "warning" = diagnostic.severity;
    expectType(severity);
  });
  // @ts-expect-error A successful terminal Bundle reference is immutable.
  success.bundle = replacementBundle;
  // @ts-expect-error Successful diagnostics are a readonly collection.
  success.diagnostics[0] = warningDiagnostic;
  const [catalog] = success.bundle.requires.catalogs;
  if (catalog !== undefined) {
    // @ts-expect-error Published Bundle data is recursively immutable.
    catalog.digest = replacementDigest;
  }
  // @ts-expect-error Successful terminal results have no failure stage.
  expectType(success.stage);
} else {
  const failure: PublishFailure = result;
  const stage: PublishPipelineStage = failure.stage;
  expectType(stage);
  // @ts-expect-error The terminal discriminator is immutable.
  failure.ok = false;
  const severity: "error" = failure.diagnostics[0].severity;
  expectType(severity);
  // @ts-expect-error The first failed publication stage is immutable.
  failure.stage = replacementStage;
  // @ts-expect-error Failure diagnostics are a readonly non-empty tuple.
  failure.diagnostics[0] = errorDiagnostic;
  // @ts-expect-error Rejected terminal results structurally omit Bundle data.
  expectType(failure.bundle);
}
