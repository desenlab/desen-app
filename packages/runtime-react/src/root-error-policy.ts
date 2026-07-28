/* eslint-disable @typescript-eslint/no-invalid-void-type -- `this: void` prevents accidental
 * receiver-dependent host policy. */

/**
 * React root callback shape used to suppress raw caught-error telemetry on a dedicated DESEN root.
 */
export type RuntimeReactRootCaughtErrorHandler = (
  this: void,
  error: unknown,
  errorInfo: unknown,
) => void;

/**
 * Ignores React's raw caught-error payload for a dedicated DESEN-managed root.
 *
 * @remarks React invokes `onCaughtError` with the original thrown value and component-stack
 * metadata before an error boundary finishes recovery. Production hosts that must not log raw
 * adapter data can pass this function to `createRoot` or `hydrateRoot`; redacted controlled
 * diagnostics still arrive through `RuntimeReactSurfaceBoundary.renderFailure`.
 *
 * Do not use this policy on a shared root when the host needs raw caught-error telemetry for
 * non-DESEN application code. Uncaught and recoverable root errors remain separate host policies.
 */
export const ignoreRuntimeReactRootCaughtError: RuntimeReactRootCaughtErrorHandler = (
  error,
  errorInfo,
) => {
  void error;
  void errorInfo;
};
