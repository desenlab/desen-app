import {
  STARTER_BOX_CAPABILITY_ID,
  STARTER_GRID_CAPABILITY_ID,
  STARTER_HEADING_CAPABILITY_ID,
  STARTER_ICON_CAPABILITY_ID,
  STARTER_IMAGE_CAPABILITY_ID,
  STARTER_SEPARATOR_CAPABILITY_ID,
  STARTER_STACK_CAPABILITY_ID,
  STARTER_TEXT_CAPABILITY_ID,
  createStarterNodeTemplate,
} from "@desen/starter-catalog-web";

import type {
  StarterBoxProps,
  StarterGridProps,
  StarterHeadingProps,
  StarterIconProps,
  StarterImageProps,
  StarterSeparatorProps,
  StarterStackProps,
  StarterTextProps,
} from "@desen/starter-catalog-web";

const box: StarterBoxProps = { dir: "rtl" };
const stack: StarterStackProps = { direction: "horizontal", wrap: true, dir: "ltr" };
const grid: StarterGridProps = { columns: 3, flow: "row", dir: "rtl" };
const text: StarterTextProps = { text: "Inert content" };
const heading: StarterHeadingProps = { text: "Heading", level: 2 };
const image: StarterImageProps = {
  source: "neutral-horizon",
  alt: "Neutral horizon",
  fit: "cover",
};
const icon: StarterIconProps = { name: "info", label: "Information", decorative: false };
const separator: StarterSeparatorProps = { orientation: "horizontal" };
void [box, stack, grid, text, heading, image, icon, separator];

createStarterNodeTemplate({ capabilityId: STARTER_BOX_CAPABILITY_ID, idPrefix: "public.box" });
createStarterNodeTemplate({ capabilityId: STARTER_STACK_CAPABILITY_ID, idPrefix: "public.stack" });
createStarterNodeTemplate({ capabilityId: STARTER_GRID_CAPABILITY_ID, idPrefix: "public.grid" });
createStarterNodeTemplate({ capabilityId: STARTER_TEXT_CAPABILITY_ID, idPrefix: "public.text" });
createStarterNodeTemplate({
  capabilityId: STARTER_HEADING_CAPABILITY_ID,
  idPrefix: "public.heading",
});
createStarterNodeTemplate({ capabilityId: STARTER_IMAGE_CAPABILITY_ID, idPrefix: "public.image" });
createStarterNodeTemplate({ capabilityId: STARTER_ICON_CAPABILITY_ID, idPrefix: "public.icon" });
createStarterNodeTemplate({
  capabilityId: STARTER_SEPARATOR_CAPABILITY_ID,
  idPrefix: "public.separator",
});

// @ts-expect-error A physical CSS side cannot be introduced through logical starter props.
const unsafeBox: StarterBoxProps = { marginLeft: 12 };
const unsafeImage: StarterImageProps = {
  // @ts-expect-error An external source cannot replace the closed trusted image set.
  source: "https://example.invalid/image.png",
  alt: "Unsafe",
};
// @ts-expect-error Executable markup cannot become inert Text data.
const unsafeText: StarterTextProps = { text: () => null };
void [unsafeBox, unsafeImage, unsafeText];
