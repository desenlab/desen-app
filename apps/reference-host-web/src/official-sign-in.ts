/* eslint-disable @typescript-eslint/no-invalid-void-type -- Trusted application reporters are
 * deliberately receiver-independent at this browser composition boundary. */
import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import type { SignInHostOperationBinding } from "@desen/reference-catalog-web/host-operations";
import { REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT } from "@desen/reference-catalog-web/react-adapters";
import { disposeRuntimeHeadlessSession, mountRuntimeHeadlessSession } from "@desen/runtime-core";
import { createRuntimeReactAdapterRegistry, renderRuntimeReactSurface } from "@desen/runtime-react";
import { disposeRuntimeWebHostAuthority, readRuntimeWebHostAuthority } from "@desen/runtime-web";

import officialDerivedSignInBundle from "../../../examples/sign-in/official-derived.bundle.desen.json";
import { createReferenceHostWebPorts } from "./host-ports.js";
import { activateReferenceHostSurface } from "./root.js";

import type {
  RuntimeAwaitable,
  RuntimeContextPort,
  RuntimeDiagnosticsPort,
  RuntimeHostCallResult,
  RuntimeJsonObject,
  RuntimeNavigationPort,
  RuntimeNavigationRequest,
  RuntimeOperationPort,
  RuntimeOperationRequest,
  RuntimeResourcePort,
  RuntimeStoragePort,
  RuntimeTokenPort,
} from "@desen/runtime-core";
import type { RuntimeReactLiveSurfaceInput } from "@desen/runtime-react";
import type { ReferenceHostRootHandle } from "./root.js";

/** Exact document identity of the controlled official-derived reference application. */
export const REFERENCE_HOST_OFFICIAL_SIGN_IN_DOCUMENT_ID = "com.example.account-app";

/** Exact immutable revision of the controlled official-derived reference Bundle. */
export const REFERENCE_HOST_OFFICIAL_SIGN_IN_REVISION =
  "sha256:6e539a76ddd0bc9b4eff82e73508b62a3980ae5dbc73dd85ccf0c1cae6957e13";

const REFERENCE_PACKAGE_ID = "run.desen.reference.sign-in";
const REFERENCE_PACKAGE_VERSION = "0.1.0";
const REFERENCE_PACKAGE_TARGET = "web-react";
const REFERENCE_PACKAGE_DIGEST =
  "sha256:d4a4e7e2ea2d68ab8bff085d90e093f2d31b784f0f2fb089c6422ce33914b051";
const SIGN_IN_SURFACE_ID = "sign-in";
const HOME_SURFACE_ID = "home";
const SIGN_IN_INVOCATION_ALIAS = "signIn";
const SIGN_IN_EFFECT = "network";
const HOME_PATH = "/home";
const DENIED_HOST_CALL = Object.freeze({ status: "denied" } as const);
const DENIED_NAVIGATION = Object.freeze({ status: "denied" } as const);
const SUCCEEDED_NAVIGATION = Object.freeze({ status: "succeeded" } as const);
const EMPTY_OBJECT = Object.freeze({}) as RuntimeJsonObject;
const ARRAY_PROTOTYPE = Object.getPrototypeOf([]) as object;
const NOOP = () => undefined;

/** Redacted application-level projection of one runtime diagnostic. */
export interface ReferenceHostOfficialSignInDiagnostic {
  /** Stable runtime diagnostic code, or a fixed fallback when the value is not safely readable. */
  readonly code: string;
}

/** Trusted diagnostic sink that can never receive credentials, raw errors, stacks, or details. */
export type ReferenceHostOfficialSignInDiagnosticReporter = (
  this: void,
  diagnostic: ReferenceHostOfficialSignInDiagnostic,
) => void;

/** Closed trusted input for activating the one official-derived sign-in application. */
export interface ReferenceHostOfficialSignInActivationInput {
  /** Browser platform owned by the independently built host. */
  readonly browser: Window;
  /** Fixed-capability binding created by the reference package's trusted binding factory. */
  readonly signIn: SignInHostOperationBinding;
  /** Application observability sink receiving only redacted diagnostic codes. */
  readonly reportDiagnostic: ReferenceHostOfficialSignInDiagnosticReporter;
}

/** Closed trusted input for activating one server-delivered reference sign-in Bundle. */
export interface ReferenceHostDeliveredSignInActivationInput extends ReferenceHostOfficialSignInActivationInput {
  /** Untrusted Bundle data delivered only after the server's durable activation boundary. */
  readonly bundle: unknown;
}

/** Controlled activation outcome without session, registry, Catalog, port, or callback authority. */
export type ReferenceHostOfficialSignInActivationResult =
  | Readonly<{
      readonly status: "activated";
      readonly relationship: "initial" | "preserved" | "replaced";
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        | "host-creation-failed"
        | "host-read-failed"
        | "bundle-policy-rejected"
        | "malformed-input"
        | "render-preflight-failed"
        | "registry-creation-failed"
        | "root-activation-failed"
        | "session-mount-failed";
    }>;

interface CapturedActivationInput {
  readonly browser: Window;
  readonly signIn: SignInHostOperationBinding;
  readonly reportDiagnostic: ReferenceHostOfficialSignInDiagnosticReporter;
}

interface CapturedBundlePolicy {
  readonly bundle: unknown;
  readonly documentId: typeof REFERENCE_HOST_OFFICIAL_SIGN_IN_DOCUMENT_ID;
  readonly revision: string;
}

interface CapturedSignInInput {
  readonly email: string;
  readonly password: string;
}

function ownDataRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(value);
    if (
      requiredKeys.some((key) => !keys.includes(key)) ||
      keys.some(
        (key) =>
          typeof key !== "string" || (!requiredKeys.includes(key) && !optionalKeys.includes(key)),
      )
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return captured;
  } catch {
    return undefined;
  }
}

function captureActivationInput(input: unknown): CapturedActivationInput | undefined {
  const captured = ownDataRecord(input, ["browser", "signIn", "reportDiagnostic"]);
  if (captured === undefined || typeof captured.reportDiagnostic !== "function") return undefined;
  const binding = ownDataRecord(captured.signIn, ["operationId", "invoke"]);
  if (
    binding === undefined ||
    binding.operationId !== "com.example.auth/signIn" ||
    typeof binding.invoke !== "function"
  ) {
    return undefined;
  }
  return Object.freeze({
    browser: captured.browser as Window,
    signIn: Object.freeze({
      operationId: "com.example.auth/signIn",
      invoke: binding.invoke,
    }) as SignInHostOperationBinding,
    reportDiagnostic: captured.reportDiagnostic as ReferenceHostOfficialSignInDiagnosticReporter,
  });
}

function captureBundlePolicy(bundle: unknown): CapturedBundlePolicy | undefined {
  try {
    const capturedBundle = ownDataRecord(
      bundle,
      ["kind", "desen", "id", "revision", "sourceDigest", "requires", "entry", "surfaces"],
      ["publication", "extensions"],
    );
    if (capturedBundle === undefined) return undefined;
    const documentId = capturedBundle.id;
    const revision = capturedBundle.revision;
    const sourceDigest = capturedBundle.sourceDigest;
    const requires = ownDataRecord(capturedBundle.requires, ["catalogs"]);
    const catalogs = requires?.catalogs;
    if (
      capturedBundle.kind !== "desen.bundle" ||
      capturedBundle.desen !== "0.1.0" ||
      documentId !== REFERENCE_HOST_OFFICIAL_SIGN_IN_DOCUMENT_ID ||
      typeof revision !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(revision) ||
      typeof sourceDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(sourceDigest) ||
      capturedBundle.entry !== SIGN_IN_SURFACE_ID ||
      !Array.isArray(catalogs) ||
      Object.getPrototypeOf(catalogs) !== ARRAY_PROTOTYPE
    ) {
      return undefined;
    }
    const catalogKeys = Reflect.ownKeys(catalogs);
    if (catalogKeys.length !== 2 || !catalogKeys.includes("0") || !catalogKeys.includes("length")) {
      return undefined;
    }
    const item = Object.getOwnPropertyDescriptor(catalogs, "0");
    const length = Object.getOwnPropertyDescriptor(catalogs, "length");
    if (
      item === undefined ||
      length === undefined ||
      item.enumerable !== true ||
      !("value" in item) ||
      length.enumerable !== false ||
      !("value" in length) ||
      length.value !== 1
    ) {
      return undefined;
    }
    const requirement = ownDataRecord(
      item.value,
      ["id", "version", "target", "digest"],
      ["extensions"],
    );
    if (
      requirement === undefined ||
      requirement.id !== REFERENCE_PACKAGE_ID ||
      requirement.version !== REFERENCE_PACKAGE_VERSION ||
      requirement.target !== REFERENCE_PACKAGE_TARGET ||
      requirement.digest !== REFERENCE_PACKAGE_DIGEST
    ) {
      return undefined;
    }
    return Object.freeze({ bundle, documentId, revision });
  } catch {
    return undefined;
  }
}

function captureRequestContext(
  value: unknown,
  surfaceId: string,
  identity: CapturedBundlePolicy,
): boolean {
  const context = ownDataRecord(value, ["documentId", "revision", "surfaceId", "requestId"]);
  return (
    context !== undefined &&
    context.documentId === identity.documentId &&
    context.revision === identity.revision &&
    context.surfaceId === surfaceId &&
    typeof context.requestId === "string" &&
    context.requestId.length > 0 &&
    context.requestId.length <= 256
  );
}

function captureSignInInput(value: unknown): CapturedSignInInput | undefined {
  const input = ownDataRecord(value, ["email", "password"]);
  if (
    input === undefined ||
    typeof input.email !== "string" ||
    typeof input.password !== "string" ||
    input.password.length === 0
  ) {
    return undefined;
  }
  return Object.freeze({ email: input.email, password: input.password });
}

function captureSignInRequest(
  value: RuntimeOperationRequest,
  operationId: string,
  identity: CapturedBundlePolicy,
): CapturedSignInInput | undefined {
  const request = ownDataRecord(value, [
    "context",
    "capabilityId",
    "invocationAlias",
    "input",
    "effect",
  ]);
  if (
    request === undefined ||
    !captureRequestContext(request.context, SIGN_IN_SURFACE_ID, identity) ||
    request.capabilityId !== operationId ||
    request.invocationAlias !== SIGN_IN_INVOCATION_ALIAS ||
    request.effect !== SIGN_IN_EFFECT
  ) {
    return undefined;
  }
  return captureSignInInput(request.input);
}

function createSignInOperationPort(
  binding: SignInHostOperationBinding,
  identity: CapturedBundlePolicy,
): RuntimeOperationPort {
  return Object.freeze({
    invoke(request: RuntimeOperationRequest): RuntimeAwaitable<RuntimeHostCallResult> {
      const input = captureSignInRequest(request, binding.operationId, identity);
      if (input === undefined) return DENIED_HOST_CALL;
      return Reflect.apply(binding.invoke, undefined, [
        input,
      ]) as RuntimeAwaitable<RuntimeHostCallResult>;
    },
  });
}

function isEmptyParams(value: unknown): boolean {
  const params = ownDataRecord(value, []);
  return params !== undefined;
}

function createNavigationPort(
  browser: Window,
  identity: CapturedBundlePolicy,
): RuntimeNavigationPort {
  return Object.freeze({
    navigate(request: RuntimeNavigationRequest) {
      const captured = ownDataRecord(request, ["context", "targetSurfaceId", "params"]);
      if (
        captured === undefined ||
        !captureRequestContext(captured.context, SIGN_IN_SURFACE_ID, identity) ||
        captured.targetSurfaceId !== HOME_SURFACE_ID ||
        !isEmptyParams(captured.params)
      ) {
        return DENIED_NAVIGATION;
      }
      try {
        browser.history.pushState(null, "", HOME_PATH);
        return SUCCEEDED_NAVIGATION;
      } catch {
        return DENIED_NAVIGATION;
      }
    },
  });
}

function safeDiagnosticCode(value: unknown): string {
  try {
    if (value === null || typeof value !== "object") return "UNKNOWN_RUNTIME_DIAGNOSTIC";
    const descriptor = Object.getOwnPropertyDescriptor(value, "code");
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      descriptor.value.length === 0 ||
      descriptor.value.length > 160 ||
      !/^[A-Za-z0-9._/-]+$/u.test(descriptor.value)
    ) {
      return "UNKNOWN_RUNTIME_DIAGNOSTIC";
    }
    return descriptor.value;
  } catch {
    return "UNKNOWN_RUNTIME_DIAGNOSTIC";
  }
}

function createDiagnosticsPort(
  reportDiagnostic: ReferenceHostOfficialSignInDiagnosticReporter,
): RuntimeDiagnosticsPort {
  return Object.freeze({
    report(diagnostic: Parameters<RuntimeDiagnosticsPort["report"]>[0]) {
      const redacted = Object.freeze({ code: safeDiagnosticCode(diagnostic) });
      try {
        Reflect.apply(reportDiagnostic, undefined, [redacted]);
      } catch {
        // Observability cannot decide whether a runtime transition succeeds.
      }
    },
  });
}

function createStoragePort(): RuntimeStoragePort {
  return Object.freeze({
    getBundle: () => Object.freeze({ status: "missing" }),
    putBundle: () => Object.freeze({ status: "conflict" }),
    readActivation: () => Object.freeze({ status: "missing" }),
    commitActivation: () => Object.freeze({ status: "conflict", generation: null }),
  });
}

function createResourcePort(): RuntimeResourcePort {
  return Object.freeze({ load: () => DENIED_HOST_CALL });
}

function createTokenPort(): RuntimeTokenPort {
  return Object.freeze({ resolve: () => Object.freeze({ status: "missing" }) });
}

function createContextPort(): RuntimeContextPort {
  return Object.freeze({
    getSnapshot: () => EMPTY_OBJECT,
    subscribe: () => NOOP,
  });
}

function safelyDisposeCreatedAuthorities(
  host: Parameters<typeof disposeRuntimeWebHostAuthority>[0] | undefined,
  session: Parameters<typeof disposeRuntimeHeadlessSession>[0] | undefined,
): void {
  if (host !== undefined) {
    try {
      disposeRuntimeWebHostAuthority(host);
    } catch {
      // No raw cleanup value crosses the application boundary.
    }
  }
  if (session !== undefined) {
    try {
      disposeRuntimeHeadlessSession(session);
    } catch {
      // No raw cleanup value crosses the application boundary.
    }
  }
}

/**
 * Activates one server-delivered sign-in Bundle through the real fixed reference adapters.
 *
 * @remarks The caller supplies one untrusted Bundle plus browser infrastructure, the exact
 * fixed-capability trusted binding, and a redacted diagnostic sink. Catalog, registry, capability
 * id, route, managed React tree, recovery key, and host policy are closed module-owned choices.
 * Successful activation transfers the created session and Web host authority to the reference
 * root. Every rejected path terminally disposes the authorities it created.
 */
export function activateReferenceHostDeliveredSignIn(
  root: ReferenceHostRootHandle,
  input: ReferenceHostDeliveredSignInActivationInput,
): ReferenceHostOfficialSignInActivationResult {
  const capturedRecord = ownDataRecord(input, ["browser", "signIn", "reportDiagnostic", "bundle"]);
  if (capturedRecord === undefined) {
    return Object.freeze({ status: "rejected", reason: "malformed-input" });
  }
  const captured = captureActivationInput({
    browser: capturedRecord.browser,
    signIn: capturedRecord.signIn,
    reportDiagnostic: capturedRecord.reportDiagnostic,
  });
  if (captured === undefined) {
    return Object.freeze({ status: "rejected", reason: "malformed-input" });
  }
  const bundlePolicy = captureBundlePolicy(capturedRecord.bundle);
  if (bundlePolicy === undefined) {
    return Object.freeze({ status: "rejected", reason: "bundle-policy-rejected" });
  }

  const registry = createRuntimeReactAdapterRegistry(REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT);
  if (registry.status !== "created") {
    return Object.freeze({ status: "rejected", reason: "registry-creation-failed" });
  }

  const host = createReferenceHostWebPorts({
    browser: captured.browser,
    documentId: bundlePolicy.documentId,
    revision: bundlePolicy.revision,
    navigation: createNavigationPort(captured.browser, bundlePolicy),
    storage: createStoragePort(),
    operations: createSignInOperationPort(captured.signIn, bundlePolicy),
    resources: createResourcePort(),
    tokens: createTokenPort(),
    context: createContextPort(),
    diagnostics: createDiagnosticsPort(captured.reportDiagnostic),
  });
  if (host.status !== "created") {
    return Object.freeze({ status: "rejected", reason: "host-creation-failed" });
  }

  const hostRead = readRuntimeWebHostAuthority(host.handle);
  if (hostRead.status !== "active") {
    safelyDisposeCreatedAuthorities(host.handle, undefined);
    return Object.freeze({ status: "rejected", reason: "host-read-failed" });
  }

  const mounted = mountRuntimeHeadlessSession({
    bundle: bundlePolicy.bundle,
    catalogs: [referenceCatalog],
    hostPorts: hostRead.hostPorts,
  });
  if (mounted.status !== "mounted") {
    safelyDisposeCreatedAuthorities(host.handle, undefined);
    return Object.freeze({ status: "rejected", reason: "session-mount-failed" });
  }

  const surface = Object.freeze({
    registry: registry.handle,
    session: mounted.handle,
    serverSnapshot: mounted.snapshot,
    catalogSet: mounted.catalogSet,
  }) satisfies RuntimeReactLiveSurfaceInput;
  const preflight = renderRuntimeReactSurface({
    registry: registry.handle,
    session: mounted.handle,
    snapshot: mounted.snapshot,
    catalogSet: mounted.catalogSet,
  });
  if (preflight.status !== "rendered") {
    safelyDisposeCreatedAuthorities(host.handle, mounted.handle);
    return Object.freeze({ status: "rejected", reason: "render-preflight-failed" });
  }
  const activated = activateReferenceHostSurface(root, {
    surface,
    hostAuthority: host.handle,
  });
  if (activated.status !== "activated") {
    safelyDisposeCreatedAuthorities(host.handle, mounted.handle);
    return Object.freeze({ status: "rejected", reason: "root-activation-failed" });
  }
  return Object.freeze({
    status: "activated",
    relationship: activated.relationship,
  });
}

/**
 * Activates the historical official-derived Bundle through the dynamic policy-closed seam.
 *
 * @remarks This compatibility wrapper remains available to the M05 host tests. The production
 * entry no longer uses it as an implicit fallback when the channel delivery path is unavailable.
 */
export function activateReferenceHostOfficialSignIn(
  root: ReferenceHostRootHandle,
  input: ReferenceHostOfficialSignInActivationInput,
): ReferenceHostOfficialSignInActivationResult {
  const captured = captureActivationInput(input);
  if (captured === undefined) {
    return Object.freeze({ status: "rejected", reason: "malformed-input" });
  }
  return activateReferenceHostDeliveredSignIn(root, {
    browser: captured.browser,
    signIn: captured.signIn,
    reportDiagnostic: captured.reportDiagnostic,
    bundle: officialDerivedSignInBundle,
  });
}
