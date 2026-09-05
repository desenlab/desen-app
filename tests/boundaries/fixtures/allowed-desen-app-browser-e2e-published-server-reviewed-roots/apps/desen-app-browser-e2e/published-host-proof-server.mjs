import { openLocalControlPlane } from "../control-plane-api/dist/index.js";
import { openDesenAppLocalPublicationHost } from "../desen-app/dev/local-publication-host.mjs";
import { openReferenceHostWebServer } from "../reference-host-web-server/dist/index.js";

export const reviewedPublishedHostComposition = [
  openLocalControlPlane,
  openDesenAppLocalPublicationHost,
  openReferenceHostWebServer,
];
