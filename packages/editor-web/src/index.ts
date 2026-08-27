/**
 * Web adapters and later Desen App canvas, inspector, overlay, and layer-tree integration.
 *
 * @packageDocumentation
 */

export {
  createLocalDesenEditorPersistencePort,
  LocalDesenEditorPersistenceConfigurationError,
} from "./local-source-persistence.js";

export type {
  LocalDesenEditorPersistenceConfigurationErrorCode,
  LocalDesenEditorPersistenceFetch,
  LocalDesenEditorPersistenceFetchRequest,
  LocalDesenEditorPersistenceFetchResponse,
  LocalDesenEditorPersistenceOptions,
} from "./local-source-persistence.js";
