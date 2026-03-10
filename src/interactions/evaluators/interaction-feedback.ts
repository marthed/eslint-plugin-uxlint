import { InteractionStore } from "../store";
import type {
  ComponentStateModel,
  InteractionHandler,
  InteractionPhase,
  PropRead,
  StateRead,
} from "../types";

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
]);

const VISIBLE_PROP_READ_KINDS = new Set<PropRead["kind"]>([
  "disabled-prop",
  "loading-prop",
  "conditional-render",
  "ternary-render",
  "generic-visible-read",
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

function hasDirectVisibleStateRead(
  component: ComponentStateModel,
  stateVar: string,
): boolean {
  return component.stateReads.some(
    (stateRead) =>
      stateRead.stateVar === stateVar && VISIBLE_READ_KINDS.has(stateRead.kind),
  );
}

function hasVisibleChildPropRead(
  component: ComponentStateModel,
  stateVar: string,
  componentsByName: Map<string, ComponentStateModel>,
): boolean {
  const relevantPasses = component.statePropPasses.filter(
    (statePropPass) => statePropPass.stateVar === stateVar,
  );
  if (relevantPasses.length === 0) return false;

  for (const statePropPass of relevantPasses) {
    const childComponent = componentsByName.get(statePropPass.childComponentName);
    if (!childComponent) {
      // Unknown child components may live in other files; treat prop handoff as visible.
      return true;
    }

    const hasVisiblePropRead = childComponent.propReads.some(
      (propRead) =>
        propRead.propName === statePropPass.propName &&
        VISIBLE_PROP_READ_KINDS.has(propRead.kind),
    );
    if (hasVisiblePropRead) return true;
  }

  return false;
}

export function evaluateInteractionFeedback(
  store: InteractionStore,
): InteractionFinding[] {
  const findings: InteractionFinding[] = [];
  const components = store.getComponents();
  const componentsByName = new Map(
    components.map((component) => [component.componentName, component]),
  );

  for (const component of components) {
    for (const interaction of component.interactions) {
      const handler = resolveInteractionHandler(component.handlers, interaction);
      if (!handler) continue;

      const writesForHandler = component.stateWrites.filter(
        (stateWrite) => stateWrite.handlerId === handler.id,
      );
      const visibleWrites = writesForHandler.filter(
        (stateWrite) =>
          hasDirectVisibleStateRead(component, stateWrite.stateVar) ||
          hasVisibleChildPropRead(component, stateWrite.stateVar, componentsByName),
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
