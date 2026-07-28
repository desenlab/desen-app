import type { RuntimeReactSurfaceFailure } from "@desen/runtime-react";

/** Host-owned props for the accessible controlled-failure surface. */
export interface ReferenceHostFailureViewProps {
  readonly failure: RuntimeReactSurfaceFailure;
  readonly onRequestRecovery: () => void;
}

function publicFailureCode(failure: RuntimeReactSurfaceFailure): string {
  if (failure.kind === "adapter") return failure.failure.code;
  if (failure.kind === "render") return failure.failure.code;
  return `SESSION_${failure.reason.toUpperCase().replaceAll("-", "_")}`;
}

/**
 * Accessible host infrastructure shown after a controlled DESEN failure.
 *
 * @remarks The view receives only the already-redacted closed runtime union. It cannot inspect a
 * raw exception, stack, cause, React component stack, managed props, or platform instance.
 */
export function ReferenceHostFailureView({
  failure,
  onRequestRecovery,
}: ReferenceHostFailureViewProps) {
  return (
    <section
      aria-labelledby="desen-reference-host-failure-title"
      className="reference-host__notice reference-host__notice--failure"
      data-desen-host-state="failed"
      role="alert"
    >
      <p className="reference-host__eyebrow">DESEN reference host</p>
      <h1 id="desen-reference-host-failure-title">The managed interface stopped safely.</h1>
      <p>
        No substitute component was guessed. You can explicitly authorize one clean retry after
        checking the host integration.
      </p>
      <code className="reference-host__code">{publicFailureCode(failure)}</code>
      <button className="reference-host__action" onClick={onRequestRecovery} type="button">
        Retry managed interface
      </button>
    </section>
  );
}
