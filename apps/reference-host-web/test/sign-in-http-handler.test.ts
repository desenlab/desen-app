import { describe, expect, it, vi } from "vitest";

import { SIGN_IN_OPERATION_ID } from "@desen/reference-catalog-web/operations";

import { createReferenceHostSignInHttpBinding } from "../src/sign-in-http-handler.js";

import type { ReferenceHostSignInFetch } from "../src/sign-in-http-handler.js";

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return Object.freeze({ promise, resolve });
}

function response(status: number, value: unknown) {
  const json = JSON.stringify(value);
  return Object.freeze({
    status,
    body: json === undefined ? null : new Response(json).body,
  });
}

describe("reference-host sign-in HTTP binding", () => {
  it("captures one fixed same-origin request and leaves successful schema validation to core", async () => {
    const candidate = { userId: "user-1" };
    const fetchLike = vi.fn(async () => response(200, candidate));
    const binding = createReferenceHostSignInHttpBinding(fetchLike);

    expect(binding.operationId).toBe(SIGN_IN_OPERATION_ID);
    expect(Object.isFrozen(binding)).toBe(true);
    expect(fetchLike).not.toHaveBeenCalled();

    const result = await binding.invoke({
      email: "person@example.com",
      password: "test-only-password",
    });

    expect(fetchLike).toHaveBeenCalledTimes(1);
    expect(fetchLike.mock.contexts).toEqual([undefined]);
    expect(fetchLike).toHaveBeenCalledWith(
      "/api/sign-in",
      Object.freeze({
        method: "POST",
        headers: Object.freeze({
          accept: "application/json",
          "content-type": "application/json",
        }),
        body: '{"email":"person@example.com","password":"test-only-password"}',
        cache: "no-store",
        credentials: "same-origin",
        mode: "same-origin",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    );
    expect(result).toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (
      result !== null &&
      typeof result === "object" &&
      "value" in result &&
      result.value !== null &&
      typeof result.value === "object"
    ) {
      expect(Object.isFrozen(result.value)).toBe(true);
    }

    candidate.userId = "mutated-after-settlement";
    expect(result).toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });
  });

  it("maps only 401 to invalidCredentials and every other HTTP failure to unavailable", async () => {
    for (const [status, expectedCode] of [
      [401, "invalidCredentials"],
      [400, "unavailable"],
      [403, "unavailable"],
      [429, "unavailable"],
      [500, "unavailable"],
    ] as const) {
      const cancel = vi.fn(async () => undefined);
      const fetchLike = vi.fn(async () =>
        Object.freeze({
          status,
          body: Object.freeze({ cancel }),
        }),
      );
      const binding = createReferenceHostSignInHttpBinding(fetchLike);

      await expect(
        binding.invoke({ email: "person@example.com", password: "test-only-password" }),
      ).resolves.toEqual({
        status: "failed",
        errorCode: expectedCode,
      });
      expect(fetchLike).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalledTimes(1);
    }
  });

  it("contains network, response, and parse failures without logging raw values or retrying", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const failures: ReferenceHostSignInFetch[] = [
      vi.fn(async () => {
        throw new Error("raw-network-secret");
      }),
      vi.fn(async () => null),
      vi.fn(async () =>
        Object.freeze({
          get status() {
            throw new Error("raw-status-secret");
          },
          body: null,
        }),
      ),
      vi.fn(async () =>
        Object.freeze({
          status: 200,
          get body() {
            throw new Error("raw-body-secret");
          },
        }),
      ),
      vi.fn(async () =>
        Object.freeze({
          status: 200,
          body: Object.freeze({
            getReader: () =>
              Object.freeze({
                read: async () => {
                  throw new Error("raw-stream-secret");
                },
              }),
          }),
        }),
      ),
      vi.fn(async () => Object.freeze({ status: 200, body: new Response("{").body })),
    ];

    try {
      for (const fetchLike of failures) {
        const binding = createReferenceHostSignInHttpBinding(fetchLike);
        await expect(
          binding.invoke({ email: "person@example.com", password: "test-only-password" }),
        ).resolves.toEqual({
          status: "failed",
          errorCode: "unavailable",
        });
        expect(fetchLike).toHaveBeenCalledTimes(1);
      }
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleLog).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      consoleLog.mockRestore();
    }
  });

  it("passes any bounded parsed JSON to core but classifies non-JSON output as unavailable", async () => {
    const schemaInvalidButJson = createReferenceHostSignInHttpBinding(
      vi.fn(async () => response(200, { unexpected: true })),
    );
    await expect(
      schemaInvalidButJson.invoke({
        email: "person@example.com",
        password: "test-only-password",
      }),
    ).resolves.toEqual({
      status: "succeeded",
      value: { unexpected: true },
    });

    for (const value of [undefined, () => undefined, Symbol("not-json")]) {
      const binding = createReferenceHostSignInHttpBinding(vi.fn(async () => response(200, value)));
      await expect(
        binding.invoke({ email: "person@example.com", password: "test-only-password" }),
      ).resolves.toEqual({
        status: "failed",
        errorCode: "unavailable",
      });
    }
  });

  it("bounds successful response bytes and cancels an oversized stream without parsing it", async () => {
    const cancel = vi.fn(async () => undefined);
    const releaseLock = vi.fn();
    const read = vi.fn(async () =>
      Object.freeze({
        done: false,
        value: new Uint8Array(64 * 1024 + 1),
      }),
    );
    const fetchLike = vi.fn(async () =>
      Object.freeze({
        status: 200,
        body: Object.freeze({
          getReader: () => Object.freeze({ read, cancel, releaseLock }),
        }),
      }),
    );
    const binding = createReferenceHostSignInHttpBinding(fetchLike);

    await expect(
      binding.invoke({ email: "person@example.com", password: "test-only-password" }),
    ).resolves.toEqual({
      status: "failed",
      errorCode: "unavailable",
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it("accepts exact byte and chunk ceilings and rejects excessive stream fragmentation", async () => {
    const envelopeBytes = JSON.stringify({ userId: "" }).length;
    const userId = "x".repeat(64 * 1024 - envelopeBytes);
    expect(JSON.stringify({ userId })).toHaveLength(64 * 1024);
    const exactBoundary = createReferenceHostSignInHttpBinding(
      vi.fn(async () => response(200, { userId })),
    );
    await expect(
      exactBoundary.invoke({
        email: "person@example.com",
        password: "test-only-password",
      }),
    ).resolves.toEqual({
      status: "succeeded",
      value: { userId },
    });

    const terminalJson = new TextEncoder().encode('{"userId":"chunk-boundary"}');
    let acceptedReads = 0;
    const acceptedCancel = vi.fn(async () => undefined);
    const acceptedRelease = vi.fn();
    const exactChunkBoundary = createReferenceHostSignInHttpBinding(
      vi.fn(async () =>
        Object.freeze({
          status: 200,
          body: Object.freeze({
            getReader: () =>
              Object.freeze({
                read: vi.fn(async () => {
                  acceptedReads += 1;
                  if (acceptedReads <= 1_023) {
                    return Object.freeze({ done: false, value: Uint8Array.of(0x20) });
                  }
                  if (acceptedReads === 1_024) {
                    return Object.freeze({ done: false, value: terminalJson });
                  }
                  return Object.freeze({ done: true, value: undefined });
                }),
                cancel: acceptedCancel,
                releaseLock: acceptedRelease,
              }),
          }),
        }),
      ),
    );
    await expect(
      exactChunkBoundary.invoke({
        email: "person@example.com",
        password: "test-only-password",
      }),
    ).resolves.toEqual({
      status: "succeeded",
      value: { userId: "chunk-boundary" },
    });
    expect(acceptedReads).toBe(1_025);
    expect(acceptedCancel).not.toHaveBeenCalled();
    expect(acceptedRelease).toHaveBeenCalledTimes(1);

    const cancel = vi.fn(async () => undefined);
    const releaseLock = vi.fn();
    const read = vi.fn(async () =>
      Object.freeze({
        done: false,
        value: Uint8Array.of(0x20),
      }),
    );
    const fragmented = createReferenceHostSignInHttpBinding(
      vi.fn(async () =>
        Object.freeze({
          status: 200,
          body: Object.freeze({
            getReader: () => Object.freeze({ read, cancel, releaseLock }),
          }),
        }),
      ),
    );
    await expect(
      fragmented.invoke({
        email: "person@example.com",
        password: "test-only-password",
      }),
    ).resolves.toEqual({
      status: "failed",
      errorCode: "unavailable",
    });
    expect(read).toHaveBeenCalledTimes(1_025);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it("rejects spoofed DataView and shared-memory chunks through captured intrinsic brands", async () => {
    const jsonBytes = new TextEncoder().encode('{"userId":"spoofed"}');
    const dataView = new DataView(jsonBytes.buffer.slice(0));
    Object.defineProperty(dataView, Symbol.toStringTag, {
      configurable: true,
      value: "Uint8Array",
    });
    const hostileChunks: unknown[] = [dataView];
    if (typeof SharedArrayBuffer !== "undefined") {
      const sharedBuffer = new SharedArrayBuffer(jsonBytes.byteLength);
      new Uint8Array(sharedBuffer).set(jsonBytes);
      Object.defineProperty(sharedBuffer, Symbol.toStringTag, {
        configurable: true,
        value: "ArrayBuffer",
      });
      hostileChunks.push(new Uint8Array(sharedBuffer));
    }

    for (const hostileChunk of hostileChunks) {
      const cancel = vi.fn(async () => undefined);
      const releaseLock = vi.fn();
      const read = vi.fn(async () =>
        Object.freeze({
          done: false,
          value: hostileChunk,
        }),
      );
      const binding = createReferenceHostSignInHttpBinding(
        vi.fn(async () =>
          Object.freeze({
            status: 200,
            body: Object.freeze({
              getReader: () => Object.freeze({ read, cancel, releaseLock }),
            }),
          }),
        ),
      );

      await expect(
        binding.invoke({
          email: "person@example.com",
          password: "test-only-password",
        }),
      ).resolves.toEqual({
        status: "failed",
        errorCode: "unavailable",
      });
      expect(read).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(releaseLock).toHaveBeenCalledTimes(1);
    }
  });

  it("snapshots exact own-data credentials before awaiting and rejects hostile input without I/O", async () => {
    const pending = deferred<unknown>();
    const fetchLike = vi.fn(() => pending.promise);
    const binding = createReferenceHostSignInHttpBinding(fetchLike);
    const input = {
      email: "first@example.com",
      password: "first-password",
    };
    const invocation = binding.invoke(input);
    input.email = "changed@example.com";
    input.password = "changed-password";
    pending.resolve(response(200, { userId: "user-1" }));

    await expect(invocation).resolves.toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });
    expect(fetchLike).toHaveBeenCalledWith(
      "/api/sign-in",
      expect.objectContaining({
        body: '{"email":"first@example.com","password":"first-password"}',
      }),
    );

    let accessorReads = 0;
    const accessorInput = Object.defineProperties(
      {},
      {
        email: {
          enumerable: true,
          get() {
            accessorReads += 1;
            return "getter@example.com";
          },
        },
        password: { enumerable: true, value: "password" },
      },
    );
    const hostileInput = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("raw-input-secret");
        },
      },
    );
    for (const malformed of [
      null,
      {},
      { email: "person@example.com", password: "" },
      { email: "person@example.com", password: "password", extra: true },
      accessorInput,
      hostileInput,
    ]) {
      const noIo = vi.fn(async () => response(200, { userId: "must-not-run" }));
      const malformedBinding = createReferenceHostSignInHttpBinding(noIo);
      await expect(malformedBinding.invoke(malformed as never)).resolves.toEqual({
        status: "failed",
        errorCode: "unavailable",
      });
      expect(noIo).not.toHaveBeenCalled();
    }
    expect(accessorReads).toBe(0);
  });

  it("rejects a non-callable dependency before creating executable authority", () => {
    expect(() =>
      createReferenceHostSignInHttpBinding(null as unknown as ReferenceHostSignInFetch),
    ).toThrowError("Reference-host sign-in fetch dependency must be a function.");
  });
});
