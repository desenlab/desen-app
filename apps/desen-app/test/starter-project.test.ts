import { describe, expect, it } from "vitest";

import { createStarterProject } from "../src/starter-project.js";

describe("DESEN Neutral blank starter project", () => {
  it("creates an admitted one-surface project from the complete installed starter catalog", () => {
    const starter = createStarterProject("new-product");

    expect(starter.record.id).toBe("new-product");
    expect(starter.record.source.catalogs).toEqual([
      { id: "run.desen.starter.web", version: "0.7.0", target: "web-react" },
    ]);
    expect(starter.record.source.entry).toBe("home");
    expect(starter.record.source.authoring).toEqual({
      canvas: { home: { x: 0, y: 0, width: 1440, height: 900 } },
    });
    expect(starter.record.source.surfaces.home?.root.use).toBe("run.desen.starter/Stack");
    expect(starter.record.designSystem.tokenSources.map(({ id }) => id)).toEqual([
      "neutral.base",
      "neutral.light",
    ]);
    expect(starter.record.connectionIntents).toEqual([]);
    expect(starter.surfaceNames).toEqual([{ id: "home", name: "Home" }]);
  });

  it("does not make an invalid external project identity part of a Source", () => {
    expect(() => createStarterProject("not a project")).toThrow(
      "Starter project id must be a finite local identifier.",
    );
  });
});
