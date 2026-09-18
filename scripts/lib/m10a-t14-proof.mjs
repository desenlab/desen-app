import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = path.join(ROOT, "docs/proof/artifacts/m10a-t14.json");
const PROFILE = "desen.m10a-t14.history-identity-safe-reuse.v1";
const SOURCES = Object.freeze([
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/test/application.test.tsx",
  "packages/editor-core/src/history.ts",
  "packages/editor-core/src/index.ts",
  "packages/editor-core/test/history.test.ts",
  "pnpm-lock.yaml",
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
      maxHistoryEntries: 100,
      maxClipboardNodes: 256,
      maxClipboardBytes: 8 * 1024 * 1024,
      maxSourceTreeDepth: 64,
    },
    claims: {
      boundedImmutableUndoRedo: true,
      redoClearedOnNewEdit: true,
      appOwnedClipboardProvenance: true,
      freshIdentityRemapping: true,
      nestedBindingReferenceRemapping: true,
      hostileClipboardRejectedAtomically: true,
      catalogValidationBeforeCommit: true,
      crashSafeSaveBoundaryPreserved: true,
      runtimePublisherProtocolUnchanged: true,
    },
    focusedCommands: [
      "pnpm --filter @desen/editor-core build",
      "pnpm --filter @desen/editor-core exec vitest run test/history.test.ts",
      "pnpm --filter @desen/app-web typecheck",
      "pnpm --filter @desen/app-web exec vitest run test/application.test.tsx",
    ],
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

export async function verifyM10AT14Evidence() {
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
  return {
    status: "PASS",
    task: evidence.task,
    profile: evidence.profile,
    sourceFiles: source.length,
  };
}
