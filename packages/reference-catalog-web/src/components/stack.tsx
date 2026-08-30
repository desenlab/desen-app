import type { CSSProperties, ReactNode } from "react";
import type { StackAlignment, StackCatalogProps, StackGap } from "./contracts.js";

const GAP_VALUES = Object.freeze({
  none: "0",
  xs: "var(--desen-space-xs, 0.25rem)",
  sm: "var(--desen-space-sm, 0.5rem)",
  md: "var(--desen-space-md, 1rem)",
  lg: "var(--desen-space-lg, 1.5rem)",
  xl: "var(--desen-space-xl, 2rem)",
} satisfies Readonly<Record<StackGap, string>>);

const ALIGNMENT_VALUES = Object.freeze({
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
} satisfies Readonly<Record<StackAlignment, CSSProperties["alignItems"]>>);

/**
 * Web–React properties for the reference Stack implementation.
 *
 * @remarks Catalog properties remain JSON-only. `children` is the target-specific materialization
 * of the declared `default` slot and is not part of `propsSchema`.
 */
export type StackProps = Readonly<
  StackCatalogProps & {
    readonly children?: ReactNode;
  }
>;

/**
 * Renders the reference linear-layout capability without changing semantic or reading order.
 *
 * @remarks Stack intentionally emits a neutral `div` with no fabricated ARIA role or focus
 * behavior. Spacing uses overridable CSS custom properties with deterministic fallbacks; the
 * forthcoming token provider can supply the same variables without changing this public contract.
 */
export function Stack({ align, children, direction = "vertical", gap, maxWidth }: StackProps) {
  const style: CSSProperties = {
    display: "flex",
    flexDirection: direction === "horizontal" ? "row" : "column",
    ...(gap === undefined ? {} : { gap: GAP_VALUES[gap] }),
    // A declared maxWidth defines a responsive layout frame, not an intrinsic-content hint.
    // Without the fluid width, conditional children (for example an Alert) can change the
    // computed width of a centered Stack between runtime states. The combination below keeps the
    // authored frame stable at its available width up to the declared cap while still shrinking
    // safely in narrower hosts.
    ...(maxWidth === undefined ? {} : { maxWidth, minWidth: 0, width: "100%" }),
    ...(align === undefined ? {} : { alignItems: ALIGNMENT_VALUES[align] }),
  };

  return <div style={style}>{children}</div>;
}
