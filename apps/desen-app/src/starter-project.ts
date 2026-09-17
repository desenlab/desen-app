import { admitEditableProjectRecord } from "@desen/design-system-core";
import { DESEN_NEUTRAL_THEME_DOCUMENT } from "@desen/design-system-authoring";
import {
  createStarterNodeTemplate,
  STARTER_CATALOG_ID,
  STARTER_CATALOG_TARGET,
  STARTER_CATALOG_VERSION,
  STARTER_STACK_CAPABILITY_ID,
} from "@desen/starter-catalog-web";

import type { EditableProjectRecord } from "@desen/design-system-core";
import type { ProjectWorkspaceSurfaceName } from "./project-lifecycle.js";

const PROJECT_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const STARTER_SURFACE_ID = "home";

const neutralTheme = DESEN_NEUTRAL_THEME_DOCUMENT.themes.find(
  (theme) => theme.id === "desen-neutral",
);
const neutralLightMode = neutralTheme?.modes.find((mode) => mode.id === "light");
if (neutralTheme === undefined || neutralLightMode === undefined) {
  throw new TypeError("The installed DESEN Neutral light token foundation is unavailable.");
}

const STARTER_NEUTRAL_TOKEN_SOURCES = Object.freeze([
  Object.freeze({
    id: neutralTheme.base.id,
    document: neutralTheme.base.document,
    ...(neutralTheme.base.description === undefined
      ? {}
      : { description: neutralTheme.base.description }),
    ...(neutralTheme.base.extensions === undefined
      ? {}
      : { extensions: neutralTheme.base.extensions }),
  }),
  Object.freeze({
    id: neutralLightMode.source.id,
    document: neutralLightMode.source.document,
    ...(neutralLightMode.source.description === undefined
      ? {}
      : { description: neutralLightMode.source.description }),
    ...(neutralLightMode.source.extensions === undefined
      ? {}
      : { extensions: neutralLightMode.source.extensions }),
  }),
]);

/** An admitted blank project and the complete labels needed to place it in a T10 workspace. */
export interface StarterProject {
  /** Exact T02 envelope with one DESEN Neutral surface. */
  readonly record: EditableProjectRecord;
  /** Complete one-to-one human labels for its Source surfaces. */
  readonly surfaceNames: readonly ProjectWorkspaceSurfaceName[];
}

/**
 * Creates one blank standalone DESEN Neutral project from the installed starter catalog.
 *
 * @remarks The returned T02 envelope contains ordinary Source data only: a Stack root, one
 * declared portrait frame, no state, resource, action, operation, connection or host binding.
 * The factory never reads or mutates an existing M10 workspace profile or stored Source bytes.
 */
export function createStarterProject(projectId: string): StarterProject {
  if (typeof projectId !== "string" || !PROJECT_ID.test(projectId)) {
    throw new TypeError("Starter project id must be a finite local identifier.");
  }
  const admission = admitEditableProjectRecord({
    kind: "desen.editable-project",
    schemaVersion: 1,
    id: projectId,
    source: {
      kind: "desen.source",
      desen: "0.1.0",
      id: `com.desen.project.${projectId}`,
      catalogs: [
        {
          id: STARTER_CATALOG_ID,
          version: STARTER_CATALOG_VERSION,
          target: STARTER_CATALOG_TARGET,
        },
      ],
      entry: STARTER_SURFACE_ID,
      surfaces: {
        [STARTER_SURFACE_ID]: {
          id: STARTER_SURFACE_ID,
          state: {},
          resources: {},
          root: createStarterNodeTemplate({
            capabilityId: STARTER_STACK_CAPABILITY_ID,
            idPrefix: `${projectId}.home`,
          }),
        },
      },
      authoring: {
        canvas: {
          [STARTER_SURFACE_ID]: { x: 0, y: 0, width: 1440, height: 900 },
        },
      },
      extensions: {},
    },
    designSystem: { tokenSources: STARTER_NEUTRAL_TOKEN_SOURCES, recipes: [], assets: [] },
    connectionIntents: [],
  });
  if (!admission.ok) {
    throw new TypeError(
      "The installed starter catalog could not create an admitted blank project.",
    );
  }
  return Object.freeze({
    record: admission.record,
    surfaceNames: Object.freeze([Object.freeze({ id: STARTER_SURFACE_ID, name: "Home" })]),
  });
}
