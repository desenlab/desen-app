import { createDesenEditorPersistencePort } from "../src/index.js";

import type {
  DesenEditorDocument,
  DesenEditorPersistenceAdapter,
  DesenEditorPersistenceAdapterSourceRecord,
  DesenEditorPersistenceAdapterWriteRequest,
  DesenEditorPersistenceAdapterWriteResult,
  DesenEditorPersistenceDiagnosticCode,
  DesenEditorPersistencePort,
  DesenEditorSourceOpenResult,
  DesenEditorSourceSaveRequest,
  DesenEditorSourceSaveResult,
} from "../src/index.js";

declare const adapter: DesenEditorPersistenceAdapter;
declare const document: DesenEditorDocument;
declare const adapterRequest: DesenEditorPersistenceAdapterWriteRequest;
declare const storedRecord: DesenEditorPersistenceAdapterSourceRecord;
declare const openResult: DesenEditorSourceOpenResult;
declare const saveResult: DesenEditorSourceSaveResult;

const port: DesenEditorPersistencePort = createDesenEditorPersistencePort(adapter);
const createRequest: DesenEditorSourceSaveRequest = {
  sourceKey: "source-a",
  expectedGeneration: null,
  document,
};
const updateRequest: DesenEditorSourceSaveRequest = {
  sourceKey: "source-a",
  expectedGeneration: 7,
  document,
};

const receiverBoundRead = async function (this: { readonly token: string }, sourceKey: string) {
  void sourceKey;
  return { status: "missing" } as const;
};

// @ts-expect-error persistence adapter callbacks must not require a receiver
const invalidReceiverRead: DesenEditorPersistenceAdapter["readSource"] = receiverBoundRead;

// @ts-expect-error save preconditions are required rather than inferred from the document
const missingExpectedGeneration: DesenEditorSourceSaveRequest = {
  sourceKey: "source-a",
  document,
};

const stringGeneration: DesenEditorSourceSaveRequest = {
  sourceKey: "source-a",
  // @ts-expect-error a save generation is exactly number or null
  expectedGeneration: "7",
  document,
};

const invalidCreateSettlement: DesenEditorPersistenceAdapterWriteResult = {
  status: "created",
  // @ts-expect-error a create settlement can expose only generation one
  generation: 2,
};

const broadAdapterRequest: DesenEditorPersistenceAdapterWriteRequest = {
  sourceKey: "source-a",
  expectedGeneration: null,
  bytes: new Uint8Array(),
  // @ts-expect-error the neutral adapter request cannot carry filesystem authority
  path: "/tmp/source.json",
};

// @ts-expect-error the adapter receives an immutable storage identity
adapterRequest.sourceKey = "source-b";

// @ts-expect-error the adapter cannot rewrite the captured compare-and-set precondition
adapterRequest.expectedGeneration = 8;

// @ts-expect-error public save requests are immutable transition values
createRequest.document = document;

// @ts-expect-error captured ports cannot have their open callback replaced
port.openSource = async () => ({ status: "missing" });

// @ts-expect-error captured adapters cannot have their read callback replaced through the contract
adapter.readSource = async () => ({ status: "missing" });

// @ts-expect-error adapter parsed values remain unknown until editor-core re-admits them
const trustedStoredDocument: DesenEditorDocument = storedRecord.value;

if (openResult.status === "opened") {
  const openedDocument: DesenEditorDocument = openResult.document;

  // @ts-expect-error opened documents remain recursively immutable
  openResult.document.id = "mutated";

  // @ts-expect-error a successful open has no failure diagnostic
  const impossibleDiagnostic = openResult.diagnostic;

  void openedDocument;
  void impossibleDiagnostic;
} else if (openResult.status === "missing") {
  // @ts-expect-error a missing Source exposes no partial document
  const partialDocument = openResult.document;
  void partialDocument;
}

if (saveResult.status === "conflict") {
  const currentGeneration: number | null = saveResult.currentGeneration;

  // @ts-expect-error a conflict does not pretend that a generation committed
  const committedGeneration = saveResult.generation;

  void currentGeneration;
  void committedGeneration;
} else if (saveResult.status === "failed") {
  const diagnosticCode: DesenEditorPersistenceDiagnosticCode = saveResult.diagnostic.code;

  // @ts-expect-error a definite failure has no conflict generation
  const currentGeneration = saveResult.currentGeneration;

  void diagnosticCode;
  void currentGeneration;
} else if (saveResult.status === "indeterminate") {
  // @ts-expect-error an uncertain commit cannot expose a trustworthy generation
  const committedGeneration = saveResult.generation;
  void committedGeneration;
}

// @ts-expect-error the minimal persistence port has no storage lifecycle authority
port.close();

// @ts-expect-error the minimal persistence port cannot enumerate storage identities
port.listSources();

// @ts-expect-error the minimal persistence port cannot delete Source identities
port.deleteSource("source-a");

// @ts-expect-error persistence diagnostic codes remain a closed task-specific union
const invalidDiagnosticCode: DesenEditorPersistenceDiagnosticCode =
  "run.desen.editor/PERSISTENCE_PRIVATE_PROVIDER_ERROR";

void updateRequest;
void invalidReceiverRead;
void missingExpectedGeneration;
void stringGeneration;
void invalidCreateSettlement;
void broadAdapterRequest;
void trustedStoredDocument;
void invalidDiagnosticCode;
