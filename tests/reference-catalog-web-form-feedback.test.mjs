import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  buildReferenceCatalogWebFormFeedbackEvidence,
  ReferenceCatalogWebFormFeedbackEvidenceError,
  verifyReferenceCatalogWebFormFeedbackEvidence,
} from "../scripts/lib/reference-catalog-web-form-feedback-proof.mjs";

const realComponentApi =
  await import("../packages/reference-catalog-web/test/form-feedback-components-consumer.mjs");
const realValidatorApi = await import("../packages/validator/dist/index.js");
const packageRequire = createRequire(
  pathToFileURL(
    path.resolve(import.meta.dirname, "../packages/reference-catalog-web/package.json"),
  ),
);
const React = packageRequire("react");

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ReferenceCatalogWebFormFeedbackEvidenceError);
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

test("accepts the tracked deterministic M03-T06 evidence", async () => {
  const result = await verifyReferenceCatalogWebFormFeedbackEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.provenanceMode, "tracked-defaults");
  assert.equal(result.components, 5);
  assert.equal(result.vectors, 279);
  assert.equal(result.packageTests, 11);
  assert.equal(result.rootTests, 18);
  assert.equal(result.typeNegativeCases, 22);
  assert.equal(result.trackedFiles, 12);
  assert.match(result.prerequisiteSha256, /^[0-9a-f]{64}$/u);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent form-feedback evidence builds are byte-identical", async () => {
  const [first, second] = await Promise.all([
    buildReferenceCatalogWebFormFeedbackEvidence({ verifyPrerequisite: false }),
    buildReferenceCatalogWebFormFeedbackEvidence({ verifyPrerequisite: false }),
  ]);

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("records every explicit build option as injected evidence", async () => {
  const result = await buildReferenceCatalogWebFormFeedbackEvidence({
    verifyPrerequisite: false,
  });

  assert.equal(result.artifact.evidence.provenance.mode, "injected-test");
  assert.deepEqual(result.artifact.evidence.provenance.overrides, ["verifyPrerequisite"]);
  assert.equal(result.artifact.prerequisite.result, "SKIPPED");
  assert.equal(result.artifact.prerequisite.artifactSha256, null);
});

test("rejects inherited accessor-backed and unknown options", async () => {
  const inherited = Object.create({ verifyPrerequisite: false });
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence(inherited),
    hasEvidenceCode("FORM_FEEDBACK_OPTIONS_INVALID"),
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
    buildReferenceCatalogWebFormFeedbackEvidence(accessorBacked),
    hasEvidenceCode("FORM_FEEDBACK_OPTIONS_INVALID"),
  );
  assert.equal(accessorRead, false);

  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({ unknownOption: true }),
    hasEvidenceCode("FORM_FEEDBACK_OPTIONS_INVALID"),
  );
});

test("rejects stale or one-byte-tampered evidence", async () => {
  const pristine = await buildReferenceCatalogWebFormFeedbackEvidence({
    verifyPrerequisite: false,
  });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyReferenceCatalogWebFormFeedbackEvidence({
      artifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_ARTIFACT_DRIFT"),
  );
});

test("rejects a missing or mismatched M03-T05 prerequisite", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t06-prerequisite-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const missingPath = path.join(directory, "missing.json");

  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      prerequisiteArtifactPath: missingPath,
    }),
    hasEvidenceCode("FORM_FEEDBACK_PREREQUISITE_DRIFT"),
  );

  const forgedPath = path.join(directory, "forged.json");
  await writeFile(forgedPath, '{"schemaVersion":1,"task":"M03-T05","result":"PASS"}\n');
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      prerequisiteArtifactPath: forgedPath,
    }),
    hasEvidenceCode("FORM_FEEDBACK_PREREQUISITE_DRIFT"),
  );
});

test("rejects each new manifest when it differs from the frozen official Catalog", async () => {
  for (const name of [
    "alertComponentRegistration",
    "buttonComponentRegistration",
    "textFieldComponentRegistration",
  ]) {
    const realRegistration = realComponentApi[name];
    const forgedRegistration = deepFreeze({
      ...realRegistration,
      manifest: { ...realRegistration.manifest, category: "content" },
    });
    await assert.rejects(
      buildReferenceCatalogWebFormFeedbackEvidence({
        componentApi: componentApiWith({ [name]: forgedRegistration }),
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("FORM_FEEDBACK_MANIFEST_DRIFT"),
    );
  }
});

test("rejects mutable registrations and accessor-backed public APIs", async () => {
  const mutableRegistration = JSON.parse(
    JSON.stringify(realComponentApi.textFieldComponentRegistration),
  );
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({
        textFieldComponentRegistration: mutableRegistration,
      }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_REGISTRATION_MUTABLE"),
  );

  const getterBackedApi = componentApiWith();
  const realAlert = getterBackedApi.Alert;
  delete getterBackedApi.Alert;
  Object.defineProperty(getterBackedApi, "Alert", {
    enumerable: true,
    get() {
      return realAlert;
    },
  });
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: getterBackedApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_PUBLIC_API_DRIFT"),
  );
});

test("rejects a TextField renderer that loses its visible native label", async () => {
  function ForgedTextField({ value }) {
    return React.createElement("input", { readOnly: true, type: "text", value });
  }

  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({ TextField: ForgedTextField }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_TEXT_FIELD_RENDERING_DRIFT"),
  );
});

test("rejects a Button renderer that replaces native button semantics", async () => {
  function ForgedButton({ label }) {
    return React.createElement("div", { role: "button", tabIndex: 0 }, label);
  }

  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({ Button: ForgedButton }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_BUTTON_RENDERING_DRIFT"),
  );
});

test("rejects trusted interaction bridges that silently drop change press or focus behavior", async () => {
  function SilentTextField(props) {
    const forwarded = { ...props };
    Reflect.deleteProperty(forwarded, "onChange");
    return React.createElement(realComponentApi.TextField, forwarded);
  }
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({ TextField: SilentTextField }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_TEXT_FIELD_INTERACTION_DRIFT"),
  );

  function LeakyTextField(props) {
    const forwarded = { ...props };
    if (forwarded.onChange !== undefined) {
      const onChange = forwarded.onChange;
      forwarded.onChange = (payload) => {
        onChange(payload, new globalThis.Event("change"));
      };
    }
    return React.createElement(realComponentApi.TextField, forwarded);
  }
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({ TextField: LeakyTextField }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_TEXT_FIELD_INTERACTION_DRIFT"),
  );

  function SilentFocusTextField(props) {
    const forwarded = { ...props };
    Reflect.deleteProperty(forwarded, "ref");
    return React.createElement(realComponentApi.TextField, forwarded);
  }
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({ TextField: SilentFocusTextField }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_TEXT_FIELD_FOCUS_DRIFT"),
  );

  function RedirectingDisabledFocusTextField(props) {
    const forwarded = { ...props };
    const externalRef = forwarded.ref;
    Reflect.deleteProperty(forwarded, "ref");
    const innerRef = React.useRef(null);
    React.useImperativeHandle(
      externalRef,
      () =>
        Object.freeze({
          focus() {
            if (forwarded.disabled) {
              const impostor = globalThis.document.createElement("button");
              impostor.type = "button";
              globalThis.document.body.append(impostor);
              impostor.focus();
            } else {
              innerRef.current?.focus();
            }
          },
        }),
      [forwarded.disabled],
    );
    return React.createElement(realComponentApi.TextField, {
      ...forwarded,
      ref: innerRef,
    });
  }
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({ TextField: RedirectingDisabledFocusTextField }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_TEXT_FIELD_FOCUS_DRIFT"),
  );

  function ReturningFocusTextField(props) {
    const forwarded = { ...props };
    const externalRef = forwarded.ref;
    Reflect.deleteProperty(forwarded, "ref");
    const innerRef = React.useRef(null);
    React.useImperativeHandle(
      externalRef,
      () =>
        Object.freeze({
          focus() {
            innerRef.current?.focus();
            return globalThis.document.activeElement;
          },
        }),
      [],
    );
    return React.createElement(realComponentApi.TextField, {
      ...forwarded,
      ref: innerRef,
    });
  }
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({ TextField: ReturningFocusTextField }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_TEXT_FIELD_FOCUS_DRIFT"),
  );

  function SilentButton(props) {
    const forwarded = { ...props };
    Reflect.deleteProperty(forwarded, "onPress");
    return React.createElement(realComponentApi.Button, forwarded);
  }
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({ Button: SilentButton }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_BUTTON_INTERACTION_DRIFT"),
  );

  function LeakyButton(props) {
    const forwarded = { ...props };
    if (forwarded.onPress !== undefined) {
      const onPress = forwarded.onPress;
      forwarded.onPress = (payload) => {
        onPress(payload, new globalThis.MouseEvent("click"));
      };
    }
    return React.createElement(realComponentApi.Button, forwarded);
  }
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({ Button: LeakyButton }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_BUTTON_INTERACTION_DRIFT"),
  );
});

test("rejects an Alert renderer that fabricates focusability", async () => {
  function ForgedAlert({ text, tone }) {
    const element = realComponentApi.Alert({ text, tone });
    return React.cloneElement(element, { tabIndex: 0 });
  }

  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentApi: componentApiWith({ Alert: ForgedAlert }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_ALERT_RENDERING_DRIFT"),
  );
});

test("rejects hidden component source changes and raw HTML paths", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t06-source-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const originalPath = new URL(
    "../packages/reference-catalog-web/src/components/alert.tsx",
    import.meta.url,
  );
  const source = await readFile(originalPath, "utf8");

  const hiddenPath = path.join(directory, "hidden-alert.tsx");
  await writeFile(hiddenPath, `${source}\nconst hiddenBehavior = () => "conditional";\n`);
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      alertSourcePath: hiddenPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_SOURCE_SHAPE_DRIFT"),
  );

  const rawHtmlPath = path.join(directory, "raw-html-alert.tsx");
  await writeFile(
    rawHtmlPath,
    `${source}\nconst unsafe = <div dangerouslySetInnerHTML={{ __html: "bad" }} />;\n`,
  );
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      alertSourcePath: rawHtmlPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_UNSAFE_HTML_PATH"),
  );
});

test("rejects declaration test and type-negative inventory drift", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t06-inventory-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const declarationSource = await readFile(
    new URL("../packages/reference-catalog-web/dist/components/index.d.ts", import.meta.url),
    "utf8",
  );
  const declarationPath = path.join(directory, "index.d.ts");
  const missingRequiredDeclaration = declarationSource.replace(
    'export { Alert } from "./alert.js";\n',
    "",
  );
  assert.notEqual(missingRequiredDeclaration, declarationSource);
  await writeFile(declarationPath, missingRequiredDeclaration);
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentIndexPath: declarationPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_PUBLIC_API_DRIFT"),
  );

  const ambientDeclarationPath = path.join(directory, "ambient-index.d.ts");
  await writeFile(
    ambientDeclarationPath,
    `${declarationSource}\ndeclare global { interface Window { __desenProofBypass: true } }\nexport {};\n`,
  );
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      componentIndexPath: ambientDeclarationPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_PUBLIC_API_DRIFT"),
  );

  const sourceIndex = await readFile(
    new URL("../packages/reference-catalog-web/src/components/index.ts", import.meta.url),
    "utf8",
  );
  const futureExport = 'export { FutureComponent } from "./future-component.js";\n';
  const futureDeclarationPath = path.join(directory, "future-index.d.ts");
  const futureSourcePath = path.join(directory, "future-index.ts");
  await writeFile(futureDeclarationPath, `${declarationSource}\n${futureExport}`);
  await writeFile(futureSourcePath, `${sourceIndex}\n${futureExport}`);
  const futureResult = await buildReferenceCatalogWebFormFeedbackEvidence({
    componentIndexPath: futureDeclarationPath,
    componentIndexSourcePath: futureSourcePath,
    verifyPrerequisite: false,
  });
  assert.equal(futureResult.artifact.result, "PASS");
  assert.equal(futureResult.artifact.evidence.trackedFiles.length, 12);
  assert.equal(futureResult.artifact.publicApi.runtimeExports.includes("FutureComponent"), false);

  const packageTestSource = await readFile(
    new URL(
      "../packages/reference-catalog-web/test/interactive-components.test.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const packageTestPath = path.join(directory, "interactive.test.tsx");
  await writeFile(packageTestPath, packageTestSource.replace(/\bit\(/u, "it.skip("));
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      packageTestPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_TEST_INVENTORY_DRIFT"),
  );

  const conditionallyWrappedPath = path.join(directory, "conditional-interactive.test.tsx");
  const conditionallyWrapped = packageTestSource
    .replace(
      '  it("registers the three exact closed interaction contracts as immutable data", () => {',
      '  if (false) {\n    it("registers the three exact closed interaction contracts as immutable data", () => {',
    )
    .replace(
      '  it("associates every visible TextField label with one unique native input", () => {',
      '  }\n\n  it("associates every visible TextField label with one unique native input", () => {',
    );
  assert.notEqual(conditionallyWrapped, packageTestSource);
  await writeFile(conditionallyWrappedPath, conditionallyWrapped);
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      packageTestPath: conditionallyWrappedPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_TEST_INVENTORY_DRIFT"),
  );

  const aliasedImportPath = path.join(directory, "aliased-import-interactive.test.tsx");
  const aliasedImport = packageTestSource.replace(
    'import { afterEach, describe, expect, it } from "vitest";',
    'import { afterEach, describe, expect, it as it } from "vitest";',
  );
  assert.notEqual(aliasedImport, packageTestSource);
  await writeFile(aliasedImportPath, aliasedImport);
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      packageTestPath: aliasedImportPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_TEST_INVENTORY_DRIFT"),
  );

  const typeTestSource = await readFile(
    new URL(
      "../packages/reference-catalog-web/test/interactive-components.types.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const typeTestPath = path.join(directory, "interactive.types.tsx");
  await writeFile(typeTestPath, typeTestSource.replace("M03-T06-N22", "M03-T06-N21"));
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      typeTestPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_TYPE_INVENTORY_DRIFT"),
  );
});

test("rejects alternate package exports and React runtime duplication", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t06-package-"));
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
    buildReferenceCatalogWebFormFeedbackEvidence({
      packagePath: conditionalPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_PACKAGE_BOUNDARY_DRIFT"),
  );

  const duplicatedReactManifest = structuredClone(packageManifest);
  duplicatedReactManifest.dependencies.react = "19.2.8";
  const duplicatedReactPath = path.join(directory, "duplicated-react-package.json");
  await writeFile(duplicatedReactPath, JSON.stringify(duplicatedReactManifest));
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      packagePath: duplicatedReactPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_PACKAGE_BOUNDARY_DRIFT"),
  );
});

test("rejects inert quality-gate command wiring", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t06-wiring-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const rootPackage = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  const inertCheckPackage = structuredClone(rootPackage);
  inertCheckPackage.scripts.check = inertCheckPackage.scripts.check.replace(
    "pnpm verify:reference-catalog-web-form-feedback",
    'echo "pnpm verify:reference-catalog-web-form-feedback"',
  );
  const inertCheckPath = path.join(directory, "inert-check-package.json");
  await writeFile(inertCheckPath, JSON.stringify(inertCheckPackage));
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      rootPackagePath: inertCheckPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_COMMAND_WIRING_DRIFT"),
  );

  const inertTestPackage = structuredClone(rootPackage);
  inertTestPackage.scripts.test = inertTestPackage.scripts.test.replace(
    "pnpm test:reference-catalog-web-form-feedback",
    'echo "pnpm test:reference-catalog-web-form-feedback"',
  );
  const inertTestPath = path.join(directory, "inert-test-package.json");
  await writeFile(inertTestPath, JSON.stringify(inertTestPackage));
  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      rootPackagePath: inertTestPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_COMMAND_WIRING_DRIFT"),
  );
});

test("rejects nondefault verification through a symlink alias", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t06-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const trackedArtifactPath = path.resolve(
    import.meta.dirname,
    "../docs/proof/artifacts/reference-catalog-web-form-feedback.json",
  );
  const aliasPath = path.join(directory, "artifact-alias.json");
  await symlink(trackedArtifactPath, aliasPath);

  await assert.rejects(
    verifyReferenceCatalogWebFormFeedbackEvidence({
      artifactPath: aliasPath,
      componentApi: realComponentApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_NONDEFAULT_TRACKED_VERIFY"),
  );
});

test("rejects forged validation that bypasses closed component props", async () => {
  const validatorApi = {
    ...realValidatorApi,
    validateDesenSourceComponentContracts() {
      return { valid: true, target: "source", value: {}, diagnostics: [], obligations: [] };
    },
  };

  await assert.rejects(
    buildReferenceCatalogWebFormFeedbackEvidence({
      validatorApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("FORM_FEEDBACK_CLOSED_SCHEMA_UNPROVEN"),
  );
});
