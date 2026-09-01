import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createDesenEditorPersistencePort } from "@desen/editor-core";

import { DesenAppApplication } from "../desen-app/src/application.js";
import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "../desen-app/src/reference-empty-project.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "../desen-app/src/reference-sign-in-workspace-profile.js";
import "../desen-app/src/styles.css";

import type {
  DesenEditorPersistenceAdapter,
  DesenEditorPersistenceAdapterWriteRequest,
} from "@desen/editor-core";

interface StoredSource {
  readonly bytes: Uint8Array;
  readonly generation: number;
  readonly sourceKey: string;
}

interface BrowserProofContract {
  readonly readSaveCount: () => number;
  readonly readSavedDocument: () => unknown | null;
}

declare global {
  interface Window {
    readonly __DESEN_BROWSER_PROOF__: BrowserProofContract;
  }
}

let storedSource: StoredSource | null = null;
let saveCount = 0;

function bytesEqual(left: Readonly<Uint8Array>, right: Readonly<Uint8Array>): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

const readSource: DesenEditorPersistenceAdapter["readSource"] = async (sourceKey) => {
  const stored = storedSource;
  if (stored === null) return Object.freeze({ status: "missing" });
  if (stored.sourceKey !== sourceKey) return Object.freeze({ status: "missing" });
  return Object.freeze({
    status: "found",
    record: Object.freeze({
      sourceKey,
      generation: stored.generation,
      value: JSON.parse(new TextDecoder().decode(stored.bytes)) as unknown,
    }),
  });
};

const compareAndSetSource: DesenEditorPersistenceAdapter["compareAndSetSource"] = async (
  request: DesenEditorPersistenceAdapterWriteRequest,
) => {
  const current = storedSource;
  if (request.expectedGeneration === null) {
    if (current !== null) {
      return Object.freeze({ status: "conflict", currentGeneration: current.generation });
    }
    storedSource = Object.freeze({
      bytes: new Uint8Array(request.bytes),
      generation: 1,
      sourceKey: request.sourceKey,
    });
    saveCount += 1;
    return Object.freeze({ status: "created", generation: 1 });
  }
  if (current === null || current.sourceKey !== request.sourceKey) {
    return Object.freeze({ status: "conflict", currentGeneration: null });
  }
  if (current.generation !== request.expectedGeneration) {
    return Object.freeze({ status: "conflict", currentGeneration: current.generation });
  }
  if (bytesEqual(current.bytes, request.bytes)) {
    return Object.freeze({ status: "unchanged", generation: current.generation });
  }
  if (current.generation === Number.MAX_SAFE_INTEGER) {
    return Object.freeze({ status: "generation-exhausted", generation: current.generation });
  }
  const generation = current.generation + 1;
  storedSource = Object.freeze({
    bytes: new Uint8Array(request.bytes),
    generation,
    sourceKey: request.sourceKey,
  });
  saveCount += 1;
  return Object.freeze({ status: "updated", generation });
};

const persistencePort = createDesenEditorPersistencePort(
  Object.freeze({ compareAndSetSource, readSource }),
);

Object.defineProperty(window, "__DESEN_BROWSER_PROOF__", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({
    readSaveCount: () => saveCount,
    readSavedDocument: () => {
      const stored = storedSource;
      return stored === null
        ? null
        : (JSON.parse(new TextDecoder().decode(stored.bytes)) as unknown);
    },
  }),
});

window.history.replaceState(null, "", "/projects/account-app/surfaces/sign-in");

const container = document.getElementById("desen-app-root");
if (!(container instanceof Element))
  throw new TypeError("The Desen App root container is missing.");

const root = createRoot(container);
root.render(
  <StrictMode>
    <DesenAppApplication
      initialDocument={EMPTY_REFERENCE_PROJECT_DOCUMENT}
      persistencePort={persistencePort}
      workspaceProfile={REFERENCE_SIGN_IN_WORKSPACE_PROFILE}
    />
  </StrictMode>,
);

function disposeOnFinalPageHide(event: PageTransitionEvent): void {
  if (event.persisted) return;
  window.removeEventListener("pagehide", disposeOnFinalPageHide);
  root.unmount();
}

window.addEventListener("pagehide", disposeOnFinalPageHide);
