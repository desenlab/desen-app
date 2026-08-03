import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { format } from "prettier";

import {
  ReferenceHostWebSourceAuditEvidenceError,
  buildCurrentReferenceHostWebSourceAuditEvidence,
  buildReferenceHostWebSourceAuditEvidence,
  inspectReferenceHostWebSourceAudit,
  inspectReferenceHostWebSourceInventory,
  resolveReferenceHostWebSourceAuditWorkspacePaths,
  verifyReferenceHostWebBackingSnapshotPolicy,
  verifyReferenceHostWebDependencyBoundaryConfiguration,
  verifyReferenceHostWebHtmlEnvelopePolicy,
  verifyReferenceHostWebPostCssBuildEnvelopePolicy,
  verifyReferenceHostWebCurrentCoordinationPolicy,
  verifyReferenceHostWebCurrentEvidencePolicy,
  verifyReferenceHostWebValidatorSuccessorSources,
  verifyReferenceHostWebSourceAuditDocumentation,
  verifyReferenceHostWebSourceAuditEvidence,
  verifyReferenceHostWebSourceAuditProofDocument,
  verifyReferenceHostWebBuildEnvelopeEntryPolicy,
  verifyReferenceHostWebSourceGraphPolicy,
  writeReferenceHostWebSourceAuditEvidence,
  verifyCurrentReferenceHostWebSourceAuditEvidence,
} from "../scripts/lib/reference-host-web-source-audit-proof.mjs";

const WORKSPACE_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const SOURCE_ROOT = "apps/reference-host-web/src";
const ROOT_SOURCE = `${SOURCE_ROOT}/root.tsx`;
const APPLICATION_SOURCE = `${SOURCE_ROOT}/application.tsx`;
const BROWSER_PROFILE_SOURCE = `${SOURCE_ROOT}/browser-profile.ts`;
const OFFICIAL_SOURCE = `${SOURCE_ROOT}/official-sign-in.ts`;
const MAIN_SOURCE = `${SOURCE_ROOT}/main.tsx`;
const VALIDATOR_SUCCESSOR_SOURCE_PATHS = Object.freeze([
  "packages/validator/src/index.ts",
  "packages/validator/src/binding-contract-validation.ts",
  "packages/validator/src/execution-contract-validation.ts",
  "packages/validator/src/interaction-contract-validation.ts",
  "packages/validator/src/semantic-validation.ts",
  "packages/validator/src/structural-validation.ts",
]);

function hasEvidenceCode(...expectedCodes) {
  return (error) => {
    assert.ok(error instanceof ReferenceHostWebSourceAuditEvidenceError);
    assert.ok(expectedCodes.includes(error.code), `unexpected evidence code ${error.code}`);
    return true;
  };
}

async function sourceText(relativePath) {
  return readFile(path.join(WORKSPACE_ROOT, relativePath), "utf8");
}

async function validatorSuccessorSourceBytes() {
  return Promise.all(
    VALIDATOR_SUCCESSOR_SOURCE_PATHS.map((relativePath) =>
      readFile(path.join(WORKSPACE_ROOT, relativePath)),
    ),
  );
}

function bindTrackedBytes(artifact, relativePath, bytes) {
  const entry = artifact.evidence.trackedFiles.find(
    ({ path: candidate }) => candidate === relativePath,
  );
  assert.ok(entry);
  entry.bytes = bytes.length;
  entry.sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function canonicalPackageBytes(manifest) {
  return Buffer.from(
    await format(JSON.stringify(manifest), {
      endOfLine: "lf",
      parser: "json-stringify",
      printWidth: 100,
      tabWidth: 2,
    }),
    "utf8",
  );
}

async function rejectMutation(relativePath, mutate, expectedMessage) {
  const original = await sourceText(relativePath);
  await assert.rejects(
    inspectReferenceHostWebSourceAudit({
      sourceOverrides: { [relativePath]: mutate(original) },
    }),
    (error) => {
      assert.ok(error instanceof ReferenceHostWebSourceAuditEvidenceError);
      assert.equal(error.code, "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT");
      assert.match(error.message, expectedMessage);
      return true;
    },
  );
}

function syntheticDocumentation(sha256) {
  const artifact = "`reference-host-web-0.1.0-source-audit.json`";
  const digest = `\`sha256:${sha256}\``;
  return Object.freeze({
    proofText: [
      "# Proof",
      "",
      "## Evidence artifact",
      "",
      "- path: `docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json`",
      `- SHA-256: \`sha256:${sha256}\``,
      "",
    ].join("\n"),
    matrixText: [
      "# Matrix",
      "",
      `| P-06 | host parity | ${artifact} ${digest} |`,
      `| P-07 | source authority | ${artifact} ${digest} |`,
      `| P-10 | runtime adapter | ${artifact} ${digest} |`,
      "",
      "## M05-T09",
      "",
      artifact,
      digest,
      "",
    ].join("\n"),
    statusText: [
      "# Status",
      "",
      "M05-T09 evidence:",
      "",
      "- `docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json`",
      "- artifact SHA-256:",
      `  \`${sha256}\``,
      "",
    ].join("\n"),
  });
}

test("accepts the stored deterministic M05-T09 source/import audit", async () => {
  const result = await verifyReferenceHostWebSourceAuditEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(
    result.artifactSha256,
    "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89",
  );
  assert.equal(result.artifactBytes, 59_871);
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.sourceFiles, 12);
  assert.equal(result.jsxElements, 18);
  assert.equal(result.graphDynamicEdges, 0);
  assert.equal(result.packageBoundaryViolations, 0);
  assert.equal(result.exactDocumentationReferences, 12);
});

test("accepts unrelated ancestor entry churn without weakening directory identity checks", async () => {
  const temporary = await mkdtemp(path.join(WORKSPACE_ROOT, ".t09-reader-churn-"));
  const proofPath = path.join(temporary, "proof.md");
  const proofMatrixPath = path.join(temporary, "matrix.md");
  const projectStatusPath = path.join(temporary, "status.md");
  const churnPath = path.join(temporary, ".unrelated-churn");
  let keepChurning = true;
  let churns = 0;
  try {
    await Promise.all([
      writeFile(
        proofPath,
        await readFile(path.join(WORKSPACE_ROOT, "docs/proof/REFERENCE-HOST-WEB-SOURCE-AUDIT.md")),
      ),
      writeFile(
        proofMatrixPath,
        await readFile(path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md")),
      ),
      writeFile(projectStatusPath, await readFile(path.join(WORKSPACE_ROOT, "PROJECT-STATUS.md"))),
    ]);
    const churn = (async () => {
      while (keepChurning) {
        await writeFile(churnPath, String(churns));
        await unlink(churnPath);
        churns += 1;
        await new Promise((resolve) => setImmediate(resolve));
      }
    })();
    try {
      for (let index = 0; index < 3; index += 1) {
        const result = await verifyReferenceHostWebSourceAuditEvidence({
          proofPath,
          proofMatrixPath,
          projectStatusPath,
        });
        assert.equal(result.result, "PASS");
      }
    } finally {
      keepChurning = false;
      await churn;
    }
    assert.ok(churns > 0);
  } finally {
    keepChurning = false;
    await rm(temporary, { recursive: true, force: true });
  }
});

test("builds a deterministic real Vite graph and semantic TypeScript inventory", async () => {
  const first = await buildCurrentReferenceHostWebSourceAuditEvidence();
  const second = await buildCurrentReferenceHostWebSourceAuditEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.claim.g05Closed, true);
  assert.equal(first.artifact.claim.p07Status, "PARTIAL");
  assert.equal(first.artifact.sourceAudit.compilerAuthority, "TypeScript Program and TypeChecker");
  assert.equal(first.artifact.sourceAudit.sourceFiles, 12);
  assert.equal(first.artifact.sourceAudit.jsxElements, 18);
  assert.equal(first.artifact.runtimeResolution.tool, "vite@8.1.5");
  assert.equal(first.artifact.runtimeResolution.observer, "moduleParsed");
  assert.equal(first.artifact.runtimeResolution.independentBuilds, 2);
  assert.equal(first.artifact.runtimeResolution.deterministic, true);
  assert.equal(first.artifact.runtimeResolution.dynamicEdges, 0);
  assert.equal(first.artifact.runtimeResolution.backingFiles, 102);
  assert.equal(first.artifact.runtimeResolution.backingModulesStableAcrossSecondObservation, true);
  assert.equal(first.artifact.runtimeResolution.backingSnapshotObservations, 3);
  assert.equal(
    first.artifact.runtimeResolution.finalBackingReauthenticatedAfterDependencyBoundary,
    true,
  );
  assert.equal(first.artifact.buildEnvelope.htmlParser, "jsdom@29.1.1 exact canonical AST");
  assert.deepEqual(first.artifact.evidence.snapshotConsistency, {
    checkedPaths: 32,
    prePostIdentityMatched: true,
    sourceAndEnvelopeStableAcrossAudit: true,
  });
  assert.equal(
    first.artifact.packageBoundary.authority,
    "package-boundary evidence only; not runtime resolution authority",
  );
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.runtimeResolution.modules), true);
});

test("runs the full current host audit while comparing every enduring M05 input", async () => {
  const result = await verifyCurrentReferenceHostWebSourceAuditEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(
    result.historicalArtifactSha256,
    "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89",
  );
  assert.equal(result.trackedFiles, 24);
  assert.equal(result.comparedTrackedFiles, 18);
  assert.deepEqual(result.admittedSuccessor, {
    task: "M06-T05",
    sourceFiles: VALIDATOR_SUCCESSOR_SOURCE_PATHS,
    modules: [
      "packages/validator/dist/binding-contract-validation.js",
      "packages/validator/dist/execution-contract-validation.js",
      "packages/validator/dist/index.js",
      "packages/validator/dist/interaction-contract-validation.js",
      "packages/validator/dist/semantic-validation.js",
      "packages/validator/dist/structural-validation.js",
    ],
  });
  assert.deepEqual(result.successorSources, {
    result: "PASS",
    task: "M06-T05",
    sources: [
      {
        path: "packages/validator/src/index.ts",
        bytes: 5_916,
        sha256: "8fb565cd1276386510bef53be5de6bb48803b8d4f6048757e261e6849adfba92",
      },
      {
        path: "packages/validator/src/binding-contract-validation.ts",
        bytes: 60_596,
        sha256: "a30578fd38c5662b1fdcdd510f7cfa1a07dd7e190df908db2cc18b7be339ea1a",
      },
      {
        path: "packages/validator/src/execution-contract-validation.ts",
        bytes: 102_812,
        sha256: "000933db59b168dbb27983a8a0d55bb4aa30c6ec3946fb6000ea03dd1ce3a176",
      },
      {
        path: "packages/validator/src/interaction-contract-validation.ts",
        bytes: 63_591,
        sha256: "559de34751c6ea52716926fffd031e147ed0785abf31708376aa838276172031",
      },
      {
        path: "packages/validator/src/semantic-validation.ts",
        bytes: 36_879,
        sha256: "b5ae0899b4202b313c6fe864e6a46189ffc3e45fd1fe659e3f2285fd84d1c463",
      },
      {
        path: "packages/validator/src/structural-validation.ts",
        bytes: 10_705,
        sha256: "8e7d4fb3a69b31bb8f4e3da050088058f53218d4ee4c440b8f631c0c475a1fc8",
      },
    ],
  });
  assert.deepEqual(result.excludedCoordinationPaths, [
    "package.json",
    "pnpm-lock.yaml",
    "scripts/generate-reference-host-web-source-audit-proof.mjs",
    "scripts/lib/reference-host-web-source-audit-proof.mjs",
    "scripts/verify-reference-host-web-source-audit.mjs",
    "tests/reference-host-web-source-audit.test.mjs",
  ]);
  assert.equal(result.sourceFiles, 12);
  assert.equal(result.graphModules, 103);
  assert.equal(result.graphDynamicEdges, 0);
  assert.equal(result.packageBoundaryViolations, 0);
  assert.equal(result.coordination.result, "PASS");
  assert.equal(result.coordination.admittedControlPlaneCoordination, "M07-T02");
  assert.equal(result.coordination.normalizedControlPlaneScriptKeys, true);
  assert.equal(result.coordination.normalizedControlPlanePipelineSegments, true);
  assert.equal(result.coordination.normalizedControlPlaneLockfileImporter, true);
  assert.equal(
    result.coordination.rootPackageHistoricalSha256,
    "sha256:1f1d19b6bdb0652f0598ba01a8549eae5c6e8b1a8825cf2cb40503c196bad6da",
  );
  assert.equal(
    result.coordination.lockfileHistoricalSha256,
    "sha256:d27fadcdc12df64a0ca99d8bc78ba5fc439b06751945339cf374944689cdbe64",
  );
});

test("current-evidence policy excludes only coordination bytes and rejects all enduring drift", async () => {
  const historical = (await buildReferenceHostWebSourceAuditEvidence()).artifact;
  const current = (await buildCurrentReferenceHostWebSourceAuditEvidence()).artifact;
  const successorSourceBytes = await validatorSuccessorSourceBytes();
  const verifyPolicy = (candidate) =>
    verifyReferenceHostWebCurrentEvidencePolicy(historical, candidate, successorSourceBytes);
  assert.equal(verifyPolicy(current).comparedTrackedFiles, 18);

  const coordinationOnly = structuredClone(current);
  for (const relativePath of [
    "package.json",
    "pnpm-lock.yaml",
    "scripts/lib/reference-host-web-source-audit-proof.mjs",
  ]) {
    const entry = coordinationOnly.evidence.trackedFiles.find(
      ({ path: candidate }) => candidate === relativePath,
    );
    entry.bytes += 1;
    entry.sha256 = `sha256:${"f".repeat(64)}`;
  }
  assert.equal(verifyPolicy(coordinationOnly).result, "PASS");

  const hostSourceDrift = structuredClone(current);
  hostSourceDrift.evidence.trackedFiles.find(
    ({ path: candidate }) => candidate === "apps/reference-host-web/src/main.tsx",
  ).sha256 = `sha256:${"e".repeat(64)}`;
  assert.throws(
    () => verifyPolicy(hostSourceDrift),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );

  const graphDrift = structuredClone(current);
  graphDrift.runtimeResolution.graphSha256 = `sha256:${"d".repeat(64)}`;
  assert.throws(
    () => verifyPolicy(graphDrift),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );

  const disguisedCoordinationPath = structuredClone(current);
  disguisedCoordinationPath.evidence.trackedFiles.push({
    path: "apps/reference-host-web/package.json",
    bytes: 1,
    sha256: `sha256:${"c".repeat(64)}`,
  });
  assert.throws(
    () => verifyPolicy(disguisedCoordinationPath),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );

  const decoratedExcludedRecord = structuredClone(current);
  decoratedExcludedRecord.evidence.trackedFiles.find(
    ({ path: candidate }) => candidate === "package.json",
  ).unexpected = true;
  assert.throws(
    () => verifyPolicy(decoratedExcludedRecord),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );

  const protoDrift = structuredClone(current);
  Object.defineProperty(protoDrift, "__proto__", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: { polluted: true },
  });
  assert.throws(
    () => verifyPolicy(protoDrift),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );
  assert.equal(Object.prototype.polluted, undefined);

  const primitiveArrayBudget = structuredClone(current);
  primitiveArrayBudget.nonclaims = Array.from({ length: 65_537 }, () => 0);
  assert.throws(
    () => verifyPolicy(primitiveArrayBudget),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );

  assert.throws(
    () => verifyPolicy(new Proxy(current, {})),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );
});

test("admits only the source-pinned M06-T05 Validator runtime successor", async () => {
  const historical = (await buildReferenceHostWebSourceAuditEvidence()).artifact;
  const current = (await buildCurrentReferenceHostWebSourceAuditEvidence()).artifact;
  const successorSourceBytes = await validatorSuccessorSourceBytes();
  const verifyPolicy = (candidate, sources = successorSourceBytes) =>
    verifyReferenceHostWebCurrentEvidencePolicy(historical, candidate, sources);
  const policy = verifyPolicy(current);
  assert.equal(policy.admittedSuccessor.task, "M06-T05");
  assert.equal(policy.admittedSuccessor.modules.length, 6);
  assert.equal(policy.successorSources.result, "PASS");
  assert.equal(
    verifyReferenceHostWebValidatorSuccessorSources(successorSourceBytes).result,
    "PASS",
  );
  for (const sourceIndex of successorSourceBytes.keys()) {
    const tamperedSources = successorSourceBytes.map((bytes) => Buffer.from(bytes));
    tamperedSources[sourceIndex][tamperedSources[sourceIndex].length - 2] ^= 1;
    assert.throws(
      () => verifyReferenceHostWebValidatorSuccessorSources(tamperedSources),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
    );
    assert.throws(
      () => verifyPolicy(current, tamperedSources),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
    );
  }
  assert.throws(
    () => verifyReferenceHostWebCurrentEvidencePolicy(historical, current),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );

  const validatorModules = [
    "packages/validator/dist/binding-contract-validation.js",
    "packages/validator/dist/execution-contract-validation.js",
    "packages/validator/dist/index.js",
    "packages/validator/dist/interaction-contract-validation.js",
    "packages/validator/dist/semantic-validation.js",
    "packages/validator/dist/structural-validation.js",
  ];
  const mutateModule = (moduleId, mutate) => {
    const mutated = structuredClone(current);
    const module = mutated.runtimeResolution.modules.find(({ id }) => id === moduleId);
    assert.ok(module);
    mutate(module, mutated);
    return mutated;
  };
  for (const moduleId of validatorModules) {
    for (const mutated of [
      mutateModule(moduleId, (module) => {
        module.codeBytes += 1;
      }),
      mutateModule(moduleId, (module) => {
        module.codeSha256 = `sha256:${"a".repeat(64)}`;
      }),
    ]) {
      assert.throws(
        () => verifyPolicy(mutated),
        hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
      );
    }
  }
  const validatorIndex = "packages/validator/dist/index.js";
  const validatorExecution = "packages/validator/dist/execution-contract-validation.js";
  for (const mutated of [
    mutateModule(validatorExecution, (module) => {
      module.imports = module.imports.filter(
        (id) => id !== "packages/validator/dist/semantic-validation.js",
      );
    }),
    mutateModule(validatorExecution, (module) => {
      module.imports.push("packages/validator/dist/unreviewed.js");
    }),
    mutateModule(validatorIndex, (module) => {
      module.imports.push("packages/validator/dist/unreviewed.js");
    }),
    mutateModule(validatorIndex, (module) => {
      module.id = "packages/validator/dist/unreviewed.js";
    }),
    mutateModule(validatorIndex, (_module, artifact) => {
      artifact.runtimeResolution.modules.push({
        id: "packages/validator/dist/unreviewed.js",
        imports: [],
        dynamicImports: [],
        codeBytes: 1,
        codeSha256: `sha256:${"b".repeat(64)}`,
      });
    }),
    mutateModule(validatorIndex, (_module, artifact) => {
      artifact.runtimeResolution.backingSnapshotSha256 = `sha256:${"c".repeat(64)}`;
    }),
  ]) {
    assert.throws(
      () => verifyPolicy(mutated),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
    );
  }
});

test("reviewed Publisher and M07-T02 coordination preserve root and lockfile provenance", async () => {
  const historical = (await buildReferenceHostWebSourceAuditEvidence()).artifact;
  const current = (await buildCurrentReferenceHostWebSourceAuditEvidence()).artifact;
  const [rootPackageBytes, lockfileBytes] = await Promise.all([
    readFile(path.join(WORKSPACE_ROOT, "package.json")),
    readFile(path.join(WORKSPACE_ROOT, "pnpm-lock.yaml")),
  ]);
  const lockfileText = lockfileBytes.toString("utf8");
  assert.equal(
    (
      await verifyReferenceHostWebCurrentCoordinationPolicy({
        historicalArtifact: historical,
        currentArtifact: current,
        rootPackageBytes,
        lockfileBytes,
      })
    ).result,
    "PASS",
  );
  const verifyCoordination = async ({
    candidateRootBytes = rootPackageBytes,
    candidateLockBytes = lockfileBytes,
  }) => {
    const candidateArtifact = structuredClone(current);
    bindTrackedBytes(candidateArtifact, "package.json", candidateRootBytes);
    bindTrackedBytes(candidateArtifact, "pnpm-lock.yaml", candidateLockBytes);
    return verifyReferenceHostWebCurrentCoordinationPolicy({
      historicalArtifact: historical,
      currentArtifact: candidateArtifact,
      rootPackageBytes: candidateRootBytes,
      lockfileBytes: candidateLockBytes,
    });
  };
  const rejectRootManifest = async (mutate) => {
    const manifest = JSON.parse(rootPackageBytes.toString("utf8"));
    mutate(manifest);
    const candidateRootBytes = await canonicalPackageBytes(manifest);
    await assert.rejects(
      verifyCoordination({ candidateRootBytes }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
    );
  };
  await rejectRootManifest((manifest) => {
    delete manifest.scripts["generate:control-plane-bundle-store"];
  });
  await rejectRootManifest((manifest) => {
    manifest.scripts["verify:control-plane-bundle-store"] += " --unreviewed";
  });
  await rejectRootManifest((manifest) => {
    delete manifest.scripts["generate:control-plane-bundle-verification"];
  });
  await rejectRootManifest((manifest) => {
    manifest.scripts["verify:control-plane-bundle-verification"] += " --unreviewed";
  });
  await rejectRootManifest((manifest) => {
    manifest.scripts["verify:control-plane-decoy"] = "node scripts/decoy.mjs";
  });
  await rejectRootManifest((manifest) => {
    manifest.scripts.check = manifest.scripts.check.replace(
      "pnpm verify:control-plane-bundle-verification",
      "pnpm verify:control-plane-bundle-verification && pnpm verify:control-plane-bundle-verification",
    );
  });
  await rejectRootManifest((manifest) => {
    manifest.scripts.check = manifest.scripts.check.replace(
      "pnpm verify:control-plane-bundle-store && pnpm verify:control-plane-bundle-verification",
      "pnpm verify:control-plane-bundle-verification && pnpm verify:control-plane-bundle-store",
    );
  });
  await rejectRootManifest((manifest) => {
    manifest.scripts.test = manifest.scripts.test.replace(
      "pnpm test:control-plane-bundle-verification && turbo run test",
      "pnpm test:control-plane-bundle-verification && pnpm test:control-plane-decoy && turbo run test",
    );
  });
  await rejectRootManifest((manifest) => {
    manifest.scripts["verify:publisher-decoy"] = "node scripts/publisher-decoy.mjs";
    manifest.scripts.check = manifest.scripts.check.replace(
      "pnpm verify:publisher-invalid-source-matrix && pnpm verify:control-plane-bundle-store",
      "pnpm verify:publisher-decoy && pnpm verify:publisher-invalid-source-matrix && pnpm verify:control-plane-bundle-store",
    );
  });
  await rejectRootManifest((manifest) => {
    manifest.scripts.check = manifest.scripts.check.replace(
      "pnpm verify:publisher-invalid-source-matrix && pnpm verify:control-plane-bundle-store",
      "pnpm verify:publisher-invalid-source-matrix && pnpm verify:publisher-invalid-source-matrix && pnpm verify:control-plane-bundle-store",
    );
  });
  const poisonedManifest = JSON.parse(rootPackageBytes.toString("utf8"));
  poisonedManifest.scripts["verify:control-plane-bundle-store"] +=
    " && node scripts/unreviewed.mjs";
  const poisonedRootPackageBytes = await canonicalPackageBytes(poisonedManifest);
  const originalObjectEntries = Object.entries;
  try {
    Object.entries = (value) => {
      const entries = originalObjectEntries(value);
      if (Object.isFrozen(value) && Object.hasOwn(value, "verify:control-plane-bundle-store")) {
        return entries.map(([key, command]) => [
          key,
          key === "verify:control-plane-bundle-store"
            ? `${command} && node scripts/unreviewed.mjs`
            : command,
        ]);
      }
      return entries;
    };
    await assert.rejects(
      verifyCoordination({ candidateRootBytes: poisonedRootPackageBytes }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
    );
  } finally {
    Object.entries = originalObjectEntries;
  }
  const originalArrayIterator = Array.prototype[Symbol.iterator];
  try {
    Array.prototype[Symbol.iterator] = function () {
      const original = originalArrayIterator.call(this);
      if (
        this.length === 2 &&
        this[0] === "verify:control-plane-bundle-store" &&
        typeof this[1] === "string"
      ) {
        let index = 0;
        return {
          next: () => {
            index += 1;
            if (index === 1) return { done: false, value: this[0] };
            if (index === 2) {
              return {
                done: false,
                value: `${this[1]} && node scripts/unreviewed.mjs`,
              };
            }
            return { done: true, value: undefined };
          },
          [Symbol.iterator]() {
            return this;
          },
        };
      }
      return original;
    };
    await assert.rejects(
      verifyCoordination({ candidateRootBytes: poisonedRootPackageBytes }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
    );
  } finally {
    Array.prototype[Symbol.iterator] = originalArrayIterator;
  }

  const futureManifest = JSON.parse(rootPackageBytes.toString("utf8"));
  futureManifest.scripts["verify:publisher-future-proof"] = "node scripts/future-publisher.mjs";
  futureManifest.scripts["test:publisher-future-proof"] =
    "node --test tests/future-publisher.test.mjs";
  const futureRootPackageBytes = await canonicalPackageBytes(futureManifest);
  const futurePipelineManifest = structuredClone(futureManifest);
  futurePipelineManifest.scripts.check = futurePipelineManifest.scripts.check.replace(
    " && pnpm lint",
    " && pnpm verify:publisher-future-proof && pnpm lint",
  );
  futurePipelineManifest.scripts.test = futurePipelineManifest.scripts.test.replace(
    " && turbo run test",
    " && pnpm test:publisher-future-proof && turbo run test",
  );
  const futurePipelineRootPackageBytes = await canonicalPackageBytes(futurePipelineManifest);
  await assert.rejects(
    verifyCoordination({ candidateRootBytes: futurePipelineRootPackageBytes }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );
  const publisherImporterMarker = "  packages/publisher:\n";
  const controlPlaneImporterMarker = "  apps/control-plane-api:\n";
  assert.equal(lockfileText.split(publisherImporterMarker).length - 1, 1);
  assert.equal(lockfileText.split(controlPlaneImporterMarker).length - 1, 1);
  const publisherStart = lockfileText.indexOf(publisherImporterMarker);
  const publisherEnd = lockfileText.indexOf("\n  packages/reference-catalog-web:", publisherStart);
  const controlPlaneStart = lockfileText.indexOf(controlPlaneImporterMarker);
  const controlPlaneEnd = lockfileText.indexOf("\n  apps/desen-app:", controlPlaneStart);
  assert.ok(publisherStart >= 0);
  assert.ok(publisherEnd > publisherStart);
  assert.ok(controlPlaneStart >= 0);
  assert.ok(controlPlaneEnd > controlPlaneStart);
  const mutatePublisher = (needle, replacement) => {
    const block = lockfileText.slice(publisherStart, publisherEnd);
    assert.equal(block.split(needle).length - 1, 1);
    return `${lockfileText.slice(0, publisherStart)}${block.replace(
      needle,
      replacement,
    )}${lockfileText.slice(publisherEnd)}`;
  };
  const futureLockfileBytes = Buffer.from(
    lockfileText.replace(
      publisherImporterMarker,
      `${publisherImporterMarker}    optionalDependencies:\n      typescript:\n        specifier: 6.0.3\n        version: 6.0.3\n`,
    ),
    "utf8",
  );
  const futureArtifact = structuredClone(current);
  bindTrackedBytes(futureArtifact, "package.json", futureRootPackageBytes);
  bindTrackedBytes(futureArtifact, "pnpm-lock.yaml", futureLockfileBytes);
  assert.equal(
    (
      await verifyReferenceHostWebCurrentCoordinationPolicy({
        historicalArtifact: historical,
        currentArtifact: futureArtifact,
        rootPackageBytes: futureRootPackageBytes,
        lockfileBytes: futureLockfileBytes,
      })
    ).result,
    "PASS",
  );
  const mutateControlPlane = (needle, replacement) => {
    const block = lockfileText.slice(controlPlaneStart, controlPlaneEnd);
    assert.equal(block.split(needle).length - 1, 1);
    return `${lockfileText.slice(0, controlPlaneStart)}${block.replace(
      needle,
      replacement,
    )}${lockfileText.slice(controlPlaneEnd)}`;
  };
  for (const mutatedLockText of [
    mutateControlPlane(
      "version: link:../../packages/protocol",
      "version: 'link:../../packages/protocol'",
    ),
    lockfileText.replace(
      lockfileText.slice(controlPlaneStart, controlPlaneEnd),
      "  apps/control-plane-api: {}\n",
    ),
    mutateControlPlane(
      "      '@desen/protocol':\n        specifier: workspace:*",
      "      '@desen/protocol':\n        specifier: workspace:^",
    ),
    mutateControlPlane(
      "      '@desen/validator':\n        specifier: workspace:*",
      "      '@desen/validator':\n        specifier: workspace:^",
    ),
    mutateControlPlane(
      "      ajv:\n        specifier: 8.20.0",
      "      ajv:\n        specifier: ^8.20.0",
    ),
    mutateControlPlane("version: 3.9.6", "version: 3.9.5"),
    mutateControlPlane(
      "version: link:../../packages/publisher",
      "version: link:../../packages/unreviewed",
    ),
    mutateControlPlane(
      "    devDependencies:",
      "    optionalDependencies:\n      typescript:\n        specifier: 6.0.3\n        version: 6.0.3\n    devDependencies:",
    ),
    lockfileText.replace(
      controlPlaneImporterMarker,
      `${controlPlaneImporterMarker}  apps/control-plane-api: {}\n\n`,
    ),
  ]) {
    const candidateLockBytes = Buffer.from(mutatedLockText, "utf8");
    await assert.rejects(
      verifyCoordination({ candidateLockBytes }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
    );
  }
  const poisonedControlPlaneLockBytes = Buffer.from(
    mutateControlPlane(
      "version: link:../../packages/publisher",
      "version: link:../../packages/unreviewed",
    ),
    "utf8",
  );
  const originalDefineProperty = Object.defineProperty;
  try {
    Object.defineProperty = (target, key, descriptor) =>
      originalDefineProperty(
        target,
        key,
        key === "version" && descriptor?.value === "link:../../packages/unreviewed"
          ? { ...descriptor, value: "link:../../packages/publisher" }
          : descriptor,
      );
    await assert.rejects(
      verifyCoordination({ candidateLockBytes: poisonedControlPlaneLockBytes }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
    );
  } finally {
    Object.defineProperty = originalDefineProperty;
  }

  await assert.rejects(
    verifyReferenceHostWebCurrentCoordinationPolicy({
      historicalArtifact: historical,
      currentArtifact: current,
      rootPackageBytes: futureRootPackageBytes,
      lockfileBytes,
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );

  const rejectMalformedLock = async (malformedText, secret) => {
    const malformedBytes = Buffer.from(malformedText, "utf8");
    const malformedArtifact = structuredClone(current);
    bindTrackedBytes(malformedArtifact, "pnpm-lock.yaml", malformedBytes);
    await assert.rejects(
      verifyReferenceHostWebCurrentCoordinationPolicy({
        historicalArtifact: historical,
        currentArtifact: malformedArtifact,
        rootPackageBytes,
        lockfileBytes: malformedBytes,
      }),
      (error) => {
        assert.ok(error instanceof ReferenceHostWebSourceAuditEvidenceError);
        assert.equal(error.code, "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT");
        assert.equal(error.message.includes(secret), false);
        assert.equal(JSON.stringify(error.details ?? {}).includes(secret), false);
        return true;
      },
    );
  };
  await rejectMalformedLock(
    lockfileText.replace(
      publisherImporterMarker,
      `${publisherImporterMarker}    [this is not valid yaml\n`,
    ),
    "[this is not valid yaml",
  );
  const protocolSpecifier = "      '@desen/protocol':\n        specifier: workspace:*";
  const validBoundaryScalarBytes = Buffer.from(
    mutatePublisher(
      protocolSpecifier,
      "      '@desen/protocol':\n        specifier: 'workspace:*'",
    ),
    "utf8",
  );
  const validBoundaryScalarArtifact = structuredClone(current);
  bindTrackedBytes(validBoundaryScalarArtifact, "pnpm-lock.yaml", validBoundaryScalarBytes);
  assert.equal(
    (
      await verifyReferenceHostWebCurrentCoordinationPolicy({
        historicalArtifact: historical,
        currentArtifact: validBoundaryScalarArtifact,
        rootPackageBytes,
        lockfileBytes: validBoundaryScalarBytes,
      })
    ).result,
    "PASS",
  );
  const validQuotedVersionBytes = Buffer.from(
    mutatePublisher("version: link:../protocol", 'version: "link:../protocol"'),
    "utf8",
  );
  const validQuotedVersionArtifact = structuredClone(current);
  bindTrackedBytes(validQuotedVersionArtifact, "pnpm-lock.yaml", validQuotedVersionBytes);
  assert.equal(
    (
      await verifyReferenceHostWebCurrentCoordinationPolicy({
        historicalArtifact: historical,
        currentArtifact: validQuotedVersionArtifact,
        rootPackageBytes,
        lockfileBytes: validQuotedVersionBytes,
      })
    ).result,
    "PASS",
  );
  const validQuotedIndicatorBytes = Buffer.from(
    mutatePublisher(protocolSpecifier, "      '@desen/protocol':\n        specifier: '@bad'"),
    "utf8",
  );
  const validQuotedIndicatorArtifact = structuredClone(current);
  bindTrackedBytes(validQuotedIndicatorArtifact, "pnpm-lock.yaml", validQuotedIndicatorBytes);
  assert.equal(
    (
      await verifyReferenceHostWebCurrentCoordinationPolicy({
        historicalArtifact: historical,
        currentArtifact: validQuotedIndicatorArtifact,
        rootPackageBytes,
        lockfileBytes: validQuotedIndicatorBytes,
      })
    ).result,
    "PASS",
  );
  await rejectMalformedLock(
    mutatePublisher(
      protocolSpecifier,
      "      '@desen/protocol':\n        specifier: workspace:\u0000*",
    ),
    "\u0000",
  );
  await rejectMalformedLock(
    mutatePublisher(
      protocolSpecifier,
      "      '@desen/protocol':\n        specifier: workspace:\u000b*",
    ),
    "\u000b",
  );
  await rejectMalformedLock(
    mutatePublisher(protocolSpecifier, "      '@desen/protocol':\n        specifier: {}"),
    "specifier: {}",
  );
  await rejectMalformedLock(
    mutatePublisher("version: link:../protocol", "version: []"),
    "version: []",
  );
  await rejectMalformedLock(
    mutatePublisher(protocolSpecifier, "      '@desen/protocol':\n        specifier: @bad"),
    "@bad",
  );
  await rejectMalformedLock(
    mutatePublisher(protocolSpecifier, "      '@desen/protocol':\n        specifier: ,bad"),
    ",bad",
  );
  await rejectMalformedLock(
    mutatePublisher(protocolSpecifier, "      '@desen/protocol':\n        specifier: foo:"),
    "foo:",
  );
  await rejectMalformedLock(
    mutatePublisher(protocolSpecifier, "      '@desen/protocol':\n        specifier: null"),
    "specifier: null",
  );
  await rejectMalformedLock(
    mutatePublisher(protocolSpecifier, "      '@desen/protocol':\n        specifier: ''"),
    "specifier: ''",
  );
  await rejectMalformedLock(
    mutatePublisher("version: link:../protocol", "version: 1"),
    "version: 1",
  );
  await rejectMalformedLock(
    mutatePublisher("version: link:../protocol", "version: .5"),
    "version: .5",
  );
  await rejectMalformedLock(
    mutatePublisher(protocolSpecifier, "      '@desen/protocol':\n        specifier: 0b10"),
    "specifier: 0b10",
  );
  await rejectMalformedLock(
    mutatePublisher("version: link:../protocol", "version: 1:20"),
    "version: 1:20",
  );
  await rejectMalformedLock(
    mutatePublisher("version: link:../protocol", "version: 2026-07-29"),
    "version: 2026-07-29",
  );
  await rejectMalformedLock(
    mutatePublisher(protocolSpecifier, `      '@desen/protocol':\n        specifier: "\\u0000"`),
    "\\u0000",
  );
  await rejectMalformedLock(
    mutatePublisher(protocolSpecifier, `      '@desen/protocol':\n        specifier: "\\ud800"`),
    "\\ud800",
  );
  await rejectMalformedLock(
    mutatePublisher(protocolSpecifier, "      '@desen/protocol':\n        specifier: ' '"),
    "specifier: ' '",
  );
  await rejectMalformedLock(mutatePublisher("      '@desen/protocol':", "      '':"), "''");
  await rejectMalformedLock(
    mutatePublisher("      '@desen/protocol':", '      "\\u0000":'),
    "\\u0000",
  );
  await rejectMalformedLock(
    mutatePublisher("      '@desen/protocol':", "      favicon.ico:"),
    "favicon.ico",
  );
  await rejectMalformedLock(mutatePublisher("      '@desen/protocol':", "      %bad:"), "%bad");
  await rejectMalformedLock(mutatePublisher("      '@desen/protocol':", "      - bad:"), "- bad");
  await rejectMalformedLock(
    mutatePublisher(
      protocolSpecifier,
      "      '@desen/protocol':\n        specifier: &desen workspace:*",
    ),
    "&desen",
  );
  await rejectMalformedLock(
    mutatePublisher("version: link:../protocol", "version: *desen"),
    "*desen",
  );
  await rejectMalformedLock(
    mutatePublisher(
      protocolSpecifier,
      "      '@desen/protocol':\n        specifier: !desen workspace:*",
    ),
    "!desen",
  );
  await rejectMalformedLock(
    mutatePublisher(
      protocolSpecifier,
      "      '@desen/protocol':\n        specifier: workspace:*\n        specifier: workspace:*",
    ),
    "specifier: workspace:*",
  );
  await rejectMalformedLock(
    lockfileText.replace(
      "  autoInstallPeers: true",
      "  autoInstallPeers: true\n  autoInstallPeers: true",
    ),
    "autoInstallPeers",
  );

  const toolchainManifest = JSON.parse(rootPackageBytes.toString("utf8"));
  toolchainManifest.devDependencies.typescript = "6.0.4";
  const toolchainBytes = await canonicalPackageBytes(toolchainManifest);
  const toolchainArtifact = structuredClone(current);
  bindTrackedBytes(toolchainArtifact, "package.json", toolchainBytes);
  await assert.rejects(
    verifyReferenceHostWebCurrentCoordinationPolicy({
      historicalArtifact: historical,
      currentArtifact: toolchainArtifact,
      rootPackageBytes: toolchainBytes,
      lockfileBytes,
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );

  const lockSettingsBytes = Buffer.from(
    lockfileText.replace("  excludeLinksFromLockfile: false", "  excludeLinksFromLockfile: true"),
    "utf8",
  );
  const lockSettingsArtifact = structuredClone(current);
  bindTrackedBytes(lockSettingsArtifact, "pnpm-lock.yaml", lockSettingsBytes);
  await assert.rejects(
    verifyReferenceHostWebCurrentCoordinationPolicy({
      historicalArtifact: historical,
      currentArtifact: lockSettingsArtifact,
      rootPackageBytes,
      lockfileBytes: lockSettingsBytes,
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );

  const duplicatePublisherBytes = Buffer.from(
    lockfileText.replace(
      publisherImporterMarker,
      `${publisherImporterMarker}  packages/publisher: {}\n\n`,
    ),
    "utf8",
  );
  const duplicatePublisherArtifact = structuredClone(current);
  bindTrackedBytes(duplicatePublisherArtifact, "pnpm-lock.yaml", duplicatePublisherBytes);
  await assert.rejects(
    verifyReferenceHostWebCurrentCoordinationPolicy({
      historicalArtifact: historical,
      currentArtifact: duplicatePublisherArtifact,
      rootPackageBytes,
      lockfileBytes: duplicatePublisherBytes,
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT"),
  );
});

test("pins exact JSX ownership and leaves every other production module JSX-free", async () => {
  const result = await inspectReferenceHostWebSourceAudit();
  assert.equal(result.sourceFiles, 12);
  assert.equal(result.executableSourceFiles, 11);
  assert.equal(result.jsxElements, 18);
  assert.deepEqual(Object.keys(result.jsxByFile).sort(), [
    `${SOURCE_ROOT}/application.tsx`,
    `${SOURCE_ROOT}/browser-profile.ts`,
    `${SOURCE_ROOT}/failure-view.tsx`,
    `${SOURCE_ROOT}/host-ports.ts`,
    `${SOURCE_ROOT}/main.tsx`,
    `${SOURCE_ROOT}/managed-surface.tsx`,
    `${SOURCE_ROOT}/official-sign-in.ts`,
    `${SOURCE_ROOT}/recovery-authority.ts`,
    `${SOURCE_ROOT}/root-policy.ts`,
    `${SOURCE_ROOT}/root.tsx`,
    `${SOURCE_ROOT}/sign-in-http-handler.ts`,
  ]);
  for (const [relativePath, jsx] of Object.entries(result.jsxByFile)) {
    if (
      ![
        `${SOURCE_ROOT}/application.tsx`,
        `${SOURCE_ROOT}/failure-view.tsx`,
        `${SOURCE_ROOT}/managed-surface.tsx`,
        `${SOURCE_ROOT}/root.tsx`,
      ].includes(relativePath)
    ) {
      assert.deepEqual(jsx, []);
    }
  }
});

test("rejects aliased namespace and helper component-tree escapes", async () => {
  await rejectMutation(
    ROOT_SOURCE,
    (text) =>
      text
        .replace(
          'import { StrictMode } from "react";',
          'import { StrictMode as HiddenStrictMode } from "react";',
        )
        .replaceAll("<StrictMode>", "<HiddenStrictMode>")
        .replaceAll("</StrictMode>", "</HiddenStrictMode>"),
    /JSX ownership or inventory drifted/u,
  );
  await rejectMutation(
    ROOT_SOURCE,
    (text) =>
      text
        .replace('import { StrictMode } from "react";', 'import * as React from "react";')
        .replaceAll("<StrictMode>", "<React.StrictMode>")
        .replaceAll("</StrictMode>", "</React.StrictMode>"),
    /namespace import/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nfunction HiddenManagedTree() { return <main />; }\nvoid HiddenManagedTree;\n`,
    /JSX ownership or inventory drifted/u,
  );
});

test("rejects createElement JSX-runtime fake-element and plan-shaped escapes", async () => {
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nimport { createElement } from "react";\nconst hidden = createElement("main");\nvoid hidden;\n`,
    /unapproved external runtime value/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nimport { jsx } from "react/jsx-runtime";\nconst hidden = jsx("main", {});\nvoid hidden;\n`,
    /JSX runtime directly/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nconst hidden = { $$typeof: Symbol.for("react.element"), type: "main", key: null, props: {} };\nvoid hidden;\n`,
    /fake React-element marker/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nconst hidden = { capabilityId: "com.example.hidden", component: "Hidden", props: {} };\nvoid hidden;\n`,
    /plan, capability, or Source-node-shaped literal/u,
  );
});

test("rejects direct surfaces access and every dynamic executable primitive", async () => {
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) => `${text}\nvoid officialDerivedSignInBundle.surfaces;\n`,
    /Bundle\.surfaces/u,
  );
  for (const [addition, expected] of [
    ['void import("./application.js");', /dynamic import/u],
    ['void eval("0");', /dynamic executable primitive/u],
    ['void Function("return 0");', /dynamic executable primitive/u],
    ['void new Worker("/worker.js");', /dynamic worker or executable constructor/u],
    ['void document.createElement("script");', /DOM method outside the exact infrastructure/u],
    ["void WebAssembly;", /dynamic executable authority reference/u],
  ]) {
    await rejectMutation(MAIN_SOURCE, (text) => `${text}\n${addition}\n`, expected);
  }
});

test("rejects Source fixtures and every additional CSS or JSON data edge", async () => {
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text.replaceAll("official-derived.bundle.desen.json", "official-derived.source.desen.json"),
    /escapes the production source directory/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) => `import "./styles.css";\n${text}`,
    /data-import allowlist drifted/u,
  );
});

test("rejects substitutions inside the exact allowed composition functions", async () => {
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      text.replace(
        '<main className="reference-host" data-desen-host-state={status}>',
        '<main className="reference-host" dangerouslySetInnerHTML={{ __html: "<form />" }} data-desen-host-state={status}>',
      ),
    /Composition function HostNotice semantic fingerprint drifted/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) => text.replace("No managed interface is active.", "Email Password Sign in"),
    /Composition function HostNotice semantic fingerprint drifted/u,
  );
});

test("rejects aliased factories re-exports and sensitive runtime-call indirection", async () => {
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nimport { createElement as hiddenFactory } from "react";\nvoid hiddenFactory("main");\n`,
    /unapproved external runtime value/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nimport { cloneElement as hiddenClone } from "react";\nvoid hiddenClone({} as never);\n`,
    /unapproved external runtime value/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nexport { RuntimeReactSurfaceBoundary as HiddenBoundary } from "@desen/runtime-react";\n`,
    /production re-export edge/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text
        .replace(
          "createRuntimeReactAdapterRegistry }",
          "createRuntimeReactAdapterRegistry as hiddenRegistry }",
        )
        .replace(
          "const registry = createRuntimeReactAdapterRegistry(",
          "const registry = hiddenRegistry(",
        ),
    /public reference-adapter registry path/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text
        .replace(
          "disposeRuntimeHeadlessSession, mountRuntimeHeadlessSession",
          "disposeRuntimeHeadlessSession, mountRuntimeHeadlessSession as hiddenMount",
        )
        .replace("const mounted = mountRuntimeHeadlessSession(", "const mounted = hiddenMount("),
    /public headless-session mount path/u,
  );
  await rejectMutation(
    `${SOURCE_ROOT}/managed-surface.tsx`,
    (text) =>
      text
        .replace("useRuntimeReactSurface }", "useRuntimeReactSurface as hiddenHook }")
        .replace(
          "const result = useRuntimeReactSurface(input);",
          "const result = hiddenHook(input);",
        ),
    /runtime-react plan path/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) => `${text}\nconst hiddenMount = mountRuntimeHeadlessSession;\nvoid hiddenMount;\n`,
    /aliases or captures a sensitive public runtime call/u,
  );
});

test("authenticates registry Bundle and Catalog identifiers to exact import symbols", async () => {
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text.replace(
        'import { REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT } from "@desen/reference-catalog-web/react-adapters";',
        'import "@desen/reference-catalog-web/react-adapters";\nconst REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT = Object.freeze([]);',
      ),
    /public reference-adapter registry path/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text.replace(
        'import officialDerivedSignInBundle from "../../../examples/sign-in/official-derived.bundle.desen.json";',
        'import "../../../examples/sign-in/official-derived.bundle.desen.json";\nconst officialDerivedSignInBundle = Object.freeze({});',
      ),
    /controlled Bundle and Catalog/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text.replace(
        'import referenceCatalog from "@desen/reference-catalog-web/catalog.json";',
        'import "@desen/reference-catalog-web/catalog.json";\nconst referenceCatalog = Object.freeze({});',
      ),
    /controlled Bundle and Catalog/u,
  );
});

test("rejects computed fake trees global authority access and DOM replacement", async () => {
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nconst hidden = { ["$$" + "typeof"]: Symbol.for("react.element"), ["ty" + "pe"]: "main", ["pro" + "ps"]: {} };\nvoid hidden;\n`,
    /fake React-element marker/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) => `${text}\nvoid officialDerivedSignInBundle["sur" + "faces"];\n`,
    /surfaces-shaped escape/u,
  );
  await rejectMutation(
    MAIN_SOURCE,
    (text) => `${text}\nconst key = "eval";\nvoid window[key];\n`,
    /computed access on a browser global authority/u,
  );
  await rejectMutation(
    MAIN_SOURCE,
    (text) => `${text}\ndocument.body.innerHTML = "<form>handwritten</form>";\n`,
    /handwritten DOM replacement or mutation sink/u,
  );
  for (const addition of [
    'container.before(document.createTextNode("handwritten"));',
    'container.insertBefore(document.createTextNode("handwritten"), container.firstChild);',
    'container.setAttribute("class", "handwritten");',
  ]) {
    await rejectMutation(
      MAIN_SOURCE,
      (text) => `${text}\n${addition}\n`,
      /DOM method outside the exact infrastructure allowlist/u,
    );
  }
  await rejectMutation(
    MAIN_SOURCE,
    (text) => `${text}\ncontainer.style.cssText = "position:fixed;inset:0";\n`,
    /executable URL, event-handler, or DOM text property/u,
  );
  await rejectMutation(
    MAIN_SOURCE,
    (text) => `${text}\nObject.assign(container, { innerHTML: "<form>handwritten</form>" });\n`,
    /open-ended object mutation or descriptor surface/u,
  );
  await rejectMutation(
    MAIN_SOURCE,
    (text) => `${text}\nReflect.set(container, "innerHTML", "<form>handwritten</form>");\n`,
    /open-ended Reflect\.set mutation surface/u,
  );
  await rejectMutation(
    MAIN_SOURCE,
    (text) =>
      `${text}\nconst dynamicKey = "eval";\nvoid Object.getOwnPropertyDescriptor(globalThis, dynamicKey);\n`,
    /enumerates or reflects a browser global authority/u,
  );
  for (const addition of [
    'container.setAttribute.call(container, "class", "handwritten");',
    'Reflect.apply(container.setAttribute, container, ["class", "handwritten"]);',
  ]) {
    await rejectMutation(
      MAIN_SOURCE,
      (text) => `${text}\n${addition}\n`,
      /captures or invokes a DOM method outside the exact infrastructure allowlist/u,
    );
  }
  await rejectMutation(
    BROWSER_PROFILE_SOURCE,
    (text) =>
      text.replace(
        'return typeof browser.matchMedia === "function" && browser.matchMedia(query).matches;',
        'const captured = browser.matchMedia;\n  void captured;\n  return typeof browser.matchMedia === "function" && browser.matchMedia(query).matches;',
      ),
    /captures or invokes a DOM method outside the exact infrastructure allowlist/u,
  );
  for (const [addition, expected] of [
    [
      `void [].filter.constructor("document.body.outerText='forged'")();`,
      /dynamic executable authority or constructor chain/u,
    ],
    [
      `void Object.values(globalThis).find((value) => typeof value === "function");`,
      /enumerates or reflects a browser global authority/u,
    ],
    [
      `(container as HTMLElement).outerText = "forged";`,
      /executable URL, event-handler, or DOM text property/u,
    ],
    [
      `container["text" + "Content"] = "forged";`,
      /indexed handwritten DOM replacement or mutation sink/u,
    ],
    [
      `container.insertAdjacentText("beforeend", "forged");`,
      /DOM method outside the exact infrastructure allowlist/u,
    ],
    [
      `container.replaceChildren(document.createTextNode("forged"));`,
      /DOM method outside the exact infrastructure allowlist/u,
    ],
  ]) {
    await rejectMutation(MAIN_SOURCE, (text) => `${text}\n${addition}\n`, expected);
  }
});

test("rejects alternate React roots timers executable URLs and CSS visual substitutes", async () => {
  await rejectMutation(
    MAIN_SOURCE,
    (text) =>
      `import { hydrateRoot } from "react-dom/client";\n${text}\nhydrateRoot(container, "handwritten");\n`,
    /unapproved external runtime value/u,
  );
  for (const [addition, expected] of [
    [`setTimeout("document.body.innerHTML='<form/>'", 0);`, /global DOM executable/u],
    ['setInterval("javascript:" + "alert(1)", 1);', /executable javascript URL/u],
    ['window.open("javascript:alert(1)");', /executable javascript URL/u],
    [
      'window.location.href = "/replacement";',
      /executable URL, event-handler, or DOM text property/u,
    ],
  ]) {
    await rejectMutation(MAIN_SOURCE, (text) => `${text}\n${addition}\n`, expected);
  }
  const cssPath = `${SOURCE_ROOT}/styles.css`;
  await rejectMutation(
    cssPath,
    (text) =>
      `${text}\nbody::after { content: "Email Password Sign in"; position: fixed; inset: 0; }\n`,
    /Host infrastructure CSS contains forbidden generated content/u,
  );
  await rejectMutation(
    cssPath,
    (text) =>
      `${text}\nbody::be\\66 ore { c\\6f ntent: "Email Password Sign in"; p\\6f sition: fixed; }\n`,
    /Host infrastructure CSS contains forbidden generated content/u,
  );
  for (const [addition, expected] of [
    [
      `body { background-image: image-set("data:image/svg+xml,<svg><text>Email Password Sign in</text></svg>" 1x); }`,
      /forbidden generated image function/u,
    ],
    [`body { background: linear-gradient(red, blue); }`, /forbidden generated gradient image/u],
    [`body { mask: none; }`, /forbidden masking/u],
    [`body { filter: opacity(0); }`, /forbidden filtering/u],
    [`.reference-host { transform: scale(0); }`, /forbidden transform/u],
    [`.reference-host { scale: 0; }`, /forbidden scale/u],
    [`.reference-host { clip-path: inset(100%); }`, /forbidden clipping/u],
    [`body { accent-color: red; }`, /frozen canonical stylesheet/u],
  ]) {
    await rejectMutation(cssPath, (text) => `${text}\n${addition}\n`, expected);
  }
});

test("rejects DOM descriptor and callable-prototype authority extraction", async () => {
  for (const [addition, expected] of [
    [
      `const descriptorKey = ["outer", "HTML"].join("");\nconst setter = Object.getOwnPropertyDescriptor(Element.prototype, descriptorKey)?.set;\nsetter?.call(container, "<form>forged</form>");`,
      /reflects a DOM instance or prototype authority/u,
    ],
    [
      `const descriptorKey = ["replace", "Children"].join("");\nvoid Reflect.get(Element.prototype, descriptorKey);`,
      /reflects a DOM instance or prototype authority/u,
    ],
    [
      `const functionPrototype = Object.getPrototypeOf(() => undefined);\nconst functionDescriptors = Object.getOwnPropertyDescriptors(functionPrototype);\nconst dynamicExecutable = Object.values(functionDescriptors).find((descriptor) => typeof descriptor.value === "function" && descriptor.value.length === 1)?.value as ((body: string) => unknown) | undefined;\nvoid dynamicExecutable?.("document.body.outerHTML = '<form>forged</form>'");`,
      /reflects or enumerates a callable authority/u,
    ],
  ]) {
    await rejectMutation(MAIN_SOURCE, (text) => `${text}\n${addition}\n`, expected);
  }
});

test("pins the closed executable call and property-write authority surface", async () => {
  for (const addition of [
    `void Array.isArray([]);`,
    `const localWrite = { value: 0 };\nlocalWrite.value = 1;`,
  ]) {
    await rejectMutation(
      MAIN_SOURCE,
      (text) => `${text}\n${addition}\n`,
      /closed executable call\/property-write authority surface drifted/u,
    );
  }
});

test("discovers and rejects unknown and symlinked internal source entries", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t09-inventory-"));
  const workspaceRoot = await realpath(temporary);
  const sourceRoot = path.join(workspaceRoot, SOURCE_ROOT);
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(path.join(sourceRoot, "main.tsx"), "export {};\n");
  try {
    assert.deepEqual(await inspectReferenceHostWebSourceInventory({ workspaceRoot }), [
      `${SOURCE_ROOT}/main.tsx`,
    ]);
    const unknown = path.join(sourceRoot, "hidden.svg");
    await writeFile(unknown, "<svg />");
    await assert.rejects(
      inspectReferenceHostWebSourceInventory({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
    );
    await unlink(unknown);
    const target = path.join(workspaceRoot, "target.ts");
    await writeFile(target, "export {};\n");
    await symlink(target, path.join(sourceRoot, "hidden.ts"));
    await assert.rejects(
      inspectReferenceHostWebSourceInventory({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects Vite public environment PostCSS and local config entry surfaces", () => {
  for (const entry of [
    "public",
    "PUBLIC",
    ".env.production",
    ".ENV.production",
    ".postcssrc.cjs",
    ".POSTCSSRC.cJs",
    ".postcssrc.json",
    "postcss.config.cjs",
    "POSTCSS.CONFIG.cjs",
    "vite.config.ts",
    "VITE.CONFIG.ts",
  ]) {
    assert.throws(
      () => verifyReferenceHostWebBuildEnvelopeEntryPolicy(["index.html", "package.json", entry]),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
    );
  }
  for (const entries of [
    ["index.html", "PACKAGE.JSON"],
    ["index.html", "package.json", "PACKAGE.JSON"],
    ["index.html", "package.json", "ＰＯＳＴＣＳＳ.CONFIG.cjs"],
  ]) {
    assert.throws(
      () => verifyReferenceHostWebBuildEnvelopeEntryPolicy(entries),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
    );
  }
  for (const scope of ["reference-host application root", "applications root", "workspace root"]) {
    for (const entry of [
      ".postcssrc.cjs",
      ".POSTCSSRC.cJs",
      ".postcssrc.json",
      "postcss.config.mjs",
      "POSTCSS.CONFIG.mjs",
    ]) {
      assert.throws(
        () =>
          verifyReferenceHostWebPostCssBuildEnvelopePolicy(["package.json", entry], "{}", {
            scope,
          }),
        hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
      );
    }
    assert.throws(
      () =>
        verifyReferenceHostWebPostCssBuildEnvelopePolicy(
          ["package.json"],
          '{"postcss":{"plugins":[]}}',
          { scope },
        ),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
    );
  }
  assert.equal(
    verifyReferenceHostWebPostCssBuildEnvelopePolicy(["reference-host-web"], "{}", {
      packageJsonOptional: true,
      scope: "applications root",
    }).result,
    "PASS",
  );
});

test("parses only the exact canonical HTML node and attribute envelope", async () => {
  const pristine = await sourceText("apps/reference-host-web/index.html");
  const result = await verifyReferenceHostWebHtmlEnvelopePolicy(pristine);
  assert.equal(result.parser, "jsdom@29.1.1 exact canonical AST");
  for (const mutation of [
    pristine.replace(
      '<meta charset="UTF-8" />',
      '<meta http-equiv="refresh" content="0;url=https://evil.example" />',
    ),
    pristine.replace("<body>", '<body style="background:url(data:image/svg+xml,evil)">'),
    pristine.replace(
      '<div id="desen-reference-host-root"></div>',
      '<div id="desen-reference-host-root"><!-- forged --></div>',
    ),
  ]) {
    await assert.rejects(
      verifyReferenceHostWebHtmlEnvelopePolicy(mutation),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
    );
  }
});

test("rejects orphan unresolved dynamic forbidden and substituted runtime graphs", async () => {
  const built = await buildCurrentReferenceHostWebSourceAuditEvidence();
  const pristine = structuredClone(built.artifact.runtimeResolution.modules);
  const sourcePaths = pristine
    .map(({ id }) => id)
    .filter((id) => id.startsWith(`${SOURCE_ROOT}/`))
    .sort();
  const rejectGraph = (graph, paths, expectedMessage) => {
    assert.throws(
      () => verifyReferenceHostWebSourceGraphPolicy(graph, paths),
      (error) => {
        assert.ok(error instanceof ReferenceHostWebSourceAuditEvidenceError);
        assert.equal(error.code, "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT");
        assert.match(error.message, expectedMessage);
        return true;
      },
    );
  };
  rejectGraph(pristine, [...sourcePaths, `${SOURCE_ROOT}/orphan.ts`], /orphan or unexpected/u);
  const unresolved = structuredClone(pristine);
  unresolved.find(({ id }) => id === MAIN_SOURCE).imports.push(`${SOURCE_ROOT}/missing.ts`);
  rejectGraph(unresolved, sourcePaths, /unresolved or externalized/u);
  const dynamic = structuredClone(pristine);
  dynamic.find(({ id }) => id === MAIN_SOURCE).dynamicImports.push(APPLICATION_SOURCE);
  rejectGraph(dynamic, sourcePaths, /dynamic import edge/u);
  const substituted = structuredClone(pristine);
  const official = substituted.find(({ id }) => id === OFFICIAL_SOURCE);
  official.imports = official.imports.filter(
    (entry) => entry !== "packages/reference-catalog-web/dist/react-adapters/index.js",
  );
  rejectGraph(substituted, sourcePaths, /public adapter and runtime-react entrypoints/u);
  const forbidden = structuredClone(pristine);
  forbidden.find(({ id }) => id === MAIN_SOURCE).imports.push("packages/editor-core/dist/index.js");
  forbidden.push({
    id: "packages/editor-core/dist/index.js",
    imports: [],
    dynamicImports: [],
    codeBytes: 1,
    codeSha256: `sha256:${"0".repeat(64)}`,
  });
  rejectGraph(forbidden, sourcePaths, /closed transitive runtime envelope/u);
  const transitiveEditor = structuredClone(pristine);
  transitiveEditor
    .find(({ id }) => id === "packages/runtime-react/dist/index.js")
    .imports.push("packages/editor-core/dist/index.js");
  transitiveEditor.push({
    id: "packages/editor-core/dist/index.js",
    imports: [],
    dynamicImports: [],
    codeBytes: 1,
    codeSha256: `sha256:${"1".repeat(64)}`,
  });
  rejectGraph(transitiveEditor, sourcePaths, /closed runtime architecture/u);
  const wrongArchitecture = structuredClone(pristine);
  wrongArchitecture
    .find(({ id }) => id === "packages/runtime-core/dist/index.js")
    .imports.push("packages/reference-catalog-web/catalog.json");
  rejectGraph(wrongArchitecture, sourcePaths, /closed runtime architecture/u);
});

test("rejects malformed duplicate and hostile graph seam containers", async () => {
  const built = await buildCurrentReferenceHostWebSourceAuditEvidence();
  const pristine = structuredClone(built.artifact.runtimeResolution.modules);
  const sourcePaths = pristine
    .map(({ id }) => id)
    .filter((id) => id.startsWith(`${SOURCE_ROOT}/`))
    .sort();
  const rejectOptions = (graph = pristine, paths = sourcePaths) => {
    assert.throws(
      () => verifyReferenceHostWebSourceGraphPolicy(graph, paths),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
    );
  };
  const missing = structuredClone(pristine);
  delete missing[0].codeSha256;
  rejectOptions(missing);
  const extra = structuredClone(pristine);
  extra[0].unexpected = true;
  rejectOptions(extra);
  const invalidHash = structuredClone(pristine);
  invalidHash[0].codeSha256 = "sha256:missing";
  rejectOptions(invalidHash);
  const duplicate = structuredClone(pristine);
  duplicate.push(structuredClone(duplicate[0]));
  assert.throws(
    () => verifyReferenceHostWebSourceGraphPolicy(duplicate, sourcePaths),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
  );

  let executed = false;
  const ownMap = structuredClone(pristine);
  Object.defineProperty(ownMap, "map", {
    enumerable: true,
    value() {
      executed = true;
    },
  });
  rejectOptions(ownMap);
  assert.equal(executed, false);

  const accessor = structuredClone(pristine);
  const first = accessor[0];
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    get() {
      executed = true;
      return first;
    },
  });
  rejectOptions(accessor);
  assert.equal(executed, false);

  const holed = structuredClone(pristine);
  delete holed[0];
  rejectOptions(holed);
  const symbolKeyed = structuredClone(pristine);
  symbolKeyed[Symbol("hidden")] = true;
  rejectOptions(symbolKeyed);

  class GraphSubclass extends Array {}
  rejectOptions(new GraphSubclass(...pristine));

  const hostileImports = structuredClone(pristine);
  const moduleWithImports = hostileImports.find(({ imports }) => imports.length > 0);
  Object.defineProperty(moduleWithImports.imports, "map", {
    enumerable: true,
    value() {
      executed = true;
    },
  });
  rejectOptions(hostileImports);
  assert.equal(executed, false);

  const accessorImports = structuredClone(pristine);
  const accessorImportModule = accessorImports.find(({ imports }) => imports.length > 0);
  const firstImport = accessorImportModule.imports[0];
  Object.defineProperty(accessorImportModule.imports, "0", {
    enumerable: true,
    get() {
      executed = true;
      return firstImport;
    },
  });
  rejectOptions(accessorImports);
  assert.equal(executed, false);

  class ImportsSubclass extends Array {}
  const subclassImports = structuredClone(pristine);
  subclassImports[0].imports = new ImportsSubclass(...subclassImports[0].imports);
  rejectOptions(subclassImports);

  const dynamicOwnMap = structuredClone(pristine);
  Object.defineProperty(dynamicOwnMap[0].dynamicImports, "map", {
    enumerable: true,
    value() {
      executed = true;
    },
  });
  rejectOptions(dynamicOwnMap);
  assert.equal(executed, false);

  const dynamicAccessor = structuredClone(pristine);
  dynamicAccessor[0].dynamicImports = [MAIN_SOURCE];
  Object.defineProperty(dynamicAccessor[0].dynamicImports, "0", {
    enumerable: true,
    get() {
      executed = true;
      return MAIN_SOURCE;
    },
  });
  rejectOptions(dynamicAccessor);
  assert.equal(executed, false);

  class DynamicImportsSubclass extends Array {}
  const subclassDynamic = structuredClone(pristine);
  subclassDynamic[0].dynamicImports = new DynamicImportsSubclass();
  rejectOptions(subclassDynamic);

  const sourceAccessor = [...sourcePaths];
  const firstSource = sourceAccessor[0];
  Object.defineProperty(sourceAccessor, "0", {
    enumerable: true,
    get() {
      executed = true;
      return firstSource;
    },
  });
  rejectOptions(pristine, sourceAccessor);
  assert.equal(executed, false);

  const sourceOwnMap = [...sourcePaths];
  Object.defineProperty(sourceOwnMap, "map", {
    enumerable: true,
    value() {
      executed = true;
    },
  });
  rejectOptions(pristine, sourceOwnMap);
  assert.equal(executed, false);

  class SourcePathsSubclass extends Array {}
  rejectOptions(pristine, new SourcePathsSubclass(...sourcePaths));
});

test("rejects Vite backing-module state drift through the production snapshot policy", () => {
  const before = [
    {
      id: "packages/runtime-core/dist/index.js",
      path: "packages/runtime-core/dist/index.js",
      dev: "1",
      ino: "2",
      size: "1",
      mtimeNs: "3",
      ctimeNs: "4",
      bytes: 1,
      sha256: `sha256:${"a".repeat(64)}`,
    },
  ];
  assert.equal(
    verifyReferenceHostWebBackingSnapshotPolicy(
      before,
      structuredClone(before),
      structuredClone(before),
    ).backingFiles,
    1,
  );
  const after = structuredClone(before);
  after[0].sha256 = `sha256:${"b".repeat(64)}`;
  assert.throws(
    () => verifyReferenceHostWebBackingSnapshotPolicy(before, structuredClone(before), after),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_GRAPH_NONDETERMINISTIC"),
  );
});

test("rejects unknown override paths and hostile option containers", async () => {
  await assert.rejects(
    inspectReferenceHostWebSourceAudit({
      sourceOverrides: { [`${SOURCE_ROOT}/unknown.ts`]: "export {};" },
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
  const accessor = {};
  Object.defineProperty(accessor, "workspaceRoot", {
    enumerable: true,
    get() {
      throw new Error("must not run");
    },
  });
  await assert.rejects(
    inspectReferenceHostWebSourceAudit(accessor),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
  await assert.rejects(
    inspectReferenceHostWebSourceAudit(new Proxy({}, {})),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
  await assert.rejects(
    inspectReferenceHostWebSourceAudit({ [Symbol("hostile")]: true }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
});

test("authenticates the exact dependency-cruiser rule and rejects removal or drift", () => {
  const expectedRule = {
    name: "application-reference-host-web-allowed-dependencies",
    severity: "error",
    comment: "reference-host-web may import only the packages assigned to its responsibility.",
    from: { path: "^apps/reference-host-web/" },
    to: {
      path: "^packages/",
      pathNot: "^packages/(?:runtime-core|runtime-react|runtime-web|reference-catalog-web)/",
    },
  };
  const configuration = { forbidden: [expectedRule], options: {} };
  assert.equal(
    verifyReferenceHostWebDependencyBoundaryConfiguration(configuration).rule.name,
    expectedRule.name,
  );
  for (const mutation of [
    { forbidden: [], options: {} },
    {
      forbidden: [{ ...structuredClone(expectedRule), severity: "warn" }],
      options: {},
    },
    {
      forbidden: [structuredClone(expectedRule), structuredClone(expectedRule)],
      options: {},
    },
  ]) {
    assert.throws(
      () => verifyReferenceHostWebDependencyBoundaryConfiguration(mutation),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_BOUNDARY_DRIFT"),
    );
  }
});

test("derives every default evidence path from one custom workspace authority", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t09-paths-"));
  const workspaceRoot = await realpath(temporary);
  try {
    const resolved = await resolveReferenceHostWebSourceAuditWorkspacePaths({
      workspaceRoot,
    });
    assert.equal(
      resolved.artifactPath,
      path.join(workspaceRoot, "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json"),
    );
    assert.equal(
      resolved.proofPath,
      path.join(workspaceRoot, "docs/proof/REFERENCE-HOST-WEB-SOURCE-AUDIT.md"),
    );
    assert.equal(resolved.proofMatrixPath, path.join(workspaceRoot, "docs/proof/PROOF-MATRIX.md"));
    assert.equal(resolved.projectStatusPath, path.join(workspaceRoot, "PROJECT-STATUS.md"));
    await assert.rejects(
      resolveReferenceHostWebSourceAuditWorkspacePaths({
        workspaceRoot,
        artifactPath: path.join(workspaceRoot, "..", "outside.json"),
      }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects ambiguous verifier inputs and a FIFO artifact without blocking", async () => {
  await assert.rejects(
    verifyReferenceHostWebSourceAuditEvidence({
      proofPath: "proof.md",
      proofDocumentText: "proof",
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
  const temporary = await mkdtemp(path.join(WORKSPACE_ROOT, ".t09-fifo-"));
  const canonicalTemporary = await realpath(temporary);
  const fifoPath = path.join(canonicalTemporary, "artifact.fifo");
  try {
    execFileSync("mkfifo", [fifoPath]);
    await assert.rejects(
      verifyReferenceHostWebSourceAuditEvidence({ artifactPath: fifoPath }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(canonicalTemporary, { recursive: true, force: true });
  }
});

test("historical receipt APIs reject live-build and successor injection", async () => {
  for (const operation of [
    () => buildReferenceHostWebSourceAuditEvidence({ workspaceRoot: WORKSPACE_ROOT }),
    () =>
      verifyReferenceHostWebSourceAuditEvidence({
        workspaceRoot: WORKSPACE_ROOT,
      }),
    () =>
      writeReferenceHostWebSourceAuditEvidence({
        workspaceRoot: WORKSPACE_ROOT,
      }),
    () =>
      buildReferenceHostWebSourceAuditEvidence({
        sourceOverrides: { [MAIN_SOURCE]: "export {};" },
      }),
    () =>
      writeReferenceHostWebSourceAuditEvidence({
        proofDocumentText: "successor content",
      }),
  ]) {
    await assert.rejects(
      operation(),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
    );
  }
});

test("rejects a symlinked workspace root before reading production source", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t09-root-"));
  const linkedRoot = path.join(temporary, "workspace");
  try {
    await symlink(WORKSPACE_ROOT, linkedRoot, "dir");
    await assert.rejects(
      inspectReferenceHostWebSourceAudit({ workspaceRoot: linkedRoot }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE"),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("accepts only exact contextual final and pending proof-document pins", () => {
  const digest = "a".repeat(64);
  const documentation = syntheticDocumentation(digest);
  assert.equal(
    verifyReferenceHostWebSourceAuditDocumentation(
      documentation.proofText,
      documentation.matrixText,
      documentation.statusText,
      digest,
    ).exactReferences,
    12,
  );
  const pending = syntheticDocumentation("[PENDING_FINAL_ARTIFACT_SHA256]");
  assert.equal(
    verifyReferenceHostWebSourceAuditProofDocument(
      pending.proofText,
      "[PENDING_FINAL_ARTIFACT_SHA256]",
      { allowPending: true },
    ).exactReferences,
    2,
  );
  assert.throws(
    () =>
      verifyReferenceHostWebSourceAuditProofDocument(
        pending.proofText,
        "[PENDING_FINAL_ARTIFACT_SHA256]",
      ),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
});

test("rejects decoy digest associations across every documentation context", () => {
  const digest = "b".repeat(64);
  const decoy = "c".repeat(64);
  const documentation = syntheticDocumentation(digest);
  const cases = [
    {
      key: "proofText",
      value: documentation.proofText.replace(
        `sha256:${digest}`,
        `sha256:${decoy}\n\nDecoy sha256:${digest}`,
      ),
    },
    {
      key: "matrixText",
      value: documentation.matrixText
        .replace(
          `| P-07 | source authority | \`reference-host-web-0.1.0-source-audit.json\` \`sha256:${digest}\` |`,
          `| P-07 | source authority | \`reference-host-web-0.1.0-source-audit.json\` \`sha256:${decoy}\` |`,
        )
        .concat(`\nDecoy \`sha256:${digest}\`\n`),
    },
    {
      key: "statusText",
      value: documentation.statusText.replace(
        `  \`${digest}\``,
        `  \`${decoy}\`\n- decoy \`${digest}\``,
      ),
    },
  ];
  for (const mutation of cases) {
    assert.throws(
      () =>
        verifyReferenceHostWebSourceAuditDocumentation(
          mutation.key === "proofText" ? mutation.value : documentation.proofText,
          mutation.key === "matrixText" ? mutation.value : documentation.matrixText,
          mutation.key === "statusText" ? mutation.value : documentation.statusText,
          digest,
        ),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_DRIFT"),
    );
  }
});

test("rejects one-byte and semantic stored-artifact tampering", async () => {
  const pristine = (await buildReferenceHostWebSourceAuditEvidence()).artifactBytes;
  const artifact = JSON.parse(pristine.toString("utf8"));
  artifact.claim.g05Closed = false;
  const docs = syntheticDocumentation("0".repeat(64));
  await assert.rejects(
    verifyReferenceHostWebSourceAuditEvidence({
      artifactBytes: Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`),
      proofDocumentText: docs.proofText,
      proofMatrixText: docs.matrixText,
      projectStatusText: docs.statusText,
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT"),
  );
  const oneByte = Buffer.from(pristine);
  oneByte[0] ^= 1;
  await assert.rejects(
    verifyReferenceHostWebSourceAuditEvidence({
      artifactBytes: oneByte,
      proofDocumentText: docs.proofText,
      proofMatrixText: docs.matrixText,
      projectStatusText: docs.statusText,
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT"),
  );
});

test("default writer preserves immutable bytes and alternate writes are exact copies", async () => {
  const historicalPath = path.join(
    WORKSPACE_ROOT,
    "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json",
  );
  const beforeState = await lstat(historicalPath, { bigint: true });
  const beforeBytes = await readFile(historicalPath);
  let hookRan = false;
  const preserved = await writeReferenceHostWebSourceAuditEvidence({
    beforeAtomicRename() {
      hookRan = true;
    },
  });
  const afterState = await lstat(historicalPath, { bigint: true });
  assert.equal(preserved.preserved, true);
  assert.equal(hookRan, false);
  assert.equal(afterState.dev, beforeState.dev);
  assert.equal(afterState.ino, beforeState.ino);
  assert.equal(afterState.size, beforeState.size);
  assert.equal(afterState.mtimeNs, beforeState.mtimeNs);
  assert.equal(afterState.ctimeNs, beforeState.ctimeNs);
  assert.deepEqual(await readFile(historicalPath), beforeBytes);

  const temporary = await mkdtemp(path.join(WORKSPACE_ROOT, ".t09-copy-"));
  const artifactPath = path.join(temporary, "receipt.json");
  try {
    const copied = await writeReferenceHostWebSourceAuditEvidence({ artifactPath });
    assert.equal(copied.preserved, false);
    assert.equal(
      copied.artifactSha256,
      "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89",
    );
    assert.deepEqual(await readFile(artifactPath), beforeBytes);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("keeps the previous artifact intact when the atomic pre-rename hook fails", async () => {
  const temporary = await mkdtemp(path.join(WORKSPACE_ROOT, ".t09-atomic-"));
  const artifactPath = path.join(temporary, "receipt.json");
  const sentinel = Buffer.from("previous-safe-bytes");
  await writeFile(artifactPath, sentinel);
  try {
    await assert.rejects(
      writeReferenceHostWebSourceAuditEvidence({
        artifactPath,
        beforeAtomicRename() {
          throw new Error("injected interruption");
        },
      }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE"),
    );
    assert.deepEqual(await readFile(artifactPath), sentinel);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("rejects atomic parent replacement without touching an external symlink target", async () => {
  const temporary = await mkdtemp(path.join(WORKSPACE_ROOT, ".t09-parent-race-"));
  const lexicalParent = path.join(temporary, "artifact-parent");
  const movedParent = path.join(temporary, "artifact-parent-original");
  const external = await mkdtemp(path.join(os.tmpdir(), "desen-t09-external-"));
  const externalSentinel = path.join(external, "sentinel.txt");
  const artifactPath = path.join(lexicalParent, "receipt.json");
  await mkdir(lexicalParent);
  await writeFile(externalSentinel, "external-safe");
  let hookRan = false;
  try {
    await assert.rejects(
      writeReferenceHostWebSourceAuditEvidence({
        artifactPath,
        async beforeAtomicRename({ temporaryPath }) {
          hookRan = true;
          assert.equal(path.dirname(temporaryPath), lexicalParent);
          await rename(lexicalParent, movedParent);
          await symlink(external, lexicalParent, "dir");
        },
      }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE"),
    );
    assert.equal(hookRan, true);
    assert.equal(await readFile(externalSentinel, "utf8"), "external-safe");
    assert.equal(
      await lstat(path.join(external, "receipt.json")).catch((error) =>
        error?.code === "ENOENT" ? undefined : null,
      ),
      undefined,
    );
    assert.deepEqual(await readdir(external), ["sentinel.txt"]);
    const abandoned = await readdir(movedParent);
    assert.equal(abandoned.length, 1);
    assert.match(abandoned[0], /^\.receipt\.json\.[0-9a-f]{24}\.tmp$/u);
  } finally {
    const lexicalEntry = await lstat(lexicalParent).catch(() => undefined);
    if (lexicalEntry?.isSymbolicLink() === true) {
      await unlink(lexicalParent);
    }
    await rm(temporary, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  }
});
