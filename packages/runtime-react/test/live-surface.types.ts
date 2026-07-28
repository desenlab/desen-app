import {
  useRuntimeReactSurface,
  type RuntimeReactLiveSurfaceInput,
  type RuntimeReactLiveSurfaceResult,
} from "../src/index.js";

declare const input: RuntimeReactLiveSurfaceInput;

const result: RuntimeReactLiveSurfaceResult = useRuntimeReactSurface(input);

if (result.status === "rendered") {
  void result.surface.diagnosticIndex.byRuntimeNodeId;
  // @ts-expect-error Rendered surfaces are immutable.
  result.surface.nodeCount = 0;
} else if (result.failure.kind === "session") {
  void result.failure.reason;
  // @ts-expect-error Session failures never retain a stale rendered surface.
  void result.surface;
} else {
  void result.failure.failure.code;
  // @ts-expect-error Render failures do not expose a guessed fallback element.
  void result.failure.element;
}

// @ts-expect-error Exact host input requires the validated Catalog set.
useRuntimeReactSurface({
  registry: input.registry,
  session: input.session,
  serverSnapshot: input.serverSnapshot,
});
