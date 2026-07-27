import {
  createDesenResolvedAdapterValidationScope,
  validateDesenResolvedAdapterProps,
  validateDesenResolvedAdapterSlots,
  validateDesenResolvedAdapterStyle,
} from "../src/index.js";

import type {
  DesenAdapterCapabilityReference,
  DesenResolvedAdapterStyle,
  DesenResolvedAdapterStyleParts,
  DesenResolvedAdapterStyleProperties,
  DesenResolvedAdapterPropsValidationResult,
  DesenResolvedAdapterSlotsValidationResult,
  DesenResolvedAdapterStyleValidationResult,
  DesenResolvedJsonValue,
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
  const base: DesenResolvedAdapterStyleParts | undefined = style.value.base;
  const root: DesenResolvedAdapterStyleProperties | undefined = base?.root;
  const color: DesenResolvedJsonValue | undefined = root?.color;
  void base;
  void root;
  void color;

  // @ts-expect-error Successful style maps are readonly.
  style.value.base = {};
} else {
  // @ts-expect-error Failures expose no partial style value.
  void style.value;
}

// @ts-expect-error A visual state must contain style parts, not a property value.
const flatStyle: DesenResolvedAdapterStyle = { base: { color: "red" } };
// @ts-expect-error A style part must contain a property map, not an array.
const malformedStyle: DesenResolvedAdapterStyle = { base: { root: [] } };

validateDesenResolvedAdapterProps(
  {},
  // @ts-expect-error Capability categories are closed.
  { capabilityKind: "operation", capabilityId: "com.example.auth/signIn" },
  created.scope,
);

void props;
void slots;
void style;
void flatStyle;
void malformedStyle;

// @ts-expect-error A Catalog set is not a receiving scope.
validateDesenResolvedAdapterProps({}, component, catalogs);

if (slots.valid) {
  // @ts-expect-error Named-slot snapshots are deeply readonly.
  slots.value.default = [];
}
