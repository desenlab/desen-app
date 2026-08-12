import {
  createReferenceHostControlPlaneClient,
  openReferenceHostChannelActivationController,
  openReferenceHostWebServer,
} from "../src/index.js";

import type {
  ReferenceHostActiveDelivery,
  ReferenceHostChannelActivationController,
  ReferenceHostWebServer,
} from "../src/index.js";

const token = "reference-host-type-boundary-token";

createReferenceHostControlPlaneClient({
  origin: "http://127.0.0.1:4317",
  apiToken: token,
  channelName: "preview",
  // @ts-expect-error M07-T11-N01 Callers cannot replace the real loopback HTTP transport.
  fetch: () => Promise.reject(new Error("not admitted")),
});

void openReferenceHostChannelActivationController({
  rootDirectory: "/application/state",
  installedPackageDirectory: "/application/packages/reference-catalog-web",
  controlPlaneOrigin: "http://127.0.0.1:4317",
  controlPlaneApiToken: token,
  channelName: "preview",
  // @ts-expect-error M07-T11-N02 Bundle data cannot select installed package material.
  packageResolver: () => undefined,
});

void openReferenceHostWebServer({
  rootDirectory: "/application/state",
  installedPackageDirectory: "/application/packages/reference-catalog-web",
  clientBuildDirectory: "/application/reference-host-web/dist",
  controlPlaneOrigin: "http://127.0.0.1:4317",
  controlPlaneApiToken: token,
  channelName: "preview",
  // @ts-expect-error M07-T11-N03 The listener address is fixed to IPv4 loopback.
  host: "0.0.0.0",
});

declare const delivery: ReferenceHostActiveDelivery;
// @ts-expect-error M07-T11-N04 Public activation identity is immutable.
delivery.activation.generation = 2;
// @ts-expect-error M07-T11-N05 Delivery grants no durable activation authority.
void delivery.authority;

declare const controller: ReferenceHostChannelActivationController;
// @ts-expect-error M07-T11-N06 Channel consumers cannot activate caller-selected Bundle data.
void controller.activate({});
// @ts-expect-error M07-T11-N07 Channel mutation is outside the host controller boundary.
void controller.putChannel("preview", "sha256:deadbeef");

declare const server: ReferenceHostWebServer;
// @ts-expect-error M07-T11-N08 The bearer secret is never readable from the server handle.
void server.controlPlaneApiToken;
// @ts-expect-error M07-T11-N09 Static browser bytes are not a caller-provided response hook.
void server.setRefreshResponse(() => ({}));
