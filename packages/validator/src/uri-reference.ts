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

function normalizePercentEncoding(value: string): string {
  return value.replace(/%([0-9A-Fa-f]{2})/gu, (_match, hexadecimal: string) => {
    const character = String.fromCharCode(Number.parseInt(hexadecimal, 16));
    return isUnreserved(character) ? character : `%${hexadecimal.toUpperCase()}`;
  });
}

function removeLastPathSegment(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function removeDotSegments(path: string): string {
  let input = path;
  let output = "";
  while (input !== "") {
    if (input.startsWith("../")) input = input.slice(3);
    else if (input.startsWith("./")) input = input.slice(2);
    else if (input.startsWith("/./")) input = input.slice(2);
    else if (input === "/.") input = "/";
    else if (input.startsWith("/../")) {
      input = input.slice(3);
      output = removeLastPathSegment(output);
    } else if (input === "/..") {
      input = "/";
      output = removeLastPathSegment(output);
    } else if (input === "." || input === "..") input = "";
    else {
      const segmentEnd = input.startsWith("/") ? input.indexOf("/", 1) : input.indexOf("/");
      if (segmentEnd < 0) {
        output += input;
        input = "";
      } else {
        output += input.slice(0, segmentEnd);
        input = input.slice(segmentEnd);
      }
    }
  }
  return output;
}

function mergePaths(base: UriReferenceParts, relativePath: string): string {
  if (base.authority !== undefined && base.path === "") return `/${relativePath}`;
  const slash = base.path.lastIndexOf("/");
  return slash < 0 ? relativePath : `${base.path.slice(0, slash + 1)}${relativePath}`;
}

function normalizeAuthority(authority: string, scheme: string): string {
  const encoded = normalizePercentEncoding(authority);
  const at = encoded.lastIndexOf("@");
  const userInfo = at < 0 ? "" : encoded.slice(0, at + 1);
  const hostAndPort = at < 0 ? encoded : encoded.slice(at + 1);

  let host: string;
  let port: string | undefined;
  if (hostAndPort.startsWith("[")) {
    const closing = hostAndPort.indexOf("]");
    host = hostAndPort.slice(0, closing + 1).toLowerCase();
    const suffix = hostAndPort.slice(closing + 1);
    port = suffix.startsWith(":") ? suffix.slice(1) : undefined;
  } else {
    const colon = hostAndPort.lastIndexOf(":");
    host = (colon < 0 ? hostAndPort : hostAndPort.slice(0, colon)).toLowerCase();
    port = colon < 0 ? undefined : hostAndPort.slice(colon + 1);
  }

  const normalizedPort =
    (scheme === "http" && port === "80") || (scheme === "https" && port === "443")
      ? undefined
      : port;
  return `${userInfo}${host}${normalizedPort === undefined ? "" : `:${normalizedPort}`}`;
}

/**
 * Resolves and syntax-normalizes one RFC 3986 URI reference against an absolute base URI.
 *
 * @remarks This is a platform-neutral implementation of RFC 3986 section 5.2. It performs no
 * network access and intentionally avoids WHATWG URL or another host API. Syntax normalization
 * lowercases schemes and hosts, removes dot segments and default HTTP(S) ports, uppercases retained
 * percent escapes, and decodes percent-encoded unreserved characters.
 */
export function resolveUriReference(reference: string, baseUri: string): string | undefined {
  const referenceParts = parseUriReference(reference);
  const base = parseUriReference(baseUri);
  if (referenceParts === undefined || base?.scheme === undefined) return undefined;

  let scheme: string;
  let authority: string | undefined;
  let path: string;
  let query: string | undefined;
  if (referenceParts.scheme !== undefined) {
    scheme = referenceParts.scheme.toLowerCase();
    authority = referenceParts.authority;
    path = removeDotSegments(normalizePercentEncoding(referenceParts.path));
    query = referenceParts.query;
  } else {
    scheme = base.scheme.toLowerCase();
    if (referenceParts.authority !== undefined) {
      authority = referenceParts.authority;
      path = removeDotSegments(normalizePercentEncoding(referenceParts.path));
      query = referenceParts.query;
    } else {
      authority = base.authority;
      if (referenceParts.path === "") {
        path = normalizePercentEncoding(base.path);
        query = referenceParts.query ?? base.query;
      } else {
        path = removeDotSegments(
          normalizePercentEncoding(
            referenceParts.path.startsWith("/")
              ? referenceParts.path
              : mergePaths(base, referenceParts.path),
          ),
        );
        query = referenceParts.query;
      }
    }
  }

  const normalizedAuthority =
    authority === undefined ? undefined : normalizeAuthority(authority, scheme);
  const normalizedQuery = query === undefined ? "" : `?${normalizePercentEncoding(query)}`;
  const normalizedFragment =
    referenceParts.fragment === undefined || referenceParts.fragment === ""
      ? ""
      : `#${normalizePercentEncoding(referenceParts.fragment)}`;
  return `${scheme}:${
    normalizedAuthority === undefined ? "" : `//${normalizedAuthority}`
  }${path}${normalizedQuery}${normalizedFragment}`;
}

/** Tests exact RFC 3986 URI-reference syntax without resolving, normalizing, or fetching it. */
export function isUriReference(value: string): boolean {
  return parseUriReference(value) !== undefined;
}

/** Tests whether a value is a syntactically valid RFC 3986 URI with an explicit scheme. */
export function isAbsoluteUri(value: string): boolean {
  return parseUriReference(value)?.scheme !== undefined;
}
