import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  calculateDesenBundleRevision,
  canonicalizeJsonBytes,
  createCoreDiagnostic,
  createJsonPointer,
} from "@desen/protocol";
import { validateDesenBundleSemantics } from "@desen/validator";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  BUNDLE_INTEGRITY_LIMITS,
  BUNDLE_REFERENCE_PREFLIGHT_LIMITS,
  INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE,
  REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE,
  preflightBundlePackages,
  preflightBundleReferences,
  verifyBundleStoreEntry,
} from "../src/index.js";
import { calculateWebReactPackageDigest } from "../src/package-preflight-web-react.js";
import {
  isBundleReferencePreflightAuthority,
  preflightBundleReferencesInternal,
  readBundleReferencePreflightAuthority,
} from "../src/reference-preflight-internal.js";

import type {
  BundlePackagePreflightAuthority,
  BundleReferencePreflightResult,
  InstalledPackageArtifact,
  InstalledPackageCandidate,
} from "../src/index.js";
import type { DesenBundle, DesenCatalog } from "@desen/protocol";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");
const BUNDLE_PATH = join(WORKSPACE_ROOT, "examples/sign-in/official-derived.bundle.desen.json");
const CATALOG_PATH = join(WORKSPACE_ROOT, "packages/reference-catalog-web/catalog.json");
const DISTRIBUTION_ROOT = join(WORKSPACE_ROOT, "packages/reference-catalog-web/dist");
const EXPECTED_REVISION = "sha256:6e539a76ddd0bc9b4eff82e73508b62a3980ae5dbc73dd85ccf0c1cae6957e13";
const EXPECTED_PACKAGE_DIGEST =
  "sha256:d4a4e7e2ea2d68ab8bff085d90e093f2d31b784f0f2fb089c6422ce33914b051";
const RESOURCE_CAPABILITY = "com.example.data/session";
const LARGE_FIXTURE_TIMEOUT_MS = 30_000;

type BundleSurface = DesenBundle["surfaces"][string];
type BundleNode = BundleSurface["root"];
type BundleAction = NonNullable<BundleNode["on"]>[string][number];
type BundlePredicate = NonNullable<BundleNode["when"]>;

let officialBundle: DesenBundle;
let officialCatalog: DesenCatalog;
let officialArtifacts: readonly InstalledPackageArtifact[];
let officialPackageAuthority: BundlePackagePreflightAuthority;

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
      else throw new TypeError("The test package distribution must contain only regular files.");
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

function withRecalculatedRevision(mutate: (bundle: DesenBundle) => void): DesenBundle {
  const bundle = cloneJson(officialBundle);
  mutate(bundle);
  bundle.revision = calculateDesenBundleRevision(bundle);
  return bundle;
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
  bundle: DesenBundle,
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

function preflight(
  bundle: DesenBundle,
  catalog: DesenCatalog = officialCatalog,
  artifacts: readonly InstalledPackageArtifact[] = officialArtifacts,
): BundleReferencePreflightResult {
  return preflightBundleReferences(packageAuthorityFor(bundle, catalog, artifacts));
}

function requirePreflighted(
  result: BundleReferencePreflightResult,
): Extract<BundleReferencePreflightResult, { readonly status: "preflighted" }> {
  if (result.status !== "preflighted") {
    throw new TypeError(`Expected M07-T04 success: ${JSON.stringify(result)}`);
  }
  expect(result.status).toBe("preflighted");
  return result;
}

function requireRejected(
  result: BundleReferencePreflightResult,
  stage: string,
  code: string,
  pointer?: string,
): Extract<BundleReferencePreflightResult, { readonly status: "rejected" }> {
  expect(result.status).toBe("rejected");
  if (result.status !== "rejected") throw new TypeError("Expected M07-T04 rejection.");
  expect(result.stage).toBe(stage);
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
  if (pointer !== undefined) expect(result.diagnostics[0]?.pointer).toBe(pointer);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.diagnostics)).toBe(true);
  expect(result.diagnostics.every((diagnostic) => Object.isFrozen(diagnostic))).toBe(true);
  expect(result).not.toHaveProperty("authority");
  return result;
}

function signInSurface(bundle: DesenBundle): BundleSurface {
  const surface = bundle.surfaces["sign-in"];
  if (surface === undefined) throw new TypeError("Missing sign-in fixture surface.");
  return surface;
}

function signInChildren(bundle: DesenBundle): BundleNode[] {
  const children = signInSurface(bundle).root.slots?.default;
  if (children === undefined) throw new TypeError("Missing sign-in fixture children.");
  return children;
}

function signInButton(bundle: DesenBundle): BundleNode {
  const button = signInChildren(bundle).find((node) => node.id === "sign-in.submit");
  if (button === undefined) throw new TypeError("Missing sign-in submit fixture node.");
  return button;
}

function signInError(bundle: DesenBundle): BundleNode {
  const error = signInChildren(bundle).find((node) => node.id === "sign-in.error");
  if (error === undefined) throw new TypeError("Missing sign-in error fixture node.");
  return error;
}

function replaceButtonActions(bundle: DesenBundle, actions: readonly BundleAction[]): void {
  signInButton(bundle).on = { press: [...actions] };
}

function catalogAndBundle(
  mutateCatalog: (catalog: DesenCatalog) => void,
  mutateBundle: (bundle: DesenBundle) => void,
): Readonly<{ readonly bundle: DesenBundle; readonly catalog: DesenCatalog }> {
  const catalog = cloneJson(officialCatalog);
  mutateCatalog(catalog);
  catalog.packageDigest = calculateWebReactPackageDigest(
    catalog as Parameters<typeof calculateWebReactPackageDigest>[0],
    officialArtifacts as Parameters<typeof calculateWebReactPackageDigest>[1],
    Number.MAX_SAFE_INTEGER,
  ).packageDigest;
  const bundle = withRecalculatedRevision((draft) => {
    const requirement = draft.requires.catalogs[0];
    if (requirement === undefined) throw new TypeError("Missing package requirement.");
    requirement.digest = catalog.packageDigest;
    mutateBundle(draft);
  });
  return Object.freeze({ bundle, catalog });
}

function stackNode(id: string, child?: BundleNode): BundleNode {
  return {
    id,
    use: "com.example.ui/Stack",
    props: { direction: "vertical" },
    ...(child === undefined ? {} : { slots: { default: [child] } }),
  };
}

function treeAtDepth(maximumDepth: number): BundleNode {
  let node = stackNode(`depth.${String(maximumDepth)}`);
  for (let depth = maximumDepth - 1; depth >= 0; depth -= 1) {
    node = stackNode(`depth.${String(depth)}`, node);
  }
  return node;
}

function repeatedTextNode(id: string, instances: number): BundleNode {
  return {
    id,
    use: "com.example.ui/Text",
    props: { text: id },
    repeat: {
      items: Array.from({ length: instances }, (_, index) => ({ id: String(index) })),
      as: "row",
      key: { $ref: "item.row.id" },
      limit: instances,
    },
  };
}

function potentialNodeSurface(lastRepeatInstances: number): BundleNode {
  return {
    id: "potential.root",
    use: "com.example.ui/Stack",
    slots: {
      default: [
        repeatedTextNode("potential.0", 1_000),
        repeatedTextNode("potential.1", 1_000),
        repeatedTextNode("potential.2", 1_000),
        repeatedTextNode("potential.3", 1_000),
        repeatedTextNode("potential.4", lastRepeatInstances),
      ],
    },
  };
}

function stateToggle(): BundleAction {
  return { type: "state.toggle", path: "flag" };
}

function installBooleanState(bundle: DesenBundle): void {
  signInSurface(bundle).state.flag = { schema: { type: "boolean" }, initial: false };
}

function settlementProgram(depth: number, maximumDepth: number): BundleAction {
  if (depth === maximumDepth) return stateToggle();
  return {
    type: "operation.invoke",
    operation: "com.example.auth/signIn",
    as: depth === 0 ? "signIn" : `settlement${String(depth)}`,
    input: { email: "person@example.com", password: "not-a-real-password" },
    onSuccess: [settlementProgram(depth + 1, maximumDepth)],
  };
}

function minimalSurface(id: string, sourceNodeCount: number): BundleSurface {
  if (!Number.isInteger(sourceNodeCount) || sourceNodeCount < 1) {
    throw new TypeError("A synthetic surface must contain at least its root node.");
  }
  const children = Array.from({ length: sourceNodeCount - 1 }, (_, index): BundleNode => ({
    id: `n${index.toString(36)}`,
    use: "com.example.ui/Text",
    props: { text: "x" },
  }));
  return {
    id,
    state: {},
    resources: {},
    root: {
      id: "root",
      use: children.length === 0 ? "com.example.ui/Text" : "com.example.ui/Stack",
      ...(children.length === 0 ? { props: { text: "x" } } : { slots: { default: children } }),
    },
  };
}

function bundleWithSurfaceNodeCounts(
  sourceNodeCounts: readonly number[],
  zeroMaterialization = false,
): DesenBundle {
  if (sourceNodeCounts.length === 0) throw new TypeError("A Bundle must contain one surface.");
  return withRecalculatedRevision((draft) => {
    const surfaces: DesenBundle["surfaces"] = {};
    for (let index = 0; index < sourceNodeCounts.length; index += 1) {
      const sourceNodeCount = sourceNodeCounts[index];
      if (sourceNodeCount === undefined) throw new TypeError("Missing synthetic node count.");
      const id = `s${index.toString(36)}`;
      surfaces[id] = minimalSurface(id, sourceNodeCount);
      if (zeroMaterialization) {
        surfaces[id].root.repeat = {
          items: [],
          as: "row",
          key: { $ref: "item.row.id" },
        };
      }
    }
    draft.entry = "s0";
    draft.surfaces = surfaces;
  });
}

function sourceNodePartitions(total: number): readonly number[] {
  const partitions: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const count = Math.min(remaining, BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceNodesPerSurface);
    partitions.push(count);
    remaining -= count;
  }
  return Object.freeze(partitions);
}

function bundleWithSingleRoot(root: BundleNode): DesenBundle {
  return withRecalculatedRevision((draft) => {
    draft.entry = "s0";
    draft.surfaces = {
      s0: {
        id: "s0",
        state: { flag: { schema: { type: "boolean" }, initial: false } },
        resources: {},
        root,
      },
    };
  });
}

function expectWithinBundleIntegrityCeiling(bundle: DesenBundle): void {
  expect(canonicalizeJsonBytes(bundle).byteLength).toBeLessThanOrEqual(
    BUNDLE_INTEGRITY_LIMITS.maxBundleCanonicalUtf8Bytes,
  );
}

function predicateWithNodeCount(nodeCount: number): BundlePredicate {
  if (!Number.isInteger(nodeCount) || nodeCount < 1 || nodeCount > 65) {
    throw new TypeError("Synthetic predicate node count must be between one and 65.");
  }
  if (nodeCount === 1) return { op: "truthy", args: [true] };
  return {
    op: "all",
    args: Array.from({ length: nodeCount - 1 }, (): BundlePredicate => ({
      op: "truthy",
      args: [true],
    })),
  };
}

function predicateAggregateRoot(predicateNodeCount: number): BundleNode {
  const children: BundleNode[] = [];
  let remaining = predicateNodeCount;
  while (remaining > 0) {
    const expressionNodes = Math.min(
      remaining,
      BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateNodesPerExpression,
    );
    children.push({
      id: `p${children.length.toString(36)}`,
      use: "com.example.ui/Text",
      props: { text: "x" },
      when: predicateWithNodeCount(expressionNodes),
    });
    remaining -= expressionNodes;
  }
  return { id: "root", use: "com.example.ui/Stack", slots: { default: children } };
}

function actionAggregateRoot(actionCount: number): BundleNode {
  const children: BundleNode[] = [];
  let remaining = actionCount;
  while (remaining > 0) {
    const programLength = Math.min(remaining, BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxActionsPerTurn);
    children.push({
      id: `a${children.length.toString(36)}`,
      use: "com.example.ui/Button",
      props: { label: "x" },
      on: { press: Array.from({ length: programLength }, stateToggle) },
    });
    remaining -= programLength;
  }
  return { id: "root", use: "com.example.ui/Stack", slots: { default: children } };
}

function commandReferenceAggregateRoot(includeOneExtraReference: boolean): Readonly<{
  readonly root: BundleNode;
  readonly commandActionCount: number;
  readonly handlerNodeCount: number;
}> {
  const fixedReferenceCount = 4;
  const handlerNodeCount = Math.ceil(
    (BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxReferenceOccurrences - fixedReferenceCount) /
      (2 * (BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxActionsPerTurn + 1)),
  );
  const commandActionCount =
    (BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxReferenceOccurrences -
      fixedReferenceCount -
      2 * handlerNodeCount) /
    2;
  if (!Number.isInteger(commandActionCount) || commandActionCount < 0) {
    throw new TypeError("Reference ceiling must admit an integral command fixture.");
  }

  const handlers: BundleNode[] = [];
  let remaining = commandActionCount;
  while (remaining > 0) {
    const programLength = Math.min(remaining, BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxActionsPerTurn);
    handlers.push({
      id: `b${handlers.length.toString(36)}`,
      use: "com.example.ui/Button",
      props: { label: "x" },
      on: {
        press: Array.from({ length: programLength }, (): BundleAction => ({
          type: "component.command",
          target: "f",
          command: "focus",
        })),
      },
    });
    remaining -= programLength;
  }
  if (handlers.length !== handlerNodeCount) {
    throw new TypeError("Reference fixture did not fill the expected handler-node count.");
  }
  if (includeOneExtraReference) {
    const last = handlers.at(-1);
    const actions = last?.on?.press;
    if (actions === undefined) throw new TypeError("Missing final reference program.");
    actions.push({ type: "navigate", surface: "s0" });
  }

  return Object.freeze({
    root: {
      id: "root",
      use: "com.example.ui/Stack",
      slots: {
        default: [
          { id: "f", use: "com.example.ui/TextField", props: { label: "x", value: "" } },
          { id: "t", use: "com.example.ui/Text", props: { text: "x" } },
          ...handlers,
        ],
      },
    },
    commandActionCount,
    handlerNodeCount,
  });
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
  officialPackageAuthority = packageAuthorityFor(officialBundle);
});

describe("M07-T04 surface, capability-reference, and activation-limit preflight", () => {
  it("preflights the real T02→T03→T04 official-derived chain as opaque immutable authority", () => {
    const accepted = requirePreflighted(preflightBundleReferences(officialPackageAuthority));

    expect(accepted.authority).toEqual({
      profile: "desen.reference.activation-preflight",
      profileVersion: 1,
      protocolVersion: "0.1.0",
      revision: EXPECTED_REVISION,
      surfaces: [
        {
          id: "home",
          sourceNodeCount: 2,
          maximumMaterializedNodeCount: 2,
          sourceTreeDepth: 1,
          capabilityReferenceCount: 2,
          actionCount: 0,
          predicateNodeCount: 0,
          settlementDepth: 0,
        },
        {
          id: "sign-in",
          sourceNodeCount: 6,
          maximumMaterializedNodeCount: 6,
          sourceTreeDepth: 1,
          capabilityReferenceCount: 7,
          actionCount: 4,
          predicateNodeCount: 1,
          settlementDepth: 1,
        },
      ],
    });
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(accepted.authority)).toBe(true);
    expect(Object.isFrozen(accepted.authority.surfaces)).toBe(true);
    expect(accepted.authority.surfaces.every((surface) => Object.isFrozen(surface))).toBe(true);
    for (const forbidden of [
      "bundle",
      "catalogSet",
      "packages",
      "artifacts",
      "stage",
      "activate",
    ]) {
      expect(accepted.authority).not.toHaveProperty(forbidden);
    }
    expect(isBundleReferencePreflightAuthority(accepted.authority)).toBe(true);
    expect(isBundleReferencePreflightAuthority({ ...accepted.authority })).toBe(false);
    const record = readBundleReferencePreflightAuthority(accepted.authority);
    expect(record?.packageAuthority).toBe(officialPackageAuthority);
    expect(record?.bundle.revision).toBe(EXPECTED_REVISION);
    expect(record?.packageRecord.packages[0]?.artifacts).toHaveLength(80);
  });

  it("rejects cloned, forged, proxied, and revoked package authorities before observing ports", () => {
    const publicShape = {
      protocolVersion: "0.1.0",
      revision: EXPECTED_REVISION,
      packages: [],
      requirementPackageIndexes: [],
    } as unknown as BundlePackagePreflightAuthority;
    let traps = 0;
    const proxied = new Proxy(publicShape, {
      get() {
        traps += 1;
        throw new Error("forged authority must remain unobserved");
      },
      ownKeys() {
        traps += 1;
        throw new Error("forged authority must remain unobserved");
      },
    });
    const revoked = Proxy.revocable(publicShape, {});
    revoked.revoke();
    const semanticsPort = vi.fn(validateDesenBundleSemantics);

    for (const authority of [
      { ...officialPackageAuthority },
      publicShape,
      proxied,
      revoked.proxy,
    ]) {
      requireRejected(
        preflightBundleReferencesInternal(authority as BundlePackagePreflightAuthority, {
          validateBundleSemantics: semanticsPort,
        }),
        "package-authority",
        INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE,
        "",
      );
    }
    expect(traps).toBe(0);
    expect(semanticsPort).not.toHaveBeenCalled();
  });

  it("rejects unknown component, behavior, resource, and nested operation capabilities exactly", () => {
    const cases: readonly Readonly<{
      readonly bundle: DesenBundle;
      readonly pointer: string;
    }>[] = [
      {
        bundle: withRecalculatedRevision((draft) => {
          signInSurface(draft).root.use = "com.example.ui/Unknown";
        }),
        pointer: "/surfaces/sign-in/root/use",
      },
      {
        bundle: withRecalculatedRevision((draft) => {
          signInSurface(draft).root.behaviors = [
            { id: "sign-in.unknown-behavior", use: "com.example.interactions/Unknown" },
          ];
        }),
        pointer: "/surfaces/sign-in/root/behaviors/0/use",
      },
      {
        bundle: withRecalculatedRevision((draft) => {
          signInSurface(draft).resources.session = {
            use: "com.example.data/Unknown",
            input: {},
            policy: "manual",
          };
        }),
        pointer: "/surfaces/sign-in/resources/session/use",
      },
      {
        bundle: withRecalculatedRevision((draft) => {
          const operation = signInButton(draft).on?.press?.[0];
          if (operation?.type !== "operation.invoke") throw new TypeError("Missing operation.");
          operation.onSuccess = [
            {
              type: "operation.invoke",
              operation: "com.example.auth/Unknown",
              as: "unknown",
              input: {},
            },
          ];
        }),
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/onSuccess/0/operation",
      },
    ];

    for (const testCase of cases) {
      requireRejected(
        preflight(testCase.bundle),
        "surface-capability-references",
        "UNKNOWN_CAPABILITY",
        testCase.pointer,
      );
    }
  });

  it("accepts exact navigation, resource, command, and event references and rejects each unknown target", () => {
    const complete = catalogAndBundle(
      (catalog) => {
        catalog.resources[RESOURCE_CAPABILITY] = {
          inputSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            additionalProperties: false,
          },
          outputSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            additionalProperties: false,
          },
          errors: [],
          policies: ["manual"],
        };
      },
      (bundle) => {
        signInSurface(bundle).resources.session = {
          use: RESOURCE_CAPABILITY,
          input: {},
          policy: "manual",
        };
        const operation = signInButton(bundle).on?.press?.[0];
        if (operation?.type !== "operation.invoke") throw new TypeError("Missing operation.");
        replaceButtonActions(bundle, [
          operation,
          { type: "resource.refresh", resource: "session" },
          { type: "component.command", target: "sign-in.email", command: "focus", input: {} },
        ]);
      },
    );
    requirePreflighted(preflight(complete.bundle, complete.catalog));

    const cases: readonly Readonly<{
      readonly bundle: DesenBundle;
      readonly code: string;
      readonly pointer: string;
    }>[] = [
      {
        bundle: withRecalculatedRevision((draft) => {
          const operation = signInButton(draft).on?.press?.[0];
          if (operation?.type !== "operation.invoke") throw new TypeError("Missing operation.");
          operation.onSuccess = [{ type: "navigate", surface: "missing" }];
        }),
        code: "ENTRY_NOT_FOUND",
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/onSuccess/0/surface",
      },
      {
        bundle: withRecalculatedRevision((draft) => {
          replaceButtonActions(draft, [{ type: "resource.refresh", resource: "missing" }]);
        }),
        code: "REFERENCE_UNRESOLVED",
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/resource",
      },
      {
        bundle: withRecalculatedRevision((draft) => {
          replaceButtonActions(draft, [
            { type: "component.command", target: "missing", command: "focus", input: {} },
          ]);
        }),
        code: "UNKNOWN_COMMAND",
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/target",
      },
      {
        bundle: withRecalculatedRevision((draft) => {
          replaceButtonActions(draft, [
            {
              type: "component.command",
              target: "sign-in.email",
              command: "teleport",
              input: {},
            },
          ]);
        }),
        code: "UNKNOWN_COMMAND",
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/command",
      },
      {
        bundle: withRecalculatedRevision((draft) => {
          replaceButtonActions(draft, [
            {
              type: "component.command",
              target: "sign-in.email",
              command: "constructor",
              input: {},
            },
          ]);
        }),
        code: "UNKNOWN_COMMAND",
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/command",
      },
      {
        bundle: withRecalculatedRevision((draft) => {
          signInButton(draft).on = { ghost: [] };
        }),
        code: "UNKNOWN_EVENT",
        pointer: "/surfaces/sign-in/root/slots/default/4/on/ghost",
      },
    ];
    for (const testCase of cases) {
      requireRejected(
        preflight(testCase.bundle),
        "surface-capability-references",
        testCase.code,
        testCase.pointer,
      );
    }
  });

  it("accepts exactly 256 surfaces and rejects 257", () => {
    const exact = bundleWithSurfaceNodeCounts(
      Array.from({ length: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSurfaces }, () => 1),
    );
    const accepted = requirePreflighted(preflight(exact));
    expect(accepted.authority.surfaces).toHaveLength(BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSurfaces);

    const over = bundleWithSurfaceNodeCounts(
      Array.from({ length: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSurfaces + 1 }, () => 1),
    );
    requireRejected(preflight(over), "activation-limits", "BUNDLE_LIMIT_EXCEEDED", "/surfaces");
  });

  it(
    "accepts 5,000 source nodes on one surface and rejects 5,001",
    () => {
      const exact = bundleWithSurfaceNodeCounts(
        [BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceNodesPerSurface],
        true,
      );
      expectWithinBundleIntegrityCeiling(exact);
      const accepted = requirePreflighted(preflight(exact));
      expect(accepted.authority.surfaces[0]).toMatchObject({
        sourceNodeCount: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceNodesPerSurface,
        maximumMaterializedNodeCount: 0,
      });

      const over = bundleWithSurfaceNodeCounts(
        [BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceNodesPerSurface + 1],
        true,
      );
      expectWithinBundleIntegrityCeiling(over);
      requireRejected(
        preflight(over),
        "activation-limits",
        "BUNDLE_LIMIT_EXCEEDED",
        "/surfaces/s0/root/slots/default/4999",
      );
    },
    LARGE_FIXTURE_TIMEOUT_MS,
  );

  it(
    "proves the 25,000 source-node aggregate is strictly dominated by the reference ceiling",
    () => {
      expect(BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceNodes).toBe(
        BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxReferenceOccurrences,
      );
      const largestAdmissibleSourceNodeCount = BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceNodes - 1;
      expect(largestAdmissibleSourceNodeCount + 1).toBe(
        BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxReferenceOccurrences,
      );

      const exactReferenceBoundary = bundleWithSurfaceNodeCounts(
        sourceNodePartitions(largestAdmissibleSourceNodeCount),
      );
      expectWithinBundleIntegrityCeiling(exactReferenceBoundary);
      const accepted = requirePreflighted(preflight(exactReferenceBoundary));
      expect(
        accepted.authority.surfaces.reduce((total, surface) => total + surface.sourceNodeCount, 0),
      ).toBe(largestAdmissibleSourceNodeCount);

      const dominatedSourceBoundary = bundleWithSurfaceNodeCounts(
        sourceNodePartitions(BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceNodes),
      );
      expectWithinBundleIntegrityCeiling(dominatedSourceBoundary);
      requireRejected(
        preflight(dominatedSourceBoundary),
        "activation-limits",
        "BUNDLE_LIMIT_EXCEEDED",
        "/surfaces/s4/root/slots/default/4998/use",
      );
    },
    LARGE_FIXTURE_TIMEOUT_MS,
  );

  it("accepts source-tree depth 64 and rejects depth 65", () => {
    const exact = withRecalculatedRevision((draft) => {
      signInSurface(draft).root = treeAtDepth(BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceTreeDepth);
    });
    const accepted = requirePreflighted(preflight(exact));
    expect(accepted.authority.surfaces.find(({ id }) => id === "sign-in")?.sourceTreeDepth).toBe(
      64,
    );

    const over = withRecalculatedRevision((draft) => {
      signInSurface(draft).root = treeAtDepth(
        BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceTreeDepth + 1,
      );
    });
    requireRejected(preflight(over), "activation-limits", "BUNDLE_LIMIT_EXCEEDED");
  });

  it("accepts 1,000 repeat instances, clamps a larger declaration, and rejects 1,001 instances", () => {
    const exact = withRecalculatedRevision((draft) => {
      const child = signInChildren(draft)[0];
      if (child === undefined) throw new TypeError("Missing repeat target.");
      child.repeat = {
        items: Array.from(
          { length: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxRepeatInstances },
          (_, index) => ({ id: String(index) }),
        ),
        as: "row",
        key: { $ref: "item.row.id" },
        limit: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxRepeatInstances,
      };
    });
    requirePreflighted(preflight(exact));

    const clamped = withRecalculatedRevision((draft) => {
      const child = signInChildren(draft)[0];
      if (child === undefined) throw new TypeError("Missing repeat target.");
      child.repeat = {
        items: [{ id: "one" }],
        as: "row",
        key: { $ref: "item.row.id" },
        limit: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxRepeatInstances + 1,
      };
    });
    requirePreflighted(preflight(clamped));

    const over = withRecalculatedRevision((draft) => {
      const child = signInChildren(draft)[0];
      if (child === undefined) throw new TypeError("Missing repeat target.");
      child.repeat = {
        items: Array.from(
          { length: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxRepeatInstances + 1 },
          (_, index) => ({ id: String(index) }),
        ),
        as: "row",
        key: { $ref: "item.row.id" },
        limit: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxRepeatInstances + 1,
      };
    });
    requireRejected(
      preflight(over),
      "activation-limits",
      "BUNDLE_LIMIT_EXCEEDED",
      "/surfaces/sign-in/root/slots/default/0/repeat/items",
    );
  });

  it("accepts exactly 5,000 potential materialized nodes and rejects 5,001", () => {
    const exactFinalRepeatInstances =
      BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxMaterializedNodesPerSurface -
      1 -
      4 * BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxRepeatInstances;
    const exact = withRecalculatedRevision((draft) => {
      signInSurface(draft).root = potentialNodeSurface(exactFinalRepeatInstances);
    });
    const accepted = requirePreflighted(preflight(exact));
    expect(
      accepted.authority.surfaces.find(({ id }) => id === "sign-in")?.maximumMaterializedNodeCount,
    ).toBe(BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxMaterializedNodesPerSurface);

    const over = withRecalculatedRevision((draft) => {
      signInSurface(draft).root = potentialNodeSurface(exactFinalRepeatInstances + 1);
    });
    requireRejected(preflight(over), "activation-limits", "BUNDLE_LIMIT_EXCEEDED");
  }, 20_000);

  it("inherits predicate arguments from T02: 64 pass and 65 fail before T04", () => {
    expect(BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateArguments).toBe(64);
    const exact = withRecalculatedRevision((draft) => {
      signInError(draft).when = {
        op: "all",
        args: Array.from(
          { length: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateArguments },
          () => true,
        ),
      };
    });
    const exactIntegrity = verifyBundleStoreEntry(
      { revision: exact.revision, bytes: canonicalizeJsonBytes(exact) },
      { status: "not-available" },
    );
    expect(exactIntegrity.status).toBe("verified");
    if (exactIntegrity.status !== "verified") throw new TypeError("Expected T02 predicate proof.");
    const packages = preflightBundlePackages(exactIntegrity.authority, [
      candidateFor(officialCatalog),
    ]);
    expect(packages.status).toBe("preflighted");
    if (packages.status !== "preflighted") throw new TypeError("Expected T03 predicate proof.");
    const accepted = requirePreflighted(preflightBundleReferences(packages.authority));
    expect(accepted.authority.surfaces.find(({ id }) => id === "sign-in")?.predicateNodeCount).toBe(
      1,
    );

    const over = withRecalculatedRevision((draft) => {
      signInError(draft).when = {
        op: "all",
        args: Array.from(
          { length: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateArguments + 1 },
          () => true,
        ),
      };
    });
    const overIntegrity = verifyBundleStoreEntry(
      { revision: over.revision, bytes: canonicalizeJsonBytes(over) },
      { status: "not-available" },
    );
    expect(overIntegrity.status).toBe("rejected");
    if (overIntegrity.status !== "rejected") {
      throw new TypeError("T02 must reject 65 predicate arguments before T04.");
    }
    expect(overIntegrity.stage).toBe("bundle-schema");
    expect(overIntegrity.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SCHEMA_INVALID",
        pointer: "/surfaces/sign-in/root/slots/default/3/when/args",
      }),
    );
    expect(overIntegrity).not.toHaveProperty("authority");
  });

  it("keeps predicate-shaped literal objects distinct from exact nested predicates", () => {
    const collisionOperands: readonly BundlePredicate["args"][number][] = [
      { op: "literal-data", args: Array.from({ length: 65 }, () => 0) },
      { op: "truthy", args: Array.from({ length: 65 }, () => false) },
      { op: "all", args: Array.from({ length: 65 }, () => true), literal: true },
    ];

    for (const collision of collisionOperands) {
      const bundle = withRecalculatedRevision((draft) => {
        signInError(draft).when = { op: "eq", args: [collision, null] };
      });
      const accepted = requirePreflighted(preflight(bundle));
      expect(
        accepted.authority.surfaces.find(({ id }) => id === "sign-in")?.predicateNodeCount,
      ).toBe(1);
    }
  });

  it("accepts 64 predicate nodes in one expression and rejects 65", () => {
    const exact = withRecalculatedRevision((draft) => {
      signInError(draft).when = predicateWithNodeCount(
        BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateNodesPerExpression,
      );
    });
    const accepted = requirePreflighted(preflight(exact));
    expect(accepted.authority.surfaces.find(({ id }) => id === "sign-in")?.predicateNodeCount).toBe(
      BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateNodesPerExpression,
    );

    const over = withRecalculatedRevision((draft) => {
      signInError(draft).when = predicateWithNodeCount(
        BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateNodesPerExpression + 1,
      );
    });
    requireRejected(
      preflight(over),
      "activation-limits",
      "BUNDLE_LIMIT_EXCEEDED",
      "/surfaces/sign-in/root/slots/default/3/when/args/63",
    );
  });

  it(
    "accepts exactly 25,000 predicate occurrences and rejects 25,001",
    () => {
      const exact = bundleWithSingleRoot(
        predicateAggregateRoot(BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateNodeOccurrences),
      );
      expectWithinBundleIntegrityCeiling(exact);
      const accepted = requirePreflighted(preflight(exact));
      expect(accepted.authority.surfaces[0]?.predicateNodeCount).toBe(
        BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateNodeOccurrences,
      );

      const over = bundleWithSingleRoot(
        predicateAggregateRoot(BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateNodeOccurrences + 1),
      );
      expectWithinBundleIntegrityCeiling(over);
      requireRejected(
        preflight(over),
        "activation-limits",
        "BUNDLE_LIMIT_EXCEEDED",
        "/surfaces/s0/root/slots/default/390/when/args/39",
      );
    },
    LARGE_FIXTURE_TIMEOUT_MS,
  );

  it("accepts 64 actions in one turn and rejects 65", () => {
    const exact = withRecalculatedRevision((draft) => {
      installBooleanState(draft);
      const operation = signInButton(draft).on?.press?.[0];
      if (operation?.type !== "operation.invoke") throw new TypeError("Missing operation.");
      replaceButtonActions(draft, [
        operation,
        ...Array.from(
          { length: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxActionsPerTurn - 1 },
          stateToggle,
        ),
      ]);
    });
    const accepted = requirePreflighted(preflight(exact));
    expect(accepted.authority.surfaces.find(({ id }) => id === "sign-in")?.actionCount).toBe(67);

    const over = withRecalculatedRevision((draft) => {
      installBooleanState(draft);
      const operation = signInButton(draft).on?.press?.[0];
      if (operation?.type !== "operation.invoke") throw new TypeError("Missing operation.");
      replaceButtonActions(draft, [
        operation,
        ...Array.from({ length: BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxActionsPerTurn }, stateToggle),
      ]);
    });
    requireRejected(
      preflight(over),
      "activation-limits",
      "BUNDLE_LIMIT_EXCEEDED",
      "/surfaces/sign-in/root/slots/default/4/on/press",
    );
  });

  it(
    "accepts exactly 25,000 action occurrences and rejects 25,001",
    () => {
      const exact = bundleWithSingleRoot(
        actionAggregateRoot(BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxActionOccurrences),
      );
      expectWithinBundleIntegrityCeiling(exact);
      const accepted = requirePreflighted(preflight(exact));
      expect(accepted.authority.surfaces[0]?.actionCount).toBe(
        BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxActionOccurrences,
      );

      const over = bundleWithSingleRoot(
        actionAggregateRoot(BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxActionOccurrences + 1),
      );
      expectWithinBundleIntegrityCeiling(over);
      requireRejected(
        preflight(over),
        "activation-limits",
        "BUNDLE_LIMIT_EXCEEDED",
        "/surfaces/s0/root/slots/default/390/on/press/40",
      );
    },
    LARGE_FIXTURE_TIMEOUT_MS,
  );

  it(
    "charges command target and command separately at the 25,000-reference boundary",
    () => {
      const exactFixture = commandReferenceAggregateRoot(false);
      expect(4 + 2 * exactFixture.handlerNodeCount + 2 * exactFixture.commandActionCount).toBe(
        BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxReferenceOccurrences,
      );
      const exact = bundleWithSingleRoot(exactFixture.root);
      expectWithinBundleIntegrityCeiling(exact);
      requirePreflighted(preflight(exact));

      const overFixture = commandReferenceAggregateRoot(true);
      const over = bundleWithSingleRoot(overFixture.root);
      expectWithinBundleIntegrityCeiling(over);
      requireRejected(
        preflight(over),
        "activation-limits",
        "BUNDLE_LIMIT_EXCEEDED",
        "/surfaces/s0/root/slots/default/194/on/press/17/surface",
      );
    },
    LARGE_FIXTURE_TIMEOUT_MS,
  );

  it("accepts settlement depth 16 and rejects depth 17", () => {
    const exact = withRecalculatedRevision((draft) => {
      installBooleanState(draft);
      replaceButtonActions(draft, [
        settlementProgram(0, BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSettlementDepth),
      ]);
    });
    const accepted = requirePreflighted(preflight(exact));
    expect(accepted.authority.surfaces.find(({ id }) => id === "sign-in")?.settlementDepth).toBe(
      16,
    );

    const over = withRecalculatedRevision((draft) => {
      installBooleanState(draft);
      replaceButtonActions(draft, [
        settlementProgram(0, BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSettlementDepth + 1),
      ]);
    });
    requireRejected(preflight(over), "activation-limits", "BUNDLE_LIMIT_EXCEEDED");
  });

  it("maps an injected semantic-validator throw to one redacted internal rejection", () => {
    const validateBundleSemantics = (() => {
      throw new Error("SENSITIVE_SEMANTIC_THROW");
    }) as typeof validateDesenBundleSemantics;
    const rejected = requireRejected(
      preflightBundleReferencesInternal(officialPackageAuthority, { validateBundleSemantics }),
      "internal",
      REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE,
      "",
    );

    expect(rejected.diagnostics).toHaveLength(1);
    expect(JSON.stringify(rejected)).not.toContain("SENSITIVE_SEMANTIC_THROW");
  });

  it("redacts an injected semantic-validation failure instead of forwarding its diagnostics", () => {
    const sensitiveDiagnostic = createCoreDiagnostic({
      code: "UNKNOWN_CAPABILITY",
      message: "SENSITIVE_SEMANTIC_DIAGNOSTIC",
      pointer: createJsonPointer(["sensitive", "location"]),
    });
    const validateBundleSemantics = (() =>
      Object.freeze({
        valid: false as const,
        target: "bundle" as const,
        diagnostics: Object.freeze([sensitiveDiagnostic]),
      })) as typeof validateDesenBundleSemantics;
    const rejected = requireRejected(
      preflightBundleReferencesInternal(officialPackageAuthority, { validateBundleSemantics }),
      "internal",
      REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE,
      "",
    );

    expect(rejected.diagnostics).toHaveLength(1);
    expect(JSON.stringify(rejected)).not.toContain("SENSITIVE_SEMANTIC_DIAGNOSTIC");
    expect(JSON.stringify(rejected)).not.toContain("/sensitive/location");
  });

  it("rejects an injected semantic success whose Bundle differs from authenticated bytes", () => {
    const validateBundleSemantics: typeof validateDesenBundleSemantics = (input, catalogSet) => {
      const result = validateDesenBundleSemantics(input, catalogSet);
      if (!result.valid) return result;
      const value = cloneJson(result.value) as unknown as DesenBundle;
      value.entry = "home";
      return Object.freeze({ ...result, value }) as unknown as typeof result;
    };

    requireRejected(
      preflightBundleReferencesInternal(officialPackageAuthority, { validateBundleSemantics }),
      "internal",
      REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE,
      "",
    );
  });

  it("calls the semantic validator once with authenticated snapshots and accepts exact success", () => {
    const validateBundleSemantics = vi.fn(validateDesenBundleSemantics);
    const accepted = requirePreflighted(
      preflightBundleReferencesInternal(officialPackageAuthority, { validateBundleSemantics }),
    );
    const record = readBundleReferencePreflightAuthority(accepted.authority);
    const call = validateBundleSemantics.mock.calls[0];
    if (record === undefined || call === undefined) {
      throw new TypeError("Expected one authenticated T04 validation call.");
    }

    expect(validateBundleSemantics).toHaveBeenCalledTimes(1);
    expect(call[0]).toBe(record.bundle);
    expect(call[1]).toBe(record.packageRecord.catalogSet);
  });
});
