import {
  createWebReactPackageDigest,
  encodeWebReactPackageDigestPreimage,
  verifyWebReactPackageDigest,
  WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
  WEB_REACT_PACKAGE_DIGEST_PROFILE,
} from "../src/index.js";

import type { DesenCatalog } from "@desen/protocol";
import type {
  WebReactPackageArtifactInput,
  WebReactPackageDigestCalculationInput,
  WebReactPackageDigest,
  WebReactPackageDigestEntry,
  WebReactPackageDigestVerificationInput,
} from "../src/index.js";

const catalog = {
  kind: "desen.catalog",
  desen: "0.1.0",
  id: "com.example.reference",
  version: "1.0.0",
  target: "web-react",
  packageDigest: WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
  components: {},
  behaviors: {},
  operations: {},
  resources: {},
} satisfies DesenCatalog;

const artifact = {
  path: "adapters/production.js",
  bytes: new Uint8Array(),
} satisfies WebReactPackageArtifactInput;

const input = {
  catalog,
  artifacts: [artifact],
} satisfies WebReactPackageDigestCalculationInput;

const description: WebReactPackageDigest = createWebReactPackageDigest(input);
const entry: WebReactPackageDigestEntry | undefined = description.entries[0];
const preimage: Uint8Array = encodeWebReactPackageDigestPreimage(input);
const profileTarget: "web-react" = WEB_REACT_PACKAGE_DIGEST_PROFILE.target;

const publishedInput: WebReactPackageDigestVerificationInput = {
  ...input,
  catalog: {
    ...catalog,
    packageDigest: description.packageDigest,
  },
};
const verified: WebReactPackageDigest = verifyWebReactPackageDigest(publishedInput);

// @ts-expect-error M03-T04-N01 package artifact contents must be exact bytes.
const invalidBytes: WebReactPackageArtifactInput = { path: "adapter.js", bytes: "code" };

// @ts-expect-error M03-T04-N02 the Catalog is required.
const missingCatalog: WebReactPackageDigestCalculationInput = { artifacts: [] };

const unknownWrapper: WebReactPackageDigestCalculationInput = {
  catalog,
  artifacts: [],
  // @ts-expect-error M03-T04-N03 unknown digest wrapper fields are not public API.
  adapter: true,
};

const unknownArtifact: WebReactPackageArtifactInput = {
  path: "adapter.js",
  bytes: new Uint8Array(),
  // @ts-expect-error M03-T04-N04 unknown artifact metadata is not part of the byte profile.
  role: "production",
};

// @ts-expect-error M03-T04-N05 digest audit results are immutable.
description.packageDigest = WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER;

void entry;
void invalidBytes;
void missingCatalog;
void preimage;
void profileTarget;
void unknownArtifact;
void unknownWrapper;
void verified;
