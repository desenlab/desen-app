import { createRuntimeResolutionSnapshot, materializeRuntimeValue } from "../src/index.js";

import type {
  RuntimeTokenProviderFailure,
  RuntimeTokenUnresolved,
  RuntimeValueMaterialization,
  RuntimeValueMaterializationContext,
} from "../src/index.js";

const snapshot = createRuntimeResolutionSnapshot({
  state: {},
  context: {},
  resource: {},
  operation: {},
  event: { status: "unavailable" },
  item: {},
  env: {},
});

const context: RuntimeValueMaterializationContext = {
  requestContext: {
    documentId: "com.desen.test",
    revision: `sha256:${"1".repeat(64)}`,
    surfaceId: "main",
    requestId: "materialize-1",
  },
  tokens: {
    resolve: ({ token }) =>
      token === "known" ? { status: "resolved", value: "#fff" } : { status: "missing" },
  },
};

const result: RuntimeValueMaterialization = materializeRuntimeValue(
  { $format: { template: "{value}", values: { value: { $token: "known" } } } },
  snapshot,
  context,
);

if (result.status === "unresolved" && "token" in result) {
  const token: string = result.token;
  const reason: "missing-token" = result.reason;
  void [token, reason];
  // @ts-expect-error unresolved tokens never expose a partial value
  void result.value;
}

if (result.status === "failed") {
  const code: "ADAPTER_FAILURE" = result.code;
  const adapter: "token-provider" = result.adapter;
  void [code, adapter];
  // @ts-expect-error provider failures redact raw errors
  void result.error;
}

// @ts-expect-error materialization requires an explicit token port
const missingTokens: RuntimeValueMaterializationContext = {
  requestContext: context.requestContext,
};
void missingTokens;

const incompleteRequestContext: RuntimeValueMaterializationContext = {
  // @ts-expect-error every request context requires a deterministic requestId
  requestContext: {
    documentId: "com.desen.test",
    revision: "revision",
    surfaceId: "main",
  },
  tokens: context.tokens,
};
void incompleteRequestContext;

const asynchronousProvider: RuntimeValueMaterializationContext = {
  requestContext: context.requestContext,
  tokens: {
    // @ts-expect-error token resolution is synchronous
    resolve: async () => ({ status: "resolved" as const, value: "#fff" }),
  },
};
void asynchronousProvider;

// @ts-expect-error a materialization context is mandatory even for literal inputs
materializeRuntimeValue("literal", snapshot);

// @ts-expect-error captured request identity is immutable
context.requestContext.requestId = "changed";

const tokenFailure: RuntimeTokenUnresolved = {
  status: "unresolved",
  code: "REFERENCE_UNRESOLVED",
  pointer: "/$token" as never,
  token: "missing",
  reason: "missing-token",
};
const providerFailure: RuntimeTokenProviderFailure = {
  status: "failed",
  code: "ADAPTER_FAILURE",
  pointer: "/$token" as never,
  adapter: "token-provider",
};
void [tokenFailure, providerFailure];
