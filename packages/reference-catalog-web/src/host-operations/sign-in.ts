import { SIGN_IN_OPERATION_ID } from "../operations/sign-in.js";

import type { SignInOperationInput } from "../operations/sign-in.js";

/**
 * Application-supplied implementation for the reference sign-in capability.
 *
 * @remarks Authentication, endpoint selection, credentials, secrets, and authorization remain
 * inside the trusted application composition root. The capability package never supplies a real
 * implementation or a production fake. The return value is deliberately `unknown`: M04 owns the
 * generic host port, asynchronous settlement envelope, successful-output validation, public-error
 * sanitization, lifecycle, concurrency, and diagnostics.
 */
export type SignInHostOperationHandler = (input: SignInOperationInput) => unknown;

/**
 * Narrow trusted-code binding for the exact reference sign-in capability.
 *
 * @remarks This executable object is deliberately outside the inert `operations` subpath and
 * must never be serialized into a Catalog, Source, Bundle, or authoring fixture snapshot.
 */
export interface SignInHostOperationBinding {
  /** Capability identifier fixed by this package rather than selected by a design document. */
  readonly operationId: typeof SIGN_IN_OPERATION_ID;
  /** Trusted application handler retained by identity without eager execution or wrapping. */
  readonly invoke: SignInHostOperationHandler;
}

/**
 * Binds the exact sign-in capability identifier to an application-supplied trusted handler.
 *
 * @remarks The factory performs no I/O, keeps no global registry, and neither calls nor wraps the
 * handler. It intentionally does not define synchronous-versus-asynchronous settlement or
 * implement runtime schema validation, lifecycle, concurrency, cancellation, retries,
 * diagnostics, authorization, or public-error settlement.
 *
 * @throws TypeError when a JavaScript caller supplies a non-function handler.
 */
export function bindReferenceSignInHostOperation(
  handler: SignInHostOperationHandler,
): SignInHostOperationBinding {
  if (typeof handler !== "function") {
    throw new TypeError("Reference sign-in host operation handler must be a function");
  }

  return Object.freeze({
    operationId: SIGN_IN_OPERATION_ID,
    invoke: handler,
  });
}
