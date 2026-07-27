import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ProtocolInteractionContractsEvidenceError,
  buildProtocolInteractionContractsEvidence,
  verifyProtocolInteractionContracts,
  writeProtocolInteractionContractsEvidence,
} from "../scripts/lib/protocol-interaction-contracts-proof.mjs";

const VALID_SOURCE = JSON.parse(
  await readFile(
    new URL(
      "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolInteractionContractsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts exact deterministic M02-T09 interaction-contract evidence", async () => {
  const result = await verifyProtocolInteractionContracts();

  assert.equal(result.result, "PASS");
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.schemaFamilies, 7);
  assert.equal(result.schemaConstraints, 246);
  assert.equal(result.ownedCoreDiagnostics, 5);
  assert.equal(result.reusedCoreDiagnostics, 5);
  assert.equal(result.officialT09Invalid, 1);
  assert.equal(result.payloadSafetyGoldens, 10);
  assert.equal(result.scopeFenceAccepted, 4);
  assert.equal(result.examples, 5);
  assert.equal(
    result.artifactSha256,
    "981e1d59dd68e32639055b1267880cc1e6ebb3a76ad1176298990b28fe048208",
  );
});

test("default evidence writer preserves immutable task-time M02-T09 bytes", async () => {
  const artifactPath = new URL(
    "../docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json",
    import.meta.url,
  );
  const before = await readFile(artifactPath);
  const result = await writeProtocolInteractionContractsEvidence();
  const after = await readFile(artifactPath);

  assert.deepEqual(after, before);
  assert.deepEqual(result.artifactBytes, before);
});

test("two independent interaction evidence builds are byte-identical", async () => {
  const first = await buildProtocolInteractionContractsEvidence();
  const second = await buildProtocolInteractionContractsEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects a current rebuild and one-byte-tampered historical interaction evidence", async () => {
  const current = await buildProtocolInteractionContractsEvidence();
  await assert.rejects(
    verifyProtocolInteractionContracts({ artifactBytes: current.artifactBytes }),
    hasEvidenceCode("INTERACTION_ARTIFACT_DRIFT"),
  );

  const historical = await readFile(
    new URL("../docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json", import.meta.url),
  );
  const tampered = Buffer.from(historical);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyProtocolInteractionContracts({ artifactBytes: tampered }),
    hasEvidenceCode("INTERACTION_ARTIFACT_DRIFT"),
  );
});

test("rejects T09 trace, BCP 14, finding, and payload-limit source drift", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-interaction-review-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  trace.schemaFamilies.find(({ id }) => id === "SC-030").expectedConstraints = 6;
  const tracePath = path.join(directory, "trace.json");
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`);
  await assert.rejects(
    buildProtocolInteractionContractsEvidence({ tracePath, verifySnapshot: false }),
    hasEvidenceCode("INTERACTION_TRACE_DRIFT"),
  );

  const normative = await readFile(
    new URL("../docs/proof/NORMATIVE-COVERAGE.md", import.meta.url),
    "utf8",
  );
  const changedNormative = normative.replace(
    /^(\| N-033 \|.*?\| )TESTED(\s+\|)/mu,
    "$1NOT_STARTED$2",
  );
  assert.notEqual(changedNormative, normative);
  const normativePath = path.join(directory, "normative.md");
  await writeFile(normativePath, changedNormative);
  await assert.rejects(
    buildProtocolInteractionContractsEvidence({
      normativeCoveragePath: normativePath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("INTERACTION_NORMATIVE_DRIFT"),
  );

  const findings = await readFile(
    new URL("../docs/plan/PROTOCOL-FINDINGS.md", import.meta.url),
    "utf8",
  );
  const changedFindings = findings.replace(
    "each behavior contract lists the other's exact",
    "either behavior contract lists the other's exact",
  );
  assert.notEqual(changedFindings, findings);
  const findingsPath = path.join(directory, "findings.md");
  await writeFile(findingsPath, changedFindings);
  await assert.rejects(
    buildProtocolInteractionContractsEvidence({ findingsPath, verifySnapshot: false }),
    hasEvidenceCode("INTERACTION_FINDING_DRIFT"),
  );

  const source = await readFile(
    new URL("../packages/validator/src/interaction-contract-validation.ts", import.meta.url),
    "utf8",
  );
  const changedSource = source.replace("maxDepth: 128,", "maxDepth: 129,");
  assert.notEqual(changedSource, source);
  const interactionSourcePath = path.join(directory, "interaction-contract-validation.ts");
  await writeFile(interactionSourcePath, changedSource);
  await assert.rejects(
    buildProtocolInteractionContractsEvidence({
      interactionSourcePath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("INTERACTION_SOURCE_PROFILE_DRIFT"),
  );
});

test("rejects a one-field-tampered M02-T08 prerequisite artifact", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-interaction-prerequisite-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifact = JSON.parse(
    await readFile(
      new URL("../docs/proof/artifacts/protocol-0.1.0-component-contracts.json", import.meta.url),
      "utf8",
    ),
  );
  artifact.result = "FAIL";
  const componentArtifactPath = path.join(directory, "component-contracts.json");
  await writeFile(componentArtifactPath, `${JSON.stringify(artifact)}\n`);

  await assert.rejects(
    buildProtocolInteractionContractsEvidence({
      componentArtifactPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("INTERACTION_PREREQUISITE_DRIFT"),
  );
});

test("rejects public API mutations that admit unknown events or invalid resolved payloads", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const failureValueApi = {
    ...api,
    validateDesenSourceInteractionContracts(input, catalogSet) {
      const result = api.validateDesenSourceInteractionContracts(input, catalogSet);
      if (result.valid) return result;
      return Object.freeze({ ...result, value: Object.freeze({}) });
    },
  };
  await assert.rejects(
    buildProtocolInteractionContractsEvidence({
      validatorApi: failureValueApi,
      verifySnapshot: false,
    }),
    hasEvidenceCode("INTERACTION_PUBLIC_API_WEAKENED"),
  );

  const weakenedDocumentApi = {
    ...api,
    validateDesenSourceInteractionContracts(input, catalogSet) {
      const result = api.validateDesenSourceInteractionContracts(input, catalogSet);
      if (result.diagnostics?.some(({ code }) => code === "UNKNOWN_EVENT")) {
        const replacement = api.validateDesenSourceInteractionContracts(VALID_SOURCE, catalogSet);
        return replacement;
      }
      return result;
    },
  };
  await assert.rejects(
    buildProtocolInteractionContractsEvidence({
      validatorApi: weakenedDocumentApi,
      verifySnapshot: false,
    }),
    hasEvidenceCode("INTERACTION_PUBLIC_API_WEAKENED"),
  );

  const weakenedPayloadApi = {
    ...api,
    validateDesenEventPayload(payload, selector, catalogSet) {
      const result = api.validateDesenEventPayload(payload, selector, catalogSet);
      if (
        result.valid ||
        !result.diagnostics.some(({ code }) => code === "EVENT_PAYLOAD_INVALID")
      ) {
        return result;
      }
      return Object.freeze({
        valid: true,
        target: "event-payload",
        value: Object.freeze({}),
        diagnostics: Object.freeze([]),
      });
    },
  };
  await assert.rejects(
    buildProtocolInteractionContractsEvidence({
      validatorApi: weakenedPayloadApi,
      verifySnapshot: false,
    }),
    hasEvidenceCode("INTERACTION_PUBLIC_API_WEAKENED"),
  );
});

test("records exact official, safety, scope, inventory, and non-claim evidence", async () => {
  const { artifact } = await buildProtocolInteractionContractsEvidence();

  assert.deepEqual(artifact.traceability.schemaFamilies, [
    { id: "SC-030", expectedConstraints: 5 },
    { id: "SC-044", expectedConstraints: 54 },
    { id: "SC-046", expectedConstraints: 70 },
    { id: "SC-053", expectedConstraints: 7 },
    { id: "SC-054", expectedConstraints: 7 },
    { id: "SC-057", expectedConstraints: 39 },
    { id: "SC-058", expectedConstraints: 64 },
  ]);
  assert.deepEqual(artifact.traceability.mandatoryClauses, [
    { id: "N-033", status: "PLANNED" },
    { id: "N-034", status: "PLANNED" },
  ]);
  assert.deepEqual(artifact.frozenValidation.officialT09Invalid, [
    {
      file: "invalid/source-unknown-event.json",
      target: "source",
      diagnostics: [
        {
          code: "UNKNOWN_EVENT",
          pointer: "/surfaces/home/root/slots/default/0/on/teleport",
        },
      ],
    },
  ]);
  assert.deepEqual(artifact.payloadSafety.limits, {
    maxDepth: 128,
    maxJsonNodes: 4_096,
    maxStringCodeUnits: 1_048_576,
  });
  const sharedContainerDag = artifact.payloadSafety.rejected.find(
    ({ id }) => id === "shared-container-dag-before-canonicalization",
  );
  assert.deepEqual(sharedContainerDag.diagnostics, [
    { code: "EVENT_PAYLOAD_INVALID", pointer: "" },
  ]);
  assert.ok(sharedContainerDag.ownKeyInspections > 0);
  assert.ok(sharedContainerDag.ownKeyInspections < artifact.payloadSafety.limits.maxJsonNodes);
  assert.equal(sharedContainerDag.traversalBound, artifact.payloadSafety.limits.maxJsonNodes);
  assert.equal(artifact.security.preCanonicalExpansionBound, true);
  assert.equal(artifact.security.queuedChildReservation, true);
  assert.deepEqual(
    artifact.payloadSafety.accepted.map(({ id }) => id),
    [
      "maximum-depth",
      "maximum-json-nodes",
      "maximum-string-code-units",
      "maximum-json-object-nodes",
    ],
  );
  const nestedWide = artifact.payloadSafety.rejected.find(
    ({ id }) => id === "nested-wide-frontier-reservation",
  );
  assert.deepEqual(nestedWide.diagnostics, [{ code: "EVENT_PAYLOAD_INVALID", pointer: "" }]);
  assert.ok(nestedWide.descriptorInspections > 0);
  assert.ok(nestedWide.descriptorInspections < nestedWide.inspectionBound);
  assert.deepEqual(
    artifact.behaviorContracts.styles.map(({ id }) => id),
    ["mismatch", "dynamic", "unknown-state", "unknown-part", "inherited-part"],
  );
  assert.deepEqual(
    artifact.behaviorContracts.slots.map(({ id }) => id),
    [
      "unknown",
      "inherited",
      "required",
      "minimum",
      "maximum",
      "rejected-child",
      "impossible-range",
    ],
  );
  assert.deepEqual(artifact.behaviorIdentity, {
    id: "node-behavior-id-collision",
    proseRule: "R-069",
    diagnostics: [
      {
        code: "DUPLICATE_NODE_ID",
        pointer: "/surfaces/main/root/behaviors/0/id",
      },
    ],
  });
  assert.deepEqual(
    artifact.events.map(({ id }) => id),
    [
      "component-case-sensitive",
      "component-inherited-name",
      "behavior-unknown",
      "behavior-inherited-name",
      "component-inherited-map-document",
      "component-inherited-map-payload",
    ],
  );
  assert.deepEqual(
    artifact.commands.map(({ id }) => id),
    [
      "known-target-declared",
      "known-target-unknown",
      "known-target-inherited-name",
      "known-target-inherited-map",
    ],
  );
  assert.deepEqual(
    artifact.schemaSafetyGoldens.rejected.slice(1).map(({ id }) => id),
    [
      "component-event",
      "component-command",
      "behavior-props",
      "behavior-event",
      "behavior-command",
      "behavior-style",
    ],
  );
  assert.deepEqual(
    artifact.conflicts.map(({ id }) => id),
    [
      "disjoint",
      "shared",
      "unilateral",
      "mutual",
      "self-unlisted",
      "self-listed",
      "three-node-missing-edge",
    ],
  );
  assert.deepEqual(
    artifact.laterTaskScopeAccepted.map(({ owner }) => owner),
    ["M02-T10", "M02-T11", "M02-T11", "M02-T11"],
  );
  assert.equal(
    artifact.prerequisite.componentContracts.verifiedBy,
    "verifyProtocolComponentContracts",
  );
  assert.equal(artifact.security.platformAudit.runtimeSchemaCompilation, false);
  assert.equal(artifact.security.platformAudit.documentCodeExecution, false);
  for (const inventory of Object.values(artifact.security.platformAudit.packages)) {
    assert.equal(inventory.distributionFiles.length, inventory.sourceFiles.length * 4);
  }
  assert.ok(artifact.implementation.trackedFiles.length > 40);
  assert.ok(
    artifact.implementation.trackedFiles.every(({ sha256 }) => /^[0-9a-f]{64}$/u.test(sha256)),
  );
  assert.ok(artifact.limitations.some((line) => line.includes("N-033 and N-034 remain PLANNED")));
});

test("built distribution exposes the exact interaction-contract runtime API", async () => {
  const api = await import("../packages/validator/dist/index.js");
  for (const exportName of [
    "validateDesenBundleInteractionContracts",
    "validateDesenEventPayload",
    "validateDesenInteractionCatalogSet",
    "validateDesenInteractionContracts",
    "validateDesenSourceInteractionContracts",
  ]) {
    assert.equal(typeof api[exportName], "function", exportName);
  }
  assert.equal(
    api.INVALID_INTERACTION_CONTRACT_CODE,
    "run.desen.validator/INVALID_INTERACTION_CONTRACT",
  );
  assert.deepEqual(api.EVENT_PAYLOAD_SAFETY_LIMITS, {
    maxDepth: 128,
    maxJsonNodes: 4_096,
    maxStringCodeUnits: 1_048_576,
  });
});

test("evidence writer rejects a symlink destination before building", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-interaction-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const realTarget = path.join(directory, "real.json");
  const linkedTarget = path.join(directory, "linked.json");
  await writeFile(realTarget, "unchanged\n");
  await symlink(realTarget, linkedTarget);

  await assert.rejects(
    writeProtocolInteractionContractsEvidence({ artifactPath: linkedTarget }),
    hasEvidenceCode("INTERACTION_ARTIFACT_UNSUPPORTED_ENTRY"),
  );
  assert.equal(await readFile(realTarget, "utf8"), "unchanged\n");

  const realParent = path.join(directory, "real-parent");
  const linkedParent = path.join(directory, "linked-parent");
  await mkdir(realParent);
  await symlink(realParent, linkedParent);
  await assert.rejects(
    writeProtocolInteractionContractsEvidence({
      artifactPath: path.join(linkedParent, "artifact.json"),
    }),
    hasEvidenceCode("INTERACTION_ARTIFACT_UNSUPPORTED_ENTRY"),
  );
});

test("evidence writer atomically commits and cleans a failed temporary", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-interaction-atomic-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "interaction-contracts.json");
  await writeFile(artifactPath, "previous complete artifact\n");

  let successfulTemporaryPath;
  let successfulTemporaryBytes;
  const result = await writeProtocolInteractionContractsEvidence({
    artifactPath,
    beforeAtomicRename: async ({ artifactPath: target, temporaryPath }) => {
      successfulTemporaryPath = temporaryPath;
      assert.equal(path.dirname(temporaryPath), path.dirname(target));
      assert.equal(await readFile(target, "utf8"), "previous complete artifact\n");
      successfulTemporaryBytes = await readFile(temporaryPath);
    },
  });
  assert.deepEqual(successfulTemporaryBytes, result.artifactBytes);
  assert.deepEqual(await readFile(artifactPath), result.artifactBytes);
  assert.ok(!(await readdir(directory)).includes(path.basename(successfulTemporaryPath)));

  await writeFile(artifactPath, "still complete\n");
  let failedTemporaryPath;
  await assert.rejects(
    writeProtocolInteractionContractsEvidence({
      artifactPath,
      beforeAtomicRename: ({ temporaryPath }) => {
        failedTemporaryPath = temporaryPath;
        throw new Error("injected pre-rename failure");
      },
    }),
    /injected pre-rename failure/u,
  );
  assert.equal(await readFile(artifactPath, "utf8"), "still complete\n");
  assert.ok(!(await readdir(directory)).includes(path.basename(failedTemporaryPath)));
});
