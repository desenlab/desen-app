import { describe, expect, it, vi } from "vitest";

import {
  DESEN_APP_LOCAL_RUNTIME_PROFILE,
  DesenAppLocalRuntimeConfigurationError,
  captureDesenAppLocalRuntimeConfig,
  createDesenAppLocalPersistencePort,
  createInjectedDesenAppLocalPersistencePort,
} from "../src/local-runtime-persistence.js";
import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "../src/reference-empty-project.js";

import type { DesenAppLocalRuntimeBrowserFetch } from "../src/local-runtime-persistence.js";

const API_TOKEN = "0123456789abcdef0123456789abcdef";
const ORIGIN = "http://127.0.0.1:43127";
const SOURCE_KEY = "account-app-source";

function runtimeConfig() {
  return {
    profile: DESEN_APP_LOCAL_RUNTIME_PROFILE,
    controlPlane: {
      origin: ORIGIN,
      apiToken: API_TOKEN,
    },
  };
}

function missingResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: "SOURCE_NOT_FOUND",
        message: "The requested editable Source was not found.",
      },
    }),
    {
      status: 404,
      headers: { "content-type": "application/json" },
    },
  );
}

describe("Desen App local runtime persistence composition", () => {
  it("captures only the exact injected loopback profile as a detached frozen config", () => {
    const raw = runtimeConfig() as {
      controlPlane: { apiToken: string; origin: string };
      profile: string;
    };
    const captured = captureDesenAppLocalRuntimeConfig(raw);

    raw.controlPlane.origin = "http://127.0.0.1:9999";

    expect(captured).toEqual({
      profile: DESEN_APP_LOCAL_RUNTIME_PROFILE,
      controlPlane: { origin: ORIGIN, apiToken: API_TOKEN },
    });
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.controlPlane)).toBe(true);
  });

  it.each([
    null,
    {},
    { ...runtimeConfig(), extra: true },
    {
      profile: "desen.app.local-runtime.v2",
      controlPlane: { origin: ORIGIN, apiToken: API_TOKEN },
    },
    {
      profile: DESEN_APP_LOCAL_RUNTIME_PROFILE,
      controlPlane: { origin: "http://localhost:43127", apiToken: API_TOKEN },
    },
    {
      profile: DESEN_APP_LOCAL_RUNTIME_PROFILE,
      controlPlane: { origin: ORIGIN, apiToken: "short" },
    },
    Object.defineProperty({ profile: DESEN_APP_LOCAL_RUNTIME_PROFILE }, "controlPlane", {
      enumerable: true,
      get: () => ({ origin: ORIGIN, apiToken: API_TOKEN }),
    }),
  ])("rejects malformed or active injected config without disclosing caller values", (value) => {
    expect(() => captureDesenAppLocalRuntimeConfig(value)).toThrowError(
      new DesenAppLocalRuntimeConfigurationError("INVALID_CONFIG"),
    );
    try {
      captureDesenAppLocalRuntimeConfig(value);
    } catch (error) {
      expect(String(error)).not.toContain(API_TOKEN);
      expect(String(error)).not.toContain("localhost");
    }
  });

  it("binds the public persistence port to one exact credential-free browser request profile", async () => {
    const calls: Readonly<{ init: RequestInit; input: string }>[] = [];
    const browserFetch: DesenAppLocalRuntimeBrowserFetch = vi.fn(async (input, init) => {
      calls.push(Object.freeze({ input, init }));
      return missingResponse();
    });
    const port = createDesenAppLocalPersistencePort(runtimeConfig(), browserFetch);

    await expect(port.openSource(SOURCE_KEY)).resolves.toEqual({ status: "missing" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(`${ORIGIN}/v1/sources/${SOURCE_KEY}`);
    expect(calls[0]?.init).toMatchObject({
      method: "GET",
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      mode: "cors",
      referrerPolicy: "no-referrer",
    });
    expect(calls[0]?.init.headers).toEqual({ authorization: `Bearer ${API_TOKEN}` });
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("preserves uncertain PUT settlement and bounds response bytes before adapter admission", async () => {
    const rejectedFetch: DesenAppLocalRuntimeBrowserFetch = async () => {
      throw new TypeError("network detail that must not escape");
    };
    const rejectedPort = createDesenAppLocalPersistencePort(runtimeConfig(), rejectedFetch);

    const saveResult = await rejectedPort.saveSource({
      sourceKey: SOURCE_KEY,
      expectedGeneration: null,
      document: EMPTY_REFERENCE_PROJECT_DOCUMENT,
    });
    expect(saveResult.status).toBe("indeterminate");

    const oversizedFetch: DesenAppLocalRuntimeBrowserFetch = async () =>
      new Response("{}", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": "8388609",
        },
      });
    const oversizedPort = createDesenAppLocalPersistencePort(runtimeConfig(), oversizedFetch);
    const openResult = await oversizedPort.openSource(SOURCE_KEY);
    expect(openResult.status).toBe("failed");
    if (openResult.status === "failed") {
      expect(openResult.diagnostic.code).toBe("run.desen.editor/PERSISTENCE_STORAGE_UNAVAILABLE");
    }
  });

  it("requires an explicit fetch capability and has no injected-config fallback in normal tests", () => {
    expect(() => createDesenAppLocalPersistencePort(runtimeConfig(), undefined)).toThrowError(
      new DesenAppLocalRuntimeConfigurationError("INVALID_FETCH"),
    );
    expect(createInjectedDesenAppLocalPersistencePort(undefined)).toBeNull();
  });
});
