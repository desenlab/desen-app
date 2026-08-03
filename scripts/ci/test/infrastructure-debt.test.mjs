import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  INFRASTRUCTURE_DEBT_AUTHORITY,
  InfrastructureDebtError,
  canonicalizeInfrastructureDebtManifest,
  parseInfrastructureDebtManifest,
  validateInfrastructureDebtManifest,
  verifyInfrastructureDebt,
} from "../infrastructure-debt.mjs";

const EXEC_FILE = promisify(execFileCallback);
const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");
const MANIFEST_PATH = path.join(REPOSITORY_ROOT, "scripts/ci/infrastructure-debt.json");
const CANONICAL_MANIFEST_BYTES = await readFile(MANIFEST_PATH);
const BASE_MANIFEST = JSON.parse(CANONICAL_MANIFEST_BYTES.toString("utf8"));
const CANONICAL_EVIDENCE_BYTES = new Map(
  await Promise.all(
    BASE_MANIFEST.entries
      .filter((entry) => entry.evidence !== null)
      .map(async (entry) => [
        entry.evidence.evidencePath,
        await readFile(path.join(REPOSITORY_ROOT, ...entry.evidence.evidencePath.split("/"))),
      ]),
  ),
);

function cloneManifest() {
  return structuredClone(BASE_MANIFEST);
}

function expectCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof InfrastructureDebtError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

function debtRegister(manifest) {
  const lines = [
    "# Infrastructure Debt and Cleanup Register",
    "",
    "## Open-entry summary",
    "",
    "| ID | Status | Temporary structure | Registered by | Removal owner | Must close by |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const entry of manifest.entries) {
    lines.push(
      `| ${entry.id} | ${entry.status} | fixture | ${entry.registeredBy} | ${entry.removalOwner} | ${entry.deadline} |`,
    );
  }
  for (const entry of manifest.entries) {
    lines.push(
      "",
      `## ${entry.id} — Fixture`,
      "",
      `- Status: \`${entry.status}\``,
      `- Registered by infrastructure task: \`${entry.registeredBy}\``,
      `- Removal owner: \`${entry.removalOwner}\``,
      `- Must close by gate: \`${entry.deadline}\``,
      "- Exact paths and symbols:",
    );
    for (const target of entry.targets) {
      lines.push(`  - \`${target.path}\``);
      for (const symbol of target.symbols) lines.push(`    - \`${symbol}\``);
    }
    lines.push(`- Closure evidence: \`${entry.evidence?.kind ?? "PENDING"}\``);
  }
  lines.push("");
  return lines.join("\n");
}

function taskBoard(overrides = {}) {
  const statuses = {
    "I07-01": "IN_PROGRESS",
    "I07-02": "DONE",
    "I07-04": "NOT_STARTED",
    "I07-05": "NOT_STARTED",
    G07: "NOT_STARTED",
    G12: "NOT_STARTED",
    ...overrides,
  };
  const lines = [
    "# Implementation Task Board",
    "",
    "| ID | Status | Depends on | Deliverable | Evidence |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const [id, status] of Object.entries(statuses)) {
    lines.push(`| ${id} | ${status} | — | fixture | fixture |`);
  }
  lines.push("");
  return lines.join("\n");
}

async function writeRelative(root, relativePath, contents) {
  const absolutePath = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}

function activeTargetSymbolsByPath(manifest) {
  const byPath = new Map();
  for (const [entryIndex, entry] of INFRASTRUCTURE_DEBT_AUTHORITY.entries()) {
    if (manifest.entries[entryIndex].status === "CLOSED") continue;
    for (const target of entry.targets) {
      const symbols = byPath.get(target.path) ?? new Set();
      for (const symbol of target.symbols) symbols.add(symbol);
      byPath.set(target.path, symbols);
    }
  }
  return byPath;
}

async function createFixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "desen-infrastructure-debt-")));
  const manifest = cloneManifest();
  await writeRelative(
    root,
    "scripts/ci/infrastructure-debt.json",
    canonicalizeInfrastructureDebtManifest(manifest),
  );
  await writeRelative(root, "docs/plan/DEBT-REGISTER.md", debtRegister(manifest));
  await writeRelative(root, "docs/plan/TASKS.md", taskBoard());
  for (const [evidencePath, evidenceBytes] of CANONICAL_EVIDENCE_BYTES) {
    await writeRelative(root, evidencePath, evidenceBytes);
  }
  for (const [relativePath, symbols] of activeTargetSymbolsByPath(manifest)) {
    await writeRelative(root, relativePath, `${[...symbols].join("\n")}\n`);
  }
  await EXEC_FILE("git", ["init", "--quiet"], { cwd: root });
  await EXEC_FILE("git", ["add", "--all"], { cwd: root });
  return {
    root,
    manifest,
    async rewriteManifestAndRegister() {
      await writeRelative(
        root,
        "scripts/ci/infrastructure-debt.json",
        canonicalizeInfrastructureDebtManifest(manifest),
      );
      await writeRelative(root, "docs/plan/DEBT-REGISTER.md", debtRegister(manifest));
    },
    async recordEvidence(entryIndex, kind) {
      const evidencePath = `docs/proof/${manifest.entries[entryIndex].id.toLowerCase()}.json`;
      const evidenceBytes = Buffer.from(`{"entry":"${manifest.entries[entryIndex].id}"}\n`);
      await writeRelative(root, evidencePath, evidenceBytes);
      await EXEC_FILE("git", ["add", "--", evidencePath], { cwd: root });
      manifest.entries[entryIndex].evidence = {
        kind,
        commitSha: "a".repeat(40),
        pullRequestUrl: "https://github.com/desenlab/desen-app/pull/123",
        evidencePath,
        evidenceSha256: createHash("sha256").update(evidenceBytes).digest("hex"),
        hostedRunUrl: "https://github.com/desenlab/desen-app/actions/runs/456",
      };
    },
    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("accepts the exact canonical code-owned debt inventory", () => {
  const manifest = parseInfrastructureDebtManifest(CANONICAL_MANIFEST_BYTES);
  assert.equal(
    manifest.entries
      .filter((entry) => entry.status === "OPEN")
      .every((entry) => entry.evidence === null),
    true,
  );
  assert.deepEqual(
    manifest.entries.map(({ id, status }) => ({ id, status })),
    [
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `DEBT-I07-00${index + 1}`,
        status: "OPEN",
      })),
      { id: "DEBT-I07-008", status: "CLOSED" },
      { id: "DEBT-I07-009", status: "OPEN" },
    ],
  );
  assert.deepEqual(
    {
      kind: manifest.entries[7].evidence.kind,
      commitSha: manifest.entries[7].evidence.commitSha,
      pullRequestUrl: manifest.entries[7].evidence.pullRequestUrl,
      evidencePath: manifest.entries[7].evidence.evidencePath,
      hostedRunUrl: manifest.entries[7].evidence.hostedRunUrl,
    },
    {
      kind: "CLOSURE",
      commitSha: "3cf72552ee3ea23a0b5e99f782f837bc6237f78b",
      pullRequestUrl: "https://github.com/desenlab/desen-app/pull/16",
      evidencePath: "docs/proof/baselines/i07-02-required-exhaustive-equivalence.json",
      hostedRunUrl: "https://github.com/desenlab/desen-app/actions/runs/30699616361",
    },
  );
  assert.equal(
    manifest.entries[7].evidence.evidenceSha256,
    createHash("sha256")
      .update(CANONICAL_EVIDENCE_BYTES.get(manifest.entries[7].evidence.evidencePath))
      .digest("hex"),
  );
  assert.deepEqual(
    manifest.entries.map(({ id, registeredBy, removalOwner, deadline }) => ({
      id,
      registeredBy,
      removalOwner,
      deadline,
    })),
    [
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `DEBT-I07-00${index + 1}`,
        registeredBy: "I07-01",
        removalOwner: "I07-04",
        deadline: "G07",
      })),
      {
        id: "DEBT-I07-007",
        registeredBy: "I07-01",
        removalOwner: "I07-05",
        deadline: "G12",
      },
      {
        id: "DEBT-I07-008",
        registeredBy: "I07-01",
        removalOwner: "I07-02",
        deadline: "G07",
      },
      {
        id: "DEBT-I07-009",
        registeredBy: "I07-01",
        removalOwner: "I07-04",
        deadline: "G07",
      },
    ],
  );
  assert.deepEqual(manifest.entries[7].targets[0].symbols, [
    "CI v2 shadow",
    "modular-shadow",
    "Exhaustive modular shadow",
    "Run exhaustive modular shadow",
  ]);
  assert.deepEqual(manifest.entries[3].targets[0].symbols, [
    "APPROVED_CURRENT_T09_SUCCESSOR_PATHS",
    "APPROVED_CURRENT_T09_SUCCESSOR_RECEIPTS",
    "APPROVED_CURRENT_T10_SUCCESSOR_PATHS",
    "APPROVED_CURRENT_T10_SUCCESSOR_RECEIPTS",
    "REQUIRED_CURRENT_T09_PROOF_MARKERS",
    "REQUIRED_CURRENT_T09_TEST_MARKERS",
    "currentT09SuccessorReceipt",
    "currentT10SuccessorReceipt",
    "assertCurrentT10SuccessorBytes",
    "authenticateLiveCurrentT09Successors",
    "authenticateCurrentT09TrackedInputs",
    "authenticateLiveCurrentT10Successors",
    "authenticateCurrentT10TrackedInputs",
    "currentT10HistoricalReceipt",
    "assertCurrentT09CompatibilityMarkers",
  ]);
  assert.deepEqual(manifest.entries[2].targets[0].symbols.slice(-4), [
    "APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT",
    "matchesReceipt",
    "authenticateRequiredCiWorkflow",
    "authenticatedM07T01Prefix",
  ]);
  assert.equal(
    manifest.entries[2].targets[1].symbols.at(-1),
    "[ci] accepts an append-only M07 successor without rewriting frozen T09 evidence",
  );
  assert.deepEqual(
    manifest.entries[3].targets.slice(2).map((target) => target.path),
    ["scripts/lib/publisher-official-golden-proof.mjs", "tests/publisher-official-golden.test.mjs"],
  );
  assert.deepEqual(manifest.entries[3].targets[2].symbols, [
    "APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT",
    "matchesReceipt",
    "authenticateRequiredCiWorkflow",
  ]);
  assert.deepEqual(manifest.entries[3].targets[1].symbols.slice(3, 7), [
    "currentT09ProofBytes",
    "currentT09RootTestBytes",
    "currentT10ProofBytes",
    "currentT10RootTestBytes",
  ]);
  assert.deepEqual(manifest.entries[4].targets[0].symbols, [
    "HISTORICAL_COMPATIBILITY_READERS",
    "HISTORICAL_TRACKED_RECEIPTS",
    "APPROVED_M07_T02_TRACKED_RECEIPTS",
    "APPROVED_M07_T02_PUBLIC_SOURCE_EXPORTS",
    "HISTORICAL_INDEX_DISTRIBUTION_RECEIPTS",
    "APPROVED_M07_T02_INDEX_DISTRIBUTION_RECEIPTS",
    "currentReaderPaths",
  ]);
  const legacyAuthority = manifest.entries[6];
  assert.equal(legacyAuthority.targets.length, 9);
  assert.deepEqual(
    legacyAuthority.targets.slice(2, 4).map((target) => target.path),
    [
      "scripts/ci/required-exhaustive-equivalence.mjs",
      "scripts/ci/test/required-exhaustive-equivalence.test.mjs",
    ],
  );
  assert.deepEqual(legacyAuthority.targets[8].symbols, [
    "legacy-rollback",
    "legacy-pnpm-store",
    "Legacy rollback",
    "Run retained legacy rollback",
    "node scripts/run-ci-quality-gate.mjs",
  ]);
  assert.deepEqual(legacyAuthority.targets[2].symbols, [
    "../run-ci-quality-gate.mjs",
    "createRetainedSequentialSteps",
    "validateRetainedSequentialPlan",
    "EXPECTED_RETAINED_PLAN_SHA256",
    "verifyRequiredExhaustiveInventoryEquivalence",
  ]);
  assert.deepEqual(legacyAuthority.targets[3].symbols, [
    "../../run-ci-quality-gate.mjs",
    "createRetainedSequentialSteps",
    "EXPECTED_RETAINED_PLAN_SHA256",
    "verifyRequiredExhaustiveInventoryEquivalence",
    "retained-plan omission, reorder, argv substitution, and duplicate fail closed",
    "RETAINED_LEGACY_COMMAND",
    "official CI admits only required exhaustive authority and a manual legacy rollback",
  ]);
  assert.deepEqual(
    legacyAuthority.targets.slice(4, 8).map((target) => target.path),
    [
      "tests/publisher-bundle-publication.test.mjs",
      "tests/publisher-catalog-pinning.test.mjs",
      "tests/publisher-invalid-source-matrix.test.mjs",
      "tests/control-plane-bundle-store.test.mjs",
    ],
  );
  assert.equal(
    manifest.entries[7].targets[2].path,
    "scripts/ci/test/modular-quality-gate.test.mjs",
  );
  assert.deepEqual(manifest.entries[8].targets[0].symbols, [
    "M07_T02_CONTROL_PLANE_COORDINATION",
    "M07_T02_CONTROL_PLANE_LOCKFILE_BLOCK",
    "normalizeCurrentRootPackageBytes",
    "inspectExactControlPlaneImporter",
    "normalizeCurrentLockfileBytes",
  ]);
  assert.ok(Object.isFrozen(manifest.entries[0].targets[0].symbols));
});

test("rejects unknown, duplicate, and reordered manifest authority", () => {
  const unknown = cloneManifest();
  unknown.extra = true;
  assert.throws(
    () => validateInfrastructureDebtManifest(unknown),
    expectCode("INFRASTRUCTURE_DEBT_SCHEMA_INVALID"),
  );

  const duplicate = cloneManifest();
  duplicate.entries[1].id = duplicate.entries[0].id;
  assert.throws(
    () => validateInfrastructureDebtManifest(duplicate),
    expectCode("INFRASTRUCTURE_DEBT_AUTHORITY_DRIFT"),
  );

  const reorderedEntries = cloneManifest();
  [reorderedEntries.entries[0], reorderedEntries.entries[1]] = [
    reorderedEntries.entries[1],
    reorderedEntries.entries[0],
  ];
  assert.throws(
    () => validateInfrastructureDebtManifest(reorderedEntries),
    expectCode("INFRASTRUCTURE_DEBT_AUTHORITY_DRIFT"),
  );

  const reorderedTargets = cloneManifest();
  reorderedTargets.entries[0].targets.reverse();
  assert.throws(
    () => validateInfrastructureDebtManifest(reorderedTargets),
    expectCode("INFRASTRUCTURE_DEBT_AUTHORITY_DRIFT"),
  );

  const reorderedSymbols = cloneManifest();
  reorderedSymbols.entries[0].targets[0].symbols.reverse();
  assert.throws(
    () => validateInfrastructureDebtManifest(reorderedSymbols),
    expectCode("INFRASTRUCTURE_DEBT_AUTHORITY_DRIFT"),
  );
});

test("rejects accessor, proxy, and sparse active structures without invoking them", () => {
  const accessor = cloneManifest();
  let getterCalled = false;
  Object.defineProperty(accessor.entries[0], "id", {
    enumerable: true,
    get() {
      getterCalled = true;
      throw new Error("must not execute");
    },
  });
  assert.throws(
    () => validateInfrastructureDebtManifest(accessor),
    expectCode("INFRASTRUCTURE_DEBT_SCHEMA_INVALID"),
  );
  assert.equal(getterCalled, false);

  const proxied = cloneManifest();
  proxied.entries[0].targets[0] = new Proxy(proxied.entries[0].targets[0], {});
  assert.throws(
    () => validateInfrastructureDebtManifest(proxied),
    expectCode("INFRASTRUCTURE_DEBT_SCHEMA_INVALID"),
  );

  const sparse = cloneManifest();
  delete sparse.entries[0].targets[0].symbols[0];
  assert.throws(
    () => validateInfrastructureDebtManifest(sparse),
    expectCode("INFRASTRUCTURE_DEBT_SCHEMA_INVALID"),
  );
});

test("rejects false OPEN, READY_FOR_REMOVAL, and CLOSED evidence claims", () => {
  const openWithEvidence = cloneManifest();
  openWithEvidence.entries[0].evidence = {};
  assert.throws(
    () => validateInfrastructureDebtManifest(openWithEvidence),
    expectCode("INFRASTRUCTURE_DEBT_EVIDENCE_INVALID"),
  );

  const readyWithoutEvidence = cloneManifest();
  readyWithoutEvidence.entries[0].status = "READY_FOR_REMOVAL";
  assert.throws(
    () => validateInfrastructureDebtManifest(readyWithoutEvidence),
    expectCode("INFRASTRUCTURE_DEBT_EVIDENCE_INVALID"),
  );

  const closedWithReadiness = cloneManifest();
  closedWithReadiness.entries[0].status = "CLOSED";
  closedWithReadiness.entries[0].evidence = {
    kind: "READINESS",
    commitSha: "a".repeat(40),
    pullRequestUrl: "https://github.com/desenlab/desen-app/pull/1",
    evidencePath: "docs/proof/debt.json",
    evidenceSha256: "b".repeat(64),
    hostedRunUrl: "https://github.com/desenlab/desen-app/actions/runs/1",
  };
  assert.throws(
    () => validateInfrastructureDebtManifest(closedWithReadiness),
    expectCode("INFRASTRUCTURE_DEBT_EVIDENCE_INVALID"),
  );
});

test("rejects non-canonical, malformed UTF-8, and oversized manifest bytes", () => {
  assert.throws(
    () =>
      parseInfrastructureDebtManifest(Buffer.concat([Buffer.from("\n"), CANONICAL_MANIFEST_BYTES])),
    expectCode("INFRASTRUCTURE_DEBT_CANONICAL_INVALID"),
  );
  assert.throws(
    () => parseInfrastructureDebtManifest(Uint8Array.from([0xc3, 0x28])),
    expectCode("INFRASTRUCTURE_DEBT_UTF8_INVALID"),
  );
  assert.throws(
    () => parseInfrastructureDebtManifest(new Uint8Array(512 * 1024 + 1)),
    expectCode("INFRASTRUCTURE_DEBT_BYTES_INVALID"),
  );
});

test("authenticates matching tracked documentation, lifecycle rows, and targets", async () => {
  const fixture = await createFixture();
  try {
    const receipt = await verifyInfrastructureDebt({ workspaceRoot: fixture.root });
    assert.deepEqual(receipt.statusCounts, {
      OPEN: 8,
      READY_FOR_REMOVAL: 0,
      CLOSED: 1,
    });
    assert.equal(receipt.taskStatuses["I07-01"], "IN_PROGRESS");
    assert.equal(receipt.taskStatuses["I07-02"], "DONE");
    assert.equal(receipt.taskStatuses["I07-05"], "NOT_STARTED");
  } finally {
    await fixture.cleanup();
  }
});

test("rejects stale summary and section projections independently", async () => {
  const fixture = await createFixture();
  try {
    const registerPath = path.join(fixture.root, "docs/plan/DEBT-REGISTER.md");
    const original = await readFile(registerPath, "utf8");
    await writeFile(
      registerPath,
      original.replace(
        "| DEBT-I07-001 | OPEN | fixture | I07-01 | I07-04 | G07 |",
        "| DEBT-I07-001 | OPEN | fixture | I07-01 | I07-05 | G07 |",
      ),
    );
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: fixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT"),
    );

    await writeFile(
      registerPath,
      original.replace("    - `G05_COMPATIBILITY_OWNERSHIP_PATHS`\n", ""),
    );
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: fixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT"),
    );

    await writeFile(
      registerPath,
      original.replace("- Closure evidence: `PENDING`", "- Closure evidence: `CLOSURE`"),
    );
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: fixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT"),
    );

    await writeFile(
      registerPath,
      original.replace("- Removal owner: `I07-04`", "- Removal owner: `I07-05`"),
    );
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: fixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT"),
    );
  } finally {
    await fixture.cleanup();
  }
});

test("fails an open entry when its removal owner or deadline is DONE", async () => {
  const ownerFixture = await createFixture();
  try {
    await writeRelative(ownerFixture.root, "docs/plan/TASKS.md", taskBoard({ "I07-04": "DONE" }));
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: ownerFixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_OVERDUE"),
    );
  } finally {
    await ownerFixture.cleanup();
  }

  const deadlineFixture = await createFixture();
  try {
    await writeRelative(deadlineFixture.root, "docs/plan/TASKS.md", taskBoard({ G07: "DONE" }));
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: deadlineFixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_OVERDUE"),
    );
  } finally {
    await deadlineFixture.cleanup();
  }
});

test("does not confuse registration completion with an overdue removal", async () => {
  const fixture = await createFixture();
  try {
    await writeRelative(fixture.root, "docs/plan/TASKS.md", taskBoard({ "I07-01": "DONE" }));
    const receipt = await verifyInfrastructureDebt({ workspaceRoot: fixture.root });
    assert.equal(receipt.taskStatuses["I07-01"], "DONE");
  } finally {
    await fixture.cleanup();
  }
});

test("enforces scoped zero references while retaining CLOSED authority records", async () => {
  const fixture = await createFixture();
  try {
    const closedEntry = fixture.manifest.entries[7];
    const target = closedEntry.targets[0];
    await writeRelative(fixture.root, target.path, `${target.symbols.join("\n")}\n`);
    await EXEC_FILE("git", ["add", "--", target.path], { cwd: fixture.root });
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: fixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_CLOSED_REFERENCE_PRESENT"),
    );

    await writeRelative(fixture.root, target.path, "replacement owns current compatibility\n");
    const receipt = await verifyInfrastructureDebt({ workspaceRoot: fixture.root });
    assert.deepEqual(receipt.statusCounts, {
      OPEN: 8,
      READY_FOR_REMOVAL: 0,
      CLOSED: 1,
    });
    // Authority and documentation intentionally retain the closed symbols; only scoped targets
    // are subject to the zero-reference rule.
    assert.match(
      await readFile(path.join(fixture.root, "scripts/ci/infrastructure-debt.json"), "utf8"),
      /CI v2 shadow/u,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("keeps both rollback-only equivalence paths in DEBT-I07-007 until legacy closure", async () => {
  const fixture = await createFixture();
  try {
    fixture.manifest.entries[6].status = "CLOSED";
    await fixture.recordEvidence(6, "CLOSURE");
    await fixture.rewriteManifestAndRegister();
    await writeRelative(fixture.root, "docs/plan/TASKS.md", taskBoard({ "I07-05": "DONE" }));

    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: fixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_CLOSED_REFERENCE_PRESENT"),
    );

    for (const target of fixture.manifest.entries[6].targets) {
      const absolutePath = path.join(fixture.root, ...target.path.split("/"));
      let targetText = await readFile(absolutePath, "utf8");
      for (const symbol of target.symbols) targetText = targetText.replaceAll(symbol, "");
      await writeRelative(fixture.root, target.path, targetText);
    }
    const receipt = await verifyInfrastructureDebt({ workspaceRoot: fixture.root });
    assert.deepEqual(receipt.statusCounts, {
      OPEN: 7,
      READY_FOR_REMOVAL: 0,
      CLOSED: 2,
    });
  } finally {
    await fixture.cleanup();
  }
});

test("requires active removal ownership and authentic evidence bytes for lifecycle advances", async () => {
  const readyFixture = await createFixture();
  try {
    readyFixture.manifest.entries[0].status = "READY_FOR_REMOVAL";
    await readyFixture.recordEvidence(0, "READINESS");
    await readyFixture.rewriteManifestAndRegister();
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: readyFixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_LIFECYCLE_INVALID"),
    );
    await writeRelative(
      readyFixture.root,
      "docs/plan/TASKS.md",
      taskBoard({ "I07-04": "IN_PROGRESS" }),
    );
    const evidencePath = readyFixture.manifest.entries[0].evidence.evidencePath;
    await unlink(path.join(readyFixture.root, ...evidencePath.split("/")));
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: readyFixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_FILE_INVALID"),
    );
    await writeRelative(readyFixture.root, evidencePath, "tampered\n");
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: readyFixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_EVIDENCE_INVALID"),
    );
  } finally {
    await readyFixture.cleanup();
  }

  const closedFixture = await createFixture();
  try {
    closedFixture.manifest.entries[0].status = "CLOSED";
    await closedFixture.recordEvidence(0, "CLOSURE");
    for (const target of closedFixture.manifest.entries[0].targets) {
      await writeRelative(closedFixture.root, target.path, "replacement\n");
    }
    await closedFixture.rewriteManifestAndRegister();
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: closedFixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_LIFECYCLE_INVALID"),
    );
  } finally {
    await closedFixture.cleanup();
  }
});

test("rejects a CLOSED target deleted only from the worktree while still index-tracked", async () => {
  const fixture = await createFixture();
  try {
    const deletedPath = fixture.manifest.entries[7].targets[0].path;
    await writeRelative(fixture.root, deletedPath, "replacement\n");
    await EXEC_FILE("git", ["add", "--", deletedPath], { cwd: fixture.root });
    await unlink(path.join(fixture.root, ...deletedPath.split("/")));
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: fixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_TRACKED_PATH_INVALID"),
    );

    await EXEC_FILE("git", ["rm", "--cached", "--quiet", "--", deletedPath], {
      cwd: fixture.root,
    });
    const receipt = await verifyInfrastructureDebt({ workspaceRoot: fixture.root });
    assert.equal(receipt.statusCounts.CLOSED, 1);
  } finally {
    await fixture.cleanup();
  }
});

test("rejects missing open, untracked, and symlink target substitutions", async () => {
  const missingFixture = await createFixture();
  try {
    const target = missingFixture.manifest.entries[0].targets[0].path;
    await unlink(path.join(missingFixture.root, ...target.split("/")));
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: missingFixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_FILE_INVALID"),
    );
  } finally {
    await missingFixture.cleanup();
  }

  const untrackedFixture = await createFixture();
  try {
    const target = untrackedFixture.manifest.entries[0].targets[0].path;
    await EXEC_FILE("git", ["rm", "--cached", "--quiet", "--", target], {
      cwd: untrackedFixture.root,
    });
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: untrackedFixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_TRACKED_PATH_INVALID"),
    );
  } finally {
    await untrackedFixture.cleanup();
  }

  const symlinkFixture = await createFixture();
  try {
    const target = symlinkFixture.manifest.entries[0].targets[0].path;
    const absoluteTarget = path.join(symlinkFixture.root, ...target.split("/"));
    await unlink(absoluteTarget);
    await writeRelative(symlinkFixture.root, "replacement.mjs", "replacement\n");
    await symlink(
      path.relative(
        path.dirname(absoluteTarget),
        path.join(symlinkFixture.root, "replacement.mjs"),
      ),
      absoluteTarget,
    );
    await EXEC_FILE("git", ["add", "--", target], { cwd: symlinkFixture.root });
    await assert.rejects(
      verifyInfrastructureDebt({ workspaceRoot: symlinkFixture.root }),
      expectCode("INFRASTRUCTURE_DEBT_FILE_INVALID"),
    );
  } finally {
    await symlinkFixture.cleanup();
  }
});

test("rejects active verification options", async () => {
  await assert.rejects(
    verifyInfrastructureDebt(
      new Proxy(
        {
          workspaceRoot: REPOSITORY_ROOT,
        },
        {},
      ),
    ),
    expectCode("INFRASTRUCTURE_DEBT_OPTIONS_INVALID"),
  );

  let getterCalled = false;
  const options = {};
  Object.defineProperty(options, "workspaceRoot", {
    enumerable: true,
    get() {
      getterCalled = true;
      throw new Error("must not execute");
    },
  });
  await assert.rejects(
    verifyInfrastructureDebt(options),
    expectCode("INFRASTRUCTURE_DEBT_OPTIONS_INVALID"),
  );
  assert.equal(getterCalled, false);
});
