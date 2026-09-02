import path from "node:path";
import { fileURLToPath } from "node:url";

function resolvedPath(value) {
  return path.resolve(value instanceof URL ? fileURLToPath(value) : value);
}

function decoded(bytes, options) {
  const encoding = typeof options === "string" ? options : options?.encoding;
  return encoding === undefined || encoding === null ? bytes : bytes.toString(encoding);
}

async function loadFailureSuccessorModule() {
  const successorModule = await import("../scripts/lib/desen-app-failure-fixture-proof.mjs");
  if (
    typeof successorModule.authenticateDesenAppFailureFixtureSuccessor !== "function" ||
    typeof successorModule.readDesenAppT02HistoricalReaderTaskTimeFile !== "function" ||
    typeof successorModule.DesenAppFailureFixtureProofError !== "function"
  ) {
    throw new TypeError("The M10-T03 proof reader does not expose the T02 bridge contract.");
  }
  return successorModule;
}

/**
 * Gives the frozen T02 root reader its exact task-time bytes after authenticating M10-T03.
 */
export function createDesenAppT02HistoricalReaderReadFile({ workspaceRoot, liveReadFile }) {
  const canonicalRoot = path.resolve(workspaceRoot);
  let successorModulePromise;
  let successorPromise;
  return async function readHistoricalAuthority(filePath, options = undefined) {
    const absolutePath = resolvedPath(filePath);
    const relativePath = path.relative(canonicalRoot, absolutePath).replaceAll(path.sep, "/");
    if (relativePath !== "" && !relativePath.startsWith("../") && !path.isAbsolute(relativePath)) {
      successorModulePromise ??= loadFailureSuccessorModule();
      const successorModule = await successorModulePromise;
      successorPromise ??= successorModule.authenticateDesenAppFailureFixtureSuccessor({
        workspaceRoot: canonicalRoot,
      });
      const successor = await successorPromise;
      try {
        return decoded(
          successorModule.readDesenAppT02HistoricalReaderTaskTimeFile(successor, relativePath),
          options,
        );
      } catch (error) {
        if (
          !(error instanceof successorModule.DesenAppFailureFixtureProofError) ||
          error.code !== "OPTIONS_INVALID"
        ) {
          throw error;
        }
      }
    }
    return liveReadFile(filePath, options);
  };
}
