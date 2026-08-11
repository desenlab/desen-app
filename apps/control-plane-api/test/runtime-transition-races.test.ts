import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { calculateDesenBundleRevision, canonicalizeJsonBytes } from "@desen/protocol";
import Database from "better-sqlite3";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  openBundleRuntimeActivation,
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
  installedCandidate,
  loadRuntimeFaultFixtures,
  packageAuthorityFor,
  readDurableRecord,
} from "./runtime-fault-injection-support.js";

import type { DesenBundle } from "@desen/protocol";
import type {
  BundleIntegrityAuthority,
  BundleRuntimeActivation,
  BundleRuntimeActivationAuthority,
  BundleRuntimeActivationResult,
  BundleStore,
  BundleStoreEntry,
  InstalledPackageArtifact,
  RuntimeActivationRecord,
} from "../src/index.js";
import type { RuntimeFaultFixtures } from "./runtime-fault-injection-support.js";

const WRONG_REVISION = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const TRANSITION_CASE_IDS = Object.freeze([
  "ordered-unsupported-protocol",
  "ordered-revision-mismatch",
  "ordered-source-digest-mismatch",
  "ordered-package-missing",
  "ordered-package-digest-mismatch",
  "ordered-reference-capability",
  "ordered-reference-limit",
  "ordered-staging-contract",
  "same-candidate-race",
  "different-candidate-race",
  "recovery-activation-race",
  "activation-recovery-race",
  "restart-stale-reconstruction",
  "journal-mode-external-transition",
  "journal-mode-writer-reauthentication",
] as const);

let fixtures: RuntimeFaultFixtures;
let alternateCandidate: DesenBundle;
let temporaryRoots: string[] = [];
const openActivations = new Set<BundleRuntimeActivation>();

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function candidateWithTitle(source: DesenBundle, text: string): DesenBundle {
  const bundle = cloneJson(source);
  const title = bundle.surfaces["sign-in"]?.root.slots?.["default"]?.find(
    ({ id }) => id === "sign-in.title",
  );
  if (title?.props === undefined) throw new TypeError("Expected the sign-in title fixture.");
  title.props = { ...title.props, text };
  bundle.revision = calculateDesenBundleRevision(bundle);
  return bundle;
}

function trackActivation(activation: BundleRuntimeActivation): BundleRuntimeActivation {
  openActivations.add(activation);
  return activation;
}

async function temporaryRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "desen-m07-t10-transition-")));
  temporaryRoots.push(root);
  return root;
}

function requireActivated(result: BundleRuntimeActivationResult): BundleRuntimeActivationAuthority {
  expect(result.status).toBe("activated");
  if (result.status !== "activated") throw new TypeError("Expected activation success.");
  return result.authority;
}

async function integrityFromStore(
  store: BundleStore,
  revision: string,
): Promise<BundleIntegrityAuthority> {
  const read = await store.getBundle(revision);
  if (read.status !== "found") throw new TypeError(`Expected stored Bundle ${revision}.`);
  const verified = verifyBundleStoreEntry(read.entry, { status: "not-available" });
  if (verified.status !== "verified") throw new TypeError("Expected Bundle integrity authority.");
  return verified.authority;
}

function changedArtifacts(): readonly InstalledPackageArtifact[] {
  const artifacts = fixtures.artifacts.map((artifact) =>
    Object.freeze({ path: artifact.path, bytes: new Uint8Array(artifact.bytes) }),
  );
  const first = artifacts[0];
  const firstByte = first?.bytes[0];
  if (first === undefined || firstByte === undefined) {
    throw new TypeError("Expected one nonempty package artifact.");
  }
  (first.bytes as Uint8Array)[0] = firstByte ^ 1;
  return artifacts;
}

function expectedSuccessor(
  activeRevision: string,
  previousGoodRevision: string,
  generation = 1,
): RuntimeActivationRecord {
  return Object.freeze({ activeRevision, previousGoodRevision, generation });
}

async function recoverExact(
  root: string,
  activeBundle: DesenBundle,
  previousGoodBundle: DesenBundle | null,
): Promise<BundleRuntimeActivation> {
  const activation = trackActivation(await openBundleRuntimeActivation({ rootDirectory: root }));
  expect(activation.readState()).toEqual({
    status: "recovery-required",
    record: readDurableRecord(root),
  });
  await recoverControllerExact(activation, activeBundle, previousGoodBundle);
  return activation;
}

async function recoverControllerExact(
  activation: BundleRuntimeActivation,
  activeBundle: DesenBundle,
  previousGoodBundle: DesenBundle | null,
): Promise<BundleRuntimeActivationAuthority> {
  const expected = activation.readState();
  if (expected.status !== "recovery-required" || expected.record === null) {
    throw new TypeError("Expected one exact durable restart record.");
  }
  const recovered = await activation.recover(
    packageAuthorityFor(fixtures, activeBundle),
    previousGoodBundle === null ? null : packageAuthorityFor(fixtures, previousGoodBundle),
  );
  expect(recovered.status).toBe("recovered");
  if (recovered.status !== "recovered") throw new TypeError("Expected exact restart recovery.");
  expect(readBundleRuntimeActivationAuthority(recovered.authority)).toBeDefined();
  expect(activation.readState()).toEqual({ status: "active", authority: recovered.authority });
  return recovered.authority;
}

type InvalidCandidateCheck = (store: BundleStore) => void | Promise<void>;

async function runOrderedInvalidCandidate(checkInvalidB: InvalidCandidateCheck): Promise<void> {
  const root = await temporaryRoot();
  const baseline = await activateBaseline(fixtures, root, [
    fixtures.candidateBundle,
    fixtures.referenceInvalidBundle,
    fixtures.referenceLimitBundle,
    fixtures.stagingInvalidBundle,
  ]);
  trackActivation(baseline.activation);

  await checkInvalidB(baseline.store);
  expect(baseline.activation.readState()).toEqual({
    status: "active",
    authority: baseline.authority,
  });
  expect(readBundleRuntimeActivationAuthority(baseline.authority)).toBeDefined();
  expect(readDurableRecord(root)).toEqual(baseline.record);

  const candidate = activationPairFor(fixtures, fixtures.candidateBundle);
  const activated = requireActivated(
    await baseline.activation.activate(
      candidate.referenceAuthority,
      candidate.stagingAuthority,
      baseline.record.generation,
    ),
  );
  const committed = expectedSuccessor(
    fixtures.candidateBundle.revision,
    fixtures.activeBundle.revision,
  );
  expect(activated).toMatchObject(committed);
  expect(readDurableRecord(root)).toEqual(committed);
  expect(readBundleRuntimeStagingAuthority(candidate.stagingAuthority)).toBeUndefined();

  baseline.activation.close();
  const restarted = await recoverExact(root, fixtures.candidateBundle, fixtures.activeBundle);
  expect(restarted.readState()).toMatchObject({ status: "active", authority: committed });
}

async function packageAuthorityFromStore(store: BundleStore, bundle: DesenBundle) {
  const integrity = await integrityFromStore(store, bundle.revision);
  const packages = preflightBundlePackages(integrity, [installedCandidate(fixtures)]);
  if (packages.status !== "preflighted") throw new TypeError("Expected exact package authority.");
  return packages.authority;
}

function deferred<Value>(): Readonly<{
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}> {
  let resolver: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolvePromise) => {
    resolver = resolvePromise;
  });
  if (resolver === undefined) throw new TypeError("Deferred resolver was not initialized.");
  return Object.freeze({ promise, resolve: resolver });
}

function candidateRendezvousStore(
  delegate: BundleStore,
  candidateRevisions: readonly string[],
): Readonly<{
  readonly arrivals: () => number;
  readonly enable: () => void;
  readonly store: BundleStore;
}> {
  const candidates = new Set(candidateRevisions);
  const release = deferred<undefined>();
  let enabled = false;
  let arrivals = 0;
  const store: BundleStore = Object.freeze({
    getBundle: async (revision: string) => {
      if (enabled && candidates.has(revision)) {
        arrivals += 1;
        if (arrivals === 2) release.resolve(undefined);
        await release.promise;
      }
      return delegate.getBundle(revision);
    },
    putBundle: (entry: BundleStoreEntry) => delegate.putBundle(entry),
  });
  return Object.freeze({
    arrivals: () => arrivals,
    enable: () => {
      if (enabled) throw new TypeError("The activation rendezvous is already enabled.");
      enabled = true;
    },
    store,
  });
}

async function runConcurrentCandidateRace(
  firstBundle: DesenBundle,
  secondBundle: DesenBundle,
): Promise<void> {
  const root = await temporaryRoot();
  const baseline = await activateBaseline(fixtures, root, [
    fixtures.candidateBundle,
    alternateCandidate,
  ]);
  trackActivation(baseline.activation);
  baseline.activation.close();

  const rendezvous = candidateRendezvousStore(baseline.store, [
    firstBundle.revision,
    secondBundle.revision,
  ]);
  const controllers = [
    trackActivation(
      createBundleRuntimeActivationInternal({
        bundleStore: rendezvous.store,
        repository: openRuntimeActivationSqliteRepository(
          join(root, RUNTIME_ACTIVATION_DATABASE_FILE_NAME),
        ),
      }),
    ),
    trackActivation(
      createBundleRuntimeActivationInternal({
        bundleStore: rendezvous.store,
        repository: openRuntimeActivationSqliteRepository(
          join(root, RUNTIME_ACTIVATION_DATABASE_FILE_NAME),
        ),
      }),
    ),
  ] as const;
  await Promise.all(
    controllers.map((controller) =>
      recoverControllerExact(controller, fixtures.activeBundle, null),
    ),
  );
  rendezvous.enable();
  const pairs = [
    activationPairFor(fixtures, firstBundle),
    activationPairFor(fixtures, secondBundle),
  ] as const;
  const results = await Promise.all([
    controllers[0].activate(pairs[0].referenceAuthority, pairs[0].stagingAuthority, 0),
    controllers[1].activate(pairs[1].referenceAuthority, pairs[1].stagingAuthority, 0),
  ]);
  expect(rendezvous.arrivals()).toBe(2);
  const winnerIndex = results.findIndex((result) => result.status === "activated");
  const loserIndex = results.findIndex((result) => result.status === "precondition-failed");
  expect([winnerIndex, loserIndex].sort()).toEqual([0, 1]);
  if (winnerIndex < 0 || loserIndex < 0) throw new TypeError("Expected one exact race winner.");

  const winner = results[winnerIndex];
  const loser = results[loserIndex];
  if (winner?.status !== "activated" || loser?.status !== "precondition-failed") {
    throw new TypeError("Expected activated and generation-fenced race results.");
  }
  const loserController = controllers[loserIndex];
  const loserPair = pairs[loserIndex];
  if (loserController === undefined || loserPair === undefined) {
    throw new TypeError("Expected one exact losing controller and candidate.");
  }
  const winnerBundle = winnerIndex === 0 ? firstBundle : secondBundle;
  const loserBundle = loserIndex === 0 ? firstBundle : secondBundle;
  const firstCommit = expectedSuccessor(winnerBundle.revision, fixtures.activeBundle.revision);
  expect(winner.authority).toMatchObject(firstCommit);
  expect(loser.current).toEqual(firstCommit);
  expect(readDurableRecord(root)).toEqual(firstCommit);
  expect(readBundleRuntimeStagingAuthority(pairs[0].stagingAuthority)).toBeUndefined();
  expect(readBundleRuntimeStagingAuthority(pairs[1].stagingAuthority)).toBeUndefined();
  expect(loserController.readState()).toEqual({
    status: "recovery-required",
    record: firstCommit,
  });

  const loserRecovered = await loserController.recover(
    packageAuthorityFor(fixtures, winnerBundle),
    packageAuthorityFor(fixtures, fixtures.activeBundle),
  );
  expect(loserRecovered.status).toBe("recovered");
  expect(
    await loserController.activate(loserPair.referenceAuthority, loserPair.stagingAuthority, 1),
  ).toMatchObject({ status: "rejected", stage: "authority-join" });

  const fresh = activationPairFor(fixtures, loserBundle);
  const retried = requireActivated(
    await loserController.activate(fresh.referenceAuthority, fresh.stagingAuthority, 1),
  );
  const finalRecord = Object.freeze({
    activeRevision: loserBundle.revision,
    previousGoodRevision:
      loserBundle.revision === winnerBundle.revision
        ? fixtures.activeBundle.revision
        : winnerBundle.revision,
    generation: 2,
  });
  expect(retried).toMatchObject(finalRecord);
  expect(readDurableRecord(root)).toEqual(finalRecord);

  controllers[0].close();
  controllers[1].close();
  await recoverExact(
    root,
    loserBundle,
    finalRecord.previousGoodRevision === fixtures.activeBundle.revision
      ? fixtures.activeBundle
      : winnerBundle,
  );
}

beforeAll(async () => {
  fixtures = await loadRuntimeFaultFixtures();
  alternateCandidate = candidateWithTitle(fixtures.activeBundle, "Concurrent alternate candidate");
  expect(alternateCandidate.revision).not.toBe(fixtures.activeBundle.revision);
  expect(alternateCandidate.revision).not.toBe(fixtures.candidateBundle.revision);
});

afterEach(async () => {
  const activations = [...openActivations];
  openActivations.clear();
  for (const activation of activations) {
    try {
      activation.close();
    } catch {
      // Cleanup cannot improve an already asserted transition result.
    }
  }
  const roots = temporaryRoots;
  temporaryRoots = [];
  await Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })));
});

describe("M07-T10 ordered activation transition and race matrix", () => {
  it("[ordered-unsupported-protocol] preserves A, rejects B, activates C, and recovers C over A", async () => {
    await runOrderedInvalidCandidate((store) => {
      void store;
      const rejected = verifyBundleStoreEntry(
        { revision: WRONG_REVISION, bytes: new TextEncoder().encode('{"desen":"9.9.9"}') },
        { status: "not-available" },
      );
      expect(rejected).toMatchObject({ status: "rejected", stage: "bundle-protocol" });
      expect(rejected).not.toHaveProperty("authority");
    });
  });

  it("[ordered-revision-mismatch] preserves A, rejects B, activates C, and recovers C over A", async () => {
    await runOrderedInvalidCandidate((store) => {
      void store;
      const rejected = verifyBundleStoreEntry(
        { revision: WRONG_REVISION, bytes: canonicalizeJsonBytes(fixtures.candidateBundle) },
        { status: "not-available" },
      );
      expect(rejected).toMatchObject({ status: "rejected", stage: "bundle-revision" });
      expect(rejected).not.toHaveProperty("authority");
    });
  });

  it("[ordered-source-digest-mismatch] preserves A, rejects B, activates C, and recovers C over A", async () => {
    await runOrderedInvalidCandidate((store) => {
      void store;
      const rejected = verifyBundleStoreEntry(
        {
          revision: fixtures.candidateBundle.revision,
          bytes: canonicalizeJsonBytes(fixtures.candidateBundle),
        },
        { status: "available", sourceBytes: fixtures.sourceDigestMismatchBytes },
      );
      expect(rejected).toMatchObject({ status: "rejected", stage: "source-digest" });
      expect(rejected).not.toHaveProperty("authority");
    });
  });

  it("[ordered-package-missing] preserves A, rejects B, activates C, and recovers C over A", async () => {
    await runOrderedInvalidCandidate(async (store) => {
      const integrity = await integrityFromStore(store, fixtures.candidateBundle.revision);
      const rejected = preflightBundlePackages(integrity, []);
      expect(rejected).toMatchObject({ status: "rejected", stage: "package-resolution" });
      expect(rejected).not.toHaveProperty("authority");
    });
  });

  it("[ordered-package-digest-mismatch] preserves A, rejects B, activates C, and recovers C over A", async () => {
    await runOrderedInvalidCandidate(async (store) => {
      const integrity = await integrityFromStore(store, fixtures.candidateBundle.revision);
      const rejected = preflightBundlePackages(integrity, [
        installedCandidate(fixtures, changedArtifacts()),
      ]);
      expect(rejected).toMatchObject({ status: "rejected", stage: "package-digest" });
      expect(rejected).not.toHaveProperty("authority");
    });
  });

  it("[ordered-reference-capability] preserves A, rejects B, activates C, and recovers C over A", async () => {
    await runOrderedInvalidCandidate(async (store) => {
      const packages = await packageAuthorityFromStore(store, fixtures.referenceInvalidBundle);
      const rejected = preflightBundleReferences(packages);
      expect(rejected).toMatchObject({
        status: "rejected",
        stage: "surface-capability-references",
      });
      expect(rejected).not.toHaveProperty("authority");
    });
  });

  it("[ordered-reference-limit] preserves A, rejects B, activates C, and recovers C over A", async () => {
    await runOrderedInvalidCandidate(async (store) => {
      const packages = await packageAuthorityFromStore(store, fixtures.referenceLimitBundle);
      const rejected = preflightBundleReferences(packages);
      expect(rejected).toMatchObject({ status: "rejected", stage: "activation-limits" });
      expect(rejected).not.toHaveProperty("authority");
    });
  });

  it("[ordered-staging-contract] preserves A, rejects B, activates C, and recovers C over A", async () => {
    await runOrderedInvalidCandidate(async (store) => {
      const packages = await packageAuthorityFromStore(store, fixtures.stagingInvalidBundle);
      expect(preflightBundleReferences(packages).status).toBe("preflighted");
      const rejected = stageBundleRuntime(packages);
      expect(rejected).toMatchObject({ status: "rejected", stage: "execution-contracts" });
      expect(rejected).not.toHaveProperty("authority");
    });
  });

  it("[same-candidate-race] commits one winner, fences one loser, and requires fresh staging", async () => {
    await runConcurrentCandidateRace(fixtures.candidateBundle, fixtures.candidateBundle);
  });

  it("[different-candidate-race] commits one winner, fences one loser, and preserves exact lineage", async () => {
    await runConcurrentCandidateRace(fixtures.candidateBundle, alternateCandidate);
  });

  it("[recovery-activation-race] rejects stale reconstruction after a concurrent durable winner", async () => {
    const root = await temporaryRoot();
    const baseline = await activateBaseline(fixtures, root, [fixtures.candidateBundle]);
    trackActivation(baseline.activation);
    baseline.activation.close();

    const winner = await recoverExact(root, fixtures.activeBundle, null);
    const pending = deferred<Awaited<ReturnType<BundleStore["getBundle"]>>>();
    let delayedReads = 0;
    const delayedStore: BundleStore = Object.freeze({
      getBundle: (revision: string) => {
        if (revision === fixtures.activeBundle.revision && delayedReads === 0) {
          delayedReads += 1;
          return pending.promise;
        }
        return baseline.store.getBundle(revision);
      },
      putBundle: (entry: BundleStoreEntry) => baseline.store.putBundle(entry),
    });
    const staleRecovery = trackActivation(
      createBundleRuntimeActivationInternal({
        bundleStore: delayedStore,
        repository: openRuntimeActivationSqliteRepository(
          join(root, RUNTIME_ACTIVATION_DATABASE_FILE_NAME),
        ),
      }),
    );
    const running = staleRecovery.recover(
      packageAuthorityFor(fixtures, fixtures.activeBundle),
      null,
    );
    expect(delayedReads).toBe(1);

    const candidate = activationPairFor(fixtures, fixtures.candidateBundle);
    const committedAuthority = requireActivated(
      await winner.activate(candidate.referenceAuthority, candidate.stagingAuthority, 0),
    );
    const committed = expectedSuccessor(
      fixtures.candidateBundle.revision,
      fixtures.activeBundle.revision,
    );
    expect(committedAuthority).toMatchObject(committed);
    const activeRead = await baseline.store.getBundle(fixtures.activeBundle.revision);
    pending.resolve(activeRead);

    const staleResult = await running;
    expect(staleResult).toEqual({ status: "recovery-required", record: committed });
    expect(staleResult).not.toHaveProperty("authority");
    expect(staleRecovery.readState()).toEqual({
      status: "recovery-required",
      record: committed,
    });
    expect(readDurableRecord(root)).toEqual(committed);

    winner.close();
    staleRecovery.close();
    await recoverExact(root, fixtures.candidateBundle, fixtures.activeBundle);
  });

  it("[activation-recovery-race] revokes recovered A after a delayed C commit wins", async () => {
    const root = await temporaryRoot();
    const baseline = await activateBaseline(fixtures, root, [fixtures.candidateBundle]);
    trackActivation(baseline.activation);
    baseline.activation.close();

    const pending = deferred<Awaited<ReturnType<BundleStore["getBundle"]>>>();
    let delayCandidate = false;
    let delayedReads = 0;
    const delayedStore: BundleStore = Object.freeze({
      getBundle: (revision: string) => {
        if (
          delayCandidate &&
          revision === fixtures.candidateBundle.revision &&
          delayedReads === 0
        ) {
          delayedReads += 1;
          return pending.promise;
        }
        return baseline.store.getBundle(revision);
      },
      putBundle: (entry: BundleStoreEntry) => baseline.store.putBundle(entry),
    });
    const candidateController = trackActivation(
      createBundleRuntimeActivationInternal({
        bundleStore: delayedStore,
        repository: openRuntimeActivationSqliteRepository(
          join(root, RUNTIME_ACTIVATION_DATABASE_FILE_NAME),
        ),
      }),
    );
    await recoverControllerExact(candidateController, fixtures.activeBundle, null);
    delayCandidate = true;
    const candidate = activationPairFor(fixtures, fixtures.candidateBundle);
    const running = candidateController.activate(
      candidate.referenceAuthority,
      candidate.stagingAuthority,
      0,
    );
    expect(delayedReads).toBe(1);

    const recoveredController = trackActivation(
      await openBundleRuntimeActivation({ rootDirectory: root }),
    );
    const recoveredA = await recoverControllerExact(
      recoveredController,
      fixtures.activeBundle,
      null,
    );
    expect(readBundleRuntimeActivationAuthority(recoveredA)).toBeDefined();

    pending.resolve(await baseline.store.getBundle(fixtures.candidateBundle.revision));
    const committedAuthority = requireActivated(await running);
    const committed = expectedSuccessor(
      fixtures.candidateBundle.revision,
      fixtures.activeBundle.revision,
    );
    expect(committedAuthority).toMatchObject(committed);
    expect(readDurableRecord(root)).toEqual(committed);
    expect(recoveredController.readState()).toEqual({
      status: "recovery-required",
      record: committed,
    });
    expect(readBundleRuntimeActivationAuthority(recoveredA)).toBeUndefined();

    candidateController.close();
    recoveredController.close();
    await recoverExact(root, fixtures.candidateBundle, fixtures.activeBundle);
  });

  it("[restart-stale-reconstruction] publishes only the exact durable winner after restart", async () => {
    const root = await temporaryRoot();
    const baseline = await activateBaseline(fixtures, root, [fixtures.candidateBundle]);
    trackActivation(baseline.activation);
    const candidate = activationPairFor(fixtures, fixtures.candidateBundle);
    const committed = requireActivated(
      await baseline.activation.activate(
        candidate.referenceAuthority,
        candidate.stagingAuthority,
        0,
      ),
    );
    baseline.activation.close();

    const restarted = trackActivation(await openBundleRuntimeActivation({ rootDirectory: root }));
    const rejected = await restarted.recover(
      packageAuthorityFor(fixtures, fixtures.activeBundle),
      packageAuthorityFor(fixtures, fixtures.candidateBundle),
    );
    expect(rejected).toMatchObject({
      status: "rejected",
      role: "active",
      stage: "package-authority",
    });
    expect(rejected).not.toHaveProperty("authority");
    expect(restarted.readState()).toEqual({
      status: "recovery-required",
      record: {
        activeRevision: committed.activeRevision,
        previousGoodRevision: committed.previousGoodRevision,
        generation: committed.generation,
      },
    });

    const recovered = await restarted.recover(
      packageAuthorityFor(fixtures, fixtures.candidateBundle),
      packageAuthorityFor(fixtures, fixtures.activeBundle),
    );
    expect(recovered.status).toBe("recovered");
    if (recovered.status !== "recovered") throw new TypeError("Expected durable winner recovery.");
    expect(restarted.readState()).toEqual({ status: "active", authority: recovered.authority });
  });

  it("[journal-mode-external-transition] rejects a live external journal transition and continues safely", async () => {
    const root = await temporaryRoot();
    const baseline = await activateBaseline(fixtures, root, [fixtures.candidateBundle]);
    trackActivation(baseline.activation);
    const external = new Database(join(root, RUNTIME_ACTIVATION_DATABASE_FILE_NAME), {
      fileMustExist: true,
    });
    try {
      let changed = false;
      try {
        changed = external.pragma("journal_mode = DELETE", { simple: true }) === "delete";
      } catch (error) {
        expect(error).toMatchObject({ code: expect.stringMatching(/^SQLITE_(?:BUSY|LOCKED)/u) });
      }
      expect(changed).toBe(false);
      expect(external.pragma("journal_mode", { simple: true })).toBe("wal");
    } finally {
      external.close();
    }
    expect(readDurableRecord(root)).toEqual(baseline.record);

    const candidate = activationPairFor(fixtures, fixtures.candidateBundle);
    const committed = requireActivated(
      await baseline.activation.activate(
        candidate.referenceAuthority,
        candidate.stagingAuthority,
        0,
      ),
    );
    expect(committed).toMatchObject(
      expectedSuccessor(fixtures.candidateBundle.revision, fixtures.activeBundle.revision),
    );
  });

  it("[journal-mode-writer-reauthentication] fails closed on transaction-time profile drift", async () => {
    const root = await temporaryRoot();
    const baseline = await activateBaseline(fixtures, root, [fixtures.candidateBundle]);
    trackActivation(baseline.activation);
    const candidate = activationPairFor(fixtures, fixtures.candidateBundle);
    const prototype = Database.prototype;
    const originalPragma = prototype.pragma;
    let journalReads = 0;
    let observedWriterLock = false;
    let observedPreDmlRecord = false;
    prototype.pragma = function patchedPragma(
      this: Database.Database,
      source: string,
      ...options: unknown[]
    ): unknown {
      if (source === "journal_mode" && journalReads === 0) {
        journalReads += 1;
        // The failure must be observed only after BEGIN IMMEDIATE owns the writer lock and before
        // any candidate DML changes the durable row. These assertions mutation-protect that order
        // without exposing a production-only hook.
        observedWriterLock = this.inTransaction;
        expect(observedWriterLock).toBe(true);
        const durableBeforeDml = this.prepare(
          "SELECT active_revision AS activeRevision, previous_good_revision AS previousGoodRevision, generation FROM runtime_activation WHERE singleton = 1",
        ).get() as RuntimeActivationRecord | undefined;
        observedPreDmlRecord = durableBeforeDml !== undefined;
        expect(durableBeforeDml).toEqual(baseline.record);
        return "delete";
      }
      return Reflect.apply(originalPragma, this, [source, ...options]);
    } as typeof prototype.pragma;
    try {
      await expect(
        baseline.activation.activate(candidate.referenceAuthority, candidate.stagingAuthority, 0),
      ).rejects.toMatchObject({ code: "ACTIVATION_CORRUPT" });
    } finally {
      prototype.pragma = originalPragma;
    }
    expect(journalReads).toBe(1);
    expect(observedWriterLock).toBe(true);
    expect(observedPreDmlRecord).toBe(true);
    expect(readBundleRuntimeStagingAuthority(candidate.stagingAuthority)).toBeUndefined();
    expect(readDurableRecord(root)).toEqual(baseline.record);
    expect(baseline.activation.readState()).toEqual({
      status: "active",
      authority: baseline.authority,
    });

    const fresh = activationPairFor(fixtures, fixtures.candidateBundle);
    const committed = requireActivated(
      await baseline.activation.activate(fresh.referenceAuthority, fresh.stagingAuthority, 0),
    );
    expect(committed).toMatchObject(
      expectedSuccessor(fixtures.candidateBundle.revision, fixtures.activeBundle.revision),
    );
  });

  it("keeps the exact transition-case inventory closed and duplicate-free", () => {
    expect(TRANSITION_CASE_IDS).toEqual([
      "ordered-unsupported-protocol",
      "ordered-revision-mismatch",
      "ordered-source-digest-mismatch",
      "ordered-package-missing",
      "ordered-package-digest-mismatch",
      "ordered-reference-capability",
      "ordered-reference-limit",
      "ordered-staging-contract",
      "same-candidate-race",
      "different-candidate-race",
      "recovery-activation-race",
      "activation-recovery-race",
      "restart-stale-reconstruction",
      "journal-mode-external-transition",
      "journal-mode-writer-reauthentication",
    ]);
    expect(new Set(TRANSITION_CASE_IDS).size).toBe(TRANSITION_CASE_IDS.length);
  });
});
