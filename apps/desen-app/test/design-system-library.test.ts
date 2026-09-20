import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import {
  compareDesignSystemLibraryReleases,
  decideDesignSystemLibraryAdoption,
  prepareDesignSystemLibrary,
  prepareDesignSystemLibraryRelease,
  prepareDesignSystemLibraryAdoption,
  restoreDesignSystemLibraryRelease,
} from "../src/design-system-library.js";
import {
  REFERENCE_AUTHORING_CATALOG_PACKAGES,
  REFERENCE_AUTHORING_MODEL,
} from "../src/reference-authoring-profile.js";

import type { PublishCatalogPackageCandidate } from "@desen/publisher";

function clone<T>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function referencePackage(): PublishCatalogPackageCandidate {
  const packageCandidate = REFERENCE_AUTHORING_CATALOG_PACKAGES[0];
  if (packageCandidate === undefined) throw new Error("Missing reference package.");
  return packageCandidate;
}

function candidateWithCatalog(catalog: Record<string, unknown>): PublishCatalogPackageCandidate {
  const base = referencePackage();
  return {
    ...base,
    catalog,
    version: String(catalog.version),
    observedPackageDigest: String(catalog.packageDigest),
  };
}

describe("Design System library management", () => {
  it("derives exact package identities and Source-backed reverse references", () => {
    const result = prepareDesignSystemLibrary({
      projects: [
        {
          projectId: "account-app",
          projectName: "Account app",
          model: REFERENCE_AUTHORING_MODEL,
          catalogPackages: REFERENCE_AUTHORING_CATALOG_PACKAGES,
        },
      ],
    });
    if (!result.ok) throw new Error(`Expected library projection: ${result.reason}.`);

    expect(result.model.releases).toHaveLength(1);
    expect(result.model.releases[0]?.identity).toEqual({
      id: REFERENCE_AUTHORING_MODEL.catalog.id,
      version: REFERENCE_AUTHORING_MODEL.catalog.version,
      target: REFERENCE_AUTHORING_MODEL.catalog.target,
      packageDigest: referencePackage().observedPackageDigest,
    });
    expect(result.model.usageIndex.references.length).toBeGreaterThan(0);
    expect(result.model.usageIndex.references[0]?.projectId).toBe("account-app");
    expect(result.model.usageIndex.references[0]?.surfaceId).toBeTruthy();
    expect(result.model.usageIndex.references[0]?.nodeId).toBeTruthy();
  });

  it("rejects an unverifiable package tuple before exposing a release", () => {
    const base = referencePackage();
    const candidate: PublishCatalogPackageCandidate = {
      ...base,
      observedPackageDigest: digestCanonicalJson({ tampered: true }),
    };
    expect(prepareDesignSystemLibraryRelease(candidate)).toEqual({
      ok: false,
      reason: "package-mismatch",
    });
  });

  it("projects inert lifecycle metadata and fails closed on malformed metadata", () => {
    const catalog = clone(referencePackage().catalog) as Record<string, unknown>;
    catalog.extensions = {
      "desen.library": {
        releaseLabel: "Reference 0.1",
        components: {
          "com.example.ui/Button": {
            deprecated: true,
            replacement: "com.example.ui/ActionButton",
            migration: "Use the ActionButton variant mapping.",
          },
        },
      },
    };
    catalog.packageDigest = digestCanonicalJson(catalog);
    const projected = prepareDesignSystemLibraryRelease(candidateWithCatalog(catalog));
    if (!projected.ok) throw new Error(`Expected lifecycle metadata: ${projected.reason}.`);
    const button = projected.release.components.find(({ id }) => id === "com.example.ui/Button");
    expect(button?.lifecycle).toEqual({
      status: "deprecated",
      replacement: "com.example.ui/ActionButton",
      migration: "Use the ActionButton variant mapping.",
    });

    const malformed = clone(catalog);
    malformed.extensions = { "desen.library": true };
    malformed.packageDigest = digestCanonicalJson(malformed);
    expect(prepareDesignSystemLibraryRelease(candidateWithCatalog(malformed))).toEqual({
      ok: false,
      reason: "metadata-invalid",
    });
  });

  it("finds an affected used component and blocks incompatible adoption", () => {
    const current = prepareDesignSystemLibrary({
      projects: [
        {
          projectId: "account-app",
          model: REFERENCE_AUTHORING_MODEL,
          catalogPackages: REFERENCE_AUTHORING_CATALOG_PACKAGES,
        },
      ],
    });
    if (!current.ok) throw new Error(`Expected current library: ${current.reason}.`);
    const catalog = clone(referencePackage().catalog) as Record<string, unknown>;
    catalog.version = "0.2.0";
    const components = catalog.components as Record<string, unknown>;
    delete components["com.example.ui/Button"];
    catalog.packageDigest = digestCanonicalJson(catalog);
    const candidateResult = prepareDesignSystemLibraryRelease(candidateWithCatalog(catalog));
    if (!candidateResult.ok)
      throw new Error(`Expected candidate release: ${candidateResult.reason}.`);

    const from = current.model.releases[0];
    if (from === undefined) throw new Error("Missing current release.");
    const comparison = compareDesignSystemLibraryReleases(
      from,
      candidateResult.release,
      current.model.usageIndex.references,
    );
    expect(comparison.compatibility).toBe("incompatible");
    expect(comparison.reasons).toContain("used-component-removed");
    expect(
      comparison.affectedUsages.some(
        ({ capabilityId }) => capabilityId === "com.example.ui/Button",
      ),
    ).toBe(true);

    const plan = prepareDesignSystemLibraryAdoption(
      from,
      candidateResult.release,
      current.model.usageIndex.references,
    );
    expect(plan.status).toBe("review_required");
    expect(decideDesignSystemLibraryAdoption(plan, "accept")).toEqual({
      ok: false,
      reason: "incompatible",
    });
    const rejected = decideDesignSystemLibraryAdoption(plan, "reject");
    expect(rejected).toMatchObject({ ok: true, status: "rejected", current: from.identity });
  });

  it("keeps explicit adoption reversible by restoring the previous exact release", () => {
    const workspace = prepareDesignSystemLibrary({
      projects: [
        {
          projectId: "account-app",
          model: REFERENCE_AUTHORING_MODEL,
          catalogPackages: REFERENCE_AUTHORING_CATALOG_PACKAGES,
        },
      ],
    });
    if (!workspace.ok) throw new Error(`Expected library workspace: ${workspace.reason}.`);
    const current = workspace.model.releases[0];
    if (current === undefined) throw new Error("Missing current release.");
    const candidate = clone(referencePackage().catalog) as Record<string, unknown>;
    candidate.version = "0.2.0";
    candidate.packageDigest = digestCanonicalJson(candidate);
    const nextResult = prepareDesignSystemLibraryRelease(candidateWithCatalog(candidate));
    if (!nextResult.ok) throw new Error(`Expected next release: ${nextResult.reason}.`);
    const plan = prepareDesignSystemLibraryAdoption(current, nextResult.release, []);
    const adopted = decideDesignSystemLibraryAdoption(plan, "accept");
    if (!adopted.ok || adopted.status !== "adopted") throw new Error("Expected explicit adoption.");
    expect(restoreDesignSystemLibraryRelease(adopted)).toEqual(current.identity);
  });
});
