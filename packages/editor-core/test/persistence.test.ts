/* eslint-disable @typescript-eslint/no-invalid-void-type -- Runtime probes verify that persistence
 * callbacks are invoked without a receiver. */
import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import { createDesenEditorDocument, createDesenEditorPersistencePort } from "../src/index.js";

import type {
  DesenEditorDocument,
  DesenEditorPersistenceAdapter,
  DesenEditorPersistenceAdapterFailureReason,
  DesenEditorPersistenceAdapterReadResult,
  DesenEditorPersistenceAdapterWriteRequest,
  DesenEditorPersistenceAdapterWriteResult,
  DesenEditorSourceOpenResult,
  DesenEditorSourceSaveResult,
} from "../src/index.js";

type MutableRecord = Record<string, unknown>;

const DOCUMENT_LIMIT = 8_388_608;

const FAILURE_CODES = Object.freeze({
  "authentication-required": "run.desen.editor/PERSISTENCE_AUTHENTICATION_REQUIRED",
  "source-invalid": "run.desen.editor/PERSISTENCE_SOURCE_INVALID",
  "source-limit-exceeded": "run.desen.editor/PERSISTENCE_SOURCE_LIMIT_EXCEEDED",
  "storage-busy": "run.desen.editor/PERSISTENCE_STORAGE_BUSY",
  "storage-corrupt": "run.desen.editor/PERSISTENCE_STORAGE_CORRUPT",
  "storage-unavailable": "run.desen.editor/PERSISTENCE_STORAGE_UNAVAILABLE",
  "unsafe-storage": "run.desen.editor/PERSISTENCE_UNSAFE_STORAGE",
} satisfies Readonly<Record<DesenEditorPersistenceAdapterFailureReason, string>>);

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a test-fixture object.");
  }
  return value as MutableRecord;
}

function persistenceInput(marker = "initial"): MutableRecord {
  const input = clone(validSource) as MutableRecord;
  input.authoring = JSON.parse(
    `{"viewport":{"marker":${JSON.stringify(marker)},"zoom":1.25},"ordered":["same",null,"same",[],{}],"__proto__":{"retained":true}}`,
  ) as MutableRecord;
  input.extensions = {
    "com.example.persistence": {
      marker,
      apparentCore: { id: "sign-in.submit", type: "state.toggle", path: "ignored" },
      unicode: ["İstanbul", "雪", "😀"],
    },
    legacyMarker: { retained: true },
  };
  record(record(record(input.surfaces)["sign-in"]).root).use =
    "com.example.unresolved/PersistenceRemainsStructural";
  return input;
}

function createDocument(input: unknown = persistenceInput()): DesenEditorDocument {
  const result = createDesenEditorDocument(input);
  if (!result.ok)
    throw new TypeError("Expected the persistence fixture to pass structural admission.");
  return result.document;
}

function adapter(
  readSource: DesenEditorPersistenceAdapter["readSource"],
  compareAndSetSource: DesenEditorPersistenceAdapter["compareAndSetSource"],
): DesenEditorPersistenceAdapter {
  return { compareAndSetSource, readSource };
}

function missingRead(): Promise<DesenEditorPersistenceAdapterReadResult> {
  return Promise.resolve({ status: "missing" });
}

function createdWrite(): Promise<DesenEditorPersistenceAdapterWriteResult> {
  return Promise.resolve({ status: "created", generation: 1 });
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    pending.push(...Object.values(value));
  }
}

function expectFailure(
  result: DesenEditorSourceOpenResult | DesenEditorSourceSaveResult,
  code: string,
): void {
  expect(result.status).toBe("failed");
  if (result.status !== "failed") throw new TypeError("Expected a definite persistence failure.");
  expect(result.diagnostic).toEqual(expect.objectContaining({ code }));
  expect(Reflect.ownKeys(result)).toEqual(["status", "diagnostic"]);
  expectDeepFrozen(result);
}

function expectIndeterminate(result: DesenEditorSourceSaveResult, code: string): void {
  expect(result.status).toBe("indeterminate");
  if (result.status !== "indeterminate") {
    throw new TypeError("Expected an indeterminate persistence settlement.");
  }
  expect(result.diagnostic).toEqual(expect.objectContaining({ code }));
  expect(Reflect.ownKeys(result)).toEqual(["status", "diagnostic"]);
  expectDeepFrozen(result);
}

function sizedInput(extraBytes: number): MutableRecord {
  const input = clone(validSource) as MutableRecord;
  input.authoring = { padding: "" };
  const baseLength = canonicalizeJsonBytes(input).byteLength;
  record(input.authoring).padding = "x".repeat(DOCUMENT_LIMIT - baseLength + extraBytes);
  return input;
}

describe("createDesenEditorPersistencePort", () => {
  it("captures an exact stable adapter and invokes both callbacks without a receiver", async () => {
    const calls: string[] = [];
    const readSource: DesenEditorPersistenceAdapter["readSource"] = async function (
      this: void,
      sourceKey,
    ) {
      expect(this).toBeUndefined();
      calls.push(`read:${sourceKey}`);
      return { status: "missing" };
    };
    const compareAndSetSource: DesenEditorPersistenceAdapter["compareAndSetSource"] =
      async function (this: void, request) {
        expect(this).toBeUndefined();
        calls.push(`write:${request.sourceKey}`);
        return { status: "created", generation: 1 };
      };
    const mutableAdapter = { compareAndSetSource, readSource };
    const port = createDesenEditorPersistencePort(mutableAdapter);
    mutableAdapter.readSource = async () => ({ status: "failed", reason: "storage-corrupt" });
    mutableAdapter.compareAndSetSource = async () => ({ status: "indeterminate" });

    await expect(port.openSource("source-a")).resolves.toEqual({ status: "missing" });
    await expect(
      port.saveSource({
        sourceKey: "source-a",
        expectedGeneration: null,
        document: createDocument(),
      }),
    ).resolves.toEqual({ status: "created", generation: 1 });
    expect(calls).toEqual(["read:source-a", "write:source-a"]);
    expect(Reflect.ownKeys(port)).toEqual(["openSource", "saveSource"]);
    expectDeepFrozen(port);

    let getterCalls = 0;
    const accessorAdapter = Object.defineProperty({ compareAndSetSource }, "readSource", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return readSource;
      },
    });
    expect(() => createDesenEditorPersistencePort(accessorAdapter as never)).toThrow(TypeError);
    expect(() =>
      createDesenEditorPersistencePort({ ...mutableAdapter, extra: true } as never),
    ).toThrow(TypeError);
    expect(getterCalls).toBe(0);
  });

  it("re-admits found parsed values as detached frozen documents with authoring and extensions", async () => {
    const input = persistenceInput("stored");
    const port = createDesenEditorPersistencePort(
      adapter(
        async (sourceKey) => ({
          status: "found",
          record: { sourceKey, generation: 7, value: input },
        }),
        createdWrite,
      ),
    );

    const first = await port.openSource("source-a");
    const second = await port.openSource("source-a");
    expect(first.status).toBe("opened");
    expect(second.status).toBe("opened");
    if (first.status !== "opened" || second.status !== "opened") {
      throw new TypeError("Expected two admitted Source generations.");
    }
    expect(first.generation).toBe(7);
    expect(first.document).toEqual(input);
    expect(first.document.authoring).toEqual(input.authoring);
    expect(first.document.extensions).toEqual(input.extensions);
    expect(first.document).not.toBe(input);
    expect(first.document).not.toBe(second.document);
    expectDeepFrozen(first);
    expectDeepFrozen(second);

    record(input.authoring).viewport = "caller-mutated";
    expect(first.document.authoring).toEqual(
      expect.objectContaining({ viewport: { marker: "stored", zoom: 1.25 } }),
    );
  });

  it("fails closed for malformed reads, invalid stored Source, and unexpected read rejection", async () => {
    const invalidSource = persistenceInput();
    invalidSource.kind = "desen.bundle";
    let getterCalls = 0;
    const accessorReadResult = Object.defineProperty({}, "status", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "missing";
      },
    });
    const vectors: readonly [unknown, string][] = [
      [
        { status: "found", record: { sourceKey: "wrong", generation: 1, value: validSource } },
        "run.desen.editor/PERSISTENCE_ADAPTER_RESULT_INVALID",
      ],
      [
        { status: "found", record: { sourceKey: "source-a", generation: 0, value: validSource } },
        "run.desen.editor/PERSISTENCE_ADAPTER_RESULT_INVALID",
      ],
      [
        {
          status: "found",
          record: { sourceKey: "source-a", generation: 1, value: validSource },
          extra: true,
        },
        "run.desen.editor/PERSISTENCE_ADAPTER_RESULT_INVALID",
      ],
      [
        { status: "found", record: { sourceKey: "source-a", generation: 1, value: invalidSource } },
        "run.desen.editor/PERSISTENCE_SOURCE_INVALID",
      ],
      [accessorReadResult, "run.desen.editor/PERSISTENCE_ADAPTER_RESULT_INVALID"],
    ];
    for (const [readResult, code] of vectors) {
      const port = createDesenEditorPersistencePort(
        adapter(async () => readResult as never, createdWrite),
      );
      expectFailure(await port.openSource("source-a"), code);
    }
    expect(getterCalls).toBe(0);

    const throwingPort = createDesenEditorPersistencePort(
      adapter(async () => {
        throw new Error("secret storage path");
      }, createdWrite),
    );
    const failure = await throwingPort.openSource("source-a");
    expectFailure(failure, "run.desen.editor/PERSISTENCE_ADAPTER_FAILURE");
    expect(JSON.stringify(failure)).not.toContain("secret");
  });

  it("maps explicit adapter read and write failures without leaking platform detail", async () => {
    const document = createDocument();
    for (const reason of Object.keys(
      FAILURE_CODES,
    ) as DesenEditorPersistenceAdapterFailureReason[]) {
      const port = createDesenEditorPersistencePort(
        adapter(
          async () => ({ status: "failed", reason }),
          async () => ({ status: "failed", reason }),
        ),
      );
      expectFailure(await port.openSource("source-a"), FAILURE_CODES[reason]);
      expectFailure(
        await port.saveSource({ sourceKey: "source-a", expectedGeneration: 1, document }),
        FAILURE_CODES[reason],
      );
    }
  });

  it("sends fresh complete RFC 8785 bytes including unresolved authoring and extensions", async () => {
    const document = createDocument(persistenceInput("candidate"));
    const expectedBytes = canonicalizeJsonBytes(document);
    let receivedRequest: DesenEditorPersistenceAdapterWriteRequest | undefined;
    const port = createDesenEditorPersistencePort(
      adapter(missingRead, async (request) => {
        receivedRequest = request;
        expect(Reflect.ownKeys(request)).toEqual(["sourceKey", "expectedGeneration", "bytes"]);
        expect(Object.isFrozen(request)).toBe(true);
        expect(request.sourceKey).toBe("source-a");
        expect(request.expectedGeneration).toBeNull();
        expect(request.bytes).toBeInstanceOf(Uint8Array);
        expect(request.bytes).not.toBe(expectedBytes);
        expect(Array.from(request.bytes)).toEqual(Array.from(expectedBytes));
        return { status: "created", generation: 1 };
      }),
    );

    const result = await port.saveSource({
      sourceKey: "source-a",
      expectedGeneration: null,
      document,
    });
    expect(result).toEqual({ status: "created", generation: 1 });
    expectDeepFrozen(result);
    expect(receivedRequest).toBeDefined();
    if (receivedRequest === undefined) throw new TypeError("Expected a captured adapter request.");
    (receivedRequest.bytes as Uint8Array)[0] = 0;
    expect(canonicalizeJsonBytes(document)).toEqual(expectedBytes);
    expect(document.authoring).toEqual(
      expect.objectContaining({ viewport: { marker: "candidate", zoom: 1.25 } }),
    );
    expect(document.extensions).toEqual(
      expect.objectContaining({ "com.example.persistence": expect.any(Object) }),
    );
  });

  it("accepts only generation settlements that match the exact compare-and-set precondition", async () => {
    const document = createDocument();
    const vectors: readonly [number | null, DesenEditorPersistenceAdapterWriteResult, unknown][] = [
      [null, { status: "created", generation: 1 }, { status: "created", generation: 1 }],
      [4, { status: "updated", generation: 5 }, { status: "updated", generation: 5 }],
      [4, { status: "unchanged", generation: 4 }, { status: "unchanged", generation: 4 }],
      [
        null,
        { status: "conflict", currentGeneration: 2 },
        { status: "conflict", currentGeneration: 2 },
      ],
      [
        4,
        { status: "conflict", currentGeneration: null },
        { status: "conflict", currentGeneration: null },
      ],
      [
        Number.MAX_SAFE_INTEGER,
        { status: "generation-exhausted", generation: Number.MAX_SAFE_INTEGER },
        { status: "generation-exhausted", generation: Number.MAX_SAFE_INTEGER },
      ],
    ];
    for (const [expectedGeneration, writeResult, publicResult] of vectors) {
      const port = createDesenEditorPersistencePort(adapter(missingRead, async () => writeResult));
      const result = await port.saveSource({ sourceKey: "source-a", expectedGeneration, document });
      expect(result).toEqual(publicResult);
      expectDeepFrozen(result);
    }
  });

  it("treats rejected, explicitly uncertain, and malformed write settlements as indeterminate", async () => {
    const document = createDocument();
    let getterCalls = 0;
    const accessorSettlement = Object.defineProperty({ status: "created" }, "generation", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 1;
      },
    });
    const malformed: readonly [number | null, unknown][] = [
      [null, { status: "created", generation: 2 }],
      [2, { status: "created", generation: 1 }],
      [null, { status: "updated", generation: 1 }],
      [2, { status: "updated", generation: 4 }],
      [null, { status: "unchanged", generation: 1 }],
      [2, { status: "unchanged", generation: 3 }],
      [null, { status: "conflict", currentGeneration: null }],
      [2, { status: "conflict", currentGeneration: 2 }],
      [2, { status: "generation-exhausted", generation: Number.MAX_SAFE_INTEGER }],
      [Number.MAX_SAFE_INTEGER, { status: "generation-exhausted", generation: 4 }],
      [null, { status: "created", generation: 1, extra: true }],
      [null, { status: "created", generation: 1, [Symbol("extra")]: true }],
      [null, accessorSettlement],
      [null, { status: "future" }],
    ];
    for (const [expectedGeneration, writeResult] of malformed) {
      const port = createDesenEditorPersistencePort(
        adapter(missingRead, async () => writeResult as never),
      );
      expectIndeterminate(
        await port.saveSource({ sourceKey: "source-a", expectedGeneration, document }),
        "run.desen.editor/PERSISTENCE_ADAPTER_RESULT_INVALID",
      );
    }
    expect(getterCalls).toBe(0);

    const uncertain = createDesenEditorPersistencePort(
      adapter(missingRead, async () => ({ status: "indeterminate" })),
    );
    expectIndeterminate(
      await uncertain.saveSource({ sourceKey: "source-a", expectedGeneration: 1, document }),
      "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
    );

    const rejecting = createDesenEditorPersistencePort(
      adapter(missingRead, async () => {
        throw new Error("private provider response");
      }),
    );
    const rejected = await rejecting.saveSource({
      sourceKey: "source-a",
      expectedGeneration: 1,
      document,
    });
    expectIndeterminate(rejected, "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE");
    expect(JSON.stringify(rejected)).not.toContain("private");
  });

  it("rejects malformed save/open requests and invalid documents before adapter invocation", async () => {
    let reads = 0;
    let writes = 0;
    const port = createDesenEditorPersistencePort(
      adapter(
        async () => {
          reads += 1;
          return { status: "missing" };
        },
        async () => {
          writes += 1;
          return { status: "created", generation: 1 };
        },
      ),
    );
    expectFailure(await port.openSource(""), "run.desen.editor/PERSISTENCE_REQUEST_INVALID");
    expectFailure(await port.openSource("\ud800"), "run.desen.editor/PERSISTENCE_REQUEST_INVALID");

    const document = createDocument();
    let getterCalls = 0;
    const accessorRequest = Object.defineProperty(
      { expectedGeneration: null, document },
      "sourceKey",
      {
        enumerable: true,
        get() {
          getterCalls += 1;
          return "source-a";
        },
      },
    );
    for (const request of [
      { sourceKey: "", expectedGeneration: null, document },
      { sourceKey: "source-a", expectedGeneration: 0, document },
      { sourceKey: "source-a", expectedGeneration: 1.5, document },
      { sourceKey: "source-a", expectedGeneration: Number.MAX_SAFE_INTEGER + 1, document },
      { sourceKey: "source-a", expectedGeneration: null, document, extra: true },
      accessorRequest,
    ]) {
      expectFailure(
        await port.saveSource(request as never),
        "run.desen.editor/PERSISTENCE_REQUEST_INVALID",
      );
    }

    const invalidDocument = clone(validSource) as MutableRecord;
    invalidDocument.kind = "desen.bundle";
    expectFailure(
      await port.saveSource({
        sourceKey: "source-a",
        expectedGeneration: null,
        document: invalidDocument as never,
      }),
      "run.desen.editor/PERSISTENCE_DOCUMENT_INVALID",
    );
    expect(reads).toBe(0);
    expect(writes).toBe(0);
    expect(getterCalls).toBe(0);
  });

  it("accepts an exact 8 MiB Source and rejects a one-byte crossing on both open and save", async () => {
    const exactInput = sizedInput(0);
    const oversizedInput = sizedInput(1);
    const exactDocument = createDocument(exactInput);
    const oversizedDocument = createDocument(oversizedInput);
    expect(canonicalizeJsonBytes(exactDocument)).toHaveLength(DOCUMENT_LIMIT);
    expect(canonicalizeJsonBytes(oversizedDocument)).toHaveLength(DOCUMENT_LIMIT + 1);

    let writes = 0;
    const port = createDesenEditorPersistencePort(
      adapter(
        async (sourceKey) => ({
          status: "found",
          record: {
            sourceKey,
            generation: 1,
            value: sourceKey === "exact" ? exactInput : oversizedInput,
          },
        }),
        async () => {
          writes += 1;
          return { status: "created", generation: 1 };
        },
      ),
    );

    await expect(port.openSource("exact")).resolves.toEqual(
      expect.objectContaining({ status: "opened", generation: 1 }),
    );
    expectFailure(
      await port.openSource("oversized"),
      "run.desen.editor/PERSISTENCE_SOURCE_LIMIT_EXCEEDED",
    );
    await expect(
      port.saveSource({ sourceKey: "exact", expectedGeneration: null, document: exactDocument }),
    ).resolves.toEqual({ status: "created", generation: 1 });
    expectFailure(
      await port.saveSource({
        sourceKey: "oversized",
        expectedGeneration: null,
        document: oversizedDocument,
      }),
      "run.desen.editor/PERSISTENCE_LIMIT_EXCEEDED",
    );
    expect(writes).toBe(1);
  }, 30_000);

  it("preserves atomic compare-and-set behavior when two opened generations race", async () => {
    let generation = 1;
    let stored = persistenceInput("base");
    const candidateA = persistenceInput("writer-a");
    const candidateB = persistenceInput("writer-b");
    const candidateABytes = canonicalizeJsonBytes(candidateA);
    const candidateBBytes = canonicalizeJsonBytes(candidateB);
    const persistenceAdapter = adapter(
      async (sourceKey) => ({
        status: "found",
        record: { sourceKey, generation, value: clone(stored) },
      }),
      async (request) => {
        if (request.expectedGeneration !== generation) {
          return { status: "conflict", currentGeneration: generation };
        }
        const bytes = Array.from(request.bytes);
        if (bytes.every((value, index) => value === candidateABytes[index])) {
          stored = clone(candidateA);
        } else if (bytes.every((value, index) => value === candidateBBytes[index])) {
          stored = clone(candidateB);
        } else {
          return { status: "failed", reason: "source-invalid" };
        }
        generation += 1;
        return { status: "updated", generation };
      },
    );
    const port = createDesenEditorPersistencePort(persistenceAdapter);
    const firstOpen = await port.openSource("source-a");
    const secondOpen = await port.openSource("source-a");
    if (firstOpen.status !== "opened" || secondOpen.status !== "opened") {
      throw new TypeError("Expected both clients to observe generation one.");
    }

    await expect(
      port.saveSource({
        sourceKey: "source-a",
        expectedGeneration: firstOpen.generation,
        document: createDocument(candidateA),
      }),
    ).resolves.toEqual({ status: "updated", generation: 2 });
    await expect(
      port.saveSource({
        sourceKey: "source-a",
        expectedGeneration: secondOpen.generation,
        document: createDocument(candidateB),
      }),
    ).resolves.toEqual({ status: "conflict", currentGeneration: 2 });

    const reopened = await port.openSource("source-a");
    expect(reopened.status).toBe("opened");
    if (reopened.status !== "opened") throw new TypeError("Expected the committed Source.");
    expect(reopened.generation).toBe(2);
    expect(record(reopened.document.authoring).viewport).toEqual({
      marker: "writer-a",
      zoom: 1.25,
    });
  });
});
