import { publishDesenSource } from "@desen/publisher";
import starterCatalog from "@desen/starter-catalog-web/catalog.json";

import {
  T06_PROOF_NODE_IDS,
  T06_PROOF_ROOT_IDS,
  createStarterT06ProofSources,
} from "./source-fixtures.js";

import type { DesenSource } from "@desen/protocol";
import type { PublishCatalogPackageCandidate, PublishSuccess } from "@desen/publisher";
import type { StarterT06ProofEnvelope } from "../t06-shared/proof-channel.js";

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
      `M10A-T06 proof publication failed at ${result.stage}: ${result.diagnostics
        .map((diagnostic) => `${diagnostic.code}@${diagnostic.pointer}`)
        .join(", ")}.`,
    );
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

function requireFormNode(source: DesenSource, id: string) {
  const surface = source.surfaces.form;
  const node = surface?.root.slots?.default?.find((candidateNode) => candidateNode.id === id);
  if (node === undefined) throw new TypeError(`Missing M10A-T06 proof node ${id}.`);
  return node;
}

/** Executes the real Publisher boundary for every isolated M10A-T06 browser proof Bundle. */
export function prepareStarterT06ProofPublications(): Readonly<{
  envelope: StarterT06ProofEnvelope;
  negative: {
    readonly invalidRadioOptionValue: ReturnType<typeof negativePublication>;
    readonly invalidRows: ReturnType<typeof negativePublication>;
  };
}> {
  const sources = createStarterT06ProofSources();
  const invalidRows = clone(sources.form);
  const invalidRowsNode = requireFormNode(invalidRows, T06_PROOF_NODE_IDS.textArea);
  invalidRowsNode.props = { ...invalidRowsNode.props, rows: 13 };

  const invalidRadioOptionValue = clone(sources.form);
  const invalidRadioNode = requireFormNode(invalidRadioOptionValue, T06_PROOF_NODE_IDS.radioGroup);
  invalidRadioNode.props = {
    ...invalidRadioNode.props,
    options: [{ value: "", label: "Invalid empty option", disabled: false }],
  };

  const envelope: StarterT06ProofEnvelope = Object.freeze({
    schemaVersion: 1,
    catalog: Object.freeze({
      id: starterCatalog.id,
      version: starterCatalog.version,
      target: starterCatalog.target,
      packageDigest: starterCatalog.packageDigest,
    }),
    bundles: Object.freeze({
      button: Object.freeze({
        disabled: publish(sources.buttonDisabled),
        loading: publish(sources.buttonLoading),
      }),
      form: publish(sources.form),
    }),
    roots: T06_PROOF_ROOT_IDS,
    nodes: T06_PROOF_NODE_IDS,
  });
  return Object.freeze({
    envelope,
    negative: Object.freeze({
      invalidRadioOptionValue: negativePublication(invalidRadioOptionValue),
      invalidRows: negativePublication(invalidRows),
    }),
  });
}

export { default as starterT06ProofCatalog } from "@desen/starter-catalog-web/catalog.json";
