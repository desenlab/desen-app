import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { calculateDesenBundleRevision, canonicalizeJsonBytes } from "@desen/protocol";
import { validateDesenCatalogSet, validateDesenStructure } from "@desen/validator";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  BUNDLE_PACKAGE_PREFLIGHT_LIMITS,
  INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE,
  INVALID_INSTALLED_PACKAGE_CODE,
  PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE,
  PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
  preflightBundlePackages,
  verifyBundleStoreEntry,
} from "../src/index.js";
import {
  isBundlePackagePreflightAuthority,
  preflightBundlePackagesInternal,
  readBundlePackagePreflightAuthority,
} from "../src/package-preflight-internal.js";
import { calculateWebReactPackageDigest } from "../src/package-preflight-web-react.js";

import type {
  BundleIntegrityAuthority,
  BundleIntegrityVerificationResult,
  BundlePackagePreflightResult,
  InstalledPackageArtifact,
  InstalledPackageCandidate,
} from "../src/index.js";
import type { DesenCatalog } from "@desen/protocol";

const FIXTURE_ROOT = resolve(import.meta.dirname, "../../..");
const BUNDLE_PATH = join(FIXTURE_ROOT, "examples/sign-in/official-derived.bundle.desen.json");
const OFFICIAL_CATALOG_PATH = join(
  FIXTURE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
);
const HISTORICAL_REFERENCE_DIGEST =
  "sha256:4ebfc62068695cd569555c96607248fa592ca95c98364db9a6daaa15b65d8b2e";
const PROFILE_MAGIC = ascii("DESEN-WEB-REACT-PACKAGE-DIGEST-V1\n");
const PACKAGE_DIGEST_PLACEHOLDER = `sha256:${"0".repeat(64)}`;
const FIXED_GOLDEN_DIGEST =
  "sha256:5a706536f9319476d39883bd2a4fddb9fb839c261e82452de397983d2edceadd";

const BASE_CATALOG = {
  kind: "desen.catalog",
  desen: "0.1.0",
  id: "com.example.reference",
  version: "1.0.0",
  target: "web-react",
  packageDigest: PACKAGE_DIGEST_PLACEHOLDER,
  components: {},
  behaviors: {},
  operations: {},
  resources: {},
} satisfies DesenCatalog;

interface PackageFixture {
  readonly candidate: InstalledPackageCandidate;
  readonly digest: string;
  readonly framedByteLength: number;
  readonly requirement: Readonly<{
    readonly id: string;
    readonly version: string;
    readonly target: string;
    readonly digest: string;
  }>;
}

let bundleTemplate: Record<string, unknown>;
let officialCatalog: Record<string, unknown>;

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function jsonRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function uint16BigEndian(value: number): Uint8Array {
  return Uint8Array.of(value >>> 8, value);
}

function uint32BigEndian(value: number): Uint8Array {
  return Uint8Array.of(value >>> 24, value >>> 16, value >>> 8, value);
}

function independentlyDigestPackage(
  catalog: Record<string, unknown>,
  artifacts: readonly InstalledPackageArtifact[],
): Readonly<{ readonly digest: string; readonly framedByteLength: number }> {
  const projectedCatalog = cloneJson(catalog);
  projectedCatalog.packageDigest = PACKAGE_DIGEST_PLACEHOLDER;
  const entries = [
    { path: "catalog.json", bytes: canonicalizeJsonBytes(projectedCatalog) },
    ...artifacts.map((artifact) => ({ path: artifact.path, bytes: artifact.bytes })),
  ].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  const hash = createHash("sha256");
  hash.update(PROFILE_MAGIC);
  hash.update(uint32BigEndian(entries.length));
  let framedByteLength = PROFILE_MAGIC.byteLength + 4;
  for (const entry of entries) {
    const pathBytes = ascii(entry.path);
    hash.update(uint16BigEndian(pathBytes.byteLength));
    hash.update(pathBytes);
    hash.update(uint32BigEndian(entry.bytes.byteLength));
    hash.update(entry.bytes);
    framedByteLength += 2 + pathBytes.byteLength + 4 + entry.bytes.byteLength;
  }
  return Object.freeze({
    digest: `sha256:${hash.digest("hex")}`,
    framedByteLength,
  });
}

function packageFixture(
  catalogInput: Record<string, unknown> = cloneJson(BASE_CATALOG),
  artifacts: readonly InstalledPackageArtifact[] = [
    { path: "adapters/production.js", bytes: ascii("export const render = 1;\n") },
    { path: "styles/reference.css", bytes: ascii(".root{display:block}\n") },
  ],
): PackageFixture {
  const catalog = cloneJson(catalogInput);
  const calculated = independentlyDigestPackage(catalog, artifacts);
  catalog.packageDigest = calculated.digest;
  const id = String(catalog.id);
  const version = String(catalog.version);
  const target = String(catalog.target);
  return Object.freeze({
    candidate: {
      id,
      version,
      target,
      catalog,
      artifacts,
    },
    digest: calculated.digest,
    framedByteLength: calculated.framedByteLength,
    requirement: Object.freeze({ id, version, target, digest: calculated.digest }),
  });
}

function verifyRequirements(
  requirements: readonly Readonly<{
    readonly id: string;
    readonly version: string;
    readonly target: string;
    readonly digest: string;
  }>[],
): BundleIntegrityVerificationResult {
  const bundle = cloneJson(bundleTemplate);
  bundle.requires = { catalogs: requirements };
  bundle.revision = calculateDesenBundleRevision(bundle);
  return verifyBundleStoreEntry(
    {
      revision: String(bundle.revision),
      bytes: canonicalizeJsonBytes(bundle),
    },
    { status: "not-available" },
  );
}

function authorityFor(
  requirements: readonly Readonly<{
    readonly id: string;
    readonly version: string;
    readonly target: string;
    readonly digest: string;
  }>[],
): BundleIntegrityAuthority {
  const integrity = verifyRequirements(requirements);
  expect(integrity.status).toBe("verified");
  if (integrity.status !== "verified") {
    throw new TypeError("Expected the exact fixture Bundle to pass M07-T02 verification.");
  }
  return integrity.authority;
}

function requirePreflighted(
  result: BundlePackagePreflightResult,
): Extract<BundlePackagePreflightResult, { readonly status: "preflighted" }> {
  expect(result.status).toBe("preflighted");
  if (result.status !== "preflighted") throw new TypeError("Expected package preflight success.");
  return result;
}

function requireRejected(
  result: BundlePackagePreflightResult,
  stage: string,
  code: string,
): Extract<BundlePackagePreflightResult, { readonly status: "rejected" }> {
  expect(result.status).toBe("rejected");
  if (result.status !== "rejected") throw new TypeError("Expected package preflight rejection.");
  expect(result.stage).toBe(stage);
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.diagnostics)).toBe(true);
  for (const diagnostic of result.diagnostics) {
    expect(Object.isFrozen(diagnostic)).toBe(true);
    expect(diagnostic).not.toHaveProperty("cause");
  }
  expect(result).not.toHaveProperty("authority");
  return result;
}

function nestedValueAtDepth(maximumDepth: number): unknown {
  let value: unknown = "leaf";
  for (let depth = 1; depth < maximumDepth; depth += 1) value = { nested: value };
  return value;
}

beforeAll(async () => {
  bundleTemplate = jsonRecord(JSON.parse(await readFile(BUNDLE_PATH, "utf8")), "Bundle fixture");
  officialCatalog = jsonRecord(
    JSON.parse(await readFile(OFFICIAL_CATALOG_PATH, "utf8")),
    "Official Catalog fixture",
  );
});

describe("M07-T03 exact installed-package preflight", () => {
  it("matches the independent Web–React v1 framing golden and returns only opaque frozen authority", () => {
    const fixture = packageFixture();
    expect(fixture.digest).toBe(FIXED_GOLDEN_DIGEST);
    expect(fixture.framedByteLength).toBe(416);
    const authority = authorityFor([fixture.requirement]);

    const accepted = requirePreflighted(preflightBundlePackages(authority, [fixture.candidate]));
    expect(accepted.authority).toEqual({
      protocolVersion: "0.1.0",
      revision: authority.revision,
      packages: [
        {
          id: "com.example.reference",
          version: "1.0.0",
          target: "web-react",
          packageDigest: FIXED_GOLDEN_DIGEST,
          digestProfile: "desen.web-react.package-digest",
          digestProfileVersion: 1,
          artifactCount: 2,
          framedByteLength: 416,
        },
      ],
      requirementPackageIndexes: [0],
    });
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(accepted.authority)).toBe(true);
    expect(Object.isFrozen(accepted.authority.packages)).toBe(true);
    expect(Object.isFrozen(accepted.authority.packages[0])).toBe(true);
    expect(Object.isFrozen(accepted.authority.requirementPackageIndexes)).toBe(true);
    expect(accepted.authority).not.toHaveProperty("catalog");
    expect(accepted.authority).not.toHaveProperty("artifacts");
    expect(accepted.authority).not.toHaveProperty("activate");
    expect(isBundlePackagePreflightAuthority(accepted.authority)).toBe(true);
    expect(isBundlePackagePreflightAuthority({ ...accepted.authority })).toBe(false);

    const privateRecord = readBundlePackagePreflightAuthority(accepted.authority);
    expect(privateRecord?.packages[0]?.catalog.packageDigest).toBe(FIXED_GOLDEN_DIGEST);
    expect(privateRecord?.packages[0]?.artifacts.map(({ path }) => path)).toEqual([
      "adapters/production.js",
      "styles/reference.css",
    ]);
    const callerBytes = fixture.candidate.artifacts[0]?.bytes as Uint8Array;
    callerBytes.fill(0);
    expect(privateRecord?.packages[0]?.artifacts[0]?.bytes).toEqual(
      ascii("export const render = 1;\n"),
    );
  });

  it("accepts the exact candidate in either order without observing hostile newer material", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement]);
    let hostileObservations = 0;
    const hostileCatalog = new Proxy(
      {},
      {
        ownKeys() {
          hostileObservations += 1;
          throw new Error("newer unselected Catalog must remain unobserved");
        },
      },
    );
    const hostileArtifacts = new Proxy([], {
      ownKeys() {
        hostileObservations += 1;
        throw new Error("newer unselected artifacts must remain unobserved");
      },
    }) as unknown as readonly InstalledPackageArtifact[];
    const newerCandidate: InstalledPackageCandidate = {
      id: fixture.candidate.id,
      version: "1.0.1",
      target: fixture.candidate.target,
      catalog: hostileCatalog,
      artifacts: hostileArtifacts,
    };

    const exactFirst = requirePreflighted(
      preflightBundlePackages(authority, [fixture.candidate, newerCandidate]),
    );
    const exactLast = requirePreflighted(
      preflightBundlePackages(authority, [newerCandidate, fixture.candidate]),
    );
    expect(exactFirst.authority.packages).toEqual(exactLast.authority.packages);
    expect(exactFirst.authority.requirementPackageIndexes).toEqual(
      exactLast.authority.requirementPackageIndexes,
    );
    expect(hostileObservations).toBe(0);
  });

  it("rejects a wrong package id without trimming whitespace", () => {
    const fixture = packageFixture();
    requireRejected(
      preflightBundlePackages(authorityFor([fixture.requirement]), [
        { ...fixture.candidate, id: `${fixture.candidate.id} ` },
      ]),
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
    );
  });

  it("rejects a newer installed version instead of silently selecting the newest", () => {
    const fixture = packageFixture();
    requireRejected(
      preflightBundlePackages(authorityFor([fixture.requirement]), [
        { ...fixture.candidate, version: "99.0.0" },
      ]),
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
    );
  });

  it("rejects target case, Unicode-hyphen, and trailing-whitespace aliases", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement]);
    for (const target of ["Web-react", "web\u2011react", "web-react "]) {
      requireRejected(
        preflightBundlePackages(authority, [{ ...fixture.candidate, target }]),
        "package-resolution",
        "CATALOG_VERSION_UNAVAILABLE",
      );
    }
  });

  it("rejects canonically equivalent composed and decomposed package ids", () => {
    const composed = packageFixture({ ...cloneJson(BASE_CATALOG), id: "com.example.café" });
    requireRejected(
      preflightBundlePackages(authorityFor([composed.requirement]), [
        { ...composed.candidate, id: "com.example.cafe\u0301" },
      ]),
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
    );
  });

  it("resolves only one literal id/version/target tuple without observing unselected material", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement]);
    let unselectedMaterialObserved = false;
    const hostileCatalog = new Proxy(
      {},
      {
        ownKeys() {
          unselectedMaterialObserved = true;
          throw new Error("unselected Catalog material must stay unobserved");
        },
      },
    );
    const newerCandidate: InstalledPackageCandidate = {
      id: fixture.candidate.id,
      version: "1.0.1",
      target: fixture.candidate.target,
      catalog: hostileCatalog,
      artifacts: [],
    };

    requireRejected(
      preflightBundlePackages(authority, [newerCandidate]),
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
    );
    expect(unselectedMaterialObserved).toBe(false);

    requireRejected(
      preflightBundlePackages(authority, [fixture.candidate, fixture.candidate]),
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
    );
    requireRejected(
      preflightBundlePackages(authority, [{ ...fixture.candidate, target: "Web-react" }]),
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
    );
    requireRejected(
      preflightBundlePackages(authority, []),
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
    );
  });

  it("preserves duplicate requirement positions while sharing one uniquely verified package", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement, fixture.requirement]);
    const accepted = requirePreflighted(preflightBundlePackages(authority, [fixture.candidate]));

    expect(accepted.authority.packages).toHaveLength(1);
    expect(accepted.authority.requirementPackageIndexes).toEqual([0, 0]);
    expect(readBundlePackagePreflightAuthority(accepted.authority)?.packages).toHaveLength(1);
  });

  it("rejects byte, path, Catalog, declared-digest, and envelope identity drift", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement]);
    const mutations: InstalledPackageCandidate[] = [
      {
        ...fixture.candidate,
        artifacts: [
          { path: "adapters/production.js", bytes: ascii("export const render = 2;\n") },
          fixture.candidate.artifacts[1] as InstalledPackageArtifact,
        ],
      },
      {
        ...fixture.candidate,
        artifacts: [
          { path: "adapters/production-v2.js", bytes: ascii("export const render = 1;\n") },
          fixture.candidate.artifacts[1] as InstalledPackageArtifact,
        ],
      },
      {
        ...fixture.candidate,
        catalog: {
          ...(fixture.candidate.catalog as Record<string, unknown>),
          extensions: { marker: "changed" },
        },
      },
      {
        ...fixture.candidate,
        catalog: {
          ...(fixture.candidate.catalog as Record<string, unknown>),
          packageDigest: `sha256:${"f".repeat(64)}`,
        },
      },
    ];

    for (const mutation of mutations) {
      requireRejected(
        preflightBundlePackages(authority, [mutation]),
        "package-digest",
        "CATALOG_DIGEST_MISMATCH",
      );
    }

    const mismatchedEnvelope = {
      ...fixture.candidate,
      version: "1.0.1",
    };
    const mismatchedRequirement = {
      ...fixture.requirement,
      version: "1.0.1",
    };
    requireRejected(
      preflightBundlePackages(authorityFor([mismatchedRequirement]), [mismatchedEnvelope]),
      "package-catalog",
      INVALID_INSTALLED_PACKAGE_CODE,
    );
  });

  it("rejects a historical digest even when Bundle and Catalog repeat the same stale value", () => {
    const fixture = packageFixture();
    const staleCatalog = {
      ...(fixture.candidate.catalog as Record<string, unknown>),
      packageDigest: HISTORICAL_REFERENCE_DIGEST,
    };
    const staleRequirement = {
      ...fixture.requirement,
      digest: HISTORICAL_REFERENCE_DIGEST,
    };
    requireRejected(
      preflightBundlePackages(authorityFor([staleRequirement]), [
        { ...fixture.candidate, catalog: staleCatalog },
      ]),
      "package-digest",
      "CATALOG_DIGEST_MISMATCH",
    );
  });

  it("rejects artifact addition, removal, and rename against the pinned package digest", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement]);
    const first = fixture.candidate.artifacts[0] as InstalledPackageArtifact;
    const second = fixture.candidate.artifacts[1] as InstalledPackageArtifact;
    const mutations: readonly InstalledPackageCandidate[] = [
      {
        ...fixture.candidate,
        artifacts: [...fixture.candidate.artifacts, { path: "dist/extra.js", bytes: ascii("x") }],
      },
      { ...fixture.candidate, artifacts: [first] },
      {
        ...fixture.candidate,
        artifacts: [{ path: "adapters/renamed.js", bytes: first.bytes }, second],
      },
    ];
    for (const mutation of mutations) {
      requireRejected(
        preflightBundlePackages(authority, [mutation]),
        "package-digest",
        "CATALOG_DIGEST_MISMATCH",
      );
    }
  });

  it("rejects duplicate artifact paths and the reserved catalog.json path before hashing", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement]);
    const duplicate = [
      { path: "dist/duplicate.js", bytes: ascii("first") },
      { path: "dist/duplicate.js", bytes: ascii("second") },
    ];
    const reserved = [{ path: "catalog.json", bytes: ascii("shadow") }];
    for (const artifacts of [duplicate, reserved]) {
      requireRejected(
        preflightBundlePackages(authority, [{ ...fixture.candidate, artifacts }]),
        "package-digest",
        INVALID_INSTALLED_PACKAGE_CODE,
      );
    }
  });

  it("accepts an empty artifact inventory and an explicitly fingerprinted zero-byte artifact", () => {
    const empty = packageFixture(cloneJson(BASE_CATALOG), []);
    const emptyAccepted = requirePreflighted(
      preflightBundlePackages(authorityFor([empty.requirement]), [empty.candidate]),
    );
    expect(emptyAccepted.authority.packages[0]?.artifactCount).toBe(0);

    const zeroByte = packageFixture(cloneJson(BASE_CATALOG), [
      { path: "dist/empty.js", bytes: new Uint8Array() },
    ]);
    const zeroAccepted = requirePreflighted(
      preflightBundlePackages(authorityFor([zeroByte.requirement]), [zeroByte.candidate]),
    );
    expect(zeroAccepted.authority.packages[0]?.artifactCount).toBe(1);
  });

  it("snapshots only the exact Uint8Array subview before caller mutation", () => {
    const expected = ascii("exact-subview");
    const backing = new Uint8Array(expected.byteLength + 8);
    backing.fill(0xff);
    backing.set(expected, 4);
    const subview = backing.subarray(4, 4 + expected.byteLength);
    const fixture = packageFixture(cloneJson(BASE_CATALOG), [
      { path: "dist/subview.bin", bytes: subview },
    ]);
    const accepted = requirePreflighted(
      preflightBundlePackages(authorityFor([fixture.requirement]), [fixture.candidate]),
    );
    backing.fill(0);
    expect(
      readBundlePackagePreflightAuthority(accepted.authority)?.packages[0]?.artifacts[0]?.bytes,
    ).toEqual(expected);
  });

  it("rejects detached and Proxy-backed artifact bytes without running Proxy traps", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement]);
    const detachedBuffer = new ArrayBuffer(8);
    const detachedView = new Uint8Array(detachedBuffer);
    structuredClone(detachedBuffer, { transfer: [detachedBuffer] });
    requireRejected(
      preflightBundlePackages(authority, [
        {
          ...fixture.candidate,
          artifacts: [{ path: "dist/detached.bin", bytes: detachedView }],
        },
      ]),
      "package-digest",
      INVALID_INSTALLED_PACKAGE_CODE,
    );

    let proxyTraps = 0;
    const proxiedBytes = new Proxy(new Uint8Array([1]), {
      get() {
        proxyTraps += 1;
        throw new Error("byte Proxy traps must not run");
      },
    }) as unknown as Uint8Array;
    const proxiedArtifact = new Proxy(
      { path: "dist/proxy.bin", bytes: new Uint8Array([1]) },
      {
        ownKeys() {
          proxyTraps += 1;
          throw new Error("artifact Proxy traps must not run");
        },
      },
    );
    for (const artifacts of [
      [{ path: "dist/proxy-bytes.bin", bytes: proxiedBytes }],
      [proxiedArtifact as InstalledPackageArtifact],
    ]) {
      requireRejected(
        preflightBundlePackages(authority, [{ ...fixture.candidate, artifacts }]),
        "package-digest",
        INVALID_INSTALLED_PACKAGE_CODE,
      );
    }
    expect(proxyTraps).toBe(0);
  });

  it("stops invalid requirement SemVer at M07-T02 so it cannot forge M07-T03 authority", () => {
    const fixture = packageFixture();
    const invalidIntegrity = verifyRequirements([{ ...fixture.requirement, version: "^1.0.0" }]);
    expect(invalidIntegrity).toMatchObject({ status: "rejected", stage: "bundle-schema" });
    expect(invalidIntegrity).not.toHaveProperty("authority");
    let inventoryObserved = false;
    const hostileInventory = new Proxy([], {
      ownKeys() {
        inventoryObserved = true;
        throw new Error("invalid upstream input must not reach package inventory");
      },
    }) as unknown as readonly InstalledPackageCandidate[];
    const missingAuthority = (
      invalidIntegrity as BundleIntegrityVerificationResult & {
        readonly authority?: BundleIntegrityAuthority;
      }
    ).authority as BundleIntegrityAuthority;
    requireRejected(
      preflightBundlePackages(missingAuthority, hostileInventory),
      "integrity-authority",
      INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE,
    );
    expect(inventoryObserved).toBe(false);
  });

  it("rejects forged authority and hostile records without invoking accessors", () => {
    const fixture = packageFixture();
    let inventoryObserved = false;
    const hostileInventory = new Proxy([], {
      ownKeys() {
        inventoryObserved = true;
        throw new Error("forged authority must win before inventory observation");
      },
    }) as unknown as readonly InstalledPackageCandidate[];
    const forged = {
      protocolVersion: "0.1.0",
      revision: authorityFor([fixture.requirement]).revision,
    } as unknown as BundleIntegrityAuthority;

    requireRejected(
      preflightBundlePackages(forged, hostileInventory),
      "integrity-authority",
      INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE,
    );
    expect(inventoryObserved).toBe(false);

    const catalogGetter = vi.fn(() => fixture.candidate.catalog);
    const accessorCandidate = {
      id: fixture.candidate.id,
      version: fixture.candidate.version,
      target: fixture.candidate.target,
      artifacts: fixture.candidate.artifacts,
    } as Record<string, unknown>;
    Object.defineProperty(accessorCandidate, "catalog", {
      enumerable: true,
      get: catalogGetter,
    });
    requireRejected(
      preflightBundlePackages(authorityFor([fixture.requirement]), [
        accessorCandidate as unknown as InstalledPackageCandidate,
      ]),
      "package-inventory",
      INVALID_INSTALLED_PACKAGE_CODE,
    );
    expect(catalogGetter).not.toHaveBeenCalled();

    const sparse = new Array<InstalledPackageCandidate>(1);
    requireRejected(
      preflightBundlePackages(authorityFor([fixture.requirement]), sparse),
      "package-inventory",
      INVALID_INSTALLED_PACKAGE_CODE,
    );

    const catalogWithAccessor = cloneJson(fixture.candidate.catalog as Record<string, unknown>);
    const componentsGetter = vi.fn(() => ({}));
    Object.defineProperty(catalogWithAccessor, "components", {
      enumerable: true,
      get: componentsGetter,
    });
    requireRejected(
      preflightBundlePackages(authorityFor([fixture.requirement]), [
        { ...fixture.candidate, catalog: catalogWithAccessor },
      ]),
      "package-catalog",
      INVALID_INSTALLED_PACKAGE_CODE,
    );
    expect(componentsGetter).not.toHaveBeenCalled();
  });

  it("accepts only detached Uint8Array views and refuses shared or differently typed memory", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement]);
    const typedMutation = {
      ...fixture.candidate,
      artifacts: [
        {
          path: "adapters/production.js",
          bytes: new Uint16Array([1]) as unknown as Uint8Array,
        },
      ],
    };
    requireRejected(
      preflightBundlePackages(authority, [typedMutation]),
      "package-digest",
      INVALID_INSTALLED_PACKAGE_CODE,
    );

    if (typeof SharedArrayBuffer !== "undefined") {
      const sharedMutation = {
        ...fixture.candidate,
        artifacts: [
          {
            path: "adapters/production.js",
            bytes: new Uint8Array(new SharedArrayBuffer(1)),
          },
        ],
      };
      requireRejected(
        preflightBundlePackages(authority, [sharedMutation]),
        "package-digest",
        INVALID_INSTALLED_PACKAGE_CODE,
      );
    }
  });

  it("enforces the immutable inventory, identity, artifact, path, Catalog-depth, and requirement limits", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement]);
    expect(Object.isFrozen(BUNDLE_PACKAGE_PREFLIGHT_LIMITS)).toBe(true);

    requireRejected(
      preflightBundlePackages(
        authority,
        Array.from(
          { length: BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCandidates + 1 },
          () => fixture.candidate,
        ),
      ),
      "package-inventory",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );
    requireRejected(
      preflightBundlePackages(authority, [
        {
          ...fixture.candidate,
          id: "x".repeat(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxIdentityStringCodeUnits + 1),
        },
      ]),
      "package-inventory",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );
    requireRejected(
      preflightBundlePackages(authority, [
        {
          ...fixture.candidate,
          artifacts: [
            {
              path: "x".repeat(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactPathBytes + 1),
              bytes: new Uint8Array(),
            },
          ],
        },
      ]),
      "package-digest",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );
    requireRejected(
      preflightBundlePackages(authority, [
        {
          ...fixture.candidate,
          artifacts: Array.from(
            { length: BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactsPerPackage + 1 },
            (_, index) => ({ path: `dist/file-${String(index)}.js`, bytes: new Uint8Array() }),
          ),
        },
      ]),
      "package-digest",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );

    let nested: Record<string, unknown> = {};
    for (let depth = 0; depth <= BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogDepth; depth += 1) {
      nested = { nested };
    }
    requireRejected(
      preflightBundlePackages(authority, [
        {
          ...fixture.candidate,
          catalog: {
            ...(fixture.candidate.catalog as Record<string, unknown>),
            extensions: nested,
          },
        },
      ]),
      "package-catalog",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );

    const excessiveRequirements = Array.from(
      { length: BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxRequirements + 1 },
      () => fixture.requirement,
    );
    requireRejected(
      preflightBundlePackages(authorityFor(excessiveRequirements), [fixture.candidate]),
      "package-requirements",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );
  });

  it("accepts the exact candidate-count and identity-length boundaries", () => {
    const fixture = packageFixture();
    const boundaryIdentityCandidate: InstalledPackageCandidate = {
      id: "x".repeat(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxIdentityStringCodeUnits),
      version: "1.0.0",
      target: "web-react",
      catalog: {},
      artifacts: [],
    };
    const candidates = [
      fixture.candidate,
      ...Array.from(
        { length: BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCandidates - 1 },
        () => boundaryIdentityCandidate,
      ),
    ];
    requirePreflighted(preflightBundlePackages(authorityFor([fixture.requirement]), candidates));
  });

  it("accepts exact artifact-path and artifact-count boundaries when the digest covers them", () => {
    const pathBoundary = packageFixture(cloneJson(BASE_CATALOG), [
      {
        path: "x".repeat(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactPathBytes),
        bytes: new Uint8Array(),
      },
    ]);
    requirePreflighted(
      preflightBundlePackages(authorityFor([pathBoundary.requirement]), [pathBoundary.candidate]),
    );

    const artifactBoundary = packageFixture(
      cloneJson(BASE_CATALOG),
      Array.from(
        { length: BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactsPerPackage },
        (_, index) => ({ path: `dist/boundary-${String(index)}.js`, bytes: new Uint8Array() }),
      ),
    );
    const accepted = requirePreflighted(
      preflightBundlePackages(authorityFor([artifactBoundary.requirement]), [
        artifactBoundary.candidate,
      ]),
    );
    expect(accepted.authority.packages[0]?.artifactCount).toBe(
      BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactsPerPackage,
    );
  });

  it("accepts exact Catalog-depth and requirement-count boundaries", () => {
    const depthBoundary = packageFixture({
      ...cloneJson(BASE_CATALOG),
      extensions: nestedValueAtDepth(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogDepth),
    });
    requirePreflighted(
      preflightBundlePackages(authorityFor([depthBoundary.requirement]), [depthBoundary.candidate]),
    );

    const requirements = Array.from(
      { length: BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxRequirements },
      () => depthBoundary.requirement,
    );
    const accepted = requirePreflighted(
      preflightBundlePackages(authorityFor(requirements), [depthBoundary.candidate]),
    );
    expect(accepted.authority.requirementPackageIndexes).toHaveLength(
      BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxRequirements,
    );
  });

  it("enforces Catalog value, string, canonical-byte, and artifact-entry ceilings", () => {
    const fixture = packageFixture();
    const authority = authorityFor([fixture.requirement]);

    requireRejected(
      preflightBundlePackages(authority, [
        {
          ...fixture.candidate,
          catalog: {
            ...(fixture.candidate.catalog as Record<string, unknown>),
            extensions: Array.from(
              { length: BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogValueOccurrences },
              () => null,
            ),
          },
        },
      ]),
      "package-catalog",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );

    requireRejected(
      preflightBundlePackages(authority, [
        {
          ...fixture.candidate,
          catalog: {
            ...(fixture.candidate.catalog as Record<string, unknown>),
            extensions: "x".repeat(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogStringCodeUnits + 1),
          },
        },
      ]),
      "package-catalog",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );

    const escapedCanonicalPayload = "\0".repeat(
      Math.ceil((BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogCanonicalBytes + 1) / 6),
    );
    expect(escapedCanonicalPayload.length).toBeLessThan(
      BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogStringCodeUnits,
    );
    const canonicalLimitCatalog = {
      ...(fixture.candidate.catalog as Record<string, unknown>),
      extensions: escapedCanonicalPayload,
    };
    expect(canonicalizeJsonBytes(canonicalLimitCatalog).byteLength).toBeGreaterThan(
      BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogCanonicalBytes,
    );
    requireRejected(
      preflightBundlePackages(authority, [
        {
          ...fixture.candidate,
          catalog: canonicalLimitCatalog,
        },
      ]),
      "package-catalog",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );

    requireRejected(
      preflightBundlePackages(authority, [
        {
          ...fixture.candidate,
          artifacts: [
            {
              path: "dist/oversized-entry.js",
              bytes: new Uint8Array(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactEntryBytes + 1),
            },
          ],
        },
      ]),
      "package-digest",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );
  });

  it("enforces aggregate Catalog and capability-declaration ceilings", () => {
    const aggregateDigest = PACKAGE_DIGEST_PLACEHOLDER;
    const aggregateCatalogBases = Array.from({ length: 5 }, (_, index) => ({
      ...cloneJson(BASE_CATALOG),
      id: `com.example.aggregate${String(index)}`,
      packageDigest: aggregateDigest,
      extensions: { payload: "" },
    }));
    const largestBaseLength = Math.max(
      ...aggregateCatalogBases.map((catalog) => canonicalizeJsonBytes(catalog).byteLength),
    );
    const sharedPayload = "\0".repeat(
      Math.floor(
        (BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogCanonicalBytes - largestBaseLength - 1) / 6,
      ),
    );
    const aggregateCatalogs = aggregateCatalogBases.map((catalog) => ({
      ...catalog,
      extensions: { payload: sharedPayload },
    }));
    for (const catalog of aggregateCatalogs) {
      const byteLength = canonicalizeJsonBytes(catalog).byteLength;
      expect(byteLength).toBeLessThanOrEqual(
        BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogCanonicalBytes,
      );
      expect(byteLength * aggregateCatalogs.length).toBeGreaterThan(
        BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxAggregateCatalogCanonicalBytes,
      );
    }
    const aggregateCandidates = aggregateCatalogs.map((catalog) => ({
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      catalog,
      artifacts: [],
    }));
    const aggregateRequirements = aggregateCatalogs.map((catalog) => ({
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      digest: aggregateDigest,
    }));
    const passthroughStructure = ((
      _kind: unknown,
      value: unknown,
    ): Readonly<{ readonly valid: true; readonly value: unknown }> =>
      Object.freeze({ valid: true, value })) as unknown as typeof validateDesenStructure;
    const passthroughDigest = ((
      catalog: Parameters<typeof calculateWebReactPackageDigest>[0],
      artifacts: Parameters<typeof calculateWebReactPackageDigest>[1],
    ) =>
      Object.freeze({
        packageDigest: catalog.packageDigest,
        artifactCount: artifacts.length,
        framedByteLength: 1,
      })) as typeof calculateWebReactPackageDigest;
    const aggregateCatalogSet = vi.fn(validateDesenCatalogSet);
    requireRejected(
      preflightBundlePackagesInternal(authorityFor(aggregateRequirements), aggregateCandidates, {
        validateStructure: passthroughStructure,
        validateCatalogSet: aggregateCatalogSet,
        calculateWebReactDigest: passthroughDigest,
      }),
      "package-catalog",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );
    expect(aggregateCatalogSet).not.toHaveBeenCalled();

    const fixture = packageFixture();
    const oversizedCapabilities = {
      ...(fixture.candidate.catalog as Record<string, unknown>),
      components: Object.fromEntries(
        Array.from(
          { length: BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCapabilityDeclarations + 1 },
          (_, index) => [`com.example/capability-${String(index)}`, null],
        ),
      ),
    };
    const capabilityStructure = (() =>
      Object.freeze({
        valid: true,
        value: oversizedCapabilities,
      })) as unknown as typeof validateDesenStructure;
    const capabilityCatalogSet = vi.fn(validateDesenCatalogSet);
    const capabilityDigest = vi.fn(calculateWebReactPackageDigest);
    requireRejected(
      preflightBundlePackagesInternal(authorityFor([fixture.requirement]), [fixture.candidate], {
        validateStructure: capabilityStructure,
        validateCatalogSet: capabilityCatalogSet,
        calculateWebReactDigest: capabilityDigest,
      }),
      "package-catalog",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );
    expect(capabilityCatalogSet).not.toHaveBeenCalled();
    expect(capabilityDigest).not.toHaveBeenCalled();
  }, 30_000);

  it("enforces exact framer and aggregate package-preimage ceilings", () => {
    const fixture = packageFixture();
    const catalog = fixture.candidate.catalog as Parameters<
      typeof calculateWebReactPackageDigest
    >[0];
    const artifacts = fixture.candidate.artifacts as Parameters<
      typeof calculateWebReactPackageDigest
    >[1];
    const unconstrained = calculateWebReactPackageDigest(
      catalog,
      artifacts,
      Number.MAX_SAFE_INTEGER,
    );
    expect(
      calculateWebReactPackageDigest(catalog, artifacts, unconstrained.framedByteLength),
    ).toEqual(unconstrained);
    expect(() =>
      calculateWebReactPackageDigest(catalog, artifacts, unconstrained.framedByteLength - 1),
    ).toThrow(RangeError);

    const first = packageFixture({ ...cloneJson(BASE_CATALOG), id: "com.example.aggregate.one" });
    const second = packageFixture({ ...cloneJson(BASE_CATALOG), id: "com.example.aggregate.two" });
    const framedHalfPlusOne =
      Math.floor(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxAggregatePackagePreimageBytes / 2) + 1;
    const inflatedDigest = ((
      inputCatalog: Parameters<typeof calculateWebReactPackageDigest>[0],
      inputArtifacts: Parameters<typeof calculateWebReactPackageDigest>[1],
    ) =>
      Object.freeze({
        packageDigest: inputCatalog.packageDigest,
        artifactCount: inputArtifacts.length,
        framedByteLength: framedHalfPlusOne,
      })) as typeof calculateWebReactPackageDigest;
    requireRejected(
      preflightBundlePackagesInternal(
        authorityFor([first.requirement, second.requirement]),
        [first.candidate, second.candidate],
        {
          validateStructure: validateDesenStructure,
          validateCatalogSet: validateDesenCatalogSet,
          calculateWebReactDigest: inflatedDigest,
        },
      ),
      "package-digest",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );
  });

  it("retains exactly the finite diagnostic ceiling for missing requirements", () => {
    expect(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxDiagnostics).toBe(
      BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxRequirements,
    );
    const fixture = packageFixture();
    const requirements = Array.from(
      { length: BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxDiagnostics },
      () => fixture.requirement,
    );
    const rejected = requireRejected(
      preflightBundlePackages(authorityFor(requirements), []),
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
    );
    expect(rejected.diagnostics).toHaveLength(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxDiagnostics);
    expect(rejected.diagnostics[0]?.pointer).toBe("/requires/catalogs/0");
    expect(rejected.diagnostics.at(-1)?.pointer).toBe(
      `/requires/catalogs/${String(BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxDiagnostics - 1)}`,
    );
  });

  it("maps an injected digest-verifier throw to one redacted internal rejection", () => {
    const fixture = packageFixture();
    const throwingDigest: typeof calculateWebReactPackageDigest = () => {
      throw new Error("SENSITIVE_VERIFIER_FAILURE");
    };
    const rejected = requireRejected(
      preflightBundlePackagesInternal(authorityFor([fixture.requirement]), [fixture.candidate], {
        validateStructure: validateDesenStructure,
        validateCatalogSet: validateDesenCatalogSet,
        calculateWebReactDigest: throwingDigest,
      }),
      "internal",
      PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE,
    );
    expect(JSON.stringify(rejected)).not.toContain("SENSITIVE_VERIFIER_FAILURE");
  });

  it("rejects an injected wrong digest without issuing partial package authority", () => {
    const fixture = packageFixture();
    const wrongDigest: typeof calculateWebReactPackageDigest = (...input) => {
      const calculated = calculateWebReactPackageDigest(...input);
      return Object.freeze({
        ...calculated,
        packageDigest: `sha256:${"f".repeat(64)}`,
      });
    };
    requireRejected(
      preflightBundlePackagesInternal(authorityFor([fixture.requirement]), [fixture.candidate], {
        validateStructure: validateDesenStructure,
        validateCatalogSet: validateDesenCatalogSet,
        calculateWebReactDigest: wrongDigest,
      }),
      "package-digest",
      "CATALOG_DIGEST_MISMATCH",
    );
  });

  it("stops a 10,000-declaration structural fanout before exhaustive validation or digest work", () => {
    const fixture = packageFixture();
    const fanoutCatalog = {
      ...(fixture.candidate.catalog as Record<string, unknown>),
      components: Object.fromEntries(
        Array.from({ length: 10_000 }, (_, index) => [
          `com.example.invalid/component-${String(index)}`,
          null,
        ]),
      ),
    };
    const validateStructureSpy = vi.fn(validateDesenStructure);
    const validateStructure = validateStructureSpy as unknown as typeof validateDesenStructure;
    const validateCatalogSet = vi.fn(validateDesenCatalogSet);
    const calculateDigest = vi.fn(calculateWebReactPackageDigest);
    const rejected = requireRejected(
      preflightBundlePackagesInternal(
        authorityFor([fixture.requirement]),
        [{ ...fixture.candidate, catalog: fanoutCatalog }],
        {
          validateStructure,
          validateCatalogSet,
          calculateWebReactDigest: calculateDigest,
        },
      ),
      "package-catalog",
      "SCHEMA_INVALID",
    );
    expect(rejected.diagnostics).toHaveLength(1);
    expect(validateStructureSpy).not.toHaveBeenCalled();
    expect(validateCatalogSet).not.toHaveBeenCalled();
    expect(calculateDigest).not.toHaveBeenCalled();
  });

  it("ignores non-enumerable and Symbol decorations without retaining or invoking them", () => {
    const fixture = packageFixture();
    const decoration = Symbol("decoration");
    const decoratedCatalog = fixture.candidate.catalog as Record<PropertyKey, unknown>;
    const decoratedArtifact = fixture.candidate.artifacts[0] as InstalledPackageArtifact &
      Record<PropertyKey, unknown>;
    const decoratedCandidate = fixture.candidate as InstalledPackageCandidate &
      Record<PropertyKey, unknown>;
    for (const target of [decoratedCatalog, decoratedArtifact, decoratedCandidate]) {
      Object.defineProperty(target, "hiddenLoader", {
        configurable: true,
        enumerable: false,
        value: () => {
          throw new Error("non-enumerable decoration must never run");
        },
      });
      Object.defineProperty(target, decoration, {
        configurable: true,
        enumerable: true,
        value: "ignored-symbol-decoration",
      });
    }
    requirePreflighted(
      preflightBundlePackages(authorityFor([fixture.requirement]), [decoratedCandidate]),
    );
  });

  it("rejects Proxy-backed array prototypes without invoking prototype traps", () => {
    const fixture = packageFixture();
    let prototypeTraps = 0;
    const hostilePrototype = new Proxy(Array.prototype, {
      ownKeys() {
        prototypeTraps += 1;
        throw new Error("hostile array prototype must not be enumerated");
      },
    });
    const inventory = [fixture.candidate];
    Object.setPrototypeOf(inventory, hostilePrototype);
    requireRejected(
      preflightBundlePackages(
        authorityFor([fixture.requirement]),
        inventory as readonly InstalledPackageCandidate[],
      ),
      "package-inventory",
      INVALID_INSTALLED_PACKAGE_CODE,
    );
    expect(prototypeTraps).toBe(0);
  });

  it("caps enumerable Catalog object members before exhaustive validation", () => {
    const fixture = packageFixture();
    const extensions = Object.fromEntries(
      Array.from(
        { length: BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogObjectMembers + 1 },
        (_, index) => [`member-${String(index)}`, null],
      ),
    );
    requireRejected(
      preflightBundlePackages(authorityFor([fixture.requirement]), [
        {
          ...fixture.candidate,
          catalog: { ...(fixture.candidate.catalog as Record<string, unknown>), extensions },
        },
      ]),
      "package-catalog",
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );
  });

  it("redacts rejected Catalog values, artifact paths and bytes, and executable loader fields", () => {
    const fixture = packageFixture();
    const catalogSecret = "SENSITIVE_CATALOG_VALUE";
    const artifactSecret = "SENSITIVE_ARTIFACT_BYTES";
    const artifactPath = "dist/sensitive-artifact.js";
    const rejected = requireRejected(
      preflightBundlePackages(authorityFor([fixture.requirement]), [
        {
          ...fixture.candidate,
          catalog: {
            ...(fixture.candidate.catalog as Record<string, unknown>),
            extensions: { secret: catalogSecret },
          },
          artifacts: [{ path: artifactPath, bytes: ascii(artifactSecret) }],
        },
      ]),
      "package-digest",
      "CATALOG_DIGEST_MISMATCH",
    );
    const serialized = JSON.stringify(rejected);
    expect(serialized).not.toContain(catalogSecret);
    expect(serialized).not.toContain(artifactSecret);
    expect(serialized).not.toContain(artifactPath);

    const loaderSecret = "SENSITIVE_LOADER";
    const candidateWithLoader = {
      ...fixture.candidate,
      loader: () => loaderSecret,
    } as unknown as InstalledPackageCandidate;
    const loaderRejected = requireRejected(
      preflightBundlePackages(authorityFor([fixture.requirement]), [candidateWithLoader]),
      "package-inventory",
      INVALID_INSTALLED_PACKAGE_CODE,
    );
    expect(JSON.stringify(loaderRejected)).not.toContain(loaderSecret);
  });

  it("rejects a structurally valid but capability-ambiguous installed Catalog set", () => {
    const firstCatalog = { ...cloneJson(officialCatalog), id: "com.example.web-catalog-one" };
    const secondCatalog = { ...cloneJson(officialCatalog), id: "com.example.web-catalog-two" };
    const first = packageFixture(firstCatalog, []);
    const second = packageFixture(secondCatalog, []);
    const authority = authorityFor([first.requirement, second.requirement]);

    const validateCatalogSet = vi.fn(validateDesenCatalogSet);
    const rejected = requireRejected(
      preflightBundlePackagesInternal(authority, [second.candidate, first.candidate], {
        validateStructure: validateDesenStructure,
        validateCatalogSet,
        calculateWebReactDigest: calculateWebReactPackageDigest,
      }),
      "catalog-set",
      "AMBIGUOUS_CAPABILITY",
    );
    expect(validateCatalogSet).not.toHaveBeenCalled();
    const serialized = JSON.stringify(rejected);
    for (const group of ["components", "behaviors", "operations", "resources"] as const) {
      for (const capabilityId of Object.keys(jsonRecord(officialCatalog[group], group))) {
        expect(serialized).not.toContain(capabilityId);
      }
    }
  });
});
