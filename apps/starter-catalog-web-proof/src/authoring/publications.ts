import { publishDesenSource } from "@desen/publisher";
import starterCatalog from "@desen/starter-catalog-web/catalog.json";

import { PROOF_ROOT_IDS, createStarterProofSources } from "./source-fixtures.js";

import type { DesenSource } from "@desen/protocol";
import type { PublishCatalogPackageCandidate, PublishSuccess } from "@desen/publisher";
import type { StarterProofEnvelope } from "../shared/proof-channel.js";

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
    throw new TypeError(`Starter proof publication failed at ${result.stage}.`);
  }
  return result.bundle;
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function negativePublication(source: DesenSource) {
  const result = publishDesenSource(JSON.stringify(source), [candidate]);
  return Object.freeze({
    rejected: !result.ok,
    stage: result.ok ? null : result.stage,
    codes: result.diagnostics.map((diagnostic) => diagnostic.code),
  });
}

/** Executes the real deterministic Publisher boundary for every browser proof Bundle. */
export function prepareStarterProofPublications(): Readonly<{
  envelope: StarterProofEnvelope;
  negative: {
    readonly unknownCapability: ReturnType<typeof negativePublication>;
    readonly unknownPart: ReturnType<typeof negativePublication>;
  };
}> {
  const sources = createStarterProofSources();
  const unknownCapability = clone(sources.buttonInitial);
  const unknownCapabilitySurface = unknownCapability.surfaces.button;
  if (unknownCapabilitySurface === undefined) throw new TypeError("Missing Button proof surface.");
  unknownCapabilitySurface.root.use = "run.desen.starter/Unknown";
  const unknownPart = clone(sources.buttonInitial);
  const unknownPartSurface = unknownPart.surfaces.button;
  if (unknownPartSurface === undefined) throw new TypeError("Missing Button proof surface.");
  unknownPartSurface.root.style = {
    base: { unknownPart: { color: "#111111" } },
  };
  const envelope: StarterProofEnvelope = Object.freeze({
    schemaVersion: 1,
    catalog: Object.freeze({
      id: starterCatalog.id,
      version: starterCatalog.version,
      target: starterCatalog.target,
      packageDigest: starterCatalog.packageDigest,
    }),
    bundles: Object.freeze({
      button: Object.freeze({
        initial: publish(sources.buttonInitial),
        compatible: publish(sources.buttonCompatible),
      }),
      select: publish(sources.select),
      dialog: publish(sources.dialog),
    }),
    roots: PROOF_ROOT_IDS,
  });
  return Object.freeze({
    envelope,
    negative: Object.freeze({
      unknownCapability: negativePublication(unknownCapability),
      unknownPart: negativePublication(unknownPart),
    }),
  });
}

export { default as starterProofCatalog } from "@desen/starter-catalog-web/catalog.json";
