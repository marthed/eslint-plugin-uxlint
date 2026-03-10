import { HierarchyCard } from "../../shared/HierarchyCard";
import { UpwardLevelFour } from "./UpwardLevelFour";
import type { UpwardFlowProps } from "../types";

export function UpwardLevelThree({ onAction }: UpwardFlowProps) {
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
      <UpwardLevelFour onApprove={handleApprove} onReject={handleReject} />
    </HierarchyCard>
  );
}
