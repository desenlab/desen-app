import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH,
  RUNTIME_REACT_FAILURE_BOUNDARY_PREREQUISITE_PATHS,
  RUNTIME_REACT_FAILURE_BOUNDARY_TRACKED_PATHS,
  RuntimeReactFailureBoundaryEvidenceError,
  buildRuntimeReactFailureBoundaryEvidence,
  verifyRuntimeReactFailureBoundaryEvidence,
  writeRuntimeReactFailureBoundaryEvidence,
} from "../scripts/lib/runtime-react-failure-boundary-proof.mjs";

const WORKSPACE_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const PROOF_PATH = path.join(WORKSPACE_ROOT, "docs/proof/RUNTIME-REACT-FAILURE-BOUNDARY.md");
const PROOF_MATRIX_PATH = path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md");
const NORMATIVE_COVERAGE_PATH = path.join(WORKSPACE_ROOT, "docs/proof/NORMATIVE-COVERAGE.md");
const FINDINGS_PATH = path.join(WORKSPACE_ROOT, "docs/plan/PROTOCOL-FINDINGS.md");

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactFailureBoundaryEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function copyEvidenceWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "desen-react-t06-"));
  const paths = [
    ...RUNTIME_REACT_FAILURE_BOUNDARY_TRACKED_PATHS,
    ...RUNTIME_REACT_FAILURE_BOUNDARY_PREREQUISITE_PATHS,
  ];
  for (const relativePath of paths) {
    const destination = path.join(workspaceRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(WORKSPACE_ROOT, relativePath), destination);
  }
  return workspaceRoot;
}

async function mutateWorkspaceFile(workspaceRoot, relativePath, mutate) {
  const filePath = path.join(workspaceRoot, relativePath);
  const original = await readFile(filePath, "utf8");
  await writeFile(filePath, mutate(original), "utf8");
}

async function documentationTexts() {
  const [proofDocumentText, proofMatrixText, normativeCoverageText, findingsText] =
    await Promise.all([
      readFile(PROOF_PATH, "utf8"),
      readFile(PROOF_MATRIX_PATH, "utf8"),
      readFile(NORMATIVE_COVERAGE_PATH, "utf8"),
      readFile(FINDINGS_PATH, "utf8"),
    ]);
  return { proofDocumentText, proofMatrixText, normativeCoverageText, findingsText };
}

test("verifies the exact current M05-T06 failure-boundary artifact", async () => {
  const result = await verifyRuntimeReactFailureBoundaryEvidence();
  assert.equal(result.result, "PASS");
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.focusedTests >= 20, true);
  assert.equal(result.compilerNegativeCases >= 9, true);
  assert.equal(result.rootMutationTests >= 15, true);
  assert.equal(result.normativeStatus, "N-037:TESTED");
  assert.equal(result.proofStatus, "P-17:PARTIAL");
});

test("two independent builds preserve exact deterministic bytes and frozen semantics", async () => {
  const first = await buildRuntimeReactFailureBoundaryEvidence();
  const second = await buildRuntimeReactFailureBoundaryEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.claim.exactAttribution, "leaf-component-only");
  assert.equal(first.artifact.claim.behaviorExactAttribution, false);
  assert.equal(first.artifact.boundary.integrationScope.omittedRecoveryKey, "safe-never-retry");
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.boundary), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles[0]), true);
});

test("rejects a one-byte artifact mutation", async () => {
  const pristine = await readFile(DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH);
  const tampered = Buffer.from(pristine);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyRuntimeReactFailureBoundaryEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_DRIFT"),
  );
});

test("rejects semantically changed valid artifact JSON", async () => {
  const pristine = JSON.parse(
    await readFile(DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH, "utf8"),
  );
  pristine.claim.wholeSurfaceFailClosed = false;
  await assert.rejects(
    verifyRuntimeReactFailureBoundaryEvidence({
      artifactBytes: Buffer.from(`${JSON.stringify(pristine, null, 2)}\n`),
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_DRIFT"),
  );
});

test("rejects loss of the reviewed whole-surface containment source", async () => {
  const workspaceRoot = await copyEvidenceWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "packages/runtime-react/src/surface-boundary.tsx",
      (text) => text.replace("whole-surface profile refuses to blame", "local policy guesses"),
    );
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ workspaceRoot }),
      hasEvidenceCode("FAILURE_BOUNDARY_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects a public exact behavior-attribution overclaim", async () => {
  const workspaceRoot = await copyEvidenceWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "packages/runtime-react/src/adapter-error-boundary.tsx",
      (text) => `${text}\nexport interface RuntimeReactBehaviorAdapterFailure {}\n`,
    );
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ workspaceRoot }),
      hasEvidenceCode("FAILURE_BOUNDARY_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects loss of the nested host-carrier double-wrap regression", async () => {
  const workspaceRoot = await copyEvidenceWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "packages/runtime-react/test/failure-boundary.test.tsx",
      (text) =>
        text.replace(
          "does not wrap a nested host-failure carrier again inside outer failure UI",
          "removed nested carrier case",
        ),
    );
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ workspaceRoot }),
      hasEvidenceCode("FAILURE_BOUNDARY_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects raw caught-error policy inspection", async () => {
  const workspaceRoot = await copyEvidenceWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "packages/runtime-react/src/root-error-policy.ts",
      (text) => text.replace("void error;", "String(error);"),
    );
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ workspaceRoot }),
      hasEvidenceCode("FAILURE_BOUNDARY_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects dynamic executable loading on the production failure path", async () => {
  const workspaceRoot = await copyEvidenceWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "packages/runtime-react/src/root-error-policy.ts",
      (text) => `${text}\nvoid import("./surface-boundary.js");\n`,
    );
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ workspaceRoot }),
      hasEvidenceCode("FAILURE_BOUNDARY_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects focused package-script drift", async () => {
  const workspaceRoot = await copyEvidenceWorkspace();
  try {
    await mutateWorkspaceFile(workspaceRoot, "packages/runtime-react/package.json", (text) =>
      text.replace("vitest run test/failure-boundary.test.tsx", "vitest run"),
    );
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ workspaceRoot }),
      hasEvidenceCode("FAILURE_BOUNDARY_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects prerequisite byte drift before interpreting successor source", async () => {
  const workspaceRoot = await copyEvidenceWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      RUNTIME_REACT_FAILURE_BOUNDARY_PREREQUISITE_PATHS[0],
      (text) => `${text} `,
    );
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ workspaceRoot }),
      hasEvidenceCode("FAILURE_BOUNDARY_PREREQUISITE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects a symlink tracked source", async () => {
  const workspaceRoot = await copyEvidenceWorkspace();
  const relativePath = "packages/runtime-react/src/root-error-policy.ts";
  const source = path.join(workspaceRoot, relativePath);
  const target = path.join(workspaceRoot, "root-policy-target.ts");
  try {
    await copyFile(source, target);
    await unlink(source);
    await symlink(target, source);
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ workspaceRoot }),
      hasEvidenceCode("FAILURE_BOUNDARY_INPUT_UNSAFE"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects a symlink prerequisite artifact", async () => {
  const workspaceRoot = await copyEvidenceWorkspace();
  const relativePath = RUNTIME_REACT_FAILURE_BOUNDARY_PREREQUISITE_PATHS[0];
  const source = path.join(workspaceRoot, relativePath);
  const target = path.join(workspaceRoot, "prerequisite-target.json");
  try {
    await copyFile(source, target);
    await unlink(source);
    await symlink(target, source);
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ workspaceRoot }),
      hasEvidenceCode("FAILURE_BOUNDARY_PREREQUISITE_UNSAFE"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects unknown, inherited, symbol, and non-enumerable options", async () => {
  const inherited = Object.create({ workspaceRoot: WORKSPACE_ROOT });
  const symbol = { [Symbol("workspaceRoot")]: WORKSPACE_ROOT };
  const nonEnumerable = Object.defineProperty({}, "workspaceRoot", {
    value: WORKSPACE_ROOT,
    enumerable: false,
  });
  for (const options of [{ fileOverrides: {} }, inherited, symbol, nonEnumerable]) {
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence(options),
      hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
    );
  }
});

test("rejects accessor, Proxy, and revoked-Proxy options without invoking hooks", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = Object.defineProperty({}, "workspaceRoot", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return WORKSPACE_ROOT;
    },
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const options of [accessor, proxy, revoked.proxy]) {
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence(options),
      hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects ambiguous artifact path and byte options", async () => {
  const artifactBytes = await readFile(DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH);
  await assert.rejects(
    verifyRuntimeReactFailureBoundaryEvidence({
      artifactPath: DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH,
      artifactBytes,
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
});

test("atomic writer preserves exact deterministic bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t06-write-"));
  const artifactPath = path.join(directory, "artifact.json");
  try {
    const written = await writeRuntimeReactFailureBoundaryEvidence({ artifactPath });
    const verified = await verifyRuntimeReactFailureBoundaryEvidence({ artifactPath });
    assert.equal(written.artifactSha256, verified.artifactSha256);
    assert.deepEqual(
      await readFile(artifactPath),
      (await buildRuntimeReactFailureBoundaryEvidence()).artifactBytes,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic writer rejects an existing symlink destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t06-write-"));
  const target = path.join(directory, "target.json");
  const artifactPath = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, artifactPath);
    await assert.rejects(
      writeRuntimeReactFailureBoundaryEvidence({ artifactPath }),
      hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic writer rejects temporary-byte tampering", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t06-write-"));
  const artifactPath = path.join(directory, "artifact.json");
  try {
    await assert.rejects(
      writeRuntimeReactFailureBoundaryEvidence({
        artifactPath,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("verification detects non-semantic tracked-byte drift", async () => {
  const workspaceRoot = await copyEvidenceWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "packages/runtime-react/src/root-error-policy.ts",
      (text) => `${text}\n// Exact tracked-byte mutation.\n`,
    );
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({
        workspaceRoot,
        artifactPath: DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH,
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("writer rejects unsafe callback and destination option shapes", async () => {
  const callbackProxy = new Proxy(() => undefined, {});
  await assert.rejects(
    writeRuntimeReactFailureBoundaryEvidence({ beforeAtomicRename: callbackProxy }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeReactFailureBoundaryEvidence({ artifactPath: "" }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
});

test("rejects moved, duplicated, pending, or mismatched human-readable artifact pins", async () => {
  const documents = await documentationTexts();
  const built = await buildRuntimeReactFailureBoundaryEvidence();
  const sha = built.artifactSha256;
  for (const proofDocumentText of [
    documents.proofDocumentText.replace("## Evidence artifact", "## Moved evidence artifact"),
    `${documents.proofDocumentText}\n\`docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json\`\n`,
    documents.proofDocumentText.replace(sha, "[PENDING_FINAL_ARTIFACT_SHA256]"),
    documents.proofDocumentText.replace(sha, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({
        ...documents,
        proofDocumentText,
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT"),
    );
  }
});

test("rejects N-037 ownership, status, artifact, or SHA drift", async () => {
  const documents = await documentationTexts();
  const built = await buildRuntimeReactFailureBoundaryEvidence();
  const n037 = documents.normativeCoverageText
    .split("\n")
    .find((line) => line.startsWith("| N-037 |"));
  assert.ok(n037);
  for (const changed of [
    n037.replace("| M05-T06 ", "| M05-T07 "),
    n037.replace("| TESTED ", "| PLANNED "),
    n037.replace("runtime-react-0.1.0-failure-boundary.json", "missing.json"),
    n037.replace(`sha256:${built.artifactSha256}`, `sha256:${"0".repeat(64)}`),
  ]) {
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({
        ...documents,
        normativeCoverageText: documents.normativeCoverageText.replace(n037, changed),
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT"),
    );
  }
});

test("rejects a falsely completed P-17 or lost M07-T04 remainder", async () => {
  const documents = await documentationTexts();
  const built = await buildRuntimeReactFailureBoundaryEvidence();
  const p17 = documents.proofMatrixText.split("\n").find((line) => line.startsWith("| P-17 |"));
  assert.ok(p17);
  for (const changed of [
    p17.replace("| PARTIAL ", "| PROVEN "),
    p17.replaceAll("M07-T04", "M05-T06"),
    p17.replace("runtime-react-0.1.0-failure-boundary.json", "missing.json"),
    p17.replace(`sha256:${built.artifactSha256}`, `sha256:${"0".repeat(64)}`),
  ]) {
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({
        ...documents,
        proofMatrixText: documents.proofMatrixText.replace(p17, changed),
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT"),
    );
  }
});

test("rejects PF-055 whole-surface, scope, or future-owner overclaims", async () => {
  const documents = await documentationTexts();
  for (const findingsText of [
    documents.findingsText.replace("Containment is whole-surface.", "Containment is node-local."),
    documents.findingsText.replace(
      "trusted runtime results",
      "arbitrary attacker-constructed results",
    ),
    documents.findingsText.replace("one deduplicated", "multiple independent copies of"),
    documents.findingsText.replace(
      "and M07-T04 owns activation-time",
      "and M05-T06 owns activation-time",
    ),
  ]) {
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({
        ...documents,
        findingsText,
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT"),
    );
  }
});
