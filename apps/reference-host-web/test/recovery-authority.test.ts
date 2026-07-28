import { describe, expect, it } from "vitest";

import {
  authorizeReferenceHostRecovery,
  createReferenceHostRecoveryAuthority,
  disposeReferenceHostRecoveryAuthority,
  observeReferenceHostRecoveryAuthority,
} from "../src/recovery-authority.js";

import type { RuntimeHeadlessSessionHandle } from "@desen/runtime-core";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactLiveSurfaceInput,
} from "@desen/runtime-react";
import type { RuntimeWebHostAuthorityHandle } from "@desen/runtime-web";
import type {
  ReferenceHostRecoveryAuthorityHandle,
  ReferenceHostRecoveryAuthorityInput,
} from "../src/recovery-authority.js";

type RuntimeReactCatalogSet = RuntimeReactLiveSurfaceInput["catalogSet"];

function identities(): ReferenceHostRecoveryAuthorityInput {
  return {
    session: Object.freeze({}) as unknown as RuntimeHeadlessSessionHandle,
    registry: Object.freeze({}) as unknown as RuntimeReactAdapterRegistryHandle,
    catalogSet: Object.freeze({}) as unknown as RuntimeReactCatalogSet,
    hostAuthority: Object.freeze({}) as unknown as RuntimeWebHostAuthorityHandle,
  };
}

describe("reference-host recovery authority", () => {
  it("preserves ordinary observations and advances only explicit retry or authority replacement", () => {
    const authority = createReferenceHostRecoveryAuthority();
    const firstIdentities = identities();
    const initial = observeReferenceHostRecoveryAuthority(authority, firstIdentities);
    expect(initial).toEqual({
      status: "observed",
      snapshot: {
        relationship: "initial",
        recoveryKey: "reference-host-authority:0:retry:0",
      },
    });

    const preserved = observeReferenceHostRecoveryAuthority(authority, {
      ...firstIdentities,
    });
    expect(preserved).toEqual({
      status: "observed",
      snapshot: {
        relationship: "preserved",
        recoveryKey: "reference-host-authority:0:retry:0",
      },
    });

    expect(authorizeReferenceHostRecovery(authority)).toEqual({
      status: "authorized",
      recoveryKey: "reference-host-authority:0:retry:1",
    });
    expect(observeReferenceHostRecoveryAuthority(authority, firstIdentities)).toEqual({
      status: "observed",
      snapshot: {
        relationship: "preserved",
        recoveryKey: "reference-host-authority:0:retry:1",
      },
    });

    const replacement = observeReferenceHostRecoveryAuthority(authority, {
      ...firstIdentities,
      registry: Object.freeze({}) as unknown as RuntimeReactAdapterRegistryHandle,
    });
    expect(replacement).toEqual({
      status: "observed",
      snapshot: {
        relationship: "replaced",
        recoveryKey: "reference-host-authority:1:retry:0",
      },
    });
  });

  it("isolates roots and has no Bundle, revision, result, or snapshot input channel", () => {
    const first = createReferenceHostRecoveryAuthority();
    const second = createReferenceHostRecoveryAuthority();
    const shared = identities();

    expect(observeReferenceHostRecoveryAuthority(first, shared)).toMatchObject({
      status: "observed",
      snapshot: { recoveryKey: "reference-host-authority:0:retry:0" },
    });
    expect(observeReferenceHostRecoveryAuthority(second, shared)).toMatchObject({
      status: "observed",
      snapshot: { recoveryKey: "reference-host-authority:0:retry:0" },
    });
    expect(authorizeReferenceHostRecovery(first)).toMatchObject({
      recoveryKey: "reference-host-authority:0:retry:1",
    });
    expect(authorizeReferenceHostRecovery(second)).toMatchObject({
      recoveryKey: "reference-host-authority:0:retry:1",
    });
  });

  it("rejects hostile and accessor-backed input without invoking hooks", () => {
    const authority = createReferenceHostRecoveryAuthority();
    let getterCalls = 0;
    const accessorInput = Object.defineProperties(
      {},
      {
        session: {
          enumerable: true,
          get() {
            getterCalls += 1;
            return {};
          },
        },
        registry: { enumerable: true, value: {} },
        catalogSet: { enumerable: true, value: {} },
        hostAuthority: { enumerable: true, value: {} },
      },
    );
    expect(
      observeReferenceHostRecoveryAuthority(
        authority,
        accessorInput as ReferenceHostRecoveryAuthorityInput,
      ),
    ).toEqual({ status: "malformed-input" });
    expect(getterCalls).toBe(0);

    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("hostile reflection");
        },
      },
    );
    expect(
      observeReferenceHostRecoveryAuthority(
        authority,
        hostile as ReferenceHostRecoveryAuthorityInput,
      ),
    ).toEqual({ status: "malformed-input" });
  });

  it("disposes terminally and does not retain current authority", () => {
    const authority = createReferenceHostRecoveryAuthority();
    expect(authorizeReferenceHostRecovery(authority)).toEqual({ status: "unavailable" });
    expect(observeReferenceHostRecoveryAuthority(authority, identities()).status).toBe("observed");
    expect(disposeReferenceHostRecoveryAuthority(authority)).toEqual({ status: "disposed" });
    expect(disposeReferenceHostRecoveryAuthority(authority)).toEqual({
      status: "already-disposed",
    });
    expect(authorizeReferenceHostRecovery(authority)).toEqual({ status: "disposed" });
    expect(observeReferenceHostRecoveryAuthority(authority, identities())).toEqual({
      status: "disposed",
    });
    expect(
      observeReferenceHostRecoveryAuthority(
        Object.freeze({}) as ReferenceHostRecoveryAuthorityHandle,
        identities(),
      ),
    ).toEqual({ status: "invalid-authority" });
  });
});
