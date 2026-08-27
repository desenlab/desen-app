import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  captureAffectedChangeBoundary,
  createAffectedChangeBoundaryTestSeams,
} from "../affected-change-boundary.mjs";
import {
  AffectedWorkloadSelectorError,
  EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256,
  SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS,
  calculateShadowAffectedComparisonAuthority,
  createShadowAffectedSelection,
  validateShadowAffectedSelection,
} from "../affected-workload-selector.mjs";
import { createRequiredExhaustivePlan } from "../run-required-exhaustive-quality-gate.mjs";

const REVISION = "a".repeat(40);
const BASE = "b".repeat(40);
const HEAD = "c".repeat(40);
const MERGE_BASE = "d".repeat(40);
const OID_BEFORE = "e".repeat(40);
const OID_AFTER = "f".repeat(40);
const TRACKED_OBJECT = "1".repeat(40);
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");
const EXPECTED_COMPARISON_AUTHORITY_PATHS = Object.freeze([
  ".github/workflows/ci.yml",
  ".node-version",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "dependency-cruiser.config.cjs",
  "scripts/ci/affected-change-boundary.mjs",
  "scripts/ci/affected-selector-promotion-evidence.mjs",
  "scripts/ci/affected-impact-graph.mjs",
  "scripts/ci/affected-observation-threshold.json",
  "scripts/ci/affected-observation-threshold.mjs",
  "scripts/ci/affected-workload-ownership.mjs",
  "scripts/ci/affected-workload-selector.mjs",
  "scripts/ci/exhaustive-gate-boundary.mjs",
  "scripts/ci/exhaustive-workload-inventory.mjs",
  "scripts/ci/no-proof-listener.cjs",
  "scripts/ci/proof-filesystem-compatibility.cjs",
  "scripts/ci/run-required-exhaustive-quality-gate.mjs",
  "scripts/ci/run-required-affected-quality-gate.mjs",
  "scripts/ci/shared-state-authority.mjs",
]);
const DESEN_APP_CONNECTED_PROOF_UNITS = Object.freeze([
  "protocol-structural-validation",
  "catalog-manifest-registration",
  "web-react-package-digest",
  "reference-catalog-web-components",
  "reference-catalog-web-form-feedback",
  "reference-tokens-and-synthetic-fixtures",
  "reference-sign-in-fixtures-and-host-binding",
  "reference-catalog-web-parity",
  "reference-catalog-web-capability-artifact",
  "runtime-core-host-ports",
  "runtime-core-value-resolution",
  "runtime-core-token-format-resolution",
  "runtime-core-predicate-evaluation",
  "runtime-core-variant-style-evaluation",
  "runtime-core-headless-sign-in",
  "runtime-core-audit-hardening",
  "reference-host-web-shell",
  "reference-host-web-sign-in",
  "reference-host-web-source-audit",
  "publisher-capability-preflight",
  "publisher-execution-preflight",
  "publisher-source-preservation",
  "publisher-source-normalization",
  "publisher-catalog-pinning",
  "publisher-bundle-publication",
  "publisher-official-golden",
  "publisher-invalid-source-matrix",
  "control-plane-bundle-store",
  "control-plane-bundle-verification",
  "control-plane-package-preflight",
  "control-plane-reference-preflight",
  "control-plane-local-api",
  "control-plane-runtime-staging",
  "control-plane-runtime-activation",
  "control-plane-runtime-recovery",
  "control-plane-runtime-fault-injection",
  "control-plane-runtime-transition-races",
  "reference-host-web-channel-consumption",
  "editor-core-source-document",
  "editor-core-stable-id-insert",
  "editor-core-structural-edits",
  "editor-core-content-edits",
  "editor-core-state-binding-edits",
  "editor-core-event-action-edits",
  "editor-core-authoring-round-trip",
  "editor-core-persistence",
  "editor-core-continuous-validation",
  "editor-core-terminal-integration",
  "desen-app-shell-navigation",
  "desen-app-catalog-panel-layer-tree",
  "desen-app-real-adapter-canvas",
  "desen-app-selection-overlay",
]);

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function result(stdout = "", status = 0, stderr = "") {
  return {
    status,
    stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout),
    stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr),
  };
}

function currentPaths() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
    .subarray(0, -1)
    .toString("utf8")
    .split("\0")
    .sort();
}

function independentlyCaptureComparisonAuthority() {
  return EXPECTED_COMPARISON_AUTHORITY_PATHS.map((relativePath) => {
    const absolutePath = path.join(WORKSPACE_ROOT, ...relativePath.split("/"));
    const stats = lstatSync(absolutePath, { bigint: true });
    assert.equal(stats.isFile(), true, `${relativePath} must remain a regular file`);
    assert.equal(stats.isSymbolicLink(), false, `${relativePath} must not be a symbolic link`);
    const bytes = readFileSync(absolutePath);
    return {
      path: relativePath,
      mode: (stats.mode & 0o111n) === 0n ? "100644" : "100755",
      byteLength: bytes.byteLength,
      byteSha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
}

function independentlyDigestComparisonAuthority(sources) {
  return sha256({
    schemaVersion: 1,
    profile: "desen.ci.shadow-affected-comparison-authority.v1",
    sources,
  });
}

function trackedTree(paths) {
  return Buffer.concat(
    paths.map((relativePath) => Buffer.from(`100644 blob ${TRACKED_OBJECT}\t${relativePath}\0`)),
  );
}

function rawChanges(changedPaths, status = "M") {
  return Buffer.concat(
    changedPaths.map((relativePath) =>
      Buffer.from(`:100644 100644 ${OID_BEFORE} ${OID_AFTER} ${status}\0${relativePath}\0`),
    ),
  );
}

async function affectedBoundary(
  paths,
  changedPaths,
  { sameRepository = true, shallow = "false\n", status = "M", diff } = {},
) {
  const runGit = async (_workspaceRoot, args) => {
    if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") {
      return result(shallow);
    }
    if (args[0] === "cat-file") return result("commit\n");
    if (args[0] === "rev-parse" && args[1] === "--verify") {
      return result(`${REVISION}\n`);
    }
    if (args[0] === "rev-list") return result(`${REVISION} ${BASE} ${HEAD}\n`);
    if (args[0] === "merge-base" && args[1] === "--is-ancestor") return result();
    if (args[0] === "merge-base" && args[1] === "--all") {
      return result(`${MERGE_BASE}\n`);
    }
    if (args[0] === "status") return result();
    if (args[0] === "ls-tree") return result(trackedTree(paths));
    if (args[0] === "diff-tree") {
      return result(diff ?? rawChanges(changedPaths, status));
    }
    throw new Error(`Unexpected Git command: ${args.join(" ")}`);
  };
  return await captureAffectedChangeBoundary({
    workspaceRoot: WORKSPACE_ROOT,
    baseRevision: BASE,
    headRevision: HEAD,
    executionRevision: REVISION,
    sameRepository,
    testSeams: createAffectedChangeBoundaryTestSeams(runGit),
  });
}

async function fallbackBoundary(reason) {
  const paths = currentPaths();
  if (reason === "UNTRUSTED_REPOSITORY") {
    return await affectedBoundary(paths, ["package.json"], { sameRepository: false });
  }
  if (reason === "REPOSITORY_SHALLOW") {
    return await affectedBoundary(paths, ["package.json"], { shallow: "true\n" });
  }
  if (reason === "UNSUPPORTED_CHANGE_KIND") {
    return await affectedBoundary(paths, ["package.json"], { status: "A" });
  }
  if (reason === "DIFF_MALFORMED") {
    return await affectedBoundary(paths, ["package.json"], {
      diff: Buffer.from("not-a-raw-diff\0package.json\0"),
    });
  }
  throw new Error(`Unsupported fallback test reason: ${reason}`);
}

test("comparison continuity seals the exact ordered code-owned source authority", () => {
  assert.deepEqual(SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS, EXPECTED_COMPARISON_AUTHORITY_PATHS);
  assert.equal(Object.isFrozen(SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS), true);

  const sources = independentlyCaptureComparisonAuthority();
  const independentlyCalculated = independentlyDigestComparisonAuthority(sources);
  assert.equal(EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256, independentlyCalculated);
  assert.equal(
    calculateShadowAffectedComparisonAuthority(sources),
    EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256,
  );

  for (const [index, source] of sources.entries()) {
    for (const mutation of [
      { byteSha256: source.byteSha256 === "0".repeat(64) ? "1".repeat(64) : "0".repeat(64) },
      { byteLength: source.byteLength + 1 },
      { mode: source.mode === "100644" ? "100755" : "100644" },
    ]) {
      const mutatedSources = structuredClone(sources);
      Object.assign(mutatedSources[index], mutation);
      assert.notEqual(
        calculateShadowAffectedComparisonAuthority(mutatedSources),
        EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256,
        `${source.path} receipt mutation must break comparison continuity`,
      );
    }
  }

  const pathMutation = structuredClone(sources);
  pathMutation[0].path = "substituted/authority.yml";
  assert.throws(
    () => calculateShadowAffectedComparisonAuthority(pathMutation),
    /must be ".github\/workflows\/ci.yml"/u,
  );
  assert.throws(
    () => calculateShadowAffectedComparisonAuthority(sources.slice(1)),
    /source count drifted/u,
  );
});

test("an exact proof-unit modification yields a strict shadow subset", async () => {
  const plan = createShadowAffectedSelection(
    await affectedBoundary(currentPaths(), ["scripts/verify-protocol-canonicalization.mjs"]),
  );
  assert.equal(plan.status, "PLANNED");
  assert.equal(plan.authority, "SHADOW");
  assert.equal(plan.effectiveScope, "AFFECTED");
  assert.equal(plan.decisionCategory, "AFFECTED");
  assert.equal(plan.selectorSha256, EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256);
  assert.equal(plan.strictSubset, true);
  assert.deepEqual(plan.ownerProofUnitIds, ["protocol-canonicalization"]);
  assert.deepEqual(plan.affectedProofUnitIds, ["protocol-canonicalization"]);
  assert.equal(plan.workloadCount, 11);
  assert.equal(validateShadowAffectedSelection(plan), plan);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.nodeIds), true);
});

test("continuous validation selects the exact T03-T07-connected successor closure", async () => {
  const plan = createShadowAffectedSelection(
    await affectedBoundary(currentPaths(), [
      "scripts/verify-editor-core-continuous-validation.mjs",
    ]),
  );
  assert.equal(plan.effectiveScope, "AFFECTED");
  assert.deepEqual(plan.ownerProofUnitIds, ["editor-core-continuous-validation"]);
  assert.deepEqual(plan.affectedProofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(plan.workloadCount, 114);
  assert.equal(plan.nodeIds.includes("editor-web-public-package-contract"), true);
  assert.equal(plan.nodeIds.includes("verify-editor-core-continuous-validation"), true);
  assert.equal(plan.nodeIds.includes("test-editor-core-continuous-validation"), true);
  assert.equal(plan.nodeIds.includes("verify-editor-core-terminal-integration"), true);
});

test("terminal integration selects every formal editor parent and frozen P-18 runtime proof", async () => {
  const plan = createShadowAffectedSelection(
    await affectedBoundary(currentPaths(), ["scripts/verify-editor-core-terminal-integration.mjs"]),
  );
  assert.equal(plan.effectiveScope, "AFFECTED");
  assert.deepEqual(plan.ownerProofUnitIds, ["editor-core-terminal-integration"]);
  assert.deepEqual(plan.affectedProofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(plan.workloadCount, 114);
  assert.equal(plan.nodeIds.includes("editor-web-public-package-contract"), true);
});

test("catalog panel selects the exact shell and Catalog-connected successor closure", async () => {
  const plan = createShadowAffectedSelection(
    await affectedBoundary(currentPaths(), [
      "scripts/verify-desen-app-catalog-panel-layer-tree.mjs",
    ]),
  );
  assert.equal(plan.effectiveScope, "AFFECTED");
  assert.deepEqual(plan.ownerProofUnitIds, ["desen-app-catalog-panel-layer-tree"]);
  assert.deepEqual(plan.affectedProofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(plan.workloadCount, 114);
  assert.equal(plan.nodeIds.includes("verify-desen-app-catalog-panel-layer-tree"), true);
  assert.equal(plan.nodeIds.includes("test-desen-app-catalog-panel-layer-tree"), true);
});

test("adapter canvas selects the exact shell and source-audit-connected successor closure", async () => {
  const plan = createShadowAffectedSelection(
    await affectedBoundary(currentPaths(), ["scripts/verify-desen-app-real-adapter-canvas.mjs"]),
  );
  assert.equal(plan.effectiveScope, "AFFECTED");
  assert.deepEqual(plan.ownerProofUnitIds, ["desen-app-real-adapter-canvas"]);
  assert.deepEqual(plan.affectedProofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(plan.proofUnitCount, 52);
  assert.equal(plan.workloadCount, 114);
  assert.equal(plan.nodeIds.includes("verify-reference-host-web-source-audit"), true);
  assert.equal(plan.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(plan.nodeIds.includes("verify-desen-app-real-adapter-canvas"), true);
  assert.equal(plan.nodeIds.includes("test-desen-app-real-adapter-canvas"), true);
  assert.equal(plan.nodeIds.includes("verify-desen-app-selection-overlay"), true);
  assert.equal(plan.nodeIds.includes("test-desen-app-selection-overlay"), true);
});

test("selection overlay selects the exact adapter-canvas-connected closure", async () => {
  const plan = createShadowAffectedSelection(
    await affectedBoundary(currentPaths(), ["scripts/verify-desen-app-selection-overlay.mjs"]),
  );
  assert.equal(plan.effectiveScope, "AFFECTED");
  assert.deepEqual(plan.ownerProofUnitIds, ["desen-app-selection-overlay"]);
  assert.deepEqual(plan.affectedProofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(plan.proofUnitCount, 52);
  assert.equal(plan.workloadCount, 114);
  assert.equal(plan.nodeIds.includes("verify-desen-app-real-adapter-canvas"), true);
  assert.equal(plan.nodeIds.includes("test-desen-app-real-adapter-canvas"), true);
  assert.equal(plan.nodeIds.includes("verify-desen-app-selection-overlay"), true);
  assert.equal(plan.nodeIds.includes("test-desen-app-selection-overlay"), true);
});

test("multiple proof owners form one canonical union independent of diff order", async () => {
  const paths = currentPaths();
  const first = createShadowAffectedSelection(
    await affectedBoundary(paths, [
      "tests/protocol-types.test.mjs",
      "scripts/verify-protocol-canonicalization.mjs",
    ]),
  );
  const second = createShadowAffectedSelection(
    await affectedBoundary(paths, [
      "scripts/verify-protocol-canonicalization.mjs",
      "tests/protocol-types.test.mjs",
    ]),
  );
  assert.deepEqual(first.ownerProofUnitIds, ["protocol-types", "protocol-canonicalization"]);
  assert.deepEqual(first.nodeIds, second.nodeIds);
  assert.equal(first.planSha256, second.planSha256);
});

test("policy, package, documentation, and shared inputs always expand to exhaustive", async () => {
  const paths = currentPaths();
  for (const changedPath of [
    "package.json",
    "packages/validator/src/index.ts",
    "README.md",
    "scripts/lib/protocol-canonicalization-proof.mjs",
  ]) {
    const plan = createShadowAffectedSelection(await affectedBoundary(paths, [changedPath]));
    assert.equal(plan.effectiveScope, "EXHAUSTIVE");
    assert.equal(plan.decisionCategory, "POLICY_DRIFT");
    assert.equal(plan.strictSubset, false);
    assert.equal(plan.workloadCount, 180);
  }
});

test("unknown paths and ownership authority drift cannot produce a partial plan", async () => {
  const paths = currentPaths();
  const unknown = createShadowAffectedSelection(
    await affectedBoundary(paths, ["unreviewed/new-proof-input.mjs"]),
  );
  assert.equal(unknown.effectiveScope, "EXHAUSTIVE");
  assert.equal(unknown.decisionCategory, "UNKNOWN_PATH");

  const driftedPaths = [...paths, "unreviewed/new-proof-input.mjs"].sort();
  const authorityDrift = createShadowAffectedSelection(
    await affectedBoundary(driftedPaths, ["scripts/verify-protocol-types.mjs"]),
  );
  assert.equal(authorityDrift.effectiveScope, "EXHAUSTIVE");
  assert.equal(authorityDrift.decisionCategory, "AUTHORITY_DRIFT");
});

test("all boundary uncertainty classes expand to exhaustive without partial paths", async () => {
  for (const [reason, category] of [
    ["UNTRUSTED_REPOSITORY", "UNTRUSTED_BASE"],
    ["REPOSITORY_SHALLOW", "UNTRUSTED_BASE"],
    ["UNSUPPORTED_CHANGE_KIND", "UNSUPPORTED_CHANGE"],
    ["DIFF_MALFORMED", "INVALID_DIFF"],
  ]) {
    const boundary = await fallbackBoundary(reason);
    assert.equal(boundary.reason, reason);
    const plan = createShadowAffectedSelection(boundary);
    assert.equal(plan.effectiveScope, "EXHAUSTIVE");
    assert.equal(plan.decisionCategory, category);
    assert.deepEqual(plan.changedPaths, []);
    assert.equal(plan.workloadCount, 180);
  }
});

test("fabricated, cloned, proxied, mutated, and self-digested receipts fail safe", async () => {
  const paths = currentPaths();
  const base = await affectedBoundary(paths, ["scripts/verify-protocol-canonicalization.mjs"]);
  const clone = structuredClone(base);
  const forged = structuredClone(base);
  forged.changes[0].beforeObjectId = "2".repeat(40);
  forged.changeSetSha256 = sha256({
    profile: forged.profile,
    baseRevision: forged.baseRevision,
    headRevision: forged.headRevision,
    executionRevision: forged.executionRevision,
    mergeBaseRevision: forged.mergeBaseRevision,
    trackedPathSetSha256: forged.trackedPathSetSha256,
    changes: forged.changes,
  });
  let proxyReads = 0;
  const proxy = new Proxy(base, {
    get() {
      proxyReads += 1;
      throw new Error("untrusted boundary data must not be read");
    },
  });
  const candidates = [
    clone,
    forged,
    { ...base, changeSetSha256: "0".repeat(64) },
    proxy,
    { ...base, trackedPaths: Array(paths.length) },
  ];
  const accessor = { ...base };
  Object.defineProperty(accessor, "changes", {
    enumerable: true,
    get: () => base.changes,
  });
  candidates.push(accessor);

  assert.throws(() => {
    base.reason = "CALLER_MUTATION";
  }, TypeError);
  for (const candidate of candidates) {
    const plan = createShadowAffectedSelection(candidate);
    assert.equal(plan.effectiveScope, "EXHAUSTIVE");
    assert.equal(plan.decisionCategory, "INVALID_DIFF");
    assert.equal(plan.reason, "AFFECTED_SELECTOR_BOUNDARY_UNTRUSTED");
  }
  assert.equal(proxyReads, 0);

  const authenticPlan = createShadowAffectedSelection(base);
  assert.equal(authenticPlan.effectiveScope, "AFFECTED");
});

test("a fabricated or cloned plan has no shadow execution authority", async () => {
  const plan = createShadowAffectedSelection(
    await affectedBoundary(currentPaths(), ["scripts/verify-protocol-types.mjs"]),
  );
  assert.throws(
    () => validateShadowAffectedSelection(structuredClone(plan)),
    AffectedWorkloadSelectorError,
  );
  assert.throws(
    () => validateShadowAffectedSelection({ ...plan, status: "PASS" }),
    AffectedWorkloadSelectorError,
  );
});

test("the required runner still rejects AFFECTED scope", () => {
  assert.throws(
    () => createRequiredExhaustivePlan({ scope: "AFFECTED" }),
    /accepts only EXHAUSTIVE/u,
  );
});
