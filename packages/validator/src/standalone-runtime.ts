/**
 * Counts Unicode code points using the same surrogate-pair rule required by JSON Schema lengths.
 *
 * @remarks Inputs reach this helper only after the inert JSON boundary has rejected unpaired
 * surrogates. The defensive pair check keeps the helper correct if generated code is exercised
 * independently inside the package.
 */
export function unicodeLength(value: string): number {
  let length = 0;
  for (let index = 0; index < value.length; index += 1) {
    const leading = value.charCodeAt(index);
    if (leading >= 0xd800 && leading <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (trailing >= 0xdc00 && trailing <= 0xdfff) index += 1;
    }
    length += 1;
  }
  return length;
}

/**
 * Compares inert JSON values deeply for generated `uniqueItems` validation.
 *
 * @remarks The public validator copies input through canonical JSON first, so this helper handles
 * only null, booleans, finite numbers, strings, dense arrays, and plain data objects. It deliberately
 * has no hooks for classes, getters, dates, maps, sets, or caller-defined equality behavior.
 */
export function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return false;
  }

  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => jsonEqual(value, right[index]));
  }
  if (Array.isArray(right)) return false;

  const leftRecord = left as Readonly<Record<string, unknown>>;
  const rightRecord = right as Readonly<Record<string, unknown>>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) => Object.hasOwn(rightRecord, key) && jsonEqual(leftRecord[key], rightRecord[key]),
  );
}
