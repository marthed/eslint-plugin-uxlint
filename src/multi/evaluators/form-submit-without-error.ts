import type { NormalizedForm } from "../normalized-types";

export type MultiNodeFinding = {
  node: any;
  message: string;
};

export function evaluateFormHasSubmitButNoErrorState(forms: NormalizedForm[]): MultiNodeFinding[] {
  const findings: MultiNodeFinding[] = [];

  for (const form of forms) {
    const hasSubmit = form.submitControls.length > 0;
    const hasErrorState = form.errorIndicators.length > 0;

    if (hasSubmit && !hasErrorState) {
      findings.push({
        node: form.node,
        message:
          "[FORM-MULTI-001] Form has a submit action but no detectable error state. " +
          "Add inline field errors, an error summary, role=\"alert\", aria-live, or a design-system error component.",
      });
    }
  }

  return findings;
}