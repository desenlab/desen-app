import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { format } from "prettier";

import {
  RuntimeReactReconciliationDiagnosticsEvidenceError,
  buildRuntimeReactReconciliationDiagnosticsEvidence,
  verifyRuntimeReactReconciliationDiagnosticsEvidence,
  writeRuntimeReactReconciliationDiagnosticsEvidence,
} from "../scripts/lib/runtime-react-reconciliation-diagnostics-proof.mjs";

const PENDING_SHA256 = "[PENDING_FINAL_ARTIFACT_SHA256]";
const ARTIFACT_FILE_NAME = "runtime-react-0.1.0-reconciliation-diagnostics.json";
const ARTIFACT_RELATIVE_PATH = `docs/proof/artifacts/${ARTIFACT_FILE_NAME}`;
const PROOF_PATH = "docs/proof/RUNTIME-REACT-RECONCILIATION-DIAGNOSTICS.md";
const MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const NORMATIVE_PATH = "docs/proof/NORMATIVE-COVERAGE.md";
const ROOT_TEST_PATH = "tests/runtime-react-reconciliation-diagnostics.test.mjs";
const PREREQUISITES = Object.freeze([
  Object.freeze({
    key: "localStateIdentity",
    path: "docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json",
  }),
  Object.freeze({
    key: "repeatMaterialization",
    path: "docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json",
  }),
  Object.freeze({
    key: "runtimeReactInteractions",
    path: "docs/proof/artifacts/runtime-react-0.1.0-interactions.json",
  }),
]);

function workspaceUrl(relativePath) {
  return new URL(`../${relativePath}`, import.meta.url);
}

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactReconciliationDiagnosticsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function documentationTexts() {
  const [proofDocumentText, proofMatrixText, normativeCoverageText] = await Promise.all([
    readFile(workspaceUrl(PROOF_PATH), "utf8"),
    readFile(workspaceUrl(MATRIX_PATH), "utf8"),
    readFile(workspaceUrl(NORMATIVE_PATH), "utf8"),
  ]);
  return Object.freeze({ proofDocumentText, proofMatrixText, normativeCoverageText });
}

function documentationAtArtifactSha(texts, artifactSha256) {
  return Object.fromEntries(
    Object.entries(texts).map(([key, text]) => {
      const sourceLines = text.split("\n");
      const lines = sourceLines.map((line, index) => {
        const previousLine = index > 0 ? sourceLines[index - 1] : undefined;
        const carriesArtifactPin =
          line.includes(ARTIFACT_FILE_NAME) ||
          previousLine === `\`${ARTIFACT_RELATIVE_PATH}\`` ||
          previousLine === `\`${ARTIFACT_FILE_NAME}\``;
        if (!carriesArtifactPin) return line;
        return line.replace(
          /sha256:(?:[0-9a-f]{64}|\[PENDING_FINAL_ARTIFACT_SHA256\])/gu,
          `sha256:${artifactSha256}`,
        );
      });
      return [key, lines.join("\n")];
    }),
  );
}

function replaceOnce(text, search, replacement) {
  assert.equal(text.includes(search), true, `missing mutation anchor: ${search}`);
  return text.replace(search, replacement);
}

function replaceOccurrence(text, search, replacement, occurrence) {
  let cursor = 0;
  let index = -1;
  for (let current = 0; current <= occurrence; current += 1) {
    index = text.indexOf(search, cursor);
    assert.notEqual(index, -1, `missing mutation occurrence ${occurrence}: ${search}`);
    cursor = index + search.length;
  }
  return `${text.slice(0, index)}${replacement}${text.slice(index + search.length)}`;
}

function replaceRow(markdown, id, transform) {
  const lines = markdown.split("\n");
  const indexes = lines.flatMap((line, index) => (line.startsWith(`| ${id} `) ? [index] : []));
  assert.equal(indexes.length, 1);
  lines[indexes[0]] = transform(lines[indexes[0]]);
  return lines.join("\n");
}

async function trackedOverridesExcept(built, excludedPath) {
  const entries = await Promise.all(
    built.artifact.evidence.trackedFiles
      .filter(({ path: relativePath }) => relativePath !== excludedPath)
      .map(async ({ path: relativePath }) => [
        relativePath,
        await readFile(workspaceUrl(relativePath)),
      ]),
  );
  return Object.fromEntries(entries);
}

async function prerequisiteBytesExcept(excludedKey) {
  const entries = await Promise.all(
    PREREQUISITES.filter(({ key }) => key !== excludedKey).map(
      async ({ key, path: relativePath }) => [key, await readFile(workspaceUrl(relativePath))],
    ),
  );
  return Object.fromEntries(entries);
}

test("builds deterministic, recursively frozen M05-T05 evidence with the reviewed claims", async () => {
  const first = await buildRuntimeReactReconciliationDiagnosticsEvidence();
  const second = await buildRuntimeReactReconciliationDiagnosticsEvidence();

  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(
    first.artifactBytes,
    Buffer.from(
      await format(JSON.stringify(first.artifact), {
        parser: "json",
        endOfLine: "lf",
        printWidth: 100,
        tabWidth: 2,
      }),
      "utf8",
    ),
  );
  assert.equal(first.artifact.task, "M05-T05");
  assert.equal(first.artifact.result, "PASS");
  assert.equal(first.artifact.target, "web-react");
  assert.deepEqual(
    first.artifact.prerequisites.map(({ task }) => task),
    ["M04-T06", "M04-T07", "M05-T04"],
  );
  assert.equal(first.artifact.claim.liveSessionSubscriptionCommitOnly, true);
  assert.equal(first.artifact.claim.realComponentBehaviorAndRepeatReconciliation, true);
  assert.equal(first.artifact.claim.boundedCallbackFreeImmutableDiagnosticIndex, true);
  assert.equal(first.artifact.claim.staleManagedSurfaceRetainedOnFailure, false);
  assert.equal(first.artifact.claim.unknownCapabilityOrRenderFallback, false);
  assert.equal(first.artifact.claim.committedAdapterErrorBoundaryImplemented, false);
  assert.equal(first.artifact.reconciliation.missingAndPresentNullAreDistinct, true);
  assert.equal(first.artifact.liveSurface.subscriptionAdmission, "commit-only");
  assert.equal(
    first.artifact.liveSurface.sessionAndRegistryRootIsolation,
    "nested-weakly-keyed-stable-boundary-component",
  );
  assert.equal(first.artifact.diagnostics.callbackFields, 0);
  assert.equal(first.artifact.diagnostics.recursivelyImmutable, true);
  assert.equal(first.artifact.publicApi.runtimeExports.length, 10);
  assert.equal(first.artifact.publicApi.typeExports.length, 51);
  assert.equal(first.artifact.publicApi.sourceDeclarations, 67);
  assert.equal(first.artifact.publicApi.tsdocDeclarations, 67);
  assert.equal(first.artifact.evidence.tests.packageRegistrations, 53);
  assert.equal(first.artifact.evidence.tests.compilerNegativeCases, 26);
  assert.equal(first.artifact.evidence.tests.rootMutationCases, 35);
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.claim), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles[0]), true);
});

test("rejects byte drift in every exact prerequisite", async () => {
  for (const prerequisite of PREREQUISITES) {
    const bytes = await readFile(workspaceUrl(prerequisite.path));
    const tampered = Buffer.from(bytes);
    tampered[Math.floor(tampered.length / 2)] ^= 1;
    await assert.rejects(
      buildRuntimeReactReconciliationDiagnosticsEvidence({
        prerequisiteBytes: { [prerequisite.key]: tampered },
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_PREREQUISITE_DRIFT"),
    );
  }
});

test("rejects all 35 reviewed source, API, package, test, and nonclaim mutations", async () => {
  const cases = [
    {
      label: "index-runtime-export",
      path: "packages/runtime-react/src/index.ts",
      mutate: (text) => replaceOnce(text, "  buildRuntimeReactDiagnosticIndex,\n", ""),
    },
    {
      label: "index-type-export",
      path: "packages/runtime-react/src/index.ts",
      mutate: (text) => replaceOnce(text, "  RuntimeReactDiagnosticIndex,\n", ""),
    },
    {
      label: "registry-remount-count-limit",
      path: "packages/runtime-react/src/registry.ts",
      mutate: (text) =>
        replaceOnce(text, "maxRemountPropsPerAdapter: 256", "maxRemountPropsPerAdapter: 255"),
    },
    {
      label: "registry-remount-code-unit-limit",
      path: "packages/runtime-react/src/registry.ts",
      mutate: (text) =>
        replaceOnce(
          text,
          "maxRemountPropCodeUnits: 1_048_576",
          "maxRemountPropCodeUnits: 1_048_575",
        ),
    },
    {
      label: "registry-trusted-policy-capture",
      path: "packages/runtime-react/src/registry.ts",
      mutate: (text) => text.replaceAll("captureRemountPolicy(", "captureRemountPolicyDisabled("),
    },
    {
      label: "reconciliation-profile",
      path: "packages/runtime-react/src/reconciliation.ts",
      mutate: (text) =>
        replaceOnce(
          text,
          "desen.runtime-react/reconciliation-key@0.1.0",
          "desen.runtime-react/reconciliation-key@0.1.1",
        ),
    },
    {
      label: "reconciliation-runtime-identity",
      path: "packages/runtime-react/src/reconciliation.ts",
      mutate: (text) =>
        replaceOnce(
          text,
          "runtimeNodeId: runtimeNodeId.value",
          "runtimeNodeId: capabilityId.value",
        ),
    },
    {
      label: "reconciliation-capability-identity",
      path: "packages/runtime-react/src/reconciliation.ts",
      mutate: (text) =>
        replaceOnce(text, "capabilityId: capabilityId.value", "capabilityId: runtimeNodeId.value"),
    },
    {
      label: "reconciliation-missing-presence",
      path: "packages/runtime-react/src/reconciliation.ts",
      mutate: (text) => text.replaceAll('presence: "missing"', 'presence: "absent"'),
    },
    {
      label: "reconciliation-present-presence",
      path: "packages/runtime-react/src/reconciliation.ts",
      mutate: (text) => text.replaceAll('presence: "present"', 'presence: "available"'),
    },
    {
      label: "reconciliation-rfc8785",
      path: "packages/runtime-react/src/reconciliation.ts",
      mutate: (text) => replaceOnce(text, "return canonicalizeJson({", "return JSON.stringify({"),
    },
    {
      label: "renderer-component-reconciliation",
      path: "packages/runtime-react/src/render-plan.tsx",
      mutate: (text) =>
        replaceOccurrence(
          text,
          "reconciliationKey = createRuntimeReactReconciliationKey({",
          "reconciliationKey = disabledReconciliationKey({",
          1,
        ),
    },
    {
      label: "renderer-behavior-reconciliation",
      path: "packages/runtime-react/src/render-plan.tsx",
      mutate: (text) =>
        replaceOccurrence(
          text,
          "reconciliationKey = createRuntimeReactReconciliationKey({",
          "reconciliationKey = disabledReconciliationKey({",
          0,
        ),
    },
    {
      label: "component-react-key",
      path: "packages/runtime-react/src/interactions.tsx",
      mutate: (text) =>
        replaceOccurrence(text, "key: input.reconciliationKey", "key: input.runtimeInstanceId", 0),
    },
    {
      label: "behavior-react-key",
      path: "packages/runtime-react/src/interactions.tsx",
      mutate: (text) =>
        replaceOccurrence(text, "key: input.reconciliationKey", "key: input.runtimeInstanceId", 1),
    },
    {
      label: "renderer-diagnostic-index",
      path: "packages/runtime-react/src/render-plan.tsx",
      mutate: (text) =>
        replaceOnce(
          text,
          "const diagnosticIndex = buildRuntimeReactDiagnosticIndex(",
          "const diagnosticIndex = disabledDiagnosticIndex(",
        ),
    },
    {
      label: "diagnostic-binding-limit",
      path: "packages/runtime-react/src/diagnostic-index.ts",
      mutate: (text) => replaceOnce(text, "maxBindings: 25_000", "maxBindings: 24_999"),
    },
    {
      label: "diagnostic-occurrence-limit",
      path: "packages/runtime-react/src/diagnostic-index.ts",
      mutate: (text) =>
        replaceOnce(text, "maxIdentifierOccurrences: 115_000", "maxIdentifierOccurrences: 114_999"),
    },
    {
      label: "diagnostic-code-unit-limit",
      path: "packages/runtime-react/src/diagnostic-index.ts",
      mutate: (text) =>
        replaceOnce(text, "maxIdentifierCodeUnits: 4_194_304", "maxIdentifierCodeUnits: 4_194_303"),
    },
    {
      label: "diagnostic-null-prototype",
      path: "packages/runtime-react/src/diagnostic-index.ts",
      mutate: (text) =>
        replaceOnce(
          text,
          "const output: Record<string, Value> = Object.create(null)",
          "const output: Record<string, Value> = {}",
        ),
    },
    {
      label: "diagnostic-recursive-immutability",
      path: "packages/runtime-react/src/diagnostic-index.ts",
      mutate: (text) =>
        replaceOnce(
          text,
          "Object.freeze([...values].sort(CODE_UNIT_COMPARATOR))",
          "[...values].sort(CODE_UNIT_COMPARATOR)",
        ),
    },
    {
      label: "session-external-store",
      path: "packages/runtime-react/src/session-surface.tsx",
      mutate: (text) =>
        replaceOnce(text, "return useSyncExternalStore(", "return disabledExternalStore("),
    },
    {
      label: "session-core-read",
      path: "packages/runtime-react/src/session-surface.tsx",
      mutate: (text) =>
        replaceOnce(text, "return readRuntimeHeadlessSession(", "return disabledSessionRead("),
    },
    {
      label: "session-core-subscribe",
      path: "packages/runtime-react/src/session-surface.tsx",
      mutate: (text) =>
        replaceOnce(
          text,
          "result = subscribeRuntimeHeadlessSession(",
          "result = disabledSessionSubscribe(",
        ),
    },
    {
      label: "session-core-unsubscribe",
      path: "packages/runtime-react/src/session-surface.tsx",
      mutate: (text) =>
        replaceOnce(
          text,
          "unsubscribeRuntimeHeadlessSession(subscription)",
          "disabledSessionUnsubscribe(subscription)",
        ),
    },
    {
      label: "live-session-observation",
      path: "packages/runtime-react/src/live-surface.tsx",
      mutate: (text) =>
        replaceOnce(
          text,
          "const observed = useRuntimeReactSessionSurface(",
          "const observed = disabledSessionSurface(",
        ),
    },
    {
      label: "live-render-compilation",
      path: "packages/runtime-react/src/live-surface.tsx",
      mutate: (text) =>
        replaceOnce(
          text,
          "const rendered = renderRuntimeReactSurface({",
          "const rendered = disabledRenderSurface({",
        ),
    },
    {
      label: "session-root-isolation",
      path: "packages/runtime-react/src/render-plan.tsx",
      mutate: (text) =>
        replaceOnce(
          text,
          "const SessionBoundary = sessionRegistryBoundary(",
          "const SessionBoundary = disabledSessionRegistryBoundary(",
        ),
    },
    {
      label: "error-boundary-deferred",
      path: "packages/runtime-react/src/live-surface.tsx",
      mutate: (text) => `${text}\n// componentDidCatch\n`,
    },
    {
      label: "package-production-protocol",
      path: "packages/runtime-react/package.json",
      mutate: (text) =>
        replaceOnce(text, '"@desen/protocol": "workspace:*"', '"@desen/protocol": "workspace:^"'),
    },
    {
      label: "lock-production-protocol",
      path: "pnpm-lock.yaml",
      mutate: (text) => {
        const importerStart = text.indexOf("  packages/runtime-react:");
        assert.notEqual(importerStart, -1);
        return (
          text.slice(0, importerStart) +
          replaceOnce(
            text.slice(importerStart),
            "specifier: workspace:*\n        version: link:../protocol",
            "specifier: workspace:^\n        version: link:../protocol",
          )
        );
      },
    },
    {
      label: "root-script-contract",
      path: "package.json",
      mutate: (text) =>
        replaceOnce(
          text,
          '"verify:runtime-react-reconciliation-diagnostics"',
          '"verify:runtime-react-reconciliation-diagnostics-disabled"',
        ),
    },
    {
      label: "focused-test-inventory",
      path: "packages/runtime-react/test/live-surface.test.tsx",
      mutate: (text) => replaceOnce(text, "  it(", "  it.skip("),
    },
    {
      label: "compiler-negative-inventory",
      path: "packages/runtime-react/test/live-surface.types.ts",
      mutate: (text) => replaceOnce(text, "@ts-expect-error", "expected-error"),
    },
    {
      label: "root-mutation-inventory",
      path: ROOT_TEST_PATH,
      mutate: (text) =>
        text.replaceAll('"root-mutation-inventory"', '"root-mutation-inventory-disabled"'),
    },
  ];

  assert.equal(cases.length, 35);
  for (const mutation of cases) {
    const original = await readFile(workspaceUrl(mutation.path), "utf8");
    const changed = mutation.mutate(original);
    assert.notEqual(changed, original, mutation.label);
    await assert.rejects(
      buildRuntimeReactReconciliationDiagnosticsEvidence({
        fileOverrides: { [mutation.path]: changed },
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT"),
      mutation.label,
    );
  }
});

test("captures strict own-data options without invoking accessors or Proxy traps", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = Object.defineProperty({}, "workspaceRoot", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "/ignored";
    },
  });
  const inherited = Object.create({ workspaceRoot: "/ignored" });
  const symbol = { [Symbol("workspaceRoot")]: "/ignored" };
  const nonEnumerable = Object.defineProperty({}, "workspaceRoot", {
    enumerable: false,
    value: "/ignored",
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();

  for (const options of [accessor, inherited, symbol, nonEnumerable, proxy, revoked.proxy]) {
    await assert.rejects(
      buildRuntimeReactReconciliationDiagnosticsEvidence(options),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects unknown, missing, Proxy, shared, subclassed, and accessor file overrides", async () => {
  class Uint8ArraySubclass extends Uint8Array {}
  let getterCalls = 0;
  const sourcePath = "packages/runtime-react/src/reconciliation.ts";
  const accessorOverrides = Object.defineProperty({}, sourcePath, {
    enumerable: true,
    get() {
      getterCalls += 1;
      return Buffer.alloc(1);
    },
  });
  for (const fileOverrides of [
    { "unknown/path.ts": Buffer.alloc(1) },
    { [sourcePath]: null },
    { [sourcePath]: new Proxy(Buffer.alloc(1), {}) },
    { [sourcePath]: new Uint8Array(new SharedArrayBuffer(1)) },
    { [sourcePath]: new Uint8ArraySubclass(1) },
    accessorOverrides,
  ]) {
    await assert.rejects(
      buildRuntimeReactReconciliationDiagnosticsEvidence({ fileOverrides }),
      (error) => {
        assert.ok(error instanceof RuntimeReactReconciliationDiagnosticsEvidenceError);
        assert.ok(
          [
            "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
            "RECONCILIATION_DIAGNOSTICS_SOURCE_MISSING",
          ].includes(error.code),
        );
        return true;
      },
    );
  }
  assert.equal(getterCalls, 0);
});

test("accepts pending pins only through the explicit test seam and accepts exact final pins", async () => {
  const built = await buildRuntimeReactReconciliationDiagnosticsEvidence();
  const texts = await documentationTexts();
  const pendingTexts = documentationAtArtifactSha(texts, PENDING_SHA256);

  await assert.rejects(
    verifyRuntimeReactReconciliationDiagnosticsEvidence({
      artifactBytes: built.artifactBytes,
      ...pendingTexts,
    }),
    hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT"),
  );
  const pendingResult = await verifyRuntimeReactReconciliationDiagnosticsEvidence({
    artifactBytes: built.artifactBytes,
    ...pendingTexts,
    allowPendingArtifactReference: true,
  });
  assert.equal(pendingResult.documentationPin, "pending-allowed-for-test");

  const finalTexts = documentationAtArtifactSha(texts, built.artifactSha256);
  const finalResult = await verifyRuntimeReactReconciliationDiagnosticsEvidence({
    artifactBytes: built.artifactBytes,
    ...finalTexts,
  });
  assert.equal(finalResult.documentationPin, "final");
  assert.equal(finalResult.artifactSha256, built.artifactSha256);
  assert.equal(finalResult.rootMutationCases, 35);
});

test("rejects moved, duplicated, mismatched, or status-drifted documentation pins", async () => {
  const built = await buildRuntimeReactReconciliationDiagnosticsEvidence();
  const texts = await documentationTexts();
  const finalTexts = documentationAtArtifactSha(texts, built.artifactSha256);
  const variants = [
    {
      ...finalTexts,
      proofDocumentText: finalTexts.proofDocumentText.replace(
        "## Evidence artifact",
        "## Moved evidence artifact",
      ),
    },
    {
      ...finalTexts,
      proofDocumentText: `${finalTexts.proofDocumentText}\nDuplicate ${ARTIFACT_FILE_NAME}\n`,
    },
    {
      ...finalTexts,
      proofMatrixText: replaceRow(finalTexts.proofMatrixText, "P-16", (row) =>
        row.replace("| PARTIAL ", "| PROVEN "),
      ),
    },
    {
      ...finalTexts,
      normativeCoverageText: replaceRow(finalTexts.normativeCoverageText, "N-021", (row) =>
        row.replace("| PLANNED ", "| TESTED  "),
      ),
    },
    {
      ...finalTexts,
      normativeCoverageText: finalTexts.normativeCoverageText.replace(
        built.artifactSha256,
        "0".repeat(64),
      ),
    },
  ];
  for (const variant of variants) {
    await assert.rejects(
      verifyRuntimeReactReconciliationDiagnosticsEvidence({
        artifactBytes: built.artifactBytes,
        ...variant,
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects symlink proof, matrix, normative, artifact, tracked-source, and prerequisite inputs", async () => {
  const built = await buildRuntimeReactReconciliationDiagnosticsEvidence();
  const texts = await documentationTexts();
  const pendingTexts = documentationAtArtifactSha(texts, PENDING_SHA256);
  const finalTexts = documentationAtArtifactSha(texts, built.artifactSha256);
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t05-symlink-"));
  try {
    for (const specification of [
      {
        sourceName: "proof.md",
        bytes: Buffer.from(pendingTexts.proofDocumentText),
        options: {
          proofMatrixText: pendingTexts.proofMatrixText,
          normativeCoverageText: pendingTexts.normativeCoverageText,
          allowPendingArtifactReference: true,
        },
        pathKey: "proofPath",
      },
      {
        sourceName: "matrix.md",
        bytes: Buffer.from(pendingTexts.proofMatrixText),
        options: {
          proofDocumentText: pendingTexts.proofDocumentText,
          normativeCoverageText: pendingTexts.normativeCoverageText,
          allowPendingArtifactReference: true,
        },
        pathKey: "proofMatrixPath",
      },
      {
        sourceName: "normative.md",
        bytes: Buffer.from(pendingTexts.normativeCoverageText),
        options: {
          proofDocumentText: pendingTexts.proofDocumentText,
          proofMatrixText: pendingTexts.proofMatrixText,
          allowPendingArtifactReference: true,
        },
        pathKey: "normativeCoveragePath",
      },
    ]) {
      const target = path.join(directory, `${specification.sourceName}.target`);
      const source = path.join(directory, specification.sourceName);
      await writeFile(target, specification.bytes);
      await symlink(target, source);
      await assert.rejects(
        verifyRuntimeReactReconciliationDiagnosticsEvidence({
          artifactBytes: built.artifactBytes,
          ...specification.options,
          [specification.pathKey]: source,
        }),
        hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_PROOF_UNSAFE"),
      );
    }

    const artifactTarget = path.join(directory, "artifact.target.json");
    const artifactSource = path.join(directory, "artifact.json");
    await writeFile(artifactTarget, built.artifactBytes);
    await symlink(artifactTarget, artifactSource);
    await assert.rejects(
      verifyRuntimeReactReconciliationDiagnosticsEvidence({
        artifactPath: artifactSource,
        ...finalTexts,
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_ARTIFACT_UNSAFE"),
    );

    const trackedPath = "packages/runtime-react/src/reconciliation.ts";
    const trackedTarget = path.join(directory, "tracked.target.ts");
    const trackedSource = path.join(directory, trackedPath);
    await mkdir(path.dirname(trackedSource), { recursive: true });
    await writeFile(trackedTarget, await readFile(workspaceUrl(trackedPath)));
    await symlink(trackedTarget, trackedSource);
    await assert.rejects(
      buildRuntimeReactReconciliationDiagnosticsEvidence({
        workspaceRoot: directory,
        fileOverrides: await trackedOverridesExcept(built, trackedPath),
        prerequisiteBytes: await prerequisiteBytesExcept(undefined),
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_SOURCE_UNSAFE"),
    );

    const prerequisite = PREREQUISITES[0];
    const prerequisiteTarget = path.join(directory, "prerequisite.target.json");
    const prerequisiteSource = path.join(directory, prerequisite.path);
    await mkdir(path.dirname(prerequisiteSource), { recursive: true });
    await writeFile(prerequisiteTarget, await readFile(workspaceUrl(prerequisite.path)));
    await symlink(prerequisiteTarget, prerequisiteSource);
    await assert.rejects(
      buildRuntimeReactReconciliationDiagnosticsEvidence({
        workspaceRoot: directory,
        fileOverrides: await trackedOverridesExcept(built, undefined),
        prerequisiteBytes: await prerequisiteBytesExcept(prerequisite.key),
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_PREREQUISITE_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects artifact-byte drift and hostile verifier inputs", async () => {
  const built = await buildRuntimeReactReconciliationDiagnosticsEvidence();
  const texts = await documentationTexts();
  const finalTexts = documentationAtArtifactSha(texts, built.artifactSha256);
  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyRuntimeReactReconciliationDiagnosticsEvidence({
      artifactBytes: tampered,
      ...finalTexts,
    }),
    hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyRuntimeReactReconciliationDiagnosticsEvidence({
      artifactBytes: built.artifactBytes,
      ...finalTexts,
      unknownOption: true,
    }),
    hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeReactReconciliationDiagnosticsEvidence({
      artifactBytes: new Uint8Array(new SharedArrayBuffer(1)),
      ...finalTexts,
    }),
    hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeReactReconciliationDiagnosticsEvidence({
      proofDocumentText: "x".repeat(500_001),
    }),
    hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID"),
  );
});

test("atomic writer rejects destination and temporary tampering, then writes exact bytes", async () => {
  const built = await buildRuntimeReactReconciliationDiagnosticsEvidence();
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t05-write-"));
  const target = path.join(directory, "target.json");
  const symlinkDestination = path.join(directory, "symlink.json");
  const tamperedDestination = path.join(directory, "tampered.json");
  const exactDestination = path.join(directory, "exact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, symlinkDestination);
    await assert.rejects(
      writeRuntimeReactReconciliationDiagnosticsEvidence({
        artifactPath: symlinkDestination,
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_ARTIFACT_UNSAFE"),
    );

    await assert.rejects(
      writeRuntimeReactReconciliationDiagnosticsEvidence({
        artifactPath: tamperedDestination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_ARTIFACT_UNSAFE"),
    );
    await assert.rejects(readFile(tamperedDestination));

    const written = await writeRuntimeReactReconciliationDiagnosticsEvidence({
      artifactPath: exactDestination,
    });
    assert.equal(written.artifactSha256, built.artifactSha256);
    assert.equal(written.rootMutationCases, 35);
    assert.deepEqual(await readFile(exactDestination), built.artifactBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
