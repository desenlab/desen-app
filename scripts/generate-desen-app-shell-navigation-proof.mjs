import {
  DesenAppShellNavigationProofError,
  writeDesenAppShellNavigationEvidence,
} from "./lib/desen-app-shell-navigation-proof.mjs";

try {
  const result = await writeDesenAppShellNavigationEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M09-T01 Desen App shell/navigation evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppShellNavigationProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
