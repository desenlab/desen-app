import { createRegisteredManifest } from "./registration-core.js";

import type { DesenCatalog } from "@desen/protocol";
import type { JsonInput } from "./inert-json.js";
import type { ExactManifest, RegisteredManifest } from "./registration-core.js";

/**
 * The complete JSON contract for one DESEN resource capability.
 *
 * @remarks The type is projected directly from the frozen Catalog schema root. Trusted resource
 * readers, caches, transport code, and authorization remain host-owned.
 */
export type ResourceManifest = DesenCatalog["resources"][string];

export type ResourceManifestInput = JsonInput<ResourceManifest>;

type RegistrationShape = Readonly<{
  id: string;
  manifest: ResourceManifestInput;
}>;

type RegistrationConstraints<Input extends RegistrationShape> = Input extends RegistrationShape
  ? Record<Exclude<keyof Input, keyof RegistrationShape>, never> &
      RegisterResourceInput<Input["id"], Input["manifest"]>
  : never;

/** Schema-authoritative, exact, inert resource input used by Catalog composition internals. */
export type ExactResourceManifest<Input> = ExactManifest<Input, ResourceManifestInput>;

/** Input accepted by {@link registerResource}. */
export interface RegisterResourceInput<
  Id extends string = string,
  Manifest = ResourceManifestInput,
> {
  /** Fully qualified resource capability identifier used as the Catalog map key. */
  readonly id: Id;
  /** Authoritative JSON resource contract; executable readers never belong here. */
  readonly manifest: ExactResourceManifest<Manifest>;
}

/**
 * Detached JSON registration for one read-oriented resource contract.
 *
 * @remarks The record carries supported policy and cache-hint data, not a live data source.
 */
export type RegisteredResource<
  Id extends string = string,
  Manifest extends ResourceManifestInput = ResourceManifestInput,
> = RegisteredManifest<Id, Manifest>;

/**
 * Registers one resource manifest as detached, immutable JSON data.
 *
 * @remarks This function does not bind a service, endpoint, SDK, database query, cache, credential,
 * or executable reader. Domain mutation remains an operation contract.
 *
 * @throws TypeError when the wrapper shape is wrong or any nested value is not inert JSON data.
 */
export function registerResource<const Input extends RegistrationShape>(
  input: Input & RegistrationConstraints<NoInfer<Input>>,
): RegisteredResource<Input["id"], Input["manifest"]> {
  return createRegisteredManifest(input, "resource") as RegisteredResource<
    Input["id"],
    Input["manifest"]
  >;
}
