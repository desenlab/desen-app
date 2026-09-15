import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { buildM10AT01PackageIdentity } from "./m10a-t01-proof.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t08.json";
const ARTIFACT_PATH = path.join(WORKSPACE_ROOT, ARTIFACT_RELATIVE_PATH);
const REPORT_LIMIT = 256 * 1024;

/** Exact real-browser command that owns the isolated M10A-T08 capture. */
export const M10A_T08_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/starter-catalog-web-proof", "run", "test:m10a-t08"]),
});

/** Exact task-owned M10A-T08 proof-artifact destination. */
export const M10A_T08_ARTIFACT_PATH = ARTIFACT_PATH;

/** Exact current starter inventory after the additive T08 extension. */
export const M10A_T08_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Accordion",
  "run.desen.starter/Box",
  "run.desen.starter/Button",
  "run.desen.starter/Checkbox",
  "run.desen.starter/Combobox",
  "run.desen.starter/Dialog",
  "run.desen.starter/Grid",
  "run.desen.starter/Heading",
  "run.desen.starter/Icon",
  "run.desen.starter/Image",
  "run.desen.starter/Menu",
  "run.desen.starter/NumberField",
  "run.desen.starter/Popover",
  "run.desen.starter/RadioGroup",
  "run.desen.starter/Select",
  "run.desen.starter/Separator",
  "run.desen.starter/Slider",
  "run.desen.starter/Stack",
  "run.desen.starter/Switch",
  "run.desen.starter/Tabs",
  "run.desen.starter/Text",
  "run.desen.starter/TextArea",
  "run.desen.starter/TextField",
  "run.desen.starter/Tooltip",
]);

/** Capability ids introduced by T08. */
export const M10A_T08_ADDED_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Accordion",
  "run.desen.starter/Menu",
  "run.desen.starter/Popover",
  "run.desen.starter/Tooltip",
]);

/** Exact isolated-browser cases required for the T08 task receipt. */
export const M10A_T08_BROWSER_TEST_TITLES = Object.freeze(
  [
    "publishes the T08 overlay and disclosure inventory through the reviewed starter Catalog",
    "renders Dialog, Popover, Tooltip, Menu, and Accordion with contained preview portals",
    "projects pointer and keyboard open close parity with focus return through Runtime events",
    "retains disabled and ordered slot states while rejecting forged portal and stale inputs",
  ].sort(),
);

/** Every assertion that the T08 custom browser reporter must explicitly attest. */
export const M10A_T08_BROWSER_ASSERTION_NAMES = Object.freeze(
  [
    "accordionOrderedPanels",
    "allOverlayDisclosureCapabilitiesPublished",
    "authoringGraphPresent",
    "containedPortalRoots",
    "dialogOpenClose",
    "disabledControls",
    "focusReturnAfterClose",
    "forgedPortalAuthorityRejected",
    "independentHostGraph",
    "menuKeyboardSelection",
    "missingRequiredSlotsRejected",
    "pointerKeyboardParity",
    "popoverOpenClose",
    "sameStaticAdapterRegistry",
    "staleInteractionRejected",
    "tooltipHoverAndFocus",
  ].sort(),
);

/** Stable root mutation-test declarations embedded in current T08 evidence. */
export const M10A_T08_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T08 builds the exact 0.5.0 overlay and disclosure Catalog deterministically",
  "M10A-T08 admits bounded overlay props, required slots, and stable item identities",
  "M10A-T08 authenticates authoring and independent-host browser observations",
  "M10A-T08 rejects malformed browser observations, artifact drift, and unsafe evidence options",
  "M10A-T08 preserves the checkpointed T07 historical receipt while the starter Catalog evolves",
  "M10A-T08 writer is atomic and leaves the current artifact bytes deterministic",
]);

/** Stable error class raised at the bounded M10A-T08 proof boundary. */
export class M10AT08ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT08ProofError";
    this.code = `M10A_T08_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT08ProofError(code, message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactOptions(raw, allowed, label) {
  if (raw === undefined) return {};
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    fail("OPTIONS_INVALID", `${label} must be one inert object.`);
  const keys = Object.keys(raw);
  if (keys.some((key) => !allowed.includes(key)))
    fail("OPTIONS_INVALID", `${label} contains an unknown option.`);
  return Object.fromEntries(keys.map((key) => [key, raw[key]]));
}

function resolveWorkspaceRoot(rawWorkspaceRoot) {
  const workspaceRoot = rawWorkspaceRoot ?? WORKSPACE_ROOT;
  if (
    typeof workspaceRoot !== "string" ||
    workspaceRoot.length === 0 ||
    workspaceRoot.includes("\0") ||
    !path.isAbsolute(workspaceRoot) ||
    path.resolve(workspaceRoot) !== workspaceRoot ||
    utilTypes.isProxy(workspaceRoot)
  ) {
    fail("OPTIONS_INVALID", "workspaceRoot must be one canonical absolute path.");
  }
  return workspaceRoot;
}

function parseBrowserObservation(raw) {
  if (raw?.profile !== "desen.m10a-t08.browser-proof.v1" || raw?.result !== "PASS") {
    fail("BROWSER_OBSERVATION_INVALID", "T08 browser receipt identity drifted.");
  }
  if (
    !Array.isArray(raw.graphReceipts) ||
    raw.graphReceipts.length !== 2 ||
    raw.graphReceipts[0] !== "authoring" ||
    raw.graphReceipts[1] !== "host"
  )
    fail("BROWSER_OBSERVATION_INVALID", "T08 graph receipts drifted.");
  const titles = Array.isArray(raw.tests) ? raw.tests.map((test) => test?.title).sort() : [];
  if (
    titles.length !== M10A_T08_BROWSER_TEST_TITLES.length ||
    titles.some((title, index) => title !== M10A_T08_BROWSER_TEST_TITLES[index]) ||
    raw.tests.some((test) => test?.result !== "PASS")
  )
    fail("BROWSER_OBSERVATION_INVALID", "T08 browser test inventory drifted.");
  if (
    raw.assertions === null ||
    typeof raw.assertions !== "object" ||
    M10A_T08_BROWSER_ASSERTION_NAMES.some((name) => raw.assertions[name] !== true)
  )
    fail("BROWSER_OBSERVATION_INVALID", "T08 browser assertions drifted.");
  return Object.freeze({
    profile: "desen.m10a-t08.browser-proof.v1",
    result: "PASS",
    graphReceipts: Object.freeze(["authoring", "host"]),
    tests: Object.freeze(
      M10A_T08_BROWSER_TEST_TITLES.map((title) => Object.freeze({ title, result: "PASS" })),
    ),
    assertions: Object.freeze(
      Object.fromEntries(M10A_T08_BROWSER_ASSERTION_NAMES.map((name) => [name, true])),
    ),
  });
}

async function currentIdentity(workspaceRoot) {
  const identity = await buildM10AT01PackageIdentity({ workspaceRoot });
  if (
    identity.catalog.id !== "run.desen.starter.web" ||
    identity.catalog.version !== "0.5.0" ||
    identity.catalog.target !== "web-react"
  ) {
    fail("CATALOG_INVALID", "Starter Catalog identity is not the reviewed T08 0.5.0 contract.");
  }
  const ids = Object.keys(identity.catalog.components).sort();
  if (
    ids.length !== M10A_T08_CAPABILITY_IDS.length ||
    ids.some((id, index) => id !== M10A_T08_CAPABILITY_IDS[index])
  ) {
    fail("CATALOG_INVALID", "T08 starter capability inventory drifted.");
  }
  return identity;
}

function buildArtifact(identity, browser, historicalT07) {
  return Object.freeze({
    schemaVersion: 1,
    task: "M10A-T08",
    proofId: "m10a-t08",
    profile: "desen.m10a-t08.overlays-disclosures.v1",
    result: "PASS",
    package: {
      name: "@desen/starter-catalog-web",
      catalog: {
        id: identity.catalog.id,
        version: identity.catalog.version,
        target: identity.catalog.target,
        sha256: sha256(identity.catalogBytes),
        bytes: identity.catalogBytes.byteLength,
      },
      packageDigest: identity.packageIdentity.packageDigest,
      digestProfile: identity.packageIdentity.profile,
      distFiles: identity.inventory.distFiles,
      distBytes: identity.inventory.distBytes,
    },
    capabilities: {
      ids: M10A_T08_CAPABILITY_IDS,
      added: M10A_T08_ADDED_CAPABILITY_IDS,
      dialogExtension: "contained-focus-return-and-nested-portal-boundary",
      requiredSlots: ["Dialog.content", "Popover.content", "Accordion.panels"],
      menuIdentity: "stable-id",
    },
    browser,
    historical: {
      m10aT07ArtifactSha256: historicalT07.artifactSha256,
      m10aT07CatalogSha256: historicalT07.artifact.package.catalog.sha256,
    },
    claims: {
      boundedOverlayDisclosureData: true,
      containedPortalRoots: true,
      keyboardPointerParity: true,
      focusReturnAfterClose: true,
      malformedDataRejected: true,
      sameStaticAdaptersInAuthoringAndHost: true,
      historicalArtifactsRewritten: false,
      runtimeCoreChanged: false,
    },
    tests: {
      rootTestNames: M10A_T08_ROOT_TEST_NAMES,
      packageCommand: "pnpm --filter @desen/starter-catalog-web test",
      browserCommand: `${M10A_T08_BROWSER_COMMAND.command} ${M10A_T08_BROWSER_COMMAND.args.join(" ")}`,
      browserExecutedByVerifier: true,
    },
    nonClaims: [
      "T08 does not add normal-App persistence, Publisher authority, Runtime activation, or M11 behavior.",
      "T08 does not admit callbacks, renderers, selectors, external portal roots, executable markup, or remote media URLs.",
      "Local evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
    ],
  });
}

async function runBrowserProof() {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "desen-m10a-t08-proof-"));
  try {
    const result = await new Promise((resolvePromise) => {
      const child = spawn(M10A_T08_BROWSER_COMMAND.command, M10A_T08_BROWSER_COMMAND.args, {
        cwd: WORKSPACE_ROOT,
        env: { ...process.env, DESEN_M10A_T08_PROOF_TEMP: temporaryRoot },
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const output = [];
      child.stdout.on("data", (chunk) => output.push(chunk));
      child.stderr.on("data", (chunk) => output.push(chunk));
      child.on("close", (code, signal) =>
        resolvePromise({ code, signal, output: Buffer.concat(output) }),
      );
    });
    if (result.code !== 0)
      fail(
        "BROWSER_EXECUTION_FAILED",
        `T08 browser proof failed: ${result.output.toString("utf8").slice(-REPORT_LIMIT)}`,
      );
    return parseBrowserObservation(
      JSON.parse(await readFile(path.join(temporaryRoot, "browser-proof.json"), "utf8")),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

/** Builds deterministic current T08 evidence from one exact passing browser observation. */
export async function buildM10AT08Evidence(rawOptions) {
  const options = exactOptions(
    rawOptions,
    ["browserObservation", "workspaceRoot"],
    "M10A-T08 evidence options",
  );
  if (options.browserObservation === undefined)
    fail("OPTIONS_INVALID", "M10A-T08 evidence requires one browser observation.");
  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  const identity = await currentIdentity(workspaceRoot);
  const browser = parseBrowserObservation(options.browserObservation);
  const frozen = await readCheckpointedFrozenArtifact("M10A-T07", {
    workspaceRoot,
  });
  const historicalT07 = {
    artifactSha256: sha256(frozen.bytes),
    artifact: JSON.parse(Buffer.from(frozen.bytes, "utf8")),
  };
  const artifact = buildArtifact(identity, browser, historicalT07);
  const artifactBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    identity,
  });
}

/** Writes newly captured T08 evidence through its exact atomic destination. */
export async function writeM10AT08Evidence(rawOptions = undefined) {
  const options = exactOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "browserObservation", "workspaceRoot"],
    "M10A-T08 writer options",
  );
  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy function.");
  }
  const artifactPath = options.artifactPath ?? path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH);
  if (
    typeof artifactPath !== "string" ||
    !path.isAbsolute(artifactPath) ||
    path.resolve(artifactPath) !== artifactPath ||
    artifactPath.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "artifactPath must be one canonical absolute path.");
  }
  const browser = options.browserObservation ?? (await runBrowserProof());
  const built = await buildM10AT08Evidence({ workspaceRoot, browserObservation: browser });
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : `: ${String(error)}`;
    fail("ARTIFACT_WRITE_UNSAFE", `Atomic T08 evidence write failed${detail}`);
  }
  return Object.freeze({
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    catalogSha256: built.artifact.package.catalog.sha256,
    packageDigest: built.artifact.package.packageDigest,
  });
}

/** Rebuilds current evidence and authenticates the exact checkpointed T08 artifact. */
export async function verifyM10AT08Evidence(rawOptions = undefined) {
  const options = exactOptions(
    rawOptions,
    ["artifactBytes", "browserObservation"],
    "M10A-T08 verifier options",
  );
  const browser = options.browserObservation ?? (await runBrowserProof());
  const built = await buildM10AT08Evidence({ browserObservation: browser });
  let artifactBytes = options.artifactBytes;
  let checkpointHeadSha256 = "TEST_OVERRIDE";
  if (artifactBytes === undefined) {
    const frozen = await readCheckpointedFrozenArtifact("M10A-T08", {
      workspaceRoot: WORKSPACE_ROOT,
    });
    artifactBytes = Buffer.from(frozen.bytes);
    checkpointHeadSha256 = frozen.checkpointHeadSha256;
  }
  if (!Buffer.isBuffer(artifactBytes) || !artifactBytes.equals(built.artifactBytes))
    fail("ARTIFACT_DRIFT", "Checkpointed T08 evidence differs from current authorities.");
  return Object.freeze({
    status: "PASS",
    task: "M10A-T08",
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    catalogSha256: built.artifact.package.catalog.sha256,
    packageDigest: built.artifact.package.packageDigest,
    browserTests: built.artifact.browser.tests,
    checkpointHeadSha256,
    browserExecutedByVerifier: options.browserObservation === undefined,
  });
}
