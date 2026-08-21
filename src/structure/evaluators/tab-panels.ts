import type { UnmountedPanelFact } from "../collectors/jsx-tab-panels";

export type TabPanelFinding = {
  node: any;
  message: string;
};

export function evaluateUnmountedTabPanels(
  facts: UnmountedPanelFact[],
): TabPanelFinding[] {
  return facts.map((fact) => ({
    node: fact.node,
    message:
      "[TABS-UNMOUNT-001] Tab panel is unmounted when it is not the active tab, " +
      "so switching away discards anything typed into it and puts its text beyond find-in-page. " +
      "Keep it mounted and use `hidden` instead.",
  }));
}
