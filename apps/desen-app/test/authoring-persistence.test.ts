/* eslint-disable @typescript-eslint/no-invalid-void-type -- Test ports verify receiver-independent
 * persistence callbacks. */
import { createDesenEditorDocument } from "@desen/editor-core";
import { createJsonPointer } from "@desen/protocol";
import { describe, expect, it, vi } from "vitest";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import {
  authenticateAuthoringPersistenceControllerProfile,
  createAuthoringPersistenceController,
  deriveAuthoringPersistenceSourceKey,
} from "../src/authoring-persistence.js";
import {
  REFERENCE_AUTHORING_WORKSPACE_PROFILE,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/reference-authoring-profile.js";
import {
  createProjectWorkspaceProfile,
  readProjectWorkspaceProfileAuthority,
} from "../src/project-workspace-profile.js";

import type {
  DesenEditorDocument,
  DesenEditorPersistencePort,
  DesenEditorSourceOpenResult,
  DesenEditorSourceSaveRequest,
  DesenEditorSourceSaveResult,
} from "@desen/editor-core";
import type {
  AuthoringPersistenceController,
  AuthoringPersistenceControllerCreationResult,
  AuthoringPersistenceRoute,
} from "../src/authoring-persistence.js";
import type { ProjectWorkspaceProfileHandle } from "../src/project-workspace-profile.js";

const ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "sign-in",
}) satisfies AuthoringPersistenceRoute;

type MutableJsonObject = Record<string, unknown>;

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function copyJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown, path: string): MutableJsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value as MutableJsonObject;
}

function editorDocument(value: unknown): DesenEditorDocument {
  const result = createDesenEditorDocument(value);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError("Expected an editor-admissible document fixture.");
  return result.document;
}

function changedDocument(text: string): DesenEditorDocument {
  const source = copyJson(officialSignInSource) as MutableJsonObject;
  const surfaces = record(source.surfaces, "surfaces");
  const signIn = record(surfaces["sign-in"], "sign-in");
  const root = record(signIn.root, "sign-in.root");
  const slots = record(root.slots, "sign-in.root.slots");
  const children = slots.default;
  if (!Array.isArray(children)) throw new TypeError("default slot must be an array.");
  const title = record(children[0], "sign-in.title");
  record(title.props, "sign-in.title.props").text = text;
  return editorDocument(source);
}

function port(
  openSource: DesenEditorPersistencePort["openSource"] = async () => ({ status: "missing" }),
  saveSource: DesenEditorPersistencePort["saveSource"] = async () => ({
    status: "created",
    generation: 1,
  }),
): DesenEditorPersistencePort {
  return Object.freeze({ openSource, saveSource });
}

function requireController(
  persistencePort: DesenEditorPersistencePort = port(),
  document: DesenEditorDocument = REFERENCE_EDITOR_DOCUMENT,
): AuthoringPersistenceController {
  const result = createAuthoringPersistenceController({
    route: ROUTE,
    document,
    profile: REFERENCE_AUTHORING_WORKSPACE_PROFILE,
    persistencePort,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(`Expected a controller, received ${result.reason}.`);
  return result.controller;
}

function siblingWorkspaceProfile(): ProjectWorkspaceProfileHandle {
  const authority = readProjectWorkspaceProfileAuthority(REFERENCE_AUTHORING_WORKSPACE_PROFILE);
  if (authority.status !== "read") throw new TypeError("Expected the official workspace profile.");
  const profile = authority.profile;
  const created = createProjectWorkspaceProfile({
    profileId: profile.profileId,
    project: profile.project,
    route: profile.route,
    sourceSurfaceId: profile.sourceSurfaceId,
    documentId: profile.documentId,
    sourceKey: "account-app-other-source",
    initialDocument: profile.initialDocument,
    catalogs: profile.catalogs,
    catalogPackages: profile.catalogPackages,
    runtime: {
      target: profile.runtime.target,
      registry: profile.runtime.registry,
      tokenCssProperties: profile.runtime.tokenCssProperties,
      hostPorts: profile.runtime.hostPorts,
    },
    publication: profile.publication,
  });
  if (!created.ok) throw new TypeError(`Expected sibling profile: ${created.reason}.`);
  return created.handle;
}

function expectCreationFailure(
  result: AuthoringPersistenceControllerCreationResult,
  reason: Exclude<AuthoringPersistenceControllerCreationResult, { readonly ok: true }>["reason"],
): void {
  expect(result).toEqual({ ok: false, reason });
  expect(Object.isFrozen(result)).toBe(true);
}

describe("Desen App authored Source persistence state", () => {
  it("derives the exact project-owned local key without consulting Source.id", () => {
    expect(deriveAuthoringPersistenceSourceKey(ROUTE, REFERENCE_AUTHORING_WORKSPACE_PROFILE)).toBe(
      "account-app-source",
    );
    expect(
      deriveAuthoringPersistenceSourceKey(
        { projectId: "account-app", surfaceId: "foreign-surface" },
        REFERENCE_AUTHORING_WORKSPACE_PROFILE,
      ),
    ).toBeNull();
    expect(
      deriveAuthoringPersistenceSourceKey(
        { projectId: "checkout-pilot", surfaceId: "sign-in" },
        REFERENCE_AUTHORING_WORKSPACE_PROFILE,
      ),
    ).toBeNull();

    let accessorCalls = 0;
    const hostileRoute = Object.defineProperty({ surfaceId: "sign-in" }, "projectId", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return "account-app";
      },
    });
    expect(
      deriveAuthoringPersistenceSourceKey(
        hostileRoute as AuthoringPersistenceRoute,
        REFERENCE_AUTHORING_WORKSPACE_PROFILE,
      ),
    ).toBeNull();
    expect(accessorCalls).toBe(0);

    const changedId = copyJson(officialSignInSource) as MutableJsonObject;
    changedId.id = "com.example.some-other-document";
    expect(deriveAuthoringPersistenceSourceKey(ROUTE, REFERENCE_AUTHORING_WORKSPACE_PROFILE)).toBe(
      "account-app-source",
    );
  });

  it("fails closed when a structurally plausible workspace-profile handle was not factory-authenticated", () => {
    const forgedProfile = Object.freeze({}) as ProjectWorkspaceProfileHandle;

    expect(deriveAuthoringPersistenceSourceKey(ROUTE, forgedProfile)).toBeNull();
    expectCreationFailure(
      createAuthoringPersistenceController({
        route: ROUTE,
        document: REFERENCE_EDITOR_DOCUMENT,
        profile: forgedProfile,
        persistencePort: port(),
      }),
      "profile-invalid",
    );
  });

  it("starts with one admitted authored session and a stable immutable external-store snapshot", () => {
    const controller = requireController();
    const first = controller.read();
    const second = controller.read();

    expect(first).toBe(second);
    expect(first).toEqual(
      expect.objectContaining({
        route: ROUTE,
        sourceKey: "account-app-source",
        generation: null,
        savedDocument: null,
        dirty: true,
        reopenRequired: false,
        pending: null,
        openResult: null,
        saveResult: null,
        disposed: false,
      }),
    );
    expect(first.session.document).toEqual(REFERENCE_EDITOR_DOCUMENT);
    expect(first.session.preview.ok).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.route)).toBe(true);
    expect(Object.isFrozen(first.session)).toBe(true);
    expect(Object.isFrozen(controller)).toBe(true);
  });

  it("binds every controller to the exact opaque profile handle that created it", () => {
    const controller = requireController();
    const sibling = siblingWorkspaceProfile();

    expect(
      authenticateAuthoringPersistenceControllerProfile(
        controller,
        REFERENCE_AUTHORING_WORKSPACE_PROFILE,
      ),
    ).toEqual({ status: "authenticated" });
    expect(authenticateAuthoringPersistenceControllerProfile(controller, sibling)).toEqual({
      status: "profile-mismatch",
    });
    expect(
      authenticateAuthoringPersistenceControllerProfile(
        Object.freeze({}) as AuthoringPersistenceController,
        REFERENCE_AUTHORING_WORKSPACE_PROFILE,
      ),
    ).toEqual({ status: "invalid-controller" });
  });

  it("fails closed for unknown routes, malformed ports, and document mismatch", () => {
    const base = {
      route: ROUTE,
      document: REFERENCE_EDITOR_DOCUMENT,
      profile: REFERENCE_AUTHORING_WORKSPACE_PROFILE,
      persistencePort: port(),
    };
    expectCreationFailure(
      createAuthoringPersistenceController({
        ...base,
        route: { projectId: "account-app", surfaceId: "foreign-surface" },
      }),
      "route-invalid",
    );
    expectCreationFailure(
      createAuthoringPersistenceController({
        ...base,
        persistencePort: { ...port(), extra: true } as DesenEditorPersistencePort,
      }),
      "port-invalid",
    );
    const wrongDocument = copyJson(officialSignInSource) as MutableJsonObject;
    wrongDocument.id = "com.example.wrong-project";
    expectCreationFailure(
      createAuthoringPersistenceController({ ...base, document: editorDocument(wrongDocument) }),
      "document-mismatch",
    );
  });

  it("captures port methods as receiver-independent stable callbacks", async () => {
    const calls: string[] = [];
    const mutablePort = {
      openSource: async function (this: void, sourceKey: string) {
        expect(this).toBeUndefined();
        calls.push(`open:${sourceKey}`);
        return { status: "missing" as const };
      },
      saveSource: async function (this: void, request: DesenEditorSourceSaveRequest) {
        expect(this).toBeUndefined();
        calls.push(`save:${request.sourceKey}`);
        return { status: "created" as const, generation: 1 as const };
      },
    };
    const controller = requireController(mutablePort);
    mutablePort.openSource = async () => {
      throw new Error("mutated callback");
    };

    await expect(controller.open()).resolves.toEqual({ status: "missing" });
    await expect(controller.save()).resolves.toEqual({ status: "created", generation: 1 });
    expect(calls).toEqual(["open:account-app-source", "save:account-app-source"]);
  });

  it("replaces only a completely admitted authored document and matching preview", () => {
    const controller = requireController();
    const before = controller.read();
    const changed = changedDocument("Welcome back");
    const result = controller.replaceAuthoredDocument(changed);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected an admitted replacement.");
    expect(controller.read().session).toBe(result.session);
    expect(controller.read().session.document).toEqual(changed);
    expect(controller.read().session.preview.revision).not.toBe(before.session.preview.revision);
    expect(controller.read().dirty).toBe(true);

    const invalid = copyJson(officialSignInSource) as MutableJsonObject;
    invalid.kind = "desen.bundle";
    const retained = controller.read();
    expect(controller.replaceAuthoredDocument(invalid as DesenEditorDocument)).toEqual({
      ok: false,
      reason: "document-invalid",
    });
    expect(controller.read()).toBe(retained);
  });

  it("clears stale open and save notices when a new idle authored edit becomes unsaved", async () => {
    const controller = requireController();
    await controller.open();
    await controller.save();
    expect(controller.read().saveResult).toEqual({ status: "created", generation: 1 });

    controller.replaceAuthoredDocument(changedDocument("A newly unsaved edit"));
    expect(controller.read()).toEqual(
      expect.objectContaining({
        dirty: true,
        openResult: null,
        saveResult: null,
      }),
    );
  });

  it("derives clean replacements from complete canonical authored content", async () => {
    const controller = requireController();
    await controller.save();
    const before = controller.read();

    const result = controller.replaceAuthoredDocument(before.session.document);
    expect(result).toEqual({ ok: true, session: before.session });
    expect(controller.read()).toBe(before);
    expect(controller.read().dirty).toBe(false);

    const sameValue = controller.replaceAuthoredDocument(changedDocument("Sign in"));
    expect(sameValue).toEqual({ ok: true, session: before.session });
    expect(controller.read()).toBe(before);

    expect(controller.replaceAuthoredDocument(changedDocument("Changed then reverted")).ok).toBe(
      true,
    );
    expect(controller.read().dirty).toBe(true);
    expect(controller.replaceAuthoredDocument(changedDocument("Sign in")).ok).toBe(true);
    expect(controller.read().session.document).toEqual(before.savedDocument);
    expect(controller.read().session.document).not.toBe(before.savedDocument);
    expect(controller.read().dirty).toBe(false);
  });

  it("publishes opening synchronously and swaps document plus preview atomically after admission", async () => {
    const pending = deferred<DesenEditorSourceOpenResult>();
    const openedDocument = changedDocument("Stored title");
    const openSource = vi.fn(() => pending.promise);
    const controller = requireController(port(openSource));
    const notifications: string[] = [];
    controller.subscribe(() => notifications.push(controller.read().pending ?? "settled"));

    const opening = controller.open();
    expect(controller.read().pending).toBe("opening");
    expect(notifications).toEqual(["opening"]);
    expect(openSource).toHaveBeenCalledWith("account-app-source");

    pending.resolve({ status: "opened", generation: 7, document: openedDocument });
    const result = await opening;
    expect(result.status).toBe("opened");
    if (result.status !== "opened") throw new TypeError("Expected an opened session.");
    expect(result.session.document).toEqual(openedDocument);
    expect(result.session.preview.revision).toBe(controller.read().session.preview.revision);
    expect(controller.read()).toEqual(
      expect.objectContaining({
        session: result.session,
        generation: 7,
        savedDocument: result.session.document,
        dirty: false,
        reopenRequired: false,
        pending: null,
        openResult: result,
      }),
    );
    expect(notifications).toEqual(["opening", "settled"]);
  });

  it("keeps opened, missing, and failed results distinct", async () => {
    const openedDocument = changedDocument("First stored title");
    const readResults: DesenEditorSourceOpenResult[] = [
      { status: "opened", generation: 4, document: openedDocument },
      { status: "missing" },
      {
        status: "failed",
        diagnostic: {
          code: "run.desen.editor/PERSISTENCE_STORAGE_UNAVAILABLE",
          message: "Storage unavailable.",
          pointer: createJsonPointer(["surfaces", "sign-in", "root"]),
          context: {
            documentId: "com.example.account-app",
            surfaceId: "sign-in",
            subject: { kind: "node", id: "sign-in.layout" },
            capabilityId: "com.example.ui/Stack",
          },
        },
      },
    ];
    const controller = requireController(
      port(async () => {
        const result = readResults.shift();
        if (result === undefined) throw new Error("Missing read fixture.");
        return result;
      }),
    );

    await expect(controller.open()).resolves.toEqual(
      expect.objectContaining({ status: "opened", generation: 4 }),
    );
    await expect(controller.open()).resolves.toEqual({ status: "missing" });
    expect(controller.read()).toEqual(
      expect.objectContaining({
        generation: null,
        savedDocument: null,
        dirty: true,
        reopenRequired: false,
      }),
    );
    await expect(controller.open()).resolves.toEqual({
      status: "failed",
      reason: "persistence-failed",
      diagnostic: expect.objectContaining({
        code: "run.desen.editor/PERSISTENCE_STORAGE_UNAVAILABLE",
        pointer: "/surfaces/sign-in/root",
        context: {
          documentId: "com.example.account-app",
          surfaceId: "sign-in",
          subject: { kind: "node", id: "sign-in.layout" },
          capabilityId: "com.example.ui/Stack",
        },
      }),
    });
  });

  it("treats an unexpected dispatched save rejection as indeterminate but an open rejection as failed", async () => {
    const openController = requireController(
      port(async () => {
        throw new Error("secret read detail");
      }),
    );
    const openResult = await openController.open();
    expect(openResult).toEqual({
      status: "failed",
      reason: "persistence-failed",
      diagnostic: null,
    });
    expect(JSON.stringify(openResult)).not.toContain("secret");

    const saveController = requireController(
      port(undefined, async () => {
        throw new Error("secret write detail");
      }),
    );
    const saveResult = await saveController.save();
    expect(saveResult).toEqual({
      status: "indeterminate",
      diagnostic: expect.objectContaining({
        code: "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
      }),
    });
    expect(JSON.stringify(saveResult)).not.toContain("secret");
    expect(saveController.read().reopenRequired).toBe(true);
    expect(saveController.read().dirty).toBe(true);
  });

  it("fails closed and remains retryable for malformed open settlements without invoking accessors", async () => {
    let accessorCalls = 0;
    let proxyCalls = 0;
    const accessorSettlement = Object.defineProperty({}, "status", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        throw new Error("SECRET_OPEN_ACCESSOR");
      },
    });
    const proxySettlement = new Proxy(
      {},
      {
        ownKeys() {
          proxyCalls += 1;
          throw new Error("SECRET_OPEN_PROXY");
        },
      },
    );
    const malformedSettlements: readonly unknown[] = [
      null,
      7,
      Object.freeze({ status: "unknown" }),
      Object.freeze({ status: "missing", extra: true }),
      Object.freeze({
        status: "opened",
        generation: 0,
        document: REFERENCE_EDITOR_DOCUMENT,
      }),
      Object.freeze({
        status: "failed",
        diagnostic: Object.freeze({ code: "UNKNOWN", message: "Not a persistence diagnostic." }),
      }),
      accessorSettlement,
      proxySettlement,
    ];

    for (const malformed of malformedSettlements) {
      let openCalls = 0;
      const controller = requireController(
        port(async () => {
          openCalls += 1;
          return (
            openCalls === 1 ? malformed : { status: "missing" }
          ) as DesenEditorSourceOpenResult;
        }),
      );
      const retainedSession = controller.read().session;

      await expect(controller.open()).resolves.toEqual({
        status: "failed",
        reason: "persistence-failed",
        diagnostic: null,
      });
      expect(controller.read()).toEqual(
        expect.objectContaining({
          session: retainedSession,
          pending: null,
          dirty: true,
          reopenRequired: false,
        }),
      );
      await expect(controller.open()).resolves.toEqual({ status: "missing" });
      expect(openCalls).toBe(2);
    }

    expect(accessorCalls).toBe(0);
    expect(proxyCalls).toBeGreaterThan(0);
  });

  it("treats every malformed dispatched save settlement as indeterminate until reopen", async () => {
    let accessorCalls = 0;
    let proxyCalls = 0;
    const accessorSettlement = Object.defineProperty({}, "status", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        throw new Error("SECRET_SAVE_ACCESSOR");
      },
    });
    const proxySettlement = new Proxy(
      {},
      {
        ownKeys() {
          proxyCalls += 1;
          throw new Error("SECRET_SAVE_PROXY");
        },
      },
    );
    const malformedSettlements: readonly unknown[] = [
      null,
      false,
      Object.freeze({ status: "unknown" }),
      Object.freeze({ status: "created", generation: 1, extra: true }),
      Object.freeze({ status: "created", generation: 2 }),
      Object.freeze({
        status: "failed",
        diagnostic: Object.freeze({
          code: "run.desen.editor/PERSISTENCE_STORAGE_BUSY",
          message: "Storage busy.",
          extra: true,
        }),
      }),
      accessorSettlement,
      proxySettlement,
    ];

    for (const malformed of malformedSettlements) {
      let saveCalls = 0;
      const controller = requireController(
        port(undefined, async () => {
          saveCalls += 1;
          return (
            saveCalls === 1 ? malformed : { status: "created", generation: 1 }
          ) as DesenEditorSourceSaveResult;
        }),
      );

      await expect(controller.save()).resolves.toEqual({
        status: "indeterminate",
        diagnostic: expect.objectContaining({
          code: "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
        }),
      });
      expect(controller.read()).toEqual(
        expect.objectContaining({
          pending: null,
          dirty: true,
          reopenRequired: true,
        }),
      );
      await expect(controller.save()).resolves.toEqual({
        status: "failed",
        reason: "reopen-required",
        diagnostic: null,
      });
      expect(saveCalls).toBe(1);

      await expect(controller.open()).resolves.toEqual({ status: "missing" });
      await expect(controller.save()).resolves.toEqual({ status: "created", generation: 1 });
      expect(saveCalls).toBe(2);
    }

    expect(accessorCalls).toBe(0);
    expect(proxyCalls).toBeGreaterThan(0);
  });

  it("rechecks open authority after settlement capture and opened-document admission", async () => {
    const captureEdit = changedDocument("Capture re-entry wins");
    const captureControllerReference: { current?: AuthoringPersistenceController } = {};
    let captureReentered = false;
    const missingSettlement = new Proxy(
      { status: "missing" as const },
      {
        getPrototypeOf(target) {
          if (!captureReentered) {
            captureReentered = true;
            const current = captureControllerReference.current;
            if (current === undefined) throw new TypeError("Missing capture controller.");
            current.replaceAuthoredDocument(captureEdit);
          }
          return Reflect.getPrototypeOf(target);
        },
      },
    );
    const captureController = requireController(
      port(async () => missingSettlement as DesenEditorSourceOpenResult),
    );
    captureControllerReference.current = captureController;

    await expect(captureController.open()).resolves.toEqual({
      status: "failed",
      reason: "stale-operation",
      diagnostic: null,
    });
    expect(captureReentered).toBe(true);
    expect(captureController.read().session.document).toEqual(captureEdit);
    expect(captureController.read().generation).toBeNull();

    const admissionEdit = changedDocument("Admission re-entry wins");
    const admissionControllerReference: { current?: AuthoringPersistenceController } = {};
    let admissionReentered = false;
    const hostileOpenedDocument = new Proxy(copyJson(officialSignInSource) as MutableJsonObject, {
      getPrototypeOf(target) {
        if (!admissionReentered) {
          admissionReentered = true;
          const current = admissionControllerReference.current;
          if (current === undefined) throw new TypeError("Missing admission controller.");
          current.replaceAuthoredDocument(admissionEdit);
        }
        return Reflect.getPrototypeOf(target);
      },
    });
    const admissionController = requireController(
      port(async () => ({
        status: "opened",
        generation: 4,
        document: hostileOpenedDocument as unknown as DesenEditorDocument,
      })),
    );
    admissionControllerReference.current = admissionController;

    await expect(admissionController.open()).resolves.toEqual({
      status: "failed",
      reason: "stale-operation",
      diagnostic: null,
    });
    expect(admissionReentered).toBe(true);
    expect(admissionController.read().session.document).toEqual(admissionEdit);
    expect(admissionController.read().generation).toBeNull();
  });

  it("rechecks save authority after settlement capture re-entry", async () => {
    const controllerReference: { current?: AuthoringPersistenceController } = {};
    let reentered = false;
    const createdSettlement = new Proxy(
      { status: "created" as const, generation: 1 as const },
      {
        getPrototypeOf(target) {
          if (!reentered) {
            reentered = true;
            const current = controllerReference.current;
            if (current === undefined) throw new TypeError("Missing save controller.");
            current.dispose();
          }
          return Reflect.getPrototypeOf(target);
        },
      },
    );
    const controller = requireController(
      port(undefined, async () => createdSettlement as DesenEditorSourceSaveResult),
    );
    controllerReference.current = controller;

    await expect(controller.save()).resolves.toEqual({
      status: "failed",
      reason: "disposed",
      diagnostic: null,
    });
    expect(reentered).toBe(true);
    expect(controller.read()).toEqual(
      expect.objectContaining({
        disposed: true,
        pending: null,
        generation: null,
        savedDocument: null,
        dirty: true,
      }),
    );
  });

  it("rejects a structurally valid opened document with the wrong exact document identity", async () => {
    const wrong = copyJson(officialSignInSource) as MutableJsonObject;
    wrong.id = "com.example.other-document";
    const controller = requireController(
      port(async () => ({ status: "opened", generation: 2, document: editorDocument(wrong) })),
    );
    const retained = controller.read().session;

    await expect(controller.open()).resolves.toEqual({
      status: "failed",
      reason: "document-mismatch",
      diagnostic: null,
    });
    expect(controller.read().session).toBe(retained);
    expect(controller.read().generation).toBeNull();
    expect(controller.read().savedDocument).toBeNull();
  });

  it("prevents an open settlement from overwriting an authored edit made while reading", async () => {
    const pending = deferred<DesenEditorSourceOpenResult>();
    const controller = requireController(port(() => pending.promise));
    const opening = controller.open();
    const edited = changedDocument("Keep my local edit");

    const openingSnapshot = controller.read();
    expect(controller.replaceAuthoredDocument(changedDocument("Sign in"))).toEqual({
      ok: true,
      session: openingSnapshot.session,
    });
    expect(controller.read()).toBe(openingSnapshot);
    expect(controller.read().pending).toBe("opening");

    expect(controller.replaceAuthoredDocument(edited).ok).toBe(true);
    expect(controller.read().pending).toBeNull();
    expect(controller.read().openResult).toEqual({
      status: "failed",
      reason: "stale-operation",
      diagnostic: null,
    });
    pending.resolve({
      status: "opened",
      generation: 8,
      document: changedDocument("Late stored title"),
    });
    await expect(opening).resolves.toEqual({
      status: "failed",
      reason: "stale-operation",
      diagnostic: null,
    });
    expect(controller.read().session.document).toEqual(edited);
    expect(controller.read().generation).toBeNull();
  });

  it("saves the authored snapshot with exact route key and generation precondition", async () => {
    const saveRequests: DesenEditorSourceSaveRequest[] = [];
    const pending = deferred<DesenEditorSourceSaveResult>();
    const controller = requireController(
      port(undefined, async (request) => {
        saveRequests.push(request);
        return pending.promise;
      }),
    );
    const notifications: string[] = [];
    controller.subscribe(() => notifications.push(controller.read().pending ?? "settled"));

    const saving = controller.save();
    expect(controller.read().pending).toBe("saving");
    expect(notifications).toEqual(["saving"]);
    expect(saveRequests).toHaveLength(1);
    expect(saveRequests[0]).toEqual({
      sourceKey: "account-app-source",
      expectedGeneration: null,
      document: controller.read().session.document,
    });
    expect(Reflect.ownKeys(saveRequests[0] ?? {})).toEqual([
      "sourceKey",
      "expectedGeneration",
      "document",
    ]);

    pending.resolve({ status: "created", generation: 1 });
    await expect(saving).resolves.toEqual({ status: "created", generation: 1 });
    expect(controller.read()).toEqual(
      expect.objectContaining({
        generation: 1,
        savedDocument: controller.read().session.document,
        dirty: false,
        reopenRequired: false,
        pending: null,
        saveResult: { status: "created", generation: 1 },
      }),
    );
    expect(notifications).toEqual(["saving", "settled"]);
  });

  it("retains a newer authored edit while an earlier save snapshot settles", async () => {
    const firstPending = deferred<DesenEditorSourceSaveResult>();
    const secondPending = deferred<DesenEditorSourceSaveResult>();
    const pendingSaves = [firstPending, secondPending];
    let saveCall = 0;
    const controller = requireController(
      port(
        async () => ({
          status: "opened",
          generation: 1,
          document: REFERENCE_EDITOR_DOCUMENT,
        }),
        () => {
          const pending = pendingSaves[saveCall];
          saveCall += 1;
          if (pending === undefined) throw new Error("Missing pending save fixture.");
          return pending.promise;
        },
      ),
    );
    await controller.open();
    const firstSaved = controller.read().savedDocument;
    const snapshot = changedDocument("Snapshot being saved");
    controller.replaceAuthoredDocument(snapshot);

    const saving = controller.save();
    const later = changedDocument("Later unsaved edit");
    controller.replaceAuthoredDocument(later);
    expect(controller.read().pending).toBe("saving");
    expect(controller.read().session.document).toEqual(later);

    firstPending.resolve({ status: "updated", generation: 2 });
    await expect(saving).resolves.toEqual({ status: "updated", generation: 2 });
    expect(controller.read().session.document).toEqual(later);
    expect(controller.read().savedDocument).toEqual(snapshot);
    expect(controller.read().savedDocument).not.toBe(firstSaved);
    expect(controller.read().generation).toBe(2);
    expect(controller.read().dirty).toBe(true);

    const savingLater = controller.save();
    expect(controller.read().pending).toBe("saving");
    controller.replaceAuthoredDocument(changedDocument("Edit away from the pending snapshot"));
    expect(controller.read().dirty).toBe(true);
    controller.replaceAuthoredDocument(changedDocument("Later unsaved edit"));
    expect(controller.read().dirty).toBe(true);

    secondPending.resolve({ status: "updated", generation: 3 });
    await expect(savingLater).resolves.toEqual({ status: "updated", generation: 3 });
    expect(controller.read().savedDocument).toEqual(later);
    expect(controller.read().session.document).toEqual(later);
    expect(controller.read().session.document).not.toBe(later);
    expect(controller.read().generation).toBe(3);
    expect(controller.read().dirty).toBe(false);
  });

  it.each([
    [{ status: "updated", generation: 2 } as const, { status: "updated", generation: 2 }, false, 1],
    [
      { status: "unchanged", generation: 1 } as const,
      { status: "unchanged", generation: 1 },
      false,
      1,
    ],
    [
      { status: "conflict", currentGeneration: 9 } as const,
      { status: "conflict", currentGeneration: 9 },
      true,
      1,
    ],
    [
      { status: "generation-exhausted", generation: Number.MAX_SAFE_INTEGER } as const,
      { status: "generation-exhausted", generation: Number.MAX_SAFE_INTEGER },
      true,
      Number.MAX_SAFE_INTEGER,
    ],
    [
      {
        status: "indeterminate",
        diagnostic: {
          code: "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
          message: "Reopen required.",
        },
      } as const,
      {
        status: "indeterminate",
        diagnostic: expect.objectContaining({
          code: "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
        }),
      },
      true,
      1,
    ],
    [
      {
        status: "failed",
        diagnostic: {
          code: "run.desen.editor/PERSISTENCE_STORAGE_BUSY",
          message: "Storage busy.",
          pointer: createJsonPointer(["surfaces", "sign-in", "root"]),
          context: { surfaceId: "sign-in", subject: { kind: "node", id: "sign-in.layout" } },
        },
      } as const,
      {
        status: "failed",
        reason: "persistence-failed",
        diagnostic: expect.objectContaining({
          code: "run.desen.editor/PERSISTENCE_STORAGE_BUSY",
          pointer: "/surfaces/sign-in/root",
          context: {
            surfaceId: "sign-in",
            subject: { kind: "node", id: "sign-in.layout" },
          },
        }),
      },
      false,
      1,
    ],
  ])(
    "keeps save settlement %# distinct",
    async (portResult, expected, reopenRequired, openedGeneration) => {
      const controller = requireController(
        port(
          async () => ({
            status: "opened",
            generation: openedGeneration,
            document: REFERENCE_EDITOR_DOCUMENT,
          }),
          async () => portResult,
        ),
      );
      await controller.open();
      controller.replaceAuthoredDocument(changedDocument(`Candidate ${String(portResult.status)}`));

      await expect(controller.save()).resolves.toEqual(expected);
      expect(controller.read().reopenRequired).toBe(reopenRequired);
      expect(controller.read().dirty).toBe(
        portResult.status !== "updated" && portResult.status !== "unchanged",
      );
    },
  );

  it.each(["conflict", "indeterminate"] as const)(
    "requires an explicit reopen after %s and never retries or merges",
    async (outcome) => {
      const writes: DesenEditorSourceSaveRequest[] = [];
      let reads = 0;
      const controller = requireController(
        port(
          async () => {
            reads += 1;
            if (reads === 1) {
              return {
                status: "opened",
                generation: 1,
                document: REFERENCE_EDITOR_DOCUMENT,
              };
            }
            return { status: "missing" };
          },
          async (request) => {
            writes.push(request);
            return outcome === "conflict"
              ? { status: "conflict", currentGeneration: 3 }
              : {
                  status: "indeterminate",
                  diagnostic: {
                    code: "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
                    message: "Reopen required.",
                  },
                };
          },
        ),
      );

      await expect(controller.open()).resolves.toEqual(
        expect.objectContaining({ status: "opened", generation: 1 }),
      );
      controller.replaceAuthoredDocument(changedDocument(`Candidate ${outcome}`));
      expect((await controller.save()).status).toBe(outcome);
      controller.replaceAuthoredDocument(changedDocument("Sign in"));
      expect(controller.read().dirty).toBe(true);
      expect(controller.read().reopenRequired).toBe(true);
      await expect(controller.save()).resolves.toEqual({
        status: "failed",
        reason: "reopen-required",
        diagnostic: null,
      });
      expect(writes).toHaveLength(1);
      expect(controller.read().reopenRequired).toBe(true);

      await expect(controller.open()).resolves.toEqual({ status: "missing" });
      expect(reads).toBe(2);
      expect(controller.read().reopenRequired).toBe(false);
      expect(controller.read().generation).toBeNull();
      expect(controller.read().savedDocument).toBeNull();
      expect(controller.read().dirty).toBe(true);
    },
  );

  it("keeps generation exhaustion locked across a failed open until storage is observed", async () => {
    let openCall = 0;
    let saveCall = 0;
    const controller = requireController(
      port(
        async () => {
          openCall += 1;
          if (openCall === 1) {
            return {
              status: "opened",
              generation: Number.MAX_SAFE_INTEGER,
              document: REFERENCE_EDITOR_DOCUMENT,
            };
          }
          if (openCall === 2) {
            return {
              status: "failed",
              diagnostic: {
                code: "run.desen.editor/PERSISTENCE_STORAGE_UNAVAILABLE",
                message: "Storage unavailable.",
              },
            };
          }
          return { status: "missing" };
        },
        async () => {
          saveCall += 1;
          return saveCall === 1
            ? { status: "generation-exhausted", generation: Number.MAX_SAFE_INTEGER }
            : { status: "created", generation: 1 };
        },
      ),
    );
    await controller.open();
    controller.replaceAuthoredDocument(changedDocument("Exhausted candidate"));
    await expect(controller.save()).resolves.toEqual({
      status: "generation-exhausted",
      generation: Number.MAX_SAFE_INTEGER,
    });
    expect(controller.read().reopenRequired).toBe(true);

    expect((await controller.open()).status).toBe("failed");
    expect(controller.read().reopenRequired).toBe(true);
    await expect(controller.save()).resolves.toEqual({
      status: "failed",
      reason: "reopen-required",
      diagnostic: null,
    });
    expect(saveCall).toBe(1);

    await expect(controller.open()).resolves.toEqual({ status: "missing" });
    expect(controller.read().reopenRequired).toBe(false);
    await expect(controller.save()).resolves.toEqual({ status: "created", generation: 1 });
    expect(saveCall).toBe(2);
  });

  it("rejects concurrent operations without dispatching a second port request", async () => {
    const pending = deferred<DesenEditorSourceOpenResult>();
    const openSource = vi.fn(() => pending.promise);
    const saveSource = vi.fn(async () => ({ status: "created" as const, generation: 1 as const }));
    const controller = requireController(port(openSource, saveSource));

    const opening = controller.open();
    await expect(controller.open()).resolves.toEqual({
      status: "failed",
      reason: "operation-in-progress",
      diagnostic: null,
    });
    await expect(controller.save()).resolves.toEqual({
      status: "failed",
      reason: "operation-in-progress",
      diagnostic: null,
    });
    expect(openSource).toHaveBeenCalledTimes(1);
    expect(saveSource).not.toHaveBeenCalled();
    pending.resolve({ status: "missing" });
    await opening;
  });

  it("revokes pending async authority on dispose and stops future notifications", async () => {
    const pending = deferred<DesenEditorSourceSaveResult>();
    const controller = requireController(port(undefined, () => pending.promise));
    const listener = vi.fn();
    controller.subscribe(listener);
    const saving = controller.save();
    expect(listener).toHaveBeenCalledTimes(1);

    controller.dispose();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(controller.read()).toEqual(
      expect.objectContaining({ disposed: true, pending: null, dirty: true }),
    );
    pending.resolve({ status: "created", generation: 1 });
    await expect(saving).resolves.toEqual({
      status: "failed",
      reason: "disposed",
      diagnostic: null,
    });
    expect(controller.read().generation).toBeNull();
    expect(controller.read().savedDocument).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(controller.replaceAuthoredDocument(changedDocument("No authority"))).toEqual({
      ok: false,
      reason: "disposed",
    });
    await expect(controller.open()).resolves.toEqual({
      status: "failed",
      reason: "disposed",
      diagnostic: null,
    });
  });

  it("supports stable subscribe/unsubscribe semantics without trusting observer success", () => {
    const controller = requireController();
    const good = vi.fn();
    const unsubscribeGood = controller.subscribe(good);
    controller.subscribe(() => {
      throw new Error("observer failure");
    });

    controller.replaceAuthoredDocument(changedDocument("First edit"));
    expect(good).toHaveBeenCalledTimes(1);
    unsubscribeGood();
    controller.replaceAuthoredDocument(changedDocument("Second edit"));
    expect(good).toHaveBeenCalledTimes(1);
  });
});
