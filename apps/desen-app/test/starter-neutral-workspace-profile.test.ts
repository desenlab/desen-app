import { describe, expect, it } from "vitest";

import { readProjectWorkspaceProfileAuthority } from "../src/project-workspace-profile.js";
import { STARTER_NEUTRAL_WORKSPACE_PROFILE } from "../src/starter-neutral-workspace-profile.js";

describe("DESEN Neutral workspace profile", () => {
  it("adds a separate reviewed starter workspace without changing reference identities", () => {
    const authority = readProjectWorkspaceProfileAuthority(STARTER_NEUTRAL_WORKSPACE_PROFILE);
    expect(authority.status).toBe("read");
    if (authority.status !== "read") return;

    const profile = authority.profile;
    expect(profile.profileId).toBe("desen-neutral-web");
    expect(profile.project).toMatchObject({ id: "desen-neutral", name: "DESEN Neutral" });
    expect(profile.sourceKey).toBe("desen-neutral-source");
    expect(profile.initialDocument.id).toBe("com.desen.project.desen-neutral");
    expect(profile.initialDocument.entry).toBe("home");
    expect(profile.runtime.registrySnapshot.componentCapabilityIds).toContain(
      "run.desen.starter/Stack",
    );
    expect(profile.publication).toBeNull();
    expect(profile.runtime.hostPorts.environment.getSnapshot()).toEqual({
      platform: "web",
      viewport: { height: 900, orientation: "landscape", width: 1440 },
    });
  });
});
