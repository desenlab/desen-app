import { createContext, useContext } from "react";

import { authenticateProjectAuthoringControllerProfile } from "./project-authoring-controller.js";

import type { ProjectAuthoringController } from "./project-authoring-controller.js";
import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";

/** Product-owned aggregate authority, retained above keyed surface editors and their history. */
export const ProjectAuthoringContext = createContext<ProjectAuthoringController | null>(null);

/** Reads the current product authority; a different profile cannot borrow its project or history. */
export function useProjectAuthoringController(
  profile: ProjectWorkspaceProfileHandle,
): ProjectAuthoringController | null {
  const controller = useContext(ProjectAuthoringContext);
  if (controller !== null && !authenticateProjectAuthoringControllerProfile(controller, profile))
    throw new TypeError("The aggregate authoring controller belongs to another workspace profile.");
  return controller;
}
