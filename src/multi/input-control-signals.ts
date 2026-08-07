import type { SignalBag } from "../shared/dsl";
import type {
  NormalizedInputControl,
  NormalizedLabel,
} from "./normalized-types";
import { hasUsableAssociatedLabel } from "./evaluators/input-controls";

// Signals exposed to DSL rules with appliesTo: ["InputControl"].
// Absent optional facts are normalized to "" / false so comparisons stay
// known rather than falling into the DSL's "unknown" state.
export function makeInputControlSignals(
  control: NormalizedInputControl,
  labels: NormalizedLabel[],
  filename: string,
): SignalBag {
  const hasVisibleLabel =
    Boolean(control.labelProp?.trim()) ||
    hasUsableAssociatedLabel(control, labels);

  return {
    "input.kind": control.kind,
    "input.componentName": control.componentName ?? "",
    "input.inputType": control.inputType ?? "",
    "input.name": control.name ?? "",
    "input.id": control.id ?? "",
    "input.placeholder": control.placeholder ?? "",
    "input.hasPlaceholder": Boolean(control.placeholder?.trim()),
    "input.ariaLabel": control.ariaLabel ?? "",
    "input.hasAriaLabel": Boolean(control.ariaLabel?.trim()),
    "input.hasVisibleLabel": hasVisibleLabel,
    "input.isWrappedByLabel": control.isWrappedByLabel,
    "input.isDefaultSelected": control.isDefaultSelected,
    "file.path": filename,
  };
}
