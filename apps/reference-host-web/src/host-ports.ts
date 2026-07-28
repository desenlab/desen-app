import { createRuntimeWebHostAuthority } from "@desen/runtime-web";

import { createReferenceHostBrowserPlatform } from "./browser-profile.js";

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
  RuntimeWebHostAuthorityCreateResult,
  RuntimeWebHostAuthorityHandle,
} from "@desen/runtime-web";

/** Complete application-owned input for one reference-host browser authority. */
export interface ReferenceHostWebPortsCreateInput {
  readonly browser: Window;
  readonly documentId: string;
  readonly revision: string;
  readonly navigation: RuntimeNavigationPort;
  readonly storage: RuntimeStoragePort;
  readonly operations: RuntimeOperationPort;
  readonly resources: RuntimeResourcePort;
  readonly tokens: RuntimeTokenPort;
  readonly context: RuntimeContextPort;
  readonly diagnostics: RuntimeDiagnosticsPort;
}

/** Controlled result of composing browser infrastructure and all explicit core host ports. */
export type ReferenceHostWebPortsCreateResult =
  | Readonly<{
      readonly status: "created";
      readonly handle: RuntimeWebHostAuthorityHandle;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        | "invalid-browser-platform"
        | "invalid-document-identity"
        | "invalid-host-ports"
        | "malformed-input";
    }>;

/**
 * Composes one independently owned browser host authority without executing a callback.
 *
 * @remarks The required storage, operation, resource, token, context, navigation, and diagnostic
 * ports are trusted application code. No Source, Bundle, Catalog, URL, capability id, or fixture
 * can supply them. The reusable runtime-web layer adds the environment, clock, exact
 * document/revision navigation assertion, and one terminal fence shared by all fourteen
 * callbacks.
 */
export function createReferenceHostWebPorts(
  input: ReferenceHostWebPortsCreateInput,
): ReferenceHostWebPortsCreateResult {
  const captured = captureInput(input);
  if (captured === undefined) {
    return Object.freeze({ status: "rejected", reason: "malformed-input" });
  }
  const platform = createReferenceHostBrowserPlatform(captured.browser);
  if (platform.status !== "created") {
    return Object.freeze({ status: "rejected", reason: "invalid-browser-platform" });
  }
  const result: RuntimeWebHostAuthorityCreateResult = createRuntimeWebHostAuthority({
    platform: platform.handle,
    documentId: captured.documentId,
    revision: captured.revision,
    navigation: captured.navigation,
    storage: captured.storage,
    operations: captured.operations,
    resources: captured.resources,
    tokens: captured.tokens,
    context: captured.context,
    diagnostics: captured.diagnostics,
  });
  return result;
}

function captureInput(
  input: ReferenceHostWebPortsCreateInput,
): ReferenceHostWebPortsCreateInput | undefined {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
    const expected = [
      "browser",
      "documentId",
      "revision",
      "navigation",
      "storage",
      "operations",
      "resources",
      "tokens",
      "context",
      "diagnostics",
    ];
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expected.length ||
      keys.some((key) => typeof key !== "string" || !expected.includes(key))
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null);
    for (const key of expected) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze({
      browser: captured.browser as Window,
      documentId: captured.documentId as string,
      revision: captured.revision as string,
      navigation: captured.navigation as RuntimeNavigationPort,
      storage: captured.storage as RuntimeStoragePort,
      operations: captured.operations as RuntimeOperationPort,
      resources: captured.resources as RuntimeResourcePort,
      tokens: captured.tokens as RuntimeTokenPort,
      context: captured.context as RuntimeContextPort,
      diagnostics: captured.diagnostics as RuntimeDiagnosticsPort,
    });
  } catch {
    return undefined;
  }
}
