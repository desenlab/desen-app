/**
 * Loopback server composition for the independently built DESEN Web reference host.
 *
 * @packageDocumentation
 */

export {
  REFERENCE_HOST_DELIVERY_ENVELOPE_BYTES,
  REFERENCE_HOST_MAX_DELIVERY_BYTES,
  openReferenceHostChannelActivationController,
} from "./channel-activation-controller.js";
export { createReferenceHostControlPlaneClient } from "./control-plane-client.js";
export { loadReferenceHostInstalledPackage } from "./installed-package-inventory.js";
export { openReferenceHostWebServer } from "./server.js";

export type {
  OpenReferenceHostChannelActivationControllerOptions,
  ReferenceHostActivationIdentity,
  ReferenceHostActiveDelivery,
  ReferenceHostChannelActivationController,
  ReferenceHostChannelRefreshResult,
} from "./channel-activation-controller.js";
export type {
  CreateReferenceHostControlPlaneClientOptions,
  ReferenceHostBundleEntry,
  ReferenceHostChannelRecord,
  ReferenceHostControlPlaneClient,
  ReferenceHostControlPlaneReadResult,
} from "./control-plane-client.js";
export type { LoadReferenceHostInstalledPackageOptions } from "./installed-package-inventory.js";
export type {
  OpenReferenceHostWebServerOptions,
  ReferenceHostWebServer,
  ReferenceHostWebServerListenResult,
} from "./server.js";
