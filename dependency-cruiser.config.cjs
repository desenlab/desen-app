/** @type {Record<string, readonly string[]>} */
const allowedPackageDependencies = {
  protocol: [],
  validator: ["protocol"],
  publisher: ["protocol", "validator"],
  "catalog-sdk": ["protocol"],
  "runtime-core": ["protocol", "validator"],
  "runtime-react": ["protocol", "validator", "runtime-core"],
  "runtime-web": ["protocol", "validator", "runtime-core"],
  "editor-core": ["protocol", "validator"],
  "design-system-core": ["protocol", "editor-core"],
  "design-system-authoring": ["protocol", "design-system-core"],
  "editor-web": [
    "protocol",
    "validator",
    "catalog-sdk",
    "editor-core",
    "runtime-core",
    "runtime-react",
  ],
  "reference-catalog-web": ["protocol", "catalog-sdk", "runtime-react"],
  "starter-catalog-web": ["protocol", "catalog-sdk", "runtime-react"],
  testkit: [
    "protocol",
    "validator",
    "publisher",
    "catalog-sdk",
    "runtime-core",
    "runtime-react",
    "runtime-web",
    "editor-core",
    "editor-web",
    "reference-catalog-web",
  ],
  desen: [
    "protocol",
    "validator",
    "publisher",
    "catalog-sdk",
    "runtime-core",
    "runtime-react",
    "runtime-web",
    "testkit",
  ],
};

/** @type {Record<string, readonly string[]>} */
const allowedApplicationDependencies = {
  "control-plane-api": [
    "protocol",
    "validator",
    "publisher",
    "catalog-sdk",
    "runtime-core",
    "testkit",
  ],
  "desen-app-browser-e2e": ["editor-core"],
  "starter-catalog-web-proof": [
    "protocol",
    "editor-core",
    "publisher",
    "runtime-core",
    "runtime-react",
    "starter-catalog-web",
  ],
  "design-system-workbench-proof": ["design-system-authoring"],
  "desen-app": [
    "protocol",
    "validator",
    "publisher",
    "catalog-sdk",
    "runtime-core",
    "runtime-react",
    "runtime-web",
    "editor-core",
    "editor-web",
    "reference-catalog-web",
    "testkit",
    "desen",
  ],
  "desen-run": ["protocol", "validator", "testkit", "desen"],
  "reference-host-web": ["runtime-core", "runtime-react", "runtime-web", "reference-catalog-web"],
  "reference-host-web-server": ["protocol"],
};

const neutralProductionSourcePath =
  "^packages/(protocol|validator|publisher|catalog-sdk|runtime-core|editor-core|design-system-core|design-system-authoring)/src/";
const desenAppBrowserProductProofServerPath =
  "^apps/desen-app-browser-e2e/product-proof-server\\.mjs$";
const desenAppBrowserRecoveryProofServerPath =
  "^apps/desen-app-browser-e2e/restart-recovery-proof-server\\.mjs$";
const desenAppBrowserRepeatableDemoProofServerPath =
  "^apps/desen-app-browser-e2e/repeatable-demo-proof-server\\.mjs$";
const desenAppBrowserRepeatableDemoAuthoringPath =
  "^apps/desen-app-browser-e2e/repeatable-demo-authoring\\.ts$";
const referenceHostSignInTestPath = "^apps/reference-host-web/test/official-sign-in\\.test\\.tsx$";
const desenAppBrowserPublicationServerPaths =
  "^apps/desen-app-browser-e2e/(?:published-host-proof-server|restart-recovery-proof-server)\\.mjs$";
const desenAppBrowserServerPaths =
  "^apps/desen-app-browser-e2e/(?:product-proof-server|published-host-proof-server|restart-recovery-proof-server)\\.mjs$";
const protocolPublicBuildEntryPath = "^packages/protocol/dist/index\\.(?:d\\.ts|js)$";
const controlPlanePublicBuildEntryPath = "^apps/control-plane-api/dist/index\\.(?:d\\.ts|js)$";
const desenAppLocalOperationHostPath = "^apps/desen-app/dev/local-operation-host\\.mjs$";
const desenAppLocalPublicationHostPath = "^apps/desen-app/dev/local-publication-host\\.mjs$";
const desenAppLocalDemoHostPath = "^apps/desen-app/dev/local-demo-host\\.mjs$";
const referenceHostServerPublicBuildEntryPath =
  "^apps/reference-host-web-server/dist/index\\.(?:d\\.ts|js)$";

/**
 * Builds a regular expression for package folders. The current package is included because
 * relative imports inside a package are legal; only cross-package edges are constrained.
 *
 * @param {readonly string[]} packageNames package folder names
 */
function packagePath(packageNames) {
  return `^packages/(?:${packageNames.join("|")})/`;
}

/**
 * Converts the dependency table above into deny-by-default cross-package rules. New package
 * edges require an intentional architecture change instead of silently entering the graph.
 */
const packageAllowlistRules = Object.entries(allowedPackageDependencies).map(
  ([packageName, allowedDependencies]) => ({
    name: `package-${packageName}-allowed-dependencies`,
    severity: "error",
    comment: `${packageName} may import only its documented internal dependencies.`,
    from: { path: `^packages/${packageName}/` },
    to: {
      path: "^packages/",
      pathNot: packagePath([packageName, ...allowedDependencies]),
    },
  }),
);

/**
 * Applications are composition roots, but each one still receives an explicit internal-package
 * allowlist. In particular, the reference host cannot acquire editor or publisher behavior.
 */
const applicationAllowlistRules = Object.entries(allowedApplicationDependencies).map(
  ([applicationName, allowedDependencies]) => ({
    name: `application-${applicationName}-allowed-dependencies`,
    severity: "error",
    comment: `${applicationName} may import only the packages assigned to its responsibility.`,
    from: {
      path: `^apps/${applicationName}/`,
      ...(applicationName === "desen-app-browser-e2e"
        ? {
            pathNot: `(?:${desenAppBrowserRecoveryProofServerPath}|${desenAppBrowserRepeatableDemoAuthoringPath})`,
          }
        : applicationName === "reference-host-web"
          ? { pathNot: referenceHostSignInTestPath }
          : {}),
    },
    to: {
      path: "^packages/",
      pathNot: packagePath(allowedDependencies),
    },
  }),
);

/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "Every import must resolve to a real module.",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-non-package-json",
      severity: "error",
      comment:
        "Workspace code must declare every npm dependency in its own package.json so packed packages do not rely on root hoisting.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "packages-never-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    ...packageAllowlistRules,
    ...applicationAllowlistRules,
    {
      name: "starter-proof-host-has-no-authoring",
      severity: "error",
      comment:
        "The independent starter browser host and shared runtime consume Bundles, never authoring, publishing or App code.",
      from: { path: "^apps/starter-catalog-web-proof/src/(?:host|shared)/" },
      to: {
        path: "^(?:packages/(?:editor-core|editor-web|publisher|testkit|desen)/|apps/)",
        pathNot: "^apps/starter-catalog-web-proof/src/(?:(?:host|shared)/|application\\.css$)",
      },
    },
    {
      name: "starter-proof-has-no-other-apps",
      severity: "error",
      from: { path: "^apps/starter-catalog-web-proof/" },
      to: { path: "^apps/(?!starter-catalog-web-proof/)" },
    },
    {
      name: "design-system-workbench-proof-has-no-other-apps",
      severity: "error",
      comment:
        "The isolated design-system workbench proof cannot acquire Desen App or another application composition root.",
      from: { path: "^apps/design-system-workbench-proof/" },
      to: { path: "^apps/(?!design-system-workbench-proof/)" },
    },
    {
      name: "reviewed-canonical-proof-protocol-public-root-only",
      severity: "error",
      comment:
        "Only the exact repeatable-demo authoring observer may authenticate canonical bytes using the public Protocol entry; private Protocol modules and other package edges remain forbidden.",
      from: { path: desenAppBrowserRepeatableDemoAuthoringPath },
      to: { path: "^packages/", pathNot: protocolPublicBuildEntryPath },
    },
    {
      name: "reference-host-sign-in-test-reviewed-packages-only",
      severity: "error",
      comment:
        "The exact official host sign-in test retains the host's existing package edges and may additionally recompute Bundle revisions using only the public Protocol entry; private Protocol and every other package remain forbidden.",
      from: { path: referenceHostSignInTestPath },
      to: {
        path: "^packages/",
        pathNot: `(?:${protocolPublicBuildEntryPath}|${packagePath(allowedApplicationDependencies["reference-host-web"])})`,
      },
    },
    {
      name: "desen-app-browser-e2e-recovery-server-protocol-public-root-only",
      severity: "error",
      comment:
        "Only the exact recovery proof server may create adversarial Bundle bytes with the public protocol digest API; private protocol modules and every other package remain forbidden.",
      from: { path: desenAppBrowserRecoveryProofServerPath },
      to: { path: "^packages/", pathNot: protocolPublicBuildEntryPath },
    },
    {
      name: "desen-app-browser-e2e-reviewed-app-source-only",
      severity: "error",
      comment:
        "The isolated browser proof may compose only the reviewed Desen App application, empty-project bootstrap, explicit reference workspace profile, and stylesheet entries.",
      from: {
        path: "^apps/desen-app-browser-e2e/",
        pathNot: `(?:${desenAppBrowserServerPaths}|${desenAppBrowserRepeatableDemoProofServerPath})`,
      },
      to: {
        path: "^apps/(?!desen-app-browser-e2e/)",
        pathNot:
          "^apps/desen-app/src/(?:application\\.tsx|reference-empty-project\\.ts|reference-sign-in-workspace-profile\\.ts|styles\\.css)$",
      },
    },
    {
      name: "desen-app-browser-e2e-repeatable-demo-server-normal-launcher-only",
      severity: "error",
      comment:
        "Only the exact repeatable-demo proof server may invoke the normal local demo lifecycle; direct package, storage, activation, and other application composition imports remain forbidden.",
      from: { path: desenAppBrowserRepeatableDemoProofServerPath },
      to: {
        path: "^(?:apps/(?!desen-app-browser-e2e/)|packages/)",
        pathNot: desenAppLocalDemoHostPath,
      },
    },
    {
      name: "desen-app-browser-e2e-product-server-control-plane-public-root-only",
      severity: "error",
      comment:
        "The normal-product proof server may compose the built public control-plane entry, never its source tree or a deep/private build module.",
      from: { path: desenAppBrowserServerPaths },
      to: {
        path: "^apps/control-plane-api/",
        pathNot: controlPlanePublicBuildEntryPath,
      },
    },
    {
      name: "desen-app-browser-e2e-published-server-reference-host-public-root-only",
      severity: "error",
      comment:
        "The published-host proof server may compose only the built public reference-host server entry, never its source tree or a deep/private build module.",
      from: { path: desenAppBrowserPublicationServerPaths },
      to: {
        path: "^apps/reference-host-web-server/",
        pathNot: referenceHostServerPublicBuildEntryPath,
      },
    },
    {
      name: "desen-app-browser-e2e-product-server-has-no-other-application-dependencies",
      severity: "error",
      comment:
        "Only the normal-product proof server may reuse the exact local operation listener alongside the public control-plane entry; other App source, dev modules and application roots remain forbidden.",
      from: { path: desenAppBrowserProductProofServerPath },
      to: {
        path: "^apps/(?!desen-app-browser-e2e/|control-plane-api/)",
        pathNot: desenAppLocalOperationHostPath,
      },
    },
    {
      name: "desen-app-browser-e2e-published-server-has-no-other-application-dependencies",
      severity: "error",
      comment:
        "Only the reviewed published-host proof server may combine the exact local activation bridge with public control-plane and reference-host entries; every other application edge remains forbidden.",
      from: { path: desenAppBrowserPublicationServerPaths },
      to: {
        path: "^apps/(?!desen-app-browser-e2e/|control-plane-api/|reference-host-web-server/)",
        pathNot: desenAppLocalPublicationHostPath,
      },
    },
    {
      name: "neutral-packages-no-node-builtins",
      severity: "error",
      comment:
        "Platform-neutral packages receive clocks, storage, cryptography, and I/O through explicit ports or universal dependencies.",
      from: { path: neutralProductionSourcePath },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "neutral-packages-no-frameworks",
      severity: "error",
      comment:
        "Protocol, validation, publishing, catalog contracts, runtime semantics, and editor commands must stay outside framework and platform adapters.",
      from: { path: neutralProductionSourcePath },
      to: {
        path: [
          "^(?:react|react-dom|react-native|expo|next)(?:/|$)",
          "^@react-native(?:/|$)",
          "(?:^|/)node_modules/(?:react|react-dom|react-native|expo|next)(?:/|$)",
          "(?:^|/)node_modules/@react-native(?:/|$)",
          "^packages/(?:runtime-react|runtime-web|editor-web|reference-catalog-web|starter-catalog-web)/",
          "(?:^|/)node_modules/@base-ui/",
        ],
      },
    },
    {
      name: "neutral-packages-no-styles",
      severity: "error",
      comment: "CSS and other stylesheet formats belong only to Web-facing packages.",
      from: { path: neutralProductionSourcePath },
      to: { path: "\\.(?:css|scss|sass|less|styl)(?:$|\\?)" },
    },
    {
      name: "production-source-never-imports-testkit",
      severity: "error",
      comment:
        "Production source must not ship proof fixtures or test fakes; the public facade may expose a dedicated test subpath separately.",
      from: {
        path: "^packages/(?!testkit/|desen/)[^/]+/src/",
      },
      to: { path: "^packages/testkit/" },
    },
    {
      name: "reference-host-has-no-authoring-or-publisher",
      severity: "error",
      comment:
        "The proof host executes bundles and must not acquire editor code or source-to-bundle publication behavior.",
      from: { path: "^apps/reference-host-web/(?:src|app)/" },
      to: { path: "^packages/(?:editor-core|editor-web|publisher)/" },
    },
    {
      name: "reference-host-has-no-test-support-or-facade",
      severity: "error",
      comment:
        "The production proof host cannot acquire fixtures, synthetic outcomes, or the broad public facade.",
      from: { path: "^apps/reference-host-web/(?:src|app)/" },
      to: { path: "^packages/(?:testkit|desen)/" },
    },
    {
      name: "reference-host-has-no-application-dependencies",
      severity: "error",
      comment:
        "The independent proof host cannot import Desen App or another application composition root.",
      from: { path: "^apps/reference-host-web/(?:src|app)/" },
      to: { path: "^apps/(?!reference-host-web/)" },
    },
    {
      name: "reference-host-server-production-has-no-package-dependencies",
      severity: "error",
      comment:
        "The host server production root composes the public control-plane app only; direct package imports remain test-only.",
      from: { path: "^apps/reference-host-web-server/(?:src|app)/" },
      to: { path: "^packages/" },
    },
    {
      name: "reference-host-server-control-plane-public-root-only",
      severity: "error",
      comment:
        "The host server may compose only the reviewed public control-plane root, never a private control-plane module.",
      from: { path: "^apps/reference-host-web-server/(?:src|app)/" },
      to: {
        path: "^apps/control-plane-api/(?!src/index\\.ts$|dist/index\\.(?:d\\.ts|js)$)",
      },
    },
    {
      name: "reference-host-server-has-no-other-application-dependencies",
      severity: "error",
      comment:
        "The host server has one reviewed app composition edge and cannot acquire a browser host, Desen App, or another application root.",
      from: { path: "^apps/reference-host-web-server/(?:src|app)/" },
      to: {
        path: "^apps/(?!reference-host-web-server/|control-plane-api/(?:src/index\\.ts$|dist/index\\.(?:d\\.ts|js)$))",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: "^packages/protocol/upstream/",
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
    tsPreCompilationDeps: "specify",
  },
};
