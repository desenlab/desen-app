/* eslint-disable @typescript-eslint/no-invalid-void-type -- External-store callbacks are receiver-independent. */
import type { DesenEditorDocument, DesenEditorPersistenceDiagnostic } from "@desen/editor-core";
import type { AuthoringPreviewBundleSuccess } from "./authoring-preview.js";

type PersistencePendingOperation = "opening" | "saving";

/** Exact App route that selects one project-owned persistence identity and surface admission. */
export interface AuthoringPersistenceRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** Atomically admitted authored Source and its matching publishable preview. */
export interface AuthoringPersistenceSession {
  readonly document: DesenEditorDocument;
  readonly preview: AuthoringPreviewBundleSuccess;
}

/** Stable local reason why an authored Source could not cross the App persistence boundary. */
export type AuthoringPersistenceFailureReason =
  | "catalog-invalid"
  | "disposed"
  | "document-invalid"
  | "document-mismatch"
  | "operation-in-progress"
  | "persistence-failed"
  | "port-invalid"
  | "preview-unavailable"
  | "profile-invalid"
  | "projection-limit"
  | "reopen-required"
  | "route-invalid"
  | "stale-operation";

/** Controlled open failure with an optional redacted Editor Core persistence diagnostic. */
export interface AuthoringPersistenceOpenFailure {
  readonly status: "failed";
  readonly reason: AuthoringPersistenceFailureReason;
  readonly diagnostic: DesenEditorPersistenceDiagnostic | null;
}

/** Exact successful open after route, document, Catalog, and preview admission. */
export interface AuthoringPersistenceOpenSuccess {
  readonly status: "opened";
  readonly generation: number;
  readonly session: AuthoringPersistenceSession;
}

/** Open outcome kept distinct from every save settlement. */
export type AuthoringPersistenceOpenResult =
  | AuthoringPersistenceOpenSuccess
  | Readonly<{ readonly status: "missing" }>
  | AuthoringPersistenceOpenFailure;

/** Controlled save failure with an optional redacted Editor Core persistence diagnostic. */
export interface AuthoringPersistenceSaveFailure {
  readonly status: "failed";
  readonly reason: AuthoringPersistenceFailureReason;
  readonly diagnostic: DesenEditorPersistenceDiagnostic | null;
}

/** App-owned save settlement retaining every distinct Editor Core persistence outcome. */
export type AuthoringPersistenceSaveResult =
  | Readonly<{ readonly status: "created"; readonly generation: 1 }>
  | Readonly<{ readonly status: "updated"; readonly generation: number }>
  | Readonly<{ readonly status: "unchanged"; readonly generation: number }>
  | Readonly<{ readonly status: "conflict"; readonly currentGeneration: number | null }>
  | Readonly<{ readonly status: "generation-exhausted"; readonly generation: number }>
  | Readonly<{
      readonly status: "indeterminate";
      readonly diagnostic: DesenEditorPersistenceDiagnostic;
    }>
  | AuthoringPersistenceSaveFailure;

/** Immutable external-store snapshot for authored Source persistence UI. */
export interface AuthoringPersistenceState {
  readonly route: AuthoringPersistenceRoute;
  readonly sourceKey: string;
  readonly session: AuthoringPersistenceSession;
  readonly generation: number | null;
  readonly savedDocument: DesenEditorDocument | null;
  readonly dirty: boolean;
  readonly reopenRequired: boolean;
  readonly pending: PersistencePendingOperation | null;
  readonly openResult: AuthoringPersistenceOpenResult | null;
  readonly saveResult: AuthoringPersistenceSaveResult | null;
  readonly disposed: boolean;
}

/** Result of replacing only the controller's authored Source session. */
export type AuthoringPersistenceDocumentReplacementResult =
  | Readonly<{ readonly ok: true; readonly session: AuthoringPersistenceSession }>
  | Readonly<{
      readonly ok: false;
      readonly reason: Extract<
        AuthoringPersistenceFailureReason,
        | "catalog-invalid"
        | "disposed"
        | "document-invalid"
        | "document-mismatch"
        | "preview-unavailable"
        | "projection-limit"
      >;
    }>;

/** Receiver-independent, React-free controller suitable for `useSyncExternalStore`. */
export interface AuthoringPersistenceController {
  readonly read: (this: void) => AuthoringPersistenceState;
  readonly subscribe: (this: void, listener: () => void) => () => void;
  readonly replaceAuthoredDocument: (
    this: void,
    document: DesenEditorDocument,
  ) => AuthoringPersistenceDocumentReplacementResult;
  readonly open: (this: void) => Promise<AuthoringPersistenceOpenResult>;
  readonly save: (this: void) => Promise<AuthoringPersistenceSaveResult>;
  readonly dispose: (this: void) => void;
}
