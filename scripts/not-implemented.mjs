const [capability = "This command", readinessGate = "its documented gate"] = process.argv.slice(2);
const displayName = capability.replaceAll("-", " ");

process.stderr.write(
  `[NOT_IMPLEMENTED] ${displayName} is intentionally unavailable until ${readinessGate}. ` +
    "A missing runner must never be reported as a passing proof.\n",
);

process.exitCode = 1;
