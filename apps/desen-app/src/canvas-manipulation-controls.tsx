import styles from "./application.module.css";

import type {
  AuthoringCanvasPreviewFrame,
  AuthoringCanvasViewport,
} from "./authoring-direct-manipulation.js";

/** App-owned Design-canvas controls. They never reach into the adapter-managed subtree. */
export function CanvasManipulationControls({
  disabled,
  frame,
  onPan,
  onReset,
  onResize,
  onZoom,
  selectedSourceNodeIds,
  viewport,
}: Readonly<{
  readonly disabled: boolean;
  readonly frame: AuthoringCanvasPreviewFrame | null;
  readonly onPan: (delta: Readonly<{ readonly x: number; readonly y: number }>) => void;
  readonly onReset: () => void;
  readonly onResize: (delta: Readonly<{ readonly width: number; readonly height: number }>) => void;
  readonly onZoom: (direction: "in" | "out") => void;
  readonly selectedSourceNodeIds: readonly string[];
  readonly viewport: AuthoringCanvasViewport;
}>) {
  const selectionLabel =
    selectedSourceNodeIds.length === 0
      ? "No layer selected"
      : selectedSourceNodeIds.length === 1
        ? `Selected · ${selectedSourceNodeIds[0]}`
        : `${selectedSourceNodeIds.length} layers selected`;
  const panStep = 48;

  return (
    <section
      aria-label="Canvas controls"
      className={styles.canvasManipulationControls}
      data-canvas-manipulation="true"
      data-selected-layer-count={selectedSourceNodeIds.length}
    >
      <span aria-live="polite" className={styles.canvasManipulationSelection} role="status">
        {selectionLabel}
      </span>
      <div aria-label="Canvas zoom" className={styles.canvasManipulationGroup} role="group">
        <button
          aria-label="Zoom out canvas"
          disabled={disabled || viewport.zoom <= 0.5}
          onClick={() => onZoom("out")}
          type="button"
        >
          −
        </button>
        <button aria-label="Reset canvas view" disabled={disabled} onClick={onReset} type="button">
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button
          aria-label="Zoom in canvas"
          disabled={disabled || viewport.zoom >= 2}
          onClick={() => onZoom("in")}
          type="button"
        >
          +
        </button>
      </div>
      <div aria-label="Canvas pan" className={styles.canvasManipulationGroup} role="group">
        <button
          aria-label="Pan canvas up"
          disabled={disabled}
          onClick={() => onPan({ x: 0, y: -panStep })}
          type="button"
        >
          ↑
        </button>
        <button
          aria-label="Pan canvas left"
          disabled={disabled}
          onClick={() => onPan({ x: -panStep, y: 0 })}
          type="button"
        >
          ←
        </button>
        <button
          aria-label="Pan canvas right"
          disabled={disabled}
          onClick={() => onPan({ x: panStep, y: 0 })}
          type="button"
        >
          →
        </button>
        <button
          aria-label="Pan canvas down"
          disabled={disabled}
          onClick={() => onPan({ x: 0, y: panStep })}
          type="button"
        >
          ↓
        </button>
      </div>
      <div
        aria-label="Resize preview frame"
        className={styles.canvasManipulationGroup}
        role="group"
      >
        <button
          aria-label="Make preview frame narrower"
          disabled={disabled || frame === null}
          onClick={() => onResize({ width: -80, height: 0 })}
          type="button"
        >
          ↔−
        </button>
        <button
          aria-label="Make preview frame wider"
          disabled={disabled || frame === null}
          onClick={() => onResize({ width: 80, height: 0 })}
          type="button"
        >
          ↔+
        </button>
        <button
          aria-label="Make preview frame shorter"
          disabled={disabled || frame === null}
          onClick={() => onResize({ width: 0, height: -80 })}
          type="button"
        >
          ↕−
        </button>
        <button
          aria-label="Make preview frame taller"
          disabled={disabled || frame === null}
          onClick={() => onResize({ width: 0, height: 80 })}
          type="button"
        >
          ↕+
        </button>
      </div>
    </section>
  );
}
