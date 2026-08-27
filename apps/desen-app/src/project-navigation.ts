const DESEN_APP_NAVIGATION_EVENT = "desen-app:navigate";
const ROUTE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_ROUTE_LENGTH = 256;
const MAX_ROUTE_SEGMENT_LENGTH = 64;

/** Closed route profile owned by the M09-T01 Desen App shell. */
export type DesenAppRoute =
  | Readonly<{ readonly kind: "projects"; readonly pathname: "/projects" }>
  | Readonly<{
      readonly kind: "project";
      readonly pathname: string;
      readonly projectId: string;
      readonly surfaceId?: string;
    }>
  | Readonly<{ readonly kind: "not-found"; readonly pathname: string }>;

function decodeRouteSegment(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    return value === encodeURIComponent(decoded) && isRouteSegment(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function isRouteSegment(value: string): boolean {
  return value.length <= MAX_ROUTE_SEGMENT_LENGTH && ROUTE_SEGMENT.test(value);
}

/** Parses only the routes implemented by M09-T01 and rejects every ambiguous path. */
export function readDesenAppRoute(pathname: string): DesenAppRoute {
  if (
    pathname.length === 0 ||
    pathname.length > MAX_ROUTE_LENGTH ||
    !pathname.startsWith("/") ||
    pathname.includes("?") ||
    pathname.includes("#")
  ) {
    return Object.freeze({ kind: "not-found", pathname });
  }

  if (pathname === "/" || pathname === "/projects") {
    return Object.freeze({ kind: "projects", pathname: "/projects" });
  }

  const segments = pathname.split("/");
  if (segments[0] !== "" || segments[1] !== "projects") {
    return Object.freeze({ kind: "not-found", pathname });
  }

  if (segments.length === 3) {
    const projectId = decodeRouteSegment(segments[2] ?? "");
    if (projectId !== undefined) {
      return Object.freeze({
        kind: "project",
        pathname: `/projects/${encodeURIComponent(projectId)}`,
        projectId,
      });
    }
  }

  if (segments.length === 5 && segments[3] === "surfaces") {
    const projectId = decodeRouteSegment(segments[2] ?? "");
    const surfaceId = decodeRouteSegment(segments[4] ?? "");
    if (projectId !== undefined && surfaceId !== undefined) {
      return Object.freeze({
        kind: "project",
        pathname: `/projects/${encodeURIComponent(projectId)}/surfaces/${encodeURIComponent(surfaceId)}`,
        projectId,
        surfaceId,
      });
    }
  }

  return Object.freeze({ kind: "not-found", pathname });
}

function requireRouteSegment(value: string, label: string): string {
  if (!isRouteSegment(value)) {
    throw new TypeError(
      `${label} must be a lowercase kebab-case route segment no longer than ${MAX_ROUTE_SEGMENT_LENGTH} characters.`,
    );
  }
  return encodeURIComponent(value);
}

/** Creates the canonical shell path for one known project and optional surface. */
export function createDesenAppProjectPath(projectId: string, surfaceId?: string): string {
  const project = requireRouteSegment(projectId, "projectId");
  if (surfaceId === undefined) return `/projects/${project}`;
  return `/projects/${project}/surfaces/${requireRouteSegment(surfaceId, "surfaceId")}`;
}

/** Reads the complete browser route location for React's external-store contract. */
export function readDesenAppLocation(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/** Stable server snapshot used only when the client shell is rendered outside a browser. */
export function readDesenAppServerLocation(): string {
  return "/projects";
}

/** Subscribes to browser traversal, fragment drift, and app-owned same-document navigation. */
export function subscribeDesenAppNavigation(onStoreChange: () => void): () => void {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener(DESEN_APP_NAVIGATION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener(DESEN_APP_NAVIGATION_EVENT, onStoreChange);
  };
}

/** Performs one same-origin History API transition and notifies the mounted shell. */
export function navigateDesenApp(pathname: string, replace = false): void {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    throw new TypeError("Desen App navigation requires an absolute app pathname.");
  }
  const destination = new URL(pathname, window.location.href);
  if (destination.origin !== window.location.origin) {
    throw new TypeError("Desen App navigation must stay on the current origin.");
  }
  if (destination.search !== "" || destination.hash !== "") {
    throw new TypeError("Desen App shell routes do not accept query parameters or fragments.");
  }
  if (destination.username !== "" || destination.password !== "") {
    throw new TypeError("Desen App shell routes do not accept credentials.");
  }
  if (pathname !== destination.pathname) {
    throw new TypeError("Desen App navigation requires one canonical pathname without aliases.");
  }
  if (readDesenAppRoute(destination.pathname).kind === "not-found") {
    throw new TypeError("Desen App navigation requires one canonical shell route.");
  }
  if (readDesenAppLocation() === destination.pathname) return;
  if (replace) {
    window.history.replaceState(null, "", destination.pathname);
  } else {
    window.history.pushState(null, "", destination.pathname);
  }
  window.dispatchEvent(new Event(DESEN_APP_NAVIGATION_EVENT));
}

/** Replaces the bare root with the canonical projects route without adding a history entry. */
export function normalizeInitialDesenAppLocation(): void {
  if (
    window.location.pathname !== "/" ||
    window.location.search !== "" ||
    window.location.hash !== ""
  ) {
    return;
  }
  navigateDesenApp("/projects", true);
}
