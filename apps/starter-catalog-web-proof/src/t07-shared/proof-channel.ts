import { canonicalizeJson } from "@desen/protocol";

/** Exact browser-local handoff used only between the two isolated M10A-T07 proof entry graphs. */
export const STARTER_T07_PROOF_CHANNEL_KEY = "run.desen.proof/m10a-t07-selection-numeric-bundles";

const MAX_ENVELOPE_CODE_UNITS = 8_388_608;
const LOCAL_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

/** Immutable Catalog tuple which the independent host must match exactly. */
export interface StarterT07ProofCatalogIdentity {
  readonly id: string;
  readonly version: string;
  readonly target: string;
  readonly packageDigest: string;
}

/** Serialized Publisher output and finite Source identities used by the isolated T07 proof only. */
export interface StarterT07ProofEnvelope {
  readonly schemaVersion: 1;
  readonly catalog: StarterT07ProofCatalogIdentity;
  readonly bundles: { readonly selectionNumeric: unknown };
  readonly roots: { readonly selectionNumeric: string };
  readonly nodes: {
    readonly select: string;
    readonly combobox: string;
    readonly tabs: string;
    readonly slider: string;
    readonly numberField: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index])
  );
}

function readText(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === "string" && field.length > 0 ? field : undefined;
}

/**
 * Reads only the finite T07 proof envelope; normal Runtime validators establish Bundle authority.
 *
 * @remarks The parser declines malformed handoff bytes instead of repairing them, preserving the
 * independent host boundary even though both proof entry points share a browser origin.
 */
export function readStarterT07ProofEnvelope(storage: Storage): StarterT07ProofEnvelope | undefined {
  let raw: string | null;
  try {
    raw = storage.getItem(STARTER_T07_PROOF_CHANNEL_KEY);
  } catch {
    return undefined;
  }
  if (raw === null || raw.length > MAX_ENVELOPE_CODE_UNITS) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  if (
    !isRecord(parsed) ||
    !exactKeys(parsed, ["schemaVersion", "catalog", "bundles", "roots", "nodes"]) ||
    parsed.schemaVersion !== 1 ||
    !isRecord(parsed.catalog) ||
    !exactKeys(parsed.catalog, ["id", "version", "target", "packageDigest"]) ||
    !isRecord(parsed.bundles) ||
    !exactKeys(parsed.bundles, ["selectionNumeric"]) ||
    !isRecord(parsed.roots) ||
    !exactKeys(parsed.roots, ["selectionNumeric"]) ||
    !isRecord(parsed.nodes) ||
    !exactKeys(parsed.nodes, ["select", "combobox", "tabs", "slider", "numberField"])
  ) {
    return undefined;
  }
  const id = readText(parsed.catalog, "id");
  const version = readText(parsed.catalog, "version");
  const target = readText(parsed.catalog, "target");
  const packageDigest = readText(parsed.catalog, "packageDigest");
  const root = readText(parsed.roots, "selectionNumeric");
  const select = readText(parsed.nodes, "select");
  const combobox = readText(parsed.nodes, "combobox");
  const tabs = readText(parsed.nodes, "tabs");
  const slider = readText(parsed.nodes, "slider");
  const numberField = readText(parsed.nodes, "numberField");
  const texts = [
    id,
    version,
    target,
    packageDigest,
    root,
    select,
    combobox,
    tabs,
    slider,
    numberField,
  ];
  if (texts.some((value) => value === undefined)) return undefined;
  if (
    (id as string).length > 4_096 ||
    (version as string).length > 256 ||
    (target as string).length > 256 ||
    !SHA256_PATTERN.test(packageDigest as string) ||
    ![root, select, combobox, tabs, slider, numberField].every((value) =>
      LOCAL_ID_PATTERN.test(value as string),
    )
  ) {
    return undefined;
  }
  return parsed as unknown as StarterT07ProofEnvelope;
}

/** Canonicalizes a detached inert snapshot before the strictly local authoring-to-host handoff. */
export function writeStarterT07ProofEnvelope(
  storage: Storage,
  envelope: StarterT07ProofEnvelope,
): void {
  const serialized = canonicalizeJson(envelope);
  if (serialized.length > MAX_ENVELOPE_CODE_UNITS) {
    throw new TypeError("M10A-T07 proof envelope exceeds its finite browser-local budget.");
  }
  storage.setItem(STARTER_T07_PROOF_CHANNEL_KEY, serialized);
}
