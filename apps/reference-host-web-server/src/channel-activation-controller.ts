/* eslint-disable @typescript-eslint/no-invalid-void-type -- Public lifecycle methods are
 * deliberately receiver-independent at this host-owned composition boundary. */
import {
  BUNDLE_INTEGRITY_LIMITS,
  openBundleRuntimeActivation,
  preflightBundlePackages,
  preflightBundleReferences,
  stageBundleRuntime,
  verifyBundleStoreEntry,
} from "@desen/control-plane-api";

import { createReferenceHostControlPlaneClient } from "./control-plane-client.js";
import { loadReferenceHostInstalledPackage } from "./installed-package-inventory.js";

import type {
  BundlePackagePreflightAuthority,
  BundleRuntimeActivationAuthority,
  InstalledPackageCandidate,
} from "@desen/control-plane-api";
import type {
  ReferenceHostChannelRecord,
  ReferenceHostControlPlaneClient,
} from "./control-plane-client.js";

/** Fixed metadata allowance added to the public maximum raw Bundle size. */
export const REFERENCE_HOST_DELIVERY_ENVELOPE_BYTES = 4_096 as const;

/** Exact maximum serialized server-to-browser activation envelope size. */
export const REFERENCE_HOST_MAX_DELIVERY_BYTES =
  BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes + REFERENCE_HOST_DELIVERY_ENVELOPE_BYTES;

const DELIVERY_READERS = new WeakMap<
  ReferenceHostChannelActivationController,
  () => Readonly<{ readonly bytes: Readonly<Uint8Array>; readonly etag: string }> | undefined
>();

/** Public activation identity carried alongside one browser-deliverable Bundle. */
export interface ReferenceHostActivationIdentity {
  /** Nonnegative safe-integer generation committed by the durable activation transaction. */
  readonly generation: number;
  /** Exact active lowercase SHA-256 Bundle revision. */
  readonly revision: string;
}

/** Immutable active response data bound to one authenticated in-process activation authority. */
export interface ReferenceHostActiveDelivery {
  /** Public durable identity that the browser must match to the ETag and Bundle revision. */
  readonly activation: ReferenceHostActivationIdentity;
  /** Independently verified inert Bundle object; it contains no server or package authority. */
  readonly bundle: unknown;
  /** Strong deterministic ETag derived only from the complete durable activation identity. */
  readonly etag: string;
}

/** Controlled result of one serialized channel refresh attempt. */
export type ReferenceHostChannelRefreshResult =
  | Readonly<{
      readonly status: "available";
      readonly relationship: "activated" | "preserved" | "recovered";
      readonly delivery: ReferenceHostActiveDelivery;
    }>
  | Readonly<{ readonly status: "unavailable" }>
  | Readonly<{ readonly status: "closed" }>;

/** Trusted server configuration for one fixed-channel activation controller. */
export interface OpenReferenceHostChannelActivationControllerOptions {
  /** Absolute application-owned local-control-plane and activation state root. */
  readonly rootDirectory: string;
  /** Absolute application-owned installed Web–React package root. */
  readonly installedPackageDirectory: string;
  /** Exact loopback origin returned by the already-running T05 control plane. */
  readonly controlPlaneOrigin: string;
  /** Bearer secret retained only by this server process. */
  readonly controlPlaneApiToken: string;
  /** Fixed channel selected by server configuration, never by Bundle data. */
  readonly channelName: string;
}

/** Serialized host-owned channel consumption and durable activation lifetime. */
export interface ReferenceHostChannelActivationController {
  /** Reads the currently authenticated delivery without performing I/O or granting authority. */
  readonly readDelivery: (this: void) => ReferenceHostActiveDelivery | undefined;
  /** Polls the fixed channel and runs the complete public T02→T08 chain when needed. */
  readonly refresh: (this: void) => Promise<ReferenceHostChannelRefreshResult>;
  /** Idempotently fences late work and closes the durable activation service. */
  readonly close: (this: void) => void;
}

interface VerifiedCandidate {
  readonly bundle: unknown;
  readonly bundleBytes: Readonly<Uint8Array>;
  readonly packages: BundlePackagePreflightAuthority;
  readonly revision: string;
}

interface PrivateDelivery {
  readonly publicValue: ReferenceHostActiveDelivery;
  readonly authority: BundleRuntimeActivationAuthority;
  readonly serializedBytes: Uint8Array;
}

type AttemptResult =
  | Readonly<{ readonly status: "activated"; readonly delivery: ReferenceHostActiveDelivery }>
  | Readonly<{ readonly status: "preserved"; readonly delivery: ReferenceHostActiveDelivery }>
  | Readonly<{ readonly status: "retry" }>
  | Readonly<{ readonly status: "unavailable" }>
  | Readonly<{ readonly status: "closed" }>;

function exactOwnDataRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return captured;
  } catch {
    return undefined;
  }
}

function deliveryEtag(generation: number, revision: string): string {
  return `"desen-active:g:${String(generation)}:${revision}"`;
}

function serializeDelivery(
  authority: BundleRuntimeActivationAuthority,
  bundle: unknown,
  bundleBytes: Readonly<Uint8Array>,
): PrivateDelivery | undefined {
  const activation = Object.freeze({
    generation: authority.generation,
    revision: authority.activeRevision,
  });
  const publicValue = Object.freeze({
    activation,
    bundle,
    etag: deliveryEtag(activation.generation, activation.revision),
  });
  try {
    const encoder = new TextEncoder();
    const prefix = encoder.encode(
      `{"activation":${JSON.stringify(publicValue.activation)},"bundle":`,
    );
    const suffix = encoder.encode("}");
    const byteLength = prefix.byteLength + bundleBytes.byteLength + suffix.byteLength;
    if (bundleBytes.byteLength === 0 || byteLength > REFERENCE_HOST_MAX_DELIVERY_BYTES) {
      return undefined;
    }
    const serializedBytes = new Uint8Array(byteLength);
    serializedBytes.set(prefix, 0);
    serializedBytes.set(bundleBytes, prefix.byteLength);
    serializedBytes.set(suffix, prefix.byteLength + bundleBytes.byteLength);
    return Object.freeze({ publicValue, authority, serializedBytes });
  } catch {
    return undefined;
  }
}

function sameChannel(left: ReferenceHostChannelRecord, right: ReferenceHostChannelRecord): boolean {
  return left.generation === right.generation && left.revision === right.revision;
}

async function verifiedCandidateFor(
  client: ReferenceHostControlPlaneClient,
  inventory: InstalledPackageCandidate,
  revision: string,
): Promise<VerifiedCandidate | undefined> {
  const read = await client.readBundle(revision);
  if (read.status !== "found" || read.value.revision !== revision) return undefined;
  const integrity = verifyBundleStoreEntry(
    { revision, bytes: read.value.bytes },
    { status: "not-available" },
  );
  if (integrity.status !== "verified") return undefined;
  const packages = preflightBundlePackages(integrity.authority, [inventory]);
  if (packages.status !== "preflighted") return undefined;
  return Object.freeze({
    bundle: integrity.authority.bundle,
    bundleBytes: new Uint8Array(read.value.bytes),
    packages: packages.authority,
    revision,
  });
}

function capturedOptions(
  value: unknown,
): OpenReferenceHostChannelActivationControllerOptions | undefined {
  const captured = exactOwnDataRecord(value, [
    "rootDirectory",
    "installedPackageDirectory",
    "controlPlaneOrigin",
    "controlPlaneApiToken",
    "channelName",
  ]);
  if (
    typeof captured?.rootDirectory !== "string" ||
    typeof captured.installedPackageDirectory !== "string" ||
    typeof captured.controlPlaneOrigin !== "string" ||
    typeof captured.controlPlaneApiToken !== "string" ||
    typeof captured.channelName !== "string"
  ) {
    return undefined;
  }
  return Object.freeze({
    rootDirectory: captured.rootDirectory,
    installedPackageDirectory: captured.installedPackageDirectory,
    controlPlaneOrigin: captured.controlPlaneOrigin,
    controlPlaneApiToken: captured.controlPlaneApiToken,
    channelName: captured.channelName,
  });
}

/**
 * Opens the fixed-channel controller over the real T05 loopback HTTP boundary.
 *
 * @remarks Every candidate reruns public Bundle integrity, installed-package, reference, staging,
 * activation and restart-recovery boundaries. A failed candidate never replaces an authenticated
 * delivery. A stale channel or activation snapshot receives at most one fresh complete attempt.
 *
 * @throws {TypeError} When trusted host configuration or installed package material is invalid.
 */
export async function openReferenceHostChannelActivationController(
  options: OpenReferenceHostChannelActivationControllerOptions,
): Promise<ReferenceHostChannelActivationController> {
  const captured = capturedOptions(options);
  if (captured === undefined) {
    throw new TypeError("The reference host channel configuration is invalid.");
  }
  const client = createReferenceHostControlPlaneClient({
    origin: captured.controlPlaneOrigin,
    apiToken: captured.controlPlaneApiToken,
    channelName: captured.channelName,
  });
  const inventory = await loadReferenceHostInstalledPackage({
    installedPackageDirectory: captured.installedPackageDirectory,
  });
  const activation = await openBundleRuntimeActivation({ rootDirectory: captured.rootDirectory });

  let closed = false;
  let epoch = 0;
  let inFlight: Promise<ReferenceHostChannelRefreshResult> | undefined;
  let delivery: PrivateDelivery | undefined;
  let highestChannel: ReferenceHostChannelRecord | undefined;

  function currentDelivery(): ReferenceHostActiveDelivery | undefined {
    if (closed || delivery === undefined) return undefined;
    try {
      const state = activation.readState();
      if (state.status !== "active" || state.authority !== delivery.authority) {
        delivery = undefined;
        return undefined;
      }
      return delivery.publicValue;
    } catch {
      delivery = undefined;
      return undefined;
    }
  }

  function alive(startEpoch: number): boolean {
    return !closed && epoch === startEpoch;
  }

  async function recoverIfRequired(
    startEpoch: number,
  ): Promise<"not-required" | "recovered" | "unavailable" | "closed"> {
    if (!alive(startEpoch)) return "closed";
    let state;
    try {
      state = activation.readState();
    } catch {
      return "unavailable";
    }
    if (state.status !== "recovery-required") return "not-required";
    const record = state.record;
    if (record === null) return "unavailable";
    const active = await verifiedCandidateFor(client, inventory, record.activeRevision);
    if (!alive(startEpoch)) return "closed";
    if (active === undefined) return "unavailable";
    const previous =
      record.previousGoodRevision === null
        ? undefined
        : await verifiedCandidateFor(client, inventory, record.previousGoodRevision);
    if (!alive(startEpoch)) return "closed";
    if (record.previousGoodRevision !== null && previous === undefined) return "unavailable";
    let result;
    try {
      result = await activation.recover(active.packages, previous?.packages ?? null);
    } catch {
      return "unavailable";
    }
    if (!alive(startEpoch)) return "closed";
    if (
      result.status !== "recovered" ||
      result.authority.activeRevision !== record.activeRevision ||
      result.authority.generation !== record.generation
    ) {
      return "unavailable";
    }
    const recoveredDelivery = serializeDelivery(
      result.authority,
      active.bundle,
      active.bundleBytes,
    );
    if (recoveredDelivery === undefined) return "unavailable";
    delivery = recoveredDelivery;
    return "recovered";
  }

  function observeChannel(candidate: ReferenceHostChannelRecord): boolean {
    if (highestChannel === undefined) {
      highestChannel = candidate;
      return true;
    }
    if (
      candidate.generation < highestChannel.generation ||
      (candidate.generation === highestChannel.generation &&
        candidate.revision !== highestChannel.revision)
    ) {
      return false;
    }
    if (candidate.generation > highestChannel.generation) highestChannel = candidate;
    return true;
  }

  async function attempt(startEpoch: number): Promise<AttemptResult> {
    if (!alive(startEpoch)) return Object.freeze({ status: "closed" });
    const channelRead = await client.readChannel();
    if (!alive(startEpoch)) return Object.freeze({ status: "closed" });
    if (channelRead.status !== "found" || !observeChannel(channelRead.value)) {
      return Object.freeze({ status: "unavailable" });
    }
    const channel = channelRead.value;
    const candidate = await verifiedCandidateFor(client, inventory, channel.revision);
    if (!alive(startEpoch)) return Object.freeze({ status: "closed" });
    if (candidate === undefined) return Object.freeze({ status: "unavailable" });

    const references = preflightBundleReferences(candidate.packages);
    if (references.status !== "preflighted") return Object.freeze({ status: "unavailable" });

    const confirmation = await client.readChannel();
    if (!alive(startEpoch)) return Object.freeze({ status: "closed" });
    if (
      confirmation.status !== "found" ||
      !observeChannel(confirmation.value) ||
      !sameChannel(channel, confirmation.value)
    ) {
      return Object.freeze({ status: "retry" });
    }

    let state;
    try {
      state = activation.readState();
    } catch {
      return Object.freeze({ status: "unavailable" });
    }
    if (state.status === "recovery-required") return Object.freeze({ status: "retry" });
    if (state.status === "active" && state.authority.activeRevision === candidate.revision) {
      let activeDelivery = delivery;
      if (activeDelivery?.authority !== state.authority) {
        const rebound = serializeDelivery(state.authority, candidate.bundle, candidate.bundleBytes);
        if (rebound === undefined) return Object.freeze({ status: "unavailable" });
        delivery = rebound;
        activeDelivery = rebound;
      }
      return Object.freeze({ status: "preserved", delivery: activeDelivery.publicValue });
    }

    const staged = stageBundleRuntime(candidate.packages);
    if (staged.status !== "staged") return Object.freeze({ status: "unavailable" });
    const expectedGeneration = state.status === "empty" ? null : state.authority.generation;
    let result;
    try {
      result = await activation.activate(
        references.authority,
        staged.authority,
        expectedGeneration,
      );
    } catch {
      return Object.freeze({ status: "unavailable" });
    }
    if (!alive(startEpoch)) return Object.freeze({ status: "closed" });
    if (result.status === "precondition-failed" || result.status === "recovery-required") {
      return Object.freeze({ status: "retry" });
    }
    if (result.status !== "activated") return Object.freeze({ status: "unavailable" });
    const activatedDelivery = serializeDelivery(
      result.authority,
      candidate.bundle,
      candidate.bundleBytes,
    );
    if (activatedDelivery === undefined) return Object.freeze({ status: "unavailable" });
    delivery = activatedDelivery;
    return Object.freeze({ status: "activated", delivery: activatedDelivery.publicValue });
  }

  async function refreshOnce(startEpoch: number): Promise<ReferenceHostChannelRefreshResult> {
    const recovery = await recoverIfRequired(startEpoch);
    if (recovery === "closed") return Object.freeze({ status: "closed" });
    if (recovery === "unavailable") {
      const current = currentDelivery();
      return current === undefined
        ? Object.freeze({ status: "unavailable" })
        : Object.freeze({ status: "available", relationship: "preserved", delivery: current });
    }

    let attempted = await attempt(startEpoch);
    if (attempted.status === "retry") {
      const retryRecovery = await recoverIfRequired(startEpoch);
      if (retryRecovery === "closed") return Object.freeze({ status: "closed" });
      if (retryRecovery !== "unavailable") attempted = await attempt(startEpoch);
      else attempted = Object.freeze({ status: "unavailable" });
    }
    if (attempted.status === "closed") return Object.freeze({ status: "closed" });
    if (attempted.status === "activated" || attempted.status === "preserved") {
      return Object.freeze({
        status: "available",
        relationship:
          attempted.status === "activated"
            ? "activated"
            : recovery === "recovered"
              ? "recovered"
              : "preserved",
        delivery: attempted.delivery,
      });
    }
    const current = currentDelivery();
    return current === undefined
      ? Object.freeze({ status: "unavailable" })
      : Object.freeze({
          status: "available",
          relationship: recovery === "recovered" ? "recovered" : "preserved",
          delivery: current,
        });
  }

  const controller: ReferenceHostChannelActivationController = Object.freeze({
    readDelivery: currentDelivery,
    refresh(): Promise<ReferenceHostChannelRefreshResult> {
      if (closed) return Promise.resolve(Object.freeze({ status: "closed" }));
      if (inFlight !== undefined) return inFlight;
      const startEpoch = epoch;
      const pending = refreshOnce(startEpoch).finally(() => {
        if (inFlight === pending) inFlight = undefined;
      });
      inFlight = pending;
      return pending;
    },
    close(): void {
      if (closed) return;
      closed = true;
      epoch += 1;
      delivery = undefined;
      try {
        activation.close();
      } catch {
        // The terminal epoch fence remains authoritative even when repository cleanup fails.
      }
    },
  });
  DELIVERY_READERS.set(controller, () => {
    const current = currentDelivery();
    if (current === undefined || delivery === undefined || current !== delivery.publicValue) {
      return undefined;
    }
    return Object.freeze({ bytes: delivery.serializedBytes, etag: delivery.publicValue.etag });
  });
  return controller;
}

/** @internal Serializes the already-bounded delivery for the HTTP adapter without reparsing it. */
export function readReferenceHostDeliveryBytes(
  controller: ReferenceHostChannelActivationController,
): Readonly<{ readonly bytes: Readonly<Uint8Array>; readonly etag: string }> | undefined {
  return DELIVERY_READERS.get(controller)?.();
}
