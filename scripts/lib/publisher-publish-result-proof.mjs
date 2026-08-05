import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import {
  getPublisherDiagnosticDefinition,
  INVALID_SOURCE_JSON_CODE,
  isPublisherDiagnosticCode,
  PUBLISH_PIPELINE_STAGES,
  PUBLISH_SOURCE_JSON_LIMITS,
  PUBLISHER_DIAGNOSTIC_REGISTRY,
  SOURCE_LIMIT_EXCEEDED_CODE,
} from "../../packages/publisher/dist/index.js";
import { parseSourceJson } from "../../packages/publisher/dist/source-json.js";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/publisher-0.1.0-publish-result.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/PUBLISHER-PUBLISH-RESULT.md";
const PROOF_MATRIX_RELATIVE_PATH = "docs/proof/PROOF-MATRIX.md";
const TRACE_RELATIVE_PATH = "docs/proof/protocol-0.1.0-traceability.json";
const IMPLEMENTATION_GUIDE_RELATIVE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/IMPLEMENTATION-GUIDE.md";
const CANONICALIZATION_PROOF_RELATIVE_PATH = "docs/proof/PROTOCOL-CANONICALIZATION.md";
const FINDINGS_RELATIVE_PATH = "docs/plan/PROTOCOL-FINDINGS.md";
const PREREQUISITE_RELATIVE_PATH =
  "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json";
const PREREQUISITE_SHA256 = "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89";

/** Absolute destination for deterministic M06-T01 evidence. */
export const DEFAULT_PUBLISHER_PUBLISH_RESULT_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute human-readable M06-T01 proof path. */
export const DEFAULT_PUBLISHER_PUBLISH_RESULT_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_RELATIVE_PATH,
);

/** Absolute Proof Matrix path carrying the exact M06-T01 artifact pin. */
export const DEFAULT_PUBLISHER_PUBLISH_RESULT_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_RELATIVE_PATH,
);

const EXPECTED_PIPELINE_STAGES = Object.freeze([
  "json-parse",
  "source-schema",
  "embedded-schema",
  "source-semantics",
  "catalog-resolution",
  "catalog-integrity",
  "namespace-conflicts",
  "capability-contracts",
  "state-and-control-flow",
  "binding-compatibility",
  "source-digest",
  "authoring-removal",
  "normalization",
  "catalog-pinning",
  "bundle-validation",
  "bundle-revision",
]);

const EXPECTED_DIAGNOSTIC_REGISTRY = Object.freeze([
  Object.freeze({
    code: "run.desen.publisher/INVALID_SOURCE_JSON",
    meaning: "Raw Source input is not interoperable JSON.",
    defaultStage: "json-parse",
    defaultSeverity: "error",
  }),
  Object.freeze({
    code: "run.desen.publisher/SOURCE_LIMIT_EXCEEDED",
    meaning: "Raw Source parsing exceeded the finite Publisher profile.",
    defaultStage: "json-parse",
    defaultSeverity: "error",
  }),
]);

const EXPECTED_SOURCE_LIMITS = Object.freeze({
  maxSourceUtf8Bytes: 8_388_608,
  maxJsonDepth: 256,
  maxJsonValueOccurrences: 262_144,
  maxDecodedStringCodeUnits: 4_194_304,
  maxNumberTokenCodeUnits: 1_024,
});

const PUBLIC_RUNTIME_EXPORTS = Object.freeze([
  "getPublisherDiagnosticDefinition",
  "INVALID_SOURCE_JSON_CODE",
  "isPublisherDiagnosticCode",
  "PUBLISH_PIPELINE_STAGES",
  "PUBLISH_SOURCE_JSON_LIMITS",
  "PUBLISHER_DIAGNOSTIC_REGISTRY",
  "SOURCE_LIMIT_EXCEEDED_CODE",
]);

const PUBLIC_TYPE_EXPORTS = Object.freeze([
  "PublishCoreDiagnostic",
  "PublishDiagnostic",
  "PublishDiagnosticSeverity",
  "PublishErrorDiagnostic",
  "PublishExtensionDiagnostic",
  "PublishExtensionDiagnosticCode",
  "PublishFailure",
  "PublishPipelineStage",
  "PublisherDiagnosticCode",
  "PublisherDiagnosticDefinition",
  "PublisherExtensionDiagnosticCode",
  "PublishResult",
  "PublishSourceJsonLimits",
  "PublishSuccess",
  "PublishWarningDiagnostic",
]);

const PUBLIC_RUNTIME_EXPORT_SOURCES = Object.freeze({
  getPublisherDiagnosticDefinition: "./publish-result.js",
  INVALID_SOURCE_JSON_CODE: "./publish-result.js",
  isPublisherDiagnosticCode: "./publish-result.js",
  PUBLISH_PIPELINE_STAGES: "./publish-result.js",
  PUBLISH_SOURCE_JSON_LIMITS: "./source-json.js",
  PUBLISHER_DIAGNOSTIC_REGISTRY: "./publish-result.js",
  SOURCE_LIMIT_EXCEEDED_CODE: "./publish-result.js",
});

const PUBLIC_TYPE_EXPORT_SOURCES = Object.freeze({
  PublishCoreDiagnostic: "./publish-result.js",
  PublishDiagnostic: "./publish-result.js",
  PublishDiagnosticSeverity: "./publish-result.js",
  PublishErrorDiagnostic: "./publish-result.js",
  PublishExtensionDiagnostic: "./publish-result.js",
  PublishExtensionDiagnosticCode: "./publish-result.js",
  PublishFailure: "./publish-result.js",
  PublishPipelineStage: "./publish-result.js",
  PublisherDiagnosticCode: "./publish-result.js",
  PublisherDiagnosticDefinition: "./publish-result.js",
  PublisherExtensionDiagnosticCode: "./publish-result.js",
  PublishResult: "./publish-result.js",
  PublishSourceJsonLimits: "./source-json.js",
  PublishSuccess: "./publish-result.js",
  PublishWarningDiagnostic: "./publish-result.js",
});

const VERIFIED_PRODUCTION_PATHS = Object.freeze([
  "packages/publisher/src/publish-result.ts",
  "packages/publisher/src/publish-diagnostics.ts",
  "packages/publisher/src/source-json.ts",
]);

const G05_COMPATIBILITY_OWNERSHIP_PATHS = Object.freeze([
  "scripts/generate-reference-host-web-source-audit-proof.mjs",
  "scripts/lib/reference-host-web-source-audit-proof.mjs",
  "scripts/verify-reference-host-web-source-audit.mjs",
  "tests/reference-host-web-source-audit.test.mjs",
]);

const TRACKED_EVIDENCE_PATHS = Object.freeze([
  "packages/publisher/test/publish-result.test.ts",
  "packages/publisher/test/publish-result.types.ts",
  ...G05_COMPATIBILITY_OWNERSHIP_PATHS,
  "scripts/lib/publisher-publish-result-proof.mjs",
  "scripts/generate-publisher-publish-result-proof.mjs",
  "scripts/verify-publisher-publish-result.mjs",
  "tests/publisher-publish-result.test.mjs",
]);

/**
 * Immutable M06-T01 receipts for evidence readers that legitimately evolve after task completion.
 *
 * The current M05 reader and root test are authenticated against the closed reviewed-successor
 * histories below before these historical records are emitted. The T01 reader and root test
 * cannot self-authenticate their current bytes without a circular receipt, so later checkpoints
 * externally anchor their current files while this reader preserves the exact task-time artifact
 * projection.
 */
const HISTORICAL_TRACKED_RECEIPTS = Object.freeze({
  "scripts/lib/reference-host-web-source-audit-proof.mjs": Object.freeze({
    bytes: 228_873,
    sha256: "5f3ee52f48e19e8ccefc6f64b07e73e2fe04aa8edb17deb389f0bfbaf4def2d1",
  }),
  "tests/reference-host-web-source-audit.test.mjs": Object.freeze({
    bytes: 70_344,
    sha256: "268d8ccec567fb05f07a24746d227ddd76d672525768c2b92faff747a870575f",
  }),
  "scripts/lib/publisher-publish-result-proof.mjs": Object.freeze({
    bytes: 49_227,
    sha256: "11dd9ea20b2607527a4846296b82a12ae6e754bd35884a9211177d5978591649",
  }),
  "tests/publisher-publish-result.test.mjs": Object.freeze({
    bytes: 14_115,
    sha256: "fae2e18ee715e2eebd2b261627adcb33786eaa90f4c4e33d145cf666a2b4e076",
  }),
});

const REVIEWED_G05_COMPATIBILITY_RECEIPT_HISTORY = Object.freeze({
  "scripts/lib/reference-host-web-source-audit-proof.mjs": Object.freeze([
    Object.freeze({
      task: "M07-T03",
      bytes: 246_554,
      sha256: "2bf728948372d8366f7badc7f2d7a36f6b8799b0dcc45baef92c29c90bdd2114",
    }),
    Object.freeze({
      task: "M07-T04",
      bytes: 252_188,
      sha256: "94d1d9f02af9d564ebe4dd2c5b36fc0f7bab4d28cad87ca144ddb41756dd1c17",
    }),
  ]),
  "tests/reference-host-web-source-audit.test.mjs": Object.freeze([
    Object.freeze({
      task: "M07-T03",
      bytes: 81_283,
      sha256: "499888c12d43b62d81a0cdaaf0c6248bfb0b7956eca9cce3c478d0ab7f39b5cd",
    }),
    Object.freeze({
      task: "M07-T04",
      bytes: 83_937,
      sha256: "1690d26b0a301b2528413b4bcfa9fc2e3f32171db284e6fced82726669c16840",
    }),
  ]),
});

const EXPECTED_TEST_INVENTORY = Object.freeze({
  packageTests: 13,
  compilerNegativeCases: 9,
  rootMutationTests: 12,
});

const REQUIRED_PRODUCTION_DEPENDENCIES = Object.freeze({
  "@desen/protocol": "workspace:*",
  "@desen/validator": "workspace:*",
});

const EXPECTED_COMPILER_CONFIGURATION = Object.freeze({
  base: Object.freeze({
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    noCheck: false,
    noEmit: true,
    module: "ESNext",
    moduleResolution: "Bundler",
    target: "ES2023",
    lib: Object.freeze(["ES2023"]),
    verbatimModuleSyntax: true,
  }),
  package: Object.freeze({
    extends: "../../tsconfig.base.json",
    compilerOptionKeys: Object.freeze(["types"]),
    noCheck: false,
    types: Object.freeze([]),
    include: Object.freeze(["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]),
    exclude: Object.freeze([]),
    files: null,
  }),
  build: Object.freeze({
    extends: "./tsconfig.json",
    compilerOptionKeys: Object.freeze([
      "declaration",
      "declarationMap",
      "noEmit",
      "outDir",
      "rootDir",
      "sourceMap",
    ]),
    noCheck: false,
    compilerOptions: Object.freeze({
      declaration: true,
      declarationMap: true,
      noEmit: false,
      outDir: "dist",
      rootDir: "src",
      sourceMap: true,
    }),
    include: Object.freeze(["src/**/*.ts", "src/**/*.tsx"]),
    exclude: Object.freeze(["test/**/*", "**/*.test.ts", "**/*.test.tsx"]),
    files: null,
  }),
  effective: Object.freeze({
    typecheck: Object.freeze({
      noCheck: false,
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
      requiredFiles: Object.freeze([
        "packages/publisher/src/index.ts",
        "packages/publisher/src/publish-diagnostics.ts",
        "packages/publisher/src/publish-result.ts",
        "packages/publisher/src/source-json.ts",
        "packages/publisher/test/publish-result.test.ts",
        "packages/publisher/test/publish-result.types.ts",
      ]),
    }),
    build: Object.freeze({
      noCheck: false,
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      noEmit: false,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      rootDir: "packages/publisher/src",
      outDir: "packages/publisher/dist",
      requiredFiles: Object.freeze([
        "packages/publisher/src/index.ts",
        "packages/publisher/src/publish-diagnostics.ts",
        "packages/publisher/src/publish-result.ts",
        "packages/publisher/src/source-json.ts",
      ]),
      testFiles: Object.freeze([]),
    }),
  }),
});

const REQUIRED_WORKSPACE_SCRIPTS = Object.freeze({
  "generate:publisher-publish-result":
    "pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:publish-result && node scripts/generate-publisher-publish-result-proof.mjs",
  "verify:publisher-publish-result":
    "pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:publish-result && node scripts/verify-publisher-publish-result.mjs",
  "test:publisher-publish-result":
    "pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:publish-result && node --test tests/publisher-publish-result.test.mjs",
});

const ROOT_POINTER = "";

/** Controlled M06-T01 evidence failure with a stable internal code. */
export class PublisherPublishResultEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PublisherPublishResultEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new PublisherPublishResultEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exact(actual, expected, code, message) {
  if (!isDeepStrictEqual(actual, expected)) fail(code, message, { expected, actual });
}

function splitScript(script) {
  return typeof script === "string" ? script.split(" && ").map((step) => step.trim()) : [];
}

const BUILD_OPTION_KEYS = new Set([
  "baseTsconfig",
  "canonicalizationText",
  "compilerTypeSource",
  "declarationIndexSource",
  "findingText",
  "guard",
  "guideText",
  "indexSource",
  "lookup",
  "packageTestSource",
  "parser",
  "pipelineStages",
  "prerequisiteBytes",
  "productionSource",
  "publisherBuildTsconfig",
  "publisherPackage",
  "publisherTsconfig",
  "registry",
  "rootTestSource",
  "snapshotRoot",
  "sourceLimits",
  "trace",
  "trackedFileBytes",
  "verifySnapshot",
  "workspacePackage",
]);
const TRACKED_FILE_OVERRIDE_PATHS = new Set(
  Object.keys(REVIEWED_G05_COMPATIBILITY_RECEIPT_HISTORY),
);
const SAFE_ARRAY_BUFFER_IS_VIEW = ArrayBuffer.isView;
const SAFE_ARRAY_BUFFER_PROTOTYPE = ArrayBuffer.prototype;
const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_BUFFER_FROM = Buffer.from.bind(Buffer);
const SAFE_NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const SAFE_OBJECT_CREATE = Object.create;
const SAFE_OBJECT_ENTRIES = Object.entries;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_HAS_OWN = Object.hasOwn;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_UINT8_ARRAY = Uint8Array;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;
const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;

function captureOwnDataRecord(value, allowedKeys, label) {
  let validRecord = false;
  try {
    if (value !== null && typeof value === "object" && !SAFE_ARRAY_IS_ARRAY(value)) {
      const prototype = SAFE_OBJECT_GET_PROTOTYPE_OF(value);
      validRecord = prototype === SAFE_OBJECT_PROTOTYPE || prototype === null;
    }
  } catch {
    fail("PUBLISHER_OPTIONS_INVALID", `${label} could not be inspected safely.`);
  }
  if (!validRecord) {
    fail("PUBLISHER_OPTIONS_INVALID", `${label} must be a plain own-data record.`);
  }
  let keys;
  try {
    keys = SAFE_REFLECT_OWN_KEYS(value);
  } catch {
    fail("PUBLISHER_OPTIONS_INVALID", `${label} could not be inspected safely.`);
  }
  const captured = SAFE_OBJECT_CREATE(null);
  for (const key of keys) {
    if (typeof key !== "string" || !allowedKeys.has(key)) {
      fail("PUBLISHER_OPTIONS_INVALID", `${label} contains an unsupported field.`);
    }
    let descriptor;
    try {
      descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    } catch {
      fail("PUBLISHER_OPTIONS_INVALID", `${label} could not be inspected safely.`);
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail("PUBLISHER_OPTIONS_INVALID", `${label} must contain only enumerable own data.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function captureExactBytes(value, label) {
  try {
    if (
      !SAFE_ARRAY_BUFFER_IS_VIEW(value) ||
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
      TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined ||
      TYPED_ARRAY_TAG_GETTER === undefined
    ) {
      throw new TypeError();
    }
    const tag = SAFE_REFLECT_APPLY(TYPED_ARRAY_TAG_GETTER, value, []);
    const buffer = SAFE_REFLECT_APPLY(TYPED_ARRAY_BUFFER_GETTER, value, []);
    const byteLength = SAFE_REFLECT_APPLY(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    const byteOffset = SAFE_REFLECT_APPLY(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
    if (
      tag !== "Uint8Array" ||
      SAFE_OBJECT_GET_PROTOTYPE_OF(buffer) !== SAFE_ARRAY_BUFFER_PROTOTYPE ||
      !SAFE_NUMBER_IS_SAFE_INTEGER(byteLength) ||
      !SAFE_NUMBER_IS_SAFE_INTEGER(byteOffset) ||
      byteLength < 0 ||
      byteOffset < 0
    ) {
      throw new TypeError();
    }
    return SAFE_BUFFER_FROM(new SAFE_UINT8_ARRAY(buffer, byteOffset, byteLength));
  } catch {
    fail("PUBLISHER_OPTIONS_INVALID", `${label} must be exact unshared Uint8Array bytes.`);
  }
}

function captureBuildOptions(value) {
  if (value === undefined) return SAFE_OBJECT_FREEZE(SAFE_OBJECT_CREATE(null));
  const captured = captureOwnDataRecord(value, BUILD_OPTION_KEYS, "Evidence options");
  if (captured.trackedFileBytes !== undefined) {
    const rawOverrides = captureOwnDataRecord(
      captured.trackedFileBytes,
      TRACKED_FILE_OVERRIDE_PATHS,
      "trackedFileBytes",
    );
    const overrides = SAFE_OBJECT_CREATE(null);
    for (const [relativePath, bytes] of SAFE_OBJECT_ENTRIES(rawOverrides)) {
      overrides[relativePath] = captureExactBytes(bytes, `trackedFileBytes.${relativePath}`);
    }
    captured.trackedFileBytes = SAFE_OBJECT_FREEZE(overrides);
  }
  return SAFE_OBJECT_FREEZE(captured);
}

async function readRegularFile(filePath, missingCode, unsafeCode) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail(missingCode, `Required evidence input is missing: ${filePath}`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(unsafeCode, `Evidence input must be a regular non-symlink file: ${filePath}`);
  }
  return readFile(filePath);
}

const PRIVATE_PARSER_EXPORTS = new Set([
  "parseSourceJson",
  "PublishJsonValue",
  "SourceJsonParseResult",
]);

function exportInventory(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(
      "PUBLISHER_PUBLIC_API_DRIFT",
      `${fileName} is not a syntactically valid TypeScript export surface.`,
    );
  }
  const records = [];

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (
        statement.exportClause === undefined ||
        !ts.isNamedExports(statement.exportClause) ||
        statement.moduleSpecifier === undefined ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        fail(
          "PUBLISHER_PARTIAL_API_EXPOSED",
          `${fileName} may expose only explicit named re-exports from one literal module.`,
        );
      }
      const module = statement.moduleSpecifier.text;
      for (const element of statement.exportClause.elements) {
        records.push(
          Object.freeze({
            imported: element.propertyName?.text ?? element.name.text,
            exported: element.name.text,
            module,
            typeOnly: statement.isTypeOnly || element.isTypeOnly,
          }),
        );
      }
      continue;
    }

    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (exported || ts.isExportAssignment(statement)) {
      fail(
        "PUBLISHER_PUBLIC_API_DRIFT",
        `${fileName} must keep package exports as explicit named module re-exports.`,
      );
    }
  }
  return Object.freeze(records);
}

function verifyExpectedExportSlice(records, expectedSources, typeOnly, fileName) {
  for (const [name, module] of Object.entries(expectedSources)) {
    const occurrences = records.filter(
      (record) => record.imported === name || record.exported === name,
    );
    if (
      occurrences.length !== 1 ||
      occurrences[0].imported !== name ||
      occurrences[0].exported !== name ||
      occurrences[0].module !== module ||
      occurrences[0].typeOnly !== typeOnly
    ) {
      fail(
        "PUBLISHER_PUBLIC_API_DRIFT",
        `${fileName} must expose the reviewed M06-T01 ${typeOnly ? "type" : "runtime"} ${name} exactly once from ${module}.`,
        { occurrences },
      );
    }
  }
}

function verifyPublicApi(indexSource, declarationIndexSource) {
  for (const [sourceText, fileName] of [
    [indexSource, "src/index.ts"],
    [declarationIndexSource, "dist/index.d.ts"],
  ]) {
    const records = exportInventory(sourceText, fileName);
    const unexpectedSourceJsonExport = records.find(
      ({ exported, module, typeOnly }) =>
        module === "./source-json.js" &&
        (typeOnly
          ? exported !== "PublishSourceJsonLimits"
          : exported !== "PUBLISH_SOURCE_JSON_LIMITS"),
    );
    const unexpectedDiagnosticHelperExport = records.find(
      ({ module }) => module === "./publish-diagnostics.js",
    );
    if (
      unexpectedSourceJsonExport !== undefined ||
      unexpectedDiagnosticHelperExport !== undefined ||
      records.some(
        ({ imported, exported }) =>
          PRIVATE_PARSER_EXPORTS.has(imported) || PRIVATE_PARSER_EXPORTS.has(exported),
      )
    ) {
      fail(
        "PUBLISHER_PARTIAL_API_EXPOSED",
        `${fileName} exposed a package-private Publisher stage value, including through an alias.`,
        { unexpectedSourceJsonExport, unexpectedDiagnosticHelperExport },
      );
    }
    verifyExpectedExportSlice(records, PUBLIC_RUNTIME_EXPORT_SOURCES, false, fileName);
    verifyExpectedExportSlice(records, PUBLIC_TYPE_EXPORT_SOURCES, true, fileName);
  }
}

function verifyRegistry({ registry, lookup, guard }) {
  if (
    !Object.isFrozen(registry) ||
    registry.some((definition) => !Object.isFrozen(definition)) ||
    new Set(registry.map(({ code }) => code)).size !== registry.length
  ) {
    fail(
      "PUBLISHER_DIAGNOSTIC_REGISTRY_MUTABLE",
      "Publisher diagnostic registry must be deeply frozen with unique codes.",
    );
  }
  const reviewedSlice = EXPECTED_DIAGNOSTIC_REGISTRY.map((expected) => {
    const matches = registry.filter(({ code }) => code === expected.code);
    if (matches.length !== 1 || !isDeepStrictEqual(matches[0], expected)) {
      fail(
        "PUBLISHER_DIAGNOSTIC_REGISTRY_DRIFT",
        "A reviewed M06-T01 diagnostic definition changed or disappeared.",
        { expected, actual: matches },
      );
    }
    return matches[0];
  });
  for (const definition of registry) {
    if (!guard(definition.code) || lookup(definition.code) !== definition) {
      fail(
        "PUBLISHER_DIAGNOSTIC_LOOKUP_DRIFT",
        "Publisher diagnostic guard or lookup no longer returns the exact frozen definition.",
        { code: definition.code },
      );
    }
  }
  if (guard("SCHEMA_INVALID") || lookup("run.desen.publisher/UNKNOWN") !== undefined) {
    fail(
      "PUBLISHER_DIAGNOSTIC_LOOKUP_DRIFT",
      "Publisher diagnostic lookup accepted a core or unknown code.",
    );
  }
  return Object.freeze(reviewedSlice);
}

function verifyPipelineAndLimits(stages, limits) {
  exact(
    stages,
    EXPECTED_PIPELINE_STAGES,
    "PUBLISHER_STAGE_ORDER_DRIFT",
    "Publisher stage order differs from the sixteen required Section 25.1 steps.",
  );
  if (!Object.isFrozen(stages)) {
    fail("PUBLISHER_STAGE_ORDER_MUTABLE", "Publisher stage order must be frozen.");
  }
  exact(
    limits,
    EXPECTED_SOURCE_LIMITS,
    "PUBLISHER_LIMIT_PROFILE_DRIFT",
    "Publisher Source-ingress limits differ from the documented M06-T01 profile.",
  );
  if (!Object.isFrozen(limits)) {
    fail("PUBLISHER_LIMIT_PROFILE_MUTABLE", "Publisher Source-ingress limits must be frozen.");
  }
}

function summarizeFailure(id, result, expectedCode, expectedPointer) {
  if (
    result?.ok !== false ||
    result.stage !== "json-parse" ||
    Object.hasOwn(result, "bundle") ||
    Object.hasOwn(result, "value") ||
    !Object.isFrozen(result) ||
    !Object.isFrozen(result.diagnostics) ||
    result.diagnostics.length !== 1 ||
    result.diagnostics[0]?.code !== expectedCode ||
    result.diagnostics[0]?.pointer !== expectedPointer ||
    result.diagnostics[0]?.stage !== "json-parse" ||
    result.diagnostics[0]?.severity !== "error" ||
    !Object.isFrozen(result.diagnostics[0])
  ) {
    fail("PUBLISHER_PARSE_VECTOR_FAILED", `${id} did not fail through the closed parse boundary.`, {
      result,
      expectedCode,
      expectedPointer,
    });
  }
  return Object.freeze({
    id,
    result: "rejected",
    code: result.diagnostics[0].code,
    pointer: result.diagnostics[0].pointer,
    bundleMember: Object.hasOwn(result, "bundle"),
    valueMember: Object.hasOwn(result, "value"),
  });
}

function verifyParseBoundary(parser) {
  const validText =
    '{"kind":"desen.source","desen":"0.1.0","id":"com.example.app","catalogs":[],"entry":"main","surfaces":{}}';
  const valid = parser(validText);
  if (
    valid?.ok !== true ||
    Object.hasOwn(valid, "bundle") ||
    !Object.isFrozen(valid) ||
    !Object.isFrozen(valid.value) ||
    valid.diagnostics.length !== 0
  ) {
    fail(
      "PUBLISHER_PARSE_VECTOR_FAILED",
      "Valid raw Source JSON did not become one frozen pre-schema snapshot.",
      { valid },
    );
  }

  const secret = "must-not-leak-source-fragment";
  const malformed = parser(`{"secret":"${secret}",`);
  const duplicate = parser('{"a":1,"\\u0061":2}');
  const invalidUnicode = parser('{"value":"\\ud800"}');
  const nonFinite = parser('{"value":1e400}');
  const limited = parser('"é"', {
    ...EXPECTED_SOURCE_LIMITS,
    maxSourceUtf8Bytes: 3,
  });
  const failures = Object.freeze([
    summarizeFailure("malformed", malformed, INVALID_SOURCE_JSON_CODE, ROOT_POINTER),
    summarizeFailure("duplicate-decoded-member", duplicate, INVALID_SOURCE_JSON_CODE, "/a"),
    summarizeFailure("invalid-unicode", invalidUnicode, INVALID_SOURCE_JSON_CODE, "/value"),
    summarizeFailure("non-finite-number", nonFinite, INVALID_SOURCE_JSON_CODE, "/value"),
    summarizeFailure("finite-limit", limited, SOURCE_LIMIT_EXCEEDED_CODE, ROOT_POINTER),
  ]);
  if (JSON.stringify(malformed).includes(secret)) {
    fail(
      "PUBLISHER_PARSE_DIAGNOSTIC_LEAK",
      "Malformed Source diagnostics leaked caller Source text.",
    );
  }

  const first = parser('{"x":1,"\\u0078":2}');
  const second = parser('{"x":1,"\\u0078":2}');
  if (first === second || JSON.stringify(first) !== JSON.stringify(second)) {
    fail(
      "PUBLISHER_PARSE_NONDETERMINISTIC",
      "Independent raw Source parse failures are not byte-equivalent.",
    );
  }
  return Object.freeze({
    accepted: {
      id: valid.value.id,
      frozenResult: Object.isFrozen(valid),
      frozenValue: Object.isFrozen(valid.value),
      bundleMember: Object.hasOwn(valid, "bundle"),
    },
    rejected: failures,
    repeatedFailureJson: JSON.stringify(first),
  });
}

function verifyTrace(trace) {
  const c011 = trace.conformanceRules?.find(({ id }) => id === "C-011");
  const pipe025 = trace.pipelineSteps?.find(({ id }) => id === "PIPE-025");
  const expectedC011 = {
    id: "C-011",
    owners: ["M06-T01", "M06-T11"],
    tests: ["M06-T10", "M06-T11"],
  };
  const expectedPipe025 = {
    id: "PIPE-025",
    owners: ["M06-T01"],
    tests: ["M06-T11"],
    evidence: "Malformed JSON emits a staged diagnostic and no bundle",
  };
  exact(
    c011 && { id: c011.id, owners: c011.owners, tests: c011.tests },
    expectedC011,
    "PUBLISHER_TRACE_DRIFT",
    "C-011 Publisher ownership changed.",
  );
  exact(
    pipe025 && {
      id: pipe025.id,
      owners: pipe025.owners,
      tests: pipe025.tests,
      evidence: pipe025.evidence,
    },
    expectedPipe025,
    "PUBLISHER_TRACE_DRIFT",
    "PIPE-025 raw JSON parsing ownership changed.",
  );
}

function verifyFrozenGuidance(guideText, canonicalizationText) {
  for (const required of [
    "type PublishResult =",
    "| { ok: true; bundle: DesenBundle; diagnostics: Diagnostic[] }",
    "| { ok: false; diagnostics: Diagnostic[] };",
    "Never publish on unresolved errors.",
  ]) {
    if (!guideText.includes(required)) {
      fail(
        "PUBLISHER_GUIDE_DRIFT",
        "Frozen Publisher implementation guidance no longer contains its reviewed terminal contract.",
        { required },
      );
    }
  }
  if (
    !canonicalizationText.includes(
      "A value-based API cannot recover duplicate object names already discarded by a parser.",
    ) ||
    !canonicalizationText.includes("Parsing\n  must enforce I-JSON before canonicalization.")
  ) {
    fail(
      "PUBLISHER_CANONICALIZATION_BOUNDARY_DRIFT",
      "M02 canonicalization evidence no longer pins the I-JSON parsing precondition.",
    );
  }
}

function verifyFinding(findingText) {
  const start = findingText.indexOf(
    "## PF-060 — Raw Source parsing needs an explicit interoperable JSON and finite-ingress profile",
  );
  if (start < 0) {
    fail("PUBLISHER_FINDING_MISSING", "PF-060 is missing from the protocol findings ledger.");
  }
  const section = findingText.slice(start);
  for (const required of [
    INVALID_SOURCE_JSON_CODE,
    SOURCE_LIMIT_EXCEEDED_CODE,
    "8,388,608 UTF-8 Source bytes",
    "structurally no `bundle` member",
  ]) {
    if (!section.includes(required)) {
      fail("PUBLISHER_FINDING_DRIFT", "PF-060 no longer records the complete M06-T01 profile.", {
        required,
      });
    }
  }
}

function testRegistrationCount(call, directName) {
  if (ts.isIdentifier(call.expression) && call.expression.text === directName) return 1;
  if (
    ts.isCallExpression(call.expression) &&
    ts.isPropertyAccessExpression(call.expression.expression) &&
    ts.isIdentifier(call.expression.expression.expression) &&
    call.expression.expression.expression.text === directName &&
    call.expression.expression.name.text === "each"
  ) {
    const cases = call.expression.arguments[0];
    if (!ts.isArrayLiteralExpression(cases)) {
      fail(
        "PUBLISHER_TEST_INVENTORY_DRIFT",
        `${directName}.each must use a direct literal case table.`,
      );
    }
    return cases.elements.length;
  }
  return 0;
}

function directTestStatements(sourceFile, directName) {
  if (directName === "test") return sourceFile.statements;
  const statements = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isCallExpression(statement.expression) ||
      !ts.isIdentifier(statement.expression.expression) ||
      statement.expression.expression.text !== "describe"
    ) {
      continue;
    }
    const callback = statement.expression.arguments[1];
    if (
      callback === undefined ||
      (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
      !ts.isBlock(callback.body)
    ) {
      fail(
        "PUBLISHER_TEST_INVENTORY_DRIFT",
        "Each Publisher describe registration must use one direct block callback.",
      );
    }
    statements.push(...callback.body.statements);
  }
  if (statements.length === 0) {
    fail(
      "PUBLISHER_TEST_INVENTORY_DRIFT",
      "The Publisher focused suite contains no direct describe test statements.",
    );
  }
  return statements;
}

function countDeclaredTests(sourceText, fileName, directName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    fileName.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
  let observed = 0;
  function visit(node) {
    if (ts.isCallExpression(node)) observed += testRegistrationCount(node, directName);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  let direct = 0;
  for (const statement of directTestStatements(sourceFile, directName)) {
    if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
      direct += testRegistrationCount(statement.expression, directName);
    }
  }
  if (observed !== direct) {
    fail(
      "PUBLISHER_TEST_INVENTORY_DRIFT",
      `${fileName} contains a conditional or nested ${directName} registration.`,
      { observed, direct },
    );
  }
  return direct;
}

function verifyTestInventory(packageTests, compilerCases, rootTests) {
  const inventory = Object.freeze({
    packageTests: countDeclaredTests(packageTests, "publish-result.test.ts", "it"),
    compilerNegativeCases: compilerCases.match(/\/\/\s*@ts-expect-error\b/gu)?.length ?? 0,
    rootMutationTests: countDeclaredTests(rootTests, "publisher-publish-result.test.mjs", "test"),
  });
  for (const [name, expected] of Object.entries(EXPECTED_TEST_INVENTORY)) {
    if (inventory[name] !== expected) {
      fail(
        "PUBLISHER_TEST_INVENTORY_DRIFT",
        `${name} differs from the reviewed M06-T01 evidence suite.`,
        { expected, actual: inventory[name] },
      );
    }
  }
  return inventory;
}

function verifyCompilerConfiguration(baseConfig, packageConfig, buildConfig) {
  const basePath = path.join(WORKSPACE_ROOT, "tsconfig.base.json");
  const packagePath = path.join(WORKSPACE_ROOT, "packages/publisher/tsconfig.json");
  const buildPath = path.join(WORKSPACE_ROOT, "packages/publisher/tsconfig.build.json");
  const overrides = new Map([
    [path.resolve(basePath), JSON.stringify(baseConfig)],
    [path.resolve(packagePath), JSON.stringify(packageConfig)],
    [path.resolve(buildPath), JSON.stringify(buildConfig)],
  ]);
  const unrecoverable = [];
  const host = {
    ...ts.sys,
    readFile(fileName) {
      return overrides.get(path.resolve(fileName)) ?? ts.sys.readFile(fileName);
    },
    fileExists(fileName) {
      return overrides.has(path.resolve(fileName)) || ts.sys.fileExists(fileName);
    },
    onUnRecoverableConfigFileDiagnostic(diagnostic) {
      unrecoverable.push(diagnostic);
    },
  };
  const parsedPackage = ts.getParsedCommandLineOfConfigFile(packagePath, {}, host);
  const parsedBuild = ts.getParsedCommandLineOfConfigFile(buildPath, {}, host);
  const diagnostics = [
    ...unrecoverable,
    ...(parsedPackage?.errors ?? []),
    ...(parsedBuild?.errors ?? []),
  ];
  if (parsedPackage === undefined || parsedBuild === undefined || diagnostics.length > 0) {
    fail(
      "PUBLISHER_COMPILER_CONFIGURATION_DRIFT",
      "Publisher compiler configuration cannot be resolved through TypeScript.",
      {
        diagnostics: diagnostics.map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        ),
      },
    );
  }
  const relative = (fileName) => path.relative(WORKSPACE_ROOT, fileName).split(path.sep).join("/");
  const packageFiles = new Set(parsedPackage.fileNames.map(relative));
  const buildFiles = new Set(parsedBuild.fileNames.map(relative));
  const expectedTypecheckFiles = EXPECTED_COMPILER_CONFIGURATION.effective.typecheck.requiredFiles;
  const expectedBuildFiles = EXPECTED_COMPILER_CONFIGURATION.effective.build.requiredFiles;

  const summary = {
    base: {
      strict: baseConfig.compilerOptions?.strict,
      exactOptionalPropertyTypes: baseConfig.compilerOptions?.exactOptionalPropertyTypes,
      noUncheckedIndexedAccess: baseConfig.compilerOptions?.noUncheckedIndexedAccess,
      noCheck: baseConfig.compilerOptions?.noCheck ?? false,
      noEmit: baseConfig.compilerOptions?.noEmit,
      module: baseConfig.compilerOptions?.module,
      moduleResolution: baseConfig.compilerOptions?.moduleResolution,
      target: baseConfig.compilerOptions?.target,
      lib: baseConfig.compilerOptions?.lib,
      verbatimModuleSyntax: baseConfig.compilerOptions?.verbatimModuleSyntax,
    },
    package: {
      extends: packageConfig.extends,
      compilerOptionKeys: Object.keys(packageConfig.compilerOptions ?? {}).sort(),
      noCheck: packageConfig.compilerOptions?.noCheck ?? false,
      types: packageConfig.compilerOptions?.types,
      include: packageConfig.include,
      exclude: packageConfig.exclude ?? [],
      files: packageConfig.files ?? null,
    },
    build: {
      extends: buildConfig.extends,
      compilerOptionKeys: Object.keys(buildConfig.compilerOptions ?? {}).sort(),
      noCheck: buildConfig.compilerOptions?.noCheck ?? false,
      compilerOptions: {
        declaration: buildConfig.compilerOptions?.declaration,
        declarationMap: buildConfig.compilerOptions?.declarationMap,
        noEmit: buildConfig.compilerOptions?.noEmit,
        outDir: buildConfig.compilerOptions?.outDir,
        rootDir: buildConfig.compilerOptions?.rootDir,
        sourceMap: buildConfig.compilerOptions?.sourceMap,
      },
      include: buildConfig.include,
      exclude: buildConfig.exclude,
      files: buildConfig.files ?? null,
    },
    effective: {
      typecheck: {
        noCheck: parsedPackage.options.noCheck ?? false,
        strict: parsedPackage.options.strict,
        exactOptionalPropertyTypes: parsedPackage.options.exactOptionalPropertyTypes,
        noUncheckedIndexedAccess: parsedPackage.options.noUncheckedIndexedAccess,
        noEmit: parsedPackage.options.noEmit,
        requiredFiles: expectedTypecheckFiles.filter((fileName) => packageFiles.has(fileName)),
      },
      build: {
        noCheck: parsedBuild.options.noCheck ?? false,
        strict: parsedBuild.options.strict,
        exactOptionalPropertyTypes: parsedBuild.options.exactOptionalPropertyTypes,
        noUncheckedIndexedAccess: parsedBuild.options.noUncheckedIndexedAccess,
        noEmit: parsedBuild.options.noEmit,
        declaration: parsedBuild.options.declaration,
        declarationMap: parsedBuild.options.declarationMap,
        sourceMap: parsedBuild.options.sourceMap,
        rootDir:
          parsedBuild.options.rootDir === undefined
            ? undefined
            : relative(parsedBuild.options.rootDir),
        outDir:
          parsedBuild.options.outDir === undefined
            ? undefined
            : relative(parsedBuild.options.outDir),
        requiredFiles: expectedBuildFiles.filter((fileName) => buildFiles.has(fileName)),
        testFiles: [...buildFiles]
          .filter(
            (fileName) => fileName.includes("/test/") || /\.test\.[cm]?[jt]sx?$/u.test(fileName),
          )
          .sort(),
      },
    },
  };
  exact(
    summary,
    EXPECTED_COMPILER_CONFIGURATION,
    "PUBLISHER_COMPILER_CONFIGURATION_DRIFT",
    "Publisher compiler configuration no longer compiles its source, negative tests, and public distribution under the reviewed strict profile.",
  );
  return EXPECTED_COMPILER_CONFIGURATION;
}

function verifyPackageBoundary(publisherPackage, productionSource) {
  exact(
    Object.fromEntries(
      Object.keys(REQUIRED_PRODUCTION_DEPENDENCIES).map((name) => [
        name,
        publisherPackage.dependencies?.[name],
      ]),
    ),
    REQUIRED_PRODUCTION_DEPENDENCIES,
    "PUBLISHER_DEPENDENCY_DRIFT",
    "Publisher lost a required platform-neutral production dependency.",
  );
  if (publisherPackage.devDependencies?.vitest !== "4.1.10") {
    fail(
      "PUBLISHER_DEPENDENCY_DRIFT",
      "Publisher lost the reviewed Vitest development dependency.",
    );
  }
  const platformDependencies = Object.keys(publisherPackage.dependencies ?? {}).filter((name) =>
    ["react", "react-dom", "react-native"].some(
      (framework) => name === framework || name.startsWith(`${framework}/`),
    ),
  );
  if (platformDependencies.length > 0) {
    fail(
      "PUBLISHER_DEPENDENCY_DRIFT",
      "Platform-neutral Publisher declared a framework-specific production dependency.",
      { platformDependencies },
    );
  }
  exact(
    {
      name: publisherPackage.name,
      version: publisherPackage.version,
      private: publisherPackage.private,
      license: publisherPackage.license,
      type: publisherPackage.type,
      sideEffects: publisherPackage.sideEffects,
      files: publisherPackage.files,
      exportKeys: Object.keys(publisherPackage.exports ?? {}).sort(),
      rootExport: publisherPackage.exports?.["."],
    },
    {
      name: "@desen/publisher",
      version: "0.0.0",
      private: true,
      license: "Apache-2.0",
      type: "module",
      sideEffects: false,
      files: ["dist"],
      exportKeys: ["."],
      rootExport: {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
    },
    "PUBLISHER_PACKAGE_ENTRY_DRIFT",
    "Publisher package entry metadata no longer resolves its built ESM runtime and declarations.",
  );
  const sourceFile = ts.createSourceFile(
    "publisher-m06-t01.ts",
    productionSource,
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.TS,
  );
  const forbidden = new Set();
  const forbiddenIdentifiers = new Set([
    "Buffer",
    "Date",
    "Function",
    "Math",
    "document",
    "eval",
    "fetch",
    "globalThis",
    "navigator",
    "process",
    "window",
  ]);
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      if (
        specifier.startsWith("node:") ||
        ["react", "react-dom", "react-native"].some(
          (name) => specifier === name || specifier.startsWith(`${name}/`),
        )
      ) {
        forbidden.add(`import:${specifier}`);
      }
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      forbidden.add("dynamic import");
    }
    if (ts.isIdentifier(node) && forbiddenIdentifiers.has(node.text)) {
      forbidden.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (forbidden.size > 0) {
    fail(
      "PUBLISHER_PLATFORM_BOUNDARY_DRIFT",
      "Platform-neutral Publisher production source contains a forbidden platform or executable edge.",
      { forbidden: [...forbidden].sort() },
    );
  }
}

function verifyCommandWiring(workspacePackage, publisherPackage) {
  for (const [name, expected] of Object.entries(REQUIRED_WORKSPACE_SCRIPTS)) {
    if (workspacePackage.scripts?.[name] !== expected) {
      fail("PUBLISHER_COMMAND_WIRING_DRIFT", `Workspace script ${name} changed.`, {
        expected,
        actual: workspacePackage.scripts?.[name],
      });
    }
  }
  if (
    !splitScript(workspacePackage.scripts?.check).includes(
      "pnpm verify:publisher-publish-result",
    ) ||
    !splitScript(workspacePackage.scripts?.test).includes("pnpm test:publisher-publish-result")
  ) {
    fail("PUBLISHER_COMMAND_WIRING_DRIFT", "Root check/test no longer execute the M06-T01 proof.");
  }
  exact(
    {
      build: publisherPackage.scripts?.build,
      lint: publisherPackage.scripts?.lint,
      test: publisherPackage.scripts?.test,
      focused: publisherPackage.scripts?.["test:publish-result"],
      coverage: publisherPackage.scripts?.["test:coverage"],
      typecheck: publisherPackage.scripts?.typecheck,
    },
    {
      build: "tsc -p tsconfig.build.json",
      lint: "eslint src test --max-warnings=0",
      test: "vitest run",
      focused: "vitest run test/publish-result.test.ts",
      coverage: "vitest run --coverage",
      typecheck: "tsc -p tsconfig.json --noEmit",
    },
    "PUBLISHER_COMMAND_WIRING_DRIFT",
    "Publisher package test/lint commands changed.",
  );
}

async function readVerifiedProductionSource() {
  const texts = await Promise.all(
    VERIFIED_PRODUCTION_PATHS.map((relativePath) =>
      readRegularFile(
        path.join(WORKSPACE_ROOT, relativePath),
        "PUBLISHER_SOURCE_FILE_MISSING",
        "PUBLISHER_SOURCE_FILE_UNSAFE",
      ).then((bytes) => bytes.toString("utf8")),
    ),
  );
  return Object.freeze({ files: VERIFIED_PRODUCTION_PATHS, text: texts.join("\n") });
}

async function trackedFileEvidence(overrides = SAFE_OBJECT_FREEZE(SAFE_OBJECT_CREATE(null))) {
  return Promise.all(
    TRACKED_EVIDENCE_PATHS.map(async (relativePath) => {
      const bytes = SAFE_OBJECT_HAS_OWN(overrides, relativePath)
        ? SAFE_BUFFER_FROM(overrides[relativePath])
        : await readRegularFile(
            path.join(WORKSPACE_ROOT, relativePath),
            "PUBLISHER_TRACKED_FILE_MISSING",
            "PUBLISHER_TRACKED_FILE_UNSAFE",
          );
      const actual = SAFE_OBJECT_FREEZE({
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
      });
      const historical = HISTORICAL_TRACKED_RECEIPTS[relativePath];
      const reviewedHistory = REVIEWED_G05_COMPATIBILITY_RECEIPT_HISTORY[relativePath];
      let receiptIsReviewed = historical !== undefined && isDeepStrictEqual(actual, historical);
      if (reviewedHistory !== undefined && historical === undefined) {
        fail(
          "PUBLISHER_G05_COMPATIBILITY_READER_DRIFT",
          "A reviewed G05 successor lost its task-time historical projection.",
          { path: relativePath },
        );
      }
      if (!receiptIsReviewed && reviewedHistory !== undefined) {
        const latestReviewed = reviewedHistory[reviewedHistory.length - 1];
        if (latestReviewed === undefined) {
          fail(
            "PUBLISHER_G05_COMPATIBILITY_READER_DRIFT",
            "A reviewed G05 successor history lost its exact latest receipt.",
            { path: relativePath },
          );
        }
        receiptIsReviewed =
          actual.bytes === latestReviewed.bytes && actual.sha256 === latestReviewed.sha256;
      }
      if (reviewedHistory !== undefined && !receiptIsReviewed) {
        fail(
          "PUBLISHER_G05_COMPATIBILITY_READER_DRIFT",
          "The current G05 compatibility reader differs from its task-time and latest reviewed receipt.",
          {
            path: relativePath,
            actual,
            historical,
            reviewedHistory,
          },
        );
      }
      if (historical !== undefined) {
        return SAFE_OBJECT_FREEZE({ path: relativePath, ...historical });
      }
      return SAFE_OBJECT_FREEZE({
        path: relativePath,
        ...actual,
      });
    }),
  );
}

function verifyPrerequisite(bytes) {
  const actual = sha256(bytes);
  if (actual !== PREREQUISITE_SHA256) {
    fail("PUBLISHER_PREREQUISITE_DRIFT", "The immutable G05 prerequisite artifact changed.", {
      expected: PREREQUISITE_SHA256,
      actual,
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("PUBLISHER_PREREQUISITE_DRIFT", "The G05 prerequisite is not valid JSON.");
  }
  if (
    artifact.task !== "M05-T09" ||
    artifact.result !== "PASS" ||
    artifact.profile !== "desen-reference-host-web-source-audit-v1"
  ) {
    fail(
      "PUBLISHER_PREREQUISITE_DRIFT",
      "The G05 prerequisite no longer carries its reviewed identity.",
    );
  }
}

function exactDocumentationPin(text, heading, artifactSha256, code, suffix = "") {
  const lines = text.split(/\r?\n/u);
  const headings = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (headings.length !== 1) fail(code, `Expected exactly one ${heading} section.`);
  const start = headings[0];
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const section = lines.slice(start, next === -1 ? lines.length : next);
  const pathLine = `\`${ARTIFACT_RELATIVE_PATH}\``;
  const shaLine = `\`sha256:${artifactSha256}\`${suffix}`;
  const pathIndex = section.indexOf(pathLine);
  if (
    pathIndex < 0 ||
    section[pathIndex + 1] !== shaLine ||
    lines.filter((line) => line.includes(ARTIFACT_RELATIVE_PATH)).length !== 1 ||
    lines.filter((line) => line.includes(`sha256:${artifactSha256}`)).length !== 1 ||
    /PENDING/iu.test(section.join("\n"))
  ) {
    fail(code, `${heading} does not carry one exact M06-T01 artifact path/SHA pin.`);
  }
}

/** Builds deterministic M06-T01 evidence in memory. */
export async function buildPublisherPublishResultEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  if (options.verifySnapshot !== false) {
    await verifyProtocolSnapshot(options.snapshotRoot ?? DEFAULT_SNAPSHOT_ROOT);
  }
  const [
    trace,
    guideText,
    canonicalizationText,
    findingText,
    indexSource,
    declarationIndexSource,
    workspacePackage,
    publisherPackage,
    baseTsconfig,
    publisherTsconfig,
    publisherBuildTsconfig,
    production,
    packageTestSource,
    compilerTypeSource,
    rootTestSource,
    prerequisiteBytes,
  ] = await Promise.all([
    options.trace ??
      readFile(path.join(WORKSPACE_ROOT, TRACE_RELATIVE_PATH), "utf8").then(JSON.parse),
    options.guideText ??
      readFile(path.join(WORKSPACE_ROOT, IMPLEMENTATION_GUIDE_RELATIVE_PATH), "utf8"),
    options.canonicalizationText ??
      readFile(path.join(WORKSPACE_ROOT, CANONICALIZATION_PROOF_RELATIVE_PATH), "utf8"),
    options.findingText ?? readFile(path.join(WORKSPACE_ROOT, FINDINGS_RELATIVE_PATH), "utf8"),
    options.indexSource ??
      readFile(path.join(WORKSPACE_ROOT, "packages/publisher/src/index.ts"), "utf8"),
    options.declarationIndexSource ??
      readFile(path.join(WORKSPACE_ROOT, "packages/publisher/dist/index.d.ts"), "utf8"),
    options.workspacePackage ??
      readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf8").then(JSON.parse),
    options.publisherPackage ??
      readFile(path.join(WORKSPACE_ROOT, "packages/publisher/package.json"), "utf8").then(
        JSON.parse,
      ),
    options.baseTsconfig ??
      readFile(path.join(WORKSPACE_ROOT, "tsconfig.base.json"), "utf8").then(JSON.parse),
    options.publisherTsconfig ??
      readFile(path.join(WORKSPACE_ROOT, "packages/publisher/tsconfig.json"), "utf8").then(
        JSON.parse,
      ),
    options.publisherBuildTsconfig ??
      readFile(path.join(WORKSPACE_ROOT, "packages/publisher/tsconfig.build.json"), "utf8").then(
        JSON.parse,
      ),
    options.productionSource === undefined
      ? readVerifiedProductionSource()
      : { files: ["override.ts"], text: options.productionSource },
    options.packageTestSource ??
      readFile(path.join(WORKSPACE_ROOT, "packages/publisher/test/publish-result.test.ts"), "utf8"),
    options.compilerTypeSource ??
      readFile(
        path.join(WORKSPACE_ROOT, "packages/publisher/test/publish-result.types.ts"),
        "utf8",
      ),
    options.rootTestSource ??
      readFile(path.join(WORKSPACE_ROOT, "tests/publisher-publish-result.test.mjs"), "utf8"),
    options.prerequisiteBytes ??
      readRegularFile(
        path.join(WORKSPACE_ROOT, PREREQUISITE_RELATIVE_PATH),
        "PUBLISHER_PREREQUISITE_MISSING",
        "PUBLISHER_PREREQUISITE_UNSAFE",
      ),
  ]);

  const stages = options.pipelineStages ?? PUBLISH_PIPELINE_STAGES;
  const limits = options.sourceLimits ?? PUBLISH_SOURCE_JSON_LIMITS;
  const registry = options.registry ?? PUBLISHER_DIAGNOSTIC_REGISTRY;
  const lookup = options.lookup ?? getPublisherDiagnosticDefinition;
  const guard = options.guard ?? isPublisherDiagnosticCode;
  const parser = options.parser ?? parseSourceJson;

  verifyPipelineAndLimits(stages, limits);
  const reviewedRegistry = verifyRegistry({ registry, lookup, guard });
  verifyPublicApi(indexSource, declarationIndexSource);
  verifyTrace(trace);
  verifyFrozenGuidance(guideText, canonicalizationText);
  verifyFinding(findingText);
  verifyPackageBoundary(publisherPackage, production.text);
  const compilerConfiguration = verifyCompilerConfiguration(
    baseTsconfig,
    publisherTsconfig,
    publisherBuildTsconfig,
  );
  verifyCommandWiring(workspacePackage, publisherPackage);
  verifyPrerequisite(Buffer.from(prerequisiteBytes));
  const parseBoundary = verifyParseBoundary(parser);
  const testInventory = verifyTestInventory(packageTestSource, compilerTypeSource, rootTestSource);

  const artifact = {
    schemaVersion: 1,
    task: "M06-T01",
    result: "PASS",
    profile: "desen-publisher-publish-result-v1",
    claim: {
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "The Publisher exposes one closed terminal success/failure contract, stable staged diagnostics, and an I-JSON-safe finite raw Source boundary without exposing a partial Bundle.",
      publicPartialPublicationApiInReviewedT01Slice: false,
      bundleOnFailure: false,
      bundleProducedByThisTask: false,
    },
    prerequisite: {
      task: "M05-T09",
      gate: "G05",
      path: PREREQUISITE_RELATIVE_PATH,
      sha256: PREREQUISITE_SHA256,
      historicalArtifactRewritten: false,
      currentCompatibilityOwnershipPaths: G05_COMPATIBILITY_OWNERSHIP_PATHS,
    },
    frozenProtocol: {
      sourceCommit: EXPECTED_PROTOCOL_SNAPSHOT.sourceCommit,
      sourceTree: EXPECTED_PROTOCOL_SNAPSHOT.sourceTree,
      aggregateSha256: EXPECTED_PROTOCOL_SNAPSHOT.aggregateSha256,
      trace: {
        conformanceRule: "C-011",
        pipelineStep: "PIPE-025",
      },
      guidance: "IMPLEMENTATION-GUIDE.md#5-publisher-architecture",
    },
    publicApi: {
      reviewedRuntimeExports: PUBLIC_RUNTIME_EXPORTS,
      reviewedTypeExports: PUBLIC_TYPE_EXPORTS,
      result: {
        discriminator: "ok",
        success: ["bundle", "warning diagnostics"],
        failure: ["first failed stage", "non-empty error-first diagnostics"],
        failureBundleMember: false,
      },
      pipelineStages: stages,
    },
    diagnostics: {
      registry: reviewedRegistry,
      severityIsSeparateFromCoreClassification: true,
      deterministicOrdering:
        "error before warning, then pipeline stage, pointer, code, context, and message",
      rawSourceTextOrNativeErrorRetained: false,
    },
    sourceIngress: {
      limits,
      inputKind: "raw JSON string",
      acceptedSnapshot: "detached and recursively frozen",
      duplicateNamesComparedAfterEscapeDecoding: true,
      parseBoundary,
    },
    boundary: {
      requiredProductionDependencies: Object.keys(REQUIRED_PRODUCTION_DEPENDENCIES).sort(),
      productionSourceFiles: production.files,
      nodeOrFrameworkImports: 0,
      publicParserExportsInReviewedT01Slice: 0,
      storageNetworkRuntimeEditorEffects: 0,
      compilerConfiguration,
    },
    evidence: {
      ...testInventory,
      trackedFiles: await trackedFileEvidence(options.trackedFileBytes),
      commands: [
        "pnpm verify:publisher-publish-result",
        "pnpm test:publisher-publish-result",
        "pnpm check",
      ],
    },
    limitations: [
      "M06-T01 defines and exercises the terminal contract but does not expose a Publisher entry point or emit a Bundle.",
      "Catalog resolution, Source/schema semantics, capability contracts, normalization, digests, and final Bundle validation remain M06-T02 through M06-T11.",
      "The finite Source-ingress values are a documented project profile, not universal DESEN constants.",
      "The artifact re-verifies only the M06-T01 public export and diagnostic slice; every later Publisher module or root export requires its successor task's own proof.",
      "Optional signing and publication metadata retain M12 ownership; this evidence makes no authenticity claim.",
      "No Proof Matrix P-claim or normative N-row changes status from this infrastructure task alone.",
    ],
  };
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
    tabWidth: 2,
    endOfLine: "lf",
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

/** Atomically writes the deterministic M06-T01 artifact. */
export async function writePublisherPublishResultEvidence({
  artifactPath = DEFAULT_PUBLISHER_PUBLISH_RESULT_ARTIFACT_PATH,
  beforeAtomicRename,
} = {}) {
  const built = await buildPublisherPublishResultEvidence();
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: built.artifactBytes,
    beforeAtomicRename,
  });
  return Object.freeze({
    artifactPath,
    artifactSha256: built.artifactSha256,
    result: built.artifact.result,
  });
}

/** Rebuilds and verifies the exact tracked artifact plus human-readable documentation pins. */
export async function verifyPublisherPublishResultEvidence({
  artifactPath = DEFAULT_PUBLISHER_PUBLISH_RESULT_ARTIFACT_PATH,
  artifactBytes,
  proofPath = DEFAULT_PUBLISHER_PUBLISH_RESULT_PROOF_PATH,
  proofText,
  matrixPath = DEFAULT_PUBLISHER_PUBLISH_RESULT_MATRIX_PATH,
  matrixText,
} = {}) {
  const built = await buildPublisherPublishResultEvidence();
  const tracked =
    artifactBytes ??
    (await readRegularFile(
      artifactPath,
      "PUBLISHER_ARTIFACT_MISSING",
      "PUBLISHER_ARTIFACT_UNSAFE",
    ));
  if (!Buffer.from(tracked).equals(built.artifactBytes)) {
    fail("PUBLISHER_ARTIFACT_DRIFT", "Tracked M06-T01 artifact is stale or modified.", {
      expectedSha256: built.artifactSha256,
      actualSha256: sha256(tracked),
    });
  }
  const [resolvedProof, resolvedMatrix] = await Promise.all([
    proofText ?? readFile(proofPath, "utf8"),
    matrixText ?? readFile(matrixPath, "utf8"),
  ]);
  exactDocumentationPin(
    resolvedProof,
    "## Evidence artifact",
    built.artifactSha256,
    "PUBLISHER_PROOF_PIN_DRIFT",
  );
  exactDocumentationPin(
    resolvedMatrix,
    "## M06-T01",
    built.artifactSha256,
    "PUBLISHER_MATRIX_PIN_DRIFT",
    ".",
  );
  return Object.freeze({
    result: "PASS",
    artifactSha256: built.artifactSha256,
    reviewedRuntimeExports: PUBLIC_RUNTIME_EXPORTS.length,
    reviewedTypeExports: PUBLIC_TYPE_EXPORTS.length,
    pipelineStages: EXPECTED_PIPELINE_STAGES.length,
    publisherDiagnosticCodes: EXPECTED_DIAGNOSTIC_REGISTRY.length,
    packageTests: built.artifact.evidence.packageTests,
    compilerNegativeCases: built.artifact.evidence.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.rootMutationTests,
    parseRejectionVectors: built.artifact.sourceIngress.parseBoundary.rejected.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
  });
}
