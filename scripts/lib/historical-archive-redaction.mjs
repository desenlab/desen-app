import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { gunzipSync, gzipSync } from "node:zlib";

const MAX_COMPRESSED_BYTES = 4 * 1_024 * 1_024;
const MAX_INFLATED_BYTES = 8 * 1_024 * 1_024;
const MAX_DECODED_FILE_BYTES = 6 * 1_024 * 1_024;
const MAX_DECODED_TOTAL_BYTES = 8 * 1_024 * 1_024;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength").get;
const BUFFER_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer").get;
const MANIFEST_KEYS = Object.freeze([
  "schemaVersion",
  "profile",
  "baseCommit",
  "successorAddedPaths",
  "files",
  "projections",
]);

function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
}

function fail(code, message) {
  const error = new TypeError(message);
  error.code = code;
  throw error;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function captureBytes(value, limit) {
  if (
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value) ||
    ![Uint8Array.prototype, Buffer.prototype].includes(Object.getPrototypeOf(value))
  ) {
    fail("ARCHIVE_REDACTION_INPUT_INVALID", "Archive authority must be a plain byte view.");
  }
  const length = BYTE_LENGTH_GETTER.call(value);
  if (length === 0 || length > limit || utilTypes.isSharedArrayBuffer(BUFFER_GETTER.call(value))) {
    fail("ARCHIVE_REDACTION_INPUT_INVALID", "Archive authority exceeds its fixed byte boundary.");
  }
  // The intrinsic copy does not invoke caller-owned getters, iterators, or Buffer methods.
  const captured = Buffer.alloc(length);
  Uint8Array.prototype.set.call(captured, value);
  return captured;
}

/**
 * Explicit old-to-new archive transport identities for AR-01, never interchangeable receipts.
 * Historical identities remain provenance only; current readers admit only the redacted bytes.
 */
export const ARCHIVE_REDACTION_PINS = deepFreeze([
  {
    id: "t01b",
    path: "docs/proof/artifacts/desen-app-0.1.0-t01b-historical-reader-bridge.json.gz",
    historical: {
      path: "docs/proof/artifacts/desen-app-0.1.0-t01b-historical-reader-bridge.json.gz",
      bytes: 1826186,
      sha256: "49fb19ef436b48b7189278e649152e660fefea6881e1163213cc61e9e6e77c96",
      uncompressedBytes: 7522591,
      profile: "desen.app.m10-t01b-historical-reader-bridge.v1",
      baseCommit: "a44575d48e073468da6b25eb8b31a375218caf0a",
      fileEntries: 76,
      successorAddedPaths: 9,
      projections: 15,
    },
    current: {
      path: "docs/proof/artifacts/desen-app-0.1.0-t01b-historical-reader-bridge.json.gz",
      bytes: 1822971,
      sha256: "8aa5c5a8b6d01c22dffbec93615f729680a0161046e9031583293e40c646ca59",
      uncompressedBytes: 7514912,
      profile: "desen.app.m10-t01b-historical-reader-bridge.redacted.v1",
      baseCommit: "a44575d48e073468da6b25eb8b31a375218caf0a",
      fileEntries: 76,
      successorAddedPaths: 9,
      projections: 15,
    },
    technicalAuthoritySha256: "e25b5e347030fcd0249d50006af711f9db9b4e07c9570340149d96dd2b39d99e",
    preservedFileCount: 75,
    childPath: null,
    taskBoard: {
      path: "docs/plan/TASKS.md",
      historical: {
        bytes: 198868,
        sha256: "474b5f5cfe6502382f3103f0d07884e4c7a201330118e2ec8c2e37a574568aca",
      },
      current: {
        bytes: 193102,
        sha256: "225873dc0e0dc0bf74be0a5ff52a291195cb38a324620eab31d441472c73f8d7",
      },
      removedSections: 3,
      removedLines: 109,
      removedBytes: 5766,
      removedSha256: "3b93a047b2214efd792698a9c8d7d22f0dcf699d9d8562eb5b97b6e91d7cb408",
    },
  },
  {
    id: "t01c",
    path: "docs/proof/artifacts/desen-app-0.1.0-t01c-historical-reader-bridge.json.gz",
    historical: {
      path: "docs/proof/artifacts/desen-app-0.1.0-t01c-historical-reader-bridge.json.gz",
      bytes: 2307407,
      sha256: "16f6ec332fb03368e617563560b9930a7608594907ce61d5d15554be4dc7523d",
      uncompressedBytes: 4557796,
      profile: "desen.app.m10-t01c-historical-reader-bridge.v1",
      baseCommit: "3814002f89ec8e75019431cd1475a98c97041b0c",
      fileEntries: 68,
      successorAddedPaths: 2,
      projections: 1,
    },
    current: {
      path: "docs/proof/artifacts/desen-app-0.1.0-t01c-historical-reader-bridge.json.gz",
      bytes: 2304433,
      sha256: "35f7ae4c8717c1dbd8f06d07dc80329fb0fb2c7ff82435fa4c75d20018e8e441",
      uncompressedBytes: 4553517,
      profile: "desen.app.m10-t01c-historical-reader-bridge.redacted.v1",
      baseCommit: "3814002f89ec8e75019431cd1475a98c97041b0c",
      fileEntries: 68,
      successorAddedPaths: 2,
      projections: 1,
    },
    technicalAuthoritySha256: "365815a7f0217ff27755f9d3d99a85cd26670079a6119f1ae4d9b7a1e1056844",
    preservedFileCount: 67,
    childPath: "docs/proof/artifacts/desen-app-0.1.0-t01b-historical-reader-bridge.json.gz",
  },
  {
    id: "t02",
    path: "docs/proof/artifacts/desen-app-0.1.0-t02-historical-reader-bridge.json.gz",
    historical: {
      path: "docs/proof/artifacts/desen-app-0.1.0-t02-historical-reader-bridge.json.gz",
      bytes: 2491742,
      sha256: "a3ef969f87441e2d8079dc7cd27db3a759acbb645441d206c3b35adc3149ec10",
      uncompressedBytes: 3728371,
      profile: "desen.app.m10-t02-historical-reader-bridge.v1",
      baseCommit: "d2c632f2cacab5d316d57aa3d51758d2a76d3cd2",
      fileEntries: 25,
      successorAddedPaths: 2,
      projections: 1,
    },
    current: {
      path: "docs/proof/artifacts/desen-app-0.1.0-t02-historical-reader-bridge.json.gz",
      bytes: 2488718,
      sha256: "2682d586857a74d887c86b25aeeb804149e55db7c71e655077989c9630f9aaab",
      uncompressedBytes: 3724416,
      profile: "desen.app.m10-t02-historical-reader-bridge.redacted.v1",
      baseCommit: "d2c632f2cacab5d316d57aa3d51758d2a76d3cd2",
      fileEntries: 25,
      successorAddedPaths: 2,
      projections: 1,
    },
    technicalAuthoritySha256: "c7d923c508dd3d5e501b1aa6bb723be79ea709d9214dacfdd39cd01a765c28c3",
    preservedFileCount: 24,
    childPath: "docs/proof/artifacts/desen-app-0.1.0-t01c-historical-reader-bridge.json.gz",
  },
  {
    id: "t03",
    path: "docs/proof/artifacts/desen-app-0.1.0-t03-historical-reader-bridge.json.gz",
    historical: {
      path: "docs/proof/artifacts/desen-app-0.1.0-t03-historical-reader-bridge.json.gz",
      bytes: 2769997,
      sha256: "64f76eaeac8369a9f7ae00086dac914adc3c84979d53c770d2ebe0082576005f",
      uncompressedBytes: 4385030,
      profile: "desen.app.m10-t03-historical-reader-bridge.v1",
      baseCommit: "a1d26905aec6ee3d4bcb73ca17b02187e7b57420",
      fileEntries: 42,
      successorAddedPaths: 16,
      projections: 1,
    },
    current: {
      path: "docs/proof/artifacts/desen-app-0.1.0-t03-historical-reader-bridge.json.gz",
      bytes: 2766770,
      sha256: "7e992dbad2e371b937ef30c2406c12d05ee10ccb155f2a7177a67c3a2543e301",
      uncompressedBytes: 4381007,
      profile: "desen.app.m10-t03-historical-reader-bridge.redacted.v1",
      baseCommit: "a1d26905aec6ee3d4bcb73ca17b02187e7b57420",
      fileEntries: 42,
      successorAddedPaths: 16,
      projections: 1,
    },
    technicalAuthoritySha256: "32e5ad525bd6d8696b12b66c2ee019531a8ffa6c72bdab689d3ce171d70b897d",
    preservedFileCount: 41,
    childPath: "docs/proof/artifacts/desen-app-0.1.0-t02-historical-reader-bridge.json.gz",
  },
]);

/** Exact generator code receipt amendments; historical archived copies remain historical data. */
export const GENERATOR_REDACTION_RECEIPTS = deepFreeze([
  {
    path: "scripts/generate-desen-app-t01b-historical-reader-bridge.mjs",
    historical: {
      path: "scripts/generate-desen-app-t01b-historical-reader-bridge.mjs",
      bytes: 7618,
      sha256: "a0341d4a4700ae3a7400f55d6e8746411db7fbfc02bf80972e3683122cc4ae48",
    },
    current: {
      path: "scripts/generate-desen-app-t01b-historical-reader-bridge.mjs",
      bytes: 7878,
      sha256: "7e09aae470c39efd6426ca54e3e0b66686ba0ea889170c791dabf1490d44fc4b",
    },
  },
  {
    path: "scripts/generate-desen-app-t01c-historical-reader-bridge.mjs",
    historical: {
      path: "scripts/generate-desen-app-t01c-historical-reader-bridge.mjs",
      bytes: 4156,
      sha256: "640edcbcb68e55cd611af6cd8dceb9ac7a1a4a473bf6b4ecd94d5394050a14c3",
    },
    current: {
      path: "scripts/generate-desen-app-t01c-historical-reader-bridge.mjs",
      bytes: 4416,
      sha256: "22dbc0581d4923cfc656c0e0ec81791bf957c6ae5046d2e3b8e3ed2140c3269b",
    },
  },
  {
    path: "scripts/generate-desen-app-t02-historical-reader-bridge.mjs",
    historical: {
      path: "scripts/generate-desen-app-t02-historical-reader-bridge.mjs",
      bytes: 3564,
      sha256: "f01137b69949f08b311c424237721bace0495043e580c79a9f607ed927f98355",
    },
    current: {
      path: "scripts/generate-desen-app-t02-historical-reader-bridge.mjs",
      bytes: 3823,
      sha256: "4d908033760a530585cd0991d78ce7e364499cefc6201f1170403189b8a3bcd0",
    },
  },
  {
    path: "scripts/generate-desen-app-t03-historical-reader-bridge.mjs",
    historical: {
      path: "scripts/generate-desen-app-t03-historical-reader-bridge.mjs",
      bytes: 6289,
      sha256: "d7916982990ab2693ac21046f820b490dfc80b4b0d928e71a38f82268683f959",
    },
    current: {
      path: "scripts/generate-desen-app-t03-historical-reader-bridge.mjs",
      bytes: 6548,
      sha256: "9160d2f2f7bfe101fa75bbcecd42128b237a578379db50ae6729c66a343b4194",
    },
  },
]);

const PINS_BY_PATH = new Map(ARCHIVE_REDACTION_PINS.map((pin) => [pin.path, pin]));
const AMENDMENTS_BY_PATH = new Map(
  [...ARCHIVE_REDACTION_PINS, ...GENERATOR_REDACTION_RECEIPTS].map((pin) => [pin.path, pin]),
);

/** Returns the immutable, code-owned amendment for one exact repository archive path. */
export function getHistoricalArchiveRedactionPin(relativePath) {
  if (typeof relativePath !== "string" || !PINS_BY_PATH.has(relativePath)) {
    fail("ARCHIVE_REDACTION_INPUT_INVALID", "Unknown historical archive amendment path.");
  }
  return PINS_BY_PATH.get(relativePath);
}

function assertIdentity(bytes, receipt) {
  if (bytes.length !== receipt.bytes || sha256(bytes) !== receipt.sha256) {
    fail(
      "ARCHIVE_REDACTION_IDENTITY_MISMATCH",
      "Historical archive transport does not match the required exact pin.",
    );
  }
}

/**
 * Authenticates freshly captured current transport bytes. Old bytes cannot be re-admitted as an
 * alternative; both identities are returned so consumers can report the amendment honestly.
 */
export function authenticateRedactedHistoricalArchive(relativePath, rawBytes) {
  const pin = getHistoricalArchiveRedactionPin(relativePath);
  assertIdentity(captureBytes(rawBytes, MAX_COMPRESSED_BYTES), pin.current);
  return Object.freeze({ historical: pin.historical, current: pin.current });
}

/**
 * Matches only one of eight exact historical receipts to its explicitly approved new bytes.
 * This is not a general hash remapper: forged, current, extra-field, and executable receipts fail.
 */
export function matchesAmendedHistoricalReceipt(receipt, rawBytes) {
  try {
    if (
      receipt === null ||
      typeof receipt !== "object" ||
      utilTypes.isProxy(receipt) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(receipt))
    ) {
      return false;
    }
    const keys = Reflect.ownKeys(receipt);
    if (keys.length !== 3 || !["path", "bytes", "sha256"].every((key) => keys.includes(key))) {
      return false;
    }
    const values = Object.fromEntries(
      keys.map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(receipt, key);
        if (!Object.hasOwn(descriptor, "value")) {
          fail("ARCHIVE_REDACTION_INPUT_INVALID", "Receipt accessors are not authority.");
        }
        return [key, descriptor.value];
      }),
    );
    const amendment = AMENDMENTS_BY_PATH.get(values.path);
    if (
      amendment === undefined ||
      values.bytes !== amendment.historical.bytes ||
      values.sha256 !== amendment.historical.sha256
    ) {
      return false;
    }
    assertIdentity(captureBytes(rawBytes, MAX_COMPRESSED_BYTES), amendment.current);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRepositoryPath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length < 512 &&
    !value.includes("\\") &&
    ![...value].some((character) => character.codePointAt(0) <= 32) &&
    value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function parseManifest(pin, compressedBytes, historical) {
  const identity = historical ? pin.historical : pin.current;
  assertIdentity(compressedBytes, identity);
  let inflated;
  let manifest;
  try {
    inflated = gunzipSync(compressedBytes, { maxOutputLength: MAX_INFLATED_BYTES });
    manifest = JSON.parse(inflated.toString("utf8"));
  } catch {
    fail("ARCHIVE_REDACTION_MANIFEST_INVALID", "Archive payload is not bounded canonical JSON.");
  }
  if (
    inflated.length !== identity.uncompressedBytes ||
    !isRecord(manifest) ||
    Object.keys(manifest).length !== MANIFEST_KEYS.length ||
    !MANIFEST_KEYS.every((key) => Object.hasOwn(manifest, key)) ||
    manifest.schemaVersion !== 1 ||
    manifest.profile !== identity.profile ||
    manifest.baseCommit !== identity.baseCommit ||
    !Array.isArray(manifest.successorAddedPaths) ||
    manifest.successorAddedPaths.length !== identity.successorAddedPaths ||
    !manifest.successorAddedPaths.every(isRepositoryPath) ||
    new Set(manifest.successorAddedPaths).size !== identity.successorAddedPaths ||
    !isRecord(manifest.files) ||
    Object.keys(manifest.files).length !== identity.fileEntries ||
    !Object.keys(manifest.files).every(isRepositoryPath) ||
    !isRecord(manifest.projections) ||
    Object.keys(manifest.projections).length !== identity.projections ||
    !Buffer.from(JSON.stringify(manifest) + "\n").equals(inflated)
  ) {
    fail(
      "ARCHIVE_REDACTION_MANIFEST_INVALID",
      "Archive manifest differs from its closed authority.",
    );
  }
  let decodedBytes = 0;
  const decodedFiles = new Map();
  for (const [relativePath, encoded] of Object.entries(manifest.files)) {
    if (typeof encoded !== "string" || encoded.length > Math.ceil(MAX_DECODED_FILE_BYTES / 3) * 4) {
      fail("ARCHIVE_REDACTION_MANIFEST_INVALID", "Archive entry exceeds its byte boundary.");
    }
    const bytes = Buffer.from(encoded, "base64");
    decodedBytes += bytes.length;
    if (
      bytes.length > MAX_DECODED_FILE_BYTES ||
      decodedBytes > MAX_DECODED_TOTAL_BYTES ||
      bytes.toString("base64") !== encoded
    ) {
      fail("ARCHIVE_REDACTION_MANIFEST_INVALID", "Archive file encoding is not exact and bounded.");
    }
    decodedFiles.set(relativePath, bytes);
  }
  return { manifest, decodedFiles };
}

function assertTechnicalAuthority(pin, manifest, decodedFiles) {
  const changedPath = pin.taskBoard?.path ?? pin.childPath;
  const preservedFiles = [...decodedFiles]
    .filter(([relativePath]) => relativePath !== changedPath)
    .map(([relativePath, bytes]) => ({
      path: relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes),
    }));
  const technical = {
    schemaVersion: manifest.schemaVersion,
    baseCommit: manifest.baseCommit,
    successorAddedPaths: manifest.successorAddedPaths,
    projections: manifest.projections,
    preservedFiles,
  };
  const digest = sha256(Buffer.from(JSON.stringify(technical) + "\n"));
  if (preservedFiles.length !== pin.preservedFileCount || digest !== pin.technicalAuthoritySha256) {
    fail(
      "ARCHIVE_REDACTION_TECHNICAL_DRIFT",
      "Non-redacted technical files or historical projections changed.",
    );
  }
  return digest;
}

function assertNoDraftSections(text) {
  // Only actual draft section headings are forbidden; historical technical policy stays intact.
  if (/^#{1,6}[^\n]*\bpublic build-log drafts\b/im.test(text)) {
    fail("ARCHIVE_REDACTION_PROSE_DRIFT", "A private draft section remains in the archive.");
  }
}

/**
 * Freshly validates a current archive, every nested transport, all preserved technical receipts,
 * and the sanitized task board. decodedFiles is a detached Map for inspection, not shared authority;
 * callers must publish only its receipts, never the archived file payloads.
 */
export function inspectHistoricalArchiveRedaction(relativePath, rawBytes) {
  const pin = getHistoricalArchiveRedactionPin(relativePath);
  const bytes = captureBytes(rawBytes, MAX_COMPRESSED_BYTES);
  const { manifest, decodedFiles } = parseManifest(pin, bytes, false);
  const technicalAuthoritySha256 = assertTechnicalAuthority(pin, manifest, decodedFiles);
  let sanitizedTaskBoard;
  if (pin.taskBoard !== undefined) {
    const taskBoardBytes = decodedFiles.get(pin.taskBoard.path);
    if (taskBoardBytes === undefined) {
      fail("ARCHIVE_REDACTION_PROSE_DRIFT", "The required sanitized task board is missing.");
    }
    assertIdentity(taskBoardBytes, pin.taskBoard.current);
    sanitizedTaskBoard = Object.freeze({
      path: pin.taskBoard.path,
      bytes: taskBoardBytes.length,
      sha256: sha256(taskBoardBytes),
    });
  }
  for (const [filePath, fileBytes] of decodedFiles) {
    if (filePath.endsWith(".md")) assertNoDraftSections(fileBytes.toString("utf8"));
  }
  assertNoDraftSections(JSON.stringify(manifest.projections, null, 2));
  const nestedTransportReceipts = [];
  if (pin.childPath !== null) {
    const childBytes = decodedFiles.get(pin.childPath);
    if (childBytes === undefined) {
      fail("ARCHIVE_REDACTION_MANIFEST_INVALID", "The required nested archive is missing.");
    }
    const child = inspectHistoricalArchiveRedaction(pin.childPath, childBytes);
    nestedTransportReceipts.push(
      Object.freeze({
        path: pin.childPath,
        historical: child.historical,
        current: child.current,
      }),
      ...child.nestedTransportReceipts,
    );
    sanitizedTaskBoard = child.sanitizedTaskBoard;
  }
  return Object.freeze({
    historical: pin.historical,
    current: pin.current,
    technicalAuthoritySha256,
    ...(sanitizedTaskBoard === undefined ? {} : { sanitizedTaskBoard }),
    nestedTransportReceipts: Object.freeze(nestedTransportReceipts),
    decodedFiles,
  });
}

function redactTaskBoard(pin, originalBytes) {
  assertIdentity(originalBytes, pin.taskBoard.historical);
  const startMarker = Buffer.from("### M10-T01 public build-log drafts\n");
  const endMarker = Buffer.from("## M11 — Capability extensibility proof\n");
  const start = originalBytes.indexOf(startMarker);
  const end = originalBytes.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    fail("ARCHIVE_REDACTION_PROSE_DRIFT", "The approved redaction span is not present.");
  }
  const removed = originalBytes.subarray(start, end);
  if (
    removed.length !== pin.taskBoard.removedBytes ||
    sha256(removed) !== pin.taskBoard.removedSha256 ||
    removed.toString("utf8").split("\n").length - 1 !== pin.taskBoard.removedLines
  ) {
    fail("ARCHIVE_REDACTION_PROSE_DRIFT", "The redaction span differs from its exact authority.");
  }
  const sanitized = Buffer.concat([originalBytes.subarray(0, start), originalBytes.subarray(end)]);
  assertIdentity(sanitized, pin.taskBoard.current);
  assertNoDraftSections(sanitized.toString("utf8"));
  return sanitized;
}

/**
 * Deterministically redacts one authenticated original archive before publication. Only the three
 * approved prose sections, explicit nested transports, and the versioned transport profile change.
 * Original bytes are accepted only here as migration input, never by a current proof reader.
 * Neither private prose nor a fallback transport can be emitted: the final bytes must match AR-01.
 */
export function redactHistoricalArchiveForPublication(relativePath, rawOriginalBytes) {
  const pin = getHistoricalArchiveRedactionPin(relativePath);
  const bytes = captureBytes(rawOriginalBytes, MAX_COMPRESSED_BYTES);
  const { manifest, decodedFiles } = parseManifest(pin, bytes, true);
  assertTechnicalAuthority(pin, manifest, decodedFiles);
  if (pin.taskBoard !== undefined) {
    const taskBoardBytes = decodedFiles.get(pin.taskBoard.path);
    if (taskBoardBytes === undefined) {
      fail("ARCHIVE_REDACTION_PROSE_DRIFT", "The original task board is missing.");
    }
    manifest.files[pin.taskBoard.path] = redactTaskBoard(pin, taskBoardBytes).toString("base64");
  } else {
    const childBytes = decodedFiles.get(pin.childPath);
    if (childBytes === undefined) {
      fail(
        "ARCHIVE_REDACTION_MANIFEST_INVALID",
        "The required original nested archive is missing.",
      );
    }
    manifest.files[pin.childPath] = redactHistoricalArchiveForPublication(
      pin.childPath,
      childBytes,
    ).toString("base64");
  }
  manifest.profile = pin.current.profile;
  const sanitizedBytes = gzipSync(Buffer.from(JSON.stringify(manifest) + "\n"), {
    level: 9,
    mtime: 0,
  });
  inspectHistoricalArchiveRedaction(relativePath, sanitizedBytes);
  return sanitizedBytes;
}
