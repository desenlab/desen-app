import "./styles.css";

import { activateReferenceHostOfficialSignIn } from "./official-sign-in.js";
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
const activation = activateReferenceHostOfficialSignIn(referenceHostRoot, {
  browser: window,
  signIn,
  reportDiagnostic: () => undefined,
});
if (activation.status !== "activated") {
  disposeReferenceHostRoot(referenceHostRoot);
  throw new TypeError("The reference sign-in application could not activate safely.");
}

function disposeOnFinalPageHide(event: PageTransitionEvent): void {
  if (event.persisted) return;
  window.removeEventListener("pagehide", disposeOnFinalPageHide);
  disposeReferenceHostRoot(referenceHostRoot);
}

window.addEventListener("pagehide", disposeOnFinalPageHide);
