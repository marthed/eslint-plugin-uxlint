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

type ResolvedInteractionHandler = {
  component: ComponentStateModel;
  handler: InteractionHandler;
};

type ParentHandlerBinding = {
  parentComponentName: string;
  handlerId?: string;
  handlerName?: string;
};

type ParentPropLink = {
  parentComponentName: string;
  sourcePropName: string;
};

type PropResolutionOptions = {
  componentsByName: Map<string, ComponentStateModel>;
  parentHandlerBindingsByChildProp: Map<string, ParentHandlerBinding[]>;
  parentPropLinksByChildProp: Map<string, ParentPropLink[]>;
  spreadParentComponentsByChild: Map<string, string[]>;
};

function resolveInteractionHandler(
  handlers: InteractionHandler[],
  interaction: { handlerId?: string; handlerName?: string },
): InteractionHandler | undefined {
  if (interaction.handlerId) {
    const byId = handlers.find(
      (handler) => handler.id === interaction.handlerId,
    );
    if (byId) return byId;
  }

  if (interaction.handlerName) {
    const byName = handlers.find(
      (handler) => handler.name === interaction.handlerName,
    );
    if (byName) return byName;
  }

  return undefined;
}

function makeChildPropKey(componentName: string, propName: string): string {
  return `${componentName}::${propName}`;
}

function indexParentHandlerBindings(
  components: ComponentStateModel[],
): Map<string, ParentHandlerBinding[]> {
  const bindingsByChildProp = new Map<string, ParentHandlerBinding[]>();

  for (const parentComponent of components) {
    for (const pass of parentComponent.handlerPropPasses) {
      const key = makeChildPropKey(pass.childComponentName, pass.childPropName);
      const existing = bindingsByChildProp.get(key) ?? [];
      existing.push({
        parentComponentName: parentComponent.componentName,
        handlerId: pass.handlerId,
        handlerName: pass.handlerName,
      });
      bindingsByChildProp.set(key, existing);
    }
  }

  return bindingsByChildProp;
}

function indexParentPropLinks(
  components: ComponentStateModel[],
): Map<string, ParentPropLink[]> {
  const linksByChildProp = new Map<string, ParentPropLink[]>();

  for (const parentComponent of components) {
    for (const pass of parentComponent.propPasses) {
      const key = makeChildPropKey(pass.childComponentName, pass.childPropName);
      const existing = linksByChildProp.get(key) ?? [];
      existing.push({
        parentComponentName: parentComponent.componentName,
        sourcePropName: pass.sourcePropName,
      });
      linksByChildProp.set(key, existing);
    }
  }

  return linksByChildProp;
}

function indexSpreadParentComponents(
  components: ComponentStateModel[],
): Map<string, string[]> {
  const parentComponentsByChild = new Map<string, string[]>();

  for (const parentComponent of components) {
    for (const pass of parentComponent.propSpreadPasses) {
      const existing = parentComponentsByChild.get(pass.childComponentName) ?? [];
      existing.push(parentComponent.componentName);
      parentComponentsByChild.set(pass.childComponentName, existing);
    }
  }

  return parentComponentsByChild;
}

function resolveHandlersForProp(
  componentName: string,
  propName: string,
  options: PropResolutionOptions,
): ResolvedInteractionHandler[] {
  const queue: Array<{ componentName: string; propName: string }> = [
    { componentName, propName },
  ];
  const visited = new Set<string>();
  const resolved = new Map<string, ResolvedInteractionHandler>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const currentKey = makeChildPropKey(current.componentName, current.propName);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    for (const binding of options.parentHandlerBindingsByChildProp.get(
      currentKey,
    ) ?? []) {
      const parentComponent = options.componentsByName.get(
        binding.parentComponentName,
      );
      if (!parentComponent) continue;

      const handler = resolveInteractionHandler(parentComponent.handlers, {
        handlerId: binding.handlerId,
        handlerName: binding.handlerName,
      });
      if (!handler) continue;

      const resolvedKey = `${parentComponent.componentName}::${handler.id}`;
      if (resolved.has(resolvedKey)) continue;
      resolved.set(resolvedKey, {
        component: parentComponent,
        handler,
      });
    }

    for (const link of options.parentPropLinksByChildProp.get(currentKey) ??
      []) {
      queue.push({
        componentName: link.parentComponentName,
        propName: link.sourcePropName,
      });
    }

    for (const parentComponentName of options.spreadParentComponentsByChild.get(
      current.componentName,
    ) ?? []) {
      queue.push({
        componentName: parentComponentName,
        propName: current.propName,
      });
    }
  }

  return [...resolved.values()];
}

function resolveInteractionHandlers(
  component: ComponentStateModel,
  interaction: { handlerId?: string; handlerName?: string },
  options: PropResolutionOptions,
): ResolvedInteractionHandler[] {
  const directHandler = resolveInteractionHandler(component.handlers, interaction);
  if (directHandler) {
    return [{ component, handler: directHandler }];
  }

  if (!interaction.handlerName) return [];

  return resolveHandlersForProp(
    component.componentName,
    interaction.handlerName,
    options,
  );
}

function expandResolvedHandlers(
  initialHandlers: ResolvedInteractionHandler[],
  options: PropResolutionOptions,
): ResolvedInteractionHandler[] {
  const queue = [...initialHandlers];
  const expanded = new Map<string, ResolvedInteractionHandler>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const currentKey = `${current.component.componentName}::${current.handler.id}`;
    if (expanded.has(currentKey)) continue;
    expanded.set(currentKey, current);

    const propCalls = current.component.handlerPropCalls.filter(
      (propCall) => propCall.handlerId === current.handler.id,
    );

    for (const propCall of propCalls) {
      queue.push(
        ...resolveHandlersForProp(
          current.component.componentName,
          propCall.propName,
          options,
        ),
      );
    }
  }

  return [...expanded.values()];
}

function getAsyncPhaseCoverage(
  phases: InteractionPhase[],
): Set<InteractionPhase> {
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
  const pendingProps: Array<{ componentName: string; propName: string }> = [];
  const visited = new Set<string>();

  for (const statePropPass of component.statePropPasses) {
    if (statePropPass.stateVar !== stateVar) continue;
    pendingProps.push({
      componentName: statePropPass.childComponentName,
      propName: statePropPass.propName,
    });
  }

  while (pendingProps.length > 0) {
    const current = pendingProps.shift();
    if (!current) continue;

    const key = makeChildPropKey(current.componentName, current.propName);
    if (visited.has(key)) continue;
    visited.add(key);

    const childComponent = componentsByName.get(current.componentName);
    if (!childComponent) {
      // Unknown child components may live in other files; treat prop handoff as visible.
      return true;
    }

    const hasVisiblePropRead = childComponent.propReads.some(
      (propRead) =>
        propRead.propName === current.propName &&
        VISIBLE_PROP_READ_KINDS.has(propRead.kind),
    );
    if (hasVisiblePropRead) return true;

    for (const propPass of childComponent.propPasses) {
      if (propPass.sourcePropName !== current.propName) continue;
      pendingProps.push({
        componentName: propPass.childComponentName,
        propName: propPass.childPropName,
      });
    }

    for (const spreadPass of childComponent.propSpreadPasses) {
      pendingProps.push({
        componentName: spreadPass.childComponentName,
        propName: current.propName,
      });
    }
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
  const resolutionOptions: PropResolutionOptions = {
    componentsByName,
    parentHandlerBindingsByChildProp: indexParentHandlerBindings(components),
    parentPropLinksByChildProp: indexParentPropLinks(components),
    spreadParentComponentsByChild: indexSpreadParentComponents(components),
  };

  for (const component of components) {
    for (const interaction of component.interactions) {
      const resolvedHandlers = expandResolvedHandlers(
        resolveInteractionHandlers(component, interaction, resolutionOptions),
        resolutionOptions,
      );
      if (resolvedHandlers.length === 0) continue;

      const writesForInteraction = resolvedHandlers.flatMap(
        ({ component: handlerComponent, handler }) =>
          handlerComponent.stateWrites
            .filter((stateWrite) => stateWrite.handlerId === handler.id)
            .map((stateWrite) => ({ component: handlerComponent, stateWrite })),
      );
      if (writesForInteraction.length === 0) continue;

      const isAsyncInteraction =
        resolvedHandlers.some(({ handler }) => handler.isAsync) ||
        writesForInteraction.some(
          ({ stateWrite }) => stateWrite.phase !== "sync",
        );
      const visibleWrites = writesForInteraction
        .filter(
          ({ component: handlerComponent, stateWrite }) =>
            hasDirectVisibleStateRead(handlerComponent, stateWrite.stateVar) ||
            hasVisibleChildPropRead(
              handlerComponent,
              stateWrite.stateVar,
              componentsByName,
            ),
        )
        .map(({ stateWrite }) => stateWrite);
      const reportNode =
        writesForInteraction.some(
          ({ component: handlerComponent }) => handlerComponent === component,
        )
          ? interaction.node
          : resolvedHandlers.find(({ component: handlerComponent, handler }) =>
              handlerComponent.stateWrites.some(
                (stateWrite) => stateWrite.handlerId === handler.id,
              ),
            )?.handler.node ?? interaction.node;

      if (!isAsyncInteraction) {
        if (visibleWrites.length > 0) continue;
        findings.push({
          node: reportNode,
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
          node: reportNode,
          message: `[${requirement.ruleId}] ${requirement.message}`,
        });
      }
    }
  }

  return findings;
}
