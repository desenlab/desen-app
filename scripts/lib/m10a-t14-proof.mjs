import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import prettier from "prettier";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = path.join(ROOT, "docs/proof/artifacts/m10a-t14.json");
const PROFILE = "desen.m10a-t14.history-identity-safe-reuse.v1";
const REPORT_LIMIT = 64 * 1024;
const SOURCES = Object.freeze([
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/test/application.test.tsx",
  "packages/editor-core/src/history.ts",
  "packages/editor-core/src/index.ts",
  "packages/editor-core/test/history.test.ts",
  "pnpm-lock.yaml",
]);

/** Exact focused behavior suites that the production verifier executes. */
export const M10A_T14_FOCUSED_COMMANDS = Object.freeze([
  Object.freeze({
    command: "node",
    args: Object.freeze([
      "node_modules/vitest/vitest.mjs",
      "run",
      "--root",
      "packages/editor-core",
      "--config",
      "package.json",
      "--configLoader",
      "runner",
      "test/history.test.ts",
    ]),
  }),
  Object.freeze({
    command: "node",
    args: Object.freeze([
      "node_modules/vitest/vitest.mjs",
      "run",
      "--root",
      "apps/desen-app",
      "--config",
      "package.json",
      "--configLoader",
      "runner",
      "test/application.test.tsx",
      "-t",
      "keeps duplicate and undo/redo operations atomic|does not reuse an older clipboard|retains the project clipboard across admitted surface remounts|clears the project clipboard when opaque workspace authority changes|keeps Source unchanged when a pasted candidate fails the current admission preflight|rejects a structurally admitted foreign capability through the real Catalog preflight|duplicates a reverse-clicked multi-selection in Source order",
    ]),
  }),
]);

export class M10AT14ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT14ProofError";
    this.code = code;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function captureVerifierOptions(input) {
  if (input === undefined) return Object.freeze({});
  if (
    typeof input !== "object" ||
    input === null ||
    utilTypes.isProxy(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new M10AT14ProofError(
      "M10A_T14_OPTIONS_INVALID",
      "T14 verifier options must be one inert plain object.",
    );
  }
  const keys = Reflect.ownKeys(input);
  if (keys.some((key) => key !== "runChild")) {
    throw new M10AT14ProofError(
      "M10A_T14_OPTIONS_INVALID",
      "T14 verifier options contain an unsupported field.",
    );
  }
  const descriptor = Object.getOwnPropertyDescriptor(input, "runChild");
  if (descriptor === undefined) return Object.freeze({});
  if (!("value" in descriptor) || typeof descriptor.value !== "function") {
    throw new M10AT14ProofError(
      "M10A_T14_OPTIONS_INVALID",
      "T14 runChild must be one inert function value.",
    );
  }
  if (utilTypes.isProxy(descriptor.value)) {
    throw new M10AT14ProofError("M10A_T14_OPTIONS_INVALID", "T14 runChild must not be a Proxy.");
  }
  return Object.freeze({ runChild: descriptor.value });
}

function runChild(command, args, options) {
  return new Promise((resolvePromise) => {
    const output = [];
    let outputBytes = 0;
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolvePromise(Object.freeze({ ...result, output: Buffer.concat(output) }));
    };
    let child;
    try {
      child = spawn(command, args, options);
    } catch (error) {
      settle({ code: null, signal: null, error });
      return;
    }
    const capture = (chunk) => {
      const bytes = Buffer.from(chunk);
      if (outputBytes < REPORT_LIMIT) {
        const retained = bytes.subarray(0, REPORT_LIMIT - outputBytes);
        output.push(retained);
        outputBytes += retained.byteLength;
      }
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("error", (error) => settle({ code: null, signal: null, error }));
    child.on("close", (code, signal) => settle({ code, signal }));
  });
}

async function runFocusedBehaviorProof(runner) {
  for (const reviewed of M10A_T14_FOCUSED_COMMANDS) {
    let result;
    try {
      result = await runner(reviewed.command, reviewed.args, {
        cwd: ROOT,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120_000,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new M10AT14ProofError(
        "M10A_T14_FOCUSED_EXECUTION_FAILED",
        `T14 focused behavior proof could not execute: ${detail}`,
      );
    }
    if (result?.error !== undefined) {
      const detail = result.error instanceof Error ? result.error.message : String(result.error);
      throw new M10AT14ProofError(
        "M10A_T14_FOCUSED_EXECUTION_FAILED",
        `T14 focused behavior proof could not start: ${detail}`,
      );
    }
    if (result?.code !== 0 || result.signal !== null) {
      const detail = Buffer.isBuffer(result?.output)
        ? result.output.toString("utf8").slice(-REPORT_LIMIT)
        : "No bounded command output was returned.";
      throw new M10AT14ProofError(
        "M10A_T14_FOCUSED_EXECUTION_FAILED",
        `T14 focused behavior proof failed: ${detail}`,
      );
    }
  }
}

async function sourceReceipts() {
  return Promise.all(
    SOURCES.map(async (relativePath) => {
      const bytes = await readFile(path.join(ROOT, relativePath));
      return { path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) };
    }),
  );
}

async function canonical(value) {
  return prettier.format(JSON.stringify(value, null, 2), { parser: "json" });
}

export async function captureM10AT14Evidence() {
  return {
    schemaVersion: 1,
    task: "M10A-T14",
    proofId: "m10a-t14",
    profile: PROFILE,
    result: "PASS",
    source: await sourceReceipts(),
    limits: {
      defaultHistoryEntries: 100,
      maxHistoryEntries: 512,
      maxClipboardSelectionRoots: 256,
      maxClipboardBytes: 8 * 1024 * 1024,
      maxSourceTreeDepth: 64,
    },
    claims: {
      boundedImmutableUndoRedo: true,
      fullyImmutableHistoryEntries: true,
      independentlyAdmittedHistorySnapshots: true,
      forgedHistoryAuthorityRejected: true,
      immutableDiagnostics: true,
      redoClearedOnNewEdit: true,
      appOwnedClipboardProvenance: true,
      projectScopedCrossSurfaceClipboard: true,
      opaqueWorkspaceClipboardIsolation: true,
      sourceOrderedMultiSelectionReuse: true,
      freshIdentityRemapping: true,
      nestedBindingReferenceRemapping: true,
      transitiveStateResourceDependencyRemapping: true,
      freshOperationAliasRemapping: true,
      schemaOwnedBindingRewriteOnly: true,
      externalComponentTargetRejectionAtomic: true,
      unresolvedBindingRejectionAtomic: true,
      multiRootReferenceRemapping: true,
      maxLengthIdentityAllocation: true,
      opaqueExtensionPreservation: true,
      hostileClipboardRejectedAtomically: true,
      hostileClipboardWrappersRejected: true,
      ambiguousSourceIdentitiesRejected: true,
      rejectedDuplicateCannotReuseClipboard: true,
      catalogValidationBeforeCommit: true,
      crashSafeSaveBoundaryPreserved: true,
      runtimePublisherProtocolUnchanged: true,
    },
    focusedCommands: M10A_T14_FOCUSED_COMMANDS.map(
      ({ command, args }) => `${command} ${args.join(" ")}`,
    ),
    nonClaims: [
      "Clipboard transfer is intentionally App-owned and in-memory; foreign OS clipboard payloads are not admitted.",
      "History changes authored Source only and does not grant Runtime, Publisher, protocol, or host authority.",
      "Masters, instances, variants, visual capture, and G10A remain later tasks.",
    ],
  };
}

export async function writeM10AT14Evidence() {
  const evidence = await captureM10AT14Evidence();
  await mkdir(path.dirname(ARTIFACT), { recursive: true });
  await writeFile(ARTIFACT, await canonical(evidence));
  return evidence;
}

/** Rejects any evidence field that is not derived from the current code-owned capture contract. */
export async function validateM10AT14EvidenceValue(evidence) {
  const expected = await captureM10AT14Evidence();
  if ((await canonical(evidence)) !== (await canonical(expected))) {
    throw new M10AT14ProofError(
      "M10A_T14_ARTIFACT_CONTENT_INVALID",
      "T14 evidence claims, limits, commands, non-claims, or source receipts drifted.",
    );
  }
  return expected;
}

export async function verifyM10AT14Evidence(rawOptions = undefined) {
  const options = captureVerifierOptions(rawOptions);
  let evidence;
  try {
    evidence = JSON.parse(await readFile(ARTIFACT, "utf8"));
  } catch {
    throw new M10AT14ProofError(
      "M10A_T14_ARTIFACT_JSON_INVALID",
      "T14 evidence is not valid JSON.",
    );
  }
  if ((await canonical(evidence)) !== (await readFile(ARTIFACT, "utf8"))) {
    throw new M10AT14ProofError(
      "M10A_T14_ARTIFACT_FORMAT_INVALID",
      "T14 evidence is not canonical JSON.",
    );
  }
  if (
    evidence.schemaVersion !== 1 ||
    evidence.task !== "M10A-T14" ||
    evidence.proofId !== "m10a-t14" ||
    evidence.profile !== PROFILE ||
    evidence.result !== "PASS"
  ) {
    throw new M10AT14ProofError(
      "M10A_T14_ARTIFACT_IDENTITY_INVALID",
      "T14 evidence identity or result drifted.",
    );
  }
  const source = await sourceReceipts();
  if (JSON.stringify(source) !== JSON.stringify(evidence.source)) {
    throw new M10AT14ProofError(
      "M10A_T14_ARTIFACT_SOURCE_DRIFT",
      "T14 source receipts no longer match the implementation.",
    );
  }
  await validateM10AT14EvidenceValue(evidence);
  await runFocusedBehaviorProof(options.runChild ?? runChild);
  return {
    status: "PASS",
    task: evidence.task,
    profile: evidence.profile,
    sourceFiles: source.length,
    focusedCommands: M10A_T14_FOCUSED_COMMANDS.length,
    focusedExecutedByVerifier: true,
  };
}
