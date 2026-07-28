import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH,
  DEFAULT_REFERENCE_HOST_WEB_SHELL_PROOF_PATH,
  REFERENCE_HOST_WEB_SHELL_INSPECTION_PATHS,
  REFERENCE_HOST_WEB_SHELL_PREREQUISITE_PATHS,
  ReferenceHostWebShellEvidenceError,
  buildReferenceHostWebShellEvidence,
  inspectReferenceHostWebShellEvidence,
  verifyReferenceHostWebShellEvidence,
  verifyReferenceHostWebShellProofDocument,
  writeReferenceHostWebShellEvidence,
} from "../scripts/lib/reference-host-web-shell-proof.mjs";

const WORKSPACE_ROOT = path.resolve(new URL("..", import.meta.url).pathname);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ReferenceHostWebShellEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function copyInspectionWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "desen-reference-host-t07-inspect-"));
  for (const relativePath of REFERENCE_HOST_WEB_SHELL_INSPECTION_PATHS) {
    const destination = path.join(workspaceRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(WORKSPACE_ROOT, relativePath), destination);
  }
  return workspaceRoot;
}

async function mutateWorkspaceFile(workspaceRoot, relativePath, mutate) {
  const filePath = path.join(workspaceRoot, relativePath);
  const original = await readFile(filePath, "utf8");
  const changed = mutate(original);
  assert.notEqual(changed, original, `mutation did not change ${relativePath}`);
  await writeFile(filePath, changed, "utf8");
}

test("inspects the exact current M05-T07 source, trace, and focused-test inventory", async () => {
  const result = await inspectReferenceHostWebShellEvidence();
  assert.equal(result.tests.appFocusedCases, 22);
  assert.equal(result.tests.runtimeFocusedCases, 15);
  assert.equal(result.tests.runtimeCoreFocusedCases, 55);
  assert.equal(result.tests.runtimeCoreSecurityCases, 5);
  assert.equal(result.tests.focusedCases, 92);
  assert.equal(result.tests.appCompilerNegativeCases, 6);
  assert.equal(result.tests.runtimeCompilerNegativeCases, 14);
  assert.equal(result.tests.runtimeCoreCompilerNegativeCases, 33);
  assert.equal(result.tests.compilerNegativeCases, 53);
  assert.equal(result.tests.rootMutationTests >= 18, true);
  assert.equal(result.dynamicExecutableCalls, 0);
  assert.deepEqual(result.runtimeExports, [
    "authenticateRuntimeWebHostDocumentAuthority",
    "createRuntimeWebBrowserPlatform",
    "createRuntimeWebHostAuthority",
    "disposeRuntimeWebHostAuthority",
    "readRuntimeWebHostAuthority",
  ]);
});

test("builds two independent Vite outputs with one deterministic immutable receipt", async () => {
  const built = await buildReferenceHostWebShellEvidence();
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.hostShell.build.independentBuilds, 2);
  assert.equal(built.artifact.hostShell.build.deterministic, true);
  assert.equal(built.artifact.hostShell.build.fileCount >= 2, true);
  assert.match(built.artifact.hostShell.build.aggregateSha256, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(Object.isFrozen(built.artifact), true);
  assert.equal(Object.isFrozen(built.artifact.hostShell), true);
  assert.equal(Object.isFrozen(built.artifact.evidence.trackedFiles), true);
  assert.equal(built.artifact.claim.officialSignInExecuted, false);
  assert.equal(built.artifact.claim.handwrittenManagedTreeFullyAudited, false);
});

test("verifies the exact stored M05-T07 artifact and proof-document pin", async () => {
  const result = await verifyReferenceHostWebShellEvidence();
  assert.equal(result.result, "PASS");
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.focusedTests, 92);
  assert.equal(result.compilerNegativeCases, 53);
  assert.equal(result.rootMutationTests >= 18, true);
  assert.equal(result.exactDocumentationReferences, 1);
});

test("rejects one-byte and semantic mutations of the stored artifact", async () => {
  const pristine = await readFile(DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH);
  const oneByte = Buffer.from(pristine);
  oneByte[oneByte.length - 2] ^= 1;
  await assert.rejects(
    verifyReferenceHostWebShellEvidence({ artifactBytes: oneByte }),
    hasEvidenceCode("REFERENCE_HOST_SHELL_ARTIFACT_DRIFT"),
  );
});

test("rejects loss of the generic runtime-react managed-surface seam", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "apps/reference-host-web/src/managed-surface.tsx",
      (text) => text.replace("useRuntimeReactSurface(input)", "createElement(input as never)"),
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects raw React root-error inspection or logging", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(workspaceRoot, "apps/reference-host-web/src/root-policy.ts", (text) =>
      text.replace("void error;", "console.error(String(error));"),
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects loss of exact caught-error suppression on the dedicated root", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(workspaceRoot, "apps/reference-host-web/src/root-policy.ts", (text) =>
      text.replace(
        "onCaughtError: ignoreRuntimeReactRootCaughtError",
        "onCaughtError: onUncaughtError",
      ),
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects weakened terminal root fencing and authority-first teardown", async () => {
  for (const [relativePath, from, to] of [
    [
      "apps/reference-host-web/src/root-policy.ts",
      "Reflect.apply(onTerminalFailure, undefined, []);",
      "void onTerminalFailure;",
    ],
    [
      "apps/reference-host-web/src/root.tsx",
      'state.lifecycle = "closing";',
      'state.lifecycle = "active";',
    ],
    ["apps/reference-host-web/src/root.tsx", "ROOTS.set(handle, DISPOSED_ROOT);", "void handle;"],
    [
      "apps/reference-host-web/src/root.tsx",
      "disposeRuntimeWebHostAuthority(current.hostAuthority);\n    safelyDisposeSession(current.surface);",
      "safelyDisposeSession(current.surface);\n    disposeRuntimeWebHostAuthority(current.hostAuthority);",
    ],
    [
      "apps/reference-host-web/src/root.tsx",
      "if (unmountConfirmed) CLAIMED_CONTAINERS.delete(state.container);",
      "CLAIMED_CONTAINERS.delete(state.container);",
    ],
  ]) {
    const workspaceRoot = await copyInspectionWorkspace();
    try {
      await mutateWorkspaceFile(workspaceRoot, relativePath, (text) => text.replace(from, to));
      await assert.rejects(
        inspectReferenceHostWebShellEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  }
});

test("rejects reentrant activation gaps or incomplete executable-authority joins", async () => {
  for (const [from, to] of [
    [
      'if (state.lifecycle === "transitioning") {',
      'if (state.lifecycle === "never-transitioning") {',
    ],
    [
      'if (state.lifecycle !== "transitioning") return Object.freeze({ status: "disposed" });',
      'if (false) return Object.freeze({ status: "disposed" });',
    ],
    ["{ hostPorts: hostRead.hostPorts }", "{ hostPorts: { ...hostRead.hostPorts } }"],
    ["snapshot: captured.surface.serverSnapshot", "snapshot: surfaceAuthentication.snapshot"],
    ["catalogSet: captured.surface.catalogSet", "catalogSet: Object.freeze([]) as never"],
    ["documentId: surfaceAuthentication.snapshot.documentId", 'documentId: "unchecked"'],
    ["revision: surfaceAuthentication.snapshot.revision", 'revision: `sha256:${"0".repeat(64)}`'],
    ["const previous = state.current;", "const previous = undefined;"],
  ]) {
    const workspaceRoot = await copyInspectionWorkspace();
    try {
      await mutateWorkspaceFile(workspaceRoot, "apps/reference-host-web/src/root.tsx", (text) =>
        text.replace(from, to),
      );
      await assert.rejects(
        inspectReferenceHostWebShellEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  }
});

test("rejects weakened exact session-to-host-port authentication", async () => {
  for (const [from, to] of [
    ["hostAuthority: captured.hostPorts,", "hostAuthority: { ...captured.hostPorts },"],
    [
      "captured.hostPorts !== current.retainedGraph.hostAuthority",
      "JSON.stringify(captured.hostPorts) !== JSON.stringify(current.retainedGraph.hostAuthority)",
    ],
    [
      'return Object.freeze({ status: "authenticated" });',
      'return Object.freeze({ status: "authenticated", hostPorts: captured.hostPorts });',
    ],
    [
      "captured.hostPorts !== current.retainedGraph.hostAuthority",
      "Reflect.ownKeys(captured.hostPorts); if (captured.hostPorts !== current.retainedGraph.hostAuthority",
    ],
    [
      "const captured = captureHostAuthorityInput(input);",
      "const captured = captureHostAuthorityInput(input); captureHostAuthorityInput(input);",
    ],
    ["current !== authority ||", "false ||"],
  ]) {
    const workspaceRoot = await copyInspectionWorkspace();
    try {
      await mutateWorkspaceFile(
        workspaceRoot,
        "packages/runtime-core/src/headless-session.ts",
        (text) => text.replace(from, to),
      );
      await assert.rejects(
        inspectReferenceHostWebShellEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  }
});

test("rejects weakened runtime-web document identity authentication", async () => {
  for (const [from, to] of [
    ["captured.documentId !== current.documentId", "false"],
    ["captured.revision !== current.revision", "false"],
    ["!validDocumentId(documentId.value)", "false"],
    ["!validRevision(revision.value)", "false"],
    [
      'return Object.freeze({ status: "authenticated" });',
      'return Object.freeze({ status: "authenticated", hostPorts: current.hostPorts });',
    ],
    [
      "const captured = captureHostDocumentAuthorityInput(input);",
      "current.delegates?.navigate({} as never); const captured = captureHostDocumentAuthorityInput(input);",
    ],
    ['current !== authority || current.status !== "active"', "false"],
  ]) {
    const workspaceRoot = await copyInspectionWorkspace();
    try {
      await mutateWorkspaceFile(
        workspaceRoot,
        "packages/runtime-web/src/host-authority.ts",
        (text) => text.replace(from, to),
      );
      await assert.rejects(
        inspectReferenceHostWebShellEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  }
});

test("rejects widened, coercive, or inner-reflective document request capture", async () => {
  for (const [from, to] of [
    ["keys.length !== 2", "keys.length > 3"],
    ['!keys.includes("documentId")', "false"],
    ['!keys.includes("revision")', "false"],
    ["!documentId.enumerable", "false"],
    ['!("value" in documentId)', "false"],
    ["!revision.enumerable", "false"],
    ['!("value" in revision)', "false"],
    ["documentId: documentId.value,", "documentId: String(documentId.value),"],
    ["revision: revision.value,", "revision: (Reflect.ownKeys(revision.value), revision.value),"],
  ]) {
    const workspaceRoot = await copyInspectionWorkspace();
    try {
      await mutateWorkspaceFile(
        workspaceRoot,
        "packages/runtime-web/src/host-authority.ts",
        (text) => text.replace(from, to),
      );
      await assert.rejects(
        inspectReferenceHostWebShellEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  }
});

test("rejects widened or reflective host-authentication request capture", async () => {
  for (const [from, to] of [
    [
      'function captureHostAuthorityInput(input: unknown): CapturedHostAuthorityInput | undefined {\n  try {\n    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;\n    const prototype = Reflect.getPrototypeOf(input);',
      'function captureHostAuthorityInput(input: unknown): CapturedHostAuthorityInput | undefined {\n  try {\n    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;\n    const prototype = Object.prototype;',
    ],
    ["keys.length !== 1", "keys.length > 2"],
    ['keys[0] !== "hostPorts"', "false"],
    ["!hostPorts.enumerable", "false"],
    ['!("value" in hostPorts)', "false"],
    [
      "return Object.freeze({ hostPorts: hostPorts.value });",
      "Reflect.ownKeys(hostPorts.value); return Object.freeze({ hostPorts: hostPorts.value });",
    ],
  ]) {
    const workspaceRoot = await copyInspectionWorkspace();
    try {
      await mutateWorkspaceFile(
        workspaceRoot,
        "packages/runtime-core/src/headless-session.ts",
        (text) => text.replace(from, to),
      );
      await assert.rejects(
        inspectReferenceHostWebShellEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  }
});

test("rejects recovery derived from fewer than the four executable authorities", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "apps/reference-host-web/src/recovery-authority.ts",
      (text) =>
        text.replace(
          'const expected = ["session", "registry", "catalogSet", "hostAuthority"]',
          'const expected = ["session", "registry"]',
        ),
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects weakened executable-registry authentication at host activation", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(workspaceRoot, "apps/reference-host-web/src/root.tsx", (text) =>
      text.replace('if (registryRead.status !== "read")', 'if (registryRead.status === "read")'),
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects loss of explicit recovery-epoch advancement", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "apps/reference-host-web/src/recovery-authority.ts",
      (text) => text.replace("state.retryEpoch += 1n", "state.retryEpoch = 0n"),
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects dynamic executable selection in host or runtime-web production source", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "apps/reference-host-web/src/main.tsx",
      (text) => `${text}\nvoid import("@desen/reference-catalog-web/components");\n`,
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects a forbidden production testkit import", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "apps/reference-host-web/src/main.tsx",
      (text) => `import "@desen/testkit";\n${text}`,
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects focused app or runtime-web package-script drift", async () => {
  for (const [relativePath, from, to] of [
    ["apps/reference-host-web/package.json", "vitest run test/host-ports.test.ts", "vitest run"],
    [
      "packages/runtime-web/package.json",
      "vitest run test/host-authority.test.ts",
      "vitest run --passWithNoTests",
    ],
  ]) {
    const workspaceRoot = await copyInspectionWorkspace();
    try {
      await mutateWorkspaceFile(workspaceRoot, relativePath, (text) => text.replace(from, to));
      await assert.rejects(
        inspectReferenceHostWebShellEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  }
});

test("rejects root proof-script or ordering drift", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(workspaceRoot, "package.json", (text) =>
      text.replace(
        "pnpm verify:reference-host-web-shell",
        "node scripts/verify-reference-host-web-shell.mjs",
      ),
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects a widened reference-host dependency allowlist", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(workspaceRoot, "dependency-cruiser.config.cjs", (text) =>
      text.replace(
        '"reference-host-web": ["runtime-core", "runtime-react", "runtime-web", "reference-catalog-web"]',
        '"reference-host-web": ["runtime-core", "runtime-react", "runtime-web", "reference-catalog-web", "testkit"]',
      ),
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects canonical R-019, R-105, or A-013 exact-location drift", async () => {
  for (const [id, from, to] of [
    ["R-019", '"owners": ["M05-T07", "M05-T09"]', '"owners": ["M05-T09"]'],
    ["R-105", '"owners": ["M04-T01", "M04-T10", "M05-T07"]', '"owners": ["M04-T01", "M04-T10"]'],
    ["A-013", '"section": "Appendix A"', '"section": "Appendix B"'],
  ]) {
    const workspaceRoot = await copyInspectionWorkspace();
    try {
      await mutateWorkspaceFile(
        workspaceRoot,
        "docs/proof/protocol-0.1.0-traceability.json",
        (text) => {
          const marker = `"id": "${id}"`;
          const start = text.indexOf(marker);
          assert.notEqual(start, -1);
          const end = text.indexOf("\n    }", start);
          const entry = text.slice(start, end);
          assert.equal(entry.includes(from), true);
          return `${text.slice(0, start)}${entry.replace(from, to)}${text.slice(end)}`;
        },
      );
      await assert.rejects(
        inspectReferenceHostWebShellEvidence({ workspaceRoot }),
        hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  }
});

test("rejects prerequisite byte drift before interpreting successor source", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      REFERENCE_HOST_WEB_SHELL_PREREQUISITE_PATHS[0],
      (text) => `${text} `,
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_PREREQUISITE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects a symlink tracked source", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  const relativePath = "apps/reference-host-web/src/root-policy.ts";
  const source = path.join(workspaceRoot, relativePath);
  const target = path.join(workspaceRoot, "root-policy-target.ts");
  try {
    await copyFile(source, target);
    await unlink(source);
    await symlink(target, source);
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_INPUT_UNSAFE"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects a symlink predecessor receipt", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  const relativePath = REFERENCE_HOST_WEB_SHELL_PREREQUISITE_PATHS[0];
  const source = path.join(workspaceRoot, relativePath);
  const target = path.join(workspaceRoot, "prerequisite-target.json");
  try {
    await copyFile(source, target);
    await unlink(source);
    await symlink(target, source);
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_PREREQUISITE_UNSAFE"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects unknown, inherited, symbol, and non-enumerable options", async () => {
  const inherited = Object.create({ workspaceRoot: WORKSPACE_ROOT });
  const symbol = { [Symbol("workspaceRoot")]: WORKSPACE_ROOT };
  const nonEnumerable = Object.defineProperty({}, "workspaceRoot", {
    value: WORKSPACE_ROOT,
    enumerable: false,
  });
  for (const options of [{ fileOverrides: {} }, inherited, symbol, nonEnumerable]) {
    await assert.rejects(
      inspectReferenceHostWebShellEvidence(options),
      hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
    );
  }
});

test("rejects accessor, hostile Proxy, and revoked-Proxy options without invoking getters", async () => {
  let getterCalls = 0;
  const accessor = Object.defineProperty({}, "workspaceRoot", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return WORKSPACE_ROOT;
    },
  });
  const hostile = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error("hostile options");
      },
    },
  );
  const transparent = new Proxy({}, {});
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const options of [accessor, transparent, hostile, revoked.proxy]) {
    await assert.rejects(
      inspectReferenceHostWebShellEvidence(options),
      hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
});

test("rejects oversized injected bytes, proof text, and Proxy callbacks before work starts", async () => {
  await assert.rejects(
    verifyReferenceHostWebShellEvidence({
      artifactBytes: Buffer.alloc(4 * 1024 * 1024 + 1),
    }),
    hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyReferenceHostWebShellEvidence({
      proofDocumentText: "x".repeat(512 * 1024 + 1),
    }),
    hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeReferenceHostWebShellEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
  );
});

test("rejects ambiguous artifact path and injected-byte options", async () => {
  const bytes = await readFile(DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH);
  await assert.rejects(
    verifyReferenceHostWebShellEvidence({
      artifactPath: DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
  );
});

test("atomic writer preserves exact generated bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-reference-host-t07-write-"));
  const artifactPath = path.join(directory, "artifact.json");
  try {
    const written = await writeReferenceHostWebShellEvidence({ artifactPath });
    const bytes = await readFile(artifactPath);
    assert.equal(written.artifactSha256, createDigest(bytes));
    assert.equal(bytes.length, written.artifactBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic writer rejects a symlink destination and temporary-byte tampering", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-reference-host-t07-write-"));
  const target = path.join(directory, "target.json");
  const artifactPath = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, artifactPath);
    await assert.rejects(
      writeReferenceHostWebShellEvidence({ artifactPath }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_ARTIFACT_UNSAFE"),
    );
    await unlink(artifactPath);
    await assert.rejects(
      writeReferenceHostWebShellEvidence({
        artifactPath,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects moved, duplicated, pending, or mismatched proof-document pins", async () => {
  const text = await readFile(DEFAULT_REFERENCE_HOST_WEB_SHELL_PROOF_PATH, "utf8");
  const built = await buildReferenceHostWebShellEvidence();
  const sha = built.artifactSha256;
  assert.equal(verifyReferenceHostWebShellProofDocument(text, sha).result, "PASS");
  for (const changed of [
    text.replace("## Evidence artifact", "## Moved evidence artifact"),
    `${text}\n\`docs/proof/artifacts/reference-host-web-0.1.0-shell.json\`\n`,
    text.replace(sha, "[PENDING_FINAL_ARTIFACT_SHA256]"),
    text.replace(sha, "0".repeat(64)),
  ]) {
    assert.throws(
      () => verifyReferenceHostWebShellProofDocument(changed, sha),
      hasEvidenceCode("REFERENCE_HOST_SHELL_DOCUMENTATION_DRIFT"),
    );
  }
});

test("rejects focused-test registration removal", async () => {
  const workspaceRoot = await copyInspectionWorkspace();
  try {
    await mutateWorkspaceFile(
      workspaceRoot,
      "apps/reference-host-web/test/root-policy.test.ts",
      (text) =>
        text.replace('it("rejects a missing reporter', 'it.skip("rejects a missing reporter'),
    );
    await assert.rejects(
      inspectReferenceHostWebShellEvidence({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_SOURCE_DRIFT"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

function createDigest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
