import {
  attrText,
  getJSXAttribute,
  getJSXName,
} from "../../multi/collectors/jsx-helpers";
import { InteractionStore } from "../store";
import type {
  InteractionHandler,
  InteractionPhase,
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

function collectNamedFunctionsInSameFile(componentFunctionNode: any): Map<string, any> {
  const functionsByName = new Map<string, any>();
  const programNode = getProgramNode(componentFunctionNode);
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
): InteractionPhase {
  if (!isAsyncHandler) return "sync";
  if (isInsideFinally(writeNode)) return "settled";
  if (isInsideCatch(writeNode)) return "error";

  const writeStart = getNodeStart(writeNode);
  if (firstAwaitStart !== null && writeStart !== null && writeStart < firstAwaitStart) {
    return "start";
  }

  if (firstAwaitStart !== null) return "success";
  return "start";
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
  helperFunctionsByName: Map<string, any>,
): StateWrite[] {
  const setterToState = new Map(
    statePairs.map((pair) => [pair.setterVar, pair.stateVar]),
  );
  const firstAwaitStart = handler.isAsync ? findFirstAwaitStart(handler.node) : null;

  function collectWritesFromFunction(
    functionNode: any,
    setterAliases: Map<string, string>,
    phaseAnchorNode: any | null,
    activeHelpers: Set<string>,
  ): StateWrite[] {
    const writes: StateWrite[] = [];

    walkAst(
      functionNode.body ?? functionNode,
      (current) => {
        if (current.type !== "CallExpression") return;
        if (current.callee?.type !== "Identifier") return;

        const calleeName = current.callee.name;
        const stateVar = setterAliases.get(calleeName);
        if (stateVar) {
          writes.push({
            handlerId: handler.id,
            stateVar,
            setterVar: calleeName,
            phase: classifyStateWritePhase(
              phaseAnchorNode ?? current,
              handler.isAsync,
              firstAwaitStart,
            ),
            node: current,
          });
          return;
        }

        const helperFunctionNode = helperFunctionsByName.get(calleeName);
        if (!helperFunctionNode) return;
        if (activeHelpers.has(calleeName)) return;

        const helperSetterAliases = new Map(setterAliases);
        const helperParams = Array.isArray(helperFunctionNode.params)
          ? helperFunctionNode.params
          : [];
        const helperArgs = Array.isArray(current.arguments) ? current.arguments : [];

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
        nestedHelpers.add(calleeName);
        writes.push(
          ...collectWritesFromFunction(
            helperFunctionNode,
            helperSetterAliases,
            phaseAnchorNode ?? current,
            nestedHelpers,
          ),
        );
      },
      { skipNestedFunctions: true },
    );

    return writes;
  }

  const writes = collectWritesFromFunction(
    handler.node,
    setterToState,
    null,
    new Set<string>(),
  );

  if (!handler.isAsync) return writes;

  // Treat post-await writes that clear a pending flag as settled feedback
  // when the same state var was set to true in start.
  const startPendingStateVars = new Set(
    writes
      .filter(
        (write) =>
          write.phase === "start" && getBooleanLiteralArgument(write.node) === true,
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

function getStateIdentifierName(
  expressionNode: any,
  stateNames: Set<string>,
): string | null {
  if (expressionNode?.type !== "Identifier") return null;
  if (!stateNames.has(expressionNode.name)) return null;
  return expressionNode.name;
}

function collectStateIdentifierNames(
  expressionNode: any,
  stateNames: Set<string>,
): string[] {
  const foundStateNames = new Set<string>();
  if (!expressionNode) return [];

  walkAst(expressionNode, (current) => {
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
  if (!propertyNode || propertyNode.type !== "Property" || propertyNode.computed) {
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
  propAliases: { localAliasToPropName: Map<string, string>; propsObjectName?: string },
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
  statePairs: StatePair[],
): StatePropPass[] {
  const passes: StatePropPass[] = [];
  const stateNames = new Set(statePairs.map((pair) => pair.stateVar));

  if (stateNames.size === 0) return passes;

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type !== "JSXAttribute") return;

      const expression = current.value?.expression;
      const stateVars = collectStateIdentifierNames(expression, stateNames);
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

function collectVisibleStateReads(
  componentFunctionNode: any,
  statePairs: StatePair[],
): StateRead[] {
  const reads: StateRead[] = [];
  const stateNames = new Set(statePairs.map((pair) => pair.stateVar));

  if (stateNames.size === 0) return reads;

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type === "JSXAttribute") {
        const expression = current.value?.expression;
        const stateVar = getStateIdentifierName(expression, stateNames);
        if (!stateVar) return;

        const openingElement = current.parent;
        const ownerTagName =
          openingElement?.type === "JSXOpeningElement"
            ? getJSXName(openingElement)
            : null;
        const belongsToComponent = isComponentJSXName(ownerTagName);

        const propName = current.name?.name;
        if (propName === "disabled" && !belongsToComponent) {
          reads.push({ stateVar, node: current, kind: "disabled-prop" });
          return;
        }

        if (
          (propName === "loading" || propName === "isLoading") &&
          !belongsToComponent
        ) {
          reads.push({ stateVar, node: current, kind: "loading-prop" });
          return;
        }

        return;
      }

      if (
        current.type === "LogicalExpression" &&
        current.operator === "&&" &&
        current.left?.type === "Identifier" &&
        stateNames.has(current.left.name)
      ) {
        reads.push({
          stateVar: current.left.name,
          node: current,
          kind: "conditional-render",
        });
        return;
      }

      if (
        current.type === "ConditionalExpression" &&
        current.test?.type === "Identifier" &&
        stateNames.has(current.test.name)
      ) {
        reads.push({
          stateVar: current.test.name,
          node: current,
          kind: "ternary-render",
        });
        return;
      }

      if (
        current.type === "JSXExpressionContainer" &&
        current.parent?.type !== "JSXAttribute" &&
        current.expression?.type === "Identifier" &&
        stateNames.has(current.expression.name)
      ) {
        reads.push({
          stateVar: current.expression.name,
          node: current,
          kind: "generic-visible-read",
        });
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
        const leftPropNames = collectPropReferenceNames(current.left, propAliases);
        for (const propName of leftPropNames) {
          reads.push({
            propName,
            node: current,
            kind: "conditional-render",
          });
        }

        const rightPropNames = collectPropReferenceNames(current.right, propAliases);
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
        const testPropNames = collectPropReferenceNames(current.test, propAliases);
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
        const propNames = collectPropReferenceNames(current.expression, propAliases);
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
  helperFunctionsByName: Map<string, any>,
  store: InteractionStore,
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
    const delegatedHandlerName = extractDirectCalledHandlerName(expression.body);
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
        helperFunctionsByName,
      ),
    };
  }

  return {};
}

function collectInteractionsAndInlineHandlers(
  componentFunctionNode: any,
  statePairs: StatePair[],
  namedHandlersByName: Map<string, InteractionHandler>,
  helperFunctionsByName: Map<string, any>,
  store: InteractionStore,
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
        helperFunctionsByName,
        store,
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
): {
  statePairs: StatePair[];
  handlers: InteractionHandler[];
  stateWrites: StateWrite[];
  stateReads: StateRead[];
  propReads: PropRead[];
  statePropPasses: StatePropPass[];
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
  const statePairs = collectStatePairsFromFunctionBody(componentFunctionNode.body);
  const namedHandlers = collectNamedHandlers(componentFunctionNode, store);
  const helperFunctionsByName = collectNamedFunctionsInSameFile(componentFunctionNode);
  const handlersByName = new Map(namedHandlers.map((handler) => [handler.name, handler]));

  const stateWrites: StateWrite[] = [];
  for (const handler of namedHandlers) {
    stateWrites.push(
      ...collectStateWritesForHandler(handler, statePairs, helperFunctionsByName),
    );
  }

  const stateReads = collectVisibleStateReads(componentFunctionNode, statePairs);
  const propReads = collectVisiblePropReads(componentFunctionNode);
  const statePropPasses = collectStatePropPasses(componentFunctionNode, statePairs);
  const interactionData = collectInteractionsAndInlineHandlers(
    componentFunctionNode,
    statePairs,
    handlersByName,
    helperFunctionsByName,
    store,
  );

  return {
    statePairs,
    handlers: [...namedHandlers, ...interactionData.inlineHandlers],
    stateWrites: [...stateWrites, ...interactionData.inlineWrites],
    stateReads,
    propReads,
    statePropPasses,
    interactions: interactionData.interactions,
  };
}

function collectComponentIntoStore(node: any, store: InteractionStore) {
  const componentInput = getComponentModelInput(node);
  if (!componentInput) return;

  store.ensureComponent(componentInput.componentName);

  const componentFacts = collectComponentFacts(componentInput.functionNode, store);

  for (const statePair of componentFacts.statePairs) {
    store.addStatePair(componentInput.componentName, statePair);
  }

  for (const handler of componentFacts.handlers) {
    store.addHandler(componentInput.componentName, handler);
  }

  for (const stateWrite of componentFacts.stateWrites) {
    store.addStateWrite(componentInput.componentName, stateWrite);
  }

  for (const stateRead of componentFacts.stateReads) {
    store.addStateRead(componentInput.componentName, stateRead);
  }

  for (const propRead of componentFacts.propReads) {
    store.addPropRead(componentInput.componentName, propRead);
  }

  for (const statePropPass of componentFacts.statePropPasses) {
    store.addStatePropPass(componentInput.componentName, statePropPass);
  }

  for (const interaction of componentFacts.interactions) {
    store.addInteraction(componentInput.componentName, interaction);
  }
}

export function createComponentStateCollector(store: InteractionStore) {
  return {
    FunctionDeclaration(node: any) {
      collectComponentIntoStore(node, store);
    },

    VariableDeclarator(node: any) {
      collectComponentIntoStore(node, store);
    },
  };
}
