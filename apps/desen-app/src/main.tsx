import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SIGN_IN_OPERATION_ID } from "@desen/reference-catalog-web/operations";
import "@fontsource-variable/inter/index.css";

import { createAuthoringIntegrationBinding } from "./authoring-integration.js";
import { createInjectedDesenAppLocalProjectWorkspaceStoragePort } from "./local-project-workspace-persistence.js";
import { createInjectedDesenAppLocalPersistencePort } from "./local-runtime-persistence.js";
import { createInjectedDesenAppLocalPublicationPort } from "./local-runtime-publication.js";
import {
  createDesenAppLocalSignInOperation,
  readInjectedDesenAppLocalOperationConfig,
} from "./local-operation-binding.js";
import { DesenAppLocalWorkspaces } from "./local-workspaces.js";
import { DesenAppProduct } from "./product-bootstrap.js";
import {
  createEmptyProjectWorkspace,
  createProjectLifecycleController,
} from "./project-lifecycle.js";
import { createProjectWorkspaceAuthoringPersistencePort } from "./project-workspace-authoring-persistence.js";
import { normalizeInitialDesenAppLocation } from "./project-navigation.js";
import { REFERENCE_FLOW_WORKSPACE_PROFILE } from "./reference-flow-workspace-profile.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "./reference-sign-in-workspace-profile.js";
import { STARTER_NEUTRAL_WORKSPACE_PROFILE } from "./starter-neutral-workspace-profile.js";
import { createStarterProject } from "./starter-project.js";
import { StarterWorkspaceProduct } from "./starter-workspace-product.js";
import "./styles.css";

import type { DesenEditorPersistencePort } from "@desen/editor-core";
import type { AuthoringIntegrationBindingHandle } from "./authoring-integration.js";
import type { AuthoringPublicationPort } from "./authoring-publication.js";
import type { ProjectLifecycleController } from "./project-lifecycle.js";

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
const starterProject = createStarterProject("desen-neutral");
let starterLifecycle: ProjectLifecycleController | null = null;
let starterPersistencePort: DesenEditorPersistencePort | null = null;
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
try {
  const storagePort = createInjectedDesenAppLocalProjectWorkspaceStoragePort(
    globalThis.fetch.bind(globalThis),
    { workspaceKey: "desen-neutral-workspace" },
  );
  if (storagePort !== null) {
    const lifecycle = createProjectLifecycleController({
      initialWorkspace: createEmptyProjectWorkspace(),
      storagePort,
    });
    const bridge =
      lifecycle === null
        ? Object.freeze({ ok: false as const })
        : createProjectWorkspaceAuthoringPersistencePort({
            lifecycle,
            initialProject: starterProject.record,
            projectName: "DESEN Neutral",
            sourceKey: "desen-neutral-source",
            surfaceNames: starterProject.surfaceNames,
          });
    if (lifecycle !== null && bridge.ok) {
      starterLifecycle = lifecycle;
      starterPersistencePort = bridge.persistencePort;
    }
  }
} catch {
  // Starter is aggregate-workspace-only. A malformed or unavailable project-workspace authority
  // cannot fall back to the legacy independent Source store.
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
              publicationPort={publicationPort}
              workspaceProfile={REFERENCE_FLOW_WORKSPACE_PROFILE}
            />
          ),
        },
        {
          profile: STARTER_NEUTRAL_WORKSPACE_PROFILE,
          render: () =>
            starterLifecycle === null ? (
              <DesenAppProduct
                authoringProjectRecord={starterProject.record}
                persistencePort={null}
                workspaceProfile={STARTER_NEUTRAL_WORKSPACE_PROFILE}
              />
            ) : (
              <StarterWorkspaceProduct
                initialProject={starterProject.record}
                lifecycle={starterLifecycle}
                persistencePort={starterPersistencePort}
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
  starterLifecycle?.dispose();
  root.unmount();
}

window.addEventListener("pagehide", disposeOnFinalPageHide);
