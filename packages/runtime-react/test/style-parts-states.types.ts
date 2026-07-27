import type { RuntimeJsonValue } from "@desen/runtime-core";
import type { DesenResolvedAdapterStyle } from "@desen/validator";
import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactRenderFailureChannel,
  RuntimeReactRenderFailureCode,
  RuntimeReactSemanticStyle,
  RuntimeReactStyleParts,
  RuntimeReactStyleProperties,
} from "../src/index.js";

declare const componentProps: RuntimeReactComponentAdapterProps;
declare const style: RuntimeReactSemanticStyle;

const channel: RuntimeReactRenderFailureChannel = "style";
const componentCode: RuntimeReactRenderFailureCode = "INVALID_COMPONENT_STYLE";
const behaviorCode: RuntimeReactRenderFailureCode = "INVALID_BEHAVIOR_STYLE";
const state: RuntimeReactStyleParts | undefined = componentProps.style.focus;
const part: RuntimeReactStyleProperties | undefined = state?.control;
const property: RuntimeJsonValue | undefined = part?.borderColor;
const validatorStyle: DesenResolvedAdapterStyle = style;
const runtimeStyle: RuntimeReactSemanticStyle = validatorStyle;

// @ts-expect-error Adapter style state maps are readonly.
componentProps.style.focus = {};
// @ts-expect-error Adapter style-part maps are readonly.
componentProps.style.base?.root = {};
if (componentProps.style.base?.root !== undefined) {
  // @ts-expect-error Resolved style property maps are readonly.
  componentProps.style.base.root.color = "red";
}
// @ts-expect-error Style values are inert resolved JSON, never executable hooks.
const executableStyle: RuntimeReactSemanticStyle = { base: { root: { color: () => "red" } } };
// @ts-expect-error A visual state must contain semantic parts, not property values.
const flatStyle: RuntimeReactSemanticStyle = { base: { color: "red" } };
// @ts-expect-error A style part must contain a property map, not an array.
const malformedStyle: RuntimeReactSemanticStyle = { base: { root: [] } };

void style;
void channel;
void componentCode;
void behaviorCode;
void state;
void part;
void property;
void validatorStyle;
void runtimeStyle;
void executableStyle;
void flatStyle;
void malformedStyle;
