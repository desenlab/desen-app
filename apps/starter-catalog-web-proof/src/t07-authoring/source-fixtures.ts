import {
  STARTER_COMBOBOX_CAPABILITY_ID,
  STARTER_NUMBER_FIELD_CAPABILITY_ID,
  STARTER_SELECT_CAPABILITY_ID,
  STARTER_SLIDER_CAPABILITY_ID,
  STARTER_STACK_CAPABILITY_ID,
  STARTER_TABS_CAPABILITY_ID,
  STARTER_TEXT_CAPABILITY_ID,
  STARTER_CATALOG_ID,
  STARTER_CATALOG_TARGET,
  STARTER_CATALOG_VERSION,
} from "@desen/starter-catalog-web";

import type { DesenSource } from "@desen/protocol";

/** Stable Source root identity retained only inside the bounded T07 browser proof envelope. */
export const T07_PROOF_ROOT_IDS = Object.freeze({ selectionNumeric: "t07.selection-numeric.root" });

/** Stable child identities used to observe admitted T07 events without private adapter DOM access. */
export const T07_PROOF_NODE_IDS = Object.freeze({
  select: "t07.selection-numeric.select",
  combobox: "t07.selection-numeric.combobox",
  tabs: "t07.selection-numeric.tabs",
  slider: "t07.selection-numeric.slider",
  numberField: "t07.selection-numeric.number-field",
});

/** Exact fixed Source intentionally admitted by the isolated M10A-T07 browser harness. */
export interface StarterT07ProofSources {
  readonly selectionNumeric: DesenSource;
}

const catalogRequirement = Object.freeze({
  id: STARTER_CATALOG_ID,
  version: STARTER_CATALOG_VERSION,
  target: STARTER_CATALOG_TARGET,
});

function sourceDocument(
  id: string,
  surfaceId: string,
  root: DesenSource["surfaces"][string]["root"],
  state: DesenSource["surfaces"][string]["state"],
): DesenSource {
  return {
    kind: "desen.source",
    desen: "0.1.0",
    id,
    catalogs: [catalogRequirement],
    entry: surfaceId,
    surfaces: {
      [surfaceId]: {
        id: surfaceId,
        state,
        resources: {},
        root,
      },
    },
    authoring: {
      canvas: { [surfaceId]: { x: 0, y: 0, width: 720, height: 1_020 } },
    },
    extensions: {},
  };
}

function selectionNumericRoot(): DesenSource["surfaces"][string]["root"] {
  return {
    id: T07_PROOF_ROOT_IDS.selectionNumeric,
    use: STARTER_STACK_CAPABILITY_ID,
    props: { direction: "vertical", wrap: false, dir: "ltr" },
    style: {
      base: {
        root: {
          backgroundColor: "#FFFFFF",
          borderColor: "#D7D7D2",
          borderRadius: 16,
          borderWidth: 1,
          gap: 18,
          paddingBlock: 20,
          paddingInline: 20,
          width: "fill",
        },
      },
    },
    slots: {
      default: [
        {
          id: T07_PROOF_NODE_IDS.select,
          use: STARTER_SELECT_CAPABILITY_ID,
          props: {
            label: "Release channel",
            // Deliberately preserves T01's public spelling through Publisher into the host graph.
            options: [
              { value: "alpha", label: "Alpha", disabled: false },
              { value: "stable", label: "Stable", disabled: false },
              { value: "sunset", label: "Sunset", disabled: true },
            ],
            value: { $ref: "state.releaseChannel" },
            disabled: false,
          },
          on: {
            change: [
              {
                type: "state.set",
                path: "releaseChannel",
                value: { $ref: "event.value" },
              },
            ],
          },
        },
        {
          id: T07_PROOF_NODE_IDS.combobox,
          use: STARTER_COMBOBOX_CAPABILITY_ID,
          props: {
            label: "Find a region",
            options: [
              { id: "north", label: "Northern region", disabled: false },
              { id: "south", label: "Southern region", disabled: false },
              { id: "archive", label: "Archived region", disabled: true },
            ],
            value: { $ref: "state.region" },
            placeholder: "Search regions",
            filterMode: "contains",
            disabled: false,
          },
          on: {
            change: [{ type: "state.set", path: "region", value: { $ref: "event.value" } }],
          },
        },
        {
          id: T07_PROOF_NODE_IDS.tabs,
          use: STARTER_TABS_CAPABILITY_ID,
          props: {
            label: "Design sections",
            tabs: [
              { id: "overview", label: "Overview", disabled: false },
              { id: "details", label: "Details", disabled: false },
              { id: "locked", label: "Locked", disabled: true },
            ],
            value: { $ref: "state.section" },
            disabled: false,
            orientation: "horizontal",
          },
          on: {
            change: [{ type: "state.set", path: "section", value: { $ref: "event.value" } }],
          },
          slots: {
            panels: [
              {
                id: "t07.selection-numeric.tabs.overview",
                use: STARTER_TEXT_CAPABILITY_ID,
                props: { text: "Overview panel is paired to the stable overview identity." },
              },
              {
                id: "t07.selection-numeric.tabs.details",
                use: STARTER_TEXT_CAPABILITY_ID,
                props: { text: "Details panel is paired to the stable details identity." },
              },
              {
                id: "t07.selection-numeric.tabs.locked",
                use: STARTER_TEXT_CAPABILITY_ID,
                props: { text: "Locked panel remains declared but cannot be selected." },
              },
            ],
          },
        },
        {
          id: T07_PROOF_NODE_IDS.slider,
          use: STARTER_SLIDER_CAPABILITY_ID,
          props: {
            label: "Opacity",
            value: { $ref: "state.opacity" },
            min: 0,
            max: 100,
            step: 1,
            helpText: "Choose a whole value between 0 and 100.",
            disabled: false,
          },
          on: {
            change: [{ type: "state.set", path: "opacity", value: { $ref: "event.value" } }],
          },
        },
        {
          id: T07_PROOF_NODE_IDS.numberField,
          use: STARTER_NUMBER_FIELD_CAPABILITY_ID,
          props: {
            label: "Columns",
            value: { $ref: "state.columns" },
            min: 1,
            max: 12,
            step: 1,
            helpText: "Choose a whole number from 1 to 12.",
            disabled: false,
          },
          on: {
            change: [{ type: "state.set", path: "columns", value: { $ref: "event.value" } }],
          },
        },
        {
          id: "t07.selection-numeric.empty-select",
          use: STARTER_SELECT_CAPABILITY_ID,
          props: { label: "No release channels", options: [], value: "", disabled: false },
        },
        {
          id: "t07.selection-numeric.disabled-combobox",
          use: STARTER_COMBOBOX_CAPABILITY_ID,
          props: {
            label: "Unavailable regions",
            options: [{ id: "north", label: "Northern region", disabled: false }],
            value: "north",
            placeholder: "Search regions",
            filterMode: "startsWith",
            disabled: true,
          },
        },
        {
          id: "t07.selection-numeric.disabled-slider",
          use: STARTER_SLIDER_CAPABILITY_ID,
          props: { label: "Locked opacity", value: 50, min: 0, max: 100, step: 1, disabled: true },
        },
      ],
    },
  } satisfies DesenSource["surfaces"][string]["root"];
}

/** Builds a detached fixed Source that exercises every M10A-T07 selection and numeric capability. */
export function createStarterT07ProofSources(): StarterT07ProofSources {
  return Object.freeze({
    selectionNumeric: sourceDocument(
      "run.desen.proof.m10a-t07-selection-numeric",
      "selectionNumeric",
      selectionNumericRoot(),
      {
        releaseChannel: { schema: { type: "string" }, initial: "alpha" },
        region: { schema: { type: "string" }, initial: "" },
        section: { schema: { type: "string" }, initial: "overview" },
        opacity: { schema: { type: "number" }, initial: 50 },
        columns: { schema: { type: "number" }, initial: 2 },
      },
    ),
  });
}
