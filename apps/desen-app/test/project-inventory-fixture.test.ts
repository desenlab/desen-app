import { describe, expect, it } from "vitest";

import {
  createProjectInventoryFixture,
  readProjectInventoryFixture,
} from "../src/project-inventory-fixture.js";

import type { DesenAppProjectSummary } from "../src/project-data.js";
import type { ProjectInventoryFixtureHandle } from "../src/project-inventory-fixture.js";

function fixtureProject(): DesenAppProjectSummary {
  return {
    id: "feedback-studio",
    name: "Feedback studio",
    description: "Inert navigation data.",
    catalog: undefined,
    navigationStatus: "1 fixture route",
    surfaces: [
      {
        id: "collect",
        sourceId: "feedback",
        name: "Collect",
        state: "navigable",
        detail: "Inert fixture surface",
      },
    ],
  };
}

describe("project inventory fixture authority", () => {
  it("detaches one inert inventory behind an opaque factory handle", () => {
    const input = fixtureProject();
    const created = createProjectInventoryFixture([input]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    (input as { name: string }).name = "Changed outside";
    expect(readProjectInventoryFixture(created.handle)).toEqual({
      status: "read",
      projects: created.projects,
    });
    expect(created.projects[0]?.name).toBe("Feedback studio");
    expect(Object.isFrozen(created.projects)).toBe(true);
    expect(Object.isFrozen(created.projects[0]?.surfaces)).toBe(true);
    expect(readProjectInventoryFixture(Object.freeze({}) as ProjectInventoryFixtureHandle)).toEqual(
      { status: "invalid-handle" },
    );
  });

  it("rejects accessors and hostile reflection without invoking caller code", () => {
    const accessorProject = fixtureProject() as unknown as Record<string, unknown>;
    let reads = 0;
    Object.defineProperty(accessorProject, "name", {
      enumerable: true,
      get() {
        reads += 1;
        return "Feedback studio";
      },
    });
    expect(createProjectInventoryFixture([accessorProject as never])).toEqual({
      ok: false,
      reason: "fixture-invalid",
    });
    expect(reads).toBe(0);

    const hostile = new Proxy(fixtureProject(), {
      getPrototypeOf() {
        throw new Error("hostile reflection");
      },
    });
    expect(createProjectInventoryFixture([hostile])).toEqual({
      ok: false,
      reason: "fixture-invalid",
    });
  });

  it("rejects sparse, extended, symbolic, and subclassed arrays", () => {
    const sparse: DesenAppProjectSummary[] = [];
    sparse.length = 1;
    const extended = [fixtureProject()] as DesenAppProjectSummary[] & { extra?: boolean };
    extended.extra = true;
    const symbolic = [fixtureProject()];
    Object.defineProperty(symbolic, Symbol("extra"), { value: true });
    class ProjectArray extends Array<DesenAppProjectSummary> {}
    const subclassed = new ProjectArray(fixtureProject());

    for (const input of [sparse, extended, symbolic, subclassed]) {
      expect(createProjectInventoryFixture(input)).toEqual({
        ok: false,
        reason: "fixture-invalid",
      });
    }
  });
});
