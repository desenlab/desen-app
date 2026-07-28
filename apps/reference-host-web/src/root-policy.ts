/* eslint-disable @typescript-eslint/no-invalid-void-type -- React's root callbacks are deliberately
 * receiver-independent and their raw arguments are never inspected. */
import { ignoreRuntimeReactRootCaughtError } from "@desen/runtime-react";

import type { RootOptions } from "react-dom/client";

/** Redacted application-level signals emitted by the dedicated reference-host React root. */
export type ReferenceHostRootDiagnosticCode =
  | "REFERENCE_HOST_ROOT_RECOVERABLE"
  | "REFERENCE_HOST_ROOT_UNCAUGHT"
  | "REFERENCE_HOST_ROOT_UNMOUNT_FAILED";

/** Inert diagnostic delivered without any raw React error or component-stack data. */
export interface ReferenceHostRootDiagnostic {
  readonly code: ReferenceHostRootDiagnosticCode;
  readonly source: "reference-host-web";
}

/** Receiver-independent sink for already-redacted reference-host root diagnostics. */
export type ReferenceHostRootDiagnosticReporter = (
  this: void,
  diagnostic: ReferenceHostRootDiagnostic,
) => void;

/** Receiver-independent terminal fence invoked after an uncaught dedicated-root failure. */
export type ReferenceHostRootTerminalFailureHandler = (this: void) => void;

const ROOT_DIAGNOSTICS = Object.freeze({
  recoverable: Object.freeze({
    code: "REFERENCE_HOST_ROOT_RECOVERABLE",
    source: "reference-host-web",
  }),
  uncaught: Object.freeze({
    code: "REFERENCE_HOST_ROOT_UNCAUGHT",
    source: "reference-host-web",
  }),
  unmount: Object.freeze({
    code: "REFERENCE_HOST_ROOT_UNMOUNT_FAILED",
    source: "reference-host-web",
  }),
} satisfies Readonly<Record<string, ReferenceHostRootDiagnostic>>);

/** Reports a fixed diagnostic without allowing observability failure to affect root policy. */
export function reportReferenceHostRootDiagnostic(
  reporter: ReferenceHostRootDiagnosticReporter,
  diagnostic: ReferenceHostRootDiagnostic,
): void {
  try {
    Reflect.apply(reporter, undefined, [diagnostic]);
  } catch {
    // Observability is deliberately unable to change rendering or teardown authority.
  }
}

/**
 * Creates the complete React 19 policy for one dedicated DESEN reference-host root.
 *
 * @remarks None of the three callbacks reads, stringifies, forwards, classifies, or retains the
 * raw thrown value or React error-info object. Controlled DESEN failures remain observable only
 * through `RuntimeReactSurfaceBoundary`.
 */
export function createReferenceHostRootOptions(
  reporter: ReferenceHostRootDiagnosticReporter,
  onTerminalFailure: ReferenceHostRootTerminalFailureHandler,
): RootOptions {
  if (typeof reporter !== "function") {
    throw new TypeError("Reference-host root diagnostic reporter must be a function.");
  }
  if (typeof onTerminalFailure !== "function") {
    throw new TypeError("Reference-host root terminal failure handler must be a function.");
  }

  return Object.freeze({
    onCaughtError: ignoreRuntimeReactRootCaughtError,
    onRecoverableError(error: unknown, errorInfo: unknown): void {
      void error;
      void errorInfo;
      reportReferenceHostRootDiagnostic(reporter, ROOT_DIAGNOSTICS.recoverable);
    },
    onUncaughtError(error: unknown, errorInfo: unknown): void {
      void error;
      void errorInfo;
      try {
        Reflect.apply(onTerminalFailure, undefined, []);
      } catch {
        // A terminal fence is application authority, not an alternate error propagation channel.
      }
      reportReferenceHostRootDiagnostic(reporter, ROOT_DIAGNOSTICS.uncaught);
    },
  });
}

/** Emits the fixed teardown diagnostic after a root-unmount exception was contained. */
export function reportReferenceHostRootUnmountFailure(
  reporter: ReferenceHostRootDiagnosticReporter,
): void {
  reportReferenceHostRootDiagnostic(reporter, ROOT_DIAGNOSTICS.unmount);
}
