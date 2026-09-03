import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const EXPECTED_BASE_COMMIT = "a1d26905aec6ee3d4bcb73ca17b02187e7b57420";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = await realpath(path.resolve(SCRIPT_DIRECTORY, ".."));
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-failure-fixture.json";
const LEGACY_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json";
const LEGACY_BEHAVIOR_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json";
const PREDECESSOR_GAP_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/product-proof-server.mjs",
  "apps/desen-app/dev/local-dev-host.mjs",
  "apps/desen-app/dev/local-dev-host.test.mjs",
  "apps/desen-app/src/preview-controls.tsx",
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "apps/desen-app/tsconfig.local-dev.json",
  "scripts/verify-boundary-fixtures.mjs",
  "tests/boundaries/README.md",
]);
const rawArguments = process.argv.slice(2);
if (rawArguments.length !== 1 || rawArguments[0]?.length === 0) {
  throw new Error(
    "Usage: node scripts/generate-desen-app-t03-historical-reader-bridge.mjs <output-path>",
  );
}
const rawOutputPath = path.resolve(rawArguments[0]);
const outputPath = path.join(
  await realpath(path.dirname(rawOutputPath)),
  path.basename(rawOutputPath),
);

const parentArtifact = JSON.parse(
  await readFile(path.join(WORKSPACE_ROOT, PARENT_ARTIFACT_PATH), "utf8"),
);
if (
  parentArtifact.task !== "M10-T03" ||
  parentArtifact.proofId !== "desen-app-failure-fixture" ||
  parentArtifact.result !== "PASS"
) {
  throw new Error("The committed M10-T03 artifact is not the expected parent authority.");
}
const parentPaths = parentArtifact.boundary?.trackedReceipts?.map(({ path: value }) => value);
if (!Array.isArray(parentPaths) || parentPaths.length !== 34) {
  throw new Error("The M10-T03 artifact does not expose its exact 34-file authority.");
}
const taskTimePaths = Object.freeze(
  [...new Set([...parentPaths, ...PREDECESSOR_GAP_PATHS])].sort((left, right) =>
    left.localeCompare(right, "en-US"),
  ),
);
if (taskTimePaths.length !== 42) {
  throw new Error("The T03 bridge path union is not exact.");
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
const taskTimeArtifact = JSON.parse(git("show", `${EXPECTED_BASE_COMMIT}:${PARENT_ARTIFACT_PATH}`));
if (JSON.stringify(taskTimeArtifact) !== JSON.stringify(parentArtifact)) {
  throw new Error("The committed M10-T03 artifact differs from its exact task-time projection.");
}
const legacyArtifactBytes = git("show", `${EXPECTED_BASE_COMMIT}:${LEGACY_ARTIFACT_PATH}`);
if (
  legacyArtifactBytes.byteLength !== 20_173 ||
  createHash("sha256").update(legacyArtifactBytes).digest("hex") !==
    "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e"
) {
  throw new Error("The immutable M10-T01A gap-receipt authority drifted.");
}
const legacyArtifact = JSON.parse(legacyArtifactBytes);
const legacyBehaviorArtifactBytes = git(
  "show",
  `${EXPECTED_BASE_COMMIT}:${LEGACY_BEHAVIOR_ARTIFACT_PATH}`,
);
if (
  legacyBehaviorArtifactBytes.byteLength !== 10_962 ||
  createHash("sha256").update(legacyBehaviorArtifactBytes).digest("hex") !==
    "cd7366014a0cb6f056fa78392f81ef7cb4b5be2f523b95e5984c704be3caf0e8"
) {
  throw new Error("The immutable M10-T01B gap-receipt authority drifted.");
}
const legacyBehaviorArtifact = JSON.parse(legacyBehaviorArtifactBytes);

const files = Object.create(null);
for (const relativePath of taskTimePaths) {
  const bytes = git("show", `${EXPECTED_BASE_COMMIT}:${relativePath}`);
  const receipt =
    parentArtifact.boundary.trackedReceipts.find(
      ({ path: candidate }) => candidate === relativePath,
    ) ??
    legacyArtifact.boundary.trackedReceipts.find(
      ({ path: candidate }) => candidate === relativePath,
    ) ??
    legacyBehaviorArtifact.boundary.trackedReceipts.find(
      ({ path: candidate }) => candidate === relativePath,
    );
  if (receipt === undefined) {
    throw new Error(`No immutable task-time receipt exists for ${relativePath}.`);
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (receipt.bytes !== bytes.byteLength || receipt.sha256 !== digest) {
    throw new Error(`Task-time receipt drifted for ${relativePath}.`);
  }
  files[relativePath] = bytes.toString("base64");
}

const payload = {
  schemaVersion: 1,
  profile: "desen.app.m10-t03-historical-reader-bridge.v1",
  baseCommit: EXPECTED_BASE_COMMIT,
  successorAddedPaths: [
    "apps/desen-app/src/local-workspaces.tsx",
    "apps/desen-app/src/local-workspaces.module.css",
    "apps/desen-app/src/reference-flow-workspace-profile.ts",
    "apps/desen-app/test/local-workspaces.test.tsx",
    "apps/desen-app/test/reference-flow-workspace-profile.test.ts",
    "apps/desen-app/src/authoring-integration.ts",
    "apps/desen-app/test/authoring-integration.test.ts",
    "apps/desen-app/src/local-operation-binding.ts",
    "apps/desen-app/test/local-operation-binding.test.ts",
    "apps/desen-app/dev/local-operation-host.mjs",
    "apps/desen-app/dev/local-operation-host.test.mjs",
    "apps/desen-app/src/authoring-run-navigation.ts",
    "apps/desen-app/test/authoring-run-navigation.test.ts",
    "apps/desen-app/test/success-host-navigation.test.tsx",
    "apps/desen-app-browser-e2e/success-host-operation.pw.ts",
    "apps/desen-app-browser-e2e/success-host-playwright.config.ts",
  ].sort((left, right) => left.localeCompare(right, "en-US")),
  files,
  projections: {
    "desen-app-failure-fixture": taskTimeArtifact,
  },
};
const bytes = Buffer.from(`${JSON.stringify(payload)}\n`);
await writeFile(outputPath, gzipSync(bytes, { level: 9, mtime: 0 }), { flag: "wx" });
