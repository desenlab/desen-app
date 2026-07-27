import { renderRuntimeReactSurface } from "../src/index.js";

import type {
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionSnapshot,
  RuntimeHeadlessSurfacePlan,
} from "@desen/runtime-core";
import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactComponentAdapterProps,
} from "../src/index.js";

declare const registry: RuntimeReactAdapterRegistryHandle;
declare const session: RuntimeHeadlessSessionHandle;
declare const snapshot: RuntimeHeadlessSessionSnapshot;
declare const catalogSet: DesenValidatedExecutionCatalogSet;
declare const plan: RuntimeHeadlessSurfacePlan;
declare const componentProps: RuntimeReactComponentAdapterProps;

renderRuntimeReactSurface({
  registry,
  session,
  snapshot,
  catalogSet,
  limits: {
    maxSlotContractEvaluationSteps: 1_000,
  },
});

renderRuntimeReactSurface({
  registry,
  session,
  snapshot,
  catalogSet,
  // @ts-expect-error Raw plans are never renderer authority.
  plan,
});

// @ts-expect-error Component adapters cannot observe raw behavior plans.
void componentProps.behaviors;
