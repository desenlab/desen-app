import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";

import {
  calculateDesenBundleRevision,
  calculateDesenSourceDigest,
  canonicalizeJson,
  canonicalizeJsonBytes,
  digestCanonicalJson,
  isSha256Digest,
  sha256Hex,
} from "../../packages/protocol/src/canonicalization.ts";

import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

/** Absolute path to the deterministic M02-T04 evidence artifact. */
export const DEFAULT_PROTOCOL_CANONICALIZATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-canonicalization.json",
);

const RFC_CANONICAL_TEXT = `{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA'B\\"\\\\\\\\\\"/"}`;
const RFC_CANONICAL_UTF8_HEX =
  "7b226c69746572616c73223a5b6e756c6c2c747275652c66616c73655d2c226e756d62657273223a5b3333333333333333332e333333333333332c31652b33302c342e352c302e3030322c31652d32375d2c22737472696e67223a22e282ac245c75303030665c6e4127425c225c5c5c5c5c222f227d";
const RFC_CANONICAL_SHA256 = "2d5e01a318d0f0879ab568c4be289c8b1f64ef8921a53c6277d5e069978baacb";
const RFC_SORTED_KEYS = Object.freeze(["\r", "1", "\u0080", "ö", "€", "😀", "דּ"]);
const RFC_SORT_CANONICAL_TEXT = `{"\\r":"Carriage Return","1":"One","":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}`;

const RFC_NUMBER_VECTORS = Object.freeze([
  Object.freeze(["0000000000000000", "0"]),
  Object.freeze(["8000000000000000", "0"]),
  Object.freeze(["0000000000000001", "5e-324"]),
  Object.freeze(["8000000000000001", "-5e-324"]),
  Object.freeze(["7fefffffffffffff", "1.7976931348623157e+308"]),
  Object.freeze(["ffefffffffffffff", "-1.7976931348623157e+308"]),
  Object.freeze(["4340000000000000", "9007199254740992"]),
  Object.freeze(["c340000000000000", "-9007199254740992"]),
  Object.freeze(["4430000000000000", "295147905179352830000"]),
  Object.freeze(["44b52d02c7e14af5", "9.999999999999997e+22"]),
  Object.freeze(["44b52d02c7e14af6", "1e+23"]),
  Object.freeze(["44b52d02c7e14af7", "1.0000000000000001e+23"]),
  Object.freeze(["444b1ae4d6e2ef4e", "999999999999999700000"]),
  Object.freeze(["444b1ae4d6e2ef4f", "999999999999999900000"]),
  Object.freeze(["444b1ae4d6e2ef50", "1e+21"]),
  Object.freeze(["3eb0c6f7a0b5ed8c", "9.999999999999997e-7"]),
  Object.freeze(["3eb0c6f7a0b5ed8d", "0.000001"]),
  Object.freeze(["41b3de4355555553", "333333333.3333332"]),
  Object.freeze(["41b3de4355555554", "333333333.33333325"]),
  Object.freeze(["41b3de4355555555", "333333333.3333333"]),
  Object.freeze(["41b3de4355555556", "333333333.3333334"]),
  Object.freeze(["41b3de4355555557", "333333333.33333343"]),
  Object.freeze(["becbf647612f3696", "-0.0000033333333333333333"]),
  Object.freeze(["43143ff3c1cb0959", "1424953923781206.2"]),
]);

const SHA256_VECTORS = Object.freeze([
  Object.freeze({
    id: "nist-empty",
    input: Object.freeze({ encoding: "ascii", value: "", bytes: 0 }),
    expected: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  }),
  Object.freeze({
    id: "nist-abc",
    input: Object.freeze({ encoding: "ascii", value: "abc", bytes: 3 }),
    expected: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  }),
  Object.freeze({
    id: "nist-multiblock",
    input: Object.freeze({
      encoding: "ascii",
      value: "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      bytes: 56,
    }),
    expected: "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
  }),
  Object.freeze({
    id: "padding-55",
    input: Object.freeze({ encoding: "repeat-byte", byte: 0x61, bytes: 55 }),
    expected: "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318",
  }),
  Object.freeze({
    id: "padding-56",
    input: Object.freeze({ encoding: "repeat-byte", byte: 0x61, bytes: 56 }),
    expected: "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a",
  }),
  Object.freeze({
    id: "padding-63",
    input: Object.freeze({ encoding: "repeat-byte", byte: 0x61, bytes: 63 }),
    expected: "7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34",
  }),
  Object.freeze({
    id: "padding-64",
    input: Object.freeze({ encoding: "repeat-byte", byte: 0x61, bytes: 64 }),
    expected: "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
  }),
  Object.freeze({
    id: "padding-65",
    input: Object.freeze({ encoding: "repeat-byte", byte: 0x61, bytes: 65 }),
    expected: "635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0",
  }),
]);

const FROZEN_FIXTURES = Object.freeze({
  source: Object.freeze({
    path: "examples/sign-in.source.desen.json",
    fileSha256: "c4b81882420d1b861dbf421da30c1447558560401f697fb7e3883fd6aaf0f7e1",
    rawCanonicalBytes: 2025,
    rawDigest: "sha256:1ecc6666503a5c9e5825f9db2455356bbbe22f48978a0016d00f4531b7bc4963",
    projectedCanonicalBytes: 1903,
    projectedDigest: "sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878",
  }),
  bundle: Object.freeze({
    path: "examples/sign-in.bundle.desen.json",
    fileSha256: "96be7f18b7b825110d7ba3703c15124ab7a09b9926b01cde43633915eaaf2edf",
    rawCanonicalBytes: 2270,
    rawDigest: "sha256:adb67ee33f7e8f0428fb2da10c4762c9d4d0517fd90acc65ccbcace24efc3d73",
    projectedCanonicalBytes: 2088,
    projectedDigest: "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601",
  }),
  revisionMismatch: Object.freeze({
    path: "conformance/invalid/bundle-revision-mismatch.json",
    fileSha256: "9d62db332b8e62f54f1470489959b31c6ce34617a3103cb1bf8d370d870b87e2",
    storedRevision: `sha256:${"f".repeat(64)}`,
    calculatedRevision: "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601",
  }),
  regressionSources: Object.freeze([
    Object.freeze({
      path: "examples/sortable-list.source.desen.json",
      fileSha256: "0cd1a8a48a0b182a41d219cbdb1d1c091186e83a9b6f99394a5ac5653b92920b",
      projectedCanonicalBytes: 1016,
      projectedDigest: "sha256:52f96e80d8e8b40f379bf4c872cb5abf78383cff0f08f861c1f96ba69472a2be",
    }),
    Object.freeze({
      path: "examples/store-map.source.desen.json",
      fileSha256: "c9d49c0b338164a68f4db9613b470de318e626028e8be4c10ae6213008617c3e",
      projectedCanonicalBytes: 1515,
      projectedDigest: "sha256:6ef45d43c603bd1e3fa0ccd4d538869be65a6782d5f51a87e0028a2cc1109990",
    }),
  ]),
});

const TRACKED_IMPLEMENTATION_PATHS = Object.freeze([
  "packages/protocol/src/canonicalization.ts",
  "packages/protocol/test/canonicalization.test.ts",
  "scripts/lib/protocol-canonicalization-proof.mjs",
  "scripts/generate-protocol-canonicalization-proof.mjs",
  "scripts/verify-protocol-canonicalization.mjs",
  "tests/protocol-canonicalization.test.mjs",
]);

const PUBLIC_EXPORTS = Object.freeze([
  "canonicalizeJson",
  "canonicalizeJsonBytes",
  "sha256Bytes",
  "sha256Hex",
  "sha256Digest",
  "digestCanonicalJson",
  "calculateDesenSourceDigest",
  "calculateDesenBundleRevision",
  "isSha256Digest",
]);

/** Stable internal failure raised by M02-T04 evidence generation and verification. */
export class ProtocolCanonicalizationEvidenceError extends Error {
  /**
   * @param {string} code stable internal failure code
   * @param {string} message human-readable failure summary
   * @param {Record<string, unknown>} [details] structured failure context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProtocolCanonicalizationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProtocolCanonicalizationEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function ascii(value) {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function numberFromIeee754Hex(bits) {
  const bytes = new Uint8Array(8);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(bits.slice(index * 2, index * 2 + 2), 16);
  }
  return new DataView(bytes.buffer).getFloat64(0);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail("CANONICALIZATION_GOLDEN_MISMATCH", `${label} differs from its fixed golden value.`, {
      label,
      expected,
      actual,
    });
  }
}

async function assertPublicExports() {
  const indexSource = await readFile(
    path.join(WORKSPACE_ROOT, "packages/protocol/src/index.ts"),
    "utf8",
  );
  const runtimeExports = new Set(
    [...indexSource.matchAll(/export\s*\{([\s\S]*?)\}\s*from\s*"[^"]+";/gu)].flatMap(([, names]) =>
      names
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== "" && !name.startsWith("type ")),
    ),
  );
  for (const exportName of PUBLIC_EXPORTS) {
    if (!runtimeExports.has(exportName)) {
      fail(
        "CANONICALIZATION_PUBLIC_EXPORT_MISSING",
        `The package root no longer exposes ${exportName}.`,
        { exportName },
      );
    }
  }
}

function shaVectorInput(vector) {
  return vector.input.encoding === "ascii"
    ? ascii(vector.input.value)
    : new Uint8Array(vector.input.bytes).fill(vector.input.byte);
}

async function loadFrozenFixture(snapshotRoot, specification) {
  const bytes = await readFile(path.join(snapshotRoot, ...specification.path.split("/")));
  assertEqual(sha256(bytes), specification.fileSha256, `${specification.path} file SHA-256`);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

async function trackedFileEvidence() {
  return Promise.all(
    TRACKED_IMPLEMENTATION_PATHS.map(async (relativePath) => {
      const bytes = await readFile(path.join(WORKSPACE_ROOT, ...relativePath.split("/")));
      return { path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) };
    }),
  );
}

/** Builds the deterministic M02-T04 artifact entirely in memory. */
export async function buildProtocolCanonicalizationEvidence({
  snapshotRoot = DEFAULT_SNAPSHOT_ROOT,
  verifySnapshot = true,
} = {}) {
  if (verifySnapshot) await verifyProtocolSnapshot(snapshotRoot);
  await assertPublicExports();

  const rfcInput = {
    numbers: [Number("333333333.33333329"), 1e30, 4.5, 2e-3, 1e-27],
    string: `€$\u000f\nA'B"\\\\"/`,
    literals: [null, true, false],
  };
  const rfcText = canonicalizeJson(rfcInput);
  const rfcBytes = canonicalizeJsonBytes(rfcInput);
  assertEqual(rfcText, RFC_CANONICAL_TEXT, "RFC 8785 canonical example text");
  assertEqual(bytesToHex(rfcBytes), RFC_CANONICAL_UTF8_HEX, "RFC 8785 canonical UTF-8 bytes");
  assertEqual(sha256Hex(rfcBytes), RFC_CANONICAL_SHA256, "RFC 8785 canonical example SHA-256");

  const sortInput = {
    "€": "Euro Sign",
    "\r": "Carriage Return",
    דּ: "Hebrew Letter Dalet With Dagesh",
    1: "One",
    "😀": "Emoji: Grinning Face",
    "\u0080": "Control",
    ö: "Latin Small Letter O With Diaeresis",
  };
  assertEqual(canonicalizeJson(sortInput), RFC_SORT_CANONICAL_TEXT, "RFC UTF-16 key order");

  for (const [bits, expected] of RFC_NUMBER_VECTORS) {
    assertEqual(canonicalizeJson(numberFromIeee754Hex(bits)), expected, `RFC number ${bits}`);
  }
  for (const vector of SHA256_VECTORS) {
    assertEqual(sha256Hex(shaVectorInput(vector)), vector.expected, `SHA-256 vector ${vector.id}`);
  }

  const source = await loadFrozenFixture(snapshotRoot, FROZEN_FIXTURES.source);
  const bundle = await loadFrozenFixture(snapshotRoot, FROZEN_FIXTURES.bundle);
  const mismatch = await loadFrozenFixture(snapshotRoot, FROZEN_FIXTURES.revisionMismatch);
  const regressionSources = await Promise.all(
    FROZEN_FIXTURES.regressionSources.map(async (specification) => ({
      specification,
      ...(await loadFrozenFixture(snapshotRoot, specification)),
    })),
  );

  assertEqual(
    canonicalizeJsonBytes(source.value).byteLength,
    FROZEN_FIXTURES.source.rawCanonicalBytes,
    "sign-in Source raw canonical byte length",
  );
  assertEqual(
    digestCanonicalJson(source.value),
    FROZEN_FIXTURES.source.rawDigest,
    "sign-in Source raw digest",
  );
  assertEqual(
    calculateDesenSourceDigest(source.value),
    FROZEN_FIXTURES.source.projectedDigest,
    "sign-in Source projected digest",
  );
  const sourceProjection = { ...source.value };
  delete sourceProjection.authoring;
  assertEqual(
    canonicalizeJsonBytes(sourceProjection).byteLength,
    FROZEN_FIXTURES.source.projectedCanonicalBytes,
    "sign-in Source projected byte length",
  );

  assertEqual(
    canonicalizeJsonBytes(bundle.value).byteLength,
    FROZEN_FIXTURES.bundle.rawCanonicalBytes,
    "sign-in Bundle raw canonical byte length",
  );
  assertEqual(
    digestCanonicalJson(bundle.value),
    FROZEN_FIXTURES.bundle.rawDigest,
    "sign-in Bundle raw digest",
  );
  assertEqual(
    calculateDesenBundleRevision(bundle.value),
    FROZEN_FIXTURES.bundle.projectedDigest,
    "sign-in Bundle projected revision",
  );
  const bundleProjection = { ...bundle.value };
  delete bundleProjection.revision;
  delete bundleProjection.publication;
  assertEqual(
    canonicalizeJsonBytes(bundleProjection).byteLength,
    FROZEN_FIXTURES.bundle.projectedCanonicalBytes,
    "sign-in Bundle projected byte length",
  );
  assertEqual(
    bundle.value.sourceDigest,
    FROZEN_FIXTURES.source.projectedDigest,
    "stored sourceDigest",
  );
  assertEqual(bundle.value.revision, FROZEN_FIXTURES.bundle.projectedDigest, "stored revision");
  assertEqual(
    mismatch.value.revision,
    FROZEN_FIXTURES.revisionMismatch.storedRevision,
    "tampered revision",
  );
  assertEqual(
    calculateDesenBundleRevision(mismatch.value),
    FROZEN_FIXTURES.revisionMismatch.calculatedRevision,
    "tampered Bundle calculated revision",
  );
  if (mismatch.value.revision === calculateDesenBundleRevision(mismatch.value)) {
    fail("CANONICALIZATION_GOLDEN_MISMATCH", "The frozen revision mismatch no longer mismatches.");
  }

  for (const { specification, value } of regressionSources) {
    const projected = { ...value };
    delete projected.authoring;
    assertEqual(
      canonicalizeJsonBytes(projected).byteLength,
      specification.projectedCanonicalBytes,
      `${specification.path} projected byte length`,
    );
    assertEqual(
      calculateDesenSourceDigest(value),
      specification.projectedDigest,
      `${specification.path} projected digest`,
    );
  }

  const frozenJcsModule = await import(
    pathToFileURL(path.join(snapshotRoot, "tools/jcs.mjs")).href
  );
  assertEqual(
    frozenJcsModule.digest("source", source.value),
    FROZEN_FIXTURES.source.projectedDigest,
    "frozen helper Source oracle",
  );
  assertEqual(
    frozenJcsModule.digest("bundle", bundle.value),
    FROZEN_FIXTURES.bundle.projectedDigest,
    "frozen helper Bundle oracle",
  );

  const artifact = {
    task: "M02-T04",
    protocolVersion: "0.1.0",
    profile: "rfc8785-sha256-v1",
    frozenInput: {
      sourceCommit: EXPECTED_PROTOCOL_SNAPSHOT.sourceCommit,
      sourceTree: EXPECTED_PROTOCOL_SNAPSHOT.sourceTree,
      aggregateSha256: EXPECTED_PROTOCOL_SNAPSHOT.aggregateSha256,
    },
    standards: [
      {
        id: "RFC 8785",
        url: "https://www.rfc-editor.org/rfc/rfc8785.html",
        coverage: [
          "canonical primitive serialization",
          "recursive UTF-16 property ordering",
          "UTF-8 output",
          "all 24 finite Appendix B number samples",
          "lone-surrogate and non-finite rejection",
        ],
      },
      {
        id: "FIPS 180-4",
        url: "https://doi.org/10.6028/NIST.FIPS.180-4",
        coverage: ["SHA-256 empty, short, multi-block, and padding-boundary vectors"],
      },
    ],
    implementation: {
      package: "@desen/protocol",
      platform: "ECMAScript 2023",
      runtimeDependencies: [],
      evidenceFormatter: { name: "prettier", version: "3.9.6" },
      publicExports: PUBLIC_EXPORTS,
      trackedFiles: await trackedFileEvidence(),
    },
    rfc8785: {
      canonicalExample: {
        canonicalText: RFC_CANONICAL_TEXT,
        canonicalUtf8Hex: RFC_CANONICAL_UTF8_HEX,
        canonicalBytes: rfcBytes.byteLength,
        sha256: RFC_CANONICAL_SHA256,
      },
      utf16PropertyOrder: RFC_SORTED_KEYS,
      numberSamples: RFC_NUMBER_VECTORS.map(([ieee754, canonical]) => ({
        ieee754,
        canonical,
      })),
      rejectedInputClasses: [
        "NaN and infinity",
        "lone surrogates",
        "undefined, bigint, symbol, and function",
        "sparse or extended arrays",
        "cycles, accessors, serialization hooks, and non-JSON prototypes",
      ],
    },
    sha256: {
      outputBytes: 32,
      vectors: SHA256_VECTORS.map((vector) => ({
        id: vector.id,
        input: vector.input,
        digestHex: vector.expected,
      })),
    },
    desen: {
      digestFormat: "sha256:<64 lowercase hexadecimal characters>",
      digestFormatAccepted: isSha256Digest(FROZEN_FIXTURES.source.projectedDigest),
      source: {
        path: FROZEN_FIXTURES.source.path,
        fileSha256: FROZEN_FIXTURES.source.fileSha256,
        projection: "omit only top-level authoring; retain extensions",
        rawCanonicalBytes: FROZEN_FIXTURES.source.rawCanonicalBytes,
        rawDigest: FROZEN_FIXTURES.source.rawDigest,
        projectedCanonicalBytes: FROZEN_FIXTURES.source.projectedCanonicalBytes,
        sourceDigest: FROZEN_FIXTURES.source.projectedDigest,
      },
      bundle: {
        path: FROZEN_FIXTURES.bundle.path,
        fileSha256: FROZEN_FIXTURES.bundle.fileSha256,
        projection: "omit only top-level revision and publication",
        rawCanonicalBytes: FROZEN_FIXTURES.bundle.rawCanonicalBytes,
        rawDigest: FROZEN_FIXTURES.bundle.rawDigest,
        projectedCanonicalBytes: FROZEN_FIXTURES.bundle.projectedCanonicalBytes,
        revision: FROZEN_FIXTURES.bundle.projectedDigest,
      },
      revisionMismatch: FROZEN_FIXTURES.revisionMismatch,
      regressionSources: FROZEN_FIXTURES.regressionSources,
    },
    verification: {
      commands: [
        "pnpm verify:protocol-canonicalization",
        "pnpm test:protocol-canonicalization",
        "pnpm check",
      ],
      packageTests: 12,
      independentOracles: [
        "fixed RFC 8785 expected text and bytes",
        "fixed FIPS/NIST and SHA-256 padding vectors",
        "Node.js crypto comparisons in root tests",
        "frozen upstream tools/jcs.mjs for valid DESEN fixtures",
      ],
    },
    limitations: [
      "This proves canonicalization and digest primitives, not DESEN structural or semantic validation.",
      "Value-based canonicalization cannot recover duplicate names already discarded by a JSON parser; parsing must enforce I-JSON before this API.",
      "Source and Bundle helpers implement only the Section 11 projections and do not prove a document is otherwise valid.",
      "A raw Catalog JCS hash is not a capability package digest; package archive digest rules remain owned by M03-T04.",
      "Publisher determinism, activation-time verification, and diagnostic emission remain assigned to later tasks; shared diagnostic primitives are covered separately by M02-T05.",
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

/** Writes the deterministic M02-T04 artifact to its single tracked destination. */
export async function writeProtocolCanonicalizationEvidence({
  artifactPath = DEFAULT_PROTOCOL_CANONICALIZATION_ARTIFACT_PATH,
} = {}) {
  try {
    const stats = await lstat(artifactPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      fail("CANONICALIZATION_ARTIFACT_UNSUPPORTED_ENTRY", "Evidence destination is not a file.", {
        artifactPath,
      });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const result = await buildProtocolCanonicalizationEvidence();
  await writeFile(artifactPath, result.artifactBytes);
  return result;
}

/** Verifies frozen inputs, every golden, tracked implementation hashes, and exact artifact bytes. */
export async function verifyProtocolCanonicalization({
  artifactPath = DEFAULT_PROTOCOL_CANONICALIZATION_ARTIFACT_PATH,
  artifactBytes,
} = {}) {
  const result = await buildProtocolCanonicalizationEvidence();
  const trackedArtifact = artifactBytes ?? (await readFile(artifactPath));
  if (!Buffer.from(trackedArtifact).equals(result.artifactBytes)) {
    fail("CANONICALIZATION_ARTIFACT_DRIFT", "Tracked M02-T04 evidence is stale or modified.", {
      artifactPath,
      expectedSha256: result.artifactSha256,
      actualSha256: sha256(trackedArtifact),
    });
  }
  return Object.freeze({
    result: "PASS",
    rfcNumberSamples: RFC_NUMBER_VECTORS.length,
    sha256Vectors: SHA256_VECTORS.length,
    frozenDesenGoldens: 5,
    publicExports: PUBLIC_EXPORTS,
    artifactSha256: result.artifactSha256,
  });
}
