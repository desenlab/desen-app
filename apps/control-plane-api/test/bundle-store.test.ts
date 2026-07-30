import { execFile } from "node:child_process";
import {
  lstat,
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { calculateDesenBundleRevision, canonicalizeJsonBytes, sha256Digest } from "@desen/protocol";
import { publishDesenSource } from "@desen/publisher";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { BundleStoreError, openBundleStore, type BundleStoreEntry } from "../src/index.js";
import { openBundleStoreInternal } from "../src/bundle-store-internal.js";

import type { PublishCatalogPackageCandidate, PublishSuccess } from "@desen/publisher";

const execFileAsync = promisify(execFile);
const TEMPORARY_PREFIX = join(tmpdir(), "desen-m07-t01-");
const FIXTURE_ROOT = resolve(import.meta.dirname, "../../..");
const OFFICIAL_SOURCE_PATH = join(
  FIXTURE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
);
const OFFICIAL_CATALOG_PATH = join(
  FIXTURE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
);
const EXPECTED_OFFICIAL_REVISION =
  "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601";

let officialEntry: BundleStoreEntry;
let publicationVariantEntry: BundleStoreEntry;
let temporaryRoots: string[] = [];

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function jsonRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

async function loadJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function requirePublishSuccess(value: ReturnType<typeof publishDesenSource>): PublishSuccess {
  if (!value.ok) throw new TypeError("Expected the frozen official Source to publish.");
  return value;
}

function bundlePath(root: string, revision: string): string {
  const hexadecimal = revision.slice("sha256:".length);
  return join(root, "bundles", "sha256", hexadecimal.slice(0, 2), `${hexadecimal.slice(2)}.bundle`);
}

async function createRoot(): Promise<string> {
  const root = await mkdtemp(TEMPORARY_PREFIX);
  temporaryRoots.push(root);
  return root;
}

function entryWith(bytes: Uint8Array, revision = officialEntry.revision): BundleStoreEntry {
  return { revision, bytes };
}

function expectStoreError(error: unknown, code: BundleStoreError["code"]): boolean {
  expect(error).toBeInstanceOf(BundleStoreError);
  expect(error).toMatchObject({ code });
  if (!(error instanceof BundleStoreError)) return false;
  expect(error.message).not.toContain("/");
  expect(error).not.toHaveProperty("cause");
  return true;
}

async function expectStoreRejection(
  operation: Promise<unknown>,
  code: BundleStoreError["code"],
): Promise<void> {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeDefined();
  expectStoreError(caught, code);
}

function deferred(): Readonly<{ promise: Promise<void>; resolve: () => void }> {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolveDeferred) => {
    resolvePromise = resolveDeferred;
  });
  if (resolvePromise === undefined) throw new TypeError("Deferred resolver was not initialized.");
  return Object.freeze({ promise, resolve: resolvePromise });
}

beforeAll(async () => {
  const source = await loadJson(OFFICIAL_SOURCE_PATH);
  const catalog = jsonRecord(await loadJson(OFFICIAL_CATALOG_PATH), "Official Catalog");
  const candidate: PublishCatalogPackageCandidate = {
    id: String(catalog.id),
    version: String(catalog.version),
    target: String(catalog.target),
    observedPackageDigest: String(catalog.packageDigest),
    catalog,
  };
  const published = requirePublishSuccess(publishDesenSource(JSON.stringify(source), [candidate]));
  const bytes = canonicalizeJsonBytes(published.bundle);
  expect(published.bundle.revision).toBe(EXPECTED_OFFICIAL_REVISION);
  expect(bytes.byteLength).toBe(2_173);
  officialEntry = {
    revision: published.bundle.revision,
    bytes,
  };

  const variant = jsonRecord(cloneJson(published.bundle), "Published Bundle");
  variant.publication = { pipeline: "m07-t01-publication-variant" };
  expect(calculateDesenBundleRevision(variant)).toBe(published.bundle.revision);
  publicationVariantEntry = {
    revision: published.bundle.revision,
    bytes: canonicalizeJsonBytes(variant),
  };
});

afterEach(async () => {
  const roots = temporaryRoots;
  temporaryRoots = [];
  await Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })));
});

describe("M07-T01 immutable content-addressed Bundle store", () => {
  it("stores the public Publisher golden exactly and reads it from a fresh store instance", async () => {
    const root = await createRoot();
    const first = await openBundleStore({ rootDirectory: root });
    await expect(first.putBundle(officialEntry)).resolves.toEqual({ status: "stored" });

    const expectedPath = bundlePath(root, officialEntry.revision);
    expect(await readFile(expectedPath)).toEqual(Buffer.from(officialEntry.bytes));
    expect((await stat(expectedPath)).mode & 0o777).toBe(0o400);

    const reopened = await openBundleStore({ rootDirectory: root });
    const result = await reopened.getBundle(officialEntry.revision);
    expect(result).toEqual({ status: "found", entry: officialEntry });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status !== "found") throw new TypeError("Expected stored Bundle bytes.");
    expect(Object.isFrozen(result.entry)).toBe(true);
    expect(result.entry.bytes).not.toBe(officialEntry.bytes);
  });

  it("returns unchanged for byte-identical content without rewriting the inode", async () => {
    const root = await createRoot();
    const store = await openBundleStore({ rootDirectory: root });
    expect(await store.putBundle(officialEntry)).toEqual({ status: "stored" });
    const expectedPath = bundlePath(root, officialEntry.revision);
    const before = await stat(expectedPath, { bigint: true });

    expect(await store.putBundle(entryWith(new Uint8Array(officialEntry.bytes)))).toEqual({
      status: "unchanged",
    });
    const after = await stat(expectedPath, { bigint: true });
    expect(after.dev).toBe(before.dev);
    expect(after.ino).toBe(before.ino);
    expect(after.mtimeNs).toBe(before.mtimeNs);
    expect(await readFile(expectedPath)).toEqual(Buffer.from(officialEntry.bytes));
  });

  it("reports exact-byte conflicts, including publication-only changes, without replacing the winner", async () => {
    const root = await createRoot();
    const store = await openBundleStore({ rootDirectory: root });
    expect(publicationVariantEntry.bytes).not.toEqual(officialEntry.bytes);
    expect(await store.putBundle(officialEntry)).toEqual({ status: "stored" });
    const expectedPath = bundlePath(root, officialEntry.revision);
    const before = await stat(expectedPath, { bigint: true });

    expect(await store.putBundle(publicationVariantEntry)).toEqual({ status: "conflict" });
    expect(await store.putBundle(entryWith(Uint8Array.from([0x7b, 0x7d])))).toEqual({
      status: "conflict",
    });
    const after = await stat(expectedPath, { bigint: true });
    expect(after.dev).toBe(before.dev);
    expect(after.ino).toBe(before.ino);
    expect(await readFile(expectedPath)).toEqual(Buffer.from(officialEntry.bytes));
  });

  it("snapshots an exact Uint8Array view synchronously before the first asynchronous step", async () => {
    const root = await createRoot();
    const store = await openBundleStore({ rootDirectory: root });
    const backing = new Uint8Array(officialEntry.bytes.byteLength + 8);
    backing.set(officialEntry.bytes, 4);
    const exactView = backing.subarray(4, backing.byteLength - 4);
    const expected = new Uint8Array(exactView);

    const pending = store.putBundle(entryWith(exactView));
    backing.fill(0);
    expect(await pending).toEqual({ status: "stored" });
    const result = await store.getBundle(officialEntry.revision);
    expect(result).toEqual({
      status: "found",
      entry: entryWith(expected),
    });
  });

  it("returns a fresh byte copy for every read", async () => {
    const root = await createRoot();
    const store = await openBundleStore({ rootDirectory: root });
    await store.putBundle(officialEntry);
    const first = await store.getBundle(officialEntry.revision);
    if (first.status !== "found") throw new TypeError("Expected the first read.");
    const mutableFirst = first.entry.bytes as Uint8Array;
    mutableFirst.fill(0);

    const second = await store.getBundle(officialEntry.revision);
    if (second.status !== "found") throw new TypeError("Expected the second read.");
    expect(second.entry.bytes).not.toBe(first.entry.bytes);
    expect(second.entry.bytes).toEqual(officialEntry.bytes);
  });

  it("linearizes concurrent byte-identical writes across independent store instances", async () => {
    const root = await createRoot();
    const stores = await Promise.all(
      Array.from({ length: 16 }, () => openBundleStore({ rootDirectory: root })),
    );
    const results = await Promise.all(stores.map((store) => store.putBundle(officialEntry)));
    expect(results.filter(({ status }) => status === "stored")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "unchanged")).toHaveLength(15);
    expect(results.filter(({ status }) => status === "conflict")).toHaveLength(0);
    expect(await readFile(bundlePath(root, officialEntry.revision))).toEqual(
      Buffer.from(officialEntry.bytes),
    );

    const contestedRoot = await createRoot();
    const reachedShardParentSync = deferred();
    const releaseShardParentSync = deferred();
    const creator = await openBundleStoreInternal(
      { rootDirectory: contestedRoot },
      {
        beforeShardParentSync: async ({ shardPath }) => {
          expect(
            shardPath.endsWith(
              join(
                "bundles",
                "sha256",
                officialEntry.revision.slice("sha256:".length, "sha256:".length + 2),
              ),
            ),
          ).toBe(true);
          reachedShardParentSync.resolve();
          await releaseShardParentSync.promise;
        },
      },
    );
    const creatorPending = creator.putBundle(officialEntry);
    await reachedShardParentSync.promise;

    const contender = await openBundleStoreInternal(
      { rootDirectory: contestedRoot },
      {
        beforeShardParentSync: () => {
          throw new Error("synthetic existing-shard parent-sync fault");
        },
      },
    );
    let contenderError: unknown;
    try {
      await contender.putBundle(officialEntry);
    } catch (error) {
      contenderError = error;
    }
    releaseShardParentSync.resolve();

    expect(contenderError).toBeDefined();
    expectStoreError(contenderError, "STORAGE_IO_FAILURE");
    await expect(creatorPending).resolves.toEqual({ status: "stored" });
    expect(await readFile(bundlePath(contestedRoot, officialEntry.revision))).toEqual(
      Buffer.from(officialEntry.bytes),
    );
  });

  it("uses first-writer-wins for concurrent divergent bytes without producing a mixed file", async () => {
    const root = await createRoot();
    const [first, second] = await Promise.all([
      openBundleStore({ rootDirectory: root }),
      openBundleStore({ rootDirectory: root }),
    ]);
    const results = await Promise.all([
      first.putBundle(officialEntry),
      second.putBundle(publicationVariantEntry),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual(["conflict", "stored"]);

    const bytes = await readFile(bundlePath(root, officialEntry.revision));
    const firstWon = bytes.equals(Buffer.from(officialEntry.bytes));
    const secondWon = bytes.equals(Buffer.from(publicationVariantEntry.bytes));
    expect(firstWon || secondWon).toBe(true);
    expect(bytes.byteLength).toBe(
      firstWon ? officialEntry.bytes.byteLength : publicationVariantEntry.bytes.byteLength,
    );
  });

  it("keeps the addressed path absent until the complete temporary file is linked", async () => {
    const root = await createRoot();
    const reachedCommit = deferred();
    const releaseCommit = deferred();
    const writer = await openBundleStoreInternal(
      { rootDirectory: root },
      {
        beforeLink: async () => {
          reachedCommit.resolve();
          await releaseCommit.promise;
        },
      },
    );
    const reader = await openBundleStore({ rootDirectory: root });
    const pending = writer.putBundle(officialEntry);
    await reachedCommit.promise;

    expect(await reader.getBundle(officialEntry.revision)).toEqual({ status: "missing" });
    await expect(lstat(bundlePath(root, officialEntry.revision))).rejects.toMatchObject({
      code: "ENOENT",
    });
    releaseCommit.resolve();
    await expect(pending).resolves.toEqual({ status: "stored" });
    expect(await reader.getBundle(officialEntry.revision)).toEqual({
      status: "found",
      entry: officialEntry,
    });
  });

  it("detects temporary truncation and removes the non-authoritative partial file", async () => {
    const root = await createRoot();
    const store = await openBundleStoreInternal(
      { rootDirectory: root },
      {
        afterTemporaryWrite: async ({ temporaryPath }) => {
          await truncate(temporaryPath, 3);
        },
      },
    );
    await expectStoreRejection(store.putBundle(officialEntry), "UNSAFE_STORAGE_PATH");

    const reader = await openBundleStore({ rootDirectory: root });
    expect(await reader.getBundle(officialEntry.revision)).toEqual({ status: "missing" });
    const shard = dirname(bundlePath(root, officialEntry.revision));
    expect((await readdir(shard)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("reports a post-link fault as indeterminate while preserving a complete retry-safe entry", async () => {
    const root = await createRoot();
    const committedCleanupSyncs: string[] = [];
    const store = await openBundleStoreInternal(
      { rootDirectory: root },
      {
        afterLink: () => {
          throw new Error("synthetic post-link fault");
        },
        afterCommittedCleanupSync: ({ shardPath }) => {
          committedCleanupSyncs.push(shardPath);
        },
      },
    );
    await expectStoreRejection(store.putBundle(officialEntry), "COMMIT_OUTCOME_INDETERMINATE");
    const finalPath = bundlePath(root, officialEntry.revision);
    expect(committedCleanupSyncs).toHaveLength(1);
    expect(committedCleanupSyncs[0]?.endsWith(dirname(finalPath).slice(root.length))).toBe(true);
    const committedEntry = await stat(finalPath, { bigint: true });
    expect(committedEntry.nlink).toBe(1n);
    expect(committedEntry.mode & 0o777n).toBe(0o400n);

    const reopened = await openBundleStore({ rootDirectory: root });
    expect(await reopened.getBundle(officialEntry.revision)).toEqual({
      status: "found",
      entry: officialEntry,
    });
    expect(await reopened.putBundle(officialEntry)).toEqual({ status: "unchanged" });
  });

  it("removes the committed temporary alias safely when a reader overlaps the link window", async () => {
    const root = await createRoot();
    const reachedPostLink = deferred();
    const releaseWriter = deferred();
    const writer = await openBundleStoreInternal(
      { rootDirectory: root },
      {
        afterLink: async () => {
          reachedPostLink.resolve();
          await releaseWriter.promise;
        },
      },
    );
    const reader = await openBundleStore({ rootDirectory: root });
    const pending = writer.putBundle(officialEntry);
    await reachedPostLink.promise;

    await expect(reader.getBundle(officialEntry.revision)).resolves.toEqual({
      status: "found",
      entry: officialEntry,
    });
    releaseWriter.resolve();
    await expect(pending).resolves.toEqual({ status: "stored" });
    expect((await stat(bundlePath(root, officialEntry.revision), { bigint: true })).nlink).toBe(1n);
  });

  it("rejects an unowned hard-link alias instead of accepting mutable revision authority", async () => {
    const root = await createRoot();
    const outside = await createRoot();
    const store = await openBundleStore({ rootDirectory: root });
    await store.putBundle(officialEntry);
    const finalPath = bundlePath(root, officialEntry.revision);
    const aliasPath = join(outside, "bundle-alias");
    await link(finalPath, aliasPath);

    await expectStoreRejection(store.getBundle(officialEntry.revision), "UNSAFE_STORAGE_PATH");
    await expectStoreRejection(store.putBundle(officialEntry), "UNSAFE_STORAGE_PATH");
    expect(await readFile(aliasPath)).toEqual(Buffer.from(officialEntry.bytes));
  });

  it("rejects final symlinks, directories, and FIFOs without following or replacing them", async () => {
    const unsafeKinds = ["directory", "symlink", "fifo"] as const;
    for (const kind of unsafeKinds) {
      if (kind === "fifo" && process.platform === "win32") continue;
      const root = await createRoot();
      const store = await openBundleStore({ rootDirectory: root });
      const finalPath = bundlePath(root, officialEntry.revision);
      await mkdir(dirname(finalPath), { recursive: true });
      const outside = join(await createRoot(), `${kind}-outside`);
      if (kind === "directory") {
        await mkdir(finalPath);
      } else if (kind === "symlink") {
        await writeFile(outside, "outside");
        await symlink(outside, finalPath);
      } else {
        await execFileAsync("mkfifo", [finalPath]);
      }

      await expectStoreRejection(store.putBundle(officialEntry), "UNSAFE_STORAGE_PATH");
      await expectStoreRejection(store.getBundle(officialEntry.revision), "UNSAFE_STORAGE_PATH");
      const finalEntry = await lstat(finalPath);
      expect(
        kind === "directory"
          ? finalEntry.isDirectory()
          : kind === "symlink"
            ? finalEntry.isSymbolicLink()
            : finalEntry.isFIFO(),
      ).toBe(true);
      if (kind === "symlink") expect(await readFile(outside, "utf8")).toBe("outside");
    }
  });

  it("rejects a symlinked shard without writing through it", async () => {
    const root = await createRoot();
    const store = await openBundleStore({ rootDirectory: root });
    const finalPath = bundlePath(root, officialEntry.revision);
    const shardPath = dirname(finalPath);
    const outside = await createRoot();
    await symlink(outside, shardPath);

    await expectStoreRejection(store.putBundle(officialEntry), "UNSAFE_STORAGE_PATH");
    expect(await readdir(outside)).toEqual([]);
  });

  it("rejects malformed revision keys before any revision-derived filesystem access", async () => {
    const root = await createRoot();
    const store = await openBundleStore({ rootDirectory: root });
    const invalid = [
      "",
      `sha256:${"A".repeat(64)}`,
      `sha256:${"a".repeat(63)}`,
      `sha256:${"a".repeat(65)}`,
      `sha256:${"g".repeat(64)}`,
      `sha256:${"a".repeat(31)}/../${"b".repeat(29)}`,
      `sha256:${"a".repeat(63)}%2f`,
      `sha256:${"a".repeat(63)}／`,
      ` sha256:${"a".repeat(64)}`,
      `sha256:${"a".repeat(64)}.bundle`,
      null,
      new String(`sha256:${"a".repeat(64)}`),
    ];
    for (const revision of invalid) {
      expect(() => store.getBundle(revision as string)).toThrowError(
        expect.objectContaining({ code: "INVALID_REVISION" }),
      );
    }
    expect(await readdir(join(root, "bundles", "sha256"))).toEqual([]);
  });

  it("rejects hostile entry shells, accessors, empty bytes, and shared memory before I/O", async () => {
    const root = await createRoot();
    const store = await openBundleStore({ rootDirectory: root });
    const getter = vi.fn(() => officialEntry.bytes);
    const accessor = { revision: officialEntry.revision } as Record<string, unknown>;
    Object.defineProperty(accessor, "bytes", { enumerable: true, get: getter });
    const hostile = new Proxy(officialEntry, {
      ownKeys: () => {
        throw new Error("hostile ownKeys");
      },
    });
    const shared = new Uint8Array(new SharedArrayBuffer(8));
    const invalid = [
      accessor,
      hostile,
      { ...officialEntry, path: "/outside" },
      { revision: officialEntry.revision, bytes: new Uint8Array() },
      { revision: officialEntry.revision, bytes: shared },
      { revision: officialEntry.revision, bytes: new DataView(new ArrayBuffer(8)) },
      { revision: officialEntry.revision, bytes: new Int8Array(8) },
      { revision: officialEntry.revision, bytes: new Uint16Array(8) },
    ];
    for (const entry of invalid) {
      expect(() => store.putBundle(entry as BundleStoreEntry)).toThrowError(
        expect.objectContaining({ code: "INVALID_ENTRY" }),
      );
    }
    expect(getter).not.toHaveBeenCalled();
    expect(await readdir(join(root, "bundles", "sha256"))).toEqual([]);
  });

  it("rejects symlinked and hostile root configuration with redacted failures", async () => {
    const realRoot = await createRoot();
    const parent = await createRoot();
    const alias = join(parent, "bundle-store-link");
    await symlink(realRoot, alias);
    await expectStoreRejection(openBundleStore({ rootDirectory: alias }), "UNSAFE_STORAGE_PATH");

    const getter = vi.fn(() => realRoot);
    const accessor = {};
    Object.defineProperty(accessor, "rootDirectory", {
      enumerable: true,
      get: getter,
    });
    await expectStoreRejection(
      openBundleStore(accessor as { rootDirectory: string }),
      "INVALID_ROOT_DIRECTORY",
    );
    expect(getter).not.toHaveBeenCalled();

    const absentRoot = join(parent, "not-created-by-the-store");
    await expectStoreRejection(
      openBundleStore({ rootDirectory: absentRoot }),
      "INVALID_ROOT_DIRECTORY",
    );
    await expect(lstat(absentRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("exposes only immutable byte storage operations and no channel, activation, list, or delete API", async () => {
    const root = await createRoot();
    const store = await openBundleStore({ rootDirectory: root });
    expect(Object.keys(store).sort()).toEqual(["getBundle", "putBundle"]);
    expect(Object.isFrozen(store)).toBe(true);
    const sourceRoot = await import("../src/index.js");
    expect(sourceRoot).toMatchObject({
      BundleStoreError,
      openBundleStore,
    });
    expect(sourceRoot).not.toHaveProperty("openBundleStoreInternal");
    expect(sha256Digest(officialEntry.bytes)).not.toBe(officialEntry.revision);
  });
});
