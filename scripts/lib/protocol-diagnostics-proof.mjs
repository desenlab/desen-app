import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import {
  CORE_DIAGNOSTIC_REGISTRY,
  createCoreDiagnostic,
  getCoreDiagnosticDefinition,
  isCoreDiagnosticCode,
} from "../../packages/protocol/src/diagnostics.ts";
import {
  appendJsonPointer,
  createJsonPointer,
  escapeJsonPointerToken,
  isJsonPointer,
  parseJsonPointer,
  unescapeJsonPointerToken,
} from "../../packages/protocol/src/json-pointer.ts";
import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

/** Absolute path to the deterministic M02-T05 evidence artifact. */
export const DEFAULT_PROTOCOL_DIAGNOSTICS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-diagnostics.json",
);

/** Absolute path to the reviewed protocol trace ledger used as an independent registry oracle. */
export const DEFAULT_PROTOCOL_DIAGNOSTICS_TRACE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

const PUBLIC_RUNTIME_EXPORTS = Object.freeze([
  "CORE_DIAGNOSTIC_REGISTRY",
  "createCoreDiagnostic",
  "getCoreDiagnosticDefinition",
  "isCoreDiagnosticCode",
  "appendJsonPointer",
  "createJsonPointer",
  "escapeJsonPointerToken",
  "isJsonPointer",
  "parseJsonPointer",
  "unescapeJsonPointerToken",
]);

const PUBLIC_TYPE_EXPORTS = Object.freeze([
  "CoreDiagnosticClassification",
  "CoreDiagnosticCode",
  "CoreDiagnosticDefinition",
  "CreateCoreDiagnosticInput",
  "DesenCoreDiagnostic",
  "DesenDiagnostic",
  "DesenDiagnosticContext",
  "DesenDiagnosticSubject",
  "JsonPointer",
  "JsonPointerSegment",
]);

const TRACKED_IMPLEMENTATION_PATHS = Object.freeze([
  "package.json",
  "turbo.json",
  "packages/protocol/package.json",
  "packages/protocol/tsconfig.json",
  "packages/protocol/src/index.ts",
  "packages/protocol/src/diagnostics.ts",
  "packages/protocol/src/json-pointer.ts",
  "packages/protocol/test/diagnostics.test.ts",
  "scripts/lib/protocol-diagnostics-proof.mjs",
  "scripts/generate-protocol-diagnostics-proof.mjs",
  "scripts/verify-protocol-diagnostics.mjs",
  "tests/protocol-diagnostics.test.mjs",
]);

const RFC_6901_SECTION_5_VECTORS = Object.freeze([
  Object.freeze({
    id: "rfc-section-5-document-root",
    segments: Object.freeze([]),
    pointer: "",
    tokens: Object.freeze([]),
  }),
  Object.freeze({
    id: "rfc-section-5-foo-array",
    segments: Object.freeze(["foo"]),
    pointer: "/foo",
    tokens: Object.freeze(["foo"]),
  }),
  Object.freeze({
    id: "rfc-section-5-foo-first-item",
    segments: Object.freeze(["foo", "0"]),
    pointer: "/foo/0",
    tokens: Object.freeze(["foo", "0"]),
  }),
  Object.freeze({
    id: "rfc-section-5-empty-member-name",
    segments: Object.freeze([""]),
    pointer: "/",
    tokens: Object.freeze([""]),
  }),
  Object.freeze({
    id: "rfc-section-5-slash",
    segments: Object.freeze(["a/b"]),
    pointer: "/a~1b",
    tokens: Object.freeze(["a/b"]),
  }),
  Object.freeze({
    id: "rfc-section-5-percent",
    segments: Object.freeze(["c%d"]),
    pointer: "/c%d",
    tokens: Object.freeze(["c%d"]),
  }),
  Object.freeze({
    id: "rfc-section-5-caret",
    segments: Object.freeze(["e^f"]),
    pointer: "/e^f",
    tokens: Object.freeze(["e^f"]),
  }),
  Object.freeze({
    id: "rfc-section-5-pipe",
    segments: Object.freeze(["g|h"]),
    pointer: "/g|h",
    tokens: Object.freeze(["g|h"]),
  }),
  Object.freeze({
    id: "rfc-section-5-backslash",
    segments: Object.freeze(["i\\j"]),
    pointer: "/i\\j",
    tokens: Object.freeze(["i\\j"]),
  }),
  Object.freeze({
    id: "rfc-section-5-quote",
    segments: Object.freeze(['k"l']),
    pointer: '/k"l',
    tokens: Object.freeze(['k"l']),
  }),
  Object.freeze({
    id: "rfc-section-5-space",
    segments: Object.freeze([" "]),
    pointer: "/ ",
    tokens: Object.freeze([" "]),
  }),
  Object.freeze({
    id: "rfc-section-5-tilde",
    segments: Object.freeze(["m~n"]),
    pointer: "/m~0n",
    tokens: Object.freeze(["m~n"]),
  }),
]);

const ADDITIONAL_POINTER_VECTORS = Object.freeze([
  Object.freeze({
    id: "decode-order",
    segments: Object.freeze(["~1"]),
    pointer: "/~01",
    tokens: Object.freeze(["~1"]),
  }),
  Object.freeze({
    id: "unicode-and-percent",
    segments: Object.freeze(["é", "e\u0301", "😀", "%2F", "\u0000"]),
    pointer: "/é/é/😀/%2F/\u0000",
    tokens: Object.freeze(["é", "e\u0301", "😀", "%2F", "\u0000"]),
  }),
]);

const POINTER_VECTORS = Object.freeze([
  ...RFC_6901_SECTION_5_VECTORS,
  ...ADDITIONAL_POINTER_VECTORS,
]);

const REJECTED_POINTERS = Object.freeze(["relative", "#/fragment", "/bad~", "/bad~2escape"]);

/** Stable internal failure raised by M02-T05 evidence generation and verification. */
export class ProtocolDiagnosticsEvidenceError extends Error {
  /**
   * @param {string} code stable internal failure code
   * @param {string} message human-readable failure summary
   * @param {Record<string, unknown>} [details] structured failure context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProtocolDiagnosticsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProtocolDiagnosticsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertEqual(actual, expected, label, code = "DIAGNOSTIC_GOLDEN_MISMATCH") {
  if (actual !== expected)
    fail(code, `${label} differs from its fixed value.`, { label, expected, actual });
}

function assertJsonEqual(actual, expected, label, code = "DIAGNOSTIC_GOLDEN_MISMATCH") {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label, code);
}

function parseAppendixB(specificationText) {
  const start = specificationText.indexOf("# Appendix B — Core Diagnostic Codes");
  const end = specificationText.indexOf("\n---", start);
  if (start < 0 || end < 0) {
    fail("DIAGNOSTIC_SPEC_SECTION_MISSING", "Could not isolate frozen SPEC Appendix B.");
  }

  const entries = [];
  for (const line of specificationText.slice(start, end).split("\n")) {
    const match = line.match(/^\| `([^`]+)` \| ([^|]+?) \| (.+) \|$/u);
    if (match) {
      entries.push({ code: match[1], classification: match[2].trim(), meaning: match[3].trim() });
    }
  }
  if (entries.length !== 36) {
    fail("DIAGNOSTIC_SPEC_COUNT_MISMATCH", "Frozen SPEC Appendix B does not contain 36 codes.", {
      actual: entries.length,
    });
  }
  return entries;
}

function verifyRegistry(registry, specificationEntries) {
  if (!Array.isArray(registry)) {
    fail("DIAGNOSTIC_REGISTRY_INVALID", "The core diagnostic registry must be an array.");
  }
  if (registry.length !== specificationEntries.length) {
    fail("DIAGNOSTIC_REGISTRY_COUNT_MISMATCH", "The registry count differs from Appendix B.", {
      expected: specificationEntries.length,
      actual: registry.length,
    });
  }

  const codes = registry.map(({ code }) => code);
  if (new Set(codes).size !== codes.length) {
    fail(
      "DIAGNOSTIC_REGISTRY_DUPLICATE_CODE",
      "The core diagnostic registry contains a duplicate code.",
    );
  }
  for (let index = 0; index < specificationEntries.length; index += 1) {
    assertJsonEqual(
      registry[index],
      specificationEntries[index],
      `Appendix B registry row ${index + 1}`,
      "DIAGNOSTIC_REGISTRY_DRIFT",
    );
  }
}

function verifyTraceLedger(trace, specificationEntries) {
  const expectedIds = specificationEntries.map(
    (_, index) => `D-${String(index + 1).padStart(3, "0")}`,
  );
  const actual = trace.diagnostics?.map(({ id, anchor, registryOwner }) => ({
    id,
    anchor,
    registryOwner,
  }));
  const expected = specificationEntries.map(({ code }, index) => ({
    id: expectedIds[index],
    anchor: code,
    registryOwner: "M02-T05",
  }));
  assertJsonEqual(
    actual,
    expected,
    "D-001 through D-036 trace ownership",
    "DIAGNOSTIC_TRACE_DRIFT",
  );

  const ownedRules = trace.proseRules
    ?.filter(({ owners }) => owners?.includes("M02-T05"))
    .map(({ id }) => id);
  assertJsonEqual(
    ownedRules,
    ["R-101", "R-110", "R-145"],
    "M02-T05 prose trace ownership",
    "DIAGNOSTIC_TRACE_DRIFT",
  );
}

function namedExports(indexSource, pattern) {
  return new Set(
    [...indexSource.matchAll(pattern)].flatMap(([, names]) =>
      names
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== "" && !name.startsWith("type ")),
    ),
  );
}

async function verifyPublicExports() {
  const indexSource = await readFile(
    path.join(WORKSPACE_ROOT, "packages/protocol/src/index.ts"),
    "utf8",
  );
  const runtimeExports = namedExports(indexSource, /export\s*\{([\s\S]*?)\}\s*from\s*"[^"]+";/gu);
  for (const exportName of PUBLIC_RUNTIME_EXPORTS) {
    if (!runtimeExports.has(exportName)) {
      fail(
        "DIAGNOSTIC_PUBLIC_EXPORT_MISSING",
        `The package root no longer exposes ${exportName}.`,
        {
          exportName,
        },
      );
    }
  }

  const typeExports = namedExports(
    indexSource,
    /export\s+type\s*\{([\s\S]*?)\}\s*from\s*"[^"]+";/gu,
  );
  for (const exportName of PUBLIC_TYPE_EXPORTS) {
    if (!typeExports.has(exportName)) {
      fail(
        "DIAGNOSTIC_PUBLIC_EXPORT_MISSING",
        `The package root no longer exposes ${exportName}.`,
        {
          exportName,
        },
      );
    }
  }

  if (/export\s+\*/u.test(indexSource)) {
    fail("DIAGNOSTIC_PUBLIC_EXPORT_WILDCARD", "The package root must use reviewed named exports.");
  }
}

function scriptSteps(script) {
  return typeof script === "string" ? script.split(/\s+&&\s+/u) : [];
}

async function verifyCommandWiring() {
  const [workspacePackage, protocolPackage, turbo] = await Promise.all(
    ["package.json", "packages/protocol/package.json", "turbo.json"].map(async (relativePath) =>
      JSON.parse(await readFile(path.join(WORKSPACE_ROOT, relativePath), "utf8")),
    ),
  );

  const exactWorkspaceScripts = {
    "generate:protocol-diagnostics": "node scripts/generate-protocol-diagnostics-proof.mjs",
    "verify:protocol-diagnostics": "node scripts/verify-protocol-diagnostics.mjs",
    "test:protocol-diagnostics":
      "pnpm --filter @desen/protocol test:diagnostics && node --test tests/protocol-diagnostics.test.mjs",
  };
  for (const [name, command] of Object.entries(exactWorkspaceScripts)) {
    assertEqual(
      workspacePackage.scripts?.[name],
      command,
      `workspace script ${name}`,
      "DIAGNOSTIC_COMMAND_WIRING_DRIFT",
    );
  }
  for (const [scriptName, requiredStep] of [
    ["check", "pnpm verify:protocol-diagnostics"],
    ["test", "pnpm test:protocol-diagnostics"],
  ]) {
    if (!scriptSteps(workspacePackage.scripts?.[scriptName]).includes(requiredStep)) {
      fail(
        "DIAGNOSTIC_COMMAND_WIRING_DRIFT",
        `Workspace ${scriptName} no longer includes ${requiredStep}.`,
      );
    }
  }

  for (const scriptName of ["test", "test:diagnostics", "test:coverage"]) {
    if (!protocolPackage.scripts?.[scriptName]?.includes("test/diagnostics.test.ts")) {
      fail(
        "DIAGNOSTIC_COMMAND_WIRING_DRIFT",
        `@desen/protocol ${scriptName} no longer includes the diagnostic suite.`,
      );
    }
  }
  for (const dependencyField of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    if (Object.keys(protocolPackage[dependencyField] ?? {}).length !== 0) {
      fail(
        "DIAGNOSTIC_RUNTIME_DEPENDENCY_DRIFT",
        `@desen/protocol ${dependencyField} must stay empty for M02-T05.`,
      );
    }
  }

  const requiredTurboInputs = [
    "../../scripts/lib/protocol-diagnostics-proof.mjs",
    "../../tests/protocol-diagnostics.test.mjs",
  ];
  for (const taskName of ["test", "test:coverage"]) {
    const inputs = turbo.tasks?.[taskName]?.inputs ?? [];
    for (const requiredInput of requiredTurboInputs) {
      if (!inputs.includes(requiredInput)) {
        fail(
          "DIAGNOSTIC_COMMAND_WIRING_DRIFT",
          `Turbo ${taskName} no longer tracks ${requiredInput}.`,
        );
      }
    }
  }
}

function verifyPointerVectors() {
  for (const vector of POINTER_VECTORS) {
    const pointer = createJsonPointer(vector.segments);
    assertEqual(pointer, vector.pointer, `${vector.id} pointer`, "JSON_POINTER_GOLDEN_MISMATCH");
    assertJsonEqual(
      parseJsonPointer(pointer),
      vector.tokens,
      `${vector.id} parsed tokens`,
      "JSON_POINTER_GOLDEN_MISMATCH",
    );
    if (!isJsonPointer(pointer)) {
      fail("JSON_POINTER_GOLDEN_MISMATCH", `${vector.id} was rejected by the syntax guard.`);
    }
  }

  assertEqual(
    escapeJsonPointerToken("a~b/c"),
    "a~0b~1c",
    "combined token escape",
    "JSON_POINTER_GOLDEN_MISMATCH",
  );
  assertEqual(
    unescapeJsonPointerToken("~01"),
    "~1",
    "token decode order",
    "JSON_POINTER_GOLDEN_MISMATCH",
  );
  assertEqual(
    appendJsonPointer(appendJsonPointer(createJsonPointer(), "surfaces"), "main/admin"),
    "/surfaces/main~1admin",
    "pointer append",
    "JSON_POINTER_GOLDEN_MISMATCH",
  );
  for (const pointer of REJECTED_POINTERS) {
    if (isJsonPointer(pointer)) {
      fail(
        "JSON_POINTER_GOLDEN_MISMATCH",
        `Invalid pointer ${JSON.stringify(pointer)} was accepted.`,
      );
    }
  }
}

async function trackedFileEvidence() {
  return Promise.all(
    TRACKED_IMPLEMENTATION_PATHS.map(async (relativePath) => {
      const bytes = await readFile(path.join(WORKSPACE_ROOT, ...relativePath.split("/")));
      return { path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) };
    }),
  );
}

/** Builds the deterministic M02-T05 diagnostic evidence entirely in memory. */
export async function buildProtocolDiagnosticsEvidence({
  snapshotRoot = DEFAULT_SNAPSHOT_ROOT,
  tracePath = DEFAULT_PROTOCOL_DIAGNOSTICS_TRACE_PATH,
  registry = CORE_DIAGNOSTIC_REGISTRY,
  verifySnapshot = true,
} = {}) {
  if (verifySnapshot) await verifyProtocolSnapshot(snapshotRoot);
  const specificationText = await readFile(path.join(snapshotRoot, "SPEC.md"), "utf8");
  const specificationEntries = parseAppendixB(specificationText);
  const trace = JSON.parse(await readFile(tracePath, "utf8"));

  verifyRegistry(registry, specificationEntries);
  verifyTraceLedger(trace, specificationEntries);
  await verifyPublicExports();
  await verifyCommandWiring();
  verifyPointerVectors();

  for (const definition of registry) {
    assertEqual(isCoreDiagnosticCode(definition.code), true, `${definition.code} type guard`);
    assertJsonEqual(
      getCoreDiagnosticDefinition(definition.code),
      definition,
      `${definition.code} lookup`,
    );
  }

  const diagnosticGolden = createCoreDiagnostic({
    code: "UNKNOWN_PROP",
    message: "Property label/text is not declared by the component contract.",
    pointer: createJsonPointer(["surfaces", "sign-in", "root", "props", "label/text"]),
    context: {
      documentId: "com.example/sign-in",
      surfaceId: "sign-in",
      subject: { kind: "node", id: "submit" },
      capabilityId: "com.example.ui/Button",
    },
  });

  const classificationCounts = Object.fromEntries(
    [...new Set(specificationEntries.map(({ classification }) => classification))].map(
      (classification) => [
        classification,
        specificationEntries.filter((entry) => entry.classification === classification).length,
      ],
    ),
  );

  const artifact = {
    task: "M02-T05",
    protocolVersion: "0.1.0",
    profile: "desen-diagnostics-json-pointer-v1",
    frozenInput: {
      sourceCommit: EXPECTED_PROTOCOL_SNAPSHOT.sourceCommit,
      sourceTree: EXPECTED_PROTOCOL_SNAPSHOT.sourceTree,
      aggregateSha256: EXPECTED_PROTOCOL_SNAPSHOT.aggregateSha256,
      specification: "SPEC.md#appendix-b--core-diagnostic-codes",
    },
    standards: [
      {
        id: "DESEN 0.1.0 Appendix B",
        coverage: ["36 stable core codes", "exact classifications", "exact canonical meanings"],
      },
      {
        id: "RFC 6901",
        url: "https://www.rfc-editor.org/rfc/rfc6901.html",
        coverage: [
          "all 12 Section 5 JSON-string examples",
          "reference-token escaping",
          "parsing",
          "append",
          "syntax guard",
        ],
      },
    ],
    traceability: {
      proseRules: ["R-101", "R-110", "R-145"],
      diagnosticRegistry: { first: "D-001", last: "D-036", count: 36 },
    },
    implementation: {
      package: "@desen/protocol",
      platform: "ECMAScript 2023",
      runtimeDependencies: [],
      evidenceFormatter: { name: "prettier", version: "3.9.6" },
      publicRuntimeExports: PUBLIC_RUNTIME_EXPORTS,
      publicTypeExports: PUBLIC_TYPE_EXPORTS,
      trackedFiles: await trackedFileEvidence(),
    },
    registry: {
      count: registry.length,
      uniqueCodes: new Set(registry.map(({ code }) => code)).size,
      classificationCounts,
      entries: registry,
    },
    jsonPointer: {
      representation: "RFC 6901 JSON string form",
      unavailableLocation: "omit the pointer property",
      knownRoot: "",
      vectors: POINTER_VECTORS,
      rejectedSyntax: REJECTED_POINTERS,
      exclusions: ["URI-fragment form", "document resolution", "array-index interpretation"],
    },
    diagnosticModel: {
      stableMachineFields: ["code", "pointer when available"],
      contextFields: ["documentId", "surfaceId", "subject", "capabilityId"],
      messageStability: "human-readable only; consumers must not branch on message text",
      appendixClassification: "derived for core codes; not an emission-stage category",
      namespacedExtensionExample: "com.example.validator/REMOTE_TIMEOUT",
      namespacedGrammar: "not defined by DESEN 0.1.0 and therefore not enforced here",
      golden: diagnosticGolden,
    },
    verification: {
      commands: [
        "pnpm verify:protocol-diagnostics",
        "pnpm test:protocol-diagnostics",
        "pnpm check",
      ],
      packageTests: 17,
      independentOracles: [
        "frozen SPEC.md Appendix B parser",
        "reviewed D-001 through D-036 trace ledger",
        "complete RFC 6901 Section 5 JSON-string table plus edge-case vectors",
      ],
    },
    limitations: [
      "This establishes shared diagnostic data and pointer primitives, not validator emission behavior.",
      "Structural, semantic, catalog, runtime, publisher, and activation diagnostics remain assigned to later tasks.",
      "DESEN 0.1.0 permits namespaced codes but does not define their syntax; this API preserves caller-defined string literals without claiming a universal grammar.",
      "JSON Pointer URI fragments and document resolution are outside M02-T05.",
      "No Proof Matrix behavior claim becomes PROVEN from registry infrastructure alone.",
    ],
  };

  const artifactText = await format(JSON.stringify(artifact), {
    endOfLine: "lf",
    parser: "json",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Writes the deterministic M02-T05 artifact to its single tracked destination. */
export async function writeProtocolDiagnosticsEvidence({
  artifactPath = DEFAULT_PROTOCOL_DIAGNOSTICS_ARTIFACT_PATH,
} = {}) {
  try {
    const stats = await lstat(artifactPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      fail("DIAGNOSTIC_ARTIFACT_UNSUPPORTED_ENTRY", "Evidence destination is not a regular file.", {
        artifactPath,
      });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const result = await buildProtocolDiagnosticsEvidence();
  await writeFile(artifactPath, result.artifactBytes);
  return result;
}

/** Verifies frozen inputs, registry parity, pointer goldens, tracked hashes, and artifact bytes. */
export async function verifyProtocolDiagnostics({
  artifactPath = DEFAULT_PROTOCOL_DIAGNOSTICS_ARTIFACT_PATH,
  artifactBytes,
} = {}) {
  const result = await buildProtocolDiagnosticsEvidence();
  const trackedArtifact = artifactBytes ?? (await readFile(artifactPath));
  if (!Buffer.from(trackedArtifact).equals(result.artifactBytes)) {
    fail("DIAGNOSTIC_ARTIFACT_DRIFT", "Tracked M02-T05 evidence is stale or modified.", {
      artifactPath,
      expectedSha256: result.artifactSha256,
      actualSha256: sha256(trackedArtifact),
    });
  }
  return Object.freeze({
    result: "PASS",
    coreDiagnosticCodes: CORE_DIAGNOSTIC_REGISTRY.length,
    pointerVectors: POINTER_VECTORS.length,
    publicRuntimeExports: PUBLIC_RUNTIME_EXPORTS,
    publicTypeExports: PUBLIC_TYPE_EXPORTS,
    artifactSha256: result.artifactSha256,
  });
}
