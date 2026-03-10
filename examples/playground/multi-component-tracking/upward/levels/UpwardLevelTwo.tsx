import { HierarchyCard } from "../../shared/HierarchyCard";
import { UpwardLevelThree } from "./UpwardLevelThree";
import type { UpwardFlowProps } from "../types";

export function UpwardLevelTwo({ onAction }: UpwardFlowProps) {
  function handleAction(actionLabel: string) {
    onAction(`Level 2 > ${actionLabel}`);
  }

  return (
    <HierarchyCard
      title="Level 2: Nested Layout"
      borderColor="#d1dff3"
      background="#f8fbff"
    >
      <UpwardLevelThree onAction={handleAction} />
    </HierarchyCard>
  );
}
