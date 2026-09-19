import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types } from "node:util";
import prettier from "prettier";

import prettierConfig from "../../prettier.config.mjs";
import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { authenticateM10AT12Artifact } from "./m10a-t12-proof.mjs";
import { authenticateM10AT13Artifact } from "./m10a-t13-proof.mjs";
import { authenticateM10AT14Artifact } from "./m10a-t14-proof.mjs";
import { executeM10AT15Workloads } from "./m10a-t15-execution.mjs";
import { M10A_T16_LEGACY_INPUT_SUCCESSORS } from "./m10a-t16-legacy-input-receipts.mjs";
import { M10A_T15_APP_TEST_FILES, M10A_T15_WORKLOADS } from "./m10a-t15-workloads.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ARTIFACT_PATH = path.join(ROOT, "docs/proof/artifacts/m10a-t15.json");
const PROFILE = "desen.m10a-t15.masters-instances.v1";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const PACKAGE_ROOTS = Object.freeze([
  "packages/design-system-core",
  "packages/design-system-authoring",
  "packages/design-system-assets",
  "packages/starter-catalog-web",
]);
const APP_SOURCE_FILES = Object.freeze([
  "application.tsx",
  "application.module.css",
  "authoring-persistence.ts",
  "authoring-persistence-types.ts",
  "master-draft-banner.tsx",
  "master-draft-banner.module.css",
  "master-instance-panel.tsx",
  "master-instance-panel.module.css",
  "main.tsx",
  "persistence-controls.tsx",
  "product-bootstrap.tsx",
  "project-lifecycle.ts",
  "project-authoring-context.tsx",
  "project-authoring-controller.ts",
  "project-authoring-session.ts",
  "project-authoring-source-controller.ts",
  "project-master-draft-controller.ts",
  "project-workspace-authoring-persistence.ts",
  "starter-project.ts",
  "starter-workspace-product.tsx",
]);
const EXTRA_FILES = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "prettier.config.mjs",
  "apps/desen-app/package.json",
  "apps/desen-app/test/project-authoring-fixture.ts",
  "apps/desen-app-browser-e2e/package.json",
  "apps/desen-app-browser-e2e/product-proof-server.mjs",
  "apps/desen-app-browser-e2e/t15-masters-instances.pw.ts",
  "apps/desen-app-browser-e2e/t15-playwright.config.ts",
  "apps/design-system-workbench-proof/package.json",
  "apps/design-system-workbench-proof/vite.config.ts",
  "apps/design-system-workbench-proof/playwright.config.ts",
  "apps/design-system-workbench-proof/proof-contract.ts",
  "apps/design-system-workbench-proof/proof-reporter.ts",
  "apps/design-system-workbench-proof/design-system-workbench.pw.ts",
  "packages/editor-core/src/history.ts",
  "packages/editor-core/test/history.test.ts",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/m10a-t15-proof.mjs",
  "scripts/lib/m10a-t15-legacy-input-receipts.mjs",
  "scripts/lib/m10a-t15-execution.mjs",
  "scripts/lib/m10a-t15-workloads.mjs",
  "scripts/verify-m10a-t15.mjs",
  "scripts/generate-m10a-t15-proof.mjs",
  "tests/m10a-t15.test.mjs",
  "scripts/lib/m10a-t02-proof.mjs",
  "scripts/lib/m10a-t03-proof.mjs",
  "scripts/lib/m10a-t12-proof.mjs",
  "scripts/lib/m10a-t13-proof.mjs",
  "scripts/lib/m10a-t14-proof.mjs",
  "tests/m10a-t02.test.mjs",
  "tests/m10a-t03.test.mjs",
  "tests/m10a-t12.test.mjs",
  "tests/m10a-t13.test.mjs",
  "tests/m10a-t14.test.mjs",
]);

/** An identity, capture or immutable-publication failure at the task-owned T15 proof boundary. */
export class M10AT15ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT15ProofError";
    this.code = `M10A_T15_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT15ProofError(code, message);
}
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function noOverrides(value) {
  if (value !== undefined)
    fail(
      "OPTIONS_INVALID",
      "Production proof accepts no workspace, runner or observation overrides.",
    );
}

/**
 * Projects only the reviewed T16 successors back to the immutable T15 source identity.
 * This is a historical byte projection; workload execution still runs against the live tree.
 */
function projectM10AT15CurrentBytes(relative, bytes) {
  const successor = M10A_T16_LEGACY_INPUT_SUCCESSORS.find(({ path: owned }) => owned === relative);
  if (successor === undefined) return bytes;
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.byteLength !== successor.current.bytes ||
    sha256(bytes) !== successor.current.sha256
  )
    fail("SOURCE_DRIFT", "The T16 successor differs from its reviewed current receipt.");
  const lines = bytes.toString("utf8").split("\n");
  for (const hunk of [...successor.inverseHunks].reverse()) {
    const start = hunk.remove === 0 ? hunk.start : hunk.start - 1;
    if (start < 0 || start + hunk.remove > lines.length)
      fail("SOURCE_DRIFT", "The reviewed T16 inverse is out of bounds.");
    lines.splice(start, hunk.remove, ...hunk.restore);
  }
  const predecessor = Buffer.from(lines.join("\n"));
  if (
    predecessor.byteLength !== successor.predecessor.bytes ||
    sha256(predecessor) !== successor.predecessor.sha256
  )
    fail("SOURCE_DRIFT", "The reviewed T16 inverse does not reproduce its predecessor.");
  return predecessor;
}

async function canonical(value) {
  return Buffer.from(
    await prettier.format(JSON.stringify(value, null, 2), { ...prettierConfig, parser: "json" }),
  );
}

async function regular(relative) {
  if (
    typeof relative !== "string" ||
    path.isAbsolute(relative) ||
    relative.split("/").includes("..")
  )
    fail("SOURCE_INVALID", "Source authority must remain inside this workspace.");
  const absolute = path.join(ROOT, relative);
  const [entry, resolved] = await Promise.all([lstat(absolute), realpath(absolute)]);
  if (
    !entry.isFile() ||
    entry.size < 1 ||
    entry.size > MAX_FILE_BYTES ||
    !resolved.startsWith(`${ROOT}${path.sep}`)
  )
    fail("SOURCE_INVALID", "Source authority must be a bounded regular workspace file.");
  const bytes = await readFile(absolute);
  if (bytes.byteLength !== entry.size) fail("SOURCE_DRIFT", "Source changed during capture.");
  return bytes;
}

async function sourceFiles(directory, depth = 0) {
  if (depth > 4 || !(await lstat(path.join(ROOT, directory))).isDirectory())
    fail("SOURCE_INVALID", "Source directory authority is invalid.");
  const result = [];
  for (const entry of await readdir(path.join(ROOT, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...(await sourceFiles(relative, depth + 1)));
    else if (entry.isFile()) result.push(relative);
    else fail("SOURCE_INVALID", "Source directories cannot contain indirect authorities.");
  }
  return result.sort();
}

/** Captures current source bytes and authenticated historical predecessors, never cached success. */
export async function captureM10AT15SourceAuthority(options = undefined) {
  noOverrides(options);
  const frozen = await Promise.all(
    ["M10A-T02", "M10A-T03", "M10A-T12", "M10A-T13", "M10A-T14"].map((task) =>
      readCheckpointedFrozenArtifact(task),
    ),
  );
  const t12 = authenticateM10AT12Artifact(Buffer.from(frozen[2].bytes));
  const t13 = authenticateM10AT13Artifact(Buffer.from(frozen[3].bytes));
  const t14 = authenticateM10AT14Artifact(Buffer.from(frozen[4].bytes));
  const paths = new Set([
    ...EXTRA_FILES,
    ...APP_SOURCE_FILES.map((file) => `apps/desen-app/src/${file}`),
    ...M10A_T15_APP_TEST_FILES.map((file) => `apps/desen-app/${file}`),
    ...[...t12.source.files, ...t13.source, ...t14.source].map(({ path: relative }) => relative),
  ]);
  for (const root of PACKAGE_ROOTS) {
    for (const directory of ["src", "test"])
      for (const file of await sourceFiles(`${root}/${directory}`)) paths.add(file);
    paths.add(`${root}/package.json`);
    paths.add(`${root}/tsconfig.json`);
    paths.add(`${root}/tsconfig.build.json`);
    if (root !== "packages/design-system-assets") paths.add(`${root}/tsconfig.public-package.json`);
  }
  for (const file of await sourceFiles("apps/design-system-workbench-proof/src")) paths.add(file);
  paths.add("packages/starter-catalog-web/catalog.json");
  if (paths.size > 512) fail("SOURCE_INVALID", "T15 source inventory exceeds its task boundary.");
  const files = [];
  for (const relative of [...paths].sort()) {
    const bytes = projectM10AT15CurrentBytes(relative, await regular(relative));
    files.push({ path: relative, bytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  const catalog = JSON.parse(await regular("packages/starter-catalog-web/catalog.json"));
  const catalogReceipt = files.find(
    ({ path: relative }) => relative === "packages/starter-catalog-web/catalog.json",
  );
  if (
    catalog.id !== "run.desen.starter.web" ||
    catalog.version !== "0.7.0" ||
    catalog.target !== "web-react" ||
    Object.keys(catalog.components ?? {}).length !== 32 ||
    catalogReceipt.sha256 !== t12.source.catalog.sha256
  )
    fail(
      "CATALOG_DRIFT",
      "T15 must retain the exact T12 0.7.0 Catalog; no capability change is authorized.",
    );
  return freeze({
    files,
    catalog: {
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      componentCount: 32,
      ...catalogReceipt,
    },
    predecessors: frozen.map(({ task, path: relative, byteLength, sha256: digest }) => ({
      task,
      path: relative,
      bytes: byteLength,
      sha256: digest,
    })),
  });
}

function evidence(source, execution) {
  return freeze({
    schemaVersion: 1,
    task: "M10A-T15",
    proofId: "m10a-t15",
    profile: PROFILE,
    result: "PASS",
    source,
    workloads: M10A_T15_WORKLOADS,
    execution,
    claims: {
      projectSchemaV2LosslessMigration: true,
      explicitAuthoringOnlyRecipeGraph: true,
      stableQualifiedSourceIdentityAndWiring: true,
      exactStoredMaterializationBeforePublisher: true,
      atomicWholeProjectHistoryAndWorkspaceCas: true,
      normalAppVisualMasterDraft: true,
      twoLinkedUpdatesWithLocalOverrideAndDetachedThird: true,
      isolatedDraftUndoAndOneLiveApplyTransaction: true,
      completeSaveReopenEquality: true,
      staleRecursiveConflictingAndForeignChangesRejected: true,
      inheritedThemeStyleAssetAndReuseCoverageRunsFresh: true,
      runtimeCoreAndProtocolUnchanged: true,
    },
    nonClaims: [
      "Local evidence is not exact-head hosted Quality gate, merge or fresh-main closure.",
      "Masters are project-local authoring data, not new Runtime or Publisher recipe semantics.",
      "T15 does not add variants, library releases, multiplayer editing, production integration, G10A or M11 authority.",
      "The master browser journey proves local authoring/persistence, not master publication or host activation.",
    ],
  });
}

/** Validates exact canonical evidence bytes against a newly computed value, not a supplied PASS flag. */
export async function validateM10AT15EvidenceBytes(bytes, expected) {
  if (
    types.isProxy(bytes) ||
    !Buffer.isBuffer(bytes) ||
    bytes.byteLength > MAX_FILE_BYTES ||
    !bytes.equals(await canonical(expected))
  )
    fail("ARTIFACT_DRIFT", "T15 evidence differs from the current source and fresh execution.");
}

async function freshEvidence() {
  const before = await captureM10AT15SourceAuthority();
  const execution = await executeM10AT15Workloads();
  const after = await captureM10AT15SourceAuthority();
  if (!isDeepStrictEqual(before, after))
    fail("SOURCE_DRIFT", "Sources changed while T15 was executing; no evidence is authorized.");
  return evidence(after, execution);
}

/** Captures a full fresh T15 run; there is no recorded-observation or runner override. */
export async function buildM10AT15Evidence(options = undefined) {
  noOverrides(options);
  return freshEvidence();
}

/** Writes only the owning T15 artifact after all fresh work and source fences pass. */
export async function writeM10AT15Evidence(options = undefined) {
  noOverrides(options);
  const captured = await freshEvidence();
  const bytes = await canonical(captured);
  await writeAtomicProofArtifact({ artifactPath: ARTIFACT_PATH, artifactBytes: bytes });
  await validateM10AT15EvidenceBytes(await readFile(ARTIFACT_PATH), captured);
  return {
    status: "PASS",
    task: "M10A-T15",
    artifactPath: ARTIFACT_PATH,
    artifactBytes: bytes.byteLength,
    artifactSha256: sha256(bytes),
    freshWorkloads: captured.execution.length,
  };
}

/** Re-admits the recorded source identity, reruns every owner, and compares the exact fresh result. */
export async function verifyM10AT15Evidence(options = undefined) {
  noOverrides(options);
  const bytes = await regular("docs/proof/artifacts/m10a-t15.json");
  let captured;
  try {
    captured = JSON.parse(bytes);
  } catch {
    fail("ARTIFACT_DRIFT", "T15 evidence must be valid JSON.");
  }
  if (!isDeepStrictEqual(captured.source, await captureM10AT15SourceAuthority()))
    fail("SOURCE_DRIFT", "T15 recorded source authority is not current.");
  await validateM10AT15EvidenceBytes(bytes, await freshEvidence());
  return {
    status: "PASS",
    task: "M10A-T15",
    artifactBytes: bytes.byteLength,
    artifactSha256: sha256(bytes),
    freshWorkloads: M10A_T15_WORKLOADS.length,
  };
}
