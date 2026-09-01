import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DesenAppEvergreenProductCompositionProofError,
  authenticateDesenAppEvergreenProductCompositionSuccessor,
  readDesenAppHistoricalReaderTaskTimeFile,
} from "../scripts/lib/desen-app-evergreen-product-composition-proof.mjs";

function resolvedPath(value) {
  return path.resolve(value instanceof URL ? fileURLToPath(value) : value);
}

function decoded(bytes, options) {
  const encoding = typeof options === "string" ? options : options?.encoding;
  return encoding === undefined || encoding === null ? bytes : bytes.toString(encoding);
}

/**
 * Gives historical root tests their exact task-time file bytes while every proof reader still
 * authenticates the live canonical M10-T01C successor before admitting the projection.
 */
export function createDesenAppHistoricalReaderReadFile({ workspaceRoot, liveReadFile }) {
  const canonicalRoot = path.resolve(workspaceRoot);
  let successorPromise;
  return async function readHistoricalAuthority(filePath, options = undefined) {
    const absolutePath = resolvedPath(filePath);
    const relativePath = path.relative(canonicalRoot, absolutePath).replaceAll(path.sep, "/");
    if (relativePath !== "" && !relativePath.startsWith("../") && !path.isAbsolute(relativePath)) {
      successorPromise ??= authenticateDesenAppEvergreenProductCompositionSuccessor({
        workspaceRoot: canonicalRoot,
      });
      const successor = await successorPromise;
      try {
        return decoded(readDesenAppHistoricalReaderTaskTimeFile(successor, relativePath), options);
      } catch (error) {
        if (
          !(error instanceof DesenAppEvergreenProductCompositionProofError) ||
          error.code !== "OPTIONS_INVALID"
        ) {
          throw error;
        }
      }
    }
    return liveReadFile(filePath, options);
  };
}
