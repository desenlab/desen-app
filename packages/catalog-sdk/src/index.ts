/**
 * Typed capability manifest registration and parity tooling with manifest authority.
 *
 * @packageDocumentation
 */

export { createCatalogManifest } from "./catalog-manifest.js";
export { registerComponent } from "./component-registration.js";

export type { CreateCatalogManifestInput } from "./catalog-manifest.js";
export type {
  ComponentManifest,
  RegisteredComponent,
  RegisterComponentInput,
} from "./component-registration.js";
export type { ImmutableJson, JsonInput, JsonPrimitive } from "./inert-json.js";
