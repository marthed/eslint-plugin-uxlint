import { HierarchyCard } from "../../shared/HierarchyCard";
import type { UpwardGoodFlowProps } from "../types";
import { UpwardGoodLevelTwo } from "./UpwardGoodLevelTwo";

export function UpwardGoodLevelOne({
  onAction,
  totalActions,
  latestAction,
}: UpwardGoodFlowProps) {
  function handleAction(actionLabel: string) {
    onAction(`Level 1 > ${actionLabel}`);
  }

  return (
    <HierarchyCard
      title="Level 1: Parent Section"
      borderColor="#d1dff3"
      background="#f8fbff"
    >
      <UpwardGoodLevelTwo
        onAction={handleAction}
        totalActions={totalActions}
        latestAction={latestAction}
      />
    </HierarchyCard>
  );
}
