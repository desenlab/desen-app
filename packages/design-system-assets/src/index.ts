/** Safe, local, content-addressed asset contracts for DESEN authoring. */

export {
  DESIGN_SYSTEM_ASSET_EXTENSION_KEY,
  DESIGN_SYSTEM_ASSET_HANDLE_PREFIX,
  DESIGN_SYSTEM_ASSET_LIMITS,
  admitDesignSystemAsset,
  createDesignSystemAssetMetadata,
  isDesignSystemAssetHandle,
} from "./asset-admission.js";
export { createMemoryDesignSystemAssetStore } from "./asset-store.js";
export { createDesignSystemImagePresentation } from "./image-presentation.js";

export type {
  AdmittedDesignSystemAsset,
  DesignSystemAssetAdmissionFailure,
  DesignSystemAssetAdmissionResult,
  DesignSystemAssetAdmissionSuccess,
  DesignSystemAssetDiagnostic,
  DesignSystemAssetDiagnosticCode,
  DesignSystemAssetInput,
  DesignSystemAssetKind,
  DesignSystemAssetMediaType,
  DesignSystemFontMetadata,
  DesignSystemImageCrop,
  DesignSystemImageFit,
  DesignSystemImageMetadata,
} from "./asset-admission.js";
export type {
  DesignSystemAssetStore,
  DesignSystemAssetStoreDiagnostic,
  DesignSystemAssetStoreDiagnosticCode,
  DesignSystemAssetStorePutResult,
  DesignSystemAssetStoreReadResult,
  DesignSystemAssetStoreRecord,
} from "./asset-store.js";
export type {
  DesignSystemImagePresentation,
  DesignSystemImagePresentationDiagnosticCode,
  DesignSystemImagePresentationFailure,
  DesignSystemImagePresentationResult,
} from "./image-presentation.js";
