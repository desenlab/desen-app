import { useEffect, useRef } from "react";

import type {
  RuntimeReactAdapterRegistryCreateInput,
  RuntimeReactComponentAdapterProps,
  RuntimeReactComponentAdapterRegistration,
  RuntimeReactComponentCommandPort,
} from "@desen/runtime-react";

import { Alert } from "../components/alert.js";
import { Button } from "../components/button.js";
import { STACK_CAPABILITY_ID, TEXT_CAPABILITY_ID } from "../components/contracts.js";
import {
  ALERT_CAPABILITY_ID,
  BUTTON_CAPABILITY_ID,
  TEXT_FIELD_CAPABILITY_ID,
} from "../components/interactive-contracts.js";
import { Stack } from "../components/stack.js";
import { Text } from "../components/text.js";
import { TextField } from "../components/text-field.js";

import type { StackCatalogProps, TextCatalogProps } from "../components/contracts.js";
import type {
  AlertCatalogProps,
  ButtonCatalogProps,
  TextFieldCatalogProps,
} from "../components/interactive-contracts.js";
import type { TextFieldHandle } from "../components/text-field.js";

const COMMAND_SUCCEEDED = Object.freeze({ status: "succeeded" } as const);
const COMMAND_DENIED = Object.freeze({ status: "denied" } as const);

function exactEmptyInput(input: object): boolean {
  try {
    if (Array.isArray(input)) return false;
    const prototype = Object.getPrototypeOf(input);
    return (
      (prototype === Object.prototype || prototype === null) && Reflect.ownKeys(input).length === 0
    );
  } catch {
    return false;
  }
}

/**
 * Adapts the exact runtime Stack contract to the real reference Stack component.
 *
 * @remarks Only the declared `default` slot becomes React children. Semantic style data and
 * undeclared runtime properties are intentionally not forwarded to a DOM surface.
 */
export function StackReactAdapter({ props, slots }: RuntimeReactComponentAdapterProps) {
  const catalogProps = props as unknown as StackCatalogProps;

  return (
    <Stack
      {...(catalogProps.align === undefined ? {} : { align: catalogProps.align })}
      {...(catalogProps.direction === undefined ? {} : { direction: catalogProps.direction })}
      {...(catalogProps.gap === undefined ? {} : { gap: catalogProps.gap })}
      {...(catalogProps.maxWidth === undefined ? {} : { maxWidth: catalogProps.maxWidth })}
    >
      {slots.default}
    </Stack>
  );
}

/**
 * Adapts the exact runtime Text contract to the real reference Text component.
 *
 * @remarks The adapter forwards only schema-validated inert text and role values.
 */
export function TextReactAdapter({ props }: RuntimeReactComponentAdapterProps) {
  const catalogProps = props as unknown as TextCatalogProps;

  return (
    <Text
      {...(catalogProps.role === undefined ? {} : { role: catalogProps.role })}
      text={catalogProps.text}
    />
  );
}

/**
 * Adapts the exact runtime TextField contract to the real reference TextField component.
 *
 * @remarks The trusted adapter forwards fresh inert change payloads through `dispatchEvent`.
 * Its narrow `TextFieldHandle` is retained only in a private React ref. Command authority is
 * attached from a passive effect after commit and the exact returned attachment is detached on
 * cleanup, supersession, and unmount. Rendering, server rendering, and abandoned renders therefore
 * create no command authority or DOM reference outside this component.
 */
export function TextFieldReactAdapter({ interactions, props }: RuntimeReactComponentAdapterProps) {
  const catalogProps = props as unknown as TextFieldCatalogProps;
  const textFieldHandle = useRef<TextFieldHandle>(null);

  useEffect(() => {
    let current = true;
    const commands = Object.freeze({
      invoke(commandName, input) {
        if (
          !current ||
          commandName !== "focus" ||
          catalogProps.disabled === true ||
          textFieldHandle.current === null ||
          !exactEmptyInput(input)
        ) {
          return COMMAND_DENIED;
        }
        textFieldHandle.current.focus();
        return COMMAND_SUCCEEDED;
      },
    } satisfies RuntimeReactComponentCommandPort);
    const attachmentResult = interactions.attachCommands(commands);
    const attachment =
      attachmentResult.status === "attached" ? attachmentResult.attachment : undefined;

    return () => {
      current = false;
      if (attachment !== undefined) {
        interactions.detachCommands(attachment);
      }
    };
  }, [catalogProps.disabled, interactions]);

  return (
    <TextField
      {...(catalogProps.disabled === undefined ? {} : { disabled: catalogProps.disabled })}
      {...(catalogProps.invalid === undefined ? {} : { invalid: catalogProps.invalid })}
      label={catalogProps.label}
      onChange={(payload) => {
        interactions.dispatchEvent("change", payload);
      }}
      {...(catalogProps.placeholder === undefined ? {} : { placeholder: catalogProps.placeholder })}
      ref={textFieldHandle}
      {...(catalogProps.secure === undefined ? {} : { secure: catalogProps.secure })}
      value={catalogProps.value}
    />
  );
}

/**
 * Adapts the exact runtime Button contract to the real reference Button component.
 *
 * @remarks Native React events stop inside the real component. This adapter receives only its
 * fresh frozen empty payload and forwards that inert value through the runtime event port.
 */
export function ButtonReactAdapter({ interactions, props }: RuntimeReactComponentAdapterProps) {
  const catalogProps = props as unknown as ButtonCatalogProps;

  return (
    <Button
      {...(catalogProps.disabled === undefined ? {} : { disabled: catalogProps.disabled })}
      label={catalogProps.label}
      {...(catalogProps.loading === undefined ? {} : { loading: catalogProps.loading })}
      onPress={(payload) => {
        interactions.dispatchEvent("press", payload);
      }}
      {...(catalogProps.variant === undefined ? {} : { variant: catalogProps.variant })}
    />
  );
}

/**
 * Adapts the exact runtime Alert contract to the real reference Alert component.
 *
 * @remarks The adapter forwards only the declared inert tone and text values.
 */
export function AlertReactAdapter({ props }: RuntimeReactComponentAdapterProps) {
  const catalogProps = props as unknown as AlertCatalogProps;

  return <Alert text={catalogProps.text} tone={catalogProps.tone} />;
}

/** Exact frozen Stack adapter registration for the reference Web Catalog. */
export const stackReactAdapterRegistration = Object.freeze({
  capabilityId: STACK_CAPABILITY_ID,
  component: StackReactAdapter,
} as const satisfies RuntimeReactComponentAdapterRegistration);

/** Exact frozen Text adapter registration for the reference Web Catalog. */
export const textReactAdapterRegistration = Object.freeze({
  capabilityId: TEXT_CAPABILITY_ID,
  component: TextReactAdapter,
} as const satisfies RuntimeReactComponentAdapterRegistration);

/** Exact frozen TextField adapter registration for the reference Web Catalog. */
export const textFieldReactAdapterRegistration = Object.freeze({
  capabilityId: TEXT_FIELD_CAPABILITY_ID,
  component: TextFieldReactAdapter,
} as const satisfies RuntimeReactComponentAdapterRegistration);

/** Exact frozen Button adapter registration for the reference Web Catalog. */
export const buttonReactAdapterRegistration = Object.freeze({
  capabilityId: BUTTON_CAPABILITY_ID,
  component: ButtonReactAdapter,
} as const satisfies RuntimeReactComponentAdapterRegistration);

/** Exact frozen Alert adapter registration for the reference Web Catalog. */
export const alertReactAdapterRegistration = Object.freeze({
  capabilityId: ALERT_CAPABILITY_ID,
  component: AlertReactAdapter,
} as const satisfies RuntimeReactComponentAdapterRegistration);

/**
 * Finite executable component-adapter inventory for the frozen reference Web Catalog.
 *
 * @remarks Every registration and the containing array are frozen. All five components are
 * statically imported; this package contains no dynamic loader, fallback resolver, or
 * manifest-selected executable path.
 */
export const REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS = Object.freeze([
  stackReactAdapterRegistration,
  textReactAdapterRegistration,
  textFieldReactAdapterRegistration,
  buttonReactAdapterRegistration,
  alertReactAdapterRegistration,
] as const satisfies readonly RuntimeReactComponentAdapterRegistration[]);

/**
 * Factory-ready immutable input for `createRuntimeReactAdapterRegistry`.
 *
 * @remarks This object carries the reviewed executable trust boundary explicitly. Catalog data
 * cannot add, replace, or select any function in the inventory.
 */
export const REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT = Object.freeze({
  components: REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS,
} satisfies RuntimeReactAdapterRegistryCreateInput);
