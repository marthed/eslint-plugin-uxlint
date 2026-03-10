import { HierarchyCard } from "../../shared/HierarchyCard";
import { DownwardGoodLevelThree } from "./DownwardGoodLevelThree";
import type { DownwardFlowProps } from "../types";

export function DownwardGoodLevelTwo(props: DownwardFlowProps) {
  return (
    <HierarchyCard title="Level 2: Feature Panel">
      <DownwardGoodLevelThree {...props} />
    </HierarchyCard>
  );
}
