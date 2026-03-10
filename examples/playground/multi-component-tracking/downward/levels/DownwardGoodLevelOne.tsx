import { HierarchyCard } from "../../shared/HierarchyCard";
import { DownwardGoodLevelTwo } from "./DownwardGoodLevelTwo";
import type { DownwardFlowProps } from "../types";

export function DownwardGoodLevelOne(props: DownwardFlowProps) {
  return (
    <HierarchyCard title="Level 1: Page Shell">
      <DownwardGoodLevelTwo {...props} />
    </HierarchyCard>
  );
}
