#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { InfrastructureDebtError, verifyInfrastructureDebt } from "./infrastructure-debt.mjs";

/**
 * Runs the machine-enforced infrastructure-debt lifecycle verifier.
 */
export async function main() {
  const receipt = await verifyInfrastructureDebt();
  const counts = receipt.statusCounts;
  process.stdout.write(
    `Infrastructure debt verified: ${receipt.entries} entries ` +
      `(${counts.OPEN} open, ${counts.READY_FOR_REMOVAL} ready, ${counts.CLOSED} closed).\n`,
  );
  return receipt;
}

const entrypoint = process.argv[1] === undefined ? undefined : pathToFileURL(process.argv[1]).href;

if (import.meta.url === entrypoint) {
  main().catch((error) => {
    if (error instanceof InfrastructureDebtError) {
      process.stderr.write(`${error.code}: ${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  });
}
