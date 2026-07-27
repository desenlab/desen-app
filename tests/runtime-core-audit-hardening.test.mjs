import assert from "node:assert/strict";
import { symlinkSync, unlinkSync } from "node:fs";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH,
  RuntimeCoreAuditHardeningEvidenceError,
  buildRuntimeCoreAuditHardeningEvidence,
  verifyRuntimeCoreAuditHardeningEvidence,
  writeRuntimeCoreAuditHardeningEvidence,
} from "../scripts/lib/runtime-core-audit-hardening-proof.mjs";

const ARTIFACT_PATH = "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json";
const HISTORICAL_ARTIFACT_SHA256 =
  "cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa";
const PF049_HEADING =
  "## PF-049 — Post-G04 audit corrections require explicit runtime notification and proof migration";

let baselinePromise;

function baseline() {
  baselinePromise ??= buildRuntimeCoreAuditHardeningEvidence({
    allowPendingArtifactReference: true,
  });
  return baselinePromise;
}

async function rejectsCode(action, code) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreAuditHardeningEvidenceError);
    assert.equal(error.code, code);
    return true;
  });
}

async function workspaceText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function replaceOnce(text, from, to) {
  assert.equal(text.includes(from), true, `Mutation anchor is missing: ${from}`);
  const mutated = text.replace(from, to);
  assert.notEqual(mutated, text);
  return mutated;
}

async function finalReferenceOverrides(artifactSha256) {
  const [proofText, matrixText] = await Promise.all([
    workspaceText("docs/proof/RUNTIME-CORE-AUDIT-HARDENING.md"),
    workspaceText("docs/proof/PROOF-MATRIX.md"),
  ]);
  const pendingReference = `\`${ARTIFACT_PATH}\`\n` + "`sha256:[PENDING_FINAL_ARTIFACT_SHA256]`.";
  const finalReference = `\`${ARTIFACT_PATH}\`\n\`sha256:${artifactSha256}\`.`;
  const finalize = (text) => {
    if (text.includes(pendingReference)) {
      return replaceOnce(text, pendingReference, finalReference);
    }
    assert.equal(text.includes(finalReference), true, "The final artifact reference is missing.");
    return text;
  };
  return {
    "docs/proof/RUNTIME-CORE-AUDIT-HARDENING.md": finalize(proofText),
    "docs/proof/PROOF-MATRIX.md": finalize(matrixText),
  };
}

async function buildPending(fileOverrides = undefined, prerequisiteBytes = undefined) {
  const evidence = await baseline();
  return buildRuntimeCoreAuditHardeningEvidence({
    allowPendingArtifactReference: true,
    runtimeProbe: evidence.artifact.runtime.probe,
    fileOverrides,
    prerequisiteBytes,
  });
}

test("accepts immutable task-time M04-T17 evidence", async () => {
  const result = await verifyRuntimeCoreAuditHardeningEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.publicRuntimeExports, 2);
  assert.equal(result.publicTypeExports, 4);
  assert.equal(result.internalModuleExports, 3);
  assert.equal(result.normativeCorrections, 2);
  assert.equal(result.rootMutationTests, 13);
  assert.equal(result.artifactSha256, HISTORICAL_ARTIFACT_SHA256);
});

test("builds byte-identical M04-T17 evidence twice", async () => {
  const first = await baseline();
  const second = await buildRuntimeCoreAuditHardeningEvidence({
    allowPendingArtifactReference: true,
    runtimeProbe: first.artifact.runtime.probe,
  });
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("verifies exact in-memory final artifact references", async () => {
  const historical = await readFile(DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH);
  const fileOverrides = await finalReferenceOverrides(HISTORICAL_ARTIFACT_SHA256);
  const verified = await verifyRuntimeCoreAuditHardeningEvidence({
    artifactBytes: historical,
    buildOptions: { fileOverrides },
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.normativeCorrections, 2);
});

test("rejects duplicate, moved, or mutated task rows", async () => {
  const tasks = await workspaceText("docs/plan/TASKS.md");
  const row = tasks.split(/\r?\n/u).find((line) => line.startsWith("| M04-T17 "));
  assert.ok(row);
  await rejectsCode(
    () => buildPending({ "docs/plan/TASKS.md": replaceOnce(tasks, row, `${row}\n${row}`) }),
    "AUDIT_TASK_LEDGER_DRIFT",
  );
  const removed = replaceOnce(tasks, `${row}\n`, "");
  await rejectsCode(
    () =>
      buildPending({
        "docs/plan/TASKS.md": replaceOnce(removed, "## M05 —", `${row}\n\n## M05 —`),
      }),
    "AUDIT_TASK_LEDGER_DRIFT",
  );
  await rejectsCode(
    () =>
      buildPending({
        "docs/plan/TASKS.md": replaceOnce(
          row ? tasks : "",
          "M04-T17 | DONE",
          "M04-T17 | IN_PROGRESS",
        ),
      }),
    "AUDIT_TASK_LEDGER_DRIFT",
  );
  const gateRow = tasks.split(/\r?\n/u).find((line) => line.startsWith("| G04 "));
  assert.ok(gateRow);
  await rejectsCode(
    () =>
      buildPending({
        "docs/plan/TASKS.md": replaceOnce(tasks, gateRow, `${gateRow}\n  ${gateRow}`),
      }),
    "AUDIT_TASK_LEDGER_DRIFT",
  );
  const compactGateRow = gateRow
    .split("|")
    .map((cell) => cell.trim())
    .join("|");
  await rejectsCode(
    () =>
      buildPending({
        "docs/plan/TASKS.md": replaceOnce(tasks, gateRow, `${gateRow}\n${compactGateRow}`),
      }),
    "AUDIT_TASK_LEDGER_DRIFT",
  );
  const heading = "## M04 — Framework-neutral runtime core";
  await rejectsCode(
    () =>
      buildPending({
        "docs/plan/TASKS.md": replaceOnce(tasks, heading, `${heading}\n  ${heading}`),
      }),
    "AUDIT_TASK_LEDGER_DRIFT",
  );
  await rejectsCode(
    () =>
      buildPending({
        "docs/plan/TASKS.md": `${tasks.trimEnd()}\n\n${heading}  \n`,
      }),
    "AUDIT_TASK_LEDGER_DRIFT",
  );
});

test("rejects duplicate, moved, or mutated normative rows", async () => {
  const normative = await workspaceText("docs/proof/NORMATIVE-COVERAGE.md");
  const row = normative.split(/\r?\n/u).find((line) => line.startsWith("| N-026 "));
  assert.ok(row);
  await rejectsCode(
    () =>
      buildPending({
        "docs/proof/NORMATIVE-COVERAGE.md": replaceOnce(normative, row, `${row}\n${row}`),
      }),
    "AUDIT_NORMATIVE_LEDGER_DRIFT",
  );
  const removed = replaceOnce(normative, `${row}\n`, "");
  await rejectsCode(
    () =>
      buildPending({
        "docs/proof/NORMATIVE-COVERAGE.md": `${removed}\n${row}\n`,
      }),
    "AUDIT_NORMATIVE_LEDGER_DRIFT",
  );
  for (const [from, to] of [["M02-T08, M04-T02, M05-T02", "M02-T08, M04-T02"]]) {
    await rejectsCode(
      () =>
        buildPending({
          "docs/proof/NORMATIVE-COVERAGE.md": replaceOnce(
            normative,
            row,
            replaceOnce(row, from, to),
          ),
        }),
      "AUDIT_NORMATIVE_LEDGER_DRIFT",
    );
  }
  const n029 = normative.split(/\r?\n/u).find((line) => line.startsWith("| N-029 "));
  assert.ok(n029);
  await rejectsCode(
    () =>
      buildPending({
        "docs/proof/NORMATIVE-COVERAGE.md": replaceOnce(
          normative,
          n029,
          replaceOnce(n029, "2026-07-27", "2026-07-28"),
        ),
      }),
    "AUDIT_NORMATIVE_LEDGER_DRIFT",
  );
  await rejectsCode(
    () =>
      buildPending({
        "docs/proof/NORMATIVE-COVERAGE.md": replaceOnce(normative, n029, `${n029}\n  ${n029}`),
      }),
    "AUDIT_NORMATIVE_LEDGER_DRIFT",
  );
  const compactN029 = n029
    .split("|")
    .map((cell) => cell.trim())
    .join("|");
  await rejectsCode(
    () =>
      buildPending({
        "docs/proof/NORMATIVE-COVERAGE.md": replaceOnce(normative, n029, `${n029}\n${compactN029}`),
      }),
    "AUDIT_NORMATIVE_LEDGER_DRIFT",
  );
});

test("rejects moved or duplicated PF-049 evidence", async () => {
  const findings = await workspaceText("docs/plan/PROTOCOL-FINDINGS.md");
  await rejectsCode(
    () =>
      buildPending({
        "docs/plan/PROTOCOL-FINDINGS.md": `${findings.trimEnd()}\n\n${PF049_HEADING}\n`,
      }),
    "AUDIT_PF049_DRIFT",
  );
  const start = findings.indexOf(PF049_HEADING);
  const section = findings.slice(start);
  const without = findings.slice(0, start).trimEnd();
  const pf048 = without.indexOf("## PF-048 —");
  const moved = `${without.slice(0, pf048)}${section}\n\n${without.slice(pf048)}\n`;
  await rejectsCode(
    () => buildPending({ "docs/plan/PROTOCOL-FINDINGS.md": moved }),
    "AUDIT_PF049_DRIFT",
  );
});

test("rejects reviewed runtime source or platform drift", async () => {
  const actionTurns = await workspaceText("packages/runtime-core/src/action-turns.ts");
  const session = await workspaceText("packages/runtime-core/src/headless-session.ts");
  await rejectsCode(
    () =>
      buildPending({
        "packages/runtime-core/src/headless-session.ts": `${session}\n/** Unapproved successor export. */\nexport const unrelatedSuccessorExport = 1;\n`,
      }),
    "AUDIT_MODULE_EXPORT_DRIFT",
  );
  await rejectsCode(
    () =>
      buildPending({
        "packages/runtime-core/src/action-turns.ts": `${actionTurns}\n`,
      }),
    "AUDIT_SOURCE_BYTE_DRIFT",
  );
  await rejectsCode(
    () =>
      buildPending({
        "packages/runtime-core/src/action-turns.ts": `${actionTurns}\nimport React from "react";\n`,
      }),
    "AUDIT_PLATFORM_BOUNDARY_DRIFT",
  );
});

test("rejects every historical artifact claimed byte-identical", async () => {
  for (const [key, relativePath] of [
    ["actionTurns", "docs/proof/artifacts/runtime-core-0.1.0-action-turns.json"],
    ["adapterBridges", "docs/proof/artifacts/runtime-core-0.1.0-adapter-bridges.json"],
    ["reactiveReevaluation", "docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json"],
    ["headlessSignIn", "docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json"],
    ["componentContracts", "docs/proof/artifacts/protocol-0.1.0-component-contracts.json"],
  ]) {
    const bytes = Buffer.from(await readFile(new URL(`../${relativePath}`, import.meta.url)));
    bytes[bytes.length - 2] ^= 1;
    await rejectsCode(() => buildPending(undefined, { [key]: bytes }), "AUDIT_PREREQUISITE_DRIFT");
  }
});

test("detects any transferred compatibility verifier or root-test drift", async () => {
  const baselineEvidence = await baseline();
  for (const relativePath of [
    "scripts/lib/runtime-core-action-turns-proof.mjs",
    "tests/runtime-core-action-turns.test.mjs",
    "scripts/lib/runtime-core-adapter-bridges-proof.mjs",
    "tests/runtime-core-adapter-bridges.test.mjs",
    "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs",
    "tests/runtime-core-reactive-reevaluation.test.mjs",
    "scripts/lib/runtime-core-headless-sign-in-proof.mjs",
    "tests/runtime-core-headless-sign-in.test.mjs",
    "scripts/lib/reference-catalog-web-parity-proof.mjs",
    "scripts/lib/protocol-component-contracts-proof.mjs",
    "tests/protocol-component-contracts.test.mjs",
  ]) {
    const source = await workspaceText(relativePath);
    try {
      const changed = await buildPending({ [relativePath]: `${source}\n` });
      assert.notEqual(changed.artifactSha256, baselineEvidence.artifactSha256, relativePath);
    } catch (error) {
      assert.ok(error instanceof RuntimeCoreAuditHardeningEvidenceError, relativePath);
      assert.equal(error.code, "AUDIT_TRANSFERRED_VERIFIER_DRIFT", relativePath);
    }
  }
});

test("rejects tampered M04-T17 artifact bytes", async () => {
  const current = await baseline();
  const fileOverrides = await finalReferenceOverrides(HISTORICAL_ARTIFACT_SHA256);
  await rejectsCode(
    () =>
      verifyRuntimeCoreAuditHardeningEvidence({
        artifactBytes: current.artifactBytes,
        buildOptions: { fileOverrides },
      }),
    "AUDIT_ARTIFACT_DRIFT",
  );

  const historical = await readFile(DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH);
  const tampered = Buffer.from(historical);
  tampered[tampered.length - 2] ^= 1;
  await rejectsCode(
    () =>
      verifyRuntimeCoreAuditHardeningEvidence({
        artifactBytes: tampered,
        buildOptions: { fileOverrides },
      }),
    "AUDIT_ARTIFACT_DRIFT",
  );
});

test("rejects wrong, relocated, or duplicated artifact SHA pins", async () => {
  const evidence = Object.freeze({
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
    artifactBytes: await readFile(DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH),
  });
  const valid = await finalReferenceOverrides(evidence.artifactSha256);
  const proofPath = "docs/proof/RUNTIME-CORE-AUDIT-HARDENING.md";
  const matrixPath = "docs/proof/PROOF-MATRIX.md";
  const artifactLine = `\`${ARTIFACT_PATH}\``;
  const shaLine = `\`sha256:${evidence.artifactSha256}\`.`;
  await rejectsCode(
    () =>
      verifyRuntimeCoreAuditHardeningEvidence({
        artifactBytes: evidence.artifactBytes,
        buildOptions: {
          fileOverrides: {
            ...valid,
            [proofPath]: valid[proofPath].replace(evidence.artifactSha256, "0".repeat(64)),
          },
        },
      }),
    "AUDIT_ARTIFACT_REFERENCE_DRIFT",
  );
  await rejectsCode(
    () =>
      verifyRuntimeCoreAuditHardeningEvidence({
        artifactBytes: evidence.artifactBytes,
        buildOptions: {
          fileOverrides: {
            ...valid,
            [proofPath]: replaceOnce(
              valid[proofPath],
              `\`${ARTIFACT_PATH}\`\n${shaLine}`,
              `${shaLine}\n\`${ARTIFACT_PATH}\``,
            ),
          },
        },
      }),
    "AUDIT_ARTIFACT_REFERENCE_DRIFT",
  );
  await rejectsCode(
    () =>
      verifyRuntimeCoreAuditHardeningEvidence({
        artifactBytes: evidence.artifactBytes,
        buildOptions: {
          fileOverrides: { ...valid, [proofPath]: `${valid[proofPath]}\n${shaLine}\n` },
        },
      }),
    "AUDIT_ARTIFACT_REFERENCE_DRIFT",
  );
  for (const documentPath of [proofPath, matrixPath]) {
    await rejectsCode(
      () =>
        verifyRuntimeCoreAuditHardeningEvidence({
          artifactBytes: evidence.artifactBytes,
          buildOptions: {
            fileOverrides: {
              ...valid,
              [documentPath]: replaceOnce(
                valid[documentPath],
                `${artifactLine}\n${shaLine}`,
                `${artifactLine}\n${shaLine}\n  ${artifactLine}\n  ${shaLine}`,
              ),
            },
          },
        }),
      "AUDIT_ARTIFACT_REFERENCE_DRIFT",
    );
    await rejectsCode(
      () =>
        verifyRuntimeCoreAuditHardeningEvidence({
          artifactBytes: evidence.artifactBytes,
          buildOptions: {
            fileOverrides: {
              ...valid,
              [documentPath]: `${valid[documentPath]}\n  ${artifactLine}\n  ${shaLine}\n`,
            },
          },
        }),
      "AUDIT_ARTIFACT_REFERENCE_DRIFT",
    );
    await rejectsCode(
      () =>
        verifyRuntimeCoreAuditHardeningEvidence({
          artifactBytes: evidence.artifactBytes,
          buildOptions: {
            fileOverrides: {
              ...valid,
              [documentPath]: replaceOnce(
                valid[documentPath],
                `${artifactLine}\n${shaLine}`,
                `${artifactLine}\n${shaLine}\n${artifactLine}  \n${shaLine}  `,
              ),
            },
          },
        }),
      "AUDIT_ARTIFACT_REFERENCE_DRIFT",
    );
    await rejectsCode(
      () =>
        verifyRuntimeCoreAuditHardeningEvidence({
          artifactBytes: evidence.artifactBytes,
          buildOptions: {
            fileOverrides: {
              ...valid,
              [documentPath]: replaceOnce(
                valid[documentPath],
                `${artifactLine}\n${shaLine}`,
                `${artifactLine}\n${shaLine}\n\`\` ${ARTIFACT_PATH} \`\`\n\`\` sha256:${evidence.artifactSha256} \`\`.`,
              ),
            },
          },
        }),
      "AUDIT_ARTIFACT_REFERENCE_DRIFT",
    );
  }
});

test("default audit writer preserves exact immutable task-time bytes", async () => {
  const before = await readFile(DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH);
  const result = await writeRuntimeCoreAuditHardeningEvidence();
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-audit-parent-alias-"));
  const parentAlias = path.join(directory, "artifact-parent");
  try {
    await symlink(
      path.dirname(DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH),
      parentAlias,
      "dir",
    );
    const aliasResult = await writeRuntimeCoreAuditHardeningEvidence({
      artifactPath: path.join(
        parentAlias,
        path.basename(DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH),
      ),
      preparedEvidence: {
        artifact: JSON.parse(before.toString("utf8")),
        artifactBytes: before,
        artifactSha256: HISTORICAL_ARTIFACT_SHA256,
      },
    });
    assert.equal(aliasResult.compatibilityMode, "immutable-task-time-artifact");

    await rm(parentAlias);
    const evidence = await baseline();
    const fileName = path.basename(DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH);
    const canonicalCustomPath = path.join(await realpath(directory), fileName);
    await symlink(directory, parentAlias, "dir");
    let swapped = false;
    const swappedResult = await writeRuntimeCoreAuditHardeningEvidence({
      artifactPath: path.join(parentAlias, fileName),
      get preparedEvidence() {
        unlinkSync(parentAlias);
        symlinkSync(
          path.dirname(DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH),
          parentAlias,
          "dir",
        );
        swapped = true;
        return evidence;
      },
      beforeAtomicRename: ({ artifactPath }) => {
        assert.equal(artifactPath, canonicalCustomPath);
      },
    });

    assert.equal(swapped, true);
    assert.equal(swappedResult.artifactPath, canonicalCustomPath);
    assert.deepEqual(await readFile(canonicalCustomPath), evidence.artifactBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  const after = await readFile(DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH);

  assert.deepEqual(after, before);
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.artifactSha256, HISTORICAL_ARTIFACT_SHA256);
});

test("rejects unsafe proof-artifact writer destinations", async () => {
  const evidence = await baseline();
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-m04-t17-"));
  const target = path.join(temporary, "target.json");
  const link = path.join(temporary, "unsafe.json");
  try {
    await writeFile(target, "preserved");
    await symlink(target, link);
    await rejectsCode(
      () =>
        writeRuntimeCoreAuditHardeningEvidence({
          artifactPath: link,
          preparedEvidence: evidence,
        }),
      "AUDIT_ARTIFACT_UNSAFE",
    );
    assert.equal(await readFile(target, "utf8"), "preserved");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("rejects runtime API or probe injection in the production verifier", async () => {
  for (const buildOptions of [
    { runtimeApi: {} },
    { actionTurnsApi: {} },
    { runtimeProbe: {} },
    { allowPendingArtifactReference: true },
  ]) {
    await rejectsCode(
      () => verifyRuntimeCoreAuditHardeningEvidence({ buildOptions }),
      "AUDIT_OPTIONS_INVALID",
    );
  }
});
