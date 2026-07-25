/** One generated Draft 2020-12 meta-schema failure. */
export interface Draft202012SyntaxError {
  /** RFC 6901 location of the failing schema value when available. */
  readonly instancePath?: unknown;
  /** Draft keyword responsible for the rejection when available. */
  readonly keyword?: unknown;
  /** Generated keyword-specific error details. */
  readonly params?: unknown;
  /** Failing object-member name when the generated validator reports one. */
  readonly propertyName?: unknown;
}

/** Callable shape of the code-free generated Draft 2020-12 meta-schema validator. */
export interface Draft202012SyntaxValidator {
  /** Checks one caller-prepared inert value against the Draft 2020-12 meta-schema. */
  (value: unknown): boolean;
  /** Failures from the most recent synchronous invocation, or `null` after success. */
  readonly errors: readonly Draft202012SyntaxError[] | null;
}

/**
 * Generated, code-free Draft 2020-12 meta-schema validator.
 *
 * @remarks The caller must first copy untrusted input through an inert bounded JSON boundary. This
 * first-party integration seam performs no schema compilation, reference fetching, coercion,
 * default application, or host effect.
 */
export declare const validateDraft202012: Draft202012SyntaxValidator;
