import { createDesenEditorDocument } from "@desen/editor-core";
import { createRuntimeHostPorts, snapshotRuntimeJsonValue } from "@desen/runtime-core";

import type { DesenEditorDocument } from "@desen/editor-core";
import type {
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeNavigationPort,
  RuntimeOperationPort,
} from "@desen/runtime-core";

const EMPTY_CONTEXT: RuntimeJsonObject = Object.freeze({});
const DENIED = Object.freeze({ status: "denied" } as const);

/** One transient managed-surface destination, never a browser URL or a Source mutation. */
export interface AuthoringRunDestination {
  readonly surfaceId: string;
  /** Detached values exposed only as `context.params` in the next managed surface. */
  readonly params: RuntimeJsonObject;
}

/** Exact preview identity and App-owned admission for one managed navigation lifetime. */
export interface AuthoringRunNavigationInput {
  readonly document: DesenEditorDocument;
  readonly revision: string;
  readonly surfaceId: string;
  /** Read synchronously, including between a mode click and React's next effect cleanup. */
  readonly isRunActive: () => boolean;
  readonly onNavigate: (destination: AuthoringRunDestination) => boolean;
}

/** Revocable navigation authority for one exact preview surface and revision. */
export interface AuthoringRunNavigationController {
  readonly navigationPort: RuntimeNavigationPort;
  readonly activate: () => void;
  readonly deactivate: () => void;
  readonly dispose: () => void;
}

function exactRecord(value: unknown, keys: readonly string[]): RuntimeJsonObject | null {
  const captured = snapshotRuntimeJsonValue(value);
  if (
    captured === undefined ||
    captured === null ||
    typeof captured !== "object" ||
    Array.isArray(captured)
  ) {
    return null;
  }
  const record = captured as RuntimeJsonObject;
  const actual = Object.keys(record);
  return actual.length === keys.length && actual.every((key) => keys.includes(key)) ? record : null;
}

/**
 * Admits local managed navigation without handing Runtime the editor's browser navigation port.
 *
 * @remarks A successful transition terminally revokes this origin. The next surface is mounted
 * from the same authored document by the App; navigation never rewrites Source entry, history,
 * persistence or publication. Callers must explicitly activate this inert-by-default lifetime.
 */
export function createAuthoringRunNavigationController(
  input: AuthoringRunNavigationInput,
): AuthoringRunNavigationController {
  const admitted = createDesenEditorDocument(input.document);
  if (
    !admitted.ok ||
    !Object.hasOwn(admitted.document.surfaces, input.surfaceId) ||
    typeof input.revision !== "string" ||
    input.revision.length === 0 ||
    input.revision.length > 256 ||
    typeof input.isRunActive !== "function" ||
    typeof input.onNavigate !== "function"
  ) {
    throw new TypeError("Run navigation requires an admitted preview identity.");
  }
  const documentId = admitted.document.id;
  const surfaceIds = new Set(Object.keys(admitted.document.surfaces));
  const { revision, surfaceId, isRunActive, onNavigate } = input;
  let active = false;
  let terminal = false;
  let transitioning = false;
  let epoch = 0;
  return Object.freeze({
    navigationPort: Object.freeze({
      navigate(request) {
        if (!active || terminal || transitioning) return DENIED;
        const requestEpoch = epoch;
        transitioning = true;
        try {
          const captured = exactRecord(request, ["context", "targetSurfaceId", "params"]);
          const context = exactRecord(captured?.context, [
            "documentId",
            "revision",
            "surfaceId",
            "requestId",
          ]);
          const params = captured?.params;
          if (
            captured === null ||
            context === null ||
            context.documentId !== documentId ||
            context.revision !== revision ||
            context.surfaceId !== surfaceId ||
            typeof context.requestId !== "string" ||
            context.requestId.length === 0 ||
            context.requestId.length > 256 ||
            typeof captured.targetSurfaceId !== "string" ||
            !surfaceIds.has(captured.targetSurfaceId) ||
            params === null ||
            typeof params !== "object" ||
            Array.isArray(params) ||
            !active ||
            terminal ||
            epoch !== requestEpoch ||
            !isRunActive() ||
            !active ||
            terminal ||
            epoch !== requestEpoch
          )
            return DENIED;
          if (
            !onNavigate(
              Object.freeze({
                surfaceId: captured.targetSurfaceId,
                params: params as RuntimeJsonObject,
              }),
            )
          ) {
            return DENIED;
          }
          terminal = true;
          active = false;
          return Object.freeze({ status: "succeeded" });
        } catch {
          return DENIED;
        } finally {
          transitioning = false;
        }
      },
    } satisfies RuntimeNavigationPort),
    activate: () => {
      if (!terminal) active = true;
    },
    deactivate: () => {
      active = false;
      epoch += 1;
    },
    dispose: () => {
      active = false;
      terminal = true;
      epoch += 1;
    },
  });
}

/**
 * Creates a least-authority Run host from explicit operations and local managed navigation.
 *
 * @remarks No product host port is inherited. Storage, resources, tokens, diagnostics and real
 * environment remain inert in both Synthetic and Integration. Navigation parameters are bounded
 * transient JSON; they grant no executable authority and are never persisted by this boundary.
 */
export function createAuthoringRunHostPorts(
  operations: RuntimeOperationPort,
  navigation: RuntimeNavigationPort,
  params: RuntimeJsonObject = EMPTY_CONTEXT,
): RuntimeHostPorts {
  const captured = snapshotRuntimeJsonValue(params);
  if (
    captured === undefined ||
    captured === null ||
    typeof captured !== "object" ||
    Array.isArray(captured)
  ) {
    throw new TypeError("Run navigation parameters must be bounded JSON data.");
  }
  const context =
    Object.keys(captured).length === 0 ? EMPTY_CONTEXT : Object.freeze({ params: captured });
  return createRuntimeHostPorts({
    navigation,
    storage: {
      getBundle: () => Object.freeze({ status: "missing" }),
      putBundle: () => Object.freeze({ status: "conflict" }),
      readActivation: () => Object.freeze({ status: "missing" }),
      commitActivation: () => Object.freeze({ status: "conflict", generation: null }),
    },
    operations,
    resources: { load: () => DENIED },
    tokens: { resolve: () => Object.freeze({ status: "missing" }) },
    context: { getSnapshot: () => context, subscribe: () => () => undefined },
    environment: { getSnapshot: () => EMPTY_CONTEXT, subscribe: () => () => undefined },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  });
}
