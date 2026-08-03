/** Counts Unicode code points for generated JSON Schema string-length checks. */
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

/** Deep equality for inert JSON values inspected by generated `uniqueItems` checks. */
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
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.hasOwn(rightRecord, key) && jsonEqual(leftRecord[key], rightRecord[key]),
    )
  );
}
