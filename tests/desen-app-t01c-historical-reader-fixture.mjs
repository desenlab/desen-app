import path from "node:path";
import { fileURLToPath } from "node:url";

function resolvedPath(value) {
  return path.resolve(value instanceof URL ? fileURLToPath(value) : value);
}

function decoded(bytes, options) {
  const encoding = typeof options === "string" ? options : options?.encoding;
  return encoding === undefined || encoding === null ? bytes : bytes.toString(encoding);
}

async function loadInputPendingSuccessorModule() {
  const successorModule = await import("../scripts/lib/desen-app-input-pending-fixture-proof.mjs");
  if (
    typeof successorModule.authenticateDesenAppInputPendingFixtureSuccessor !== "function" ||
    typeof successorModule.readDesenAppT01cHistoricalReaderTaskTimeFile !== "function" ||
    typeof successorModule.DesenAppInputPendingFixtureProofError !== "function"
  ) {
    throw new TypeError("The M10-T02 proof reader does not expose the T01C bridge contract.");
  }
  return successorModule;
}

/**
 * Gives the frozen T01C root reader its exact task-time bytes after authenticating M10-T02.
 */
export function createDesenAppT01cHistoricalReaderReadFile({ workspaceRoot, liveReadFile }) {
  const canonicalRoot = path.resolve(workspaceRoot);
  let successorModulePromise;
  let successorPromise;
  return async function readHistoricalAuthority(filePath, options = undefined) {
    const absolutePath = resolvedPath(filePath);
    const relativePath = path.relative(canonicalRoot, absolutePath).replaceAll(path.sep, "/");
    if (relativePath !== "" && !relativePath.startsWith("../") && !path.isAbsolute(relativePath)) {
      successorModulePromise ??= loadInputPendingSuccessorModule();
      const successorModule = await successorModulePromise;
      successorPromise ??= successorModule.authenticateDesenAppInputPendingFixtureSuccessor({
        workspaceRoot: canonicalRoot,
      });
      const successor = await successorPromise;
      try {
        return decoded(
          successorModule.readDesenAppT01cHistoricalReaderTaskTimeFile(successor, relativePath),
          options,
        );
      } catch (error) {
        if (
          !(error instanceof successorModule.DesenAppInputPendingFixtureProofError) ||
          error.code !== "OPTIONS_INVALID"
        ) {
          throw error;
        }
      }
    }
    return liveReadFile(filePath, options);
  };
}
