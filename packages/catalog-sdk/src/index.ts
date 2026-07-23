/**
 * Typed capability manifest registration and parity tooling with manifest authority.
 *
 * @packageDocumentation
 */

export { registerBehavior } from "./behavior-registration.js";
export { createCatalogManifest } from "./catalog-manifest.js";
export { deriveComponentInspectorControls } from "./component-inspector-control.js";
export { registerComponent } from "./component-registration.js";
export { registerOperation } from "./operation-registration.js";
export { registerResource } from "./resource-registration.js";

export type {
  BehaviorManifest,
  RegisteredBehavior,
  RegisterBehaviorInput,
} from "./behavior-registration.js";
export type { CreateCatalogManifestInput } from "./catalog-manifest.js";
export type {
  ComponentInspectorControl,
  ComponentInspectorControlKind,
  ComponentInspectorControlPlan,
  ComponentInspectorFallbackReason,
} from "./component-inspector-control.js";
export type {
  ComponentManifest,
  RegisteredComponent,
  RegisterComponentInput,
} from "./component-registration.js";
export type { ImmutableJson, JsonInput, JsonPrimitive } from "./inert-json.js";
export type {
  OperationManifest,
  RegisteredOperation,
  RegisterOperationInput,
} from "./operation-registration.js";
export type {
  RegisteredResource,
  RegisterResourceInput,
  ResourceManifest,
} from "./resource-registration.js";
export type { ComponentPropsOf, JsonSchemaValue, JsonValue } from "./schema-type-derivation.js";
