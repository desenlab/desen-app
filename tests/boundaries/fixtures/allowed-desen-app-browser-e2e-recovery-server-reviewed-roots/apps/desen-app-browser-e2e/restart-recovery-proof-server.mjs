import { openLocalControlPlane } from "../control-plane-api/dist/index.js";
import { openReferenceHostWebServer } from "../reference-host-web-server/dist/index.js";
import { openDesenAppLocalPublicationHost } from "../desen-app/dev/local-publication-host.mjs";
import { calculateDesenBundleRevision } from "../../packages/protocol/dist/index.js";

export const reviewedRecoveryComposition = [
  openLocalControlPlane,
  openReferenceHostWebServer,
  openDesenAppLocalPublicationHost,
  calculateDesenBundleRevision,
];
