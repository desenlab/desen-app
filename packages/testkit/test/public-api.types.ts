import { registerOperation, registerResource } from "@desen/catalog-sdk";

import {
  createSyntheticFixtureSnapshot,
  lookupSyntheticOperationError,
  lookupSyntheticOperationSuccess,
  lookupSyntheticResourceFixture,
  SYNTHETIC_FIXTURE_CONTEXT,
} from "../src/index.js";

import type { SyntheticFixtureValue } from "../src/index.js";

const operation = registerOperation({
  id: "com.example.operations/calculate",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [{ code: "INVALID_INPUT" }],
    effect: "none",
    authoring: {
      fixtures: {
        success: { total: 42 },
        errors: { INVALID_INPUT: { field: "synthetic" } },
      },
    },
  },
});

const resource = registerResource({
  id: "com.example.resources/list",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [],
    policies: ["manual"],
    authoring: { fixtures: { default: [{ id: "synthetic-record" }] } },
  },
});

const fixtures = createSyntheticFixtureSnapshot({
  context: SYNTHETIC_FIXTURE_CONTEXT,
  operations: [operation],
  resources: [resource],
});
const success = lookupSyntheticOperationSuccess(fixtures, operation.id);
const failure = lookupSyntheticOperationError(fixtures, operation.id, "INVALID_INPUT");
const resourceResult = lookupSyntheticResourceFixture(fixtures, resource.id, "default");
if (success.status === "found") {
  const value: SyntheticFixtureValue = success.value;
  void value;
}
void failure;
void resourceResult;

// @ts-expect-error M03-T07-N01 The fixed fixture context is recursively readonly.
SYNTHETIC_FIXTURE_CONTEXT.kind = "production";

// @ts-expect-error M03-T07-N02 Fixture snapshots are recursively readonly.
fixtures.operations[operation.id] = {};

// @ts-expect-error M03-T07-N03 A snapshot requires the explicit synthetic context.
createSyntheticFixtureSnapshot({
  operations: [operation],
  resources: [resource],
});

createSyntheticFixtureSnapshot({
  context: {
    // @ts-expect-error M03-T07-N04 Production is not a fixture context.
    kind: "production",
    source: "manifest.authoring.fixtures",
  },
  operations: [operation],
  resources: [resource],
});

createSyntheticFixtureSnapshot({
  context: SYNTHETIC_FIXTURE_CONTEXT,
  operations: [operation],
  resources: [resource],
  // @ts-expect-error M03-T07-N05 The fixture wrapper cannot select an execution mode.
  mode: "integration",
});

createSyntheticFixtureSnapshot({
  context: SYNTHETIC_FIXTURE_CONTEXT,
  operations: [operation],
  resources: [resource],
  // @ts-expect-error M03-T07-N06 Endpoint bindings are outside synthetic fixtures.
  endpoint: "https://production.invalid",
});

createSyntheticFixtureSnapshot({
  context: SYNTHETIC_FIXTURE_CONTEXT,
  operations: [
    {
      ...operation,
      // @ts-expect-error M03-T07-N07 Executable operation callbacks are host-owned.
      execute: () => null,
    },
  ],
  resources: [resource],
});

// @ts-expect-error M03-T07-N08 Lookup ids must be strings.
lookupSyntheticOperationSuccess(fixtures, 42);

// @ts-expect-error M03-T07-N09 Operation error codes must be strings.
lookupSyntheticOperationError(fixtures, operation.id, false);

// @ts-expect-error M03-T07-N10 Resource fixture names must be strings.
lookupSyntheticResourceFixture(fixtures, resource.id, {});
