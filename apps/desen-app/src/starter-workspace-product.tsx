import { useSyncExternalStore } from "react";

import { DesenAppProduct } from "./product-bootstrap.js";
import { STARTER_NEUTRAL_WORKSPACE_PROFILE } from "./starter-neutral-workspace-profile.js";

import type { DesenEditorPersistencePort } from "@desen/editor-core";
import type { EditableProjectRecord } from "@desen/design-system-core";
import type { ProjectLifecycleController } from "./project-lifecycle.js";

/** Props for the normal starter workspace over its one aggregate T02 persistence controller. */
export interface StarterWorkspaceProductProps {
  readonly initialProject: EditableProjectRecord;
  readonly lifecycle: ProjectLifecycleController;
  readonly persistencePort: DesenEditorPersistencePort | null;
}

/**
 * Renders the ordinary DESEN Neutral product while keeping its visible Style token selection tied
 * to the current persisted aggregate project record.
 *
 * @remarks The component does not open or save storage itself. The profile-bound editor port does
 * that through the same lifecycle controller. This external-store subscription merely prevents a
 * stale profile default from becoming the Style panel's token authority after a saved/reopened
 * project supplies a different admitted design-system selection.
 */
export function StarterWorkspaceProduct({
  initialProject,
  lifecycle,
  persistencePort,
}: Readonly<StarterWorkspaceProductProps>) {
  const state = useSyncExternalStore(lifecycle.subscribe, lifecycle.read, lifecycle.read);
  const project = state.workspace.projects.find(({ id }) => id === initialProject.id)?.record;
  return (
    <DesenAppProduct
      authoringProjectRecord={project ?? initialProject}
      persistencePort={persistencePort}
      workspaceProfile={STARTER_NEUTRAL_WORKSPACE_PROFILE}
    />
  );
}
