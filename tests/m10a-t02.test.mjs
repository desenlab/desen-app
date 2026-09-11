import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import * as designSystemCore from "../packages/design-system-core/dist/index.js";
import {
  M10A_T02_ROOT_TEST_NAMES,
  M10A_T02_SC01_PIN,
  M10AT02ProofError,
  buildM10AT02Evidence,
  verifyM10AT02Evidence,
  writeM10AT02Evidence,
} from "../scripts/lib/m10a-t02-proof.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const SC01_ARTIFACT = "docs/proof/artifacts/sc-01-dtcg-compatibility.json";
const PACKAGE_MANIFEST = "packages/design-system-core/package.json";
const PROOF_DOCUMENT = "docs/proof/M10A-T02.md";
const EXPECTED_ARTIFACT_BYTES = 11_513;
const EXPECTED_ARTIFACT_SHA256 = "135dffbab6bc2c0d73e93caf2da6edbbeb7cec2653555fc5c128e1de0f5936c2";

let built;
let proofDocumentTemplate;
const temporaryDirectories = [];

function expectProofError(code) {
  return (error) => error instanceof M10AT02ProofError && error.code === `M10A_T02_${code}`;
}

function exactProofDocument(artifactSha256) {
  const artifactMarker = /Final artifact: `sha256:[0-9a-f]{64}`/gu;
  assert.equal(proofDocumentTemplate.match(artifactMarker)?.length, 1);
  return Buffer.from(
    proofDocumentTemplate.replace(artifactMarker, `Final artifact: \`sha256:${artifactSha256}\``),
  );
}

const DONE_RECEIPT = Object.freeze({
  prNumber: "123",
  headSha: "1".repeat(40),
  pullRunId: "1001",
  pullQualityJobId: "2001",
  pullBrowserJobId: "2002",
  mergeSha: "2".repeat(40),
  freshRunId: "1002",
  freshQualityJobId: "2003",
  freshBrowserJobId: "2004",
});

function exactDoneProofDocument(artifactSha256, overrides = {}) {
  const receipt = { ...DONE_RECEIPT, ...overrides };
  const canonical = exactProofDocument(artifactSha256).toString("utf8").slice(0, -1).split("\n\n");
  const hostedClosureIndex = canonical.indexOf("## Hosted closure");
  const nonClaimsIndex = canonical.indexOf("## Non-claims");
  assert.ok(hostedClosureIndex > 0);
  assert.equal(nonClaimsIndex, hostedClosureIndex + 4);
  const pullRunUrlId = receipt.pullRunUrlId ?? receipt.pullRunId;
  const freshRunUrlId = receipt.freshRunUrlId ?? receipt.freshRunId;
  const freshSha = receipt.freshSha ?? receipt.mergeSha;
  return Buffer.from(
    `${[
      ...canonical.slice(0, hostedClosureIndex + 1),
      [
        `[PR #${receipt.prNumber}](https://github.com/desenlab/desen-app/pull/${receipt.prUrlNumber ?? receipt.prNumber}) at exact head`,
        `\`${receipt.headSha}\` passed`,
        `[run ${receipt.pullRunId}](https://github.com/desenlab/desen-app/actions/runs/${pullRunUrlId}):`,
        `[Quality gate job ${receipt.pullQualityJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.pullRunId}/job/${receipt.pullQualityJobId}) and`,
        `[Browser E2E job ${receipt.pullBrowserJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.pullRunId}/job/${receipt.pullBrowserJobId})`,
        "both completed successfully. The pull request was squash-merged as",
        `[\`${receipt.mergeSha}\`](https://github.com/desenlab/desen-app/commit/${receipt.mergeUrlSha ?? receipt.mergeSha}).`,
      ].join("\n"),
      [
        "The resulting fresh",
        `[\`main\` run ${receipt.freshRunId}](https://github.com/desenlab/desen-app/actions/runs/${freshRunUrlId}) passed at exact merge SHA`,
        `\`${freshSha}\`:`,
        `[Quality gate job ${receipt.freshQualityJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.freshRunId}/job/${receipt.freshQualityJobId}) and`,
        `[Browser E2E job ${receipt.freshBrowserJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.freshRunId}/job/${receipt.freshBrowserJobId})`,
        "both completed successfully.",
      ].join("\n"),
      "M10A-T03 is ready but remains `NOT_STARTED`.",
      ...canonical.slice(nonClaimsIndex),
    ].join("\n\n")}\n`,
  );
}

function runtimeWithProfileLimit(limitName, value) {
  return {
    ...designSystemCore,
    DESIGN_TOKEN_PROFILE: Object.freeze({
      ...designSystemCore.DESIGN_TOKEN_PROFILE,
      limits: Object.freeze({
        ...designSystemCore.DESIGN_TOKEN_PROFILE.limits,
        [limitName]: value,
      }),
    }),
  };
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

before(async () => {
  [built, proofDocumentTemplate] = await Promise.all([
    buildM10AT02Evidence(),
    readFile(path.join(WORKSPACE_ROOT, PROOF_DOCUMENT), "utf8"),
  ]);
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(M10A_T02_ROOT_TEST_NAMES[0], async () => {
  const second = await buildM10AT02Evidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.task, "M10A-T02");
  assert.equal(built.artifact.proofId, "m10a-t02");
  assert.equal(built.artifact.profile, "desen.design-system-core.proof.v1");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.publicPackage.name, "@desen/design-system-core");
  assert.equal(built.artifact.publicPackage.exercisedBuiltPublicRoot, true);
  assert.equal(built.artifact.tests.verifierWritesWorkspace, false);
  assert.equal(built.artifact.tests.verifierUsesNetwork, false);
  assert.equal(built.artifact.tests.verifierSpawnsChildren, false);
  assert.equal(built.artifactBytes.byteLength, EXPECTED_ARTIFACT_BYTES);
  assert.equal(built.artifactSha256, EXPECTED_ARTIFACT_SHA256);
  assert.ok(Object.isFrozen(built.artifact));
});

test(M10A_T02_ROOT_TEST_NAMES[1], () => {
  const project = built.artifact.project;
  assert.deepEqual(project.schemaVersions, [1]);
  assert.equal(project.kind, "desen.editable-project");
  assert.equal(project.sourceKind, "desen.source");
  assert.equal(project.sourcePreservedExactly, true);
  assert.equal(project.deterministicAcrossKeyOrder, true);
  assert.equal(project.reimportByteIdentical, true);
  assert.equal(project.reimportRecordIdentical, true);
  assert.equal(project.changes, 0);
  assert.equal(project.losses, 0);
  assert.deepEqual(project.retained, {
    tokenSources: 1,
    recipes: 1,
    assets: 1,
    connectionIntents: 1,
    projectExtensions: true,
    tokenExtensions: true,
  });
  assert.equal(project.connectionIntentAuthority, "INERT_DRAFT_ONLY");
  assert.equal(project.executableIntentRejected, true);
  assert.match(project.digest, /^sha256:[0-9a-f]{64}$/u);
});

test(M10A_T02_ROOT_TEST_NAMES[2], () => {
  const tokens = built.artifact.tokens;
  assert.equal(tokens.standard, "DTCG 2025.10");
  assert.equal(tokens.supportedTypeCount, 9);
  assert.equal(tokens.supportedFamilyCount, 7);
  assert.deepEqual(tokens.supportedTypes, [
    "border",
    "color",
    "cubicBezier",
    "dimension",
    "duration",
    "number",
    "shadow",
    "transition",
    "typography",
  ]);
  assert.deepEqual(tokens.supportedFamilies, [
    "border",
    "color",
    "dimension",
    "motion",
    "number",
    "shadow",
    "typography",
  ]);
  assert.deepEqual(tokens.motionTypes, ["duration", "cubicBezier", "transition"]);
  assert.equal(tokens.admittedTokenCount, 10);
  assert.deepEqual(tokens.orderedSourceIds, ["neutral.base", "mode.dark"]);
  assert.equal(tokens.deterministicOrder, true);
  assert.equal(tokens.laterSourceWins, true);
  assert.equal(tokens.aliasResolvedAfterOverlay, true);
  assert.equal(tokens.crossSourceUntypedAliasTargetIntroducedLater, true);
  assert.equal(tokens.literalOverrideWinsLast, true);
  assert.equal(tokens.aliasesObserveLiteralOverride, true);
  assert.equal(tokens.outputRecursivelyImmutable, true);
  assert.deepEqual(tokens.observations.overlayBrand, tokens.observations.overlayAlias);
  assert.deepEqual(tokens.observations.literalBrand, tokens.observations.literalAlias);
  assert.notDeepEqual(tokens.observations.overlayBrand, tokens.observations.literalBrand);
});

test(M10A_T02_ROOT_TEST_NAMES[3], () => {
  assert.deepEqual(built.artifact.tokens.negativeMatrix, [
    { id: "alias-cycle", code: "ALIAS_CYCLE", partialResult: false },
    { id: "alias-missing-target", code: "ALIAS_TARGET_MISSING", partialResult: false },
    { id: "alias-type-mismatch", code: "ALIAS_TYPE_MISMATCH", partialResult: false },
    { id: "numeric-overflow", code: "LIMIT_EXCEEDED", partialResult: false },
    { id: "unsafe-accessor", code: "UNSAFE_DTCG_VALUE", partialResult: false },
  ]);
});

test(M10A_T02_ROOT_TEST_NAMES[4], () => {
  assert.deepEqual(built.artifact.historicalSc01, {
    ...M10A_T02_SC01_PIN,
    effectiveTypes: ["color", "dimension"],
    typeCounts: { color: 20, dimension: 6 },
    aliases: 3,
    fullResolverClaim: false,
    relationship: "UNCHANGED_HISTORICAL_CLOSED_REFERENCE_PROFILE",
  });
});

test(M10A_T02_ROOT_TEST_NAMES[5], async () => {
  assert.deepEqual(built.artifact.publicPackage.productionDependencies, [
    "@desen/editor-core",
    "@desen/protocol",
  ]);
  assert.deepEqual(built.artifact.publicPackage.requiredRuntimeExports, [
    "DESIGN_TOKEN_PROFILE",
    "EDITABLE_PROJECT_KIND",
    "EDITABLE_PROJECT_LIMITS",
    "EDITABLE_PROJECT_SCHEMA_VERSION",
    "SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS",
    "admitDtcgTokenDocument",
    "admitEditableProjectRecord",
    "getDesignTokenValueFamily",
    "getDtcgAliasTarget",
    "isDtcgTokenAlias",
    "migrateEditableProjectRecord",
    "resolveDesignTokens",
  ]);

  const substitutedRuntime = {
    ...designSystemCore,
    resolveDesignTokens() {
      return Object.freeze({ ok: false, diagnostics: Object.freeze([]) });
    },
  };
  await assert.rejects(
    buildM10AT02Evidence({ runtime: substitutedRuntime }),
    expectProofError("BEHAVIOR_DRIFT"),
  );

  const missingRuntimeExport = { ...designSystemCore };
  delete missingRuntimeExport.getDtcgAliasTarget;
  await assert.rejects(
    buildM10AT02Evidence({ runtime: missingRuntimeExport }),
    expectProofError("PUBLIC_API_DRIFT"),
  );
  await assert.rejects(
    buildM10AT02Evidence({ runtime: { ...designSystemCore, unreviewedExport: true } }),
    expectProofError("PUBLIC_API_DRIFT"),
  );

  for (const limitName of Object.keys(designSystemCore.DESIGN_TOKEN_PROFILE.limits)) {
    await assert.rejects(
      buildM10AT02Evidence({ runtime: runtimeWithProfileLimit(limitName, Infinity) }),
      expectProofError("PUBLIC_API_DRIFT"),
    );
  }
  for (const invalidLimit of [Number.NaN, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"]) {
    await assert.rejects(
      buildM10AT02Evidence({
        runtime: runtimeWithProfileLimit("maxAliasDepth", invalidLimit),
      }),
      expectProofError("PUBLIC_API_DRIFT"),
    );
  }

  const manifest = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, PACKAGE_MANIFEST), "utf8"));
  manifest.name = "@desen/substituted";
  await assert.rejects(
    buildM10AT02Evidence({
      fileOverrides: new Map([[PACKAGE_MANIFEST, Buffer.from(`${JSON.stringify(manifest)}\n`)]]),
    }),
    expectProofError("PACKAGE_DRIFT"),
  );
  manifest.name = "@desen/design-system-core";
  manifest.dependencies["@desen/validator"] = "workspace:*";
  await assert.rejects(
    buildM10AT02Evidence({
      fileOverrides: new Map([[PACKAGE_MANIFEST, Buffer.from(`${JSON.stringify(manifest)}\n`)]]),
    }),
    expectProofError("PACKAGE_DRIFT"),
  );

  const sc01 = await readFile(path.join(WORKSPACE_ROOT, SC01_ARTIFACT));
  await assert.rejects(
    buildM10AT02Evidence({ fileOverrides: new Map([[SC01_ARTIFACT, changedByte(sc01)]]) }),
    expectProofError("SC01_DRIFT"),
  );

  let getterInvocations = 0;
  const unsafeOptions = Object.defineProperty({}, "runtime", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return designSystemCore;
    },
  });
  await assert.rejects(buildM10AT02Evidence(unsafeOptions), expectProofError("OPTIONS_INVALID"));
  assert.equal(getterInvocations, 0);
  await assert.rejects(
    buildM10AT02Evidence(new Proxy({}, {})),
    expectProofError("OPTIONS_INVALID"),
  );
});

test(M10A_T02_ROOT_TEST_NAMES[6], async () => {
  const proofDocumentBytes = exactProofDocument(built.artifactSha256);
  const verified = await verifyM10AT02Evidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes,
  });
  assert.equal(verified.status, "PASS");
  assert.equal(verified.checkpointHeadSha256, "TEST_OVERRIDE");
  assert.equal(verified.externalExecution, false);

  const doneProofDocumentBytes = exactDoneProofDocument(built.artifactSha256);
  const doneVerified = await verifyM10AT02Evidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes: doneProofDocumentBytes,
  });
  assert.equal(doneVerified.status, "PASS");

  const missingRequiredCheck = Buffer.from(
    doneProofDocumentBytes
      .toString("utf8")
      .replace(
        `[Browser E2E job ${DONE_RECEIPT.pullBrowserJobId}](https://github.com/desenlab/desen-app/actions/runs/${DONE_RECEIPT.pullRunId}/job/${DONE_RECEIPT.pullBrowserJobId})\n`,
        "",
      ),
  );
  for (const proofDocumentBytes of [
    missingRequiredCheck,
    exactDoneProofDocument(built.artifactSha256, { freshSha: "3".repeat(40) }),
    exactDoneProofDocument(built.artifactSha256, { pullRunUrlId: "9999" }),
    Buffer.concat([doneProofDocumentBytes, Buffer.from("\nContradictory closure claim.\n")]),
  ]) {
    await assert.rejects(
      verifyM10AT02Evidence({ artifactBytes: built.artifactBytes, proofDocumentBytes }),
      expectProofError("REPORT_DRIFT"),
    );
  }

  await assert.rejects(
    verifyM10AT02Evidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocumentBytes,
    }),
    expectProofError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyM10AT02Evidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.from(
        `# M10A-T02 — Project design-system model and token resolver\n\nFinal artifact: \`sha256:${built.artifactSha256}\`\n`,
      ),
    }),
    expectProofError("REPORT_DRIFT"),
  );
  await assert.rejects(
    verifyM10AT02Evidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.concat([
        proofDocumentBytes,
        Buffer.from("\n**Status:** DONE; exact-head hosted closure and G10A are complete.\n"),
      ]),
    }),
    expectProofError("REPORT_DRIFT"),
  );
  await assert.rejects(
    verifyM10AT02Evidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.from(
        proofDocumentBytes
          .toString("utf8")
          .replace("`fullResolverClaim: false`", "`fullResolverClaim: true`"),
      ),
    }),
    expectProofError("REPORT_DRIFT"),
  );
  await assert.rejects(
    verifyM10AT02Evidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.from("# substituted\n"),
    }),
    expectProofError("REPORT_DRIFT"),
  );
});

test(M10A_T02_ROOT_TEST_NAMES[7], async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t02-proof-"));
  temporaryDirectories.push(directory);
  const artifactPath = path.join(directory, "artifact.json");
  const first = await writeM10AT02Evidence({ artifactPath });
  assert.equal(first.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  await assert.rejects(
    writeM10AT02Evidence({
      artifactPath,
      beforeAtomicRename() {
        throw new Error("injected failure");
      },
    }),
    expectProofError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  const symlinkPath = path.join(directory, "symlink.json");
  await symlink(artifactPath, symlinkPath);
  await assert.rejects(
    writeM10AT02Evidence({ artifactPath: symlinkPath }),
    expectProofError("ARTIFACT_WRITE_UNSAFE"),
  );

  const linkedSource = path.join(directory, "linked-source.json");
  const hardlinkPath = path.join(directory, "hardlink.json");
  await writeFile(linkedSource, "existing\n");
  await link(linkedSource, hardlinkPath);
  await assert.rejects(
    writeM10AT02Evidence({ artifactPath: hardlinkPath }),
    expectProofError("ARTIFACT_WRITE_UNSAFE"),
  );

  const directoryPath = path.join(directory, "directory.json");
  await mkdir(directoryPath);
  await assert.rejects(
    writeM10AT02Evidence({ artifactPath: directoryPath }),
    expectProofError("ARTIFACT_WRITE_UNSAFE"),
  );
});

test(M10A_T02_ROOT_TEST_NAMES[8], async () => {
  const result = await verifyM10AT02Evidence();
  assert.equal(result.status, "PASS");
  assert.equal(result.task, "M10A-T02");
  assert.equal(result.artifactSha256, EXPECTED_ARTIFACT_SHA256);
  assert.match(result.checkpointHeadSha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.tokenTypes, 9);
  assert.equal(result.tokenFamilies, 7);
  assert.equal(result.rejectedCases, 5);
  assert.equal(result.historicalSc01Sha256, M10A_T02_SC01_PIN.sha256);
});
