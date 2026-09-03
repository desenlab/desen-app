import { Fragment, useMemo, useState, useSyncExternalStore } from "react";

import {
  navigateDesenApp,
  readDesenAppLocation,
  readDesenAppRoute,
  readDesenAppServerLocation,
  subscribeDesenAppNavigation,
} from "./project-navigation.js";
import { readProjectWorkspaceProfileAuthority } from "./project-workspace-profile.js";
import styles from "./local-workspaces.module.css";

import type { ReactNode } from "react";
import type {
  ProjectWorkspaceProfileHandle,
  ProjectWorkspaceProfileSnapshot,
} from "./project-workspace-profile.js";

const MAX_LOCAL_WORKSPACES = 64;

/** One trusted composition root and its independently authenticated workspace identity. */
export interface DesenAppLocalWorkspace {
  /** Factory-created authority; a URL, serialized object, or lookalike grants no authority. */
  readonly profile: ProjectWorkspaceProfileHandle;
  /** Trusted host-owned renderer, invoked only while this exact workspace is selected. */
  readonly render: () => ReactNode;
}

/** Complete closed inventory of workspaces installed by the local application host. */
export interface DesenAppLocalWorkspacesProps {
  /** The first authenticated workspace remains the default for an unqualified projects route. */
  readonly workspaces: readonly DesenAppLocalWorkspace[];
}

interface AuthenticatedWorkspace {
  readonly handle: ProjectWorkspaceProfileHandle;
  readonly profile: ProjectWorkspaceProfileSnapshot;
  readonly render: () => ReactNode;
}

function authenticateWorkspaces(value: unknown): readonly AuthenticatedWorkspace[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length === 0 ||
      value.length > MAX_LOCAL_WORKSPACES ||
      Reflect.ownKeys(value).length !== value.length + 1
    ) {
      return null;
    }
    const handles = new Set<ProjectWorkspaceProfileHandle>();
    const profileIds = new Set<string>();
    const projectIds = new Set<string>();
    const documentIds = new Set<string>();
    const sourceKeys = new Set<string>();
    const workspaces: AuthenticatedWorkspace[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return null;
      }
      const entry: unknown = descriptor.value;
      if (
        entry === null ||
        typeof entry !== "object" ||
        (Object.getPrototypeOf(entry) !== Object.prototype &&
          Object.getPrototypeOf(entry) !== null) ||
        Reflect.ownKeys(entry).length !== 2
      ) {
        return null;
      }
      const profileDescriptor = Object.getOwnPropertyDescriptor(entry, "profile");
      const renderDescriptor = Object.getOwnPropertyDescriptor(entry, "render");
      if (
        profileDescriptor === undefined ||
        renderDescriptor === undefined ||
        !profileDescriptor.enumerable ||
        !renderDescriptor.enumerable ||
        !("value" in profileDescriptor) ||
        !("value" in renderDescriptor) ||
        typeof renderDescriptor.value !== "function"
      ) {
        return null;
      }
      const authority = readProjectWorkspaceProfileAuthority(profileDescriptor.value);
      if (authority.status !== "read") return null;
      const handle = profileDescriptor.value as ProjectWorkspaceProfileHandle;
      const profile = authority.profile;
      if (
        handles.has(handle) ||
        profileIds.has(profile.profileId) ||
        projectIds.has(profile.project.id) ||
        documentIds.has(profile.documentId) ||
        sourceKeys.has(profile.sourceKey)
      ) {
        return null;
      }
      handles.add(handle);
      profileIds.add(profile.profileId);
      projectIds.add(profile.project.id);
      documentIds.add(profile.documentId);
      sourceKeys.add(profile.sourceKey);
      workspaces.push(
        Object.freeze({ handle, profile, render: renderDescriptor.value as () => ReactNode }),
      );
    }
    return Object.freeze(workspaces);
  } catch {
    return null;
  }
}

function ConfiguredLocalWorkspaces({
  workspaces,
}: Readonly<{ readonly workspaces: readonly AuthenticatedWorkspace[] }>) {
  const location = useSyncExternalStore(
    subscribeDesenAppNavigation,
    readDesenAppLocation,
    readDesenAppServerLocation,
  );
  const route = readDesenAppRoute(location);
  const routedWorkspace =
    route.kind === "project"
      ? workspaces.find(
          ({ profile }) =>
            profile.project.id === route.projectId &&
            (route.surfaceId === undefined ||
              profile.project.surfaces.some(({ id }) => id === route.surfaceId)),
        )
      : undefined;
  const [retainedHandle, setRetainedHandle] = useState(
    () => routedWorkspace?.handle ?? workspaces[0]?.handle,
  );

  // Commit route-derived selection before a missing workspace can redirect to /projects in its
  // mount effect. Waiting for an effect here would briefly reopen the unrelated default Source.
  if (routedWorkspace !== undefined && retainedHandle !== routedWorkspace.handle) {
    setRetainedHandle(routedWorkspace.handle);
  }

  const activeWorkspace =
    route.kind === "projects"
      ? (workspaces.find(({ handle }) => handle === retainedHandle) ?? workspaces[0])
      : routedWorkspace;

  return (
    <>
      <label className={styles.chooser}>
        <span>Workspace</span>
        <select
          aria-label="Local workspace"
          onChange={(event) => {
            const target = workspaces.find(
              ({ profile }) => profile.profileId === event.currentTarget.value,
            );
            if (target !== undefined && target.handle !== activeWorkspace?.handle) {
              // Only an admitted navigation event may switch mounts. Dirty-source vetoes keep
              // both the selected option and the currently mounted controller unchanged.
              navigateDesenApp(target.profile.surfacePath);
            }
          }}
          value={activeWorkspace?.profile.profileId ?? ""}
        >
          {activeWorkspace === undefined ? <option value="">Choose workspace</option> : null}
          {workspaces.map(({ profile }) => (
            <option key={profile.profileId} value={profile.profileId}>
              {profile.project.name}
            </option>
          ))}
        </select>
      </label>
      {activeWorkspace === undefined ? (
        <main className={styles.unavailable}>
          <h1>Workspace not found</h1>
          <p>Choose an installed workspace to continue. This address grants no workspace access.</p>
        </main>
      ) : (
        <Fragment key={activeWorkspace.profile.profileId}>{activeWorkspace.render()}</Fragment>
      )}
    </>
  );
}

/**
 * Selects only host-installed authenticated workspaces through the existing guarded App router.
 *
 * @remarks Selection never creates profiles, writes Sources, or bypasses the current editor's
 * dirty-navigation guard. The chooser is floating App chrome, outside the managed canvas tree.
 */
export function DesenAppLocalWorkspaces({ workspaces }: DesenAppLocalWorkspacesProps) {
  const authenticated = useMemo(() => authenticateWorkspaces(workspaces), [workspaces]);
  if (authenticated === null) {
    return (
      <main className={styles.unavailable} role="alert">
        <h1>Workspace unavailable</h1>
        <p>The installed workspace identities could not be authenticated. Nothing was opened.</p>
      </main>
    );
  }
  return <ConfiguredLocalWorkspaces workspaces={authenticated} />;
}
