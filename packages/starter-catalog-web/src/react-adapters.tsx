import { createContext, useContext, useId, useMemo, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Select } from "@base-ui/react/select";
import { Dialog } from "@base-ui/react/dialog";
import { canonicalizeJson } from "@desen/protocol";

import {
  starterButtonComponentRegistration,
  starterSelectComponentRegistration,
  starterDialogComponentRegistration,
} from "./contracts.js";
import styles from "./neutral.module.css";

import type { CSSProperties, ReactNode } from "react";
import type {
  RuntimeReactAdapterRegistryCreateInput,
  RuntimeReactComponentAdapterProps,
  RuntimeReactSemanticStyle,
} from "@desen/runtime-react";
import type { StarterButtonProps, StarterSelectProps, StarterDialogProps } from "./contracts.js";

interface PortalBoundary {
  readonly root: HTMLDivElement | null;
  readonly container: HTMLDivElement | null;
}

const PortalContext = createContext<PortalBoundary | null>(null);

/**
 * Trusted Web host boundary shared by canvas and independent host compositions.
 *
 * @remarks Owns its DOM portal target; neither Source nor callers can supply a selector, ref or
 * external container. Portals wait for a committed contained target and never fall back to body.
 * The wrapper clips overlays to this preview surface; it is host chrome, not a managed node.
 */
export function StarterSurfaceBoundary({ children }: Readonly<{ children: ReactNode }>) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const boundary = useMemo(() => ({ root, container }), [root, container]);
  return (
    <div ref={setRoot} className={styles.boundary} data-desen-starter-boundary="">
      <PortalContext.Provider value={boundary}>{children}</PortalContext.Provider>
      <div ref={setContainer} className={styles.portals} data-desen-starter-portals="" />
    </div>
  );
}

function usePortalBoundary(): PortalBoundary {
  const boundary = useContext(PortalContext);
  if (boundary === null) throw new Error("STARTER_PORTAL_BOUNDARY_REQUIRED");
  if (
    boundary.root !== null &&
    boundary.container !== null &&
    !boundary.root.contains(boundary.container)
  ) {
    throw new Error("STARTER_PORTAL_BOUNDARY_INVALID");
  }
  return boundary;
}

type Registration =
  | typeof starterButtonComponentRegistration
  | typeof starterSelectComponentRegistration
  | typeof starterDialogComponentRegistration;

function guardInput(input: RuntimeReactComponentAdapterProps, registration: Registration): void {
  // Runtime React is the schema-admission authority. This defensive check prevents direct trusted
  // misuse from widening the bridge to callbacks, JSX, unknown parts or arbitrary Base UI props.
  if (input.identity.capabilityId !== registration.id)
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  canonicalizeJson(input.props);
  const allowedProps = Object.keys(registration.manifest.propsSchema.properties);
  if (Object.keys(input.props).some((key) => !allowedProps.includes(key)))
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  const allowedSlots = registration.id === starterDialogComponentRegistration.id ? ["content"] : [];
  if (Object.keys(input.slots).some((key) => !allowedSlots.includes(key)))
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  if (
    registration.id === starterDialogComponentRegistration.id &&
    (input.slots.content === undefined ||
      input.slots.content.length < 1 ||
      input.slots.content.length > 16)
  )
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  const parts = Object.keys(registration.manifest.styleParts);
  const states: readonly string[] = registration.manifest.visualStates;
  for (const [state, stateParts] of Object.entries(input.style)) {
    if (state !== "base" && !states.includes(state))
      throw new Error("STARTER_ADAPTER_INPUT_INVALID");
    for (const [part, values] of Object.entries(stateParts)) {
      if (!parts.includes(part)) throw new Error("STARTER_ADAPTER_INPUT_INVALID");
      for (const [property, value] of Object.entries(values)) {
        const valid = ["color", "backgroundColor", "borderColor"].includes(property)
          ? typeof value === "string" && /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/u.test(value)
          : typeof value === "number" &&
            Number.isFinite(value) &&
            ((property === "borderRadius" && value >= 0 && value <= 64) ||
              (property === "padding" && value >= 0 && value <= 128) ||
              (property === "fontSize" && value >= 8 && value <= 96));
        if (!valid) throw new Error("STARTER_ADAPTER_INPUT_INVALID");
      }
    }
  }
}

function partStyle(
  style: RuntimeReactSemanticStyle,
  part: string,
  states: readonly string[] = [],
): CSSProperties {
  const result: CSSProperties = {};
  for (const state of ["base", ...states]) {
    const values = style[state]?.[part];
    if (values === undefined) continue;
    // No property name supplied by a document becomes a CSS property through generic spreading.
    if (typeof values.color === "string") result.color = values.color;
    if (typeof values.backgroundColor === "string") result.backgroundColor = values.backgroundColor;
    if (typeof values.borderColor === "string") result.borderColor = values.borderColor;
    if (typeof values.borderRadius === "number") result.borderRadius = values.borderRadius;
    if (typeof values.padding === "number") result.padding = values.padding;
    if (typeof values.fontSize === "number") result.fontSize = values.fontSize;
  }
  return result;
}

function useInteractionStates(disabled: boolean) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pressed, setPressed] = useState(false);
  return {
    states: [
      ...(!disabled && hover ? ["hover"] : []),
      ...(focus ? ["focus"] : []),
      ...(!disabled && pressed ? ["pressed"] : []),
    ],
    handlers: {
      onPointerEnter: () => {
        setHover(true);
      },
      onPointerLeave: () => {
        setHover(false);
        setPressed(false);
      },
      onPointerDown: () => {
        setPressed(true);
      },
      onPointerUp: () => {
        setPressed(false);
      },
      onPointerCancel: () => {
        setPressed(false);
      },
      onFocus: () => {
        setFocus(true);
      },
      onBlur: () => {
        setFocus(false);
        setPressed(false);
      },
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === " " || event.key === "Enter") setPressed(true);
      },
      onKeyUp: () => {
        setPressed(false);
      },
    },
  };
}

/** Maps the admitted Button contract to Base UI; native events remain private to this adapter. */
export function StarterButtonReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterButtonComponentRegistration);
  const props = input.props as unknown as StarterButtonProps;
  const disabled = props.disabled === true;
  const loading = props.loading === true;
  const interaction = useInteractionStates(disabled || loading);
  const states = [
    ...interaction.states,
    ...(disabled ? ["disabled"] : []),
    ...(loading ? ["loading"] : []),
  ];
  const labelId = useId();
  return (
    <Button
      type="button"
      className={styles.button}
      style={partStyle(input.style, "root", states)}
      disabled={disabled || loading}
      focusableWhenDisabled={loading && !disabled}
      aria-busy={loading || undefined}
      aria-labelledby={labelId}
      {...interaction.handlers}
      onClick={() => {
        if (!disabled && !loading) input.interactions.dispatchEvent("press", Object.freeze({}));
      }}
    >
      <span id={labelId} style={partStyle(input.style, "label", states)}>
        {props.label}
      </span>
    </Button>
  );
}

/** Maps a finite inert option list to the real Base UI Select and a contained portal. */
export function StarterSelectReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterSelectComponentRegistration);
  const props = input.props as unknown as StarterSelectProps;
  const boundary = usePortalBoundary();
  const [open, setOpen] = useState(false);
  const disabled = props.disabled === true;
  const interaction = useInteractionStates(disabled);
  const states = [
    ...interaction.states.filter((state) => state !== "pressed"),
    ...(open ? ["open"] : []),
    ...(disabled ? ["disabled"] : []),
  ];
  const optionValues = props.options.map((item) => item.value);
  if (
    new Set(optionValues).size !== optionValues.length ||
    (props.defaultValue !== undefined && !optionValues.includes(props.defaultValue))
  )
    throw new Error("STARTER_SELECT_OPTIONS_INVALID");
  return (
    <div className={styles.field} style={partStyle(input.style, "root", states)}>
      <Select.Root<string>
        defaultValue={props.defaultValue ?? null}
        disabled={disabled}
        modal={false}
        items={props.options}
        onOpenChange={setOpen}
        onValueChange={(value) => {
          if (
            value !== null &&
            !disabled &&
            props.options.some((option) => option.value === value && option.disabled !== true)
          )
            input.interactions.dispatchEvent("change", Object.freeze({ value }));
        }}
      >
        <Select.Label className={styles.label} style={partStyle(input.style, "label", states)}>
          {props.label}
        </Select.Label>
        <Select.Trigger
          className={styles.trigger}
          style={partStyle(input.style, "trigger", states)}
          {...interaction.handlers}
        >
          <Select.Value placeholder="Select an option" />
          <Select.Icon aria-hidden="true">⌄</Select.Icon>
        </Select.Trigger>
        {boundary.container !== null && boundary.root !== null && (
          <Select.Portal container={boundary.container}>
            <Select.Positioner
              alignItemWithTrigger={false}
              positionMethod="absolute"
              collisionBoundary={boundary.root}
              sideOffset={8}
            >
              <Select.Popup
                className={styles.popup}
                style={partStyle(input.style, "popup", states)}
              >
                <Select.List>
                  {props.options.map((option) => (
                    <Select.Item
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled === true}
                      className={styles.item}
                      style={(state) =>
                        partStyle(input.style, "item", [
                          ...(state.selected ? ["selected"] : []),
                          ...(state.highlighted ? ["highlighted"] : []),
                          ...(state.disabled ? ["disabled"] : []),
                        ])
                      }
                    >
                      <Select.ItemText>{option.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        )}
      </Select.Root>
    </div>
  );
}

/** Maps the declared Dialog parts and required content slot to a bounded, focus-trapping overlay. */
export function StarterDialogReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterDialogComponentRegistration);
  const props = input.props as unknown as StarterDialogProps;
  const boundary = usePortalBoundary();
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<HTMLDivElement | null>(null);
  const [nestedContainer, setNestedContainer] = useState<HTMLDivElement | null>(null);
  const nestedBoundary = useMemo(
    () => ({ root: popup, container: nestedContainer }),
    [popup, nestedContainer],
  );
  const disabled = props.disabled === true;
  const interaction = useInteractionStates(disabled);
  const states = [
    ...interaction.states.filter((state) => state === "focus"),
    ...(open ? ["open"] : []),
    ...(disabled ? ["disabled"] : []),
  ];
  return (
    <div style={partStyle(input.style, "root", states)}>
      <Dialog.Root
        modal="trap-focus"
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          input.interactions.dispatchEvent("openChange", Object.freeze({ open: nextOpen }));
        }}
      >
        <Dialog.Trigger
          disabled={disabled}
          className={styles.button}
          style={partStyle(input.style, "trigger", states)}
          {...interaction.handlers}
        >
          {props.triggerLabel ??
            starterDialogComponentRegistration.manifest.propsSchema.properties.triggerLabel.default}
        </Dialog.Trigger>
        {boundary.container !== null && (
          <Dialog.Portal container={boundary.container}>
            <Dialog.Backdrop
              className={styles.backdrop}
              style={partStyle(input.style, "backdrop", states)}
            />
            <Dialog.Popup
              ref={setPopup}
              className={styles.dialog}
              style={partStyle(input.style, "popup", states)}
            >
              <Dialog.Title
                className={styles.title}
                style={partStyle(input.style, "title", states)}
              >
                {props.title ??
                  starterDialogComponentRegistration.manifest.propsSchema.properties.title.default}
              </Dialog.Title>
              <Dialog.Description
                className={styles.description}
                style={partStyle(input.style, "description", states)}
              >
                {props.description ??
                  starterDialogComponentRegistration.manifest.propsSchema.properties.description
                    .default}
              </Dialog.Description>
              <div className={styles.content}>
                <PortalContext.Provider value={nestedBoundary}>
                  {input.slots.content}
                </PortalContext.Provider>
              </div>
              <Dialog.Close
                className={styles.close}
                style={partStyle(input.style, "close", states)}
              >
                {props.closeLabel ??
                  starterDialogComponentRegistration.manifest.propsSchema.properties.closeLabel
                    .default}
              </Dialog.Close>
              <div
                ref={setNestedContainer}
                className={styles.portals}
                data-desen-starter-portals=""
              />
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </Dialog.Root>
    </div>
  );
}

/**
 * Exact static production/authoring adapter inventory. Select option/default edits intentionally
 * remount its local native selection; ordinary label/style changes preserve instance identity.
 */
export const STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT = Object.freeze({
  components: Object.freeze([
    Object.freeze({
      capabilityId: starterButtonComponentRegistration.id,
      component: StarterButtonReactAdapter,
    }),
    Object.freeze({
      capabilityId: starterSelectComponentRegistration.id,
      component: StarterSelectReactAdapter,
      remountOnProps: Object.freeze(["options", "defaultValue"]),
    }),
    Object.freeze({
      capabilityId: starterDialogComponentRegistration.id,
      component: StarterDialogReactAdapter,
    }),
  ]),
} satisfies RuntimeReactAdapterRegistryCreateInput);
