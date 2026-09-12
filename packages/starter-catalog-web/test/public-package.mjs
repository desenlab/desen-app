/* global console */

import assert from "node:assert/strict";

const packageRoot = await import("../dist/index.js");

assert.deepEqual(Object.keys(packageRoot).sort(), [
  "STARTER_BOX_CAPABILITY_ID",
  "STARTER_BUTTON_CAPABILITY_ID",
  "STARTER_CATALOG_ID",
  "STARTER_CATALOG_TARGET",
  "STARTER_CATALOG_TEMPLATE",
  "STARTER_CATALOG_VERSION",
  "STARTER_COMPONENT_REGISTRATIONS",
  "STARTER_DIALOG_CAPABILITY_ID",
  "STARTER_DIALOG_CONTENT_MAX_ITEMS",
  "STARTER_GRID_CAPABILITY_ID",
  "STARTER_HEADING_CAPABILITY_ID",
  "STARTER_ICON_CAPABILITY_ID",
  "STARTER_IMAGE_CAPABILITY_ID",
  "STARTER_LAYOUT_CONTENT_MAX_ITEMS",
  "STARTER_SELECT_CAPABILITY_ID",
  "STARTER_SELECT_MAX_OPTIONS",
  "STARTER_SEPARATOR_CAPABILITY_ID",
  "STARTER_STACK_CAPABILITY_ID",
  "STARTER_TEMPLATE_ID_PREFIX_MAX_LENGTH",
  "STARTER_TEMPLATE_MAX_RESERVED_IDS",
  "STARTER_TEXT_CAPABILITY_ID",
  "createStarterNodeTemplate",
  "starterBoxComponentRegistration",
  "starterButtonComponentRegistration",
  "starterDialogComponentRegistration",
  "starterGridComponentRegistration",
  "starterHeadingComponentRegistration",
  "starterIconComponentRegistration",
  "starterImageComponentRegistration",
  "starterSelectComponentRegistration",
  "starterSeparatorComponentRegistration",
  "starterStackComponentRegistration",
  "starterTextComponentRegistration",
]);

const template = packageRoot.createStarterNodeTemplate({
  capabilityId: packageRoot.STARTER_GRID_CAPABILITY_ID,
  idPrefix: "public.grid",
});
assert.equal(template.use, packageRoot.STARTER_GRID_CAPABILITY_ID);
assert.equal(template.slots.default.length, 2);
assert.equal(Object.isFrozen(template), true);
console.log("✔ built starter catalog public package exports 33 reviewed members");
