import { Fragment } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as RuntimeCoreModule from "@desen/runtime-core";

const COMPONENT_BINDING_PARITY_CASES = Object.freeze([
  "component-missing",
  "component-duplicate",
  "component-kind",
  "component-runtime-instance-id",
  "component-source-node-id",
  "component-capability-id",
] as const);

const BEHAVIOR_BINDING_PARITY_CASES = Object.freeze([
  "behavior-missing",
  "behavior-duplicate",
  "behavior-kind",
  "behavior-runtime-instance-id",
  "behavior-source-node-id",
  "behavior-capability-id",
  "behavior-behavior-id",
  "behavior-owner-runtime-instance-id",
] as const);

type BindingParityDriftCase =
  (typeof COMPONENT_BINDING_PARITY_CASES)[number] | (typeof BEHAVIOR_BINDING_PARITY_CASES)[number];

const parityMock = vi.hoisted(() => ({
  mode: "none" as
    | "none"
    | "component-missing"
    | "component-duplicate"
    | "component-kind"
    | "component-runtime-instance-id"
    | "component-source-node-id"
    | "component-capability-id"
    | "behavior-missing"
    | "behavior-duplicate"
    | "behavior-kind"
    | "behavior-runtime-instance-id"
    | "behavior-source-node-id"
    | "behavior-capability-id"
    | "behavior-behavior-id"
    | "behavior-owner-runtime-instance-id",
}));

vi.mock("@desen/runtime-core", async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeCoreModule>();
  return {
    ...actual,
    authenticateRuntimeHeadlessSessionAdapterAuthority: (
      ...input: Parameters<typeof actual.authenticateRuntimeHeadlessSessionAdapterAuthority>
    ) => {
      const authenticated = actual.authenticateRuntimeHeadlessSessionAdapterAuthority(...input);
      if (authenticated.status !== "authenticated" || parityMock.mode === "none") {
        return authenticated;
      }
      const bindings = [...authenticated.snapshot.bindings];
      const targetKind = parityMock.mode.startsWith("behavior-") ? "behavior" : "component";
      const index = bindings.findIndex((binding) => binding.kind === targetKind);
      const binding = bindings[index];
      if (binding === undefined) {
        throw new TypeError(`Expected a ${targetKind} binding for parity drift.`);
      }

      if (parityMock.mode.endsWith("-missing")) {
        bindings.splice(index, 1);
      } else if (parityMock.mode.endsWith("-duplicate")) {
        bindings.push(binding);
      } else if (parityMock.mode.endsWith("-kind")) {
        bindings[index] =
          binding.kind === "component"
            ? Object.freeze({
                ...binding,
                kind: "behavior",
                behaviorId: "binding-parity-drift",
                ownerRuntimeInstanceId: "runtime:binding-parity-drift-owner",
              })
            : Object.freeze({
                kind: "component",
                sourceNodeId: binding.sourceNodeId,
                capabilityId: binding.capabilityId,
                runtimeInstanceId: binding.runtimeInstanceId,
                registrationGeneration: binding.registrationGeneration,
                handledEvents: binding.handledEvents,
              });
      } else if (parityMock.mode.endsWith("-runtime-instance-id")) {
        bindings[index] = Object.freeze({
          ...binding,
          runtimeInstanceId: "runtime:binding-parity-drift",
        });
      } else if (parityMock.mode.endsWith("-source-node-id")) {
        bindings[index] = Object.freeze({
          ...binding,
          sourceNodeId: "source:binding-parity-drift",
        });
      } else if (parityMock.mode.endsWith("-capability-id")) {
        bindings[index] = Object.freeze({
          ...binding,
          capabilityId: "com.example.ui/BindingParityDrift",
        });
      } else if (parityMock.mode === "behavior-behavior-id" && binding.kind === "behavior") {
        bindings[index] = Object.freeze({
          ...binding,
          behaviorId: "binding-parity-drift",
        });
      } else if (
        parityMock.mode === "behavior-owner-runtime-instance-id" &&
        binding.kind === "behavior"
      ) {
        bindings[index] = Object.freeze({
          ...binding,
          ownerRuntimeInstanceId: "runtime:binding-parity-drift-owner",
        });
      } else {
        throw new TypeError(`Unhandled binding parity drift: ${parityMock.mode}`);
      }
      return Object.freeze({
        ...authenticated,
        snapshot: Object.freeze({
          ...authenticated.snapshot,
          bindings: Object.freeze(bindings),
        }),
      });
    },
  };
});

import { createRuntimeReactAdapterRegistry, renderRuntimeReactSurface } from "../src/index.js";
import { createRuntimeReactSessionFixture, rootNode } from "./session-fixture.js";

import type {
  RuntimeReactBehaviorAdapterProps,
  RuntimeReactComponentAdapterProps,
} from "../src/index.js";

const STACK_ID = "com.example.ui/Stack";
const TEXT_ID = "com.example.ui/Text";
const TEXT_FIELD_ID = "com.example.ui/TextField";
const BUTTON_ID = "com.example.ui/Button";
const SORTABLE_ID = "com.example.interactions/Sortable";

function fixture(withBehavior = false) {
  return createRuntimeReactSessionFixture({
    ...(withBehavior
      ? {
          mutateBundle(bundle: Record<string, unknown>) {
            rootNode(bundle).behaviors = [
              {
                id: "sign-in.sortable",
                use: SORTABLE_ID,
                props: { axis: "vertical", handle: "item" },
              },
            ];
          },
        }
      : {}),
  });
}

function registry() {
  const Component = vi.fn((props: RuntimeReactComponentAdapterProps) => (
    <Fragment>{props.slots.default}</Fragment>
  ));
  const Behavior = vi.fn((props: RuntimeReactBehaviorAdapterProps) => (
    <Fragment>{props.children}</Fragment>
  ));
  const created = createRuntimeReactAdapterRegistry({
    components: [
      { capabilityId: STACK_ID, component: Component },
      { capabilityId: TEXT_ID, component: Component },
      { capabilityId: TEXT_FIELD_ID, component: Component },
      { capabilityId: BUTTON_ID, component: Component },
    ],
    behaviors: [{ capabilityId: SORTABLE_ID, component: Behavior }],
  });
  if (created.status !== "created") throw new TypeError("Expected parity registry.");
  return { handle: created.handle, Component, Behavior };
}

beforeEach(() => {
  parityMock.mode = "none";
});

function expectBindingParityDriftFailure(mode: BindingParityDriftCase): void {
  const bindingKind = mode.startsWith("behavior-") ? "behavior" : "component";
  const target = fixture(bindingKind === "behavior");
  const adapters = registry();
  const original = target.snapshot.bindings.find((binding) => binding.kind === bindingKind);
  if (original === undefined) {
    throw new TypeError(`Expected a ${bindingKind} binding in the parity fixture.`);
  }
  parityMock.mode = mode;
  const result = renderRuntimeReactSurface({
    registry: adapters.handle,
    session: target.session,
    snapshot: target.snapshot,
    catalogSet: target.catalogSet,
  });
  expect(result).toEqual({
    status: "failed",
    failure: {
      code: "RUNTIME_BINDING_MISMATCH",
      runtimeNodeId: mode.endsWith("-runtime-instance-id")
        ? "runtime:binding-parity-drift"
        : original.runtimeInstanceId,
      sourceNodeId: mode.endsWith("-source-node-id")
        ? "source:binding-parity-drift"
        : original.sourceNodeId,
      capabilityId: mode.endsWith("-capability-id")
        ? "com.example.ui/BindingParityDrift"
        : original.capabilityId,
      channel: null,
      diagnostics: [],
    },
  });
  expect(result).not.toHaveProperty("surface");
  expect(adapters.Component).not.toHaveBeenCalled();
  expect(adapters.Behavior).not.toHaveBeenCalled();
}

describe("render-plan to authenticated binding parity", () => {
  it.each(COMPONENT_BINDING_PARITY_CASES)(
    "fails closed before adapter execution for exact component case %s",
    expectBindingParityDriftFailure,
  );

  it.each(BEHAVIOR_BINDING_PARITY_CASES)(
    "fails closed before adapter execution for exact behavior case %s",
    expectBindingParityDriftFailure,
  );
});
