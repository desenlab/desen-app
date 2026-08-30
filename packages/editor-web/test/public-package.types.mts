import {
  createLocalDesenBundleChannelPublicationPort,
  createLocalDesenEditorPersistencePort,
  LocalDesenBundleChannelPublicationConfigurationError,
  LocalDesenEditorPersistenceConfigurationError,
} from "@desen/editor-web";

import type {
  LocalDesenBundleChannelPublicationConfigurationErrorCode,
  LocalDesenBundleChannelPublicationFetch,
  LocalDesenBundleChannelPublicationFetchRequest,
  LocalDesenBundleChannelPublicationFetchResponse,
  LocalDesenBundleChannelPublicationOptions,
  LocalDesenBundleChannelPublicationResult,
  LocalDesenEditorPersistenceConfigurationErrorCode,
  LocalDesenEditorPersistenceFetch,
  LocalDesenEditorPersistenceFetchRequest,
  LocalDesenEditorPersistenceFetchResponse,
  LocalDesenEditorPersistenceOptions,
} from "@desen/editor-web";

const publicationResponse: LocalDesenBundleChannelPublicationFetchResponse = {
  status: 404,
  headers: { "content-type": "application/json" },
  body: new TextEncoder().encode(
    JSON.stringify({ error: { code: "CHANNEL_NOT_FOUND", message: "Channel not found." } }),
  ),
};
const publicationFetch: LocalDesenBundleChannelPublicationFetch = async (
  request: LocalDesenBundleChannelPublicationFetchRequest,
) => {
  const method: "GET" | "PUT" = request.method;
  const redirect: "error" = request.redirect;
  void method;
  void redirect;
  return publicationResponse;
};
const publicationOptions: LocalDesenBundleChannelPublicationOptions = {
  origin: "http://127.0.0.1:43127",
  apiToken: "type-only-local-publication-token-000001",
  channelName: "preview",
  fetch: publicationFetch,
};
const publicationPort = createLocalDesenBundleChannelPublicationPort(publicationOptions);
const publicationResult: LocalDesenBundleChannelPublicationResult =
  await publicationPort.publishBundleToChannel({
    revision: `sha256:${"a".repeat(64)}`,
    bundleBytes: new TextEncoder().encode("{}"),
  });
if (publicationResult.status === "published") {
  const channelName: string = publicationResult.channelName;
  const generation: number = publicationResult.channelGeneration;
  void channelName;
  void generation;

  // @ts-expect-error emitted publication receipts are readonly
  publicationResult.channelGeneration = 2;
}

publicationPort.publishBundleToChannel({
  revision: `sha256:${"a".repeat(64)}`,
  bundleBytes: new TextEncoder().encode("{}"),
  // @ts-expect-error the publication channel is fixed in options, not caller-selected
  channelName: "attacker",
});

// @ts-expect-error an explicit transport is mandatory; no global fetch fallback exists
createLocalDesenBundleChannelPublicationPort({
  origin: "http://127.0.0.1:43127",
  apiToken: "type-only-local-publication-token-000001",
  channelName: "preview",
});

const publicationCode: LocalDesenBundleChannelPublicationConfigurationErrorCode =
  "INVALID_CHANNEL_NAME";
const publicationError = new LocalDesenBundleChannelPublicationConfigurationError(publicationCode);
const exactPublicationCode: LocalDesenBundleChannelPublicationConfigurationErrorCode =
  publicationError.code;

// @ts-expect-error stable publication configuration codes form a closed union
const unsupportedPublicationCode: LocalDesenBundleChannelPublicationConfigurationErrorCode =
  "NETWORK_FAILURE";

void exactPublicationCode;
void unsupportedPublicationCode;

const previewPublicationPort = createLocalDesenBundleChannelPublicationPort({
  origin: "http://127.0.0.1:43127",
  apiToken: "type-only-local-publication-token-000001",
  channelName: "preview",
  fetch: publicationFetch,
});
const previewPublicationResult = await previewPublicationPort.publishBundleToChannel({
  revision: `sha256:${"a".repeat(64)}`,
  bundleBytes: new TextEncoder().encode("{}"),
});
if (previewPublicationResult.status === "published") {
  const exactPreviewChannel: "preview" = previewPublicationResult.channelName;
  void exactPreviewChannel;
}

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
