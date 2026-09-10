/**
 * Inert DESEN Neutral Web starter contracts and declarative Source templates.
 * Executable adapters are available only through the explicit `./react-adapters` subpath.
 * @packageDocumentation
 */
export {
  STARTER_CATALOG_ID,
  STARTER_CATALOG_VERSION,
  STARTER_CATALOG_TARGET,
  STARTER_CATALOG_TEMPLATE,
  STARTER_BUTTON_CAPABILITY_ID,
  STARTER_SELECT_CAPABILITY_ID,
  STARTER_DIALOG_CAPABILITY_ID,
  STARTER_SELECT_MAX_OPTIONS,
  STARTER_DIALOG_CONTENT_MAX_ITEMS,
  STARTER_COMPONENT_REGISTRATIONS,
  starterButtonComponentRegistration,
  starterSelectComponentRegistration,
  starterDialogComponentRegistration,
} from "./contracts.js";
export type {
  StarterButtonProps,
  StarterSelectProps,
  StarterDialogProps,
  StarterSelectOption,
} from "./contracts.js";
export {
  createStarterNodeTemplate,
  STARTER_TEMPLATE_ID_PREFIX_MAX_LENGTH,
  STARTER_TEMPLATE_MAX_RESERVED_IDS,
} from "./templates.js";
export type {
  CreateStarterNodeTemplateInput,
  StarterSourceNode,
  StarterTemplateCapabilityId,
} from "./templates.js";
