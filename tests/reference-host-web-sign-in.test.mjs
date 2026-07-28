import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
  REFERENCE_HOST_WEB_SIGN_IN_INSPECTION_PATHS,
  REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS,
  ReferenceHostWebSignInEvidenceError,
  buildReferenceHostWebSignInEvidence,
  inspectReferenceHostWebSignInEvidence,
  verifyReferenceHostWebSignInDocumentation,
  verifyReferenceHostWebSignInEvidence,
  writeReferenceHostWebSignInEvidence,
} from "../scripts/lib/reference-host-web-sign-in-proof.mjs";

const WORKSPACE_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const PROOF_PATH = path.join(WORKSPACE_ROOT, "docs/proof/REFERENCE-HOST-WEB-SIGN-IN.md");

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ReferenceHostWebSignInEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function copyInspectionWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "desen-reference-host-t08-"));
  for (const relativePath of REFERENCE_HOST_WEB_SIGN_IN_INSPECTION_PATHS) {
    const destination = path.join(workspaceRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(WORKSPACE_ROOT, relativePath), destination);
  }
  return workspaceRoot;
}

async function mutateWorkspaceFile(workspaceRoot, relativePath, mutate) {
  const filePath = path.join(workspaceRoot, relativePath);
  const original = await readFile(filePath, "utf8");
  await writeFile(filePath, mutate(original), "utf8");
  return async () => writeFile(filePath, original, "utf8");
}

function syntheticDocumentation(sha256) {
  return Object.freeze({
    proofDocumentText: [
      "# Proof",
      "",
      "## Evidence artifact",
      "",
      "- path: `docs/proof/artifacts/reference-host-web-0.1.0-sign-in.json`",
      `- SHA-256: \`sha256:${sha256}\``,
      "",
    ].join("\n"),
    proofMatrixText: [
      "# Matrix",
      "",
      `| P-06 | host parity | \`reference-host-web-0.1.0-sign-in.json\` \`sha256:${sha256}\` |`,
      `| P-10 | host operations | \`reference-host-web-0.1.0-sign-in.json\` \`sha256:${sha256}\` |`,
      "",
      "## M05-T08",
      "",
      "`reference-host-web-0.1.0-sign-in.json`",
      `\`sha256:${sha256}\``,
      "",
    ].join("\n"),
    projectStatusText: [
      "# Status",
      "",
      "M05-T08 evidence:",
      "",
      "- `docs/proof/artifacts/reference-host-web-0.1.0-sign-in.json`",
      "- artifact SHA-256:",
      `  \`${sha256}\``,
      "",
    ].join("\n"),
  });
}

test("accepts the tracked deterministic M05-T08 sign-in evidence", async () => {
  const result = await verifyReferenceHostWebSignInEvidence();
  assert.equal(result.result, "PASS");
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.focusedTests, 18);
  assert.equal(result.fullAppTests, 40);
  assert.equal(result.compilerNegativeCases, 13);
  assert.equal(result.rootMutationTests, 14);
  assert.equal(result.traceEntries, 13);
  assert.equal(result.buildFiles, 3);
  assert.equal(result.exactDocumentationReferences, 10);
});

test("builds byte-identical evidence across independent proof runs", async () => {
  const built = await buildReferenceHostWebSignInEvidence();
  const stored = await readFile(DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH);
  assert.deepEqual(built.artifactBytes, stored);
  assert.equal(built.artifact.independentBuild.independentBuilds, 2);
  assert.equal(built.artifact.independentBuild.deterministic, true);
  assert.equal(Object.isFrozen(built.artifact), true);
  assert.equal(Object.isFrozen(built.artifact.evidence.trackedFiles), true);
  assert.equal(Object.isFrozen(built.artifact.evidence.trackedFiles[0]), true);
});

test("inspects the exact official-derived fixture and current production boundary", async () => {
  const inventory = await inspectReferenceHostWebSignInEvidence();
  assert.equal(inventory.prerequisites.length, 2);
  assert.equal(
    inventory.fixtures.source.digest,
    "sha256:b8e2d6bac855fb307aaeb0636becf93834f6faeda5464bdbfbc1e8d52f379635",
  );
  assert.equal(
    inventory.fixtures.bundle.revision,
    "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
  );
  assert.equal(inventory.fixtures.managedSurfaces.inventory.nodes, 8);
  assert.equal(inventory.production.httpBinding.acceptedAttemptsPerInvocation, 1);
  assert.equal(inventory.production.httpBinding.maximumResponseBytes, 65_536);
  assert.equal(inventory.production.httpBinding.maximumResponseChunks, 1_024);
  assert.equal(inventory.production.dynamicExecutableCalls, 0);
  assert.equal(inventory.production.officialCompositionJsx, 0);
  assert.equal(inventory.tests.focusedCases, 18);
});

test("rejects inherited accessor-backed symbolic Proxy and unknown options", async () => {
  const inherited = Object.create({ workspaceRoot: WORKSPACE_ROOT });
  await assert.rejects(
    inspectReferenceHostWebSignInEvidence(inherited),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
  );
  const accessor = {};
  Object.defineProperty(accessor, "workspaceRoot", {
    enumerable: true,
    get() {
      throw new Error("must not run");
    },
  });
  await assert.rejects(
    inspectReferenceHostWebSignInEvidence(accessor),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
  );
  await assert.rejects(
    inspectReferenceHostWebSignInEvidence({
      workspaceRoot: WORKSPACE_ROOT,
      [Symbol("hostile")]: true,
    }),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
  );
  await assert.rejects(
    inspectReferenceHostWebSignInEvidence(new Proxy({}, {})),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
  );
  await assert.rejects(
    inspectReferenceHostWebSignInEvidence({ unexpected: true }),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
  );
  if (typeof SharedArrayBuffer !== "undefined") {
    await assert.rejects(
      verifyReferenceHostWebSignInEvidence({
        artifactBytes: new Uint8Array(new SharedArrayBuffer(8)),
      }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
    );
  }
});

test("rejects stale semantic and one-byte artifact tampering", async () => {
  const pristine = await readFile(DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH);
  const artifact = JSON.parse(pristine.toString("utf8"));
  artifact.claim.officialSignInExecuted = false;
  const semanticTamper = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
  const documentation = syntheticDocumentation("0".repeat(64));
  await assert.rejects(
    verifyReferenceHostWebSignInEvidence({
      artifactBytes: semanticTamper,
      ...documentation,
    }),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_ARTIFACT_DRIFT"),
  );
  const oneByteTamper = Buffer.from(pristine);
  oneByteTamper[0] ^= 1;
  await assert.rejects(
    verifyReferenceHostWebSignInEvidence({
      artifactBytes: oneByteTamper,
      ...documentation,
    }),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_ARTIFACT_DRIFT"),
  );
});

test("rejects missing changed or substituted direct prerequisite evidence", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    for (const relativePath of REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS) {
      const restore = await mutateWorkspaceFile(workspaceRoot, relativePath, (text) => `${text} `);
      await assert.rejects(
        inspectReferenceHostWebSignInEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SIGN_IN_PREREQUISITE_DRIFT"),
      );
      await restore();
    }
    await unlink(path.join(workspaceRoot, REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS[0]));
    await assert.rejects(
      inspectReferenceHostWebSignInEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_PREREQUISITE_MISSING"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects official-derived fixture surface digest revision and authoring drift", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  const mutations = [
    [
      "examples/sign-in/official-derived.bundle.desen.json",
      (text) => text.replace('"revision": "sha256:2dc98', '"revision": "sha256:3dc98'),
    ],
    [
      "examples/sign-in/official-derived.bundle.desen.json",
      (text) => text.replace("{", '{"authoring": {},'),
    ],
    [
      "examples/sign-in/official-derived.bundle.desen.json",
      (text) => text.replace('"Sign in"', '"Sign in altered"'),
    ],
    [
      "examples/sign-in/official-derived.bundle.desen.json",
      (text) => text.replace("sha256:acdbbfe9", "sha256:bcdbbfe9"),
    ],
  ];
  try {
    for (const [relativePath, mutate] of mutations) {
      const restore = await mutateWorkspaceFile(workspaceRoot, relativePath, mutate);
      await assert.rejects(
        inspectReferenceHostWebSignInEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT"),
      );
      await restore();
    }
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects production sign-in composition and authority-boundary drift", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  const mutations = [
    [
      "apps/reference-host-web/src/official-sign-in.ts",
      (text) =>
        `${text.replace(
          'binding.operationId !== "com.example.auth/signIn"',
          'binding.operationId === "com.example.auth/signIn"',
        )}\n// decoy: binding.operationId !== "com.example.auth/signIn"\n`,
    ],
    [
      "apps/reference-host-web/src/official-sign-in.ts",
      (text) =>
        `${text.replace(
          'browser.history.pushState(null, "", HOME_PATH)',
          'browser.history.pushState(null, "", "/untrusted")',
        )}\n// decoy: browser.history.pushState(null, "", HOME_PATH)\n`,
    ],
  ];
  try {
    for (const [relativePath, mutate] of mutations) {
      const restore = await mutateWorkspaceFile(workspaceRoot, relativePath, mutate);
      await assert.rejects(
        inspectReferenceHostWebSignInEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT"),
      );
      await restore();
    }
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects HTTP request redaction and single-attempt policy drift", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  const relativePath = "apps/reference-host-web/src/sign-in-http-handler.ts";
  const mutations = [
    (text) =>
      `${text.replace(
        "if (response.status === 401) {",
        "if (response.status !== 401) {",
      )}\n// decoy: if (response.status === 401) {\n`,
    (text) =>
      `${text.replace(
        "rawResponse = await Reflect.apply(fetchLike, undefined, [",
        "rawResponse = await Reflect.apply(fetchLike, undefined, []); rawResponse = await Reflect.apply(fetchLike, undefined, [",
      )}\n// decoy: rawResponse = await Reflect.apply(fetchLike, undefined, [\n`,
    (text) =>
      `${text.replace(
        "const MAX_SIGN_IN_RESPONSE_BYTES = 64 * 1024;",
        "const MAX_SIGN_IN_RESPONSE_BYTES = Number.MAX_SAFE_INTEGER;",
      )}\n// decoy: const MAX_SIGN_IN_RESPONSE_BYTES = 64 * 1024;\n`,
    (text) =>
      `${text.replace(
        'Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []) !== "Uint8Array"',
        "false",
      )}\n// decoy: Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []) !== "Uint8Array"\n`,
    (text) =>
      `${text.replace(
        "captureResponseChunk(result.value, MAX_SIGN_IN_RESPONSE_BYTES - totalBytes)",
        "captureResponseChunk(result.value, Number.MAX_SAFE_INTEGER)",
      )}\n// decoy: captureResponseChunk(result.value, MAX_SIGN_IN_RESPONSE_BYTES - totalBytes)\n`,
  ];
  try {
    for (const mutate of mutations) {
      const restore = await mutateWorkspaceFile(workspaceRoot, relativePath, mutate);
      await assert.rejects(
        inspectReferenceHostWebSignInEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT"),
      );
      await restore();
    }
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects manifest root-script import and executable-loading drift", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  const mutations = [
    [
      "package.json",
      (text) =>
        text.replace(
          "pnpm verify:reference-host-web-shell && pnpm --filter @desen/reference-host-web... build",
          "pnpm --filter @desen/reference-host-web... build",
        ),
    ],
    [
      "apps/reference-host-web/package.json",
      (text) => text.replace('"@desen/runtime-core": "workspace:*"', '"desen": "workspace:*"'),
    ],
    [
      "apps/reference-host-web/src/application.tsx",
      (text) => `${text}\nvoid import("@desen/editor-core");\n`,
    ],
  ];
  try {
    for (const [relativePath, mutate] of mutations) {
      const restore = await mutateWorkspaceFile(workspaceRoot, relativePath, mutate);
      await assert.rejects(
        inspectReferenceHostWebSignInEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT"),
      );
      await restore();
    }
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects focused test compiler-negative and T07 compatibility inventory drift", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  const mutations = [
    [
      "apps/reference-host-web/test/official-sign-in.test.tsx",
      (text) =>
        text.replace("runs pending, declared failure", "skips pending and declared failure"),
    ],
    [
      "apps/reference-host-web/test/main-lifecycle.test.tsx",
      (text) => text.replace("preserves the production composition", "disposes BFCache entry"),
    ],
    [
      "apps/reference-host-web/test/main-lifecycle.test.tsx",
      (text) =>
        text.replace(
          "const PRODUCTION_ENTRY_TEST_TIMEOUT_MS = 15_000;",
          "const PRODUCTION_ENTRY_TEST_TIMEOUT_MS = 5_000;",
        ),
    ],
    [
      "apps/reference-host-web/test/official-sign-in.types.ts",
      (text) => text.replace("M05-T08-N07", "M05-T08-N77"),
    ],
    [
      "tests/reference-host-web-shell.test.mjs",
      (text) =>
        text.replace(
          "accepts immutable task-time M05-T07 reference-host shell evidence",
          "rebuilds old evidence from successor source",
        ),
    ],
  ];
  try {
    for (const [relativePath, mutate] of mutations) {
      const restore = await mutateWorkspaceFile(workspaceRoot, relativePath, mutate);
      await assert.rejects(
        inspectReferenceHostWebSignInEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT"),
      );
      await restore();
    }
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects symlink workspace artifact proof and tracked-source inputs", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "desen-reference-host-t08-links-"));
  const workspaceLink = path.join(temporaryRoot, "workspace");
  await symlink(WORKSPACE_ROOT, workspaceLink);
  await assert.rejects(
    inspectReferenceHostWebSignInEvidence({ workspaceRoot: workspaceLink }),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_INPUT_UNSAFE"),
  );

  const workspaceRoot = await copyInspectionWorkspace();
  try {
    const trackedPath = path.join(workspaceRoot, "apps/reference-host-web/src/main.tsx");
    await unlink(trackedPath);
    await symlink(path.join(WORKSPACE_ROOT, "apps/reference-host-web/src/main.tsx"), trackedPath);
    await assert.rejects(
      inspectReferenceHostWebSignInEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_INPUT_UNSAFE"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }

  const ancestorWorkspace = await copyInspectionWorkspace();
  try {
    const sourceDirectory = path.join(ancestorWorkspace, "apps/reference-host-web/src");
    await rm(sourceDirectory, { recursive: true });
    await symlink(path.join(WORKSPACE_ROOT, "apps/reference-host-web/src"), sourceDirectory);
    await assert.rejects(
      inspectReferenceHostWebSignInEvidence({ workspaceRoot: ancestorWorkspace }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_INPUT_UNSAFE"),
    );
  } finally {
    await rm(ancestorWorkspace, { recursive: true, force: true });
  }

  const artifactLink = path.join(temporaryRoot, "artifact.json");
  await symlink(DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH, artifactLink);
  await assert.rejects(
    verifyReferenceHostWebSignInEvidence({ artifactPath: artifactLink }),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_ARTIFACT_UNSAFE"),
  );

  const pristineArtifact = await readFile(DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH);
  const sha256 = (await buildReferenceHostWebSignInEvidence()).artifactSha256;
  const documentation = syntheticDocumentation(sha256);
  const proofLink = path.join(temporaryRoot, "proof.md");
  await symlink(PROOF_PATH, proofLink);
  await assert.rejects(
    verifyReferenceHostWebSignInEvidence({
      artifactBytes: pristineArtifact,
      proofPath: proofLink,
      proofMatrixText: documentation.proofMatrixText,
      projectStatusText: documentation.projectStatusText,
    }),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_DOCUMENTATION_UNSAFE"),
  );
  await rm(temporaryRoot, { recursive: true, force: true });
});

test("requires one unique final proof-document artifact and SHA pin", async () => {
  const sha256 = "a".repeat(64);
  const valid = syntheticDocumentation(sha256);
  assert.deepEqual(
    verifyReferenceHostWebSignInDocumentation(
      valid.proofDocumentText,
      valid.proofMatrixText,
      valid.projectStatusText,
      sha256,
    ),
    { result: "PASS", exactReferences: 10 },
  );

  const mutations = [
    {
      ...valid,
      proofDocumentText: valid.proofDocumentText.replace(
        "## Evidence artifact",
        "## Moved evidence",
      ),
    },
    {
      ...valid,
      proofDocumentText: `${valid.proofDocumentText}\n${valid.proofDocumentText}`,
    },
    {
      ...valid,
      proofDocumentText: valid.proofDocumentText.replace(
        `sha256:${sha256}`,
        "sha256:[PENDING_FINAL_ARTIFACT_SHA256]",
      ),
    },
    {
      ...valid,
      proofMatrixText: valid.proofMatrixText.replace("## M05-T08", "## M05-T80"),
    },
    {
      ...valid,
      proofMatrixText: valid.proofMatrixText.replace(sha256, "b".repeat(64)),
    },
    {
      ...valid,
      proofMatrixText: valid.proofMatrixText.replace("| P-10 |", "| P-01 |"),
    },
    {
      ...valid,
      proofMatrixText: valid.proofMatrixText.replace(
        "## M05-T08",
        `| P-06 | duplicate | \`reference-host-web-0.1.0-sign-in.json\` \`sha256:${sha256}\` |\n\n## M05-T08`,
      ),
    },
    {
      ...valid,
      proofMatrixText: valid.proofMatrixText.replace(
        `| P-10 | host operations | \`reference-host-web-0.1.0-sign-in.json\` \`sha256:${sha256}\` |`,
        `| P-10 | host operations | \`reference-host-web-0.1.0-sign-in.json\` \`sha256:${"d".repeat(64)}\` |`,
      ),
    },
    {
      ...valid,
      proofMatrixText: valid.proofMatrixText.replace(
        `| P-06 | host parity | \`reference-host-web-0.1.0-sign-in.json\` \`sha256:${sha256}\` |`,
        `| P-06 | host parity | \`reference-host-web-0.1.0-sign-in.json\` \`sha256:${"0".repeat(64)}\` | CORRECT-DECOY \`sha256:${sha256}\` |`,
      ),
    },
    {
      ...valid,
      projectStatusText: `${valid.projectStatusText}\n${valid.projectStatusText}`,
    },
    {
      ...valid,
      projectStatusText: valid.projectStatusText.replace(sha256, "c".repeat(64)),
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () =>
        verifyReferenceHostWebSignInDocumentation(
          mutation.proofDocumentText,
          mutation.proofMatrixText,
          mutation.projectStatusText,
          sha256,
        ),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT"),
    );
  }
});

test("writes exact evidence atomically and rejects temporary-byte substitution", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "desen-reference-host-t08-write-"));
  try {
    const destination = path.join(temporaryRoot, "evidence.json");
    const written = await writeReferenceHostWebSignInEvidence({ artifactPath: destination });
    assert.equal(written.result, "PASS");
    assert.deepEqual(
      await readFile(destination),
      await readFile(DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH),
    );

    const preserved = Buffer.from("preserved destination\n");
    await writeFile(destination, preserved);
    await assert.rejects(
      writeReferenceHostWebSignInEvidence({
        artifactPath: destination,
        async beforeAtomicRename({ temporaryPath }) {
          const bytes = await readFile(temporaryPath);
          bytes[0] ^= 1;
          await writeFile(temporaryPath, bytes);
        },
      }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_ARTIFACT_UNSAFE"),
    );
    assert.deepEqual(await readFile(destination), preserved);
    assert.equal(
      (await readdir(temporaryRoot)).some((name) => name.endsWith(".tmp")),
      false,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
