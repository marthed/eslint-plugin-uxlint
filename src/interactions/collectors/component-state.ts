import path from "node:path";
import {
  attrText,
  getJSXAttribute,
  getJSXName,
} from "../../multi/collectors/jsx-helpers";
import {
  ProjectFunctionIndex,
  type ParserLike,
  type ResolvedProjectFunction,
} from "../tracing/project-index";
import { InteractionStore } from "../store";
import type {
  HandlerPropCall,
  HandlerPropPass,
  InteractionHandler,
  InteractionPhase,
  PropPass,
  PropSpreadPass,
  PropRead,
  StatePair,
  StatePropPass,
  StateRead,
  StateWrite,
} from "../types";

const FUNCTION_LIKE_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

const HANDLER_EVENT_NAMES = ["onSubmit", "onClick", "onPress"] as const;

type ExternalStatusModel = {
  observableStateVars: Set<string>;
  statusPhasesByStateVar: Map<string, Set<InteractionPhase>>;
  triggerStateVarsByIdentifier: Map<string, Set<string>>;
  triggerStateVarsByMember: Map<string, Map<string, Set<string>>>;
};

const PENDING_NAME_HINT =
  /(pending|loading|saving|submitting|fetching|mutating)/i;
const ERROR_NAME_HINT = /(error|failed|failure|invalid)/i;
const SUCCESS_NAME_HINT =
  /(success|succeed|succeeded|saved|done|complete|completed)/i;
const STATUS_NAME_HINT = /status/i;
const ACTION_NAME_HINT =
  /^(set|save|submit|create|update|remove|delete|load|fetch|mutate)/i;
const DEFAULT_MAX_HELPER_TRACE_DEPTH = 4;

type HelperFunctionResolver = {
  resolve(
    fromFilePath: string,
    calleeName: string,
  ): ResolvedProjectFunction | null;
};

type MultiFileTraceOptions = {
  filePath: string;
  projectFunctionIndex: ProjectFunctionIndex;
  maxTraceDepth: number;
};

function createExternalStatusModel(): ExternalStatusModel {
  return {
    observableStateVars: new Set<string>(),
    statusPhasesByStateVar: new Map<string, Set<InteractionPhase>>(),
    triggerStateVarsByIdentifier: new Map<string, Set<string>>(),
    triggerStateVarsByMember: new Map<string, Map<string, Set<string>>>(),
  };
}

function addStatusPhases(
  model: ExternalStatusModel,
  stateVar: string,
  phases: Iterable<InteractionPhase>,
) {
  const existingPhases =
    model.statusPhasesByStateVar.get(stateVar) ?? new Set<InteractionPhase>();

  for (const phase of phases) {
    existingPhases.add(phase);
  }

  if (existingPhases.size === 0) return;
  model.observableStateVars.add(stateVar);
  model.statusPhasesByStateVar.set(stateVar, existingPhases);
}

function addTriggerIdentifier(
  model: ExternalStatusModel,
  triggerName: string,
  stateVars: Iterable<string>,
) {
  const existingStateVars =
    model.triggerStateVarsByIdentifier.get(triggerName) ?? new Set<string>();

  for (const stateVar of stateVars) {
    existingStateVars.add(stateVar);
  }

  if (existingStateVars.size === 0) return;
  model.triggerStateVarsByIdentifier.set(triggerName, existingStateVars);
}

function addTriggerMember(
  model: ExternalStatusModel,
  objectName: string,
  methodName: string,
  stateVars: Iterable<string>,
) {
  const methodsForObject =
    model.triggerStateVarsByMember.get(objectName) ??
    new Map<string, Set<string>>();
  const existingStateVars =
    methodsForObject.get(methodName) ?? new Set<string>();

  for (const stateVar of stateVars) {
    existingStateVars.add(stateVar);
  }

  if (existingStateVars.size === 0) return;
  methodsForObject.set(methodName, existingStateVars);
  model.triggerStateVarsByMember.set(objectName, methodsForObject);
}

function getMemberExpressionName(node: any): string | null {
  if (
    node?.type !== "MemberExpression" ||
    node.computed !== false ||
    node.object?.type !== "Identifier" ||
    node.property?.type !== "Identifier"
  ) {
    return null;
  }

  return `${node.object.name}.${node.property.name}`;
}

function getCallTargetName(node: any): string {
  if (node?.type === "Identifier") return node.name;

  const memberExpressionName = getMemberExpressionName(node);
  if (memberExpressionName) return memberExpressionName;

  return "<call>";
}

function getStatusPhasesFromName(name: string): Set<InteractionPhase> {
  const phases = new Set<InteractionPhase>();

  if (PENDING_NAME_HINT.test(name)) {
    phases.add("start");
    phases.add("settled");
  }

  if (ERROR_NAME_HINT.test(name)) {
    phases.add("error");
  }

  if (SUCCESS_NAME_HINT.test(name)) {
    phases.add("success");
  }

  if (STATUS_NAME_HINT.test(name)) {
    phases.add("start");
    phases.add("settled");
    phases.add("error");
    phases.add("success");
  }

  return phases;
}

function isUseMutationCallExpression(node: any): boolean {
  return node?.type === "CallExpression" && node.callee?.type === "Identifier"
    ? node.callee.name === "useMutation"
    : false;
}

function isUseSelectorCallExpression(node: any): boolean {
  return node?.type === "CallExpression" && node.callee?.type === "Identifier"
    ? node.callee.name === "useSelector"
    : false;
}

function isUseDispatchCallExpression(node: any): boolean {
  return node?.type === "CallExpression" && node.callee?.type === "Identifier"
    ? node.callee.name === "useDispatch"
    : false;
}

function isLikelyUseStoreHook(node: any): boolean {
  if (node?.type !== "CallExpression") return false;
  if (node.callee?.type !== "Identifier") return false;
  return node.callee.name === "useStore" || /Store$/.test(node.callee.name);
}

function isActionLikeName(name: string): boolean {
  return ACTION_NAME_HINT.test(name);
}

function extractReturnedNodeFromSelector(selectorNode: any): any | null {
  if (!selectorNode) return null;

  if (
    selectorNode.type === "ArrowFunctionExpression" ||
    selectorNode.type === "FunctionExpression"
  ) {
    if (selectorNode.body?.type === "BlockStatement") {
      for (const statement of selectorNode.body.body ?? []) {
        if (statement.type !== "ReturnStatement") continue;
        return statement.argument ?? null;
      }
      return null;
    }

    return selectorNode.body ?? null;
  }

  return null;
}

function extractSelectedStoreMemberName(selectorNode: any): string | null {
  const returnedNode = extractReturnedNodeFromSelector(selectorNode);
  if (!returnedNode) return null;

  if (
    returnedNode.type === "MemberExpression" &&
    returnedNode.computed === false &&
    returnedNode.property?.type === "Identifier"
  ) {
    return returnedNode.property.name;
  }

  return null;
}

function collectExternalStatusModel(
  componentFunctionNode: any,
): ExternalStatusModel {
  const model = createExternalStatusModel();
  const reduxStateVars = new Set<string>();
  const reduxTriggerNames = new Set<string>();
  const zustandStateVars = new Set<string>();
  const zustandTriggerNames = new Set<string>();

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type !== "VariableDeclarator") return;
      if (current.init?.type !== "CallExpression") return;

      if (isUseMutationCallExpression(current.init)) {
        if (current.id?.type === "ObjectPattern") {
          const mutationStatusStateVars = new Set<string>();
          const mutationTriggerNames = new Set<string>();

          for (const property of current.id.properties ?? []) {
            const keyName = getObjectPatternPropertyKeyName(property);
            if (!keyName) continue;

            const valueNode = unwrapAssignmentPattern(property.value);
            if (valueNode?.type !== "Identifier") continue;

            if (keyName === "mutate" || keyName === "mutateAsync") {
              mutationTriggerNames.add(valueNode.name);
              continue;
            }

            const phaseHints = getStatusPhasesFromName(keyName);
            if (phaseHints.size === 0) continue;

            addStatusPhases(model, valueNode.name, phaseHints);
            mutationStatusStateVars.add(valueNode.name);
          }

          for (const triggerName of mutationTriggerNames) {
            addTriggerIdentifier(model, triggerName, mutationStatusStateVars);
          }
        }

        if (current.id?.type === "Identifier") {
          const mutationObjectName = current.id.name;
          const memberStatusFields: Array<{
            fieldName: string;
            phases: InteractionPhase[];
          }> = [
            { fieldName: "isPending", phases: ["start", "settled"] },
            { fieldName: "isLoading", phases: ["start", "settled"] },
            { fieldName: "isError", phases: ["error"] },
            { fieldName: "error", phases: ["error"] },
            { fieldName: "isSuccess", phases: ["success"] },
            {
              fieldName: "status",
              phases: ["start", "settled", "error", "success"],
            },
          ];

          const memberStatusStateVars = new Set<string>();
          for (const memberStatusField of memberStatusFields) {
            const stateVar = `${mutationObjectName}.${memberStatusField.fieldName}`;
            addStatusPhases(model, stateVar, memberStatusField.phases);
            memberStatusStateVars.add(stateVar);
          }

          addTriggerMember(
            model,
            mutationObjectName,
            "mutate",
            memberStatusStateVars,
          );
          addTriggerMember(
            model,
            mutationObjectName,
            "mutateAsync",
            memberStatusStateVars,
          );
        }

        return;
      }

      if (isUseDispatchCallExpression(current.init)) {
        if (current.id?.type !== "Identifier") return;
        reduxTriggerNames.add(current.id.name);
        return;
      }

      if (isUseSelectorCallExpression(current.init)) {
        if (current.id?.type !== "Identifier") return;

        const selectorPhases = getStatusPhasesFromName(current.id.name);
        if (selectorPhases.size === 0) return;

        addStatusPhases(model, current.id.name, selectorPhases);
        reduxStateVars.add(current.id.name);
        return;
      }

      if (!isLikelyUseStoreHook(current.init)) return;
      if (current.id?.type !== "Identifier") return;

      const selectedStoreMember = extractSelectedStoreMemberName(
        current.init.arguments?.[0],
      );
      if (!selectedStoreMember) return;

      const selectedStatePhases = getStatusPhasesFromName(selectedStoreMember);
      if (selectedStatePhases.size > 0) {
        addStatusPhases(model, current.id.name, selectedStatePhases);
        zustandStateVars.add(current.id.name);
        return;
      }

      if (
        isActionLikeName(selectedStoreMember) ||
        isActionLikeName(current.id.name)
      ) {
        zustandTriggerNames.add(current.id.name);
      }
    },
    { skipNestedFunctions: true },
  );

  for (const reduxTriggerName of reduxTriggerNames) {
    addTriggerIdentifier(model, reduxTriggerName, reduxStateVars);
  }

  for (const zustandTriggerName of zustandTriggerNames) {
    addTriggerIdentifier(model, zustandTriggerName, zustandStateVars);
  }

  return model;
}

function isAstNode(value: unknown): value is { type: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    "type" in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>).type === "string",
  );
}

function isFunctionLikeNode(node: unknown): boolean {
  return isAstNode(node) && FUNCTION_LIKE_TYPES.has(node.type);
}

function walkAst(
  node: unknown,
  visitor: (node: any) => void,
  options?: {
    skipNestedFunctions?: boolean;
  },
  visited = new Set<object>(),
) {
  if (!isAstNode(node)) return;
  if (visited.has(node as object)) return;

  visited.add(node as object);
  visitor(node);

  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (!isAstNode(item)) continue;
        if (options?.skipNestedFunctions && isFunctionLikeNode(item)) continue;
        walkAst(item, visitor, options, visited);
      }
      continue;
    }

    if (!isAstNode(value)) continue;
    if (options?.skipNestedFunctions && isFunctionLikeNode(value)) continue;
    walkAst(value, visitor, options, visited);
  }
}

function isReactComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

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

function getProgramNode(node: any): any | null {
  let current = node;
  while (current?.parent) {
    current = current.parent;
  }

  if (current?.type !== "Program") return null;
  return current;
}

function collectNamedFunctionsInProgram(programNode: any): Map<string, any> {
  const functionsByName = new Map<string, any>();
  if (!programNode) return functionsByName;

  walkAst(programNode, (current) => {
    if (current.type === "FunctionDeclaration" && current.id?.name) {
      functionsByName.set(current.id.name, current);
      return;
    }

    if (
      current.type === "VariableDeclarator" &&
      current.id?.type === "Identifier" &&
      (current.init?.type === "ArrowFunctionExpression" ||
        current.init?.type === "FunctionExpression")
    ) {
      functionsByName.set(current.id.name, current.init);
    }
  });

  return functionsByName;
}

function createHelperFunctionResolver(
  componentFunctionNode: any,
  multiFileTraceOptions: MultiFileTraceOptions | null,
  currentFilePath: string,
): HelperFunctionResolver {
  const programNode = getProgramNode(componentFunctionNode);
  const sameFileFunctionsByName = collectNamedFunctionsInProgram(programNode);

  if (!multiFileTraceOptions || !programNode) {
    return {
      resolve(_fromFilePath, calleeName) {
        const functionNode = sameFileFunctionsByName.get(calleeName);
        if (!functionNode) return null;

        return {
          filePath: currentFilePath,
          functionName: calleeName,
          node: functionNode,
        };
      },
    };
  }

  multiFileTraceOptions.projectFunctionIndex.seedProgram(
    currentFilePath,
    programNode,
  );

  return {
    resolve(fromFilePath, calleeName) {
      if (path.resolve(fromFilePath) === path.resolve(currentFilePath)) {
        const sameFileFunction = sameFileFunctionsByName.get(calleeName);
        if (sameFileFunction) {
          return {
            filePath: currentFilePath,
            functionName: calleeName,
            node: sameFileFunction,
          };
        }
      }

      return multiFileTraceOptions.projectFunctionIndex.resolveFunction(
        fromFilePath,
        calleeName,
      );
    },
  };
}

function isUseStateCallExpression(node: any): boolean {
  if (node?.type !== "CallExpression") return false;

  if (node.callee?.type === "Identifier" && node.callee.name === "useState") {
    return true;
  }

  if (
    node.callee?.type === "MemberExpression" &&
    node.callee.object?.type === "Identifier" &&
    node.callee.object.name === "React" &&
    node.callee.property?.type === "Identifier" &&
    node.callee.property.name === "useState" &&
    node.callee.computed === false
  ) {
    return true;
  }

  return false;
}

function collectStatePairsFromFunctionBody(fnBody: any): StatePair[] {
  const pairs: StatePair[] = [];

  if (!Array.isArray(fnBody?.body)) return pairs;

  for (const statement of fnBody.body) {
    if (statement.type !== "VariableDeclaration") continue;

    for (const declarator of statement.declarations ?? []) {
      if (!isUseStateCallExpression(declarator.init)) continue;

      const pattern = declarator.id;
      if (
        pattern?.type !== "ArrayPattern" ||
        pattern.elements?.length !== 2 ||
        pattern.elements[0]?.type !== "Identifier" ||
        pattern.elements[1]?.type !== "Identifier"
      ) {
        continue;
      }

      pairs.push({
        stateVar: pattern.elements[0].name,
        setterVar: pattern.elements[1].name,
      });
    }
  }

  return pairs;
}

function handlerContainsAwait(handlerNode: any): boolean {
  let foundAwait = false;

  walkAst(
    handlerNode.body ?? handlerNode,
    (current) => {
      if (foundAwait) return;
      if (current.type === "AwaitExpression") {
        foundAwait = true;
      }
    },
    { skipNestedFunctions: true },
  );

  return foundAwait;
}

function inferIsAsyncHandler(handlerNode: any): boolean {
  return Boolean(handlerNode?.async) || handlerContainsAwait(handlerNode);
}

function collectNamedHandlers(
  componentFunctionNode: any,
  store: InteractionStore,
): InteractionHandler[] {
  const handlers: InteractionHandler[] = [];
  const bodyStatements = componentFunctionNode.body?.body;

  if (!Array.isArray(bodyStatements)) return handlers;

  for (const statement of bodyStatements) {
    if (statement.type === "FunctionDeclaration" && statement.id?.name) {
      handlers.push({
        id: store.nextId("handler"),
        name: statement.id.name,
        node: statement,
        isAsync: inferIsAsyncHandler(statement),
        kind: "named",
      });
      continue;
    }

    if (statement.type !== "VariableDeclaration") continue;

    for (const declarator of statement.declarations ?? []) {
      if (declarator.id?.type !== "Identifier") continue;
      const init = declarator.init;
      if (
        init?.type !== "ArrowFunctionExpression" &&
        init?.type !== "FunctionExpression"
      ) {
        continue;
      }

      handlers.push({
        id: store.nextId("handler"),
        name: declarator.id.name,
        node: init,
        isAsync: inferIsAsyncHandler(init),
        kind: "named",
      });
    }
  }

  return handlers;
}

function getNodeStart(node: any): number | null {
  if (Array.isArray(node?.range) && typeof node.range[0] === "number") {
    return node.range[0];
  }

  return null;
}

function findFirstAwaitStart(handlerNode: any): number | null {
  let firstAwaitStart: number | null = null;

  walkAst(
    handlerNode.body ?? handlerNode,
    (current) => {
      if (current.type !== "AwaitExpression") return;
      const start = getNodeStart(current);
      if (start === null) return;
      if (firstAwaitStart === null || start < firstAwaitStart) {
        firstAwaitStart = start;
      }
    },
    { skipNestedFunctions: true },
  );

  return firstAwaitStart;
}

function isInsideCatch(node: any): boolean {
  let current = node;
  let parent = node?.parent;

  while (parent) {
    if (parent.type === "CatchClause" && parent.body === current) {
      return true;
    }

    current = parent;
    parent = parent.parent;
  }

  return false;
}

function isInsideFinally(node: any): boolean {
  let current = node;
  let parent = node?.parent;

  while (parent) {
    if (parent.type === "TryStatement" && parent.finalizer === current) {
      return true;
    }

    current = parent;
    parent = parent.parent;
  }

  return false;
}

function classifyStateWritePhase(
  writeNode: any,
  isAsyncHandler: boolean,
  firstAwaitStart: number | null,
  orderingNode?: any,
): InteractionPhase {
  if (!isAsyncHandler) return "sync";
  if (isInsideFinally(writeNode)) return "settled";
  if (isInsideCatch(writeNode)) return "error";

  const writeStart = getNodeStart(orderingNode ?? writeNode);
  if (
    firstAwaitStart !== null &&
    writeStart !== null &&
    writeStart < firstAwaitStart
  ) {
    return "start";
  }

  if (firstAwaitStart !== null) return "success";
  return "start";
}

type WritePhaseContext = {
  firstAwaitStart: number | null;
  isAsync: boolean;
  orderingNode: any | null;
};

function createWritePhaseContext(
  functionNode: any,
  parentContext: WritePhaseContext | null,
  callSiteNode: any | null,
): WritePhaseContext {
  const functionIsAsync = inferIsAsyncHandler(functionNode);
  if (functionIsAsync) {
    return {
      isAsync: true,
      firstAwaitStart: findFirstAwaitStart(functionNode),
      orderingNode: null,
    };
  }

  if (!parentContext?.isAsync) {
    return {
      isAsync: false,
      firstAwaitStart: null,
      orderingNode: null,
    };
  }

  return {
    isAsync: true,
    firstAwaitStart: parentContext.firstAwaitStart,
    orderingNode: callSiteNode,
  };
}

function classifyStateWriteWithContext(
  writeNode: any,
  phaseContext: WritePhaseContext,
  fallbackOrderingNode?: any,
): InteractionPhase {
  return classifyStateWritePhase(
    writeNode,
    phaseContext.isAsync,
    phaseContext.firstAwaitStart,
    phaseContext.orderingNode ?? fallbackOrderingNode ?? writeNode,
  );
}

function getBooleanLiteralArgument(callExpressionNode: any): boolean | null {
  const firstArgument = callExpressionNode?.arguments?.[0];
  if (
    firstArgument?.type === "Literal" &&
    typeof firstArgument.value === "boolean"
  ) {
    return firstArgument.value;
  }

  return null;
}

function collectStateWritesForHandler(
  handler: InteractionHandler,
  statePairs: StatePair[],
  helperFunctionResolver: HelperFunctionResolver,
  externalStatusModel: ExternalStatusModel,
  currentFilePath: string,
  maxTraceDepth: number,
): StateWrite[] {
  const setterToState = new Map(
    statePairs.map((pair) => [pair.setterVar, pair.stateVar]),
  );
  const externalWriteKeys = new Set<string>();
  const rootPhaseContext = createWritePhaseContext(handler.node, null, null);

  function collectWritesFromFunction(
    functionNode: any,
    functionFilePath: string,
    setterAliases: Map<string, string>,
    phaseContext: WritePhaseContext,
    activeHelpers: Set<string>,
    depth: number,
  ): StateWrite[] {
    const writes: StateWrite[] = [];

    walkAst(
      functionNode.body ?? functionNode,
      (current) => {
        if (current.type !== "CallExpression") return;

        const calleeName =
          current.callee?.type === "Identifier" ? current.callee.name : null;
        const callTargetName = getCallTargetName(current.callee);

        const stateVar = calleeName ? setterAliases.get(calleeName) : undefined;
        if (stateVar) {
          writes.push({
            handlerId: handler.id,
            stateVar,
            setterVar: callTargetName,
            phase: classifyStateWriteWithContext(
              current,
              phaseContext,
              current,
            ),
            node: current,
          });
        }

        const triggeredStateVars = new Set<string>();
        if (calleeName) {
          for (const triggeredStateVar of externalStatusModel.triggerStateVarsByIdentifier.get(
            calleeName,
          ) ?? []) {
            triggeredStateVars.add(triggeredStateVar);
          }
        }

        if (
          current.callee?.type === "MemberExpression" &&
          current.callee.computed === false &&
          current.callee.object?.type === "Identifier" &&
          current.callee.property?.type === "Identifier"
        ) {
          const methodsForObject =
            externalStatusModel.triggerStateVarsByMember.get(
              current.callee.object.name,
            );
          for (const triggeredStateVar of methodsForObject?.get(
            current.callee.property.name,
          ) ?? []) {
            triggeredStateVars.add(triggeredStateVar);
          }
        }

        for (const triggeredStateVar of triggeredStateVars) {
          const phases =
            externalStatusModel.statusPhasesByStateVar.get(triggeredStateVar);
          if (!phases || phases.size === 0) continue;

          for (const phase of phases) {
            const writeKey = `${triggeredStateVar}:${phase}:${callTargetName}`;
            if (externalWriteKeys.has(writeKey)) continue;
            externalWriteKeys.add(writeKey);

            writes.push({
              handlerId: handler.id,
              stateVar: triggeredStateVar,
              setterVar: callTargetName,
              phase,
              node: current,
            });
          }
        }

        if (!calleeName) return;
        if (depth >= maxTraceDepth) return;

        const helperFunction = helperFunctionResolver.resolve(
          functionFilePath,
          calleeName,
        );
        if (!helperFunction) return;

        const helperTraceKey = `${helperFunction.filePath}::${helperFunction.functionName}`;
        if (activeHelpers.has(helperTraceKey)) return;

        const helperSetterAliases = new Map(setterAliases);
        const helperParams = Array.isArray(helperFunction.node.params)
          ? helperFunction.node.params
          : [];
        const helperArgs = Array.isArray(current.arguments)
          ? current.arguments
          : [];

        for (let index = 0; index < helperParams.length; index += 1) {
          const param = helperParams[index];
          const arg = helperArgs[index];
          if (param?.type !== "Identifier") continue;
          if (arg?.type !== "Identifier") continue;

          const argStateVar = setterAliases.get(arg.name);
          if (!argStateVar) continue;
          helperSetterAliases.set(param.name, argStateVar);
        }

        const nestedHelpers = new Set(activeHelpers);
        nestedHelpers.add(helperTraceKey);
        const helperPhaseContext = createWritePhaseContext(
          helperFunction.node,
          phaseContext,
          current,
        );
        writes.push(
          ...collectWritesFromFunction(
            helperFunction.node,
            helperFunction.filePath,
            helperSetterAliases,
            helperPhaseContext,
            nestedHelpers,
            depth + 1,
          ),
        );
      },
      { skipNestedFunctions: true },
    );

    return writes;
  }

  const writes = collectWritesFromFunction(
    handler.node,
    currentFilePath,
    setterToState,
    rootPhaseContext,
    new Set<string>(),
    0,
  );

  if (!writes.some((write) => write.phase !== "sync")) return writes;

  // Treat post-await writes that clear a pending flag as settled feedback
  // when the same state var was set to true in start.
  const startPendingStateVars = new Set(
    writes
      .filter(
        (write) =>
          write.phase === "start" &&
          getBooleanLiteralArgument(write.node) === true,
      )
      .map((write) => write.stateVar),
  );

  for (const write of writes) {
    if (write.phase !== "success") continue;
    if (!startPendingStateVars.has(write.stateVar)) continue;
    if (getBooleanLiteralArgument(write.node) !== false) continue;

    write.phase = "settled";
  }

  return writes;
}

function collectStateReferenceNames(
  expressionNode: any,
  stateNames: Set<string>,
): string[] {
  const foundStateNames = new Set<string>();
  if (!expressionNode) return [];

  walkAst(expressionNode, (current) => {
    if (
      current.type === "MemberExpression" &&
      current.computed === false &&
      current.object?.type === "Identifier" &&
      current.property?.type === "Identifier"
    ) {
      const memberName = `${current.object.name}.${current.property.name}`;
      if (stateNames.has(memberName)) {
        foundStateNames.add(memberName);
      }
      return;
    }

    if (current.type !== "Identifier") return;
    if (!stateNames.has(current.name)) return;

    const parent = current.parent;
    if (
      parent?.type === "MemberExpression" &&
      parent.property === current &&
      parent.computed === false
    ) {
      return;
    }

    if (
      parent?.type === "Property" &&
      parent.key === current &&
      parent.computed === false
    ) {
      return;
    }

    foundStateNames.add(current.name);
  });

  return [...foundStateNames];
}

function unwrapAssignmentPattern(node: any): any {
  if (node?.type === "AssignmentPattern") return node.left;
  return node;
}

function getObjectPatternPropertyKeyName(propertyNode: any): string | null {
  if (
    !propertyNode ||
    propertyNode.type !== "Property" ||
    propertyNode.computed
  ) {
    return null;
  }

  if (propertyNode.key?.type === "Identifier") return propertyNode.key.name;
  if (
    propertyNode.key?.type === "Literal" &&
    typeof propertyNode.key.value === "string"
  ) {
    return propertyNode.key.value;
  }

  return null;
}

function collectComponentPropAliases(componentFunctionNode: any): {
  localAliasToPropName: Map<string, string>;
  propsObjectName?: string;
} {
  const localAliasToPropName = new Map<string, string>();
  const firstParam = unwrapAssignmentPattern(componentFunctionNode.params?.[0]);

  if (!firstParam) return { localAliasToPropName };

  if (firstParam.type === "Identifier") {
    return {
      localAliasToPropName,
      propsObjectName: firstParam.name,
    };
  }

  if (firstParam.type !== "ObjectPattern") return { localAliasToPropName };

  for (const property of firstParam.properties ?? []) {
    const propName = getObjectPatternPropertyKeyName(property);
    if (!propName) continue;

    const value = unwrapAssignmentPattern(property.value);
    if (value?.type !== "Identifier") continue;
    localAliasToPropName.set(value.name, propName);
  }

  return { localAliasToPropName };
}

function collectPropReferenceNames(
  expressionNode: any,
  propAliases: {
    localAliasToPropName: Map<string, string>;
    propsObjectName?: string;
  },
): string[] {
  const foundPropNames = new Set<string>();
  if (!expressionNode) return [];

  walkAst(expressionNode, (current) => {
    if (current.type === "Identifier") {
      const propName = propAliases.localAliasToPropName.get(current.name);
      if (!propName) return;

      const parent = current.parent;
      if (
        parent?.type === "MemberExpression" &&
        parent.property === current &&
        parent.computed === false
      ) {
        return;
      }

      if (
        parent?.type === "Property" &&
        parent.key === current &&
        parent.computed === false
      ) {
        return;
      }

      foundPropNames.add(propName);
      return;
    }

    if (
      current.type === "MemberExpression" &&
      current.object?.type === "Identifier" &&
      current.property?.type === "Identifier" &&
      current.computed === false &&
      propAliases.propsObjectName &&
      current.object.name === propAliases.propsObjectName
    ) {
      foundPropNames.add(current.property.name);
    }
  });

  return [...foundPropNames];
}

function isComponentJSXName(name: string | null): name is string {
  return Boolean(name && /^[A-Z]/.test(name));
}

function collectStatePropPasses(
  componentFunctionNode: any,
  stateNames: Set<string>,
): StatePropPass[] {
  const passes: StatePropPass[] = [];

  if (stateNames.size === 0) return passes;

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type !== "JSXAttribute") return;

      const expression = current.value?.expression;
      const stateVars = collectStateReferenceNames(expression, stateNames);
      if (stateVars.length === 0) return;

      const openingElement = current.parent;
      if (openingElement?.type !== "JSXOpeningElement") return;

      const childComponentName = getJSXName(openingElement);
      if (!isComponentJSXName(childComponentName)) return;

      const propName = current.name?.name;
      if (typeof propName !== "string") return;

      for (const stateVar of stateVars) {
        passes.push({
          stateVar,
          node: current,
          childComponentName,
          propName,
        });
      }
    },
    { skipNestedFunctions: true },
  );

  return passes;
}

function collectPropPasses(componentFunctionNode: any): {
  propPasses: PropPass[];
  propSpreadPasses: PropSpreadPass[];
} {
  const propAliases = collectComponentPropAliases(componentFunctionNode);
  const propPasses: PropPass[] = [];
  const propSpreadPasses: PropSpreadPass[] = [];

  if (
    propAliases.localAliasToPropName.size === 0 &&
    !propAliases.propsObjectName
  ) {
    return { propPasses, propSpreadPasses };
  }

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type !== "JSXOpeningElement") return;

      const childComponentName = getJSXName(current);
      if (!isComponentJSXName(childComponentName)) return;

      for (const attribute of current.attributes ?? []) {
        if (attribute?.type === "JSXSpreadAttribute") {
          if (
            propAliases.propsObjectName &&
            attribute.argument?.type === "Identifier" &&
            attribute.argument.name === propAliases.propsObjectName
          ) {
            propSpreadPasses.push({
              childComponentName,
              node: attribute,
            });
          }
          continue;
        }

        if (attribute?.type !== "JSXAttribute") continue;
        const childPropName = attribute.name?.name;
        if (typeof childPropName !== "string") continue;

        const sourcePropNames = collectPropReferenceNames(
          attribute.value?.expression,
          propAliases,
        );
        for (const sourcePropName of sourcePropNames) {
          propPasses.push({
            sourcePropName,
            childPropName,
            childComponentName,
            node: attribute,
          });
        }
      }
    },
    { skipNestedFunctions: true },
  );

  return { propPasses, propSpreadPasses };
}

function collectHandlerPropPasses(
  componentFunctionNode: any,
  handlersByName: Map<string, InteractionHandler>,
): HandlerPropPass[] {
  const passes: HandlerPropPass[] = [];
  if (handlersByName.size === 0) return passes;

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type !== "JSXOpeningElement") return;

      const childComponentName = getJSXName(current);
      if (!isComponentJSXName(childComponentName)) return;

      for (const attribute of current.attributes ?? []) {
        if (attribute?.type !== "JSXAttribute") continue;

        const childPropName = attribute.name?.name;
        if (typeof childPropName !== "string") continue;

        const expression = attribute.value?.expression;
        if (!expression) continue;

        let candidateHandlerName: string | null = null;

        if (expression.type === "Identifier") {
          candidateHandlerName = expression.name;
        } else if (
          expression.type === "ArrowFunctionExpression" ||
          expression.type === "FunctionExpression"
        ) {
          candidateHandlerName = extractDirectCalledHandlerName(expression.body);
        }

        if (!candidateHandlerName) continue;
        const handler = handlersByName.get(candidateHandlerName);
        if (!handler) continue;

        passes.push({
          childComponentName,
          childPropName,
          node: attribute,
          handlerId: handler.id,
          handlerName: handler.name,
        });
      }
    },
    { skipNestedFunctions: true },
  );

  return passes;
}

function resolveCalledPropName(
  calleeNode: any,
  propAliases: {
    localAliasToPropName: Map<string, string>;
    propsObjectName?: string;
  },
): string | null {
  if (calleeNode?.type === "Identifier") {
    return propAliases.localAliasToPropName.get(calleeNode.name) ?? null;
  }

  if (
    calleeNode?.type === "MemberExpression" &&
    calleeNode.computed === false &&
    calleeNode.object?.type === "Identifier" &&
    calleeNode.property?.type === "Identifier" &&
    propAliases.propsObjectName &&
    calleeNode.object.name === propAliases.propsObjectName
  ) {
    return calleeNode.property.name;
  }

  return null;
}

function collectHandlerPropCalls(
  componentFunctionNode: any,
  handlers: InteractionHandler[],
): HandlerPropCall[] {
  const calls: HandlerPropCall[] = [];
  if (handlers.length === 0) return calls;

  const propAliases = collectComponentPropAliases(componentFunctionNode);
  if (
    propAliases.localAliasToPropName.size === 0 &&
    !propAliases.propsObjectName
  ) {
    return calls;
  }

  for (const handler of handlers) {
    walkAst(
      handler.node.body ?? handler.node,
      (current) => {
        if (current.type !== "CallExpression") return;

        const propName = resolveCalledPropName(current.callee, propAliases);
        if (!propName) return;

        calls.push({
          handlerId: handler.id,
          propName,
          node: current,
        });
      },
      { skipNestedFunctions: true },
    );
  }

  return calls;
}

function collectVisibleStateReads(
  componentFunctionNode: any,
  stateNames: Set<string>,
): StateRead[] {
  const reads: StateRead[] = [];

  if (stateNames.size === 0) return reads;

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type === "JSXAttribute") {
        const expression = current.value?.expression;
        const stateVars = collectStateReferenceNames(expression, stateNames);
        if (stateVars.length === 0) return;

        const openingElement = current.parent;
        const ownerTagName =
          openingElement?.type === "JSXOpeningElement"
            ? getJSXName(openingElement)
            : null;
        const belongsToComponent = isComponentJSXName(ownerTagName);

        const propName = current.name?.name;
        if (propName === "disabled" && !belongsToComponent) {
          for (const stateVar of stateVars) {
            reads.push({ stateVar, node: current, kind: "disabled-prop" });
          }
          return;
        }

        if (
          (propName === "loading" || propName === "isLoading") &&
          !belongsToComponent
        ) {
          for (const stateVar of stateVars) {
            reads.push({ stateVar, node: current, kind: "loading-prop" });
          }
          return;
        }

        return;
      }

      if (current.type === "LogicalExpression" && current.operator === "&&") {
        const leftStateVars = collectStateReferenceNames(
          current.left,
          stateNames,
        );
        for (const stateVar of leftStateVars) {
          reads.push({
            stateVar,
            node: current,
            kind: "conditional-render",
          });
        }
        return;
      }

      if (current.type === "ConditionalExpression") {
        const testStateVars = collectStateReferenceNames(
          current.test,
          stateNames,
        );
        for (const stateVar of testStateVars) {
          reads.push({
            stateVar,
            node: current,
            kind: "ternary-render",
          });
        }
        return;
      }

      if (
        current.type === "JSXExpressionContainer" &&
        current.parent?.type !== "JSXAttribute"
      ) {
        const expressionStateVars = collectStateReferenceNames(
          current.expression,
          stateNames,
        );
        for (const stateVar of expressionStateVars) {
          reads.push({
            stateVar,
            node: current,
            kind: "generic-visible-read",
          });
        }
      }
    },
    { skipNestedFunctions: true },
  );

  return reads;
}

function collectVisiblePropReads(componentFunctionNode: any): PropRead[] {
  const reads: PropRead[] = [];
  const propAliases = collectComponentPropAliases(componentFunctionNode);

  if (
    propAliases.localAliasToPropName.size === 0 &&
    !propAliases.propsObjectName
  ) {
    return reads;
  }

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type === "JSXAttribute") {
        const propNames = collectPropReferenceNames(
          current.value?.expression,
          propAliases,
        );
        if (propNames.length === 0) return;

        const attributeName = current.name?.name;
        if (attributeName === "disabled") {
          for (const propName of propNames) {
            reads.push({ propName, node: current, kind: "disabled-prop" });
          }
          return;
        }

        if (attributeName === "loading" || attributeName === "isLoading") {
          for (const propName of propNames) {
            reads.push({ propName, node: current, kind: "loading-prop" });
          }
          return;
        }

        return;
      }

      if (current.type === "LogicalExpression" && current.operator === "&&") {
        const leftPropNames = collectPropReferenceNames(
          current.left,
          propAliases,
        );
        for (const propName of leftPropNames) {
          reads.push({
            propName,
            node: current,
            kind: "conditional-render",
          });
        }

        const rightPropNames = collectPropReferenceNames(
          current.right,
          propAliases,
        );
        for (const propName of rightPropNames) {
          reads.push({
            propName,
            node: current,
            kind: "generic-visible-read",
          });
        }
        return;
      }

      if (current.type === "ConditionalExpression") {
        const testPropNames = collectPropReferenceNames(
          current.test,
          propAliases,
        );
        for (const propName of testPropNames) {
          reads.push({
            propName,
            node: current,
            kind: "ternary-render",
          });
        }

        const consequentPropNames = collectPropReferenceNames(
          current.consequent,
          propAliases,
        );
        for (const propName of consequentPropNames) {
          reads.push({
            propName,
            node: current,
            kind: "generic-visible-read",
          });
        }

        const alternatePropNames = collectPropReferenceNames(
          current.alternate,
          propAliases,
        );
        for (const propName of alternatePropNames) {
          reads.push({
            propName,
            node: current,
            kind: "generic-visible-read",
          });
        }
        return;
      }

      if (
        current.type === "JSXExpressionContainer" &&
        current.parent?.type !== "JSXAttribute"
      ) {
        const propNames = collectPropReferenceNames(
          current.expression,
          propAliases,
        );
        for (const propName of propNames) {
          reads.push({
            propName,
            node: current,
            kind: "generic-visible-read",
          });
        }
      }
    },
    { skipNestedFunctions: true },
  );

  return reads;
}

function extractDirectCalledHandlerName(expressionNode: any): string | null {
  if (
    expressionNode?.type === "CallExpression" &&
    expressionNode.callee?.type === "Identifier"
  ) {
    return expressionNode.callee.name;
  }

  if (
    expressionNode?.type === "BlockStatement" &&
    Array.isArray(expressionNode.body) &&
    expressionNode.body.length > 0
  ) {
    const firstStatement = expressionNode.body[0];

    if (
      firstStatement?.type === "ExpressionStatement" &&
      firstStatement.expression?.type === "CallExpression" &&
      firstStatement.expression.callee?.type === "Identifier"
    ) {
      return firstStatement.expression.callee.name;
    }

    if (
      firstStatement?.type === "ReturnStatement" &&
      firstStatement.argument?.type === "CallExpression" &&
      firstStatement.argument.callee?.type === "Identifier"
    ) {
      return firstStatement.argument.callee.name;
    }
  }

  return null;
}

function getEventBinding(openingElement: any): {
  eventName: "onClick" | "onSubmit" | "onPress" | "unknown";
  handlerAttribute: any;
} | null {
  for (const eventName of HANDLER_EVENT_NAMES) {
    const attribute = getJSXAttribute(openingElement, eventName);
    if (!attribute) continue;
    return { eventName, handlerAttribute: attribute };
  }

  return null;
}

function resolveInteractionHandlerReference(
  handlerAttribute: any,
  handlersByName: Map<string, InteractionHandler>,
  statePairs: StatePair[],
  helperFunctionResolver: HelperFunctionResolver,
  externalStatusModel: ExternalStatusModel,
  store: InteractionStore,
  currentFilePath: string,
  maxTraceDepth: number,
): {
  handlerId?: string;
  handlerName?: string;
  inlineHandler?: InteractionHandler;
  inlineWrites?: StateWrite[];
} {
  const expression = handlerAttribute?.value?.expression;
  if (!expression) return {};

  if (expression.type === "Identifier") {
    const namedHandler = handlersByName.get(expression.name);
    return {
      handlerId: namedHandler?.id,
      handlerName: expression.name,
    };
  }

  if (
    expression.type === "ArrowFunctionExpression" ||
    expression.type === "FunctionExpression"
  ) {
    const delegatedHandlerName = extractDirectCalledHandlerName(
      expression.body,
    );
    if (delegatedHandlerName) {
      const namedHandler = handlersByName.get(delegatedHandlerName);
      if (namedHandler) {
        return {
          handlerId: namedHandler.id,
          handlerName: delegatedHandlerName,
        };
      }
    }

    const inlineHandler: InteractionHandler = {
      id: store.nextId("handler"),
      name: "<inline>",
      node: expression,
      isAsync: inferIsAsyncHandler(expression),
      kind: "inline",
    };

    return {
      handlerId: inlineHandler.id,
      handlerName: inlineHandler.name,
      inlineHandler,
      inlineWrites: collectStateWritesForHandler(
        inlineHandler,
        statePairs,
        helperFunctionResolver,
        externalStatusModel,
        currentFilePath,
        maxTraceDepth,
      ),
    };
  }

  return {};
}

function collectInteractionsAndInlineHandlers(
  componentFunctionNode: any,
  statePairs: StatePair[],
  namedHandlersByName: Map<string, InteractionHandler>,
  helperFunctionResolver: HelperFunctionResolver,
  externalStatusModel: ExternalStatusModel,
  store: InteractionStore,
  currentFilePath: string,
  maxTraceDepth: number,
): {
  interactions: Array<{
    id: string;
    node: any;
    eventName: "onClick" | "onSubmit" | "onPress" | "unknown";
    componentName?: string;
    label?: string;
    handlerId?: string;
    handlerName?: string;
  }>;
  inlineHandlers: InteractionHandler[];
  inlineWrites: StateWrite[];
} {
  const interactions: Array<{
    id: string;
    node: any;
    eventName: "onClick" | "onSubmit" | "onPress" | "unknown";
    componentName?: string;
    label?: string;
    handlerId?: string;
    handlerName?: string;
  }> = [];
  const inlineHandlers: InteractionHandler[] = [];
  const inlineWrites: StateWrite[] = [];

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type !== "JSXOpeningElement") return;

      const binding = getEventBinding(current);
      if (!binding) return;

      const resolution = resolveInteractionHandlerReference(
        binding.handlerAttribute,
        namedHandlersByName,
        statePairs,
        helperFunctionResolver,
        externalStatusModel,
        store,
        currentFilePath,
        maxTraceDepth,
      );

      if (resolution.inlineHandler) {
        inlineHandlers.push(resolution.inlineHandler);
      }

      if (resolution.inlineWrites?.length) {
        inlineWrites.push(...resolution.inlineWrites);
      }

      interactions.push({
        id: store.nextId("interaction"),
        node: current,
        eventName: binding.eventName,
        componentName: getJSXName(current) ?? undefined,
        label: attrText(current, "aria-label") ?? undefined,
        handlerId: resolution.handlerId,
        handlerName: resolution.handlerName,
      });
    },
    { skipNestedFunctions: true },
  );

  return { interactions, inlineHandlers, inlineWrites };
}

function collectComponentFacts(
  componentFunctionNode: any,
  store: InteractionStore,
  multiFileTraceOptions: MultiFileTraceOptions | null,
  componentFilePath?: string,
): {
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
  interactions: Array<{
    id: string;
    node: any;
    eventName: "onClick" | "onSubmit" | "onPress" | "unknown";
    componentName?: string;
    label?: string;
    handlerId?: string;
    handlerName?: string;
  }>;
} {
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
    componentFilePath ??
    multiFileTraceOptions?.filePath ??
    "<current-file>";
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
      ),
    );
  }

  const stateReads = collectVisibleStateReads(
    componentFunctionNode,
    observableStateVars,
  );
  const propReads = collectVisiblePropReads(componentFunctionNode);
  const statePropPasses = collectStatePropPasses(
    componentFunctionNode,
    observableStateVars,
  );
  const { propPasses, propSpreadPasses } =
    collectPropPasses(componentFunctionNode);
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
  );
  const handlers = [...namedHandlers, ...interactionData.inlineHandlers];
  const handlerPropCalls = collectHandlerPropCalls(
    componentFunctionNode,
    handlers,
  );

  return {
    statePairs,
    handlers,
    stateWrites: [...stateWrites, ...interactionData.inlineWrites],
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

function collectComponentIntoStore(
  node: any,
  store: InteractionStore,
  multiFileTraceOptions: MultiFileTraceOptions | null,
  visitedComponents: Set<string>,
  entryFilePath: string,
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
  );
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

function addComponentFactsToStore(
  componentName: string,
  componentFacts: ReturnType<typeof collectComponentFacts>,
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

function hasLocalInteractionState(
  componentFacts: ReturnType<typeof collectComponentFacts>,
): boolean {
  return (
    componentFacts.statePairs.length > 0 ||
    componentFacts.stateWrites.length > 0 ||
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
  );
  if (
    resolvedFilePath !== entryFilePath &&
    hasLocalInteractionState(componentFacts)
  ) {
    return;
  }

  addComponentFactsToStore(
    componentName,
    componentFacts,
    store,
  );

  if (!multiFileTraceOptions) return;

  for (const childComponentName of collectChildComponentNames(
    componentFunctionNode,
  )) {
    const resolvedChild = multiFileTraceOptions.projectFunctionIndex.resolveFunction(
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
    );
  }
}

type ComponentStateCollectorOptions = {
  filePath?: string;
  parser?: ParserLike;
  parserOptions?: Record<string, unknown>;
  projectRoot?: string;
  maxTraceDepth?: number;
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
      );
    },

    VariableDeclarator(node: any) {
      collectComponentIntoStore(
        node,
        store,
        multiFileTraceOptions,
        visitedComponents,
        entryFilePath,
      );
    },
  };
}
