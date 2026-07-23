import { registerComponent } from "../src/component-registration.js";

import type {
  ComponentPropsOf,
  JsonSchemaValue,
  JsonValue,
} from "../src/schema-type-derivation.js";

const jsonDocument: JsonValue = {
  enabled: true,
  labels: ["one", "two"],
  nested: { count: 2 },
};

// @ts-expect-error M03-T03-N01 JSON values cannot contain executable functions.
const executableJsonValue: JsonValue = () => "not data";

const enumSchema = {
  enum: ["primary", "secondary", null],
} as const;
type EnumValue = JsonSchemaValue<typeof enumSchema>;
const primaryEnum: EnumValue = "primary";
const nullEnum: EnumValue = null;
// @ts-expect-error M03-T03-N02 Enum projections retain their exact literal choices.
const unknownEnum: EnumValue = "tertiary";

const profileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "settings", "tags"],
  properties: {
    name: { type: "string", minLength: 1 },
    nickname: { type: "string" },
    role: { enum: ["admin", "member"] },
    settings: {
      type: "object",
      additionalProperties: false,
      required: ["enabled"],
      properties: {
        enabled: { type: "boolean" },
        density: { enum: ["compact", "comfortable"] },
      },
    },
    tags: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;
type ProfileValue = JsonSchemaValue<typeof profileSchema>;

const completeProfile: ProfileValue = {
  name: "Ada",
  nickname: "A",
  role: "admin",
  settings: {
    enabled: true,
    density: "compact",
  },
  tags: ["typed", "manifest"],
};
const profileWithoutOptionals: ProfileValue = {
  name: "Lin",
  settings: { enabled: false },
  tags: [],
};

// @ts-expect-error M03-T03-N03 Required schema properties cannot be omitted.
const profileWithoutName: ProfileValue = { settings: { enabled: true }, tags: [] };

// @ts-expect-error M03-T03-N04 Optional properties cannot be explicitly undefined.
const profileWithUndefined: ProfileValue = {
  name: "Ada",
  nickname: undefined,
  settings: { enabled: true },
  tags: [],
};

// @ts-expect-error M03-T03-N05 Nested required properties remain required.
const profileWithoutEnabled: ProfileValue = { name: "Ada", settings: {}, tags: [] };

const profileWithExtraProperty: ProfileValue = {
  name: "Ada",
  settings: { enabled: true },
  tags: [],
  // @ts-expect-error M03-T03-N06 Fresh closed object literals reject undeclared properties.
  implementation: "./Profile.js",
};

// @ts-expect-error M03-T03-N07 Derived object properties are readonly.
completeProfile.name = "Grace";

// @ts-expect-error M03-T03-N08 Nested derived object properties are readonly.
completeProfile.settings.enabled = false;

const constSchema = {
  const: {
    mode: "fixed",
    sizes: [1, 2],
  },
} as const;
type ConstValue = JsonSchemaValue<typeof constSchema>;
const exactConstant: ConstValue = { mode: "fixed", sizes: [1, 2] };
// @ts-expect-error M03-T03-N09 Const projections retain the exact JSON literal.
const wrongConstant: ConstValue = { mode: "fluid", sizes: [1, 2] };

const stringArraySchema = {
  type: "array",
  items: { type: "string" },
} as const;
type StringArrayValue = JsonSchemaValue<typeof stringArraySchema>;
const stringArray: StringArrayValue = ["one", "two"];
// @ts-expect-error M03-T03-N10 Array item projections reject incompatible values.
const numericArrayItem: StringArrayValue = ["one", 2];

const falseSchema = false as const;
type ImpossibleValue = JsonSchemaValue<typeof falseSchema>;
// @ts-expect-error M03-T03-N11 A false JSON Schema accepts no value.
const impossibleValue: ImpossibleValue = null;

const nullableTextSchema = {
  type: ["string", "null"],
} as const;
type NullableText = JsonSchemaValue<typeof nullableTextSchema>;
const textValue: NullableText = "text";
const nullTextValue: NullableText = null;
// @ts-expect-error M03-T03-N12 Primitive type arrays do not admit unrelated JSON types.
const objectTextValue: NullableText = { text: "not primitive" };

const booleanSchema = { type: "boolean" } as const;
type BooleanValue = JsonSchemaValue<typeof booleanSchema>;
const booleanValue: BooleanValue = true;
// @ts-expect-error M03-T03-N13 Single primitive types remain exact.
const stringBooleanValue: BooleanValue = "true";

const formattedTextSchema = { type: "string", format: "email" } as const;
type FormattedTextValue = JsonSchemaValue<typeof formattedTextSchema>;
const formattedTextValue: FormattedTextValue = "person@example.com";

const scoreMapSchema = {
  type: "object",
  additionalProperties: { type: "number", minimum: 0 },
} as const;
type ScoreMap = JsonSchemaValue<typeof scoreMapSchema>;
const scoreMap: ScoreMap = { accessibility: 100, determinism: 100 };
// @ts-expect-error M03-T03-N14 Schema-valued additional properties retain their value type.
const invalidScoreMap: ScoreMap = { accessibility: "high" };

const mixedAdditionalSchema = {
  type: "object",
  properties: {
    known: { type: "string" },
  },
  additionalProperties: { type: "number" },
} as const;
type MixedAdditionalFallback = JsonSchemaValue<typeof mixedAdditionalSchema>;
const mixedAdditionalFallback: MixedAdditionalFallback = [
  "named and schema-valued additional keys use the honest JSON fallback",
];

const openObjectSchema = {
  type: "object",
  properties: {
    known: { type: "string" },
  },
} as const;
type OpenObjectValue = JsonSchemaValue<typeof openObjectSchema>;
const openObject: OpenObjectValue = {
  known: "declared",
  extension: { remains: "JSON" },
};

const registeredComponent = registerComponent({
  id: "com.example.ui/Typed",
  manifest: {
    propsSchema: {
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: { type: "string" },
        tone: { enum: ["quiet", "strong"] },
      },
    },
  },
});
type RegisteredProps = ComponentPropsOf<typeof registeredComponent>;
type ManifestProps = ComponentPropsOf<typeof registeredComponent.manifest>;
const registeredProps: RegisteredProps = { label: "Continue", tone: "strong" };
const manifestProps: ManifestProps = { label: "Cancel" };

// @ts-expect-error M03-T03-N15 Registered component props derive exact enum literals.
const invalidRegisteredProps: RegisteredProps = { label: "Continue", tone: "loud" };

// @ts-expect-error M03-T03-N16 Direct manifest props retain required properties.
const invalidManifestProps: ManifestProps = { tone: "quiet" };

// @ts-expect-error M03-T03-N17 Schema-derived arrays are readonly.
stringArray.push("three");

type InvalidComponentSource = ComponentPropsOf<{ readonly id: "missing-manifest" }>;
// @ts-expect-error M03-T03-N18 A source without propsSchema cannot produce component props.
const invalidComponentSource: InvalidComponentSource = {};

const trueSchema = true as const;
type TrueFallback = JsonSchemaValue<typeof trueSchema>;
const trueFallback: TrueFallback = {
  anyJson: ["remains", { editable: true }],
};

const referencedSchema = {
  type: "string",
  $ref: "#/$defs/name",
} as const;
type ReferenceFallback = JsonSchemaValue<typeof referencedSchema>;
const referenceFallback: ReferenceFallback = {
  unsupportedReference: "falls back safely",
};

const patternedSchema = {
  type: "string",
  pattern: "^[a-z]+$",
} as const;
type PatternFallback = JsonSchemaValue<typeof patternedSchema>;
const patternFallback: PatternFallback = ["pattern", "is", "complex"];

const conditionalSchema = {
  oneOf: [{ type: "string" }, { type: "number" }],
} as const;
type ConditionalFallback = JsonSchemaValue<typeof conditionalSchema>;
const conditionalFallback: ConditionalFallback = {
  applicator: "does not become a second schema engine",
};

const widenedSchema: Readonly<Record<string, JsonValue>> = {
  type: "string",
};
type WidenedFallback = JsonSchemaValue<typeof widenedSchema>;
const widenedFallback: WidenedFallback = {
  literalInformation: "was intentionally widened",
};

type UnknownFallback = JsonSchemaValue<unknown>;
const unknownFallback: UnknownFallback = {
  unavailableSchemaInformation: ["remains", "JSON-only"],
};

type DeepSchema<Depth extends readonly unknown[] = readonly []> = Depth["length"] extends 20
  ? { readonly type: "string" }
  : {
      readonly type: "object";
      readonly additionalProperties: false;
      readonly required: readonly ["child"];
      readonly properties: {
        readonly child: DeepSchema<readonly [...Depth, unknown]>;
      };
    };

type DescendantAtSixteen<
  Value,
  Depth extends readonly unknown[] = readonly [],
> = Depth["length"] extends 16
  ? Value
  : Value extends { readonly child: infer Child }
    ? DescendantAtSixteen<Child, readonly [...Depth, unknown]>
    : never;

type DeepValue = JsonSchemaValue<DeepSchema>;
type DepthFallback = DescendantAtSixteen<DeepValue>;
const depthFallback: DepthFallback = {
  recursion: "falls back to JSON at level sixteen",
};

void [
  jsonDocument,
  executableJsonValue,
  enumSchema,
  primaryEnum,
  nullEnum,
  unknownEnum,
  profileSchema,
  completeProfile,
  profileWithoutOptionals,
  profileWithoutName,
  profileWithUndefined,
  profileWithoutEnabled,
  profileWithExtraProperty,
  constSchema,
  exactConstant,
  wrongConstant,
  stringArraySchema,
  stringArray,
  numericArrayItem,
  falseSchema,
  impossibleValue,
  nullableTextSchema,
  textValue,
  nullTextValue,
  objectTextValue,
  booleanSchema,
  booleanValue,
  stringBooleanValue,
  formattedTextSchema,
  formattedTextValue,
  scoreMapSchema,
  scoreMap,
  invalidScoreMap,
  mixedAdditionalSchema,
  mixedAdditionalFallback,
  openObjectSchema,
  openObject,
  registeredComponent,
  registeredProps,
  manifestProps,
  invalidRegisteredProps,
  invalidManifestProps,
  invalidComponentSource,
  trueSchema,
  trueFallback,
  referencedSchema,
  referenceFallback,
  patternedSchema,
  patternFallback,
  conditionalSchema,
  conditionalFallback,
  widenedSchema,
  widenedFallback,
  unknownFallback,
  depthFallback,
];
