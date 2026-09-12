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
  STARTER_BOX_CAPABILITY_ID,
  STARTER_SELECT_CAPABILITY_ID,
  STARTER_DIALOG_CAPABILITY_ID,
  STARTER_GRID_CAPABILITY_ID,
  STARTER_HEADING_CAPABILITY_ID,
  STARTER_ICON_CAPABILITY_ID,
  STARTER_IMAGE_CAPABILITY_ID,
  STARTER_LAYOUT_CONTENT_MAX_ITEMS,
  STARTER_SEPARATOR_CAPABILITY_ID,
  STARTER_STACK_CAPABILITY_ID,
  STARTER_TEXT_CAPABILITY_ID,
  STARTER_SELECT_MAX_OPTIONS,
  STARTER_DIALOG_CONTENT_MAX_ITEMS,
  STARTER_COMPONENT_REGISTRATIONS,
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
export type {
  StarterButtonProps,
  StarterBoxProps,
  StarterSelectProps,
  StarterDialogProps,
  StarterSelectOption,
  StarterGridProps,
  StarterHeadingProps,
  StarterIconProps,
  StarterImageProps,
  StarterSeparatorProps,
  StarterStackProps,
  StarterTextProps,
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
