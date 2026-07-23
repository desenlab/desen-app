import {
  Stack,
  Text,
  stackComponentRegistration,
  textComponentRegistration,
} from "../src/components/index.js";

import type { StackCatalogProps, StackProps, TextProps } from "../src/components/index.js";

const stackId: "com.example.ui/Stack" = stackComponentRegistration.id;
const textId: "com.example.ui/Text" = textComponentRegistration.id;
const stackProps: StackProps = {
  direction: "vertical",
  gap: "sm",
  children: <Text text="Safe child" />,
};
const textProps: TextProps = { text: "Hello", role: "heading" };
const catalogProps: StackCatalogProps = { align: "stretch", maxWidth: 640 };
void stackId;
void textId;
void stackProps;
void textProps;
void catalogProps;

// @ts-expect-error M03-T05-N01 Text requires its schema-authoritative text property.
Text({});

// @ts-expect-error M03-T05-N02 Text roles are limited to the frozen Catalog enum.
Text({ text: "Invalid", role: "hero" });

// @ts-expect-error M03-T05-N03 Text has no slot and therefore accepts no React children.
Text({ text: "Leaf", children: "Undeclared child" });

// @ts-expect-error M03-T05-N04 Stack direction is limited to the frozen Catalog enum.
Stack({ direction: "reverse" });

// @ts-expect-error M03-T05-N05 Stack gap is limited to the frozen Catalog enum.
Stack({ gap: "xxl" });

// @ts-expect-error M03-T05-N06 Stack alignment is limited to the frozen Catalog enum.
Stack({ align: "baseline" });

const invalidCatalogProps: StackCatalogProps = {
  // @ts-expect-error M03-T05-N07 React children come from the default slot, not Catalog props.
  children: <Text text="Not JSON" />,
};
void invalidCatalogProps;
