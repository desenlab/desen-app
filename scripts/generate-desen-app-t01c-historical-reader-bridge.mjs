import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { redactHistoricalArchiveForPublication } from "./lib/historical-archive-redaction.mjs";

const EXPECTED_BASE_COMMIT = "3814002f89ec8e75019431cd1475a98c97041b0c";
const EXPECTED_PREDECESSOR_COMMIT = "a44575d48e073468da6b25eb8b31a375218caf0a";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = await realpath(path.resolve(SCRIPT_DIRECTORY, ".."));
const PARENT_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-evergreen-product-composition.json";
const rawArguments = process.argv.slice(2);
if (rawArguments.length !== 1 || rawArguments[0]?.length === 0) {
  throw new Error(
    "Usage: node scripts/generate-desen-app-t01c-historical-reader-bridge.mjs <output-path>",
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
  parentArtifact.task !== "M10-T01C" ||
  parentArtifact.proofId !== "desen-app-evergreen-product-composition" ||
  parentArtifact.result !== "PASS"
) {
  throw new Error("The committed M10-T01C artifact is not the expected parent authority.");
}
const parentPaths = parentArtifact.boundary?.trackedReceipts?.map(({ path: value }) => value);
if (!Array.isArray(parentPaths) || parentPaths.length !== 64) {
  throw new Error("The M10-T01C artifact does not expose its exact 64-file authority.");
}
const predecessorGapPaths = Object.freeze([
  "apps/desen-app-browser-e2e/package.json",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/behavior-controls.tsx",
  "apps/desen-app/test/authoring-connections.test.ts",
]);
const taskTimePaths = Object.freeze(
  [...new Set([...parentPaths, ...predecessorGapPaths])].sort((left, right) =>
    left.localeCompare(right, "en-US"),
  ),
);
if (taskTimePaths.length !== 68) {
  throw new Error("The T01C bridge path union is not exact.");
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
  throw new Error("The committed M10-T01C artifact differs from its exact task-time projection.");
}

const files = Object.create(null);
for (const relativePath of taskTimePaths) {
  const bytes = git("show", `${EXPECTED_BASE_COMMIT}:${relativePath}`);
  const receipt = parentArtifact.boundary.trackedReceipts.find(
    ({ path: candidate }) => candidate === relativePath,
  );
  if (receipt !== undefined) {
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (receipt.bytes !== bytes.byteLength || receipt.sha256 !== digest) {
      throw new Error(`Task-time receipt drifted for ${relativePath}.`);
    }
  } else if (!bytes.equals(git("show", `${EXPECTED_PREDECESSOR_COMMIT}:${relativePath}`))) {
    throw new Error(`Predecessor gap bytes are not shared by T01B and T01C: ${relativePath}.`);
  }
  files[relativePath] = bytes.toString("base64");
}

const payload = {
  schemaVersion: 1,
  profile: "desen.app.m10-t01c-historical-reader-bridge.v1",
  baseCommit: EXPECTED_BASE_COMMIT,
  successorAddedPaths: [
    "apps/desen-app-browser-e2e/input-pending-fixture.pw.ts",
    "apps/desen-app-browser-e2e/input-pending-playwright.config.ts",
  ],
  files,
  projections: {
    "desen-app-evergreen-product-composition": taskTimeArtifact,
  },
};
const bytes = Buffer.from(`${JSON.stringify(payload)}\n`);
const sanitizedBytes = redactHistoricalArchiveForPublication(
  "docs/proof/artifacts/desen-app-0.1.0-t01c-historical-reader-bridge.json.gz",
  gzipSync(bytes, { level: 9, mtime: 0 }),
);
await writeFile(outputPath, sanitizedBytes, { flag: "wx" });
