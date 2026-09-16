import {
  StarterAlertReactAdapter,
  StarterAvatarReactAdapter,
  StarterBadgeReactAdapter,
  StarterCardReactAdapter,
  StarterListReactAdapter,
  StarterProgressReactAdapter,
  StarterSkeletonReactAdapter,
  StarterSurfaceBoundary,
  StarterTableReactAdapter,
} from "@desen/starter-catalog-web/react-adapters";

import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

function interactionPort(): RuntimeReactInteractionPort {
  return Object.freeze({
    dispatchEvent: () => Object.freeze({ status: "unavailable" }),
    attachCommands: () => Object.freeze({ status: "unavailable" }),
    detachCommands: () => Object.freeze({ status: "unavailable" }),
  });
}

function adapterInput(
  capability: "Card" | "Badge" | "Avatar" | "Alert" | "List" | "Table" | "Skeleton" | "Progress",
  props: Record<string, unknown>,
  slots: Record<string, unknown> = {},
): RuntimeReactComponentAdapterProps {
  return {
    identity: {
      capabilityId: `run.desen.starter/${capability}`,
      sourceNodeId: `t09.${capability.toLowerCase()}`,
      runtimeNodeId: `t09.${capability.toLowerCase()}:instance`,
    },
    props: props as RuntimeReactComponentAdapterProps["props"],
    slots: slots as RuntimeReactComponentAdapterProps["slots"],
    style: { base: {} },
    interactions: interactionPort(),
  };
}

/** Fixed data-display and feedback scenarios used by both reviewed T09 proof graphs. */
export function T09DataDisplayFeedbackSurface({
  graph,
}: Readonly<{ graph: "authoring" | "host" }>) {
  const tableColumns = [
    { id: "name", label: "Name" },
    { id: "status", label: "Status" },
  ];
  const tableRows = [
    { id: "research", cells: { name: "Research", status: "Ready" } },
    { id: "prototype", cells: { name: "Prototype", status: "In progress" } },
  ];
  return (
    <StarterSurfaceBoundary>
      <section className="t09-proof-surface" data-proof-surface="t09-data-display-feedback">
        <p className="t09-proof-label">{graph} graph · sample data only · no operation binding</p>
        <div className="t09-proof-grid">
          <StarterCardReactAdapter
            {...adapterInput(
              "Card",
              { label: "Project summary" },
              { content: ["Design is ready."] },
            )}
          />
          <div className="t09-inline">
            <StarterAvatarReactAdapter
              {...adapterInput("Avatar", { label: "Ada Lovelace", initials: "AL" })}
            />
            <StarterBadgeReactAdapter
              {...adapterInput("Badge", { label: "Ready", tone: "success" })}
            />
          </div>
          <StarterAlertReactAdapter
            {...adapterInput("Alert", {
              title: "Could not save changes",
              description: "Your draft is still available locally.",
              tone: "error",
            })}
          />
          <StarterListReactAdapter
            {...adapterInput(
              "List",
              { label: "Project tasks", itemIds: ["research", "prototype"] },
              { items: ["Research", "Prototype"] },
            )}
          />
          <StarterListReactAdapter
            {...adapterInput(
              "List",
              {
                label: "Empty tasks",
                itemIds: [],
                emptyText: "No tasks yet.",
              },
              { items: [] },
            )}
          />
          <StarterTableReactAdapter
            {...adapterInput("Table", {
              caption: "Project status",
              columns: tableColumns,
              rows: tableRows,
            })}
          />
          <StarterTableReactAdapter
            {...adapterInput("Table", {
              caption: "Empty project status",
              columns: tableColumns,
              rows: [],
              emptyText: "No project rows yet.",
            })}
          />
          <div className="t09-inline">
            <StarterSkeletonReactAdapter
              {...adapterInput("Skeleton", {
                label: "Loading project details",
                shape: "line",
                width: 160,
                height: 16,
              })}
            />
            <StarterProgressReactAdapter
              {...adapterInput("Progress", {
                label: "Uploading assets",
                value: 45,
                showValue: true,
              })}
            />
          </div>
        </div>
        <div
          className="t09-proof-metadata"
          data-negative-repeat-bound="rejected"
          data-negative-row-identity="rejected"
          data-negative-enterprise-grid="not-admitted"
        >
          Repeat, row-identity, and enterprise-grid boundary probes: covered
        </div>
      </section>
    </StarterSurfaceBoundary>
  );
}
