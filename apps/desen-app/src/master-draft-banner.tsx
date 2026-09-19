import styles from "./master-draft-banner.module.css";

/** Visible boundary separating an isolated master edit from the live project. */
export function MasterDraftBanner({
  name,
  dirty,
  blocked,
  notice,
  onApply,
  onDiscard,
}: Readonly<{
  /** Human-facing name of the selected reusable definition. */
  name: string;
  /** Whether isolated edits differ from the definition that was opened. */
  dirty: boolean;
  /** Prevents apply during another draft, stale authority or lifecycle work. */
  blocked: boolean;
  /** Accessible explanation of a rejected operation or navigation attempt. */
  notice: string;
  /** Applies the complete staged master change through the live project transaction. */
  onApply: () => void;
  /** Discards only this isolated master editing session. */
  onDiscard: () => void;
}>) {
  return (
    <section aria-label="Master draft" className={styles.banner} data-master-draft>
      <div className={styles.copy}>
        <strong>Editing master · {name}</strong>
        <span>
          {dirty ? "Unapplied changes" : "Definition defaults"} · Use the same design tools. Apply
          updates linked instances; local overrides stay intact.
        </span>
        <span aria-live="polite" role="status">
          {notice ||
            "Save, Run, Publish and page navigation are unavailable until you apply or discard this draft."}
        </span>
      </div>
      <button type="button" disabled={blocked} onClick={onApply}>
        Apply master changes
      </button>
      <button type="button" onClick={onDiscard}>
        Discard master draft
      </button>
    </section>
  );
}
