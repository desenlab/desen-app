import path from "node:path";
import { fileURLToPath } from "node:url";

function resolvedPath(value) {
  return path.resolve(value instanceof URL ? fileURLToPath(value) : value);
}

function decoded(bytes, options) {
  const encoding = typeof options === "string" ? options : options?.encoding;
  return encoding === undefined || encoding === null ? bytes : bytes.toString(encoding);
}

async function loadPublishedHostUpdateSuccessorModule() {
  const successorModule = await import("../scripts/lib/desen-app-published-host-update-proof.mjs");
  if (
    typeof successorModule.authenticateDesenAppPublishedHostUpdateSuccessor !== "function" ||
    typeof successorModule.readDesenAppT04HistoricalReaderTaskTimeFile !== "function" ||
    typeof successorModule.DesenAppPublishedHostUpdateProofError !== "function"
  ) {
    throw new TypeError("The M10-T05 proof reader does not expose the T04 bridge contract.");
  }
  return successorModule;
}

/** Gives the frozen T04 root reader exact clean task-time bytes after authenticating M10-T05. */
export function createDesenAppT04HistoricalReaderReadFile({ workspaceRoot, liveReadFile }) {
  const canonicalRoot = path.resolve(workspaceRoot);
  let successorModulePromise;
  let successorPromise;
  return async function readHistoricalAuthority(filePath, options = undefined) {
    const absolutePath = resolvedPath(filePath);
    const relativePath = path.relative(canonicalRoot, absolutePath).replaceAll(path.sep, "/");
    if (relativePath !== "" && !relativePath.startsWith("../") && !path.isAbsolute(relativePath)) {
      successorModulePromise ??= loadPublishedHostUpdateSuccessorModule();
      const successorModule = await successorModulePromise;
      successorPromise ??= successorModule.authenticateDesenAppPublishedHostUpdateSuccessor({
        workspaceRoot: canonicalRoot,
      });
      const successor = await successorPromise;
      try {
        return decoded(
          successorModule.readDesenAppT04HistoricalReaderTaskTimeFile(successor, relativePath),
          options,
        );
      } catch (error) {
        if (
          !(error instanceof successorModule.DesenAppPublishedHostUpdateProofError) ||
          error.code !== "OPTIONS_INVALID"
        ) {
          throw error;
        }
      }
    }
    return liveReadFile(filePath, options);
  };
}
