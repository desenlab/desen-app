import { LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS, openLocalControlPlane } from "../src/index.js";

import type {
  LocalControlPlane,
  LocalControlPlaneBundleRecord,
  LocalControlPlaneChannelRecord,
  LocalControlPlaneInjectResponse,
  LocalControlPlaneListenResult,
  LocalControlPlaneSourceRecord,
  OpenLocalControlPlaneOptions,
} from "../src/index.js";

const options = {
  rootDirectory: "/absolute/application-owned/control-plane",
  apiToken: "0123456789abcdef0123456789abcdef",
  allowedOrigins: ["https://desen.app"],
} as const satisfies OpenLocalControlPlaneOptions;

const opening: Promise<LocalControlPlane> = openLocalControlPlane(options);
declare const controlPlane: LocalControlPlane;
const injected: Promise<LocalControlPlaneInjectResponse> = controlPlane.inject({
  method: "PUT",
  path: "/v1/sources/sign-in",
  headers: {
    authorization: `Bearer ${options.apiToken}`,
    "content-type": "application/json",
    "if-none-match": "*",
  },
  body: new Uint8Array([123, 125]),
});
const listened: Promise<LocalControlPlaneListenResult> = controlPlane.listen(0);
const closed: Promise<void> = controlPlane.close();
const loopback: "127.0.0.1" = LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS;

declare const sourceRecord: LocalControlPlaneSourceRecord;
declare const bundleRecord: LocalControlPlaneBundleRecord;
declare const channelRecord: LocalControlPlaneChannelRecord;
declare const response: LocalControlPlaneInjectResponse;
declare const listenResult: LocalControlPlaneListenResult;
declare const configuredOptions: OpenLocalControlPlaneOptions;

const sourceBytes: Readonly<Uint8Array> = sourceRecord.bytes;
const bundleBytes: Readonly<Uint8Array> = bundleRecord.bytes;
const channelRevision: string = channelRecord.revision;
const responseBytes: Readonly<Uint8Array> = response.body;
const listenAddress: "127.0.0.1" = listenResult.address;

// @ts-expect-error Opening a control plane always requires a host-supplied bearer token.
void openLocalControlPlane({ rootDirectory: "/absolute/application-owned/control-plane" });
// @ts-expect-error The factory deliberately exposes no caller-selected host or remote bind option.
void openLocalControlPlane({ ...options, host: "0.0.0.0" });
// @ts-expect-error Listening accepts only a port; callers cannot select an address or socket.
void controlPlane.listen({ host: "0.0.0.0", port: 3000 });
// @ts-expect-error Request bodies must be exact Uint8Array byte views.
void controlPlane.inject({ method: "PUT", path: "/v1/sources/sign-in", body: "{}" });
// @ts-expect-error M07-T05 grants no activation authority.
void controlPlane.activate(bundleRecord.revision);
// @ts-expect-error Runtime staging belongs to M07-T06.
void controlPlane.stage(bundleRecord.revision);
// @ts-expect-error Rollback belongs to the later activation and recovery boundary.
void controlPlane.rollback();
// @ts-expect-error A channel pointer cannot set the active revision.
void controlPlane.setActive(bundleRecord.revision);
// @ts-expect-error Previous-good state is not exposed by the local distribution API.
void controlPlane.previousGood;
// @ts-expect-error M07-T05 exposes no destructive delete operation.
void controlPlane.delete(bundleRecord.revision);
// @ts-expect-error Local storage identities cannot be enumerated through a list operation.
void controlPlane.list();
// @ts-expect-error Public configuration is immutable after capture.
configuredOptions.apiToken = "fedcba9876543210fedcba9876543210";
// @ts-expect-error Source metadata fields are immutable at the contract boundary.
sourceRecord.generation = 2;
// @ts-expect-error Exact Source byte-view properties cannot be replaced.
sourceRecord.bytes = new Uint8Array();
// @ts-expect-error Immutable Bundle record fields cannot be replaced.
bundleRecord.revision = "sha256:mutated";
// @ts-expect-error Channel metadata fields are immutable at the contract boundary.
channelRecord.revision = bundleRecord.revision;
// @ts-expect-error Response byte-view properties cannot be replaced.
response.body = new Uint8Array();
// @ts-expect-error The listener address is fixed and immutable.
listenResult.address = "127.0.0.1";

void injected;
void opening;
void listened;
void closed;
void loopback;
void sourceBytes;
void bundleBytes;
void channelRevision;
void responseBytes;
void listenAddress;
