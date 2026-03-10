import { HierarchyCard } from "../../shared/HierarchyCard";
import type { UpwardGoodFlowProps } from "../types";
import { UpwardGoodLevelThree } from "./UpwardGoodLevelThree";

export function UpwardGoodLevelTwo({
  onAction,
  totalActions,
  latestAction,
}: UpwardGoodFlowProps) {
  function handleAction(actionLabel: string) {
    onAction(`Level 2 > ${actionLabel}`);
  }

  return (
    <HierarchyCard
      title="Level 2: Nested Layout"
      borderColor="#d1dff3"
      background="#f8fbff"
    >
      <UpwardGoodLevelThree
        onAction={handleAction}
        totalActions={totalActions}
        latestAction={latestAction}
      />
    </HierarchyCard>
  );
}
