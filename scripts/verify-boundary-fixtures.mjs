import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = path.join(workspaceRoot, "tests", "boundaries", "fixtures");
const executable = path.join(workspaceRoot, "node_modules", ".bin", "depcruise");
const configuration = path.join(workspaceRoot, "dependency-cruiser.config.cjs");

const cases = [
  { name: "allowed-validator-protocol", expectedRule: null },
  { name: "allowed-runtime-react-validator", expectedRule: null },
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
