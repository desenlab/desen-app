import { ReferenceHostManagedSurface } from "./managed-surface.js";

import type { RuntimeReactLiveSurfaceInput } from "@desen/runtime-react";

/** Closed application state accepted by the independent reference-host shell. */
export type ReferenceHostApplicationState =
  | Readonly<{ readonly status: "booting" }>
  | Readonly<{
      readonly status: "surface";
      readonly input: RuntimeReactLiveSurfaceInput;
      readonly recoveryKey: string;
      readonly onRequestRecovery: () => void;
    }>
  | Readonly<{ readonly status: "unavailable" }>;

/** Exact props for the host-owned application frame. */
export interface ReferenceHostApplicationProps {
  readonly state: ReferenceHostApplicationState;
}

function HostNotice({ status }: Readonly<{ readonly status: "booting" | "unavailable" }>) {
  const unavailable = status === "unavailable";
  return (
    <main className="reference-host" data-desen-host-state={status}>
      <section
        aria-labelledby="desen-reference-host-title"
        aria-live="polite"
        className="reference-host__notice"
      >
        <p className="reference-host__eyebrow">DESEN reference host</p>
        <h1 id="desen-reference-host-title">
          {unavailable ? "No managed interface is active." : "Waiting for verified activation."}
        </h1>
        <p>
          {unavailable
            ? "The previous runtime authority was closed without replacing it with guessed UI."
            : "This independent host will render only a validated bundle through registered adapters."}
        </p>
      </section>
    </main>
  );
}

/**
 * Independent host frame whose state cannot carry a handwritten managed React tree.
 */
export function ReferenceHostApplication({ state }: ReferenceHostApplicationProps) {
  if (state.status !== "surface") return <HostNotice status={state.status} />;

  return (
    <main className="reference-host" data-desen-host-state="surface">
      <ReferenceHostManagedSurface
        input={state.input}
        onRequestRecovery={state.onRequestRecovery}
        recoveryKey={state.recoveryKey}
      />
    </main>
  );
}
