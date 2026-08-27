import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN,
  DESEN_APP_SHELL_NAVIGATION_ROOT_TEST_NAMES,
  DesenAppShellNavigationProofError,
  buildDesenAppShellNavigationEvidence,
  verifyDesenAppShellNavigationEvidence,
  writeDesenAppShellNavigationEvidence,
} from "../scripts/lib/desen-app-shell-navigation-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json";
const PREREQUISITE = "docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json";
const NAVIGATION = "apps/desen-app/src/project-navigation.ts";
const APPLICATION = "apps/desen-app/src/application.tsx";
const ADAPTER_CANVAS = "apps/desen-app/src/adapter-canvas.tsx";
const AUTHORING_SELECTION = "apps/desen-app/src/authoring-selection.ts";
const LOGO = "apps/desen-app/src/assets/desen-logo.svg";
const INDEX = "apps/desen-app/index.html";
const PACKAGE = "apps/desen-app/package.json";
const ROOT_PACKAGE = "package.json";
const temporaryDirectories = [];
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppShellNavigationProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    `# Desen App shell and navigation\n\nTask: M09-T01\n\nStatus: DONE\n\nArtifact: \`${ARTIFACT}\`\n\nFinal artifact: \`sha256:${artifactSha256}\`\n`,
  );
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  built = await buildDesenAppShellNavigationEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test("[authority] binds M09-T01 to the exact completed G08 artifact", () => {
  assert.equal(built.artifactBytes.byteLength, 12_118);
  assert.equal(
    built.artifactSha256,
    "c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220",
  );
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-shell-navigation");
  assert.equal(built.artifact.profile, "desen.app.shell-navigation-proof.v1");
  assert.equal(built.artifact.task, "M09-T01");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisite, DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.prerequisiteGate, "G08");
  assert.equal(built.artifact.claim.prerequisiteStatus, "DONE");
  assert.deepEqual(
    built.artifact.evidence.rootTestNames,
    DESEN_APP_SHELL_NAVIGATION_ROOT_TEST_NAMES,
  );
  assert.equal(built.currentCompatibility.result, "PASS");
  assert.equal(built.currentCompatibility.additiveSuccessor.task, "M09-T04");
});

test("[shell] records the closed route, fixture, guidance, and accessibility profile", () => {
  assert.deepEqual(built.artifact.application.shell.routes, [
    "/projects",
    "/projects/:projectId",
    "/projects/:projectId/surfaces/:surfaceId",
  ]);
  assert.deepEqual(built.artifact.application.shell.fixtureProjects, [
    "account-app",
    "checkout-pilot",
  ]);
  assert.equal(built.artifact.application.shell.unknownRoutePolicy, "EXPLICIT_NOT_FOUND");
  assert.equal(
    built.artifact.application.shell.navigationAuthority,
    "SAME_ORIGIN_HISTORY_API_WITH_POPSTATE_AND_APP_EVENT",
  );
  assert.equal(built.artifact.application.shell.disabledFutureActionsExplained, true);
  assert.equal(built.artifact.application.shell.keyboardFocusVisible, true);
  assert.equal(built.artifact.application.shell.routeHeadingFocus, true);
  assert.equal(built.artifact.application.shell.reducedMotionHonored, true);
  assert.deepEqual(built.artifact.application.shell.localSvgAssets, [
    "apps/desen-app/src/assets/breadcrumb-separator.svg",
    "apps/desen-app/src/assets/desen-logo.svg",
    "apps/desen-app/src/assets/plus.svg",
    "apps/desen-app/src/assets/settings.svg",
    "apps/desen-app/src/assets/theme.svg",
  ]);
  assert.equal(built.artifact.evidence.tests.positiveAndNegativeCoverage, true);
  assert.deepEqual(built.artifact.evidence.tests.runtimeCases, {
    "project-navigation.test.ts": 30,
    "application.test.tsx": 10,
    "main-lifecycle.test.tsx": 3,
  });
  assert.equal(built.artifact.evidence.tests.totalRuntimeCases, 43);
});

test("[boundary] keeps the first app slice free of editor, renderer, persistence, and publish authority", () => {
  assert.deepEqual(
    {
      catalogDrivenPanelImplemented: built.artifact.claim.catalogDrivenPanelImplemented,
      realAdapterCanvasImplemented: built.artifact.claim.realAdapterCanvasImplemented,
      selectionOrInspectorImplemented: built.artifact.claim.selectionOrInspectorImplemented,
      persistenceUiImplemented: built.artifact.claim.persistenceUiImplemented,
      runOrPublishImplemented: built.artifact.claim.runOrPublishImplemented,
      userProjectCreationImplemented: built.artifact.claim.userProjectCreationImplemented,
    },
    {
      catalogDrivenPanelImplemented: false,
      realAdapterCanvasImplemented: false,
      selectionOrInspectorImplemented: false,
      persistenceUiImplemented: false,
      runOrPublishImplemented: false,
      userProjectCreationImplemented: false,
    },
  );
  assert.equal(built.artifact.boundary.imports.desenPackageImports, 0);
  assert.equal(built.artifact.boundary.imports.arbitraryExecutableImports, 0);
  assert.equal(built.artifact.boundary.imports.arbitraryExecutableHtmlEntries, 0);
  assert.equal(built.artifact.boundary.trackedFiles, 24);
  assert.equal(built.artifact.nonclaims.length, 4);
  assert.equal(
    built.currentCompatibility.additiveSuccessor.catalogDrivenAuthoringReadModelAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.exactPublicRuntimeAdapterCanvasAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.stableSourceSelectionOverlayAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor
      .historicalNoCatalogPanelNonclaimAppliedToCurrentApp,
    false,
  );
  assert.deepEqual(built.currentCompatibility.additiveSuccessor.knownSourceEdges, [
    "apps/desen-app/src/authoring-data.ts",
    "apps/desen-app/src/adapter-canvas.tsx",
    "apps/desen-app/src/authoring-selection.ts",
  ]);
  assert.equal(
    built.currentCompatibility.additiveSuccessor
      .historicalNoRealAdapterCanvasNonclaimAppliedToCurrentApp,
    false,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor
      .historicalNoSelectionOrInspectorNonclaimAppliedToCurrentApp,
    false,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.sourceMutationPersistenceAndPublishStillDisallowed,
    true,
  );
  assert.equal(built.currentCompatibility.boundary.imports.exactReferenceAdapterRegistry, true);
  assert.equal(built.currentCompatibility.boundary.imports.publicDiagnosticIndexTypeOnlyImports, 1);
  assert.equal(built.currentCompatibility.boundary.imports.handwrittenManagedTreeElements, 0);
  assert.equal(built.currentCompatibility.boundary.imports.privateDomAccesses, 0);
  assert.equal(built.currentCompatibility.boundary.imports.mutationOrPublicationCalls, 0);
  assert.equal(built.currentCompatibility.retainedClaim.catalogDrivenPanelImplemented, undefined);
  assert.equal(built.currentCompatibility.retainedClaim.realAdapterCanvasImplemented, undefined);
});

test("[determinism] builds byte-identical detached evidence twice", async () => {
  const second = await buildDesenAppShellNavigationEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
  assert.deepEqual(second.currentCompatibility, built.currentCompatibility);
  assert.equal(Object.isFrozen(second.currentCompatibility), true);
});

test("[mutation] rejects prerequisite, route, package, and scope-boundary drift", async () => {
  const prerequisite = await readFile(path.join(ROOT, PREREQUISITE));
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({ prerequisiteBytes: changedByte(prerequisite) }),
    expectedError("PREREQUISITE_DRIFT"),
  );

  const navigation = await readFile(path.join(ROOT, NAVIGATION), "utf8");
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [NAVIGATION, Buffer.from(navigation.replaceAll('kind: "not-found"', 'kind: "fallback"'))],
      ]),
    }),
    expectedError("SHELL_SEMANTIC_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          NAVIGATION,
          Buffer.from(
            navigation.replace(
              "return `${window.location.pathname}${window.location.search}${window.location.hash}`;",
              "return window.location.pathname;",
            ),
          ),
        ],
      ]),
    }),
    expectedError("SHELL_SEMANTIC_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          NAVIGATION,
          Buffer.from(
            navigation.replace(
              'window.location.pathname !== "/" ||\n    window.location.search !== "" ||\n    window.location.hash !== ""',
              'window.location.pathname !== "/"',
            ),
          ),
        ],
      ]),
    }),
    expectedError("SHELL_SEMANTIC_DRIFT"),
  );

  const packageBytes = await readFile(path.join(ROOT, PACKAGE), "utf8");
  const packageWithExtraDependency = JSON.parse(packageBytes);
  packageWithExtraDependency.dependencies["react-router-dom"] = "7.9.1";
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [PACKAGE, Buffer.from(`${JSON.stringify(packageWithExtraDependency, null, 2)}\n`)],
      ]),
    }),
    expectedError("PACKAGE_DRIFT"),
  );
  const rootPackageBytes = await readFile(path.join(ROOT, ROOT_PACKAGE), "utf8");
  const rootPackageWithParserDrift = JSON.parse(rootPackageBytes);
  rootPackageWithParserDrift.devDependencies.typescript = "6.0.4";
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [ROOT_PACKAGE, Buffer.from(`${JSON.stringify(rootPackageWithParserDrift, null, 2)}\n`)],
      ]),
    }),
    expectedError("PACKAGE_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [PACKAGE, Buffer.from(packageBytes.replace("@desen/app-web", "@desen/app-shell"))],
      ]),
    }),
    expectedError("PACKAGE_DRIFT"),
  );

  const application = await readFile(path.join(ROOT, APPLICATION), "utf8");
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nimport "./untracked-module.js";\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nimport"./untracked-module.js";\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nexport*from"./untracked-module.js";\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nexport*from/*x*/"./untracked-module.js";\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );

  const indexHtml = await readFile(path.join(ROOT, INDEX), "utf8");
  for (const executableHtml of [
    '<script src="https://example.test/extra.js"></script>',
    "<script>globalThis.extraExecution = true;</script>",
    '<button onclick="globalThis.extraExecution = true">Unsafe</button>',
  ]) {
    await assert.rejects(
      buildDesenAppShellNavigationEvidence({
        fileOverrides: new Map([
          [INDEX, Buffer.from(indexHtml.replace("</body>", `${executableHtml}\n  </body>`))],
        ]),
      }),
      expectedError("IMPORT_BOUNDARY_DRIFT"),
    );
  }
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nimport/*x*/"./untracked-module.js";\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nvoid import("./project-data.js");\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nvoid import/*x*/("./project-data.js");\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          APPLICATION,
          Buffer.from(`${application}\ntype Hidden = import("./untracked-module.js").Hidden;\n`),
        ],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\ncreateDesenEditor();\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );

  const adapterCanvas = await readFile(path.join(ROOT, ADAPTER_CANVAS), "utf8");
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          ADAPTER_CANVAS,
          Buffer.from(
            adapterCanvas.replace(
              "@desen/reference-catalog-web/react-adapters",
              "@desen/reference-catalog-web/private/react-adapters",
            ),
          ),
        ],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );

  const authoringSelection = await readFile(path.join(ROOT, AUTHORING_SELECTION), "utf8");
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          AUTHORING_SELECTION,
          Buffer.from(`${authoringSelection}\ndocument.querySelector("input");\n`),
        ],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [AUTHORING_SELECTION, Buffer.from(authoringSelection.replace("import type {", "import {"))],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\nvoid import("@desen/runtime-react");\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\nconst handwritten = <Stack />;\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\ndocument.querySelector("main");\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\ninsertDesenEditor();\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          ADAPTER_CANVAS,
          Buffer.from(
            adapterCanvas.replace(
              "createRuntimeReactAdapterRegistry(\n  REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT,\n)",
              "createRuntimeReactAdapterRegistry({})",
            ),
          ),
        ],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );

  const logo = await readFile(path.join(ROOT, LOGO), "utf8");
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([[LOGO, Buffer.from(logo.replace("</svg>", "<script/>\n</svg>"))]]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
});

test("[verification] rejects artifact and visible proof-pin drift", async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppShellNavigationEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisiteGate, "G08");
  assert.equal(verified.prerequisiteStatus, "DONE");

  await assert.rejects(
    verifyDesenAppShellNavigationEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppShellNavigationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
});

test("[writer] atomically writes exact evidence and preserves a destination on tampering", async () => {
  const directory = await temporaryDirectory("desen-m09-t01-writer-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppShellNavigationEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppShellNavigationEvidence({
      artifactPath: destination,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), preserved);
});

test("[filesystem] rejects linked prerequisite, artifact, and proof authorities", async () => {
  const directory = await temporaryDirectory("desen-m09-t01-links-");
  const prerequisiteTarget = path.join(directory, "prerequisite-target.json");
  const prerequisiteLink = path.join(directory, "prerequisite.json");
  await writeFile(prerequisiteTarget, await readFile(path.join(ROOT, PREREQUISITE)));
  await symlink(prerequisiteTarget, prerequisiteLink);
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({ prerequisitePath: prerequisiteLink }),
    expectedError("AUTHORITY_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppShellNavigationEvidence({
      artifactPath: artifactLink,
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );

  const proofTarget = path.join(directory, "proof-target.md");
  const proofLink = path.join(directory, "proof-link.md");
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await symlink(proofTarget, proofLink);
  await assert.rejects(
    verifyDesenAppShellNavigationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath: proofLink,
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );
});
