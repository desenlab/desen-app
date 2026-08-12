import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadReferenceHostInstalledPackage } from "../src/installed-package-inventory.js";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");
const OFFICIAL_PACKAGE_ROOT = join(WORKSPACE_ROOT, "packages/reference-catalog-web");
const MAX_FIXTURE_COPY_ENTRIES = 128;
const MAX_FIXTURE_COPY_BYTES = 1_048_576;
const temporaryRoots: string[] = [];

interface FixtureCopyBudget {
  bytes: number;
  entries: number;
}

async function copyFixtureEntry(
  source: string,
  destination: string,
  budget: FixtureCopyBudget,
): Promise<void> {
  const entry = await lstat(source);
  budget.entries += 1;
  if (budget.entries > MAX_FIXTURE_COPY_ENTRIES) {
    throw new Error("The installed-package fixture exceeds its bounded entry budget.");
  }

  if (entry.isDirectory()) {
    await mkdir(destination);
    const children = await readdir(source, { withFileTypes: true });
    children.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const child of children) {
      await copyFixtureEntry(join(source, child.name), join(destination, child.name), budget);
    }
    return;
  }

  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw new Error("The installed-package fixture contains an unsupported entry.");
  }
  budget.bytes += entry.size;
  if (budget.bytes > MAX_FIXTURE_COPY_BYTES) {
    throw new Error("The installed-package fixture exceeds its bounded byte budget.");
  }
  const bytes = await readFile(source);
  if (bytes.byteLength !== entry.size) {
    throw new Error("The installed-package fixture changed while it was copied.");
  }
  await writeFile(destination, bytes, { flag: "wx" });
}

async function copyFixture(source: string, destination: string): Promise<void> {
  await copyFixtureEntry(source, destination, { bytes: 0, entries: 0 });
}

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(async (path) => rm(path, { recursive: true, force: true })),
  );
});

describe("reference host installed package inventory", () => {
  it("loads the exact official Catalog and complete sorted dist inventory", async () => {
    const candidate = await loadReferenceHostInstalledPackage({
      installedPackageDirectory: OFFICIAL_PACKAGE_ROOT,
    });

    expect(candidate).toMatchObject({
      id: "run.desen.reference.sign-in",
      version: "0.1.0",
      target: "web-react",
    });
    expect(candidate.artifacts).toHaveLength(80);
    expect(candidate.artifacts.map((artifact) => artifact.path)).toEqual(
      [...candidate.artifacts.map((artifact) => artifact.path)].sort(),
    );
    expect(candidate.artifacts.every((artifact) => artifact.path.startsWith("dist/"))).toBe(true);
  });

  it("[installed-inventory-symlink-rejected] rejects a linked dist artifact", async () => {
    const root = await temporaryRoot("desen-reference-host-package-");
    const copied = join(root, "reference-catalog-web");
    const externalArtifact = join(root, "external-alert.js");
    await mkdir(copied);
    await copyFixture(join(OFFICIAL_PACKAGE_ROOT, "catalog.json"), join(copied, "catalog.json"));
    await copyFixture(join(OFFICIAL_PACKAGE_ROOT, "dist"), join(copied, "dist"));
    await copyFixture(join(OFFICIAL_PACKAGE_ROOT, "dist/components/alert.js"), externalArtifact);
    const target = join(copied, "dist/components/alert.js");
    await rm(target);
    await symlink(externalArtifact, target);

    await expect(
      loadReferenceHostInstalledPackage({ installedPackageDirectory: copied }),
    ).rejects.toThrow("unsafe");
  });

  it("rejects a hard-linked dist artifact outside the package root", async () => {
    const root = await temporaryRoot("desen-reference-host-package-hard-link-");
    const copied = join(root, "reference-catalog-web");
    const externalArtifact = join(root, "external-alert.js");
    await mkdir(copied);
    await copyFixture(join(OFFICIAL_PACKAGE_ROOT, "catalog.json"), join(copied, "catalog.json"));
    await copyFixture(join(OFFICIAL_PACKAGE_ROOT, "dist"), join(copied, "dist"));
    await copyFixture(join(OFFICIAL_PACKAGE_ROOT, "dist/components/alert.js"), externalArtifact);
    const target = join(copied, "dist/components/alert.js");
    await rm(target);
    await link(externalArtifact, target);

    await expect(
      loadReferenceHostInstalledPackage({ installedPackageDirectory: copied }),
    ).rejects.toThrow("unsafe");
  });

  it("rejects a hard-linked Catalog outside the package root", async () => {
    const root = await temporaryRoot("desen-reference-host-catalog-hard-link-");
    const copied = join(root, "reference-catalog-web");
    const externalCatalog = join(root, "external-catalog.json");
    await mkdir(copied);
    await copyFixture(join(OFFICIAL_PACKAGE_ROOT, "catalog.json"), externalCatalog);
    await link(externalCatalog, join(copied, "catalog.json"));
    await copyFixture(join(OFFICIAL_PACKAGE_ROOT, "dist"), join(copied, "dist"));

    await expect(
      loadReferenceHostInstalledPackage({ installedPackageDirectory: copied }),
    ).rejects.toThrow("unsafe");
  });

  it("rejects a finite aggregate package overflow before reading all artifacts", async () => {
    const root = await temporaryRoot("desen-reference-host-package-limit-");
    const packageRoot = join(root, "package");
    await mkdir(join(packageRoot, "dist"), { recursive: true });
    await writeFile(
      join(packageRoot, "catalog.json"),
      JSON.stringify({ id: "run.desen.large", version: "1.0.0", target: "web-react" }),
    );
    for (let index = 0; index < 4; index += 1) {
      const handle = await open(join(packageRoot, "dist", `large-${String(index)}.bin`), "w");
      await handle.truncate(16 * 1_024 * 1_024);
      await handle.close();
    }

    await expect(
      loadReferenceHostInstalledPackage({ installedPackageDirectory: packageRoot }),
    ).rejects.toThrow("fixed limits");
  });

  it("rejects an immediate installed-package directory fan-out at its entry ceiling", async () => {
    const root = await temporaryRoot("desen-reference-host-package-entry-limit-");
    const packageRoot = join(root, "package");
    const distributionRoot = join(packageRoot, "dist");
    await mkdir(distributionRoot, { recursive: true });
    await writeFile(
      join(packageRoot, "catalog.json"),
      JSON.stringify({ id: "run.desen.large", version: "1.0.0", target: "web-react" }),
    );
    await Promise.all(
      Array.from({ length: 2_049 }, async (_unused, index) =>
        mkdir(join(distributionRoot, `empty-${String(index).padStart(4, "0")}`)),
      ),
    );

    await expect(
      loadReferenceHostInstalledPackage({ installedPackageDirectory: packageRoot }),
    ).rejects.toThrow("fixed limits");
  });
});
