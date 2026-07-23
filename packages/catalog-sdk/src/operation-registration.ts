import { createRegisteredManifest } from "./registration-core.js";

import type { DesenCatalog } from "@desen/protocol";
import type { JsonInput } from "./inert-json.js";
import type { ExactManifest, RegisteredManifest } from "./registration-core.js";

/**
 * The complete JSON contract for one DESEN operation capability.
 *
 * @remarks The type is projected directly from the frozen Catalog schema root. Trusted operation
 * implementations and host authorization remain outside the Catalog SDK.
 */
export type OperationManifest = DesenCatalog["operations"][string];

export type OperationManifestInput = JsonInput<OperationManifest>;

type RegistrationShape = Readonly<{
  id: string;
  manifest: OperationManifestInput;
}>;

type RegistrationConstraints<Input extends RegistrationShape> = Input extends RegistrationShape
  ? Record<Exclude<keyof Input, keyof RegistrationShape>, never> &
      RegisterOperationInput<Input["id"], Input["manifest"]>
  : never;

/** Schema-authoritative, exact, inert operation input used by Catalog composition internals. */
export type ExactOperationManifest<Input> = ExactManifest<Input, OperationManifestInput>;

/** Input accepted by {@link registerOperation}. */
export interface RegisterOperationInput<
  Id extends string = string,
  Manifest = OperationManifestInput,
> {
  /** Fully qualified operation capability identifier used as the Catalog map key. */
  readonly id: Id;
  /** Authoritative JSON operation contract; executable handlers never belong here. */
  readonly manifest: ExactOperationManifest<Manifest>;
}

/**
 * Detached JSON registration for one operation contract.
 *
 * @remarks The effect field is descriptive data and never grants permission or carries code.
 */
export type RegisteredOperation<
  Id extends string = string,
  Manifest extends OperationManifestInput = OperationManifestInput,
> = RegisteredManifest<Id, Manifest>;

/**
 * Registers one operation manifest as detached, immutable JSON data.
 *
 * @remarks This function does not bind an endpoint, SDK, database query, authorization policy, or
 * executable handler. Those are trusted host responsibilities.
 *
 * @throws TypeError when the wrapper shape is wrong or any nested value is not inert JSON data.
 */
export function registerOperation<const Input extends RegistrationShape>(
  input: Input & RegistrationConstraints<NoInfer<Input>>,
): RegisteredOperation<Input["id"], Input["manifest"]> {
  return createRegisteredManifest(input, "operation") as RegisteredOperation<
    Input["id"],
    Input["manifest"]
  >;
}
