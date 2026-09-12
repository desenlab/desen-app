import { createDesenEditorDocument, insertDesenEditorSubtree } from "@desen/editor-core";
import {
  STARTER_BUTTON_CAPABILITY_ID,
  STARTER_BOX_CAPABILITY_ID,
  STARTER_CATALOG_ID,
  STARTER_CATALOG_TARGET,
  STARTER_CATALOG_VERSION,
  STARTER_DIALOG_CAPABILITY_ID,
  STARTER_GRID_CAPABILITY_ID,
  STARTER_HEADING_CAPABILITY_ID,
  STARTER_ICON_CAPABILITY_ID,
  STARTER_IMAGE_CAPABILITY_ID,
  STARTER_SELECT_CAPABILITY_ID,
  STARTER_SEPARATOR_CAPABILITY_ID,
  STARTER_STACK_CAPABILITY_ID,
  STARTER_TEXT_CAPABILITY_ID,
  createStarterNodeTemplate,
} from "@desen/starter-catalog-web";

import type { DesenSource } from "@desen/protocol";
import type { DesenEditorDocument } from "@desen/editor-core";

export const PROOF_ROOT_IDS = Object.freeze({
  button: "button.root",
  select: "select.root",
  dialog: "dialog.root",
  layout: "layout.root",
});

export interface StarterProofSources {
  readonly buttonInitial: DesenSource;
  readonly buttonCompatible: DesenSource;
  readonly select: DesenSource;
  readonly dialog: DesenEditorDocument;
  readonly layout: DesenSource;
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
      canvas: { [surfaceId]: { x: 0, y: 0, width: 420, height: 480 } },
    },
    extensions: {},
  };
}

function buttonNode(compatible: boolean): DesenSource["surfaces"][string]["root"] {
  const template = createStarterNodeTemplate({
    capabilityId: STARTER_BUTTON_CAPABILITY_ID,
    idPrefix: PROOF_ROOT_IDS.button,
  });
  return {
    ...template,
    props: compatible
      ? { label: "Publishing starter…", disabled: false, loading: true }
      : { label: "Unavailable action", disabled: true, loading: false },
    style: {
      base: {
        root: compatible
          ? { backgroundColor: "#111111", borderRadius: 14, padding: 14 }
          : { backgroundColor: "#E8E8E5", borderRadius: 14, padding: 14 },
        label: compatible ? { color: "#FFFFFF", fontSize: 15 } : { color: "#555555" },
      },
    },
  };
}

function selectNode(
  idPrefix: string = PROOF_ROOT_IDS.select,
  label = "Release channel",
  handleChange = true,
) {
  const template = createStarterNodeTemplate({
    capabilityId: STARTER_SELECT_CAPABILITY_ID,
    idPrefix,
  });
  return {
    ...template,
    props: {
      label,
      options: [
        { value: "alpha", label: "Alpha", disabled: false },
        { value: "paused", label: "Paused", disabled: true },
        { value: "stable", label: "Stable", disabled: false },
      ],
      defaultValue: "alpha",
      disabled: false,
    },
    ...(handleChange
      ? {
          on: {
            change: [{ type: "state.set", path: "selection", value: { $ref: "event.value" } }],
          },
        }
      : {}),
  } satisfies DesenSource["surfaces"][string]["root"];
}

function dialogDocument(): DesenEditorDocument {
  const template = createStarterNodeTemplate({
    capabilityId: STARTER_DIALOG_CAPABILITY_ID,
    idPrefix: PROOF_ROOT_IDS.dialog,
  });
  const root = {
    ...template,
    props: {
      triggerLabel: "Review publication",
      title: "Starter publication",
      description: "This content is a managed DESEN slot.",
      closeLabel: "Close review",
      disabled: false,
    },
    on: {
      openChange: [{ type: "state.set", path: "open", value: { $ref: "event.open" } }],
    },
  } satisfies DesenSource["surfaces"][string]["root"];
  const source = sourceDocument("run.desen.proof.starter-dialog", "dialog", root, {
    open: { schema: { type: "boolean" }, initial: false },
  });
  const admitted = createDesenEditorDocument(source);
  if (!admitted.ok) throw new TypeError("Dialog proof Source failed Editor admission.");
  const insertedRequiredSubtree = insertDesenEditorSubtree(admitted.document, {
    surfaceId: "dialog",
    parentId: PROOF_ROOT_IDS.dialog,
    slot: "content",
    index: 1,
    subtree: createStarterNodeTemplate({
      capabilityId: STARTER_DIALOG_CAPABILITY_ID,
      idPrefix: "dialog.nested",
      reservedIds: [PROOF_ROOT_IDS.dialog, `${PROOF_ROOT_IDS.dialog}.content`],
    }),
  });
  if (!insertedRequiredSubtree.ok)
    throw new TypeError("Dialog required-slot subtree insertion failed atomically.");
  const insertedNestedSelect = insertDesenEditorSubtree(insertedRequiredSubtree.document, {
    surfaceId: "dialog",
    parentId: PROOF_ROOT_IDS.dialog,
    slot: "content",
    index: 2,
    subtree: selectNode("dialog.choice", "Dialog channel", false),
  });
  if (!insertedNestedSelect.ok)
    throw new TypeError("Dialog nested Select insertion failed atomically.");
  return insertedNestedSelect.document;
}

function layoutNode(): DesenSource["surfaces"][string]["root"] {
  return {
    id: PROOF_ROOT_IDS.layout,
    use: STARTER_BOX_CAPABILITY_ID,
    props: { dir: "rtl" },
    style: {
      base: {
        root: {
          backgroundColor: "#FFFFFF",
          borderColor: "#E5E5E5",
          borderWidth: 1,
          borderRadius: 12,
          paddingBlock: 24,
          paddingInline: 24,
          marginBlock: 8,
          width: "fill",
          maxWidth: 960,
          textAlign: "start",
        },
      },
    },
    slots: {
      default: [
        {
          id: "layout.stack",
          use: STARTER_STACK_CAPABILITY_ID,
          props: { direction: "vertical", wrap: false, dir: "rtl" },
          style: {
            base: {
              root: {
                gap: 16,
                justifyContent: "start",
                alignItems: "stretch",
              },
            },
          },
          slots: {
            default: [
              {
                id: "layout.heading",
                use: STARTER_HEADING_CAPABILITY_ID,
                props: { text: "Neutral layout system", level: 2 },
                style: {
                  base: {
                    root: { color: "#171717", fontSize: 24, fontWeight: 700, textAlign: "start" },
                  },
                },
              },
              {
                id: "layout.text",
                use: STARTER_TEXT_CAPABILITY_ID,
                props: { text: "Semantic content is composed through declared, nested slots." },
                style: {
                  base: {
                    root: {
                      color: "#525252",
                      fontSize: 16,
                      lineHeight: 1.5,
                      textAlign: "start",
                    },
                  },
                },
              },
              {
                id: "layout.image",
                use: STARTER_IMAGE_CAPABILITY_ID,
                props: { source: "neutral-horizon", alt: "Neutral horizon", fit: "cover" },
                style: { base: { root: { width: 480, height: 180, borderRadius: 12 } } },
              },
              {
                id: "layout.icon",
                use: STARTER_ICON_CAPABILITY_ID,
                props: { name: "info", label: "Information", decorative: false },
                style: { base: { root: { color: "#171717", width: 24, height: 24 } } },
              },
              {
                id: "layout.separator",
                use: STARTER_SEPARATOR_CAPABILITY_ID,
                props: { orientation: "horizontal" },
                style: { base: { root: { backgroundColor: "#E5E5E5", height: 1 } } },
              },
              {
                id: "layout.separator.vertical",
                use: STARTER_SEPARATOR_CAPABILITY_ID,
                props: { orientation: "vertical" },
              },
              {
                id: "layout.grid",
                use: STARTER_GRID_CAPABILITY_ID,
                props: { columns: 2, flow: "column", dir: "rtl" },
                style: {
                  base: {
                    root: {
                      gap: 12,
                      overflow: "auto",
                      justifyContent: "between",
                      alignItems: "stretch",
                    },
                  },
                },
                slots: {
                  default: [
                    {
                      id: "layout.grid.first",
                      use: STARTER_TEXT_CAPABILITY_ID,
                      props: { text: "First logical grid item" },
                    },
                    {
                      id: "layout.grid.second",
                      use: STARTER_TEXT_CAPABILITY_ID,
                      props: { text: "Second logical grid item" },
                    },
                    {
                      id: "layout.grid.third",
                      use: STARTER_TEXT_CAPABILITY_ID,
                      props: { text: "Third logical grid item" },
                    },
                    {
                      id: "layout.grid.fourth",
                      use: STARTER_TEXT_CAPABILITY_ID,
                      props: { text: "Fourth logical grid item" },
                    },
                    {
                      id: "layout.grid.fifth",
                      use: STARTER_TEXT_CAPABILITY_ID,
                      props: { text: "Fifth logical grid item" },
                    },
                    {
                      id: "layout.grid.sixth",
                      use: STARTER_TEXT_CAPABILITY_ID,
                      props: { text: "Sixth logical grid item" },
                    },
                    {
                      id: "layout.grid.seventh",
                      use: STARTER_TEXT_CAPABILITY_ID,
                      props: { text: "Seventh logical grid item" },
                    },
                    {
                      id: "layout.grid.eighth",
                      use: STARTER_TEXT_CAPABILITY_ID,
                      props: { text: "Eighth logical grid item" },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  } satisfies DesenSource["surfaces"][string]["root"];
}

export function createStarterProofSources(): StarterProofSources {
  return Object.freeze({
    buttonInitial: sourceDocument("run.desen.proof.starter-button", "button", buttonNode(false)),
    buttonCompatible: sourceDocument("run.desen.proof.starter-button", "button", buttonNode(true)),
    select: sourceDocument("run.desen.proof.starter-select", "select", selectNode(), {
      selection: { schema: { type: "string" }, initial: "alpha" },
    }),
    dialog: dialogDocument(),
    layout: sourceDocument("run.desen.proof.starter-layout", "layout", layoutNode()),
  });
}
