import { createRuntimeResolutionSnapshot, evaluateRuntimeVariantOverrides } from "../src/index.js";

import type {
  RuntimeJsonValue,
  RuntimePropValueSpecs,
  RuntimeStyleValueSpecs,
  RuntimeTokenProviderFailure,
  RuntimeValueMaterializationContext,
  RuntimeVariantEvaluationInput,
  RuntimeVariantOverrideInvalidReason,
  RuntimeVariantOverridesEvaluated,
  RuntimeVariantOverridesEvaluation,
  RuntimeVariantOverridesInvalid,
  RuntimeVariantOverrideSpec,
  RuntimeVariantValueSources,
} from "../src/index.js";

const snapshot = createRuntimeResolutionSnapshot({
  state: { enabled: true },
  context: {},
  resource: {},
  operation: {},
  event: { status: "unavailable" },
  item: {},
  env: {},
});

const context: RuntimeValueMaterializationContext = {
  requestContext: {
    documentId: "com.desen.variant-types",
    revision: `sha256:${"6".repeat(64)}`,
    surfaceId: "main",
    requestId: "variant-types-1",
  },
  tokens: {
    resolve: ({ token }) =>
      token === "known" ? { status: "resolved", value: "#fff" } : { status: "missing" },
  },
};

const propVariant: RuntimeVariantOverrideSpec = {
  when: { op: "eq", args: [{ $ref: "state.enabled" }, true] },
  props: {
    label: "Enabled",
    token: { $token: "known" },
  },
};

const styleVariant: RuntimeVariantOverrideSpec = {
  when: { op: "truthy", args: [{ $ref: "state.enabled" }] },
  style: {
    default: {
      root: {
        color: { $token: "known" },
      },
    },
  },
};

const input: RuntimeVariantEvaluationInput = {
  props: { label: "Base" },
  style: { default: { root: { opacity: 1 } } },
  variants: [propVariant, styleVariant],
};

const result: RuntimeVariantOverridesEvaluation = evaluateRuntimeVariantOverrides(
  input,
  snapshot,
  context,
);

if (result.status === "evaluated") {
  const props: RuntimePropValueSpecs = result.effectiveProps;
  const style: RuntimeStyleValueSpecs = result.effectiveStyle;
  const sources: RuntimeVariantValueSources = result.sources;
  const matching: readonly number[] = result.matchingVariantIndices;
  const diagnostics = result.diagnostics;
  void [props, style, sources, matching, diagnostics];

  // Effective values remain ValueSpecs; this stage does not claim final resolved JSON.
  // @ts-expect-error a selected ValueSpec can still be a dynamic token or format form
  const resolvedValue: RuntimeJsonValue = result.effectiveProps.token;
  void resolvedValue;

  // @ts-expect-error evaluated prop maps are immutable
  result.effectiveProps.label = "changed";
  // @ts-expect-error evaluated style-state maps are immutable
  result.effectiveStyle.default = {};
  const defaultStyle = result.effectiveStyle.default;
  if (defaultStyle !== undefined) {
    // @ts-expect-error evaluated style-part maps are immutable
    defaultStyle.root = {};
    const rootStyle = defaultStyle.root;
    if (rootStyle !== undefined) {
      // @ts-expect-error evaluated style-property maps are immutable
      rootStyle.color = "changed";
    }
  }
  // @ts-expect-error winning prop source maps are immutable
  result.sources.props.label = "/changed" as never;
  // @ts-expect-error matching indexes preserve immutable document order
  result.matchingVariantIndices.push(3);
  // @ts-expect-error ordered diagnostics are immutable
  result.diagnostics.push({
    code: "PREDICATE_TYPE_MISMATCH",
    pointer: "" as never,
  });
  // @ts-expect-error successful evaluation has no deferred form
  void result.form;
} else if (result.status === "invalid") {
  const reason: RuntimeVariantOverrideInvalidReason = result.reason;
  void reason;
  // @ts-expect-error invalid outcomes expose no partial effective props
  void result.effectiveProps;
  // @ts-expect-error invalid outcomes expose no partial diagnostics
  void result.diagnostics;
} else {
  const code: "ADAPTER_FAILURE" = result.code;
  const adapter: "token-provider" = result.adapter;
  void [code, adapter];
  // @ts-expect-error provider failures redact raw errors
  void result.error;
  // @ts-expect-error provider failures expose no partial effective style
  void result.effectiveStyle;
}

const evaluated: RuntimeVariantOverridesEvaluated = {
  status: "evaluated",
  effectiveProps: {},
  effectiveStyle: {},
  sources: { props: {}, style: {} },
  matchingVariantIndices: [],
  diagnostics: [],
};
const invalid: RuntimeVariantOverridesInvalid = {
  status: "invalid",
  pointer: "" as never,
  reason: "malformed-variant-overrides",
};
const failed: RuntimeTokenProviderFailure = {
  status: "failed",
  code: "ADAPTER_FAILURE",
  pointer: "/variants/0/when/args/0/$token" as never,
  adapter: "token-provider",
};
void [evaluated, invalid, failed];

// @ts-expect-error every variant requires a predicate
const missingWhen: RuntimeVariantOverrideSpec = {
  props: { label: "invalid" },
};
void missingWhen;

// @ts-expect-error every variant requires at least props or style
const emptyPatch: RuntimeVariantOverrideSpec = {
  when: { op: "eq", args: [1, 1] },
};
void emptyPatch;

const structuralPatch: RuntimeVariantOverrideSpec = {
  when: { op: "eq", args: [1, 1] },
  props: {},
  // @ts-expect-error variants cannot mutate structural children or slots
  slots: { default: [] },
};
void structuralPatch;

const executablePatch: RuntimeVariantOverrideSpec = {
  when: {
    // @ts-expect-error predicate operators are a closed data-only vocabulary
    op: "javascript",
    args: ["return true"],
  },
  props: {},
};
void executablePatch;

const executableStyle: RuntimeStyleValueSpecs = {
  default: {
    root: {
      // @ts-expect-error style leaves must be inert ValueSpecs
      color: () => "#fff",
    },
  },
};
void executableStyle;

const structuralInput: RuntimeVariantEvaluationInput = {
  props: {},
  // @ts-expect-error the evaluator input intentionally excludes structural node fields
  children: [],
};
void structuralInput;

const variants = input.variants;
if (variants !== undefined) {
  // @ts-expect-error the variant array is immutable
  variants.push(propVariant);
}

const baseProps = input.props;
if (baseProps !== undefined) {
  // @ts-expect-error base prop maps are immutable
  baseProps.label = "changed";
}

// @ts-expect-error the materialization context is mandatory
evaluateRuntimeVariantOverrides(input, snapshot);

// @ts-expect-error variant evaluation cannot omit the factory-created snapshot
evaluateRuntimeVariantOverrides(input, context);

const asynchronousContext: RuntimeValueMaterializationContext = {
  requestContext: context.requestContext,
  tokens: {
    // @ts-expect-error token resolution remains synchronous during predicate evaluation
    resolve: async () => ({ status: "resolved" as const, value: "#fff" }),
  },
};
void asynchronousContext;

// @ts-expect-error the public result has no unresolved or deferred terminal
if (result.status === "unresolved") void result;
