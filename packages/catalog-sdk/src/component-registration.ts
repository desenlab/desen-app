import { createRegisteredManifest } from "./registration-core.js";

import type { DesenCatalog } from "@desen/protocol";
import type { JsonInput } from "./inert-json.js";
import type { ExactManifest, RegisteredManifest } from "./registration-core.js";

/**
 * The complete JSON contract for one DESEN component capability.
 *
 * @remarks The type is projected directly from the frozen Catalog schema root. It is not an
 * independent contract and does not replace runtime Catalog validation.
 */
export type ComponentManifest = DesenCatalog["components"][string];

export type ComponentManifestInput = JsonInput<ComponentManifest>;

type RegistrationShape = Readonly<{
  id: string;
  manifest: ComponentManifestInput;
}>;

type RegistrationConstraints<Input extends RegistrationShape> = Input extends RegistrationShape
  ? Record<Exclude<keyof Input, keyof RegistrationShape>, never> &
      RegisterComponentInput<Input["id"], Input["manifest"]>
  : never;

/** Schema-authoritative, exact, inert input view used by catalog composition internals. */
export type ExactComponentManifest<Input> = ExactManifest<Input, ComponentManifestInput>;

/** Input accepted by {@link registerComponent}. */
export interface RegisterComponentInput<
  Id extends string = string,
  Manifest = ComponentManifestInput,
> {
  /** Fully qualified capability identifier used as the Catalog map key. */
  readonly id: Id;
  /** Authoritative JSON component contract; executable adapters never belong here. */
  readonly manifest: ExactComponentManifest<Manifest>;
}

/**
 * Detached JSON registration for one component contract.
 *
 * @remarks The record is recursively frozen and contains only the identifier plus the authoritative
 * manifest. Renderer implementations are registered by target-specific runtime packages.
 */
export type RegisteredComponent<
  Id extends string = string,
  Manifest extends ComponentManifestInput = ComponentManifestInput,
> = RegisteredManifest<Id, Manifest>;

/**
 * Registers one component manifest as detached, immutable JSON data.
 *
 * @remarks This function is pure and writes no global registry. Canonical snapshotting makes equal
 * JSON inputs independent of object insertion order while preserving array order. Full identifier,
 * JSON Schema, and cross-contract validation remains the validator/publisher boundary.
 *
 * @throws TypeError when the wrapper shape is wrong or any nested value is not inert JSON data.
 */
export function registerComponent<const Input extends RegistrationShape>(
  input: Input & RegistrationConstraints<NoInfer<Input>>,
): RegisteredComponent<Input["id"], Input["manifest"]> {
  return createRegisteredManifest(input, "component") as RegisteredComponent<
    Input["id"],
    Input["manifest"]
  >;
}
