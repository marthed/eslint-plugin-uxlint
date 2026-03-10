import { InteractionStore } from "../store";
import type { InteractionHandler, InteractionPhase, StateRead } from "../types";

export type InteractionFinding = {
  node: any;
  message: string;
};

const VISIBLE_READ_KINDS = new Set<StateRead["kind"]>([
  "disabled-prop",
  "loading-prop",
  "conditional-render",
  "ternary-render",
  "generic-visible-read",
  "prop-passed",
]);

const REQUIRED_ASYNC_PHASE_REQUIREMENTS: Array<{
  phase: InteractionPhase;
  ruleId: string;
  message: string;
}> = [
  {
    phase: "start",
    ruleId: "INTERACTION-ASYNC-START-001",
    message:
      "Async interaction has no detectable visible feedback when work starts (pending).",
  },
  {
    phase: "settled",
    ruleId: "INTERACTION-ASYNC-SETTLED-001",
    message:
      "Async interaction has no detectable visible feedback when work settles (pending clears).",
  },
  {
    phase: "error",
    ruleId: "INTERACTION-ASYNC-ERROR-001",
    message:
      "Async interaction has no detectable visible feedback for error outcomes.",
  },
  {
    phase: "success",
    ruleId: "INTERACTION-ASYNC-SUCCESS-001",
    message:
      "Async interaction has no detectable visible feedback for success outcomes.",
  },
];

function resolveInteractionHandler(
  handlers: InteractionHandler[],
  interaction: { handlerId?: string; handlerName?: string },
): InteractionHandler | undefined {
  if (interaction.handlerId) {
    const byId = handlers.find((handler) => handler.id === interaction.handlerId);
    if (byId) return byId;
  }

  if (interaction.handlerName) {
    const byName = handlers.find((handler) => handler.name === interaction.handlerName);
    if (byName) return byName;
  }

  return undefined;
}

function getAsyncPhaseCoverage(phases: InteractionPhase[]): Set<InteractionPhase> {
  return new Set<InteractionPhase>(phases);
}

export function evaluateInteractionFeedback(
  store: InteractionStore,
): InteractionFinding[] {
  const findings: InteractionFinding[] = [];

  for (const component of store.getComponents()) {
    for (const interaction of component.interactions) {
      const handler = resolveInteractionHandler(component.handlers, interaction);
      if (!handler) continue;

      const writesForHandler = component.stateWrites.filter(
        (stateWrite) => stateWrite.handlerId === handler.id,
      );
      const visibleWrites = writesForHandler.filter((stateWrite) =>
        component.stateReads.some(
          (stateRead) =>
            stateRead.stateVar === stateWrite.stateVar &&
            VISIBLE_READ_KINDS.has(stateRead.kind),
        ),
      );

      if (!handler.isAsync) {
        if (visibleWrites.length > 0) continue;
        findings.push({
          node: interaction.node,
          message:
            "[INTERACTION-SYNC-001] Interaction has no detectable visible feedback. " +
            "No component state written by this handler appears to be visibly rendered.",
        });
        continue;
      }

      const phaseCoverage = getAsyncPhaseCoverage(
        visibleWrites.map((stateWrite) => stateWrite.phase),
      );
      for (const requirement of REQUIRED_ASYNC_PHASE_REQUIREMENTS) {
        if (phaseCoverage.has(requirement.phase)) continue;
        findings.push({
          node: interaction.node,
          message: `[${requirement.ruleId}] ${requirement.message}`,
        });
      }
    }
  }

  return findings;
}
