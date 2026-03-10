import { HierarchyCard } from "../../shared/HierarchyCard";
import type { UpwardGoodFlowProps } from "../types";
import { UpwardGoodLevelFour } from "./UpwardGoodLevelFour";

export function UpwardGoodLevelThree({
  onAction,
  totalActions,
  latestAction,
}: UpwardGoodFlowProps) {
  function handleApprove() {
    onAction("Level 3 > Approve");
  }

  function handleReject() {
    onAction("Level 3 > Reject");
  }

  return (
    <HierarchyCard
      title="Level 3: Action Wrapper"
      borderColor="#d1dff3"
      background="#f8fbff"
    >
      <UpwardGoodLevelFour
        onApprove={handleApprove}
        onReject={handleReject}
        totalActions={totalActions}
        latestAction={latestAction}
      />
    </HierarchyCard>
  );
}
