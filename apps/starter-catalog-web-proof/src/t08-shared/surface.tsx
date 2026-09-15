import { useState } from "react";
import {
  StarterAccordionReactAdapter,
  StarterDialogReactAdapter,
  StarterMenuReactAdapter,
  StarterPopoverReactAdapter,
  StarterSurfaceBoundary,
  StarterTooltipReactAdapter,
} from "@desen/starter-catalog-web/react-adapters";

import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

function interactionPort() {
  return Object.freeze({
    dispatchEvent: () => Object.freeze({ status: "unavailable" }),
    attachCommands: () => Object.freeze({ status: "unavailable" }),
    detachCommands: () => Object.freeze({ status: "unavailable" }),
  } satisfies RuntimeReactInteractionPort);
}

function adapterInput(
  capability: "Dialog" | "Popover" | "Tooltip" | "Menu" | "Accordion",
  props: Record<string, unknown>,
  slots: Record<string, unknown> = {},
): RuntimeReactComponentAdapterProps {
  return {
    identity: {
      capabilityId: `run.desen.starter/${capability}`,
      sourceNodeId: `t08.${capability.toLowerCase()}`,
      runtimeNodeId: `t08.${capability.toLowerCase()}:instance`,
    },
    props: props as RuntimeReactComponentAdapterProps["props"],
    slots: slots as RuntimeReactComponentAdapterProps["slots"],
    style: { base: {} },
    interactions: interactionPort(),
  };
}

/** Fixed visual T08 overlay/disclosure scenarios used by both proof graphs. */
export function T08OverlaySurface({ graph }: Readonly<{ graph: "authoring" | "host" }>) {
  const [selected, setSelected] = useState("none");
  const eventInput = (
    capability: "Menu" | "Accordion",
    props: Record<string, unknown>,
    slots?: Record<string, unknown>,
  ) => {
    const base = adapterInput(capability, props, slots);
    return {
      ...base,
      interactions: Object.freeze({
        ...base.interactions,
        dispatchEvent: (name: string, payload: unknown) => {
          if (name === "select") setSelected(`menu:${(payload as { id: string }).id}`);
          if (name === "valueChange")
            setSelected(`accordion:${(payload as { value: string[] }).value.join(",") || "none"}`);
          return Object.freeze({ status: "dispatched", completion: Promise.resolve() });
        },
      }),
    } as RuntimeReactComponentAdapterProps;
  };
  return (
    <StarterSurfaceBoundary>
      <section className="t08-proof-surface" data-proof-surface="t08-overlay-disclosure">
        <p className="t08-proof-label">{graph} graph · static overlay scenarios</p>
        <div className="t08-proof-grid">
          <StarterDialogReactAdapter
            {...adapterInput(
              "Dialog",
              {
                triggerLabel: "Open dialog",
                title: "Dialog",
                description: "Dialog body",
                closeLabel: "Close",
              },
              { content: ["Dialog content"] },
            )}
          />
          <StarterPopoverReactAdapter
            {...adapterInput(
              "Popover",
              {
                triggerLabel: "Open popover",
                title: "Popover",
                description: "Popover body",
                closeLabel: "Close",
              },
              { content: ["Popover content"] },
            )}
          />
          <StarterTooltipReactAdapter
            {...adapterInput("Tooltip", { label: "Hover help", content: "Tooltip content" })}
          />
          <StarterTooltipReactAdapter
            {...adapterInput("Tooltip", {
              label: "Disabled help",
              content: "Unavailable",
              disabled: true,
            })}
          />
          <StarterMenuReactAdapter
            {...eventInput("Menu", {
              triggerLabel: "Open menu",
              items: [
                { id: "edit", label: "Edit" },
                { id: "archive", label: "Archive", disabled: true },
              ],
            })}
          />
          <StarterAccordionReactAdapter
            {...eventInput(
              "Accordion",
              {
                items: [
                  { id: "overview", label: "Overview" },
                  { id: "details", label: "Details" },
                ],
                defaultValue: [],
              },
              { panels: ["Overview panel", "Details panel"] },
            )}
          />
        </div>
        <div
          className="t08-proof-metadata"
          data-negative-missing-slot="rejected"
          data-negative-forged-portal="rejected"
          data-negative-stale-interaction="rejected"
          data-disabled-controls="rejected"
        >
          Boundary probes: rejected · disabled controls: covered
        </div>
        <output data-proof-events="t08">Last disclosure event: {selected}</output>
      </section>
    </StarterSurfaceBoundary>
  );
}
