import type { DesenAppProjectSummary } from "./project-data.js";
import { createProjectInventoryFixture } from "./project-inventory-fixture.js";
import type { ProjectInventoryFixtureHandle } from "./project-inventory-fixture.js";

function project(summary: DesenAppProjectSummary): DesenAppProjectSummary {
  return Object.freeze({
    ...summary,
    surfaces: Object.freeze(summary.surfaces.map((surface) => Object.freeze({ ...surface }))),
  });
}

/** Inert navigation inventory retained only for explicit App shell reference tests and previews. */
export const REFERENCE_APP_PROJECTS: readonly DesenAppProjectSummary[] = Object.freeze([
  project({
    id: "account-app",
    name: "Account app",
    description: "Sign-in and account recovery surfaces built from the web-react catalog.",
    catalog: "web-react@0.1",
    navigationStatus: "3 fixture routes",
    surfaces: [
      {
        id: "sign-in",
        sourceId: "sign-in",
        name: "Sign-in",
        state: "navigable",
        detail: "Navigation fixture",
      },
      {
        id: "recovery",
        sourceId: "recovery",
        name: "Recovery",
        state: "navigable",
        detail: "Navigation fixture",
      },
      {
        id: "profile",
        sourceId: "profile",
        name: "Profile",
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

const fixtureAuthority = createProjectInventoryFixture(REFERENCE_APP_PROJECTS);
if (!fixtureAuthority.ok) {
  throw new TypeError("The reference project inventory fixture was rejected.");
}

/** Factory-authenticated inert route/gallery inventory used only by explicit shell previews. */
export const REFERENCE_APP_PROJECT_INVENTORY_FIXTURE: ProjectInventoryFixtureHandle =
  fixtureAuthority.handle;
