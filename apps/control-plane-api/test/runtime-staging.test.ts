import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  calculateDesenBundleRevision,
  canonicalizeJson,
  canonicalizeJsonBytes,
  createJsonPointer,
  sha256Digest,
} from "@desen/protocol";
import { prepareRuntimeActionProgram } from "@desen/runtime-core";
import {
  validateDesenBundleExecutionContracts,
  validateDesenExecutionCatalogSet,
} from "@desen/validator";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  BUNDLE_RUNTIME_STAGING_LIMITS,
  INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE,
  RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
  RUNTIME_STAGING_LIMIT_EXCEEDED_CODE,
  RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE,
  preflightBundlePackages,
  preflightBundleReferences,
  stageBundleRuntime,
  verifyBundleStoreEntry,
} from "../src/index.js";
import { readBundlePackagePreflightAuthority } from "../src/package-preflight-internal.js";
import { calculateWebReactPackageDigest } from "../src/package-preflight-web-react.js";
import {
  isBundleRuntimeStagingAuthority,
  readBundleRuntimeStagingAuthority,
  readStagedRuntimeArtifactBytes,
  stageBundleRuntimeInternal,
} from "../src/runtime-staging-internal.js";

import type { DesenBundle, DesenCatalog } from "@desen/protocol";
import type { RuntimeActionTurnProgram } from "@desen/runtime-core";
import type {
  BundlePackagePreflightAuthority,
  BundleRuntimeStagingLimits,
  BundleRuntimeStagingResult,
  InstalledPackageArtifact,
  InstalledPackageCandidate,
} from "../src/index.js";
import type { RuntimeStagingPorts } from "../src/runtime-staging-internal.js";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");
const BUNDLE_PATH = join(WORKSPACE_ROOT, "examples/sign-in/official-derived.bundle.desen.json");
const CATALOG_PATH = join(WORKSPACE_ROOT, "packages/reference-catalog-web/catalog.json");
const DISTRIBUTION_ROOT = join(WORKSPACE_ROOT, "packages/reference-catalog-web/dist");
const EXPECTED_REVISION = "sha256:6e539a76ddd0bc9b4eff82e73508b62a3980ae5dbc73dd85ccf0c1cae6957e13";
const EXPECTED_PACKAGE_DIGEST =
  "sha256:d4a4e7e2ea2d68ab8bff085d90e093f2d31b784f0f2fb089c6422ce33914b051";
const OBSERVE_BEHAVIOR = "com.example.interactions/Observe";
const PROFILE_RESOURCE = "com.example.account/profile";

let officialBundle: DesenBundle;
let officialCatalog: DesenCatalog;
let officialArtifacts: readonly InstalledPackageArtifact[];

const DEFAULT_PORTS: RuntimeStagingPorts = Object.freeze({
  validateExecutionCatalogSet: validateDesenExecutionCatalogSet,
  validateBundleExecutionContracts: validateDesenBundleExecutionContracts,
  prepareActionProgram: prepareRuntimeActionProgram,
  calculatePackageDigest: calculateWebReactPackageDigest,
});

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
      else throw new TypeError("The staged package fixture must contain only regular files.");
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

function candidateFor(
  catalog: DesenCatalog,
  artifacts: readonly InstalledPackageArtifact[] = officialArtifacts,
): InstalledPackageCandidate {
  return Object.freeze({
    id: catalog.id,
    version: catalog.version,
    target: catalog.target,
    catalog,
    artifacts,
  });
}

function packageAuthorityFor(
  bundle: DesenBundle = officialBundle,
  catalog: DesenCatalog = officialCatalog,
  artifacts: readonly InstalledPackageArtifact[] = officialArtifacts,
): BundlePackagePreflightAuthority {
  const integrity = verifyBundleStoreEntry(
    { revision: bundle.revision, bytes: canonicalizeJsonBytes(bundle) },
    { status: "not-available" },
  );
  expect(integrity.status).toBe("verified");
  if (integrity.status !== "verified") throw new TypeError("Expected M07-T02 authority.");
  const packages = preflightBundlePackages(integrity.authority, [candidateFor(catalog, artifacts)]);
  expect(packages.status).toBe("preflighted");
  if (packages.status !== "preflighted") throw new TypeError("Expected M07-T03 authority.");
  return packages.authority;
}

function requireStaged(
  result: BundleRuntimeStagingResult,
): Extract<BundleRuntimeStagingResult, { readonly status: "staged" }> {
  expect(result.status).toBe("staged");
  if (result.status !== "staged") throw new TypeError(`Expected staging success: ${result.stage}`);
  return result;
}

function requireRejected(
  result: BundleRuntimeStagingResult,
  stage: string,
  code: string,
): Extract<BundleRuntimeStagingResult, { readonly status: "rejected" }> {
  expect(result.status).toBe("rejected");
  if (result.status !== "rejected") throw new TypeError("Expected staging rejection.");
  expect(result.stage).toBe(stage);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.code).toBe(code);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.diagnostics)).toBe(true);
  expect(result).not.toHaveProperty("authority");
  expect(result.diagnostics[0]).not.toHaveProperty("cause");
  return result;
}

function recalculatedCandidate(
  mutateCatalog: (catalog: DesenCatalog) => void,
  mutateBundle?: (bundle: DesenBundle) => void,
): Readonly<{ readonly bundle: DesenBundle; readonly catalog: DesenCatalog }> {
  const catalog = cloneJson(officialCatalog);
  mutateCatalog(catalog);
  const calculated = calculateWebReactPackageDigest(
    catalog as Parameters<typeof calculateWebReactPackageDigest>[0],
    officialArtifacts as Parameters<typeof calculateWebReactPackageDigest>[1],
    BUNDLE_RUNTIME_STAGING_LIMITS.maxArtifactBytes,
  );
  catalog.packageDigest = calculated.packageDigest;
  const bundle = cloneJson(officialBundle);
  const requirement = bundle.requires.catalogs[0];
  if (requirement === undefined) throw new TypeError("Expected official package requirement.");
  requirement.digest = calculated.packageDigest;
  mutateBundle?.(bundle);
  bundle.revision = calculateDesenBundleRevision(bundle);
  return Object.freeze({ bundle, catalog });
}

function indexedBehaviorResourceCandidate(): Readonly<{
  readonly bundle: DesenBundle;
  readonly catalog: DesenCatalog;
}> {
  return recalculatedCandidate(
    (catalog) => {
      catalog.behaviors[OBSERVE_BEHAVIOR] = {
        propsSchema: { type: "object", additionalProperties: false },
        attachTo: { categories: ["layout"] },
        events: {
          observed: {
            payloadSchema: { type: "object", additionalProperties: false },
          },
        },
      };
      catalog.resources[PROFILE_RESOURCE] = {
        inputSchema: { type: "object", additionalProperties: false },
        outputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { name: { type: "string" } },
        },
        errors: [],
        policies: ["manual"],
      };
    },
    (bundle) => {
      const home = bundle.surfaces.home;
      if (home === undefined) throw new TypeError("Expected official home surface.");
      home.root.behaviors = [
        {
          id: "home.observe",
          use: OBSERVE_BEHAVIOR,
          on: { observed: [] },
        },
      ];
      home.resources.profile = {
        use: PROFILE_RESOURCE,
        input: {},
        policy: "manual",
      };
    },
  );
}

function loweredLimits(
  updates: Partial<BundleRuntimeStagingLimits>,
): Readonly<BundleRuntimeStagingLimits> {
  return Object.freeze({ ...BUNDLE_RUNTIME_STAGING_LIMITS, ...updates });
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
  expect(officialBundle.revision).toBe(EXPECTED_REVISION);
  expect(officialCatalog.packageDigest).toBe(EXPECTED_PACKAGE_DIGEST);
  expect(officialArtifacts).toHaveLength(80);
});

describe("M07-T06 staged runtime indexes", () => {
  it("stages the exact official package snapshot as callback-free active-separated authority", () => {
    const packageAuthority = packageAuthorityFor();
    const accepted = requireStaged(stageBundleRuntime(packageAuthority));

    expect(accepted.authority).toEqual({
      profile: "desen.runtime-index-staging",
      profileVersion: 1,
      protocolVersion: "0.1.0",
      stagedRevision: EXPECTED_REVISION,
      documentId: "com.example.account-app",
      entrySurfaceId: "sign-in",
      packages: [
        {
          id: "run.desen.reference.sign-in",
          version: "0.1.0",
          target: "web-react",
          packageDigest: EXPECTED_PACKAGE_DIGEST,
          artifactCount: 80,
          artifactByteLength: 243_740,
          componentCount: 5,
          behaviorCount: 0,
          operationCount: 1,
          resourceCount: 0,
        },
      ],
      surfaces: [
        {
          id: "home",
          sourceNodeCount: 2,
          behaviorCount: 0,
          handlerProgramCount: 0,
          stateEntryCount: 0,
          resourceAliasCount: 0,
          operationAliasCount: 0,
        },
        {
          id: "sign-in",
          sourceNodeCount: 6,
          behaviorCount: 0,
          handlerProgramCount: 3,
          stateEntryCount: 2,
          resourceAliasCount: 0,
          operationAliasCount: 1,
        },
      ],
      runtimeObligationCount: 7,
    });
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(accepted.authority)).toBe(true);
    expect(Object.isFrozen(accepted.authority.packages)).toBe(true);
    expect(Object.isFrozen(accepted.authority.packages[0])).toBe(true);
    expect(Object.isFrozen(accepted.authority.surfaces)).toBe(true);
    expect(Object.isFrozen(accepted.authority.surfaces[0])).toBe(true);
    expect(isBundleRuntimeStagingAuthority(accepted.authority)).toBe(true);
    expect(isBundleRuntimeStagingAuthority({ ...accepted.authority })).toBe(false);
    for (const forbidden of [
      "activeRevision",
      "previousGoodRevision",
      "generation",
      "bundle",
      "catalogSet",
      "artifacts",
      "artifactPaths",
      "load",
      "commit",
      "activate",
      "rollback",
      "channel",
      "hostPorts",
    ]) {
      expect(accepted.authority).not.toHaveProperty(forbidden);
    }
  });

  it("retains exact execution identity, staged byte copies, indexes, and sorted obligations privately", () => {
    const packageAuthority = packageAuthorityFor();
    const packageRecord = readBundlePackagePreflightAuthority(packageAuthority);
    const accepted = requireStaged(stageBundleRuntime(packageAuthority));
    const staged = readBundleRuntimeStagingAuthority(accepted.authority);

    expect(staged?.packageAuthority).toBe(packageAuthority);
    expect(staged?.packageRecord).toBe(packageRecord);
    expect(staged?.catalogSet).toBe(packageRecord?.catalogSet);
    expect(staged?.bundle).not.toBe(packageRecord?.integrityRecord.bundle);
    expect(calculateDesenBundleRevision(staged?.bundle)).toBe(EXPECTED_REVISION);
    expect(staged?.requirementPackageIndexes).toBe(packageRecord?.requirementPackageIndexes);
    expect(staged?.packages[0]?.artifacts).toHaveLength(80);
    const stagedArtifact = staged?.packages[0]?.artifacts[0];
    const firstStagedBytes = readStagedRuntimeArtifactBytes(stagedArtifact);
    const secondStagedBytes = readStagedRuntimeArtifactBytes(stagedArtifact);
    expect(firstStagedBytes).not.toBe(packageRecord?.packages[0]?.artifacts[0]?.bytes);
    expect(firstStagedBytes).toEqual(packageRecord?.packages[0]?.artifacts[0]?.bytes);
    expect(secondStagedBytes).not.toBe(firstStagedBytes);
    firstStagedBytes?.fill(0);
    expect(readStagedRuntimeArtifactBytes(stagedArtifact)).toEqual(
      packageRecord?.packages[0]?.artifacts[0]?.bytes,
    );
    expect(stagedArtifact).not.toHaveProperty("bytes");
    expect(stagedArtifact?.digest).toBe(
      secondStagedBytes === undefined ? undefined : sha256Digest(secondStagedBytes),
    );
    expect(staged?.packages[0]?.artifactByPath[stagedArtifact?.path ?? "missing"]).toBe(
      stagedArtifact,
    );
    expect(Object.keys(staged?.capabilities.components ?? {})).toEqual([
      "com.example.ui/Alert",
      "com.example.ui/Button",
      "com.example.ui/Stack",
      "com.example.ui/Text",
      "com.example.ui/TextField",
    ]);
    expect(Object.keys(staged?.capabilities.operations ?? {})).toEqual(["com.example.auth/signIn"]);
    expect(Object.keys(staged?.surfaces ?? {})).toEqual(["home", "sign-in"]);
    expect(staged?.entrySurface).toBe(staged?.surfaces["sign-in"]);
    expect(Object.keys(staged?.entrySurface.handlers ?? {})).toEqual([
      canonicalizeJson(["component", "sign-in.email", "change"]),
      canonicalizeJson(["component", "sign-in.password", "change"]),
      canonicalizeJson(["component", "sign-in.submit", "press"]),
    ]);
    expect(staged?.entrySurface.operationAliases).toEqual({ signIn: "com.example.auth/signIn" });
    expect(staged?.obligations.map(({ kind }) => kind)).toEqual([
      "state-write",
      "component-prop",
      "state-write",
      "component-prop",
      "operation-input",
      "operation-input",
      "component-prop",
    ]);
    expect(staged?.obligations.map(({ pointer }) => pointer)).toEqual(
      [...(staged?.obligations ?? [])].map(({ pointer }) => pointer).sort(),
    );
  });

  it("stages from the T03-owned copies after caller artifact mutation", () => {
    const callerArtifacts = officialArtifacts.map((artifact) => ({
      path: artifact.path,
      bytes: new Uint8Array(artifact.bytes),
    }));
    const packageAuthority = packageAuthorityFor(officialBundle, officialCatalog, callerArtifacts);
    const retained =
      readBundlePackagePreflightAuthority(packageAuthority)?.packages[0]?.artifacts[0]?.bytes;
    callerArtifacts[0]?.bytes.fill(0);

    const accepted = requireStaged(stageBundleRuntime(packageAuthority));
    const stagedArtifact = readBundleRuntimeStagingAuthority(accepted.authority)?.packages[0]
      ?.artifacts[0];
    const stagedBytes = readStagedRuntimeArtifactBytes(stagedArtifact);
    expect(stagedBytes).toEqual(retained);
    expect(stagedBytes).not.toEqual(callerArtifacts[0]?.bytes);
  });

  it("rejects package-private byte drift before creating staged authority", () => {
    const packageAuthority = packageAuthorityFor();
    const retained =
      readBundlePackagePreflightAuthority(packageAuthority)?.packages[0]?.artifacts[0]?.bytes;
    if (retained === undefined) throw new TypeError("Expected retained T03 artifact bytes.");
    retained[0] = (retained[0] ?? 0) ^ 0xff;

    requireRejected(
      stageBundleRuntime(packageAuthority),
      "package-snapshots",
      RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE,
    );

    const detachedAuthority = packageAuthorityFor();
    const detached =
      readBundlePackagePreflightAuthority(detachedAuthority)?.packages[0]?.artifacts[0]?.bytes;
    if (detached === undefined) throw new TypeError("Expected detachable T03 artifact bytes.");
    const transferred = detached.buffer as ArrayBuffer;
    structuredClone(transferred, { transfer: [transferred] });
    expect(detached.byteLength).toBe(0);
    requireRejected(
      stageBundleRuntime(detachedAuthority),
      "package-snapshots",
      RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE,
    );
  });

  it("rejects forged authorities before observing any staging port", () => {
    const ports: RuntimeStagingPorts = {
      validateExecutionCatalogSet: vi.fn(DEFAULT_PORTS.validateExecutionCatalogSet),
      validateBundleExecutionContracts: vi.fn(DEFAULT_PORTS.validateBundleExecutionContracts),
      prepareActionProgram: vi.fn(DEFAULT_PORTS.prepareActionProgram),
      calculatePackageDigest: vi.fn(DEFAULT_PORTS.calculatePackageDigest),
    };
    for (const forged of [
      {},
      { ...packageAuthorityFor() },
      new Proxy(
        {},
        {
          ownKeys: () => {
            throw new Error("must not inspect");
          },
        },
      ),
    ]) {
      requireRejected(
        stageBundleRuntimeInternal(forged as BundlePackagePreflightAuthority, ports),
        "package-authority",
        INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE,
      );
    }
    expect(ports.validateExecutionCatalogSet).not.toHaveBeenCalled();
    expect(ports.validateBundleExecutionContracts).not.toHaveBeenCalled();
    expect(ports.prepareActionProgram).not.toHaveBeenCalled();
    expect(ports.calculatePackageDigest).not.toHaveBeenCalled();
  });

  it("keeps the T04 reference branch parallel while rejecting static execution-contract drift", () => {
    const fixture = recalculatedCandidate(
      () => undefined,
      (bundle) => {
        const signIn = bundle.surfaces["sign-in"];
        const defaultChildren = signIn?.root.slots?.["default"];
        const text = defaultChildren?.find((node) => node.use === "com.example.ui/Text");
        if (text === undefined) throw new TypeError("Expected official Text node.");
        text.props = { text: 42 };
      },
    );
    const packageAuthority = packageAuthorityFor(fixture.bundle, fixture.catalog);
    expect(preflightBundleReferences(packageAuthority).status).toBe("preflighted");

    const rejected = stageBundleRuntime(packageAuthority);
    expect(rejected.status).toBe("rejected");
    if (rejected.status !== "rejected") throw new TypeError("Expected execution rejection.");
    expect(rejected.stage).toBe("execution-contracts");
    expect(rejected.diagnostics).toHaveLength(1);
    expect(rejected).not.toHaveProperty("authority");
  });

  it("rejects execution Catalog contract drift without retaining partial package plans", () => {
    const fixture = recalculatedCandidate((catalog) => {
      const stack = catalog.components["com.example.ui/Stack"];
      const slot = stack?.slots?.["default"];
      if (slot === undefined) throw new TypeError("Expected official Stack slot.");
      slot.required = true;
      slot.minItems = 2;
      slot.maxItems = 1;
    });
    const rejected = stageBundleRuntime(packageAuthorityFor(fixture.bundle, fixture.catalog));
    expect(rejected.status).toBe("rejected");
    if (rejected.status !== "rejected") throw new TypeError("Expected Catalog rejection.");
    expect(rejected.stage).toBe("execution-catalogs");
    expect(rejected.diagnostics).toHaveLength(1);
    expect(rejected).not.toHaveProperty("authority");
  });

  it("redacts thrown and disagreeing trusted execution ports as internal rejection", () => {
    const packageAuthority = packageAuthorityFor();
    requireRejected(
      stageBundleRuntimeInternal(packageAuthority, {
        ...DEFAULT_PORTS,
        validateBundleExecutionContracts() {
          throw new Error("sensitive validator cause");
        },
      }),
      "internal",
      RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
    );

    const real = validateDesenExecutionCatalogSet(
      readBundlePackagePreflightAuthority(packageAuthority)?.catalogSet,
    );
    if (!real.valid) throw new TypeError("Expected execution Catalog authority.");
    const valid = validateDesenBundleExecutionContracts(officialBundle, real.value);
    if (!valid.valid) throw new TypeError("Expected valid official execution Bundle.");
    const drifted = cloneJson(valid.value) as unknown as DesenBundle;
    drifted.entry = "home";
    requireRejected(
      stageBundleRuntimeInternal(packageAuthority, {
        ...DEFAULT_PORTS,
        validateBundleExecutionContracts: () =>
          Object.freeze({ ...valid, value: drifted }) as typeof valid,
      }),
      "execution-contracts",
      RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
    );

    requireRejected(
      stageBundleRuntimeInternal(
        packageAuthority,
        {
          ...DEFAULT_PORTS,
          validateBundleExecutionContracts: () =>
            Object.freeze({
              valid: true,
              target: "bundle",
              diagnostics: Object.freeze([]),
              obligations: Object.freeze(Array.from({ length: 8 }, () => null)),
              value: null,
            }) as unknown as ReturnType<RuntimeStagingPorts["validateBundleExecutionContracts"]>,
        },
        loweredLimits({ maxRuntimeValidationObligations: 0 }),
      ),
      "execution-contracts",
      RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
    );

    let hostileReads = 0;
    requireRejected(
      stageBundleRuntimeInternal(packageAuthority, {
        ...DEFAULT_PORTS,
        calculatePackageDigest(catalog, artifacts, maximumFramedBytes) {
          const realDigest = DEFAULT_PORTS.calculatePackageDigest(
            catalog,
            artifacts,
            maximumFramedBytes,
          );
          const hostile = {
            artifactCount: realDigest.artifactCount,
            framedByteLength: realDigest.framedByteLength,
          } as Record<string, unknown>;
          Object.defineProperty(hostile, "packageDigest", {
            enumerable: true,
            get() {
              hostileReads += 1;
              return realDigest.packageDigest;
            },
          });
          return hostile as unknown as ReturnType<RuntimeStagingPorts["calculatePackageDigest"]>;
        },
      }),
      "package-snapshots",
      RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE,
    );

    requireRejected(
      stageBundleRuntimeInternal(packageAuthority, {
        ...DEFAULT_PORTS,
        validateExecutionCatalogSet(input) {
          const realCatalogs = DEFAULT_PORTS.validateExecutionCatalogSet(input);
          if (!realCatalogs.valid) return realCatalogs;
          return Object.freeze({
            ...realCatalogs,
            target: "wrong-target",
          }) as unknown as typeof realCatalogs;
        },
      }),
      "execution-catalogs",
      RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
    );

    requireRejected(
      stageBundleRuntimeInternal(packageAuthority, {
        ...DEFAULT_PORTS,
        validateBundleExecutionContracts(input, catalogs) {
          const realExecution = DEFAULT_PORTS.validateBundleExecutionContracts(input, catalogs);
          if (!realExecution.valid) return realExecution;
          const hostile = {
            valid: true,
            target: "bundle",
            diagnostics: realExecution.diagnostics,
            obligations: realExecution.obligations,
          } as Record<string, unknown>;
          Object.defineProperty(hostile, "value", {
            enumerable: true,
            get() {
              hostileReads += 1;
              return realExecution.value;
            },
          });
          return hostile as unknown as typeof realExecution;
        },
      }),
      "execution-contracts",
      RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
    );

    const forgedProgram = Object.freeze({}) as RuntimeActionTurnProgram;
    const programAccepted = requireStaged(
      stageBundleRuntimeInternal(packageAuthority, {
        ...DEFAULT_PORTS,
        prepareActionProgram: (actions) =>
          Object.freeze({
            status: "prepared",
            program: forgedProgram,
            actionCount: actions.length,
            overflow: false,
          }),
      }),
    );
    const programRecord = readBundleRuntimeStagingAuthority(programAccepted.authority);
    expect(
      Object.values(programRecord?.surfaces ?? {}).flatMap((surface) =>
        Object.values(surface.handlers).map(({ program }) => program),
      ),
    ).not.toContain(forgedProgram);

    const accessorDiagnostic = { message: "must not escape" } as Record<string, unknown>;
    Object.defineProperty(accessorDiagnostic, "code", {
      enumerable: true,
      get() {
        hostileReads += 1;
        return "SCHEMA_INVALID";
      },
    });
    const proxyDiagnostic = new Proxy(
      { code: "SCHEMA_INVALID", message: "must not escape" },
      {
        get(target, key, receiver) {
          hostileReads += 1;
          return Reflect.get(target, key, receiver);
        },
      },
    );
    for (const hostile of [accessorDiagnostic, proxyDiagnostic]) {
      requireRejected(
        stageBundleRuntimeInternal(packageAuthority, {
          ...DEFAULT_PORTS,
          validateExecutionCatalogSet: () =>
            ({
              valid: false,
              target: "execution-catalog-set",
              diagnostics: [hostile],
            }) as unknown as ReturnType<RuntimeStagingPorts["validateExecutionCatalogSet"]>,
        }),
        "execution-catalogs",
        RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
      );
    }
    expect(hostileReads).toBe(0);
  });

  it("copies trusted rejection diagnostics and fails closed on malformed diagnostic data", () => {
    const packageAuthority = packageAuthorityFor();
    const mutable = {
      code: "SCHEMA_INVALID",
      message: "The execution Catalog contract is invalid.",
      pointer: "",
      context: {
        documentId: "com.example.account-app",
        subject: { kind: "node", id: "form" },
      },
    };
    const rejected = stageBundleRuntimeInternal(packageAuthority, {
      ...DEFAULT_PORTS,
      validateExecutionCatalogSet: () =>
        ({
          valid: false,
          target: "execution-catalog-set",
          diagnostics: [mutable],
        }) as unknown as ReturnType<RuntimeStagingPorts["validateExecutionCatalogSet"]>,
    });
    const stable = requireRejected(rejected, "execution-catalogs", "SCHEMA_INVALID");
    expect(stable.diagnostics[0]).not.toBe(mutable);
    expect(Object.isFrozen(stable.diagnostics[0])).toBe(true);
    expect(Object.isFrozen(stable.diagnostics[0]?.context)).toBe(true);
    expect(Object.isFrozen(stable.diagnostics[0]?.context?.subject)).toBe(true);
    mutable.message = "changed after rejection";
    mutable.context.subject.id = "changed";
    expect(stable.diagnostics[0]?.message).toBe("The execution Catalog contract is invalid.");
    expect(stable.diagnostics[0]?.context?.subject?.id).toBe("form");

    requireRejected(
      stageBundleRuntimeInternal(packageAuthority, {
        ...DEFAULT_PORTS,
        validateExecutionCatalogSet: () =>
          ({
            valid: false,
            target: "execution-catalog-set",
            diagnostics: [{ code: "SCHEMA_INVALID", message: 42 }],
          }) as unknown as ReturnType<RuntimeStagingPorts["validateExecutionCatalogSet"]>,
      }),
      "execution-catalogs",
      RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
    );
  });

  it("creates independent deterministic candidates without a mutable global staged or active slot", () => {
    const packageAuthority = packageAuthorityFor();
    const activeRecord = {
      activeRevision: `sha256:${"a".repeat(64)}`,
      previousGoodRevision: null,
      generation: 4,
    };
    const first = requireStaged(stageBundleRuntime(packageAuthority));
    const second = requireStaged(stageBundleRuntime(packageAuthority));

    expect(first.authority).not.toBe(second.authority);
    expect(first.authority).toEqual(second.authority);
    expect(readBundleRuntimeStagingAuthority(first.authority)).not.toBe(
      readBundleRuntimeStagingAuthority(second.authority),
    );
    expect(activeRecord).toEqual({
      activeRevision: `sha256:${"a".repeat(64)}`,
      previousGoodRevision: null,
      generation: 4,
    });
  });

  it("indexes nonzero behavior and resource contracts, instances, handlers, and aliases exactly", () => {
    const fixture = indexedBehaviorResourceCandidate();
    const packageAuthority = packageAuthorityFor(fixture.bundle, fixture.catalog);
    const accepted = requireStaged(
      stageBundleRuntimeInternal(
        packageAuthority,
        DEFAULT_PORTS,
        loweredLimits({ maxBehaviors: 1, maxResourceAliases: 1 }),
      ),
    );
    const staged = readBundleRuntimeStagingAuthority(accepted.authority);
    const home = staged?.surfaces.home;
    const behaviorKey = canonicalizeJson(["home.layout", "home.observe"]);
    const handlerKey = canonicalizeJson(["behavior", "home.layout", "home.observe", "observed"]);

    expect(Object.keys(staged?.capabilities.behaviors ?? {})).toEqual([OBSERVE_BEHAVIOR]);
    expect(Object.keys(staged?.capabilities.resources ?? {})).toEqual([PROFILE_RESOURCE]);
    expect(staged?.capabilities.behaviors[OBSERVE_BEHAVIOR]?.packageIndex).toBe(0);
    expect(staged?.capabilities.resources[PROFILE_RESOURCE]?.packageIndex).toBe(0);
    expect(Object.keys(home?.behaviors ?? {})).toEqual([behaviorKey]);
    expect(home?.behaviors[behaviorKey]).toMatchObject({
      sourceNodeId: "home.layout",
      behaviorId: "home.observe",
      capabilityId: OBSERVE_BEHAVIOR,
    });
    expect(Object.keys(home?.handlers ?? {})).toEqual([handlerKey]);
    expect(home?.handlers[handlerKey]).toMatchObject({
      selector: handlerKey,
      sourceNodeId: "home.layout",
      behaviorId: "home.observe",
      eventName: "observed",
    });
    expect(home?.resources.profile).toMatchObject({
      alias: "profile",
      capabilityId: PROFILE_RESOURCE,
    });
    expect(home?.summary).toEqual({
      id: "home",
      sourceNodeCount: 2,
      behaviorCount: 1,
      handlerProgramCount: 1,
      stateEntryCount: 0,
      resourceAliasCount: 1,
      operationAliasCount: 0,
    });

    for (const limits of [
      loweredLimits({ maxBehaviors: 0 }),
      loweredLimits({ maxResourceAliases: 0 }),
    ]) {
      requireRejected(
        stageBundleRuntimeInternal(packageAuthority, DEFAULT_PORTS, limits),
        "runtime-indexes",
        RUNTIME_STAGING_LIMIT_EXCEEDED_CODE,
      );
    }
  });

  it("rejects exact lower staging ceilings without returning truncated indexes", () => {
    const packageAuthority = packageAuthorityFor();
    for (const [field, exact, stage] of [
      ["maxPackages", 1, "package-snapshots"],
      ["maxArtifactEntries", 80, "package-snapshots"],
      ["maxArtifactBytes", 243_740, "package-snapshots"],
      ["maxCapabilityEntries", 6, "runtime-indexes"],
      ["maxSurfaces", 2, "runtime-indexes"],
      ["maxSourceNodes", 8, "runtime-indexes"],
      ["maxStateEntries", 2, "runtime-indexes"],
      ["maxHandlerPrograms", 3, "runtime-indexes"],
      ["maxOperationAliases", 1, "runtime-indexes"],
      ["maxRuntimeValidationObligations", 7, "runtime-indexes"],
    ] as const) {
      requireStaged(
        stageBundleRuntimeInternal(
          packageAuthority,
          DEFAULT_PORTS,
          loweredLimits({ [field]: exact }),
        ),
      );
      requireRejected(
        stageBundleRuntimeInternal(
          packageAuthority,
          DEFAULT_PORTS,
          loweredLimits({ [field]: exact - 1 }),
        ),
        stage,
        RUNTIME_STAGING_LIMIT_EXCEEDED_CODE,
      );
    }

    const operationFirst = recalculatedCandidate(
      () => undefined,
      (bundle) => {
        const children = bundle.surfaces["sign-in"]?.root.slots?.["default"];
        const submitIndex = children?.findIndex((node) => node.id === "sign-in.submit") ?? -1;
        if (children === undefined || submitIndex < 0) {
          throw new TypeError("Expected the official submit node.");
        }
        const [submit] = children.splice(submitIndex, 1);
        if (submit === undefined) throw new TypeError("Expected the official submit node.");
        children.unshift(submit);
      },
    );
    let preparedPrograms = 0;
    requireRejected(
      stageBundleRuntimeInternal(
        packageAuthorityFor(operationFirst.bundle, operationFirst.catalog),
        {
          ...DEFAULT_PORTS,
          prepareActionProgram: (actions) => {
            preparedPrograms += 1;
            return DEFAULT_PORTS.prepareActionProgram(actions);
          },
        },
        loweredLimits({ maxOperationAliases: 0 }),
      ),
      "runtime-indexes",
      RUNTIME_STAGING_LIMIT_EXCEEDED_CODE,
    );
    expect(preparedPrograms).toBe(1);

    let overLimitHandlerPreparations = 0;
    requireRejected(
      stageBundleRuntimeInternal(
        packageAuthority,
        {
          ...DEFAULT_PORTS,
          prepareActionProgram: (actions) => {
            overLimitHandlerPreparations += 1;
            return DEFAULT_PORTS.prepareActionProgram(actions);
          },
        },
        loweredLimits({ maxHandlerPrograms: 0 }),
      ),
      "runtime-indexes",
      RUNTIME_STAGING_LIMIT_EXCEEDED_CODE,
    );
    expect(overLimitHandlerPreparations).toBe(0);

    const packageRecord = readBundlePackagePreflightAuthority(packageAuthority);
    const catalogs = validateDesenExecutionCatalogSet(packageRecord?.catalogSet);
    if (!catalogs.valid) throw new TypeError("Expected exact execution Catalogs.");
    const execution = validateDesenBundleExecutionContracts(
      packageRecord?.integrityRecord.bundle,
      catalogs.value,
    );
    if (!execution.valid) throw new TypeError("Expected exact execution Bundle contracts.");
    const firstObligation = execution.obligations[0];
    if (firstObligation === undefined) throw new TypeError("Expected one runtime obligation.");
    const portsWithObligations = (obligations: readonly (typeof firstObligation)[]) => ({
      ...DEFAULT_PORTS,
      validateBundleExecutionContracts: () =>
        Object.freeze({ ...execution, obligations: Object.freeze([...obligations]) }),
    });

    const exactPointer = createJsonPointer([
      "a".repeat(BUNDLE_RUNTIME_STAGING_LIMITS.maxRuntimeObligationPointerCodeUnits - 1),
    ]);
    const pointerObligation = Object.freeze({ ...firstObligation, pointer: exactPointer });
    requireStaged(
      stageBundleRuntimeInternal(packageAuthority, portsWithObligations([pointerObligation])),
    );
    requireRejected(
      stageBundleRuntimeInternal(
        packageAuthority,
        portsWithObligations([
          Object.freeze({
            ...firstObligation,
            pointer: createJsonPointer([
              "a".repeat(BUNDLE_RUNTIME_STAGING_LIMITS.maxRuntimeObligationPointerCodeUnits),
            ]),
          }),
        ]),
      ),
      "runtime-indexes",
      RUNTIME_STAGING_LIMIT_EXCEEDED_CODE,
    );

    const aggregatePointer = createJsonPointer(["aggregate"]);
    const aggregateBaseUnits = firstObligation.kind.length + aggregatePointer.length;
    const aggregateObligation = (extraCodeUnits: number) =>
      Object.freeze({
        ...firstObligation,
        pointer: aggregatePointer,
        context: Object.freeze({
          capabilityId: "x".repeat(
            BUNDLE_RUNTIME_STAGING_LIMITS.maxAggregateRuntimeObligationCodeUnits -
              aggregateBaseUnits +
              extraCodeUnits,
          ),
        }),
      });
    requireStaged(
      stageBundleRuntimeInternal(packageAuthority, portsWithObligations([aggregateObligation(0)])),
    );
    requireRejected(
      stageBundleRuntimeInternal(packageAuthority, portsWithObligations([aggregateObligation(1)])),
      "runtime-indexes",
      RUNTIME_STAGING_LIMIT_EXCEEDED_CODE,
    );
  });

  it("fails closed when runtime-core cannot prepare one otherwise trusted handler program", () => {
    const packageAuthority = packageAuthorityFor();
    requireRejected(
      stageBundleRuntimeInternal(packageAuthority, {
        ...DEFAULT_PORTS,
        prepareActionProgram: () =>
          Object.freeze({
            status: "invalid",
            reason: "program-limit",
            diagnostics: Object.freeze([]),
          }),
      }),
      "runtime-indexes",
      RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
    );
  });
});
