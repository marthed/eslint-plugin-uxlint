import { HierarchyCard } from "../../shared/HierarchyCard";
import { UpwardLevelTwo } from "./UpwardLevelTwo";
import type { UpwardFlowProps } from "../types";

export function UpwardLevelOne({ onAction }: UpwardFlowProps) {
  function handleAction(actionLabel: string) {
    onAction(`Level 1 > ${actionLabel}`);
  }

  return (
    <HierarchyCard
      title="Level 1: Parent Section"
      borderColor="#d1dff3"
      background="#f8fbff"
    >
      <UpwardLevelTwo onAction={handleAction} />
    </HierarchyCard>
  );
}
