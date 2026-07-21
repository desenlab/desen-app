/**
 * Frozen protocol artifacts, derived types, stable diagnostics, and deterministic digest primitives.
 *
 * @packageDocumentation
 */

import type { DESENPublishedDesignBundle } from "./generated/0.1.0/desen-bundle.generated.js";
import type { DESENCapabilityCatalog } from "./generated/0.1.0/desen-catalog.generated.js";
import type { DESENDesignSourceDocument } from "./generated/0.1.0/desen-source.generated.js";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

// JSON Schema evaluates JSON instances, while its unconstrained positions become `unknown` in the
// generator. This projection closes that TypeScript-only gap without redefining schema structure.
type JsonDocumentProjection<Value> = unknown extends Value
  ? JsonValue
  : Value extends JsonPrimitive
    ? Value
    : Value extends readonly (infer Item)[]
      ? JsonDocumentProjection<Item>[]
      : Value extends object
        ? { [Key in keyof Value]: JsonDocumentProjection<Value[Key]> }
        : never;

/**
 * An editable DESEN 0.1.0 design source document.
 *
 * @remarks This is a compile-time structural projection of the frozen Source JSON Schema. It does
 * not validate untrusted runtime data or enforce every pattern, cardinality, and reference rule.
 * Unconstrained schema positions are recursively limited to JSON-compatible TypeScript values.
 */
export type DesenSource = JsonDocumentProjection<DESENDesignSourceDocument>;

/**
 * An immutable DESEN 0.1.0 published design bundle.
 *
 * @remarks This is a compile-time structural projection of the frozen Bundle JSON Schema. Runtime
 * validation, digest verification, and semantic reference checks are separate responsibilities.
 * Unconstrained schema positions are recursively limited to JSON-compatible TypeScript values.
 */
export type DesenBundle = JsonDocumentProjection<DESENPublishedDesignBundle>;

/**
 * A DESEN 0.1.0 capability catalog for a specific implementation target.
 *
 * @remarks This is a compile-time structural projection of the frozen Catalog JSON Schema. It does
 * not establish package integrity or prove that executable adapters match the declared contracts.
 * Unconstrained schema positions are recursively limited to JSON-compatible TypeScript values.
 */
export type DesenCatalog = JsonDocumentProjection<DESENCapabilityCatalog>;
