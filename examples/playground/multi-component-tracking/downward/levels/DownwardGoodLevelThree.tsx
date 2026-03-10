import { HierarchyCard } from "../../shared/HierarchyCard";
import { DownwardGoodLevelFour } from "./DownwardGoodLevelFour";
import type { DownwardFlowProps } from "../types";

export function DownwardGoodLevelThree(props: DownwardFlowProps) {
  return (
    <HierarchyCard title="Level 3: Action Group">
      <DownwardGoodLevelFour {...props} />
    </HierarchyCard>
  );
}
