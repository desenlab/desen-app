import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  auditSc01ExecutedSourceFixture,
  auditSc01RuntimeModuleFixture,
  buildSc01DtcgEvidence,
  DEFAULT_SC01_DTCG_ARTIFACT_PATH,
  evaluateSc01DtcgFixture,
  SC01_DTCG_PROFILE_CLASSIFICATION,
  SC01_INVALID_DTCG_CLASSIFICATION,
  SC01_UNSUPPORTED_DTCG_CLASSIFICATION,
  Sc01DtcgAuditError,
  verifySc01DtcgEvidence,
  writeSc01DtcgEvidence,
} from "../scripts/lib/sc-01-dtcg-audit.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TEST_DIRECTORY, "..");
const FROZEN_SPEC_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/SPEC.md",
);
const PROOF_MATRIX_PATH = path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md");
const HISTORICAL_SHA256 = "sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6";

function expectAuditFailure(error, code) {
  assert.ok(error instanceof Sc01DtcgAuditError);
  if (code !== undefined) assert.equal(error.code, code);
  return true;
}

async function temporaryDirectory() {
  return mkdtemp(path.join(os.tmpdir(), "desen-sc-01-dtcg-"));
}

test("accepts the tracked deterministic SC-01 DTCG compatibility evidence", async () => {
  const result = await verifySc01DtcgEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    classification: SC01_DTCG_PROFILE_CLASSIFICATION,
    artifactSha256: result.artifactSha256,
    tokens: 26,
    reviewedUnsupportedFeatures: 14,
    reviewedUnsupportedFixtures: 16,
    reviewedInvalidFixtures: 7,
    provenanceMode: "tracked-defaults",
    compatibilityMode: "immutable-task-time-artifact",
  });
  assert.equal(result.artifactSha256, HISTORICAL_SHA256);
});

test("reads byte-identical immutable task-time evidence twice", async () => {
  const [first, second] = await Promise.all([buildSc01DtcgEvidence(), buildSc01DtcgEvidence()]);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.equal(second.artifactSha256, HISTORICAL_SHA256);
  assert.equal(first.artifact.evidence.provenance.mode, "tracked-defaults");
  assert.equal(first.compatibilityMode, "immutable-task-time-artifact");
});

test("pins the three immutable DTCG 2025.10 reports and publication commit", async () => {
  const { artifact } = await buildSc01DtcgEvidence();
  assert.deepEqual(artifact.stableStandardPin, {
    organization: "Design Tokens Community Group",
    stableVersion: "2025.10",
    publicationDate: "2025-10-28",
    reportStatus: "FINAL_COMMUNITY_GROUP_REPORT",
    w3cStandardTrack: false,
    immutableReports: [
      {
        module: "Format",
        url: "https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/",
      },
      {
        module: "Color",
        url: "https://www.w3.org/community/reports/design-tokens/CG-FINAL-color-20251028/",
      },
      {
        module: "Resolver",
        url: "https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/",
      },
    ],
    publicationCommit: {
      repository: "https://github.com/design-tokens/community-group",
      sha: "f0f32a7dce0b51b36488be9cbbf7cad2763c6f29",
      url: "https://github.com/design-tokens/community-group/commit/f0f32a7dce0b51b36488be9cbbf7cad2763c6f29",
    },
    upstreamInconsistencies: [
      {
        id: "DTCG_RESOLVER_2025_10_VERSION_CONFLICT",
        report: "https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/",
        rootPropertyTableValue: "2025-10-01",
        normativeSection: "4.1.2 Version",
        normativeMustValue: "2025-11-01",
        selectedFixtureInterpretation: "2025-11-01",
        note: "The immutable report conflicts internally. The executable fixture follows the normative MUST paragraph in section 4.1.2; no general Resolver conformance is claimed.",
      },
    ],
  });
});

test("audits the exact built 26-leaf inherited color and dimension profile", async () => {
  const { artifact } = await buildSc01DtcgEvidence();
  const audited = artifact.auditedReferenceDocument;
  assert.equal(audited.classification, SC01_DTCG_PROFILE_CLASSIFICATION);
  assert.equal(audited.leafCount, 26);
  assert.deepEqual(audited.effectiveTypes, ["color", "dimension"]);
  assert.deepEqual(audited.typeCounts, { color: 20, dimension: 6 });
  assert.deepEqual(audited.typeInheritance, { inherited: 26, explicitOnToken: 0 });
  assert.equal(audited.colorProfile.directValues, 17);
  assert.deepEqual(audited.colorProfile.observedColorSpaces, ["srgb"]);
  assert.equal(audited.colorProfile.alphaRequiredLocally, true);
  assert.equal(audited.colorProfile.lowercaseSixDigitHexRequiredLocally, true);
  assert.deepEqual(audited.dimensionProfile.acceptedUnits, ["px", "rem"]);
  assert.deepEqual(audited.dimensionProfile.observedUnits, ["rem"]);
  assert.equal(audited.aliases.count, 3);
  assert.equal(audited.aliases.maximumObservedChainDepth, 1);
  assert.equal(audited.aliases.cycleFree, true);
  assert.equal(audited.recursivelyFrozen, true);
});

test("executes every reviewed valid-but-unsupported fixture with a stable feature id", async () => {
  const { artifact } = await buildSc01DtcgEvidence();
  const matrix = artifact.compatibility.reviewedValidButUnsupportedFeatures;
  assert.deepEqual(
    matrix.map((entry) => entry.id),
    [
      "ROOT_TOKEN_CURLY_ALIAS",
      "ALIAS_TARGET_TYPE_INFERENCE",
      "JSON_POINTER_REF",
      "PROPERTY_LEVEL_REF",
      "ROOT_GROUP_TOKEN",
      "GROUP_EXTENDS",
      "EMPTY_GROUP",
      "EXTENSIONS",
      "DEPRECATED",
      "ADDITIONAL_TOKEN_TYPES",
      "ADDITIONAL_COLOR_SPACES",
      "NONE_COLOR_COMPONENTS",
      "OPTIONAL_COLOR_ALPHA_AND_HEX",
      "RESOLVER_THEMES_AND_MODES",
    ],
  );
  for (const entry of matrix) {
    assert.equal(entry.dtcgStatus, "VALID_DTCG_2025_10");
    assert.equal(entry.localStatus, "UNSUPPORTED");
    assert.equal(entry.classification, SC01_UNSUPPORTED_DTCG_CLASSIFICATION);
    assert.ok(entry.executableFixtures.length > 0);
    for (const fixture of entry.executableFixtures) {
      assert.equal(fixture.classification, SC01_UNSUPPORTED_DTCG_CLASSIFICATION);
      assert.equal(fixture.featureId, entry.id);
      const outcome = evaluateSc01DtcgFixture(fixture.document);
      assert.equal(outcome.classification, SC01_UNSUPPORTED_DTCG_CLASSIFICATION);
      assert.equal(outcome.featureId, entry.id);
    }
  }
  const resolver = matrix.find(({ id }) => id === "RESOLVER_THEMES_AND_MODES");
  assert.deepEqual(resolver.upstreamInconsistency, {
    id: "DTCG_RESOLVER_2025_10_VERSION_CONFLICT",
    report: "https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/",
    rootPropertyTableValue: "2025-10-01",
    normativeSection: "4.1.2 Version",
    normativeMustValue: "2025-11-01",
    selectedFixtureInterpretation: "2025-11-01",
    note: "The immutable report conflicts internally. The executable fixture follows the normative MUST paragraph in section 4.1.2; no general Resolver conformance is claimed.",
  });
  assert.equal(resolver.executableFixtures[0].document.version, "2025-11-01");
});

test("keeps the exact reviewed negative fixtures separate from reviewed unsupported features", async () => {
  const { artifact } = await buildSc01DtcgEvidence();
  assert.equal(
    artifact.compatibility.reviewedInvalidFixtures.reviewScope,
    "EXACT_EMBEDDED_FIXTURES_ONLY",
  );
  assert.equal(
    artifact.compatibility.reviewedInvalidFixtures.expectedClassification,
    SC01_INVALID_DTCG_CLASSIFICATION,
  );
  assert.deepEqual(
    artifact.compatibility.reviewedInvalidFixtures.fixtures.map(({ id, classification }) => ({
      id,
      classification,
    })),
    [
      { id: "name-containing-dot", classification: SC01_INVALID_DTCG_CLASSIFICATION },
      { id: "malformed-dimension-value", classification: SC01_INVALID_DTCG_CLASSIFICATION },
      { id: "alias-cycle", classification: SC01_INVALID_DTCG_CLASSIFICATION },
      { id: "malformed-json-pointer", classification: SC01_INVALID_DTCG_CLASSIFICATION },
      { id: "missing-json-pointer-target", classification: SC01_INVALID_DTCG_CLASSIFICATION },
      {
        id: "misplaced-json-pointer-under-value",
        classification: SC01_INVALID_DTCG_CLASSIFICATION,
      },
      {
        id: "malformed-resolver-required-fields",
        classification: SC01_INVALID_DTCG_CLASSIFICATION,
      },
    ],
  );
  for (const fixture of artifact.compatibility.reviewedInvalidFixtures.fixtures) {
    assert.equal(
      evaluateSc01DtcgFixture(fixture.document).classification,
      SC01_INVALID_DTCG_CLASSIFICATION,
    );
  }

  const malformedAlias = evaluateSc01DtcgFixture({
    color: {
      $type: "color",
      bad: { $value: "{color.missing" },
    },
  });
  assert.equal(malformedAlias.classification, SC01_INVALID_DTCG_CLASSIFICATION);

  const rootAlias = evaluateSc01DtcgFixture({
    primary: {
      $type: "color",
      $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: "#000000" },
    },
    alias: { $type: "color", $value: "{primary}" },
  });
  assert.equal(rootAlias.classification, SC01_UNSUPPORTED_DTCG_CLASSIFICATION);
  assert.equal(rootAlias.featureId, "ROOT_TOKEN_CURLY_ALIAS");

  const jsonPointerAlias = evaluateSc01DtcgFixture({
    primary: {
      $type: "color",
      $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: "#000000" },
    },
    alias: { $type: "color", $ref: "#/primary/$value" },
  });
  assert.equal(jsonPointerAlias.classification, SC01_UNSUPPORTED_DTCG_CLASSIFICATION);
  assert.equal(jsonPointerAlias.featureId, "JSON_POINTER_REF");
  const pointerFixture = artifact.compatibility.reviewedValidButUnsupportedFeatures
    .find(({ id }) => id === "JSON_POINTER_REF")
    .executableFixtures.find(({ id }) => id === "whole-token-json-pointer");
  assert.deepEqual(pointerFixture.document.alias, {
    $ref: "#/primary/$value",
    $type: "color",
  });
  assert.equal(Object.hasOwn(pointerFixture.document.alias, "$value"), false);
  assert.match(pointerFixture.canonicalJsonSha256, /^sha256:[0-9a-f]{64}$/u);

  const inferredAliasType = evaluateSc01DtcgFixture({
    palette: {
      primary: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: "#000000" },
      },
    },
    alias: { $value: "{palette.primary}" },
  });
  assert.equal(inferredAliasType.classification, SC01_UNSUPPORTED_DTCG_CLASSIFICATION);
  assert.equal(inferredAliasType.featureId, "ALIAS_TARGET_TYPE_INFERENCE");

  const noneComponent = evaluateSc01DtcgFixture({
    accent: {
      $type: "color",
      $value: {
        colorSpace: "srgb",
        components: ["none", 0.2, 0.3],
        alpha: 1,
      },
    },
  });
  assert.equal(noneComponent.classification, SC01_UNSUPPORTED_DTCG_CLASSIFICATION);
  assert.equal(noneComponent.featureId, "NONE_COLOR_COMPONENTS");

  for (const malformedReference of [
    { $type: "color", $ref: "" },
    { $type: "color", $ref: "primary/$value" },
    { $type: "color", $ref: "#/primary/~2value" },
    {
      $type: "color",
      $value: { $ref: "#/primary/$value" },
    },
  ]) {
    const malformed = evaluateSc01DtcgFixture({
      primary: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: "#000000" },
      },
      alias: malformedReference,
    });
    assert.equal(malformed.classification, SC01_INVALID_DTCG_CLASSIFICATION);
  }

  const missingReference = evaluateSc01DtcgFixture({
    alias: { $type: "color", $ref: "#/missing/$value" },
  });
  assert.equal(missingReference.classification, SC01_INVALID_DTCG_CLASSIFICATION);

  const malformedResolver = evaluateSc01DtcgFixture({
    version: "bogus",
    modifiers: { theme: {} },
    resolutionOrder: [],
  });
  assert.equal(malformedResolver.classification, SC01_INVALID_DTCG_CLASSIFICATION);
});

test("accepts recursive dotted alias chains and rejects cycles", () => {
  const chain = evaluateSc01DtcgFixture({
    color: {
      $type: "color",
      base: {
        $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: "#000000" },
      },
      middle: { $value: "{color.base}" },
      final: { $value: "{color.middle}" },
    },
  });
  assert.equal(chain.classification, SC01_DTCG_PROFILE_CLASSIFICATION);
  assert.equal(chain.aliases.count, 2);
  assert.equal(chain.aliases.maximumObservedChainDepth, 2);
  assert.equal(chain.aliases.entries.at(-1).terminal, "color.base");

  const cycle = evaluateSc01DtcgFixture({
    color: {
      $type: "color",
      a: { $value: "{color.b}" },
      b: { $value: "{color.a}" },
    },
  });
  assert.equal(cycle.classification, SC01_INVALID_DTCG_CLASSIFICATION);
});

test("rejects every current-successor source build or API injection", async () => {
  for (const options of [
    { tokenDocument: {} },
    { tokenConsumerPath: "ignored" },
    { referencePackagePath: "ignored" },
    { builtTokenEntryPath: "ignored" },
    { tokenSourcePath: "ignored" },
    { providerSourcePath: "ignored" },
    { frozenSpecPath: "ignored" },
  ]) {
    await assert.rejects(buildSc01DtcgEvidence(options), (error) =>
      expectAuditFailure(error, "SC01_DTCG_OPTIONS_INVALID"),
    );
  }
});

test("rejects Proxy accessor and hidden DTCG fixture data without invoking traps", () => {
  let proxyCalls = 0;
  let getterCalls = 0;
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
    },
  );
  const accessor = Object.defineProperty({}, "token", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return {};
    },
  });
  const hidden = Object.defineProperty({}, "token", {
    enumerable: false,
    value: {},
  });
  const sparse = [];
  sparse.length = 1;
  for (const value of [proxy, accessor, hidden, sparse]) {
    assert.equal(evaluateSc01DtcgFixture(value).classification, SC01_INVALID_DTCG_CLASSIFICATION);
  }
  assert.equal(proxyCalls, 0);
  assert.equal(getterCalls, 0);
});

test("rejects storage network or global DOM ownership in every executed-source fixture", async () => {
  const frozenSpec = await readFile(FROZEN_SPEC_PATH, "utf8");
  for (const source of [
    "void globalThis.localStorage;",
    'fetch("https://example.invalid");',
    'import "node:fs";',
    "document.createElement('div');",
  ]) {
    assert.throws(
      () =>
        auditSc01ExecutedSourceFixture(
          [{ label: "adversarial-executed-source", source }],
          frozenSpec,
        ),
      (error) => expectAuditFailure(error, "SC01_DTCG_HOST_BOUNDARY_DRIFT"),
    );
  }

  let proxyCalls = 0;
  let getterCalls = 0;
  const proxy = new Proxy([], {
    getPrototypeOf() {
      proxyCalls += 1;
      return Array.prototype;
    },
  });
  const accessorEntry = Object.defineProperty({}, "source", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "";
    },
  });
  for (const sources of [proxy, [accessorEntry]]) {
    assert.throws(
      () => auditSc01ExecutedSourceFixture(sources, frozenSpec),
      (error) => expectAuditFailure(error, "SC01_DTCG_OPTIONS_INVALID"),
    );
  }
  assert.equal(proxyCalls, 0);
  assert.equal(getterCalls, 0);
});

test("rejects extra static and dynamic side-effect edges outside the built module allowlist", () => {
  for (const fixture of [
    {
      source:
        'export * from "./reference-token-document.js";\nexport * from "./web-token-provider.js";\nexport * from "./telemetry.js";\n',
      expectedSpecifiers: ["./reference-token-document.js", "./web-token-provider.js"],
      exportOnly: true,
    },
    {
      source:
        'import "./reference-token-document.js";\nimport "./telemetry.js";\nexport const provider = {};\n',
      expectedSpecifiers: ["./reference-token-document.js"],
      exportOnly: false,
    },
    {
      source: 'void import("./telemetry.js");\nexport const tokens = {};\n',
      expectedSpecifiers: [],
      exportOnly: false,
    },
  ]) {
    assert.throws(
      () =>
        auditSc01RuntimeModuleFixture({
          ...fixture,
          label: "adversarial-side-effect-edge",
        }),
      (error) => expectAuditFailure(error, "SC01_DTCG_BUILT_BINDING_DRIFT"),
    );
  }

  let proxyCalls = 0;
  const optionProxy = new Proxy(
    {},
    {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
    },
  );
  const specifierProxy = new Proxy([], {
    getPrototypeOf() {
      proxyCalls += 1;
      return Array.prototype;
    },
  });
  assert.throws(
    () => auditSc01RuntimeModuleFixture(optionProxy),
    (error) => expectAuditFailure(error, "SC01_DTCG_OPTIONS_INVALID"),
  );
  assert.throws(
    () =>
      auditSc01RuntimeModuleFixture({
        source: "",
        expectedSpecifiers: specifierProxy,
      }),
    (error) => expectAuditFailure(error, "SC01_DTCG_BUILT_BINDING_DRIFT"),
  );
  assert.equal(proxyCalls, 0);
});

test("rejects Proxy accessor hidden symbolic inherited and unknown options without traps", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "artifactPath", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "ignored";
    },
  });
  const hidden = Object.defineProperty({}, "artifactPath", {
    enumerable: false,
    value: "ignored",
  });
  const inherited = Object.create({ artifactPath: "ignored" });
  const symbolic = { [Symbol("artifactPath")]: "ignored" };
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
    },
  );
  for (const options of [accessor, hidden, inherited, symbolic, proxy, { unknown: true }]) {
    await assert.rejects(buildSc01DtcgEvidence(options), (error) =>
      expectAuditFailure(error, "SC01_DTCG_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects Proxy and shared artifact bytes before parsing", async () => {
  const proxied = new Proxy(new Uint8Array([1, 2, 3]), {});
  await assert.rejects(buildSc01DtcgEvidence({ artifactBytes: proxied }), (error) =>
    expectAuditFailure(error, "SC01_DTCG_OPTIONS_INVALID"),
  );
  const historicalBytes = await readFile(DEFAULT_SC01_DTCG_ARTIFACT_PATH);
  assert.equal(
    (
      await buildSc01DtcgEvidence({
        artifactBytes: new Uint8Array(historicalBytes),
      })
    ).artifactSha256,
    HISTORICAL_SHA256,
  );

  let accessorCalls = 0;
  class HostileBytes extends Uint8Array {
    get buffer() {
      accessorCalls += 1;
      throw new Error("hostile buffer accessor");
    }

    get byteLength() {
      accessorCalls += 1;
      throw new Error("hostile byteLength accessor");
    }

    get byteOffset() {
      accessorCalls += 1;
      throw new Error("hostile byteOffset accessor");
    }
  }
  await assert.rejects(
    buildSc01DtcgEvidence({ artifactBytes: new HostileBytes(historicalBytes) }),
    (error) => expectAuditFailure(error, "SC01_DTCG_OPTIONS_INVALID"),
  );
  assert.equal(accessorCalls, 0);

  if (typeof SharedArrayBuffer === "function") {
    await assert.rejects(
      buildSc01DtcgEvidence({ artifactBytes: new Uint8Array(new SharedArrayBuffer(8)) }),
      (error) => expectAuditFailure(error, "SC01_DTCG_OPTIONS_INVALID"),
    );
  }
});

test("rejects stale or one-byte-tampered evidence", async () => {
  const result = await buildSc01DtcgEvidence();
  const tampered = Buffer.from(result.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(verifySc01DtcgEvidence({ artifactBytes: tampered }), (error) =>
    expectAuditFailure(error, "SC01_DTCG_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects moved duplicated or mismatched Proof Matrix pins", async () => {
  const matrix = await readFile(PROOF_MATRIX_PATH, "utf8");
  const exactReference = `\`sc-01-dtcg-compatibility.json\`\n\`${HISTORICAL_SHA256}\`.`;
  for (const proofMatrixText of [
    matrix.replace("`sc-01-dtcg-compatibility.json`", "`moved.json`"),
    `${matrix}\n\`sc-01-dtcg-compatibility.json\`\n`,
    matrix.replace(HISTORICAL_SHA256, `sha256:${"0".repeat(64)}`),
    `${matrix.replace(exactReference, "")}\n${exactReference}\n`,
  ]) {
    await assert.rejects(verifySc01DtcgEvidence({ proofMatrixText }), (error) =>
      expectAuditFailure(error, "SC01_DTCG_PROOF_PIN_DRIFT"),
    );
  }
  await assert.rejects(
    verifySc01DtcgEvidence({ proofMatrixText: "x".repeat(2_000_001) }),
    (error) => expectAuditFailure(error, "SC01_DTCG_OPTIONS_INVALID"),
  );
});

test("rejects a symlink historical artifact source", async () => {
  const directory = await temporaryDirectory();
  const target = path.join(directory, "target.json");
  const source = path.join(directory, "artifact.json");
  try {
    await writeFile(target, await readFile(DEFAULT_SC01_DTCG_ARTIFACT_PATH));
    await symlink(target, source);
    await assert.rejects(buildSc01DtcgEvidence({ artifactPath: source }), (error) =>
      expectAuditFailure(error, "SC01_DTCG_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("writes and verifies an exact alternate copy and detects pre-rename tampering", async () => {
  const directory = await temporaryDirectory();
  const artifactPath = path.join(directory, "sc-01-dtcg.json");
  try {
    const written = await writeSc01DtcgEvidence({ artifactPath });
    const verified = await verifySc01DtcgEvidence({ artifactPath });
    assert.equal(written.preserved, false);
    assert.equal(verified.artifactSha256, HISTORICAL_SHA256);
    assert.equal(verified.artifactSha256, written.artifactSha256);
    assert.deepEqual(await readFile(artifactPath), await readFile(DEFAULT_SC01_DTCG_ARTIFACT_PATH));

    const tamperedPath = path.join(directory, "tampered.json");
    await assert.rejects(
      writeSc01DtcgEvidence({
        artifactPath: tamperedPath,
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      (error) => expectAuditFailure(error, "SC01_DTCG_ARTIFACT_WRITE_FAILED"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects symlink destinations without changing their targets", async () => {
  const directory = await temporaryDirectory();
  const target = path.join(directory, "target.json");
  const destination = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(writeSc01DtcgEvidence({ artifactPath: destination }), (error) =>
      expectAuditFailure(error, "SC01_DTCG_ARTIFACT_WRITE_FAILED"),
    );
    assert.equal(await readFile(target, "utf8"), "{}\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preserves the tracked inode through the default and symlink-parent alias no-op", async () => {
  const directory = await temporaryDirectory();
  const aliasParent = path.join(directory, "artifacts");
  const aliasPath = path.join(aliasParent, path.basename(DEFAULT_SC01_DTCG_ARTIFACT_PATH));
  try {
    await symlink(path.dirname(DEFAULT_SC01_DTCG_ARTIFACT_PATH), aliasParent, "dir");
    const before = await lstat(DEFAULT_SC01_DTCG_ARTIFACT_PATH, { bigint: true });
    const defaultResult = await writeSc01DtcgEvidence();
    const aliasResult = await writeSc01DtcgEvidence({ artifactPath: aliasPath });
    const after = await lstat(DEFAULT_SC01_DTCG_ARTIFACT_PATH, { bigint: true });
    assert.equal(defaultResult.preserved, true);
    assert.equal(aliasResult.preserved, true);
    assert.equal(after.dev, before.dev);
    assert.equal(after.ino, before.ino);
    assert.equal(after.mtimeNs, before.mtimeNs);

    let hookCalls = 0;
    await assert.rejects(
      writeSc01DtcgEvidence({
        artifactPath: aliasPath,
        beforeAtomicRename() {
          hookCalls += 1;
        },
      }),
      (error) => expectAuditFailure(error, "SC01_DTCG_NONDEFAULT_TRACKED_WRITE"),
    );
    await assert.rejects(
      writeSc01DtcgEvidence({
        artifactPath: aliasPath,
        buildOptions: {},
      }),
      (error) => expectAuditFailure(error, "SC01_DTCG_NONDEFAULT_TRACKED_WRITE"),
    );
    assert.equal(hookCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("keeps the host-owned storage boundary and explicit non-claims in the artifact", async () => {
  const { artifact } = await buildSc01DtcgEvidence();
  assert.deepEqual(artifact.hostOwnedStorageBoundary, {
    owner: "host",
    frozenProtocol: "DESEN 0.1.0",
    protocolTokenShape: '{ "$token": "color.action.primary" }',
    protocolDefinesTokenStorage: false,
    protocolRole:
      "The host token provider resolves the opaque token name and the receiving capability schema determines the expected resolved type.",
    referenceProviderPersistence: "none",
    referenceProviderExternalLookup: "none",
    referenceProviderGlobalDomMutation: "none",
    auditedExecutedImplementations: [
      "token index TypeScript source and exact built module",
      "token document TypeScript source and exact built module",
      "token provider TypeScript source and exact built module",
    ],
    competingTokenFileFormatCreated: false,
  });
  assert.equal(
    artifact.claim.auditScope,
    "CURRENT_BUILT_REFERENCE_DOCUMENT_AND_REVIEWED_EXACT_FIXTURE_MATRIX",
  );
  assert.equal(artifact.claim.arbitraryInputConformanceVerdict, false);
  assert.equal(artifact.claim.fullParserClaim, false);
  assert.equal(artifact.claim.fullResolverClaim, false);
  assert.equal(
    artifact.evidence.builtTokenBinding.consumerShim.exactLine,
    'export * from "@desen/reference-catalog-web/tokens";',
  );
  assert.equal(
    artifact.evidence.builtTokenBinding.packageSelfExport.import,
    "./dist/tokens/index.js",
  );
  assert.match(
    artifact.evidence.builtTokenBinding.resolvedBuiltEntry.sha256,
    /^sha256:[0-9a-f]{64}$/u,
  );
  assert.match(
    artifact.evidence.builtTokenBinding.resolvedBuiltDocument.sha256,
    /^sha256:[0-9a-f]{64}$/u,
  );
  assert.match(
    artifact.evidence.builtTokenBinding.resolvedBuiltProvider.sha256,
    /^sha256:[0-9a-f]{64}$/u,
  );
  assert.deepEqual(artifact.evidence.builtTokenBinding.sourceToBuiltTranspileParity, {
    tokenIndex: true,
    tokenDocument: true,
    tokenProvider: true,
  });
  assert.deepEqual(artifact.evidence.builtTokenBinding.runtimeModuleEdges, {
    tokenIndex: ["./reference-token-document.js", "./web-token-provider.js"],
    tokenDocument: [],
    tokenProvider: ["./reference-token-document.js"],
  });
  assert.ok(
    artifact.boundaries.includes(
      "Evaluator outcomes for arbitrary inputs outside those audited bytes are not DTCG validity or conformance verdicts.",
    ),
  );
  assert.equal(DEFAULT_SC01_DTCG_ARTIFACT_PATH.endsWith("sc-01-dtcg-compatibility.json"), true);
});
