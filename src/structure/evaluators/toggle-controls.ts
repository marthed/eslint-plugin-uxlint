import type {
  NormalizedForm,
  NormalizedToggleControl,
} from "../normalized-types";

export type StructureFinding = {
  node: any;
  message: string;
};

const INPUT_TOGGLE_001_MESSAGE =
  "[INPUT-TOGGLE-001] Toggle switches should represent only two opposing states.";
const INPUT_TOGGLE_002_MESSAGE =
  "[INPUT-TOGGLE-002] Toggle switches should take immediate effect; if changes are deferred, prefer a checkbox or radio buttons.";

function evaluateNonBinaryToggles(
  toggles: NormalizedToggleControl[],
): StructureFinding[] {
  return toggles
    .filter((toggle) => toggle.boundValueShape === "non-boolean")
    .map((toggle) => ({
      node: toggle.node,
      message: INPUT_TOGGLE_001_MESSAGE,
    }));
}

function evaluateDeferredToggles(
  toggles: NormalizedToggleControl[],
  forms: NormalizedForm[],
): StructureFinding[] {
  const formsById = new Map(forms.map((form) => [form.id, form]));

  return toggles
    .filter((toggle) => {
      if (!toggle.formId) return false;
      // Progressive disclosure: the switch already takes effect immediately
      // by changing what the form shows.
      if (toggle.controlsConditionalRender) return false;
      const form = formsById.get(toggle.formId);
      return Boolean(form && form.submitControls.length > 0);
    })
    .map((toggle) => ({
      node: toggle.node,
      message: INPUT_TOGGLE_002_MESSAGE,
    }));
}

export function evaluateToggleControls(
  toggles: NormalizedToggleControl[],
  forms: NormalizedForm[],
): StructureFinding[] {
  return [
    ...evaluateNonBinaryToggles(toggles),
    ...evaluateDeferredToggles(toggles, forms),
  ];
}
