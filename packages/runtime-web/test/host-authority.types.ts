import {
  authenticateRuntimeWebHostDocumentAuthority,
  createRuntimeWebBrowserPlatform,
  createRuntimeWebHostAuthority,
  disposeRuntimeWebHostAuthority,
  readRuntimeWebHostAuthority,
} from "../src/index.js";

import type {
  RuntimeContextPort,
  RuntimeDiagnosticsPort,
  RuntimeNavigationPort,
  RuntimeOperationPort,
  RuntimeResourcePort,
  RuntimeStoragePort,
  RuntimeTokenPort,
} from "@desen/runtime-core";
import type {
  RuntimeWebBrowserPlatformHandle,
  RuntimeWebHostAuthorityHandle,
  RuntimeWebHostDocumentAuthorityInput,
  RuntimeWebHostDocumentAuthorityResult,
} from "../src/index.js";

declare const navigation: RuntimeNavigationPort;
declare const storage: RuntimeStoragePort;
declare const operations: RuntimeOperationPort;
declare const resources: RuntimeResourcePort;
declare const tokens: RuntimeTokenPort;
declare const context: RuntimeContextPort;
declare const diagnostics: RuntimeDiagnosticsPort;
declare const authority: RuntimeWebHostAuthorityHandle;

const documentAuthorityInput: RuntimeWebHostDocumentAuthorityInput = {
  documentId: "run.desen.reference.sign-in",
  revision: `sha256:${"a".repeat(64)}`,
};
const documentAuthorityResult: RuntimeWebHostDocumentAuthorityResult =
  authenticateRuntimeWebHostDocumentAuthority(authority, documentAuthorityInput);
if (documentAuthorityResult.status === "authenticated") {
  // @ts-expect-error status-only authentication never exposes host ports
  void documentAuthorityResult.hostPorts;
}

// @ts-expect-error document-authority inputs are immutable
documentAuthorityInput.documentId = "run.desen.reference.other";

// @ts-expect-error both exact document-identity members are required
authenticateRuntimeWebHostDocumentAuthority(authority, {
  documentId: "run.desen.reference.sign-in",
});

authenticateRuntimeWebHostDocumentAuthority(authority, {
  documentId: "run.desen.reference.sign-in",
  revision: `sha256:${"a".repeat(64)}`,
  // @ts-expect-error no host ports or delegate authority may accompany the identity
  hostPorts: {},
});

authenticateRuntimeWebHostDocumentAuthority(authority, {
  // @ts-expect-error document identifiers are strings
  documentId: 1,
  revision: `sha256:${"a".repeat(64)}`,
});

authenticateRuntimeWebHostDocumentAuthority(
  // @ts-expect-error a browser-platform handle cannot authenticate a Web host authority
  {} as RuntimeWebBrowserPlatformHandle,
  documentAuthorityInput,
);

const platformResult = createRuntimeWebBrowserPlatform({
  environment: {
    getSnapshot: () => ({ platform: "web" }),
    subscribe: (onChange) => {
      void onChange;
      return () => undefined;
    },
  },
  clock: {
    now: () => 1_785_000_000_000,
  },
});

if (platformResult.status === "created") {
  const authorityResult = createRuntimeWebHostAuthority({
    platform: platformResult.handle,
    documentId: "run.desen.reference.sign-in",
    revision: `sha256:${"a".repeat(64)}`,
    navigation,
    storage,
    operations,
    resources,
    tokens,
    context,
    diagnostics,
  });

  if (authorityResult.status === "created") {
    const read = readRuntimeWebHostAuthority(authorityResult.handle);
    if (read.status === "active") {
      read.hostPorts.clock.now();
    } else {
      // @ts-expect-error terminal reads cannot expose the prior callback aggregate
      void read.hostPorts;
    }
    disposeRuntimeWebHostAuthority(authorityResult.handle);
  }
}

// @ts-expect-error browser environment observation is required
createRuntimeWebBrowserPlatform({
  clock: {
    now: () => 0,
  },
});

createRuntimeWebBrowserPlatform({
  environment: {
    getSnapshot: () => ({}),
    subscribe: (onChange) => {
      void onChange;
      return () => undefined;
    },
  },
  clock: {
    // @ts-expect-error browser clock callbacks must be receiver-independent
    now(this: { readonly value: number }) {
      return this.value;
    },
  },
});

// @ts-expect-error a structural object cannot forge factory-authenticated platform authority
const forgedPlatform: RuntimeWebBrowserPlatformHandle = {};
void forgedPlatform;

declare const platform: RuntimeWebBrowserPlatformHandle;

// @ts-expect-error every trusted host delegate is explicit, including diagnostics
createRuntimeWebHostAuthority({
  platform,
  documentId: "run.desen.reference.sign-in",
  revision: `sha256:${"a".repeat(64)}`,
  navigation,
  storage,
  operations,
  resources,
  tokens,
  context,
});

createRuntimeWebHostAuthority({
  platform,
  documentId: "run.desen.reference.sign-in",
  revision: `sha256:${"a".repeat(64)}`,
  navigation,
  storage,
  operations,
  resources,
  tokens,
  context,
  diagnostics,
  // @ts-expect-error undocumented callback authorities are rejected
  scheduler: {},
});

// @ts-expect-error a structural object cannot forge factory-authenticated host authority
const forgedAuthority: RuntimeWebHostAuthorityHandle = {};
void forgedAuthority;

const disposal = disposeRuntimeWebHostAuthority(authority);
// @ts-expect-error disposal results are recursively readonly public data
disposal.status = "disposed";
