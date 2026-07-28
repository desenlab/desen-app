import type { ReactNode } from "react";
import type { RuntimeReactLiveSurfaceInput } from "@desen/runtime-react";
import type { RuntimeWebHostAuthorityHandle } from "@desen/runtime-web";

import type {
  ReferenceHostRootDiagnostic,
  ReferenceHostRootDiagnosticReporter,
} from "../src/root-policy.js";
import type {
  ReferenceHostApplicationState,
  ReferenceHostApplicationProps,
} from "../src/application.js";
import type { ReferenceHostSurfaceActivationInput } from "../src/root.js";

declare const surface: RuntimeReactLiveSurfaceInput;
declare const hostAuthority: RuntimeWebHostAuthorityHandle;

const activation: ReferenceHostSurfaceActivationInput = {
  surface,
  hostAuthority,
};

const surfaceState: ReferenceHostApplicationState = {
  status: "surface",
  input: surface,
  recoveryKey: "host-owned",
  onRequestRecovery: () => undefined,
};

const applicationProps: ReferenceHostApplicationProps = { state: surfaceState };
const reporter: ReferenceHostRootDiagnosticReporter = (diagnostic) => {
  const code: ReferenceHostRootDiagnostic["code"] = diagnostic.code;
  void code;
};

// @ts-expect-error Arbitrary React children cannot enter the managed application seam.
const handwrittenTree: ReferenceHostApplicationProps = { state: surfaceState, children: null };

const activationWithChildren: ReferenceHostSurfaceActivationInput = {
  ...activation,
  // @ts-expect-error Activation cannot accept a host-selected managed React tree.
  children: null as ReactNode,
};

const activationWithRecoveryKey: ReferenceHostSurfaceActivationInput = {
  ...activation,
  // @ts-expect-error Bundle or caller data cannot supply a recovery key during activation.
  recoveryKey: "bundle-selected",
};

declare const diagnostic: ReferenceHostRootDiagnostic;
// @ts-expect-error Root diagnostics never expose the raw React error.
void diagnostic.error;
// @ts-expect-error Root diagnostics never expose a component stack.
void diagnostic.componentStack;
// @ts-expect-error Root diagnostics never expose a raw cause.
void diagnostic.cause;

void applicationProps;
void reporter;
void handwrittenTree;
void activationWithChildren;
void activationWithRecoveryKey;
