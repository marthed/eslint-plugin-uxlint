import type { NormalizedSplitButton } from "../normalized-types";

export type StructureFinding = {
  node: any;
  message: string;
};

const INPUT_SPLIT_001_MESSAGE =
  "[INPUT-SPLIT-001] Split buttons should expose a default action, not just a menu.";
const INPUT_SPLIT_002_MESSAGE =
  "[INPUT-SPLIT-002] Split buttons are better for commands than page navigation; prefer a menu or dropdown for navigation.";

export function evaluateSplitButtons(
  splitButtons: NormalizedSplitButton[],
): StructureFinding[] {
  const findings: StructureFinding[] = [];

  for (const splitButton of splitButtons) {
    if (!splitButton.hasPrimaryAction) {
      findings.push({
        node: splitButton.node,
        message: INPUT_SPLIT_001_MESSAGE,
      });
    }

    if (splitButton.navigatesToRoute) {
      findings.push({
        node: splitButton.node,
        message: INPUT_SPLIT_002_MESSAGE,
      });
    }
  }

  return findings;
}
