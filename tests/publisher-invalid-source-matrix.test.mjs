import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_PINS,
  PUBLISHER_INVALID_SOURCE_MATRIX_PACKAGE_ASSERTION_FAMILIES,
  PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_PINS,
  PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_SURFACES,
  PublisherInvalidSourceMatrixEvidenceError,
  buildPublisherInvalidSourceMatrixEvidence,
  verifyPublisherInvalidSourceMatrixEvidence,
  writePublisherInvalidSourceMatrixEvidence,
} from "../scripts/lib/publisher-invalid-source-matrix-proof.mjs";
import { createQualityGateSteps } from "../scripts/run-ci-quality-gate.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/publisher-0.1.0-invalid-source-matrix.json";
const SOURCE = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const PACKAGE_TEST = "packages/publisher/test/invalid-source-matrix.test.ts";
const PROOF_LIBRARY = "scripts/lib/publisher-invalid-source-matrix-proof.mjs";
const ROOT_TEST = "tests/publisher-invalid-source-matrix.test.mjs";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const BUNDLE_PUBLICATION_PROOF_LIBRARY = "scripts/lib/publisher-bundle-publication-proof.mjs";
const BUNDLE_PUBLICATION_ROOT_TEST = "tests/publisher-bundle-publication.test.mjs";

const baseline = await buildPublisherInvalidSourceMatrixEvidence();
const runtimeReceipt = baseline.runtimeReceipt;
const matrixCases = baseline.artifact.claims.packageTests.caseInventory;
const pinnedProof = [
  "# Test-only final T11 pin",
  "",
  `\`${ARTIFACT}\``,
  "",
  `\`sha256:${baseline.artifactSha256}\``,
  "",
].join("\n");

function expectCode(code) {
  return (error) => {
    assert.equal(error instanceof PublisherInvalidSourceMatrixEvidenceError, true);
    assert.equal(error.code, code);
    return true;
  };
}

function fastOptions(additions = {}) {
  return { runtimeReceipt, ...additions };
}

async function sourceBytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

async function sourceText(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

async function trackedMutation(relativePath, transform) {
  const original = await sourceText(relativePath);
  const mutated = transform(original);
  assert.notEqual(mutated, original);
  return fastOptions({
    trackedFileBytes: { [relativePath]: Buffer.from(mutated, "utf8") },
  });
}

function appendValidCiSuccessor(source, rootPackageSource) {
  const successor = Object.freeze({
    id: "control-plane-append-only-probe",
    verifierFile: "scripts/verify-control-plane-append-only-probe.mjs",
    rootTestFile: "tests/control-plane-append-only-probe.test.mjs",
  });
  const currentSteps = createQualityGateSteps();
  const firstRootTestIndex = currentSteps.findIndex(({ id }) => id.startsWith("test-"));
  const dependencyBoundaryIndex = currentSteps.findIndex(
    ({ id }) => id === "dependency-boundaries",
  );
  assert.ok(firstRootTestIndex > 0);
  assert.ok(dependencyBoundaryIndex > firstRootTestIndex);
  const steps = [
    ...currentSteps.slice(0, firstRootTestIndex),
    {
      id: `verify-${successor.id}`,
      label: `Proof verifier: ${successor.id}`,
      command: "node",
      args: [successor.verifierFile],
    },
    ...currentSteps.slice(firstRootTestIndex, dependencyBoundaryIndex),
    {
      id: `test-${successor.id}`,
      label: `Root proof and mutation test: ${successor.id}`,
      command: "node",
      args: ["--test", "--test-concurrency=1", successor.rootTestFile],
    },
    ...currentSteps.slice(dependencyBoundaryIndex),
  ];
  const planSha256 = createHash("sha256")
    .update(
      JSON.stringify(
        steps.map(({ id, command, args }) => ({
          id,
          command,
          args,
        })),
      ),
    )
    .digest("hex");
  const inventoryTerminator =
    "  ].map(([id, verifierFile, rootTestFile]) => Object.freeze({ id, verifierFile, rootTestFile })),";
  const tuple = [
    "    [",
    `      "${successor.id}",`,
    `      "${successor.verifierFile}",`,
    `      "${successor.rootTestFile}",`,
    "    ],",
    "",
  ].join("\n");
  const withTuple = source.replace(inventoryTerminator, `${tuple}${inventoryTerminator}`);
  assert.notEqual(withTuple, source);
  const ciSource = withTuple.replace(
    /const QUALITY_GATE_PLAN_SHA256 = "[0-9a-f]{64}";/u,
    `const QUALITY_GATE_PLAN_SHA256 = "${planSha256}";`,
  );
  assert.notEqual(ciSource, withTuple);

  const rootManifest = JSON.parse(rootPackageSource);
  const proofIds = [
    ...currentSteps
      .filter(({ id }) => id.startsWith("verify-"))
      .map(({ id }) => id.slice("verify-".length)),
    successor.id,
  ];
  const splitScript = (script) => script.split(" && ").map((command) => command.trim());
  const legacyPrerequisiteInventory = proofIds.map((id) => ({
    id,
    verify: splitScript(rootManifest.scripts[`verify:${id}`]).slice(0, -1),
    test: splitScript(rootManifest.scripts[`test:${id}`]).slice(0, -1),
  }));
  const expandRootScript = (scriptName, ancestors = []) => {
    assert.equal(ancestors.includes(scriptName), false);
    const script = rootManifest.scripts[scriptName];
    assert.equal(typeof script, "string");
    return splitScript(script).flatMap((command) => {
      const reference = /^pnpm ([a-z0-9:-]+)$/u.exec(command)?.[1];
      return reference && Object.hasOwn(rootManifest.scripts, reference)
        ? expandRootScript(reference, [...ancestors, scriptName])
        : [command];
    });
  };
  const leafInvocations = expandRootScript("check");
  const distinctLeafWorkloads = [...new Set(leafInvocations)].sort();
  const hashJson = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const replacements = [
    [
      /const LEGACY_PREREQUISITE_SHA256 =\n {2}"[0-9a-f]{64}";/u,
      `const LEGACY_PREREQUISITE_SHA256 =\n  "${hashJson(legacyPrerequisiteInventory)}";`,
    ],
    [
      /const LEGACY_LEAF_INVOCATION_SHA256 =\n {2}"[0-9a-f]{64}";/u,
      `const LEGACY_LEAF_INVOCATION_SHA256 =\n  "${hashJson(leafInvocations)}";`,
    ],
    [
      /const DISTINCT_LEAF_WORKLOAD_SHA256 =\n {2}"[0-9a-f]{64}";/u,
      `const DISTINCT_LEAF_WORKLOAD_SHA256 =\n  "${hashJson(distinctLeafWorkloads)}";`,
    ],
  ];
  let fullyPinnedCiSource = ciSource;
  for (const [pattern, replacement] of replacements) {
    const mutated = fullyPinnedCiSource.replace(pattern, replacement);
    assert.notEqual(mutated, fullyPinnedCiSource);
    fullyPinnedCiSource = mutated;
  }
  return Object.freeze({ ciSource: fullyPinnedCiSource });
}

function appendValidRootSuccessor(source) {
  const manifest = JSON.parse(source);
  const originalCheck = manifest.scripts.check;
  const originalTest = manifest.scripts.test;
  manifest.scripts["verify:control-plane-append-only-probe"] =
    "node scripts/verify-control-plane-append-only-probe.mjs";
  manifest.scripts["test:control-plane-append-only-probe"] =
    "node --test tests/control-plane-append-only-probe.test.mjs";
  manifest.scripts.check = manifest.scripts.check.replace(
    "pnpm verify:control-plane-runtime-staging && pnpm lint",
    "pnpm verify:control-plane-runtime-staging && pnpm verify:control-plane-append-only-probe && pnpm lint",
  );
  manifest.scripts.test = manifest.scripts.test.replace(
    "pnpm test:control-plane-runtime-staging && turbo run test",
    "pnpm test:control-plane-runtime-staging && pnpm test:control-plane-append-only-probe && turbo run test",
  );
  assert.notEqual(manifest.scripts.check, originalCheck);
  assert.notEqual(manifest.scripts.test, originalTest);
  return JSON.stringify(manifest);
}

async function verifyWith(additions = {}) {
  return verifyPublisherInvalidSourceMatrixEvidence(
    fastOptions({
      artifactBytes: baseline.artifactBytes,
      proofDocument: pinnedProof,
      ...additions,
    }),
  );
}

function deeplyFrozen(root) {
  const pending = [root];
  const seen = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || seen.has(value)) continue;
    seen.add(value);
    if (!Object.isFrozen(value)) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor) pending.push(descriptor.value);
    }
  }
  return true;
}

test("[authority] builds the exact versioned M06-T11 artifact root", async () => {
  assert.deepEqual(Object.keys(baseline.artifact), [
    "schemaVersion",
    "profile",
    "task",
    "result",
    "summary",
    "prerequisites",
    "claims",
    "trackedFiles",
    "tests",
    "nonclaims",
    "reproduction",
  ]);
  assert.equal(baseline.artifact.schemaVersion, 1);
  assert.equal(baseline.artifact.profile, "desen.publisher.invalid-source-matrix-proof.v1");
  assert.equal(baseline.artifact.task, "M06-T11");
  assert.equal(baseline.artifact.result, "PASS");
  assert.equal(baseline.artifact.summary.length > 0, true);
  assert.equal(Object.hasOwn(baseline.artifact, "nonClaims"), false);

  const { programBytes, ...transport } = baseline.artifact.claims.runtimeProbeTransport;
  assert.equal(programBytes > 128 * 1024, true);
  assert.deepEqual(transport, {
    transport: "stdin",
    nodeArguments: ["--no-warnings", "--input-type=module", "-"],
    maximumProgramBytes: 2 * 1024 * 1024,
    maximumStdoutBytes: 8 * 1024 * 1024,
    maximumStderrBytes: 256 * 1024,
    timeoutMilliseconds: 180_000,
    executableSourceArgumentBytes: 0,
    inheritedNodeOptions: false,
    inheritedNodePath: false,
    settlesOnClose: true,
    shell: false,
    temporaryFiles: false,
  });
  assert.equal(programBytes <= transport.maximumProgramBytes, true);
  assert.equal(Object.isFrozen(transport.nodeArguments), true);

  const proofLibrary = await sourceText(PROOF_LIBRARY);
  assert.match(proofLibrary, /execFileAsync\(/u);
  assert.match(proofLibrary, /"--permission"/u);
  assert.match(proofLibrary, /child\.stdin\.end\(programBytes\)/u);
  assert.match(proofLibrary, /child\.once\("close"/u);
  assert.match(proofLibrary, /setTimeout\(/u);
  assert.match(proofLibrary, /child\.kill\("SIGKILL"\)/u);
  assert.match(proofLibrary, /nextBytes > maximumBytes/u);
  assert.match(proofLibrary, /NODE_OPTIONS: ""/u);
  assert.match(proofLibrary, /delete environment\.NODE_PATH/u);
});

test("[authority] pins exactly M06-T03 through M06-T10", () => {
  assert.deepEqual(
    PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_PINS.map(({ task }) => task),
    ["M06-T03", "M06-T04", "M06-T05", "M06-T06", "M06-T07", "M06-T08", "M06-T09", "M06-T10"],
  );
  assert.deepEqual(
    baseline.artifact.prerequisites.map(({ task }) => task),
    ["M06-T03", "M06-T04", "M06-T05", "M06-T06", "M06-T07", "M06-T08", "M06-T09", "M06-T10"],
  );
});

test("[authority] preserves every task-time successor surface by semantic role and hash", () => {
  assert.deepEqual(
    baseline.artifact.claims.successorAuthority.map(
      ({ path: relativePath, role, bytes, sha256 }) => ({
        path: relativePath,
        role,
        bytes,
        sha256,
      }),
    ),
    PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_SURFACES,
  );
  for (const claim of baseline.artifact.claims.successorAuthority) {
    assert.equal(claim.verifiedSha256, claim.sha256);
  }
});

test("[authority] records the exact package-owned invalid case table", () => {
  assert.equal(baseline.artifact.tests.invalidMatrixCases, matrixCases.length);
  assert.equal(baseline.artifact.tests.invalidMatrixCases, 127);
  assert.equal(baseline.artifact.tests.focusedRuntimeCases, 135);
  assert.equal(baseline.artifact.claims.packageTests.bytes, 91_924);
  assert.equal(
    baseline.artifact.claims.packageTests.sha256,
    "959b366b99d304e217b51e89ff377b2c4bb09c61e5202bf454a09575c75b0a56",
  );
  assert.deepEqual(
    runtimeReceipt.caseIds,
    matrixCases.map(({ id }) => id),
  );
  assert.deepEqual(
    runtimeReceipt.caseStages,
    matrixCases.map(({ stage }) => stage),
  );
  assert.equal(
    Object.values(baseline.artifact.claims.packageTests.traceDistribution).reduce(
      (sum, count) => sum + count,
      0,
    ),
    matrixCases.length,
  );
  assert.equal(
    Object.values(baseline.artifact.claims.packageTests.stageDistribution).reduce(
      (sum, count) => sum + count,
      0,
    ),
    matrixCases.length,
  );
});

test("[authority] pins all eight frozen public matrix fixtures", () => {
  assert.equal(PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_PINS.length, 8);
  assert.deepEqual(
    baseline.artifact.claims.fixtureAuthority.map(
      ({ path: relativePath, bytes, sha256, verifiedSha256 }) => ({
        path: relativePath,
        bytes,
        sha256,
        verifiedSha256,
      }),
    ),
    PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_PINS.map((pin) => ({
      ...pin,
      verifiedSha256: pin.sha256,
    })),
  );
});

test("[authority] closes all twelve naturally reachable default finite-limit vectors", () => {
  assert.deepEqual(baseline.artifact.claims.packageTests.finiteLimitClosure, [
    {
      id: "PIPE-025-inherited-diagnostic-pointer-limit",
      name: "an inherited JSON diagnostic pointer beyond 4,096 units is rebound safely",
      trace: "PIPE-025",
      stage: "json-parse",
      code: "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-029-inherited-diagnostic-aggregate-limit",
      name: "an inherited Catalog report beyond the aggregate budget is rebound safely",
      trace: "PIPE-029",
      stage: "catalog-resolution",
      code: "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-032-diagnostic-pointer-limit",
      name: "a static capability diagnostic pointer beyond 4,096 units fails closed",
      trace: "PIPE-032",
      stage: "capability-contracts",
      code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-032-diagnostic-aggregate-limit",
      name: "an exact-count static capability report beyond the aggregate budget fails closed",
      trace: "PIPE-032",
      stage: "capability-contracts",
      code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-032-warning-count-limit",
      name: "1,025 deprecated capability warnings fail closed instead of truncating",
      trace: "PIPE-032",
      stage: "capability-contracts",
      code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-032-warning-pointer-limit",
      name: "a deprecated capability warning pointer beyond 4,096 units fails closed",
      trace: "PIPE-032",
      stage: "capability-contracts",
      code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-032-warning-aggregate-limit",
      name: "an exact-count warning report beyond the aggregate budget fails closed",
      trace: "PIPE-032",
      stage: "capability-contracts",
      code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-033-diagnostic-count-limit",
      name: "1,025 execution diagnostics fail closed instead of truncating",
      trace: "PIPE-033",
      stage: "state-and-control-flow",
      code: "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-033-diagnostic-pointer-limit",
      name: "an execution diagnostic pointer beyond 4,096 units fails closed",
      trace: "PIPE-033",
      stage: "state-and-control-flow",
      code: "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-033-diagnostic-aggregate-limit",
      name: "an exact-count execution report beyond the aggregate budget fails closed",
      trace: "PIPE-033",
      stage: "state-and-control-flow",
      code: "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-037-source-node-pointer-limit",
      name: "a complete Source trace pointer beyond 4,096 units fails closed",
      trace: "PIPE-037",
      stage: "normalization",
      code: "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-037-source-node-aggregate-limit",
      name: "a sub-count Source trace beyond the aggregate budget fails closed",
      trace: "PIPE-037",
      stage: "normalization",
      code: "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
    },
  ]);
  assert.equal(baseline.artifact.claims.scope.finiteCapabilityDiagnosticLimitsClosed, true);
  assert.equal(baseline.artifact.claims.scope.finiteCapabilityWarningLimitsClosed, true);
  assert.equal(baseline.artifact.claims.scope.finiteSourcePreservationLimitsClosed, true);
  assert.equal(
    baseline.artifact.claims.scope.naturallyReachableDefaultFiniteLimitBranchesClosed,
    true,
  );
});

test("[authority] closes the five reviewed traversal and identity branches", () => {
  assert.deepEqual(baseline.artifact.claims.packageTests.publicBranchClosure, [
    {
      id: "PIPE-028-behavior-reference-category",
      name: "an existing component cannot satisfy a behavior reference",
      trace: "PIPE-028",
      stage: "source-semantics",
      code: "UNKNOWN_CAPABILITY",
    },
    {
      id: "PIPE-028-resource-reference-category",
      name: "an existing operation cannot satisfy a resource reference",
      trace: "PIPE-028",
      stage: "source-semantics",
      code: "UNKNOWN_CAPABILITY",
    },
    {
      id: "PIPE-029-document-identity-limit",
      name: "a Source document identity beyond 4,096 units fails before package observation",
      trace: "PIPE-029",
      stage: "catalog-resolution",
      code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-029-requirement-identity-limit",
      name: "a Source Catalog requirement identity beyond 4,096 units fails closed",
      trace: "PIPE-029",
      stage: "catalog-resolution",
      code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    },
    {
      id: "PIPE-030-catalog-identity-mismatch",
      name: "a selected package envelope cannot override its inner Catalog identity",
      trace: "PIPE-030",
      stage: "catalog-integrity",
      code: "run.desen.publisher/INVALID_CATALOG_INPUT",
    },
  ]);
  assert.equal(baseline.artifact.claims.scope.completeReviewedPublicBranchMatrix, true);
  assert.equal(baseline.artifact.claims.scope.publicTraversalAndIdentityBranchesClosed, true);
});

test("[authority] authenticates PIPE-025 through PIPE-034 plus frozen PIPE-037 and PIPE-039", () => {
  assert.deepEqual(
    baseline.artifact.claims.traceability.map(({ id }) => id),
    [
      "PIPE-025",
      "PIPE-026",
      "PIPE-027",
      "PIPE-028",
      "PIPE-029",
      "PIPE-030",
      "PIPE-031",
      "PIPE-032",
      "PIPE-033",
      "PIPE-034",
      "PIPE-037",
      "PIPE-039",
    ],
  );
});

test("[authority] records the exact thirty-one-row task-applicability classification", () => {
  assert.deepEqual(
    baseline.artifact.claims.taskApplicability.records.map(({ ledger, applicability }) => [
      ledger.id,
      applicability.classification,
    ]),
    [
      ["C-011", "EXECUTABLE_COMPOSITE"],
      ["C-012", "EXECUTABLE_GOLDEN_AND_NO_BUNDLE_MATRIX"],
      ["PIPE-004", "EXECUTABLE_INVALID_PUBLICATION_SLICE"],
      ["PIPE-025", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-026", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-027", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-028", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-029", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-030", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-031", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-032", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-033", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-034", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-035", "EXECUTABLE_TOTAL_STAGE_SUCCESS"],
      ["PIPE-036", "EXECUTABLE_TOTAL_STAGE_SUCCESS"],
      ["PIPE-037", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-038", "EXECUTABLE_TOTAL_STAGE_SUCCESS"],
      ["PIPE-039", "EXECUTABLE_INVALID_PUBLICATION"],
      ["PIPE-040", "EXECUTABLE_TOTAL_STAGE_SUCCESS"],
      ["PIPE-041", "JUSTIFIED_NA"],
      ["R-025", "EXECUTABLE_REPRESENTATIVE_CASES"],
      ["R-033", "EXECUTABLE_REPRESENTATIVE_CASES"],
      ["R-052", "EXECUTABLE_REPRESENTATIVE_CASES"],
      ["R-057", "EXECUTABLE_REPRESENTATIVE_CASES"],
      ["R-083", "EXECUTABLE_REPRESENTATIVE_CASES"],
      ["R-108", "EXECUTABLE_COMPLETE_NO_BUNDLE_MATRIX"],
      ["R-111", "EXECUTABLE_REPRESENTATIVE_CASES"],
      ["R-137", "EXECUTABLE_REPRESENTATIVE_CASES"],
      ["R-143", "EXECUTABLE_REPRESENTATIVE_CASES"],
      ["D-032", "EXECUTABLE_REPRESENTATIVE_CASES"],
      ["D-033", "EXECUTABLE_REPRESENTATIVE_CASES"],
    ],
  );
  assert.equal(baseline.artifact.claims.taskApplicability.records.length, 31);
});

test("[authority] pins positive total-stage prerequisites and the unsigned signing non-claim", () => {
  const records = new Map(
    baseline.artifact.claims.taskApplicability.records.map((record) => [record.ledger.id, record]),
  );
  assert.deepEqual(records.get("PIPE-035").applicability.prerequisiteTasks, ["M06-T08", "M06-T10"]);
  assert.deepEqual(records.get("PIPE-036").applicability.prerequisiteTasks, ["M06-T07", "M06-T10"]);
  assert.deepEqual(records.get("PIPE-038").applicability.prerequisiteTasks, ["M06-T08", "M06-T10"]);
  assert.deepEqual(records.get("PIPE-040").applicability.prerequisiteTasks, ["M06-T09", "M06-T10"]);
  const signing = records.get("PIPE-041");
  assert.equal(signing.ledger.status, "JUSTIFIED_NA");
  assert.equal(signing.applicability.classification, "JUSTIFIED_NA");
  assert.equal(signing.applicability.localClaim, "unsigned publication only");
  assert.equal(signing.applicability.completeRuleClaim, false);
  assert.equal(signing.applicability.rationale.length > 0, true);
});

test("[authority] keeps PF-047 scoped to A-011 and D-009 without ledger reassignment", () => {
  const authority = baseline.artifact.claims.taskApplicability.taskLocalFindingAuthority;
  assert.equal(authority.finding, "PF-047");
  assert.equal(authority.frozenLedgerReassignment, false);
  assert.deepEqual(
    authority.records.map(({ historicalLedger, applicableM06T11 }) => ({
      id: historicalLedger.id,
      status: applicableM06T11.status,
      completeRuleClaim: applicableM06T11.completeRuleClaim,
      frozenLedgerReassignment: applicableM06T11.frozenLedgerReassignment,
    })),
    [
      {
        id: "A-011",
        status: "TASK_LOCAL_SLICE_PROVED",
        completeRuleClaim: false,
        frozenLedgerReassignment: false,
      },
      {
        id: "D-009",
        status: "TASK_LOCAL_SLICE_PROVED",
        completeRuleClaim: false,
        frozenLedgerReassignment: false,
      },
    ],
  );
});

test("[authority] records exact public failure and no-partial-authority claims", () => {
  const claim = baseline.artifact.claims.publicInvalidSourceMatrix;
  assert.deepEqual(claim.exactFailureKeys, ["diagnostics", "ok", "stage"]);
  assert.equal(claim.errorFirstNonemptyDiagnostics, true);
  assert.equal(claim.firstDiagnosticStageMatchesResult, true);
  assert.equal(claim.forbiddenFailureAuthority.includes("bundle"), true);
  assert.equal(claim.warningSuppressionOnLaterFailure, true);
  assert.deepEqual(
    claim.stageEightNineTenPrecedence.map(({ id, stage }) => ({ id, stage })),
    [
      { id: "PIPE-032-capability-precedence", stage: "capability-contracts" },
      { id: "PIPE-033-control-flow-precedence", stage: "state-and-control-flow" },
      { id: "PIPE-034-binding-precedence", stage: "binding-compatibility" },
    ],
  );
});

test("[authority] pins the exact finite public raw Source profile", () => {
  assert.deepEqual(baseline.artifact.claims.publicInvalidSourceMatrix.publicSourceJsonLimits, {
    maxDecodedStringCodeUnits: 4_194_304,
    maxJsonDepth: 256,
    maxJsonValueOccurrences: 262_144,
    maxNumberTokenCodeUnits: 1_024,
    maxSourceUtf8Bytes: 8_388_608,
  });
});

test("[authority] authenticates the complete public Publisher-owned diagnostic registry", () => {
  const registry =
    baseline.artifact.claims.publicInvalidSourceMatrix.completePublisherDiagnosticRegistry;
  assert.equal(registry.length, 14);
  assert.deepEqual(
    registry.map(({ code }) => code),
    runtimeReceipt.publisherDiagnosticCodes,
  );
  assert.equal(new Set(runtimeReceipt.publisherDiagnosticCodes).size, 14);
  assert.equal(runtimeReceipt.publisherRegistryComplete, true);
  assert.equal(runtimeReceipt.publisherRegistryDeepFrozen, true);
});

test("[authority] keeps the four total-stage fake negatives out of scope", () => {
  assert.deepEqual(
    baseline.artifact.claims.publicInvalidSourceMatrix.deliberatelyUnrepresentedNegativeStages,
    ["source-digest", "authoring-removal", "catalog-pinning", "bundle-revision"],
  );
  assert.equal(
    baseline.artifact.nonclaims.some((nonclaim) => nonclaim.includes("does not manufacture")),
    true,
  );
});

test("[authority] returns recursively immutable artifact and receipt graphs", () => {
  assert.equal(deeplyFrozen(baseline.artifact), true);
  assert.equal(deeplyFrozen(baseline.runtimeReceipt), true);
});

test("[artifact] verifies exact in-memory bytes and one final proof pin", async () => {
  const result = await verifyWith();
  assert.equal(result.result, "PASS");
  assert.equal(result.artifactSha256, baseline.artifactSha256);
  assert.equal(result.invalidCases, matrixCases.length);
  assert.equal(result.taskApplicabilityRows, 31);
  assert.equal(result.taskLocalFindingRows, 2);
  assert.equal(result.traceRows, 12);
});

test("[artifact] accepts an exact plain Uint8Array byte override", async () => {
  const result = await verifyPublisherInvalidSourceMatrixEvidence(
    fastOptions({
      artifactBytes: new Uint8Array(baseline.artifactBytes),
      proofDocument: pinnedProof,
    }),
  );
  assert.equal(result.result, "PASS");
});

test("[artifact] rejects one changed artifact byte", async () => {
  const bytes = Buffer.from(baseline.artifactBytes);
  bytes[bytes.length - 2] ^= 1;
  await assert.rejects(
    verifyPublisherInvalidSourceMatrixEvidence(
      fastOptions({ artifactBytes: bytes, proofDocument: pinnedProof }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT"),
  );
});

test("[artifact] rejects a PENDING proof pin", async () => {
  await assert.rejects(
    verifyPublisherInvalidSourceMatrixEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: `\`${ARTIFACT}\`\n\n\`sha256:PENDING\``,
      }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_PROOF_DOCUMENT_DRIFT"),
  );
});

test("[artifact] rejects a wrong proof hash", async () => {
  await assert.rejects(
    verifyPublisherInvalidSourceMatrixEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: `\`${ARTIFACT}\`\n\n\`sha256:${"0".repeat(64)}\``,
      }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_PROOF_DOCUMENT_DRIFT"),
  );
});

test("[artifact] rejects duplicate artifact-path proof authority", async () => {
  await assert.rejects(
    verifyPublisherInvalidSourceMatrixEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: `${pinnedProof}\n\`${ARTIFACT}\`\n`,
      }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_PROOF_DOCUMENT_DRIFT"),
  );
});

test("[options] rejects a build-time writer option instead of ignoring it", async () => {
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence({ artifactPath: "/tmp/ignored.json" }),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
});

test("[options] rejects a verify-time atomic hook instead of ignoring it", async () => {
  await assert.rejects(
    verifyPublisherInvalidSourceMatrixEvidence({
      beforeAtomicRename() {
        return undefined;
      },
    }),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
});

test("[options] rejects an outer accessor without invoking it", async () => {
  let reads = 0;
  const options = {};
  Object.defineProperty(options, "runtimeReceipt", {
    enumerable: true,
    get() {
      reads += 1;
      return runtimeReceipt;
    },
  });
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[options] rejects inherited option authority", async () => {
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(Object.create({ runtimeReceipt })),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
});

test("[options] rejects unknown and symbol option authority", async () => {
  for (const options of [{ unknown: true }, { [Symbol("authority")]: true }]) {
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(options),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
    );
  }
});

test("[options] rejects a transparent Proxy without invoking traps", async () => {
  let traps = 0;
  const options = new Proxy(
    { runtimeReceipt },
    {
      get() {
        traps += 1;
        throw new TypeError();
      },
      getPrototypeOf() {
        traps += 1;
        throw new TypeError();
      },
      ownKeys() {
        traps += 1;
        throw new TypeError();
      },
    },
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
  assert.equal(traps, 0);
});

test("[bytes] rejects an override-map accessor without invoking it", async () => {
  let reads = 0;
  const map = {};
  Object.defineProperty(map, PROOF_LIBRARY, {
    enumerable: true,
    get() {
      reads += 1;
      return Buffer.alloc(0);
    },
  });
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(fastOptions({ trackedFileBytes: map })),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[bytes] rejects non-byte override authority", async () => {
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(
      fastOptions({ trackedFileBytes: { [PROOF_LIBRARY]: "not bytes" } }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
});

test("[bytes] rejects a transparent Proxy byte without invoking traps", async () => {
  let traps = 0;
  const proxy = new Proxy(Buffer.from(await sourceBytes(PROOF_LIBRARY)), {
    get() {
      traps += 1;
      throw new TypeError();
    },
    getPrototypeOf() {
      traps += 1;
      throw new TypeError();
    },
    ownKeys() {
      traps += 1;
      throw new TypeError();
    },
  });
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(
      fastOptions({ trackedFileBytes: { [PROOF_LIBRARY]: proxy } }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
  assert.equal(traps, 0);
});

test("[bytes] controls a revoked Proxy prerequisite byte", async () => {
  const [{ path: prerequisitePath }] = PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_PINS;
  const revocable = Proxy.revocable(Buffer.from(await sourceBytes(prerequisitePath)), {});
  revocable.revoke();
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(
      fastOptions({ prerequisiteBytes: { [prerequisitePath]: revocable.proxy } }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
});

test("[bytes] rejects subclasses and custom prototypes", async () => {
  class ByteSubclass extends Uint8Array {}
  await assert.rejects(
    verifyPublisherInvalidSourceMatrixEvidence(
      fastOptions({
        artifactBytes: new ByteSubclass(baseline.artifactBytes),
        proofDocument: pinnedProof,
      }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
  const custom = new Uint8Array(await sourceBytes(PROOF_LIBRARY));
  Object.setPrototypeOf(custom, {});
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(
      fastOptions({ trackedFileBytes: { [PROOF_LIBRARY]: custom } }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
});

test("[bytes] rejects an extra byte accessor without invoking it", async () => {
  let reads = 0;
  const bytes = Buffer.from(await sourceBytes(PROOF_LIBRARY));
  Object.defineProperty(bytes, "extra", {
    enumerable: true,
    get() {
      reads += 1;
      return 1;
    },
  });
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(
      fastOptions({ trackedFileBytes: { [PROOF_LIBRARY]: bytes } }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[prerequisite] rejects drift in every exact M06-T03 through M06-T10 pin", async () => {
  for (const { path: prerequisitePath } of PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_PINS) {
    const bytes = Buffer.from(await sourceBytes(prerequisitePath));
    bytes[0] ^= 1;
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(
        fastOptions({ prerequisiteBytes: { [prerequisitePath]: bytes } }),
      ),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_DRIFT"),
      prerequisitePath,
    );
  }
});

test("[prerequisite] rejects frozen valid Source fixture drift", async () => {
  const bytes = Buffer.from(await sourceBytes(SOURCE));
  bytes[0] ^= 1;
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(
      fastOptions({ trackedFileBytes: { [SOURCE]: bytes } }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_DRIFT"),
  );
});

test("[prerequisite] rejects drift in every exact matrix example fixture", async () => {
  for (const pin of PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_PINS) {
    const bytes = Buffer.from(await sourceBytes(pin.path));
    bytes[0] ^= 1;
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(
        fastOptions({ trackedFileBytes: { [pin.path]: bytes } }),
      ),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_DRIFT"),
      pin.path,
    );
  }
});

test("[prerequisite] fatally rejects invalid UTF-8 in a tracked text", async () => {
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(
      fastOptions({ trackedFileBytes: { [PACKAGE_TEST]: Uint8Array.of(0xc3, 0x28) } }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_UTF8_INVALID"),
  );
});

test("[runtime] rejects a changed matrix case id", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.caseIds[0] = "forged";
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects a changed stopped stage", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.caseStages[0] = "bundle-revision";
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects a changed first diagnostic code", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.caseCodes[0] = "forged/CODE";
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects incomplete or reordered Publisher diagnostic registry authority", async () => {
  for (const field of [
    "publisherDiagnosticCodes",
    "publisherDiagnosticStages",
    "publisherDiagnosticSeverities",
  ]) {
    const receipt = structuredClone(runtimeReceipt);
    receipt[field].reverse();
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(fastOptions({ runtimeReceipt: receipt })),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
      field,
    );
  }
  const receipt = structuredClone(runtimeReceipt);
  receipt.publisherDiagnosticCodes.pop();
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects any false no-Bundle or diagnostic invariant", async () => {
  for (const key of [
    "diagnosticsNonEmptyAll",
    "exactFailureKeysAll",
    "firstDiagnosticErrorAll",
    "firstDiagnosticStageMatchesAll",
    "forbiddenAuthorityAbsentAll",
    "inputsUnchangedAll",
    "onlyErrorsAll",
    "privateSeamsAbsent",
    "publisherRegistryComplete",
    "publisherRegistryDeepFrozen",
    "publicLimitsDeepFrozen",
    "resultsDeepFrozenAll",
  ]) {
    const receipt = structuredClone(runtimeReceipt);
    receipt[key] = false;
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(fastOptions({ runtimeReceipt: receipt })),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
      key,
    );
  }
});

test("[runtime] rejects warning-suppression and positive-guard drift", async () => {
  for (const key of [
    "dynamicObligationSuccess",
    "laterFailureSuppressesWarnings",
    "sanitizedWarningSuccess",
  ]) {
    const receipt = structuredClone(runtimeReceipt);
    receipt[key] = false;
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(fastOptions({ runtimeReceipt: receipt })),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
      key,
    );
  }
});

test("[runtime] rejects duplicate or omitted matrix rows", async () => {
  for (const mutate of [
    (receipt) => receipt.caseIds.push(receipt.caseIds[0]),
    (receipt) => receipt.caseIds.pop(),
  ]) {
    const receipt = structuredClone(runtimeReceipt);
    mutate(receipt);
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(fastOptions({ runtimeReceipt: receipt })),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
    );
  }
});

test("[runtime] rejects a nested accessor without invoking it", async () => {
  let reads = 0;
  const ids = [...runtimeReceipt.caseIds];
  Object.defineProperty(ids, "0", {
    enumerable: true,
    get() {
      reads += 1;
      return runtimeReceipt.caseIds[0];
    },
  });
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(
      fastOptions({ runtimeReceipt: { ...runtimeReceipt, caseIds: ids } }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[runtime] rejects outer Proxy, custom prototype, and extra authority", async () => {
  for (const receipt of [
    new Proxy({ ...runtimeReceipt }, {}),
    Object.assign(Object.create({}), runtimeReceipt),
    { ...runtimeReceipt, bundle: {} },
  ]) {
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(fastOptions({ runtimeReceipt: receipt })),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
    );
  }
});

test("[runtime] rejects an outer accessor without invoking it", async () => {
  let reads = 0;
  const receipt = { ...runtimeReceipt };
  Object.defineProperty(receipt, "matrixCases", {
    enumerable: true,
    get() {
      reads += 1;
      return runtimeReceipt.matrixCases;
    },
  });
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[authority] detects tracked public package root drift", async () => {
  const relativePath = "packages/publisher/dist/index.js";
  const options = await trackedMutation(relativePath, (text) => `${text}\n// drift\n`);
  await assert.rejects(
    verifyPublisherInvalidSourceMatrixEvidence({
      ...options,
      artifactBytes: baseline.artifactBytes,
      proofDocument: pinnedProof,
    }),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT"),
  );
});

test("[authority] detects focused package-test byte drift", async () => {
  const options = await trackedMutation(PACKAGE_TEST, (text) => `${text}\n// drift\n`);
  await assert.rejects(
    verifyPublisherInvalidSourceMatrixEvidence({
      ...options,
      artifactBytes: baseline.artifactBytes,
      proofDocument: pinnedProof,
    }),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT"),
  );
});

test("[authority] pins the explicit isolated Vitest timeout", async () => {
  const options = await trackedMutation(PROOF_LIBRARY, (text) =>
    text.replace(
      "const RUNTIME_PROBE_TEST_TIMEOUT_MILLISECONDS = 20_000;",
      "const RUNTIME_PROBE_TEST_TIMEOUT_MILLISECONDS = 5_000;",
    ),
  );
  await assert.rejects(
    verifyPublisherInvalidSourceMatrixEvidence({
      ...options,
      artifactBytes: baseline.artifactBytes,
      proofDocument: pinnedProof,
    }),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT"),
  );
});

test("[authority] distinguishes semantic coordination drift from frozen surface drift", async () => {
  const currentT09ProofBytes = await sourceBytes(BUNDLE_PUBLICATION_PROOF_LIBRARY);
  const currentT09RootTestBytes = await sourceBytes(BUNDLE_PUBLICATION_ROOT_TEST);
  const currentT10ProofBytes = await sourceBytes("scripts/lib/publisher-official-golden-proof.mjs");
  const currentT10RootTestBytes = await sourceBytes("tests/publisher-official-golden.test.mjs");
  const approvedCurrentT09 = await buildPublisherInvalidSourceMatrixEvidence(
    fastOptions({
      trackedFileBytes: {
        [BUNDLE_PUBLICATION_PROOF_LIBRARY]: currentT09ProofBytes,
        [BUNDLE_PUBLICATION_ROOT_TEST]: currentT09RootTestBytes,
        "scripts/lib/publisher-official-golden-proof.mjs": currentT10ProofBytes,
        "tests/publisher-official-golden.test.mjs": currentT10RootTestBytes,
      },
    }),
  );
  assert.deepEqual(approvedCurrentT09.artifactBytes, baseline.artifactBytes);
  assert.equal(approvedCurrentT09.artifactSha256, baseline.artifactSha256);

  for (const { path: relativePath } of PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_SURFACES) {
    const options = await trackedMutation(relativePath, (text) => {
      if (relativePath === ROOT_PACKAGE) {
        return text.replace(
          "node scripts/verify-control-plane-bundle-store.mjs",
          "node scripts/verify-control-plane-bundle-store-unreviewed.mjs",
        );
      }
      if (relativePath === CI_SOURCE) {
        return text.replace('"prettier", ".", "--check"', '"prettier-unreviewed", ".", "--check"');
      }
      return relativePath.endsWith(".json") ? ` ${text}` : `${text}\n// T11 drift\n`;
    });
    await assert.rejects(
      verifyPublisherInvalidSourceMatrixEvidence({
        ...options,
        artifactBytes: baseline.artifactBytes,
        proofDocument: pinnedProof,
      }),
      expectCode(
        [
          ROOT_PACKAGE,
          CI_SOURCE,
          BUNDLE_PUBLICATION_PROOF_LIBRARY,
          BUNDLE_PUBLICATION_ROOT_TEST,
          "scripts/lib/publisher-official-golden-proof.mjs",
          "tests/publisher-official-golden.test.mjs",
        ].includes(relativePath)
          ? "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT"
          : "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT",
      ),
      relativePath,
    );
  }

  const unreviewedT09ProofBytes = Buffer.concat([
    currentT09ProofBytes,
    Buffer.from("\n// unreviewed T09 compatibility successor\n"),
  ]);
  const unreviewedT09ProofSha256 = createHash("sha256")
    .update(unreviewedT09ProofBytes)
    .digest("hex");
  const originalObjectFreeze = Object.freeze;
  const originalObjectEntries = Object.entries;
  const originalArrayFilter = Array.prototype.filter;
  try {
    Object.freeze = (value) => {
      if (value?.relativePath === BUNDLE_PUBLICATION_PROOF_LIBRARY && value?.overridden === true) {
        return originalObjectFreeze({
          relativePath: value.relativePath,
          bytes: currentT09ProofBytes,
          overridden: true,
        });
      }
      if (
        value?.bytes === unreviewedT09ProofBytes.byteLength &&
        value?.sha256 === unreviewedT09ProofSha256
      ) {
        return originalObjectFreeze({
          bytes: currentT09ProofBytes.byteLength,
          sha256: createHash("sha256").update(currentT09ProofBytes).digest("hex"),
        });
      }
      return originalObjectFreeze(value);
    };
    Object.entries = (value) => {
      const entries = originalObjectEntries(value);
      if (Object.isFrozen(value) && Object.hasOwn(value, BUNDLE_PUBLICATION_PROOF_LIBRARY)) {
        return [
          [
            BUNDLE_PUBLICATION_PROOF_LIBRARY,
            {
              bytes: unreviewedT09ProofBytes.byteLength,
              sha256: unreviewedT09ProofSha256,
            },
          ],
        ];
      }
      return entries;
    };
    Array.prototype.filter = function (predicate, thisArgument) {
      let isT09Inventory = false;
      let index = 0;
      while (index < this.length) {
        if (this[index]?.relativePath === BUNDLE_PUBLICATION_PROOF_LIBRARY) {
          isT09Inventory = true;
          break;
        }
        index += 1;
      }
      if (isT09Inventory) {
        return [
          {
            relativePath: BUNDLE_PUBLICATION_PROOF_LIBRARY,
            bytes: currentT09ProofBytes,
            overridden: true,
          },
        ];
      }
      return Reflect.apply(originalArrayFilter, this, [predicate, thisArgument]);
    };
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(
        fastOptions({
          trackedFileBytes: {
            [BUNDLE_PUBLICATION_PROOF_LIBRARY]: unreviewedT09ProofBytes,
          },
        }),
      ),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT"),
    );
  } finally {
    Object.freeze = originalObjectFreeze;
    Object.entries = originalObjectEntries;
    Array.prototype.filter = originalArrayFilter;
  }
});

test("[successor] rejects removal of the exact M07-T01 CI successor", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace('"control-plane-bundle-store"', '"control-plane-bundle-store-removed"'),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT"),
  );
});

test("[successor] rejects reordering the exact T11 to M07-T01 CI edge", async () => {
  const t11 = `    [
      "publisher-invalid-source-matrix",
      "scripts/verify-publisher-invalid-source-matrix.mjs",
      "tests/publisher-invalid-source-matrix.test.mjs",
    ],`;
  const m07 = `    [
      "control-plane-bundle-store",
      "scripts/verify-control-plane-bundle-store.mjs",
      "tests/control-plane-bundle-store.test.mjs",
    ],`;
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace(`${t11}\n${m07}`, `${m07}\n${t11}`),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT"),
  );
});

test("[successor] rejects drift in the exact M07-T01 CI tuple", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace(
      '"scripts/verify-control-plane-bundle-store.mjs"',
      '"scripts/verify-control-plane-bundle-store-unreviewed.mjs"',
    ),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT"),
  );
});

test("[successor] rejects exact M07-T01 root registration drift", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) =>
    text.replace(
      "node scripts/verify-control-plane-bundle-store.mjs",
      "node scripts/verify-control-plane-bundle-store-unreviewed.mjs",
    ),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT"),
  );
});

test("[successor] rejects removal of the aggregate M07-T01 successor", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) =>
    text.replace(
      "pnpm test:publisher-invalid-source-matrix && pnpm test:control-plane-bundle-store",
      "pnpm test:publisher-invalid-source-matrix",
    ),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT"),
  );
});

test("[successor] rejects a non-immediate aggregate T11 to M07-T01 edge", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) =>
    text.replace(
      "pnpm verify:publisher-invalid-source-matrix && pnpm verify:control-plane-bundle-store",
      "pnpm verify:publisher-invalid-source-matrix && pnpm lint && pnpm verify:control-plane-bundle-store",
    ),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT"),
  );
});

test("[successor] accepts an append-only M07 task without rewriting frozen T11 evidence", async () => {
  const source = await sourceText(CI_SOURCE);
  const rootPackage = await sourceText(ROOT_PACKAGE);
  const appendedRootPackage = appendValidRootSuccessor(rootPackage);
  const appended = appendValidCiSuccessor(source, appendedRootPackage);
  const result = await buildPublisherInvalidSourceMatrixEvidence(
    fastOptions({
      trackedFileBytes: {
        [CI_SOURCE]: Buffer.from(appended.ciSource, "utf8"),
        [ROOT_PACKAGE]: Buffer.from(appendedRootPackage, "utf8"),
      },
    }),
  );
  assert.deepEqual(result.artifactBytes, baseline.artifactBytes);
  assert.equal(result.artifactSha256, baseline.artifactSha256);
});

test("[successor] rejects a detached default gate with an empty execution plan", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace("    steps: createQualityGateSteps(),", "    steps: [],"),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT"),
  );
});

test("[successor] rejects verifier-command drift despite a caller receipt", async () => {
  const currentSteps = createQualityGateSteps();
  const ciReceipt = Object.freeze({
    planSha256: createHash("sha256")
      .update(
        JSON.stringify(
          currentSteps.map(({ id, command, args }) => ({
            id,
            command,
            args,
          })),
        ),
      )
      .digest("hex"),
    proofEntries: (currentSteps.length - 8) / 2,
    stepCount: currentSteps.length,
  });
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace(
      'commandStep(`verify-${id}`, `Proof verifier: ${id}`, "node", [verifierFile])',
      'commandStep(`verify-${id}`, `Proof verifier: ${id}`, "pnpm", [verifierFile])',
    ),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence({ ...options, ciReceipt }),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT"),
  );
});

test("[authority] rejects hostile task-applicability trace reassignment", async () => {
  const options = await trackedMutation(TRACEABILITY, (text) =>
    text.replace('"status": "JUSTIFIED_NA"', '"status": "ASSIGNED"'),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT"),
  );
});

test("[artifact] rejects hostile task-applicability claim mutation", async () => {
  const artifact = structuredClone(baseline.artifact);
  artifact.claims.taskApplicability.records[0].applicability.classification = "FORGED";
  await assert.rejects(
    verifyPublisherInvalidSourceMatrixEvidence(
      fastOptions({
        artifactBytes: Buffer.from(JSON.stringify(artifact), "utf8"),
        proofDocument: pinnedProof,
      }),
    ),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT"),
  );
});

test("[authority] rejects removal of an exact package-test case row", async () => {
  const firstId = matrixCases[0].id;
  const options = await trackedMutation(PACKAGE_TEST, (text) =>
    text.replace(firstId, "removed-case"),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT"),
  );
});

test("[authority] rejects removal of every final audit-closure vector", async () => {
  const closureCases = [
    ...baseline.artifact.claims.packageTests.finiteLimitClosure,
    ...baseline.artifact.claims.packageTests.publicBranchClosure,
  ];
  for (const { id } of closureCases) {
    const options = await trackedMutation(PACKAGE_TEST, (text) =>
      text.replace(`id: "${id}"`, `id: "removed-${id}"`),
    );
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(options),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT"),
      id,
    );
  }
});

test("[authority] rejects removal of every authenticated package assertion family", async () => {
  for (const { id, fragment } of PUBLISHER_INVALID_SOURCE_MATRIX_PACKAGE_ASSERTION_FAMILIES) {
    const options = await trackedMutation(PACKAGE_TEST, (text) =>
      text.replace(fragment, "/* removed T11 assertion */"),
    );
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(options),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT"),
      id,
    );
  }
});

test("[authority] rejects package-helper control-flow bypasses before runtime", async () => {
  for (const marker of [
    "function publishWithoutInputMutation(input: PublicationInput): PublishResult {",
    "): asserts result is PublishFailure {",
    "function expectSuccess(result: PublishResult, label: string): asserts result is PublishSuccess {",
  ]) {
    const options = await trackedMutation(PACKAGE_TEST, (text) =>
      text.replace(marker, `${marker}\n  if (true) return undefined;`),
    );
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(options),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT"),
      marker,
    );
  }
});

test("[authority] rejects missing, duplicate, private, or aliased runtime Publisher imports", async () => {
  const publicImportPath = 'from "../src/index.js";';
  for (const mutate of [
    (text) => text.replace(publicImportPath, 'from "../src/bundle-publication.js";'),
    (text) =>
      text.replace(
        'import { describe, expect, it } from "vitest";',
        `import { describe, expect, it } from "vitest";\nimport { publishDesenSource } ${publicImportPath}`,
      ),
    (text) => text.replace(publicImportPath, 'from "../dist/bundle-publication.js";'),
    (text) => text.replace(publicImportPath, 'from "@desen/publisher/private";'),
  ]) {
    const options = await trackedMutation(PACKAGE_TEST, mutate);
    await assert.rejects(
      buildPublisherInvalidSourceMatrixEvidence(options),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("[authority] rejects root hostile-category inventory removal", async () => {
  const options = await trackedMutation(ROOT_TEST, (text) =>
    text.replaceAll('test("[symlink]', 'void("[removed-symlink]'),
  );
  await assert.rejects(
    buildPublisherInvalidSourceMatrixEvidence(options),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT"),
  );
});

test("[writer] atomically writes exact deterministic evidence bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t11-writer-"));
  const artifactPath = path.join(directory, "artifact.json");
  try {
    const result = await writePublisherInvalidSourceMatrixEvidence({ artifactPath });
    assert.equal(result.artifactSha256, baseline.artifactSha256);
    assert.deepEqual(await readFile(artifactPath), baseline.artifactBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[writer] preserves an old destination and removes a tampered temporary", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t11-tamper-"));
  const artifactPath = path.join(directory, "artifact.json");
  const oldBytes = Buffer.from("old artifact\n");
  await writeFile(artifactPath, oldBytes);
  try {
    await assert.rejects(
      writePublisherInvalidSourceMatrixEvidence({
        artifactPath,
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "tampered\n");
        },
      }),
      TypeError,
    );
    assert.deepEqual(await readFile(artifactPath), oldBytes);
    assert.deepEqual(
      (await readdir(directory)).filter((entry) => entry.endsWith(".tmp")),
      [],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[writer] rejects semantic evidence overrides", async () => {
  await assert.rejects(
    writePublisherInvalidSourceMatrixEvidence({ runtimeReceipt }),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
});

test("[writer] rejects a non-function atomic hook", async () => {
  await assert.rejects(
    writePublisherInvalidSourceMatrixEvidence({ beforeAtomicRename: true }),
    expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID"),
  );
});

test("[symlink] rejects an atomic-writer destination symlink", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t11-writer-link-"));
  const target = path.join(directory, "target.json");
  const artifactPath = path.join(directory, "artifact.json");
  await writeFile(target, "target\n");
  await symlink(target, artifactPath);
  try {
    await assert.rejects(writePublisherInvalidSourceMatrixEvidence({ artifactPath }), TypeError);
    assert.equal(await readFile(target, "utf8"), "target\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[symlink] rejects a verifier artifact symlink", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t11-artifact-link-"));
  const target = path.join(directory, "target.json");
  const artifactPath = path.join(directory, "artifact.json");
  await writeFile(target, baseline.artifactBytes);
  await symlink(target, artifactPath);
  try {
    await assert.rejects(
      verifyPublisherInvalidSourceMatrixEvidence(
        fastOptions({ artifactPath, proofDocument: pinnedProof }),
      ),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[symlink] rejects a proof-document symlink", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t11-proof-link-"));
  const target = path.join(directory, "target.md");
  const proofDocumentPath = path.join(directory, "proof.md");
  await writeFile(target, pinnedProof);
  await symlink(target, proofDocumentPath);
  try {
    await assert.rejects(
      verifyPublisherInvalidSourceMatrixEvidence(
        fastOptions({ artifactBytes: baseline.artifactBytes, proofDocumentPath }),
      ),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_PROOF_DOCUMENT_DRIFT"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[symlink] fatally rejects invalid UTF-8 in a proof-document file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t11-proof-utf8-"));
  const proofDocumentPath = path.join(directory, "proof.md");
  await writeFile(proofDocumentPath, Uint8Array.of(0xc3, 0x28));
  try {
    await assert.rejects(
      verifyPublisherInvalidSourceMatrixEvidence(
        fastOptions({ artifactBytes: baseline.artifactBytes, proofDocumentPath }),
      ),
      expectCode("PUBLISHER_INVALID_SOURCE_MATRIX_PROOF_DOCUMENT_DRIFT"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
