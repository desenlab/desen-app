import type { ProjectWorkspaceProfileSnapshot } from "./project-workspace-profile.js";

/** One admitted surface exposed to the Desen App project shell. */
export interface DesenAppSurfaceSummary {
  /** URL-safe project-local route slug shown by the App shell. */
  readonly id: string;
  /** Exact DESEN Source surface identity; it is not constrained by URL-segment grammar. */
  readonly sourceId: string;
  readonly name: string;
  readonly state: "navigable" | "not-configured";
  readonly detail: string;
}

/** Read-only project summary presented by the Desen App shell. */
export interface DesenAppProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly catalog: string | undefined;
  readonly navigationStatus: string;
  readonly surfaces: readonly DesenAppSurfaceSummary[];
}

function surface(summary: DesenAppSurfaceSummary): DesenAppSurfaceSummary {
  return Object.freeze({ ...summary });
}

function project(summary: DesenAppProjectSummary): DesenAppProjectSummary {
  return Object.freeze({
    ...summary,
    surfaces: Object.freeze(summary.surfaces.map((item) => surface(item))),
  });
}

/** Projects one authenticated workspace profile into inert App routing and gallery metadata. */
export function projectWorkspaceProfileSummary(
  profile: ProjectWorkspaceProfileSnapshot,
): DesenAppProjectSummary {
  const catalogSummary = profile.catalogs
    .map((catalog) => `${catalog.id}@${catalog.version}`)
    .join(" · ");
  return project({
    id: profile.project.id,
    name: profile.project.name,
    description: profile.project.description,
    catalog: catalogSummary,
    navigationStatus: `${profile.project.surfaces.length} local ${profile.project.surfaces.length === 1 ? "surface" : "surfaces"}`,
    surfaces: profile.project.surfaces.map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      name: item.name,
      state: "navigable",
      detail: item.description,
    })),
  });
}

/** Resolves an exact project from an admitted inventory without aliasing or fallback. */
export function findDesenAppProject(
  projectId: string,
  projects: readonly DesenAppProjectSummary[],
): DesenAppProjectSummary | undefined {
  return projects.find((candidate) => candidate.id === projectId);
}

/** Resolves an exact surface fixture inside its already resolved project. */
export function findDesenAppSurface(
  projectSummary: DesenAppProjectSummary,
  surfaceId: string,
): DesenAppSurfaceSummary | undefined {
  return projectSummary.surfaces.find((candidate) => candidate.id === surfaceId);
}
