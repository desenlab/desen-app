import {
  createRuntimeRepeatRootScope,
  createRuntimeRepeatedNodeIdentity,
  createRuntimeResolutionSnapshot,
  materializeRuntimeRepeat,
} from "../src/index.js";

import type {
  RuntimeRepeatScope,
  RuntimeRepeatSpec,
  RuntimeRepeatedNodeIdentity,
} from "../src/index.js";

const snapshot = createRuntimeResolutionSnapshot({
  state: {},
  context: {},
  resource: {},
  operation: {},
  event: { status: "unavailable" },
  item: {},
  env: {},
});
const root = createRuntimeRepeatRootScope(snapshot);

const spec: RuntimeRepeatSpec = {
  items: [{ id: "a" }],
  as: "row",
  key: { $ref: "item.row.id" },
};
const materialized = materializeRuntimeRepeat(root, spec);
if (materialized.status === "materialized") {
  const scope = materialized.instances[0]?.scope;
  if (scope !== undefined) {
    // @ts-expect-error repeat key paths are immutable
    scope.repeatKeys.push("forged");

    const created = createRuntimeRepeatedNodeIdentity(
      {
        documentId: "com.desen.tasks",
        surfaceId: "tasks",
        nodeId: "tasks.item",
        use: "com.desen.ui/Text",
      },
      scope,
    );
    if (created.status === "created") {
      const identity: RuntimeRepeatedNodeIdentity = created.identity;
      // @ts-expect-error repeated identities are immutable
      identity.mountGeneration = 4;
    }
  }
}

// @ts-expect-error opaque repeat scopes cannot be constructed by shape
const forgedScope: RuntimeRepeatScope = {
  aliases: {},
  aliasOrder: [],
  repeatKeys: [],
};
void forgedScope;

// @ts-expect-error opaque repeated identities cannot be constructed by shape
const forgedIdentity: RuntimeRepeatedNodeIdentity = {
  key: "forged",
  baseIdentity: {} as never,
  repeatKeys: ["a"],
  use: "com.desen.ui/Text",
  mountGeneration: 0,
};
void forgedIdentity;

const executableItems: RuntimeRepeatSpec = {
  // @ts-expect-error repeat items are inert ValueSpecs, never callbacks
  items: () => [{ id: "a" }],
  as: "row",
  key: "a",
};
void executableItems;

const nonStringAlias: RuntimeRepeatSpec = {
  items: [],
  // @ts-expect-error aliases are strings
  as: 1,
  key: "unused",
};
void nonStringAlias;

const booleanKey: RuntimeRepeatSpec = {
  items: [],
  as: "row",
  key: true,
};
void booleanKey;

createRuntimeRepeatedNodeIdentity(
  {
    documentId: "com.desen.tasks",
    surfaceId: "tasks",
    nodeId: "tasks.item",
    use: "com.desen.ui/Text",
    // @ts-expect-error repeat keys come from the branded scope, not the base descriptor
    repeatKey: "a",
  },
  root,
);
