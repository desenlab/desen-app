import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { matchesAmendedHistoricalReceipt } from "./lib/historical-archive-redaction.mjs";

const EXPECTED_BASE_COMMIT = "33b922e6746365510c0549ddbf3b08469e58dc11";
const EXPECTED_T01A_BASE_COMMIT = "39a3c6c7a477b700b332b725a9ddf5d1956c0ba5";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = await realpath(path.resolve(SCRIPT_DIRECTORY, ".."));
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-success-host-operation.json";
const T01A_ARTIFACT_PIN = Object.freeze({
  path: "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json",
  bytes: 20_173,
  sha256: "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
});
const T01A_ANCESTOR_GAP_RECEIPTS = Object.freeze([
  Object.freeze({
    path: "apps/desen-app/package.json",
    bytes: 4_122,
    sha256: "7038647aa1809f07ee5131d0df8d0bee75bf1f2cdf0358be738b2c3603b64577",
  }),
]);
const APPROVED_AR_01_RECEIPT_PATHS = Object.freeze([
  "docs/proof/artifacts/desen-app-0.1.0-t03-historical-reader-bridge.json.gz",
  "scripts/generate-desen-app-t03-historical-reader-bridge.mjs",
]);
const PREDECESSOR_GAP_RECEIPTS = Object.freeze([
  Object.freeze({
    path: "apps/desen-app/dev/local-dev.mjs",
    bytes: 1_313,
    sha256: "8e7e4fe465a9ce46737bf1bc0c0e1154d62feeac7a96443a5cd7952412881a1e",
  }),
  Object.freeze({
    path: "pnpm-lock.yaml",
    bytes: 131_888,
    sha256: "23632d4c1d8bc8832a31db328fa36c7f1523aeb7c52f034ddbb3f8edecc4c002",
  }),
]);
const SUCCESSOR_ADDED_PATHS = Object.freeze(
  [
    "apps/desen-app-browser-e2e/published-host-playwright.config.ts",
    "apps/desen-app-browser-e2e/published-host-proof-server.mjs",
    "apps/desen-app-browser-e2e/published-host-update.pw.ts",
    "apps/desen-app/dev/local-publication-host.mjs",
    "apps/desen-app/dev/local-publication-host.test.mjs",
    "apps/desen-app/src/local-runtime-publication.ts",
    "apps/desen-app/test/local-runtime-publication.test.ts",
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

const rawArguments = process.argv.slice(2);
if (rawArguments.length !== 1 || rawArguments[0]?.length === 0) {
  throw new Error(
    "Usage: node scripts/generate-desen-app-t04-historical-reader-bridge.mjs <output-path>",
  );
}
const rawOutputPath = path.resolve(rawArguments[0]);
const outputPath = path.join(
  await realpath(path.dirname(rawOutputPath)),
  path.basename(rawOutputPath),
);

const parentArtifactBytes = await readFile(path.join(WORKSPACE_ROOT, PARENT_ARTIFACT_PATH));
const parentArtifact = JSON.parse(parentArtifactBytes);
if (
  parentArtifact.task !== "M10-T04" ||
  parentArtifact.proofId !== "desen-app-success-host-operation" ||
  parentArtifact.profile !== "desen.app.success-host-operation-proof.v1" ||
  parentArtifact.result !== "PASS"
) {
  throw new Error("The committed M10-T04 artifact is not the expected parent authority.");
}
const parentReceipts = parentArtifact.boundary?.trackedReceipts;
if (!Array.isArray(parentReceipts) || parentReceipts.length !== 51) {
  throw new Error("The M10-T04 artifact does not expose its exact 51-file authority.");
}
const taskTimePaths = Object.freeze(
  parentReceipts
    .map(({ path: value }) => value)
    .sort((left, right) => left.localeCompare(right, "en-US")),
);
if (new Set(taskTimePaths).size !== 51) {
  throw new Error("The M10-T04 bridge path inventory is not exact.");
}

const git = (...arguments_) =>
  execFileSync("git", arguments_, {
    cwd: WORKSPACE_ROOT,
    encoding: "buffer",
    maxBuffer: 32 * 1_024 * 1_024,
  });
const resolvedBase = git("rev-parse", EXPECTED_BASE_COMMIT).toString("utf8").trim();
if (resolvedBase !== EXPECTED_BASE_COMMIT) {
  throw new Error(`Missing exact task-time commit ${EXPECTED_BASE_COMMIT}.`);
}
const resolvedT01aBase = git("rev-parse", EXPECTED_T01A_BASE_COMMIT).toString("utf8").trim();
if (resolvedT01aBase !== EXPECTED_T01A_BASE_COMMIT) {
  throw new Error(`Missing exact T01A task-time commit ${EXPECTED_T01A_BASE_COMMIT}.`);
}
const taskTimeArtifactBytes = git("show", `${EXPECTED_BASE_COMMIT}:${PARENT_ARTIFACT_PATH}`);
if (!taskTimeArtifactBytes.equals(parentArtifactBytes)) {
  throw new Error("The committed M10-T04 artifact differs from its exact clean task-time bytes.");
}

const t01aArtifactBytes = await readFile(path.join(WORKSPACE_ROOT, T01A_ARTIFACT_PIN.path));
const taskTimeT01aArtifactBytes = git(
  "show",
  `${EXPECTED_T01A_BASE_COMMIT}:${T01A_ARTIFACT_PIN.path}`,
);
if (
  t01aArtifactBytes.byteLength !== T01A_ARTIFACT_PIN.bytes ||
  createHash("sha256").update(t01aArtifactBytes).digest("hex") !== T01A_ARTIFACT_PIN.sha256 ||
  !taskTimeT01aArtifactBytes.equals(t01aArtifactBytes)
) {
  throw new Error("The immutable M10-T01A artifact differs from its exact clean task-time bytes.");
}
const t01aArtifact = JSON.parse(t01aArtifactBytes);
if (
  t01aArtifact.task !== "M10-T01A" ||
  t01aArtifact.proofId !== "desen-app-user-created-blank-project" ||
  t01aArtifact.profile !== "desen.app.user-created-blank-project-proof.v1" ||
  t01aArtifact.result !== "PASS"
) {
  throw new Error("The immutable M10-T01A artifact is not the expected ancestor authority.");
}
const t01aArtifactReceipts = t01aArtifact.boundary?.trackedReceipts;
if (!Array.isArray(t01aArtifactReceipts)) {
  throw new Error("The immutable M10-T01A artifact has no tracked receipt authority.");
}
for (const receipt of T01A_ANCESTOR_GAP_RECEIPTS) {
  const matches = t01aArtifactReceipts.filter(({ path: candidate }) => candidate === receipt.path);
  if (
    matches.length !== 1 ||
    matches[0].bytes !== receipt.bytes ||
    matches[0].sha256 !== receipt.sha256
  ) {
    throw new Error(`M10-T01A ancestor receipt drifted for ${receipt.path}.`);
  }
}

const files = Object.create(null);
for (const relativePath of taskTimePaths) {
  const bytes = git("show", `${EXPECTED_BASE_COMMIT}:${relativePath}`);
  const receipt = parentReceipts.find(({ path: candidate }) => candidate === relativePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const exactReceipt = receipt?.bytes === bytes.byteLength && receipt.sha256 === digest;
  const approvedAmendment =
    receipt !== undefined &&
    APPROVED_AR_01_RECEIPT_PATHS.includes(relativePath) &&
    matchesAmendedHistoricalReceipt(receipt, bytes);
  if (
    receipt === undefined ||
    (!exactReceipt && !approvedAmendment) ||
    (exactReceipt && APPROVED_AR_01_RECEIPT_PATHS.includes(relativePath))
  ) {
    throw new Error(`Clean task-time receipt drifted for ${relativePath}.`);
  }
  files[relativePath] = bytes.toString("base64");
}

const predecessorGapFiles = Object.create(null);
for (const receipt of PREDECESSOR_GAP_RECEIPTS) {
  if (taskTimePaths.includes(receipt.path)) {
    throw new Error(`T04 predecessor gap duplicates a parent receipt: ${receipt.path}.`);
  }
  const bytes = git("show", `${EXPECTED_BASE_COMMIT}:${receipt.path}`);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== receipt.bytes || digest !== receipt.sha256) {
    throw new Error(`T04 predecessor gap receipt drifted for ${receipt.path}.`);
  }
  predecessorGapFiles[receipt.path] = bytes.toString("base64");
}

const t01aAncestorFiles = Object.create(null);
for (const receipt of T01A_ANCESTOR_GAP_RECEIPTS) {
  const bytes = git("show", `${EXPECTED_T01A_BASE_COMMIT}:${receipt.path}`);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== receipt.bytes || digest !== receipt.sha256) {
    throw new Error(`M10-T01A ancestor gap receipt drifted for ${receipt.path}.`);
  }
  t01aAncestorFiles[receipt.path] = bytes.toString("base64");
}

const payload = {
  schemaVersion: 1,
  profile: "desen.app.m10-t04-historical-reader-bridge.v1",
  baseCommit: EXPECTED_BASE_COMMIT,
  t01aAncestor: {
    task: "M10-T01A",
    baseCommit: EXPECTED_T01A_BASE_COMMIT,
    artifact: T01A_ARTIFACT_PIN,
    files: t01aAncestorFiles,
  },
  successorAddedPaths: SUCCESSOR_ADDED_PATHS,
  predecessorGapFiles,
  files,
  projections: {
    "desen-app-success-host-operation": parentArtifact,
  },
};
const bytes = Buffer.from(`${JSON.stringify(payload)}\n`, "utf8");
await writeFile(outputPath, gzipSync(bytes, { level: 9, mtime: 0 }), { flag: "wx" });
