import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ReferenceHostWebSourceAuditEvidenceError,
  buildCurrentReferenceHostWebSourceAuditEvidence,
  buildReferenceHostWebSourceAuditEvidence,
  inspectReferenceHostWebSourceAudit,
  inspectReferenceHostWebSourceInventory,
  resolveReferenceHostWebSourceAuditWorkspacePaths,
  verifyReferenceHostWebBackingSnapshotPolicy,
  verifyReferenceHostWebDependencyBoundaryConfiguration,
  verifyReferenceHostWebHtmlEnvelopePolicy,
  verifyReferenceHostWebPostCssBuildEnvelopePolicy,
  verifyReferenceHostWebSourceAuditDocumentation,
  verifyReferenceHostWebSourceAuditEvidence,
  verifyReferenceHostWebSourceAuditProofDocument,
  verifyReferenceHostWebBuildEnvelopeEntryPolicy,
  verifyReferenceHostWebSourceGraphPolicy,
  writeReferenceHostWebSourceAuditEvidence,
  verifyCurrentReferenceHostWebSourceAuditEvidence,
} from "../scripts/lib/reference-host-web-source-audit-proof.mjs";

const WORKSPACE_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const SOURCE_ROOT = "apps/reference-host-web/src";
const ROOT_SOURCE = `${SOURCE_ROOT}/root.tsx`;
const APPLICATION_SOURCE = `${SOURCE_ROOT}/application.tsx`;
const BROWSER_PROFILE_SOURCE = `${SOURCE_ROOT}/browser-profile.ts`;
const CHANNEL_SOURCE = `${SOURCE_ROOT}/channel-delivery.ts`;
const OFFICIAL_SOURCE = `${SOURCE_ROOT}/official-sign-in.ts`;
const MAIN_SOURCE = `${SOURCE_ROOT}/main.tsx`;

function hasEvidenceCode(...expectedCodes) {
  return (error) => {
    assert.ok(error instanceof ReferenceHostWebSourceAuditEvidenceError);
    assert.ok(expectedCodes.includes(error.code), `unexpected evidence code ${error.code}`);
    return true;
  };
}

async function sourceText(relativePath) {
  return readFile(path.join(WORKSPACE_ROOT, relativePath), "utf8");
}

async function rejectMutation(relativePath, mutate, expectedMessage) {
  const original = await sourceText(relativePath);
  await assert.rejects(
    inspectReferenceHostWebSourceAudit({
      sourceOverrides: { [relativePath]: mutate(original) },
    }),
    (error) => {
      assert.ok(error instanceof ReferenceHostWebSourceAuditEvidenceError);
      assert.equal(error.code, "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT");
      assert.match(error.message, expectedMessage);
      return true;
    },
  );
}

function syntheticDocumentation(sha256) {
  const artifact = "`reference-host-web-0.1.0-source-audit.json`";
  const digest = `\`sha256:${sha256}\``;
  return Object.freeze({
    proofText: [
      "# Proof",
      "",
      "## Evidence artifact",
      "",
      "- path: `docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json`",
      `- SHA-256: \`sha256:${sha256}\``,
      "",
    ].join("\n"),
    matrixText: [
      "# Matrix",
      "",
      `| P-06 | host parity | ${artifact} ${digest} |`,
      `| P-07 | source authority | ${artifact} ${digest} |`,
      `| P-10 | runtime adapter | ${artifact} ${digest} |`,
      "",
      "## M05-T09",
      "",
      artifact,
      digest,
      "",
    ].join("\n"),
    statusText: [
      "# Status",
      "",
      "M05-T09 evidence:",
      "",
      "- `docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json`",
      "- artifact SHA-256:",
      `  \`${sha256}\``,
      "",
    ].join("\n"),
  });
}

test("accepts the stored deterministic M05-T09 source/import audit", async () => {
  const result = await verifyReferenceHostWebSourceAuditEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(
    result.artifactSha256,
    "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89",
  );
  assert.equal(result.artifactBytes, 59_871);
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.sourceFiles, 12);
  assert.equal(result.jsxElements, 18);
  assert.equal(result.graphDynamicEdges, 0);
  assert.equal(result.packageBoundaryViolations, 0);
  assert.equal(result.exactDocumentationReferences, 12);
});

test("accepts unrelated ancestor entry churn without weakening directory identity checks", async () => {
  const temporary = await mkdtemp(path.join(WORKSPACE_ROOT, ".t09-reader-churn-"));
  const proofPath = path.join(temporary, "proof.md");
  const proofMatrixPath = path.join(temporary, "matrix.md");
  const projectStatusPath = path.join(temporary, "status.md");
  const churnPath = path.join(temporary, ".unrelated-churn");
  let keepChurning = true;
  let churns = 0;
  try {
    await Promise.all([
      writeFile(
        proofPath,
        await readFile(path.join(WORKSPACE_ROOT, "docs/proof/REFERENCE-HOST-WEB-SOURCE-AUDIT.md")),
      ),
      writeFile(
        proofMatrixPath,
        await readFile(path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md")),
      ),
      writeFile(projectStatusPath, await readFile(path.join(WORKSPACE_ROOT, "PROJECT-STATUS.md"))),
    ]);
    const churn = (async () => {
      while (keepChurning) {
        await writeFile(churnPath, String(churns));
        await unlink(churnPath);
        churns += 1;
        await new Promise((resolve) => setImmediate(resolve));
      }
    })();
    try {
      for (let index = 0; index < 3; index += 1) {
        const result = await verifyReferenceHostWebSourceAuditEvidence({
          proofPath,
          proofMatrixPath,
          projectStatusPath,
        });
        assert.equal(result.result, "PASS");
      }
    } finally {
      keepChurning = false;
      await churn;
    }
    assert.ok(churns > 0);
  } finally {
    keepChurning = false;
    await rm(temporary, { recursive: true, force: true });
  }
});

test("builds a deterministic real Vite graph and semantic TypeScript inventory", async () => {
  const first = await buildCurrentReferenceHostWebSourceAuditEvidence();
  const second = await buildCurrentReferenceHostWebSourceAuditEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.claim.g05Closed, true);
  assert.equal(first.artifact.claim.p07Status, "PARTIAL");
  assert.equal(first.artifact.sourceAudit.compilerAuthority, "TypeScript Program and TypeChecker");
  assert.equal(first.artifact.sourceAudit.sourceFiles, 13);
  assert.equal(first.artifact.sourceAudit.publicRuntimeReactRenderPreflightCalls, 1);
  assert.equal(first.artifact.sourceAudit.jsxElements, 18);
  const currentReceipts = new Map(
    first.artifact.evidence.trackedFiles.map((receipt) => [receipt.path, receipt]),
  );
  assert.deepEqual(currentReceipts.get("examples/sign-in/official-derived.bundle.desen.json"), {
    path: "examples/sign-in/official-derived.bundle.desen.json",
    bytes: 4_899,
    sha256: "sha256:f8068e54e0880a3ea8dc18a568c9b6e9ccbcead942da5708f88a1b650c9932ef",
  });
  assert.deepEqual(currentReceipts.get("packages/reference-catalog-web/catalog.json"), {
    path: "packages/reference-catalog-web/catalog.json",
    bytes: 8_439,
    sha256: "sha256:5d30b58b2ecb630fcefc70a2e5a5b1dc0b228d028ba768194c5b06429949727a",
  });
  assert.equal(first.artifact.runtimeResolution.tool, "vite@8.1.5");
  assert.equal(first.artifact.runtimeResolution.observer, "moduleParsed");
  assert.equal(first.artifact.runtimeResolution.independentBuilds, 2);
  assert.equal(first.artifact.runtimeResolution.deterministic, true);
  assert.equal(first.artifact.runtimeResolution.dynamicEdges, 0);
  assert.equal(first.artifact.runtimeResolution.backingFiles, 103);
  assert.equal(first.artifact.runtimeResolution.backingModulesStableAcrossSecondObservation, true);
  assert.equal(first.artifact.runtimeResolution.backingSnapshotObservations, 3);
  assert.equal(
    first.artifact.runtimeResolution.finalBackingReauthenticatedAfterDependencyBoundary,
    true,
  );
  assert.equal(first.artifact.buildEnvelope.htmlParser, "jsdom@29.1.1 exact canonical AST");
  assert.deepEqual(first.artifact.evidence.snapshotConsistency, {
    checkedPaths: 33,
    prePostIdentityMatched: true,
    sourceAndEnvelopeStableAcrossAudit: true,
  });
  assert.equal(
    first.artifact.packageBoundary.authority,
    "package-boundary evidence only; not runtime resolution authority",
  );
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.runtimeResolution.modules), true);
});

test("runs the authenticated current semantic and source audit", async () => {
  const result = await verifyCurrentReferenceHostWebSourceAuditEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.checkpoint.status, "PASS");
  assert.equal(result.trackedFiles, 25);
  assert.equal(result.sourceFiles, 13);
  assert.equal(result.graphModules, 104);
  assert.equal(result.graphDynamicEdges, 0);
  assert.equal(result.packageBoundaryViolations, 0);
});

test("pins exact JSX ownership and leaves every other production module JSX-free", async () => {
  const result = await inspectReferenceHostWebSourceAudit();
  assert.equal(result.sourceFiles, 13);
  assert.equal(result.executableSourceFiles, 12);
  assert.equal(result.jsxElements, 18);
  assert.deepEqual(Object.keys(result.jsxByFile).sort(), [
    `${SOURCE_ROOT}/application.tsx`,
    `${SOURCE_ROOT}/browser-profile.ts`,
    CHANNEL_SOURCE,
    `${SOURCE_ROOT}/failure-view.tsx`,
    `${SOURCE_ROOT}/host-ports.ts`,
    `${SOURCE_ROOT}/main.tsx`,
    `${SOURCE_ROOT}/managed-surface.tsx`,
    `${SOURCE_ROOT}/official-sign-in.ts`,
    `${SOURCE_ROOT}/recovery-authority.ts`,
    `${SOURCE_ROOT}/root-policy.ts`,
    `${SOURCE_ROOT}/root.tsx`,
    `${SOURCE_ROOT}/sign-in-http-handler.ts`,
  ]);
  for (const [relativePath, jsx] of Object.entries(result.jsxByFile)) {
    if (
      ![
        `${SOURCE_ROOT}/application.tsx`,
        `${SOURCE_ROOT}/failure-view.tsx`,
        `${SOURCE_ROOT}/managed-surface.tsx`,
        `${SOURCE_ROOT}/root.tsx`,
      ].includes(relativePath)
    ) {
      assert.deepEqual(jsx, []);
    }
  }
});

test("rejects aliased namespace and helper component-tree escapes", async () => {
  await rejectMutation(
    ROOT_SOURCE,
    (text) =>
      text
        .replace(
          'import { StrictMode } from "react";',
          'import { StrictMode as HiddenStrictMode } from "react";',
        )
        .replaceAll("<StrictMode>", "<HiddenStrictMode>")
        .replaceAll("</StrictMode>", "</HiddenStrictMode>"),
    /JSX ownership or inventory drifted/u,
  );
  await rejectMutation(
    ROOT_SOURCE,
    (text) =>
      text
        .replace('import { StrictMode } from "react";', 'import * as React from "react";')
        .replaceAll("<StrictMode>", "<React.StrictMode>")
        .replaceAll("</StrictMode>", "</React.StrictMode>"),
    /namespace import/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nfunction HiddenManagedTree() { return <main />; }\nvoid HiddenManagedTree;\n`,
    /JSX ownership or inventory drifted/u,
  );
});

test("rejects createElement JSX-runtime fake-element and plan-shaped escapes", async () => {
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nimport { createElement } from "react";\nconst hidden = createElement("main");\nvoid hidden;\n`,
    /unapproved external runtime value/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nimport { jsx } from "react/jsx-runtime";\nconst hidden = jsx("main", {});\nvoid hidden;\n`,
    /JSX runtime directly/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nconst hidden = { $$typeof: Symbol.for("react.element"), type: "main", key: null, props: {} };\nvoid hidden;\n`,
    /fake React-element marker/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nconst hidden = { capabilityId: "com.example.hidden", component: "Hidden", props: {} };\nvoid hidden;\n`,
    /plan, capability, or Source-node-shaped literal/u,
  );
});

test("rejects direct surfaces access and every dynamic executable primitive", async () => {
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) => `${text}\nvoid officialDerivedSignInBundle.surfaces;\n`,
    /Bundle\.surfaces/u,
  );
  for (const [addition, expected] of [
    ['void import("./application.js");', /dynamic import/u],
    ['void eval("0");', /dynamic executable primitive/u],
    ['void Function("return 0");', /dynamic executable primitive/u],
    ['void new Worker("/worker.js");', /dynamic worker or executable constructor/u],
    ['void document.createElement("script");', /DOM method outside the exact infrastructure/u],
    ["void WebAssembly;", /dynamic executable authority reference/u],
  ]) {
    await rejectMutation(MAIN_SOURCE, (text) => `${text}\n${addition}\n`, expected);
  }
});

test("rejects Source fixtures and every additional CSS or JSON data edge", async () => {
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text.replaceAll("official-derived.bundle.desen.json", "official-derived.source.desen.json"),
    /escapes the production source directory/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) => `import "./styles.css";\n${text}`,
    /data-import allowlist drifted/u,
  );
});

test("rejects substitutions inside the exact allowed composition functions", async () => {
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      text.replace(
        '<main className="reference-host" data-desen-host-state={status}>',
        '<main className="reference-host" dangerouslySetInnerHTML={{ __html: "<form />" }} data-desen-host-state={status}>',
      ),
    /Composition function HostNotice semantic fingerprint drifted/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) => text.replace("No managed interface is active.", "Email Password Sign in"),
    /Composition function HostNotice semantic fingerprint drifted/u,
  );
});

test("rejects aliased factories re-exports and sensitive runtime-call indirection", async () => {
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nimport { createElement as hiddenFactory } from "react";\nvoid hiddenFactory("main");\n`,
    /unapproved external runtime value/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nimport { cloneElement as hiddenClone } from "react";\nvoid hiddenClone({} as never);\n`,
    /unapproved external runtime value/u,
  );
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nexport { RuntimeReactSurfaceBoundary as HiddenBoundary } from "@desen/runtime-react";\n`,
    /production re-export edge/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text
        .replace(
          "createRuntimeReactAdapterRegistry }",
          "createRuntimeReactAdapterRegistry as hiddenRegistry }",
        )
        .replace(
          "const registry = createRuntimeReactAdapterRegistry(",
          "const registry = hiddenRegistry(",
        ),
    /public reference-adapter registry(?: path|\.)/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text
        .replace(
          "disposeRuntimeHeadlessSession, mountRuntimeHeadlessSession",
          "disposeRuntimeHeadlessSession, mountRuntimeHeadlessSession as hiddenMount",
        )
        .replace("const mounted = mountRuntimeHeadlessSession(", "const mounted = hiddenMount("),
    /public headless-session mount path/u,
  );
  await rejectMutation(
    `${SOURCE_ROOT}/managed-surface.tsx`,
    (text) =>
      text
        .replace("useRuntimeReactSurface }", "useRuntimeReactSurface as hiddenHook }")
        .replace(
          "const result = useRuntimeReactSurface(input);",
          "const result = hiddenHook(input);",
        ),
    /runtime-react plan path/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) => `${text}\nconst hiddenMount = mountRuntimeHeadlessSession;\nvoid hiddenMount;\n`,
    /aliases or captures a sensitive public runtime call/u,
  );
});

test("authenticates registry Bundle and Catalog identifiers to exact import symbols", async () => {
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text.replace(
        'import { REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT } from "@desen/reference-catalog-web/react-adapters";',
        'import "@desen/reference-catalog-web/react-adapters";\nconst REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT = Object.freeze([]);',
      ),
    /public reference-adapter registry path/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text.replace(
        'import officialDerivedSignInBundle from "../../../examples/sign-in/official-derived.bundle.desen.json";',
        'import "../../../examples/sign-in/official-derived.bundle.desen.json";\nconst officialDerivedSignInBundle = Object.freeze({});',
      ),
    /controlled Bundle and Catalog|closed executable call\/property-write authority surface/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) =>
      text.replace(
        'import referenceCatalog from "@desen/reference-catalog-web/catalog.json";',
        'import "@desen/reference-catalog-web/catalog.json";\nconst referenceCatalog = Object.freeze({});',
      ),
    /controlled Bundle and Catalog/u,
  );
});

test("rejects computed fake trees global authority access and DOM replacement", async () => {
  await rejectMutation(
    APPLICATION_SOURCE,
    (text) =>
      `${text}\nconst hidden = { ["$$" + "typeof"]: Symbol.for("react.element"), ["ty" + "pe"]: "main", ["pro" + "ps"]: {} };\nvoid hidden;\n`,
    /fake React-element marker/u,
  );
  await rejectMutation(
    OFFICIAL_SOURCE,
    (text) => `${text}\nvoid officialDerivedSignInBundle["sur" + "faces"];\n`,
    /surfaces-shaped escape/u,
  );
  await rejectMutation(
    MAIN_SOURCE,
    (text) => `${text}\nconst key = "eval";\nvoid window[key];\n`,
    /computed access on a browser global authority/u,
  );
  await rejectMutation(
    MAIN_SOURCE,
    (text) => `${text}\ndocument.body.innerHTML = "<form>handwritten</form>";\n`,
    /handwritten DOM replacement or mutation sink/u,
  );
  for (const addition of [
    'container.before(document.createTextNode("handwritten"));',
    'container.insertBefore(document.createTextNode("handwritten"), container.firstChild);',
    'container.setAttribute("class", "handwritten");',
  ]) {
    await rejectMutation(
      MAIN_SOURCE,
      (text) => `${text}\n${addition}\n`,
      /DOM method outside the exact infrastructure allowlist/u,
    );
  }
  await rejectMutation(
    MAIN_SOURCE,
    (text) => `${text}\ncontainer.style.cssText = "position:fixed;inset:0";\n`,
    /executable URL, event-handler, or DOM text property/u,
  );
  await rejectMutation(
    MAIN_SOURCE,
    (text) => `${text}\nObject.assign(container, { innerHTML: "<form>handwritten</form>" });\n`,
    /open-ended object mutation or descriptor surface/u,
  );
  await rejectMutation(
    MAIN_SOURCE,
    (text) => `${text}\nReflect.set(container, "innerHTML", "<form>handwritten</form>");\n`,
    /open-ended Reflect\.set mutation surface/u,
  );
  await rejectMutation(
    MAIN_SOURCE,
    (text) =>
      `${text}\nconst dynamicKey = "eval";\nvoid Object.getOwnPropertyDescriptor(globalThis, dynamicKey);\n`,
    /enumerates or reflects a browser global authority/u,
  );
  for (const addition of [
    'container.setAttribute.call(container, "class", "handwritten");',
    'Reflect.apply(container.setAttribute, container, ["class", "handwritten"]);',
  ]) {
    await rejectMutation(
      MAIN_SOURCE,
      (text) => `${text}\n${addition}\n`,
      /captures or invokes a DOM method outside the exact infrastructure allowlist/u,
    );
  }
  await rejectMutation(
    BROWSER_PROFILE_SOURCE,
    (text) =>
      text.replace(
        'return typeof browser.matchMedia === "function" && browser.matchMedia(query).matches;',
        'const captured = browser.matchMedia;\n  void captured;\n  return typeof browser.matchMedia === "function" && browser.matchMedia(query).matches;',
      ),
    /captures or invokes a DOM method outside the exact infrastructure allowlist/u,
  );
  for (const [addition, expected] of [
    [
      `void [].filter.constructor("document.body.outerText='forged'")();`,
      /dynamic executable authority or constructor chain/u,
    ],
    [
      `void Object.values(globalThis).find((value) => typeof value === "function");`,
      /enumerates or reflects a browser global authority/u,
    ],
    [
      `(container as HTMLElement).outerText = "forged";`,
      /executable URL, event-handler, or DOM text property/u,
    ],
    [
      `container["text" + "Content"] = "forged";`,
      /indexed handwritten DOM replacement or mutation sink/u,
    ],
    [
      `container.insertAdjacentText("beforeend", "forged");`,
      /DOM method outside the exact infrastructure allowlist/u,
    ],
    [
      `container.replaceChildren(document.createTextNode("forged"));`,
      /DOM method outside the exact infrastructure allowlist/u,
    ],
  ]) {
    await rejectMutation(MAIN_SOURCE, (text) => `${text}\n${addition}\n`, expected);
  }
});

test("rejects alternate React roots timers executable URLs and CSS visual substitutes", async () => {
  await rejectMutation(
    MAIN_SOURCE,
    (text) =>
      `import { hydrateRoot } from "react-dom/client";\n${text}\nhydrateRoot(container, "handwritten");\n`,
    /unapproved external runtime value/u,
  );
  for (const [addition, expected] of [
    [`setTimeout("document.body.innerHTML='<form/>'", 0);`, /global DOM executable/u],
    ['setInterval("javascript:" + "alert(1)", 1);', /executable javascript URL/u],
    ['window.open("javascript:alert(1)");', /executable javascript URL/u],
    [
      'window.location.href = "/replacement";',
      /executable URL, event-handler, or DOM text property/u,
    ],
  ]) {
    await rejectMutation(MAIN_SOURCE, (text) => `${text}\n${addition}\n`, expected);
  }
  const cssPath = `${SOURCE_ROOT}/styles.css`;
  await rejectMutation(
    cssPath,
    (text) =>
      `${text}\nbody::after { content: "Email Password Sign in"; position: fixed; inset: 0; }\n`,
    /Host infrastructure CSS contains forbidden generated content/u,
  );
  await rejectMutation(
    cssPath,
    (text) =>
      `${text}\nbody::be\\66 ore { c\\6f ntent: "Email Password Sign in"; p\\6f sition: fixed; }\n`,
    /Host infrastructure CSS contains forbidden generated content/u,
  );
  for (const [addition, expected] of [
    [
      `body { background-image: image-set("data:image/svg+xml,<svg><text>Email Password Sign in</text></svg>" 1x); }`,
      /forbidden generated image function/u,
    ],
    [`body { background: linear-gradient(red, blue); }`, /forbidden generated gradient image/u],
    [`body { mask: none; }`, /forbidden masking/u],
    [`body { filter: opacity(0); }`, /forbidden filtering/u],
    [`.reference-host { transform: scale(0); }`, /forbidden transform/u],
    [`.reference-host { scale: 0; }`, /forbidden scale/u],
    [`.reference-host { clip-path: inset(100%); }`, /forbidden clipping/u],
    [`body { accent-color: red; }`, /frozen canonical stylesheet/u],
  ]) {
    await rejectMutation(cssPath, (text) => `${text}\n${addition}\n`, expected);
  }
});

test("rejects DOM descriptor and callable-prototype authority extraction", async () => {
  for (const [addition, expected] of [
    [
      `const descriptorKey = ["outer", "HTML"].join("");\nconst setter = Object.getOwnPropertyDescriptor(Element.prototype, descriptorKey)?.set;\nsetter?.call(container, "<form>forged</form>");`,
      /reflects a DOM instance or prototype authority/u,
    ],
    [
      `const descriptorKey = ["replace", "Children"].join("");\nvoid Reflect.get(Element.prototype, descriptorKey);`,
      /reflects a DOM instance or prototype authority/u,
    ],
    [
      `const functionPrototype = Object.getPrototypeOf(() => undefined);\nconst functionDescriptors = Object.getOwnPropertyDescriptors(functionPrototype);\nconst dynamicExecutable = Object.values(functionDescriptors).find((descriptor) => typeof descriptor.value === "function" && descriptor.value.length === 1)?.value as ((body: string) => unknown) | undefined;\nvoid dynamicExecutable?.("document.body.outerHTML = '<form>forged</form>'");`,
      /reflects or enumerates a callable authority/u,
    ],
  ]) {
    await rejectMutation(MAIN_SOURCE, (text) => `${text}\n${addition}\n`, expected);
  }
});

test("pins the closed executable call and property-write authority surface", async () => {
  for (const addition of [
    `void Array.isArray([]);`,
    `const localWrite = { value: 0 };\nlocalWrite.value = 1;`,
  ]) {
    await rejectMutation(
      MAIN_SOURCE,
      (text) => `${text}\n${addition}\n`,
      /closed executable call\/property-write authority surface drifted/u,
    );
  }
});

test("discovers and rejects unknown and symlinked internal source entries", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t09-inventory-"));
  const workspaceRoot = await realpath(temporary);
  const sourceRoot = path.join(workspaceRoot, SOURCE_ROOT);
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(path.join(sourceRoot, "main.tsx"), "export {};\n");
  try {
    assert.deepEqual(await inspectReferenceHostWebSourceInventory({ workspaceRoot }), [
      `${SOURCE_ROOT}/main.tsx`,
    ]);
    const unknown = path.join(sourceRoot, "hidden.svg");
    await writeFile(unknown, "<svg />");
    await assert.rejects(
      inspectReferenceHostWebSourceInventory({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
    );
    await unlink(unknown);
    const target = path.join(workspaceRoot, "target.ts");
    await writeFile(target, "export {};\n");
    await symlink(target, path.join(sourceRoot, "hidden.ts"));
    await assert.rejects(
      inspectReferenceHostWebSourceInventory({ workspaceRoot }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects Vite public environment PostCSS and local config entry surfaces", () => {
  for (const entry of [
    "public",
    "PUBLIC",
    ".env.production",
    ".ENV.production",
    ".postcssrc.cjs",
    ".POSTCSSRC.cJs",
    ".postcssrc.json",
    "postcss.config.cjs",
    "POSTCSS.CONFIG.cjs",
    "vite.config.ts",
    "VITE.CONFIG.ts",
  ]) {
    assert.throws(
      () => verifyReferenceHostWebBuildEnvelopeEntryPolicy(["index.html", "package.json", entry]),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
    );
  }
  for (const entries of [
    ["index.html", "PACKAGE.JSON"],
    ["index.html", "package.json", "PACKAGE.JSON"],
    ["index.html", "package.json", "ＰＯＳＴＣＳＳ.CONFIG.cjs"],
  ]) {
    assert.throws(
      () => verifyReferenceHostWebBuildEnvelopeEntryPolicy(entries),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
    );
  }
  for (const scope of ["reference-host application root", "applications root", "workspace root"]) {
    for (const entry of [
      ".postcssrc.cjs",
      ".POSTCSSRC.cJs",
      ".postcssrc.json",
      "postcss.config.mjs",
      "POSTCSS.CONFIG.mjs",
    ]) {
      assert.throws(
        () =>
          verifyReferenceHostWebPostCssBuildEnvelopePolicy(["package.json", entry], "{}", {
            scope,
          }),
        hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
      );
    }
    assert.throws(
      () =>
        verifyReferenceHostWebPostCssBuildEnvelopePolicy(
          ["package.json"],
          '{"postcss":{"plugins":[]}}',
          { scope },
        ),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
    );
  }
  assert.equal(
    verifyReferenceHostWebPostCssBuildEnvelopePolicy(["reference-host-web"], "{}", {
      packageJsonOptional: true,
      scope: "applications root",
    }).result,
    "PASS",
  );
});

test("parses only the exact canonical HTML node and attribute envelope", async () => {
  const pristine = await sourceText("apps/reference-host-web/index.html");
  const result = await verifyReferenceHostWebHtmlEnvelopePolicy(pristine);
  assert.equal(result.parser, "jsdom@29.1.1 exact canonical AST");
  for (const mutation of [
    pristine.replace(
      '<meta charset="UTF-8" />',
      '<meta http-equiv="refresh" content="0;url=https://evil.example" />',
    ),
    pristine.replace("<body>", '<body style="background:url(data:image/svg+xml,evil)">'),
    pristine.replace(
      '<div id="desen-reference-host-root"></div>',
      '<div id="desen-reference-host-root"><!-- forged --></div>',
    ),
  ]) {
    await assert.rejects(
      verifyReferenceHostWebHtmlEnvelopePolicy(mutation),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
    );
  }
});

test("rejects orphan unresolved dynamic forbidden and substituted runtime graphs", async () => {
  const built = await buildCurrentReferenceHostWebSourceAuditEvidence();
  const pristine = structuredClone(built.artifact.runtimeResolution.modules);
  const sourcePaths = pristine
    .map(({ id }) => id)
    .filter((id) => id.startsWith(`${SOURCE_ROOT}/`))
    .sort();
  const rejectGraph = (graph, paths, expectedMessage) => {
    assert.throws(
      () => verifyReferenceHostWebSourceGraphPolicy(graph, paths),
      (error) => {
        assert.ok(error instanceof ReferenceHostWebSourceAuditEvidenceError);
        assert.equal(error.code, "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT");
        assert.match(error.message, expectedMessage);
        return true;
      },
    );
  };
  rejectGraph(pristine, [...sourcePaths, `${SOURCE_ROOT}/orphan.ts`], /orphan or unexpected/u);
  const unresolved = structuredClone(pristine);
  unresolved.find(({ id }) => id === MAIN_SOURCE).imports.push(`${SOURCE_ROOT}/missing.ts`);
  rejectGraph(unresolved, sourcePaths, /unresolved or externalized/u);
  const dynamic = structuredClone(pristine);
  dynamic.find(({ id }) => id === MAIN_SOURCE).dynamicImports.push(APPLICATION_SOURCE);
  rejectGraph(dynamic, sourcePaths, /dynamic import edge/u);
  const substituted = structuredClone(pristine);
  const official = substituted.find(({ id }) => id === OFFICIAL_SOURCE);
  official.imports = official.imports.filter(
    (entry) => entry !== "packages/reference-catalog-web/dist/react-adapters/index.js",
  );
  rejectGraph(substituted, sourcePaths, /public adapter and runtime-react entrypoints/u);
  const forbidden = structuredClone(pristine);
  forbidden.find(({ id }) => id === MAIN_SOURCE).imports.push("packages/editor-core/dist/index.js");
  forbidden.push({
    id: "packages/editor-core/dist/index.js",
    imports: [],
    dynamicImports: [],
    codeBytes: 1,
    codeSha256: `sha256:${"0".repeat(64)}`,
  });
  rejectGraph(forbidden, sourcePaths, /closed transitive runtime envelope/u);
  const transitiveEditor = structuredClone(pristine);
  transitiveEditor
    .find(({ id }) => id === "packages/runtime-react/dist/index.js")
    .imports.push("packages/editor-core/dist/index.js");
  transitiveEditor.push({
    id: "packages/editor-core/dist/index.js",
    imports: [],
    dynamicImports: [],
    codeBytes: 1,
    codeSha256: `sha256:${"1".repeat(64)}`,
  });
  rejectGraph(transitiveEditor, sourcePaths, /closed runtime architecture/u);
  const wrongArchitecture = structuredClone(pristine);
  wrongArchitecture
    .find(({ id }) => id === "packages/runtime-core/dist/index.js")
    .imports.push("packages/reference-catalog-web/catalog.json");
  rejectGraph(wrongArchitecture, sourcePaths, /closed runtime architecture/u);
});

test("rejects malformed duplicate and hostile graph seam containers", async () => {
  const built = await buildCurrentReferenceHostWebSourceAuditEvidence();
  const pristine = structuredClone(built.artifact.runtimeResolution.modules);
  const sourcePaths = pristine
    .map(({ id }) => id)
    .filter((id) => id.startsWith(`${SOURCE_ROOT}/`))
    .sort();
  const rejectOptions = (graph = pristine, paths = sourcePaths) => {
    assert.throws(
      () => verifyReferenceHostWebSourceGraphPolicy(graph, paths),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
    );
  };
  const missing = structuredClone(pristine);
  delete missing[0].codeSha256;
  rejectOptions(missing);
  const extra = structuredClone(pristine);
  extra[0].unexpected = true;
  rejectOptions(extra);
  const invalidHash = structuredClone(pristine);
  invalidHash[0].codeSha256 = "sha256:missing";
  rejectOptions(invalidHash);
  const duplicate = structuredClone(pristine);
  duplicate.push(structuredClone(duplicate[0]));
  assert.throws(
    () => verifyReferenceHostWebSourceGraphPolicy(duplicate, sourcePaths),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT"),
  );

  let executed = false;
  const ownMap = structuredClone(pristine);
  Object.defineProperty(ownMap, "map", {
    enumerable: true,
    value() {
      executed = true;
    },
  });
  rejectOptions(ownMap);
  assert.equal(executed, false);

  const accessor = structuredClone(pristine);
  const first = accessor[0];
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    get() {
      executed = true;
      return first;
    },
  });
  rejectOptions(accessor);
  assert.equal(executed, false);

  const holed = structuredClone(pristine);
  delete holed[0];
  rejectOptions(holed);
  const symbolKeyed = structuredClone(pristine);
  symbolKeyed[Symbol("hidden")] = true;
  rejectOptions(symbolKeyed);

  class GraphSubclass extends Array {}
  rejectOptions(new GraphSubclass(...pristine));

  const hostileImports = structuredClone(pristine);
  const moduleWithImports = hostileImports.find(({ imports }) => imports.length > 0);
  Object.defineProperty(moduleWithImports.imports, "map", {
    enumerable: true,
    value() {
      executed = true;
    },
  });
  rejectOptions(hostileImports);
  assert.equal(executed, false);

  const accessorImports = structuredClone(pristine);
  const accessorImportModule = accessorImports.find(({ imports }) => imports.length > 0);
  const firstImport = accessorImportModule.imports[0];
  Object.defineProperty(accessorImportModule.imports, "0", {
    enumerable: true,
    get() {
      executed = true;
      return firstImport;
    },
  });
  rejectOptions(accessorImports);
  assert.equal(executed, false);

  class ImportsSubclass extends Array {}
  const subclassImports = structuredClone(pristine);
  subclassImports[0].imports = new ImportsSubclass(...subclassImports[0].imports);
  rejectOptions(subclassImports);

  const dynamicOwnMap = structuredClone(pristine);
  Object.defineProperty(dynamicOwnMap[0].dynamicImports, "map", {
    enumerable: true,
    value() {
      executed = true;
    },
  });
  rejectOptions(dynamicOwnMap);
  assert.equal(executed, false);

  const dynamicAccessor = structuredClone(pristine);
  dynamicAccessor[0].dynamicImports = [MAIN_SOURCE];
  Object.defineProperty(dynamicAccessor[0].dynamicImports, "0", {
    enumerable: true,
    get() {
      executed = true;
      return MAIN_SOURCE;
    },
  });
  rejectOptions(dynamicAccessor);
  assert.equal(executed, false);

  class DynamicImportsSubclass extends Array {}
  const subclassDynamic = structuredClone(pristine);
  subclassDynamic[0].dynamicImports = new DynamicImportsSubclass();
  rejectOptions(subclassDynamic);

  const sourceAccessor = [...sourcePaths];
  const firstSource = sourceAccessor[0];
  Object.defineProperty(sourceAccessor, "0", {
    enumerable: true,
    get() {
      executed = true;
      return firstSource;
    },
  });
  rejectOptions(pristine, sourceAccessor);
  assert.equal(executed, false);

  const sourceOwnMap = [...sourcePaths];
  Object.defineProperty(sourceOwnMap, "map", {
    enumerable: true,
    value() {
      executed = true;
    },
  });
  rejectOptions(pristine, sourceOwnMap);
  assert.equal(executed, false);

  class SourcePathsSubclass extends Array {}
  rejectOptions(pristine, new SourcePathsSubclass(...sourcePaths));
});

test("rejects Vite backing-module state drift through the production snapshot policy", () => {
  const before = [
    {
      id: "packages/runtime-core/dist/index.js",
      path: "packages/runtime-core/dist/index.js",
      dev: "1",
      ino: "2",
      size: "1",
      mtimeNs: "3",
      ctimeNs: "4",
      bytes: 1,
      sha256: `sha256:${"a".repeat(64)}`,
    },
  ];
  assert.equal(
    verifyReferenceHostWebBackingSnapshotPolicy(
      before,
      structuredClone(before),
      structuredClone(before),
    ).backingFiles,
    1,
  );
  const after = structuredClone(before);
  after[0].sha256 = `sha256:${"b".repeat(64)}`;
  assert.throws(
    () => verifyReferenceHostWebBackingSnapshotPolicy(before, structuredClone(before), after),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_GRAPH_NONDETERMINISTIC"),
  );
});

test("rejects unknown override paths and hostile option containers", async () => {
  await assert.rejects(
    inspectReferenceHostWebSourceAudit({
      sourceOverrides: { [`${SOURCE_ROOT}/unknown.ts`]: "export {};" },
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
  const accessor = {};
  Object.defineProperty(accessor, "workspaceRoot", {
    enumerable: true,
    get() {
      throw new Error("must not run");
    },
  });
  await assert.rejects(
    inspectReferenceHostWebSourceAudit(accessor),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
  await assert.rejects(
    inspectReferenceHostWebSourceAudit(new Proxy({}, {})),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
  await assert.rejects(
    inspectReferenceHostWebSourceAudit({ [Symbol("hostile")]: true }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
});

test("authenticates the exact dependency-cruiser rule and rejects removal or drift", () => {
  const expectedRule = {
    name: "application-reference-host-web-allowed-dependencies",
    severity: "error",
    comment: "reference-host-web may import only the packages assigned to its responsibility.",
    from: { path: "^apps/reference-host-web/" },
    to: {
      path: "^packages/",
      pathNot: "^packages/(?:runtime-core|runtime-react|runtime-web|reference-catalog-web)/",
    },
  };
  const configuration = { forbidden: [expectedRule], options: {} };
  assert.equal(
    verifyReferenceHostWebDependencyBoundaryConfiguration(configuration).rule.name,
    expectedRule.name,
  );
  for (const mutation of [
    { forbidden: [], options: {} },
    {
      forbidden: [{ ...structuredClone(expectedRule), severity: "warn" }],
      options: {},
    },
    {
      forbidden: [structuredClone(expectedRule), structuredClone(expectedRule)],
      options: {},
    },
  ]) {
    assert.throws(
      () => verifyReferenceHostWebDependencyBoundaryConfiguration(mutation),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_BOUNDARY_DRIFT"),
    );
  }
});

test("derives every default evidence path from one custom workspace authority", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t09-paths-"));
  const workspaceRoot = await realpath(temporary);
  try {
    const resolved = await resolveReferenceHostWebSourceAuditWorkspacePaths({
      workspaceRoot,
    });
    assert.equal(
      resolved.artifactPath,
      path.join(workspaceRoot, "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json"),
    );
    assert.equal(
      resolved.proofPath,
      path.join(workspaceRoot, "docs/proof/REFERENCE-HOST-WEB-SOURCE-AUDIT.md"),
    );
    assert.equal(resolved.proofMatrixPath, path.join(workspaceRoot, "docs/proof/PROOF-MATRIX.md"));
    assert.equal(resolved.projectStatusPath, path.join(workspaceRoot, "PROJECT-STATUS.md"));
    await assert.rejects(
      resolveReferenceHostWebSourceAuditWorkspacePaths({
        workspaceRoot,
        artifactPath: path.join(workspaceRoot, "..", "outside.json"),
      }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects ambiguous verifier inputs and a FIFO artifact without blocking", async () => {
  await assert.rejects(
    verifyReferenceHostWebSourceAuditEvidence({
      proofPath: "proof.md",
      proofDocumentText: "proof",
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
  const temporary = await mkdtemp(path.join(WORKSPACE_ROOT, ".t09-fifo-"));
  const canonicalTemporary = await realpath(temporary);
  const fifoPath = path.join(canonicalTemporary, "artifact.fifo");
  try {
    execFileSync("mkfifo", [fifoPath]);
    await assert.rejects(
      verifyReferenceHostWebSourceAuditEvidence({ artifactPath: fifoPath }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(canonicalTemporary, { recursive: true, force: true });
  }
});

test("historical receipt APIs reject live-build and successor injection", async () => {
  for (const operation of [
    () => buildReferenceHostWebSourceAuditEvidence({ workspaceRoot: WORKSPACE_ROOT }),
    () =>
      verifyReferenceHostWebSourceAuditEvidence({
        workspaceRoot: WORKSPACE_ROOT,
      }),
    () =>
      writeReferenceHostWebSourceAuditEvidence({
        workspaceRoot: WORKSPACE_ROOT,
      }),
    () =>
      buildReferenceHostWebSourceAuditEvidence({
        sourceOverrides: { [MAIN_SOURCE]: "export {};" },
      }),
    () =>
      writeReferenceHostWebSourceAuditEvidence({
        proofDocumentText: "successor content",
      }),
  ]) {
    await assert.rejects(
      operation(),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
    );
  }
});

test("rejects a symlinked workspace root before reading production source", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t09-root-"));
  const linkedRoot = path.join(temporary, "workspace");
  try {
    await symlink(WORKSPACE_ROOT, linkedRoot, "dir");
    await assert.rejects(
      inspectReferenceHostWebSourceAudit({ workspaceRoot: linkedRoot }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE"),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("accepts only exact contextual final and pending proof-document pins", () => {
  const digest = "a".repeat(64);
  const documentation = syntheticDocumentation(digest);
  assert.equal(
    verifyReferenceHostWebSourceAuditDocumentation(
      documentation.proofText,
      documentation.matrixText,
      documentation.statusText,
      digest,
    ).exactReferences,
    12,
  );
  const pending = syntheticDocumentation("[PENDING_FINAL_ARTIFACT_SHA256]");
  assert.equal(
    verifyReferenceHostWebSourceAuditProofDocument(
      pending.proofText,
      "[PENDING_FINAL_ARTIFACT_SHA256]",
      { allowPending: true },
    ).exactReferences,
    2,
  );
  assert.throws(
    () =>
      verifyReferenceHostWebSourceAuditProofDocument(
        pending.proofText,
        "[PENDING_FINAL_ARTIFACT_SHA256]",
      ),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID"),
  );
});

test("rejects decoy digest associations across every documentation context", () => {
  const digest = "b".repeat(64);
  const decoy = "c".repeat(64);
  const documentation = syntheticDocumentation(digest);
  const cases = [
    {
      key: "proofText",
      value: documentation.proofText.replace(
        `sha256:${digest}`,
        `sha256:${decoy}\n\nDecoy sha256:${digest}`,
      ),
    },
    {
      key: "matrixText",
      value: documentation.matrixText
        .replace(
          `| P-07 | source authority | \`reference-host-web-0.1.0-source-audit.json\` \`sha256:${digest}\` |`,
          `| P-07 | source authority | \`reference-host-web-0.1.0-source-audit.json\` \`sha256:${decoy}\` |`,
        )
        .concat(`\nDecoy \`sha256:${digest}\`\n`),
    },
    {
      key: "statusText",
      value: documentation.statusText.replace(
        `  \`${digest}\``,
        `  \`${decoy}\`\n- decoy \`${digest}\``,
      ),
    },
  ];
  for (const mutation of cases) {
    assert.throws(
      () =>
        verifyReferenceHostWebSourceAuditDocumentation(
          mutation.key === "proofText" ? mutation.value : documentation.proofText,
          mutation.key === "matrixText" ? mutation.value : documentation.matrixText,
          mutation.key === "statusText" ? mutation.value : documentation.statusText,
          digest,
        ),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_DRIFT"),
    );
  }
});

test("rejects one-byte and semantic stored-artifact tampering", async () => {
  const pristine = (await buildReferenceHostWebSourceAuditEvidence()).artifactBytes;
  const artifact = JSON.parse(pristine.toString("utf8"));
  artifact.claim.g05Closed = false;
  const docs = syntheticDocumentation("0".repeat(64));
  await assert.rejects(
    verifyReferenceHostWebSourceAuditEvidence({
      artifactBytes: Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`),
      proofDocumentText: docs.proofText,
      proofMatrixText: docs.matrixText,
      projectStatusText: docs.statusText,
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT"),
  );
  const oneByte = Buffer.from(pristine);
  oneByte[0] ^= 1;
  await assert.rejects(
    verifyReferenceHostWebSourceAuditEvidence({
      artifactBytes: oneByte,
      proofDocumentText: docs.proofText,
      proofMatrixText: docs.matrixText,
      projectStatusText: docs.statusText,
    }),
    hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT"),
  );
});

test("default writer preserves immutable bytes and alternate writes are exact copies", async () => {
  const historicalPath = path.join(
    WORKSPACE_ROOT,
    "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json",
  );
  const beforeState = await lstat(historicalPath, { bigint: true });
  const beforeBytes = await readFile(historicalPath);
  let hookRan = false;
  const preserved = await writeReferenceHostWebSourceAuditEvidence({
    beforeAtomicRename() {
      hookRan = true;
    },
  });
  const afterState = await lstat(historicalPath, { bigint: true });
  assert.equal(preserved.preserved, true);
  assert.equal(hookRan, false);
  assert.equal(afterState.dev, beforeState.dev);
  assert.equal(afterState.ino, beforeState.ino);
  assert.equal(afterState.size, beforeState.size);
  assert.equal(afterState.mtimeNs, beforeState.mtimeNs);
  assert.equal(afterState.ctimeNs, beforeState.ctimeNs);
  assert.deepEqual(await readFile(historicalPath), beforeBytes);

  const temporary = await mkdtemp(path.join(WORKSPACE_ROOT, ".t09-copy-"));
  const artifactPath = path.join(temporary, "receipt.json");
  try {
    const copied = await writeReferenceHostWebSourceAuditEvidence({ artifactPath });
    assert.equal(copied.preserved, false);
    assert.equal(
      copied.artifactSha256,
      "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89",
    );
    assert.deepEqual(await readFile(artifactPath), beforeBytes);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("keeps the previous artifact intact when the atomic pre-rename hook fails", async () => {
  const temporary = await mkdtemp(path.join(WORKSPACE_ROOT, ".t09-atomic-"));
  const artifactPath = path.join(temporary, "receipt.json");
  const sentinel = Buffer.from("previous-safe-bytes");
  await writeFile(artifactPath, sentinel);
  try {
    await assert.rejects(
      writeReferenceHostWebSourceAuditEvidence({
        artifactPath,
        beforeAtomicRename() {
          throw new Error("injected interruption");
        },
      }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE"),
    );
    assert.deepEqual(await readFile(artifactPath), sentinel);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("rejects atomic parent replacement without touching an external symlink target", async () => {
  const temporary = await mkdtemp(path.join(WORKSPACE_ROOT, ".t09-parent-race-"));
  const lexicalParent = path.join(temporary, "artifact-parent");
  const movedParent = path.join(temporary, "artifact-parent-original");
  const external = await mkdtemp(path.join(os.tmpdir(), "desen-t09-external-"));
  const externalSentinel = path.join(external, "sentinel.txt");
  const artifactPath = path.join(lexicalParent, "receipt.json");
  await mkdir(lexicalParent);
  await writeFile(externalSentinel, "external-safe");
  let hookRan = false;
  try {
    await assert.rejects(
      writeReferenceHostWebSourceAuditEvidence({
        artifactPath,
        async beforeAtomicRename({ temporaryPath }) {
          hookRan = true;
          assert.equal(path.dirname(temporaryPath), lexicalParent);
          await rename(lexicalParent, movedParent);
          await symlink(external, lexicalParent, "dir");
        },
      }),
      hasEvidenceCode("REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE"),
    );
    assert.equal(hookRan, true);
    assert.equal(await readFile(externalSentinel, "utf8"), "external-safe");
    assert.equal(
      await lstat(path.join(external, "receipt.json")).catch((error) =>
        error?.code === "ENOENT" ? undefined : null,
      ),
      undefined,
    );
    assert.deepEqual(await readdir(external), ["sentinel.txt"]);
    const abandoned = await readdir(movedParent);
    assert.equal(abandoned.length, 1);
    assert.match(abandoned[0], /^\.receipt\.json\.[0-9a-f]{24}\.tmp$/u);
  } finally {
    const lexicalEntry = await lstat(lexicalParent).catch(() => undefined);
    if (lexicalEntry?.isSymbolicLink() === true) {
      await unlink(lexicalParent);
    }
    await rm(temporary, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  }
});
