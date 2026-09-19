import { useId, useState } from "react";
import { getEditableProjectMasterDefinitionDigest } from "@desen/design-system-core";

import styles from "./master-instance-panel.module.css";
import type { EditableProjectRecipeTransactionCommand } from "@desen/design-system-core";
import type {
  ProjectAuthoringResult,
  ProjectAuthoringState,
} from "./project-authoring-controller.js";
import type { AuthoringComponentSelection } from "./authoring-selection.js";
import type { CatalogAuthoringModel, AuthoringLayerNode } from "./authoring-data.js";

/** Project-bound controls embedded beside the ordinary Catalog library. */
export interface MasterInstancePanelProps {
  /** Complete admitted project; command fences are captured from this rendered snapshot. */
  readonly state: ProjectAuthoringState;
  /** Current ordinary Source/Catalog layer model, not a separately recreated component tree. */
  readonly model: CatalogAuthoringModel;
  /** Current Design surface. */
  readonly surfaceId: string;
  /** Exact selected Source layer, or null. */
  readonly selection: AuthoringComponentSelection | null;
  /** Disables authoring during Run, Source drafts or lifecycle work. */
  readonly disabled: boolean;
  /** The parent commits the whole project before any local success/selection update. */
  readonly onCommand: (command: EditableProjectRecipeTransactionCommand) => ProjectAuthoringResult;
  /** Opens the selected definition with the existing visual editor; absent inside another draft. */
  readonly onEditMaster?: (masterId: string) => void;
  /** Limits this panel to nested-instance operations while a master draft is open. */
  readonly editingMasterId?: string;
}

function nextId(prefix: string, existing: readonly { readonly id: string }[]): string {
  const occupied = new Set(existing.map(({ id }) => id));
  for (let suffix = 1; ; suffix += 1)
    if (!occupied.has(`${prefix}.${suffix}`)) return `${prefix}.${suffix}`;
}

/** Creates reusable compositions, inserts linked instances, and explicitly resets/detaches them. */
export function MasterInstancePanel({
  state,
  model,
  surfaceId,
  selection,
  disabled,
  onCommand,
  onEditMaster,
  editingMasterId,
}: MasterInstancePanelProps) {
  const id = useId();
  const [name, setName] = useState("");
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    scope: string | undefined;
    text: string;
  } | null>(null);
  const graph = state.session.record.designSystem.recipeGraph;
  const linked = graph.instances.find(
    (instance) =>
      instance.surfaceId === surfaceId &&
      instance.mapping.some(
        ({ owner, sourceId }) => owner.kind === "node" && sourceId === selection?.sourceNodeId,
      ),
  );
  const master =
    graph.definitions.find(({ id: masterId }) => masterId === selectedMasterId) ??
    graph.definitions.find(({ id: masterId }) => masterId === linked?.masterId) ??
    graph.definitions[0];
  const managedOwners = new Set(
    graph.instances
      .filter((instance) => instance.surfaceId === surfaceId)
      .flatMap((instance) =>
        instance.mapping
          .filter(({ owner }) => owner.kind === "node" || owner.kind === "behavior")
          .map(({ sourceId }) => sourceId),
      ),
  );
  const destinations: {
    key: string;
    parentId: string;
    slot: string;
    index: number;
    label: string;
  }[] = [];
  function visit(node: AuthoringLayerNode): void {
    for (const owner of [node, ...node.behaviors]) {
      for (const slot of owner.slots) {
        if (!managedOwners.has(owner.id))
          destinations.push({
            key: JSON.stringify([owner.id, slot.name]),
            parentId: owner.id,
            slot: slot.name,
            index: slot.children.length,
            label: `${owner.displayName} · ${owner.id} · ${slot.name}`,
          });
        for (const child of slot.children) visit(child);
      }
    }
  }
  const surface = model.surfaces.find(
    ({ id: surfaceIdCandidate }) => surfaceIdCandidate === surfaceId,
  );
  if (surface !== undefined) visit(surface.root);
  const destination =
    destinations.find(({ key }) => key === selectedDestination) ?? destinations[0];
  const blocked =
    disabled ||
    state.pending !== null ||
    state.reopenRequired ||
    state.disposed ||
    state.unavailable;
  function execute(command: EditableProjectRecipeTransactionCommand, message: string): boolean {
    if (blocked) return false;
    const result = onCommand(command);
    setNotice({
      scope: editingMasterId,
      text: result.ok
        ? message
        : `No change: ${result.reason}. The project and history are preserved.`,
    });
    return result.ok;
  }
  return (
    <details className={styles.panel}>
      <summary>
        My components <span>{graph.definitions.length}</span>
      </summary>
      <div className={styles.body}>
        <p>
          {editingMasterId === undefined
            ? "Create a master from a designed layer or composition. Edit an instance in Inspector to make local overrides."
            : "Compose this master using linked instances. Inspector edits become occurrence defaults; edit other master definitions after closing this draft."}
        </p>
        {editingMasterId === undefined && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (selection === null || name.trim().length === 0) return;
              const masterId = nextId("master", graph.definitions);
              if (
                execute(
                  {
                    type: "master.capture",
                    expectedProjectDigest: state.session.digest,
                    masterId,
                    name: name.trim(),
                    surfaceId,
                    nodeId: selection.sourceNodeId,
                    instanceId: nextId("instance", graph.instances),
                  },
                  "Master created; the selected composition is linked.",
                )
              ) {
                setSelectedMasterId(masterId);
                setName("");
              }
            }}
          >
            <label htmlFor={`${id}-name`}>Component name</label>
            <input
              id={`${id}-name`}
              maxLength={256}
              disabled={blocked}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <button
              type="submit"
              disabled={blocked || selection === null || name.trim().length === 0}
            >
              Create master from selection
            </button>
          </form>
        )}
        {graph.definitions.length === 0 ? (
          <p>No reusable components yet.</p>
        ) : (
          <>
            <label htmlFor={`${id}-master`}>Master</label>
            <select
              id={`${id}-master`}
              disabled={blocked}
              value={master?.id ?? ""}
              onChange={(event) => setSelectedMasterId(event.currentTarget.value)}
            >
              {graph.definitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
            {onEditMaster !== undefined && (
              <button
                type="button"
                disabled={blocked || master === undefined}
                onClick={() => {
                  if (master !== undefined && !blocked) {
                    setNotice(null);
                    onEditMaster(master.id);
                  }
                }}
              >
                Edit master
              </button>
            )}
            <label htmlFor={`${id}-destination`}>Insert into</label>
            <select
              id={`${id}-destination`}
              disabled={blocked || destinations.length === 0}
              value={destination?.key ?? ""}
              onChange={(event) => setSelectedDestination(event.currentTarget.value)}
            >
              {destinations.length === 0 ? (
                <option value="">No unmanaged destination</option>
              ) : (
                destinations.map((target) => (
                  <option key={target.key} value={target.key}>
                    {target.label}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              disabled={
                blocked ||
                master === undefined ||
                master.id === editingMasterId ||
                destination === undefined
              }
              onClick={() => {
                if (
                  master === undefined ||
                  master.id === editingMasterId ||
                  destination === undefined
                )
                  return;
                execute(
                  {
                    type: "instance.insert",
                    expectedProjectDigest: state.session.digest,
                    masterId: master.id,
                    instanceId: nextId("instance", graph.instances),
                    destination: {
                      surfaceId,
                      parentId: destination.parentId,
                      slot: destination.slot,
                      index: destination.index,
                    },
                  },
                  "Linked instance inserted. Select it in Layers to customize.",
                );
              }}
            >
              Insert linked instance
            </button>
            {editingMasterId === undefined && (
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={blocked || master === undefined || name.trim().length === 0}
                  onClick={() => {
                    if (master === undefined) return;
                    const digest = getEditableProjectMasterDefinitionDigest(
                      state.session.record,
                      master.id,
                    );
                    if (digest === undefined) return;
                    if (
                      execute(
                        {
                          type: "master.update",
                          expectedProjectDigest: state.session.digest,
                          expectedDefinitionDigest: digest,
                          definition: { ...master, name: name.trim() },
                        },
                        "Master renamed.",
                      )
                    )
                      setName("");
                  }}
                >
                  Rename master
                </button>
                <button
                  type="button"
                  disabled={blocked || master === undefined}
                  onClick={() => {
                    if (master !== undefined)
                      execute(
                        {
                          type: "master.delete",
                          expectedProjectDigest: state.session.digest,
                          masterId: master.id,
                        },
                        "Unused master deleted.",
                      );
                  }}
                >
                  Delete unused master
                </button>
              </div>
            )}
          </>
        )}
        {linked === undefined ? (
          <p>Selected content is not linked to a master.</p>
        ) : (
          <section aria-label="Selected component instance">
            <strong>
              Linked instance ·{" "}
              {graph.definitions.find(({ id: masterId }) => masterId === linked.masterId)?.name}
            </strong>
            <p>
              {linked.overrides.length} local override{linked.overrides.length === 1 ? "" : "s"}
            </p>
            {linked.overrides.map((override) => (
              <div
                key={JSON.stringify([override.owner, override.property])}
                className={styles.override}
              >
                <span>
                  {[...override.owner.path, override.owner.id, override.property.name].join(" / ")}
                </span>
                <button
                  disabled={blocked}
                  type="button"
                  aria-label={`Reset override ${override.property.name} · ${[...override.owner.path, override.owner.id].join(" / ")}${override.property.kind === "style" ? ` · ${override.property.state}/${override.property.part}` : ""}`}
                  onClick={() => {
                    execute(
                      {
                        type: "instance.reset",
                        expectedProjectDigest: state.session.digest,
                        instanceId: linked.id,
                        owner: override.owner,
                        property: override.property,
                      },
                      "Override reset to the current master value.",
                    );
                  }}
                >
                  Reset
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={blocked}
              onClick={() =>
                execute(
                  {
                    type: "instance.detach",
                    expectedProjectDigest: state.session.digest,
                    instanceId: linked.id,
                  },
                  "Instance detached. Its design and wiring are unchanged.",
                )
              }
            >
              Detach instance
            </button>
          </section>
        )}
        <p role="status" aria-live="polite">
          {notice?.scope === editingMasterId ? notice?.text : ""}
        </p>
      </div>
    </details>
  );
}
