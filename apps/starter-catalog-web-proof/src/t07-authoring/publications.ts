import { publishDesenSource } from "@desen/publisher";
import starterCatalog from "@desen/starter-catalog-web/catalog.json";

import {
  T07_PROOF_NODE_IDS,
  T07_PROOF_ROOT_IDS,
  createStarterT07ProofSources,
} from "./source-fixtures.js";

import type { PublishCatalogPackageCandidate, PublishSuccess } from "@desen/publisher";
import type { StarterT07ProofEnvelope } from "../t07-shared/proof-channel.js";

const candidate = Object.freeze({
  id: starterCatalog.id,
  version: starterCatalog.version,
  target: starterCatalog.target,
  observedPackageDigest: starterCatalog.packageDigest,
  catalog: starterCatalog,
}) satisfies PublishCatalogPackageCandidate;

function publish(source: unknown): PublishSuccess["bundle"] {
  const result = publishDesenSource(JSON.stringify(source), [candidate]);
  if (!result.ok) {
    throw new TypeError(
      `M10A-T07 proof publication failed at ${result.stage}: ${result.diagnostics
        .map((diagnostic) => `${diagnostic.code}@${diagnostic.pointer}`)
        .join(", ")}.`,
    );
  }
  return result.bundle;
}

/** Executes the real Publisher boundary for the isolated M10A-T07 browser proof Bundle. */
export function prepareStarterT07ProofPublications(): Readonly<{
  envelope: StarterT07ProofEnvelope;
}> {
  const sources = createStarterT07ProofSources();
  const envelope: StarterT07ProofEnvelope = Object.freeze({
    schemaVersion: 1,
    catalog: Object.freeze({
      id: starterCatalog.id,
      version: starterCatalog.version,
      target: starterCatalog.target,
      packageDigest: starterCatalog.packageDigest,
    }),
    bundles: Object.freeze({ selectionNumeric: publish(sources.selectionNumeric) }),
    roots: T07_PROOF_ROOT_IDS,
    nodes: T07_PROOF_NODE_IDS,
  });
  return Object.freeze({ envelope });
}

export { default as starterT07ProofCatalog } from "@desen/starter-catalog-web/catalog.json";
