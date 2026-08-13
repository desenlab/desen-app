#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  AffectedSelectorPromotionEvidenceError,
  verifyAffectedSelectorPromotionEvidence,
} from "./affected-selector-promotion-evidence.mjs";

export async function main() {
  const receipt = await verifyAffectedSelectorPromotionEvidence();
  process.stdout.write(
    `I07-04 promotion evidence verified: ${receipt.observations}/20 hosted comparisons, ` +
      `${receipt.falseNegatives} false negatives, sha256:${receipt.sha256}.\n`,
  );
  return receipt;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    if (error instanceof AffectedSelectorPromotionEvidenceError) {
      process.stderr.write(`${error.code}: ${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  });
}
