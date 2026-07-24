import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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
const PROVIDER_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/src/tokens/web-token-provider.ts",
);
const TOKEN_CONSUMER_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/tokens-consumer.mjs",
);
const FROZEN_SPEC_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/SPEC.md",
);

function expectAuditFailure(error, code) {
  assert.ok(error instanceof Sc01DtcgAuditError);
  if (code !== undefined) assert.equal(error.code, code);
  return true;
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
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
  });
  assert.match(result.artifactSha256, /^sha256:[0-9a-f]{64}$/u);
});

test("builds byte-identical evidence twice", async () => {
  const [first, second] = await Promise.all([buildSc01DtcgEvidence(), buildSc01DtcgEvidence()]);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.evidence.provenance.mode, "tracked-defaults");
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

test("rejects current-reference leaf, color-space, and value mutations", async () => {
  const tokenModule = await import(
    `${pathToFileURL(TOKEN_CONSUMER_PATH).href}?sc01-test=${Date.now()}`
  );
  const source = JSON.parse(JSON.stringify(tokenModule.REFERENCE_TOKEN_DOCUMENT));

  const missingLeaf = structuredClone(source);
  delete missingLeaf.space.xs;
  const p3Color = structuredClone(source);
  p3Color.color.action.primary.$value.colorSpace = "display-p3";
  delete p3Color.color.action.primary.$value.hex;
  const malformedDimension = structuredClone(source);
  malformedDimension.space.md.$value.value = "1";

  for (const document of [missingLeaf, p3Color, malformedDimension]) {
    deepFreeze(document);
    await assert.rejects(buildSc01DtcgEvidence({ tokenDocument: document }), (error) =>
      expectAuditFailure(error, "SC01_DTCG_REFERENCE_PROFILE_DRIFT"),
    );
  }
});

test("rejects provider source and built-module drift before loading the token API", async () => {
  const directory = await temporaryDirectory();
  const providerSource = await readFile(PROVIDER_SOURCE_PATH, "utf8");
  const mutatedPath = path.join(directory, "web-token-provider.ts");
  await writeFile(mutatedPath, `${providerSource}\nvoid globalThis.localStorage;\n`);
  await assert.rejects(buildSc01DtcgEvidence({ providerSourcePath: mutatedPath }), (error) =>
    expectAuditFailure(error, "SC01_DTCG_BUILT_BINDING_DRIFT"),
  );
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
});

test("rejects a mutated consumer shim before loading the built token document", async () => {
  const directory = await temporaryDirectory();
  const consumer = await readFile(TOKEN_CONSUMER_PATH, "utf8");
  const mutatedPath = path.join(directory, "tokens-consumer.mjs");
  await writeFile(mutatedPath, `${consumer}// redirected consumer\n`);
  await assert.rejects(buildSc01DtcgEvidence({ tokenConsumerPath: mutatedPath }), (error) =>
    expectAuditFailure(error, "SC01_DTCG_BUILT_BINDING_DRIFT"),
  );
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
});

test("rejects accessor-backed symbolic inherited and unknown options without invoking getters", async () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "tokenDocument", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return {};
    },
  });
  const inherited = Object.create({ tokenDocument: {} });
  const symbolic = { [Symbol("tokenDocument")]: {} };
  for (const options of [accessor, inherited, symbolic, { unknown: true }]) {
    await assert.rejects(buildSc01DtcgEvidence(options), (error) =>
      expectAuditFailure(error, "SC01_DTCG_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
});

test("rejects stale or one-byte-tampered evidence", async () => {
  const result = await buildSc01DtcgEvidence();
  const tampered = Buffer.from(result.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(verifySc01DtcgEvidence({ artifactBytes: tampered }), (error) =>
    expectAuditFailure(error, "SC01_DTCG_ARTIFACT_DRIFT"),
  );
});

test("writes and verifies an injected artifact atomically and detects pre-rename tampering", async () => {
  const directory = await temporaryDirectory();
  const artifactPath = path.join(directory, "sc-01-dtcg.json");
  const written = await writeSc01DtcgEvidence({ artifactPath });
  const verified = await verifySc01DtcgEvidence({ artifactPath });
  assert.equal(verified.artifactSha256, written.artifactSha256);

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
