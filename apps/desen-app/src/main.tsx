import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createInjectedDesenAppLocalPersistencePort } from "./local-runtime-persistence.js";
import { DesenAppProduct } from "./product-bootstrap.js";
import { normalizeInitialDesenAppLocation } from "./project-navigation.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "./reference-sign-in-workspace-profile.js";
import "./styles.css";

import type { DesenEditorPersistencePort } from "@desen/editor-core";

normalizeInitialDesenAppLocation();

const container = document.getElementById("desen-app-root");
if (!(container instanceof Element)) {
  throw new TypeError("The Desen App root container is missing.");
}

let persistencePort: DesenEditorPersistencePort | null = null;
try {
  const browserFetch = globalThis.fetch.bind(globalThis);
  persistencePort = createInjectedDesenAppLocalPersistencePort(browserFetch);
} catch {
  // A missing or malformed local-runtime authority is represented by the product's controlled,
  // fixture-free unavailable state. Configuration details and credentials never cross into UI.
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <DesenAppProduct
      persistencePort={persistencePort}
      workspaceProfile={REFERENCE_SIGN_IN_WORKSPACE_PROFILE}
    />
  </StrictMode>,
);

function disposeOnFinalPageHide(event: PageTransitionEvent): void {
  if (event.persisted) return;
  window.removeEventListener("pagehide", disposeOnFinalPageHide);
  root.unmount();
}

window.addEventListener("pagehide", disposeOnFinalPageHide);
