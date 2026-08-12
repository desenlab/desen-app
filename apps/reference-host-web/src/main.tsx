import "./styles.css";

import {
  createReferenceHostChannelDelivery,
  disposeReferenceHostChannelDelivery,
  refreshReferenceHostChannel,
} from "./channel-delivery.js";
import { createReferenceHostRoot, disposeReferenceHostRoot } from "./root.js";
import { createReferenceHostSignInHttpBinding } from "./sign-in-http-handler.js";

const container = document.getElementById("desen-reference-host-root");
if (!(container instanceof Element)) {
  throw new TypeError("The reference-host root container is missing.");
}

const referenceHostRoot = createReferenceHostRoot({
  container,
  reportDiagnostic: () => undefined,
});

const signIn = createReferenceHostSignInHttpBinding((resource, init) =>
  window.fetch(resource, init),
);
const channelDelivery = createReferenceHostChannelDelivery({
  browser: window,
  fetch: (resource, init) => window.fetch(resource, init),
  root: referenceHostRoot,
  signIn,
  reportDiagnostic: () => undefined,
});

function refreshAfterPageShow(event: PageTransitionEvent): void {
  if (!event.persisted) return;
  void refreshReferenceHostChannel(channelDelivery);
}

function disposeOnFinalPageHide(event: PageTransitionEvent): void {
  if (event.persisted) return;
  window.removeEventListener("pagehide", disposeOnFinalPageHide);
  window.removeEventListener("pageshow", refreshAfterPageShow);
  disposeReferenceHostChannelDelivery(channelDelivery);
  disposeReferenceHostRoot(referenceHostRoot);
}

window.addEventListener("pageshow", refreshAfterPageShow);
window.addEventListener("pagehide", disposeOnFinalPageHide);
void refreshReferenceHostChannel(channelDelivery);
