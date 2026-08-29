// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDesenAppProjectPath,
  installDesenAppNavigationGuard,
  navigateDesenApp,
  normalizeInitialDesenAppLocation,
  readDesenAppLocation,
  readDesenAppRoute,
  readDesenAppServerLocation,
  subscribeDesenAppNavigation,
} from "../src/project-navigation.js";

let removeNavigationGuard: (() => void) | null = null;

describe("Desen App project navigation", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/projects");
  });

  afterEach(() => {
    removeNavigationGuard?.();
    removeNavigationGuard = null;
    vi.restoreAllMocks();
  });

  it("reads only the bounded canonical shell routes", () => {
    expect(readDesenAppRoute("/")).toEqual({ kind: "projects", pathname: "/projects" });
    expect(readDesenAppRoute("/projects")).toEqual({
      kind: "projects",
      pathname: "/projects",
    });
    expect(readDesenAppRoute("/projects/account-app")).toEqual({
      kind: "project",
      pathname: "/projects/account-app",
      projectId: "account-app",
    });
    expect(readDesenAppRoute("/projects/account-app/surfaces/sign-in")).toEqual({
      kind: "project",
      pathname: "/projects/account-app/surfaces/sign-in",
      projectId: "account-app",
      surfaceId: "sign-in",
    });
  });

  it.each([
    "projects",
    "/Projects",
    "/project/account-app",
    "/projects/",
    "/projects//",
    "/projects/account-app/",
    "/projects/account-app/extra",
    "/projects/account_app",
    "/projects/account-app/surface/sign-in",
    "/projects/account-app/surfaces/",
    "/projects/account-app/surfaces/sign-in/",
    "/projects/account-app/surfaces/sign-in/extra",
    "/projects?mode=design",
    "/projects#workspace",
    "/projects/account-app?mode=design",
    "/projects/account-app/surfaces/sign-in#inspector",
  ])("rejects the non-canonical route %s", (pathname) => {
    expect(readDesenAppRoute(pathname)).toEqual({ kind: "not-found", pathname });
  });

  it.each([
    "/projects/%61ccount-app",
    "/projects/account%2Dapp",
    "/projects/%2e%2e",
    "/projects/account-app/surfaces/%73ign-in",
    "/projects/account-app/surfaces/sign%2Fin",
    "/projects/%",
  ])("rejects encoded and malformed route aliases instead of canonicalizing %s", (pathname) => {
    expect(readDesenAppRoute(pathname)).toEqual({ kind: "not-found", pathname });
  });

  it("rejects an unbounded route segment before it becomes shell state", () => {
    const longProjectId = "a".repeat(1_025);
    const pathname = `/projects/${longProjectId}`;

    expect(readDesenAppRoute(pathname)).toEqual({ kind: "not-found", pathname });
    expect(() => createDesenAppProjectPath(longProjectId)).toThrow(TypeError);
  });

  it("creates exact project and surface paths and rejects ambiguous segments", () => {
    expect(createDesenAppProjectPath("account-app")).toBe("/projects/account-app");
    expect(createDesenAppProjectPath("account-app", "sign-in")).toBe(
      "/projects/account-app/surfaces/sign-in",
    );

    for (const projectId of ["", "Account-app", "account_app", "account app", "account%2Dapp"]) {
      expect(() => createDesenAppProjectPath(projectId)).toThrow(TypeError);
    }
    for (const surfaceId of ["", "Sign-in", "sign_in", "sign in", "sign%2Din"]) {
      expect(() => createDesenAppProjectPath("account-app", surfaceId)).toThrow(TypeError);
    }
  });

  it("pushes and replaces same-document paths and publishes one app navigation event", () => {
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeDesenAppNavigation(onStoreChange);
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");

    navigateDesenApp("/projects");
    expect(pushState).not.toHaveBeenCalled();
    expect(onStoreChange).not.toHaveBeenCalled();

    navigateDesenApp("/projects/account-app");
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/projects/account-app");
    expect(readDesenAppLocation()).toBe("/projects/account-app");
    expect(onStoreChange).toHaveBeenCalledTimes(1);

    navigateDesenApp("/projects/account-app/surfaces/sign-in", true);
    expect(replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      "/projects/account-app/surfaces/sign-in",
    );
    expect(readDesenAppLocation()).toBe("/projects/account-app/surfaces/sign-in");
    expect(onStoreChange).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("admits canonical app navigation only through the current exact guard owner", () => {
    const firstGuard = vi.fn(() => false);
    const removeFirst = installDesenAppNavigationGuard(firstGuard);
    const secondGuard = vi.fn(() => false);
    removeNavigationGuard = installDesenAppNavigationGuard(secondGuard);
    const pushState = vi.spyOn(window.history, "pushState");

    removeFirst();
    navigateDesenApp("/projects");
    expect(secondGuard).not.toHaveBeenCalled();
    expect(() => navigateDesenApp("/projects?mode=design")).toThrow(TypeError);
    expect(secondGuard).not.toHaveBeenCalled();

    navigateDesenApp("/projects/account-app");
    expect(secondGuard).toHaveBeenCalledWith("/projects/account-app");
    expect(pushState).not.toHaveBeenCalled();
    expect(readDesenAppLocation()).toBe("/projects");

    secondGuard.mockReturnValue(true);
    navigateDesenApp("/projects/account-app");
    expect(pushState).toHaveBeenCalledWith(null, "", "/projects/account-app");
  });

  it("restores the last admitted location when traversal is canceled or guard admission throws", () => {
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeDesenAppNavigation(onStoreChange);
    const guard = vi.fn<() => boolean>(() => false);
    removeNavigationGuard = installDesenAppNavigationGuard(guard);

    window.history.pushState(null, "", "/projects/account-app");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(guard).toHaveBeenLastCalledWith("/projects/account-app");
    expect(readDesenAppLocation()).toBe("/projects");
    expect(onStoreChange).not.toHaveBeenCalled();

    guard.mockImplementation(() => {
      throw new Error("prompt unavailable");
    });
    window.history.pushState(null, "", "/projects/account-app");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(readDesenAppLocation()).toBe("/projects");
    expect(onStoreChange).not.toHaveBeenCalled();

    guard.mockReturnValue(true);
    window.history.pushState(null, "", "/projects/account-app");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(readDesenAppLocation()).toBe("/projects/account-app");
    expect(onStoreChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("rejects cross-origin, query, hash, and credential-bearing destinations without mutation", () => {
    const originalLocation = window.location.href;
    const pushState = vi.spyOn(window.history, "pushState");

    for (const destination of [
      "https://example.test/projects",
      "https://user@example.test/projects",
      `//${window.location.host}/projects`,
      `//user@${window.location.host}/projects`,
      "/projects/../projects/account-app",
      "/projects\\account-app",
      "/projects?mode=design",
      "/projects#workspace",
      "/projects/account-app?surface=sign-in#canvas",
    ]) {
      expect(() => navigateDesenApp(destination)).toThrow(TypeError);
    }

    expect(pushState).not.toHaveBeenCalled();
    expect(window.location.href).toBe(originalLocation);
  });

  it("observes popstate and app transitions and removes both listeners on cleanup", () => {
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeDesenAppNavigation(onStoreChange);

    window.dispatchEvent(new PopStateEvent("popstate"));
    navigateDesenApp("/projects/account-app");
    expect(onStoreChange).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(onStoreChange).toHaveBeenCalledTimes(3);

    unsubscribe();
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    navigateDesenApp("/projects");
    expect(onStoreChange).toHaveBeenCalledTimes(3);
  });

  it("replaces only the exact bare root and leaves query or fragment inputs fail-closed", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    window.history.replaceState(null, "", "/");
    replaceState.mockClear();

    normalizeInitialDesenAppLocation();

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/projects");
    expect(window.location.pathname).toBe("/projects");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");

    window.history.replaceState(null, "", "/?mode=design#workspace");
    replaceState.mockClear();
    normalizeInitialDesenAppLocation();
    expect(replaceState).not.toHaveBeenCalled();
    expect(readDesenAppLocation()).toBe("/?mode=design#workspace");
    expect(readDesenAppRoute(readDesenAppLocation()).kind).toBe("not-found");
  });

  it("publishes a complete client location and stable server snapshot", () => {
    window.history.replaceState(null, "", "/projects/account-app?mode=design#workspace");

    expect(readDesenAppLocation()).toBe("/projects/account-app?mode=design#workspace");
    expect(readDesenAppRoute(readDesenAppLocation()).kind).toBe("not-found");
    expect(readDesenAppServerLocation()).toBe("/projects");
  });
});
