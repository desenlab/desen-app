import { mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { calculateDesenBundleRevision, canonicalizeJsonBytes } from "@desen/protocol";
import Database from "better-sqlite3";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  BundleStoreError,
  INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE,
  RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE,
  RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE,
  RuntimeActivationError,
  openBundleRuntimeActivation,
  openBundleStore,
  preflightBundlePackages,
  preflightBundleReferences,
  stageBundleRuntime,
  verifyBundleStoreEntry,
} from "../src/index.js";
import {
  createBundleRuntimeActivationInternal,
  readBundleRuntimeActivationAuthority,
} from "../src/runtime-activation-internal.js";
import { readBundleReferencePreflightAuthority } from "../src/reference-preflight-internal.js";
import {
  createInMemoryRuntimeActivationRepository,
  RuntimeActivationStorageError,
} from "../src/runtime-activation-repository-internal.js";
import { openRuntimeActivationSqliteRepository } from "../src/runtime-activation-sqlite-internal.js";
import { createOwnedBundleRuntimeActivationInternal } from "../src/runtime-activation.js";
import {
  consumeBundleRuntimeStagingAuthority,
  isBundleRuntimeStagingAuthority,
  readBundleRuntimeStagingAuthority,
} from "../src/runtime-staging-internal.js";

import type { DesenBundle, DesenCatalog } from "@desen/protocol";
import type {
  BundlePackagePreflightAuthority,
  BundleReferencePreflightAuthority,
  BundleRuntimeActivationAuthority,
  BundleRuntimeActivationResult,
  BundleRuntimeStagingAuthority,
  InstalledPackageArtifact,
  RuntimeActivationRecord,
} from "../src/index.js";
import type { BundleStore, BundleStoreEntry } from "../src/bundle-store-contract.js";
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
      paths.map(async (path) =>
        Object.freeze({
          path: `dist/${path}`,
          bytes: new Uint8Array(await readFile(join(DISTRIBUTION_ROOT, path))),
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

function activationPair(bundle: DesenBundle = officialBundle): Readonly<{
  readonly reference: BundleReferencePreflightAuthority;
  readonly staging: BundleRuntimeStagingAuthority;
}> {
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

async function temporaryRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "desen-runtime-activation-")));
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

function memoryBundleStore(entries: readonly BundleStoreEntry[]): BundleStore {
  const stored = new Map(entries.map((entry) => [entry.revision, new Uint8Array(entry.bytes)]));
  return Object.freeze({
    getBundle: async (revision: string) => {
      const bytes = stored.get(revision);
      return bytes === undefined
        ? Object.freeze({ status: "missing" as const })
        : Object.freeze({
            status: "found" as const,
            entry: Object.freeze({ revision, bytes: new Uint8Array(bytes) }),
          });
    },
    putBundle: async () => Object.freeze({ status: "conflict" as const }),
  });
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

function hostileThrownValue(): Readonly<{
  readonly value: unknown;
  readonly accesses: () => number;
}> {
  let accessCount = 0;
  const value = new Proxy(Object.create(null) as object, {
    get: () => {
      accessCount += 1;
      throw new Error("A hostile thrown value was inspected.");
    },
    getOwnPropertyDescriptor: () => {
      accessCount += 1;
      throw new Error("A hostile thrown value descriptor was inspected.");
    },
    getPrototypeOf: () => {
      accessCount += 1;
      throw new Error("A hostile thrown value prototype was inspected.");
    },
  });
  return Object.freeze({ value, accesses: () => accessCount });
}

function forgedNamedStorageError(): object {
  return Object.freeze(
    Object.defineProperties(Object.create(null) as object, {
      code: { enumerable: true, value: "ACTIVATION_CORRUPT" },
      constructor: {
        enumerable: true,
        value: Object.freeze({ name: "RuntimeActivationStorageError" }),
      },
    }),
  );
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

describe("M07-T07 durable runtime activation", () => {
  it("commits generation zero and transfers the exact staged authority out of T06", async () => {
    const root = await storedRoot(officialBundle);
    const pair = activationPair();
    const activation = await openBundleRuntimeActivation({ rootDirectory: root });

    expect(activation.readState()).toEqual({ status: "empty" });
    const authority = requireActivated(
      await activation.activate(pair.reference, pair.staging, null),
    );

    expect(authority).toEqual({
      profile: "desen.runtime-activation",
      profileVersion: 1,
      protocolVersion: "0.1.0",
      documentId: "com.example.account-app",
      entrySurfaceId: "sign-in",
      activeRevision: EXPECTED_REVISION,
      previousGoodRevision: null,
      generation: 0,
    });
    expect(Object.isFrozen(authority)).toBe(true);
    expect(
      readBundleRuntimeActivationAuthority(authority)?.stagingRecord.entrySurface,
    ).toBeDefined();
    expect(readBundleRuntimeStagingAuthority(pair.staging)).toBeUndefined();
    expect(isBundleRuntimeStagingAuthority(pair.staging)).toBe(false);
    expect(activation.readState()).toEqual({ status: "active", authority });
    activation.close();
  });

  it("rejects equal-revision authorities from distinct private T03 lineages without consuming T06", async () => {
    const root = await storedRoot(officialBundle);
    const reference = activationPair().reference;
    const staging = activationPair().staging;
    const activation = await openBundleRuntimeActivation({ rootDirectory: root });

    const result = await activation.activate(reference, staging, null);

    expect(result).toMatchObject({
      status: "rejected",
      stage: "authority-join",
      diagnostics: [{ code: INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE }],
    });
    expect(readBundleRuntimeStagingAuthority(staging)).toBeDefined();
    expect(activation.readState()).toEqual({ status: "empty" });
    activation.close();
  });

  it("rejects forged, cloned, proxied, and already consumed pairs before Bundle-store I/O", async () => {
    const pair = activationPair();
    let storeReads = 0;
    let commitCalls = 0;
    const repository = createInMemoryRuntimeActivationRepository();
    const activation = createBundleRuntimeActivationInternal({
      bundleStore: Object.freeze({
        getBundle: async () => {
          storeReads += 1;
          return Object.freeze({ status: "missing" as const });
        },
        putBundle: async () => Object.freeze({ status: "conflict" as const }),
      }),
      repository: Object.freeze({
        get: repository.get,
        commit: (
          expectedGeneration: number | null,
          authenticatedCurrent: RuntimeActivationRecord | null,
          candidateRevision: string,
        ) => {
          commitCalls += 1;
          return repository.commit(expectedGeneration, authenticatedCurrent, candidateRevision);
        },
        close: repository.close,
      }),
    });
    const hostileProxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("Authority authentication must not reflect over a proxy.");
        },
      },
    );

    for (const [reference, staging] of [
      [{} as never, pair.staging],
      [{ ...pair.reference } as never, pair.staging],
      [hostileProxy as never, pair.staging],
      [pair.reference, { ...pair.staging } as never],
    ] as const) {
      const result = await activation.activate(reference, staging, null);
      expect(result).toMatchObject({
        status: "rejected",
        stage: "authority-join",
        diagnostics: [{ code: INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE }],
      });
    }

    const referenceRecord = readBundleReferencePreflightAuthority(pair.reference);
    const stagingRecord = readBundleRuntimeStagingAuthority(pair.staging);
    if (referenceRecord === undefined || stagingRecord === undefined) {
      throw new TypeError("Expected private activation records for the pollution regression.");
    }
    const pollution = Object.freeze({
      expectedGeneration: null,
      referenceRecord,
      stagingRecord,
    });
    const pollutionEntries = Object.entries(pollution);
    const previousDescriptors = new Map(
      pollutionEntries.map(([key]) => [
        key,
        Object.getOwnPropertyDescriptor(Object.prototype, key),
      ]),
    );
    try {
      for (const [key, value] of pollutionEntries) {
        Object.defineProperty(Object.prototype, key, {
          configurable: true,
          enumerable: false,
          value,
        });
      }
      expect(await activation.activate({} as never, {} as never, null)).toMatchObject({
        status: "rejected",
        stage: "authority-join",
        diagnostics: [{ code: INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE }],
      });
    } finally {
      for (const [key] of pollutionEntries) {
        const previous = previousDescriptors.get(key);
        if (previous === undefined) Reflect.deleteProperty(Object.prototype, key);
        else Object.defineProperty(Object.prototype, key, previous);
      }
    }
    expect(commitCalls).toBe(0);
    expect(readBundleRuntimeStagingAuthority(pair.staging)).toBeDefined();
    expect(consumeBundleRuntimeStagingAuthority(pair.staging)).toBeDefined();
    expect(await activation.activate(pair.reference, pair.staging, null)).toMatchObject({
      status: "rejected",
      stage: "authority-join",
    });
    expect(storeReads).toBe(0);
    expect(commitCalls).toBe(0);
    activation.close();
  });

  it("authenticates storage failures without inspecting hostile values or trusting a forged name", async () => {
    const cleanupFailure = hostileThrownValue();
    let cleanupCalls = 0;
    const failingOpenRepository: RuntimeActivationRepository = Object.freeze({
      get: () => {
        throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
      },
      commit: () => Object.freeze({ status: "recovery-required" as const }),
      close: () => {
        cleanupCalls += 1;
        throw cleanupFailure.value;
      },
    });
    expect(() =>
      createOwnedBundleRuntimeActivationInternal(memoryBundleStore([]), failingOpenRepository),
    ).toThrowError(expect.objectContaining({ code: "ACTIVATION_CORRUPT" }));
    expect(cleanupCalls).toBe(1);
    expect(cleanupFailure.accesses()).toBe(0);

    const createHostile = hostileThrownValue();
    for (const thrown of [createHostile.value, forgedNamedStorageError()]) {
      const repository: RuntimeActivationRepository = Object.freeze({
        get: () => {
          throw thrown;
        },
        commit: () => Object.freeze({ status: "recovery-required" as const }),
        close: () => undefined,
      });
      expect(() =>
        createBundleRuntimeActivationInternal({
          bundleStore: memoryBundleStore([]),
          repository,
        }),
      ).toThrowError(expect.objectContaining({ code: "STORAGE_IO_FAILURE" }));
    }
    expect(createHostile.accesses()).toBe(0);

    const activateHostile = hostileThrownValue();
    const activationPairForFailure = activationPair();
    const activation = createBundleRuntimeActivationInternal({
      bundleStore: memoryBundleStore([
        { revision: officialBundle.revision, bytes: canonicalizeJsonBytes(officialBundle) },
      ]),
      repository: Object.freeze({
        get: () => Object.freeze({ status: "missing" as const }),
        commit: () => {
          throw activateHostile.value;
        },
        close: () => undefined,
      }),
    });
    expect(
      await activation.activate(
        activationPairForFailure.reference,
        activationPairForFailure.staging,
        null,
      ),
    ).toMatchObject({
      status: "rejected",
      stage: "internal",
      diagnostics: [{ code: RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE }],
    });
    expect(activateHostile.accesses()).toBe(0);
    expect(readBundleRuntimeStagingAuthority(activationPairForFailure.staging)).toBeUndefined();
    activation.close();

    const readHostile = hostileThrownValue();
    let readCount = 0;
    const readFailure = createBundleRuntimeActivationInternal({
      bundleStore: memoryBundleStore([]),
      repository: Object.freeze({
        get: () => {
          readCount += 1;
          if (readCount === 1) return Object.freeze({ status: "missing" as const });
          throw readHostile.value;
        },
        commit: () => Object.freeze({ status: "recovery-required" as const }),
        close: () => undefined,
      }),
    });
    expect(() => readFailure.readState()).toThrowError(
      expect.objectContaining({ code: "STORAGE_IO_FAILURE" }),
    );
    expect(readHostile.accesses()).toBe(0);
    readFailure.close();

    const closeHostile = hostileThrownValue();
    const closeFailure = createBundleRuntimeActivationInternal({
      bundleStore: memoryBundleStore([]),
      repository: Object.freeze({
        get: () => Object.freeze({ status: "missing" as const }),
        commit: () => Object.freeze({ status: "recovery-required" as const }),
        close: () => {
          throw closeHostile.value;
        },
      }),
    });
    expect(() => closeFailure.close()).toThrowError(
      expect.objectContaining({ code: "STORAGE_IO_FAILURE" }),
    );
    expect(closeHostile.accesses()).toBe(0);
  });

  it("admits only one in-flight attempt and does not consume a busy candidate", async () => {
    const first = activationPair();
    const busy = activationPair();
    const entry = Object.freeze({
      revision: officialBundle.revision,
      bytes: canonicalizeJsonBytes(officialBundle),
    });
    const pending =
      deferred<Readonly<{ readonly status: "found"; readonly entry: BundleStoreEntry }>>();
    let storeReads = 0;
    const activation = createBundleRuntimeActivationInternal({
      bundleStore: Object.freeze({
        getBundle: () => {
          storeReads += 1;
          return pending.promise;
        },
        putBundle: async () => Object.freeze({ status: "conflict" as const }),
      }),
      repository: createInMemoryRuntimeActivationRepository(),
    });

    const running = activation.activate(first.reference, first.staging, null);
    await expect(activation.activate(first.reference, first.staging, null)).rejects.toMatchObject({
      code: "ACTIVATION_BUSY",
    });
    await expect(activation.activate(busy.reference, busy.staging, null)).rejects.toMatchObject({
      code: "ACTIVATION_BUSY",
    });
    expect(storeReads).toBe(1);
    expect(readBundleRuntimeStagingAuthority(busy.staging)).toBeDefined();
    pending.resolve(Object.freeze({ status: "found", entry }));
    expect((await running).status).toBe("activated");
    expect(readBundleRuntimeStagingAuthority(first.staging)).toBeUndefined();
    activation.close();
  });

  it("terminally consumes a valid candidate when the same-root Bundle cannot be reclosed", async () => {
    const pair = activationPair();
    const activation = createBundleRuntimeActivationInternal({
      bundleStore: memoryBundleStore([]),
      repository: createInMemoryRuntimeActivationRepository(),
    });

    const result = await activation.activate(pair.reference, pair.staging, null);

    expect(result).toMatchObject({
      status: "rejected",
      stage: "bundle-reclosure",
      diagnostics: [{ code: RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE }],
    });
    expect(readBundleRuntimeStagingAuthority(pair.staging)).toBeUndefined();
    expect(activation.readState()).toEqual({ status: "empty" });
    activation.close();
  });

  it("propagates Bundle-store operational failures without writing or disguising them as reclosure", async () => {
    for (const [storeCode, activationCode] of [
      ["UNSAFE_STORAGE_PATH", "UNSAFE_STORAGE_PATH"],
      ["STORAGE_IO_FAILURE", "STORAGE_IO_FAILURE"],
      ["COMMIT_OUTCOME_INDETERMINATE", "STORAGE_IO_FAILURE"],
    ] as const) {
      const pair = activationPair();
      let durableWrites = 0;
      const activation = createBundleRuntimeActivationInternal({
        bundleStore: Object.freeze({
          getBundle: async () => {
            throw new BundleStoreError(storeCode);
          },
          putBundle: async () => Object.freeze({ status: "conflict" as const }),
        }),
        repository: Object.freeze({
          get: () => Object.freeze({ status: "missing" as const }),
          commit: () => {
            durableWrites += 1;
            return Object.freeze({ status: "recovery-required" as const });
          },
          close: () => undefined,
        }),
      });

      const failedActivation = activation.activate(pair.reference, pair.staging, null);
      await expect(failedActivation).rejects.toBeInstanceOf(RuntimeActivationError);
      await expect(failedActivation).rejects.toMatchObject({
        code: activationCode,
      });
      expect(readBundleRuntimeStagingAuthority(pair.staging)).toBeUndefined();
      expect(durableWrites).toBe(0);
      expect(activation.readState()).toEqual({ status: "empty" });
      activation.close();
    }
  });

  it("rejects same-key bytes whose embedded revision and staged content do not reclose", async () => {
    const pair = activationPair();
    const activation = createBundleRuntimeActivationInternal({
      bundleStore: memoryBundleStore([
        {
          revision: officialBundle.revision,
          bytes: canonicalizeJsonBytes(variantBundle),
        },
      ]),
      repository: createInMemoryRuntimeActivationRepository(),
    });

    expect(await activation.activate(pair.reference, pair.staging, null)).toMatchObject({
      status: "rejected",
      stage: "bundle-reclosure",
    });
    expect(activation.readState()).toEqual({ status: "empty" });
    activation.close();
  });

  it("increments same-revision commits, derives previous-good, and revokes superseded authorities", async () => {
    const root = await storedRoot(officialBundle, variantBundle);
    const activation = await openBundleRuntimeActivation({ rootDirectory: root });
    const firstPair = activationPair();
    const first = requireActivated(
      await activation.activate(firstPair.reference, firstPair.staging, null),
    );
    const samePair = activationPair();
    const same = requireActivated(
      await activation.activate(samePair.reference, samePair.staging, 0),
    );
    expect(same).toMatchObject({
      activeRevision: officialBundle.revision,
      previousGoodRevision: null,
      generation: 1,
    });
    expect(readBundleRuntimeActivationAuthority(first)).toBeUndefined();

    const variantPair = activationPair(variantBundle);
    const variant = requireActivated(
      await activation.activate(variantPair.reference, variantPair.staging, 1),
    );
    expect(variant).toMatchObject({
      activeRevision: variantBundle.revision,
      previousGoodRevision: officialBundle.revision,
      generation: 2,
    });
    expect(readBundleRuntimeActivationAuthority(same)).toBeUndefined();

    const repeatedVariant = activationPair(variantBundle);
    const repeated = requireActivated(
      await activation.activate(repeatedVariant.reference, repeatedVariant.staging, 2),
    );
    expect(repeated).toMatchObject({
      activeRevision: variantBundle.revision,
      previousGoodRevision: officialBundle.revision,
      generation: 3,
    });
    expect(readBundleRuntimeActivationAuthority(variant)).toBeUndefined();
    const returnPair = activationPair();
    const returned = requireActivated(
      await activation.activate(returnPair.reference, returnPair.staging, 3),
    );
    expect(returned).toMatchObject({
      activeRevision: officialBundle.revision,
      previousGoodRevision: variantBundle.revision,
      generation: 4,
    });
    expect(readBundleRuntimeActivationAuthority(repeated)).toBeUndefined();
    expect(activation.readState()).toEqual({ status: "active", authority: returned });
    activation.close();
    expect(readBundleRuntimeActivationAuthority(returned)).toBeUndefined();
  });

  it("preserves the authenticated current authority on a definite stale CAS loss", async () => {
    const root = await storedRoot(officialBundle);
    const activation = await openBundleRuntimeActivation({ rootDirectory: root });
    const firstPair = activationPair();
    const current = requireActivated(
      await activation.activate(firstPair.reference, firstPair.staging, null),
    );
    const stalePair = activationPair();

    const result = await activation.activate(stalePair.reference, stalePair.staging, null);

    expect(result).toEqual({
      status: "precondition-failed",
      current: {
        activeRevision: officialBundle.revision,
        previousGoodRevision: null,
        generation: 0,
      },
    });
    expect(readBundleRuntimeStagingAuthority(stalePair.staging)).toBeUndefined();
    expect(readBundleRuntimeActivationAuthority(current)).toBeDefined();
    expect(activation.readState()).toEqual({ status: "active", authority: current });
    activation.close();
  });

  it("opens a preexisting record only as recovery-required and blocks activation without consumption", async () => {
    const pair = activationPair();
    const record = Object.freeze({
      activeRevision: officialBundle.revision,
      previousGoodRevision: null,
      generation: 0,
    });
    const activation = createBundleRuntimeActivationInternal({
      bundleStore: memoryBundleStore([
        { revision: officialBundle.revision, bytes: canonicalizeJsonBytes(officialBundle) },
      ]),
      repository: createInMemoryRuntimeActivationRepository({ initialRecord: record }),
    });

    expect(activation.readState()).toEqual({ status: "recovery-required", record });
    expect(await activation.activate(pair.reference, pair.staging, 0)).toEqual({
      status: "recovery-required",
    });
    expect(readBundleRuntimeStagingAuthority(pair.staging)).toBeDefined();
    activation.close();
  });

  it("reopens a public durable record as raw recovery state rather than active authority", async () => {
    const root = await storedRoot(officialBundle);
    const first = await openBundleRuntimeActivation({ rootDirectory: root });
    const pair = activationPair();
    const authority = requireActivated(await first.activate(pair.reference, pair.staging, null));
    first.close();
    expect(readBundleRuntimeActivationAuthority(authority)).toBeUndefined();

    const reopened = await openBundleRuntimeActivation({ rootDirectory: root });
    expect(reopened.readState()).toEqual({
      status: "recovery-required",
      record: {
        activeRevision: officialBundle.revision,
        previousGoodRevision: null,
        generation: 0,
      },
    });
    reopened.close();
  });

  it("enters sticky recovery when authenticated durable state disappears or is rewritten", async () => {
    const root = await storedRoot(officialBundle);
    const databasePath = join(root, "runtime-activation.sqlite3");
    const activation = await openBundleRuntimeActivation({ rootDirectory: root });
    const firstPair = activationPair();
    const current = requireActivated(
      await activation.activate(firstPair.reference, firstPair.staging, null),
    );

    const externalConnection = new Database(databasePath);
    externalConnection.exec("DELETE FROM runtime_activation WHERE singleton = 1");
    externalConnection.close();

    const directPair = activationPair();
    expect(await activation.activate(directPair.reference, directPair.staging, null)).toEqual({
      status: "recovery-required",
    });
    expect(readBundleRuntimeStagingAuthority(directPair.staging)).toBeUndefined();
    expect(readBundleRuntimeActivationAuthority(current)).toBeUndefined();
    const beforeRecovery = openRuntimeActivationSqliteRepository(databasePath);
    expect(beforeRecovery.get()).toEqual({ status: "missing" });
    beforeRecovery.close();

    expect(activation.readState()).toEqual({ status: "recovery-required", record: null });
    const blockedPair = activationPair();
    expect(await activation.activate(blockedPair.reference, blockedPair.staging, null)).toEqual({
      status: "recovery-required",
    });
    expect(readBundleRuntimeStagingAuthority(blockedPair.staging)).toBeDefined();

    const observer = openRuntimeActivationSqliteRepository(databasePath);
    expect(observer.get()).toEqual({ status: "missing" });
    observer.close();
    activation.close();

    const rewriteRoot = await storedRoot(officialBundle, variantBundle);
    const rewriteDatabasePath = join(rewriteRoot, "runtime-activation.sqlite3");
    const rewriteActivation = await openBundleRuntimeActivation({ rootDirectory: rewriteRoot });
    const rewriteInitialPair = activationPair();
    const rewriteCurrent = requireActivated(
      await rewriteActivation.activate(
        rewriteInitialPair.reference,
        rewriteInitialPair.staging,
        null,
      ),
    );
    const rewriteConnection = new Database(rewriteDatabasePath);
    rewriteConnection
      .prepare(
        "UPDATE runtime_activation SET active_revision = ? WHERE singleton = 1 AND generation = 0",
      )
      .run(variantBundle.revision);
    rewriteConnection.close();
    const rewrittenPair = activationPair();

    expect(
      await rewriteActivation.activate(rewrittenPair.reference, rewrittenPair.staging, 0),
    ).toEqual({ status: "recovery-required" });
    expect(readBundleRuntimeStagingAuthority(rewrittenPair.staging)).toBeUndefined();
    expect(readBundleRuntimeActivationAuthority(rewriteCurrent)).toBeUndefined();
    const rewrittenObserver = openRuntimeActivationSqliteRepository(rewriteDatabasePath);
    expect(rewrittenObserver.get()).toEqual({
      status: "found",
      record: {
        activeRevision: variantBundle.revision,
        previousGoodRevision: null,
        generation: 0,
      },
    });
    rewrittenObserver.close();
    rewriteActivation.close();

    const pendingRoot = await storedRoot(officialBundle, variantBundle);
    const pendingDatabasePath = join(pendingRoot, "runtime-activation.sqlite3");
    const pendingStore = await openBundleStore({ rootDirectory: pendingRoot });
    const pendingRead =
      deferred<Readonly<{ readonly status: "found"; readonly entry: BundleStoreEntry }>>();
    const pendingActivation = createBundleRuntimeActivationInternal({
      bundleStore: Object.freeze({
        getBundle: async (revision: string) =>
          revision === variantBundle.revision
            ? pendingRead.promise
            : pendingStore.getBundle(revision),
        putBundle: pendingStore.putBundle,
      }),
      repository: openRuntimeActivationSqliteRepository(pendingDatabasePath),
    });
    const pendingInitialPair = activationPair();
    const pendingCurrent = requireActivated(
      await pendingActivation.activate(
        pendingInitialPair.reference,
        pendingInitialPair.staging,
        null,
      ),
    );
    const pendingVariantPair = activationPair(variantBundle);
    const running = pendingActivation.activate(
      pendingVariantPair.reference,
      pendingVariantPair.staging,
      0,
    );
    const pendingExternal = new Database(pendingDatabasePath);
    pendingExternal.exec("DELETE FROM runtime_activation WHERE singleton = 1");
    expect(pendingActivation.readState()).toEqual({
      status: "recovery-required",
      record: null,
    });
    pendingExternal
      .prepare(
        "INSERT INTO runtime_activation (singleton, active_revision, previous_good_revision, generation) VALUES (1, ?, NULL, 0)",
      )
      .run(officialBundle.revision);
    pendingExternal.close();
    const pendingVariantRead = await pendingStore.getBundle(variantBundle.revision);
    if (pendingVariantRead.status !== "found") throw new TypeError("Expected staged Bundle entry.");
    pendingRead.resolve(pendingVariantRead);

    expect(await running).toEqual({ status: "recovery-required" });
    expect(readBundleRuntimeStagingAuthority(pendingVariantPair.staging)).toBeUndefined();
    expect(readBundleRuntimeActivationAuthority(pendingCurrent)).toBeUndefined();
    const pendingObserver = openRuntimeActivationSqliteRepository(pendingDatabasePath);
    expect(pendingObserver.get()).toEqual({
      status: "found",
      record: {
        activeRevision: officialBundle.revision,
        previousGoodRevision: null,
        generation: 0,
      },
    });
    pendingObserver.close();
    pendingActivation.close();
  });

  it("rolls back a definite before-COMMIT failure and admits a fresh candidate retry", async () => {
    const root = await storedRoot(officialBundle);
    let attempts = 0;
    const repository = openRuntimeActivationSqliteRepository(
      join(root, "runtime-activation.sqlite3"),
      {
        beforeCommit: () => {
          attempts += 1;
          if (attempts === 1) throw new Error("synthetic pre-COMMIT fault");
        },
      },
    );
    const activation = createBundleRuntimeActivationInternal({
      bundleStore: await openBundleStore({ rootDirectory: root }),
      repository,
    });
    const failedPair = activationPair();

    await expect(
      activation.activate(failedPair.reference, failedPair.staging, null),
    ).rejects.toMatchObject({ code: "STORAGE_IO_FAILURE" });
    expect(readBundleRuntimeStagingAuthority(failedPair.staging)).toBeUndefined();
    expect(activation.readState()).toEqual({ status: "empty" });

    const retryPair = activationPair();
    const retried = requireActivated(
      await activation.activate(retryPair.reference, retryPair.staging, null),
    );
    expect(retried.generation).toBe(0);
    expect(activation.readState()).toEqual({ status: "active", authority: retried });
    activation.close();
  });

  it("turns a post-COMMIT failure into recovery-required and revokes the prior current authority", async () => {
    const root = await storedRoot(officialBundle, variantBundle);
    const databasePath = join(root, "runtime-activation.sqlite3");
    let commitCount = 0;
    const repository = openRuntimeActivationSqliteRepository(databasePath, {
      afterCommit: () => {
        commitCount += 1;
        if (commitCount === 2) throw new Error("synthetic post-COMMIT observation fault");
      },
    });
    const activation = createBundleRuntimeActivationInternal({
      bundleStore: await openBundleStore({ rootDirectory: root }),
      repository,
    });
    const firstPair = activationPair();
    const current = requireActivated(
      await activation.activate(firstPair.reference, firstPair.staging, null),
    );
    const variantPair = activationPair(variantBundle);

    expect(await activation.activate(variantPair.reference, variantPair.staging, 0)).toEqual({
      status: "recovery-required",
    });
    expect(readBundleRuntimeActivationAuthority(current)).toBeUndefined();
    expect(activation.readState()).toEqual({ status: "recovery-required", record: null });
    const blockedPair = activationPair();
    expect(await activation.activate(blockedPair.reference, blockedPair.staging, 1)).toEqual({
      status: "recovery-required",
    });
    expect(readBundleRuntimeStagingAuthority(blockedPair.staging)).toBeDefined();

    const observed = openRuntimeActivationSqliteRepository(databasePath);
    expect(observed.get()).toEqual({
      status: "found",
      record: {
        activeRevision: variantBundle.revision,
        previousGoodRevision: officialBundle.revision,
        generation: 1,
      },
    });
    observed.close();
    activation.close();
  });

  it("allows one winner across two SQLite connections at the same expected generation", async () => {
    const root = await temporaryRoot();
    const databasePath = join(root, "runtime-activation.sqlite3");
    const first = openRuntimeActivationSqliteRepository(databasePath);
    const second = openRuntimeActivationSqliteRepository(databasePath);

    expect(first.commit(null, null, officialBundle.revision)).toEqual({
      status: "activated",
      record: {
        activeRevision: officialBundle.revision,
        previousGoodRevision: null,
        generation: 0,
      },
    });
    expect(second.commit(null, null, variantBundle.revision)).toEqual({
      status: "precondition-failed",
      current: {
        activeRevision: officialBundle.revision,
        previousGoodRevision: null,
        generation: 0,
      },
    });
    expect(first.get()).toEqual(second.get());
    first.close();
    second.close();
  });

  it("consumes a generation-exhausted candidate without changing the authenticated current slot", async () => {
    const maximum = Number.MAX_SAFE_INTEGER;
    let stored: Readonly<{
      readonly activeRevision: string;
      readonly previousGoodRevision: string | null;
      readonly generation: number;
    }> | null = null;
    let closed = false;
    const repository: RuntimeActivationRepository = Object.freeze({
      get: () =>
        stored === null
          ? Object.freeze({ status: "missing" as const })
          : Object.freeze({ status: "found" as const, record: stored }),
      commit: (
        expectedGeneration: number | null,
        _authenticatedCurrent: RuntimeActivationRecord | null,
        candidateRevision: string,
      ) => {
        if (closed) throw new TypeError("closed");
        if (stored === null) {
          stored = Object.freeze({
            activeRevision: candidateRevision,
            previousGoodRevision: null,
            generation: maximum,
          });
          return Object.freeze({ status: "activated" as const, record: stored });
        }
        expect(expectedGeneration).toBe(maximum);
        return Object.freeze({ status: "generation-exhausted" as const, current: stored });
      },
      close: () => {
        closed = true;
      },
    });
    const activation = createBundleRuntimeActivationInternal({
      bundleStore: memoryBundleStore([
        { revision: officialBundle.revision, bytes: canonicalizeJsonBytes(officialBundle) },
        { revision: variantBundle.revision, bytes: canonicalizeJsonBytes(variantBundle) },
      ]),
      repository,
    });
    const firstPair = activationPair();
    const current = requireActivated(
      await activation.activate(firstPair.reference, firstPair.staging, null),
    );
    const exhaustedPair = activationPair(variantBundle);

    expect(
      await activation.activate(exhaustedPair.reference, exhaustedPair.staging, maximum),
    ).toEqual({ status: "generation-exhausted", current: stored });
    expect(readBundleRuntimeStagingAuthority(exhaustedPair.staging)).toBeUndefined();
    const durable = repository.get();
    expect(durable.status).toBe("found");
    if (durable.status !== "found") throw new TypeError("Expected durable activation state.");
    expect(durable.record.activeRevision).toBe(officialBundle.revision);
    expect(activation.readState()).toEqual({ status: "active", authority: current });
    activation.close();
  });

  it("keeps generation exhaustion and repository close deterministic", () => {
    const maximum = Number.MAX_SAFE_INTEGER;
    const repository = createInMemoryRuntimeActivationRepository({
      initialRecord: {
        activeRevision: officialBundle.revision,
        previousGoodRevision: null,
        generation: maximum,
      },
    });
    expect(
      repository.commit(
        maximum,
        {
          activeRevision: officialBundle.revision,
          previousGoodRevision: null,
          generation: maximum,
        },
        variantBundle.revision,
      ),
    ).toEqual({
      status: "generation-exhausted",
      current: {
        activeRevision: officialBundle.revision,
        previousGoodRevision: null,
        generation: maximum,
      },
    });
    repository.close();
    expect(() => repository.get()).toThrow("closed");
  });

  it("redacts statement-acquisition failure and closes the partially opened repository", async () => {
    const root = await temporaryRoot();
    const databasePath = join(root, "runtime-activation.sqlite3");
    const prepared: string[] = [];

    expect(() =>
      openRuntimeActivationSqliteRepository(databasePath, {
        afterPrepareStatement: (statement) => {
          prepared.push(statement);
          if (statement === "read") throw new Error("synthetic statement-acquisition failure");
        },
      }),
    ).toThrowError(expect.objectContaining({ code: "STORAGE_IO_FAILURE" }));
    expect(prepared).toEqual(["read"]);

    const reopened = openRuntimeActivationSqliteRepository(databasePath);
    expect(reopened.get()).toEqual({ status: "missing" });
    reopened.close();
  });

  it("rejects unsafe SQLite leaves and sidecars plus schema drift and corruption", async () => {
    const unsafeLeafRoot = await temporaryRoot();
    const unsafeLeafDatabase = join(unsafeLeafRoot, "runtime-activation.sqlite3");
    const leafTarget = join(unsafeLeafRoot, "database-target");
    await writeFile(leafTarget, new Uint8Array([1]));
    await symlink(leafTarget, unsafeLeafDatabase);
    expect(() => openRuntimeActivationSqliteRepository(unsafeLeafDatabase)).toThrowError(
      expect.objectContaining({ code: "UNSAFE_STORAGE_PATH" }),
    );

    const unsafeRoot = await temporaryRoot();
    const unsafeDatabase = join(unsafeRoot, "runtime-activation.sqlite3");
    const sidecarTarget = join(unsafeRoot, "sidecar-target");
    await writeFile(sidecarTarget, new Uint8Array([1]));
    await symlink(sidecarTarget, `${unsafeDatabase}-wal`);
    expect(() => openRuntimeActivationSqliteRepository(unsafeDatabase)).toThrowError(
      expect.objectContaining({ code: "UNSAFE_STORAGE_PATH" }),
    );

    const driftRoot = await temporaryRoot();
    const driftDatabase = join(driftRoot, "runtime-activation.sqlite3");
    const initializedForDrift = openRuntimeActivationSqliteRepository(driftDatabase);
    initializedForDrift.close();
    const driftConnection = new Database(driftDatabase);
    driftConnection.exec("CREATE TABLE unexpected_schema_drift (value TEXT) STRICT");
    driftConnection.close();
    expect(() => openRuntimeActivationSqliteRepository(driftDatabase)).toThrowError(
      expect.objectContaining({ code: "ACTIVATION_CORRUPT" }),
    );

    const liveDriftRoot = await storedRoot(officialBundle, variantBundle);
    const liveDriftDatabase = join(liveDriftRoot, "runtime-activation.sqlite3");
    const liveDriftActivation = await openBundleRuntimeActivation({
      rootDirectory: liveDriftRoot,
    });
    const liveInitialPair = activationPair();
    const liveCurrent = requireActivated(
      await liveDriftActivation.activate(liveInitialPair.reference, liveInitialPair.staging, null),
    );
    const liveDriftConnection = new Database(liveDriftDatabase);
    liveDriftConnection.exec(
      "CREATE TRIGGER delete_activation_after_update AFTER UPDATE ON runtime_activation BEGIN DELETE FROM runtime_activation WHERE singleton = 1; END",
    );
    liveDriftConnection.close();
    const liveVariantPair = activationPair(variantBundle);
    await expect(
      liveDriftActivation.activate(liveVariantPair.reference, liveVariantPair.staging, 0),
    ).rejects.toMatchObject({ code: "ACTIVATION_CORRUPT" });
    expect(readBundleRuntimeStagingAuthority(liveVariantPair.staging)).toBeUndefined();
    expect(readBundleRuntimeActivationAuthority(liveCurrent)).toBeDefined();
    const liveObserver = new Database(liveDriftDatabase);
    expect(
      liveObserver
        .prepare(
          "SELECT active_revision AS activeRevision, previous_good_revision AS previousGoodRevision, generation FROM runtime_activation WHERE singleton = 1",
        )
        .get(),
    ).toEqual({
      activeRevision: officialBundle.revision,
      previousGoodRevision: null,
      generation: 0,
    });
    liveObserver.close();
    liveDriftActivation.close();

    const corruptRoot = await temporaryRoot();
    const corruptDatabase = join(corruptRoot, "runtime-activation.sqlite3");
    const initialized = openRuntimeActivationSqliteRepository(corruptDatabase);
    initialized.close();
    await writeFile(corruptDatabase, new TextEncoder().encode("not a SQLite database"));
    expect(() => openRuntimeActivationSqliteRepository(corruptDatabase)).toThrowError(
      expect.objectContaining({ code: "ACTIVATION_CORRUPT" }),
    );
  });

  it("rejects malformed roots and revokes service operations after close", async () => {
    await expect(openBundleRuntimeActivation({ rootDirectory: "relative" })).rejects.toBeInstanceOf(
      RuntimeActivationError,
    );
    const root = await storedRoot(officialBundle);
    const activation = await openBundleRuntimeActivation({ rootDirectory: root });
    activation.close();
    expect(() => activation.readState()).toThrowError(
      expect.objectContaining({ code: "ACTIVATION_CLOSED" }),
    );
    const pair = activationPair();
    await expect(activation.activate(pair.reference, pair.staging, null)).rejects.toMatchObject({
      code: "ACTIVATION_CLOSED",
    });
    expect(readBundleRuntimeStagingAuthority(pair.staging)).toBeDefined();
  });
});
