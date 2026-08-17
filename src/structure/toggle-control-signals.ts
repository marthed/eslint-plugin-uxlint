import type { SignalBag } from "../shared/dsl";
import type {
  NormalizedForm,
  NormalizedToggleControl,
} from "./normalized-types";
import { getJSXName } from "./collectors/jsx-helpers";

// Signals exposed to DSL rules with appliesTo: ["ToggleControl"].
// Absent optional facts are normalized to "" / false so comparisons stay
// known rather than falling into the DSL's "unknown" state. The one
// deliberate exception is `toggle.boundValueShape`, where "unknown" is a
// value a rule can match on: it means the bound value could not be
// classified, which is exactly what a fail-safe rule wants to test for.
export function makeToggleControlSignals(
  toggle: NormalizedToggleControl,
  forms: NormalizedForm[],
  filename: string,
): SignalBag {
  const form = toggle.formId
    ? forms.find((candidate) => candidate.id === toggle.formId)
    : undefined;

  return {
    "toggle.componentName": getJSXName(toggle.node?.openingElement) ?? "",
    "toggle.boundValueShape": toggle.boundValueShape,
    "toggle.isBooleanBound": toggle.boundValueShape === "boolean",
    "toggle.controlsConditionalRender": toggle.controlsConditionalRender,
    "toggle.isInsideForm": Boolean(form),
    "toggle.isInsideSubmitForm": Boolean(
      form && form.submitControls.length > 0,
    ),
    "file.path": filename,
  };
}
