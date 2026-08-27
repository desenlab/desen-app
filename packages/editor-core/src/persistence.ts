/* eslint-disable @typescript-eslint/no-invalid-void-type -- Persistence callbacks are deliberately
 * receiver-independent at the platform-neutral adapter boundary. */
import { canonicalizeJsonBytes } from "@desen/protocol";

import { createDesenEditorDocument } from "./source-document.js";

import type { DesenDiagnostic } from "@desen/protocol";
import type { DesenEditorDocument } from "./source-document.js";

const MAX_DOCUMENT_CANONICAL_BYTES = 8_388_608;
const MAX_GENERATION = Number.MAX_SAFE_INTEGER;
const ADAPTER_KEYS = Object.freeze(["compareAndSetSource", "readSource"] as const);
const ADAPTER_RECORD_KEYS = Object.freeze(["generation", "sourceKey", "value"] as const);
const ADAPTER_FAILURE_KEYS = Object.freeze(["reason", "status"] as const);
const ADAPTER_FOUND_KEYS = Object.freeze(["record", "status"] as const);
const ADAPTER_MISSING_KEYS = Object.freeze(["status"] as const);
const SAVE_REQUEST_KEYS = Object.freeze(["document", "expectedGeneration", "sourceKey"] as const);
const ADAPTER_WRITE_REQUEST_KEYS = Object.freeze([
  "bytes",
  "expectedGeneration",
  "sourceKey",
] as const);

/** Stable reasons that a persistence adapter may report without exposing platform errors. */
export type DesenEditorPersistenceAdapterFailureReason =
  | "authentication-required"
  | "source-invalid"
  | "source-limit-exceeded"
  | "storage-busy"
  | "storage-corrupt"
  | "storage-unavailable"
  | "unsafe-storage";

/** One parsed Source candidate and its atomic positive compare-and-set generation. */
export interface DesenEditorPersistenceAdapterSourceRecord {
  /** Storage identity selected by the read request, independent of the Source document id. */
  readonly sourceKey: string;
  /** Positive safe-integer generation observed atomically with the Source value. */
  readonly generation: number;
  /** Untrusted parsed Source candidate that editor-core must structurally re-admit. */
  readonly value: unknown;
}

/** Controlled storage-level result of reading one editable Source identity. */
export type DesenEditorPersistenceAdapterReadResult =
  | Readonly<{
      /** Confirms that one complete candidate record was observed. */
      status: "found";
      /** Candidate record whose key, generation, and value are revalidated by editor-core. */
      record: DesenEditorPersistenceAdapterSourceRecord;
    }>
  | Readonly<{
      /** Confirms that no record currently owns the requested storage identity. */
      status: "missing";
    }>
  | Readonly<{
      /** Confirms a definite read failure with no platform error object or sensitive detail. */
      status: "failed";
      /** Stable redacted classification translated into an editor persistence diagnostic. */
      reason: DesenEditorPersistenceAdapterFailureReason;
    }>;

/** Exact canonical byte candidate supplied to an adapter compare-and-set write. */
export interface DesenEditorPersistenceAdapterWriteRequest {
  /** Storage identity selected by the editor, independent of the Source document id. */
  readonly sourceKey: string;
  /** `null` creates only when absent; a positive safe integer updates only that generation. */
  readonly expectedGeneration: number | null;
  /** Fresh complete RFC 8785 Source bytes, including root authoring and extensions. */
  readonly bytes: Readonly<Uint8Array>;
}

/** Controlled storage-level result of one editable Source compare-and-set write. */
export type DesenEditorPersistenceAdapterWriteResult =
  | Readonly<{
      /** An absent identity durably accepted its first complete Source. */
      status: "created";
      /** The first local Source generation is exactly one. */
      generation: 1;
    }>
  | Readonly<{
      /** The expected generation durably advanced to its exact successor. */
      status: "updated";
      /** Positive successor generation committed by the adapter. */
      generation: number;
    }>
  | Readonly<{
      /** The exact candidate already owned the expected generation, so no write occurred. */
      status: "unchanged";
      /** Unchanged positive generation. */
      generation: number;
    }>
  | Readonly<{
      /** Absence or another generation won before this request, so no write occurred. */
      status: "conflict";
      /** Current positive generation, or `null` when an expected record is absent. */
      currentGeneration: number | null;
    }>
  | Readonly<{
      /** A different candidate could not advance the largest exact generation. */
      status: "generation-exhausted";
      /** Exact exhausted generation, always `Number.MAX_SAFE_INTEGER`. */
      generation: number;
    }>
  | Readonly<{
      /** The adapter cannot prove whether the complete candidate durably committed. */
      status: "indeterminate";
    }>
  | Readonly<{
      /** The adapter proved that this request did not commit. */
      status: "failed";
      /** Stable redacted classification translated into an editor persistence diagnostic. */
      reason: DesenEditorPersistenceAdapterFailureReason;
    }>;

/** Trusted platform integration used by the neutral editor persistence port. */
export interface DesenEditorPersistenceAdapter {
  /** Reads and parses one Source candidate without granting storage authority to the document. */
  readonly readSource: (
    this: void,
    sourceKey: string,
  ) => Promise<DesenEditorPersistenceAdapterReadResult>;
  /** Atomically compares and sets one complete canonical Source byte sequence. */
  readonly compareAndSetSource: (
    this: void,
    request: DesenEditorPersistenceAdapterWriteRequest,
  ) => Promise<DesenEditorPersistenceAdapterWriteResult>;
}

/** Stable editor persistence diagnostic codes emitted by the platform-neutral port. */
export type DesenEditorPersistenceDiagnosticCode =
  | "run.desen.editor/PERSISTENCE_ADAPTER_FAILURE"
  | "run.desen.editor/PERSISTENCE_ADAPTER_RESULT_INVALID"
  | "run.desen.editor/PERSISTENCE_AUTHENTICATION_REQUIRED"
  | "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE"
  | "run.desen.editor/PERSISTENCE_DOCUMENT_INVALID"
  | "run.desen.editor/PERSISTENCE_LIMIT_EXCEEDED"
  | "run.desen.editor/PERSISTENCE_REQUEST_INVALID"
  | "run.desen.editor/PERSISTENCE_SOURCE_INVALID"
  | "run.desen.editor/PERSISTENCE_SOURCE_LIMIT_EXCEEDED"
  | "run.desen.editor/PERSISTENCE_STORAGE_BUSY"
  | "run.desen.editor/PERSISTENCE_STORAGE_CORRUPT"
  | "run.desen.editor/PERSISTENCE_STORAGE_UNAVAILABLE"
  | "run.desen.editor/PERSISTENCE_UNSAFE_STORAGE";

/** Frozen JSON-serializable diagnostic emitted by the editor persistence port. */
export type DesenEditorPersistenceDiagnostic = Readonly<
  DesenDiagnostic<DesenEditorPersistenceDiagnosticCode>
>;

/** Successful open of one independent immutable editor Source generation. */
export interface DesenEditorSourceOpenSuccess {
  /** Confirms that one structurally admitted Source is available. */
  readonly status: "opened";
  /** Positive generation observed atomically with the stored Source value. */
  readonly generation: number;
  /** Fresh detached recursively immutable direct Source document. */
  readonly document: DesenEditorDocument;
}

/** Controlled result of opening one editor Source identity. */
export type DesenEditorSourceOpenResult =
  | DesenEditorSourceOpenSuccess
  | Readonly<{
      /** No Source currently owns the requested storage identity. */
      status: "missing";
    }>
  | Readonly<{
      /** The Source could not be opened and no partial document is exposed. */
      status: "failed";
      /** Stable redacted failure safe for JSON serialization and user-facing mapping. */
      diagnostic: DesenEditorPersistenceDiagnostic;
    }>;

/** Complete generation-guarded request to save one editor Source. */
export interface DesenEditorSourceSaveRequest {
  /** Storage identity selected by the editor, independent of the Source document id. */
  readonly sourceKey: string;
  /** `null` creates only when absent; a positive safe integer updates only that generation. */
  readonly expectedGeneration: number | null;
  /** Complete direct editor Source to re-admit, bound, canonicalize, and save atomically. */
  readonly document: DesenEditorDocument;
}

/** Controlled result of one editor Source save attempt. */
export type DesenEditorSourceSaveResult =
  | Readonly<{
      /** An absent identity durably accepted its first complete Source. */
      status: "created";
      /** The first local Source generation is exactly one. */
      generation: 1;
    }>
  | Readonly<{
      /** The exact expected generation durably advanced. */
      status: "updated";
      /** Exact successor of the expected generation. */
      generation: number;
    }>
  | Readonly<{
      /** The canonical Source already owned the expected generation. */
      status: "unchanged";
      /** Generation retained without a write. */
      generation: number;
    }>
  | Readonly<{
      /** The requested absence or generation no longer identifies current storage. */
      status: "conflict";
      /** Current positive generation, or `null` when an expected record is absent. */
      currentGeneration: number | null;
    }>
  | Readonly<{
      /** A different Source cannot advance the largest exact generation. */
      status: "generation-exhausted";
      /** Exact exhausted generation. */
      generation: number;
    }>
  | Readonly<{
      /** Storage may have committed; callers must reopen instead of assuming failure. */
      status: "indeterminate";
      /** Stable redacted diagnostic explaining the uncertain commit outcome. */
      diagnostic: DesenEditorPersistenceDiagnostic;
    }>
  | Readonly<{
      /** The request definitely did not commit. */
      status: "failed";
      /** Stable redacted failure safe for JSON serialization and user-facing mapping. */
      diagnostic: DesenEditorPersistenceDiagnostic;
    }>;

/** Framework-neutral open/save boundary consumed by editor applications. */
export interface DesenEditorPersistencePort {
  /** Opens one storage identity as a fresh structurally admitted editor document. */
  readonly openSource: (this: void, sourceKey: string) => Promise<DesenEditorSourceOpenResult>;
  /** Saves one complete Source under an explicit absence or generation precondition. */
  readonly saveSource: (
    this: void,
    request: DesenEditorSourceSaveRequest,
  ) => Promise<DesenEditorSourceSaveResult>;
}

type AdapterCallbacks = Readonly<{
  compareAndSetSource: DesenEditorPersistenceAdapter["compareAndSetSource"];
  readSource: DesenEditorPersistenceAdapter["readSource"];
}>;

const FAILURE_DIAGNOSTICS: Readonly<
  Record<
    DesenEditorPersistenceAdapterFailureReason,
    readonly [DesenEditorPersistenceDiagnosticCode, string]
  >
> = Object.freeze({
  "authentication-required": Object.freeze([
    "run.desen.editor/PERSISTENCE_AUTHENTICATION_REQUIRED",
    "The editor persistence adapter requires valid local authentication.",
  ] as const),
  "source-invalid": Object.freeze([
    "run.desen.editor/PERSISTENCE_SOURCE_INVALID",
    "The stored editor Source is not valid interoperable Source data.",
  ] as const),
  "source-limit-exceeded": Object.freeze([
    "run.desen.editor/PERSISTENCE_SOURCE_LIMIT_EXCEEDED",
    "The stored editor Source exceeds a fixed finite persistence limit.",
  ] as const),
  "storage-busy": Object.freeze([
    "run.desen.editor/PERSISTENCE_STORAGE_BUSY",
    "The editor Source storage is busy.",
  ] as const),
  "storage-corrupt": Object.freeze([
    "run.desen.editor/PERSISTENCE_STORAGE_CORRUPT",
    "The editor Source storage is inconsistent.",
  ] as const),
  "storage-unavailable": Object.freeze([
    "run.desen.editor/PERSISTENCE_STORAGE_UNAVAILABLE",
    "The editor Source storage is unavailable.",
  ] as const),
  "unsafe-storage": Object.freeze([
    "run.desen.editor/PERSISTENCE_UNSAFE_STORAGE",
    "The editor Source storage boundary is unsafe.",
  ] as const),
});

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactOwnData(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== null && prototype !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string") ||
      !(keys as string[])
        .slice()
        .sort(compareText)
        .every((key, index) => key === expectedKeys[index])
    ) {
      return undefined;
    }
    const output: Record<string, unknown> = Object.create(null);
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return undefined;
  }
}

function positiveGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function expectedGeneration(value: unknown): value is number | null {
  return value === null || positiveGeneration(value);
}

function wellFormedString(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function diagnostic(
  code: DesenEditorPersistenceDiagnosticCode,
  message: string,
): DesenEditorPersistenceDiagnostic {
  return Object.freeze({ code, message });
}

function failed(
  code: DesenEditorPersistenceDiagnosticCode,
  message: string,
): Readonly<{ status: "failed"; diagnostic: DesenEditorPersistenceDiagnostic }> {
  return Object.freeze({ status: "failed", diagnostic: diagnostic(code, message) });
}

function adapterFailure(
  reason: DesenEditorPersistenceAdapterFailureReason,
): Readonly<{ status: "failed"; diagnostic: DesenEditorPersistenceDiagnostic }> {
  const [code, message] = FAILURE_DIAGNOSTICS[reason];
  return failed(code, message);
}

function indeterminate(
  code: DesenEditorPersistenceDiagnosticCode,
  message: string,
): Extract<DesenEditorSourceSaveResult, { readonly status: "indeterminate" }> {
  return Object.freeze({ status: "indeterminate", diagnostic: diagnostic(code, message) });
}

function captureAdapter(input: DesenEditorPersistenceAdapter): AdapterCallbacks {
  const values = exactOwnData(input, ADAPTER_KEYS);
  if (
    values === undefined ||
    typeof values.readSource !== "function" ||
    typeof values.compareAndSetSource !== "function"
  ) {
    throw new TypeError(
      "Invalid editor persistence adapter: expected exact receiver-independent readSource and compareAndSetSource callbacks.",
    );
  }
  return Object.freeze({
    compareAndSetSource: values.compareAndSetSource as AdapterCallbacks["compareAndSetSource"],
    readSource: values.readSource as AdapterCallbacks["readSource"],
  });
}

function captureSaveRequest(input: DesenEditorSourceSaveRequest):
  | Readonly<{
      document: DesenEditorDocument;
      expectedGeneration: number | null;
      sourceKey: string;
    }>
  | undefined {
  const values = exactOwnData(input, SAVE_REQUEST_KEYS);
  if (
    values === undefined ||
    !wellFormedString(values.sourceKey) ||
    !expectedGeneration(values.expectedGeneration)
  ) {
    return undefined;
  }
  return Object.freeze({
    document: values.document as DesenEditorDocument,
    expectedGeneration: values.expectedGeneration,
    sourceKey: values.sourceKey,
  });
}

function adapterReason(value: unknown): value is DesenEditorPersistenceAdapterFailureReason {
  return typeof value === "string" && Object.hasOwn(FAILURE_DIAGNOSTICS, value);
}

function captureReadResult(
  input: DesenEditorPersistenceAdapterReadResult,
  sourceKey: string,
):
  | Readonly<{ status: "found"; generation: number; value: unknown }>
  | Readonly<{ status: "missing" }>
  | Readonly<{ status: "failed"; reason: DesenEditorPersistenceAdapterFailureReason }>
  | undefined {
  const statusDescriptor = (() => {
    try {
      return typeof input === "object" && input !== null
        ? Object.getOwnPropertyDescriptor(input, "status")
        : undefined;
    } catch {
      return undefined;
    }
  })();
  const status =
    statusDescriptor !== undefined && statusDescriptor.enumerable && "value" in statusDescriptor
      ? statusDescriptor.value
      : undefined;
  if (status === "missing") {
    return exactOwnData(input, ADAPTER_MISSING_KEYS) === undefined
      ? undefined
      : Object.freeze({ status: "missing" });
  }
  if (status === "failed") {
    const values = exactOwnData(input, ADAPTER_FAILURE_KEYS);
    return values !== undefined && adapterReason(values.reason)
      ? Object.freeze({ status: "failed", reason: values.reason })
      : undefined;
  }
  if (status !== "found") return undefined;
  const values = exactOwnData(input, ADAPTER_FOUND_KEYS);
  if (values === undefined) return undefined;
  const record = exactOwnData(values.record, ADAPTER_RECORD_KEYS);
  if (
    record === undefined ||
    record.sourceKey !== sourceKey ||
    !positiveGeneration(record.generation)
  ) {
    return undefined;
  }
  return Object.freeze({ status: "found", generation: record.generation, value: record.value });
}

function captureWriteResult(
  input: DesenEditorPersistenceAdapterWriteResult,
  expected: number | null,
): DesenEditorSourceSaveResult | undefined {
  const statusDescriptor = (() => {
    try {
      return typeof input === "object" && input !== null
        ? Object.getOwnPropertyDescriptor(input, "status")
        : undefined;
    } catch {
      return undefined;
    }
  })();
  const status =
    statusDescriptor !== undefined && statusDescriptor.enumerable && "value" in statusDescriptor
      ? statusDescriptor.value
      : undefined;
  if (status === "indeterminate") {
    return exactOwnData(input, ADAPTER_MISSING_KEYS) === undefined
      ? undefined
      : indeterminate(
          "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
          "The editor Source may have committed; reopen it before another save.",
        );
  }
  if (status === "failed") {
    const values = exactOwnData(input, ADAPTER_FAILURE_KEYS);
    return values !== undefined && adapterReason(values.reason)
      ? adapterFailure(values.reason)
      : undefined;
  }
  if (status === "created") {
    const values = exactOwnData(input, ["generation", "status"]);
    return expected === null && values?.generation === 1
      ? Object.freeze({ status: "created", generation: 1 })
      : undefined;
  }
  if (status === "updated") {
    const values = exactOwnData(input, ["generation", "status"]);
    return expected !== null && expected < MAX_GENERATION && values?.generation === expected + 1
      ? Object.freeze({ status: "updated", generation: expected + 1 })
      : undefined;
  }
  if (status === "unchanged") {
    const values = exactOwnData(input, ["generation", "status"]);
    return expected !== null && values?.generation === expected
      ? Object.freeze({ status: "unchanged", generation: expected })
      : undefined;
  }
  if (status === "generation-exhausted") {
    const values = exactOwnData(input, ["generation", "status"]);
    return expected === MAX_GENERATION && values?.generation === MAX_GENERATION
      ? Object.freeze({ status: "generation-exhausted", generation: MAX_GENERATION })
      : undefined;
  }
  if (status === "conflict") {
    const values = exactOwnData(input, ["currentGeneration", "status"]);
    const current = values?.currentGeneration;
    if (!(current === null || positiveGeneration(current))) return undefined;
    if (expected === null ? current === null : current === expected) return undefined;
    return Object.freeze({ status: "conflict", currentGeneration: current });
  }
  return undefined;
}

/**
 * Captures one stable adapter and returns a framework-neutral Source open/save port.
 *
 * @remarks The port re-admits every saved and opened Source, enforces the complete 8 MiB canonical
 * limit, includes root authoring in saved bytes, validates adapter settlements, and returns only
 * detached frozen documents or redacted controlled outcomes. It performs no Catalog-semantic
 * validation, automatic retry, merge, list, delete, lifecycle, filesystem, network, or UI work.
 * A rejected or malformed write settlement is indeterminate because the port cannot prove that a
 * trusted adapter failed before its durable commit point.
 *
 * @throws TypeError when the adapter does not expose exactly two own enumerable data callbacks.
 */
export function createDesenEditorPersistencePort(
  adapter: DesenEditorPersistenceAdapter,
): DesenEditorPersistencePort {
  const captured = captureAdapter(adapter);
  const compareAndSetSource = captured.compareAndSetSource;
  const readSource = captured.readSource;

  const openSource: DesenEditorPersistencePort["openSource"] = async (sourceKey) => {
    if (!wellFormedString(sourceKey)) {
      return failed(
        "run.desen.editor/PERSISTENCE_REQUEST_INVALID",
        "The editor persistence open request is malformed.",
      );
    }
    let raw: DesenEditorPersistenceAdapterReadResult;
    try {
      raw = await readSource(sourceKey);
    } catch {
      return failed(
        "run.desen.editor/PERSISTENCE_ADAPTER_FAILURE",
        "The editor persistence adapter failed unexpectedly while reading.",
      );
    }
    const result = captureReadResult(raw, sourceKey);
    if (result === undefined) {
      return failed(
        "run.desen.editor/PERSISTENCE_ADAPTER_RESULT_INVALID",
        "The editor persistence adapter returned a malformed read result.",
      );
    }
    if (result.status === "missing") return Object.freeze({ status: "missing" });
    if (result.status === "failed") return adapterFailure(result.reason);

    const admitted = createDesenEditorDocument(result.value);
    if (!admitted.ok) {
      return failed(
        "run.desen.editor/PERSISTENCE_SOURCE_INVALID",
        "The stored editor Source failed structural admission.",
      );
    }
    let bytes: Uint8Array;
    try {
      bytes = canonicalizeJsonBytes(admitted.document);
    } catch {
      return failed(
        "run.desen.editor/PERSISTENCE_SOURCE_INVALID",
        "The stored editor Source could not be canonicalized.",
      );
    }
    if (bytes.byteLength > MAX_DOCUMENT_CANONICAL_BYTES) {
      return failed(
        "run.desen.editor/PERSISTENCE_SOURCE_LIMIT_EXCEEDED",
        "The stored editor Source exceeds the fixed 8 MiB canonical limit.",
      );
    }
    return Object.freeze({
      status: "opened",
      generation: result.generation,
      document: admitted.document,
    });
  };

  const saveSource: DesenEditorPersistencePort["saveSource"] = async (request) => {
    const values = captureSaveRequest(request);
    if (values === undefined) {
      return failed(
        "run.desen.editor/PERSISTENCE_REQUEST_INVALID",
        "The editor persistence save request is malformed.",
      );
    }
    const admitted = createDesenEditorDocument(values.document);
    if (!admitted.ok) {
      return failed(
        "run.desen.editor/PERSISTENCE_DOCUMENT_INVALID",
        "The editor persistence document failed structural admission.",
      );
    }
    let canonicalBytes: Uint8Array;
    try {
      canonicalBytes = canonicalizeJsonBytes(admitted.document);
    } catch {
      return failed(
        "run.desen.editor/PERSISTENCE_DOCUMENT_INVALID",
        "The editor persistence document could not be canonicalized.",
      );
    }
    if (canonicalBytes.byteLength > MAX_DOCUMENT_CANONICAL_BYTES) {
      return failed(
        "run.desen.editor/PERSISTENCE_LIMIT_EXCEEDED",
        "The editor persistence document exceeds the fixed 8 MiB canonical limit.",
      );
    }
    const adapterRequest = Object.freeze({
      sourceKey: values.sourceKey,
      expectedGeneration: values.expectedGeneration,
      bytes: new Uint8Array(canonicalBytes),
    });
    if (exactOwnData(adapterRequest, ADAPTER_WRITE_REQUEST_KEYS) === undefined) {
      return indeterminate(
        "run.desen.editor/PERSISTENCE_ADAPTER_RESULT_INVALID",
        "The editor persistence write request could not be captured safely.",
      );
    }
    let raw: DesenEditorPersistenceAdapterWriteResult;
    try {
      raw = await compareAndSetSource(adapterRequest);
    } catch {
      return indeterminate(
        "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
        "The editor Source may have committed; reopen it before another save.",
      );
    }
    const result = captureWriteResult(raw, values.expectedGeneration);
    return (
      result ??
      indeterminate(
        "run.desen.editor/PERSISTENCE_ADAPTER_RESULT_INVALID",
        "The editor persistence adapter returned a malformed write result after receiving the candidate.",
      )
    );
  };

  return Object.freeze({ openSource, saveSource });
}
