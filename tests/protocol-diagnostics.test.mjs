import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CORE_DIAGNOSTIC_REGISTRY } from "../packages/protocol/src/diagnostics.ts";
import {
  appendJsonPointer,
  createJsonPointer,
  isJsonPointer,
  parseJsonPointer,
} from "../packages/protocol/src/json-pointer.ts";
import {
  ProtocolDiagnosticsEvidenceError,
  buildProtocolDiagnosticsEvidence,
  verifyProtocolDiagnostics,
} from "../scripts/lib/protocol-diagnostics-proof.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolDiagnosticsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts exact deterministic diagnostic and JSON Pointer evidence", async () => {
  const result = await verifyProtocolDiagnostics();

  assert.equal(result.result, "PASS");
  assert.equal(result.coreDiagnosticCodes, 36);
  assert.equal(result.pointerVectors, 14);
  assert.equal(result.publicRuntimeExports.length, 10);
  assert.equal(result.publicTypeExports.length, 10);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent diagnostic evidence builds are byte-identical", async () => {
  const first = await buildProtocolDiagnosticsEvidence();
  const second = await buildProtocolDiagnosticsEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects stale or one-byte-tampered diagnostic evidence", async () => {
  const pristine = await buildProtocolDiagnosticsEvidence();
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyProtocolDiagnostics({ artifactBytes: tampered }),
    hasEvidenceCode("DIAGNOSTIC_ARTIFACT_DRIFT"),
  );
});

test("rejects missing, duplicate, and changed Appendix B registry rows", async () => {
  const missing = CORE_DIAGNOSTIC_REGISTRY.slice(1);
  await assert.rejects(
    buildProtocolDiagnosticsEvidence({ registry: missing, verifySnapshot: false }),
    hasEvidenceCode("DIAGNOSTIC_REGISTRY_COUNT_MISMATCH"),
  );

  const duplicate = [...CORE_DIAGNOSTIC_REGISTRY];
  duplicate[duplicate.length - 1] = CORE_DIAGNOSTIC_REGISTRY[0];
  await assert.rejects(
    buildProtocolDiagnosticsEvidence({ registry: duplicate, verifySnapshot: false }),
    hasEvidenceCode("DIAGNOSTIC_REGISTRY_DUPLICATE_CODE"),
  );

  const changed = CORE_DIAGNOSTIC_REGISTRY.map((definition) => ({ ...definition }));
  changed[8].classification = "runtime";
  await assert.rejects(
    buildProtocolDiagnosticsEvidence({ registry: changed, verifySnapshot: false }),
    hasEvidenceCode("DIAGNOSTIC_REGISTRY_DRIFT"),
  );
});

test("rejects trace-ledger diagnostic and prose ownership drift", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-diagnostic-trace-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  trace.diagnostics[0].registryOwner = "M02-T06";
  const tracePath = path.join(directory, "trace.json");
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`);

  await assert.rejects(
    buildProtocolDiagnosticsEvidence({ tracePath, verifySnapshot: false }),
    hasEvidenceCode("DIAGNOSTIC_TRACE_DRIFT"),
  );

  trace.diagnostics[0].registryOwner = "M02-T05";
  const proseRule = trace.proseRules.find(({ id }) => id === "R-101");
  proseRule.owners = proseRule.owners.filter((owner) => owner !== "M02-T05");
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`);

  await assert.rejects(
    buildProtocolDiagnosticsEvidence({ tracePath, verifySnapshot: false }),
    hasEvidenceCode("DIAGNOSTIC_TRACE_DRIFT"),
  );
});

test("round-trips deterministic RFC 6901 tokens without URI or Unicode normalization", () => {
  const tokens = ["", "a/b", "m~n", "~1", "%2F", "0", "01", "-", "é", "e\u0301", "😀", "\u0000"];
  for (const first of tokens) {
    for (const second of tokens) {
      const pointer = createJsonPointer([first, second]);
      assert.deepEqual(parseJsonPointer(pointer), [first, second]);
      assert.equal(createJsonPointer(parseJsonPointer(pointer)), pointer);
    }
  }

  assert.equal(appendJsonPointer(createJsonPointer(), ""), "/");
  assert.equal(isJsonPointer("/01"), true);
  assert.equal(isJsonPointer("/-"), true);
  assert.equal(isJsonPointer("#/a~1b"), false);
  assert.equal(isJsonPointer("/bad~2escape"), false);
});

test("exposes the exact diagnostic API from the package root without wildcard exports", async () => {
  const requiredRuntime = [
    "CORE_DIAGNOSTIC_REGISTRY",
    "createCoreDiagnostic",
    "getCoreDiagnosticDefinition",
    "isCoreDiagnosticCode",
    "appendJsonPointer",
    "createJsonPointer",
    "escapeJsonPointerToken",
    "isJsonPointer",
    "parseJsonPointer",
    "unescapeJsonPointerToken",
  ];
  const requiredTypes = [
    "CoreDiagnosticClassification",
    "CoreDiagnosticCode",
    "CoreDiagnosticDefinition",
    "CreateCoreDiagnosticInput",
    "DesenCoreDiagnostic",
    "DesenDiagnostic",
    "DesenDiagnosticContext",
    "DesenDiagnosticSubject",
    "JsonPointer",
    "JsonPointerSegment",
  ];

  const indexSource = await readFile(
    new URL("../packages/protocol/src/index.ts", import.meta.url),
    "utf8",
  );
  const runtimeExports = new Set(
    [...indexSource.matchAll(/export\s*\{([\s\S]*?)\}\s*from\s*"[^"]+";/gu)].flatMap(([, names]) =>
      names
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== "" && !name.startsWith("type ")),
    ),
  );
  const typeExports = new Set(
    [...indexSource.matchAll(/export\s+type\s*\{([\s\S]*?)\}\s*from\s*"[^"]+";/gu)].flatMap(
      ([, names]) =>
        names
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name !== ""),
    ),
  );
  for (const exportName of requiredRuntime) {
    assert.equal(runtimeExports.has(exportName), true, exportName);
  }
  for (const exportName of requiredTypes) {
    assert.equal(typeExports.has(exportName), true, exportName);
  }
  assert.doesNotMatch(indexSource, /export\s+\*/u);
});

test("keeps diagnostic production code platform-neutral and free of executable hooks", async () => {
  const sources = await Promise.all(
    ["diagnostics.ts", "json-pointer.ts"].map((file) =>
      readFile(new URL(`../packages/protocol/src/${file}`, import.meta.url), "utf8"),
    ),
  );
  const productionSource = sources.join("\n");

  assert.doesNotMatch(productionSource, /from\s+["']node:/u);
  assert.doesNotMatch(productionSource, /from\s+["'](?:react|react-dom)(?:["'/])/u);
  assert.doesNotMatch(productionSource, /\b(?:Buffer|window|document|fetch|React)\s*(?:\.|\(|\[)/u);
  assert.doesNotMatch(productionSource, /\b(?:eval|Function)\s*\(/u);
});
