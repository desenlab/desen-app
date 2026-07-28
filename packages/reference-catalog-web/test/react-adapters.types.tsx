import { Button } from "../src/components/index.js";
import {
  AlertReactAdapter,
  ButtonReactAdapter,
  REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT,
  REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS,
  StackReactAdapter,
  TextFieldReactAdapter,
  TextReactAdapter,
  alertReactAdapterRegistration,
  buttonReactAdapterRegistration,
  stackReactAdapterRegistration,
  textFieldReactAdapterRegistration,
  textReactAdapterRegistration,
} from "../src/react-adapters/index.js";

import type {
  RuntimeReactAdapterRegistryCreateInput,
  RuntimeReactCommandAttachmentHandle,
  RuntimeReactComponentAdapterComponent,
  RuntimeReactComponentAdapterProps,
  RuntimeReactComponentAdapterRegistration,
  RuntimeReactInteractionPort,
  RuntimeReactSemanticStyle,
} from "@desen/runtime-react";

const factoryInput: RuntimeReactAdapterRegistryCreateInput =
  REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT;
const registrations: readonly RuntimeReactComponentAdapterRegistration[] =
  REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS;
const registrationCount: 5 = REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS.length;
const adapters: readonly RuntimeReactComponentAdapterComponent[] = [
  StackReactAdapter,
  TextReactAdapter,
  TextFieldReactAdapter,
  ButtonReactAdapter,
  AlertReactAdapter,
];
const stackId: "com.example.ui/Stack" = stackReactAdapterRegistration.capabilityId;
const textId: "com.example.ui/Text" = textReactAdapterRegistration.capabilityId;
const textFieldId: "com.example.ui/TextField" = textFieldReactAdapterRegistration.capabilityId;
const buttonId: "com.example.ui/Button" = buttonReactAdapterRegistration.capabilityId;
const alertId: "com.example.ui/Alert" = alertReactAdapterRegistration.capabilityId;
const semanticStyle: RuntimeReactSemanticStyle = {
  base: {
    root: {
      color: "token.reference.color.text",
    },
  },
};

// @ts-expect-error M05-T04-N01 the reviewed registration inventory is immutable.
REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS.push(stackReactAdapterRegistration);

// @ts-expect-error M05-T04-N02 the factory-ready input cannot replace its component inventory.
REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT.components = [];

// @ts-expect-error M05-T04-N03 exact registrations cannot change capability identity.
stackReactAdapterRegistration.capabilityId = "com.example.ui/Forged";

const rawComponentRegistration: RuntimeReactComponentAdapterRegistration = {
  capabilityId: "com.example.ui/Button",
  // @ts-expect-error M05-T04-N04 a raw real component is not a runtime adapter component.
  component: Button,
};

// @ts-expect-error M05-T04-N05 adapters require the complete trusted runtime adapter props.
StackReactAdapter({ props: { direction: "vertical" } });

const missingInteractions: RuntimeReactComponentAdapterProps = {
  identity: {
    runtimeNodeId: "runtime:test",
    sourceNodeId: "source:test",
    capabilityId: "com.example.ui/Text",
  },
  props: { text: "Text" },
  slots: {},
  style: { base: {} },
  // @ts-expect-error M05-T04-N06 executable interaction authority is an explicit required port.
  interactions: undefined,
};

// @ts-expect-error M05-T04-N07 native events cannot cross the inert JSON event seam.
const nativePayload: Parameters<RuntimeReactInteractionPort["dispatchEvent"]>[1] = new MouseEvent(
  "click",
);

// @ts-expect-error M05-T04-N08 attachment handles are opaque and cannot be forged structurally.
const forgedAttachment: RuntimeReactCommandAttachmentHandle = {};

const executableSemanticStyle: RuntimeReactSemanticStyle = {
  base: {
    root: {
      // @ts-expect-error M05-T04-N09 semantic style values remain inert JSON, never DOM callbacks.
      onClick: () => undefined,
    },
  },
};

// @ts-expect-error M05-T04-N10 the static reference inventory contains no behavior authority.
void REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT.behaviors;

void adapters;
void alertId;
void buttonId;
void executableSemanticStyle;
void factoryInput;
void forgedAttachment;
void missingInteractions;
void nativePayload;
void rawComponentRegistration;
void registrationCount;
void registrations;
void semanticStyle;
void stackId;
void textFieldId;
void textId;
