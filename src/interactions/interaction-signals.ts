import type { SignalBag } from "../shared/dsl";
import type { InteractionFact } from "./evaluators/interaction-feedback";

// Signals exposed to DSL rules with appliesTo: ["Interaction"].
export function makeInteractionSignals(
  fact: InteractionFact,
  filename: string,
): SignalBag {
  return {
    "interaction.eventName": fact.eventName,
    "interaction.elementName": fact.elementName,
    "interaction.componentName": fact.componentName,
    "interaction.label": fact.label,
    "interaction.isAsync": fact.isAsync,
    "interaction.writesState": fact.writesState,
    "interaction.hasVisibleFeedback": fact.hasVisibleFeedback,
    "interaction.hasStartFeedback": fact.visiblePhases.has("start"),
    "interaction.hasSettledFeedback": fact.visiblePhases.has("settled"),
    "interaction.hasErrorFeedback": fact.visiblePhases.has("error"),
    "interaction.hasSuccessFeedback": fact.visiblePhases.has("success"),
    "file.path": filename,
  };
}
