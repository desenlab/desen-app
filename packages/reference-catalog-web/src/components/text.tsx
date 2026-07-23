import type { TextCatalogProps, TextRole } from "./contracts.js";

const TEXT_ELEMENTS = Object.freeze({
  body: "p",
  heading: "h2",
  caption: "small",
} satisfies Readonly<Record<TextRole, "h2" | "p" | "small">>);

/**
 * Web–React properties for the leaf Text implementation.
 *
 * @remarks The type is exactly the JSON-only Catalog contract. Text has no child slot and accepts
 * neither React children nor raw HTML.
 */
export type TextProps = TextCatalogProps;

/**
 * Renders inert text with native HTML semantics.
 *
 * @remarks Body text uses `p`, headings use `h2` beneath the host application's top-level heading,
 * and captions use `small`. React creates a text node from `text`; no HTML parsing or
 * `dangerouslySetInnerHTML` path exists.
 */
export function Text({ role = "body", text }: TextProps) {
  const Element = TEXT_ELEMENTS[role];

  return <Element>{text}</Element>;
}
