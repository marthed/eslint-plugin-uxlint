import { HierarchyCard } from "../../shared/HierarchyCard";
import type { DownwardFlowProps } from "../types";

export function DownwardLevelFour({
  onSaveSuccess,
  onSaveFailure,
}: DownwardFlowProps) {
  return (
    <HierarchyCard title="Level 4: Leaf Control">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={onSaveSuccess}>
          Save (Success)
        </button>
        <button type="button" onClick={onSaveFailure}>
          Save (Fail)
        </button>
      </div>

      <div style={{ color: "#666" }}>
        No visible status feedback is rendered in this hierarchy.
      </div>
    </HierarchyCard>
  );
}
