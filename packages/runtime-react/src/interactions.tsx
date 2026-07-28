import { Fragment, createElement, useLayoutEffect, useMemo } from "react";

import {
  attachRuntimeHeadlessSessionComponentCommands,
  detachRuntimeHeadlessSessionComponentCommands,
  dispatchRuntimeHeadlessSessionEvent,
  snapshotRuntimeJsonValue,
} from "@desen/runtime-core";

import { RuntimeReactAdapterFailureBoundary } from "./adapter-error-boundary.js";

import type { ReactElement, ReactNode } from "react";
import type {
  RuntimeAdapterComponentCommandPort,
  RuntimeAdapterComponentCommandRequest,
  RuntimeHeadlessSessionComponentCommandsAttachment,
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionSnapshot,
  RuntimeJsonValue,
} from "@desen/runtime-core";
import type {
  RuntimeReactBehaviorAdapterComponent,
  RuntimeReactBehaviorAdapterProps,
  RuntimeReactCommandAttachmentHandle,
  RuntimeReactCommandAttachmentResult,
  RuntimeReactCommandDetachmentResult,
  RuntimeReactComponentAdapterComponent,
  RuntimeReactComponentAdapterProps,
  RuntimeReactComponentCommandPort,
  RuntimeReactDiagnosticIdentity,
  RuntimeReactEventDispatchResult,
  RuntimeReactInteractionPort,
  RuntimeReactNamedSlots,
  RuntimeReactSemanticStyle,
} from "./registry.js";

interface RuntimeReactInteractionAuthority {
  readonly session: RuntimeHeadlessSessionHandle;
  readonly snapshot: RuntimeHeadlessSessionSnapshot;
  readonly runtimeInstanceId: string;
  readonly kind: "component" | "behavior";
}

interface RuntimeReactComponentElementInput extends RuntimeReactInteractionAuthority {
  readonly kind: "component";
  readonly reconciliationKey: string;
  readonly hasManagedDescendants: boolean;
  readonly component: RuntimeReactComponentAdapterComponent;
  readonly identity: RuntimeReactDiagnosticIdentity;
  readonly props: RuntimeReactComponentAdapterProps["props"];
  readonly slots: RuntimeReactNamedSlots;
  readonly style: RuntimeReactSemanticStyle;
}

interface RuntimeReactBehaviorElementInput extends RuntimeReactInteractionAuthority {
  readonly kind: "behavior";
  readonly reconciliationKey: string;
  readonly component: RuntimeReactBehaviorAdapterComponent;
  readonly identity: RuntimeReactDiagnosticIdentity;
  readonly behaviorId: string;
  readonly props: RuntimeReactBehaviorAdapterProps["props"];
  readonly slots: RuntimeReactNamedSlots;
  readonly style: RuntimeReactSemanticStyle;
  readonly children: ReactNode;
}

interface RuntimeReactCommandAttachmentAuthority {
  readonly ownerToken: object;
  coreAttachment: RuntimeHeadlessSessionComponentCommandsAttachment | undefined;
  status: "attached" | "detached";
}

interface RuntimeReactInteractionController {
  readonly attachments: Set<RuntimeReactCommandAttachmentAuthority>;
  readonly interactions: RuntimeReactInteractionPort;
  readonly ownerToken: object;
  committed: boolean;
  currentAuthority: RuntimeReactInteractionAuthority | undefined;
  lifecycleEpoch: object;
}

const COMMAND_ATTACHMENTS = new WeakMap<
  RuntimeReactCommandAttachmentHandle,
  RuntimeReactCommandAttachmentAuthority
>();

const UNAVAILABLE_ATTACHMENT = Object.freeze({
  status: "unavailable",
}) as RuntimeReactCommandAttachmentResult;
const UNAVAILABLE_DETACHMENT = Object.freeze({
  status: "unavailable",
}) as RuntimeReactCommandDetachmentResult;
const UNAVAILABLE_EVENT = Object.freeze({
  status: "unavailable",
}) as RuntimeReactEventDispatchResult;
const REJECTED_ATTACHMENT = Object.freeze({
  status: "rejected",
}) as RuntimeReactCommandAttachmentResult;
const REJECTED_DETACHMENT = Object.freeze({
  status: "rejected",
}) as RuntimeReactCommandDetachmentResult;
const REJECTED_EVENT = Object.freeze({
  status: "rejected",
}) as RuntimeReactEventDispatchResult;

function captureCommandInvoke(
  value: RuntimeReactComponentCommandPort,
): RuntimeReactComponentCommandPort["invoke"] | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 1 || keys[0] !== "invoke") return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, "invoke");
    return descriptor !== undefined &&
      descriptor.enumerable &&
      "value" in descriptor &&
      typeof descriptor.value === "function"
      ? (descriptor.value as RuntimeReactComponentCommandPort["invoke"])
      : undefined;
  } catch {
    return undefined;
  }
}

function dispatchEvent(
  controller: RuntimeReactInteractionController,
  eventName: string,
  payload: RuntimeJsonValue,
): RuntimeReactEventDispatchResult {
  const authority = controller.currentAuthority;
  if (!controller.committed || authority === undefined) return UNAVAILABLE_EVENT;
  const lifecycleEpoch = controller.lifecycleEpoch;
  const detachedPayload = snapshotRuntimeJsonValue(payload);
  if (
    !controller.committed ||
    controller.currentAuthority !== authority ||
    controller.lifecycleEpoch !== lifecycleEpoch
  ) {
    return UNAVAILABLE_EVENT;
  }
  if (detachedPayload === undefined) return REJECTED_EVENT;
  let result: ReturnType<typeof dispatchRuntimeHeadlessSessionEvent>;
  try {
    result = dispatchRuntimeHeadlessSessionEvent(authority.session, {
      snapshot: authority.snapshot,
      runtimeInstanceId: authority.runtimeInstanceId,
      eventName,
      payload: detachedPayload,
    });
  } catch {
    return REJECTED_EVENT;
  }
  if (result.status !== "dispatched") return REJECTED_EVENT;
  const completion = result.completion.then(
    () => undefined,
    () => undefined,
  );
  return Object.freeze({ status: "dispatched", completion });
}

function attachCommands(
  controller: RuntimeReactInteractionController,
  commands: RuntimeReactComponentCommandPort,
): RuntimeReactCommandAttachmentResult {
  const authority = controller.currentAuthority;
  if (!controller.committed || authority?.kind !== "component") {
    return UNAVAILABLE_ATTACHMENT;
  }
  const lifecycleEpoch = controller.lifecycleEpoch;
  const invoke = captureCommandInvoke(commands);
  if (invoke === undefined) return REJECTED_ATTACHMENT;
  if (
    !controller.committed ||
    controller.currentAuthority !== authority ||
    controller.lifecycleEpoch !== lifecycleEpoch
  ) {
    return UNAVAILABLE_ATTACHMENT;
  }
  const coreCommands: RuntimeAdapterComponentCommandPort = Object.freeze({
    invoke: (request: RuntimeAdapterComponentCommandRequest) =>
      invoke(request.command, request.input),
  });
  let result: ReturnType<typeof attachRuntimeHeadlessSessionComponentCommands>;
  try {
    result = attachRuntimeHeadlessSessionComponentCommands(authority.session, {
      snapshot: authority.snapshot,
      runtimeInstanceId: authority.runtimeInstanceId,
      commands: coreCommands,
    });
  } catch {
    return REJECTED_ATTACHMENT;
  }
  if (result.status !== "attached") return REJECTED_ATTACHMENT;
  if (
    !controller.committed ||
    controller.currentAuthority !== authority ||
    controller.lifecycleEpoch !== lifecycleEpoch
  ) {
    try {
      detachRuntimeHeadlessSessionComponentCommands(result.attachment);
    } catch {
      // The React port still exposes no attachment if lower authority ended concurrently.
    }
    return UNAVAILABLE_ATTACHMENT;
  }

  const attachment = Object.freeze({}) as RuntimeReactCommandAttachmentHandle;
  const attachmentAuthority: RuntimeReactCommandAttachmentAuthority = {
    ownerToken: controller.ownerToken,
    coreAttachment: result.attachment,
    status: "attached",
  };
  COMMAND_ATTACHMENTS.set(attachment, attachmentAuthority);
  for (const previous of controller.attachments) {
    previous.status = "detached";
    previous.coreAttachment = undefined;
  }
  controller.attachments.clear();
  controller.attachments.add(attachmentAuthority);
  return Object.freeze({ status: "attached", attachment });
}

function detachCommands(
  controller: RuntimeReactInteractionController,
  attachment: RuntimeReactCommandAttachmentHandle,
): RuntimeReactCommandDetachmentResult {
  if (!controller.committed || controller.currentAuthority?.kind !== "component") {
    return UNAVAILABLE_DETACHMENT;
  }
  if (typeof attachment !== "object" || attachment === null) return REJECTED_DETACHMENT;
  const authority = COMMAND_ATTACHMENTS.get(attachment);
  if (authority === undefined || authority.ownerToken !== controller.ownerToken) {
    return REJECTED_DETACHMENT;
  }
  if (authority.status === "detached") {
    return Object.freeze({ status: "already-detached" });
  }
  const coreAttachment = authority.coreAttachment;
  if (coreAttachment === undefined) return REJECTED_DETACHMENT;
  let result: ReturnType<typeof detachRuntimeHeadlessSessionComponentCommands>;
  try {
    result = detachRuntimeHeadlessSessionComponentCommands(coreAttachment);
  } catch {
    return REJECTED_DETACHMENT;
  }
  if (result.status !== "detached" && result.status !== "already-detached") {
    return REJECTED_DETACHMENT;
  }
  authority.status = "detached";
  controller.attachments.delete(authority);
  authority.coreAttachment = undefined;
  return Object.freeze({ status: result.status });
}

function createInteractionController(): RuntimeReactInteractionController {
  const controller: RuntimeReactInteractionController = {
    attachments: new Set<RuntimeReactCommandAttachmentAuthority>(),
    interactions: Object.freeze({
      dispatchEvent: (eventName: string, payload: RuntimeJsonValue) =>
        dispatchEvent(controller, eventName, payload),
      attachCommands: (commands: RuntimeReactComponentCommandPort) =>
        attachCommands(controller, commands),
      detachCommands: (attachment: RuntimeReactCommandAttachmentHandle) =>
        detachCommands(controller, attachment),
    }),
    committed: false,
    currentAuthority: undefined,
    lifecycleEpoch: Object.freeze({}),
    ownerToken: Object.freeze({}),
  };
  return controller;
}

function activateInteractionController(
  controller: RuntimeReactInteractionController,
  authority: RuntimeReactInteractionAuthority,
): () => void {
  const lifecycleEpoch = Object.freeze({});
  controller.lifecycleEpoch = lifecycleEpoch;
  controller.currentAuthority = authority;
  controller.committed = true;
  return () => {
    if (controller.lifecycleEpoch !== lifecycleEpoch) return;
    controller.committed = false;
    controller.lifecycleEpoch = Object.freeze({});
    for (const attachment of controller.attachments) {
      if (attachment.status === "attached") {
        const coreAttachment = attachment.coreAttachment;
        try {
          if (coreAttachment !== undefined) {
            detachRuntimeHeadlessSessionComponentCommands(coreAttachment);
          }
        } catch {
          // The public React lifetime is revoked even if lower authority ended first.
        }
        attachment.status = "detached";
        attachment.coreAttachment = undefined;
      }
    }
    controller.attachments.clear();
    controller.currentAuthority = undefined;
  };
}

function RuntimeReactInteractionCommit({
  authority,
  controller,
}: {
  readonly authority: RuntimeReactInteractionAuthority;
  readonly controller: RuntimeReactInteractionController;
}): null {
  // Layout activation happens only for a committed tree and completes before trusted adapters'
  // passive attachment effects. A pre-commit or server-rendered adapter remains unauthorized.
  useLayoutEffect(
    () => activateInteractionController(controller, authority),
    [authority, controller],
  );
  return null;
}

function RuntimeReactComponentBoundary(input: RuntimeReactComponentElementInput): ReactElement {
  const authority = useMemo<RuntimeReactInteractionAuthority>(
    () =>
      Object.freeze({
        session: input.session,
        snapshot: input.snapshot,
        runtimeInstanceId: input.runtimeInstanceId,
        kind: "component",
      }),
    [input.runtimeInstanceId, input.session, input.snapshot],
  );
  const controller = useMemo(() => createInteractionController(), [authority]);
  return createElement(
    RuntimeReactAdapterFailureBoundary,
    {
      adapterKind: "component",
      identity: input.identity,
      behaviorId: null,
      canAttributeRawError: !input.hasManagedDescendants,
    },
    createElement(
      Fragment,
      null,
      createElement(RuntimeReactInteractionCommit, { authority, controller }),
      createElement(input.component, {
        identity: input.identity,
        props: input.props,
        slots: input.slots,
        style: input.style,
        interactions: controller.interactions,
      }),
    ),
  );
}

function RuntimeReactBehaviorBoundary(input: RuntimeReactBehaviorElementInput): ReactElement {
  const authority = useMemo<RuntimeReactInteractionAuthority>(
    () =>
      Object.freeze({
        session: input.session,
        snapshot: input.snapshot,
        runtimeInstanceId: input.runtimeInstanceId,
        kind: "behavior",
      }),
    [input.runtimeInstanceId, input.session, input.snapshot],
  );
  const controller = useMemo(() => createInteractionController(), [authority]);
  return createElement(
    RuntimeReactAdapterFailureBoundary,
    {
      adapterKind: "behavior",
      identity: input.identity,
      behaviorId: input.behaviorId,
      canAttributeRawError: false,
    },
    createElement(
      Fragment,
      null,
      createElement(RuntimeReactInteractionCommit, { authority, controller }),
      createElement(input.component, {
        identity: input.identity,
        behaviorId: input.behaviorId,
        props: input.props,
        slots: input.slots,
        style: input.style,
        interactions: controller.interactions,
        children: input.children,
      }),
    ),
  );
}

/** Creates one commit-gated component adapter element after complete renderer preflight. */
export function createRuntimeReactComponentAdapterElement(
  input: RuntimeReactComponentElementInput,
): ReactElement {
  return createElement(RuntimeReactComponentBoundary, {
    ...input,
    key: input.reconciliationKey,
  });
}

/** Creates one commit-gated behavior adapter element after complete renderer preflight. */
export function createRuntimeReactBehaviorAdapterElement(
  input: RuntimeReactBehaviorElementInput,
): ReactElement {
  return createElement(RuntimeReactBehaviorBoundary, {
    ...input,
    key: input.reconciliationKey,
  });
}
