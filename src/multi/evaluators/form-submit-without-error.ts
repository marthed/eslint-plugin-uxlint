import type { NormalizedForm } from "../normalized-types";
import type { InteractionFact } from "../../interactions/evaluators/interaction-feedback";

export type MultiNodeFinding = {
  node: any;
  message: string;
};

function isWithinNode(containerNode: any, node: any): boolean {
  if (!Array.isArray(containerNode?.range) || !Array.isArray(node?.range)) {
    return false;
  }

  return (
    node.range[0] >= containerNode.range[0] &&
    node.range[1] <= containerNode.range[1]
  );
}

function submitHandlerShowsErrorFeedback(
  form: NormalizedForm,
  interactionFacts: InteractionFact[],
): boolean {
  return interactionFacts.some((fact) => {
    if (fact.eventName !== "onSubmit") return false;

    const matchesForm =
      form.node?.openingElement === fact.sourceNode ||
      isWithinNode(form.node, fact.sourceNode);
    if (!matchesForm) return false;

    if (fact.isAsync) return fact.visiblePhases.has("error");
    return fact.hasVisibleFeedback;
  });
}

export function evaluateFormHasSubmitButNoErrorState(
  forms: NormalizedForm[],
  interactionFacts: InteractionFact[] = [],
): MultiNodeFinding[] {
  const findings: MultiNodeFinding[] = [];

  for (const form of forms) {
    const hasSubmit = form.submitControls.length > 0;
    const hasErrorState = form.errorIndicators.length > 0;

    if (!hasSubmit || hasErrorState) continue;
    if (submitHandlerShowsErrorFeedback(form, interactionFacts)) continue;

    findings.push({
      node: form.node,
      message:
        "[FORM-MULTI-001] Form has a submit action but no detectable error state. " +
        'Add inline field errors, an error summary, role="alert", aria-live, or a design-system error component.',
    });
  }

  return findings;
}
