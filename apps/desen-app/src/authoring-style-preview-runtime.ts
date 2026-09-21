import { createRuntimeHostPorts, snapshotRuntimeJsonValue } from "@desen/runtime-core";

import type {
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeNavigationPort,
  RuntimeOperationPort,
  RuntimeResourcePort,
  RuntimeTokenPort,
} from "@desen/runtime-core";

const EMPTY_CONTEXT: RuntimeJsonObject = Object.freeze({});
const DENIED = Object.freeze({ status: "denied" } as const);

/** The finite responsive preview environments owned by the App Style panel. */
export type AuthoringStylePreviewViewportId = "desktop" | "tablet" | "mobile";

/**
 * A bounded, App-owned desktop preview frame.
 *
 * @remarks This is deliberately presentation state, not a Source viewport or an authorable
 * breakpoint. It exists so T11's resizable base canvas and the Runtime environment used to
 * render that same canvas cannot disagree about `env.viewport`.
 */
export interface AuthoringStyleDesktopPreviewFrame {
  /** Positive integral CSS-pixel width of the current base canvas preview. */
  readonly width: number;
  /** Positive integral CSS-pixel height of the current base canvas preview. */
  readonly height: number;
}

/**
 * Fixed preview viewports paired with T12's closed responsive variant breakpoints.
 *
 * @remarks Tablet is exactly the `<= 1024` edge and mobile is safely inside the `<= 767` edge.
 * No CSS media query, browser dimension, or user-supplied environment JSON enters Source.
 */
export const AUTHORING_STYLE_PREVIEW_VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ height: 900, orientation: "landscape", width: 1440 }),
  tablet: Object.freeze({ height: 768, orientation: "landscape", width: 1024 }),
  mobile: Object.freeze({ height: 844, orientation: "portrait", width: 390 }),
} satisfies Readonly<Record<AuthoringStylePreviewViewportId, RuntimeJsonObject>>);

const MAX_DESKTOP_PREVIEW_DIMENSION = 16_384;

function desktopPreviewViewport(frame: AuthoringStyleDesktopPreviewFrame): RuntimeJsonObject {
  if (
    !Number.isSafeInteger(frame.width) ||
    !Number.isSafeInteger(frame.height) ||
    frame.width < 1 ||
    frame.height < 1 ||
    frame.width > MAX_DESKTOP_PREVIEW_DIMENSION ||
    frame.height > MAX_DESKTOP_PREVIEW_DIMENSION
  ) {
    throw new TypeError(
      "Desktop style preview frame must use bounded positive integer dimensions.",
    );
  }
  return Object.freeze({
    height: frame.height,
    orientation:
      frame.height > frame.width ? "portrait" : frame.height < frame.width ? "landscape" : "square",
    width: frame.width,
  });
}

function captureParams(value: unknown): RuntimeJsonObject {
  const captured = snapshotRuntimeJsonValue(value);
  if (
    captured === undefined ||
    captured === null ||
    typeof captured !== "object" ||
    Array.isArray(captured)
  ) {
    throw new TypeError("Run navigation parameters must be bounded JSON data.");
  }
  return Object.keys(captured).length === 0 ? EMPTY_CONTEXT : Object.freeze({ params: captured });
}

function viewportFor(
  value: unknown,
  desktopPreviewFrame: AuthoringStyleDesktopPreviewFrame | undefined,
): RuntimeJsonObject {
  if (value === "desktop" || value === "tablet" || value === "mobile") {
    if (desktopPreviewFrame !== undefined) {
      if (value !== "desktop") {
        throw new TypeError("Only the base desktop preview may use a resizable canvas frame.");
      }
      return desktopPreviewViewport(desktopPreviewFrame);
    }
    return AUTHORING_STYLE_PREVIEW_VIEWPORTS[value];
  }
  throw new TypeError("Style preview requires a known responsive viewport.");
}

/**
 * Creates the least-authority Runtime host used when the Style panel previews an explicit
 * desktop, tablet, or mobile layer.
 *
 * @remarks The only added authority compared with the ordinary Run host is a frozen, App-owned
 * viewport snapshot plus the caller's already-resolved persisted-project token lookup. The
 * optional frame is accepted only for the base desktop canvas and is validated before it becomes
 * the inert host environment; it never enters Source. Storage, resources, diagnostics, and all
 * real browser/environment access remain unavailable.
 */
export function createAuthoringStylePreviewHostPorts(
  operations: RuntimeOperationPort,
  navigation: RuntimeNavigationPort,
  params: RuntimeJsonObject | undefined,
  resolveToken: RuntimeTokenPort["resolve"],
  viewportId: AuthoringStylePreviewViewportId,
  desktopPreviewFrame?: AuthoringStyleDesktopPreviewFrame,
  resources: RuntimeResourcePort = { load: () => DENIED },
): RuntimeHostPorts {
  if (typeof resolveToken !== "function") {
    throw new TypeError("Style preview requires a resolved project token lookup.");
  }
  const context = captureParams(params ?? EMPTY_CONTEXT);
  const viewport = viewportFor(viewportId, desktopPreviewFrame);
  const environment = Object.freeze({ platform: "web", viewport });
  return createRuntimeHostPorts({
    navigation,
    storage: {
      getBundle: () => Object.freeze({ status: "missing" }),
      putBundle: () => Object.freeze({ status: "conflict" }),
      readActivation: () => Object.freeze({ status: "missing" }),
      commitActivation: () => Object.freeze({ status: "conflict", generation: null }),
    },
    operations,
    resources,
    tokens: Object.freeze({ resolve: resolveToken }),
    context: { getSnapshot: () => context, subscribe: () => () => undefined },
    environment: { getSnapshot: () => environment, subscribe: () => () => undefined },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  });
}
