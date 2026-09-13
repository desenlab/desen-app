import {
  STARTER_BOX_CAPABILITY_ID,
  STARTER_BUTTON_CAPABILITY_ID,
  STARTER_CATALOG_ID,
  STARTER_CATALOG_TARGET,
  STARTER_CATALOG_VERSION,
  STARTER_CHECKBOX_CAPABILITY_ID,
  STARTER_RADIO_GROUP_CAPABILITY_ID,
  STARTER_SWITCH_CAPABILITY_ID,
  STARTER_TEXT_AREA_CAPABILITY_ID,
  STARTER_TEXT_FIELD_CAPABILITY_ID,
} from "@desen/starter-catalog-web";

import type { DesenSource } from "@desen/protocol";

/** Stable Source root identities retained only inside the bounded T06 browser proof envelope. */
export const T06_PROOF_ROOT_IDS = Object.freeze({
  button: "t06.button.root",
  form: "t06.form.root",
});

/** Stable child identities used to observe declared form events without exposing private adapter DOM. */
export const T06_PROOF_NODE_IDS = Object.freeze({
  checkbox: "t06.form.checkbox",
  radioGroup: "t06.form.radio-group",
  switch: "t06.form.switch",
  textArea: "t06.form.text-area",
  textField: "t06.form.text-field",
});

/** Exact fixed Sources intentionally admitted by the isolated M10A-T06 browser harness. */
export interface StarterT06ProofSources {
  readonly buttonDisabled: DesenSource;
  readonly buttonLoading: DesenSource;
  readonly form: DesenSource;
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
  state: DesenSource["surfaces"][string]["state"] = {},
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
      canvas: { [surfaceId]: { x: 0, y: 0, width: 640, height: 760 } },
    },
    extensions: {},
  };
}

function buttonNode(loading: boolean): DesenSource["surfaces"][string]["root"] {
  return {
    id: T06_PROOF_ROOT_IDS.button,
    use: STARTER_BUTTON_CAPABILITY_ID,
    props: loading
      ? { label: "Publishing form controls…", disabled: false, loading: true }
      : { label: "Unavailable action", disabled: true, loading: false },
    style: {
      base: {
        root: loading
          ? { backgroundColor: "#111111", borderRadius: 14, padding: 14 }
          : { backgroundColor: "#E8E8E5", borderRadius: 14, padding: 14 },
        label: loading ? { color: "#FFFFFF", fontSize: 15 } : { color: "#555555" },
      },
    },
  };
}

function formNode(): DesenSource["surfaces"][string]["root"] {
  return {
    id: T06_PROOF_ROOT_IDS.form,
    use: STARTER_BOX_CAPABILITY_ID,
    props: { dir: "ltr" },
    style: {
      base: {
        root: {
          backgroundColor: "#FFFFFF",
          borderColor: "#E5E5E5",
          borderWidth: 1,
          borderRadius: 16,
          paddingBlock: 20,
          paddingInline: 20,
          width: "fill",
        },
      },
    },
    slots: {
      default: [
        {
          id: T06_PROOF_NODE_IDS.textField,
          use: STARTER_TEXT_FIELD_CAPABILITY_ID,
          props: {
            label: "Project name",
            value: { $ref: "state.projectName" },
            placeholder: "Spring collection",
            helpText: "Used in the project overview.",
            disabled: false,
            required: true,
          },
          on: {
            change: [{ type: "state.set", path: "projectName", value: { $ref: "event.value" } }],
          },
          style: {
            base: {
              root: { marginBlock: 8 },
              label: { color: "#171717", fontWeight: 600 },
              control: {
                borderColor: "#171717",
                borderRadius: 8,
                borderWidth: 1,
                paddingBlock: 8,
                paddingInline: 10,
              },
            },
          },
        },
        {
          id: T06_PROOF_NODE_IDS.textArea,
          use: STARTER_TEXT_AREA_CAPABILITY_ID,
          props: {
            label: "Project summary",
            value: { $ref: "state.projectSummary" },
            placeholder: "Describe the work",
            error: "Add a clear project summary.",
            disabled: false,
            required: true,
            rows: 3,
          },
          on: {
            change: [{ type: "state.set", path: "projectSummary", value: { $ref: "event.value" } }],
          },
          style: {
            base: {
              root: { marginBlock: 8 },
              label: { color: "#171717", fontWeight: 600 },
              control: {
                borderColor: "#9F1239",
                borderRadius: 8,
                borderWidth: 1,
                paddingBlock: 8,
                paddingInline: 10,
              },
              error: { color: "#9F1239", fontWeight: 500 },
            },
          },
        },
        {
          id: T06_PROOF_NODE_IDS.checkbox,
          use: STARTER_CHECKBOX_CAPABILITY_ID,
          props: {
            label: "Receive design updates",
            checked: { $ref: "state.receiveUpdates" },
            helpText: "Only product and workflow updates are sent.",
            disabled: false,
            required: false,
          },
          on: {
            change: [
              { type: "state.set", path: "receiveUpdates", value: { $ref: "event.checked" } },
            ],
          },
          style: {
            base: {
              root: { marginBlock: 8 },
              label: { color: "#171717", fontWeight: 500 },
              control: { borderColor: "#171717", borderRadius: 4, borderWidth: 1 },
              indicator: { color: "#FFFFFF", backgroundColor: "#171717" },
            },
          },
        },
        {
          id: T06_PROOF_NODE_IDS.radioGroup,
          use: STARTER_RADIO_GROUP_CAPABILITY_ID,
          props: {
            label: "Publishing plan",
            options: [
              { value: "starter", label: "Starter", disabled: false },
              { value: "team", label: "Team", disabled: false },
              { value: "enterprise", label: "Enterprise", disabled: true },
            ],
            value: { $ref: "state.plan" },
            helpText: "Choose the scope to prepare.",
            error: "Choose an admitted publishing plan.",
            disabled: false,
            required: true,
          },
          on: {
            change: [{ type: "state.set", path: "plan", value: { $ref: "event.value" } }],
          },
          style: {
            base: {
              root: { marginBlock: 8 },
              label: { color: "#171717", fontWeight: 600 },
              control: { borderColor: "#171717", borderRadius: 8, borderWidth: 1 },
              option: { marginInline: 4 },
              optionLabel: { color: "#262626" },
              indicator: { backgroundColor: "#171717" },
            },
            selected: { control: { backgroundColor: "#F3F3F1" } },
            required: { option: { borderWidth: 2 } },
            invalid: { optionLabel: { color: "#9F1239" } },
            hover: { option: { marginInline: 12 } },
            focus: { optionLabel: { fontWeight: 700 } },
          },
        },
        {
          id: T06_PROOF_NODE_IDS.switch,
          use: STARTER_SWITCH_CAPABILITY_ID,
          props: {
            label: "Enable review notifications",
            checked: { $ref: "state.reviewNotifications" },
            helpText: "A notification is prepared when the review state changes.",
            disabled: false,
            required: false,
          },
          on: {
            change: [
              {
                type: "state.set",
                path: "reviewNotifications",
                value: { $ref: "event.checked" },
              },
            ],
          },
          style: {
            base: {
              root: { marginBlock: 8 },
              label: { color: "#171717", fontWeight: 500 },
              control: { borderColor: "#171717", borderRadius: 64, borderWidth: 1 },
              track: { backgroundColor: "#D4D4D0" },
              thumb: { backgroundColor: "#FFFFFF", borderColor: "#171717", borderWidth: 1 },
            },
          },
        },
      ],
    },
  } satisfies DesenSource["surfaces"][string]["root"];
}

/** Builds detached fixed Sources that exercise every M10A-T06 form capability in one surface. */
export function createStarterT06ProofSources(): StarterT06ProofSources {
  return Object.freeze({
    buttonDisabled: sourceDocument("run.desen.proof.m10a-t06-button", "button", buttonNode(false)),
    buttonLoading: sourceDocument("run.desen.proof.m10a-t06-button", "button", buttonNode(true)),
    form: sourceDocument("run.desen.proof.m10a-t06-form", "form", formNode(), {
      plan: { schema: { type: "string" }, initial: "starter" },
      projectName: { schema: { type: "string" }, initial: "" },
      projectSummary: { schema: { type: "string" }, initial: "" },
      receiveUpdates: { schema: { type: "boolean" }, initial: false },
      reviewNotifications: { schema: { type: "boolean" }, initial: false },
    }),
  });
}
