import { useCallback } from "react";

import { RuntimeReactSurfaceBoundary, useRuntimeReactSurface } from "@desen/runtime-react";

import { ReferenceHostFailureView } from "./failure-view.js";

import type {
  RuntimeReactLiveSurfaceInput,
  RuntimeReactSurfaceFailure,
} from "@desen/runtime-react";

/** Closed host input for one generic, authenticated managed surface. */
export interface ReferenceHostManagedSurfaceProps {
  readonly input: RuntimeReactLiveSurfaceInput;
  readonly recoveryKey: string;
  readonly onRequestRecovery: () => void;
}

/**
 * Connects one exact runtime session to the generic production React boundary.
 *
 * @remarks This is the only managed-surface composition seam in the application. It accepts no
 * arbitrary React node, component implementation, capability identifier, slot tree, or plan-shaped
 * value. Runtime-core owns the plan and `runtime-react` owns every managed element.
 */
export function ReferenceHostManagedSurface({
  input,
  recoveryKey,
  onRequestRecovery,
}: ReferenceHostManagedSurfaceProps) {
  const result = useRuntimeReactSurface(input);
  const renderFailure = useCallback(
    (failure: RuntimeReactSurfaceFailure) => (
      <ReferenceHostFailureView failure={failure} onRequestRecovery={onRequestRecovery} />
    ),
    [onRequestRecovery],
  );

  return (
    <RuntimeReactSurfaceBoundary
      recoveryKey={recoveryKey}
      renderFailure={renderFailure}
      result={result}
    />
  );
}
