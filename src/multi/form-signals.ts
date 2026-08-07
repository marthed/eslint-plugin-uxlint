import type { SignalBag } from "../shared/dsl";
import type { NormalizedForm } from "./normalized-types";

// Signals exposed to DSL rules with appliesTo: ["Form"].
export function makeFormSignals(
  form: NormalizedForm,
  filename: string,
): SignalBag {
  return {
    "form.source": form.source,
    "form.framework": form.framework,
    "form.hasSubmitControl": form.submitControls.length > 0,
    "form.hasErrorIndicator": form.errorIndicators.length > 0,
    "form.fieldCount": form.fields.length,
    "form.submitControlCount": form.submitControls.length,
    "file.path": filename,
  };
}
