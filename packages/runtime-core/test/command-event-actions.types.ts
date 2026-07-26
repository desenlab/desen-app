import {
  disposeRuntimeCommandEventActions,
  executeRuntimeCommandEventAction,
  mountRuntimeCommandEventActions,
  readRuntimeCommandEventActions,
  readRuntimeCommandEventActionsForAdapterBridge,
  registerRuntimeComponentCommandTarget,
  unregisterRuntimeComponentCommandTarget,
} from "../src/command-event-actions.js";
import {
  consumeRuntimeComponentCommandHostRequestForAdapterBridge,
  createRuntimeCommandEventHostPorts,
} from "../src/command-event-ports.js";

import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeCommandEventAction,
  RuntimeCommandEventActionLimitProfile,
  RuntimeCommandEventActionResult,
  RuntimeCommandEventActionsHandle,
  RuntimeCommandEventActionsMountInput,
  RuntimeCommandEventActionsReadResult,
  RuntimeCommandEventActionsSnapshot,
  RuntimeComponentCommandAction,
  RuntimeComponentCommandRegistrationTicket,
  RuntimeComponentCommandTargetRegistrationInput,
  RuntimeHostEventEmitAction,
} from "../src/command-event-actions.js";
import type {
  RuntimeCommandEventHostPorts,
  RuntimeCommandEventHostPortsInput,
  RuntimeComponentCommandHostRequest,
  RuntimeComponentCommandHostResult,
  RuntimeHostEventEmissionResult,
  RuntimeHostEventRequest,
  RuntimeHostEventValidationResult,
} from "../src/command-event-ports.js";
import type { RuntimeHostPorts } from "../src/host-ports.js";
import type { RuntimeResolutionSnapshot } from "../src/value-resolution.js";

declare const catalogSet: DesenValidatedExecutionCatalogSet;
declare const hostPorts: RuntimeHostPorts;
declare const resolutionSnapshot: RuntimeResolutionSnapshot;

const portInput: RuntimeCommandEventHostPortsInput = {
  commands: {
    invoke(request: RuntimeComponentCommandHostRequest): RuntimeComponentCommandHostResult {
      void request.input;
      return { status: "succeeded" };
    },
  },
  events: {
    validate(request: RuntimeHostEventRequest): RuntimeHostEventValidationResult {
      void request.contractId;
      return { status: "valid" };
    },
    emit(request: RuntimeHostEventRequest): RuntimeHostEventEmissionResult {
      void request.payload;
      return { status: "succeeded" };
    },
  },
};
const commandEventPorts = createRuntimeCommandEventHostPorts(portInput);
const callerCommandRequest: RuntimeComponentCommandHostRequest = {
  context: {
    documentId: "com.desen.types",
    revision: `sha256:${"a".repeat(64)}`,
    surfaceId: "sign-in",
    requestId: "request-0",
  },
  sourceNodeId: "field",
  runtimeInstanceId: "field-1",
  capabilityId: "com.example.ui/TextField",
  command: "focus",
  input: {},
};
const callerCommandIsNormalized: boolean =
  consumeRuntimeComponentCommandHostRequestForAdapterBridge(
    callerCommandRequest,
    commandEventPorts,
  );
void callerCommandIsNormalized;

// @ts-expect-error package-internal command authority still requires the complete detached request
const incompleteCommandRequest: RuntimeComponentCommandHostRequest = {
  command: "focus",
  input: {},
};
consumeRuntimeComponentCommandHostRequestForAdapterBridge(
  incompleteCommandRequest,
  commandEventPorts,
);

const mountInput: RuntimeCommandEventActionsMountInput = {
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "sign-in",
  staticComponents: { field: "com.example.ui/TextField" },
  hostEvents: { "analytics / 登录": "host.contract/sign-in@1" },
  catalogSet,
  hostPorts,
  commandEventPorts,
  limits: {
    maxActionGeneration: 10,
    maxRegistrationGeneration: 10,
    maxSnapshotGeneration: 20,
    maxLiveTargets: 5,
    maxStaticComponents: 5,
    maxHostEvents: 5,
    maxRetainedIdentifierCodeUnits: 1_024,
    maxRuntimeInstanceIdCodeUnits: 64,
  },
};
const mounted = mountRuntimeCommandEventActions(mountInput);
if (mounted.status === "mounted") {
  const handle: RuntimeCommandEventActionsHandle = mounted.handle;
  const snapshot: RuntimeCommandEventActionsSnapshot = mounted.snapshot;
  const read: RuntimeCommandEventActionsReadResult = readRuntimeCommandEventActions(handle);
  if (read.status === "read") {
    const currentSnapshot: RuntimeCommandEventActionsSnapshot = read.snapshot;
    void currentSnapshot;
  }
  const bridgeRead = readRuntimeCommandEventActionsForAdapterBridge(handle);
  if (bridgeRead.status === "read") {
    const exactCatalogSet: DesenValidatedExecutionCatalogSet = bridgeRead.catalogSet;
    const exactCommandEventPorts: RuntimeCommandEventHostPorts = bridgeRead.commandEventPorts;
    const exactBridgeSnapshot: RuntimeCommandEventActionsSnapshot = bridgeRead.snapshot;
    void [exactCatalogSet, exactCommandEventPorts, exactBridgeSnapshot];
  }
  const registration = registerRuntimeComponentCommandTarget(handle, {
    sourceNodeId: "field",
    capabilityId: "com.example.ui/TextField",
    runtimeInstanceId: "field-1",
    snapshot,
  });
  if (registration.status === "registered") {
    const ticket: RuntimeComponentCommandRegistrationTicket = registration.ticket;
    const command: RuntimeComponentCommandAction = {
      type: "component.command",
      target: "field",
      command: "focus",
      input: {},
    };
    const result: RuntimeCommandEventActionResult = executeRuntimeCommandEventAction(
      handle,
      command,
      resolutionSnapshot,
      registration.snapshot,
    );
    void [
      result,
      unregisterRuntimeComponentCommandTarget(handle, {
        ticket,
        snapshot: registration.snapshot,
      }),
      disposeRuntimeCommandEventActions(handle),
    ];
  }
}

// @ts-expect-error command/event host boundaries are opaque factory authorities
const forgedPorts: RuntimeCommandEventHostPorts = {};
void forgedPorts;

// @ts-expect-error action manager handles are opaque factory authorities
const forgedHandle: RuntimeCommandEventActionsHandle = {};
void forgedHandle;

// @ts-expect-error registration tickets are opaque one-registration authorities
const forgedTicket: RuntimeComponentCommandRegistrationTicket = {};
void forgedTicket;

// @ts-expect-error registry reads accept only command/event manager authorities
readRuntimeCommandEventActions({} as RuntimeComponentCommandRegistrationTicket);

// @ts-expect-error component.command requires a static source target
const commandWithoutTarget: RuntimeComponentCommandAction = {
  type: "component.command",
  command: "focus",
};
void commandWithoutTarget;

// @ts-expect-error component.command requires a command name
const commandWithoutName: RuntimeComponentCommandAction = {
  type: "component.command",
  target: "field",
};
void commandWithoutName;

const executableCommandInput: RuntimeComponentCommandAction = {
  type: "component.command",
  target: "field",
  command: "focus",
  input: {
    // @ts-expect-error command inputs contain data-only ValueSpecs, never callbacks
    callback: () => undefined,
  },
};
void executableCommandInput;

// An outbound shell event name is intentionally host-profile data, not a local identifier.
const unicodeEvent: RuntimeHostEventEmitAction = {
  type: "event.emit",
  name: "analytics / 登录",
  payload: { source: "form" },
};
void unicodeEvent;

const eventWithCallback: RuntimeHostEventEmitAction = {
  type: "event.emit",
  name: "submitted",
  payload: {
    // @ts-expect-error event payloads contain data-only ValueSpecs, never callbacks
    callback: () => undefined,
  },
};
void eventWithCallback;

const callerRequestIdentity: RuntimeComponentCommandAction = {
  type: "component.command",
  target: "field",
  command: "focus",
  // @ts-expect-error deterministic request identity is runtime-owned
  requestId: "caller-owned",
};
void callerRequestIdentity;

const arbitraryCommandField: RuntimeComponentCommandAction = {
  type: "component.command",
  target: "field",
  command: "focus",
  // @ts-expect-error arbitrary action fields must live under extensions
  arbitrary: true,
};
void arbitraryCommandField;

const unsupportedAction: RuntimeCommandEventAction = {
  // @ts-expect-error this primitive's action vocabulary excludes operation/resource actions
  type: "resource.refresh",
  resource: "profile",
};
void unsupportedAction;

const registrationWithTarget: RuntimeComponentCommandTargetRegistrationInput = {
  sourceNodeId: "field",
  capabilityId: "com.example.ui/TextField",
  runtimeInstanceId: "field-1",
  snapshot: {} as RuntimeCommandEventActionsSnapshot,
  // @ts-expect-error registrations retain only inert identity, never a platform target
  target: { focus: () => undefined },
};
void registrationWithTarget;

const registrationWithCommands: RuntimeComponentCommandTargetRegistrationInput = {
  sourceNodeId: "field",
  capabilityId: "com.example.ui/TextField",
  runtimeInstanceId: "field-1",
  snapshot: {} as RuntimeCommandEventActionsSnapshot,
  // @ts-expect-error caller command inventories cannot add Catalog authority
  implementedCommands: ["focus"],
};
void registrationWithCommands;

const promisedCommand: RuntimeCommandEventHostPortsInput = {
  commands: {
    // @ts-expect-error command ports are strictly synchronous
    invoke: async () => ({ status: "succeeded" as const }),
  },
  events: portInput.events,
};
void promisedCommand;

const promisedValidator: RuntimeCommandEventHostPortsInput = {
  commands: portInput.commands,
  events: {
    // @ts-expect-error host event contract validation is strictly synchronous
    validate: async () => ({ status: "valid" as const }),
    emit: () => ({ status: "succeeded" }),
  },
};
void promisedValidator;

const invalidCommandResult: RuntimeComponentCommandHostResult = {
  // @ts-expect-error command result vocabulary is closed
  status: "queued",
};
void invalidCommandResult;

const invalidEventResult: RuntimeHostEventEmissionResult = {
  // @ts-expect-error event emission result vocabulary is closed
  status: "emitted",
};
void invalidEventResult;

const invalidLimits: RuntimeCommandEventActionLimitProfile = {
  // @ts-expect-error the host profile cannot invent an unproved semantic ceiling
  maxRetries: 3,
};
void invalidLimits;

// @ts-expect-error adapter-bridge Catalog authority reads remain package-internal
import { readRuntimeCommandEventActionsForAdapterBridge as leakedAdapterBridgeRead } from "../src/index.js";
void leakedAdapterBridgeRead;

declare const result: RuntimeCommandEventActionResult;
// @ts-expect-error public action results are immutable
result.status = "busy";

declare const registrySnapshot: RuntimeCommandEventActionsSnapshot;
// @ts-expect-error registry snapshots are immutable
registrySnapshot.generation = 3;
// @ts-expect-error instance inventories are immutable
registrySnapshot.liveTargets.field?.instances.push({
  runtimeInstanceId: "field-2",
  registrationGeneration: 2,
});

declare const registryRead: RuntimeCommandEventActionsReadResult;
// @ts-expect-error public registry read results are immutable
registryRead.status = "disposed";

// @ts-expect-error normalized bridge invokers remain package-internal
import { invokeRuntimeComponentCommandHostPort as leakedInvoker } from "../src/index.js";
void leakedInvoker;

// @ts-expect-error normalized request ownership consumers remain package-internal
import { consumeRuntimeComponentCommandHostRequestForAdapterBridge as leakedNormalizedConsumer } from "../src/index.js";
void leakedNormalizedConsumer;

// @ts-expect-error exact component-port ownership probes remain package-internal
import { isRuntimeCommandEventHostPortsForComponentCommandPort as leakedPortOwnerProbe } from "../src/index.js";
void leakedPortOwnerProbe;
