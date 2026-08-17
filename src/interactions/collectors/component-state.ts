// Entry point for interaction-lifecycle analysis. Walks each React
// component function, collects its state, handlers, writes, reads, and
// prop-flow facts (delegating to the sibling modules in this directory),
// and stores the result for the interaction-feedback evaluator.
//
// Multi-file tracing (when a filePath is given) additionally follows JSX
// children into their own files via the ProjectFunctionIndex, so a parent's
// interaction facts can be completed by a child component defined
// elsewhere in the project.

import path from "node:path";
import { InteractionStore } from "../store";
import {
  DEFAULT_FEEDBACK_FUNCTIONS,
  type ComponentVocabulary,
} from "../../shared/design-system";
import { DELEGATED_FEEDBACK_STATE_VAR } from "../types";
import type {
  HandlerPropCall,
  HandlerPropPass,
  InteractionHandler,
  PropPass,
  PropSpreadPass,
  PropRead,
  StatePair,
  StatePropPass,
  StateRead,
  StateWrite,
} from "../types";
import { getJSXName } from "../../shared/jsx-helpers";
import {
  isComponentJSXName,
  isReactComponentName,
  walkAst,
} from "./ast-helpers";
import {
  DEFAULT_MAX_HELPER_TRACE_DEPTH,
  createHelperFunctionResolver,
  type MultiFileTraceOptions,
} from "./helper-resolver";
import {
  ProjectFunctionIndex,
  type ParserLike,
} from "../tracing/project-index";
import { collectExternalStatusModel } from "./external-status-model";
import { collectStatePairsFromFunctionBody } from "./state-pairs";
import {
  classifyNodePhaseInHandler,
  collectStateWritesForHandler,
} from "./state-writes";
import {
  collectVisiblePropReads,
  collectVisibleStateReads,
} from "./visible-reads";
import {
  collectHandlerPropCalls,
  collectHandlerPropPasses,
  collectPropPasses,
  collectStatePropPasses,
} from "./prop-flow";
import {
  collectInteractionsAndInlineHandlers,
  collectNamedHandlers,
  type InteractionSourceFact,
} from "./handlers";

function getComponentModelInput(
  node: any,
): { componentName: string; functionNode: any } | null {
  if (node.type === "FunctionDeclaration" && node.id?.name) {
    if (!isReactComponentName(node.id.name)) return null;
    return {
      componentName: node.id.name,
      functionNode: node,
    };
  }

  if (
    node.type === "VariableDeclarator" &&
    node.id?.type === "Identifier" &&
    isReactComponentName(node.id.name) &&
    (node.init?.type === "ArrowFunctionExpression" ||
      node.init?.type === "FunctionExpression")
  ) {
    return {
      componentName: node.id.name,
      functionNode: node.init,
    };
  }

  return null;
}

function collectChildComponentNames(componentFunctionNode: any): string[] {
  const names = new Set<string>();

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type !== "JSXOpeningElement") return;
      const childComponentName = getJSXName(current);
      if (!isComponentJSXName(childComponentName)) return;
      names.add(childComponentName);
    },
    { skipNestedFunctions: true },
  );

  return [...names];
}

type ComponentFacts = {
  statePairs: StatePair[];
  handlers: InteractionHandler[];
  stateWrites: StateWrite[];
  stateReads: StateRead[];
  propReads: PropRead[];
  statePropPasses: StatePropPass[];
  propPasses: PropPass[];
  propSpreadPasses: PropSpreadPass[];
  handlerPropPasses: HandlerPropPass[];
  handlerPropCalls: HandlerPropCall[];
  interactions: InteractionSourceFact[];
};

function collectComponentFacts(
  componentFunctionNode: any,
  store: InteractionStore,
  multiFileTraceOptions: MultiFileTraceOptions | null,
  componentFilePath?: string,
  vocabulary?: ComponentVocabulary,
): ComponentFacts {
  const statePairs = collectStatePairsFromFunctionBody(
    componentFunctionNode.body,
  );
  const externalStatusModel = collectExternalStatusModel(componentFunctionNode);
  const observableStateVars = new Set(
    statePairs
      .map((pair) => pair.stateVar)
      .concat([...externalStatusModel.observableStateVars]),
  );
  const currentFilePath =
    componentFilePath ?? multiFileTraceOptions?.filePath ?? "<current-file>";
  const namedHandlers = collectNamedHandlers(componentFunctionNode, store);
  const helperFunctionResolver = createHelperFunctionResolver(
    componentFunctionNode,
    multiFileTraceOptions,
    currentFilePath,
  );
  const maxTraceDepth =
    multiFileTraceOptions?.maxTraceDepth ?? DEFAULT_MAX_HELPER_TRACE_DEPTH;
  const handlersByName = new Map(
    namedHandlers.map((handler) => [handler.name, handler]),
  );
  const feedbackFunctionNames = new Set(
    vocabulary?.getFeedbackFunctions() ?? DEFAULT_FEEDBACK_FUNCTIONS,
  );

  const stateWrites: StateWrite[] = [];
  for (const handler of namedHandlers) {
    stateWrites.push(
      ...collectStateWritesForHandler(
        handler,
        statePairs,
        helperFunctionResolver,
        externalStatusModel,
        currentFilePath,
        maxTraceDepth,
        feedbackFunctionNames,
      ),
    );
  }

  const stateReads = collectVisibleStateReads(
    componentFunctionNode,
    observableStateVars,
    vocabulary,
  );
  const propReads = collectVisiblePropReads(componentFunctionNode, vocabulary);
  const statePropPasses = collectStatePropPasses(
    componentFunctionNode,
    observableStateVars,
  );
  const { propPasses, propSpreadPasses } = collectPropPasses(
    componentFunctionNode,
  );
  const handlerPropPasses = collectHandlerPropPasses(
    componentFunctionNode,
    handlersByName,
  );
  const interactionData = collectInteractionsAndInlineHandlers(
    componentFunctionNode,
    statePairs,
    handlersByName,
    helperFunctionResolver,
    externalStatusModel,
    store,
    currentFilePath,
    maxTraceDepth,
    feedbackFunctionNames,
  );
  const handlers = [...namedHandlers, ...interactionData.inlineHandlers];
  const handlerPropCalls = collectHandlerPropCalls(
    componentFunctionNode,
    handlers,
  );

  // Handing an outcome to a parent-supplied callback is feedback whose visible
  // half lives in the parent. The parent is followed when it can be resolved
  // (see expandResolvedHandlers); when it cannot, the phase is unknown rather
  // than unhandled, so record it as a delegated write instead of reporting.
  const handlersById = new Map(
    handlers.map((handler) => [handler.id, handler]),
  );
  const delegatedWrites: StateWrite[] = [];
  for (const propCall of handlerPropCalls) {
    const handler = handlersById.get(propCall.handlerId);
    if (!handler) continue;

    delegatedWrites.push({
      handlerId: propCall.handlerId,
      stateVar: DELEGATED_FEEDBACK_STATE_VAR,
      setterVar: propCall.propName,
      phase: classifyNodePhaseInHandler(handler, propCall.node),
      node: propCall.node,
    });
  }

  return {
    statePairs,
    handlers,
    stateWrites: [
      ...stateWrites,
      ...interactionData.inlineWrites,
      ...delegatedWrites,
    ],
    stateReads,
    propReads,
    statePropPasses,
    propPasses,
    propSpreadPasses,
    handlerPropPasses,
    handlerPropCalls,
    interactions: interactionData.interactions,
  };
}

function addComponentFactsToStore(
  componentName: string,
  componentFacts: ComponentFacts,
  store: InteractionStore,
) {
  store.ensureComponent(componentName);

  for (const statePair of componentFacts.statePairs) {
    store.addStatePair(componentName, statePair);
  }

  for (const handler of componentFacts.handlers) {
    store.addHandler(componentName, handler);
  }

  for (const stateWrite of componentFacts.stateWrites) {
    store.addStateWrite(componentName, stateWrite);
  }

  for (const stateRead of componentFacts.stateReads) {
    store.addStateRead(componentName, stateRead);
  }

  for (const propRead of componentFacts.propReads) {
    store.addPropRead(componentName, propRead);
  }

  for (const statePropPass of componentFacts.statePropPasses) {
    store.addStatePropPass(componentName, statePropPass);
  }

  for (const propPass of componentFacts.propPasses) {
    store.addPropPass(componentName, propPass);
  }

  for (const propSpreadPass of componentFacts.propSpreadPasses) {
    store.addPropSpreadPass(componentName, propSpreadPass);
  }

  for (const handlerPropPass of componentFacts.handlerPropPasses) {
    store.addHandlerPropPass(componentName, handlerPropPass);
  }

  for (const handlerPropCall of componentFacts.handlerPropCalls) {
    store.addHandlerPropCall(componentName, handlerPropCall);
  }

  for (const interaction of componentFacts.interactions) {
    store.addInteraction(componentName, interaction);
  }
}

function hasLocalInteractionState(componentFacts: ComponentFacts): boolean {
  return (
    componentFacts.statePairs.length > 0 ||
    // A delegated write means the component hands its outcome upward, which is
    // the pass-through shape this check exists to trace through — not local
    // state of its own.
    componentFacts.stateWrites.some(
      (stateWrite) => stateWrite.stateVar !== DELEGATED_FEEDBACK_STATE_VAR,
    ) ||
    componentFacts.stateReads.length > 0
  );
}

function collectResolvedComponentIntoStore(
  componentName: string,
  componentFunctionNode: any,
  componentFilePath: string,
  store: InteractionStore,
  multiFileTraceOptions: MultiFileTraceOptions | null,
  visitedComponents: Set<string>,
  entryFilePath: string,
  vocabulary?: ComponentVocabulary,
) {
  if (!isReactComponentName(componentName)) return;

  const resolvedFilePath = path.resolve(componentFilePath);
  const componentKey = `${resolvedFilePath}::${componentName}`;
  if (visitedComponents.has(componentKey)) return;
  visitedComponents.add(componentKey);

  const componentFacts = collectComponentFacts(
    componentFunctionNode,
    store,
    multiFileTraceOptions,
    resolvedFilePath,
    vocabulary,
  );
  if (
    resolvedFilePath !== entryFilePath &&
    hasLocalInteractionState(componentFacts)
  ) {
    return;
  }

  addComponentFactsToStore(componentName, componentFacts, store);

  if (!multiFileTraceOptions) return;

  for (const childComponentName of collectChildComponentNames(
    componentFunctionNode,
  )) {
    const resolvedChild =
      multiFileTraceOptions.projectFunctionIndex.resolveFunction(
        resolvedFilePath,
        childComponentName,
      );
    if (!resolvedChild) continue;

    collectResolvedComponentIntoStore(
      resolvedChild.functionName,
      resolvedChild.node,
      resolvedChild.filePath,
      store,
      multiFileTraceOptions,
      visitedComponents,
      entryFilePath,
      vocabulary,
    );
  }
}

function collectComponentIntoStore(
  node: any,
  store: InteractionStore,
  multiFileTraceOptions: MultiFileTraceOptions | null,
  visitedComponents: Set<string>,
  entryFilePath: string,
  vocabulary?: ComponentVocabulary,
) {
  const componentInput = getComponentModelInput(node);
  if (!componentInput) return;

  const componentFilePath = multiFileTraceOptions
    ? multiFileTraceOptions.filePath
    : "<current-file>";

  collectResolvedComponentIntoStore(
    componentInput.componentName,
    componentInput.functionNode,
    componentFilePath,
    store,
    multiFileTraceOptions,
    visitedComponents,
    entryFilePath,
    vocabulary,
  );
}

type ComponentStateCollectorOptions = {
  filePath?: string;
  parser?: ParserLike;
  parserOptions?: Record<string, unknown>;
  projectRoot?: string;
  maxTraceDepth?: number;
  vocabulary?: ComponentVocabulary;
};

export function createComponentStateCollector(
  store: InteractionStore,
  options?: ComponentStateCollectorOptions,
) {
  const multiFileTraceOptions: MultiFileTraceOptions | null = options?.filePath
    ? {
        filePath: path.resolve(options.filePath),
        projectFunctionIndex: new ProjectFunctionIndex({
          projectRoot: path.resolve(options.projectRoot ?? process.cwd()),
          parser: options.parser,
          parserOptions: options.parserOptions,
        }),
        maxTraceDepth: options.maxTraceDepth ?? DEFAULT_MAX_HELPER_TRACE_DEPTH,
      }
    : null;
  const visitedComponents = new Set<string>();
  const entryFilePath = path.resolve(
    options?.filePath ?? multiFileTraceOptions?.filePath ?? "<current-file>",
  );

  return {
    FunctionDeclaration(node: any) {
      collectComponentIntoStore(
        node,
        store,
        multiFileTraceOptions,
        visitedComponents,
        entryFilePath,
        options?.vocabulary,
      );
    },

    VariableDeclarator(node: any) {
      collectComponentIntoStore(
        node,
        store,
        multiFileTraceOptions,
        visitedComponents,
        entryFilePath,
        options?.vocabulary,
      );
    },
  };
}
