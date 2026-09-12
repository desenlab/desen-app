import { describe, expect, it } from "vitest";

import {
  DESIGN_SYSTEM_RELEASE_KIND,
  DesignSystemReleaseError,
  createDesignSystemRelease,
  createDesignSystemReleaseStore,
  createHostProfileReleaseReference,
  readDesignSystemRelease,
  verifyDesignSystemRelease,
} from "../src/index.js";
import { canonicalizeJsonBytes, sha256Digest } from "@desen/protocol";

import type { DesignSystemReleaseInput, DesignSystemReleaseStore } from "../src/index.js";

const tokenSource = Object.freeze({
  id: "neutral.base",
  document: {
    color: {
      $type: "color",
      action: { $value: { colorSpace: "srgb", components: [0.1, 0.2, 0.3] } },
    },
  },
});

function input(overrides: Partial<DesignSystemReleaseInput> = {}): DesignSystemReleaseInput {
  return {
    tokenSources: [tokenSource],
    assets: [
      {
        id: "font.inter",
        kind: "font",
        mediaType: "font/woff2",
        bytes: Uint8Array.from([1, 2, 3, 4]),
      },
    ],
    recipes: [
      {
        id: "button.primary",
        document: { capability: "button", variant: "primary" },
      },
    ],
    ...overrides,
  };
}

function fixtureAsset(): DesignSystemReleaseInput["assets"][number] {
  const asset = input().assets[0];
  if (!asset) throw new Error("test fixture asset missing");
  return asset;
}

function expectSyncError(code: DesignSystemReleaseError["code"], action: () => unknown): void {
  try {
    action();
    throw new Error("expected release error");
  } catch (error) {
    expect(error).toBeInstanceOf(DesignSystemReleaseError);
    expect((error as DesignSystemReleaseError).code).toBe(code);
  }
}

async function expectAsyncError(
  code: DesignSystemReleaseError["code"],
  action: () => Promise<unknown>,
): Promise<void> {
  try {
    await action();
    throw new Error("expected release error");
  } catch (error) {
    expect(error).toBeInstanceOf(DesignSystemReleaseError);
    expect((error as DesignSystemReleaseError).code).toBe(code);
  }
}

describe("M10A-T04 immutable release identity", () => {
  it("creates a detached, content-addressed release from token, asset, and recipe snapshots", () => {
    const result = createDesignSystemRelease(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.release.kind).toBe(DESIGN_SYSTEM_RELEASE_KIND);
    expect(result.release.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(result.release.dependencyManifest).toHaveLength(3);
    expect(result.release.assets[0]?.bytes).toEqual([1, 2, 3, 4]);
    expect(Object.isFrozen(result.release)).toBe(true);
    expect(Object.isFrozen(result.release.assets[0]?.bytes)).toBe(true);

    const source = input();
    const sourceAsset = source.assets[0];
    if (!sourceAsset) throw new Error("test fixture asset missing");
    sourceAsset.bytes[0] = 99;
    expect(result.release.assets[0]?.bytes[0]).toBe(1);
    expect(verifyDesignSystemRelease(result.release)).toMatchObject({
      ok: true,
      dependencyCount: 3,
      dependencyBytes: expect.any(Number),
    });
  });

  it("is deterministic for equal inputs and changes identity for production dependencies", () => {
    const first = createDesignSystemRelease(input());
    const second = createDesignSystemRelease(input());
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.release.digest).toBe(first.release.digest);

    const changed = createDesignSystemRelease(
      input({ assets: [{ ...fixtureAsset(), bytes: Uint8Array.from([1, 2, 3, 9]) }] }),
    );
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.release.digest).not.toBe(first.release.digest);
  });

  it("rejects missing, tampered, and invalid production dependencies before release identity", () => {
    expectSyncError("LIMIT_EXCEEDED", () => createDesignSystemRelease(input({ tokenSources: [] })));
    expectSyncError("DIGEST_MISMATCH", () =>
      createDesignSystemRelease(
        input({ assets: [{ ...fixtureAsset(), digest: `sha256:${"0".repeat(64)}` }] }),
      ),
    );
    expectSyncError("INVALID_ASSET", () =>
      createDesignSystemRelease(
        input({ assets: [{ ...fixtureAsset(), mediaType: "application/x-executable" }] }),
      ),
    );
    expectSyncError("INVALID_ASSET", () =>
      createDesignSystemRelease(
        input({ assets: [{ ...fixtureAsset(), mediaType: "not a media type" }] }),
      ),
    );
  });

  it("stores exact releases atomically and resolves only an exact host-profile reference", async () => {
    const created = createDesignSystemRelease(input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const store = createDesignSystemReleaseStore();
    const entry = Object.freeze({ release: created.release });
    expect(await store.putRelease(entry)).toEqual({ status: "stored" });
    expect(await store.putRelease(entry)).toEqual({ status: "unchanged" });

    const reference = createHostProfileReleaseReference({
      hostProfileId: "web-react",
      releaseDigest: created.release.digest,
    });
    expect((await readDesignSystemRelease(store, reference)).digest).toBe(created.release.digest);
    await expectAsyncError("RELEASE_NOT_FOUND", () =>
      readDesignSystemRelease(
        store,
        createHostProfileReleaseReference({
          hostProfileId: "web-react",
          releaseDigest: `sha256:${"f".repeat(64)}`,
        }),
      ),
    );
  });

  it("recovers an interrupted store write by retrying the same immutable entry", async () => {
    const created = createDesignSystemRelease(input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const durable = createDesignSystemReleaseStore();
    let interrupted = true;
    const store: DesignSystemReleaseStore = {
      getRelease: durable.getRelease,
      async putRelease(entry) {
        if (interrupted) {
          interrupted = false;
          throw new Error("simulated interruption");
        }
        return durable.putRelease(entry);
      },
    };
    await expect(store.putRelease({ release: created.release })).rejects.toThrow();
    expect(await store.putRelease({ release: created.release })).toEqual({ status: "stored" });
    expect(
      await readDesignSystemRelease(
        store,
        createHostProfileReleaseReference({
          hostProfileId: "web-react",
          releaseDigest: created.release.digest,
        }),
      ),
    ).toEqual(created.release);
  });

  it("rejects a tampered stored snapshot instead of falling back to another release", async () => {
    const created = createDesignSystemRelease(input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const firstAsset = created.release.assets[0];
    if (!firstAsset) throw new Error("release fixture asset missing");
    const tampered = {
      ...created.release,
      assets: [{ ...firstAsset, bytes: [9, 9, 9, 9] }, ...created.release.assets.slice(1)],
    };
    const store: DesignSystemReleaseStore = {
      async getRelease() {
        return { status: "found", entry: { release: tampered } };
      },
      async putRelease() {
        return { status: "conflict" };
      },
    };
    await expectAsyncError("DIGEST_MISMATCH", () =>
      readDesignSystemRelease(
        store,
        createHostProfileReleaseReference({
          hostProfileId: "web-react",
          releaseDigest: created.release.digest,
        }),
      ),
    );

    expectSyncError("DIGEST_MISMATCH", () =>
      verifyDesignSystemRelease({
        ...created.release,
        assets: [],
      }),
    );
  });

  it("rejects sparse asset snapshots and malformed store entries", async () => {
    const created = createDesignSystemRelease(input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const firstAsset = created.release.assets[0];
    if (!firstAsset) throw new Error("release fixture asset missing");
    const sparseBytes = new Array<number>(firstAsset.bytes.length);
    sparseBytes[0] = firstAsset.bytes[0] ?? 0;
    expectSyncError("INVALID_ASSET", () =>
      verifyDesignSystemRelease({
        ...created.release,
        assets: [{ ...firstAsset, bytes: sparseBytes }, ...created.release.assets.slice(1)],
      }),
    );
    const store = createDesignSystemReleaseStore();
    await expectAsyncError("STORE_FAILURE", () =>
      store.putRelease(undefined as unknown as { release: typeof created.release }),
    );
  });

  it("requires the exact ordered manifest and complete snapshot projection", () => {
    const ordered = createDesignSystemRelease(
      input({
        tokenSources: [
          tokenSource,
          {
            id: "neutral.override",
            document: {
              color: {
                $type: "color",
                action: { $value: { colorSpace: "srgb", components: [0.4, 0.5, 0.6] } },
              },
            },
          },
        ],
        assets: [
          fixtureAsset(),
          {
            id: "icon.logo",
            kind: "icon",
            mediaType: "image/svg+xml",
            bytes: Uint8Array.from([5, 6, 7, 8]),
          },
        ],
      }),
    );
    expect(ordered.ok).toBe(true);
    if (!ordered.ok) return;
    expectSyncError("DIGEST_MISMATCH", () =>
      verifyDesignSystemRelease({
        ...ordered.release,
        tokenSources: [...ordered.release.tokenSources].reverse(),
      }),
    );
    const firstAsset = ordered.release.assets[0];
    if (!firstAsset) throw new Error("release fixture asset missing");
    expectSyncError("DUPLICATE_DEPENDENCY_ID", () =>
      verifyDesignSystemRelease({ ...ordered.release, assets: [firstAsset, firstAsset] }),
    );
    expectSyncError("INVALID_INPUT", () =>
      verifyDesignSystemRelease({
        ...ordered.release,
        dependencyManifest: ordered.release.dependencyManifest.map((dependency, index) =>
          index === 0 ? { ...dependency, unused: "hidden input" } : dependency,
        ),
      }),
    );
    expectSyncError("INVALID_INPUT", () =>
      verifyDesignSystemRelease({
        ...ordered.release,
        execute: () => undefined,
      } as typeof ordered.release),
    );
  });

  it("reapplies category limits and rejects authority-bearing recipe metadata", () => {
    const emptyDigest = sha256Digest(
      canonicalizeJsonBytes({
        kind: DESIGN_SYSTEM_RELEASE_KIND,
        schemaVersion: 1,
        dependencies: [],
      }),
    );
    expectSyncError("LIMIT_EXCEEDED", () =>
      verifyDesignSystemRelease({
        kind: DESIGN_SYSTEM_RELEASE_KIND,
        schemaVersion: 1,
        digest: emptyDigest,
        dependencyManifest: [],
        tokenSources: [],
        assets: [],
        recipes: [],
      }),
    );
    expectSyncError("INVALID_RECIPE", () =>
      createDesignSystemRelease(
        input({
          recipes: [
            {
              id: "unsafe.recipe",
              document: {
                module: "third-party",
                loaderPath: "/tmp/plugin.mjs",
                networkDestination: "https://example.invalid",
                credentials: "secret",
                execute: "not executable here",
              },
            },
          ],
        }),
      ),
    );
    for (const key of ["access_token", "API-KEY", "loader_path", "network.destination"]) {
      expectSyncError("INVALID_RECIPE", () =>
        createDesignSystemRelease(
          input({
            recipes: [{ id: "normalized.unsafe.recipe", document: { [key]: "forbidden" } }],
          }),
        ),
      );
    }
    for (const key of ["access_token", "API-KEY", "loader_path", "network.destination"]) {
      expectSyncError("INVALID_TOKEN_SOURCE", () =>
        createDesignSystemRelease(
          input({
            tokenSources: [
              {
                id: "unsafe.token",
                document: {
                  color: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0.1, 0.2, 0.3] },
                    $extensions: { [key]: "forbidden" },
                  },
                },
              },
            ],
          }),
        ),
      );
    }
    expectSyncError("INVALID_ASSET", () =>
      createDesignSystemRelease(
        input({
          assets: [
            {
              ...fixtureAsset(),
              mediaType: `image/${"a".repeat(513)}`,
            },
          ],
        }),
      ),
    );
    let nested: unknown = { capability: "button" };
    for (let index = 0; index <= 64; index += 1) nested = { child: nested };
    expectSyncError("LIMIT_EXCEEDED", () =>
      createDesignSystemRelease(
        input({ recipes: [{ id: "deep.recipe", document: nested as Record<string, never> }] }),
      ),
    );
  });

  it("stores and returns detached immutable releases", async () => {
    const created = createDesignSystemRelease(input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const mutable = JSON.parse(JSON.stringify(created.release)) as {
      assets: { bytes: number[] }[];
    } & typeof created.release;
    const store = createDesignSystemReleaseStore();
    await store.putRelease({ release: mutable });
    const mutableAsset = mutable.assets[0];
    if (!mutableAsset) throw new Error("mutable asset missing");
    mutableAsset.bytes[0] = 99;
    const resolved = await readDesignSystemRelease(
      store,
      createHostProfileReleaseReference({
        hostProfileId: "web-react",
        releaseDigest: created.release.digest,
      }),
    );
    expect(resolved.assets[0]?.bytes).toEqual([1, 2, 3, 4]);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.assets[0]?.bytes)).toBe(true);

    const unsafeStore: DesignSystemReleaseStore = {
      async getRelease() {
        return {
          status: "found",
          entry: { release: { ...created.release, execute: () => undefined } },
        } as unknown as Awaited<ReturnType<DesignSystemReleaseStore["getRelease"]>>;
      },
      async putRelease() {
        return { status: "conflict" };
      },
    };
    await expectAsyncError("INVALID_INPUT", () =>
      readDesignSystemRelease(
        unsafeStore,
        createHostProfileReleaseReference({
          hostProfileId: "web-react",
          releaseDigest: created.release.digest,
        }),
      ),
    );

    const accessorRelease = {
      kind: DESIGN_SYSTEM_RELEASE_KIND,
      schemaVersion: 1,
      dependencyManifest: created.release.dependencyManifest,
      tokenSources: created.release.tokenSources,
      assets: created.release.assets,
      recipes: created.release.recipes,
    };
    Object.defineProperty(accessorRelease, "digest", {
      enumerable: true,
      get() {
        throw new Error("untrusted getter must not run");
      },
    });
    const accessorStore: DesignSystemReleaseStore = {
      async getRelease() {
        return {
          status: "found",
          entry: { release: accessorRelease },
        } as unknown as Awaited<ReturnType<DesignSystemReleaseStore["getRelease"]>>;
      },
      async putRelease() {
        return { status: "conflict" };
      },
    };
    await expectAsyncError("INVALID_INPUT", () =>
      readDesignSystemRelease(
        accessorStore,
        createHostProfileReleaseReference({
          hostProfileId: "web-react",
          releaseDigest: created.release.digest,
        }),
      ),
    );
  });
});
