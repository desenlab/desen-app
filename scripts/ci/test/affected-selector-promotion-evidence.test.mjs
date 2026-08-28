import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  copyFile,
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  AffectedSelectorPromotionEvidenceError,
  readAffectedSelectorPromotionEvidence,
  validateAffectedSelectorPromotionEvidence,
  validateAffectedSelectorPromotionLiveCheckpoint,
  verifyAffectedSelectorPromotionEvidence,
} from "../affected-selector-promotion-evidence.mjs";
import { SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS } from "../affected-workload-selector.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");
const EVIDENCE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/baselines/i07-04-affected-selector-promotion.json",
);
const EXEC_FILE = promisify(execFile);

async function promotionWorkspace() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-promotion-evidence-")));
  const checkpoint = JSON.parse(
    await readFile(path.join(WORKSPACE_ROOT, "scripts/ci/proof-reader-checkpoints.json"), "utf8"),
  );
  const checkpointHead = checkpoint.checkpoints.at(-1);
  for (const relativePath of new Set([
    "docs/proof/baselines/i07-04-affected-selector-promotion.json",
    "scripts/ci/proof-reader-checkpoints.json",
    ...SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS,
    ...checkpointHead.artifacts.map(({ path: artifactPath }) => artifactPath),
    ...checkpointHead.readers.map(({ path: readerPath }) => readerPath),
  ])) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(WORKSPACE_ROOT, relativePath), target);
  }
  return root;
}

test("one comparison snapshot owns both receipts and executable semantic checks", async () => {
  const root = await promotionWorkspace();
  const replacements = new Map();
  for (const relativePath of [
    ".github/workflows/ci.yml",
    "scripts/ci/affected-workload-ownership.mjs",
    "scripts/ci/affected-workload-selector.mjs",
    "scripts/ci/run-required-affected-quality-gate.mjs",
  ]) {
    const target = path.join(root, relativePath);
    const replacement = `${target}.replacement`;
    await writeFile(replacement, Buffer.from("invalid swapped authority bytes\n"));
    replacements.set(relativePath, replacement);
  }
  const swapped = [];
  const swap = async (relativePath) => {
    const target = path.join(root, relativePath);
    await rename(target, `${target}.captured`);
    await rename(replacements.get(relativePath), target);
    swapped.push(relativePath);
  };
  try {
    const receipt = await verifyAffectedSelectorPromotionEvidence({
      workspaceRoot: root,
      beforeComparisonSourceOpen: async ({ relativePath }) => {
        if (relativePath === ".node-version") {
          await swap(".github/workflows/ci.yml");
        }
        if (relativePath === "scripts/ci/exhaustive-gate-boundary.mjs") {
          await swap("scripts/ci/affected-workload-ownership.mjs");
          await swap("scripts/ci/affected-workload-selector.mjs");
        }
        if (relativePath === "scripts/ci/shared-state-authority.mjs") {
          await swap("scripts/ci/run-required-affected-quality-gate.mjs");
        }
      },
    });
    assert.equal(receipt.status, "PASS");
    assert.deepEqual(swapped, [
      ".github/workflows/ci.yml",
      "scripts/ci/affected-workload-ownership.mjs",
      "scripts/ci/affected-workload-selector.mjs",
      "scripts/ci/run-required-affected-quality-gate.mjs",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function evidence() {
  return JSON.parse(await readFile(EVIDENCE_PATH, "utf8"));
}

async function rejects(code, mutate) {
  const candidate = structuredClone(await evidence());
  mutate(candidate);
  assert.throws(
    () => validateAffectedSelectorPromotionEvidence(candidate),
    (error) => error instanceof AffectedSelectorPromotionEvidenceError && error.code === code,
  );
}

function completeHostedCutover(value) {
  value.cutover = {
    status: "HOSTED_CUTOVER_VERIFIED",
    cleanup: {
      commitSha: "1".repeat(40),
      pullRequestNumber: 36,
      pullRequestUrl: "https://github.com/desenlab/desen-app/pull/36",
      baseRevision: value.campaign.frozenBaseRevision,
      headRevision: "1".repeat(40),
      pullRequestMergeRevision: "2".repeat(40),
      mergedMainRevision: "3".repeat(40),
      runId: 400_000_000_001,
      runAttempt: 1,
      runUrl: "https://github.com/desenlab/desen-app/actions/runs/400000000001",
      jobId: 500_000_000_001,
      jobUrl: "https://github.com/desenlab/desen-app/actions/runs/400000000001/job/500000000001",
      receiptSha256: "6".repeat(64),
      receiptRevision: "2".repeat(40),
      authority: "REQUIRED",
      scope: "EXHAUSTIVE",
      status: "PASS",
    },
    main: {
      commitSha: "3".repeat(40),
      runId: 400_000_000_002,
      runAttempt: 1,
      runUrl: "https://github.com/desenlab/desen-app/actions/runs/400000000002",
      jobId: 500_000_000_002,
      jobUrl: "https://github.com/desenlab/desen-app/actions/runs/400000000002/job/500000000002",
      receiptSha256: "7".repeat(64),
      receiptRevision: "3".repeat(40),
      authority: "REQUIRED",
      scope: "EXHAUSTIVE",
      status: "PASS",
    },
    affectedCanary: {
      pullRequestNumber: 37,
      pullRequestUrl: "https://github.com/desenlab/desen-app/pull/37",
      baseRevision: "3".repeat(40),
      headRevision: "4".repeat(40),
      mergeRevision: "5".repeat(40),
      runId: 400_000_000_003,
      runAttempt: 1,
      runUrl: "https://github.com/desenlab/desen-app/actions/runs/400000000003",
      jobId: 500_000_000_003,
      jobUrl: "https://github.com/desenlab/desen-app/actions/runs/400000000003/job/500000000003",
      receiptSha256: "8".repeat(64),
      executionRevision: "5".repeat(40),
      changedPaths: [
        {
          path: "scripts/verify-protocol-types.mjs",
          status: "M",
          mode: "100644",
        },
      ],
      authority: "REQUIRED",
      requestedScope: "AFFECTED",
      effectiveScope: "AFFECTED",
      decisionCategory: "AFFECTED",
      reason: "ELIGIBLE_PROOF_UNIT_CLOSURE",
      status: "PASS",
      strictSubset: true,
      freshExecution: true,
      cachedSuccessRead: false,
      selectorSha256: value.promotedAuthorities.selectorSha256,
      ownershipSha256: value.promotedAuthorities.ownershipSha256,
      impactGraphSha256: value.promotedAuthorities.impactGraphSha256,
      thresholdSha256: value.promotedAuthorities.thresholdSha256,
      inventorySha256: value.promotedAuthorities.inventorySha256,
      planSha256: "9".repeat(64),
      changeSetSha256: "a".repeat(64),
      selectedWorkloadCount: 10,
      selectedProofUnitCount: 1,
      observedClosedCount: 10,
    },
    proofReaderCheckpoint: {
      profile: "desen.ci.proof-reader-checkpoints.v1",
      sequence: 28,
      headSha256: "2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546",
      frozenArtifactCount: 25,
      currentReaderCount: 50,
      liveVerification: "PASS",
    },
    infrastructureDebt: {
      profile: "desen.ci.infrastructure-debt.v1",
      entryIds: [
        "DEBT-I07-001",
        "DEBT-I07-002",
        "DEBT-I07-003",
        "DEBT-I07-004",
        "DEBT-I07-005",
        "DEBT-I07-006",
        "DEBT-I07-009",
        "DEBT-I07-010",
        "DEBT-I07-011",
        "DEBT-I07-012",
        "DEBT-I07-013",
        "DEBT-I07-014",
        "DEBT-I07-015",
        "DEBT-I07-016",
        "DEBT-I07-017",
        "DEBT-I07-018",
        "DEBT-I07-019",
      ],
      zeroReferences: "PASS",
      status: "CLOSED",
      openCount: 1,
      removedPendingHostedProofCount: 0,
      closedCount: 18,
      liveVerification: "PASS",
    },
  };
  return value.cutover;
}

function pendingHostedCutover(value) {
  value.cutover = {
    status: "PENDING_HOSTED_CUTOVER",
    cleanup: null,
    main: null,
    affectedCanary: null,
    proofReaderCheckpoint: structuredClone(value.cutover.proofReaderCheckpoint),
    infrastructureDebt: {
      ...structuredClone(value.cutover.infrastructureDebt),
      status: "REMOVED_PENDING_HOSTED_PROOF",
      removedPendingHostedProofCount: 17,
      closedCount: 1,
    },
  };
  return value.cutover;
}

async function rejectsCompletedCutover(mutate, code = "AFFECTED_PROMOTION_CUTOVER_DRIFT") {
  await rejects(code, (value) => mutate(completeHostedCutover(value), value));
}

test("authenticates the exact 20/20 hosted promotion campaign", async () => {
  const receipt = await verifyAffectedSelectorPromotionEvidence();
  assert.deepEqual(
    {
      status: receipt.status,
      observations: receipt.observations,
      falseNegatives: receipt.falseNegatives,
      promotionAuthorized: receipt.promotionAuthorized,
    },
    {
      status: "PASS",
      observations: 20,
      falseNegatives: 0,
      promotionAuthorized: true,
    },
  );
  assert.equal(receipt.cutoverStatus, "HOSTED_CUTOVER_VERIFIED");
  assert.equal(receipt.hostedCutoverVerified, true);
  assert.deepEqual(receipt.promotedAuthorities, {
    selectorSha256: "5301aedd0f4e7fe44bb07f67d6dd0dfaeea08cbc7ecd431ddf619345805656d0",
    ownershipSha256: "3561ac8305b7b34cfef0975abe5899aa54e637a4747ac0fa76bd39a129ce9f03",
    impactGraphSha256: "905d22e40524d26eac056ca32236f0948910a7ac6049b0d35c644f19e629d668",
    thresholdSha256: "ca6ee4128f2dbc581d033ebabe8e437268c8f7c5b29d6fbc7f9e3fb031b6c23c",
    inventorySha256: "67e537ed19f3518561909a342fa79e06d0f9adc49436aaf6c9816be1c840cb6f",
    selectionEquivalenceSha256: "97cc1b29553f1bf3d92386e399c76f2f9c21e73a1c8073a15a9465f7c4fcf698",
    runnerAuthoritySha256: "7b660497db1d82411a1e6c223d9225c5608ceb1cf25daddc9cc84de49661b559",
  });
});

test("rejects a stale or widened live proof-reader checkpoint receipt", () => {
  const liveReceipt = {
    status: "PASS",
    profile: "desen.ci.proof-reader-checkpoints.v1",
    headSha256: "f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f",
    checkpoints: 46,
    frozenArtifacts: 42,
    currentReaders: 84,
  };
  assert.equal(validateAffectedSelectorPromotionLiveCheckpoint(liveReceipt), liveReceipt);
  for (const [field, replacement] of [
    ["headSha256", "b71b67c31b299fa082aad8e1bee67e1c4f02b132c39b7f0a810c6c219f2c6806"],
    ["checkpoints", 43],
    ["frozenArtifacts", 39],
    ["currentReaders", 78],
    ["status", "FAIL"],
  ]) {
    assert.throws(
      () =>
        validateAffectedSelectorPromotionLiveCheckpoint({
          ...liveReceipt,
          [field]: replacement,
        }),
      (error) =>
        error instanceof AffectedSelectorPromotionEvidenceError &&
        error.code === "AFFECTED_PROMOTION_CUTOVER_DRIFT",
    );
  }
});

test("rejects missing, reordered, replayed, or retried comparisons", async () => {
  await rejects("AFFECTED_PROMOTION_EVIDENCE_INVALID", (value) => value.observations.pop());
  await rejects("AFFECTED_PROMOTION_SEQUENCE_DRIFT", (value) => value.observations.reverse());
  await rejects("AFFECTED_PROMOTION_REPLAY", (value) => {
    value.observations[1].runId = value.observations[0].runId;
    value.observations[1].comparisonId = value.observations[0].comparisonId;
    value.observations[1].runUrl = value.observations[0].runUrl;
  });
  await rejects("AFFECTED_PROMOTION_SEQUENCE_DRIFT", (value) => {
    value.observations[0].runAttempt = 2;
  });
});

test("rejects a coordinated rewrite of historical run, job, and receipt identities", async () => {
  await rejects("AFFECTED_PROMOTION_EVIDENCE_DRIFT", (value) => {
    const observation = value.observations[0];
    observation.runId = 999_999_999;
    observation.comparisonId = "github:999999999:attempt:1";
    observation.runUrl = "https://github.com/desenlab/desen-app/actions/runs/999999999";
    observation.quality.jobId = 888_888_881;
    observation.quality.jobUrl =
      "https://github.com/desenlab/desen-app/actions/runs/999999999/job/888888881";
    observation.quality.receiptSha256 = "a".repeat(64);
    observation.affected.jobId = 888_888_882;
    observation.affected.jobUrl =
      "https://github.com/desenlab/desen-app/actions/runs/999999999/job/888888882";
    observation.affected.receiptSha256 = "b".repeat(64);
  });
});

test("rejects provenance, chronology, repository URL, and revision drift", async () => {
  await rejects("AFFECTED_PROMOTION_EVIDENCE_DRIFT", (value) => {
    value.observations[0].baseRevision = "a".repeat(40);
  });
  await rejects("AFFECTED_PROMOTION_CHRONOLOGY_DRIFT", (value) => {
    value.observations[1].createdAt = "2026-08-12T15:00:00Z";
  });
  await rejects("AFFECTED_PROMOTION_EVIDENCE_DRIFT", (value) => {
    value.observations[0].runUrl = "https://example.invalid/run/1";
  });
  await rejects("AFFECTED_PROMOTION_EVIDENCE_DRIFT", (value) => {
    value.observations[0].quality.revision = "a".repeat(40);
  });
  await rejects("AFFECTED_PROMOTION_EVIDENCE_DRIFT", (value) => {
    value.observations[0].affected.executionRevision = "a".repeat(40);
  });
});

test("rejects incomplete exhaustive or affected executions", async () => {
  await rejects("AFFECTED_PROMOTION_REQUIRED_MISMATCH", (value) => {
    value.observations[0].quality.observedClosedCount = 149;
  });
  await rejects("AFFECTED_PROMOTION_REQUIRED_MISMATCH", (value) => {
    value.observations[0].quality.workspaceUnchanged = false;
  });
  await rejects("AFFECTED_PROMOTION_SUBSET_MISMATCH", (value) => {
    value.observations[0].affected.observedClosedCount = 9;
  });
  await rejects("AFFECTED_PROMOTION_SUBSET_MISMATCH", (value) => {
    value.observations[0].affected.cachedSuccessRead = true;
  });
  await rejects("AFFECTED_PROMOTION_SUBSET_MISMATCH", (value) => {
    value.observations[0].affected.strictSubset = false;
  });
});

test("rejects authority, threshold, topology, controller, or decision widening", async () => {
  await rejects("AFFECTED_PROMOTION_EVIDENCE_DRIFT", (value) => {
    value.observations[0].affected.selectorSha256 = "a".repeat(64);
  });
  await rejects("AFFECTED_PROMOTION_THRESHOLD_UNSATISFIED", (value) => {
    value.threshold.falseNegatives = 1;
  });
  await rejects("AFFECTED_PROMOTION_CAMPAIGN_DRIFT", (value) => {
    value.campaign.pullRequests[0] = 99;
  });
  await rejects("AFFECTED_PROMOTION_EVIDENCE_DRIFT", (value) => {
    value.controller.rawStateSha256 = "a".repeat(64);
  });
  await rejects("AFFECTED_PROMOTION_DECISION_DRIFT", (value) => {
    value.decision.main = "REQUIRED_AFFECTED";
  });
  await rejects("AFFECTED_PROMOTION_DECISION_DRIFT", (value) => {
    value.decision.legacyRollbackRetained = false;
  });
  await rejects("AFFECTED_PROMOTION_EVIDENCE_DRIFT", (value) => {
    value.promotedAuthorities.selectionEquivalenceSha256 = "a".repeat(64);
  });
  await rejects("AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT", (value) => {
    value.selectionSemanticsEquivalence.measuredSources[7].byteSha256 = "b".repeat(64);
  });
  await rejects("AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT", (value) => {
    value.selectionSemanticsEquivalence.promotedSources[8].byteLength += 1;
  });
  await rejects("AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT", (value) => {
    value.selectionSemanticsEquivalence.changedComparisonSourcePaths.reverse();
  });
  await rejects("AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT", (value) => {
    value.selectionSemanticsEquivalence.ownershipDelta.selectedProofOwnerDelta = 1;
  });
  await rejects("AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT", (value) => {
    value.selectionSemanticsEquivalence.ownershipDelta.addedPaths.reverse();
  });
  await rejects("AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT", (value) => {
    value.selectionSemanticsEquivalence.ownershipDelta.addedPathAuthorities[0].disposition =
      "SELECT_PROOF_UNIT";
  });
  await rejects("AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT", (value) => {
    value.selectionSemanticsEquivalence.inventoryGraph.workloadCount = 149;
  });
  await rejects("AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT", (value) => {
    value.selectionSemanticsEquivalence.equivalenceSha256 = "c".repeat(64);
  });
  await rejects("AFFECTED_PROMOTION_RUNNER_AUTHORITY_DRIFT", (value) => {
    value.runnerAuthority.workflowContract.shadowCommandAllowed = true;
  });
  await rejects("AFFECTED_PROMOTION_RUNNER_AUTHORITY_DRIFT", (value) => {
    value.runnerAuthority.sources[0].byteSha256 = "d".repeat(64);
  });
});

test("accepts only one complete hosted cutover with exhaustive cleanup/main and affected canary", async () => {
  const candidate = structuredClone(await evidence());
  completeHostedCutover(candidate);
  const receipt = validateAffectedSelectorPromotionEvidence(candidate);
  assert.equal(receipt.cutoverStatus, "HOSTED_CUTOVER_VERIFIED");
  assert.equal(receipt.hostedCutoverVerified, true);
});

test("retains the pending builder projection without accepting a partial hosted cutover", async () => {
  const candidate = structuredClone(await evidence());
  pendingHostedCutover(candidate);
  const receipt = validateAffectedSelectorPromotionEvidence(candidate);
  assert.equal(receipt.cutoverStatus, "PENDING_HOSTED_CUTOVER");
  assert.equal(receipt.hostedCutoverVerified, false);

  candidate.cutover.cleanup = completeHostedCutover(structuredClone(candidate)).cleanup;
  assert.throws(
    () => validateAffectedSelectorPromotionEvidence(candidate),
    (error) =>
      error instanceof AffectedSelectorPromotionEvidenceError &&
      error.code === "AFFECTED_PROMOTION_CUTOVER_DRIFT",
  );
});

test("rejects unknown fields and every pending/completed cutover hybrid", async () => {
  await rejects("AFFECTED_PROMOTION_EVIDENCE_INVALID", (value) => {
    value.unreviewed = true;
  });
  await rejects("AFFECTED_PROMOTION_EVIDENCE_INVALID", (value) => {
    value.observations[0].quality.unreviewed = true;
  });
  await rejects("AFFECTED_PROMOTION_CUTOVER_DRIFT", (value) => {
    value.cutover.status = "PENDING_HOSTED_CUTOVER";
  });
  await rejects("AFFECTED_PROMOTION_CUTOVER_DRIFT", (value) => {
    value.cutover.cleanup = completeHostedCutover(structuredClone(value)).cleanup;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup = null;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.main = null;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary = null;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.status = "DONE";
  });
});

test("rejects cleanup and main hosted identity, revision, receipt, and authority drift", async () => {
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.baseRevision = "0".repeat(40);
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.mergedMainRevision = cutover.cleanup.baseRevision;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.commitSha = "0".repeat(40);
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.pullRequestNumber = 35;
    cutover.cleanup.pullRequestUrl = "https://github.com/desenlab/desen-app/pull/35";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.pullRequestUrl = "https://github.com/desenlab/desen-app/pull/99";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.runAttempt = 2;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.jobUrl =
      "https://github.com/desenlab/desen-app/actions/runs/400000000001/job/999";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.receiptRevision = cutover.cleanup.headRevision;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.authority = "TEST";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.scope = "AFFECTED";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.status = "FAIL";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.main.commitSha = "0".repeat(40);
    cutover.main.receiptRevision = "0".repeat(40);
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.cleanup.mergedMainRevision = "0".repeat(40);
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.main.authority = "TEST";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.main.scope = "AFFECTED";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.main.status = "FAIL";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.main.runId = cutover.cleanup.runId;
    cutover.main.runUrl = cutover.cleanup.runUrl;
    cutover.main.jobUrl = `https://github.com/desenlab/desen-app/actions/runs/${cutover.main.runId}/job/${cutover.main.jobId}`;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.main.runId = cutover.cleanup.runId - 1;
    cutover.main.runUrl = `https://github.com/desenlab/desen-app/actions/runs/${cutover.main.runId}`;
    cutover.main.jobUrl = `https://github.com/desenlab/desen-app/actions/runs/${cutover.main.runId}/job/${cutover.main.jobId}`;
  });
});

test("rejects affected-canary boundary, singleton diff, authority, completeness, and digest drift", async () => {
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.baseRevision = cutover.cleanup.commitSha;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.executionRevision = cutover.affectedCanary.headRevision;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.pullRequestUrl = "https://github.com/desenlab/desen-app/pull/99";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.pullRequestNumber = cutover.cleanup.pullRequestNumber;
    cutover.affectedCanary.pullRequestUrl = cutover.cleanup.pullRequestUrl;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.changedPaths[0].path = "README.md";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.changedPaths[0].mode = "100755";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.changedPaths.push({
      path: "README.md",
      status: "M",
      mode: "100644",
    });
  }, "AFFECTED_PROMOTION_EVIDENCE_INVALID");
  for (const [field, replacement] of [
    ["authority", "TEST"],
    ["requestedScope", "EXHAUSTIVE"],
    ["effectiveScope", "EXHAUSTIVE"],
    ["decisionCategory", "AUTHORITY_DRIFT"],
    ["reason", "POLICY_PATH_CHANGED"],
    ["status", "FAIL"],
    ["strictSubset", false],
    ["freshExecution", false],
    ["cachedSuccessRead", true],
    ["selectedWorkloadCount", 9],
    ["selectedProofUnitCount", 2],
    ["observedClosedCount", 9],
  ]) {
    await rejectsCompletedCutover((cutover) => {
      cutover.affectedCanary[field] = replacement;
    });
  }
  for (const field of [
    "selectorSha256",
    "ownershipSha256",
    "impactGraphSha256",
    "thresholdSha256",
    "inventorySha256",
  ]) {
    await rejectsCompletedCutover((cutover) => {
      cutover.affectedCanary[field] = "f".repeat(64);
    });
  }
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.planSha256 = "invalid";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.changeSetSha256 = "invalid";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.runId = cutover.main.runId;
    cutover.affectedCanary.runUrl = cutover.main.runUrl;
    cutover.affectedCanary.jobUrl = `https://github.com/desenlab/desen-app/actions/runs/${cutover.affectedCanary.runId}/job/${cutover.affectedCanary.jobId}`;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.affectedCanary.runId = cutover.main.runId - 1;
    cutover.affectedCanary.runUrl = `https://github.com/desenlab/desen-app/actions/runs/${cutover.affectedCanary.runId}`;
    cutover.affectedCanary.jobUrl = `https://github.com/desenlab/desen-app/actions/runs/${cutover.affectedCanary.runId}/job/${cutover.affectedCanary.jobId}`;
  });
});

test("rejects checkpoint and exact 17-entry G07 closure-debt projection drift", async () => {
  await rejectsCompletedCutover((cutover) => {
    cutover.proofReaderCheckpoint.sequence = 26;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.proofReaderCheckpoint.headSha256 = "f".repeat(64);
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.proofReaderCheckpoint.currentReaderCount = 49;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.infrastructureDebt.entryIds.reverse();
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.infrastructureDebt.entryIds.pop();
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.infrastructureDebt.status = "REMOVED_PENDING_HOSTED_PROOF";
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.infrastructureDebt.removedPendingHostedProofCount = 17;
  });
  await rejectsCompletedCutover((cutover) => {
    cutover.infrastructureDebt.closedCount = 17;
  });
  await rejects("AFFECTED_PROMOTION_CUTOVER_DRIFT", (value) => {
    value.cutover.infrastructureDebt.status = "REMOVED_PENDING_HOSTED_PROOF";
  });
});

test("rejects symlink, hard-link, FIFO, and oversized evidence authorities", async () => {
  for (const kind of ["symlink", "hardlink", "fifo", "oversize"]) {
    const root = await promotionWorkspace();
    const evidencePath = path.join(
      root,
      "docs/proof/baselines/i07-04-affected-selector-promotion.json",
    );
    const sibling = `${evidencePath}.sibling`;
    try {
      await rm(evidencePath);
      if (kind === "symlink") {
        await copyFile(EVIDENCE_PATH, sibling);
        await symlink(sibling, evidencePath);
      } else if (kind === "hardlink") {
        await copyFile(EVIDENCE_PATH, sibling);
        await link(sibling, evidencePath);
      } else if (kind === "fifo") {
        await EXEC_FILE("mkfifo", [evidencePath]);
      } else {
        await writeFile(evidencePath, Buffer.alloc(512 * 1024 + 1, 0x20));
      }
      await assert.rejects(
        readAffectedSelectorPromotionEvidence(root),
        (error) =>
          error instanceof AffectedSelectorPromotionEvidenceError &&
          error.code === "AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("rejects symlink, hard-link, FIFO, and oversized selector authorities", async () => {
  for (const kind of ["symlink", "hardlink", "fifo", "oversize"]) {
    const root = await promotionWorkspace();
    const selectorPath = path.join(root, "scripts/ci/affected-workload-selector.mjs");
    const sibling = `${selectorPath}.reviewed`;
    try {
      await rm(selectorPath);
      if (kind === "symlink") {
        await copyFile(
          path.join(WORKSPACE_ROOT, "scripts/ci/affected-workload-selector.mjs"),
          sibling,
        );
        await symlink(sibling, selectorPath);
      } else if (kind === "hardlink") {
        await copyFile(
          path.join(WORKSPACE_ROOT, "scripts/ci/affected-workload-selector.mjs"),
          sibling,
        );
        await link(sibling, selectorPath);
      } else if (kind === "fifo") {
        await EXEC_FILE("mkfifo", [selectorPath]);
      } else {
        await writeFile(selectorPath, Buffer.alloc(512 * 1024 + 1, 0x20));
      }
      await assert.rejects(
        verifyAffectedSelectorPromotionEvidence({ workspaceRoot: root }),
        (error) =>
          error instanceof AffectedSelectorPromotionEvidenceError &&
          error.code === "AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("rejects evidence and selector identity swaps between lstat and open", async () => {
  for (const target of ["evidence", "selector"]) {
    const root = await promotionWorkspace();
    const targetPath =
      target === "evidence"
        ? path.join(root, "docs/proof/baselines/i07-04-affected-selector-promotion.json")
        : path.join(root, "scripts/ci/affected-workload-selector.mjs");
    const replacement = `${targetPath}.replacement`;
    const displaced = `${targetPath}.displaced`;
    await copyFile(targetPath, replacement);
    let swapped = false;
    const swap = async () => {
      if (swapped) return;
      swapped = true;
      await rename(targetPath, displaced);
      await rename(replacement, targetPath);
    };
    try {
      await assert.rejects(
        target === "evidence"
          ? readAffectedSelectorPromotionEvidence(root, undefined, swap)
          : verifyAffectedSelectorPromotionEvidence({
              workspaceRoot: root,
              beforeSelectorOpen: swap,
            }),
        (error) =>
          error instanceof AffectedSelectorPromotionEvidenceError &&
          error.code === "AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID",
      );
      assert.equal(swapped, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("rejects authority-parent rename to an outside symlink during a read", async () => {
  for (const target of ["evidence", "selector"]) {
    const root = await promotionWorkspace();
    const outside = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "desen-promotion-parent-outside-")),
    );
    const targetPath =
      target === "evidence"
        ? path.join(root, "docs/proof/baselines/i07-04-affected-selector-promotion.json")
        : path.join(root, "scripts/ci/affected-workload-selector.mjs");
    const parentPath = path.dirname(targetPath);
    const displacedParent = path.join(outside, "reviewed-parent");
    let swapped = false;
    const swap = async () => {
      if (swapped) return;
      swapped = true;
      await rename(parentPath, displacedParent);
      await symlink(displacedParent, parentPath, "dir");
    };
    try {
      await assert.rejects(
        target === "evidence"
          ? readAffectedSelectorPromotionEvidence(root, undefined, swap)
          : verifyAffectedSelectorPromotionEvidence({
              workspaceRoot: root,
              beforeSelectorOpen: swap,
            }),
        (error) =>
          error instanceof AffectedSelectorPromotionEvidenceError &&
          error.code === "AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID",
      );
      assert.equal(swapped, true);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  }
});

test("rejects workspace-root rename to an outside symlink during a read", async () => {
  for (const target of ["evidence", "selector"]) {
    const root = await promotionWorkspace();
    const displacedRoot = `${root}-reviewed`;
    let swapped = false;
    const swap = async () => {
      if (swapped) return;
      swapped = true;
      await rename(root, displacedRoot);
      await symlink(displacedRoot, root, "dir");
    };
    try {
      await assert.rejects(
        target === "evidence"
          ? readAffectedSelectorPromotionEvidence(root, undefined, swap)
          : verifyAffectedSelectorPromotionEvidence({
              workspaceRoot: root,
              beforeSelectorOpen: swap,
            }),
        (error) =>
          error instanceof AffectedSelectorPromotionEvidenceError &&
          error.code === "AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID",
      );
      assert.equal(swapped, true);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(displacedRoot, { recursive: true, force: true });
    }
  }
});
