import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { calculateDesenBundleRevision, canonicalizeJsonBytes } from "@desen/protocol";
import Database from "better-sqlite3";

import {
  openBundleRuntimeActivation,
  openBundleStore,
  preflightBundlePackages,
  preflightBundleReferences,
  stageBundleRuntime,
  verifyBundleStoreEntry,
} from "../src/index.js";

import type { DesenBundle, DesenCatalog } from "@desen/protocol";
import type {
  BundlePackagePreflightAuthority,
  BundleReferencePreflightAuthority,
  BundleRuntimeActivation,
  BundleRuntimeActivationAuthority,
  BundleRuntimeStagingAuthority,
  BundleStore,
  InstalledPackageArtifact,
  InstalledPackageCandidate,
  RuntimeActivationRecord,
} from "../src/index.js";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");
const BUNDLE_PATH = join(WORKSPACE_ROOT, "examples/sign-in/official-derived.bundle.desen.json");
const SOURCE_PATH = join(
  WORKSPACE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
);
const CATALOG_PATH = join(WORKSPACE_ROOT, "packages/reference-catalog-web/catalog.json");
const DISTRIBUTION_ROOT = join(WORKSPACE_ROOT, "packages/reference-catalog-web/dist");

export const RUNTIME_ACTIVATION_DATABASE_FILE_NAME = "runtime-activation.sqlite3";

export interface RuntimeFaultFixtures {
  readonly activeBundle: DesenBundle;
  readonly candidateBundle: DesenBundle;
  readonly referenceInvalidBundle: DesenBundle;
  readonly referenceLimitBundle: DesenBundle;
  readonly stagingInvalidBundle: DesenBundle;
  readonly catalog: DesenCatalog;
  readonly artifacts: readonly InstalledPackageArtifact[];
  readonly sourceBytes: Uint8Array;
  readonly sourceDigestMismatchBytes: Uint8Array;
}

export interface RuntimeActivationPair {
  readonly packageAuthority: BundlePackagePreflightAuthority;
  readonly referenceAuthority: BundleReferencePreflightAuthority;
  readonly stagingAuthority: BundleRuntimeStagingAuthority;
}

export interface ActiveRuntimeBaseline {
  readonly activation: BundleRuntimeActivation;
  readonly authority: BundleRuntimeActivationAuthority;
  readonly record: RuntimeActivationRecord;
  readonly store: BundleStore;
}

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function stackNode(
  id: string,
  child?: DesenBundle["surfaces"][string]["root"],
): DesenBundle["surfaces"][string]["root"] {
  return {
    id,
    use: "com.example.ui/Stack",
    props: { direction: "vertical" },
    ...(child === undefined ? {} : { slots: { default: [child] } }),
  };
}

function treeAtDepth(maximumDepth: number): DesenBundle["surfaces"][string]["root"] {
  let node = stackNode(`depth.${String(maximumDepth)}`);
  for (let depth = maximumDepth - 1; depth >= 0; depth -= 1) {
    node = stackNode(`depth.${String(depth)}`, node);
  }
  return node;
}

function withRevision(source: DesenBundle, mutate: (bundle: DesenBundle) => void): DesenBundle {
  const bundle = cloneJson(source);
  mutate(bundle);
  bundle.revision = calculateDesenBundleRevision(bundle);
  return bundle;
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
      else throw new TypeError("The fault-matrix package fixture must contain regular files only.");
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

/** Loads one immutable fixture family shared by every bounded T09 boundary case. */
export async function loadRuntimeFaultFixtures(): Promise<RuntimeFaultFixtures> {
  const [bundleText, sourceBytes, catalogText, artifacts] = await Promise.all([
    readFile(BUNDLE_PATH, "utf8"),
    readFile(SOURCE_PATH),
    readFile(CATALOG_PATH, "utf8"),
    distributionArtifacts(),
  ]);
  const activeBundle = JSON.parse(bundleText) as DesenBundle;
  const candidateBundle = withRevision(activeBundle, (bundle) => {
    const title = bundle.surfaces["sign-in"]?.root.slots?.["default"]?.find(
      ({ id }) => id === "sign-in.title",
    );
    if (title?.props === undefined) throw new TypeError("Expected the official title fixture.");
    title.props = { ...title.props, text: "Fault-matrix candidate" };
  });
  const referenceInvalidBundle = withRevision(activeBundle, (bundle) => {
    const title = bundle.surfaces["sign-in"]?.root.slots?.["default"]?.find(
      ({ id }) => id === "sign-in.title",
    );
    if (title === undefined) throw new TypeError("Expected the official title fixture.");
    title.use = "com.example.ui/Unknown";
  });
  const referenceLimitBundle = withRevision(activeBundle, (bundle) => {
    const surface = bundle.surfaces["sign-in"];
    if (surface === undefined) throw new TypeError("Expected the official sign-in surface.");
    surface.root = treeAtDepth(65);
  });
  const stagingInvalidBundle = withRevision(activeBundle, (bundle) => {
    const text = bundle.surfaces["sign-in"]?.root.slots?.["default"]?.find(
      ({ use }) => use === "com.example.ui/Text",
    );
    if (text === undefined) throw new TypeError("Expected the official Text fixture.");
    text.props = { text: 42 };
  });
  const source = JSON.parse(sourceBytes.toString("utf8")) as Record<string, unknown>;
  source.id = "com.example.account-app-fault-matrix";

  return Object.freeze({
    activeBundle,
    candidateBundle,
    referenceInvalidBundle,
    referenceLimitBundle,
    stagingInvalidBundle,
    catalog: JSON.parse(catalogText) as DesenCatalog,
    artifacts,
    sourceBytes: new Uint8Array(sourceBytes),
    sourceDigestMismatchBytes: new TextEncoder().encode(JSON.stringify(source)),
  });
}

/** Creates the exact inert installed-package candidate used by the public T03 boundary. */
export function installedCandidate(
  fixtures: RuntimeFaultFixtures,
  artifacts: readonly InstalledPackageArtifact[] = fixtures.artifacts,
): InstalledPackageCandidate {
  return Object.freeze({
    id: fixtures.catalog.id,
    version: fixtures.catalog.version,
    target: fixtures.catalog.target,
    catalog: fixtures.catalog,
    artifacts,
  });
}

/** Builds an exact authentic T03 authority through the public T02 and T03 operations. */
export function packageAuthorityFor(
  fixtures: RuntimeFaultFixtures,
  bundle: DesenBundle,
): BundlePackagePreflightAuthority {
  const integrity = verifyBundleStoreEntry(
    { revision: bundle.revision, bytes: canonicalizeJsonBytes(bundle) },
    { status: "not-available" },
  );
  if (integrity.status !== "verified") {
    throw new TypeError(`Expected T02 success, received ${integrity.stage}.`);
  }
  const packages = preflightBundlePackages(integrity.authority, [installedCandidate(fixtures)]);
  if (packages.status !== "preflighted") {
    throw new TypeError(`Expected T03 success, received ${packages.stage}.`);
  }
  return packages.authority;
}

/** Builds one exact T04/T06 pair through the public production functions. */
export function activationPairFor(
  fixtures: RuntimeFaultFixtures,
  bundle: DesenBundle,
): RuntimeActivationPair {
  const packageAuthority = packageAuthorityFor(fixtures, bundle);
  const references = preflightBundleReferences(packageAuthority);
  const staging = stageBundleRuntime(packageAuthority);
  if (references.status !== "preflighted" || staging.status !== "staged") {
    throw new TypeError("Expected one exact public T04/T06 activation pair.");
  }
  return Object.freeze({
    packageAuthority,
    referenceAuthority: references.authority,
    stagingAuthority: staging.authority,
  });
}

/** Stores complete canonical Bundles beneath one already-created application-owned root. */
export async function storeBundles(
  rootDirectory: string,
  bundles: readonly DesenBundle[],
): Promise<BundleStore> {
  const store = await openBundleStore({ rootDirectory });
  for (const bundle of bundles) {
    const stored = await store.putBundle({
      revision: bundle.revision,
      bytes: canonicalizeJsonBytes(bundle),
    });
    if (stored.status !== "stored" && stored.status !== "unchanged") {
      throw new TypeError(`Could not store fixture ${bundle.revision}.`);
    }
  }
  return store;
}

/** Creates one real SQLite generation-zero A baseline through the public activation service. */
export async function activateBaseline(
  fixtures: RuntimeFaultFixtures,
  rootDirectory: string,
  additionalBundles: readonly DesenBundle[] = [],
): Promise<ActiveRuntimeBaseline> {
  const store = await storeBundles(rootDirectory, [fixtures.activeBundle, ...additionalBundles]);
  const activation = await openBundleRuntimeActivation({ rootDirectory });
  const pair = activationPairFor(fixtures, fixtures.activeBundle);
  const result = await activation.activate(pair.referenceAuthority, pair.stagingAuthority, null);
  if (result.status !== "activated") {
    throw new TypeError(`Expected generation-zero activation, received ${result.status}.`);
  }
  const record = Object.freeze({
    activeRevision: result.authority.activeRevision,
    previousGoodRevision: result.authority.previousGoodRevision,
    generation: result.authority.generation,
  });
  return Object.freeze({ activation, authority: result.authority, record, store });
}

/** Reads the exact durable singleton through an independent read-only SQLite observation. */
export function readDurableRecord(rootDirectory: string): RuntimeActivationRecord | null {
  const database = new Database(join(rootDirectory, RUNTIME_ACTIVATION_DATABASE_FILE_NAME), {
    fileMustExist: true,
    readonly: true,
  });
  try {
    const row = database
      .prepare(
        "SELECT active_revision AS activeRevision, previous_good_revision AS previousGoodRevision, generation FROM runtime_activation WHERE singleton = 1",
      )
      .get() as RuntimeActivationRecord | undefined;
    return row === undefined
      ? null
      : Object.freeze({
          activeRevision: row.activeRevision,
          previousGoodRevision: row.previousGoodRevision,
          generation: row.generation,
        });
  } finally {
    database.close();
  }
}

/** Replaces the singleton only for a controlled external-drift recovery test. */
export function writeDurableRecord(rootDirectory: string, record: RuntimeActivationRecord): void {
  const database = new Database(join(rootDirectory, RUNTIME_ACTIVATION_DATABASE_FILE_NAME), {
    fileMustExist: true,
  });
  try {
    database.exec("BEGIN IMMEDIATE");
    database.prepare("DELETE FROM runtime_activation WHERE singleton = 1").run();
    database
      .prepare(
        "INSERT INTO runtime_activation (singleton, active_revision, previous_good_revision, generation) VALUES (1, ?, ?, ?)",
      )
      .run(record.activeRevision, record.previousGoodRevision, record.generation);
    database.exec("COMMIT");
  } catch (error) {
    if (database.inTransaction) database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

/** Returns the exact immutable Bundle leaf path for one controlled temp-root mutation. */
export function bundleFilePath(rootDirectory: string, revision: string): string {
  const digest = revision.slice("sha256:".length);
  return join(rootDirectory, "bundles", "sha256", digest.slice(0, 2), `${digest.slice(2)}.bundle`);
}
