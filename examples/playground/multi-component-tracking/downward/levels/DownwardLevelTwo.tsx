import { HierarchyCard } from "../../shared/HierarchyCard";
import { DownwardLevelThree } from "./DownwardLevelThree";
import type { DownwardFlowProps } from "../types";

export function DownwardLevelTwo(props: DownwardFlowProps) {
  return (
    <HierarchyCard title="Level 2: Feature Panel">
      <DownwardLevelThree {...props} />
    </HierarchyCard>
  );
}
