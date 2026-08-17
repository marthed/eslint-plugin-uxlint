import type { SignalBag } from "../shared/dsl";
import type { NormalizedSplitButton } from "./normalized-types";
import { getJSXName } from "../shared/jsx-helpers";

// Signals exposed to DSL rules with appliesTo: ["SplitButton"].
// Absent optional facts are normalized to "" / false so comparisons stay
// known rather than falling into the DSL's "unknown" state.
export function makeSplitButtonSignals(
  splitButton: NormalizedSplitButton,
  filename: string,
): SignalBag {
  return {
    "splitButton.componentName":
      splitButton.componentName ??
      getJSXName(splitButton.node?.openingElement) ??
      "",
    "splitButton.hasPrimaryAction": splitButton.hasPrimaryAction,
    "splitButton.navigatesToRoute": splitButton.navigatesToRoute,
    "file.path": filename,
  };
}
