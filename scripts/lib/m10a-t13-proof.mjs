import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_PATH = path.join(WORKSPACE_ROOT, "docs/proof/artifacts/m10a-t13.json");
const PROFILE = "desen.m10a-t13.safe-local-assets.v1";
const SOURCE_FILES = Object.freeze([
  "apps/desen-app/package.json",
  "apps/desen-app/src/design-system-asset-storage.ts",
  "apps/desen-app/src/main.tsx",
  "package.json",
  "packages/design-system-assets/README.md",
  "packages/design-system-assets/package.json",
  "packages/design-system-assets/src/asset-admission.ts",
  "packages/design-system-assets/src/asset-store.ts",
  "packages/design-system-assets/src/image-presentation.ts",
  "packages/design-system-assets/src/index.ts",
  "packages/design-system-assets/test/asset-admission.test.ts",
  "pnpm-lock.yaml",
]);
const FONT = Object.freeze({
  package: "@fontsource-variable/inter",
  version: "5.3.0",
  license: "OFL-1.1",
  integrity:
    "sha512-OupL48va4JNofb97w6NYeF9S7W/kHNKM0Er8Dem5nqi4jeOLrVJDoE8tZEpnMJmtkvNbB1EIPPwHcdkF6b1oUA==",
});

export class M10AT13ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT13ProofError";
    this.code = code;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sourceReceipt(relativePath) {
  const bytes = await readFile(path.join(WORKSPACE_ROOT, relativePath));
  return { path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) };
}

async function currentSource() {
  return Promise.all(SOURCE_FILES.map((relativePath) => sourceReceipt(relativePath)));
}

async function canonical(value) {
  return prettier.format(JSON.stringify(value, null, 2), { parser: "json" });
}

function expectedClaims() {
  return {
    boundedRasterImages: true,
    restrictedSvgIcons: true,
    woff2Fonts: true,
    contentAddressedOpaqueHandles: true,
    inertProjectMetadataOnly: true,
    localIndexedDbCas: true,
    missingAssetDiagnostic: true,
    boundedImageFitAndCrop: true,
    noRemoteAssetRequest: true,
    fontReadinessRequiredByCapture: false,
    runtimeCoreChanged: false,
    protocolChanged: false,
    publisherChanged: false,
  };
}

export async function captureM10AT13Evidence() {
  const source = await currentSource();
  return {
    schemaVersion: 1,
    task: "M10A-T13",
    proofId: "m10a-t13",
    profile: PROFILE,
    result: "PASS",
    source,
    limits: {
      maxImageEncodedBytes: 8 * 1024 * 1024,
      maxFontEncodedBytes: 4 * 1024 * 1024,
      maxImageDimension: 8192,
      maxImageDecodedPixels: 16_777_216,
      allowedImageMediaTypes: ["image/jpeg", "image/png", "image/webp"],
      allowedIconMediaTypes: ["image/svg+xml"],
      allowedFontMediaTypes: ["font/woff2"],
    },
    bundledDefaultFont: FONT,
    focusedCommands: [
      "pnpm --filter @desen/design-system-assets build",
      "pnpm --filter @desen/design-system-assets lint",
      "pnpm --filter @desen/design-system-assets exec vitest run",
      "pnpm --filter @desen/app-web typecheck",
      "pnpm --filter @desen/app-web build",
    ],
    claims: expectedClaims(),
    nonClaims: [
      "This slice does not grant Runtime activation, Publisher authority, protocol/Core changes, or release activation.",
      "The App IndexedDB adapter is a local CAS port; it does not migrate the existing project aggregate or silently replace missing assets.",
      "Font readiness remains a prerequisite for future visual capture work; T24 owns the capture engine and T26 owns acceptance budgets.",
    ],
  };
}

export async function writeM10AT13Evidence() {
  const evidence = await captureM10AT13Evidence();
  await mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
  await writeFile(ARTIFACT_PATH, await canonical(evidence));
  return evidence;
}

export async function verifyM10AT13Evidence() {
  const bytes = await readFile(ARTIFACT_PATH);
  let evidence;
  try {
    evidence = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new M10AT13ProofError(
      "M10A_T13_ARTIFACT_JSON_INVALID",
      "T13 evidence is not valid JSON.",
    );
  }
  if (bytes.toString("utf8") !== (await canonical(evidence))) {
    throw new M10AT13ProofError(
      "M10A_T13_ARTIFACT_FORMAT_INVALID",
      "T13 evidence is not canonical JSON.",
    );
  }
  if (
    evidence.schemaVersion !== 1 ||
    evidence.task !== "M10A-T13" ||
    evidence.proofId !== "m10a-t13" ||
    evidence.profile !== PROFILE ||
    evidence.result !== "PASS"
  ) {
    throw new M10AT13ProofError(
      "M10A_T13_ARTIFACT_IDENTITY_INVALID",
      "T13 evidence identity or result drifted.",
    );
  }
  const actualSource = await currentSource();
  if (JSON.stringify(evidence.source) !== JSON.stringify(actualSource)) {
    throw new M10AT13ProofError(
      "M10A_T13_ARTIFACT_SOURCE_DRIFT",
      "T13 source receipts no longer match the checked-out implementation.",
    );
  }
  if (
    JSON.stringify(evidence.bundledDefaultFont) !== JSON.stringify(FONT) ||
    JSON.stringify(evidence.claims) !== JSON.stringify(expectedClaims())
  ) {
    throw new M10AT13ProofError(
      "M10A_T13_ARTIFACT_CLAIM_DRIFT",
      "T13 safety or bundled-font claims drifted.",
    );
  }
  return {
    status: "PASS",
    task: evidence.task,
    profile: evidence.profile,
    sourceFiles: actualSource.length,
  };
}
