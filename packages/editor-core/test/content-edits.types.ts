import {
  clearDesenEditorNodeCondition,
  deleteDesenEditorOwnerProp,
  deleteDesenEditorOwnerStyleProperty,
  deleteDesenEditorVariant,
  deleteDesenEditorVariantProp,
  deleteDesenEditorVariantStyleProperty,
  insertDesenEditorVariant,
  reorderDesenEditorVariant,
  setDesenEditorNodeCondition,
  setDesenEditorOwnerProp,
  setDesenEditorOwnerStyleProperty,
  setDesenEditorVariantCondition,
  setDesenEditorVariantProp,
  setDesenEditorVariantStyleProperty,
} from "../src/index.js";

import type {
  DesenEditorContentEditResult,
  DesenEditorContentPredicate,
  DesenEditorContentValue,
  DesenEditorContentVariant,
  DesenEditorDocument,
  DesenEditorNodeConditionClearCommand,
  DesenEditorNodeConditionSetCommand,
  DesenEditorOwnerPropDeleteCommand,
  DesenEditorOwnerPropSetCommand,
  DesenEditorOwnerStylePropertyDeleteCommand,
  DesenEditorOwnerStylePropertySetCommand,
  DesenEditorVariantConditionSetCommand,
  DesenEditorVariantDeleteCommand,
  DesenEditorVariantInsertCommand,
  DesenEditorVariantPropDeleteCommand,
  DesenEditorVariantPropSetCommand,
  DesenEditorVariantReorderCommand,
  DesenEditorVariantStylePropertyDeleteCommand,
  DesenEditorVariantStylePropertySetCommand,
} from "../src/index.js";

declare const document: DesenEditorDocument;

const value: DesenEditorContentValue = { token: "color.accent", fallbacks: [null, true, 1] };
const when: DesenEditorContentPredicate = { op: "truthy", args: [true] };
const variant: DesenEditorContentVariant = { when, props: { label: value } };

const ownerPropSet: DesenEditorOwnerPropSetCommand = {
  surfaceId: "main",
  ownerId: "main.title",
  name: "text",
  value,
};
const ownerPropDelete: DesenEditorOwnerPropDeleteCommand = {
  surfaceId: "main",
  ownerId: "main.title",
  name: "text",
};
const ownerStyleSet: DesenEditorOwnerStylePropertySetCommand = {
  surfaceId: "main",
  ownerId: "main.title",
  state: "base",
  part: "root",
  property: "color",
  value,
};
const ownerStyleDelete: DesenEditorOwnerStylePropertyDeleteCommand = {
  surfaceId: "main",
  ownerId: "main.title",
  state: "base",
  part: "root",
  property: "color",
};
const nodeConditionSet: DesenEditorNodeConditionSetCommand = {
  surfaceId: "main",
  nodeId: "main.title",
  when,
};
const nodeConditionClear: DesenEditorNodeConditionClearCommand = {
  surfaceId: "main",
  nodeId: "main.title",
};
const variantInsert: DesenEditorVariantInsertCommand = {
  surfaceId: "main",
  nodeId: "main.title",
  index: 0,
  variant,
};
const variantDelete: DesenEditorVariantDeleteCommand = {
  surfaceId: "main",
  nodeId: "main.title",
  index: 0,
};
const variantReorder: DesenEditorVariantReorderCommand = {
  surfaceId: "main",
  nodeId: "main.title",
  variantIndex: 1,
  index: 0,
};
const variantConditionSet: DesenEditorVariantConditionSetCommand = {
  surfaceId: "main",
  nodeId: "main.title",
  index: 0,
  when,
};
const variantPropSet: DesenEditorVariantPropSetCommand = {
  surfaceId: "main",
  nodeId: "main.title",
  index: 0,
  name: "text",
  value,
};
const variantPropDelete: DesenEditorVariantPropDeleteCommand = {
  surfaceId: "main",
  nodeId: "main.title",
  index: 0,
  name: "text",
};
const variantStyleSet: DesenEditorVariantStylePropertySetCommand = {
  surfaceId: "main",
  nodeId: "main.title",
  index: 0,
  state: "base",
  part: "root",
  property: "color",
  value,
};
const variantStyleDelete: DesenEditorVariantStylePropertyDeleteCommand = {
  surfaceId: "main",
  nodeId: "main.title",
  index: 0,
  state: "base",
  part: "root",
  property: "color",
};

const results: readonly DesenEditorContentEditResult[] = [
  setDesenEditorOwnerProp(document, ownerPropSet),
  deleteDesenEditorOwnerProp(document, ownerPropDelete),
  setDesenEditorOwnerStyleProperty(document, ownerStyleSet),
  deleteDesenEditorOwnerStyleProperty(document, ownerStyleDelete),
  setDesenEditorNodeCondition(document, nodeConditionSet),
  clearDesenEditorNodeCondition(document, nodeConditionClear),
  insertDesenEditorVariant(document, variantInsert),
  deleteDesenEditorVariant(document, variantDelete),
  reorderDesenEditorVariant(document, variantReorder),
  setDesenEditorVariantCondition(document, variantConditionSet),
  setDesenEditorVariantProp(document, variantPropSet),
  deleteDesenEditorVariantProp(document, variantPropDelete),
  setDesenEditorVariantStyleProperty(document, variantStyleSet),
  deleteDesenEditorVariantStyleProperty(document, variantStyleDelete),
];

for (const result of results) {
  if (result.ok) {
    const accepted: DesenEditorDocument = result.document;
    void accepted;
    // @ts-expect-error successful content edits expose no diagnostic element
    const impossibleDiagnostic = result.diagnostics[0];
    void impossibleDiagnostic;
  } else {
    const code: string = result.diagnostics[0].code;
    void code;
    // @ts-expect-error atomic failures expose no partial document
    const partialDocument = result.document;
    void partialDocument;
  }
}

// @ts-expect-error content values are inert JSON values, not executable callbacks
const executableValue: DesenEditorContentValue = () => true;
void executableValue;

// @ts-expect-error the set command requires a complete value
const incompleteSet: DesenEditorOwnerPropSetCommand = {
  surfaceId: "main",
  ownerId: "main.title",
  name: "text",
};
void incompleteSet;

// @ts-expect-error command fields are immutable
ownerPropSet.name = "replacement";

const identityAuthority: DesenEditorVariantInsertCommand = {
  surfaceId: "main",
  nodeId: "main.title",
  index: 0,
  variant,
  // @ts-expect-error inserted variants do not accept editor-generated identity authority
  id: "variant-1",
};
void identityAuthority;
