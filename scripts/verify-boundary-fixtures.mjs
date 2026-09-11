import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = path.join(workspaceRoot, "tests", "boundaries", "fixtures");
const executable = path.join(workspaceRoot, "node_modules", ".bin", "depcruise");
const configuration = path.join(workspaceRoot, "dependency-cruiser.config.cjs");

const cases = [
  { name: "allowed-starter-runtime-react", expectedRule: null },
  {
    name: "starter-imports-editor-core",
    expectedRule: "package-starter-catalog-web-allowed-dependencies",
  },
  { name: "starter-imports-app", expectedRule: "packages-never-import-apps" },
  { name: "neutral-imports-starter", expectedRule: "neutral-packages-no-frameworks" },
  {
    name: "starter-proof-host-imports-publisher",
    expectedRule: "starter-proof-host-has-no-authoring",
  },
  { name: "starter-proof-imports-app", expectedRule: "starter-proof-has-no-other-apps" },
  { name: "allowed-reference-host-sign-in-test-protocol-root", expectedRule: null },
  { name: "allowed-desen-app-browser-repeatable-authoring-protocol-root", expectedRule: null },
  ...[
    "reference-host-sign-in-test-imports-protocol-private",
    "reference-host-sign-in-test-imports-publisher",
  ].map((name) => ({
    name,
    expectedRule: "reference-host-sign-in-test-reviewed-packages-only",
  })),
  ...[
    "desen-app-browser-repeatable-authoring-imports-protocol-private",
    "desen-app-browser-repeatable-authoring-imports-editor-core",
  ].map((name) => ({
    name,
    expectedRule: "reviewed-canonical-proof-protocol-public-root-only",
  })),
  {
    name: "reference-host-other-test-imports-protocol",
    expectedRule: "application-reference-host-web-allowed-dependencies",
  },
  {
    name: "desen-app-browser-non-repeatable-authoring-imports-protocol",
    expectedRule: "application-desen-app-browser-e2e-allowed-dependencies",
  },
  { name: "allowed-desen-app-browser-e2e-repeatable-demo-normal-launcher", expectedRule: null },
  {
    name: "desen-app-browser-e2e-non-repeatable-demo-imports-normal-launcher",
    expectedRule: "desen-app-browser-e2e-reviewed-app-source-only",
  },
  ...["unreviewed-dev-module", "app-source", "control-plane-root", "editor-core"].map((target) => ({
    name: `desen-app-browser-e2e-repeatable-demo-imports-${target}`,
    expectedRule: "desen-app-browser-e2e-repeatable-demo-server-normal-launcher-only",
  })),
  { name: "allowed-desen-app-browser-e2e-recovery-server-reviewed-roots", expectedRule: null },
  {
    name: "desen-app-browser-e2e-recovery-server-imports-control-plane-private",
    expectedRule: "desen-app-browser-e2e-product-server-control-plane-public-root-only",
  },
  {
    name: "desen-app-browser-e2e-recovery-server-imports-reference-host-private",
    expectedRule: "desen-app-browser-e2e-published-server-reference-host-public-root-only",
  },
  {
    name: "desen-app-browser-e2e-recovery-server-imports-unreviewed-dev-module",
    expectedRule: "desen-app-browser-e2e-published-server-has-no-other-application-dependencies",
  },
  {
    name: "desen-app-browser-e2e-recovery-server-imports-app-source",
    expectedRule: "desen-app-browser-e2e-published-server-has-no-other-application-dependencies",
  },
  {
    name: "desen-app-browser-e2e-recovery-server-imports-protocol-private",
    expectedRule: "desen-app-browser-e2e-recovery-server-protocol-public-root-only",
  },
  {
    name: "desen-app-browser-e2e-recovery-server-imports-publisher",
    expectedRule: "desen-app-browser-e2e-recovery-server-protocol-public-root-only",
  },
  {
    name: "desen-app-browser-e2e-non-recovery-server-imports-protocol",
    expectedRule: "application-desen-app-browser-e2e-allowed-dependencies",
  },
  { name: "allowed-validator-protocol", expectedRule: null },
  { name: "allowed-runtime-react-validator", expectedRule: null },
  { name: "allowed-reference-host-server-control-plane-root", expectedRule: null },
  { name: "allowed-desen-app-browser-e2e-reviewed-imports", expectedRule: null },
  {
    name: "allowed-desen-app-browser-e2e-product-server-control-plane-root",
    expectedRule: null,
  },
  {
    name: "allowed-desen-app-browser-e2e-product-server-local-operation-host",
    expectedRule: null,
  },
  {
    name: "allowed-desen-app-browser-e2e-published-server-reviewed-roots",
    expectedRule: null,
  },
  {
    name: "desen-app-browser-e2e-product-server-imports-unreviewed-dev-module",
    expectedRule: "desen-app-browser-e2e-product-server-has-no-other-application-dependencies",
  },
  {
    name: "desen-app-browser-e2e-non-product-server-imports-local-operation-host",
    expectedRule: "desen-app-browser-e2e-reviewed-app-source-only",
  },
  {
    name: "desen-app-browser-e2e-imports-publisher",
    expectedRule: "application-desen-app-browser-e2e-allowed-dependencies",
  },
  {
    name: "desen-app-browser-e2e-imports-unreviewed-app-source",
    expectedRule: "desen-app-browser-e2e-reviewed-app-source-only",
  },
  {
    name: "desen-app-browser-e2e-non-product-server-imports-control-plane",
    expectedRule: "desen-app-browser-e2e-reviewed-app-source-only",
  },
  {
    name: "desen-app-browser-e2e-product-server-imports-control-plane-private",
    expectedRule: "desen-app-browser-e2e-product-server-control-plane-public-root-only",
  },
  {
    name: "desen-app-browser-e2e-product-server-imports-other-app",
    expectedRule: "desen-app-browser-e2e-product-server-has-no-other-application-dependencies",
  },
  {
    name: "desen-app-browser-e2e-published-server-imports-reference-host-private",
    expectedRule: "desen-app-browser-e2e-published-server-reference-host-public-root-only",
  },
  {
    name: "desen-app-browser-e2e-published-server-imports-unreviewed-dev-module",
    expectedRule: "desen-app-browser-e2e-published-server-has-no-other-application-dependencies",
  },
  {
    name: "desen-app-browser-e2e-non-published-server-imports-local-publication-host",
    expectedRule: "desen-app-browser-e2e-reviewed-app-source-only",
  },
  {
    name: "protocol-imports-runtime",
    expectedRule: "package-protocol-allowed-dependencies",
  },
  {
    name: "runtime-core-imports-node",
    expectedRule: "neutral-packages-no-node-builtins",
  },
  {
    name: "runtime-core-imports-css",
    expectedRule: "neutral-packages-no-styles",
  },
  {
    name: "catalog-sdk-imports-runtime-react",
    expectedRule: "neutral-packages-no-frameworks",
  },
  {
    name: "runtime-core-imports-testkit",
    expectedRule: "production-source-never-imports-testkit",
  },
  {
    name: "validator-imports-runtime-react",
    expectedRule: "package-validator-allowed-dependencies",
  },
  {
    name: "reference-host-imports-editor",
    expectedRule: "reference-host-has-no-authoring-or-publisher",
  },
  {
    name: "reference-host-imports-testkit",
    expectedRule: "reference-host-has-no-test-support-or-facade",
  },
  {
    name: "reference-host-imports-facade",
    expectedRule: "reference-host-has-no-test-support-or-facade",
  },
  {
    name: "reference-host-imports-desen-app",
    expectedRule: "reference-host-has-no-application-dependencies",
  },
  {
    name: "reference-host-server-imports-control-plane-private",
    expectedRule: "reference-host-server-control-plane-public-root-only",
  },
  {
    name: "reference-host-server-production-imports-protocol",
    expectedRule: "reference-host-server-production-has-no-package-dependencies",
  },
  {
    name: "reference-host-server-imports-desen-app",
    expectedRule: "reference-host-server-has-no-other-application-dependencies",
  },
];

let failed = false;

for (const boundaryCase of cases) {
  const fixtureRoot = path.join(fixturesRoot, boundaryCase.name);
  const inputs = ["apps", "packages"].filter((input) => existsSync(path.join(fixtureRoot, input)));
  const result = spawnSync(
    executable,
    ["--config", configuration, "--output-type", "json", ...inputs],
    {
      cwd: fixtureRoot,
      encoding: "utf8",
    },
  );

  if (!result.stdout) {
    failed = true;
    process.stderr.write(
      `FAIL ${boundaryCase.name}: dependency-cruiser produced no JSON output.\n${result.stderr}\n`,
    );
    continue;
  }

  /** @type {{ summary?: { error?: number; violations?: Array<{ rule?: { name?: string } }> } }} */
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    failed = true;
    process.stderr.write(
      `FAIL ${boundaryCase.name}: could not parse dependency-cruiser output: ${String(error)}\n`,
    );
    continue;
  }

  const ruleNames = new Set(
    report.summary?.violations?.map((violation) => violation.rule?.name).filter(Boolean),
  );

  if (boundaryCase.expectedRule === null) {
    if ((report.summary?.error ?? 0) !== 0 || result.status !== 0) {
      failed = true;
      process.stderr.write(
        `FAIL ${boundaryCase.name}: an allowed edge was rejected by ${[...ruleNames].join(", ")}.\n`,
      );
    } else {
      process.stdout.write(`PASS ${boundaryCase.name}: allowed edge accepted.\n`);
    }
    continue;
  }

  if (!ruleNames.has(boundaryCase.expectedRule)) {
    failed = true;
    process.stderr.write(
      `FAIL ${boundaryCase.name}: expected ${boundaryCase.expectedRule}; observed ${[...ruleNames].join(", ") || "no violations"}.\n`,
    );
  } else {
    process.stdout.write(
      `PASS ${boundaryCase.name}: ${boundaryCase.expectedRule} rejected the forbidden edge.\n`,
    );
  }
}

if (failed) {
  process.exitCode = 1;
}
