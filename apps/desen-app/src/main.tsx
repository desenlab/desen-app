import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SIGN_IN_OPERATION_ID } from "@desen/reference-catalog-web/operations";

import { createAuthoringIntegrationBinding } from "./authoring-integration.js";
import { createInjectedDesenAppLocalPersistencePort } from "./local-runtime-persistence.js";
import { createInjectedDesenAppLocalPublicationPort } from "./local-runtime-publication.js";
import {
  createDesenAppLocalSignInOperation,
  readInjectedDesenAppLocalOperationConfig,
} from "./local-operation-binding.js";
import { DesenAppLocalWorkspaces } from "./local-workspaces.js";
import { DesenAppProduct } from "./product-bootstrap.js";
import { normalizeInitialDesenAppLocation } from "./project-navigation.js";
import { REFERENCE_FLOW_WORKSPACE_PROFILE } from "./reference-flow-workspace-profile.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "./reference-sign-in-workspace-profile.js";
import "./styles.css";

import type { DesenEditorPersistencePort } from "@desen/editor-core";
import type { AuthoringIntegrationBindingHandle } from "./authoring-integration.js";
import type { AuthoringPublicationPort } from "./authoring-publication.js";

normalizeInitialDesenAppLocation();

const container = document.getElementById("desen-app-root");
if (!(container instanceof Element)) {
  throw new TypeError("The Desen App root container is missing.");
}

let flowIntegration: AuthoringIntegrationBindingHandle | null = null;
try {
  const config = readInjectedDesenAppLocalOperationConfig();
  if (config !== null) {
    const binding = createAuthoringIntegrationBinding({
      profile: REFERENCE_FLOW_WORKSPACE_PROFILE,
      bindingId: "local-reference-account-service",
      label: "Local account service",
      description:
        "Real local HTTP service · test account only, not production authentication. Use designer@example.test and local-demo-pass.",
      operations: [
        {
          capabilityId: SIGN_IN_OPERATION_ID,
          effect: "network",
          invoke: createDesenAppLocalSignInOperation(config, globalThis.fetch.bind(globalThis)),
        },
      ],
    });
    if (binding.status === "created") flowIntegration = binding.binding;
  }
} catch {
  // A missing or rejected operation authority cannot fall back to a synthetic success or gain
  // persistence credentials. The independent workspace remains usable with Integration disabled.
}

let persistencePort: DesenEditorPersistencePort | null = null;
let publicationPort: AuthoringPublicationPort | null = null;
try {
  const browserFetch = globalThis.fetch.bind(globalThis);
  persistencePort = createInjectedDesenAppLocalPersistencePort(browserFetch);
} catch {
  // A missing or malformed local-runtime authority is represented by the product's controlled,
  // fixture-free unavailable state. Configuration details and credentials never cross into UI.
}
try {
  publicationPort = createInjectedDesenAppLocalPublicationPort(globalThis.fetch.bind(globalThis));
} catch {
  // Publication is an independent optional authority. A malformed activation profile cannot
  // disable Source persistence or silently acquire a broader destination.
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <DesenAppLocalWorkspaces
      workspaces={[
        {
          profile: REFERENCE_SIGN_IN_WORKSPACE_PROFILE,
          render: () => (
            <DesenAppProduct
              persistencePort={persistencePort}
              publicationPort={publicationPort}
              workspaceProfile={REFERENCE_SIGN_IN_WORKSPACE_PROFILE}
            />
          ),
        },
        {
          profile: REFERENCE_FLOW_WORKSPACE_PROFILE,
          render: () => (
            <DesenAppProduct
              integrationBinding={flowIntegration}
              persistencePort={persistencePort}
              workspaceProfile={REFERENCE_FLOW_WORKSPACE_PROFILE}
            />
          ),
        },
      ]}
    />
  </StrictMode>,
);

function disposeOnFinalPageHide(event: PageTransitionEvent): void {
  if (event.persisted) return;
  window.removeEventListener("pagehide", disposeOnFinalPageHide);
  root.unmount();
}

window.addEventListener("pagehide", disposeOnFinalPageHide);
