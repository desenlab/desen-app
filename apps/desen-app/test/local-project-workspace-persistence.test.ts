// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import {
  createDesenAppLocalProjectWorkspaceStoragePort,
  createInjectedDesenAppLocalProjectWorkspaceStoragePort,
} from "../src/local-project-workspace-persistence.js";
import { DESEN_APP_LOCAL_RUNTIME_PROFILE } from "../src/local-runtime-persistence.js";
import { createStarterProject } from "../src/starter-project.js";

import type { DesenAppLocalRuntimeBrowserFetch } from "../src/local-runtime-persistence.js";

const API_TOKEN = "0123456789abcdef0123456789abcdef";
const ORIGIN = "http://127.0.0.1:43127";
const WORKSPACE_KEY = "desen-neutral";

function runtimeConfig() {
  return {
    profile: DESEN_APP_LOCAL_RUNTIME_PROFILE,
    controlPlane: {
      origin: ORIGIN,
      apiToken: API_TOKEN,
    },
  };
}

function workspace(): unknown {
  const starter = createStarterProject("desen-neutral");
  return {
    kind: "desen.app.project-workspace",
    schemaVersion: 1,
    projects: [
      {
        id: starter.record.id,
        name: "DESEN Neutral",
        record: starter.record,
        surfaceOrder: ["home"],
        surfaceNames: starter.surfaceNames,
      },
    ],
    deletedProjects: [],
  };
}

function jsonResponse(value: unknown, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function savedWorkspaceResponse(value: unknown, generation: number): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", etag: `"g:${String(generation)}"` },
  });
}

describe("local application project-workspace persistence", () => {
  it("writes the complete admitted T02 project registry through only its fixed workspace route", async () => {
    const calls: Readonly<{ readonly init: RequestInit; readonly input: string }>[] = [];
    const browserFetch: DesenAppLocalRuntimeBrowserFetch = vi.fn(async (input, init) => {
      calls.push(Object.freeze({ input, init }));
      return jsonResponse({ generation: 1, status: "created", workspaceKey: WORKSPACE_KEY }, 201, {
        etag: '"g:1"',
      });
    });
    const port = createDesenAppLocalProjectWorkspaceStoragePort(runtimeConfig(), browserFetch, {
      workspaceKey: WORKSPACE_KEY,
    });
    const candidate = workspace();

    await expect(
      port.saveWorkspace({ expectedGeneration: null, workspace: candidate as never }),
    ).resolves.toEqual({ status: "created", generation: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(`${ORIGIN}/v1/project-workspaces/${WORKSPACE_KEY}`);
    expect(calls[0]?.init).toMatchObject({
      method: "PUT",
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      mode: "cors",
      referrerPolicy: "no-referrer",
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        "content-type": "application/json",
        "if-none-match": "*",
      },
    });
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
    const body = calls[0]?.init.body;
    expect(typeof body).toBe("string");
    const saved = JSON.parse(body as string) as Record<string, unknown>;
    const project = (saved.projects as Record<string, unknown>[])[0]?.record as Record<
      string,
      unknown
    >;
    expect(project.designSystem).toEqual(
      expect.objectContaining({
        tokenSources: expect.arrayContaining([
          expect.objectContaining({ id: "neutral.base" }),
          expect.objectContaining({ id: "neutral.light" }),
        ]),
      }),
    );
    expect(calls[0]?.input).not.toContain("/v1/sources/");
  });

  it("reopens only an app-admitted aggregate registry and maps a known missing response", async () => {
    const candidate = workspace();
    const fetches: DesenAppLocalRuntimeBrowserFetch[] = [
      async () =>
        jsonResponse(
          {
            error: {
              code: "PROJECT_WORKSPACE_NOT_FOUND",
              message: "The requested application project workspace was not found.",
            },
          },
          404,
        ),
      async () => savedWorkspaceResponse(candidate, 4),
      async () => savedWorkspaceResponse({ kind: "desen.app.project-workspace" }, 5),
    ];
    let index = 0;
    const port = createDesenAppLocalProjectWorkspaceStoragePort(
      runtimeConfig(),
      async (input: string, init: RequestInit) => {
        expect(input).toBe(`${ORIGIN}/v1/project-workspaces/${WORKSPACE_KEY}`);
        expect(init.method).toBe("GET");
        const current = fetches[index];
        index += 1;
        if (current === undefined) throw new TypeError("Unexpected fetch");
        return current(input, init);
      },
      { workspaceKey: WORKSPACE_KEY },
    );

    await expect(port.openWorkspace()).resolves.toEqual({ status: "missing" });
    await expect(port.openWorkspace()).resolves.toMatchObject({
      status: "opened",
      generation: 4,
      workspace: expect.objectContaining({
        projects: [expect.objectContaining({ id: "desen-neutral" })],
      }),
    });
    await expect(port.openWorkspace()).resolves.toEqual({ status: "failed" });
  });

  it("preserves uncertain writes and rejects invalid local identities before issuing a request", async () => {
    const rejectedFetch: DesenAppLocalRuntimeBrowserFetch = async () => {
      throw new TypeError("network detail that must not escape");
    };
    const port = createDesenAppLocalProjectWorkspaceStoragePort(runtimeConfig(), rejectedFetch, {
      workspaceKey: WORKSPACE_KEY,
    });
    await expect(
      port.saveWorkspace({ expectedGeneration: null, workspace: workspace() as never }),
    ).resolves.toEqual({ status: "indeterminate" });

    const neverFetch = vi.fn();
    expect(() =>
      createDesenAppLocalProjectWorkspaceStoragePort(runtimeConfig(), neverFetch, {
        workspaceKey: "not a workspace key",
      }),
    ).toThrow("The Desen App local runtime configuration is invalid.");
    expect(neverFetch).not.toHaveBeenCalled();
  });

  it("has no ambient injected-config fallback in ordinary browser tests", () => {
    expect(
      createInjectedDesenAppLocalProjectWorkspaceStoragePort(undefined, {
        workspaceKey: WORKSPACE_KEY,
      }),
    ).toBeNull();
  });
});
