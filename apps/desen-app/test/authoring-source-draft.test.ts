import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import { reviewAuthoringSourceDraft } from "../src/authoring-source-draft.js";
import { projectAuthoringDiagnostics } from "../src/authoring-diagnostics.js";
import {
  REFERENCE_AUTHORING_WORKSPACE_PROFILE,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/reference-authoring-profile.js";

import type { ProjectWorkspaceProfileHandle } from "../src/project-workspace-profile.js";

const route = Object.freeze({ projectId: "account-app", surfaceId: "sign-in" });
const baseline = digestCanonicalJson(REFERENCE_EDITOR_DOCUMENT);
interface MutableNode {
  id: string;
  props: Record<string, unknown>;
  on?: Record<string, unknown>;
  slots?: Record<string, MutableNode[]>;
}
interface MutableSource {
  id: string;
  catalogs: unknown[];
  entry: string;
  surfaces: Record<string, { root: MutableNode }>;
}
function draft(): MutableSource {
  return JSON.parse(JSON.stringify(REFERENCE_EDITOR_DOCUMENT)) as MutableSource;
}
function root(source: MutableSource): MutableNode {
  const node = source.surfaces["sign-in"]?.root;
  if (node === undefined) throw new Error("Expected reference root.");
  return node;
}
function title(source: MutableSource): MutableNode {
  const node = root(source).slots?.default?.[0];
  if (node === undefined) throw new Error("Expected reference title.");
  return node;
}
function review(text: unknown) {
  return reviewAuthoringSourceDraft(
    text,
    REFERENCE_AUTHORING_WORKSPACE_PROFILE,
    REFERENCE_EDITOR_DOCUMENT,
    route,
    baseline,
  );
}

describe("advanced Source publication admission", () => {
  it.each([
    [
      "prop",
      (source: MutableSource) => {
        title(source).props.text = 123;
      },
      "sign-in.title",
      "/surfaces/sign-in/root/slots/default/0/props/text",
      "PROP_TYPE_MISMATCH",
    ],
    [
      "event",
      (source: MutableSource) => {
        title(source).on = { unlisted: [] };
      },
      "sign-in.title",
      "/surfaces/sign-in/root/slots/default/0/on/unlisted",
      "UNKNOWN_EVENT",
    ],
    [
      "slot",
      (source: MutableSource) => {
        const node = root(source);
        node.slots = { ...node.slots, unlisted: [] };
      },
      "sign-in.layout",
      "/surfaces/sign-in/root/slots/unlisted",
      "UNKNOWN_SLOT",
    ],
  ] as const)(
    "rejects invalid %s through the real Publisher with exact node-linked diagnostics and no partial authority",
    (_kind, mutate, subjectId, pointer, code) => {
      const source = draft();
      mutate(source);
      const before = canonicalizeJson(REFERENCE_EDITOR_DOCUMENT);
      const text = JSON.stringify(source);
      const result = review(text);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Invalid draft must not succeed.");
      expect(result.reason).toBe("invalid-source");
      expect(result.publicationFailure).toMatchObject({ ok: false, stage: "capability-contracts" });
      expect(result.publicationFailure?.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code, pointer })]),
      );
      expect(result).not.toHaveProperty("document");
      expect(result).not.toHaveProperty("preview");
      expect(result.publicationFailure).not.toHaveProperty("bundle");
      const report = result.validationReport;
      if (report?.documentFingerprint === null || report === undefined)
        throw new Error("Expected mapped immutable report.");
      expect(report.valid).toBe(false);
      const projected = projectAuthoringDiagnostics(report, {
        ...route,
        documentFingerprint: report.documentFingerprint,
        catalogSetFingerprint: report.catalogSetFingerprint,
      });
      if (projected.status !== "ready") throw new Error("Expected diagnostic projection.");
      expect(
        projected.model.diagnostics.some(
          (diagnostic) =>
            diagnostic.pointer === pointer &&
            diagnostic.code === code &&
            diagnostic.occurrences.some((occurrence) => occurrence.subjectId === subjectId),
        ),
      ).toBe(true);
      expect(Object.isFrozen(report)).toBe(true);
      expect(Object.isFrozen(result.publicationFailure)).toBe(true);
      expect(canonicalizeJson(REFERENCE_EDITOR_DOCUMENT)).toBe(before);
      title(source).props.text = "Mutation after rejection";
      expect(JSON.stringify(result)).not.toContain("Mutation after rejection");
    },
  );

  it("applies a fully validated detached correction without changing its authored bindings or baseline", () => {
    const source = draft();
    title(source).props.text = "A corrected reusable screen";
    const result = review(JSON.stringify(source));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.document).toEqual(source);
    expect(result.document).not.toBe(source);
    expect(result.preview.bundle.revision).toBe(result.preview.revision);
    expect(Object.isFrozen(result.document)).toBe(true);
    expect(Object.isFrozen(result.preview.bundle)).toBe(true);
    expect(digestCanonicalJson(REFERENCE_EDITOR_DOCUMENT)).toBe(baseline);
    expect(canonicalizeJson(result.document)).toContain("state.password");
  });

  it.each([
    null,
    "{",
    '{"id":"first","id":"second"}',
    '{"value":1e999}',
    '{"value":"\\ud800"}',
    " ".repeat(8_388_609),
  ])("rejects malformed or over-budget text with no candidate or report", (raw) => {
    const result = review(raw);
    expect(result).toEqual({ ok: false, reason: "invalid-json" });
  });

  it("keeps structural Publisher diagnostics readable without guessing a Source node", () => {
    const result = review('{"kind":"desen.source"}');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected rejection.");
    expect(result.publicationFailure).toMatchObject({ ok: false, stage: "source-schema" });
    expect(result.validationReport).toBeUndefined();
  });

  it("rejects a stale authoring baseline even when the draft is publishable", () => {
    expect(
      reviewAuthoringSourceDraft(
        JSON.stringify(draft()),
        REFERENCE_AUTHORING_WORKSPACE_PROFILE,
        REFERENCE_EDITOR_DOCUMENT,
        route,
        `sha256:${"0".repeat(64)}`,
      ),
    ).toEqual({ ok: false, reason: "stale-draft" });
  });

  it.each([
    { projectId: "other-project", surfaceId: "sign-in" },
    { projectId: "account-app", surfaceId: "missing-surface" },
  ])("rejects foreign routes before acquiring draft authority", (otherRoute) => {
    expect(
      reviewAuthoringSourceDraft(
        JSON.stringify(draft()),
        REFERENCE_AUTHORING_WORKSPACE_PROFILE,
        REFERENCE_EDITOR_DOCUMENT,
        otherRoute,
        baseline,
      ),
    ).toEqual({ ok: false, reason: "workspace-mismatch" });
  });

  it("rejects forged profile handles and valid foreign Source identities", () => {
    expect(
      reviewAuthoringSourceDraft(
        JSON.stringify(draft()),
        {} as ProjectWorkspaceProfileHandle,
        REFERENCE_EDITOR_DOCUMENT,
        route,
        baseline,
      ),
    ).toEqual({ ok: false, reason: "workspace-mismatch" });
    const source = draft();
    source.id = "com.example.foreign";
    expect(review(JSON.stringify(source))).toEqual({ ok: false, reason: "workspace-mismatch" });
    title(source).props.text = 123;
    expect(review(JSON.stringify(source))).toEqual({ ok: false, reason: "workspace-mismatch" });
    const catalogs = draft();
    catalogs.catalogs.reverse();
    catalogs.catalogs.push(...catalogs.catalogs);
    expect(review(JSON.stringify(catalogs))).toEqual({ ok: false, reason: "workspace-mismatch" });
  });
});
