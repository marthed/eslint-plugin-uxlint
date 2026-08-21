import { InteractionStore } from "../store";
import {
  DELEGATED_FEEDBACK_STATE_VAR,
  IMPERATIVE_FEEDBACK_STATE_VAR,
  NAVIGATION_FEEDBACK_STATE_VAR,
} from "../types";
import { collectStateReferenceNames } from "../collectors/reference-names";
import type {
  ComponentStateModel,
  InteractionHandler,
  InteractionPhase,
  PropRead,
  StateRead,
  StateWrite,
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
      const existing =
        parentComponentsByChild.get(pass.childComponentName) ?? [];
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

    const currentKey = makeChildPropKey(
      current.componentName,
      current.propName,
    );
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
  const directHandler = resolveInteractionHandler(
    component.handlers,
    interaction,
  );
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

// An optimistic update is a start-phase write whose new value is derived from
// the state it replaces -- setLikes(likes + 1), setItems([...items, item]),
// setLiked(!liked), or a functional updater. That self-reference is what
// separates "show the result before it is confirmed" from merely recording an
// argument (setQuery(value)) or raising a pending flag (setIsSaving(true)).
function isOptimisticWrite(stateWrite: StateWrite): boolean {
  if (stateWrite.phase !== "start") return false;
  if (stateWrite.stateVar.startsWith("<")) return false;

  const argument = stateWrite.node?.arguments?.[0];
  if (!argument) return false;

  // A functional updater is self-referential by construction.
  if (
    argument.type === "ArrowFunctionExpression" ||
    argument.type === "FunctionExpression"
  ) {
    return true;
  }

  return (
    collectStateReferenceNames(argument, new Set([stateWrite.stateVar]))
      .length > 0
  );
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

export type InteractionFact = {
  node: any;
  sourceNode: any;
  eventName: string;
  elementName: string;
  componentName: string;
  label: string;
  isAsync: boolean;
  writesState: boolean;
  hasVisibleFeedback: boolean;
  visiblePhases: Set<InteractionPhase>;
  // Nodes of state changed before the request that nothing restores on failure.
  unrolledOptimisticWrites: any[];
};

// A handler that hands its outcome to a parent-supplied callback only counts
// as feedback when the parent cannot be found. When it can, that parent's own
// handlers are already pulled into scope by expandResolvedHandlers, so its
// feedback is judged directly — and its absence is a real finding.
function isUnresolvableDelegation(
  component: ComponentStateModel,
  stateWrite: StateWrite,
  options: PropResolutionOptions,
): boolean {
  if (stateWrite.stateVar !== DELEGATED_FEEDBACK_STATE_VAR) return false;
  return (
    resolveHandlersForProp(
      component.componentName,
      stateWrite.setterVar,
      options,
    ).length === 0
  );
}

export function collectInteractionFacts(
  store: InteractionStore,
): InteractionFact[] {
  const facts: InteractionFact[] = [];
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

      const isAsyncInteraction =
        resolvedHandlers.some(({ handler }) => handler.isAsync) ||
        writesForInteraction.some(
          ({ stateWrite }) => stateWrite.phase !== "sync",
        );
      const visibleWrites = writesForInteraction
        .filter(
          ({ component: handlerComponent, stateWrite }) =>
            stateWrite.stateVar === IMPERATIVE_FEEDBACK_STATE_VAR ||
            stateWrite.stateVar === NAVIGATION_FEEDBACK_STATE_VAR ||
            isUnresolvableDelegation(
              handlerComponent,
              stateWrite,
              resolutionOptions,
            ) ||
            hasDirectVisibleStateRead(handlerComponent, stateWrite.stateVar) ||
            hasVisibleChildPropRead(
              handlerComponent,
              stateWrite.stateVar,
              componentsByName,
            ),
        )
        .map(({ stateWrite }) => stateWrite);
      const reportNode = writesForInteraction.some(
        ({ component: handlerComponent }) => handlerComponent === component,
      )
        ? interaction.node
        : // Prefer a handler that writes real state. A pass-through component
          // only has delegated writes, and picking its node would report the
          // finding at a line in whichever file that component lives in.
          (resolvedHandlers.find(({ component: handlerComponent, handler }) =>
            handlerComponent.stateWrites.some(
              (stateWrite) =>
                stateWrite.handlerId === handler.id &&
                stateWrite.stateVar !== DELEGATED_FEEDBACK_STATE_VAR,
            ),
          )?.handler.node ?? interaction.node);

      facts.push({
        node: reportNode,
        sourceNode: interaction.node,
        eventName: interaction.eventName,
        elementName: interaction.componentName ?? "",
        componentName: component.componentName,
        label: interaction.label ?? "",
        isAsync: isAsyncInteraction,
        // Delegation alone is not state of this interaction's own: a handler
        // that only forwards to a parent callback stays out of scope, exactly
        // as it did before delegation was tracked.
        writesState: writesForInteraction.some(
          ({ stateWrite }) =>
            stateWrite.stateVar !== DELEGATED_FEEDBACK_STATE_VAR,
        ),
        hasVisibleFeedback: visibleWrites.length > 0,
        visiblePhases: getAsyncPhaseCoverage(
          visibleWrites.map((stateWrite) => stateWrite.phase),
        ),
        unrolledOptimisticWrites: isAsyncInteraction
          ? writesForInteraction
              .filter(
                ({ component: handlerComponent, stateWrite }) =>
                  isOptimisticWrite(stateWrite) &&
                  // Only matters if the user can see the changed value.
                  (hasDirectVisibleStateRead(
                    handlerComponent,
                    stateWrite.stateVar,
                  ) ||
                    hasVisibleChildPropRead(
                      handlerComponent,
                      stateWrite.stateVar,
                      componentsByName,
                    )) &&
                  // A write on either recovery path counts as restoring it.
                  !writesForInteraction.some(
                    ({ stateWrite: other }) =>
                      other.stateVar === stateWrite.stateVar &&
                      (other.phase === "error" || other.phase === "settled"),
                  ),
              )
              .map(({ stateWrite }) => stateWrite.node)
          : [],
      });
    }
  }

  return facts;
}

export function evaluateInteractionFactFindings(
  facts: InteractionFact[],
): InteractionFinding[] {
  const findings: InteractionFinding[] = [];

  for (const fact of facts) {
    if (!fact.writesState) continue;

    if (!fact.isAsync) {
      if (fact.hasVisibleFeedback) continue;
      findings.push({
        node: fact.node,
        message:
          "[INTERACTION-SYNC-001] Interaction has no detectable visible feedback. " +
          "No component state written by this handler appears to be visibly rendered.",
      });
      continue;
    }

    for (const node of fact.unrolledOptimisticWrites) {
      findings.push({
        node,
        message:
          "[INTERACTION-OPTIMISTIC-001] State is changed before the request and never restored when it fails. " +
          "Restore the previous value on the error path, or show the user that the change did not stick.",
      });
    }

    for (const requirement of REQUIRED_ASYNC_PHASE_REQUIREMENTS) {
      if (fact.visiblePhases.has(requirement.phase)) continue;

      // When no pending cue is ever shown there is nothing to clear; the
      // start finding already covers this interaction's pending problem.
      if (requirement.phase === "settled" && !fact.visiblePhases.has("start")) {
        continue;
      }

      findings.push({
        node: fact.node,
        message: `[${requirement.ruleId}] ${requirement.message}`,
      });
    }
  }

  return findings;
}

export function evaluateInteractionFeedback(
  store: InteractionStore,
): InteractionFinding[] {
  return evaluateInteractionFactFindings(collectInteractionFacts(store));
}
