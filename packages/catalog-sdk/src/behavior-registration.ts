import { createRegisteredManifest } from "./registration-core.js";

import type { DesenCatalog } from "@desen/protocol";
import type { JsonInput } from "./inert-json.js";
import type { ExactManifest, RegisteredManifest } from "./registration-core.js";

/**
 * The complete JSON contract for one DESEN behavior capability.
 *
 * @remarks The type is projected directly from the frozen Catalog schema root. Executable behavior
 * adapters belong to target renderer packages and never enter this manifest.
 */
export type BehaviorManifest = DesenCatalog["behaviors"][string];

export type BehaviorManifestInput = JsonInput<BehaviorManifest>;

type RegistrationShape = Readonly<{
  id: string;
  manifest: BehaviorManifestInput;
}>;

type RegistrationConstraints<Input extends RegistrationShape> = Input extends RegistrationShape
  ? Record<Exclude<keyof Input, keyof RegistrationShape>, never> &
      RegisterBehaviorInput<Input["id"], Input["manifest"]>
  : never;

/** Schema-authoritative, exact, inert behavior input used by Catalog composition internals. */
export type ExactBehaviorManifest<Input> = ExactManifest<Input, BehaviorManifestInput>;

/** Input accepted by {@link registerBehavior}. */
export interface RegisterBehaviorInput<
  Id extends string = string,
  Manifest = BehaviorManifestInput,
> {
  /** Fully qualified behavior capability identifier used as the Catalog map key. */
  readonly id: Id;
  /** Authoritative JSON behavior contract; executable adapters never belong here. */
  readonly manifest: ExactBehaviorManifest<Manifest>;
}

/**
 * Detached JSON registration for one behavior contract.
 *
 * @remarks The record is recursively frozen and contains no renderer adapter or host code.
 */
export type RegisteredBehavior<
  Id extends string = string,
  Manifest extends BehaviorManifestInput = BehaviorManifestInput,
> = RegisteredManifest<Id, Manifest>;

/**
 * Registers one behavior manifest as detached, immutable JSON data.
 *
 * @remarks This function writes no global registry and does not register an executable behavior
 * adapter. Identifier, attachment, composition, and schema semantics remain validator concerns.
 *
 * @throws TypeError when the wrapper shape is wrong or any nested value is not inert JSON data.
 */
export function registerBehavior<const Input extends RegistrationShape>(
  input: Input & RegistrationConstraints<NoInfer<Input>>,
): RegisteredBehavior<Input["id"], Input["manifest"]> {
  return createRegisteredManifest(input, "behavior") as RegisteredBehavior<
    Input["id"],
    Input["manifest"]
  >;
}
