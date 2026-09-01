/* eslint-disable @typescript-eslint/no-invalid-void-type -- Test ports verify receiver-independent
 * publication callbacks. */
import { setDesenEditorOwnerProp } from "@desen/editor-core";
import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it, vi } from "vitest";

import {
  createAuthoringPublicationController,
  createFixedDestinationAuthoringPublicationPort,
} from "../src/authoring-publication.js";
import { readProjectWorkspaceProfileAuthority } from "../src/project-workspace-profile.js";
import {
  prepareReferenceAuthoringPreviewBundle as prepareAuthoringPreviewBundle,
  REFERENCE_AUTHORING_WORKSPACE_PROFILE,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/reference-authoring-profile.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type {
  AuthoringControlPlanePublicationRequest,
  AuthoringControlPlanePublicationSettlement,
  AuthoringPublicationController,
  AuthoringPublicationControllerCreationResult,
  AuthoringPublicationPort,
  AuthoringPublicationSnapshot,
  AuthoringHostActivationRequest,
  AuthoringHostActivationSettlement,
} from "../src/authoring-publication.js";

const ROUTE = Object.freeze({ projectId: "account-app", surfaceId: "sign-in" });
const PROFILE_AUTHORITY = readProjectWorkspaceProfileAuthority(
  REFERENCE_AUTHORING_WORKSPACE_PROFILE,
);
if (PROFILE_AUTHORITY.status !== "read" || PROFILE_AUTHORITY.profile.publication === null) {
  throw new TypeError("The reference workspace profile must authorize publication in this test.");
}
const CHANNEL_NAME = PROFILE_AUTHORITY.profile.publication.channelName;
const HOST_ID = PROFILE_AUTHORITY.profile.publication.hostId;
const PREVIEW = prepareAuthoringPreviewBundle(REFERENCE_EDITOR_DOCUMENT);
if (!PREVIEW.ok) throw new TypeError("The reference authored Source must publish in this test.");
const REVISION = PREVIEW.revision;
const OTHER_REVISION = `sha256:${"b".repeat(64)}`;
const SOURCE_GENERATION = 4;
const CHANNEL_GENERATION = 7;
const ACTIVATION_GENERATION = 11;

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

interface PortHarness {
  readonly port: AuthoringPublicationPort;
  readonly channelCalls: AuthoringControlPlanePublicationRequest[];
  readonly activationCalls: AuthoringHostActivationRequest[];
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function changedDocument(value: string | number): DesenEditorDocument {
  const edited = setDesenEditorOwnerProp(REFERENCE_EDITOR_DOCUMENT, {
    surfaceId: "sign-in",
    ownerId: "sign-in.title",
    name: "text",
    value,
  });
  expect(edited.ok).toBe(true);
  if (!edited.ok) throw new TypeError("Expected an editor-admissible Source edit.");
  return edited.document;
}

function revisionOf(document: DesenEditorDocument): string {
  const preview = prepareAuthoringPreviewBundle(document);
  expect(preview.ok).toBe(true);
  if (!preview.ok) throw new TypeError("Expected a Publisher-admissible Source fixture.");
  return preview.revision;
}

function snapshot(
  overrides: Partial<AuthoringPublicationSnapshot> = {},
): AuthoringPublicationSnapshot {
  return {
    document: REFERENCE_EDITOR_DOCUMENT,
    savedDocument: REFERENCE_EDITOR_DOCUMENT,
    sourceGeneration: SOURCE_GENERATION,
    persistenceAuthority: "ready",
    previewRevision: REVISION,
    ...overrides,
  };
}

function publishedChannel(
  revision = REVISION,
  channelGeneration = CHANNEL_GENERATION,
  bundleStatus: "stored" | "unchanged" = "stored",
  channelStatus: "created" | "updated" | "unchanged" = "updated",
): AuthoringControlPlanePublicationSettlement {
  return Object.freeze({
    status: "published",
    channelName: CHANNEL_NAME,
    revision,
    bundleStatus,
    channelStatus,
    channelGeneration,
  });
}

function activeHost(
  revision = REVISION,
  activationGeneration = ACTIVATION_GENERATION,
  relationship: "activated" | "preserved" | "recovered" = "activated",
): AuthoringHostActivationSettlement {
  return Object.freeze({
    status: "active",
    relationship,
    activeRevision: revision,
    activationGeneration,
  });
}

function harness(
  publishBundleToChannel: AuthoringPublicationPort["publishBundleToChannel"] = async () =>
    publishedChannel(),
  activatePublishedRevision: AuthoringPublicationPort["activatePublishedRevision"] = async () =>
    activeHost(),
): PortHarness {
  const channelCalls: AuthoringControlPlanePublicationRequest[] = [];
  const activationCalls: AuthoringHostActivationRequest[] = [];
  return {
    channelCalls,
    activationCalls,
    port: createFixedDestinationAuthoringPublicationPort({
      channelName: CHANNEL_NAME,
      hostId: HOST_ID,
      async publishBundleToChannel(request) {
        const fullRequest = Object.freeze({ ...request, channelName: CHANNEL_NAME });
        channelCalls.push(fullRequest);
        return publishBundleToChannel(fullRequest);
      },
      async activatePublishedRevision(request: AuthoringHostActivationRequest) {
        activationCalls.push(request);
        return activatePublishedRevision(request);
      },
    }),
  };
}

function requireController(
  port: AuthoringPublicationPort = harness().port,
  currentSnapshot: AuthoringPublicationSnapshot = snapshot(),
): AuthoringPublicationController {
  const created = createAuthoringPublicationController({
    profile: REFERENCE_AUTHORING_WORKSPACE_PROFILE,
    route: ROUTE,
    snapshot: currentSnapshot,
    publicationPort: port,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new TypeError(`Expected a controller, received ${created.reason}.`);
  return created.controller;
}

function expectCreationFailure(
  result: AuthoringPublicationControllerCreationResult,
  reason: Exclude<AuthoringPublicationControllerCreationResult, { readonly ok: true }>["reason"],
): void {
  expect(result).toEqual({ ok: false, reason });
  expect(Object.isFrozen(result)).toBe(true);
}

describe("Desen App saved-Source publication controller", () => {
  it("captures only the exact route, snapshot, and two-method trusted-host port", () => {
    const base = {
      profile: REFERENCE_AUTHORING_WORKSPACE_PROFILE,
      route: ROUTE,
      snapshot: snapshot(),
      publicationPort: harness().port,
    };
    const created = createAuthoringPublicationController(base);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new TypeError("Expected the exact publication configuration.");

    const state = created.controller.read();
    expect(created.controller.read()).toBe(state);
    expect(state).toEqual({
      route: ROUTE,
      channelName: CHANNEL_NAME,
      hostId: HOST_ID,
      snapshot: snapshot(),
      pending: null,
      result: null,
      disposed: false,
    });
    expect(Object.isFrozen(created.controller)).toBe(true);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.route)).toBe(true);
    expect(Object.isFrozen(state.snapshot)).toBe(true);

    expectCreationFailure(
      createAuthoringPublicationController({
        ...base,
        route: { projectId: "account-app", surfaceId: "foreign-surface" },
      }),
      "route-invalid",
    );
    expectCreationFailure(
      createAuthoringPublicationController({ ...base, debug: true } as never),
      "route-invalid",
    );
    expectCreationFailure(
      createAuthoringPublicationController({ ...base, profile: Object.freeze({}) as never }),
      "profile-invalid",
    );
    expectCreationFailure(
      createAuthoringPublicationController({
        ...base,
        publicationPort: { ...base.publicationPort, close: () => undefined } as never,
      }),
      "port-invalid",
    );

    for (const forbidden of ["scenario", "effectivePreview", "fixtures"] as const) {
      expectCreationFailure(
        createAuthoringPublicationController({
          ...base,
          snapshot: { ...snapshot(), [forbidden]: Object.freeze({}) } as never,
        }),
        "snapshot-invalid",
      );
    }

    let accessorCalls = 0;
    const accessorSnapshot = Object.defineProperty(
      {
        savedDocument: REFERENCE_EDITOR_DOCUMENT,
        sourceGeneration: SOURCE_GENERATION,
        persistenceAuthority: "ready",
        previewRevision: REVISION,
      },
      "document",
      {
        enumerable: true,
        get() {
          accessorCalls += 1;
          return REFERENCE_EDITOR_DOCUMENT;
        },
      },
    );
    expectCreationFailure(
      createAuthoringPublicationController({ ...base, snapshot: accessorSnapshot as never }),
      "snapshot-invalid",
    );
    expect(accessorCalls).toBe(0);
  });

  it("captures receiver-independent methods once and exposes destructurable store methods", async () => {
    let channelReceiverWasUndefined = false;
    let activationReceiverWasUndefined = false;
    const mutablePort = {
      publishBundleToChannel(this: void) {
        channelReceiverWasUndefined = this === undefined;
        return Promise.resolve(publishedChannel());
      },
      activatePublishedRevision(this: void) {
        activationReceiverWasUndefined = this === undefined;
        return Promise.resolve(activeHost());
      },
    };
    const controller = requireController(
      createFixedDestinationAuthoringPublicationPort({
        channelName: CHANNEL_NAME,
        hostId: HOST_ID,
        publishBundleToChannel: mutablePort.publishBundleToChannel,
        activatePublishedRevision: mutablePort.activatePublishedRevision,
      }),
    );
    mutablePort.publishBundleToChannel = () => {
      throw new TypeError("late mutation must not replace the captured method");
    };
    mutablePort.activatePublishedRevision = () => {
      throw new TypeError("late mutation must not replace the captured method");
    };

    const { publish, read, subscribe, replaceSnapshot, dispose } = controller;
    const unsubscribe = subscribe(() => undefined);
    expect(replaceSnapshot(snapshot())).toEqual({ ok: true, snapshot: read().snapshot });
    await expect(publish()).resolves.toMatchObject({ status: "published" });
    expect(channelReceiverWasUndefined).toBe(true);
    expect(activationReceiverWasUndefined).toBe(true);
    unsubscribe();
    dispose();
    expect(read().disposed).toBe(true);
  });

  it("blocks every unsaved, unauthorized, dirty, or stale-preview state before host I/O", async () => {
    const edited = changedDocument("A newer unsaved title");
    const cases = [
      {
        current: snapshot({ persistenceAuthority: "pending" }),
        reason: "persistence-not-ready",
      },
      {
        current: snapshot({ savedDocument: null, sourceGeneration: null }),
        reason: "source-not-saved",
      },
      {
        current: snapshot({ document: edited, previewRevision: revisionOf(edited) }),
        reason: "source-dirty",
      },
      {
        current: snapshot({ previewRevision: OTHER_REVISION }),
        reason: "preview-revision-stale",
      },
    ] as const;

    for (const testCase of cases) {
      const port = harness();
      const controller = requireController(port.port, testCase.current);
      await expect(controller.publish()).resolves.toEqual({
        status: "failed",
        reason: testCase.reason,
        lastKnownGoodPreserved: false,
      });
      expect(controller.read().result).toEqual(
        expect.objectContaining({ status: "failed", reason: testCase.reason }),
      );
      expect(port.channelCalls).toHaveLength(0);
      expect(port.activationCalls).toHaveLength(0);
    }
  });

  it("rejects a profile-invalid semantic document before any publication controller or bytes", () => {
    const invalidForCatalog = changedDocument(42);
    expect(prepareAuthoringPreviewBundle(invalidForCatalog)).toEqual({
      ok: false,
      reason: "publication-rejected",
    });
    const port = harness();
    expectCreationFailure(
      createAuthoringPublicationController({
        profile: REFERENCE_AUTHORING_WORKSPACE_PROFILE,
        route: ROUTE,
        snapshot: snapshot({
          document: invalidForCatalog,
          savedDocument: invalidForCatalog,
          previewRevision: REVISION,
        }),
        publicationPort: port.port,
      }),
      "document-invalid",
    );
    expect(port.channelCalls).toHaveLength(0);
    expect(port.activationCalls).toHaveLength(0);
  });

  it("passes exact canonical fresh Bundle bytes, then activates only the fixed preview receipt", async () => {
    const port = harness();
    const controller = requireController(port.port);

    await expect(controller.publish()).resolves.toEqual({
      status: "published",
      relationship: "activated",
      channelName: CHANNEL_NAME,
      revision: REVISION,
      sourceGeneration: SOURCE_GENERATION,
      channelGeneration: CHANNEL_GENERATION,
      activationGeneration: ACTIVATION_GENERATION,
    });

    expect(port.channelCalls).toHaveLength(1);
    expect(Object.keys(port.channelCalls[0] ?? {}).sort()).toEqual([
      "bundleBytes",
      "channelName",
      "revision",
    ]);
    expect(port.channelCalls[0]).toEqual({
      bundleBytes: canonicalizeJsonBytes(PREVIEW.bundle),
      channelName: CHANNEL_NAME,
      revision: REVISION,
    });
    expect(Object.isFrozen(port.channelCalls[0])).toBe(true);
    expect(port.activationCalls).toEqual([
      {
        channelName: CHANNEL_NAME,
        channelGeneration: CHANNEL_GENERATION,
        hostId: HOST_ID,
        revision: REVISION,
      },
    ]);
    expect(Object.isFrozen(port.activationCalls[0])).toBe(true);
    expect(controller.read().result).toEqual(
      expect.objectContaining({ status: "published", revision: REVISION }),
    );
    expect(Object.isFrozen(controller.read().result)).toBe(true);
  });

  it("lets a fixed-channel adapter reject a profile-channel mismatch before any write", async () => {
    const fixedChannelWrite = vi.fn(async () => publishedChannel());
    const activation = vi.fn(async () => activeHost());
    const boundChannel = "another-preview";
    const fixedPort = createFixedDestinationAuthoringPublicationPort({
      channelName: boundChannel,
      hostId: HOST_ID,
      async publishBundleToChannel() {
        return fixedChannelWrite();
      },
      activatePublishedRevision: activation,
    });

    expectCreationFailure(
      createAuthoringPublicationController({
        profile: REFERENCE_AUTHORING_WORKSPACE_PROFILE,
        route: ROUTE,
        snapshot: snapshot(),
        publicationPort: fixedPort,
      }),
      "port-invalid",
    );
    expect(fixedChannelWrite).not.toHaveBeenCalled();
    expect(activation).not.toHaveBeenCalled();
  });

  it("reconstructs fixed-destination requests before trusted callbacks observe them", async () => {
    const publishedRequests: unknown[] = [];
    const activationRequests: unknown[] = [];
    const port = createFixedDestinationAuthoringPublicationPort({
      channelName: CHANNEL_NAME,
      hostId: HOST_ID,
      async publishBundleToChannel(request) {
        publishedRequests.push(request);
        return publishedChannel();
      },
      async activatePublishedRevision(request) {
        activationRequests.push(request);
        return activeHost();
      },
    });
    const bytes = canonicalizeJsonBytes(PREVIEW.bundle);
    const mutablePublish = {
      bundleBytes: bytes,
      channelName: CHANNEL_NAME,
      revision: REVISION,
    };
    const publishing = port.publishBundleToChannel(mutablePublish);
    mutablePublish.channelName = "changed-after-dispatch";
    mutablePublish.revision = OTHER_REVISION;
    bytes[0] = 0;
    await publishing;

    expect(publishedRequests).toHaveLength(1);
    expect(publishedRequests[0]).toEqual({
      bundleBytes: canonicalizeJsonBytes(PREVIEW.bundle),
      revision: REVISION,
    });
    expect(Object.isFrozen(publishedRequests[0])).toBe(true);

    const mutableActivation = {
      channelGeneration: CHANNEL_GENERATION,
      channelName: CHANNEL_NAME,
      hostId: HOST_ID,
      revision: REVISION,
    };
    const activating = port.activatePublishedRevision(mutableActivation);
    mutableActivation.channelGeneration = 99;
    mutableActivation.channelName = "changed-after-dispatch";
    mutableActivation.hostId = "changed-host";
    mutableActivation.revision = OTHER_REVISION;
    await activating;
    expect(activationRequests).toEqual([
      {
        channelGeneration: CHANNEL_GENERATION,
        channelName: CHANNEL_NAME,
        hostId: HOST_ID,
        revision: REVISION,
      },
    ]);
    expect(Object.isFrozen(activationRequests[0])).toBe(true);

    let accessorReads = 0;
    const accessorRequest = Object.defineProperty(
      { bundleBytes: canonicalizeJsonBytes(PREVIEW.bundle), revision: REVISION },
      "channelName",
      {
        enumerable: true,
        get() {
          accessorReads += 1;
          return CHANNEL_NAME;
        },
      },
    );
    await expect(port.publishBundleToChannel(accessorRequest as never)).resolves.toMatchObject({
      status: "failed",
      phase: "request",
    });
    await expect(
      port.publishBundleToChannel({
        bundleBytes: canonicalizeJsonBytes(PREVIEW.bundle),
        channelName: CHANNEL_NAME,
        revision: REVISION,
        extra: true,
      } as never),
    ).resolves.toMatchObject({ status: "failed", phase: "request" });
    expect(accessorReads).toBe(0);
    expect(publishedRequests).toHaveLength(1);
  });

  it("retains every exact durable activation relationship, including identical preservation", async () => {
    for (const relationship of ["activated", "preserved", "recovered"] as const) {
      const port = harness(
        async () => publishedChannel(REVISION, CHANNEL_GENERATION, "unchanged", "unchanged"),
        async () => activeHost(REVISION, ACTIVATION_GENERATION, relationship),
      );
      const result = await requireController(port.port).publish();
      expect(result).toMatchObject({
        status: "published",
        relationship,
        revision: REVISION,
        channelGeneration: CHANNEL_GENERATION,
        activationGeneration: ACTIVATION_GENERATION,
      });
    }
  });

  it("preserves conflict generation and never activates after a definite channel rejection", async () => {
    for (const currentGeneration of [8, null] as const) {
      const port = harness(async () => ({
        status: "conflict",
        revision: REVISION,
        bundleStatus: "stored",
        currentGeneration,
      }));
      await expect(requireController(port.port).publish()).resolves.toEqual({
        status: "failed",
        reason: "control-plane-conflict",
        lastKnownGoodPreserved: false,
        revision: REVISION,
        sourceGeneration: SOURCE_GENERATION,
        currentChannelGeneration: currentGeneration,
      });
      expect(port.activationCalls).toHaveLength(0);
    }

    const failed = harness(async () => ({
      status: "failed",
      phase: "channel-write",
      reason: "storage-busy",
      revision: REVISION,
      bundleStatus: "unchanged",
    }));
    await expect(requireController(failed.port).publish()).resolves.toEqual({
      status: "failed",
      reason: "control-plane-failed",
      lastKnownGoodPreserved: false,
    });
    expect(failed.activationCalls).toHaveLength(0);
  });

  it("contains thrown, explicit-indeterminate, and malformed control-plane outcomes", async () => {
    const settlements: (
      AuthoringControlPlanePublicationSettlement | Readonly<Record<string, unknown>> | "throw"
    )[] = [
      { status: "indeterminate", phase: "bundle-write", revision: REVISION },
      {
        status: "indeterminate",
        phase: "channel-write",
        revision: REVISION,
        bundleStatus: "stored",
      },
      { ...publishedChannel(), channelGeneration: 0 },
      { ...publishedChannel(), diagnostic: "forbidden" },
      "throw",
    ];

    for (const settlement of settlements) {
      const port = harness(async () => {
        if (settlement === "throw") throw new TypeError("transport uncertainty");
        return settlement as AuthoringControlPlanePublicationSettlement;
      });
      await expect(requireController(port.port).publish()).resolves.toEqual({
        status: "indeterminate",
        stage: "control-plane",
        revision: REVISION,
        sourceGeneration: SOURCE_GENERATION,
      });
      expect(port.activationCalls).toHaveLength(0);
    }
  });

  it("requires the exact published revision before asking the reference host", async () => {
    const mismatch = harness(async () => publishedChannel(OTHER_REVISION));
    await expect(requireController(mismatch.port).publish()).resolves.toEqual({
      status: "failed",
      reason: "channel-revision-mismatch",
      lastKnownGoodPreserved: false,
    });
    expect(mismatch.activationCalls).toHaveLength(0);

    const malformedConflict = harness(async () => ({
      status: "conflict",
      revision: OTHER_REVISION,
      bundleStatus: "stored",
      currentGeneration: 9,
    }));
    await expect(requireController(malformedConflict.port).publish()).resolves.toMatchObject({
      status: "indeterminate",
      stage: "control-plane",
    });
    expect(malformedConflict.activationCalls).toHaveLength(0);
  });

  it("reports host LKG preservation with the already-published channel receipt", async () => {
    for (const hostStatus of ["unavailable", "failed"] as const) {
      const port = harness(
        async () => publishedChannel(),
        async () => ({ status: hostStatus }),
      );
      await expect(requireController(port.port).publish()).resolves.toEqual({
        status: "failed",
        reason:
          hostStatus === "unavailable" ? "host-activation-unavailable" : "host-activation-failed",
        lastKnownGoodPreserved: true,
        revision: REVISION,
        sourceGeneration: SOURCE_GENERATION,
        channelGeneration: CHANNEL_GENERATION,
      });
    }

    const oldActive = harness(
      async () => publishedChannel(),
      async () => activeHost(OTHER_REVISION, 5, "preserved"),
    );
    await expect(requireController(oldActive.port).publish()).resolves.toEqual({
      status: "failed",
      reason: "host-activation-revision-mismatch",
      lastKnownGoodPreserved: true,
      revision: REVISION,
      sourceGeneration: SOURCE_GENERATION,
      channelGeneration: CHANNEL_GENERATION,
      activeRevision: OTHER_REVISION,
      activationGeneration: 5,
    });
  });

  it("contains thrown, explicit-indeterminate, and malformed host activation outcomes", async () => {
    const settlements: (
      AuthoringHostActivationSettlement | Readonly<Record<string, unknown>> | "throw"
    )[] = [
      { status: "indeterminate" },
      { status: "active", activeRevision: REVISION, activationGeneration: 2 },
      { ...activeHost(), diagnostic: "forbidden" },
      "throw",
    ];
    for (const settlement of settlements) {
      const port = harness(
        async () => publishedChannel(),
        async () => {
          if (settlement === "throw") throw new TypeError("host outcome unknown");
          return settlement as AuthoringHostActivationSettlement;
        },
      );
      await expect(requireController(port.port).publish()).resolves.toEqual({
        status: "indeterminate",
        stage: "host-activation",
        revision: REVISION,
        sourceGeneration: SOURCE_GENERATION,
        channelGeneration: CHANNEL_GENERATION,
      });
    }
  });

  it("rejects concurrent entry and fences a pending channel result after a document edit", async () => {
    const pending = deferred<AuthoringControlPlanePublicationSettlement>();
    const port = harness(() => pending.promise);
    const controller = requireController(port.port);
    const first = controller.publish();
    expect(controller.read().pending).toBe("control-plane");
    await expect(controller.publish()).resolves.toEqual({
      status: "failed",
      reason: "operation-in-progress",
      lastKnownGoodPreserved: false,
    });

    const edited = changedDocument("Edited while publishing");
    const replaced = controller.replaceSnapshot(
      snapshot({ document: edited, previewRevision: revisionOf(edited) }),
    );
    expect(replaced.ok).toBe(true);
    expect(controller.read().pending).toBeNull();
    expect(controller.read().result).toBeNull();
    pending.resolve(publishedChannel());
    await expect(first).resolves.toEqual({
      status: "failed",
      reason: "stale-operation",
      lastKnownGoodPreserved: false,
    });
    expect(port.activationCalls).toHaveLength(0);
    expect(controller.read().result).toBeNull();
  });

  it("fences synchronous reentrant replacement before a channel callback can authorize activation", async () => {
    const edited = changedDocument("Reentrant edit");
    {
      const port = harness(async () => {
        expect(
          controller.replaceSnapshot(
            snapshot({ document: edited, previewRevision: revisionOf(edited) }),
          ).ok,
        ).toBe(true);
        return publishedChannel();
      });
      const controller = requireController(port.port);

      await expect(controller.publish()).resolves.toEqual({
        status: "failed",
        reason: "stale-operation",
        lastKnownGoodPreserved: false,
      });
      expect(port.activationCalls).toHaveLength(0);
      expect(controller.read().result).toBeNull();
    }

    for (const pendingStage of ["control-plane", "host-activation"] as const) {
      for (const lifetime of ["replace", "dispose"] as const) {
        const port = harness();
        const controller = requireController(port.port);
        let cancellationCount = 0;
        let replacementSucceeded: boolean | null = null;
        const unsubscribe = controller.subscribe(() => {
          if (cancellationCount !== 0 || controller.read().pending !== pendingStage) return;
          cancellationCount += 1;
          if (lifetime === "replace") {
            replacementSucceeded = controller.replaceSnapshot(
              snapshot({ document: edited, previewRevision: revisionOf(edited) }),
            ).ok;
          } else {
            controller.dispose();
          }
        });

        await expect(controller.publish()).resolves.toEqual({
          status: "failed",
          reason: lifetime === "dispose" ? "disposed" : "stale-operation",
          lastKnownGoodPreserved: false,
        });
        unsubscribe();
        expect(cancellationCount).toBe(1);
        expect(replacementSucceeded).toBe(lifetime === "replace" ? true : null);
        expect(port.channelCalls).toHaveLength(pendingStage === "control-plane" ? 0 : 1);
        expect(port.activationCalls).toHaveLength(0);
        expect(controller.read().result).toBeNull();
      }
    }
  });

  it("fences late activation after replacement and after controller disposal", async () => {
    const edited = changedDocument("Activation fence edit");
    for (const lifetime of ["replace", "dispose"] as const) {
      const pending = deferred<AuthoringHostActivationSettlement>();
      const port = harness(
        async () => publishedChannel(),
        () => pending.promise,
      );
      const controller = requireController(port.port);
      const publication = controller.publish();
      await vi.waitFor(() => expect(controller.read().pending).toBe("host-activation"));

      if (lifetime === "replace") {
        expect(
          controller.replaceSnapshot(
            snapshot({ document: edited, previewRevision: revisionOf(edited) }),
          ).ok,
        ).toBe(true);
      } else {
        controller.dispose();
      }
      pending.resolve(activeHost());
      await expect(publication).resolves.toEqual({
        status: "failed",
        reason: lifetime === "dispose" ? "disposed" : "stale-operation",
        lastKnownGoodPreserved: false,
      });
      expect(controller.read().result).toBeNull();
      expect(controller.read().pending).toBeNull();
    }
  });

  it("provides stable external-store notifications, ignores observer errors, and closes lifetime", () => {
    const controller = requireController();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    controller.subscribe(() => {
      throw new TypeError("one observer cannot block another");
    });

    const first = controller.read();
    expect(controller.replaceSnapshot(snapshot())).toEqual({ ok: true, snapshot: first.snapshot });
    expect(controller.read()).toBe(first);
    expect(listener).not.toHaveBeenCalled();

    const edited = changedDocument("External store edit");
    const replacement = controller.replaceSnapshot(
      snapshot({ document: edited, previewRevision: revisionOf(edited) }),
    );
    expect(replacement.ok).toBe(true);
    expect(Object.isFrozen(replacement)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    controller.dispose();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.read()).toMatchObject({ disposed: true, pending: null, result: null });
    expect(Object.isFrozen(controller.read())).toBe(true);
    expect(controller.replaceSnapshot(snapshot())).toEqual({ ok: false, reason: "disposed" });
  });
});
