/// <reference types="node" />

import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { openLocalControlPlane } from "@desen/control-plane-api";
import { createLocalDesenBundleChannelPublicationPort } from "@desen/editor-web";
import { calculateDesenSourceDigest, canonicalizeJsonBytes } from "@desen/protocol";
import { openReferenceHostChannelActivationController } from "@desen/reference-host-web-server";
import { afterEach, describe, expect, it } from "vitest";

import {
  createAuthoringPublicationController,
  createFixedDestinationAuthoringPublicationPort,
} from "../src/authoring-publication.js";
import { readProjectWorkspaceProfileAuthority } from "../src/project-workspace-profile.js";
import {
  prepareReferenceAuthoringPreviewBundle as prepareAuthoringPreviewBundle,
  REFERENCE_AUTHORING_WORKSPACE_PROFILE,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/reference-authoring-profile.js";

import type { LocalControlPlane } from "@desen/control-plane-api";
import type {
  LocalDesenBundleChannelPublicationFetch,
  LocalDesenBundleChannelPublicationFetchRequest,
  LocalDesenBundleChannelPublicationResult,
} from "@desen/editor-web";
import type {
  ReferenceHostChannelActivationController,
  ReferenceHostChannelRefreshResult,
} from "@desen/reference-host-web-server";
import type {
  AuthoringPublicationController,
  AuthoringPublicationPort,
  AuthoringPublicationSnapshot,
  AuthoringHostActivationRequest,
} from "../src/authoring-publication.js";

const API_TOKEN = "m09-t14-public-loopback-token-000001";
const SOURCE_GENERATION = 37;
const ROUTE = Object.freeze({ projectId: "account-app", surfaceId: "sign-in" });
const PROFILE_AUTHORITY = readProjectWorkspaceProfileAuthority(
  REFERENCE_AUTHORING_WORKSPACE_PROFILE,
);
if (PROFILE_AUTHORITY.status !== "read" || PROFILE_AUTHORITY.profile.publication === null) {
  throw new TypeError("The reference workspace profile must authorize publication in this test.");
}
const CHANNEL_NAME = PROFILE_AUTHORITY.profile.publication.channelName;
const HOST_ID = PROFILE_AUTHORITY.profile.publication.hostId;
const WORKSPACE_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const INSTALLED_PACKAGE_DIRECTORY = join(WORKSPACE_ROOT, "packages/reference-catalog-web");
const TRANSIENT_SCENARIO_VALUE = "m09-t14-scenario-only-title";
const TRANSIENT_RUNTIME_INPUT = "m09-t14-runtime-input@example.test";
const TRANSIENT_SECRET = "m09-t14-runtime-secret-never-publish";

const EXPECTED_PREVIEW = prepareAuthoringPreviewBundle(REFERENCE_EDITOR_DOCUMENT);
if (!EXPECTED_PREVIEW.ok) {
  throw new TypeError("The saved reference Source must publish for the real integration test.");
}
const EXPECTED_BUNDLE = EXPECTED_PREVIEW.bundle;
const EXPECTED_REVISION = EXPECTED_PREVIEW.revision;
const EXPECTED_BUNDLE_BYTES = canonicalizeJsonBytes(EXPECTED_BUNDLE);

interface RealPublicationEnvironment {
  readonly root: string;
  readonly controlPlane: LocalControlPlane;
  readonly referenceHost: ReferenceHostChannelActivationController;
  readonly publicationPort: AuthoringPublicationPort;
  readonly channelSettlements: LocalDesenBundleChannelPublicationResult<string>[];
  readonly activationRequests: AuthoringHostActivationRequest[];
  readonly activationRefreshes: ReferenceHostChannelRefreshResult[];
  readonly publicationRequestBodies: Uint8Array[];
}

const roots: string[] = [];
const controlPlanes: LocalControlPlane[] = [];
const referenceHosts: ReferenceHostChannelActivationController[] = [];

function snapshot(): AuthoringPublicationSnapshot {
  return Object.freeze({
    document: REFERENCE_EDITOR_DOCUMENT,
    savedDocument: REFERENCE_EDITOR_DOCUMENT,
    sourceGeneration: SOURCE_GENERATION,
    persistenceAuthority: "ready",
    previewRevision: EXPECTED_REVISION,
  });
}

function copiedRequestBody(
  request: LocalDesenBundleChannelPublicationFetchRequest,
): Uint8Array<ArrayBuffer> | undefined {
  if (request.body === undefined) return undefined;
  const copy = new Uint8Array(request.body.byteLength);
  copy.set(request.body);
  return copy;
}

function loopbackFetch(
  publicationRequestBodies: Uint8Array[],
): LocalDesenBundleChannelPublicationFetch {
  return async (request) => {
    const requestBody = copiedRequestBody(request);
    if (requestBody !== undefined) publicationRequestBodies.push(new Uint8Array(requestBody));
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      redirect: request.redirect,
      ...(requestBody === undefined ? {} : { body: requestBody }),
    });
    const headers: Record<string, string> = Object.create(null) as Record<string, string>;
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });
    return Object.freeze({
      status: response.status,
      headers: Object.freeze(headers),
      body: new Uint8Array(await response.arrayBuffer()),
    });
  };
}

async function openEnvironment(): Promise<RealPublicationEnvironment> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "desen-app-publication-")));
  roots.push(root);
  const controlPlane = await openLocalControlPlane({ rootDirectory: root, apiToken: API_TOKEN });
  controlPlanes.push(controlPlane);
  const listener = await controlPlane.listen(0);
  const publicationRequestBodies: Uint8Array[] = [];
  const channelPort = createLocalDesenBundleChannelPublicationPort({
    origin: listener.origin,
    apiToken: API_TOKEN,
    channelName: CHANNEL_NAME,
    fetch: loopbackFetch(publicationRequestBodies),
  });
  const referenceHost = await openReferenceHostChannelActivationController({
    rootDirectory: root,
    installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
    controlPlaneOrigin: listener.origin,
    controlPlaneApiToken: API_TOKEN,
    channelName: CHANNEL_NAME,
  });
  referenceHosts.push(referenceHost);

  const channelSettlements: LocalDesenBundleChannelPublicationResult<string>[] = [];
  const activationRequests: AuthoringHostActivationRequest[] = [];
  const activationRefreshes: ReferenceHostChannelRefreshResult[] = [];
  const publicationPort = createFixedDestinationAuthoringPublicationPort({
    channelName: CHANNEL_NAME,
    hostId: HOST_ID,
    async publishBundleToChannel(request) {
      const settlement = await channelPort.publishBundleToChannel(request);
      channelSettlements.push(settlement);
      return settlement;
    },
    async activatePublishedRevision(request: AuthoringHostActivationRequest) {
      activationRequests.push(request);
      if (request.hostId !== HOST_ID) return Object.freeze({ status: "failed" as const });
      const published = channelSettlements.at(-1);
      if (
        published?.status !== "published" ||
        published.channelName !== request.channelName ||
        published.channelGeneration !== request.channelGeneration ||
        published.revision !== request.revision
      ) {
        return Object.freeze({ status: "failed" as const });
      }
      const refresh = await referenceHost.refresh();
      activationRefreshes.push(refresh);
      if (refresh.status === "available") {
        return Object.freeze({
          status: "active" as const,
          relationship: refresh.relationship,
          activeRevision: refresh.delivery.activation.revision,
          activationGeneration: refresh.delivery.activation.generation,
        });
      }
      return Object.freeze({ status: refresh.status === "unavailable" ? "unavailable" : "failed" });
    },
  });

  return Object.freeze({
    root,
    controlPlane,
    referenceHost,
    publicationPort,
    channelSettlements,
    activationRequests,
    activationRefreshes,
    publicationRequestBodies,
  });
}

function requireController(
  environment: RealPublicationEnvironment,
): AuthoringPublicationController {
  const created = createAuthoringPublicationController({
    profile: REFERENCE_AUTHORING_WORKSPACE_PROFILE,
    route: ROUTE,
    snapshot: snapshot(),
    publicationPort: environment.publicationPort,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new TypeError(`Expected a publication controller, got ${created.reason}.`);
  return created.controller;
}

function authenticatedGet(
  controlPlane: LocalControlPlane,
  path: string,
): ReturnType<LocalControlPlane["inject"]> {
  return controlPlane.inject({
    method: "GET",
    path,
    headers: Object.freeze({ authorization: `Bearer ${API_TOKEN}` }),
  });
}

function parseJson(bytes: Readonly<Uint8Array>): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

afterEach(async () => {
  referenceHosts.splice(0).forEach((controller) => controller.close());
  await Promise.all(controlPlanes.splice(0).map(async (controlPlane) => controlPlane.close()));
  await Promise.all(
    roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })),
  );
});

describe("real saved-Source publication and durable reference-host activation", () => {
  it("rejects a host activation request that does not match the authenticated profile binding", async () => {
    const environment = await openEnvironment();

    await expect(
      environment.publicationPort.activatePublishedRevision({
        channelName: CHANNEL_NAME,
        channelGeneration: 1,
        hostId: "another-host",
        revision: EXPECTED_REVISION,
      }),
    ).resolves.toEqual({ status: "failed" });
    expect(environment.activationRefreshes).toHaveLength(0);
    expect(environment.referenceHost.readDelivery()).toBeUndefined();
  });

  it("keeps exact saved Source, Publisher Bundle, fixed channel, and active revision equal", async () => {
    const environment = await openEnvironment();
    const forbiddenSnapshot = {
      ...snapshot(),
      scenario: Object.freeze({ title: TRANSIENT_SCENARIO_VALUE }),
      runtimeInput: Object.freeze({ email: TRANSIENT_RUNTIME_INPUT, password: TRANSIENT_SECRET }),
      secret: TRANSIENT_SECRET,
    };
    expect(
      createAuthoringPublicationController({
        profile: REFERENCE_AUTHORING_WORKSPACE_PROFILE,
        route: ROUTE,
        snapshot: forbiddenSnapshot as never,
        publicationPort: environment.publicationPort,
      }),
    ).toEqual({ ok: false, reason: "snapshot-invalid" });
    expect(environment.channelSettlements).toHaveLength(0);

    const result = await requireController(environment).publish();
    expect(result).toEqual({
      status: "published",
      relationship: "activated",
      channelName: CHANNEL_NAME,
      revision: EXPECTED_REVISION,
      sourceGeneration: SOURCE_GENERATION,
      channelGeneration: 1,
      activationGeneration: 0,
    });
    expect(EXPECTED_BUNDLE.sourceDigest).toBe(
      calculateDesenSourceDigest(REFERENCE_EDITOR_DOCUMENT),
    );
    expect(environment.channelSettlements).toEqual([
      {
        status: "published",
        channelName: CHANNEL_NAME,
        revision: EXPECTED_REVISION,
        bundleStatus: "stored",
        channelStatus: "created",
        channelGeneration: 1,
      },
    ]);

    const storedBundle = await authenticatedGet(
      environment.controlPlane,
      `/v1/bundles/${EXPECTED_REVISION}`,
    );
    expect(storedBundle.statusCode).toBe(200);
    expect(storedBundle.body).toEqual(EXPECTED_BUNDLE_BYTES);
    const channel = await authenticatedGet(
      environment.controlPlane,
      `/v1/channels/${CHANNEL_NAME}`,
    );
    expect(channel.statusCode).toBe(200);
    expect(parseJson(channel.body)).toEqual({
      channelName: CHANNEL_NAME,
      generation: 1,
      revision: EXPECTED_REVISION,
    });
    const delivery = environment.referenceHost.readDelivery();
    expect(delivery?.bundle).toEqual(EXPECTED_BUNDLE);
    expect(environment.activationRequests).toEqual([
      {
        channelName: CHANNEL_NAME,
        channelGeneration: 1,
        hostId: HOST_ID,
        revision: EXPECTED_REVISION,
      },
    ]);
    const firstChannelSettlement = environment.channelSettlements[0];
    expect([
      result.revision,
      firstChannelSettlement?.status === "published" ? firstChannelSettlement.revision : undefined,
      (parseJson(channel.body) as { readonly revision: string }).revision,
      delivery?.activation.revision,
      (delivery?.bundle as { readonly revision?: string } | undefined)?.revision,
    ]).toEqual(Array.from({ length: 5 }, () => EXPECTED_REVISION));

    const forbiddenValues = [
      TRANSIENT_SCENARIO_VALUE,
      TRANSIENT_RUNTIME_INPUT,
      TRANSIENT_SECRET,
      API_TOKEN,
    ];
    const publishedBodies = [
      new TextDecoder().decode(storedBundle.body),
      JSON.stringify(delivery),
      ...environment.publicationRequestBodies.map((body) => new TextDecoder().decode(body)),
    ];
    for (const body of publishedBodies) {
      for (const forbidden of forbiddenValues) expect(body).not.toContain(forbidden);
    }
  });

  it("keeps repeated publication unchanged and preserves the durable active revision", async () => {
    const environment = await openEnvironment();
    const controller = requireController(environment);

    await expect(controller.publish()).resolves.toMatchObject({
      status: "published",
      relationship: "activated",
      channelGeneration: 1,
      activationGeneration: 0,
    });
    await expect(controller.publish()).resolves.toEqual({
      status: "published",
      relationship: "preserved",
      channelName: CHANNEL_NAME,
      revision: EXPECTED_REVISION,
      sourceGeneration: SOURCE_GENERATION,
      channelGeneration: 1,
      activationGeneration: 0,
    });

    expect(environment.channelSettlements).toEqual([
      expect.objectContaining({
        status: "published",
        bundleStatus: "stored",
        channelStatus: "created",
        channelGeneration: 1,
      }),
      expect.objectContaining({
        status: "published",
        bundleStatus: "unchanged",
        channelStatus: "unchanged",
        channelGeneration: 1,
      }),
    ]);
    expect(environment.activationRefreshes).toEqual([
      expect.objectContaining({ status: "available", relationship: "activated" }),
      expect.objectContaining({ status: "available", relationship: "preserved" }),
    ]);
    expect(environment.activationRequests).toEqual([
      {
        channelName: CHANNEL_NAME,
        channelGeneration: 1,
        hostId: HOST_ID,
        revision: EXPECTED_REVISION,
      },
      {
        channelName: CHANNEL_NAME,
        channelGeneration: 1,
        hostId: HOST_ID,
        revision: EXPECTED_REVISION,
      },
    ]);
    expect(environment.referenceHost.readDelivery()?.activation).toEqual({
      generation: 0,
      revision: EXPECTED_REVISION,
    });
  });
});
