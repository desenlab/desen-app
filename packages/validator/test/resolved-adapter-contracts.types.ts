import {
  createDesenResolvedAdapterValidationScope,
  validateDesenResolvedAdapterProps,
  validateDesenResolvedAdapterSlots,
  validateDesenResolvedAdapterStyle,
} from "../src/index.js";

import type {
  DesenAdapterCapabilityReference,
  DesenResolvedAdapterPropsValidationResult,
  DesenResolvedAdapterSlotsValidationResult,
  DesenResolvedAdapterStyleValidationResult,
} from "../src/index.js";

import type { DesenValidatedExecutionCatalogSet } from "../src/index.js";

declare const catalogs: DesenValidatedExecutionCatalogSet;

const component = {
  capabilityKind: "component",
  capabilityId: "com.example.ui/TextField",
} as const satisfies DesenAdapterCapabilityReference;

const created = createDesenResolvedAdapterValidationScope(catalogs);
createDesenResolvedAdapterValidationScope(catalogs, {
  maxSlotContractEvaluationSteps: 1_000,
});
if (created.status !== "created") throw new TypeError("Expected scope.");
const props: DesenResolvedAdapterPropsValidationResult = validateDesenResolvedAdapterProps(
  { label: "Email", value: "" },
  component,
  created.scope,
);
const style: DesenResolvedAdapterStyleValidationResult = validateDesenResolvedAdapterStyle(
  { base: { root: { color: "#112233" } } },
  component,
  created.scope,
);
const slots: DesenResolvedAdapterSlotsValidationResult = validateDesenResolvedAdapterSlots(
  { default: [{ capabilityId: "com.example.ui/Text" }] },
  component,
  created.scope,
);

if (props.valid) {
  const label: unknown = props.value.label;
  void label;

  // @ts-expect-error Successful snapshots are readonly.
  props.value.label = "Changed";
} else {
  const code: string = props.diagnostics[0]?.code ?? "";
  void code;

  // @ts-expect-error Failures expose no partial adapter value.
  void props.value;
}

if (style.valid) {
  const base: unknown = style.value.base;
  void base;

  // @ts-expect-error Successful style maps are readonly.
  style.value.base = {};
} else {
  // @ts-expect-error Failures expose no partial style value.
  void style.value;
}

validateDesenResolvedAdapterProps(
  {},
  // @ts-expect-error Capability categories are closed.
  { capabilityKind: "operation", capabilityId: "com.example.auth/signIn" },
  created.scope,
);

void props;
void slots;
void style;

// @ts-expect-error A Catalog set is not a receiving scope.
validateDesenResolvedAdapterProps({}, component, catalogs);

if (slots.valid) {
  // @ts-expect-error Named-slot snapshots are deeply readonly.
  slots.value.default = [];
}
