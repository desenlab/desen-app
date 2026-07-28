import type { RuntimeHeadlessSessionHandle } from "@desen/runtime-core";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactLiveSurfaceInput,
} from "@desen/runtime-react";
import type { RuntimeWebHostAuthorityHandle } from "@desen/runtime-web";

type RuntimeReactCatalogSet = RuntimeReactLiveSurfaceInput["catalogSet"];

declare const REFERENCE_HOST_RECOVERY_AUTHORITY_TYPE_BRAND: unique symbol;

/** Opaque host-owned authority controlling one root's sticky adapter-failure retry epoch. */
export interface ReferenceHostRecoveryAuthorityHandle {
  readonly [REFERENCE_HOST_RECOVERY_AUTHORITY_TYPE_BRAND]: true;
}

/** Exact executable/session authority identities observed by the host composition root. */
export interface ReferenceHostRecoveryAuthorityInput {
  readonly session: RuntimeHeadlessSessionHandle;
  readonly registry: RuntimeReactAdapterRegistryHandle;
  readonly catalogSet: RuntimeReactCatalogSet;
  readonly hostAuthority: RuntimeWebHostAuthorityHandle;
}

/** Immutable observation returned after an authority input is accepted. */
export interface ReferenceHostRecoveryAuthoritySnapshot {
  readonly relationship: "initial" | "preserved" | "replaced";
  readonly recoveryKey: string;
}

interface RecoveryAuthorityState {
  active: boolean;
  authorityEpoch: bigint;
  retryEpoch: bigint;
  current: ReferenceHostRecoveryAuthorityInput | undefined;
}

const AUTHORITIES = new WeakMap<ReferenceHostRecoveryAuthorityHandle, RecoveryAuthorityState>();

function recoveryKey(state: RecoveryAuthorityState): string {
  return `reference-host-authority:${state.authorityEpoch.toString()}:retry:${state.retryEpoch.toString()}`;
}

function stateFor(
  authority: ReferenceHostRecoveryAuthorityHandle,
): RecoveryAuthorityState | undefined {
  try {
    return AUTHORITIES.get(authority);
  } catch {
    return undefined;
  }
}

function captureInput(
  input: ReferenceHostRecoveryAuthorityInput,
): ReferenceHostRecoveryAuthorityInput | undefined {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const expected = ["session", "registry", "catalogSet", "hostAuthority"];
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expected.length ||
      keys.some((key) => typeof key !== "string" || !expected.includes(key))
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null);
    for (const key of expected) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze({
      session: captured.session as RuntimeHeadlessSessionHandle,
      registry: captured.registry as RuntimeReactAdapterRegistryHandle,
      catalogSet: captured.catalogSet as RuntimeReactCatalogSet,
      hostAuthority: captured.hostAuthority as RuntimeWebHostAuthorityHandle,
    });
  } catch {
    return undefined;
  }
}

/**
 * Creates one isolated recovery authority with no Bundle-, URL-, or snapshot-derived input.
 */
export function createReferenceHostRecoveryAuthority(): ReferenceHostRecoveryAuthorityHandle {
  const handle = Object.freeze({}) as ReferenceHostRecoveryAuthorityHandle;
  AUTHORITIES.set(handle, {
    active: true,
    authorityEpoch: 0n,
    retryEpoch: 0n,
    current: undefined,
  });
  return handle;
}

/**
 * Observes trusted session, registry, Catalog, and host-port authority identities.
 *
 * @remarks Ordinary runtime snapshot publication is intentionally absent from this API. Reusing
 * the exact four authority objects preserves the recovery key. Replacing any authority advances
 * the authority epoch exactly once and resets the explicit retry epoch.
 */
export function observeReferenceHostRecoveryAuthority(
  authority: ReferenceHostRecoveryAuthorityHandle,
  input: ReferenceHostRecoveryAuthorityInput,
):
  | Readonly<{
      readonly status: "observed";
      readonly snapshot: ReferenceHostRecoveryAuthoritySnapshot;
    }>
  | Readonly<{ readonly status: "disposed" | "invalid-authority" | "malformed-input" }> {
  const state = stateFor(authority);
  if (state === undefined) return Object.freeze({ status: "invalid-authority" });
  if (!state.active) return Object.freeze({ status: "disposed" });
  const captured = captureInput(input);
  if (captured === undefined) return Object.freeze({ status: "malformed-input" });

  let relationship: ReferenceHostRecoveryAuthoritySnapshot["relationship"];
  if (state.current === undefined) {
    relationship = "initial";
    state.current = captured;
  } else if (
    state.current.session === captured.session &&
    state.current.registry === captured.registry &&
    state.current.catalogSet === captured.catalogSet &&
    state.current.hostAuthority === captured.hostAuthority
  ) {
    relationship = "preserved";
    state.current = captured;
  } else {
    relationship = "replaced";
    state.authorityEpoch += 1n;
    state.retryEpoch = 0n;
    state.current = captured;
  }

  return Object.freeze({
    status: "observed",
    snapshot: Object.freeze({
      relationship,
      recoveryKey: recoveryKey(state),
    }),
  });
}

/**
 * Advances one recovery epoch only after an explicit host/user retry decision.
 */
export function authorizeReferenceHostRecovery(
  authority: ReferenceHostRecoveryAuthorityHandle,
):
  | Readonly<{ readonly status: "authorized"; readonly recoveryKey: string }>
  | Readonly<{ readonly status: "disposed" | "invalid-authority" | "unavailable" }> {
  const state = stateFor(authority);
  if (state === undefined) return Object.freeze({ status: "invalid-authority" });
  if (!state.active) return Object.freeze({ status: "disposed" });
  if (state.current === undefined) return Object.freeze({ status: "unavailable" });
  state.retryEpoch += 1n;
  return Object.freeze({ status: "authorized", recoveryKey: recoveryKey(state) });
}

/** Terminally revokes one root-local recovery authority. */
export function disposeReferenceHostRecoveryAuthority(
  authority: ReferenceHostRecoveryAuthorityHandle,
): Readonly<{ readonly status: "disposed" | "already-disposed" | "invalid-authority" }> {
  const state = stateFor(authority);
  if (state === undefined) return Object.freeze({ status: "invalid-authority" });
  if (!state.active) return Object.freeze({ status: "already-disposed" });
  state.active = false;
  state.current = undefined;
  return Object.freeze({ status: "disposed" });
}
