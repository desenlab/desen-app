import { createDesenEditorContinuousValidator } from "@desen/editor-core";
import { describe, expect, it } from "vitest";

import { REFERENCE_AUTHORING_MODEL } from "../src/authoring-data.js";
import { projectAuthoringDiagnostics } from "../src/authoring-diagnostics.js";

import type { DesenEditorContinuousValidationReport } from "@desen/editor-core";
import type {
  RuntimeReactDiagnosticIndex,
  RuntimeReactDiagnosticIndexEntry,
} from "@desen/runtime-react";
import type {
  AuthoringDiagnosticsSnapshotIdentity,
  AuthoringRenderedDiagnosticsSnapshot,
} from "../src/authoring-diagnostics.js";

const DOCUMENT_FINGERPRINT = `sha256:${"1".repeat(64)}`;
const CATALOG_SET_FINGERPRINT = `sha256:${"2".repeat(64)}`;
const OTHER_DOCUMENT_FINGERPRINT = `sha256:${"3".repeat(64)}`;
const OTHER_CATALOG_SET_FINGERPRINT = `sha256:${"4".repeat(64)}`;

function deepFreeze<Value>(value: Value, seen = new Set<object>()): Value {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) deepFreeze(descriptor.value, seen);
  }
  return Object.freeze(value);
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectDeepFrozen(descriptor.value, seen);
    }
  }
}

function containsFunction(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null || seen.has(value)) return false;
  seen.add(value);
  return Reflect.ownKeys(value).some((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor
      ? containsFunction(descriptor.value, seen)
      : false;
  });
}

function snapshot(
  documentFingerprint = DOCUMENT_FINGERPRINT,
  catalogSetFingerprint = CATALOG_SET_FINGERPRINT,
): AuthoringDiagnosticsSnapshotIdentity {
  return Object.freeze({
    projectId: "account-app",
    surfaceId: "sign-in",
    documentFingerprint,
    catalogSetFingerprint,
  });
}

function syntheticReport(
  value: Readonly<{
    valid?: boolean;
    documentFingerprint?: string | null;
    catalogSetFingerprint?: string;
    diagnostics?: readonly unknown[];
    obligations?: readonly unknown[];
    invalidSubjects?: readonly unknown[];
    unmappedDiagnosticIndexes?: readonly number[];
  }> = {},
): DesenEditorContinuousValidationReport {
  return deepFreeze({
    valid: value.valid ?? false,
    documentFingerprint: value.documentFingerprint ?? DOCUMENT_FINGERPRINT,
    catalogSetFingerprint: value.catalogSetFingerprint ?? CATALOG_SET_FINGERPRINT,
    diagnostics: value.diagnostics ?? [],
    obligations: value.obligations ?? [],
    invalidSubjects: value.invalidSubjects ?? [],
    unmappedDiagnosticIndexes: value.unmappedDiagnosticIndexes ?? [],
  }) as unknown as DesenEditorContinuousValidationReport;
}

function diagnostic(
  code: string,
  pointer: string,
  surfaceId?: string,
  subject?: Readonly<{ readonly kind: "node" | "behavior"; readonly id: string }>,
  message = `${code} at ${pointer}`,
): unknown {
  return {
    code,
    message,
    pointer,
    ...(surfaceId === undefined
      ? {}
      : {
          context: {
            documentId: "com.example.account-app",
            surfaceId,
            ...(subject === undefined ? {} : { subject }),
          },
        }),
  };
}

function mapping(
  diagnosticIndexes: readonly number[],
  occurrencePointers: readonly string[],
  surfaceId: string,
  subject: Readonly<{ readonly kind: "node" | "behavior"; readonly id: string }>,
): unknown {
  return { diagnosticIndexes, occurrencePointers, surfaceId, subject };
}

function frozenLookup<Value>(
  entries: readonly (readonly [string, Value])[],
): Readonly<Record<string, Value>> {
  const output: Record<string, Value> = Object.create(null) as Record<string, Value>;
  for (const [key, value] of entries) output[key] = value;
  return Object.freeze(output);
}

function diagnosticIndex(
  entries: readonly RuntimeReactDiagnosticIndexEntry[],
  sourceBuckets: readonly (readonly [string, readonly string[]])[],
  behaviorBuckets: readonly (readonly [string, readonly string[]])[] = [],
): RuntimeReactDiagnosticIndex {
  return Object.freeze({
    byRuntimeNodeId: frozenLookup(
      entries.map((entry) => [entry.runtimeNodeId, Object.freeze(entry)] as const),
    ),
    runtimeNodeIdsBySourceNodeId: frozenLookup(
      sourceBuckets.map(([key, values]) => [key, Object.freeze([...values])] as const),
    ),
    runtimeNodeIdsByBehaviorId: frozenLookup(
      behaviorBuckets.map(([key, values]) => [key, Object.freeze([...values])] as const),
    ),
  });
}

function rendered(
  index: RuntimeReactDiagnosticIndex,
  projectId = "account-app",
  surfaceId = "sign-in",
): AuthoringRenderedDiagnosticsSnapshot {
  return Object.freeze({ projectId, surfaceId, diagnosticIndex: index });
}

describe("Desen App authoring diagnostics projection", () => {
  it("projects a real immutable report and exposes obligations only as inert visible metadata", () => {
    const creation = createDesenEditorContinuousValidator(
      REFERENCE_AUTHORING_MODEL.validationCatalogs,
    );
    expect(creation.ok).toBe(true);
    if (!creation.ok) throw new Error("Expected the reference continuous validator.");
    const report = creation.validator.validate(REFERENCE_AUTHORING_MODEL.validationDocument);
    const result = projectAuthoringDiagnostics(report, {
      projectId: "account-app",
      surfaceId: "sign-in",
      documentFingerprint: report.documentFingerprint as string,
      catalogSetFingerprint: report.catalogSetFingerprint,
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error(`Unexpected rejection: ${result.reason}`);
    expect(result.model.valid).toBe(true);
    expect(result.model.diagnostics).toEqual([]);
    expect(result.model.obligations.length).toBeGreaterThan(0);
    expect(Object.keys(result.model.obligations[0] ?? {}).sort()).toEqual([
      "context",
      "index",
      "kind",
      "pointer",
    ]);
    expect(containsFunction(result)).toBe(false);
    expectDeepFrozen(result);
  });

  it("creates links only from invalidSubjects and leaves code/message/pointer guesses visible but inert", () => {
    const explicitSubject = Object.freeze({ kind: "node" as const, id: "sign-in.email" });
    const report = syntheticReport({
      diagnostics: [
        diagnostic(
          "UNKNOWN_CAPABILITY",
          "/surfaces/sign-in/root/slots/default/1/use",
          "sign-in",
          explicitSubject,
        ),
        diagnostic(
          "UNKNOWN_CAPABILITY",
          "/surfaces/sign-in/root/slots/default/2/sign-in.password",
          undefined,
          undefined,
          "The sign-in.password node is invalid.",
        ),
      ],
      invalidSubjects: [
        mapping([0], ["/surfaces/sign-in/root/slots/default/1"], "sign-in", explicitSubject),
      ],
      unmappedDiagnosticIndexes: [1],
    });
    const result = projectAuthoringDiagnostics(report, snapshot());

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error(`Unexpected rejection: ${result.reason}`);
    expect(result.model.diagnostics.map(({ index }) => index)).toEqual([0, 1]);
    expect(result.model.diagnostics[0]).toMatchObject({
      linkStatus: "linked",
      occurrences: [
        {
          diagnosticIndex: 0,
          kind: "node",
          subjectId: "sign-in.email",
          occurrencePointer: "/surfaces/sign-in/root/slots/default/1",
          previewStatus: "invalid-placeholder",
          runtimeNodeIds: [],
        },
      ],
    });
    expect(result.model.diagnostics[0]?.occurrences[0]?.selectionKey).toContain(
      DOCUMENT_FINGERPRINT,
    );
    expect(result.model.diagnostics[1]).toMatchObject({
      code: "UNKNOWN_CAPABILITY",
      linkStatus: "unmapped",
      occurrences: [],
    });
  });

  it("preserves every duplicate occurrence without guessing which runtime instance belongs to it", () => {
    const subject = Object.freeze({ kind: "node" as const, id: "duplicate" });
    const report = syntheticReport({
      diagnostics: [diagnostic("DUPLICATE_NODE_ID", "/duplicate", "sign-in", subject)],
      invalidSubjects: [mapping([0], ["/first", "/second"], "sign-in", subject)],
    });
    const index = diagnosticIndex(
      [
        {
          kind: "component",
          runtimeNodeId: "duplicate#0",
          sourceNodeId: "duplicate",
          capabilityId: "com.example.ui/Text",
        },
      ],
      [["duplicate", ["duplicate#0"]]],
    );
    const result = projectAuthoringDiagnostics(report, snapshot(), rendered(index));

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error(`Unexpected rejection: ${result.reason}`);
    const occurrences = result.model.diagnostics[0]?.occurrences ?? [];
    expect(occurrences.map(({ occurrencePointer }) => occurrencePointer)).toEqual([
      "/first",
      "/second",
    ]);
    expect(occurrences.map(({ previewStatus }) => previewStatus)).toEqual([
      "invalid-placeholder",
      "invalid-placeholder",
    ]);
    expect(occurrences.every(({ runtimeNodeIds }) => runtimeNodeIds.length === 0)).toBe(true);
    expect(new Set(occurrences.map(({ selectionKey }) => selectionKey)).size).toBe(2);
  });

  it("keeps equal-text node and behavior subjects separate while retaining repeated runtime instances", () => {
    const node = Object.freeze({ kind: "node" as const, id: "shared" });
    const behavior = Object.freeze({ kind: "behavior" as const, id: "shared" });
    const report = syntheticReport({
      diagnostics: [
        diagnostic("UNKNOWN_CAPABILITY", "/node", "sign-in", node),
        diagnostic("BEHAVIOR_ATTACHMENT_INVALID", "/behavior", "sign-in", behavior),
      ],
      invalidSubjects: [
        mapping([0], ["/node-owner"], "sign-in", node),
        mapping([1], ["/node-owner/behaviors/0"], "sign-in", behavior),
      ],
    });
    const index = diagnosticIndex(
      [
        {
          kind: "component",
          runtimeNodeId: "shared#0",
          sourceNodeId: "shared",
          capabilityId: "com.example.ui/Stack",
        },
        {
          kind: "component",
          runtimeNodeId: "shared#1",
          sourceNodeId: "shared",
          capabilityId: "com.example.ui/Stack",
        },
        {
          kind: "behavior",
          runtimeNodeId: "shared:behavior#0",
          sourceNodeId: "shared",
          capabilityId: "com.example.interactions/Sortable",
          behaviorId: "shared",
          ownerRuntimeNodeId: "shared#0",
        },
      ],
      [["shared", ["shared#0", "shared#1", "shared:behavior#0"]]],
      [["shared", ["shared:behavior#0"]]],
    );
    const result = projectAuthoringDiagnostics(report, snapshot(), rendered(index));

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error(`Unexpected rejection: ${result.reason}`);
    expect(result.model.diagnostics[0]?.occurrences[0]).toMatchObject({
      kind: "node",
      previewStatus: "materialized",
      runtimeNodeIds: ["shared#0", "shared#1"],
    });
    expect(result.model.diagnostics[1]?.occurrences[0]).toMatchObject({
      kind: "behavior",
      previewStatus: "materialized",
      runtimeNodeIds: ["shared:behavior#0"],
    });
  });

  it("keeps explicitly mapped diagnostics outside the current route visible but non-linkable", () => {
    const subject = Object.freeze({ kind: "node" as const, id: "profile.title" });
    const report = syntheticReport({
      diagnostics: [diagnostic("UNKNOWN_PROP", "/profile", "profile", subject)],
      invalidSubjects: [mapping([0], ["/surfaces/profile/root"], "profile", subject)],
    });
    const result = projectAuthoringDiagnostics(report, snapshot());

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error(`Unexpected rejection: ${result.reason}`);
    expect(result.model.diagnostics).toEqual([
      expect.objectContaining({ linkStatus: "outside-route", occurrences: [] }),
    ]);
  });

  it("rejects stale report or rendered route authority and inconsistent runtime kinds without a partial model", () => {
    const emptyReport = syntheticReport();
    expect(
      projectAuthoringDiagnostics(
        emptyReport,
        snapshot(OTHER_DOCUMENT_FINGERPRINT, CATALOG_SET_FINGERPRINT),
      ),
    ).toEqual({ status: "rejected", reason: "stale-validation-report" });
    expect(
      projectAuthoringDiagnostics(
        emptyReport,
        snapshot(DOCUMENT_FINGERPRINT, OTHER_CATALOG_SET_FINGERPRINT),
      ),
    ).toEqual({ status: "rejected", reason: "stale-validation-report" });
    expect(
      projectAuthoringDiagnostics(
        emptyReport,
        snapshot(),
        rendered(diagnosticIndex([], []), "account-app", "profile"),
      ),
    ).toEqual({ status: "rejected", reason: "stale-rendered-snapshot" });

    const behavior = Object.freeze({ kind: "behavior" as const, id: "shared" });
    const behaviorReport = syntheticReport({
      diagnostics: [diagnostic("BEHAVIOR_CONFLICT", "/behavior", "sign-in", behavior)],
      invalidSubjects: [mapping([0], ["/behavior"], "sign-in", behavior)],
    });
    const wrongKind = diagnosticIndex(
      [
        {
          kind: "component",
          runtimeNodeId: "shared#0",
          sourceNodeId: "shared",
          capabilityId: "com.example.ui/Text",
        },
      ],
      [["shared", ["shared#0"]]],
      [["shared", ["shared#0"]]],
    );
    expect(projectAuthoringDiagnostics(behaviorReport, snapshot(), rendered(wrongKind))).toEqual({
      status: "rejected",
      reason: "runtime-index-mismatch",
    });
  });

  it("copies obligation metadata through a closed shape and never retains executable extras", () => {
    const report = syntheticReport({
      valid: true,
      obligations: [
        {
          kind: "state-write",
          pointer: "/surfaces/sign-in/state/submitted",
          context: {
            documentId: "com.example.account-app",
            surfaceId: "sign-in",
            subject: { kind: "node", id: "sign-in.submit" },
            capabilityId: "com.example.ui/Button",
          },
          execute: () => {
            throw new Error("must never be retained");
          },
        },
      ],
    });
    const result = projectAuthoringDiagnostics(report, snapshot());

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error(`Unexpected rejection: ${result.reason}`);
    expect(result.model.obligations).toEqual([
      {
        index: 0,
        kind: "state-write",
        pointer: "/surfaces/sign-in/state/submitted",
        context: {
          documentId: "com.example.account-app",
          surfaceId: "sign-in",
          subject: { kind: "node", id: "sign-in.submit" },
          capabilityId: "com.example.ui/Button",
        },
      },
    ]);
    expect(containsFunction(result.model.obligations)).toBe(false);
    expect(Object.hasOwn(result.model.obligations[0] ?? {}, "execute")).toBe(false);
  });
});
