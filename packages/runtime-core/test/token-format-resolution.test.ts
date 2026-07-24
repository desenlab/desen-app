import { describe, expect, it, vi } from "vitest";

import {
  RUNTIME_VALUE_SAFETY_LIMITS,
  createRuntimeResolutionSnapshot,
  materializeRuntimeValue,
} from "../src/index.js";

import type {
  RuntimeResolutionSnapshotInput,
  RuntimeTokenRequest,
  RuntimeTokenResolution,
  RuntimeValueMaterializationContext,
  RuntimeValueSpec,
} from "../src/index.js";

function createSnapshotInput(locale = "tr-TR"): RuntimeResolutionSnapshotInput {
  return {
    state: {
      profile: { name: "Selman", nullable: null },
      count: 0,
    },
    context: { route: { tenant: "desenlab" } },
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { locale, platform: "web" },
  };
}

function createMaterializationContext(
  resolve: (request: {
    readonly context: {
      readonly documentId: string;
      readonly revision: string;
      readonly surfaceId: string;
      readonly requestId: string;
    };
    readonly token: string;
  }) => RuntimeTokenResolution,
): RuntimeValueMaterializationContext {
  return {
    requestContext: {
      documentId: "com.desen.test",
      revision: `sha256:${"1".repeat(64)}`,
      surfaceId: "main",
      requestId: "materialize-1",
    },
    tokens: { resolve },
  };
}

function asValueSpec(value: unknown): RuntimeValueSpec {
  return value as RuntimeValueSpec;
}

function asContext(value: unknown): RuntimeValueMaterializationContext {
  return value as RuntimeValueMaterializationContext;
}

describe("materializeRuntimeValue", () => {
  it("resolves each unique token once with a detached frozen request and a fresh per-call cache", () => {
    const requests: unknown[] = [];
    const receivers: unknown[] = [];
    const resolve = vi.fn(function (this: unknown, request: RuntimeTokenRequest) {
      receivers.push(this);
      requests.push(request);
      return {
        status: "resolved" as const,
        value: request.token === "color.primary" ? "#1d4ed8" : "1rem",
      };
    });
    const context = createMaterializationContext(resolve);
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const spec = {
      a: { $token: "color.primary" },
      formatted: {
        $format: {
          template: "{again}/{spacing}",
          values: {
            spacing: { $token: "space.md" },
            again: { $token: "color.primary" },
          },
        },
      },
      z: { $token: "space.md" },
    } as const;

    expect(materializeRuntimeValue(spec, snapshot, context)).toEqual({
      status: "resolved",
      usedFallback: false,
      value: {
        a: "#1d4ed8",
        formatted: "#1d4ed8/1rem",
        z: "1rem",
      },
    });
    expect(resolve.mock.calls.map(([request]) => request.token)).toEqual([
      "color.primary",
      "space.md",
    ]);
    expect(requests).toHaveLength(2);
    for (const request of requests as {
      readonly context: object;
      readonly token: string;
    }[]) {
      expect(Object.isFrozen(request)).toBe(true);
      expect(Object.isFrozen(request.context)).toBe(true);
    }
    expect((requests[0] as { readonly context: object }).context).not.toBe(context.requestContext);

    expect(materializeRuntimeValue(spec, snapshot, context)).toMatchObject({ status: "resolved" });
    expect(resolve).toHaveBeenCalledTimes(4);
    expect(receivers).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("keeps token missing, resolved null, and redacted provider failure distinct", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const missing = materializeRuntimeValue(
      { $token: "color.missing" },
      snapshot,
      createMaterializationContext(() => ({ status: "missing" })),
    );
    expect(missing).toEqual({
      status: "unresolved",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/$token",
      token: "color.missing",
      reason: "missing-token",
    });
    expect("value" in missing).toBe(false);

    expect(
      materializeRuntimeValue(
        { $token: "nullable" },
        snapshot,
        createMaterializationContext(() => ({ status: "resolved", value: null })),
      ),
    ).toEqual({ status: "resolved", value: null, usedFallback: false });

    const failure = materializeRuntimeValue(
      { nested: { $token: "throws" } },
      snapshot,
      createMaterializationContext(() => {
        throw new Error("private provider detail");
      }),
    );
    expect(failure).toEqual({
      status: "failed",
      code: "ADAPTER_FAILURE",
      pointer: "/nested/$token",
      adapter: "token-provider",
    });
    expect(JSON.stringify(failure)).not.toContain("private provider detail");

    expect(
      materializeRuntimeValue(
        { $token: "async" },
        snapshot,
        createMaterializationContext((() =>
          Promise.resolve({ status: "resolved", value: "late" })) as never),
      ),
    ).toEqual({
      status: "failed",
      code: "ADAPTER_FAILURE",
      pointer: "/$token",
      adapter: "token-provider",
    });

    for (const malformed of [
      { status: "resolved" },
      { status: "resolved", value: "visible", extra: "not-allowed" },
      { status: "missing", value: "guessed" },
      { status: "missing", extra: true },
      { status: "unknown" },
    ]) {
      expect(
        materializeRuntimeValue(
          { $token: "malformed" },
          snapshot,
          createMaterializationContext(() => malformed as never),
        ),
      ).toEqual({
        status: "failed",
        code: "ADAPTER_FAILURE",
        pointer: "/$token",
        adapter: "token-provider",
      });
    }
  });

  it("keeps resolved token data inert and rejects hostile or over-budget provider values", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const providerValue = {
      $format: {
        template: "{secret}",
        values: { secret: { $ref: "context.private" } },
      },
    };
    const inert = materializeRuntimeValue(
      { $token: "data.dynamic-shaped" },
      snapshot,
      createMaterializationContext(() => ({ status: "resolved", value: providerValue })),
    );
    expect(inert).toEqual({
      status: "resolved",
      usedFallback: false,
      value: providerValue,
    });
    if (inert.status !== "resolved") throw new Error("expected resolved token data");
    expect(inert.value).not.toBe(providerValue);
    expect(Object.isFrozen(inert.value)).toBe(true);
    providerValue.$format.template = "mutated";
    expect(inert.value).toMatchObject({ $format: { template: "{secret}" } });

    const getter = vi.fn(() => "must not run");
    const accessorResult = { status: "resolved" };
    Object.defineProperty(accessorResult, "value", { enumerable: true, get: getter });
    expect(
      materializeRuntimeValue(
        { $token: "hostile.accessor" },
        snapshot,
        createMaterializationContext(() => accessorResult as never),
      ),
    ).toMatchObject({ status: "failed", code: "ADAPTER_FAILURE" });
    expect(getter).not.toHaveBeenCalled();

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const hostileResult = new Proxy(
      { status: "resolved", value: "hidden" },
      {
        ownKeys() {
          throw new Error("hostile reflection");
        },
      },
    );
    for (const unsafeValue of [
      Number.NaN,
      () => "executable",
      cycle,
      "x".repeat(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits + 1),
    ]) {
      expect(
        materializeRuntimeValue(
          { $token: "hostile.value" },
          snapshot,
          createMaterializationContext(
            () =>
              ({
                status: "resolved",
                value: unsafeValue,
              }) as never,
          ),
        ),
      ).toEqual({
        status: "failed",
        code: "ADAPTER_FAILURE",
        pointer: "/$token",
        adapter: "token-provider",
      });
    }
    expect(
      materializeRuntimeValue(
        { $token: "hostile.proxy" },
        snapshot,
        createMaterializationContext(() => hostileResult as never),
      ),
    ).toMatchObject({ status: "failed", code: "ADAPTER_FAILURE" });
  });

  it("formats raw strings and canonical JSON with exact PF-017 placeholder semantics", () => {
    const context = createMaterializationContext(() => ({ status: "missing" }));
    const format = {
      $format: {
        template: "{raw}|{number}|{negativeZero}|{flag}|{empty}|{object}|{array}|{raw}",
        values: {
          raw: "Ada\nLovelace",
          number: 1.25,
          negativeZero: -0,
          flag: false,
          empty: null,
          object: { z: 2, a: 1 },
          array: [1, "x"],
        },
      },
    } as const;
    const tr = createRuntimeResolutionSnapshot(createSnapshotInput("tr-TR"));
    const en = createRuntimeResolutionSnapshot(createSnapshotInput("en-US"));
    const expected = 'Ada\nLovelace|1.25|0|false|null|{"a":1,"z":2}|[1,"x"]|Ada\nLovelace';

    expect(materializeRuntimeValue(format, tr, context)).toEqual({
      status: "resolved",
      value: expected,
      usedFallback: false,
    });
    expect(materializeRuntimeValue(format, en, context)).toEqual({
      status: "resolved",
      value: expected,
      usedFallback: false,
    });
    expect(
      materializeRuntimeValue({ $format: { template: "literal", values: {} } }, tr, context),
    ).toEqual({ status: "resolved", value: "literal", usedFallback: false });

    const repeatedPlaceholderCount = 220_000;
    const repeatedTemplate = "{x}".repeat(repeatedPlaceholderCount);
    const freeze = vi.spyOn(Object, "freeze");
    try {
      expect(
        materializeRuntimeValue(
          { $format: { template: repeatedTemplate, values: { x: "x" } } },
          tr,
          context,
        ),
      ).toEqual({
        status: "resolved",
        value: "x".repeat(repeatedPlaceholderCount),
        usedFallback: false,
      });
      expect(freeze.mock.calls.length).toBeLessThan(100);
    } finally {
      freeze.mockRestore();
    }

    for (const template of [
      "Hello {name",
      "Hello name}",
      "Hello {{name}",
      "Hello {}",
      "Hello {0name}",
      "Hello {first-name}",
    ]) {
      expect(
        materializeRuntimeValue({ $format: { template, values: { name: "Ada" } } }, tr, context),
      ).toEqual({
        status: "invalid",
        pointer: "/$format/template",
        reason: "malformed-format",
      });
    }
    expect(
      materializeRuntimeValue({ $format: { template: "Hello {name}", values: {} } }, tr, context),
    ).toMatchObject({ status: "invalid", pointer: "/$format/template" });
    expect(
      materializeRuntimeValue(
        { $format: { template: "Hello", values: { extra: "Ada" } } },
        tr,
        context,
      ),
    ).toMatchObject({ status: "invalid", pointer: "/$format/values/extra" });

    const resolve = vi.fn(() => ({ status: "resolved" as const, value: "#fff" }));
    expect(
      materializeRuntimeValue(
        {
          a: { $token: "must.not.run" },
          z: { $format: { template: "{bad", values: { bad: "x" } } },
        },
        tr,
        createMaterializationContext(resolve),
      ),
    ).toMatchObject({ status: "invalid", pointer: "/z/$format/template" });
    expect(resolve).not.toHaveBeenCalled();

    expect(
      materializeRuntimeValue(
        {
          a: { $ref: "state.profile.unknown" },
          z: { $format: { template: "{bad", values: { bad: "x" } } },
        },
        tr,
        createMaterializationContext(resolve),
      ),
    ).toMatchObject({ status: "invalid", pointer: "/z/$format/template" });
    expect(resolve).not.toHaveBeenCalled();

    expect(
      materializeRuntimeValue(
        {
          $ref: "state.profile.name",
          fallback: {
            $format: { template: "{unreachable", values: { unreachable: "x" } },
          },
        },
        tr,
        createMaterializationContext(resolve),
      ),
    ).toMatchObject({
      status: "invalid",
      pointer: "/fallback/$format/template",
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("materializes nested references, tokens, formats, and fallback without a partial value", () => {
    const resolve = vi.fn(({ token }) =>
      token === "tone.primary"
        ? ({ status: "resolved", value: "blue" } as const)
        : ({ status: "missing" } as const),
    );
    const context = createMaterializationContext(resolve);
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const nested = materializeRuntimeValue(
      {
        $format: {
          template: "{greeting} / {nickname}",
          values: {
            greeting: {
              $format: {
                template: "Hello {name} in {tone}",
                values: {
                  name: { $ref: "state.profile.name" },
                  tone: { $token: "tone.primary" },
                },
              },
            },
            nickname: {
              $ref: "state.profile.nickname",
              fallback: {
                $format: {
                  template: "{name}-fallback",
                  values: { name: { $ref: "state.profile.name" } },
                },
              },
            },
          },
        },
      },
      snapshot,
      context,
    );
    expect(nested).toEqual({
      status: "resolved",
      value: "Hello Selman in blue / Selman-fallback",
      usedFallback: true,
    });

    const incomplete = materializeRuntimeValue(
      {
        observable: { $token: "tone.primary" },
        nested: {
          $format: {
            template: "{missing}",
            values: { missing: { $token: "tone.missing" } },
          },
        },
      },
      snapshot,
      context,
    );
    expect(incomplete).toEqual({
      status: "unresolved",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/nested/$format/values/missing/$token",
      token: "tone.missing",
      reason: "missing-token",
    });
    expect("value" in incomplete).toBe(false);

    expect(
      materializeRuntimeValue(
        {
          nested: {
            $format: {
              template: "{name}",
              values: { name: { $ref: "state.profile.unknown" } },
            },
          },
        },
        snapshot,
        context,
      ),
    ).toMatchObject({
      status: "unresolved",
      pointer: "/nested/$format/values/name/$ref",
      reference: "state.profile.unknown",
    });
  });

  it("bounds amplified format output and preserves exact failure pointers", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const context = createMaterializationContext(() => ({
      status: "resolved",
      value: "x".repeat(600_000),
    }));
    const halfLimit = "x".repeat(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits / 2);

    expect(
      materializeRuntimeValue(
        {
          $format: {
            template: "{text}{text}",
            values: { text: halfLimit },
          },
        },
        snapshot,
        context,
      ),
    ).toMatchObject({
      status: "resolved",
      value: "x".repeat(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits),
    });
    expect(
      materializeRuntimeValue(
        {
          greeting: {
            $format: {
              template: "{text}{text}x",
              values: { text: halfLimit },
            },
          },
        },
        snapshot,
        context,
      ),
    ).toEqual({
      status: "invalid",
      pointer: "/greeting/$format",
      reason: "unsafe-or-unbounded-json",
    });

    expect(
      materializeRuntimeValue(
        {
          first: { $token: "large" },
          second: { $token: "large" },
        },
        snapshot,
        context,
      ),
    ).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });

    const siblingResolve = vi.fn(() => ({
      status: "resolved" as const,
      value: "s".repeat(600_000),
    }));
    expect(
      materializeRuntimeValue(
        {
          first: {
            $format: {
              template: "{text}",
              values: { text: { $token: "shared-large" } },
            },
          },
          second: {
            $format: {
              template: "{text}",
              values: { text: { $token: "shared-large" } },
            },
          },
        },
        snapshot,
        createMaterializationContext(siblingResolve),
      ),
    ).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });
    expect(siblingResolve).toHaveBeenCalledTimes(1);

    const uniqueResolve = vi.fn(() => ({
      status: "resolved" as const,
      value: "u".repeat(600_000),
    }));
    const uniqueTokens = Object.fromEntries(
      Array.from({ length: 16 }, (_, index) => [
        `value${String(index).padStart(2, "0")}`,
        { $token: `large.${String(index).padStart(2, "0")}` },
      ]),
    );
    expect(
      materializeRuntimeValue(uniqueTokens, snapshot, createMaterializationContext(uniqueResolve)),
    ).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });
    expect(uniqueResolve).toHaveBeenCalledTimes(2);

    expect(
      materializeRuntimeValue(
        { "a/b~c": { $token: "missing" } },
        snapshot,
        createMaterializationContext(() => ({ status: "missing" })),
      ),
    ).toMatchObject({ status: "unresolved", pointer: "/a~1b~0c/$token" });
  });

  it("rejects unsafe materialization contexts before invoking the token provider", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const resolve = vi.fn(() => ({ status: "resolved" as const, value: "#fff" }));
    const valid = createMaterializationContext(resolve);

    const inheritedTokens = Object.create({ resolve }) as object;
    const accessorContext = {
      requestContext: valid.requestContext,
      get tokens() {
        return valid.tokens;
      },
    };
    const hostileContext = new Proxy(valid, {
      ownKeys() {
        throw new Error("hostile reflection");
      },
    });
    const craftedErrorContext = new Proxy(valid, {
      ownKeys() {
        throw new TypeError(
          "Invalid runtime value materialization context: crafted private detail",
        );
      },
    });
    const thrownProxy = new Proxy(
      {},
      {
        get() {
          throw new Error("caught proxy property was inspected");
        },
        getPrototypeOf() {
          throw new Error("caught proxy prototype was inspected");
        },
      },
    );
    const thrownProxyContext = new Proxy(valid, {
      ownKeys() {
        throw thrownProxy;
      },
    });
    const contexts = [
      { requestContext: valid.requestContext },
      { ...valid, extra: true },
      { requestContext: valid.requestContext, tokens: inheritedTokens },
      accessorContext,
      hostileContext,
      craftedErrorContext,
      thrownProxyContext,
      {
        ...valid,
        requestContext: { ...valid.requestContext, requestId: 1 },
      },
    ];

    for (const context of contexts) {
      expect(() =>
        materializeRuntimeValue({ $token: "color.primary" }, snapshot, asContext(context)),
      ).toThrowError("Invalid runtime value materialization context");
    }
    expect(resolve).not.toHaveBeenCalled();
    for (const context of [craftedErrorContext, thrownProxyContext]) {
      expect(() =>
        materializeRuntimeValue({ $token: "color.primary" }, snapshot, context),
      ).toThrowError(
        /^Invalid runtime value materialization context at \/: property descriptors could not be read safely$/,
      );
    }

    const forgedSnapshot = createSnapshotInput() as never;
    expect(() =>
      materializeRuntimeValue(
        { $token: "color.primary" },
        forgedSnapshot,
        asContext({ requestContext: valid.requestContext }),
      ),
    ).toThrowError("Invalid runtime value materialization context");
    expect(() =>
      materializeRuntimeValue({ $token: "color.primary" }, forgedSnapshot, valid),
    ).toThrowError("Runtime values require a factory-created resolution snapshot");
    expect(resolve).not.toHaveBeenCalled();

    const executableSpec = {};
    Object.defineProperty(executableSpec, "$token", {
      enumerable: true,
      get() {
        throw new Error("must remain contained");
      },
    });
    expect(materializeRuntimeValue(asValueSpec(executableSpec), snapshot, valid)).toMatchObject({
      status: "invalid",
      reason: "unsafe-or-unbounded-json",
    });
    expect(resolve).not.toHaveBeenCalled();
  });
});
