import type { ImmutableJson, JsonPrimitive } from "./inert-json.js";

/**
 * Recursively readonly JSON data accepted at DESEN contract boundaries.
 *
 * @remarks This type deliberately excludes executable values, `undefined`, symbols, bigint, and
 * other non-JSON TypeScript values. Runtime validation is still required for constraints such as
 * finite numbers and schema semantics.
 */
export type JsonValue =
  JsonPrimitive | { readonly [key: string]: JsonValue } | readonly JsonValue[];

type SupportedSchemaKeyword =
  | "$anchor"
  | "$comment"
  | "$id"
  | "$schema"
  | "additionalProperties"
  | "const"
  | "default"
  | "deprecated"
  | "description"
  | "enum"
  | "examples"
  | "exclusiveMaximum"
  | "exclusiveMinimum"
  | "format"
  | "items"
  | "maximum"
  | "maxItems"
  | "maxLength"
  | "maxProperties"
  | "minimum"
  | "minItems"
  | "minLength"
  | "minProperties"
  | "multipleOf"
  | "properties"
  | "readOnly"
  | "required"
  | "title"
  | "type"
  | "uniqueItems"
  | "writeOnly";

type HasOnlySupportedKeywords<Schema extends object> =
  Exclude<keyof Schema, SupportedSchemaKeyword> extends never ? true : false;

type PrimitiveSchemaType = "boolean" | "integer" | "null" | "number" | "string";

type PrimitiveValue<Type> = Type extends "boolean"
  ? boolean
  : Type extends "integer" | "number"
    ? number
    : Type extends "null"
      ? null
      : Type extends "string"
        ? string
        : never;

type Increment<Depth extends readonly unknown[]> = readonly [...Depth, unknown];

type KnownPropertyNames<Properties extends object> = Extract<keyof Properties, string>;

type InferredKnownProperties<
  Properties extends object,
  RequiredNames extends string,
  Depth extends readonly unknown[],
> = {
  readonly [
    Key in KnownPropertyNames<Properties> as Key extends RequiredNames ? Key : never
  ]-?: InferJsonSchemaValue<Properties[Key], Depth>;
} & {
  readonly [
    Key in KnownPropertyNames<Properties> as Key extends RequiredNames ? never : Key
  ]?: InferJsonSchemaValue<Properties[Key], Depth>;
};

type ClosedObject<
  Properties extends object,
  RequiredNames extends string,
  Depth extends readonly unknown[],
> = keyof Properties extends never
  ? Readonly<Record<string, never>>
  : InferredKnownProperties<Properties, RequiredNames, Depth>;

type OpenObject<
  Properties extends object,
  RequiredNames extends string,
  Depth extends readonly unknown[],
> = keyof Properties extends never
  ? Readonly<Record<string, JsonValue>>
  : InferredKnownProperties<Properties, RequiredNames, Depth> & Readonly<Record<string, JsonValue>>;

type InferAdditionalProperties<
  Schema extends object,
  Properties extends object,
  RequiredNames extends string,
  Depth extends readonly unknown[],
> = Schema extends { readonly additionalProperties: infer Additional }
  ? Additional extends false
    ? ClosedObject<Properties, RequiredNames, Depth>
    : Additional extends true
      ? OpenObject<Properties, RequiredNames, Depth>
      : Additional extends readonly unknown[]
        ? JsonValue
        : Additional extends object
          ? keyof Properties extends never
            ? Readonly<Record<string, InferJsonSchemaValue<Additional, Depth>>>
            : JsonValue
          : JsonValue
  : OpenObject<Properties, RequiredNames, Depth>;

type InferObjectWithRequired<
  Schema extends object,
  Properties extends object,
  Required,
  Depth extends readonly unknown[],
> = Required extends readonly string[]
  ? number extends Required["length"]
    ? JsonValue
    : Exclude<Required[number], KnownPropertyNames<Properties>> extends never
      ? InferAdditionalProperties<Schema, Properties, Required[number], Depth>
      : JsonValue
  : JsonValue;

type InferObjectWithProperties<
  Schema extends object,
  Properties extends object,
  Depth extends readonly unknown[],
> =
  Exclude<keyof Properties, string> extends never
    ? string extends keyof Properties
      ? JsonValue
      : Schema extends { readonly required: infer Required }
        ? InferObjectWithRequired<Schema, Properties, Required, Depth>
        : InferAdditionalProperties<Schema, Properties, never, Depth>
    : JsonValue;

type InferObjectSchema<Schema extends object, Depth extends readonly unknown[]> = Schema extends {
  readonly properties: infer Properties;
}
  ? Properties extends readonly unknown[]
    ? JsonValue
    : Properties extends object
      ? InferObjectWithProperties<Schema, Properties, Depth>
      : JsonValue
  : Schema extends { readonly required: readonly string[] }
    ? JsonValue
    : InferAdditionalProperties<Schema, Readonly<Record<never, never>>, never, Depth>;

type InferArraySchema<Schema extends object, Depth extends readonly unknown[]> = Schema extends {
  readonly items: infer Items;
}
  ? Items extends false
    ? readonly never[]
    : Items extends true
      ? readonly JsonValue[]
      : Items extends readonly unknown[]
        ? JsonValue
        : Items extends object
          ? readonly InferJsonSchemaValue<Items, Depth>[]
          : JsonValue
  : readonly JsonValue[];

type InferPrimitiveTypeList<Type extends readonly unknown[]> = Type extends readonly []
  ? JsonValue
  : number extends Type["length"]
    ? JsonValue
    : Exclude<Type[number], PrimitiveSchemaType> extends never
      ? PrimitiveValue<Type[number]>
      : JsonValue;

type InferDeclaredType<
  Schema extends object,
  Type,
  Depth extends readonly unknown[],
> = Type extends readonly unknown[]
  ? InferPrimitiveTypeList<Type>
  : Type extends PrimitiveSchemaType
    ? PrimitiveValue<Type>
    : Type extends "object"
      ? InferObjectSchema<Schema, Depth>
      : Type extends "array"
        ? InferArraySchema<Schema, Depth>
        : JsonValue;

type InferEnum<Options> = Options extends readonly []
  ? JsonValue
  : Options extends readonly unknown[]
    ? [Options[number]] extends [JsonValue]
      ? ImmutableJson<Options[number]>
      : JsonValue
    : JsonValue;

type InferSchemaObject<Schema extends object, Depth extends readonly unknown[]> =
  HasOnlySupportedKeywords<Schema> extends true
    ? Schema extends { readonly const: infer Constant }
      ? [Constant] extends [JsonValue]
        ? ImmutableJson<Constant>
        : JsonValue
      : Schema extends { readonly enum: infer Options }
        ? InferEnum<Options>
        : Schema extends { readonly type: infer Type }
          ? InferDeclaredType<Schema, Type, Increment<Depth>>
          : JsonValue
    : JsonValue;

type IsUnbounded<Value> = 0 extends 1 & Value ? true : false;

type InferJsonSchemaValue<Schema, Depth extends readonly unknown[]> =
  IsUnbounded<Schema> extends true
    ? JsonValue
    : Depth["length"] extends 16
      ? JsonValue
      : Schema extends false
        ? never
        : Schema extends true
          ? JsonValue
          : Schema extends readonly unknown[]
            ? JsonValue
            : Schema extends object
              ? InferSchemaObject<Schema, Depth>
              : JsonValue;

/**
 * Conservative TypeScript value projection of one literal JSON Schema.
 *
 * @remarks Literal `const`, `enum`, primitive types, object properties, required names,
 * closed or unconstrained `additionalProperties`, schema-valued pure maps, and homogeneous array
 * items are projected recursively. A schema-valued open object that also declares named
 * properties falls back because TypeScript cannot model its two key domains without incorrectly
 * constraining the named properties. The recursion budget is sixteen schema levels. Boolean
 * `true`, widened schemas, unsupported keywords, complex applicators, and deeper subtrees fall
 * back to {@link JsonValue}; boolean `false` produces `never`. This compile-time convenience never
 * replaces Catalog or resolved-value validation.
 */
export type JsonSchemaValue<Schema> = InferJsonSchemaValue<Schema, readonly []>;

type ComponentPropsSchema<Source> = Source extends {
  readonly manifest: { readonly propsSchema: infer Schema };
}
  ? Schema
  : Source extends { readonly propsSchema: infer Schema }
    ? Schema
    : never;

/**
 * Resolved component props derived from a registered component or component manifest.
 *
 * @remarks `Source` may be a `RegisteredComponent`-shaped `{ manifest: { propsSchema } }` value or
 * the manifest's direct `{ propsSchema }` shape. Literal information must remain available in the
 * source value; an explicitly widened manifest safely yields the conservative
 * {@link JsonSchemaValue} fallback. The result describes resolved adapter props, not unresolved
 * DESEN `ValueSpec` authoring expressions.
 */
export type ComponentPropsOf<Source> = JsonSchemaValue<ComponentPropsSchema<Source>>;
