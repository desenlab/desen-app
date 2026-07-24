import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const VALIDATOR_REQUIRE = createRequire(
  path.join(WORKSPACE_ROOT, "packages/validator/package.json"),
);
const Ajv2020 = VALIDATOR_REQUIRE("ajv/dist/2020.js").default;
const AJV_VERSION = VALIDATOR_REQUIRE("ajv/package.json").version;

export const SC01_A2UI_VERSION = "v0.9.1";
export const SC01_A2UI_COMMIT = "d4723f29254520e1214d5004cb555d83eaafb828";
export const SC01_A2UI_SPEC_TREE = "c7bbfeea1e6d62b0f24af4c83231c2d9fd55aa89";
export const SC01_A2UI_CATALOG_ID =
  "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";
export const SC01_PROFILE_ID = "SC01_STATIC_TEXT_V1";

export const DEFAULT_SC01_A2UI_FIXTURE_DIRECTORY = path.join(
  WORKSPACE_ROOT,
  "tests/fixtures/standards/a2ui/0.9.1",
);

export const DEFAULT_SC01_A2UI_BRIDGE_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/sc-01-a2ui-bridge.json",
);

const DESEN_VERSION = "0.1.0";
const DESEN_KIND = "desen.source";
const DESEN_CATALOG = Object.freeze({
  id: "com.example.web-catalog",
  version: "1.0.0",
  target: "web-react",
});
const STACK_USE = "com.example.ui/Stack";
const TEXT_USE = "com.example.ui/Text";
const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const MAX_COMPONENTS = 256;
const MAX_DEPTH = 32;
const MAX_TEXT_UTF16_CODE_UNITS = 4096;
const MAX_SCHEMA_JSON_DEPTH = 256;
const MAX_SCHEMA_JSON_VALUES = 10_000;
const A2UI_CATALOG_ALIAS_ID = "https://a2ui.org/specification/v0_9/catalog.json";
const DESEN_SOURCE_SCHEMA_RELATIVE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-source.schema.json";
const DESEN_SOURCE_SCHEMA_SHA256 =
  "5ce5d541991940676ce0d3705e5b0658cd60f31025be8bfb96aec21a3116dba3";
const DESEN_SOURCE_SCHEMA_ID = "https://schemas.desen.dev/0.1/desen-source.schema.json";
const DESEN_CHECKSUMS_RELATIVE_PATH = "packages/protocol/upstream/0.1.0/snapshot/SHA256SUMS";
const DESEN_CHECKSUMS_SHA256 = "92e1c817d75ddc71e993de0dcf42ad7003738b6a59dc57905b879f872828c2cd";
const DESEN_CATALOG_SCHEMA_RELATIVE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-catalog.schema.json";
const DESEN_CATALOG_SCHEMA_SHA256 =
  "51014ab088b6a483502fd6aee5eed9fc4451be55556b6bd6220a5a6a1b610555";
const DESEN_CATALOG_SCHEMA_ID = "https://schemas.desen.dev/0.1/desen-catalog.schema.json";
const DESEN_CATALOG_EXAMPLE_RELATIVE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json";
const DESEN_CATALOG_EXAMPLE_SHA256 =
  "7b9a8bad7b49340dc2a5f818ac008feb403fb43c8c476eecba5e1fcbdf3bf45d";

const ROLE_TO_VARIANT = Object.freeze({
  body: "body",
  heading: "h2",
  caption: "caption",
});
const VARIANT_TO_ROLE = Object.freeze({
  body: "body",
  h2: "heading",
  caption: "caption",
});
const DIRECTION_TO_COMPONENT = Object.freeze({
  vertical: "Column",
  horizontal: "Row",
});
const COMPONENT_TO_DIRECTION = Object.freeze({
  Column: "vertical",
  Row: "horizontal",
});
const ALIGN_VALUES = Object.freeze(["start", "center", "end", "stretch"]);

export const SC01_A2UI_REJECTION_CODES = Object.freeze({
  OPTIONS_INVALID: "SC01_OPTIONS_INVALID",
  SOURCE_SHAPE_UNSUPPORTED: "SC01_SOURCE_SHAPE_UNSUPPORTED",
  SOURCE_IDENTITY_UNSUPPORTED: "SC01_SOURCE_IDENTITY_UNSUPPORTED",
  CATALOG_UNSUPPORTED: "SC01_CATALOG_UNSUPPORTED",
  AUTHORING_UNSUPPORTED: "SC01_AUTHORING_UNSUPPORTED",
  EXTENSIONS_UNSUPPORTED: "SC01_EXTENSIONS_UNSUPPORTED",
  STATE_UNSUPPORTED: "SC01_STATE_UNSUPPORTED",
  RESOURCES_UNSUPPORTED: "SC01_RESOURCES_UNSUPPORTED",
  ROOT_ID_UNSUPPORTED: "SC01_ROOT_ID_UNSUPPORTED",
  COMPONENT_UNSUPPORTED: "SC01_COMPONENT_UNSUPPORTED",
  COMPONENT_ID_UNSUPPORTED: "SC01_COMPONENT_ID_UNSUPPORTED",
  SLOTS_UNSUPPORTED: "SC01_SLOTS_UNSUPPORTED",
  STACK_DIRECTION_UNSUPPORTED: "SC01_STACK_DIRECTION_UNSUPPORTED",
  STACK_ALIGN_UNSUPPORTED: "SC01_STACK_ALIGN_UNSUPPORTED",
  STACK_GAP_UNSUPPORTED: "SC01_STACK_GAP_UNSUPPORTED",
  STACK_MAX_WIDTH_UNSUPPORTED: "SC01_STACK_MAX_WIDTH_UNSUPPORTED",
  STACK_PROP_UNSUPPORTED: "SC01_STACK_PROP_UNSUPPORTED",
  TEXT_VALUE_UNSUPPORTED: "SC01_TEXT_VALUE_UNSUPPORTED",
  TEXT_LENGTH_UNSUPPORTED: "SC01_TEXT_LENGTH_UNSUPPORTED",
  TEXT_PLAIN_UNSAFE: "SC01_TEXT_PLAIN_UNSAFE",
  TEXT_ROLE_UNSUPPORTED: "SC01_TEXT_ROLE_UNSUPPORTED",
  TEXT_PROP_UNSUPPORTED: "SC01_TEXT_PROP_UNSUPPORTED",
  STYLE_UNSUPPORTED: "SC01_STYLE_UNSUPPORTED",
  EVENTS_UNSUPPORTED: "SC01_EVENTS_UNSUPPORTED",
  CONDITION_UNSUPPORTED: "SC01_CONDITION_UNSUPPORTED",
  REPEAT_UNSUPPORTED: "SC01_REPEAT_UNSUPPORTED",
  BEHAVIOR_UNSUPPORTED: "SC01_BEHAVIOR_UNSUPPORTED",
  VARIANTS_UNSUPPORTED: "SC01_VARIANTS_UNSUPPORTED",
  A2UI_STREAM_UNSUPPORTED: "SC01_A2UI_STREAM_UNSUPPORTED",
  A2UI_SCHEMA_INVALID: "SC01_A2UI_SCHEMA_INVALID",
  A2UI_CATALOG_UNSUPPORTED: "SC01_A2UI_CATALOG_UNSUPPORTED",
  A2UI_SURFACE_UNSUPPORTED: "SC01_A2UI_SURFACE_UNSUPPORTED",
  A2UI_VERSION_UNSUPPORTED: "SC01_A2UI_VERSION_UNSUPPORTED",
  A2UI_MESSAGE_UNSUPPORTED: "SC01_A2UI_MESSAGE_UNSUPPORTED",
  A2UI_THEME_UNSUPPORTED: "SC01_A2UI_THEME_UNSUPPORTED",
  A2UI_STATE_UNSUPPORTED: "SC01_A2UI_STATE_UNSUPPORTED",
  A2UI_ACTION_UNSUPPORTED: "SC01_A2UI_ACTION_UNSUPPORTED",
  A2UI_COMPONENT_UNSUPPORTED: "SC01_A2UI_COMPONENT_UNSUPPORTED",
  A2UI_COMPONENT_ID_UNSUPPORTED: "SC01_A2UI_COMPONENT_ID_UNSUPPORTED",
  A2UI_ROOT_UNSUPPORTED: "SC01_A2UI_ROOT_UNSUPPORTED",
  A2UI_CHILDREN_UNSUPPORTED: "SC01_A2UI_CHILDREN_UNSUPPORTED",
  A2UI_DYNAMIC_VALUE_UNSUPPORTED: "SC01_A2UI_DYNAMIC_VALUE_UNSUPPORTED",
  A2UI_NON_CANONICAL: "SC01_A2UI_NON_CANONICAL",
  DESEN_SCHEMA_INVALID: "SC01_DESEN_SCHEMA_INVALID",
  DESEN_CATALOG_INVALID: "SC01_DESEN_CATALOG_INVALID",
  DESEN_CATALOG_CONTRACT_DRIFT: "SC01_DESEN_CATALOG_CONTRACT_DRIFT",
  FIXTURE_INTEGRITY_FAILED: "SC01_FIXTURE_INTEGRITY_FAILED",
  PROOF_DRIFT: "SC01_PROOF_DRIFT",
});

const PINNED_FILES = Object.freeze([
  Object.freeze({
    localName: "server_to_client.json",
    upstreamPath: "specification/v0_9_1/json/server_to_client.json",
    gitBlobSha1: "dcf138a1776b2039c8035aa263b7fa0ba244ab4e",
    sha256: "2ba29dbcb57611225c96d3e064d05cf97e9d8224b293c8b20d37b93922a2d30d",
  }),
  Object.freeze({
    localName: "common_types.json",
    upstreamPath: "specification/v0_9_1/json/common_types.json",
    gitBlobSha1: "51c5b036bcba83631aad780f5b6b78dad6b552f8",
    sha256: "ac79788e95e5bdf0a39808953593a53c1bc9fcdcdb55480f4610613c6591e94c",
  }),
  Object.freeze({
    localName: "basic-catalog.json",
    upstreamPath: "specification/v0_9_1/catalogs/basic/catalog.json",
    gitBlobSha1: "cefc2b98bb475d4399e1ebbcb5b81fa547ec5e1e",
    sha256: "4c694b68ee51e0e5716add4bcfddafb6311089df07314832f27decaca319c0d3",
  }),
]);

const IMPLEMENTATION_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/sc-01-a2ui-bridge-spike.mjs",
  "scripts/generate-sc-01-a2ui-bridge-proof.mjs",
  "scripts/verify-sc-01-a2ui-bridge.mjs",
  "tests/sc-01-a2ui-bridge-spike.test.mjs",
  "tests/fixtures/standards/a2ui/0.9.1/PROVENANCE.md",
  ...PINNED_FILES.map(({ localName }) =>
    path.posix.join("tests/fixtures/standards/a2ui/0.9.1", localName),
  ),
]);

/**
 * Stable failure shape for the deliberately narrow SC-01 interoperability spike.
 */
export class Sc01A2uiBridgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "Sc01A2uiBridgeError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new Sc01A2uiBridgeError(code, message, details);
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || utilTypes.isProxy(value)) {
    return false;
  }
  return !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function recordKeys(value, code, pointer, label) {
  if (!isPlainRecord(value)) {
    fail(code, `${label} must be a plain JSON object.`, { pointer });
  }
  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (
      typeof key !== "string" ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value")
    ) {
      fail(code, `${label} must contain enumerable own data properties only.`, { pointer });
    }
  }
  return keys;
}

function assertDataArray(value, code, pointer, label, maxLength) {
  if (
    utilTypes.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    fail(code, `${label} must be a JSON array.`, { pointer });
  }
  if (maxLength !== undefined && value.length > maxLength) {
    fail(code, `${label} exceeds the ${maxLength}-item profile limit.`, {
      pointer,
      actual: value.length,
      maximum: maxLength,
    });
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys[value.length] !== "length") {
    fail(code, `${label} must contain only dense indices and length.`, { pointer });
  }
  for (let index = 0; index < value.length; index += 1) {
    if (keys[index] !== String(index)) {
      fail(code, `${label} must contain only canonical dense indices.`, {
        pointer: `${pointer}/${index}`,
      });
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      fail(code, `${label} must be dense and contain data elements only.`, {
        pointer: `${pointer}/${index}`,
      });
    }
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    lengthDescriptor.enumerable ||
    !Object.hasOwn(lengthDescriptor, "value") ||
    lengthDescriptor.value !== value.length
  ) {
    fail(code, `${label} must have the ordinary own array length data property.`, {
      pointer,
    });
  }
}

function hasOwn(value, key) {
  return Object.hasOwn(value, key);
}

function mapPrimitiveString(value, mapping, code, pointer, message) {
  if (typeof value !== "string" || !hasOwn(mapping, value)) {
    fail(code, message, { pointer });
  }
  return mapping[value];
}

function requiredOwnDataValue(value, key, code, pointer, label) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
    fail(code, `${label} requires own data property ${key}.`, {
      pointer: `${pointer}/${key}`,
    });
  }
  return descriptor.value;
}

function assertExactKeys(value, allowed, required, code, pointer, label) {
  const keys = recordKeys(value, code, pointer, label);
  for (const requiredKey of required) {
    if (!keys.includes(requiredKey)) {
      fail(code, `${label} is missing ${requiredKey}.`, { pointer });
    }
  }
  for (const key of keys) {
    if (!allowed.includes(key)) {
      fail(code, `${label} contains unsupported field ${key}.`, {
        pointer: `${pointer}/${key}`,
      });
    }
  }
}

function assertIdentifier(value, code, pointer, label) {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    fail(code, `${label} must be a DESEN-compatible identifier.`, { pointer });
  }
}

function projectJsonData(value, code, pointer, label, state = { values: 0 }, depth = 0) {
  state.values += 1;
  if (state.values > MAX_SCHEMA_JSON_VALUES || depth > MAX_SCHEMA_JSON_DEPTH) {
    fail(code, `${label} exceeds the bounded JSON validation envelope.`, {
      pointer,
      maximumDepth: MAX_SCHEMA_JSON_DEPTH,
      maximumValues: MAX_SCHEMA_JSON_VALUES,
    });
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value === "object" && utilTypes.isProxy(value)) {
    fail(code, `${label} must contain JSON data without Proxy objects.`, {
      pointer,
    });
  }
  if (Array.isArray(value)) {
    assertDataArray(value, code, pointer, label, MAX_SCHEMA_JSON_VALUES);
    const projected = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      projected.push(
        projectJsonData(descriptor.value, code, `${pointer}/${index}`, label, state, depth + 1),
      );
    }
    return projected;
  }
  const keys = recordKeys(value, code, pointer, label);
  const projected = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    projected[key] = projectJsonData(
      descriptor.value,
      code,
      `${pointer}/${key}`,
      label,
      state,
      depth + 1,
    );
  }
  return projected;
}

function containsUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function containsControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit <= 0x1f || (unit >= 0x7f && unit <= 0x9f)) return true;
  }
  return false;
}

function isSafePlainText(value) {
  if (containsUnpairedSurrogate(value) || containsControlCharacter(value)) {
    return false;
  }
  if (/[\\`<>*_]/u.test(value)) return false;
  if (/!\[|\[[^\]]*\]\(|~~/u.test(value)) return false;
  if (/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/iu.test(value)) return false;
  if (/^ {0,3}(?:-\s*){3,}$/u.test(value) || /^ {4}/u.test(value)) return false;
  if (/^ {0,3}\[[^\]]+\]:/u.test(value)) return false;
  return !/^ {0,3}(?:#{1,6}|>|[-+*]|\d+[.)])(?:\s|$)/u.test(value);
}

function validateCatalogRequirement(catalogs) {
  assertDataArray(
    catalogs,
    SC01_A2UI_REJECTION_CODES.CATALOG_UNSUPPORTED,
    "/catalogs",
    "catalogs",
    1,
  );
  if (catalogs.length !== 1) {
    fail(
      SC01_A2UI_REJECTION_CODES.CATALOG_UNSUPPORTED,
      "SC-01 accepts exactly one Catalog requirement.",
      { pointer: "/catalogs" },
    );
  }
  const catalog = catalogs[0];
  assertExactKeys(
    catalog,
    ["id", "version", "target"],
    ["id", "version", "target"],
    SC01_A2UI_REJECTION_CODES.CATALOG_UNSUPPORTED,
    "/catalogs/0",
    "Catalog requirement",
  );
  if (
    catalog.id !== DESEN_CATALOG.id ||
    catalog.version !== DESEN_CATALOG.version ||
    catalog.target !== DESEN_CATALOG.target
  ) {
    fail(
      SC01_A2UI_REJECTION_CODES.CATALOG_UNSUPPORTED,
      "SC-01 accepts only com.example.web-catalog@1.0.0 for web-react.",
      { pointer: "/catalogs/0" },
    );
  }
}

function rejectUnsupportedNodeSemantics(node, pointer) {
  const semanticFields = [
    ["style", SC01_A2UI_REJECTION_CODES.STYLE_UNSUPPORTED],
    ["on", SC01_A2UI_REJECTION_CODES.EVENTS_UNSUPPORTED],
    ["when", SC01_A2UI_REJECTION_CODES.CONDITION_UNSUPPORTED],
    ["repeat", SC01_A2UI_REJECTION_CODES.REPEAT_UNSUPPORTED],
    ["behaviors", SC01_A2UI_REJECTION_CODES.BEHAVIOR_UNSUPPORTED],
    ["variants", SC01_A2UI_REJECTION_CODES.VARIANTS_UNSUPPORTED],
    ["extensions", SC01_A2UI_REJECTION_CODES.EXTENSIONS_UNSUPPORTED],
  ];
  for (const [field, code] of semanticFields) {
    if (hasOwn(node, field)) {
      fail(code, `SC-01 does not bridge node.${field}.`, {
        pointer: `${pointer}/${field}`,
      });
    }
  }
}

function validateStackNode(node, pointer, context, depth) {
  assertExactKeys(
    node,
    ["id", "use", "props", "slots"],
    ["id", "use", "props", "slots"],
    SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED,
    pointer,
    "Stack node",
  );
  const propsPointer = `${pointer}/props`;
  const props = node.props;
  recordKeys(props, SC01_A2UI_REJECTION_CODES.STACK_PROP_UNSUPPORTED, propsPointer, "Stack props");
  if (hasOwn(props, "gap")) {
    fail(
      SC01_A2UI_REJECTION_CODES.STACK_GAP_UNSUPPORTED,
      "Stack.gap has no exact structural SC-01 A2UI mapping.",
      { pointer: `${propsPointer}/gap` },
    );
  }
  if (hasOwn(props, "maxWidth")) {
    fail(
      SC01_A2UI_REJECTION_CODES.STACK_MAX_WIDTH_UNSUPPORTED,
      "Stack.maxWidth has no exact structural SC-01 A2UI mapping.",
      { pointer: `${propsPointer}/maxWidth` },
    );
  }
  if (!hasOwn(props, "direction")) {
    fail(
      SC01_A2UI_REJECTION_CODES.STACK_DIRECTION_UNSUPPORTED,
      "Stack.direction must be explicitly vertical or horizontal.",
      { pointer: `${propsPointer}/direction` },
    );
  }
  if (!hasOwn(props, "align")) {
    fail(
      SC01_A2UI_REJECTION_CODES.STACK_ALIGN_UNSUPPORTED,
      "Stack.align must be explicit in SC01_STATIC_TEXT_V1.",
      { pointer: `${propsPointer}/align` },
    );
  }
  assertExactKeys(
    props,
    ["direction", "align"],
    ["direction", "align"],
    SC01_A2UI_REJECTION_CODES.STACK_PROP_UNSUPPORTED,
    propsPointer,
    "Stack props",
  );
  mapPrimitiveString(
    props.direction,
    DIRECTION_TO_COMPONENT,
    SC01_A2UI_REJECTION_CODES.STACK_DIRECTION_UNSUPPORTED,
    `${propsPointer}/direction`,
    "Stack.direction must be explicitly vertical or horizontal.",
  );
  if (!ALIGN_VALUES.includes(props.align)) {
    fail(
      SC01_A2UI_REJECTION_CODES.STACK_ALIGN_UNSUPPORTED,
      "Stack.align must be start, center, end, or stretch.",
      { pointer: `${propsPointer}/align` },
    );
  }

  assertExactKeys(
    node.slots,
    ["default"],
    ["default"],
    SC01_A2UI_REJECTION_CODES.SLOTS_UNSUPPORTED,
    `${pointer}/slots`,
    "Stack slots",
  );
  assertDataArray(
    node.slots.default,
    SC01_A2UI_REJECTION_CODES.SLOTS_UNSUPPORTED,
    `${pointer}/slots/default`,
    "Stack default slot",
    MAX_COMPONENTS,
  );
  for (let index = 0; index < node.slots.default.length; index += 1) {
    validateDesenNode(
      node.slots.default[index],
      `${pointer}/slots/default/${index}`,
      context,
      depth + 1,
    );
  }
}

function validateTextNode(node, pointer) {
  if (hasOwn(node, "slots")) {
    fail(
      SC01_A2UI_REJECTION_CODES.SLOTS_UNSUPPORTED,
      "Text cannot own slots in the SC-01 subset.",
      { pointer: `${pointer}/slots` },
    );
  }
  assertExactKeys(
    node,
    ["id", "use", "props"],
    ["id", "use", "props"],
    SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED,
    pointer,
    "Text node",
  );
  assertExactKeys(
    node.props,
    ["text", "role"],
    ["text", "role"],
    SC01_A2UI_REJECTION_CODES.TEXT_PROP_UNSUPPORTED,
    `${pointer}/props`,
    "Text props",
  );
  if (typeof node.props.text !== "string") {
    fail(
      SC01_A2UI_REJECTION_CODES.TEXT_VALUE_UNSUPPORTED,
      "Text.text must be a literal string; bindings and formatted values are unsupported.",
      { pointer: `${pointer}/props/text` },
    );
  }
  if (node.props.text.length > MAX_TEXT_UTF16_CODE_UNITS) {
    fail(
      SC01_A2UI_REJECTION_CODES.TEXT_LENGTH_UNSUPPORTED,
      `Text.text exceeds the ${MAX_TEXT_UTF16_CODE_UNITS}-UTF-16-code-unit profile limit.`,
      {
        pointer: `${pointer}/props/text`,
        actual: node.props.text.length,
        maximum: MAX_TEXT_UTF16_CODE_UNITS,
      },
    );
  }
  if (!isSafePlainText(node.props.text)) {
    fail(
      SC01_A2UI_REJECTION_CODES.TEXT_PLAIN_UNSAFE,
      "Text.text must not contain control, HTML, entity, or Markdown syntax in SC-01.",
      { pointer: `${pointer}/props/text` },
    );
  }
  mapPrimitiveString(
    node.props.role,
    ROLE_TO_VARIANT,
    SC01_A2UI_REJECTION_CODES.TEXT_ROLE_UNSUPPORTED,
    `${pointer}/props/role`,
    "Text.role must be body, heading, or caption.",
  );
}

function validateDesenNode(node, pointer, context, depth) {
  if (depth > MAX_DEPTH) {
    fail(
      SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED,
      `SC-01 component depth exceeds ${MAX_DEPTH}.`,
      { pointer },
    );
  }
  recordKeys(node, SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED, pointer, "DESEN node");
  rejectUnsupportedNodeSemantics(node, pointer);
  if (!hasOwn(node, "id") || !hasOwn(node, "use")) {
    fail(SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED, "Every SC-01 node requires id and use.", {
      pointer,
    });
  }
  assertIdentifier(
    node.id,
    SC01_A2UI_REJECTION_CODES.COMPONENT_ID_UNSUPPORTED,
    `${pointer}/id`,
    "Component id",
  );
  if (context.ids.has(node.id)) {
    fail(SC01_A2UI_REJECTION_CODES.COMPONENT_ID_UNSUPPORTED, `Duplicate component id ${node.id}.`, {
      pointer: `${pointer}/id`,
    });
  }
  context.ids.add(node.id);
  context.count += 1;
  if (context.count > MAX_COMPONENTS) {
    fail(
      SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED,
      `SC-01 accepts at most ${MAX_COMPONENTS} components.`,
      { pointer },
    );
  }
  if (node.use === STACK_USE) {
    validateStackNode(node, pointer, context, depth);
  } else if (node.use === TEXT_USE) {
    validateTextNode(node, pointer);
  } else {
    fail(
      SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED,
      "SC-01 accepts only com.example.ui/Stack and com.example.ui/Text.",
      { pointer: `${pointer}/use`, use: node.use },
    );
  }
}

function validateDesenSource(source) {
  recordKeys(source, SC01_A2UI_REJECTION_CODES.SOURCE_SHAPE_UNSUPPORTED, "", "DESEN Source");
  if (hasOwn(source, "authoring")) {
    fail(
      SC01_A2UI_REJECTION_CODES.AUTHORING_UNSUPPORTED,
      "SC-01 does not bridge authoring metadata.",
      { pointer: "/authoring" },
    );
  }
  if (hasOwn(source, "extensions")) {
    fail(
      SC01_A2UI_REJECTION_CODES.EXTENSIONS_UNSUPPORTED,
      "SC-01 does not bridge Source extensions.",
      { pointer: "/extensions" },
    );
  }
  assertExactKeys(
    source,
    ["kind", "desen", "id", "catalogs", "entry", "surfaces"],
    ["kind", "desen", "id", "catalogs", "entry", "surfaces"],
    SC01_A2UI_REJECTION_CODES.SOURCE_SHAPE_UNSUPPORTED,
    "",
    "DESEN Source",
  );
  if (source.kind !== DESEN_KIND || source.desen !== DESEN_VERSION) {
    fail(
      SC01_A2UI_REJECTION_CODES.SOURCE_SHAPE_UNSUPPORTED,
      "SC-01 accepts only kind desen.source at DESEN 0.1.0.",
      { pointer: source.kind !== DESEN_KIND ? "/kind" : "/desen" },
    );
  }
  assertIdentifier(
    source.id,
    SC01_A2UI_REJECTION_CODES.SOURCE_IDENTITY_UNSUPPORTED,
    "/id",
    "Source id",
  );
  validateCatalogRequirement(source.catalogs);
  assertIdentifier(
    source.entry,
    SC01_A2UI_REJECTION_CODES.SOURCE_IDENTITY_UNSUPPORTED,
    "/entry",
    "Source entry",
  );
  const surfaceKeys = recordKeys(
    source.surfaces,
    SC01_A2UI_REJECTION_CODES.SOURCE_IDENTITY_UNSUPPORTED,
    "/surfaces",
    "surfaces",
  );
  if (source.id !== source.entry || surfaceKeys.length !== 1 || surfaceKeys[0] !== source.id) {
    fail(
      SC01_A2UI_REJECTION_CODES.SOURCE_IDENTITY_UNSUPPORTED,
      "Source id, entry, sole surface key, and surface id must be identical.",
      { pointer: "/surfaces" },
    );
  }
  const surface = source.surfaces[source.id];
  recordKeys(
    surface,
    SC01_A2UI_REJECTION_CODES.SOURCE_SHAPE_UNSUPPORTED,
    `/surfaces/${source.id}`,
    "Surface",
  );
  if (hasOwn(surface, "extensions")) {
    fail(
      SC01_A2UI_REJECTION_CODES.EXTENSIONS_UNSUPPORTED,
      "SC-01 does not bridge Surface extensions.",
      { pointer: `/surfaces/${source.id}/extensions` },
    );
  }
  assertExactKeys(
    surface,
    ["id", "state", "resources", "root"],
    ["id", "state", "resources", "root"],
    SC01_A2UI_REJECTION_CODES.SOURCE_SHAPE_UNSUPPORTED,
    `/surfaces/${source.id}`,
    "Surface",
  );
  if (surface.id !== source.id) {
    fail(
      SC01_A2UI_REJECTION_CODES.SOURCE_IDENTITY_UNSUPPORTED,
      "The sole Surface id must equal Source id.",
      { pointer: `/surfaces/${source.id}/id` },
    );
  }
  const stateKeys = recordKeys(
    surface.state,
    SC01_A2UI_REJECTION_CODES.STATE_UNSUPPORTED,
    `/surfaces/${source.id}/state`,
    "Surface state",
  );
  if (stateKeys.length !== 0) {
    fail(
      SC01_A2UI_REJECTION_CODES.STATE_UNSUPPORTED,
      "SC-01 accepts only an empty required DESEN state object.",
      { pointer: `/surfaces/${source.id}/state` },
    );
  }
  const resourceKeys = recordKeys(
    surface.resources,
    SC01_A2UI_REJECTION_CODES.RESOURCES_UNSUPPORTED,
    `/surfaces/${source.id}/resources`,
    "Surface resources",
  );
  if (resourceKeys.length !== 0) {
    fail(
      SC01_A2UI_REJECTION_CODES.RESOURCES_UNSUPPORTED,
      "SC-01 accepts only an empty required DESEN resources object.",
      { pointer: `/surfaces/${source.id}/resources` },
    );
  }
  const context = { ids: new Set(), count: 0 };
  validateDesenNode(surface.root, `/surfaces/${source.id}/root`, context, 0);
  if (surface.root.id !== "root") {
    fail(
      SC01_A2UI_REJECTION_CODES.ROOT_ID_UNSUPPORTED,
      'The SC-01 root component id must be "root".',
      { pointer: `/surfaces/${source.id}/root/id` },
    );
  }
  return Object.freeze({ surface, componentCount: context.count });
}

function encodeDesenNode(node, components) {
  if (node.use === TEXT_USE) {
    components.push({
      id: node.id,
      component: "Text",
      text: node.props.text,
      variant: mapPrimitiveString(
        node.props.role,
        ROLE_TO_VARIANT,
        SC01_A2UI_REJECTION_CODES.TEXT_ROLE_UNSUPPORTED,
        `/components/${node.id}/props/role`,
        "Text.role must be body, heading, or caption.",
      ),
    });
    return;
  }
  const children = [];
  let childIndex = 0;
  while (childIndex < node.slots.default.length) {
    children.push(node.slots.default[childIndex].id);
    childIndex += 1;
  }
  const component = {
    id: node.id,
    component: mapPrimitiveString(
      node.props.direction,
      DIRECTION_TO_COMPONENT,
      SC01_A2UI_REJECTION_CODES.STACK_DIRECTION_UNSUPPORTED,
      `/components/${node.id}/props/direction`,
      "Stack.direction must be explicitly vertical or horizontal.",
    ),
    children,
    align: node.props.align,
  };
  components.push(component);
  let encodeIndex = 0;
  while (encodeIndex < node.slots.default.length) {
    encodeDesenNode(node.slots.default[encodeIndex], components);
    encodeIndex += 1;
  }
}

/**
 * Encodes only the explicitly bounded SC-01 exact-structural-field Source subset.
 */
export function desenSourceToA2uiStream(source) {
  const { surface } = validateDesenSource(source);
  const components = [];
  encodeDesenNode(surface.root, components);
  return deepFreeze([
    {
      version: SC01_A2UI_VERSION,
      createSurface: {
        surfaceId: source.id,
        catalogId: SC01_A2UI_CATALOG_ID,
      },
    },
    {
      version: SC01_A2UI_VERSION,
      updateComponents: {
        surfaceId: source.id,
        components,
      },
    },
  ]);
}

function rejectA2uiMessageSemantics(message, index) {
  const pointer = `/${index}`;
  recordKeys(message, SC01_A2UI_REJECTION_CODES.A2UI_STREAM_UNSUPPORTED, pointer, "A2UI message");
  const version = requiredOwnDataValue(
    message,
    "version",
    SC01_A2UI_REJECTION_CODES.A2UI_VERSION_UNSUPPORTED,
    pointer,
    "A2UI message",
  );
  if (hasOwn(message, "updateDataModel")) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_STATE_UNSUPPORTED,
      "SC-01 does not bridge A2UI data-model updates.",
      { pointer: `${pointer}/updateDataModel` },
    );
  }
  if (hasOwn(message, "deleteSurface")) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_MESSAGE_UNSUPPORTED,
      "SC-01 accepts only createSurface followed by updateComponents.",
      { pointer: `${pointer}/deleteSurface` },
    );
  }
  if (version !== SC01_A2UI_VERSION) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_VERSION_UNSUPPORTED,
      "SC-01 emits and accepts only A2UI message version v0.9.1.",
      { pointer: `${pointer}/version` },
    );
  }
}

function rejectA2uiComponentAction(component, pointer) {
  const keys = recordKeys(
    component,
    SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
    pointer,
    "A2UI component",
  );
  for (const key of keys) {
    if (/^(?:on|action|actions|event|functionCall)/u.test(key)) {
      fail(
        SC01_A2UI_REJECTION_CODES.A2UI_ACTION_UNSUPPORTED,
        `SC-01 does not bridge A2UI action field ${key}.`,
        { pointer: `${pointer}/${key}` },
      );
    }
  }
  return keys;
}

function parseA2uiComponents(components) {
  assertDataArray(
    components,
    SC01_A2UI_REJECTION_CODES.A2UI_STREAM_UNSUPPORTED,
    "/1/updateComponents/components",
    "A2UI components",
    MAX_COMPONENTS,
  );
  if (components.length === 0 || components.length > MAX_COMPONENTS) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
      `SC-01 requires 1 to ${MAX_COMPONENTS} A2UI components.`,
      { pointer: "/1/updateComponents/components" },
    );
  }
  const byId = new Map();
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const pointer = `/1/updateComponents/components/${index}`;
    rejectA2uiComponentAction(component, pointer);
    const id = requiredOwnDataValue(
      component,
      "id",
      SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_ID_UNSUPPORTED,
      pointer,
      "A2UI component",
    );
    const componentKind = requiredOwnDataValue(
      component,
      "component",
      SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
      pointer,
      "A2UI component",
    );
    assertIdentifier(
      id,
      SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_ID_UNSUPPORTED,
      `${pointer}/id`,
      "A2UI component id",
    );
    if (byId.has(id)) {
      fail(
        SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_ID_UNSUPPORTED,
        `Duplicate A2UI component id ${id}.`,
        { pointer: `${pointer}/id` },
      );
    }
    if (componentKind === "Text") {
      assertExactKeys(
        component,
        ["id", "component", "text", "variant"],
        ["id", "component", "text", "variant"],
        SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
        pointer,
        "A2UI Text",
      );
      if (typeof component.text !== "string") {
        fail(
          SC01_A2UI_REJECTION_CODES.A2UI_DYNAMIC_VALUE_UNSUPPORTED,
          "SC-01 accepts only literal A2UI Text.text strings.",
          { pointer: `${pointer}/text` },
        );
      }
      if (component.text.length > MAX_TEXT_UTF16_CODE_UNITS) {
        fail(
          SC01_A2UI_REJECTION_CODES.TEXT_LENGTH_UNSUPPORTED,
          `A2UI Text.text exceeds the ${MAX_TEXT_UTF16_CODE_UNITS}-UTF-16-code-unit profile limit.`,
          {
            pointer: `${pointer}/text`,
            actual: component.text.length,
            maximum: MAX_TEXT_UTF16_CODE_UNITS,
          },
        );
      }
      if (!isSafePlainText(component.text)) {
        fail(
          SC01_A2UI_REJECTION_CODES.TEXT_PLAIN_UNSAFE,
          "A2UI Text.text must be safe plain text for an exact structural DESEN mapping.",
          { pointer: `${pointer}/text` },
        );
      }
      mapPrimitiveString(
        component.variant,
        VARIANT_TO_ROLE,
        SC01_A2UI_REJECTION_CODES.TEXT_ROLE_UNSUPPORTED,
        `${pointer}/variant`,
        "SC-01 accepts only A2UI Text variants body, h2, and caption.",
      );
    } else if (componentKind === "Row" || componentKind === "Column") {
      if (!hasOwn(component, "align")) {
        fail(
          SC01_A2UI_REJECTION_CODES.STACK_ALIGN_UNSUPPORTED,
          "A2UI Row/Column align must be explicit in SC01_STATIC_TEXT_V1.",
          { pointer: `${pointer}/align` },
        );
      }
      assertExactKeys(
        component,
        ["id", "component", "children", "align"],
        ["id", "component", "children", "align"],
        SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
        pointer,
        `A2UI ${componentKind}`,
      );
      if (!ALIGN_VALUES.includes(component.align)) {
        fail(
          SC01_A2UI_REJECTION_CODES.STACK_ALIGN_UNSUPPORTED,
          "A2UI Row/Column align is outside the exact structural Stack subset.",
          { pointer: `${pointer}/align` },
        );
      }
      if (!Array.isArray(component.children)) {
        fail(
          SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
          "Dynamic A2UI ChildList templates are unsupported.",
          { pointer: `${pointer}/children` },
        );
      }
      assertDataArray(
        component.children,
        SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
        `${pointer}/children`,
        "A2UI static children",
        MAX_COMPONENTS,
      );
      for (let childIndex = 0; childIndex < component.children.length; childIndex += 1) {
        assertIdentifier(
          component.children[childIndex],
          SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
          `${pointer}/children/${childIndex}`,
          "A2UI child reference",
        );
      }
    } else {
      fail(
        SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
        "SC-01 accepts only A2UI Column, Row, and Text.",
        { pointer: `${pointer}/component`, component: componentKind },
      );
    }
    byId.set(id, component);
  }
  return byId;
}

function reconstructDesenTree(byId) {
  const root = byId.get("root");
  if (root === undefined) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_ROOT_UNSUPPORTED,
      'A2UI components must contain id "root".',
      { pointer: "/1/updateComponents/components" },
    );
  }
  const parentCounts = new Map();
  for (const id of byId.keys()) parentCounts.set(id, 0);
  for (const component of byId.values()) {
    if (component.component === "Text") continue;
    let index = 0;
    while (index < component.children.length) {
      const childId = component.children[index];
      if (!byId.has(childId)) {
        fail(
          SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
          `A2UI child reference ${childId} does not exist.`,
          { componentId: component.id, childId },
        );
      }
      parentCounts.set(childId, (parentCounts.get(childId) ?? 0) + 1);
      index += 1;
    }
  }
  if (parentCounts.get("root") !== 0) {
    fail(SC01_A2UI_REJECTION_CODES.A2UI_ROOT_UNSUPPORTED, "A2UI root cannot be a child.", {
      componentId: "root",
    });
  }
  for (const [id, count] of parentCounts) {
    if (id !== "root" && count !== 1) {
      fail(
        SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
        `A2UI component ${id} must have exactly one parent.`,
        { componentId: id, parents: count },
      );
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(component, depth) {
    if (depth > MAX_DEPTH || visiting.has(component.id)) {
      fail(
        SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
        "A2UI component graph must be an acyclic bounded tree.",
        { componentId: component.id },
      );
    }
    visiting.add(component.id);
    let node;
    if (component.component === "Text") {
      node = {
        id: component.id,
        use: TEXT_USE,
        props: {
          text: component.text,
          role: mapPrimitiveString(
            component.variant,
            VARIANT_TO_ROLE,
            SC01_A2UI_REJECTION_CODES.TEXT_ROLE_UNSUPPORTED,
            `/components/${component.id}/variant`,
            "SC-01 accepts only A2UI Text variants body, h2, and caption.",
          ),
        },
      };
    } else {
      const props = {
        direction: mapPrimitiveString(
          component.component,
          COMPONENT_TO_DIRECTION,
          SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
          `/components/${component.id}/component`,
          "SC-01 accepts only A2UI Column, Row, and Text.",
        ),
        align: component.align,
      };
      const children = [];
      let index = 0;
      while (index < component.children.length) {
        children.push(visit(byId.get(component.children[index]), depth + 1));
        index += 1;
      }
      node = {
        id: component.id,
        use: STACK_USE,
        props,
        slots: {
          default: children,
        },
      };
    }
    visiting.delete(component.id);
    visited.add(component.id);
    return node;
  }
  const tree = visit(root, 0);
  if (visited.size !== byId.size) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
      "Every A2UI component must be reachable from root.",
      { visited: visited.size, components: byId.size },
    );
  }
  return tree;
}

/**
 * Decodes only the canonical A2UI stream emitted by the SC-01 bridge.
 */
export function a2uiStreamToDesenSource(stream) {
  assertDataArray(stream, SC01_A2UI_REJECTION_CODES.A2UI_STREAM_UNSUPPORTED, "", "A2UI stream", 2);
  if (stream.length !== 2) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_STREAM_UNSUPPORTED,
      "SC-01 requires exactly createSurface then updateComponents.",
      { pointer: "" },
    );
  }
  rejectA2uiMessageSemantics(stream[0], 0);
  rejectA2uiMessageSemantics(stream[1], 1);
  assertExactKeys(
    stream[0],
    ["version", "createSurface"],
    ["version", "createSurface"],
    SC01_A2UI_REJECTION_CODES.A2UI_MESSAGE_UNSUPPORTED,
    "/0",
    "First A2UI message",
  );
  assertExactKeys(
    stream[1],
    ["version", "updateComponents"],
    ["version", "updateComponents"],
    SC01_A2UI_REJECTION_CODES.A2UI_MESSAGE_UNSUPPORTED,
    "/1",
    "Second A2UI message",
  );
  const create = stream[0].createSurface;
  recordKeys(
    create,
    SC01_A2UI_REJECTION_CODES.A2UI_MESSAGE_UNSUPPORTED,
    "/0/createSurface",
    "createSurface",
  );
  if (hasOwn(create, "theme") || hasOwn(create, "sendDataModel")) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_THEME_UNSUPPORTED,
      "SC-01 does not bridge A2UI theme or sendDataModel.",
      {
        pointer: hasOwn(create, "theme")
          ? "/0/createSurface/theme"
          : "/0/createSurface/sendDataModel",
      },
    );
  }
  assertExactKeys(
    create,
    ["surfaceId", "catalogId"],
    ["surfaceId", "catalogId"],
    SC01_A2UI_REJECTION_CODES.A2UI_MESSAGE_UNSUPPORTED,
    "/0/createSurface",
    "createSurface",
  );
  if (create.catalogId !== SC01_A2UI_CATALOG_ID) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_CATALOG_UNSUPPORTED,
      "SC-01 requires the exact Basic Catalog schema-owned catalogId.",
      { pointer: "/0/createSurface/catalogId" },
    );
  }
  assertIdentifier(
    create.surfaceId,
    SC01_A2UI_REJECTION_CODES.A2UI_SURFACE_UNSUPPORTED,
    "/0/createSurface/surfaceId",
    "A2UI surfaceId",
  );
  const update = stream[1].updateComponents;
  assertExactKeys(
    update,
    ["surfaceId", "components"],
    ["surfaceId", "components"],
    SC01_A2UI_REJECTION_CODES.A2UI_MESSAGE_UNSUPPORTED,
    "/1/updateComponents",
    "updateComponents",
  );
  if (update.surfaceId !== create.surfaceId) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_SURFACE_UNSUPPORTED,
      "Both A2UI messages must address the same surfaceId.",
      { pointer: "/1/updateComponents/surfaceId" },
    );
  }
  const byId = parseA2uiComponents(update.components);
  const root = reconstructDesenTree(byId);
  const source = {
    kind: DESEN_KIND,
    desen: DESEN_VERSION,
    id: create.surfaceId,
    catalogs: [{ ...DESEN_CATALOG }],
    entry: create.surfaceId,
    surfaces: {
      [create.surfaceId]: {
        id: create.surfaceId,
        state: {},
        resources: {},
        root,
      },
    },
  };
  const canonicalStream = desenSourceToA2uiStream(source);
  if (!isDeepStrictEqual(canonicalStream, stream)) {
    fail(
      SC01_A2UI_REJECTION_CODES.A2UI_NON_CANONICAL,
      "A2UI input is valid subset data but not the bridge's canonical two-message encoding.",
      {},
    );
  }
  return deepFreeze(source);
}

function normalizeFixtureDirectory(options) {
  if (options === undefined) return DEFAULT_SC01_A2UI_FIXTURE_DIRECTORY;
  if (!isPlainRecord(options)) {
    fail(SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID, "Options must be a plain object.");
  }
  assertExactKeys(
    options,
    ["fixtureDirectory"],
    [],
    SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID,
    "",
    "Options",
  );
  if (
    hasOwn(options, "fixtureDirectory") &&
    (typeof options.fixtureDirectory !== "string" || !path.isAbsolute(options.fixtureDirectory))
  ) {
    fail(SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID, "fixtureDirectory must be an absolute path.");
  }
  return options.fixtureDirectory ?? DEFAULT_SC01_A2UI_FIXTURE_DIRECTORY;
}

async function readRegularFile(filePath, label) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail(SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED, `${label} cannot be read.`, {
      file: path.basename(filePath),
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      `${label} must be a regular file, not a symlink or directory.`,
      { file: path.basename(filePath) },
    );
  }
  return readFile(filePath);
}

async function loadPinnedSchemas(fixtureDirectory) {
  const schemas = {};
  const files = [];
  for (const pinned of PINNED_FILES) {
    const bytes = await readRegularFile(
      path.join(fixtureDirectory, pinned.localName),
      `Pinned ${pinned.localName}`,
    );
    const actualSha256 = sha256Hex(bytes);
    const actualGitBlobSha1 = gitBlobSha1(bytes);
    if (actualSha256 !== pinned.sha256 || actualGitBlobSha1 !== pinned.gitBlobSha1) {
      fail(
        SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
        `Pinned ${pinned.localName} bytes differ from the recorded upstream blob.`,
        {
          file: pinned.localName,
          expectedSha256: pinned.sha256,
          actualSha256,
          expectedGitBlobSha1: pinned.gitBlobSha1,
          actualGitBlobSha1,
        },
      );
    }
    try {
      schemas[pinned.localName] = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      fail(
        SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
        `Pinned ${pinned.localName} is not JSON.`,
        { file: pinned.localName, cause: String(error) },
      );
    }
    files.push(
      Object.freeze({
        localName: pinned.localName,
        upstreamPath: pinned.upstreamPath,
        url: `https://github.com/a2ui-project/a2ui/blob/${SC01_A2UI_COMMIT}/${pinned.upstreamPath}`,
        rawUrl: `https://raw.githubusercontent.com/a2ui-project/a2ui/${SC01_A2UI_COMMIT}/${pinned.upstreamPath}`,
        gitBlobSha1: pinned.gitBlobSha1,
        sha256: `sha256:${pinned.sha256}`,
        bytes: bytes.length,
      }),
    );
  }
  const provenanceBytes = await readRegularFile(
    path.join(fixtureDirectory, "PROVENANCE.md"),
    "Pinned provenance",
  );
  const provenance = provenanceBytes.toString("utf8");
  for (const required of [
    SC01_A2UI_COMMIT,
    SC01_A2UI_SPEC_TREE,
    SC01_A2UI_CATALOG_ID,
    A2UI_CATALOG_ALIAS_ID,
  ]) {
    if (!provenance.includes(required)) {
      fail(
        SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
        "Pinned provenance omits a required identity.",
        { missing: required },
      );
    }
  }
  const server = schemas["server_to_client.json"];
  const common = schemas["common_types.json"];
  const catalog = schemas["basic-catalog.json"];
  if (
    server.$id !== "https://a2ui.org/specification/v0_9/server_to_client.json" ||
    common.$id !== "https://a2ui.org/specification/v0_9/common_types.json" ||
    catalog.$id !== SC01_A2UI_CATALOG_ID ||
    catalog.catalogId !== SC01_A2UI_CATALOG_ID ||
    !server.$defs?.CreateSurfaceMessage?.properties?.version?.enum?.includes(SC01_A2UI_VERSION)
  ) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      "Pinned schemas do not expose the expected 0.9.1 message and v0_9 Catalog identities.",
    );
  }
  return Object.freeze({
    schemas,
    files: Object.freeze(files),
    provenanceSha256: `sha256:${sha256Hex(provenanceBytes)}`,
  });
}

function formatAjvErrors(errors) {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    keyword: error.keyword,
    message: error.message,
    schemaPath: error.schemaPath,
  }));
}

/**
 * Validates every stream message offline against the exact pinned A2UI 0.9.1 schemas.
 */
export async function validateA2uiStreamAgainstPinnedSchemas(stream, options) {
  if (AJV_VERSION !== "8.20.0") {
    fail(
      SC01_A2UI_REJECTION_CODES.PROOF_DRIFT,
      "SC-01 requires the workspace-pinned Ajv 8.20.0 validation engine.",
      { expected: "8.20.0", actual: AJV_VERSION },
    );
  }
  const fixtureDirectory = normalizeFixtureDirectory(options);
  const pinned = await loadPinnedSchemas(fixtureDirectory);
  const catalogAlias = cloneJson(pinned.schemas["basic-catalog.json"]);
  catalogAlias.$id = A2UI_CATALOG_ALIAS_ID;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  ajv.addSchema(pinned.schemas["common_types.json"]);
  ajv.addSchema(catalogAlias);
  const validate = ajv.compile(pinned.schemas["server_to_client.json"]);
  assertDataArray(
    stream,
    SC01_A2UI_REJECTION_CODES.A2UI_SCHEMA_INVALID,
    "",
    "A2UI schema input",
    2,
  );
  for (let index = 0; index < stream.length; index += 1) {
    const schemaInput = projectJsonData(
      stream[index],
      SC01_A2UI_REJECTION_CODES.A2UI_SCHEMA_INVALID,
      `/${index}`,
      "A2UI schema message",
    );
    if (!validate(schemaInput)) {
      fail(
        SC01_A2UI_REJECTION_CODES.A2UI_SCHEMA_INVALID,
        `A2UI message ${index} fails the pinned official server_to_client schema.`,
        { index, errors: formatAjvErrors(validate.errors) },
      );
    }
  }
  return deepFreeze({
    result: "PASS",
    messages: stream.length,
    files: pinned.files,
    provenanceSha256: pinned.provenanceSha256,
    catalogAlias: {
      mode: "official-runner-compatible in-memory $id alias",
      schemaOwnedCatalogId: SC01_A2UI_CATALOG_ID,
      resolverId: A2UI_CATALOG_ALIAS_ID,
      emittedCatalogIdChanged: false,
    },
  });
}

/**
 * Validates a Source offline against the exact frozen DESEN 0.1.0 Source schema.
 */
export async function validateDesenSourceAgainstPinnedSchema(source) {
  const schemaPath = path.join(WORKSPACE_ROOT, DESEN_SOURCE_SCHEMA_RELATIVE_PATH);
  const checksumsPath = path.join(WORKSPACE_ROOT, DESEN_CHECKSUMS_RELATIVE_PATH);
  const [schemaBytes, checksumsBytes] = await Promise.all([
    readRegularFile(schemaPath, "Frozen DESEN Source schema"),
    readRegularFile(checksumsPath, "Frozen DESEN checksum ledger"),
  ]);
  const schemaSha256 = sha256Hex(schemaBytes);
  const checksumsSha256 = sha256Hex(checksumsBytes);
  const expectedLedgerLine = `${DESEN_SOURCE_SCHEMA_SHA256}  ./schemas/desen-source.schema.json`;
  if (
    schemaSha256 !== DESEN_SOURCE_SCHEMA_SHA256 ||
    checksumsSha256 !== DESEN_CHECKSUMS_SHA256 ||
    !checksumsBytes.toString("utf8").split(/\r?\n/u).includes(expectedLedgerLine)
  ) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      "Frozen DESEN Source schema or its checksum ledger differs from the 0.1.0 pin.",
      {
        schemaPath: DESEN_SOURCE_SCHEMA_RELATIVE_PATH,
        expectedSchemaSha256: DESEN_SOURCE_SCHEMA_SHA256,
        actualSchemaSha256: schemaSha256,
        expectedChecksumsSha256: DESEN_CHECKSUMS_SHA256,
        actualChecksumsSha256: checksumsSha256,
      },
    );
  }
  let schema;
  try {
    schema = JSON.parse(schemaBytes.toString("utf8"));
  } catch (error) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      "Frozen DESEN Source schema is not JSON.",
      { cause: String(error) },
    );
  }
  if (schema.$id !== DESEN_SOURCE_SCHEMA_ID) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      "Frozen DESEN Source schema has an unexpected $id.",
      { expected: DESEN_SOURCE_SCHEMA_ID, actual: schema.$id },
    );
  }
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  const validate = ajv.compile(schema);
  const schemaInput = projectJsonData(
    source,
    SC01_A2UI_REJECTION_CODES.DESEN_SCHEMA_INVALID,
    "",
    "DESEN schema input",
  );
  if (!validate(schemaInput)) {
    fail(
      SC01_A2UI_REJECTION_CODES.DESEN_SCHEMA_INVALID,
      "DESEN Source fails the frozen 0.1.0 Source schema.",
      { errors: formatAjvErrors(validate.errors) },
    );
  }
  return deepFreeze({
    result: "PASS",
    schemaPath: DESEN_SOURCE_SCHEMA_RELATIVE_PATH,
    schemaId: DESEN_SOURCE_SCHEMA_ID,
    schemaSha256: `sha256:${DESEN_SOURCE_SCHEMA_SHA256}`,
    checksumLedger: {
      path: DESEN_CHECKSUMS_RELATIVE_PATH,
      sha256: `sha256:${DESEN_CHECKSUMS_SHA256}`,
      sourceSchemaEntryMatched: true,
    },
  });
}

/**
 * Pins and validates the frozen example Catalog that defines the SC-01 DESEN Stack/Text side.
 */
export async function validatePinnedDesenCatalogProfile() {
  const schemaPath = path.join(WORKSPACE_ROOT, DESEN_CATALOG_SCHEMA_RELATIVE_PATH);
  const examplePath = path.join(WORKSPACE_ROOT, DESEN_CATALOG_EXAMPLE_RELATIVE_PATH);
  const checksumsPath = path.join(WORKSPACE_ROOT, DESEN_CHECKSUMS_RELATIVE_PATH);
  const [schemaBytes, exampleBytes, checksumsBytes] = await Promise.all([
    readRegularFile(schemaPath, "Frozen DESEN Catalog schema"),
    readRegularFile(examplePath, "Frozen DESEN example Catalog"),
    readRegularFile(checksumsPath, "Frozen DESEN checksum ledger"),
  ]);
  const actual = {
    schemaSha256: sha256Hex(schemaBytes),
    exampleSha256: sha256Hex(exampleBytes),
    checksumsSha256: sha256Hex(checksumsBytes),
  };
  const ledgerLines = checksumsBytes.toString("utf8").split(/\r?\n/u);
  const expectedSchemaLine = `${DESEN_CATALOG_SCHEMA_SHA256}  ./schemas/desen-catalog.schema.json`;
  const expectedExampleLine = `${DESEN_CATALOG_EXAMPLE_SHA256}  ./examples/catalog.web.example.json`;
  if (
    actual.schemaSha256 !== DESEN_CATALOG_SCHEMA_SHA256 ||
    actual.exampleSha256 !== DESEN_CATALOG_EXAMPLE_SHA256 ||
    actual.checksumsSha256 !== DESEN_CHECKSUMS_SHA256 ||
    !ledgerLines.includes(expectedSchemaLine) ||
    !ledgerLines.includes(expectedExampleLine)
  ) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      "Frozen DESEN Catalog schema, example, or checksum ledger differs from the 0.1.0 pin.",
      {
        expected: {
          schemaSha256: DESEN_CATALOG_SCHEMA_SHA256,
          exampleSha256: DESEN_CATALOG_EXAMPLE_SHA256,
          checksumsSha256: DESEN_CHECKSUMS_SHA256,
        },
        actual,
      },
    );
  }

  let schema;
  let catalog;
  try {
    schema = JSON.parse(schemaBytes.toString("utf8"));
    catalog = JSON.parse(exampleBytes.toString("utf8"));
  } catch (error) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      "Frozen DESEN Catalog schema and example must be JSON.",
      { cause: String(error) },
    );
  }
  if (schema.$id !== DESEN_CATALOG_SCHEMA_ID) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      "Frozen DESEN Catalog schema has an unexpected $id.",
      { expected: DESEN_CATALOG_SCHEMA_ID, actual: schema.$id },
    );
  }
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  const validateCatalog = ajv.compile(schema);
  if (!validateCatalog(catalog)) {
    fail(
      SC01_A2UI_REJECTION_CODES.DESEN_CATALOG_INVALID,
      "Frozen DESEN example Catalog fails its frozen 0.1.0 Catalog schema.",
      { errors: formatAjvErrors(validateCatalog.errors) },
    );
  }

  const stack = catalog.components?.[STACK_USE];
  const text = catalog.components?.[TEXT_USE];
  const contract = {
    identity: {
      kind: catalog.kind,
      desen: catalog.desen,
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
    },
    Stack: {
      propsSchema: stack?.propsSchema,
      slots: stack?.slots,
      authoringDefaultProps: stack?.authoring?.defaultProps,
    },
    Text: {
      propsSchema: text?.propsSchema,
      authoringDefaultProps: text?.authoring?.defaultProps,
    },
  };
  const expectedContract = {
    identity: {
      kind: "desen.catalog",
      desen: DESEN_VERSION,
      id: DESEN_CATALOG.id,
      version: DESEN_CATALOG.version,
      target: DESEN_CATALOG.target,
    },
    Stack: {
      propsSchema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        properties: {
          direction: {
            type: "string",
            enum: ["vertical", "horizontal"],
            default: "vertical",
          },
          gap: {
            type: "string",
            enum: ["none", "xs", "sm", "md", "lg", "xl"],
          },
          maxWidth: {
            type: "number",
            exclusiveMinimum: 0,
          },
          align: {
            type: "string",
            enum: ["start", "center", "end", "stretch"],
          },
        },
      },
      slots: {
        default: {
          required: false,
          minItems: 0,
          acceptsCategories: ["layout", "content", "input", "action", "feedback", "complex"],
        },
      },
      authoringDefaultProps: {
        direction: "vertical",
        gap: "md",
      },
    },
    Text: {
      propsSchema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: {
          text: {
            type: "string",
          },
          role: {
            type: "string",
            enum: ["body", "heading", "caption"],
          },
        },
      },
      authoringDefaultProps: {
        text: "Text",
        role: "body",
      },
    },
  };
  if (!isDeepStrictEqual(contract, expectedContract)) {
    fail(
      SC01_A2UI_REJECTION_CODES.DESEN_CATALOG_CONTRACT_DRIFT,
      "Frozen DESEN example Catalog Stack/Text fields, enums, or defaults changed.",
      { profileId: SC01_PROFILE_ID },
    );
  }

  const fixture = createSc01DesenFixture();
  const root = fixture.surfaces[fixture.id].root;
  const validateStackProps = ajv.compile(stack.propsSchema);
  const validateTextProps = ajv.compile(text.propsSchema);
  if (!validateStackProps(root.props) || !validateTextProps(root.slots.default[0].props)) {
    fail(
      SC01_A2UI_REJECTION_CODES.DESEN_CATALOG_CONTRACT_DRIFT,
      "SC-01 sample props do not validate against the pinned Stack/Text Catalog contracts.",
      {
        stackErrors: formatAjvErrors(validateStackProps.errors),
        textErrors: formatAjvErrors(validateTextProps.errors),
      },
    );
  }
  return deepFreeze({
    result: "PASS",
    profileId: SC01_PROFILE_ID,
    schema: {
      path: DESEN_CATALOG_SCHEMA_RELATIVE_PATH,
      id: DESEN_CATALOG_SCHEMA_ID,
      sha256: `sha256:${DESEN_CATALOG_SCHEMA_SHA256}`,
      bytes: schemaBytes.length,
    },
    example: {
      path: DESEN_CATALOG_EXAMPLE_RELATIVE_PATH,
      sha256: `sha256:${DESEN_CATALOG_EXAMPLE_SHA256}`,
      bytes: exampleBytes.length,
      identity: contract.identity,
    },
    checksumLedger: {
      path: DESEN_CHECKSUMS_RELATIVE_PATH,
      sha256: `sha256:${DESEN_CHECKSUMS_SHA256}`,
      catalogSchemaEntryMatched: true,
      catalogExampleEntryMatched: true,
    },
    contract: {
      result: "PASS",
      stackTextFieldsEnumsDefaultsExact: true,
      sampleStackPropsValid: true,
      sampleTextPropsValid: true,
      profileStricterThanCatalog: [
        "Stack.direction is explicit despite the Catalog default",
        "Stack.align is explicit despite being optional in the Catalog",
        "Text.role is explicit despite being optional in the Catalog",
        `Text.text is capped at ${MAX_TEXT_UTF16_CODE_UNITS} UTF-16 code units`,
        "Stack.gap and Stack.maxWidth are rejected",
      ],
    },
  });
}

export function createSc01DesenFixture() {
  return deepFreeze({
    kind: DESEN_KIND,
    desen: DESEN_VERSION,
    id: "bridge-demo",
    catalogs: [{ ...DESEN_CATALOG }],
    entry: "bridge-demo",
    surfaces: {
      "bridge-demo": {
        id: "bridge-demo",
        state: {},
        resources: {},
        root: {
          id: "root",
          use: STACK_USE,
          props: {
            direction: "vertical",
            align: "stretch",
          },
          slots: {
            default: [
              {
                id: "title",
                use: TEXT_USE,
                props: {
                  text: "Desen bridge proof",
                  role: "heading",
                },
              },
              {
                id: "content-row",
                use: STACK_USE,
                props: {
                  direction: "horizontal",
                  align: "center",
                },
                slots: {
                  default: [
                    {
                      id: "body-copy",
                      use: TEXT_USE,
                      props: {
                        text: "Static body text",
                        role: "body",
                      },
                    },
                    {
                      id: "caption",
                      use: TEXT_USE,
                      props: {
                        text: "Pinned A2UI 0.9.1",
                        role: "caption",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  });
}

function createProfileSource(id, root) {
  return {
    kind: DESEN_KIND,
    desen: DESEN_VERSION,
    id,
    catalogs: [{ ...DESEN_CATALOG }],
    entry: id,
    surfaces: {
      [id]: {
        id,
        state: {},
        resources: {},
        root,
      },
    },
  };
}

function createTextNode(id, text, role) {
  return {
    id,
    use: TEXT_USE,
    props: { text, role },
  };
}

function createStackNode(id, direction, align, children) {
  return {
    id,
    use: STACK_USE,
    props: { direction, align },
    slots: { default: children },
  };
}

function createDepthCoverageSource(maximumDepth) {
  let node = createTextNode(`leaf-${maximumDepth}`, `Depth ${maximumDepth}`, "body");
  for (let depth = maximumDepth - 1; depth >= 0; depth -= 1) {
    node = createStackNode(depth === 0 ? "root" : `stack-${depth}`, "vertical", "stretch", [node]);
  }
  return createProfileSource(`depth-${maximumDepth}`, node);
}

function createDepthCoverageStream(maximumDepth) {
  const components = [];
  for (let depth = 0; depth < maximumDepth; depth += 1) {
    components.push({
      id: depth === 0 ? "root" : `stack-${depth}`,
      component: "Column",
      children: [depth + 1 === maximumDepth ? `leaf-${maximumDepth}` : `stack-${depth + 1}`],
      align: "stretch",
    });
  }
  components.push({
    id: `leaf-${maximumDepth}`,
    component: "Text",
    text: `Depth ${maximumDepth}`,
    variant: "body",
  });
  return [
    {
      version: SC01_A2UI_VERSION,
      createSurface: {
        surfaceId: `depth-${maximumDepth}`,
        catalogId: SC01_A2UI_CATALOG_ID,
      },
    },
    {
      version: SC01_A2UI_VERSION,
      updateComponents: {
        surfaceId: `depth-${maximumDepth}`,
        components,
      },
    },
  ];
}

function createComponentCountCoverageSource(componentCount) {
  const children = [];
  for (let index = 1; index < componentCount; index += 1) {
    children.push(createTextNode(`node-${index}`, `Node ${index}`, "body"));
  }
  return createProfileSource(
    `components-${componentCount}`,
    createStackNode("root", "vertical", "stretch", children),
  );
}

function createComponentCountCoverageStream(componentCount) {
  if (componentCount <= MAX_COMPONENTS) {
    return cloneJson(desenSourceToA2uiStream(createComponentCountCoverageSource(componentCount)));
  }
  const stream = createComponentCountCoverageStream(MAX_COMPONENTS);
  const components = stream[1].updateComponents.components;
  for (let index = MAX_COMPONENTS; index < componentCount; index += 1) {
    const id = `node-${index}`;
    components[0].children.push(id);
    components.push({
      id,
      component: "Text",
      text: `Node ${index}`,
      variant: "body",
    });
  }
  stream[0].createSurface.surfaceId = `components-${componentCount}`;
  stream[1].updateComponents.surfaceId = `components-${componentCount}`;
  return stream;
}

function createSeededIntegerGenerator(seed) {
  let state = seed;
  return (maximumExclusive) => {
    state = (state * 48_271) % 2_147_483_647;
    return state % maximumExclusive;
  };
}

function createSeededCoverageSource(caseIndex, nextInteger) {
  const directions = ["vertical", "horizontal"];
  const aligns = ["start", "center", "end", "stretch"];
  const roles = ["body", "heading", "caption"];
  const targetCount = 2 + nextInteger(23);
  const root = createStackNode(
    "root",
    directions[nextInteger(directions.length)],
    aligns[nextInteger(aligns.length)],
    [],
  );
  const stackCandidates = [{ node: root, depth: 0 }];
  for (let index = 1; index < targetCount; index += 1) {
    const parent = stackCandidates[nextInteger(stackCandidates.length)];
    const depth = parent.depth + 1;
    const makeStack = depth < 6 && nextInteger(100) < 42;
    const node = makeStack
      ? createStackNode(
          `node-${index}`,
          directions[nextInteger(directions.length)],
          aligns[nextInteger(aligns.length)],
          [],
        )
      : createTextNode(
          `node-${index}`,
          `Seeded ${caseIndex}:${index} — café 日本語 🌱`,
          roles[nextInteger(roles.length)],
        );
    parent.node.slots.default.push(node);
    if (makeStack) stackCandidates.push({ node, depth });
  }
  return createProfileSource(`seeded-${caseIndex}`, root);
}

function sourceTreeMetrics(source) {
  const root = source.surfaces[source.id].root;
  const pending = [{ node: root, depth: 0 }];
  let componentCount = 0;
  let maximumDepth = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    componentCount += 1;
    maximumDepth = Math.max(maximumDepth, current.depth);
    if (current.node.use === STACK_USE) {
      let index = current.node.slots.default.length - 1;
      while (index >= 0) {
        pending.push({
          node: current.node.slots.default[index],
          depth: current.depth + 1,
        });
        index -= 1;
      }
    }
  }
  return Object.freeze({ componentCount, maximumDepth });
}

function expectBridgeRejection(id, direction, expectedCode, makeInput, convert) {
  let actualCode = null;
  try {
    convert(makeInput());
  } catch (error) {
    if (error instanceof Sc01A2uiBridgeError) actualCode = error.code;
    else throw error;
  }
  if (actualCode !== expectedCode) {
    fail(
      SC01_A2UI_REJECTION_CODES.PROOF_DRIFT,
      `Rejection vector ${id} returned ${String(actualCode)} instead of ${expectedCode}.`,
    );
  }
  return Object.freeze({ id, direction, code: expectedCode, result: "PASS" });
}

function sourceMutation(mutator) {
  return () => {
    const source = cloneJson(createSc01DesenFixture());
    mutator(source);
    return source;
  };
}

function streamMutation(mutator) {
  return () => {
    const stream = cloneJson(desenSourceToA2uiStream(createSc01DesenFixture()));
    mutator(stream);
    return stream;
  };
}

function buildRejectionVectors() {
  const sourceRoot = (source) => source.surfaces["bridge-demo"].root;
  const firstText = (source) => sourceRoot(source).slots.default[0];
  const cases = [
    [
      "source-authoring",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.AUTHORING_UNSUPPORTED,
      sourceMutation((source) => {
        source.authoring = {};
      }),
      desenSourceToA2uiStream,
    ],
    [
      "source-extensions",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.EXTENSIONS_UNSUPPORTED,
      sourceMutation((source) => {
        source.extensions = {};
      }),
      desenSourceToA2uiStream,
    ],
    [
      "non-empty-state",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.STATE_UNSUPPORTED,
      sourceMutation((source) => {
        source.surfaces["bridge-demo"].state.count = {
          schema: { type: "number" },
          initial: 0,
        };
      }),
      desenSourceToA2uiStream,
    ],
    [
      "non-empty-resources",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.RESOURCES_UNSUPPORTED,
      sourceMutation((source) => {
        source.surfaces["bridge-demo"].resources.copy = {};
      }),
      desenSourceToA2uiStream,
    ],
    [
      "node-style",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.STYLE_UNSUPPORTED,
      sourceMutation((source) => {
        sourceRoot(source).style = {};
      }),
      desenSourceToA2uiStream,
    ],
    [
      "node-events",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.EVENTS_UNSUPPORTED,
      sourceMutation((source) => {
        sourceRoot(source).on = {};
      }),
      desenSourceToA2uiStream,
    ],
    [
      "node-condition",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.CONDITION_UNSUPPORTED,
      sourceMutation((source) => {
        sourceRoot(source).when = { op: "truthy", args: [true] };
      }),
      desenSourceToA2uiStream,
    ],
    [
      "node-repeat",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.REPEAT_UNSUPPORTED,
      sourceMutation((source) => {
        sourceRoot(source).repeat = { items: [], as: "item", key: "item" };
      }),
      desenSourceToA2uiStream,
    ],
    [
      "node-behaviors",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.BEHAVIOR_UNSUPPORTED,
      sourceMutation((source) => {
        sourceRoot(source).behaviors = [];
      }),
      desenSourceToA2uiStream,
    ],
    [
      "node-variants",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.VARIANTS_UNSUPPORTED,
      sourceMutation((source) => {
        sourceRoot(source).variants = [];
      }),
      desenSourceToA2uiStream,
    ],
    [
      "stack-gap",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.STACK_GAP_UNSUPPORTED,
      sourceMutation((source) => {
        sourceRoot(source).props.gap = "md";
      }),
      desenSourceToA2uiStream,
    ],
    [
      "stack-max-width",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.STACK_MAX_WIDTH_UNSUPPORTED,
      sourceMutation((source) => {
        sourceRoot(source).props.maxWidth = 420;
      }),
      desenSourceToA2uiStream,
    ],
    [
      "stack-direction-non-string-json-object",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.STACK_DIRECTION_UNSUPPORTED,
      sourceMutation((source) => {
        sourceRoot(source).props.direction = JSON.parse('{"toString":null}');
      }),
      desenSourceToA2uiStream,
    ],
    [
      "stack-missing-explicit-align",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.STACK_ALIGN_UNSUPPORTED,
      sourceMutation((source) => {
        delete sourceRoot(source).props.align;
      }),
      desenSourceToA2uiStream,
    ],
    [
      "unsupported-component",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED,
      sourceMutation((source) => {
        firstText(source).use = "com.example.ui/Button";
      }),
      desenSourceToA2uiStream,
    ],
    [
      "dynamic-text",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.TEXT_VALUE_UNSUPPORTED,
      sourceMutation((source) => {
        firstText(source).props.text = { $ref: "state.title" };
      }),
      desenSourceToA2uiStream,
    ],
    [
      "text-role-non-string-json-object",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.TEXT_ROLE_UNSUPPORTED,
      sourceMutation((source) => {
        firstText(source).props.role = JSON.parse('{"toString":null}');
      }),
      desenSourceToA2uiStream,
    ],
    [
      "unsafe-markdown-text",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.TEXT_PLAIN_UNSAFE,
      sourceMutation((source) => {
        firstText(source).props.text = "**not plain**";
      }),
      desenSourceToA2uiStream,
    ],
    [
      "text-over-profile-limit",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.TEXT_LENGTH_UNSUPPORTED,
      sourceMutation((source) => {
        firstText(source).props.text = "a".repeat(MAX_TEXT_UTF16_CODE_UNITS + 1);
      }),
      desenSourceToA2uiStream,
    ],
    [
      "wrong-root-id",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.ROOT_ID_UNSUPPORTED,
      sourceMutation((source) => {
        sourceRoot(source).id = "not-root";
      }),
      desenSourceToA2uiStream,
    ],
    [
      "a2ui-v0.9-version",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.A2UI_VERSION_UNSUPPORTED,
      streamMutation((stream) => {
        stream[0].version = "v0.9";
      }),
      a2uiStreamToDesenSource,
    ],
    [
      "invented-v0.9.1-catalog-alias",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.A2UI_CATALOG_UNSUPPORTED,
      streamMutation((stream) => {
        stream[0].createSurface.catalogId =
          "https://a2ui.org/specification/v0_9_1/catalogs/basic/catalog.json";
      }),
      a2uiStreamToDesenSource,
    ],
    [
      "a2ui-theme",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.A2UI_THEME_UNSUPPORTED,
      streamMutation((stream) => {
        stream[0].createSurface.theme = { primaryColor: "#000000" };
      }),
      a2uiStreamToDesenSource,
    ],
    [
      "a2ui-data-model-message",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.A2UI_STATE_UNSUPPORTED,
      streamMutation((stream) => {
        stream[1] = {
          version: SC01_A2UI_VERSION,
          updateDataModel: { surfaceId: "bridge-demo", value: {} },
        };
      }),
      a2uiStreamToDesenSource,
    ],
    [
      "a2ui-dynamic-text",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.A2UI_DYNAMIC_VALUE_UNSUPPORTED,
      streamMutation((stream) => {
        stream[1].updateComponents.components[1].text = { path: "/title" };
      }),
      a2uiStreamToDesenSource,
    ],
    [
      "a2ui-variant-non-string-json-object",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.TEXT_ROLE_UNSUPPORTED,
      streamMutation((stream) => {
        stream[1].updateComponents.components[1].variant = JSON.parse('{"toString":null}');
      }),
      a2uiStreamToDesenSource,
    ],
    [
      "a2ui-dynamic-children",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
      streamMutation((stream) => {
        stream[1].updateComponents.components[0].children = {
          componentId: "title",
          path: "/items",
        };
      }),
      a2uiStreamToDesenSource,
    ],
    [
      "a2ui-missing-explicit-align",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.STACK_ALIGN_UNSUPPORTED,
      streamMutation((stream) => {
        delete stream[1].updateComponents.components[0].align;
      }),
      a2uiStreamToDesenSource,
    ],
    [
      "a2ui-action",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.A2UI_ACTION_UNSUPPORTED,
      streamMutation((stream) => {
        stream[1].updateComponents.components[1].onPress = {
          event: { name: "open" },
        };
      }),
      a2uiStreamToDesenSource,
    ],
    [
      "a2ui-unsupported-component",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
      streamMutation((stream) => {
        stream[1].updateComponents.components[1].component = "Button";
      }),
      a2uiStreamToDesenSource,
    ],
    [
      "desen-depth-33",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED,
      () => createDepthCoverageSource(MAX_DEPTH + 1),
      desenSourceToA2uiStream,
    ],
    [
      "a2ui-depth-33",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
      () => createDepthCoverageStream(MAX_DEPTH + 1),
      a2uiStreamToDesenSource,
    ],
    [
      "desen-components-257",
      "desen-to-a2ui",
      SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED,
      () => createComponentCountCoverageSource(MAX_COMPONENTS + 1),
      desenSourceToA2uiStream,
    ],
    [
      "a2ui-components-257",
      "a2ui-to-desen",
      SC01_A2UI_REJECTION_CODES.A2UI_STREAM_UNSUPPORTED,
      () => createComponentCountCoverageStream(MAX_COMPONENTS + 1),
      a2uiStreamToDesenSource,
    ],
  ];
  return Object.freeze(
    cases.map(([id, direction, code, makeInput, convert]) =>
      expectBridgeRejection(id, direction, code, makeInput, convert),
    ),
  );
}

async function createPositiveCoverageValidators(fixtureDirectory) {
  if (AJV_VERSION !== "8.20.0") {
    fail(
      SC01_A2UI_REJECTION_CODES.PROOF_DRIFT,
      "SC-01 requires the workspace-pinned Ajv 8.20.0 validation engine.",
      { expected: "8.20.0", actual: AJV_VERSION },
    );
  }
  const pinned = await loadPinnedSchemas(fixtureDirectory);
  const catalogAlias = cloneJson(pinned.schemas["basic-catalog.json"]);
  catalogAlias.$id = A2UI_CATALOG_ALIAS_ID;
  const a2uiAjv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  a2uiAjv.addSchema(pinned.schemas["common_types.json"]);
  a2uiAjv.addSchema(catalogAlias);
  const validateA2uiMessage = a2uiAjv.compile(pinned.schemas["server_to_client.json"]);

  const sourceSchemaBytes = await readRegularFile(
    path.join(WORKSPACE_ROOT, DESEN_SOURCE_SCHEMA_RELATIVE_PATH),
    "Frozen DESEN Source schema",
  );
  if (sha256Hex(sourceSchemaBytes) !== DESEN_SOURCE_SCHEMA_SHA256) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      "Frozen DESEN Source schema differs from the 0.1.0 pin.",
    );
  }
  let sourceSchema;
  try {
    sourceSchema = JSON.parse(sourceSchemaBytes.toString("utf8"));
  } catch (error) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      "Frozen DESEN Source schema is not JSON.",
      { cause: String(error) },
    );
  }
  if (sourceSchema.$id !== DESEN_SOURCE_SCHEMA_ID) {
    fail(
      SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED,
      "Frozen DESEN Source schema has an unexpected $id.",
      { expected: DESEN_SOURCE_SCHEMA_ID, actual: sourceSchema.$id },
    );
  }
  const desenAjv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  return Object.freeze({
    validateA2uiMessage,
    validateDesenSource: desenAjv.compile(sourceSchema),
  });
}

async function buildPositiveCoverage(fixtureDirectory) {
  const validators = await createPositiveCoverageValidators(fixtureDirectory);
  const categoryCounts = {
    textRoot: 0,
    emptyStack: 0,
    mappingMatrix: 0,
    depthBoundary: 0,
    componentBoundary: 0,
    unicodeTextAndPrototypeNamedIds: 0,
    seededTrees: 0,
  };
  const receipts = [];
  const schemaValidations = {
    desenSources: 0,
    a2uiStreams: 0,
    a2uiMessages: 0,
  };

  function runVector(id, category, source) {
    const stream = desenSourceToA2uiStream(source);
    const decoded = a2uiStreamToDesenSource(stream);
    const reencoded = desenSourceToA2uiStream(decoded);
    if (!isDeepStrictEqual(decoded, source) || !isDeepStrictEqual(reencoded, stream)) {
      fail(
        SC01_A2UI_REJECTION_CODES.PROOF_DRIFT,
        `Positive coverage vector ${id} failed exact two-way roundtrip.`,
      );
    }
    if (!validators.validateDesenSource(source)) {
      fail(
        SC01_A2UI_REJECTION_CODES.PROOF_DRIFT,
        `Positive coverage vector ${id} fails the frozen DESEN Source schema.`,
        { errors: formatAjvErrors(validators.validateDesenSource.errors) },
      );
    }
    schemaValidations.desenSources += 1;
    for (let index = 0; index < stream.length; index += 1) {
      if (!validators.validateA2uiMessage(stream[index])) {
        fail(
          SC01_A2UI_REJECTION_CODES.PROOF_DRIFT,
          `Positive coverage vector ${id} message ${index} fails the pinned A2UI schema.`,
          {
            index,
            errors: formatAjvErrors(validators.validateA2uiMessage.errors),
          },
        );
      }
      schemaValidations.a2uiMessages += 1;
    }
    schemaValidations.a2uiStreams += 1;
    categoryCounts[category] += 1;
    const metrics = sourceTreeMetrics(source);
    receipts.push({
      id,
      category,
      componentCount: metrics.componentCount,
      maximumDepthFromRoot: metrics.maximumDepth,
      sourceSha256: `sha256:${sha256Hex(Buffer.from(JSON.stringify(source), "utf8"))}`,
      streamSha256: `sha256:${sha256Hex(Buffer.from(JSON.stringify(stream), "utf8"))}`,
    });
  }

  runVector(
    "text-root",
    "textRoot",
    createProfileSource(
      "coverage-text-root",
      createTextNode("root", "Text root — Merhaba 🌍", "heading"),
    ),
  );
  runVector(
    "empty-stack",
    "emptyStack",
    createProfileSource("coverage-empty-stack", createStackNode("root", "vertical", "stretch", [])),
  );

  const directions = ["vertical", "horizontal"];
  const aligns = ["start", "center", "end", "stretch"];
  const roles = ["body", "heading", "caption"];
  for (const direction of directions) {
    for (const align of aligns) {
      for (const role of roles) {
        const id = `matrix-${direction}-${align}-${role}`;
        runVector(
          id,
          "mappingMatrix",
          createProfileSource(
            id,
            createStackNode("root", direction, align, [
              createTextNode("copy", `Matrix ${direction} ${align} ${role}`, role),
            ]),
          ),
        );
      }
    }
  }

  runVector("depth-32", "depthBoundary", createDepthCoverageSource(MAX_DEPTH));
  runVector(
    "components-256",
    "componentBoundary",
    createComponentCountCoverageSource(MAX_COMPONENTS),
  );
  runVector(
    "unicode-prototype-named-ids",
    "unicodeTextAndPrototypeNamedIds",
    createProfileSource(
      "coverage-unicode-ids",
      createStackNode("root", "horizontal", "center", [
        createTextNode("constructor", "İstanbul — café — 日本語 🌍", "heading"),
        createTextNode("toString", "Zażółć gęślą jaźń", "body"),
        createTextNode("hasOwnProperty", "مرحبا بالعالم", "caption"),
      ]),
    ),
  );

  const seed = 20_260_724;
  const nextInteger = createSeededIntegerGenerator(seed);
  const seededTreeCount = 1_000;
  for (let index = 0; index < seededTreeCount; index += 1) {
    runVector(
      `seeded-tree-${index}`,
      "seededTrees",
      createSeededCoverageSource(index, nextInteger),
    );
  }

  const receiptBytes = Buffer.from(JSON.stringify(receipts), "utf8");
  return deepFreeze({
    result: "PASS",
    vectorCount: receipts.length,
    categoryCounts,
    deterministicCorpus: {
      generator: "Park-Miller minimal standard PRNG",
      seed,
      seededTreeCount,
    },
    exactRoundtrips: {
      desenToA2uiToDesen: receipts.length,
      a2uiToDesenToA2ui: receipts.length,
    },
    schemaValidations,
    aggregateReceipt: {
      algorithm: "SHA-256",
      encoding:
        "UTF-8 JSON.stringify of ordered receipts with id, category, component/depth metrics, Source hash, and stream hash",
      bytes: receiptBytes.length,
      sha256: `sha256:${sha256Hex(receiptBytes)}`,
    },
    boundaries: {
      depth: {
        rootDepth: 0,
        maximumAcceptedDepthFromRoot: MAX_DEPTH,
        acceptedLevelsIncludingRoot: MAX_DEPTH + 1,
        firstRejectedDepthFromRoot: MAX_DEPTH + 1,
        rejectionVectorIds: ["desen-depth-33", "a2ui-depth-33"],
      },
      components: {
        maximumAccepted: MAX_COMPONENTS,
        firstRejected: MAX_COMPONENTS + 1,
        rejectionVectorIds: ["desen-components-257", "a2ui-components-257"],
      },
    },
  });
}

async function implementationInventory() {
  const entries = [];
  for (const relativePath of IMPLEMENTATION_PATHS) {
    const bytes = await readFile(path.join(WORKSPACE_ROOT, relativePath));
    entries.push({
      path: relativePath,
      bytes: bytes.length,
      sha256: `sha256:${sha256Hex(bytes)}`,
    });
  }
  return Object.freeze(entries);
}

function normalizeBuildOptions(options) {
  const fixtureDirectory = normalizeFixtureDirectory(options);
  return Object.freeze({ fixtureDirectory });
}

/**
 * Builds deterministic, replayable evidence for the SC-01 bridge claim.
 */
export async function buildSc01A2uiBridgeEvidence(options) {
  const { fixtureDirectory } = normalizeBuildOptions(options);
  const source = createSc01DesenFixture();
  const stream = desenSourceToA2uiStream(source);
  const schemaValidation = await validateA2uiStreamAgainstPinnedSchemas(stream, {
    fixtureDirectory,
  });
  const sampleDesenValidation = await validateDesenSourceAgainstPinnedSchema(source);
  const desenCatalogValidation = await validatePinnedDesenCatalogProfile();
  const decodedSource = a2uiStreamToDesenSource(stream);
  const decodedDesenValidation = await validateDesenSourceAgainstPinnedSchema(decodedSource);
  const reencodedStream = desenSourceToA2uiStream(decodedSource);
  if (!isDeepStrictEqual(decodedSource, source) || !isDeepStrictEqual(reencodedStream, stream)) {
    fail(SC01_A2UI_REJECTION_CODES.PROOF_DRIFT, "SC-01 exact two-way roundtrip changed data.");
  }

  const invalidSchemaStream = cloneJson(stream);
  invalidSchemaStream[0].createSurface.unknown = true;
  let invalidSchemaCode = null;
  try {
    await validateA2uiStreamAgainstPinnedSchemas(invalidSchemaStream, {
      fixtureDirectory,
    });
  } catch (error) {
    if (error instanceof Sc01A2uiBridgeError) invalidSchemaCode = error.code;
    else throw error;
  }
  if (invalidSchemaCode !== SC01_A2UI_REJECTION_CODES.A2UI_SCHEMA_INVALID) {
    fail(
      SC01_A2UI_REJECTION_CODES.PROOF_DRIFT,
      "Pinned schema negative control did not reject an additional property.",
    );
  }

  const rejections = buildRejectionVectors();
  const positiveCoverage = await buildPositiveCoverage(fixtureDirectory);
  const inventory = await implementationInventory();
  const artifact = deepFreeze({
    proof: "SC-01",
    profileId: SC01_PROFILE_ID,
    formatVersion: 3,
    result: "PASS",
    scope: {
      classification: "executable interoperability bridge spike",
      productionPackageApiChanged: false,
      publicPackageExportAdded: false,
      supportedSurfaceCount: 1,
      supportedRenderingTarget: "web-react",
      claim:
        "For every JSON value admitted by SC01_STATIC_TEXT_V1, the bridge preserves the profile's structural fields exactly in both directions.",
      proofBasis: {
        method:
          "bounded structural induction over the admitted rooted component tree, backed by deterministic executable coverage",
        invariants: [
          "Base Text: id, literal safe text, and the body|heading|caption bijection are preserved exactly.",
          "Base empty Stack: id, explicit direction, explicit align, and an empty ordered default slot are preserved exactly.",
          "Inductive Stack step: if each ordered child roundtrips exactly, depth-first pre-order encoding preserves child ids and order, and reconstruction restores the same ordered child subtrees.",
          "The inverse is restricted to canonical two-message A2UI streams whose ids form one rooted, reachable, acyclic tree with exactly one parent per non-root node.",
          "All enum maps are bijections on strictly primitive string domains; values are never canonicalized through caller coercion.",
          `Induction is finite with at most ${MAX_COMPONENTS} components and deepest node depth ${MAX_DEPTH} from root depth 0.`,
        ],
      },
      nonClaims: [
        "general DESEN/A2UI equivalence",
        "rendered pixels, HTML, DOM, CSS, or accessibility-tree parity",
        "semantic typography parity because A2UI Text.variant is only a renderer hint",
        "default-value parity across DESEN Catalog and A2UI renderers",
        "A2UI justify parity; justify is outside this profile",
        "dynamic state, resources, actions, conditions, repeat, behavior, authoring, or style semantics",
      ],
    },
    externalStandard: {
      name: "A2UI",
      release: "0.9.1",
      repository: "https://github.com/a2ui-project/a2ui",
      commit: SC01_A2UI_COMMIT,
      specificationTreeGitSha1: SC01_A2UI_SPEC_TREE,
      specificationDirectory: "specification/v0_9_1",
      files: schemaValidation.files,
      catalogIdentity: {
        emittedCatalogId: SC01_A2UI_CATALOG_ID,
        pinnedSchemaId: SC01_A2UI_CATALOG_ID,
        proseDirectorySpelling: "v0_9_1",
        schemaIdentitySpelling: "v0_9",
        inventedV091CatalogAliasAccepted: false,
        note: "The pinned 0.9.1 directory contains a Basic Catalog whose actual $id/catalogId remains under v0_9.",
      },
      schemaReferenceResolution: schemaValidation.catalogAlias,
      provenanceSha256: schemaValidation.provenanceSha256,
    },
    desenProtocol: {
      version: DESEN_VERSION,
      frozenSourceSchema: {
        path: sampleDesenValidation.schemaPath,
        id: sampleDesenValidation.schemaId,
        sha256: sampleDesenValidation.schemaSha256,
        checksumLedger: sampleDesenValidation.checksumLedger,
      },
      frozenExampleCatalog: {
        profileId: desenCatalogValidation.profileId,
        schema: desenCatalogValidation.schema,
        example: desenCatalogValidation.example,
        checksumLedger: desenCatalogValidation.checksumLedger,
        contract: desenCatalogValidation.contract,
      },
    },
    subset: {
      desen: { kind: DESEN_KIND, version: DESEN_VERSION },
      identity: "source id = entry = sole surface key = surface id",
      catalogRequirement: { ...DESEN_CATALOG },
      requiredEmptyContainers: ["surface.state", "surface.resources"],
      rootId: "root",
      components: {
        Stack: {
          use: STACK_USE,
          direction: {
            vertical: "A2UI Column",
            horizontal: "A2UI Row",
          },
          requiredExplicitAlign: ALIGN_VALUES,
          forbiddenProps: ["gap", "maxWidth"],
          onlySlot: "default",
        },
        Text: {
          use: TEXT_USE,
          literalSafePlainTextOnly: true,
          maximumUtf16CodeUnits: MAX_TEXT_UTF16_CODE_UNITS,
          roles: {
            body: "A2UI body",
            heading: "A2UI h2",
            caption: "A2UI caption",
          },
        },
      },
      forbiddenSemantics: [
        "non-empty state",
        "non-empty resources",
        "authoring",
        "extensions",
        "style",
        "events/actions",
        "conditions",
        "repeat",
        "variants",
        "behaviors",
        "dynamic values",
        "dynamic children",
        "theme",
      ],
      finiteBounds: {
        maximumComponents: MAX_COMPONENTS,
        maximumNodeDepthFromRoot: MAX_DEPTH,
        rootDepth: 0,
        maximumTextUtf16CodeUnits: MAX_TEXT_UTF16_CODE_UNITS,
      },
    },
    streamContract: {
      messages: ["createSurface", "updateComponents"],
      version: SC01_A2UI_VERSION,
      catalogId: SC01_A2UI_CATALOG_ID,
      componentOrder: "depth-first pre-order with root first",
      rowColumnAlign: "explicit and required",
      justify: "outside profile and rejected",
    },
    schemaValidation: {
      result: schemaValidation.result,
      mode: "offline exact pinned JSON Schema bytes",
      engine: `Ajv ${AJV_VERSION} Draft 2020-12 from existing validator dev dependency`,
      messagesValidated: schemaValidation.messages,
      negativeAdditionalPropertyControl: "PASS",
      desenSource: {
        sample: sampleDesenValidation.result,
        decodedRoundtrip: decodedDesenValidation.result,
        schemaSha256: sampleDesenValidation.schemaSha256,
      },
      desenCatalog: {
        result: desenCatalogValidation.result,
        schemaSha256: desenCatalogValidation.schema.sha256,
        exampleSha256: desenCatalogValidation.example.sha256,
        stackTextContract: desenCatalogValidation.contract.result,
      },
    },
    roundtrips: {
      desenToA2uiToDesen: {
        result: "PASS",
        equality: "exact JSON structural fields via Node.js deep strict equality",
        components: stream[1].updateComponents.components.length,
      },
      a2uiToDesenToA2ui: {
        result: "PASS",
        equality: "exact JSON structural fields via Node.js deep strict equality",
        messages: stream.length,
      },
      sample: {
        sourceSha256: `sha256:${sha256Hex(Buffer.from(JSON.stringify(source)))}`,
        streamSha256: `sha256:${sha256Hex(Buffer.from(JSON.stringify(stream)))}`,
      },
    },
    positiveCoverage,
    rejections: {
      result: "PASS",
      count: rejections.length,
      stableCodes: rejections,
    },
    implementation: {
      result: "PASS",
      trackedFiles: inventory,
    },
  });
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
  });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: `sha256:${sha256Hex(artifactBytes)}`,
    source,
    stream,
  });
}

function normalizeWriteOptions(options) {
  if (options === undefined) return Object.freeze({});
  if (!isPlainRecord(options)) {
    fail(SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID, "Write options must be a plain object.");
  }
  assertExactKeys(
    options,
    ["artifactPath", "fixtureDirectory", "beforeAtomicRename"],
    [],
    SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID,
    "",
    "Write options",
  );
  if (
    hasOwn(options, "artifactPath") &&
    (typeof options.artifactPath !== "string" || !path.isAbsolute(options.artifactPath))
  ) {
    fail(SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID, "artifactPath must be an absolute path.");
  }
  if (hasOwn(options, "beforeAtomicRename") && typeof options.beforeAtomicRename !== "function") {
    fail(SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID, "beforeAtomicRename must be a function.");
  }
  normalizeFixtureDirectory(
    hasOwn(options, "fixtureDirectory")
      ? { fixtureDirectory: options.fixtureDirectory }
      : undefined,
  );
  return Object.freeze({ ...options });
}

export async function writeSc01A2uiBridgeEvidence(options) {
  const normalized = normalizeWriteOptions(options);
  const expected = await buildSc01A2uiBridgeEvidence(
    hasOwn(normalized, "fixtureDirectory")
      ? { fixtureDirectory: normalized.fixtureDirectory }
      : undefined,
  );
  const artifactPath = normalized.artifactPath ?? DEFAULT_SC01_A2UI_BRIDGE_ARTIFACT_PATH;
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: expected.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  return Object.freeze({
    result: "PASS",
    artifactPath,
    artifactSha256: expected.artifactSha256,
    positiveVectors: expected.artifact.positiveCoverage.vectorCount,
    rejections: expected.artifact.rejections.count,
  });
}

function normalizeVerifyOptions(options) {
  if (options === undefined) return Object.freeze({});
  if (!isPlainRecord(options)) {
    fail(SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID, "Verification options must be a plain object.");
  }
  assertExactKeys(
    options,
    ["artifactPath", "artifactBytes", "fixtureDirectory"],
    [],
    SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID,
    "",
    "Verification options",
  );
  if (
    hasOwn(options, "artifactPath") &&
    (typeof options.artifactPath !== "string" || !path.isAbsolute(options.artifactPath))
  ) {
    fail(SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID, "artifactPath must be an absolute path.");
  }
  if (hasOwn(options, "artifactBytes") && !utilTypes.isUint8Array(options.artifactBytes)) {
    fail(
      SC01_A2UI_REJECTION_CODES.OPTIONS_INVALID,
      "artifactBytes must be exact Uint8Array bytes.",
    );
  }
  normalizeFixtureDirectory(
    hasOwn(options, "fixtureDirectory")
      ? { fixtureDirectory: options.fixtureDirectory }
      : undefined,
  );
  return Object.freeze({ ...options });
}

export async function verifySc01A2uiBridgeEvidence(options) {
  const normalized = normalizeVerifyOptions(options);
  const expected = await buildSc01A2uiBridgeEvidence(
    hasOwn(normalized, "fixtureDirectory")
      ? { fixtureDirectory: normalized.fixtureDirectory }
      : undefined,
  );
  const artifactPath = normalized.artifactPath ?? DEFAULT_SC01_A2UI_BRIDGE_ARTIFACT_PATH;
  const actualBytes =
    normalized.artifactBytes ?? (await readRegularFile(artifactPath, "SC-01 proof artifact"));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail(
      SC01_A2UI_REJECTION_CODES.PROOF_DRIFT,
      "Tracked SC-01 proof bytes differ from a fresh deterministic replay.",
      {
        expectedSha256: expected.artifactSha256,
        actualSha256: `sha256:${sha256Hex(actualBytes)}`,
      },
    );
  }
  return Object.freeze({
    result: "PASS",
    artifactPath,
    artifactSha256: expected.artifactSha256,
    schemaMessages: expected.artifact.schemaValidation.messagesValidated,
    roundtrips: 2,
    positiveVectors: expected.artifact.positiveCoverage.vectorCount,
    rejections: expected.artifact.rejections.count,
  });
}
