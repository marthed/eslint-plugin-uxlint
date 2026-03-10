import { HierarchyCard } from "../../shared/HierarchyCard";
import type { DownwardFlowProps } from "../types";

export function DownwardGoodLevelFour({
  onSaveSuccess,
  onSaveFailure,
  isSaving,
  didSave,
  didFail,
}: DownwardFlowProps) {
  return (
    <HierarchyCard title="Level 4: Leaf Control">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={isSaving} onClick={onSaveSuccess}>
          Save (Success)
        </button>
        <button type="button" disabled={isSaving} onClick={onSaveFailure}>
          Save (Fail)
        </button>
      </div>

      <div>{isSaving ? "Saving..." : ""}</div>
      <div>{didSave && "Saved"}</div>
      <div>{didFail && "Failed"}</div>
    </HierarchyCard>
  );
}
