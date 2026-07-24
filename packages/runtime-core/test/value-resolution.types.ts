import { createRuntimeResolutionSnapshot, resolveRuntimeValue } from "../src/index.js";

import type {
  RuntimeEventReferenceSnapshot,
  RuntimeFormatValue,
  RuntimeLifecycleReferenceSnapshot,
  RuntimeResolutionSnapshot,
  RuntimeResolutionSnapshotInput,
  RuntimeValueResolution,
  RuntimeValueSpec,
} from "../src/index.js";

const idle: RuntimeLifecycleReferenceSnapshot = { status: "idle", pending: false };
const pending: RuntimeLifecycleReferenceSnapshot = { status: "pending", pending: true };
const succeeded: RuntimeLifecycleReferenceSnapshot = {
  status: "succeeded",
  pending: false,
  value: { id: "result" },
};
const failed: RuntimeLifecycleReferenceSnapshot = {
  status: "failed",
  pending: false,
  error: { code: "publicCode" },
};
void [idle, pending, succeeded, failed];

// @ts-expect-error pending lifecycle must expose pending=true
const incoherentPending: RuntimeLifecycleReferenceSnapshot = { status: "pending", pending: false };
void incoherentPending;

// @ts-expect-error failure must expose a public error code
const missingError: RuntimeLifecycleReferenceSnapshot = { status: "failed", pending: false };
void missingError;

const idleWithValue: RuntimeLifecycleReferenceSnapshot = {
  status: "idle",
  pending: false,
  // @ts-expect-error idle cannot smuggle a value
  value: "stale",
};
void idleWithValue;

const unavailableEvent: RuntimeEventReferenceSnapshot = { status: "unavailable" };
const availableEvent: RuntimeEventReferenceSnapshot = { status: "available", value: null };
void [unavailableEvent, availableEvent];

// @ts-expect-error an available handler turn requires an explicit payload, including null
const missingEventValue: RuntimeEventReferenceSnapshot = { status: "available" };
void missingEventValue;

const input: RuntimeResolutionSnapshotInput = {
  state: { title: "DESEN" },
  context: {},
  resource: { list: idle },
  operation: { save: pending },
  event: unavailableEvent,
  item: {},
  env: { platform: "web" },
};
const snapshot = createRuntimeResolutionSnapshot(input);

// @ts-expect-error opaque snapshots cannot be constructed without the factory
const forgedSnapshot: RuntimeResolutionSnapshot = input;
void forgedSnapshot;

// @ts-expect-error snapshots are recursively readonly
snapshot.state.title = "mutated";

const reference: RuntimeValueSpec = { $ref: "state.title", fallback: "Untitled" };
const format: RuntimeValueSpec = {
  $format: {
    template: "{title}",
    values: { title: reference },
  },
};
void format;

// @ts-expect-error functions are not DESEN value forms
const executable: RuntimeValueSpec = () => "unsafe";
void executable;

// @ts-expect-error format values are required
const incompleteFormat: RuntimeFormatValue = { $format: { template: "{title}" } };
void incompleteFormat;

const result: RuntimeValueResolution = resolveRuntimeValue(reference, snapshot);
if (result.status === "resolved") {
  const value = result.value;
  const usedFallback: boolean = result.usedFallback;
  void [value, usedFallback];
  // @ts-expect-error a resolved result has no unresolved reference
  void result.reference;
} else if (result.status === "unresolved") {
  const code: "REFERENCE_UNRESOLVED" = result.code;
  void code;
  // @ts-expect-error unresolved results never expose partial values
  void result.value;
}
