/** One fixture-backed surface exposed to the M09-T01 project shell. */
export interface DesenAppSurfaceSummary {
  readonly id: string;
  readonly name: string;
  readonly capabilityId: string;
  readonly state: "navigable" | "not-configured";
  readonly detail: string;
}

/** Read-only project summary used only to prove shell and navigation behavior. */
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

/** Resolves an exact project fixture without aliasing or fallback. */
export function findDesenAppProject(projectId: string): DesenAppProjectSummary | undefined {
  return DESEN_APP_PROJECTS.find((candidate) => candidate.id === projectId);
}

/** Resolves an exact surface fixture inside its already resolved project. */
export function findDesenAppSurface(
  projectSummary: DesenAppProjectSummary,
  surfaceId: string,
): DesenAppSurfaceSummary | undefined {
  return projectSummary.surfaces.find((candidate) => candidate.id === surfaceId);
}
