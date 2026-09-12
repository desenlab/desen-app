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
    readonly invalidDimension: ReturnType<typeof negativePublication>;
    readonly unsupportedImageColor: ReturnType<typeof negativePublication>;
    readonly unsafeImageSource: ReturnType<typeof negativePublication>;
    readonly privateSelector: ReturnType<typeof negativePublication>;
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
  const invalidDimension = clone(sources.layout);
  const invalidDimensionSurface = invalidDimension.surfaces.layout;
  if (invalidDimensionSurface === undefined) throw new TypeError("Missing layout proof surface.");
  invalidDimensionSurface.root.style = { base: { root: { width: -1 } } };
  const unsafeImageSource = clone(sources.layout);
  const unsafeImageSurface = unsafeImageSource.surfaces.layout;
  if (unsafeImageSurface === undefined) throw new TypeError("Missing layout proof surface.");
  const unsafeStack = unsafeImageSurface.root.slots?.default?.[0];
  const unsafeImage = unsafeStack?.slots?.default?.find((node) => node.id === "layout.image");
  if (unsafeImage === undefined) throw new TypeError("Missing layout image proof node.");
  unsafeImage.props = {
    source: "https://untrusted.invalid/image.png",
    alt: "Unsafe remote image",
    fit: "cover",
  };
  const unsupportedImageColor = clone(sources.layout);
  const unsupportedImageColorSurface = unsupportedImageColor.surfaces.layout;
  if (unsupportedImageColorSurface === undefined)
    throw new TypeError("Missing layout proof surface.");
  const unsupportedImageColorStack = unsupportedImageColorSurface.root.slots?.default?.[0];
  const unsupportedImageColorNode = unsupportedImageColorStack?.slots?.default?.find(
    (node) => node.id === "layout.image",
  );
  if (unsupportedImageColorNode === undefined)
    throw new TypeError("Missing layout image proof node.");
  unsupportedImageColorNode.style = { base: { root: { color: "#112233" } } };
  const privateSelector = clone(sources.layout);
  const privateSelectorSurface = privateSelector.surfaces.layout;
  if (privateSelectorSurface === undefined) throw new TypeError("Missing layout proof surface.");
  privateSelectorSurface.root.style = {
    base: { root: { selector: ".private [data-state]" } },
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
      layout: publish(sources.layout),
    }),
    roots: PROOF_ROOT_IDS,
  });
  return Object.freeze({
    envelope,
    negative: Object.freeze({
      unknownCapability: negativePublication(unknownCapability),
      unknownPart: negativePublication(unknownPart),
      invalidDimension: negativePublication(invalidDimension),
      unsupportedImageColor: negativePublication(unsupportedImageColor),
      unsafeImageSource: negativePublication(unsafeImageSource),
      privateSelector: negativePublication(privateSelector),
    }),
  });
}

export { default as starterProofCatalog } from "@desen/starter-catalog-web/catalog.json";
