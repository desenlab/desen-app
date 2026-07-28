import { bindReferenceSignInHostOperation } from "@desen/reference-catalog-web/host-operations";

import { activateReferenceHostOfficialSignIn } from "../src/official-sign-in.js";

import type { ReferenceHostRootHandle } from "../src/root.js";

declare const browser: Window;
declare const root: ReferenceHostRootHandle;

const signIn = bindReferenceSignInHostOperation(() =>
  Object.freeze({
    status: "failed",
    errorCode: "unavailable",
  }),
);
const valid = activateReferenceHostOfficialSignIn(root, {
  browser,
  signIn,
  reportDiagnostic: () => undefined,
});

void valid;

activateReferenceHostOfficialSignIn(root, {
  browser,
  signIn,
  reportDiagnostic: () => undefined,
  // @ts-expect-error M05-T08-N01 Bundle selection is closed inside the production composition.
  bundle: {},
});

activateReferenceHostOfficialSignIn(root, {
  browser,
  signIn,
  reportDiagnostic: () => undefined,
  // @ts-expect-error M05-T08-N02 Catalog selection is closed inside the production composition.
  catalogs: [],
});

activateReferenceHostOfficialSignIn(root, {
  browser,
  signIn,
  reportDiagnostic: () => undefined,
  // @ts-expect-error M05-T08-N03 Executable registry selection is closed inside the composition.
  registry: {},
});

activateReferenceHostOfficialSignIn(root, {
  browser,
  signIn,
  reportDiagnostic: () => undefined,
  // @ts-expect-error M05-T08-N04 Managed React trees cannot cross the composition boundary.
  children: null,
});

activateReferenceHostOfficialSignIn(root, {
  browser,
  signIn,
  reportDiagnostic: () => undefined,
  // @ts-expect-error M05-T08-N05 Operation capability selection is fixed by the binding package.
  operationId: "custom.operation",
});

activateReferenceHostOfficialSignIn(root, {
  browser,
  signIn,
  reportDiagnostic: () => undefined,
  // @ts-expect-error M05-T08-N06 Recovery keys remain owned by the independent root.
  recoveryKey: "document-selected",
});

// @ts-expect-error M05-T08-N07 The trusted fixed-capability binding is required.
activateReferenceHostOfficialSignIn(root, {
  browser,
  reportDiagnostic: () => undefined,
});
