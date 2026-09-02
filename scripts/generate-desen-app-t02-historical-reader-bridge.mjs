import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const EXPECTED_BASE_COMMIT = "d2c632f2cacab5d316d57aa3d51758d2a76d3cd2";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = await realpath(path.resolve(SCRIPT_DIRECTORY, ".."));
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-input-pending-fixture.json";
const rawArguments = process.argv.slice(2);
if (rawArguments.length !== 1 || rawArguments[0]?.length === 0) {
  throw new Error(
    "Usage: node scripts/generate-desen-app-t02-historical-reader-bridge.mjs <output-path>",
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
  parentArtifact.task !== "M10-T02" ||
  parentArtifact.proofId !== "desen-app-input-pending-fixture" ||
  parentArtifact.result !== "PASS"
) {
  throw new Error("The committed M10-T02 artifact is not the expected parent authority.");
}
const parentPaths = parentArtifact.boundary?.trackedReceipts?.map(({ path: value }) => value);
if (!Array.isArray(parentPaths) || parentPaths.length !== 25) {
  throw new Error("The M10-T02 artifact does not expose its exact 25-file authority.");
}
const taskTimePaths = Object.freeze(
  [...new Set(parentPaths)].sort((left, right) => left.localeCompare(right, "en-US")),
);
if (taskTimePaths.length !== 25) {
  throw new Error("The T02 bridge path union is not exact.");
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
  throw new Error("The committed M10-T02 artifact differs from its exact task-time projection.");
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
  }
  files[relativePath] = bytes.toString("base64");
}

const payload = {
  schemaVersion: 1,
  profile: "desen.app.m10-t02-historical-reader-bridge.v1",
  baseCommit: EXPECTED_BASE_COMMIT,
  successorAddedPaths: [
    "apps/desen-app-browser-e2e/failure-fixture.pw.ts",
    "apps/desen-app-browser-e2e/failure-playwright.config.ts",
  ],
  files,
  projections: {
    "desen-app-input-pending-fixture": taskTimeArtifact,
  },
};
const bytes = Buffer.from(`${JSON.stringify(payload)}\n`);
await writeFile(outputPath, gzipSync(bytes, { level: 9, mtime: 0 }), { flag: "wx" });
