import { HierarchyCard } from "../../shared/HierarchyCard";
import type { UpwardGoodLeafProps } from "../types";

export function UpwardGoodLevelFour({
  onApprove,
  onReject,
  totalActions,
  latestAction,
}: UpwardGoodLeafProps) {
  return (
    <HierarchyCard
      title="Level 4: Leaf Button Cluster"
      borderColor="#d1dff3"
      background="#f8fbff"
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={onApprove}>
          Approve
        </button>
        <button type="button" onClick={onReject}>
          Reject
        </button>
      </div>

      <div>Total actions: {totalActions}</div>
      <div>Latest action: {latestAction}</div>
    </HierarchyCard>
  );
}
