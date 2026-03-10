import { HierarchyCard } from "../../shared/HierarchyCard";
import { DownwardLevelFour } from "./DownwardLevelFour";
import type { DownwardFlowProps } from "../types";

export function DownwardLevelThree(props: DownwardFlowProps) {
  return (
    <HierarchyCard title="Level 3: Action Group">
      <DownwardLevelFour {...props} />
    </HierarchyCard>
  );
}
