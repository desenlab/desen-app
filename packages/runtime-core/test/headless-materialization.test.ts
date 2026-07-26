import {
  validateDesenBundleExecutionContracts,
  validateDesenExecutionCatalogSet,
} from "@desen/validator";
import { describe, expect, it, vi } from "vitest";

import frozenSignInBundle from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  RUNTIME_HEADLESS_MATERIALIZATION_LIMITS,
  materializeRuntimeHeadlessSurface,
  readRuntimeHeadlessMaterializationSidecar,
} from "../src/headless-materialization.js";
import { createRuntimeResolutionSnapshot } from "../src/value-resolution.js";

import type {
  RuntimeHeadlessMaterializationInput,
  RuntimeHeadlessMaterializationLimitProfile,
} from "../src/headless-materialization.js";
import type { RuntimeJsonValue, RuntimeTokenPort } from "../src/host-ports.js";
import type { RuntimeResolutionSnapshot } from "../src/value-resolution.js";

function deepFreeze<Value>(value: Value): Value {
  const pending: unknown[] = [value];
  const containers: object[] = [];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null) continue;
    containers.push(current);
    if (Array.isArray(current)) pending.push(...current);
    else pending.push(...Object.values(current));
  }
  for (let index = containers.length - 1; index >= 0; index -= 1) {
    Object.freeze(containers[index]);
  }
  return value;
}

function preparedCatalog(catalogInput: unknown = frozenWebCatalog) {
  const catalogs = validateDesenExecutionCatalogSet([
    JSON.parse(JSON.stringify(catalogInput)) as unknown,
  ]);
  expect(catalogs.valid).toBe(true);
  if (!catalogs.valid) throw new TypeError("Expected the Catalog to validate.");
  return catalogs.value;
}

function defaultSnapshot(): RuntimeResolutionSnapshot {
  return createRuntimeResolutionSnapshot({
    state: {},
    context: { tenant: "test" },
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { platform: "web", locale: "en" },
  });
}

function customMaterialization(
  surfaceInput: unknown,
  options: {
    readonly snapshot?: RuntimeResolutionSnapshot;
    readonly resolveToken?: RuntimeTokenPort["resolve"];
    readonly evaluationId?: string;
    readonly limits?: RuntimeHeadlessMaterializationLimitProfile;
    readonly catalogInput?: unknown;
    readonly freezeSurface?: boolean;
  } = {},
) {
  const catalogSet = preparedCatalog(options.catalogInput);
  const evaluationId = options.evaluationId ?? "reactive-evaluation:custom";
  const resolveToken =
    options.resolveToken ?? (() => Object.freeze({ status: "missing" } as const));
  const surface = options.freezeSurface === false ? surfaceInput : deepFreeze(surfaceInput);
  return materializeRuntimeHeadlessSurface({
    documentId: "com.example.account-app",
    surfaceId: "sign-in",
    surface: surface as RuntimeHeadlessMaterializationInput["surface"],
    catalogSet,
    resolutionSnapshot: options.snapshot ?? defaultSnapshot(),
    materializationContext: {
      requestContext: {
        documentId: "com.example.account-app",
        revision: frozenSignInBundle.revision,
        surfaceId: "sign-in",
        requestId: evaluationId,
      },
      tokens: { resolve: resolveToken },
    },
    evaluationId,
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
}

function surface(root: unknown): unknown {
  return {
    id: "sign-in",
    state: {},
    resources: {},
    root,
  };
}

function fixture(evaluationId = "reactive-evaluation:0") {
  const catalogs = preparedCatalog();

  const bundle = validateDesenBundleExecutionContracts(
    JSON.parse(JSON.stringify(frozenSignInBundle)) as unknown,
    catalogs,
  );
  expect(bundle.valid).toBe(true);
  if (!bundle.valid) throw new TypeError("Expected the frozen sign-in Bundle to validate.");
  const surface = bundle.value.surfaces["sign-in"];
  if (surface === undefined) throw new TypeError("Expected the sign-in surface.");

  const resolutionSnapshot = createRuntimeResolutionSnapshot({
    state: { email: "", password: "" },
    context: { tenant: "test" },
    resource: {},
    operation: {
      signIn: { status: "idle", pending: false },
    },
    event: { status: "unavailable" },
    item: {},
    env: { platform: "web", locale: "en" },
  });
  const resolveToken = vi.fn(() => Object.freeze({ status: "missing" } as const));
  const result = materializeRuntimeHeadlessSurface({
    documentId: bundle.value.id,
    surfaceId: surface.id,
    surface,
    catalogSet: catalogs,
    resolutionSnapshot,
    materializationContext: {
      requestContext: {
        documentId: bundle.value.id,
        revision: bundle.value.revision,
        surfaceId: surface.id,
        requestId: evaluationId,
      },
      tokens: { resolve: resolveToken },
    },
    evaluationId,
  });
  return { result, resolveToken, evaluationId };
}

function containsExecutable(value: RuntimeJsonValue): boolean {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (
      typeof current === "function" ||
      typeof current === "symbol" ||
      typeof current === "bigint" ||
      current === undefined
    ) {
      return true;
    }
    if (typeof current !== "object" || current === null) continue;
    if (Array.isArray(current)) pending.push(...current);
    else pending.push(...Object.values(current));
  }
  return false;
}

describe("M04-T16 headless materialization", () => {
  it("materializes the frozen initial sign-in tree while omitting the false Alert subtree", () => {
    const { result, resolveToken, evaluationId } = fixture();
    expect(result.status).toBe("materialized");
    if (result.status !== "materialized") throw new TypeError("Expected materialization.");

    expect(result.plan.documentId).toBe("com.example.account-app");
    expect(result.plan.surfaceId).toBe("sign-in");
    expect(result.plan.root).toHaveLength(1);
    const root = result.plan.root[0];
    expect(root?.sourceNodeId).toBe("sign-in.layout");
    expect(root?.use).toBe("com.example.ui/Stack");
    expect(root?.props).toEqual({
      direction: "vertical",
      gap: "md",
      maxWidth: 420,
    });
    expect(root?.slots.default?.map((node) => node.sourceNodeId)).toEqual([
      "sign-in.title",
      "sign-in.email",
      "sign-in.password",
      "sign-in.submit",
    ]);
    expect(root?.slots.default?.some((node) => node.sourceNodeId === "sign-in.error")).toBe(false);
    expect(root?.slots.default?.[3]?.props).toEqual({
      label: "Sign in",
      loading: false,
      variant: "primary",
    });
    expect(resolveToken).not.toHaveBeenCalled();

    expect(result.commitment).toEqual({
      status: "materialized",
      planDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      bindingDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    });
    expect(Object.isFrozen(result.plan)).toBe(true);
    expect(Object.isFrozen(root?.slots.default)).toBe(true);
    expect(containsExecutable(result.plan as unknown as RuntimeJsonValue)).toBe(false);

    expect(
      readRuntimeHeadlessMaterializationSidecar(result.sidecar, "reactive-evaluation:different"),
    ).toEqual({ status: "evaluation-mismatch" });
    const sidecar = readRuntimeHeadlessMaterializationSidecar(result.sidecar, evaluationId);
    expect(sidecar.status).toBe("read");
    if (sidecar.status !== "read") throw new TypeError("Expected an authenticated sidecar.");
    expect(sidecar.intents).toHaveLength(5);
    expect(sidecar.intents.map((intent) => intent.sourceNodeId)).not.toContain("sign-in.error");
    expect(sidecar.commitment).toBe(result.commitment);
    expect(sidecar.plan).toBe(result.plan);
  });

  it("shares one token cache while formats, ordered variants, repeats, and keys materialize", () => {
    const repeatedSurface = surface({
      id: "tasks.stack",
      use: "com.example.ui/Stack",
      repeat: {
        items: { $ref: "resource.tasks.value" },
        as: "task",
        key: {
          $format: {
            template: "{id}",
            values: { id: { $ref: "item.task.id" } },
          },
        },
      },
      props: {
        direction: "vertical",
        gap: { $token: "space.gap" },
        maxWidth: { $ref: "item.task.width" },
      },
      variants: [
        {
          when: { op: "truthy", args: [{ $ref: "item.task.featured" }] },
          props: { gap: "lg" },
        },
        {
          when: { op: "truthy", args: [{ $ref: "item.task.featured" }] },
          props: { gap: "xl" },
        },
      ],
      slots: {
        default: [
          {
            id: "tasks.label",
            use: "com.example.ui/Text",
            props: {
              text: {
                $format: {
                  template: "Task: {title}",
                  values: { title: { $ref: "item.task.title" } },
                },
              },
            },
          },
        ],
      },
    });
    const taskSnapshot = (tasks: readonly RuntimeJsonValue[]) =>
      createRuntimeResolutionSnapshot({
        state: {},
        context: {},
        resource: {
          tasks: { status: "succeeded", pending: false, value: tasks },
        },
        operation: {},
        event: { status: "unavailable" },
        item: {},
        env: {},
      });
    const tasks = [
      { id: "a", title: "Alpha", width: 320, featured: true },
      { id: "b", title: "Beta", featured: false },
    ] as const;
    const resolveToken = vi.fn(() => Object.freeze({ status: "resolved", value: "md" } as const));
    const first = customMaterialization(repeatedSurface, {
      snapshot: taskSnapshot(tasks),
      resolveToken,
    });
    expect(first.status).toBe("materialized");
    if (first.status !== "materialized") throw new TypeError("Expected repeated materialization.");
    expect(first.plan.root).toHaveLength(2);
    expect(first.plan.root.map((node) => node.props)).toEqual([
      { direction: "vertical", gap: "xl", maxWidth: 320 },
      { direction: "vertical", gap: "md" },
    ]);
    expect(first.plan.root.map((node) => node.slots.default?.[0]?.props.text)).toEqual([
      "Task: Alpha",
      "Task: Beta",
    ]);
    expect(resolveToken).toHaveBeenCalledTimes(1);

    const sidecar = readRuntimeHeadlessMaterializationSidecar(
      first.sidecar,
      "reactive-evaluation:custom",
    );
    expect(sidecar.status).toBe("read");
    if (sidecar.status !== "read") throw new TypeError("Expected repeated sidecar.");
    const repeatedRoots = sidecar.intents.filter((intent) => intent.sourceNodeId === "tasks.stack");
    expect(repeatedRoots.map((intent) => intent.scope.aliases.task)).toEqual(tasks);
    expect(repeatedRoots.map((intent) => intent.scope.repeatKeys)).toEqual([["a"], ["b"]]);

    const reordered = customMaterialization(repeatedSurface, {
      snapshot: taskSnapshot([...tasks].reverse()),
      resolveToken: () => Object.freeze({ status: "resolved", value: "md" }),
    });
    expect(reordered.status).toBe("materialized");
    if (reordered.status !== "materialized") throw new TypeError("Expected reordered output.");
    const firstByText = new Map(
      first.plan.root.map((node) => [node.slots.default?.[0]?.props.text as string, node.identity]),
    );
    const reorderedByText = new Map(
      reordered.plan.root.map((node) => [
        node.slots.default?.[0]?.props.text as string,
        node.identity,
      ]),
    );
    expect(reordered.plan.root.map((node) => node.slots.default?.[0]?.props.text)).toEqual([
      "Task: Beta",
      "Task: Alpha",
    ]);
    expect(reorderedByText).toEqual(firstByText);
  });

  it("rejects duplicate repeat keys atomically", () => {
    const result = customMaterialization(
      surface({
        id: "duplicate.item",
        use: "com.example.ui/Text",
        repeat: {
          items: [{ id: "same" }, { id: "same" }],
          as: "item",
          key: { $ref: "item.item.id" },
        },
        props: { text: "duplicate" },
      }),
    );
    expect(result).toMatchObject({
      status: "invalid",
      reason: "repeat-invalid",
    });
    expect("plan" in result).toBe(false);
  });

  it("omits unresolved optional props and fails the complete node for unresolved required props", () => {
    const optional = customMaterialization(
      surface({
        id: "optional.stack",
        use: "com.example.ui/Stack",
        props: {
          direction: "vertical",
          maxWidth: { $ref: "state.missing" },
        },
      }),
    );
    expect(optional.status).toBe("materialized");
    if (optional.status !== "materialized") throw new TypeError("Expected optional omission.");
    expect(optional.plan.root[0]?.props).toEqual({ direction: "vertical" });

    const required = customMaterialization(
      surface({
        id: "required.text",
        use: "com.example.ui/Text",
        props: { text: { $ref: "state.missing" } },
      }),
    );
    expect(required).toMatchObject({
      status: "invalid",
      reason: "required-prop-unresolved",
    });
    expect("plan" in required).toBe(false);
  });

  it("does no descendant repeat, token, or handler work below a false parent", () => {
    const resolveToken = vi.fn(() => Object.freeze({ status: "resolved", value: [] } as const));
    const result = customMaterialization(
      surface({
        id: "conditional.root",
        use: "com.example.ui/Stack",
        slots: {
          default: [
            {
              id: "conditional.branch",
              use: "com.example.ui/Stack",
              when: { op: "truthy", args: [{ $ref: "state.show", fallback: false }] },
              slots: {
                default: [
                  {
                    id: "conditional.descendant",
                    use: "com.example.ui/Text",
                    repeat: {
                      items: { $token: "items" },
                      as: "item",
                      key: { $ref: "item.item.id" },
                    },
                    props: { text: { $token: "text" } },
                    on: { click: [] },
                  },
                ],
              },
            },
          ],
        },
      }),
      { resolveToken },
    );
    expect(result.status).toBe("materialized");
    if (result.status !== "materialized") throw new TypeError("Expected inactive branch.");
    expect(result.plan.root[0]?.slots.default).toEqual([]);
    expect(resolveToken).not.toHaveBeenCalled();
    const sidecar = readRuntimeHeadlessMaterializationSidecar(
      result.sidecar,
      "reactive-evaluation:custom",
    );
    expect(sidecar.status).toBe("read");
    if (sidecar.status !== "read") throw new TypeError("Expected inactive sidecar.");
    expect(sidecar.intents.map((intent) => intent.sourceNodeId)).toEqual(["conditional.root"]);
  });

  it("retains behavior ownership, behavior slots, and exact handler selectors privately", () => {
    const catalog = JSON.parse(JSON.stringify(frozenWebCatalog)) as {
      behaviors: Record<string, unknown>;
    };
    catalog.behaviors["com.example.behavior/Observe"] = {
      propsSchema: {
        type: "object",
        additionalProperties: false,
        required: ["mode"],
        properties: { mode: { type: "string" } },
      },
      attachTo: { capabilities: ["com.example.ui/Stack"] },
      slots: {
        default: {
          required: false,
          minItems: 0,
          accepts: ["com.example.ui/Text"],
        },
      },
      events: {
        observed: {
          payloadSchema: { type: "object", additionalProperties: false },
        },
      },
    };
    const result = customMaterialization(
      surface({
        id: "behavior.owner",
        use: "com.example.ui/Stack",
        behaviors: [
          {
            id: "behavior.observe",
            use: "com.example.behavior/Observe",
            props: { mode: "visible" },
            on: { observed: [] },
            slots: {
              default: [
                {
                  id: "behavior.label",
                  use: "com.example.ui/Text",
                  props: { text: "Observed" },
                },
              ],
            },
          },
        ],
      }),
      { catalogInput: catalog },
    );
    expect(result.status).toBe("materialized");
    if (result.status !== "materialized") throw new TypeError("Expected behavior plan.");
    const behavior = result.plan.root[0]?.behaviors[0];
    expect(behavior?.props).toEqual({ mode: "visible" });
    expect(behavior?.slots.default?.[0]?.sourceNodeId).toBe("behavior.label");
    const sidecar = readRuntimeHeadlessMaterializationSidecar(
      result.sidecar,
      "reactive-evaluation:custom",
    );
    expect(sidecar.status).toBe("read");
    if (sidecar.status !== "read") throw new TypeError("Expected behavior sidecar.");
    expect(sidecar.intents.map((intent) => intent.kind)).toEqual([
      "component",
      "behavior",
      "component",
    ]);
    const behaviorIntent = sidecar.intents[1];
    expect(behaviorIntent?.kind).toBe("behavior");
    if (behaviorIntent?.kind !== "behavior") throw new TypeError("Expected behavior intent.");
    expect(behaviorIntent.ownerRuntimeInstanceId).toBe(result.plan.root[0]?.identity);
    expect(behavior?.identity).toBe(behaviorIntent.identity);
    expect(behaviorIntent.handledEvents).toEqual(["observed"]);
    expect(behaviorIntent.handlers.observed).toEqual([]);
  });

  it("publishes equal commitments for equal observable plans across different evaluation ids", () => {
    const first = fixture("reactive-evaluation:determinism-1").result;
    const second = fixture("reactive-evaluation:determinism-2").result;
    expect(first.status).toBe("materialized");
    expect(second.status).toBe("materialized");
    if (first.status !== "materialized" || second.status !== "materialized") {
      throw new TypeError("Expected deterministic materializations.");
    }
    expect(second.plan).toEqual(first.plan);
    expect(second.commitment).toEqual(first.commitment);
    expect(Reflect.set(first.plan, "surfaceId", "changed")).toBe(false);
    expect(first.plan.surfaceId).toBe("sign-in");
    expect(
      readRuntimeHeadlessMaterializationSidecar(first.sidecar, "reactive-evaluation:determinism-2"),
    ).toEqual({ status: "evaluation-mismatch" });
    expect(
      readRuntimeHeadlessMaterializationSidecar(
        Object.freeze({}) as never,
        "reactive-evaluation:determinism-1",
      ),
    ).toEqual({ status: "invalid-sidecar" });
  });

  it("enforces lowered node, depth, repeat, JSON occurrence, and string ceilings", () => {
    const twoNodes = surface({
      id: "limit.root",
      use: "com.example.ui/Stack",
      slots: {
        default: [
          {
            id: "limit.child",
            use: "com.example.ui/Text",
            props: { text: "child" },
          },
        ],
      },
    });
    expect(customMaterialization(twoNodes, { limits: { maxNodes: 2 } }).status).toBe(
      "materialized",
    );
    expect(customMaterialization(twoNodes, { limits: { maxNodes: 1 } })).toMatchObject({
      status: "limit-exceeded",
      reason: "node-limit",
      limit: 1,
      observed: 2,
    });

    const depthTwo = surface({
      id: "depth.root",
      use: "com.example.ui/Stack",
      slots: {
        default: [
          {
            id: "depth.middle",
            use: "com.example.ui/Stack",
            slots: {
              default: [
                {
                  id: "depth.leaf",
                  use: "com.example.ui/Text",
                  props: { text: "leaf" },
                },
              ],
            },
          },
        ],
      },
    });
    expect(customMaterialization(depthTwo, { limits: { maxDepth: 2 } }).status).toBe(
      "materialized",
    );
    expect(customMaterialization(depthTwo, { limits: { maxDepth: 1 } })).toMatchObject({
      status: "limit-exceeded",
      reason: "depth-limit",
      limit: 1,
      observed: 2,
    });

    const repeated = surface({
      id: "repeat.limit",
      use: "com.example.ui/Text",
      repeat: { items: ["a", "b"], as: "item", key: { $ref: "item.item" } },
      props: { text: { $ref: "item.item" } },
    });
    expect(customMaterialization(repeated, { limits: { maxRepeatInstances: 1 } })).toMatchObject({
      status: "limit-exceeded",
      reason: "repeat-limit",
      limit: 1,
      observed: 2,
    });
    expect(customMaterialization(twoNodes, { limits: { maxJsonOccurrences: 1 } })).toMatchObject({
      status: "limit-exceeded",
      reason: "json-occurrence-limit",
    });
    expect(customMaterialization(twoNodes, { limits: { maxStringCodeUnits: 1 } })).toMatchObject({
      status: "limit-exceeded",
      reason: "string-code-unit-limit",
    });
    expect(customMaterialization(twoNodes, { limits: { maxNodes: -1 } })).toMatchObject({
      status: "invalid",
      reason: "malformed-limits",
    });
    expect(RUNTIME_HEADLESS_MATERIALIZATION_LIMITS).toMatchObject({
      maxNodes: 5_000,
      maxDepth: 128,
      maxRepeatInstances: 1_000,
      maxJsonOccurrences: 262_144,
      maxStringCodeUnits: 4_194_304,
    });
  });

  it("admits exactly 5,000 materialized nodes and rejects 5,001 without truncation", () => {
    const flatSurface = (totalNodes: number) =>
      surface({
        id: "node-limit.root",
        use: "com.example.ui/Stack",
        slots: {
          default: Array.from({ length: totalNodes - 1 }, (_, index) => ({
            id: `node-limit.item-${index}`,
            use: "com.example.ui/Text",
            props: { text: "item" },
          })),
        },
      });
    const exact = customMaterialization(flatSurface(5_000));
    expect(exact.status).toBe("materialized");
    if (exact.status !== "materialized") throw new TypeError("Expected exact node boundary.");
    expect(exact.plan.root[0]?.slots.default).toHaveLength(4_999);

    const overflow = customMaterialization(flatSurface(5_001));
    expect(overflow).toMatchObject({
      status: "limit-exceeded",
      reason: "node-limit",
      limit: 5_000,
      observed: 5_001,
    });
    expect("plan" in overflow).toBe(false);
  }, 60_000);

  it("fails closed for unbranded catalogs, accessors, and revoked Proxies without invoking getters", () => {
    const validSurface = deepFreeze(
      surface({
        id: "hostile.text",
        use: "com.example.ui/Text",
        props: { text: "safe" },
      }),
    );
    const forgedCatalog = materializeRuntimeHeadlessSurface({
      documentId: "com.example.account-app",
      surfaceId: "sign-in",
      surface: validSurface as RuntimeHeadlessMaterializationInput["surface"],
      catalogSet: Object.freeze([]) as never,
      resolutionSnapshot: defaultSnapshot(),
      materializationContext: {
        requestContext: {
          documentId: "com.example.account-app",
          revision: frozenSignInBundle.revision,
          surfaceId: "sign-in",
          requestId: "reactive-evaluation:forged",
        },
        tokens: { resolve: () => Object.freeze({ status: "missing" }) },
      },
      evaluationId: "reactive-evaluation:forged",
    });
    expect(forgedCatalog).toMatchObject({
      status: "invalid",
      reason: "catalog-authentication-failed",
    });

    const getter = vi.fn(() => validSurface);
    const request: Record<string, unknown> = {
      documentId: "com.example.account-app",
      surfaceId: "sign-in",
      catalogSet: preparedCatalog(),
      resolutionSnapshot: defaultSnapshot(),
      materializationContext: {
        requestContext: {
          documentId: "com.example.account-app",
          revision: frozenSignInBundle.revision,
          surfaceId: "sign-in",
          requestId: "reactive-evaluation:accessor",
        },
        tokens: { resolve: () => Object.freeze({ status: "missing" }) },
      },
      evaluationId: "reactive-evaluation:accessor",
    };
    Object.defineProperty(request, "surface", { enumerable: true, get: getter });
    expect(
      materializeRuntimeHeadlessSurface(request as unknown as RuntimeHeadlessMaterializationInput),
    ).toMatchObject({ status: "invalid", reason: "malformed-input" });
    expect(getter).not.toHaveBeenCalled();

    const revocable = Proxy.revocable(validSurface as object, {});
    Object.freeze(revocable.proxy);
    revocable.revoke();
    expect(customMaterialization(revocable.proxy, { freezeSurface: false })).toMatchObject({
      status: "invalid",
      reason: "unsafe-surface",
    });
  });
});
