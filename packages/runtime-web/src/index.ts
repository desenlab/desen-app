/**
 * Browser host ports, channel fetching, navigation bridge, and persistent last-known-good activation.
 *
 * @packageDocumentation
 */

export { createRuntimeWebBrowserPlatform } from "./browser-platform.js";
export {
  authenticateRuntimeWebHostDocumentAuthority,
  createRuntimeWebHostAuthority,
  disposeRuntimeWebHostAuthority,
  readRuntimeWebHostAuthority,
} from "./host-authority.js";

export type {
  RuntimeWebBrowserPlatformCreateInput,
  RuntimeWebBrowserPlatformCreateResult,
  RuntimeWebBrowserPlatformHandle,
} from "./browser-platform.js";
export type {
  RuntimeWebHostAuthorityCreateInput,
  RuntimeWebHostAuthorityCreateResult,
  RuntimeWebHostAuthorityDisposeResult,
  RuntimeWebHostAuthorityHandle,
  RuntimeWebHostAuthorityReadResult,
  RuntimeWebHostDocumentAuthorityInput,
  RuntimeWebHostDocumentAuthorityResult,
} from "./host-authority.js";
