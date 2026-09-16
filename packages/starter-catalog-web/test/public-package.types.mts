import {
  STARTER_BOX_CAPABILITY_ID,
  STARTER_CARD_CAPABILITY_ID,
  STARTER_LIST_CAPABILITY_ID,
  STARTER_TABLE_CAPABILITY_ID,
  STARTER_PROGRESS_CAPABILITY_ID,
  STARTER_COMBOBOX_CAPABILITY_ID,
  STARTER_GRID_CAPABILITY_ID,
  STARTER_HEADING_CAPABILITY_ID,
  STARTER_ICON_CAPABILITY_ID,
  STARTER_IMAGE_CAPABILITY_ID,
  STARTER_NUMBER_FIELD_CAPABILITY_ID,
  STARTER_SEPARATOR_CAPABILITY_ID,
  STARTER_SLIDER_CAPABILITY_ID,
  STARTER_STACK_CAPABILITY_ID,
  STARTER_TABS_CAPABILITY_ID,
  STARTER_TEXT_CAPABILITY_ID,
  createStarterNodeTemplate,
} from "@desen/starter-catalog-web";

import type {
  StarterBoxProps,
  StarterCardProps,
  StarterListProps,
  StarterTableProps,
  StarterProgressProps,
  StarterComboboxProps,
  StarterGridProps,
  StarterHeadingProps,
  StarterIconProps,
  StarterImageProps,
  StarterNumberFieldProps,
  StarterSeparatorProps,
  StarterSliderProps,
  StarterStackProps,
  StarterTabsProps,
  StarterTextProps,
} from "@desen/starter-catalog-web";

const box: StarterBoxProps = { dir: "rtl" };
const card: StarterCardProps = { label: "Project summary" };
const list: StarterListProps = { label: "Project tasks", itemIds: ["research", "prototype"] };
const table: StarterTableProps = {
  caption: "Project status",
  columns: [{ id: "name", label: "Name" }],
  rows: [{ id: "research", cells: { name: "Research" } }],
};
const progress: StarterProgressProps = { label: "Uploading", value: 45 };
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
const combobox: StarterComboboxProps = {
  label: "Find a region",
  options: [{ id: "north", label: "Northern region" }],
};
const tabs: StarterTabsProps = {
  label: "Sections",
  tabs: [{ id: "overview", label: "Overview" }],
  value: "overview",
};
const slider: StarterSliderProps = { label: "Opacity", value: 50, min: 0, max: 100, step: 1 };
const numberField: StarterNumberFieldProps = {
  label: "Columns",
  value: 2,
  min: 1,
  max: 12,
  step: 1,
};
void [
  box,
  card,
  list,
  table,
  progress,
  stack,
  grid,
  text,
  heading,
  image,
  icon,
  separator,
  combobox,
  tabs,
  slider,
  numberField,
];

createStarterNodeTemplate({ capabilityId: STARTER_BOX_CAPABILITY_ID, idPrefix: "public.box" });
createStarterNodeTemplate({ capabilityId: STARTER_CARD_CAPABILITY_ID, idPrefix: "public.card" });
createStarterNodeTemplate({ capabilityId: STARTER_LIST_CAPABILITY_ID, idPrefix: "public.list" });
createStarterNodeTemplate({ capabilityId: STARTER_TABLE_CAPABILITY_ID, idPrefix: "public.table" });
createStarterNodeTemplate({
  capabilityId: STARTER_PROGRESS_CAPABILITY_ID,
  idPrefix: "public.progress",
});
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
createStarterNodeTemplate({
  capabilityId: STARTER_COMBOBOX_CAPABILITY_ID,
  idPrefix: "public.combobox",
});
createStarterNodeTemplate({ capabilityId: STARTER_TABS_CAPABILITY_ID, idPrefix: "public.tabs" });
createStarterNodeTemplate({
  capabilityId: STARTER_SLIDER_CAPABILITY_ID,
  idPrefix: "public.slider",
});
createStarterNodeTemplate({
  capabilityId: STARTER_NUMBER_FIELD_CAPABILITY_ID,
  idPrefix: "public.number-field",
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
const unsafeCombobox: StarterComboboxProps = {
  label: "Find a region",
  options: [{ id: "north", label: "Northern region" }],
  // @ts-expect-error A renderer function cannot cross the public Catalog surface.
  renderItem: () => null,
};
const unsafeSlider: StarterSliderProps = {
  label: "Opacity",
  // @ts-expect-error Numeric data cannot be substituted with a callback.
  value: () => 50,
  min: 0,
  max: 100,
  step: 1,
};
const unsafeTable: StarterTableProps = {
  caption: "Project status",
  columns: [{ id: "name", label: "Name" }],
  // @ts-expect-error Table cells are inert text, never executable renderers.
  rows: [{ id: "research", cells: { name: () => null } }],
};
void [unsafeBox, unsafeImage, unsafeText, unsafeCombobox, unsafeSlider, unsafeTable];
