import { bindReferenceSignInHostOperation } from "@desen/reference-catalog-web/host-operations";

import {
  createReferenceHostChannelDelivery,
  refreshReferenceHostChannel,
} from "../src/channel-delivery.js";

import type {
  ReferenceHostChannelDeliveryFetch,
  ReferenceHostChannelDeliveryHandle,
} from "../src/channel-delivery.js";
import type { ReferenceHostRootHandle } from "../src/root.js";

declare const browser: Window;
declare const delivery: ReferenceHostChannelDeliveryHandle;
declare const root: ReferenceHostRootHandle;

const fetchChannel: ReferenceHostChannelDeliveryFetch = async (resource, init) => {
  const exactResource: "/__desen/runtime/refresh" = resource;
  void exactResource;
  void init;
  return new Response(null, { status: 204 });
};
const signIn = bindReferenceSignInHostOperation(() =>
  Object.freeze({ status: "failed", errorCode: "unavailable" }),
);

const valid = createReferenceHostChannelDelivery({
  browser,
  fetch: fetchChannel,
  reportDiagnostic: () => undefined,
  root,
  signIn,
});

createReferenceHostChannelDelivery({
  browser,
  fetch: fetchChannel,
  reportDiagnostic: () => undefined,
  root,
  signIn,
  // @ts-expect-error M07-T11-N01 Channel selection remains server-owned.
  channel: "custom",
});

createReferenceHostChannelDelivery({
  browser,
  fetch: fetchChannel,
  reportDiagnostic: () => undefined,
  root,
  signIn,
  // @ts-expect-error M07-T11-N02 A bearer token cannot enter the browser delivery seam.
  token: "secret",
});

createReferenceHostChannelDelivery({
  browser,
  fetch: fetchChannel,
  reportDiagnostic: () => undefined,
  root,
  signIn,
  // @ts-expect-error M07-T11-N03 Upstream origins remain server-owned.
  upstreamOrigin: "https://control-plane.invalid",
});

createReferenceHostChannelDelivery({
  browser,
  fetch: fetchChannel,
  reportDiagnostic: () => undefined,
  root,
  signIn,
  // @ts-expect-error M07-T11-N04 Installed package paths cannot enter browser code.
  installedPackagePath: "/private/package",
});

createReferenceHostChannelDelivery({
  browser,
  fetch: fetchChannel,
  reportDiagnostic: () => undefined,
  root,
  signIn,
  // @ts-expect-error M07-T11-N05 Previous-good identity remains server-private.
  previousGoodRevision: "sha256:private",
});

refreshReferenceHostChannel(delivery);
// @ts-expect-error M07-T11-N06 The browser cannot select a revision during refresh.
refreshReferenceHostChannel(delivery, "sha256:selected");

void valid;
