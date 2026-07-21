const URI_REFERENCE_PATTERN =
  /^(?:([A-Za-z][A-Za-z0-9+.-]*):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/u;
const SUB_DELIMITERS = "!$&'()*+,;=";

interface UriReferenceParts {
  readonly scheme: string | undefined;
  readonly authority: string | undefined;
  readonly path: string;
  readonly query: string | undefined;
  readonly fragment: string | undefined;
}

function isHexadecimal(character: string | undefined): boolean {
  return character !== undefined && /^[0-9A-Fa-f]$/u.test(character);
}

function isUnreserved(character: string): boolean {
  return /^[A-Za-z0-9._~-]$/u.test(character);
}

function validEncodedComponent(value: string, additionalCharacters: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] as string;
    if (character === "%") {
      if (!isHexadecimal(value[index + 1]) || !isHexadecimal(value[index + 2])) return false;
      index += 2;
      continue;
    }
    if (
      character.charCodeAt(0) > 0x7f ||
      (!isUnreserved(character) &&
        !SUB_DELIMITERS.includes(character) &&
        !additionalCharacters.includes(character))
    ) {
      return false;
    }
  }
  return true;
}

function isIpv4Address(value: string): boolean {
  const octets = value.split(".");
  return (
    octets.length === 4 &&
    octets.every(
      (octet) =>
        /^(?:0|[1-9][0-9]{0,2})$/u.test(octet) && Number(octet) >= 0 && Number(octet) <= 255,
    )
  );
}

function ipv6GroupCount(groups: readonly string[], allowIpv4Tail: boolean): number | undefined {
  let count = 0;
  for (const [index, group] of groups.entries()) {
    if (group.includes(".")) {
      if (!allowIpv4Tail || index !== groups.length - 1 || !isIpv4Address(group)) return undefined;
      count += 2;
    } else {
      if (!/^[0-9A-Fa-f]{1,4}$/u.test(group)) return undefined;
      count += 1;
    }
  }
  return count;
}

function isIpv6Address(value: string): boolean {
  const compression = value.indexOf("::");
  if (compression >= 0 && compression !== value.lastIndexOf("::")) return false;

  if (compression < 0) {
    const groups = value.split(":");
    return ipv6GroupCount(groups, true) === 8;
  }

  const leftText = value.slice(0, compression);
  const rightText = value.slice(compression + 2);
  const leftGroups = leftText === "" ? [] : leftText.split(":");
  const rightGroups = rightText === "" ? [] : rightText.split(":");
  const leftCount = ipv6GroupCount(leftGroups, false);
  const rightCount = ipv6GroupCount(rightGroups, true);
  return leftCount !== undefined && rightCount !== undefined && leftCount + rightCount < 8;
}

function isIpLiteral(value: string): boolean {
  if (isIpv6Address(value)) return true;
  const future = value.match(/^v([0-9A-Fa-f]+)\.(.+)$/iu);
  return (
    future !== null &&
    validEncodedComponent(future[2] as string, ":") &&
    !(future[2] as string).includes("%")
  );
}

function isAuthority(value: string): boolean {
  const at = value.lastIndexOf("@");
  if (at >= 0) {
    if (value.indexOf("@") !== at || !validEncodedComponent(value.slice(0, at), ":")) return false;
    value = value.slice(at + 1);
  }

  if (value.startsWith("[")) {
    const closing = value.indexOf("]");
    if (closing < 0 || value.indexOf("[", 1) >= 0 || value.indexOf("]", closing + 1) >= 0) {
      return false;
    }
    const suffix = value.slice(closing + 1);
    return isIpLiteral(value.slice(1, closing)) && (suffix === "" || /^:[0-9]*$/u.test(suffix));
  }

  if (value.includes("[") || value.includes("]")) return false;
  const colon = value.lastIndexOf(":");
  const host = colon < 0 ? value : value.slice(0, colon);
  const port = colon < 0 ? undefined : value.slice(colon + 1);
  if (host.includes(":")) return false;
  return validEncodedComponent(host, "") && (port === undefined || /^[0-9]*$/u.test(port));
}

function parseUriReference(value: string): UriReferenceParts | undefined {
  const match = value.match(URI_REFERENCE_PATTERN);
  if (match === null) return undefined;
  const [, scheme, authority, path, query, fragment] = match;
  if (path === undefined || !validEncodedComponent(path, ":@/")) return undefined;
  if (query !== undefined && !validEncodedComponent(query, ":@/?")) return undefined;
  if (fragment !== undefined && !validEncodedComponent(fragment, ":@/?")) return undefined;
  if (
    authority !== undefined &&
    (!isAuthority(authority) || (path !== "" && !path.startsWith("/")))
  ) {
    return undefined;
  }
  if (scheme === undefined && authority === undefined) {
    const firstSegment = path.split("/", 1)[0] as string;
    if (firstSegment.includes(":")) return undefined;
  }
  return { scheme, authority, path, query, fragment };
}

/** Tests exact RFC 3986 URI-reference syntax without resolving, normalizing, or fetching it. */
export function isUriReference(value: string): boolean {
  return parseUriReference(value) !== undefined;
}

/** Tests whether a value is a syntactically valid RFC 3986 URI with an explicit scheme. */
export function isAbsoluteUri(value: string): boolean {
  return parseUriReference(value)?.scheme !== undefined;
}
