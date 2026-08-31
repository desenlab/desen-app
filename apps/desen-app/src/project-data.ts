/** One admitted surface exposed to the Desen App project shell. */
export interface DesenAppSurfaceSummary {
  readonly id: string;
  readonly name: string;
  readonly capabilityId: string;
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

/** Exact supported local project profile created by the normal blank-project product flow. */
export const DESEN_APP_BLANK_PROJECT: DesenAppProjectSummary = project({
  id: "account-app",
  name: "Account app",
  description: "A local sign-in project authored with the exact web-react reference catalog.",
  catalog: "web-react@0.1",
  navigationStatus: "1 local surface",
  surfaces: [
    {
      id: "sign-in",
      name: "Sign-in",
      capabilityId: "account.sign-in",
      state: "navigable",
      detail: "Local authored Source",
    },
  ],
});

/** Product inventory after the supported local blank project has been created. */
export const DESEN_APP_LOCAL_PROJECTS: readonly DesenAppProjectSummary[] = Object.freeze([
  DESEN_APP_BLANK_PROJECT,
]);

/** Exact inert project fixtures admitted by the first Desen App shell slice. */
export const DESEN_APP_PROJECTS: readonly DesenAppProjectSummary[] = Object.freeze([
  project({
    id: "account-app",
    name: "Account app",
    description: "Sign-in and account recovery surfaces built from the web-react catalog.",
    catalog: "web-react@0.1",
    navigationStatus: "3 fixture routes",
    surfaces: [
      {
        id: "sign-in",
        name: "Sign-in",
        capabilityId: "account.sign-in",
        state: "navigable",
        detail: "Navigation fixture",
      },
      {
        id: "recovery",
        name: "Recovery",
        capabilityId: "account.recovery",
        state: "navigable",
        detail: "Navigation fixture",
      },
      {
        id: "profile",
        name: "Profile",
        capabilityId: "account.profile",
        state: "navigable",
        detail: "Navigation fixture",
      },
    ],
  }),
  project({
    id: "checkout-pilot",
    name: "Checkout pilot",
    description: "A bounded evaluation project. No capability catalog is connected yet.",
    catalog: undefined,
    navigationStatus: "Setup route",
    surfaces: [],
  }),
]);

/** Resolves an exact project from an admitted inventory without aliasing or fallback. */
export function findDesenAppProject(
  projectId: string,
  projects: readonly DesenAppProjectSummary[] = DESEN_APP_PROJECTS,
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
