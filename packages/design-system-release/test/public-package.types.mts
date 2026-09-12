import {
  DESIGN_SYSTEM_RELEASE_KIND,
  createDesignSystemRelease,
  createDesignSystemReleaseStore,
  createHostProfileReleaseReference,
  readDesignSystemRelease,
  verifyDesignSystemRelease,
} from "@desen/design-system-release";

import type {
  DesignSystemReleaseInput,
  DesignSystemReleaseReference,
  DesignSystemReleaseSnapshot,
  DesignSystemReleaseStore,
} from "@desen/design-system-release";

const input: DesignSystemReleaseInput = {
  tokenSources: [
    {
      id: "base",
      document: {
        color: {
          $type: "color",
          action: { $value: { colorSpace: "srgb", components: [0, 0, 0] } },
        },
      },
    },
  ],
  assets: [],
  recipes: [],
};
const result = createDesignSystemRelease(input);
if (result.ok) {
  const snapshot: DesignSystemReleaseSnapshot = result.release;
  const reference: DesignSystemReleaseReference = createHostProfileReleaseReference({
    hostProfileId: "web-react",
    releaseDigest: snapshot.digest,
  });
  const store: DesignSystemReleaseStore = createDesignSystemReleaseStore();
  void store.putRelease({ release: snapshot });
  void readDesignSystemRelease(store, reference);
  void verifyDesignSystemRelease(snapshot);
}
if (DESIGN_SYSTEM_RELEASE_KIND !== "desen.design-system-release") throw new Error("kind drift");
