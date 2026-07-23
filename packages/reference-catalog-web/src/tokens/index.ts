/**
 * DTCG-backed reference tokens and their DOM-free Web projection.
 *
 * @packageDocumentation
 */

export { REFERENCE_TOKEN_DOCUMENT } from "./reference-token-document.js";
export {
  REFERENCE_WEB_TOKEN_CSS_PROPERTIES,
  REFERENCE_WEB_TOKEN_CSS_REFERENCES,
  REFERENCE_WEB_TOKEN_PROVIDER,
  REFERENCE_WEB_TOKEN_VALUES,
  resolveReferenceWebToken,
} from "./web-token-provider.js";

export type {
  DtcgReferenceAlias,
  DtcgReferenceColorValue,
  DtcgReferenceDimensionValue,
  DtcgReferenceTokenValue,
} from "./reference-token-document.js";
export type {
  ReferenceWebTokenCssProperty,
  ReferenceWebTokenCssProperties,
  ReferenceWebTokenCssReference,
  ReferenceWebTokenPath,
  ReferenceWebTokenProvider,
  ReferenceWebTokenResolution,
  ReferenceWebTokenResolutionFailure,
  ReferenceWebTokenResolutionSuccess,
} from "./web-token-provider.js";
