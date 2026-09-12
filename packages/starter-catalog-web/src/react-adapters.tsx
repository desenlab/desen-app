import { createContext, useContext, useId, useMemo, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Select } from "@base-ui/react/select";
import { Dialog } from "@base-ui/react/dialog";
import { canonicalizeJson } from "@desen/protocol";

import {
  STARTER_BOX_CAPABILITY_ID,
  STARTER_GRID_CAPABILITY_ID,
  STARTER_HEADING_CAPABILITY_ID,
  STARTER_ICON_CAPABILITY_ID,
  STARTER_IMAGE_CAPABILITY_ID,
  STARTER_SEPARATOR_CAPABILITY_ID,
  STARTER_STACK_CAPABILITY_ID,
  STARTER_TEXT_CAPABILITY_ID,
  starterButtonComponentRegistration,
  starterBoxComponentRegistration,
  starterSelectComponentRegistration,
  starterDialogComponentRegistration,
  starterGridComponentRegistration,
  starterHeadingComponentRegistration,
  starterIconComponentRegistration,
  starterImageComponentRegistration,
  starterSeparatorComponentRegistration,
  starterStackComponentRegistration,
  starterTextComponentRegistration,
} from "./contracts.js";
import styles from "./neutral.module.css";

import type { CSSProperties, ReactNode } from "react";
import type {
  RuntimeReactAdapterRegistryCreateInput,
  RuntimeReactComponentAdapterProps,
  RuntimeReactSemanticStyle,
} from "@desen/runtime-react";
import type {
  StarterBoxProps,
  StarterButtonProps,
  StarterDialogProps,
  StarterGridProps,
  StarterHeadingProps,
  StarterIconProps,
  StarterImageProps,
  StarterSelectProps,
  StarterSeparatorProps,
  StarterStackProps,
  StarterTextProps,
} from "./contracts.js";

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
  | typeof starterDialogComponentRegistration
  | typeof starterBoxComponentRegistration
  | typeof starterStackComponentRegistration
  | typeof starterGridComponentRegistration
  | typeof starterTextComponentRegistration
  | typeof starterHeadingComponentRegistration
  | typeof starterImageComponentRegistration
  | typeof starterIconComponentRegistration
  | typeof starterSeparatorComponentRegistration;

type T05StyleProjection = "image" | "layout" | "typography" | "media" | "separator";

const T01_STYLE_PROPERTIES = Object.freeze([
  "color",
  "backgroundColor",
  "borderColor",
  "borderRadius",
  "padding",
  "fontSize",
] as const);
const LAYOUT_STYLE_PROPERTIES = Object.freeze([
  "color",
  "backgroundColor",
  "borderColor",
  "borderRadius",
  "borderWidth",
  "paddingBlock",
  "paddingInline",
  "marginBlock",
  "marginInline",
  "gap",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "overflow",
  "alignItems",
  "alignSelf",
  "justifyContent",
  "textAlign",
  "opacity",
] as const);
const TYPOGRAPHY_STYLE_PROPERTIES = Object.freeze([
  "color",
  "backgroundColor",
  "borderColor",
  "borderRadius",
  "borderWidth",
  "paddingBlock",
  "paddingInline",
  "marginBlock",
  "marginInline",
  "width",
  "minWidth",
  "maxWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecoration",
  "opacity",
] as const);
const MEDIA_STYLE_PROPERTIES = Object.freeze([
  "color",
  "backgroundColor",
  "borderColor",
  "borderRadius",
  "borderWidth",
  "paddingBlock",
  "paddingInline",
  "marginBlock",
  "marginInline",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "opacity",
] as const);
const IMAGE_STYLE_PROPERTIES = Object.freeze(
  MEDIA_STYLE_PROPERTIES.filter((property) => property !== "color"),
);
const SEPARATOR_STYLE_PROPERTIES = Object.freeze([
  "backgroundColor",
  "borderRadius",
  "marginBlock",
  "marginInline",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "opacity",
] as const);

function t05StyleProjection(registration: Registration): T05StyleProjection | undefined {
  if (
    registration.id === STARTER_BOX_CAPABILITY_ID ||
    registration.id === STARTER_STACK_CAPABILITY_ID ||
    registration.id === STARTER_GRID_CAPABILITY_ID
  ) {
    return "layout";
  }
  if (
    registration.id === STARTER_TEXT_CAPABILITY_ID ||
    registration.id === STARTER_HEADING_CAPABILITY_ID
  ) {
    return "typography";
  }
  if (registration.id === STARTER_IMAGE_CAPABILITY_ID) return "image";
  if (registration.id === STARTER_ICON_CAPABILITY_ID) return "media";
  if (registration.id === STARTER_SEPARATOR_CAPABILITY_ID) return "separator";
  return undefined;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/u.test(value);
}

function isFiniteNumber(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
  );
}

function isLayoutDimension(value: unknown): boolean {
  return isFiniteNumber(value, 0, 4_096) || value === "fill" || value === "hug";
}

function isT05StyleValueValid(
  projection: T05StyleProjection,
  property: string,
  value: unknown,
): boolean {
  if (["color", "backgroundColor", "borderColor"].includes(property)) return isHexColor(value);
  if (["borderRadius"].includes(property)) return isFiniteNumber(value, 0, 64);
  if (["borderWidth"].includes(property)) return isFiniteNumber(value, 0, 16);
  if (["paddingBlock", "paddingInline", "marginBlock", "marginInline", "gap"].includes(property)) {
    return isFiniteNumber(value, 0, 512);
  }
  if (["width", "height"].includes(property)) return isLayoutDimension(value);
  if (["minWidth", "maxWidth", "minHeight", "maxHeight"].includes(property))
    return isFiniteNumber(value, 0, 4_096);
  if (property === "opacity") return isFiniteNumber(value, 0, 1);
  if (property === "fontSize") return isFiniteNumber(value, 8, 96);
  if (property === "fontWeight") return [400, 500, 600, 700].includes(value as number);
  if (property === "lineHeight") return isFiniteNumber(value, 1, 3);
  if (property === "letterSpacing") return isFiniteNumber(value, -4, 16);
  if (property === "fontFamily") return ["system", "serif", "mono"].includes(value as string);
  if (property === "textDecoration")
    return ["none", "underline", "line-through"].includes(value as string);
  if (property === "textAlign") return ["start", "center", "end"].includes(value as string);
  if (projection === "layout" && property === "overflow")
    return ["visible", "hidden", "auto"].includes(value as string);
  if (projection === "layout" && property === "alignItems")
    return ["start", "center", "end", "stretch"].includes(value as string);
  if (projection === "layout" && property === "alignSelf")
    return ["auto", "start", "center", "end", "stretch"].includes(value as string);
  if (projection === "layout" && property === "justifyContent")
    return ["start", "center", "end", "between", "around", "evenly"].includes(value as string);
  return false;
}

function stylePropertyNames(projection: T05StyleProjection | undefined): readonly string[] {
  if (projection === "layout") return LAYOUT_STYLE_PROPERTIES;
  if (projection === "typography") return TYPOGRAPHY_STYLE_PROPERTIES;
  if (projection === "image") return IMAGE_STYLE_PROPERTIES;
  if (projection === "media") return MEDIA_STYLE_PROPERTIES;
  if (projection === "separator") return SEPARATOR_STYLE_PROPERTIES;
  return T01_STYLE_PROPERTIES;
}

function validateT05Props(
  input: RuntimeReactComponentAdapterProps,
  registration: Registration,
): void {
  const props = input.props as Readonly<Record<string, unknown>>;
  const invalid = () => {
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  };
  const hasOnly = (keys: readonly string[]) =>
    Object.keys(props).every((key) => keys.includes(key));
  const isDirection = (value: unknown) => value === "ltr" || value === "rtl";

  if (registration.id === STARTER_BOX_CAPABILITY_ID) {
    if (!hasOnly(["dir"]) || (props.dir !== undefined && !isDirection(props.dir))) invalid();
    return;
  }
  if (registration.id === STARTER_STACK_CAPABILITY_ID) {
    if (
      !hasOnly(["direction", "wrap", "dir"]) ||
      (props.direction !== undefined &&
        !["vertical", "horizontal"].includes(props.direction as string)) ||
      (props.wrap !== undefined && typeof props.wrap !== "boolean") ||
      (props.dir !== undefined && !isDirection(props.dir))
    ) {
      invalid();
    }
    return;
  }
  if (registration.id === STARTER_GRID_CAPABILITY_ID) {
    if (
      !hasOnly(["columns", "flow", "dir"]) ||
      (props.columns !== undefined &&
        (!Number.isInteger(props.columns) || !isFiniteNumber(props.columns, 1, 12))) ||
      (props.flow !== undefined && !["row", "column"].includes(props.flow as string)) ||
      (props.dir !== undefined && !isDirection(props.dir))
    ) {
      invalid();
    }
    return;
  }
  if (registration.id === STARTER_TEXT_CAPABILITY_ID) {
    if (
      !hasOnly(["text"]) ||
      typeof props.text !== "string" ||
      props.text.length < 1 ||
      props.text.length > 4_096
    )
      invalid();
    return;
  }
  if (registration.id === STARTER_HEADING_CAPABILITY_ID) {
    if (
      !hasOnly(["text", "level"]) ||
      typeof props.text !== "string" ||
      props.text.length < 1 ||
      props.text.length > 256 ||
      (props.level !== undefined &&
        (!Number.isInteger(props.level) || !isFiniteNumber(props.level, 1, 6)))
    ) {
      invalid();
    }
    return;
  }
  if (registration.id === STARTER_IMAGE_CAPABILITY_ID) {
    if (
      !hasOnly(["source", "alt", "fit"]) ||
      !["neutral-horizon", "neutral-grid"].includes(props.source as string) ||
      typeof props.alt !== "string" ||
      props.alt.length < 1 ||
      props.alt.length > 256 ||
      (props.fit !== undefined && !["cover", "contain"].includes(props.fit as string))
    ) {
      invalid();
    }
    return;
  }
  if (registration.id === STARTER_ICON_CAPABILITY_ID) {
    if (
      !hasOnly(["name", "label", "decorative"]) ||
      !["arrow-right", "check", "close", "info", "menu", "plus", "search"].includes(
        props.name as string,
      ) ||
      typeof props.label !== "string" ||
      props.label.length < 1 ||
      props.label.length > 128 ||
      (props.decorative !== undefined && typeof props.decorative !== "boolean")
    ) {
      invalid();
    }
    return;
  }
  if (registration.id === STARTER_SEPARATOR_CAPABILITY_ID) {
    if (
      !hasOnly(["orientation"]) ||
      (props.orientation !== undefined &&
        !["horizontal", "vertical"].includes(props.orientation as string))
    ) {
      invalid();
    }
  }
}

function guardInput(input: RuntimeReactComponentAdapterProps, registration: Registration): void {
  // Runtime React is the schema-admission authority. This defensive check prevents direct trusted
  // misuse from widening the bridge to callbacks, JSX, unknown parts or arbitrary Base UI props.
  if (input.identity.capabilityId !== registration.id)
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  try {
    canonicalizeJson(input.props);
  } catch {
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  }
  const allowedProps = Object.keys(registration.manifest.propsSchema.properties);
  if (Object.keys(input.props).some((key) => !allowedProps.includes(key)))
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  const allowedSlots =
    registration.id === starterDialogComponentRegistration.id
      ? ["content"]
      : t05StyleProjection(registration) === "layout"
        ? ["default"]
        : [];
  if (Object.keys(input.slots).some((key) => !allowedSlots.includes(key)))
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  if (
    registration.id === starterDialogComponentRegistration.id &&
    (input.slots.content === undefined ||
      input.slots.content.length < 1 ||
      input.slots.content.length > 16)
  )
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  if (
    t05StyleProjection(registration) === "layout" &&
    (input.slots.default === undefined ||
      input.slots.default.length < 1 ||
      input.slots.default.length > 100)
  ) {
    throw new Error("STARTER_ADAPTER_INPUT_INVALID");
  }
  validateT05Props(input, registration);
  const parts = Object.keys(registration.manifest.styleParts);
  const states: readonly string[] =
    "visualStates" in registration.manifest ? registration.manifest.visualStates : [];
  const projection = t05StyleProjection(registration);
  const propertyNames = stylePropertyNames(projection);
  for (const [state, stateParts] of Object.entries(input.style)) {
    if (state !== "base" && !states.includes(state))
      throw new Error("STARTER_ADAPTER_INPUT_INVALID");
    for (const [part, values] of Object.entries(stateParts)) {
      if (!parts.includes(part)) throw new Error("STARTER_ADAPTER_INPUT_INVALID");
      for (const [property, value] of Object.entries(values)) {
        const valid =
          propertyNames.includes(property) &&
          (projection === undefined
            ? ["color", "backgroundColor", "borderColor"].includes(property)
              ? isHexColor(value)
              : typeof value === "number" &&
                Number.isFinite(value) &&
                ((property === "borderRadius" && value >= 0 && value <= 64) ||
                  (property === "padding" && value >= 0 && value <= 128) ||
                  (property === "fontSize" && value >= 8 && value <= 96))
            : isT05StyleValueValid(projection, property, value));
        if (!valid) throw new Error("STARTER_ADAPTER_INPUT_INVALID");
      }
    }
  }
}

function partStyle(
  style: RuntimeReactSemanticStyle,
  part: string,
  states: readonly string[] = [],
  projection: T05StyleProjection | undefined = undefined,
): CSSProperties {
  const result: CSSProperties = {};
  for (const state of ["base", ...states]) {
    const values = style[state]?.[part];
    if (values === undefined) continue;
    // No property name supplied by a document becomes a CSS property through generic spreading.
    if (projection !== "image" && typeof values.color === "string") result.color = values.color;
    if (typeof values.backgroundColor === "string") result.backgroundColor = values.backgroundColor;
    if (typeof values.borderColor === "string") result.borderColor = values.borderColor;
    if (
      projection !== undefined &&
      (typeof values.borderColor === "string" || typeof values.borderWidth === "number")
    ) {
      result.borderStyle = "solid";
    }
    if (typeof values.borderRadius === "number") result.borderRadius = values.borderRadius;
    if (typeof values.padding === "number") result.padding = values.padding;
    if (typeof values.fontSize === "number") result.fontSize = values.fontSize;
    if (projection === undefined) continue;
    if (typeof values.borderWidth === "number") result.borderWidth = values.borderWidth;
    if (typeof values.paddingBlock === "number") result.paddingBlock = values.paddingBlock;
    if (typeof values.paddingInline === "number") result.paddingInline = values.paddingInline;
    if (typeof values.marginBlock === "number") result.marginBlock = values.marginBlock;
    if (typeof values.marginInline === "number") result.marginInline = values.marginInline;
    if (typeof values.gap === "number") result.gap = values.gap;
    if (typeof values.width === "number") result.width = values.width;
    if (values.width === "fill") result.width = "100%";
    if (values.width === "hug") result.width = "fit-content";
    if (typeof values.height === "number") result.height = values.height;
    if (values.height === "fill") result.height = "100%";
    if (values.height === "hug") result.height = "fit-content";
    if (typeof values.minWidth === "number") result.minWidth = values.minWidth;
    if (typeof values.maxWidth === "number") result.maxWidth = values.maxWidth;
    if (typeof values.minHeight === "number") result.minHeight = values.minHeight;
    if (typeof values.maxHeight === "number") result.maxHeight = values.maxHeight;
    if (typeof values.opacity === "number") result.opacity = values.opacity;
    if (projection === "layout") {
      if (
        values.overflow === "visible" ||
        values.overflow === "hidden" ||
        values.overflow === "auto"
      )
        result.overflow = values.overflow;
      if (values.alignItems === "start") result.alignItems = "flex-start";
      if (values.alignItems === "center") result.alignItems = "center";
      if (values.alignItems === "end") result.alignItems = "flex-end";
      if (values.alignItems === "stretch") result.alignItems = "stretch";
      if (values.alignSelf === "auto") result.alignSelf = "auto";
      if (values.alignSelf === "start") result.alignSelf = "flex-start";
      if (values.alignSelf === "center") result.alignSelf = "center";
      if (values.alignSelf === "end") result.alignSelf = "flex-end";
      if (values.alignSelf === "stretch") result.alignSelf = "stretch";
      if (values.justifyContent === "start") result.justifyContent = "flex-start";
      if (values.justifyContent === "center") result.justifyContent = "center";
      if (values.justifyContent === "end") result.justifyContent = "flex-end";
      if (values.justifyContent === "between") result.justifyContent = "space-between";
      if (values.justifyContent === "around") result.justifyContent = "space-around";
      if (values.justifyContent === "evenly") result.justifyContent = "space-evenly";
    }
    if (values.textAlign === "start" || values.textAlign === "center" || values.textAlign === "end")
      result.textAlign = values.textAlign;
    if (projection === "typography") {
      if (values.fontFamily === "system") result.fontFamily = "system-ui, sans-serif";
      if (values.fontFamily === "serif") result.fontFamily = "ui-serif, Georgia, serif";
      if (values.fontFamily === "mono") result.fontFamily = "ui-monospace, monospace";
      if (
        values.fontWeight === 400 ||
        values.fontWeight === 500 ||
        values.fontWeight === 600 ||
        values.fontWeight === 700
      )
        result.fontWeight = values.fontWeight;
      if (typeof values.lineHeight === "number") result.lineHeight = values.lineHeight;
      if (typeof values.letterSpacing === "number") result.letterSpacing = values.letterSpacing;
      if (
        values.textDecoration === "none" ||
        values.textDecoration === "underline" ||
        values.textDecoration === "line-through"
      ) {
        result.textDecoration = values.textDecoration;
      }
    }
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

/** Renders one semantic Box with only its declared logical layout contract. */
export function StarterBoxReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterBoxComponentRegistration);
  const props = input.props as unknown as StarterBoxProps;
  return (
    <div
      className={styles.box}
      dir={props.dir ?? "ltr"}
      style={partStyle(input.style, "root", [], "layout")}
    >
      {input.slots.default}
    </div>
  );
}

/** Renders a semantic logical flex Stack without inspecting or rewriting its managed children. */
export function StarterStackReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterStackComponentRegistration);
  const props = input.props as unknown as StarterStackProps;
  return (
    <div
      className={styles.stack}
      dir={props.dir ?? "ltr"}
      style={{
        display: "flex",
        flexDirection: props.direction === "horizontal" ? "row" : "column",
        flexWrap: props.wrap === true ? "wrap" : "nowrap",
        ...partStyle(input.style, "root", [], "layout"),
      }}
    >
      {input.slots.default}
    </div>
  );
}

/** Renders a finite-column semantic Grid with browser-native normal-flow placement. */
export function StarterGridReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterGridComponentRegistration);
  const props = input.props as unknown as StarterGridProps;
  const columns = props.columns ?? 2;
  const flow = props.flow ?? "row";
  const rows =
    flow === "column" ? Math.ceil((input.slots.default?.length ?? 0) / columns) : undefined;
  return (
    <div
      className={styles.grid}
      dir={props.dir ?? "ltr"}
      style={{
        display: "grid",
        gridAutoFlow: flow,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        ...(rows === undefined ? {} : { gridTemplateRows: `repeat(${rows}, minmax(0, auto))` }),
        ...partStyle(input.style, "root", [], "layout"),
      }}
    >
      {input.slots.default}
    </div>
  );
}

/** Renders inert paragraph text as a native `<p>` with no HTML parsing path. */
export function StarterTextReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterTextComponentRegistration);
  const props = input.props as unknown as StarterTextProps;
  return (
    <p className={styles.text} style={partStyle(input.style, "root", [], "typography")}>
      {props.text}
    </p>
  );
}

/** Renders an inert bounded heading level as its matching native HTML heading. */
export function StarterHeadingReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterHeadingComponentRegistration);
  const props = input.props as unknown as StarterHeadingProps;
  const level = props.level ?? 2;
  const Element = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return (
    <Element className={styles.heading} style={partStyle(input.style, "root", [], "typography")}>
      {props.text}
    </Element>
  );
}

const BUILT_IN_IMAGE_SOURCES = Object.freeze({
  "neutral-horizon":
    "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%20640%20360%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27a%27%20x1%3D%270%27%20y1%3D%270%27%20x2%3D%271%27%20y2%3D%271%27%3E%3Cstop%20stop-color%3D%27%23171717%27%2F%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%23525252%27%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%27640%27%20height%3D%27360%27%20fill%3D%27url(%23a)%27%2F%3E%3Ccircle%20cx%3D%27470%27%20cy%3D%27105%27%20r%3D%2745%27%20fill%3D%27%23fafafa%27%20fill-opacity%3D%27.65%27%2F%3E%3Cpath%20d%3D%27M0%20260%20190%20145%20335%20255%20470%20155%20640%20245V360H0Z%27%20fill%3D%27%23fafafa%27%20fill-opacity%3D%27.24%27%2F%3E%3C%2Fsvg%3E",
  "neutral-grid":
    "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%20640%20360%27%3E%3Crect%20width%3D%27640%27%20height%3D%27360%27%20fill%3D%27%23f4f4f3%27%2F%3E%3Cpath%20d%3D%27M0%2072H640M0%20144H640M0%20216H640M0%20288H640M128%200V360M256%200V360M384%200V360M512%200V360%27%20stroke%3D%27%23d4d4d0%27%20stroke-width%3D%272%27%2F%3E%3Ccircle%20cx%3D%27320%27%20cy%3D%27180%27%20r%3D%2780%27%20fill%3D%27%23171717%27%20fill-opacity%3D%27.1%27%2F%3E%3C%2Fsvg%3E",
} as const);

/** Renders only a closed, trusted in-package image source and an explicit text alternative. */
export function StarterImageReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterImageComponentRegistration);
  const props = input.props as unknown as StarterImageProps;
  return (
    <img
      className={styles.image}
      src={BUILT_IN_IMAGE_SOURCES[props.source]}
      alt={props.alt}
      style={{
        objectFit: props.fit ?? "cover",
        ...partStyle(input.style, "root", [], "image"),
      }}
    />
  );
}

const BUILT_IN_ICON_PATHS = Object.freeze({
  "arrow-right": Object.freeze(["M4 12h16M13 5l7 7-7 7"]),
  check: Object.freeze(["m5 12 4.5 4.5L19 7"]),
  close: Object.freeze(["m6 6 12 12M18 6 6 18"]),
  info: Object.freeze(["M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"]),
  menu: Object.freeze(["M4 7h16M4 12h16M4 17h16"]),
  plus: Object.freeze(["M12 5v14M5 12h14"]),
  search: Object.freeze(["m20 20-4.4-4.4M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"]),
} as const);

/** Renders a reviewed icon path, never document-supplied SVG, markup, or selector data. */
export function StarterIconReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterIconComponentRegistration);
  const props = input.props as unknown as StarterIconProps;
  const decorative = props.decorative === true;
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : props.label}
      style={partStyle(input.style, "root", [], "media")}
    >
      {BUILT_IN_ICON_PATHS[props.name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

/** Renders a native horizontal rule or an explicitly oriented vertical semantic separator. */
export function StarterSeparatorReactAdapter(input: RuntimeReactComponentAdapterProps) {
  guardInput(input, starterSeparatorComponentRegistration);
  const props = input.props as unknown as StarterSeparatorProps;
  const style = partStyle(input.style, "root", [], "separator");
  if ((props.orientation ?? "horizontal") === "vertical") {
    return (
      <div
        className={styles.separatorVertical}
        role="separator"
        aria-orientation="vertical"
        style={style}
      />
    );
  }
  return <hr className={styles.separator} style={style} />;
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
    Object.freeze({
      capabilityId: starterBoxComponentRegistration.id,
      component: StarterBoxReactAdapter,
    }),
    Object.freeze({
      capabilityId: starterStackComponentRegistration.id,
      component: StarterStackReactAdapter,
    }),
    Object.freeze({
      capabilityId: starterGridComponentRegistration.id,
      component: StarterGridReactAdapter,
    }),
    Object.freeze({
      capabilityId: starterTextComponentRegistration.id,
      component: StarterTextReactAdapter,
    }),
    Object.freeze({
      capabilityId: starterHeadingComponentRegistration.id,
      component: StarterHeadingReactAdapter,
    }),
    Object.freeze({
      capabilityId: starterImageComponentRegistration.id,
      component: StarterImageReactAdapter,
    }),
    Object.freeze({
      capabilityId: starterIconComponentRegistration.id,
      component: StarterIconReactAdapter,
    }),
    Object.freeze({
      capabilityId: starterSeparatorComponentRegistration.id,
      component: StarterSeparatorReactAdapter,
    }),
  ]),
} satisfies RuntimeReactAdapterRegistryCreateInput);
