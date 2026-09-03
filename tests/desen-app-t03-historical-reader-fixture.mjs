import path from "node:path";
import { fileURLToPath } from "node:url";

function resolvedPath(value) {
  return path.resolve(value instanceof URL ? fileURLToPath(value) : value);
}

function decoded(bytes, options) {
  const encoding = typeof options === "string" ? options : options?.encoding;
  return encoding === undefined || encoding === null ? bytes : bytes.toString(encoding);
}

async function loadSuccessHostOperationSuccessorModule() {
  const successorModule = await import("../scripts/lib/desen-app-success-host-operation-proof.mjs");
  if (
    typeof successorModule.authenticateDesenAppSuccessHostOperationSuccessor !== "function" ||
    typeof successorModule.readDesenAppT03HistoricalReaderTaskTimeFile !== "function" ||
    typeof successorModule.DesenAppSuccessHostOperationProofError !== "function"
  ) {
    throw new TypeError("The M10-T04 proof reader does not expose the T03 bridge contract.");
  }
  return successorModule;
}

/**
 * Gives the frozen T03 root reader its exact task-time bytes after authenticating M10-T04.
 */
export function createDesenAppT03HistoricalReaderReadFile({ workspaceRoot, liveReadFile }) {
  const canonicalRoot = path.resolve(workspaceRoot);
  let successorModulePromise;
  let successorPromise;
  return async function readHistoricalAuthority(filePath, options = undefined) {
    const absolutePath = resolvedPath(filePath);
    const relativePath = path.relative(canonicalRoot, absolutePath).replaceAll(path.sep, "/");
    if (relativePath !== "" && !relativePath.startsWith("../") && !path.isAbsolute(relativePath)) {
      successorModulePromise ??= loadSuccessHostOperationSuccessorModule();
      const successorModule = await successorModulePromise;
      successorPromise ??= successorModule.authenticateDesenAppSuccessHostOperationSuccessor({
        workspaceRoot: canonicalRoot,
      });
      const successor = await successorPromise;
      try {
        return decoded(
          successorModule.readDesenAppT03HistoricalReaderTaskTimeFile(successor, relativePath),
          options,
        );
      } catch (error) {
        if (
          !(error instanceof successorModule.DesenAppSuccessHostOperationProofError) ||
          error.code !== "OPTIONS_INVALID"
        ) {
          throw error;
        }
      }
    }
    return liveReadFile(filePath, options);
  };
}
