import { createRuntimeWebBrowserPlatform } from "@desen/runtime-web";

import type { RuntimeJsonObject } from "@desen/runtime-core";
import type { RuntimeWebBrowserPlatformCreateResult } from "@desen/runtime-web";

const FALLBACK_ENVIRONMENT = Object.freeze({
  platform: "web",
}) as RuntimeJsonObject;

function finiteViewport(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function matches(browser: Window, query: string): boolean {
  return typeof browser.matchMedia === "function" && browser.matchMedia(query).matches;
}

function readBrowserEnvironment(browser: Window): RuntimeJsonObject | undefined {
  try {
    const width = finiteViewport(browser.innerWidth);
    const height = finiteViewport(browser.innerHeight);
    const locale =
      typeof browser.navigator.language === "string" && browser.navigator.language.length > 0
        ? browser.navigator.language
        : "und";
    return Object.freeze({
      viewport: Object.freeze({
        width,
        height,
        orientation: width >= height ? "landscape" : "portrait",
      }),
      pointer: matches(browser, "(pointer: fine)")
        ? "fine"
        : matches(browser, "(pointer: coarse)")
          ? "coarse"
          : "none",
      colorScheme: matches(browser, "(prefers-color-scheme: dark)") ? "dark" : "light",
      reducedMotion: matches(browser, "(prefers-reduced-motion: reduce)"),
      locale,
      platform: "web",
    });
  } catch {
    return undefined;
  }
}

function cleanupBrowserEnvironmentSubscriptions(cleanups: (() => void)[]): void {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup === undefined) continue;
    try {
      cleanup();
    } catch {
      // Each registered listener has an independent cleanup attempt. One hostile platform
      // removal cannot strand the remaining browser or media-query listeners.
    }
  }
}

function subscribeBrowserEnvironment(browser: Window, listener: () => void): () => void {
  let active = true;
  const notice = (): void => {
    if (!active) return;
    listener();
  };
  const cleanups: (() => void)[] = [];
  try {
    browser.addEventListener("resize", notice);
    cleanups.push(() => {
      browser.removeEventListener("resize", notice);
    });
    browser.addEventListener("languagechange", notice);
    cleanups.push(() => {
      browser.removeEventListener("languagechange", notice);
    });
    if (typeof browser.matchMedia === "function") {
      for (const query of [
        "(pointer: fine)",
        "(pointer: coarse)",
        "(prefers-color-scheme: dark)",
        "(prefers-reduced-motion: reduce)",
      ]) {
        const mediaQuery = browser.matchMedia(query);
        mediaQuery.addEventListener("change", notice);
        cleanups.push(() => {
          mediaQuery.removeEventListener("change", notice);
        });
      }
    }
  } catch {
    active = false;
    cleanupBrowserEnvironmentSubscriptions(cleanups);
    throw new TypeError("Reference-host browser environment subscription failed.");
  }

  return () => {
    if (!active) return;
    active = false;
    cleanupBrowserEnvironmentSubscriptions(cleanups);
  };
}

function readEpochMilliseconds(browser: Window, previous: { value: number }): number {
  let observed = previous.value;
  try {
    const timeOrigin = browser.performance.timeOrigin;
    const elapsed = browser.performance.now();
    const candidate = timeOrigin + elapsed;
    if (Number.isFinite(candidate) && candidate >= 0) observed = Math.max(observed, candidate);
  } catch {
    // Keep the last monotonic value when the browser clock is temporarily unavailable.
  }
  previous.value = observed;
  return observed;
}

/**
 * Creates the browser-specific environment and monotonic epoch-clock authority for the host.
 *
 * @remarks Browser globals are never read at module load. Environment callbacks are evaluated
 * only after runtime composition; subscriptions are lazy and return exact idempotent cleanup.
 */
export function createReferenceHostBrowserPlatform(
  browser: Window,
): RuntimeWebBrowserPlatformCreateResult {
  if (typeof browser !== "object" || browser === null) {
    return Object.freeze({ status: "rejected", reason: "malformed-input" });
  }
  const lastEpochMilliseconds = { value: 0 };
  let lastEnvironmentSnapshot = FALLBACK_ENVIRONMENT;
  return createRuntimeWebBrowserPlatform({
    environment: Object.freeze({
      getSnapshot: () => {
        const observed = readBrowserEnvironment(browser);
        if (observed !== undefined) lastEnvironmentSnapshot = observed;
        return lastEnvironmentSnapshot;
      },
      subscribe: (listener: () => void) => subscribeBrowserEnvironment(browser, listener),
    }),
    clock: Object.freeze({
      now: () => readEpochMilliseconds(browser, lastEpochMilliseconds),
    }),
  });
}
