import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalizeJsonBytes } from "@desen/protocol";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  BUNDLE_INTEGRITY_LIMITS,
  LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
  openBundleRuntimeActivation,
  openBundleStore,
  openLocalControlPlane,
  preflightBundlePackages,
  preflightBundleReferences,
  stageBundleRuntime,
  verifyBundleStoreEntry,
} from "../src/index.js";
import {
  createBundleRuntimeActivationInternal,
  readBundleRuntimeActivationAuthority,
} from "../src/runtime-activation-internal.js";
import { openRuntimeActivationSqliteRepository } from "../src/runtime-activation-sqlite-internal.js";
import { readBundleRuntimeStagingAuthority } from "../src/runtime-staging-internal.js";
import {
  RUNTIME_ACTIVATION_DATABASE_FILE_NAME,
  activateBaseline,
  activationPairFor,
  bundleFilePath,
  installedCandidate,
  loadRuntimeFaultFixtures,
  packageAuthorityFor,
  readDurableRecord,
  storeBundles,
  writeDurableRecord,
} from "./runtime-fault-injection-support.js";

import type { DesenBundle } from "@desen/protocol";
import type {
  ActiveRuntimeBaseline,
  RuntimeFaultFixtures,
} from "./runtime-fault-injection-support.js";
import type {
  BundleIntegrityAuthority,
  BundleRuntimeActivation,
  BundleStore,
  LocalControlPlane,
  LocalControlPlaneInjectResponse,
  RuntimeActivationRecord,
} from "../src/index.js";

const API_TOKEN = "m07-t09-runtime-fault-token-32-bytes";
const CHANNEL_REVISION = `sha256:${"f".repeat(64)}`;
const WRONG_REVISION = `sha256:${"e".repeat(64)}`;

export const M07_T09_FAULT_CASE_IDS = Object.freeze([
  "channel-invalid-discovery",
  "immutable-fetch-missing",
  "integrity-bundle-size",
  "integrity-bundle-json",
  "integrity-unsupported-protocol",
  "integrity-revision-mismatch",
  "integrity-source-digest-mismatch",
  "package-resolution-missing",
  "package-digest-mismatch",
  "reference-capability-unknown",
  "reference-depth-limit",
  "staging-execution-contract",
  "commit-definite-precommit",
  "commit-postcommit-indeterminate",
  "recovery-package-authority",
  "recovery-reference-preflight",
  "recovery-runtime-staging",
  "recovery-previous-good-reclosure",
  "recovery-final-record-drift",
] as const);

let fixtures: RuntimeFaultFixtures;
let temporaryRoots: string[] = [];
let activations: BundleRuntimeActivation[] = [];
let localApis: LocalControlPlane[] = [];

function trackActivation<Activation extends BundleRuntimeActivation>(
  activation: Activation,
): Activation {
  activations.push(activation);
  return activation;
}

function trackLocalApi<Api extends LocalControlPlane>(api: Api): Api {
  localApis.push(api);
  return api;
}

async function temporaryRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "desen-m07-t09-fault-")));
  temporaryRoots.push(root);
  return root;
}

async function baselineWith(
  ...additionalBundles: readonly DesenBundle[]
): Promise<Readonly<{ readonly baseline: ActiveRuntimeBaseline; readonly root: string }>> {
  const root = await temporaryRoot();
  const baseline = await activateBaseline(fixtures, root, additionalBundles);
  trackActivation(baseline.activation);
  return Object.freeze({ baseline, root });
}

function expectBaselineUnchanged(baseline: ActiveRuntimeBaseline, root: string): void {
  expect(baseline.activation.readState()).toEqual({
    status: "active",
    authority: baseline.authority,
  });
  expect(readDurableRecord(root)).toEqual(baseline.record);
  expect(readBundleRuntimeActivationAuthority(baseline.authority)).toBeDefined();
}

async function integrityFromStore(
  store: BundleStore,
  revision: string,
): Promise<BundleIntegrityAuthority> {
  const read = await store.getBundle(revision);
  if (read.status !== "found") throw new TypeError("Expected one stored fault-matrix Bundle.");
  const integrity = verifyBundleStoreEntry(read.entry, { status: "not-available" });
  if (integrity.status !== "verified") {
    throw new TypeError(`Expected T02 success, received ${integrity.stage}.`);
  }
  return integrity.authority;
}

function responseJson(response: LocalControlPlaneInjectResponse): Record<string, unknown> {
  const decoded = JSON.parse(new TextDecoder().decode(response.body)) as unknown;
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new TypeError("Expected one local control-plane JSON response.");
  }
  return decoded as Record<string, unknown>;
}

function authorizedHeaders(precondition?: string): Readonly<Record<string, string>> {
  return Object.freeze({
    authorization: `Bearer ${API_TOKEN}`,
    "content-type": LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
    ...(precondition === undefined ? {} : { [precondition]: "*" }),
  });
}

function deferred(): Readonly<{
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}> {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolveDeferred) => {
    resolvePromise = resolveDeferred;
  });
  if (resolvePromise === undefined) throw new TypeError("Deferred resolver was not initialized.");
  return Object.freeze({ promise, resolve: resolvePromise });
}

async function commitCandidate(
  baseline: ActiveRuntimeBaseline,
  bundle: DesenBundle,
): Promise<RuntimeActivationRecord> {
  const pair = activationPairFor(fixtures, bundle);
  const result = await baseline.activation.activate(
    pair.referenceAuthority,
    pair.stagingAuthority,
    baseline.record.generation,
  );
  if (result.status !== "activated") {
    throw new TypeError(`Expected candidate activation, received ${result.status}.`);
  }
  return Object.freeze({
    activeRevision: result.authority.activeRevision,
    previousGoodRevision: result.authority.previousGoodRevision,
    generation: result.authority.generation,
  });
}

beforeAll(async () => {
  fixtures = await loadRuntimeFaultFixtures();
  expect(M07_T09_FAULT_CASE_IDS).toHaveLength(19);
  expect(new Set(M07_T09_FAULT_CASE_IDS).size).toBe(M07_T09_FAULT_CASE_IDS.length);
});

afterEach(async () => {
  const currentApis = localApis;
  const currentActivations = activations;
  const currentRoots = temporaryRoots;
  localApis = [];
  activations = [];
  temporaryRoots = [];
  const apiCleanup = await Promise.allSettled(
    currentApis.map(async (api) => {
      await api.close();
    }),
  );
  const activationCleanup = await Promise.allSettled(
    currentActivations.map(async (activation) => {
      activation.close();
    }),
  );
  const rootCleanup = await Promise.allSettled(
    currentRoots.map((root) => rm(root, { force: true, recursive: true })),
  );
  const firstFailure = [...apiCleanup, ...activationCleanup, ...rootCleanup].find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (firstFailure !== undefined) throw firstFailure.reason;
});

describe("M07-T09 bounded activation fault matrix", () => {
  it("[channel-invalid-discovery] keeps an invalid channel candidate outside active authority", async () => {
    const { baseline, root } = await baselineWith();
    const localApi = trackLocalApi(
      await openLocalControlPlane({
        rootDirectory: root,
        apiToken: API_TOKEN,
        allowedOrigins: [],
      }),
    );
    const invalidBytes = new TextEncoder().encode('{"kind":"not-a-bundle"}');
    const stored = await localApi.inject({
      method: "PUT",
      path: `/v1/bundles/${CHANNEL_REVISION}`,
      headers: authorizedHeaders(),
      body: invalidBytes,
    });
    expect(stored.statusCode).toBe(201);
    const moved = await localApi.inject({
      method: "PUT",
      path: "/v1/channels/preview",
      headers: authorizedHeaders("if-none-match"),
      body: new TextEncoder().encode(JSON.stringify({ revision: CHANNEL_REVISION })),
    });
    expect(moved.statusCode).toBe(201);
    expect(responseJson(moved)).toMatchObject({ revision: CHANNEL_REVISION, status: "created" });
    const discovered = await localApi.inject({
      method: "GET",
      path: "/v1/channels/preview",
      headers: { authorization: `Bearer ${API_TOKEN}` },
    });
    expect(responseJson(discovered)).toMatchObject({ revision: CHANNEL_REVISION });

    const fetched = await baseline.store.getBundle(CHANNEL_REVISION);
    expect(fetched.status).toBe("found");
    if (fetched.status !== "found") throw new TypeError("Expected the discovered Bundle bytes.");
    const integrity = verifyBundleStoreEntry(fetched.entry, { status: "not-available" });
    expect(integrity).toMatchObject({ status: "rejected", stage: "bundle-schema" });
    expect(integrity).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[immutable-fetch-missing] stops a disappeared channel target before integrity", async () => {
    const { baseline, root } = await baselineWith(fixtures.candidateBundle);
    const localApi = trackLocalApi(
      await openLocalControlPlane({
        rootDirectory: root,
        apiToken: API_TOKEN,
        allowedOrigins: [],
      }),
    );
    const moved = await localApi.inject({
      method: "PUT",
      path: "/v1/channels/preview",
      headers: authorizedHeaders("if-none-match"),
      body: new TextEncoder().encode(
        JSON.stringify({ revision: fixtures.candidateBundle.revision }),
      ),
    });
    expect(moved.statusCode).toBe(201);
    await rm(bundleFilePath(root, fixtures.candidateBundle.revision));

    const discovered = await localApi.inject({
      method: "GET",
      path: "/v1/channels/preview",
      headers: { authorization: `Bearer ${API_TOKEN}` },
    });
    expect(discovered.statusCode).toBe(200);
    const discoveredBody = responseJson(discovered);
    expect(discoveredBody).toMatchObject({ revision: fixtures.candidateBundle.revision });
    const discoveredRevision = discoveredBody["revision"];
    if (typeof discoveredRevision !== "string") {
      throw new TypeError("Expected the channel to return one exact Bundle revision.");
    }

    await expect(baseline.store.getBundle(discoveredRevision)).resolves.toEqual({
      status: "missing",
    });
    expectBaselineUnchanged(baseline, root);
  });

  it("[integrity-bundle-size] rejects the raw byte ceiling before parsing", async () => {
    const { baseline, root } = await baselineWith();
    const bytes = new Uint8Array(BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes + 1);
    bytes.fill(0x20);
    const result = verifyBundleStoreEntry(
      { revision: WRONG_REVISION, bytes },
      { status: "not-available" },
    );
    expect(result).toMatchObject({ status: "rejected", stage: "bundle-size" });
    expect(result).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[integrity-bundle-json] rejects malformed immutable bytes before protocol checks", async () => {
    const { baseline, root } = await baselineWith();
    const result = verifyBundleStoreEntry(
      { revision: WRONG_REVISION, bytes: new TextEncoder().encode("{") },
      { status: "not-available" },
    );
    expect(result).toMatchObject({ status: "rejected", stage: "bundle-json" });
    expect(result).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[integrity-unsupported-protocol] rejects forward-version guessing before revision work", async () => {
    const { baseline, root } = await baselineWith();
    const result = verifyBundleStoreEntry(
      {
        revision: WRONG_REVISION,
        bytes: new TextEncoder().encode('{"desen":"9.9.9"}'),
      },
      { status: "not-available" },
    );
    expect(result).toMatchObject({ status: "rejected", stage: "bundle-protocol" });
    expect(result).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[integrity-revision-mismatch] rejects valid Bundle bytes under a substituted key", async () => {
    const { baseline, root } = await baselineWith();
    const result = verifyBundleStoreEntry(
      { revision: WRONG_REVISION, bytes: canonicalizeJsonBytes(fixtures.candidateBundle) },
      { status: "not-available" },
    );
    expect(result).toMatchObject({ status: "rejected", stage: "bundle-revision" });
    expect(result).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[integrity-source-digest-mismatch] rejects independently supplied Source drift", async () => {
    const { baseline, root } = await baselineWith();
    const result = verifyBundleStoreEntry(
      {
        revision: fixtures.activeBundle.revision,
        bytes: canonicalizeJsonBytes(fixtures.activeBundle),
      },
      { status: "available", sourceBytes: fixtures.sourceDigestMismatchBytes },
    );
    expect(result).toMatchObject({ status: "rejected", stage: "source-digest" });
    expect(result).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[package-resolution-missing] preserves A when the exact package tuple is unavailable", async () => {
    const { baseline, root } = await baselineWith(fixtures.candidateBundle);
    const integrity = await integrityFromStore(baseline.store, fixtures.candidateBundle.revision);
    const result = preflightBundlePackages(integrity, []);
    expect(result).toMatchObject({ status: "rejected", stage: "package-resolution" });
    expect(result).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[package-digest-mismatch] preserves A when installed artifact bytes drift", async () => {
    const { baseline, root } = await baselineWith(fixtures.candidateBundle);
    const integrity = await integrityFromStore(baseline.store, fixtures.candidateBundle.revision);
    const artifacts = fixtures.artifacts.map((artifact) =>
      Object.freeze({ path: artifact.path, bytes: new Uint8Array(artifact.bytes) }),
    );
    const first = artifacts[0];
    const firstByte = first?.bytes[0];
    if (first === undefined || firstByte === undefined) {
      throw new TypeError("Expected one nonempty package artifact.");
    }
    (first.bytes as Uint8Array)[0] = firstByte ^ 1;
    const result = preflightBundlePackages(integrity, [installedCandidate(fixtures, artifacts)]);
    expect(result).toMatchObject({ status: "rejected", stage: "package-digest" });
    expect(result).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[reference-capability-unknown] rejects an unknown capability before staging", async () => {
    const { baseline, root } = await baselineWith(fixtures.referenceInvalidBundle);
    const integrity = await integrityFromStore(
      baseline.store,
      fixtures.referenceInvalidBundle.revision,
    );
    const packages = preflightBundlePackages(integrity, [installedCandidate(fixtures)]);
    if (packages.status !== "preflighted") throw new TypeError("Expected T03 success.");
    const result = preflightBundleReferences(packages.authority);
    expect(result).toMatchObject({
      status: "rejected",
      stage: "surface-capability-references",
    });
    expect(result).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[reference-depth-limit] rejects depth 65 before runtime indexes", async () => {
    const { baseline, root } = await baselineWith(fixtures.referenceLimitBundle);
    const integrity = await integrityFromStore(
      baseline.store,
      fixtures.referenceLimitBundle.revision,
    );
    const packages = preflightBundlePackages(integrity, [installedCandidate(fixtures)]);
    if (packages.status !== "preflighted") throw new TypeError("Expected T03 success.");
    const result = preflightBundleReferences(packages.authority);
    expect(result).toMatchObject({ status: "rejected", stage: "activation-limits" });
    expect(result).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[staging-execution-contract] rejects static contract drift without partial indexes", async () => {
    const { baseline, root } = await baselineWith(fixtures.stagingInvalidBundle);
    const integrity = await integrityFromStore(
      baseline.store,
      fixtures.stagingInvalidBundle.revision,
    );
    const packages = preflightBundlePackages(integrity, [installedCandidate(fixtures)]);
    if (packages.status !== "preflighted") throw new TypeError("Expected T03 success.");
    expect(preflightBundleReferences(packages.authority).status).toBe("preflighted");
    const result = stageBundleRuntime(packages.authority);
    expect(result).toMatchObject({ status: "rejected", stage: "execution-contracts" });
    expect(result).not.toHaveProperty("authority");
    expectBaselineUnchanged(baseline, root);
  });

  it("[commit-definite-precommit] rolls back real SQLite and keeps A current", async () => {
    const root = await temporaryRoot();
    const store = await storeBundles(root, [fixtures.activeBundle, fixtures.candidateBundle]);
    let commits = 0;
    const repository = openRuntimeActivationSqliteRepository(
      join(root, RUNTIME_ACTIVATION_DATABASE_FILE_NAME),
      {
        beforeCommit: () => {
          commits += 1;
          if (commits === 2) throw new Error("controlled definite pre-COMMIT fault");
        },
      },
    );
    const activation = trackActivation(
      createBundleRuntimeActivationInternal({ bundleStore: store, repository }),
    );
    const activePair = activationPairFor(fixtures, fixtures.activeBundle);
    const active = await activation.activate(
      activePair.referenceAuthority,
      activePair.stagingAuthority,
      null,
    );
    if (active.status !== "activated") throw new TypeError("Expected A activation.");
    const record = readDurableRecord(root);
    const candidatePair = activationPairFor(fixtures, fixtures.candidateBundle);

    await expect(
      activation.activate(candidatePair.referenceAuthority, candidatePair.stagingAuthority, 0),
    ).rejects.toMatchObject({ code: "STORAGE_IO_FAILURE" });
    expect(readBundleRuntimeStagingAuthority(candidatePair.stagingAuthority)).toBeUndefined();
    expect(readDurableRecord(root)).toEqual(record);
    expect(activation.readState()).toEqual({ status: "active", authority: active.authority });
    expect(readBundleRuntimeActivationAuthority(active.authority)).toBeDefined();
  });

  it("[commit-postcommit-indeterminate] recovers only the complete durable winner", async () => {
    const root = await temporaryRoot();
    const store = await storeBundles(root, [fixtures.activeBundle, fixtures.candidateBundle]);
    let commits = 0;
    const repository = openRuntimeActivationSqliteRepository(
      join(root, RUNTIME_ACTIVATION_DATABASE_FILE_NAME),
      {
        afterCommit: () => {
          commits += 1;
          if (commits === 2) throw new Error("controlled post-COMMIT observation fault");
        },
      },
    );
    const activation = trackActivation(
      createBundleRuntimeActivationInternal({ bundleStore: store, repository }),
    );
    const activePair = activationPairFor(fixtures, fixtures.activeBundle);
    const active = await activation.activate(
      activePair.referenceAuthority,
      activePair.stagingAuthority,
      null,
    );
    if (active.status !== "activated") throw new TypeError("Expected A activation.");
    const candidatePair = activationPairFor(fixtures, fixtures.candidateBundle);
    expect(
      await activation.activate(
        candidatePair.referenceAuthority,
        candidatePair.stagingAuthority,
        0,
      ),
    ).toEqual({ status: "recovery-required" });
    expect(readBundleRuntimeStagingAuthority(candidatePair.stagingAuthority)).toBeUndefined();
    const committed = {
      activeRevision: fixtures.candidateBundle.revision,
      previousGoodRevision: fixtures.activeBundle.revision,
      generation: 1,
    };
    expect(readDurableRecord(root)).toEqual(committed);
    expect(readBundleRuntimeActivationAuthority(active.authority)).toBeUndefined();
    expect(activation.readState()).toEqual({ status: "recovery-required", record: null });
    activation.close();

    const restarted = trackActivation(await openBundleRuntimeActivation({ rootDirectory: root }));
    expect(restarted.readState()).toEqual({ status: "recovery-required", record: committed });
    const recovered = await restarted.recover(
      packageAuthorityFor(fixtures, fixtures.candidateBundle),
      packageAuthorityFor(fixtures, fixtures.activeBundle),
    );
    expect(recovered).toMatchObject({ status: "recovered", authority: committed });
    if (recovered.status !== "recovered") throw new TypeError("Expected exact winner recovery.");
    expect(readBundleRuntimeActivationAuthority(recovered.authority)).toBeDefined();
    expect(restarted.readState()).toEqual({
      status: "active",
      authority: recovered.authority,
    });
    expect(readDurableRecord(root)).toEqual(committed);
  });

  it("[recovery-package-authority] rejects swapped durable roles without writing", async () => {
    const { baseline, root } = await baselineWith(fixtures.candidateBundle);
    const committed = await commitCandidate(baseline, fixtures.candidateBundle);
    baseline.activation.close();
    const restarted = trackActivation(await openBundleRuntimeActivation({ rootDirectory: root }));
    const rejected = await restarted.recover(
      packageAuthorityFor(fixtures, fixtures.activeBundle),
      packageAuthorityFor(fixtures, fixtures.activeBundle),
    );
    expect(rejected).toMatchObject({
      status: "rejected",
      role: "active",
      stage: "package-authority",
    });
    expect(rejected).not.toHaveProperty("authority");
    expect(readDurableRecord(root)).toEqual(committed);
    expect(restarted.readState()).toEqual({ status: "recovery-required", record: committed });
  });

  it("[recovery-reference-preflight] rejects an externally selected invalid reference lineage", async () => {
    const root = await temporaryRoot();
    await storeBundles(root, [fixtures.referenceInvalidBundle]);
    const initialized = trackActivation(await openBundleRuntimeActivation({ rootDirectory: root }));
    initialized.close();
    const record = Object.freeze({
      activeRevision: fixtures.referenceInvalidBundle.revision,
      previousGoodRevision: null,
      generation: 0,
    });
    writeDurableRecord(root, record);
    const restarted = trackActivation(await openBundleRuntimeActivation({ rootDirectory: root }));

    const rejected = await restarted.recover(
      packageAuthorityFor(fixtures, fixtures.referenceInvalidBundle),
      null,
    );
    expect(rejected).toMatchObject({
      status: "rejected",
      role: "active",
      stage: "reference-preflight",
    });
    expect(rejected).not.toHaveProperty("authority");
    expect(readDurableRecord(root)).toEqual(record);
    expect(restarted.readState()).toEqual({ status: "recovery-required", record });
  });

  it("[recovery-runtime-staging] rejects an externally selected invalid execution lineage", async () => {
    const root = await temporaryRoot();
    await storeBundles(root, [fixtures.stagingInvalidBundle]);
    const initialized = trackActivation(await openBundleRuntimeActivation({ rootDirectory: root }));
    initialized.close();
    const record = Object.freeze({
      activeRevision: fixtures.stagingInvalidBundle.revision,
      previousGoodRevision: null,
      generation: 0,
    });
    writeDurableRecord(root, record);
    const restarted = trackActivation(await openBundleRuntimeActivation({ rootDirectory: root }));

    const rejected = await restarted.recover(
      packageAuthorityFor(fixtures, fixtures.stagingInvalidBundle),
      null,
    );
    expect(rejected).toMatchObject({
      status: "rejected",
      role: "active",
      stage: "runtime-staging",
    });
    expect(rejected).not.toHaveProperty("authority");
    expect(readDurableRecord(root)).toEqual(record);
    expect(restarted.readState()).toEqual({ status: "recovery-required", record });
  });

  it("[recovery-previous-good-reclosure] publishes neither role when fallback bytes disappear", async () => {
    const { baseline, root } = await baselineWith(fixtures.candidateBundle);
    const committed = await commitCandidate(baseline, fixtures.candidateBundle);
    baseline.activation.close();
    await rm(bundleFilePath(root, fixtures.activeBundle.revision));
    const restarted = trackActivation(await openBundleRuntimeActivation({ rootDirectory: root }));

    const rejected = await restarted.recover(
      packageAuthorityFor(fixtures, fixtures.candidateBundle),
      packageAuthorityFor(fixtures, fixtures.activeBundle),
    );
    expect(rejected).toMatchObject({
      status: "rejected",
      role: "previous-good",
      stage: "bundle-reclosure",
    });
    expect(rejected).not.toHaveProperty("authority");
    expect(readDurableRecord(root)).toEqual(committed);
    expect(restarted.readState()).toEqual({ status: "recovery-required", record: committed });
  });

  it("[recovery-final-record-drift] lets the final durable observation win", async () => {
    const { baseline, root } = await baselineWith(fixtures.candidateBundle);
    const committed = await commitCandidate(baseline, fixtures.candidateBundle);
    baseline.activation.close();
    const store = await openBundleStore({ rootDirectory: root });
    const entered = deferred();
    const release = deferred();
    let firstRead = true;
    const delayedStore: BundleStore = Object.freeze({
      putBundle: store.putBundle,
      getBundle: async (revision: string) => {
        if (firstRead) {
          firstRead = false;
          entered.resolve();
          await release.promise;
        }
        return store.getBundle(revision);
      },
    });
    const repository = openRuntimeActivationSqliteRepository(
      join(root, RUNTIME_ACTIVATION_DATABASE_FILE_NAME),
    );
    const restarted = trackActivation(
      createBundleRuntimeActivationInternal({ bundleStore: delayedStore, repository }),
    );
    const pending = restarted.recover(
      packageAuthorityFor(fixtures, fixtures.candidateBundle),
      packageAuthorityFor(fixtures, fixtures.activeBundle),
    );
    await entered.promise;
    const drifted = Object.freeze({ ...committed, generation: committed.generation + 1 });
    writeDurableRecord(root, drifted);
    release.resolve();

    await expect(pending).resolves.toEqual({ status: "recovery-required", record: drifted });
    expect(readDurableRecord(root)).toEqual(drifted);
    expect(restarted.readState()).toEqual({ status: "recovery-required", record: drifted });
  });

  it("keeps the exact fault-case inventory closed and duplicate-free", () => {
    expect(M07_T09_FAULT_CASE_IDS).toEqual([
      "channel-invalid-discovery",
      "immutable-fetch-missing",
      "integrity-bundle-size",
      "integrity-bundle-json",
      "integrity-unsupported-protocol",
      "integrity-revision-mismatch",
      "integrity-source-digest-mismatch",
      "package-resolution-missing",
      "package-digest-mismatch",
      "reference-capability-unknown",
      "reference-depth-limit",
      "staging-execution-contract",
      "commit-definite-precommit",
      "commit-postcommit-indeterminate",
      "recovery-package-authority",
      "recovery-reference-preflight",
      "recovery-runtime-staging",
      "recovery-previous-good-reclosure",
      "recovery-final-record-drift",
    ]);
  });
});
