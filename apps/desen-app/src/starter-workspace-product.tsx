import { useSyncExternalStore } from "react";

import { DesenAppProduct } from "./product-bootstrap.js";
import { STARTER_NEUTRAL_WORKSPACE_PROFILE } from "./starter-neutral-workspace-profile.js";
import { ProjectAuthoringContext } from "./project-authoring-context.js";

import type { DesenEditorPersistencePort } from "@desen/editor-core";
import type { EditableProjectRecord } from "@desen/design-system-core";
import type { ProjectLifecycleController } from "./project-lifecycle.js";
import type { ProjectAuthoringController } from "./project-authoring-controller.js";

const readUnavailable = () => null;
const subscribeUnavailable = () => () => undefined;

/** Props for the normal starter workspace over its one aggregate T02 persistence controller. */
export interface StarterWorkspaceProductProps {
  /** Main-owned whole-project draft retained across surface remounts. */
  readonly authoringController?: ProjectAuthoringController | null;
  readonly initialProject: EditableProjectRecord;
  readonly lifecycle: ProjectLifecycleController;
  readonly persistencePort: DesenEditorPersistencePort | null;
}

/**
 * Renders the ordinary DESEN Neutral product with its main-owned aggregate draft retained above
 * route-keyed editors. Style selection and recipe controls observe that same complete project.
 *
 * @remarks The component does not open or save storage itself. The profile-bound editor port does
 * that through the same lifecycle controller. Legacy embeddings without aggregate authoring retain
 * their existing persisted-project token projection; normal main supplies the authenticated draft.
 */
export function StarterWorkspaceProduct({
  authoringController = null,
  initialProject,
  lifecycle,
  persistencePort,
}: Readonly<StarterWorkspaceProductProps>) {
  const state = useSyncExternalStore(lifecycle.subscribe, lifecycle.read, lifecycle.read);
  const authoring = useSyncExternalStore(
    authoringController?.subscribe ?? subscribeUnavailable,
    authoringController?.read ?? readUnavailable,
    authoringController?.read ?? readUnavailable,
  );
  const project = state.workspace.projects.find(({ id }) => id === initialProject.id)?.record;
  return (
    <ProjectAuthoringContext.Provider value={authoringController}>
      <DesenAppProduct
        authoringProjectRecord={authoring?.session.record ?? project ?? initialProject}
        persistencePort={persistencePort}
        workspaceProfile={STARTER_NEUTRAL_WORKSPACE_PROFILE}
      />
    </ProjectAuthoringContext.Provider>
  );
}
