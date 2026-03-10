import { HierarchyCard } from "../../shared/HierarchyCard";
import { DownwardLevelTwo } from "./DownwardLevelTwo";
import type { DownwardFlowProps } from "../types";

export function DownwardLevelOne(props: DownwardFlowProps) {
  return (
    <HierarchyCard title="Level 1: Page Shell">
      <DownwardLevelTwo {...props} />
    </HierarchyCard>
  );
}
