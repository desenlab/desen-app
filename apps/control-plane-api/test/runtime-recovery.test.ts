import { mkdtemp, readFile, readdir, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { calculateDesenBundleRevision, canonicalizeJsonBytes } from "@desen/protocol";
import Database from "better-sqlite3";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE,
  RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE,
  RuntimeActivationError,
  openBundleRuntimeActivation,
  openBundleStore,
  preflightBundlePackages,
  preflightBundleReferences,
  stageBundleRuntime,
  verifyBundleStoreEntry,
} from "../src/index.js";
import { RuntimeActivationStorageError } from "../src/runtime-activation-repository-internal.js";
import {
  createBundleRuntimeActivationInternal,
  readBundleRuntimeActivationAuthority,
} from "../src/runtime-activation-internal.js";
import { openRuntimeActivationSqliteRepository } from "../src/runtime-activation-sqlite-internal.js";
import { readBundleRuntimeStagingAuthority } from "../src/runtime-staging-internal.js";

import type { DesenBundle, DesenCatalog } from "@desen/protocol";
import type {
  BundlePackagePreflightAuthority,
  BundleRuntimeActivationAuthority,
  BundleRuntimeActivationResult,
  BundleStore,
  BundleStoreEntry,
  InstalledPackageArtifact,
  RuntimeActivationRecord,
} from "../src/index.js";
import type { RuntimeActivationRepository } from "../src/runtime-activation-repository-internal.js";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");
const BUNDLE_PATH = join(WORKSPACE_ROOT, "examples/sign-in/official-derived.bundle.desen.json");
const CATALOG_PATH = join(WORKSPACE_ROOT, "packages/reference-catalog-web/catalog.json");
const DISTRIBUTION_ROOT = join(WORKSPACE_ROOT, "packages/reference-catalog-web/dist");
const EXPECTED_REVISION = "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb";

let officialBundle: DesenBundle;
let variantBundle: DesenBundle;
let officialCatalog: DesenCatalog;
let officialArtifacts: readonly InstalledPackageArtifact[];
let temporaryRoots: string[] = [];

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

async function distributionArtifacts(): Promise<readonly InstalledPackageArtifact[]> {
  const paths: string[] = [];
  async function visit(directory: string, prefix: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) paths.push(relative);
      else throw new TypeError("The package fixture must contain only regular files.");
    }
  }
  await visit(DISTRIBUTION_ROOT, "");
  return Object.freeze(
    await Promise.all(
      paths.map(async (artifactPath) =>
        Object.freeze({
          path: `dist/${artifactPath}`,
          bytes: new Uint8Array(await readFile(join(DISTRIBUTION_ROOT, artifactPath))),
        }),
      ),
    ),
  );
}

function packageAuthorityFor(bundle: DesenBundle): BundlePackagePreflightAuthority {
  const integrity = verifyBundleStoreEntry(
    { revision: bundle.revision, bytes: canonicalizeJsonBytes(bundle) },
    { status: "not-available" },
  );
  if (integrity.status !== "verified") throw new TypeError("Expected integrity authority.");
  const packages = preflightBundlePackages(integrity.authority, [
    {
      id: officialCatalog.id,
      version: officialCatalog.version,
      target: officialCatalog.target,
      catalog: officialCatalog,
      artifacts: officialArtifacts,
    },
  ]);
  if (packages.status !== "preflighted") throw new TypeError("Expected package authority.");
  return packages.authority;
}

function activationPair(bundle: DesenBundle = officialBundle) {
  const packageAuthority = packageAuthorityFor(bundle);
  const reference = preflightBundleReferences(packageAuthority);
  const staging = stageBundleRuntime(packageAuthority);
  if (reference.status !== "preflighted" || staging.status !== "staged") {
    throw new TypeError("Expected one exact T04/T06 activation pair.");
  }
  return Object.freeze({ reference: reference.authority, staging: staging.authority });
}

function requireActivated(result: BundleRuntimeActivationResult): BundleRuntimeActivationAuthority {
  expect(result.status).toBe("activated");
  if (result.status !== "activated") throw new TypeError("Expected activation success.");
  return result.authority;
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

async function temporaryRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "desen-runtime-recovery-")));
  temporaryRoots.push(root);
  return root;
}

async function storedRoot(...bundles: DesenBundle[]): Promise<string> {
  const root = await temporaryRoot();
  const store = await openBundleStore({ rootDirectory: root });
  for (const bundle of bundles) {
    expect(
      await store.putBundle({ revision: bundle.revision, bytes: canonicalizeJsonBytes(bundle) }),
    ).toEqual({ status: "stored" });
  }
  return root;
}

function bundleFilePath(root: string, revision: string): string {
  const digest = revision.slice("sha256:".length);
  return join(root, "bundles", "sha256", digest.slice(0, 2), `${digest.slice(2)}.bundle`);
}

function durableRecord(root: string): RuntimeActivationRecord | null {
  const repository = openRuntimeActivationSqliteRepository(
    join(root, "runtime-activation.sqlite3"),
  );
  try {
    const read = repository.get();
    return read.status === "missing" ? null : read.record;
  } finally {
    repository.close();
  }
}

function rawDurableRecord(root: string): RuntimeActivationRecord | null {
  const database = new Database(join(root, "runtime-activation.sqlite3"));
  try {
    const row = database
      .prepare(
        "SELECT active_revision AS activeRevision, previous_good_revision AS previousGoodRevision, generation FROM runtime_activation WHERE singleton = 1",
      )
      .get() as RuntimeActivationRecord | undefined;
    return row ?? null;
  } finally {
    database.close();
  }
}

async function commitOfficialThenVariant(root: string): Promise<void> {
  const activation = await openBundleRuntimeActivation({ rootDirectory: root });
  const official = activationPair();
  requireActivated(await activation.activate(official.reference, official.staging, null));
  const variant = activationPair(variantBundle);
  requireActivated(await activation.activate(variant.reference, variant.staging, 0));
  activation.close();
}

beforeAll(async () => {
  const [bundleText, catalogText, artifacts] = await Promise.all([
    readFile(BUNDLE_PATH, "utf8"),
    readFile(CATALOG_PATH, "utf8"),
    distributionArtifacts(),
  ]);
  officialBundle = JSON.parse(bundleText) as DesenBundle;
  officialCatalog = JSON.parse(catalogText) as DesenCatalog;
  officialArtifacts = artifacts;
  variantBundle = cloneJson(officialBundle);
  const title = variantBundle.surfaces["sign-in"]?.root.slots?.["default"]?.find(
    ({ id }) => id === "sign-in.title",
  );
  if (title?.props === undefined) throw new TypeError("Expected sign-in title fixture.");
  title.props = { ...title.props, text: "Welcome back" };
  variantBundle.revision = calculateDesenBundleRevision(variantBundle);
  expect(officialBundle.revision).toBe(EXPECTED_REVISION);
  expect(variantBundle.revision).not.toBe(EXPECTED_REVISION);
});

afterEach(async () => {
  const roots = temporaryRoots;
  temporaryRoots = [];
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("M07-T08 restart recovery", () => {
  it("rebuilds generation-zero authority without changing the durable record", async () => {
    const root = await storedRoot(officialBundle);
    const first = await openBundleRuntimeActivation({ rootDirectory: root });
    const pair = activationPair();
    const formerAuthority = requireActivated(
      await first.activate(pair.reference, pair.staging, null),
    );
    const before = durableRecord(root);
    first.close();
    expect(readBundleRuntimeActivationAuthority(formerAuthority)).toBeUndefined();

    const restarted = await openBundleRuntimeActivation({ rootDirectory: root });
    expect(restarted.readState()).toEqual({ status: "recovery-required", record: before });
    const recovered = await restarted.recover(packageAuthorityFor(officialBundle), null);

    expect(recovered.status).toBe("recovered");
    if (recovered.status !== "recovered") throw new TypeError("Expected recovery success.");
    expect(recovered.authority).toEqual({
      profile: "desen.runtime-activation",
      profileVersion: 1,
      protocolVersion: "0.1.0",
      documentId: "com.example.account-app",
      entrySurfaceId: "sign-in",
      activeRevision: officialBundle.revision,
      previousGoodRevision: null,
      generation: 0,
    });
    expect(Object.isFrozen(recovered.authority)).toBe(true);
    expect(
      readBundleRuntimeActivationAuthority(recovered.authority)?.previousGoodRecord,
    ).toBeNull();
    expect(restarted.readState()).toEqual({ status: "active", authority: recovered.authority });
    expect(durableRecord(root)).toEqual(before);
    await expect(restarted.recover(packageAuthorityFor(officialBundle), null)).resolves.toEqual({
      status: "not-required",
      state: "active",
    });
    restarted.close();
    expect(readBundleRuntimeActivationAuthority(recovered.authority)).toBeUndefined();
  });

  it("revalidates both lineages and uses the recovered record as the next CAS baseline", async () => {
    const root = await storedRoot(officialBundle, variantBundle);
    await commitOfficialThenVariant(root);
    const before = durableRecord(root);
    const restarted = await openBundleRuntimeActivation({ rootDirectory: root });

    const recovered = await restarted.recover(
      packageAuthorityFor(variantBundle),
      packageAuthorityFor(officialBundle),
    );

    expect(recovered.status).toBe("recovered");
    if (recovered.status !== "recovered") throw new TypeError("Expected recovery success.");
    expect(recovered.authority).toMatchObject({
      activeRevision: variantBundle.revision,
      previousGoodRevision: officialBundle.revision,
      generation: 1,
    });
    expect(
      readBundleRuntimeActivationAuthority(recovered.authority)?.previousGoodRecord?.stagingRecord
        .packageRecord.integrityRecord.revision,
    ).toBe(officialBundle.revision);
    expect(durableRecord(root)).toEqual(before);

    const repeated = activationPair(variantBundle);
    const repeatedAuthority = requireActivated(
      await restarted.activate(repeated.reference, repeated.staging, 1),
    );
    expect(repeatedAuthority).toMatchObject({
      activeRevision: variantBundle.revision,
      previousGoodRevision: officialBundle.revision,
      generation: 2,
    });
    expect(
      readBundleRuntimeActivationAuthority(repeatedAuthority)?.previousGoodRecord?.stagingRecord
        .packageRecord.integrityRecord.revision,
    ).toBe(officialBundle.revision);
    expect(readBundleRuntimeActivationAuthority(recovered.authority)).toBeUndefined();

    const next = activationPair(officialBundle);
    const nextAuthority = requireActivated(
      await restarted.activate(next.reference, next.staging, 2),
    );
    expect(nextAuthority).toMatchObject({
      activeRevision: officialBundle.revision,
      previousGoodRevision: variantBundle.revision,
      generation: 3,
    });
    expect(
      readBundleRuntimeActivationAuthority(nextAuthority)?.previousGoodRecord?.stagingRecord
        .packageRecord.integrityRecord.revision,
    ).toBe(variantBundle.revision);
    expect(readBundleRuntimeActivationAuthority(repeatedAuthority)).toBeUndefined();
    restarted.close();
  });

  it("rejects mismatched, missing, cloned, and proxied package authorities without publication", async () => {
    const root = await storedRoot(officialBundle, variantBundle);
    const first = await openBundleRuntimeActivation({ rootDirectory: root });
    const pair = activationPair();
    requireActivated(await first.activate(pair.reference, pair.staging, null));
    first.close();
    const expectedRecord = durableRecord(root);
    const restarted = await openBundleRuntimeActivation({ rootDirectory: root });
    const valid = packageAuthorityFor(officialBundle);
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("Recovery must authenticate authority by identity.");
        },
      },
    );

    for (const authority of [packageAuthorityFor(variantBundle), { ...valid }, proxy]) {
      await expect(restarted.recover(authority as never, null)).resolves.toMatchObject({
        status: "rejected",
        role: "active",
        stage: "package-authority",
        diagnostics: [{ code: INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE }],
      });
      expect(restarted.readState()).toEqual({
        status: "recovery-required",
        record: expectedRecord,
      });
      expect(durableRecord(root)).toEqual(expectedRecord);
    }
    await expect(
      restarted.recover(valid, packageAuthorityFor(variantBundle)),
    ).resolves.toMatchObject({
      status: "rejected",
      role: "previous-good",
      stage: "package-authority",
      diagnostics: [{ code: INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE }],
    });
    restarted.close();

    const previousRoot = await storedRoot(officialBundle, variantBundle);
    await commitOfficialThenVariant(previousRoot);
    const previousRecord = durableRecord(previousRoot);
    const previousRestart = await openBundleRuntimeActivation({ rootDirectory: previousRoot });
    await expect(
      previousRestart.recover(packageAuthorityFor(variantBundle), null),
    ).resolves.toMatchObject({
      status: "rejected",
      role: "previous-good",
      stage: "package-authority",
      diagnostics: [{ code: INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE }],
    });
    await expect(
      previousRestart.recover(
        packageAuthorityFor(variantBundle),
        packageAuthorityFor(variantBundle),
      ),
    ).resolves.toMatchObject({
      status: "rejected",
      role: "previous-good",
      stage: "package-authority",
      diagnostics: [{ code: INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE }],
    });
    expect(previousRestart.readState()).toEqual({
      status: "recovery-required",
      record: previousRecord,
    });
    expect(durableRecord(previousRoot)).toEqual(previousRecord);
    previousRestart.close();
  });

  it("publishes neither active nor fallback authority when either durable Bundle is missing", async () => {
    const previousRoot = await storedRoot(officialBundle, variantBundle);
    await commitOfficialThenVariant(previousRoot);
    const previousRecord = durableRecord(previousRoot);
    await rm(bundleFilePath(previousRoot, officialBundle.revision));
    const previousRestart = await openBundleRuntimeActivation({ rootDirectory: previousRoot });

    await expect(
      previousRestart.recover(
        packageAuthorityFor(variantBundle),
        packageAuthorityFor(officialBundle),
      ),
    ).resolves.toMatchObject({
      status: "rejected",
      role: "previous-good",
      stage: "bundle-reclosure",
      diagnostics: [{ code: RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE }],
    });
    expect(previousRestart.readState()).toEqual({
      status: "recovery-required",
      record: previousRecord,
    });
    expect(durableRecord(previousRoot)).toEqual(previousRecord);
    previousRestart.close();

    const activeRoot = await storedRoot(officialBundle, variantBundle);
    await commitOfficialThenVariant(activeRoot);
    const activeRecord = durableRecord(activeRoot);
    await rm(bundleFilePath(activeRoot, variantBundle.revision));
    const activeRestart = await openBundleRuntimeActivation({ rootDirectory: activeRoot });
    await expect(
      activeRestart.recover(
        packageAuthorityFor(variantBundle),
        packageAuthorityFor(officialBundle),
      ),
    ).resolves.toMatchObject({
      status: "rejected",
      role: "active",
      stage: "bundle-reclosure",
      diagnostics: [{ code: RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE }],
    });
    expect(activeRestart.readState()).toEqual({
      status: "recovery-required",
      record: activeRecord,
    });
    expect(durableRecord(activeRoot)).toEqual(activeRecord);
    activeRestart.close();
  });

  it("fails closed on an unsafe previous-good Bundle path instead of using active alone", async () => {
    const root = await storedRoot(officialBundle, variantBundle);
    await commitOfficialThenVariant(root);
    const expectedRecord = durableRecord(root);
    const previousPath = bundleFilePath(root, officialBundle.revision);
    await rm(previousPath);
    await symlink(bundleFilePath(root, variantBundle.revision), previousPath);
    const restarted = await openBundleRuntimeActivation({ rootDirectory: root });

    const attempt = restarted.recover(
      packageAuthorityFor(variantBundle),
      packageAuthorityFor(officialBundle),
    );
    await expect(attempt).rejects.toBeInstanceOf(RuntimeActivationError);
    await expect(attempt).rejects.toMatchObject({ code: "UNSAFE_STORAGE_PATH" });
    expect(restarted.readState()).toEqual({ status: "recovery-required", record: expectedRecord });
    expect(durableRecord(root)).toEqual(expectedRecord);
    restarted.close();
  });

  it("recovers the durable winner after a post-COMMIT observation failure", async () => {
    const root = await storedRoot(officialBundle);
    const databasePath = join(root, "runtime-activation.sqlite3");
    const repository = openRuntimeActivationSqliteRepository(databasePath, {
      afterCommit: () => {
        throw new Error("synthetic post-COMMIT observation fault");
      },
    });
    const activation = createBundleRuntimeActivationInternal({
      bundleStore: await openBundleStore({ rootDirectory: root }),
      repository,
    });
    const pair = activationPair();

    expect(await activation.activate(pair.reference, pair.staging, null)).toEqual({
      status: "recovery-required",
    });
    expect(activation.readState()).toEqual({ status: "recovery-required", record: null });
    const untrustedInput = new Proxy(
      {},
      {
        get: () => {
          throw new Error("An indeterminate recovery record must not inspect caller input.");
        },
        getPrototypeOf: () => {
          throw new Error("An indeterminate recovery record must not inspect caller input.");
        },
        ownKeys: () => {
          throw new Error("An indeterminate recovery record must not inspect caller input.");
        },
      },
    );
    await expect(
      activation.recover(untrustedInput as never, untrustedInput as never),
    ).resolves.toEqual({
      status: "recovery-required",
      record: null,
    });
    activation.close();
    expect(durableRecord(root)).toEqual({
      activeRevision: officialBundle.revision,
      previousGoodRevision: null,
      generation: 0,
    });

    const restarted = await openBundleRuntimeActivation({ rootDirectory: root });
    const recovered = await restarted.recover(packageAuthorityFor(officialBundle), null);
    expect(recovered.status).toBe("recovered");
    if (recovered.status !== "recovered") throw new TypeError("Expected recovery success.");
    expect(recovered.authority).toMatchObject({
      activeRevision: officialBundle.revision,
      previousGoodRevision: null,
      generation: 0,
    });
    restarted.close();
  });

  it("reauthenticates all three fields plus deletion after asynchronous Bundle reads", async () => {
    const initialRecord = Object.freeze({
      activeRevision: officialBundle.revision,
      previousGoodRevision: null,
      generation: 1,
    });
    for (const rewrittenRecord of [
      Object.freeze({
        activeRevision: variantBundle.revision,
        previousGoodRevision: null,
        generation: 1,
      }),
      Object.freeze({
        activeRevision: officialBundle.revision,
        previousGoodRevision: variantBundle.revision,
        generation: 1,
      }),
      Object.freeze({
        activeRevision: officialBundle.revision,
        previousGoodRevision: null,
        generation: 2,
      }),
      null,
    ] satisfies readonly (RuntimeActivationRecord | null)[]) {
      let current: RuntimeActivationRecord | null = initialRecord;
      let commitCalls = 0;
      const pending =
        deferred<Readonly<{ readonly status: "found"; readonly entry: BundleStoreEntry }>>();
      const repository: RuntimeActivationRepository = Object.freeze({
        get: () =>
          current === null
            ? Object.freeze({ status: "missing" as const })
            : Object.freeze({ status: "found" as const, record: current }),
        commit: () => {
          commitCalls += 1;
          return Object.freeze({ status: "recovery-required" as const });
        },
        close: () => undefined,
      });
      const store: BundleStore = Object.freeze({
        getBundle: () => pending.promise,
        putBundle: async () => Object.freeze({ status: "conflict" as const }),
      });
      const activation = createBundleRuntimeActivationInternal({ bundleStore: store, repository });
      const running = activation.recover(packageAuthorityFor(officialBundle), null);

      current = rewrittenRecord;
      pending.resolve(
        Object.freeze({
          status: "found",
          entry: Object.freeze({
            revision: officialBundle.revision,
            bytes: canonicalizeJsonBytes(officialBundle),
          }),
        }),
      );

      await expect(running).resolves.toEqual({
        status: "recovery-required",
        record: rewrittenRecord,
      });
      expect(activation.readState()).toEqual({
        status: "recovery-required",
        record: rewrittenRecord,
      });
      expect(commitCalls).toBe(0);
      activation.close();
    }
  });

  it("does not begin previous-good store I/O after close while active reclosure is pending", async () => {
    const record = Object.freeze({
      activeRevision: variantBundle.revision,
      previousGoodRevision: officialBundle.revision,
      generation: 1,
    });
    const activePending =
      deferred<Readonly<{ readonly status: "found"; readonly entry: BundleStoreEntry }>>();
    const storeReads: string[] = [];
    let closeCalls = 0;
    const repository: RuntimeActivationRepository = Object.freeze({
      get: () => Object.freeze({ status: "found" as const, record }),
      commit: () => Object.freeze({ status: "recovery-required" as const }),
      close: () => {
        closeCalls += 1;
        throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
      },
    });
    const store: BundleStore = Object.freeze({
      getBundle: (revision: string) => {
        storeReads.push(revision);
        if (revision === variantBundle.revision) return activePending.promise;
        return Promise.resolve(
          Object.freeze({
            status: "found" as const,
            entry: Object.freeze({
              revision: officialBundle.revision,
              bytes: canonicalizeJsonBytes(officialBundle),
            }),
          }),
        );
      },
      putBundle: async () => Object.freeze({ status: "conflict" as const }),
    });
    const activation = createBundleRuntimeActivationInternal({ bundleStore: store, repository });
    const running = activation.recover(
      packageAuthorityFor(variantBundle),
      packageAuthorityFor(officialBundle),
    );
    expect(storeReads).toEqual([variantBundle.revision]);

    expect(() => activation.close()).toThrowError(
      expect.objectContaining({ code: "STORAGE_IO_FAILURE" }),
    );
    activePending.resolve(
      Object.freeze({
        status: "found",
        entry: Object.freeze({
          revision: variantBundle.revision,
          bytes: canonicalizeJsonBytes(variantBundle),
        }),
      }),
    );

    await expect(running).rejects.toMatchObject({ code: "ACTIVATION_CLOSED" });
    expect(storeReads).toEqual([variantBundle.revision]);
    expect(() => activation.readState()).toThrowError(
      expect.objectContaining({ code: "ACTIVATION_CLOSED" }),
    );
    expect(() => activation.close()).not.toThrow();
    expect(closeCalls).toBe(1);
  });

  it("preserves durable state when active T04 or previous-good T06 reconstruction rejects", async () => {
    const unknownComponentBundle = cloneJson(officialBundle);
    const unknownRoot = unknownComponentBundle.surfaces["sign-in"]?.root;
    if (unknownRoot === undefined) throw new TypeError("Expected official sign-in root.");
    unknownRoot.use = "com.example.ui/Unknown";
    unknownComponentBundle.revision = calculateDesenBundleRevision(unknownComponentBundle);

    const unknownRootDirectory = await storedRoot(unknownComponentBundle);
    const unknownRepository = openRuntimeActivationSqliteRepository(
      join(unknownRootDirectory, "runtime-activation.sqlite3"),
    );
    expect(unknownRepository.commit(null, null, unknownComponentBundle.revision)).toMatchObject({
      status: "activated",
    });
    unknownRepository.close();
    const unknownRecord = durableRecord(unknownRootDirectory);
    const unknownRecovery = await openBundleRuntimeActivation({
      rootDirectory: unknownRootDirectory,
    });

    const activeRejected = await unknownRecovery.recover(
      packageAuthorityFor(unknownComponentBundle),
      null,
    );

    expect(activeRejected).toMatchObject({
      status: "rejected",
      role: "active",
      stage: "reference-preflight",
    });
    expect(activeRejected).not.toHaveProperty("authority");
    expect(unknownRecovery.readState()).toEqual({
      status: "recovery-required",
      record: unknownRecord,
    });
    expect(durableRecord(unknownRootDirectory)).toEqual(unknownRecord);
    unknownRecovery.close();

    const invalidPropsBundle = cloneJson(officialBundle);
    const invalidPropsChildren = invalidPropsBundle.surfaces["sign-in"]?.root.slots?.["default"];
    const invalidText = invalidPropsChildren?.find((node) => node.use === "com.example.ui/Text");
    if (invalidText === undefined) throw new TypeError("Expected official Text node.");
    invalidText.props = { text: 42 };
    invalidPropsBundle.revision = calculateDesenBundleRevision(invalidPropsBundle);

    const invalidPropsRoot = await storedRoot(officialBundle, invalidPropsBundle);
    const invalidPropsRepository = openRuntimeActivationSqliteRepository(
      join(invalidPropsRoot, "runtime-activation.sqlite3"),
    );
    const previousCommit = invalidPropsRepository.commit(null, null, invalidPropsBundle.revision);
    expect(previousCommit.status).toBe("activated");
    if (previousCommit.status !== "activated") {
      throw new TypeError("Expected controlled previous-good commit.");
    }
    expect(
      invalidPropsRepository.commit(0, previousCommit.record, officialBundle.revision),
    ).toMatchObject({ status: "activated" });
    invalidPropsRepository.close();
    const invalidPropsRecord = durableRecord(invalidPropsRoot);
    const invalidPropsRecovery = await openBundleRuntimeActivation({
      rootDirectory: invalidPropsRoot,
    });

    const previousGoodRejected = await invalidPropsRecovery.recover(
      packageAuthorityFor(officialBundle),
      packageAuthorityFor(invalidPropsBundle),
    );

    expect(previousGoodRejected).toMatchObject({
      status: "rejected",
      role: "previous-good",
      stage: "runtime-staging",
    });
    expect(previousGoodRejected).not.toHaveProperty("authority");
    expect(invalidPropsRecovery.readState()).toEqual({
      status: "recovery-required",
      record: invalidPropsRecord,
    });
    expect(durableRecord(invalidPropsRoot)).toEqual(invalidPropsRecord);
    invalidPropsRecovery.close();
  });

  it("restores the safe-integer ceiling without wrapping or resetting generation", async () => {
    const root = await storedRoot(officialBundle, variantBundle);
    const databasePath = join(root, "runtime-activation.sqlite3");
    const repository = openRuntimeActivationSqliteRepository(databasePath);
    expect(repository.commit(null, null, officialBundle.revision).status).toBe("activated");
    repository.close();
    const external = new Database(databasePath);
    external
      .prepare("UPDATE runtime_activation SET generation = ? WHERE singleton = 1")
      .run(Number.MAX_SAFE_INTEGER);
    external.close();

    const restarted = await openBundleRuntimeActivation({ rootDirectory: root });
    const recovered = await restarted.recover(packageAuthorityFor(officialBundle), null);
    expect(recovered.status).toBe("recovered");
    if (recovered.status !== "recovered") throw new TypeError("Expected recovery success.");
    expect(recovered.authority.generation).toBe(Number.MAX_SAFE_INTEGER);

    const next = activationPair(variantBundle);
    expect(await restarted.activate(next.reference, next.staging, Number.MAX_SAFE_INTEGER)).toEqual(
      {
        status: "generation-exhausted",
        current: {
          activeRevision: officialBundle.revision,
          previousGoodRevision: null,
          generation: Number.MAX_SAFE_INTEGER,
        },
      },
    );
    expect(restarted.readState()).toEqual({ status: "active", authority: recovered.authority });
    expect(durableRecord(root)).toEqual({
      activeRevision: officialBundle.revision,
      previousGoodRevision: null,
      generation: Number.MAX_SAFE_INTEGER,
    });
    restarted.close();
  });

  it("rejects a generation-zero record that the transactional repository cannot produce", async () => {
    const root = await storedRoot(officialBundle, variantBundle);
    const databasePath = join(root, "runtime-activation.sqlite3");
    const repository = openRuntimeActivationSqliteRepository(databasePath);
    expect(repository.commit(null, null, officialBundle.revision).status).toBe("activated");
    repository.close();
    const external = new Database(databasePath);
    external
      .prepare(
        "UPDATE runtime_activation SET previous_good_revision = ? WHERE singleton = 1 AND generation = 0",
      )
      .run(variantBundle.revision);
    external.close();

    await expect(openBundleRuntimeActivation({ rootDirectory: root })).rejects.toMatchObject({
      code: "ACTIVATION_CORRUPT",
    });
    expect(rawDurableRecord(root)).toEqual({
      activeRevision: officialBundle.revision,
      previousGoodRevision: variantBundle.revision,
      generation: 0,
    });
  });

  it("serializes restart reconstruction and leaves an empty controller unchanged", async () => {
    const emptyRoot = await storedRoot(officialBundle);
    const empty = await openBundleRuntimeActivation({ rootDirectory: emptyRoot });
    await expect(empty.recover(packageAuthorityFor(officialBundle), null)).resolves.toEqual({
      status: "not-required",
      state: "empty",
    });
    expect(empty.readState()).toEqual({ status: "empty" });
    empty.close();

    const root = await storedRoot(officialBundle);
    const first = await openBundleRuntimeActivation({ rootDirectory: root });
    const pair = activationPair();
    requireActivated(await first.activate(pair.reference, pair.staging, null));
    first.close();
    const restarted = await openBundleRuntimeActivation({ rootDirectory: root });
    const running = restarted.recover(packageAuthorityFor(officialBundle), null);
    const busyActivation = activationPair();

    await expect(
      restarted.recover(packageAuthorityFor(officialBundle), null),
    ).rejects.toMatchObject({
      code: "ACTIVATION_BUSY",
    });
    await expect(
      restarted.activate(busyActivation.reference, busyActivation.staging, 0),
    ).rejects.toMatchObject({ code: "ACTIVATION_BUSY" });
    expect(readBundleRuntimeStagingAuthority(busyActivation.staging)).toBeDefined();
    await expect(running).resolves.toMatchObject({ status: "recovered" });
    restarted.close();
  });
});
