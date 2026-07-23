import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  buildReferenceCatalogWebComponentsEvidence,
  ReferenceCatalogWebComponentsEvidenceError,
  verifyReferenceCatalogWebComponentsEvidence,
} from "../scripts/lib/reference-catalog-web-components-proof.mjs";

const realComponentApi =
  await import("../packages/reference-catalog-web/test/components-consumer.mjs");
const realValidatorApi = await import("../packages/validator/dist/index.js");
const packageRequire = createRequire(
  pathToFileURL(
    path.resolve(import.meta.dirname, "../packages/reference-catalog-web/package.json"),
  ),
);
const React = packageRequire("react");

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ReferenceCatalogWebComponentsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function componentApiWith(overrides = {}) {
  return { ...realComponentApi, ...overrides };
}

test("accepts the tracked deterministic M03-T05 evidence", async () => {
  const result = await verifyReferenceCatalogWebComponentsEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.provenanceMode, "tracked-defaults");
  assert.equal(result.components, 2);
  assert.equal(result.packageTests, 5);
  assert.equal(result.rootTests, 18);
  assert.equal(result.typeNegativeCases, 7);
  assert.equal(result.trackedFiles, 18);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent reference component evidence builds are byte-identical", async () => {
  const first = await buildReferenceCatalogWebComponentsEvidence({
    verifyPrerequisite: false,
  });
  const second = await buildReferenceCatalogWebComponentsEvidence({
    verifyPrerequisite: false,
  });

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("records every explicit build option as injected evidence", async () => {
  const result = await buildReferenceCatalogWebComponentsEvidence({
    verifyPrerequisite: false,
  });

  assert.equal(result.artifact.evidence.provenance.mode, "injected-test");
  assert.deepEqual(result.artifact.evidence.provenance.overrides, ["verifyPrerequisite"]);
  assert.equal(result.artifact.prerequisite.result, "SKIPPED");
  assert.equal(result.artifact.prerequisite.artifactSha256, null);
});

test("rejects inherited, accessor-backed, or unknown build options", async () => {
  const inherited = Object.create({ verifyPrerequisite: false });
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence(inherited),
    hasEvidenceCode("REFERENCE_COMPONENT_OPTIONS_INVALID"),
  );

  let accessorRead = false;
  const accessorBacked = {};
  Object.defineProperty(accessorBacked, "verifyPrerequisite", {
    enumerable: true,
    get() {
      accessorRead = true;
      return false;
    },
  });
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence(accessorBacked),
    hasEvidenceCode("REFERENCE_COMPONENT_OPTIONS_INVALID"),
  );
  assert.equal(accessorRead, false);

  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({ unknownOption: true }),
    hasEvidenceCode("REFERENCE_COMPONENT_OPTIONS_INVALID"),
  );
});

test("rejects stale or one-byte-tampered evidence", async () => {
  const pristine = await buildReferenceCatalogWebComponentsEvidence({
    verifyPrerequisite: false,
  });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyReferenceCatalogWebComponentsEvidence({
      artifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_ARTIFACT_DRIFT"),
  );
});

test("rejects a component manifest that differs from the frozen official Catalog", async () => {
  const forgedRegistration = deepFreeze({
    ...realComponentApi.stackComponentRegistration,
    manifest: {
      ...realComponentApi.stackComponentRegistration.manifest,
      category: "content",
    },
  });

  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      componentApi: componentApiWith({ stackComponentRegistration: forgedRegistration }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_MANIFEST_DRIFT"),
  );
});

test("rejects mutable component registration data", async () => {
  const mutableRegistration = JSON.parse(
    JSON.stringify(realComponentApi.stackComponentRegistration),
  );

  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      componentApi: componentApiWith({ stackComponentRegistration: mutableRegistration }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_REGISTRATION_MUTABLE"),
  );
});

test("rejects a getter-backed component public API", async () => {
  const getterBackedApi = componentApiWith();
  const realText = getterBackedApi.Text;
  delete getterBackedApi.Text;
  Object.defineProperty(getterBackedApi, "Text", {
    enumerable: true,
    get() {
      return realText;
    },
  });

  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      componentApi: getterBackedApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_PUBLIC_API_DRIFT"),
  );
});

test("rejects a Text renderer that discards the declared native semantics", async () => {
  function ForgedText({ text }) {
    return React.createElement("div", null, text);
  }

  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      componentApi: componentApiWith({ Text: ForgedText }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_TEXT_RENDERING_DRIFT"),
  );
});

test("rejects a conditional Text renderer outside the original examples", async () => {
  function ConditionalText(props) {
    return props.text === "conditional-sentinel"
      ? React.createElement("div", null, props.text)
      : realComponentApi.Text(props);
  }

  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      componentApi: componentApiWith({ Text: ConditionalText }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_TEXT_RENDERING_DRIFT"),
  );
});

test("rejects a Stack renderer that fabricates focusability for one schema value", async () => {
  function ConditionalStack(props) {
    const element = realComponentApi.Stack(props);
    return props.gap === "lg" ? React.cloneElement(element, { tabIndex: 0 }) : element;
  }

  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      componentApi: componentApiWith({ Stack: ConditionalStack }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_STACK_RENDERING_DRIFT"),
  );
});

test("rejects a raw HTML execution path in the reviewed Text source", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t05-source-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const originalPath = new URL(
    "../packages/reference-catalog-web/src/components/text.tsx",
    import.meta.url,
  );
  const source = await readFile(originalPath, "utf8");
  const forgedPath = path.join(directory, "text.tsx");
  await writeFile(
    forgedPath,
    `${source}\nconst unsafe = <div dangerouslySetInnerHTML={{ __html: "forged" }} />;\n`,
  );

  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      textSourcePath: forgedPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_UNSAFE_HTML_PATH"),
  );
});

test("rejects conditional Stack source behavior outside sampled numbers", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t05-stack-source-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const originalPath = new URL(
    "../packages/reference-catalog-web/src/components/stack.tsx",
    import.meta.url,
  );
  const source = await readFile(originalPath, "utf8");
  const forgedSource = source.replace(
    "    ...(align === undefined ? {} : { alignItems: ALIGNMENT_VALUES[align] }),",
    '    ...(maxWidth === 999 ? { ["order"]: -1 } : {}),\n' +
      "    ...(align === undefined ? {} : { alignItems: ALIGNMENT_VALUES[align] }),",
  );
  assert.notEqual(forgedSource, source);
  const forgedPath = path.join(directory, "stack.tsx");
  await writeFile(forgedPath, forgedSource);

  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      stackSourcePath: forgedPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_STACK_SOURCE_SHAPE_DRIFT"),
  );

  const browserConditionalSource = source.replace(
    '  xl: "var(--desen-space-xl, 2rem)",',
    '  xl: typeof window === "undefined" ? "var(--desen-space-xl, 2rem)" : "0",',
  );
  assert.notEqual(browserConditionalSource, source);
  const browserConditionalPath = path.join(directory, "browser-conditional-stack.tsx");
  await writeFile(browserConditionalPath, browserConditionalSource);
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      stackSourcePath: browserConditionalPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_STACK_SOURCE_SHAPE_DRIFT"),
  );

  const topLevelExecutableSource =
    'if (typeof window !== "undefined") Reflect.set(Object, "freeze", (value) => value);\n' +
    source;
  const topLevelExecutablePath = path.join(directory, "top-level-executable-stack.tsx");
  await writeFile(topLevelExecutablePath, topLevelExecutableSource);
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      stackSourcePath: topLevelExecutablePath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_STACK_SOURCE_SHAPE_DRIFT"),
  );
});

test("rejects extra declaration exports and modified test calls", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t05-inventory-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const declarationSource = await readFile(
    new URL("../packages/reference-catalog-web/dist/components/index.d.ts", import.meta.url),
    "utf8",
  );
  const forgedDeclarationPath = path.join(directory, "index.d.ts");
  await writeFile(forgedDeclarationPath, `${declarationSource}\nexport interface Extra {}\n`);
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      componentIndexPath: forgedDeclarationPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_PUBLIC_API_DRIFT"),
  );

  const rootTestSource = await readFile(new URL(import.meta.url), "utf8");
  const forgedRootTestPath = path.join(directory, "root.test.mjs");
  await writeFile(
    forgedRootTestPath,
    rootTestSource.replace(
      'test("accepts the tracked deterministic M03-T05 evidence"',
      'test.skip("accepts the tracked deterministic M03-T05 evidence"',
    ),
  );
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      rootTestPath: forgedRootTestPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects alternate web export conditions and React runtime duplication", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t05-package-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const packageManifest = JSON.parse(
    await readFile(
      new URL("../packages/reference-catalog-web/package.json", import.meta.url),
      "utf8",
    ),
  );

  const conditionalManifest = structuredClone(packageManifest);
  conditionalManifest.exports["./components"] = {
    browser: "./dist/components/evil.js",
    ...conditionalManifest.exports["./components"],
  };
  const conditionalPath = path.join(directory, "conditional-package.json");
  await writeFile(conditionalPath, JSON.stringify(conditionalManifest));
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      packagePath: conditionalPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_PACKAGE_BOUNDARY_DRIFT"),
  );

  const topLevelBrowserManifest = structuredClone(packageManifest);
  topLevelBrowserManifest.browser = {
    "./dist/components/index.js": "./dist/components/evil.js",
  };
  const topLevelBrowserPath = path.join(directory, "browser-package.json");
  await writeFile(topLevelBrowserPath, JSON.stringify(topLevelBrowserManifest));
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      packagePath: topLevelBrowserPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_PACKAGE_BOUNDARY_DRIFT"),
  );

  const duplicatedReactManifest = structuredClone(packageManifest);
  duplicatedReactManifest.dependencies.react = "19.2.8";
  const duplicatedReactPath = path.join(directory, "duplicated-react-package.json");
  await writeFile(duplicatedReactPath, JSON.stringify(duplicatedReactManifest));
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      packagePath: duplicatedReactPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_PACKAGE_BOUNDARY_DRIFT"),
  );
});

test("rejects inert quality-gate command wiring", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t05-wiring-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const rootPackage = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  const inertCheckPackage = structuredClone(rootPackage);
  inertCheckPackage.scripts.check = inertCheckPackage.scripts.check.replace(
    "pnpm verify:reference-catalog-web-components",
    'echo "pnpm verify:reference-catalog-web-components"',
  );
  const inertCheckPath = path.join(directory, "inert-check-package.json");
  await writeFile(inertCheckPath, JSON.stringify(inertCheckPackage));
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      rootPackagePath: inertCheckPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_COMMAND_WIRING_DRIFT"),
  );

  const inertTestPackage = structuredClone(rootPackage);
  inertTestPackage.scripts.test = inertTestPackage.scripts.test.replace(
    "pnpm test:reference-catalog-web-components",
    'echo "pnpm test:reference-catalog-web-components"',
  );
  const inertTestPath = path.join(directory, "inert-test-package.json");
  await writeFile(inertTestPath, JSON.stringify(inertTestPackage));
  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      rootPackagePath: inertTestPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_COMMAND_WIRING_DRIFT"),
  );
});

test("rejects nondefault verification through a symlink alias to the tracked artifact", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t05-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const trackedArtifactPath = path.resolve(
    import.meta.dirname,
    "../docs/proof/artifacts/reference-catalog-web-components.json",
  );
  const aliasPath = path.join(directory, "artifact-alias.json");
  await symlink(trackedArtifactPath, aliasPath);

  await assert.rejects(
    verifyReferenceCatalogWebComponentsEvidence({
      artifactPath: aliasPath,
      componentApi: realComponentApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_NONDEFAULT_TRACKED_VERIFY"),
  );
});

test("rejects forged validation that fails to enforce closed public props", async () => {
  const validatorApi = {
    ...realValidatorApi,
    validateDesenSourceComponentContracts() {
      return { valid: true, target: "source", value: {}, diagnostics: [], obligations: [] };
    },
  };

  await assert.rejects(
    buildReferenceCatalogWebComponentsEvidence({
      validatorApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("REFERENCE_COMPONENT_CLOSED_SCHEMA_UNPROVEN"),
  );
});
