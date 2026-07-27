import { createHash, randomBytes } from "node:crypto";
import { lstat, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import {
  DEFAULT_PROTOCOL_CANONICALIZATION_ARTIFACT_PATH,
  verifyProtocolCanonicalization,
} from "./protocol-canonicalization-proof.mjs";
import {
  DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_ARTIFACT_PATH,
  verifyProtocolExecutionContracts,
} from "./protocol-execution-contracts-proof.mjs";
import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const PROTOCOL_API_URL = new URL("../../packages/protocol/dist/index.js", import.meta.url);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);

/** Absolute path to the deterministic M02-T12 evidence artifact. */
export const DEFAULT_PROTOCOL_OFFICIAL_SUITE_PARITY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-official-suite-parity.json",
);
const HISTORICAL_ARTIFACT_SHA256 =
  "efa6b4ed014b942d45d621ffc77c47e76d82dd6965deb13cf677c6bebf7a76ae";

/** Frozen, human-readable output captured from the upstream Python suite runner. */
export const DEFAULT_PROTOCOL_OFFICIAL_SUITE_BASELINE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/baselines/protocol-0.1.0-validation.txt",
);

/** Frozen checksum transcript captured with the upstream validation baseline. */
export const DEFAULT_PROTOCOL_OFFICIAL_SUITE_CHECKSUM_BASELINE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/baselines/protocol-0.1.0-checksums.txt",
);

/** Reviewed trace ledger containing the responsibilities exercised by M02-T12. */
export const DEFAULT_PROTOCOL_OFFICIAL_SUITE_TRACE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

const EXPECTED_VALIDATION_BASELINE_SHA256 =
  "d2c5e7e27a5a1f5ecc66f3aad4956451c81b420a60908be5c948071a7305aa86";
const EXPECTED_CHECKSUM_BASELINE_SHA256 =
  "6208ed37fa4da3b816e505c106be1801fcee504e1dde2ab4a4e4ceb5b0ca166f";
const EXPECTED_TRANSCRIPT_SHA256 =
  "5f03bedd9ad9c3755a41a462bf1b5da48077aa32ac93941d53dc6cc2f6d57cfd";

const EXPECTED_MANIFEST = Object.freeze({
  version: "0.1.0",
  catalog: "valid/web.catalog.json",
  vectors: Object.freeze([
    Object.freeze({ file: "valid/sign-in.source.json", target: "source", expect: "valid" }),
    Object.freeze({ file: "valid/sign-in.bundle.json", target: "bundle", expect: "valid" }),
    Object.freeze({ file: "valid/web.catalog.json", target: "catalog", expect: "valid" }),
    Object.freeze({
      file: "invalid/source-unknown-core-field.json",
      target: "source",
      expect: "schema_error",
      code: "UNKNOWN_CORE_FIELD",
    }),
    Object.freeze({
      file: "invalid/source-duplicate-node-id.json",
      target: "source",
      expect: "semantic_error",
      code: "DUPLICATE_NODE_ID",
    }),
    Object.freeze({
      file: "invalid/source-unknown-capability.json",
      target: "source",
      expect: "catalog_error",
      code: "UNKNOWN_CAPABILITY",
    }),
    Object.freeze({
      file: "invalid/source-unknown-event.json",
      target: "source",
      expect: "catalog_error",
      code: "UNKNOWN_EVENT",
    }),
    Object.freeze({
      file: "invalid/bundle-revision-mismatch.json",
      target: "bundle",
      expect: "integrity_error",
      code: "REVISION_MISMATCH",
    }),
    Object.freeze({
      file: "invalid/bundle-catalog-digest-mismatch.json",
      target: "bundle",
      expect: "activation_error",
      code: "CATALOG_DIGEST_MISMATCH",
    }),
  ]),
});

const EXPECTED_EXAMPLES = Object.freeze([
  Object.freeze({ file: "catalog.web.example.json", target: "catalog" }),
  Object.freeze({ file: "sign-in.source.desen.json", target: "source" }),
  Object.freeze({ file: "sign-in.bundle.desen.json", target: "bundle" }),
  Object.freeze({ file: "store-map.source.desen.json", target: "source" }),
  Object.freeze({ file: "sortable-list.source.desen.json", target: "source" }),
]);

const EXPECTED_TARGET_COUNTS = Object.freeze({ source: 8, bundle: 4, catalog: 2 });
const EXPECTED_NEGATIVE_CATEGORY_COUNTS = Object.freeze({
  schema_error: 1,
  semantic_error: 1,
  catalog_error: 2,
  integrity_error: 1,
  activation_error: 1,
});
const VALIDATOR_DIAGNOSTIC_SUITE_PAIRS = Object.freeze({
  UNKNOWN_CORE_FIELD: Object.freeze({ classification: "schema", category: "schema_error" }),
  DUPLICATE_NODE_ID: Object.freeze({
    classification: "semantic",
    category: "semantic_error",
  }),
  UNKNOWN_CAPABILITY: Object.freeze({
    classification: "catalog",
    category: "catalog_error",
  }),
  UNKNOWN_EVENT: Object.freeze({ classification: "catalog", category: "catalog_error" }),
});
const EXPECTED_TRACE = Object.freeze({
  proseRules: Object.freeze(["R-001", "R-032", "R-035", "R-082", "R-142"]),
  conformanceRules: Object.freeze(["C-016", "C-024"]),
  schemaNonConstraintDecisions: Object.freeze(["SN-003"]),
  schemaRegistry: Object.freeze(["SR-001", "SR-002", "SR-003"]),
});
const FIXED_TRACKED_PATHS = Object.freeze([
  "packages/validator/test/official-suite-parity.test.ts",
  "docs/proof/baselines/protocol-0.1.0-checksums.txt",
  "docs/proof/baselines/protocol-0.1.0-validation.txt",
  "docs/proof/PROTOCOL-OFFICIAL-SUITE-PARITY.md",
  "docs/proof/protocol-0.1.0-traceability.json",
  "scripts/lib/protocol-official-suite-parity-proof.mjs",
  "scripts/generate-protocol-official-suite-parity-proof.mjs",
  "scripts/verify-protocol-official-suite-parity.mjs",
  "tests/protocol-official-suite-parity.test.mjs",
]);

/** Stable failure raised when deterministic M02-T12 parity cannot be established. */
export class ProtocolOfficialSuiteParityEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ProtocolOfficialSuiteParityEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ProtocolOfficialSuiteParityEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function authenticateHistoricalArtifact(artifactPath, suppliedBytes) {
  let bytes;
  if (suppliedBytes === undefined) {
    let entry;
    try {
      entry = await lstat(artifactPath);
    } catch (error) {
      fail("OFFICIAL_SUITE_ARTIFACT_DRIFT", "Immutable M02-T12 evidence is missing.", {
        cause: String(error),
      });
    }
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail(
        "OFFICIAL_SUITE_ARTIFACT_UNSUPPORTED_ENTRY",
        "Immutable M02-T12 evidence must be a regular non-symlink file.",
      );
    }
    bytes = await readFile(artifactPath);
  } else {
    bytes = Buffer.from(suppliedBytes);
  }
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail("OFFICIAL_SUITE_ARTIFACT_DRIFT", "Immutable task-time M02-T12 evidence bytes changed.", {
      expectedSha256: HISTORICAL_ARTIFACT_SHA256,
      actualSha256,
    });
  }

  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("OFFICIAL_SUITE_ARTIFACT_DRIFT", "Immutable M02-T12 evidence is not valid JSON.");
  }
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M02-T12" ||
    artifact.result !== "PASS" ||
    artifact.profile !== "desen-official-suite-parity-v1" ||
    artifact.protocolVersion !== "0.1.0" ||
    artifact.suite?.composition?.cases !== 14 ||
    artifact.suite?.composition?.conformanceVectors !== 9 ||
    artifact.suite?.composition?.publicExamples !== 5 ||
    artifact.suite?.composition?.valid !== 8 ||
    artifact.suite?.composition?.invalid !== 6 ||
    artifact.suite?.targets?.source !== 8 ||
    artifact.suite?.targets?.bundle !== 4 ||
    artifact.suite?.targets?.catalog !== 2 ||
    artifact.suite?.semanticParity?.byteEqual !== true ||
    artifact.suite?.transcriptParity?.byteEqual !== true ||
    artifact.suite?.supplements?.length !== 2
  ) {
    fail(
      "OFFICIAL_SUITE_ARTIFACT_DRIFT",
      "Immutable M02-T12 evidence no longer has its reviewed identity, inventory, or semantics.",
    );
  }
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(bytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function assertJsonEqual(actual, expected, label, code = "OFFICIAL_SUITE_CONTRACT_DRIFT") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} changed.`, { expected, actual });
  }
}

async function loadPublicApis() {
  const cacheKey = `${String(Date.now())}-${randomBytes(4).toString("hex")}`;
  const [protocolApi, validatorApi] = await Promise.all([
    import(`${PROTOCOL_API_URL.href}?proof=${cacheKey}`),
    import(`${VALIDATOR_API_URL.href}?proof=${cacheKey}`),
  ]);
  return { protocolApi, validatorApi };
}

function verifyPublicApis(protocolApi, validatorApi) {
  const expectedProtocol = ["calculateDesenBundleRevision", "canonicalizeJsonBytes"];
  const expectedValidator = [
    "validateDesenBundleExecutionContracts",
    "validateDesenExecutionCatalogSet",
    "validateDesenSourceExecutionContracts",
  ];
  for (const name of expectedProtocol) {
    if (typeof protocolApi?.[name] !== "function") {
      fail("OFFICIAL_SUITE_PUBLIC_API_DRIFT", `The built protocol API is missing ${name}.`);
    }
  }
  for (const name of expectedValidator) {
    if (typeof validatorApi?.[name] !== "function") {
      fail("OFFICIAL_SUITE_PUBLIC_API_DRIFT", `The built validator API is missing ${name}.`);
    }
  }
  return Object.freeze({
    protocol: Object.freeze(expectedProtocol),
    validator: Object.freeze(expectedValidator),
  });
}

async function verifyCommandWiring() {
  const root = await readJson(path.join(WORKSPACE_ROOT, "package.json"));
  const expected = {
    "generate:protocol-official-suite-parity":
      "pnpm --filter @desen/validator... build && node scripts/generate-protocol-official-suite-parity-proof.mjs",
    "verify:protocol-official-suite-parity":
      "pnpm --filter @desen/validator... build && node scripts/verify-protocol-official-suite-parity.mjs",
    "test:protocol-official-suite-parity":
      "pnpm --filter @desen/validator... build && pnpm --filter @desen/validator test:official-suite-parity && node --test tests/protocol-official-suite-parity.test.mjs",
  };
  for (const [name, command] of Object.entries(expected)) {
    if (root.scripts?.[name] !== command) {
      fail("OFFICIAL_SUITE_COMMAND_WIRING_DRIFT", `${name} wiring changed.`, {
        expected: command,
        actual: root.scripts?.[name],
      });
    }
  }
  for (const [scriptName, required] of [
    ["test", "pnpm test:protocol-official-suite-parity"],
    ["check", "pnpm verify:protocol-official-suite-parity"],
  ]) {
    if (!root.scripts?.[scriptName]?.includes(required)) {
      fail("OFFICIAL_SUITE_COMMAND_WIRING_DRIFT", `${scriptName} omits ${required}.`);
    }
  }
  return Object.freeze(expected);
}

async function verifyPrerequisite({ artifactPath, kind }) {
  const isCanonicalization = kind === "canonicalization";
  const verifier = isCanonicalization
    ? verifyProtocolCanonicalization
    : verifyProtocolExecutionContracts;
  let verification;
  try {
    verification = await verifier({ artifactPath });
  } catch (error) {
    fail(
      "OFFICIAL_SUITE_PREREQUISITE_DRIFT",
      `M02-${isCanonicalization ? "T04" : "T11"} prerequisite verification failed.`,
      {
        predecessorCode: typeof error?.code === "string" ? error.code : "UNEXPECTED_ERROR",
      },
    );
  }
  const bytes = await readFile(artifactPath);
  const artifact = JSON.parse(bytes);
  const expected = isCanonicalization
    ? { task: "M02-T04", profile: "rfc8785-sha256-v1", protocolVersion: "0.1.0" }
    : {
        task: "M02-T11",
        profile: "desen-execution-contract-validation-v1",
        protocolVersion: "0.1.0",
        result: "PASS",
      };
  for (const [key, value] of Object.entries(expected)) {
    if (artifact[key] !== value) {
      fail("OFFICIAL_SUITE_PREREQUISITE_DRIFT", `${expected.task} metadata changed.`, {
        key,
        expected: value,
        actual: artifact[key],
      });
    }
  }
  const digest = sha256(bytes);
  if (verification.artifactSha256 !== digest) {
    fail("OFFICIAL_SUITE_PREREQUISITE_DRIFT", `${expected.task} bytes disagree with its verifier.`);
  }
  return Object.freeze({
    task: expected.task,
    profile: expected.profile,
    result: "PASS",
    sha256: digest,
    verifiedBy: isCanonicalization
      ? "verifyProtocolCanonicalization"
      : "verifyProtocolExecutionContracts",
  });
}

function idsTestedBy(entries, task) {
  return entries
    .filter(({ tests }) => tests?.includes(task))
    .map(({ id }) => id)
    .sort(compareText);
}

function idsOwnedBy(entries, task, ownerField = "owners") {
  return entries
    .filter((entry) => entry[ownerField]?.includes(task))
    .map(({ id }) => id)
    .sort(compareText);
}

async function verifyTraceability(tracePath) {
  const trace = await readJson(tracePath);
  for (const [collection, expected] of Object.entries(EXPECTED_TRACE)) {
    assertJsonEqual(
      idsTestedBy(trace[collection] ?? [], "M02-T12"),
      [...expected].sort(compareText),
      `M02-T12 ${collection} test responsibilities`,
      "OFFICIAL_SUITE_TRACE_DRIFT",
    );
  }
  const ownership = {
    schemaFamilies: idsOwnedBy(trace.schemaFamilies ?? [], "M02-T12", "semanticOwners"),
    invariants: idsOwnedBy(trace.invariants ?? [], "M02-T12"),
    diagnostics: idsOwnedBy(trace.diagnostics ?? [], "M02-T12"),
  };
  for (const [collection, ids] of Object.entries(ownership)) {
    assertJsonEqual(ids, [], `M02-T12 ${collection} ownership`, "OFFICIAL_SUITE_TRACE_DRIFT");
  }
  return Object.freeze({
    ownership: Object.freeze({ schemaFamilies: 0, invariants: 0, diagnostics: 0 }),
    tests: EXPECTED_TRACE,
  });
}

function expectedTranscriptLines() {
  return [
    ...EXPECTED_MANIFEST.vectors.map(({ file, expect, code }) =>
      expect === "valid" ? `PASS ${file} (valid)` : `PASS ${file} (${expect}/${code})`,
    ),
    ...EXPECTED_EXAMPLES.map(({ file }) => `PASS example ${file}`),
    "",
    "14 suite cases passed, 0 failed (9 vectors, 5 examples)",
  ];
}

function renderExpectedTranscript() {
  return Buffer.from(`${expectedTranscriptLines().join("\n")}\n`);
}

function parseValidationBaseline(bytes) {
  const digest = sha256(bytes);
  if (digest !== EXPECTED_VALIDATION_BASELINE_SHA256) {
    fail("OFFICIAL_SUITE_BASELINE_DRIFT", "The frozen Python validation baseline bytes changed.", {
      expectedSha256: EXPECTED_VALIDATION_BASELINE_SHA256,
      actualSha256: digest,
    });
  }
  const text = Buffer.from(bytes).toString("utf8");
  const lines = text.split("\n");
  const expectedHeader = [
    "DESEN 0.1.0 baseline validation",
    "Date: 2026-07-21",
    `Commit: ${EXPECTED_PROTOCOL_SNAPSHOT.sourceCommit}`,
    "Command: python3 tools/validate.py --suite",
    "Suite composition: 9 conformance vectors + 5 public examples = 14 cases",
    "",
  ];
  assertJsonEqual(
    lines.slice(0, expectedHeader.length),
    expectedHeader,
    "Frozen Python baseline header",
    "OFFICIAL_SUITE_BASELINE_DRIFT",
  );
  const transcript = Buffer.from(lines.slice(expectedHeader.length).join("\n"));
  const expected = renderExpectedTranscript();
  if (!transcript.equals(expected)) {
    fail("OFFICIAL_SUITE_BASELINE_DRIFT", "The frozen Python suite transcript changed.", {
      expectedSha256: sha256(expected),
      actualSha256: sha256(transcript),
    });
  }
  if (sha256(transcript) !== EXPECTED_TRANSCRIPT_SHA256) {
    fail("OFFICIAL_SUITE_BASELINE_DRIFT", "The fixed normalized transcript digest changed.");
  }
  const transcriptLines = Buffer.from(transcript).toString("utf8").split("\n");
  const semanticRecords = [];
  for (const [index, vector] of EXPECTED_MANIFEST.vectors.entries()) {
    const match = /^PASS (.+) \((valid|([a-z_]+)\/([A-Z_]+))\)$/u.exec(transcriptLines[index]);
    if (match === null || match[1] !== vector.file) {
      fail("OFFICIAL_SUITE_BASELINE_DRIFT", "A frozen vector transcript record is malformed.", {
        line: index + 7,
      });
    }
    semanticRecords.push(
      Object.freeze({
        family: "conformance-vector",
        file: match[1],
        target: vector.target,
        outcome: match[2] === "valid" ? "valid" : "invalid",
        ...(match[2] === "valid" ? {} : { category: match[3], code: match[4] }),
      }),
    );
  }
  for (const [offset, example] of EXPECTED_EXAMPLES.entries()) {
    const index = EXPECTED_MANIFEST.vectors.length + offset;
    const match = /^PASS example (.+)$/u.exec(transcriptLines[index]);
    if (match === null || match[1] !== example.file) {
      fail("OFFICIAL_SUITE_BASELINE_DRIFT", "A frozen example transcript record is malformed.", {
        line: index + 7,
      });
    }
    semanticRecords.push(
      Object.freeze({
        family: "public-example",
        file: match[1],
        target: example.target,
        outcome: "valid",
      }),
    );
  }
  return Object.freeze({
    bytes: bytes.length,
    sha256: digest,
    transcript,
    semanticRecords: Object.freeze(semanticRecords),
  });
}

function parseChecksumBaseline(bytes) {
  const digest = sha256(bytes);
  if (digest !== EXPECTED_CHECKSUM_BASELINE_SHA256) {
    fail("OFFICIAL_SUITE_CHECKSUM_BASELINE_DRIFT", "The frozen checksum baseline bytes changed.", {
      expectedSha256: EXPECTED_CHECKSUM_BASELINE_SHA256,
      actualSha256: digest,
    });
  }
  const lines = Buffer.from(bytes).toString("utf8").split("\n");
  const expectedHeader = [
    "DESEN 0.1.0 checksum baseline",
    "Date: 2026-07-21",
    `Commit: ${EXPECTED_PROTOCOL_SNAPSHOT.sourceCommit}`,
    `SHA256SUMS sha256: ${EXPECTED_PROTOCOL_SNAPSHOT.manifestSha256}`,
    "Command: shasum -a 256 -c SHA256SUMS",
    "",
  ];
  assertJsonEqual(
    lines.slice(0, expectedHeader.length),
    expectedHeader,
    "Frozen checksum baseline header",
    "OFFICIAL_SUITE_CHECKSUM_BASELINE_DRIFT",
  );
  return Object.freeze({ bytes: bytes.length, sha256: digest });
}

function createCatalogSet(validatorApi, catalogs, label) {
  const result = validatorApi.validateDesenExecutionCatalogSet(catalogs);
  if (result?.valid !== true || !("value" in result) || result.diagnostics?.length !== 0) {
    fail("OFFICIAL_SUITE_PUBLIC_API_FAILURE", `${label} unexpectedly failed.`, {
      diagnostics: result?.diagnostics,
    });
  }
  return result.value;
}

function exactCatalogRequirementMatch(requirement, catalog) {
  return (
    requirement?.id === catalog?.id &&
    requirement?.version === catalog?.version &&
    requirement?.target === catalog?.target
  );
}

function suiteCategoryForValidatorDiagnostic(code, classification) {
  const pair = VALIDATOR_DIAGNOSTIC_SUITE_PAIRS[code];
  return pair !== undefined && pair.classification === classification ? pair.category : undefined;
}

function normalizeValidatorDiagnostic({ code, classification, pointer }) {
  const category = suiteCategoryForValidatorDiagnostic(code, classification);
  return Object.freeze({
    code,
    classification,
    ...(category === undefined ? {} : { category }),
    ...(pointer === undefined ? {} : { pointer }),
  });
}

function narrowBundleSupplement(
  protocolApi,
  bundle,
  catalogs,
  catalogDigestMatches = (requirement, catalog) => requirement.digest === catalog.packageDigest,
) {
  const calculatedRevision = protocolApi.calculateDesenBundleRevision(bundle);
  if (calculatedRevision !== bundle.revision) {
    return Object.freeze({
      matchedBy: "proof-only-bundle-revision-supplement",
      diagnostic: Object.freeze({
        code: "REVISION_MISMATCH",
        classification: null,
        category: "integrity_error",
        pointer: "/revision",
      }),
    });
  }
  for (const [index, requirement] of (bundle.requires?.catalogs ?? []).entries()) {
    const catalog = catalogs.find((candidate) =>
      exactCatalogRequirementMatch(requirement, candidate),
    );
    if (catalog !== undefined && !catalogDigestMatches(requirement, catalog)) {
      return Object.freeze({
        matchedBy: "proof-only-catalog-digest-supplement",
        diagnostic: Object.freeze({
          code: "CATALOG_DIGEST_MISMATCH",
          classification: null,
          category: "activation_error",
          pointer: `/requires/catalogs/${String(index)}/digest`,
        }),
      });
    }
  }
  return undefined;
}

function validateOfficialCase({
  validatorApi,
  protocolApi,
  target,
  document,
  catalogSet,
  catalogDigestMatches,
}) {
  let result;
  if (target === "catalog") {
    result = validatorApi.validateDesenExecutionCatalogSet([document]);
  } else if (target === "source") {
    result = validatorApi.validateDesenSourceExecutionContracts(document, catalogSet);
  } else if (target === "bundle") {
    result = validatorApi.validateDesenBundleExecutionContracts(document, catalogSet);
  } else {
    fail("OFFICIAL_SUITE_ROUTE_DRIFT", `Unsupported official target ${String(target)}.`);
  }
  if (result?.valid !== true) {
    return Object.freeze({
      outcome: "invalid",
      diagnostics: Object.freeze(
        Array.isArray(result?.diagnostics)
          ? result.diagnostics.map((diagnostic) => normalizeValidatorDiagnostic(diagnostic))
          : [],
      ),
      matchedBy: "validator-diagnostic",
    });
  }
  if (target === "bundle") {
    const supplement = narrowBundleSupplement(
      protocolApi,
      result.value,
      catalogSet,
      catalogDigestMatches,
    );
    if (supplement !== undefined) {
      return Object.freeze({
        outcome: "invalid",
        diagnostics: Object.freeze([supplement.diagnostic]),
        matchedBy: supplement.matchedBy,
      });
    }
  }
  return Object.freeze({
    outcome: "valid",
    diagnostics: Object.freeze([]),
    matchedBy: "validator-success",
  });
}

function semanticRecord({ family, file, target, expected }) {
  return Object.freeze({
    family,
    file,
    target,
    outcome: expected === "valid" ? "valid" : "invalid",
    ...(expected === "valid" ? {} : { category: expected.expect, code: expected.code }),
  });
}

function assertCaseOutcome(actual, expected, label) {
  if (expected === "valid") {
    if (actual.outcome !== "valid") {
      fail("OFFICIAL_SUITE_OUTCOME_MISMATCH", `${label} was rejected.`, {
        diagnostics: actual.diagnostics,
      });
    }
    return undefined;
  }
  const matched = actual.diagnostics?.find(
    ({ code, category }) => code === expected.code && category === expected.expect,
  );
  if (actual.outcome !== "invalid" || matched === undefined) {
    fail("OFFICIAL_SUITE_OUTCOME_MISMATCH", `${label} did not produce ${expected.code}.`, {
      expected,
      actual,
    });
  }
  return Object.freeze({ code: matched.code, category: matched.category });
}

function renderObservedTranscript(cases) {
  const vectors = cases.filter(({ family }) => family === "conformance-vector");
  const examples = cases.filter(({ family }) => family === "public-example");
  const lines = cases.map((entry) => {
    if (entry.family === "public-example") return `PASS example ${entry.file}`;
    return entry.outcome === "valid"
      ? `PASS ${entry.file} (valid)`
      : `PASS ${entry.file} (${entry.category}/${entry.code})`;
  });
  lines.push(
    "",
    `${String(cases.length)} suite cases passed, 0 failed (${String(vectors.length)} vectors, ${String(examples.length)} examples)`,
  );
  return Buffer.from(`${lines.join("\n")}\n`);
}

async function verifyOfficialSuite({
  suiteRoot,
  protocolApi,
  validatorApi,
  catalogDigestMatches,
  observedTranscriptTransform,
  oracleSemantic,
}) {
  const conformanceRoot = path.join(suiteRoot, "conformance");
  const examplesRoot = path.join(suiteRoot, "examples");
  const manifest = await readJson(path.join(conformanceRoot, "vectors.json"));
  assertJsonEqual(
    manifest,
    EXPECTED_MANIFEST,
    "Official conformance manifest",
    "OFFICIAL_SUITE_MANIFEST_DRIFT",
  );

  const conformanceCatalog = await readJson(path.join(conformanceRoot, manifest.catalog));
  const exampleCatalog = await readJson(path.join(examplesRoot, EXPECTED_EXAMPLES[0].file));
  const conformanceCatalogs = [conformanceCatalog];
  const exampleCatalogs = [exampleCatalog];
  const conformanceCatalogSet = createCatalogSet(
    validatorApi,
    conformanceCatalogs,
    "Official conformance catalog",
  );
  const exampleCatalogSet = createCatalogSet(
    validatorApi,
    exampleCatalogs,
    "Official example catalog",
  );
  const cases = [];
  const expectedSemantic = [];
  const actualSemantic = [];

  for (const vector of manifest.vectors) {
    const document = await readJson(path.join(conformanceRoot, vector.file));
    const actual = validateOfficialCase({
      validatorApi,
      protocolApi,
      target: vector.target,
      document,
      catalogSet: conformanceCatalogSet,
      catalogDigestMatches,
    });
    const matched = assertCaseOutcome(
      actual,
      vector.expect === "valid" ? "valid" : vector,
      vector.file,
    );
    const expectedRecord = semanticRecord({
      family: "conformance-vector",
      file: vector.file,
      target: vector.target,
      expected: vector.expect === "valid" ? "valid" : vector,
    });
    const actualRecord = Object.freeze({
      family: expectedRecord.family,
      file: vector.file,
      target: vector.target,
      outcome: actual.outcome,
      ...(actual.outcome === "valid" ? {} : { category: matched.category, code: matched.code }),
    });
    expectedSemantic.push(expectedRecord);
    actualSemantic.push(actualRecord);
    cases.push(
      Object.freeze({
        ...actualRecord,
        result: "PASS",
        matchedBy: actual.matchedBy,
        diagnostics: actual.diagnostics,
      }),
    );
  }

  for (const example of EXPECTED_EXAMPLES) {
    const document = await readJson(path.join(examplesRoot, example.file));
    const actual = validateOfficialCase({
      validatorApi,
      protocolApi,
      target: example.target,
      document,
      catalogSet: exampleCatalogSet,
      catalogDigestMatches,
    });
    assertCaseOutcome(actual, "valid", `example ${example.file}`);
    const record = semanticRecord({
      family: "public-example",
      file: example.file,
      target: example.target,
      expected: "valid",
    });
    expectedSemantic.push(record);
    actualSemantic.push(record);
    cases.push(
      Object.freeze({
        ...record,
        result: "PASS",
        matchedBy: actual.matchedBy,
        diagnostics: actual.diagnostics,
      }),
    );
  }

  if (cases.length !== 14) fail("OFFICIAL_SUITE_COUNT_DRIFT", "Official suite case count changed.");
  const targetCounts = Object.fromEntries(
    Object.keys(EXPECTED_TARGET_COUNTS).map((target) => [
      target,
      cases.filter((entry) => entry.target === target).length,
    ]),
  );
  assertJsonEqual(
    targetCounts,
    EXPECTED_TARGET_COUNTS,
    "Official target counts",
    "OFFICIAL_SUITE_COUNT_DRIFT",
  );
  const negativeCategoryCounts = Object.fromEntries(
    Object.keys(EXPECTED_NEGATIVE_CATEGORY_COUNTS).map((category) => [
      category,
      cases.filter((entry) => entry.category === category).length,
    ]),
  );
  assertJsonEqual(
    negativeCategoryCounts,
    EXPECTED_NEGATIVE_CATEGORY_COUNTS,
    "Official negative-category counts",
    "OFFICIAL_SUITE_COUNT_DRIFT",
  );

  assertJsonEqual(
    expectedSemantic,
    oracleSemantic,
    "Manifest and frozen Python semantic records",
    "OFFICIAL_SUITE_SEMANTIC_PARITY_MISMATCH",
  );
  const expectedBytes = Buffer.from(protocolApi.canonicalizeJsonBytes(oracleSemantic));
  const actualBytes = Buffer.from(protocolApi.canonicalizeJsonBytes(actualSemantic));
  if (!actualBytes.equals(expectedBytes)) {
    fail(
      "OFFICIAL_SUITE_SEMANTIC_PARITY_MISMATCH",
      "Structured suite outcomes differ from the frozen oracle.",
      {
        expectedSha256: sha256(expectedBytes),
        actualSha256: sha256(actualBytes),
      },
    );
  }
  const observedTranscript = renderObservedTranscript(cases);
  const transcript = Buffer.from(
    observedTranscriptTransform === undefined
      ? observedTranscript
      : observedTranscriptTransform(Buffer.from(observedTranscript), Object.freeze([...cases])),
  );
  return Object.freeze({
    cases: Object.freeze(cases),
    targetCounts: Object.freeze(targetCounts),
    negativeCategoryCounts: Object.freeze(negativeCategoryCounts),
    semanticBytes: expectedBytes.length,
    expectedSemanticSha256: sha256(expectedBytes),
    actualSemanticSha256: sha256(actualBytes),
    transcript,
  });
}

async function trackedFiles(suiteRoot) {
  const fixturePaths = [
    "conformance/vectors.json",
    ...EXPECTED_MANIFEST.vectors.map(({ file }) => `conformance/${file}`),
    ...EXPECTED_EXAMPLES.map(({ file }) => `examples/${file}`),
  ];
  const entries = [];
  for (const relativePath of FIXED_TRACKED_PATHS) {
    const bytes = await readFile(path.join(WORKSPACE_ROOT, relativePath));
    entries.push({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
  }
  for (const relativePath of fixturePaths) {
    const bytes = await readFile(path.join(suiteRoot, ...relativePath.split("/")));
    entries.push({
      path: `packages/protocol/upstream/0.1.0/snapshot/${relativePath}`,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  return Object.freeze(entries.sort((left, right) => compareText(left.path, right.path)));
}

async function assertArtifactDestinationEntry(artifactPath) {
  try {
    const entry = await lstat(artifactPath);
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail(
        "OFFICIAL_SUITE_ARTIFACT_UNSUPPORTED_ENTRY",
        "The parity artifact destination must be absent or a regular file.",
      );
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function resolveWritableArtifactPath(artifactPath) {
  const absolute = path.resolve(artifactPath);
  const parent = path.dirname(absolute);
  const parentEntry = await lstat(parent);
  if (parentEntry.isSymbolicLink() || !parentEntry.isDirectory()) {
    fail(
      "OFFICIAL_SUITE_ARTIFACT_UNSUPPORTED_ENTRY",
      "The parity artifact parent must be a real directory.",
    );
  }
  const resolvedParent = await realpath(parent);
  const resolvedArtifactPath = path.join(resolvedParent, path.basename(absolute));
  await assertArtifactDestinationEntry(resolvedArtifactPath);
  return Object.freeze({ resolvedArtifactPath, resolvedParent });
}

async function openExclusiveTemporary(parent, basename) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const temporaryPath = path.join(
      parent,
      `.${basename}.${String(process.pid)}.${randomBytes(8).toString("hex")}.tmp`,
    );
    try {
      return { handle: await open(temporaryPath, "wx", 0o600), temporaryPath };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  fail("OFFICIAL_SUITE_ARTIFACT_TEMPORARY_CREATE_FAILED", "Could not reserve a temporary file.");
}

async function removeTemporary(temporaryPath) {
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/** Builds deterministic M02-T12 official-suite parity evidence entirely in memory. */
export async function buildProtocolOfficialSuiteParityEvidence({
  suiteRoot = DEFAULT_SNAPSHOT_ROOT,
  validationBaselinePath = DEFAULT_PROTOCOL_OFFICIAL_SUITE_BASELINE_PATH,
  checksumBaselinePath = DEFAULT_PROTOCOL_OFFICIAL_SUITE_CHECKSUM_BASELINE_PATH,
  tracePath = DEFAULT_PROTOCOL_OFFICIAL_SUITE_TRACE_PATH,
  canonicalizationArtifactPath = DEFAULT_PROTOCOL_CANONICALIZATION_ARTIFACT_PATH,
  executionContractsArtifactPath = DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_ARTIFACT_PATH,
  protocolApi,
  validatorApi,
  catalogDigestMatches,
  observedTranscriptTransform,
  verifySnapshot = true,
} = {}) {
  const snapshot = verifySnapshot
    ? await verifyProtocolSnapshot(suiteRoot)
    : EXPECTED_PROTOCOL_SNAPSHOT;
  const loadedApis =
    protocolApi === undefined || validatorApi === undefined ? await loadPublicApis() : undefined;
  const activeProtocolApi = protocolApi ?? loadedApis.protocolApi;
  const activeValidatorApi = validatorApi ?? loadedApis.validatorApi;
  const publicApi = verifyPublicApis(activeProtocolApi, activeValidatorApi);
  const commandWiring = await verifyCommandWiring();
  const [validationBytes, checksumBytes, canonicalization, executionContracts, traceability] =
    await Promise.all([
      readFile(validationBaselinePath),
      readFile(checksumBaselinePath),
      verifyPrerequisite({ artifactPath: canonicalizationArtifactPath, kind: "canonicalization" }),
      verifyPrerequisite({
        artifactPath: executionContractsArtifactPath,
        kind: "execution-contracts",
      }),
      verifyTraceability(tracePath),
    ]);
  const validationBaseline = parseValidationBaseline(validationBytes);
  const checksumBaseline = parseChecksumBaseline(checksumBytes);
  const suite = await verifyOfficialSuite({
    suiteRoot,
    protocolApi: activeProtocolApi,
    validatorApi: activeValidatorApi,
    catalogDigestMatches,
    observedTranscriptTransform,
    oracleSemantic: validationBaseline.semanticRecords,
  });
  if (!suite.transcript.equals(validationBaseline.transcript)) {
    fail(
      "OFFICIAL_SUITE_TRANSCRIPT_PARITY_MISMATCH",
      "TypeScript and frozen Python transcripts differ byte-for-byte.",
      {
        expectedSha256: sha256(validationBaseline.transcript),
        actualSha256: sha256(suite.transcript),
      },
    );
  }
  const files = await trackedFiles(suiteRoot);
  const vectors = suite.cases.filter(({ family }) => family === "conformance-vector");
  const examples = suite.cases.filter(({ family }) => family === "public-example");
  const valid = suite.cases.filter(({ outcome }) => outcome === "valid").length;
  const invalid = suite.cases.length - valid;

  const artifact = {
    schemaVersion: 1,
    task: "M02-T12",
    profile: "desen-official-suite-parity-v1",
    protocolVersion: "0.1.0",
    result: "PASS",
    frozenInput: {
      sourceCommit: snapshot.sourceCommit,
      sourceTree: snapshot.sourceTree,
      aggregateSha256: snapshot.aggregateSha256,
      validationBaseline: {
        path: "docs/proof/baselines/protocol-0.1.0-validation.txt",
        bytes: validationBaseline.bytes,
        sha256: validationBaseline.sha256,
        execution: "not rerun; archived Python oracle",
      },
      checksumBaseline: {
        path: "docs/proof/baselines/protocol-0.1.0-checksums.txt",
        bytes: checksumBaseline.bytes,
        sha256: checksumBaseline.sha256,
      },
    },
    prerequisites: { canonicalization, executionContracts },
    traceability,
    suite: {
      composition: {
        cases: suite.cases.length,
        conformanceVectors: vectors.length,
        publicExamples: examples.length,
        valid,
        invalid,
      },
      targets: suite.targetCounts,
      negativeCategories: suite.negativeCategoryCounts,
      cases: suite.cases,
      semanticParity: {
        encoding: "RFC 8785 canonical JSON UTF-8",
        bytes: suite.semanticBytes,
        expectedSha256: suite.expectedSemanticSha256,
        actualSha256: suite.actualSemanticSha256,
        byteEqual: true,
      },
      transcriptParity: {
        normalization: "14 PASS lines + blank line + summary + LF",
        bytes: suite.transcript.length,
        expectedSha256: sha256(validationBaseline.transcript),
        actualSha256: sha256(suite.transcript),
        byteEqual: true,
      },
      supplements: [
        {
          code: "REVISION_MISMATCH",
          category: "integrity_error",
          mechanism: "calculateDesenBundleRevision(bundle) !== bundle.revision",
          scope: "official Bundle cases only",
        },
        {
          code: "CATALOG_DIGEST_MISMATCH",
          category: "activation_error",
          mechanism: "exact (id, version, target) requirement digest !== catalog packageDigest",
          scope: "official Bundle cases only",
        },
      ],
    },
    implementation: {
      packages: ["@desen/protocol", "@desen/validator"],
      publicApi,
      trackedFiles: files,
    },
    verification: {
      commands: [
        "pnpm generate:protocol-official-suite-parity",
        "pnpm verify:protocol-official-suite-parity",
        "pnpm test:protocol-official-suite-parity",
        "pnpm check",
      ],
      commandWiring,
      artifactWriter: {
        parentResolution: "realpath",
        temporaryFile: "same-directory exclusive create",
        durabilityBeforeCommit: "file sync",
        commit: "atomic rename",
        failureCleanup: "temporary file removed",
      },
      independentAnchors: [
        "exact M02-T04 and M02-T11 verifier PASS plus prerequisite bytes",
        "frozen snapshot commit, tree, aggregate, validation transcript, and checksum transcript",
        "exact 9-vector manifest order and exact five-example order",
        "built public APIs routed across Source, Bundle, and Catalog",
        "RFC 8785 canonical structured outcome byte parity",
        "normalized TypeScript/Python transcript byte parity",
        "narrow proof-only Bundle revision and catalog-digest supplements",
      ],
    },
    limitations: [
      "The archived Python baseline is not executed by pnpm check; parity remains hermetic and deterministic.",
      "Negative parity claims only expected category/code presence, not diagnostic message, pointer, order, or multiplicity parity.",
      "Exhaustive diagnostic micro-vectors and exact portable diagnostic results remain M02-T13.",
      "The proof-only supplements are not production activation APIs and do not execute adapters or runtime behavior.",
      "This M02-T12 artifact alone does not claim publication, package activation, G02 completion, or a complete P-02 result; the separate M02-T13 evidence is also required.",
    ],
  };
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Writes current evidence only outside the immutable tracked M02-T12 artifact path. */
export async function writeProtocolOfficialSuiteParityEvidence({
  artifactPath = DEFAULT_PROTOCOL_OFFICIAL_SUITE_PARITY_ARTIFACT_PATH,
  beforeAtomicRename,
} = {}) {
  if (
    path.resolve(artifactPath) ===
    path.resolve(DEFAULT_PROTOCOL_OFFICIAL_SUITE_PARITY_ARTIFACT_PATH)
  ) {
    return authenticateHistoricalArtifact(artifactPath);
  }
  const { resolvedArtifactPath, resolvedParent } = await resolveWritableArtifactPath(artifactPath);
  const result = await buildProtocolOfficialSuiteParityEvidence();
  const { handle, temporaryPath } = await openExclusiveTemporary(
    resolvedParent,
    path.basename(resolvedArtifactPath),
  );
  let openHandle = handle;
  try {
    await openHandle.writeFile(result.artifactBytes);
    await openHandle.sync();
    await openHandle.close();
    openHandle = undefined;
    if (beforeAtomicRename !== undefined) {
      await beforeAtomicRename(
        Object.freeze({ artifactPath: resolvedArtifactPath, temporaryPath }),
      );
    }
    await assertArtifactDestinationEntry(resolvedArtifactPath);
    await rename(temporaryPath, resolvedArtifactPath);
    return result;
  } catch (error) {
    if (openHandle !== undefined) {
      try {
        await openHandle.close();
      } catch {
        // Preserve the primary writer failure.
      }
    }
    try {
      await removeTemporary(temporaryPath);
    } catch (cleanupError) {
      fail(
        "OFFICIAL_SUITE_ARTIFACT_TEMPORARY_CLEANUP_FAILED",
        "Parity evidence failed and its temporary file could not be removed.",
        {
          writerError: error instanceof Error ? error.message : String(error),
          cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        },
      );
    }
    throw error;
  }
}

/** Authenticates immutable task-time M02-T12 evidence without rebuilding successor source. */
export async function verifyProtocolOfficialSuiteParity({
  artifactPath = DEFAULT_PROTOCOL_OFFICIAL_SUITE_PARITY_ARTIFACT_PATH,
  artifactBytes,
} = {}) {
  const result = await authenticateHistoricalArtifact(artifactPath, artifactBytes);
  return Object.freeze({
    result: "PASS",
    compatibilityMode: "immutable-task-time-artifact",
    cases: result.artifact.suite.composition.cases,
    conformanceVectors: result.artifact.suite.composition.conformanceVectors,
    publicExamples: result.artifact.suite.composition.publicExamples,
    valid: result.artifact.suite.composition.valid,
    invalid: result.artifact.suite.composition.invalid,
    source: result.artifact.suite.targets.source,
    bundle: result.artifact.suite.targets.bundle,
    catalog: result.artifact.suite.targets.catalog,
    semanticByteEqual: result.artifact.suite.semanticParity.byteEqual,
    transcriptByteEqual: result.artifact.suite.transcriptParity.byteEqual,
    supplements: result.artifact.suite.supplements.length,
    artifactSha256: result.artifactSha256,
  });
}
