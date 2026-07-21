/** @type {Record<string, readonly string[]>} */
const allowedPackageDependencies = {
  protocol: [],
  validator: ["protocol"],
  publisher: ["protocol", "validator"],
  "catalog-sdk": ["protocol"],
  "runtime-core": ["protocol", "validator"],
  "runtime-react": ["protocol", "runtime-core"],
  "runtime-web": ["protocol", "validator", "runtime-core"],
  "editor-core": ["protocol", "validator"],
  "editor-web": [
    "protocol",
    "validator",
    "catalog-sdk",
    "editor-core",
    "runtime-core",
    "runtime-react",
  ],
  "reference-catalog-web": ["protocol", "catalog-sdk", "runtime-react"],
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
  "control-plane-api": ["protocol", "validator", "publisher", "catalog-sdk", "testkit"],
  "desen-app": [
    "protocol",
    "validator",
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
  "reference-host-web": [
    "protocol",
    "validator",
    "catalog-sdk",
    "runtime-core",
    "runtime-react",
    "runtime-web",
    "reference-catalog-web",
    "testkit",
    "desen",
  ],
};

const neutralProductionSourcePath =
  "^packages/(protocol|validator|publisher|catalog-sdk|runtime-core|editor-core)/src/";

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
    from: { path: `^apps/${applicationName}/` },
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
          "^packages/(?:runtime-react|runtime-web|editor-web|reference-catalog-web)/",
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
