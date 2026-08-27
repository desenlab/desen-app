import {
  createLocalDesenEditorPersistencePort,
  LocalDesenEditorPersistenceConfigurationError,
} from "@desen/editor-web";

import type {
  LocalDesenEditorPersistenceConfigurationErrorCode,
  LocalDesenEditorPersistenceFetch,
  LocalDesenEditorPersistenceFetchRequest,
  LocalDesenEditorPersistenceFetchResponse,
  LocalDesenEditorPersistenceOptions,
} from "@desen/editor-web";

const response: LocalDesenEditorPersistenceFetchResponse = {
  status: 404,
  headers: { "content-type": "application/json" },
  body: new TextEncoder().encode(
    JSON.stringify({ error: { code: "SOURCE_NOT_FOUND", message: "Source not found." } }),
  ),
};
const fetch: LocalDesenEditorPersistenceFetch = async (
  request: LocalDesenEditorPersistenceFetchRequest,
) => {
  const method: "GET" | "PUT" = request.method;
  const redirect: "error" = request.redirect;
  void method;
  void redirect;
  return response;
};
const options: LocalDesenEditorPersistenceOptions = {
  origin: "http://127.0.0.1:43127",
  apiToken: "type-only-local-editor-token-00000001",
  fetch,
};
const port = createLocalDesenEditorPersistencePort(options);
const openResult = await port.openSource("draft");

if (openResult.status === "opened") {
  // @ts-expect-error emitted declarations keep opened Source documents readonly
  openResult.document.id = "mutated";

  // @ts-expect-error emitted declarations keep observed generations readonly
  openResult.generation = 2;
}

// @ts-expect-error emitted port methods are readonly
port.openSource = async () => ({ status: "missing" });

// @ts-expect-error no delete authority is exposed by the closed persistence port
port.deleteSource("draft");

// @ts-expect-error an explicit transport is mandatory; no global fetch fallback exists
createLocalDesenEditorPersistencePort({
  origin: "http://127.0.0.1:43127",
  apiToken: "type-only-local-editor-token-00000001",
});

const code: LocalDesenEditorPersistenceConfigurationErrorCode = "INVALID_ORIGIN";
const error = new LocalDesenEditorPersistenceConfigurationError(code);
const exactCode: LocalDesenEditorPersistenceConfigurationErrorCode = error.code;

// @ts-expect-error stable configuration codes form a closed union
const unsupportedCode: LocalDesenEditorPersistenceConfigurationErrorCode = "NETWORK_FAILURE";

void exactCode;
void unsupportedCode;
