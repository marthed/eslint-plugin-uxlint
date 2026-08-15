// Traces how state, props, and handlers flow from a component into its
// JSX children: state/prop values passed as child props, handler references
// passed as child props, and prop-shaped functions the handler itself calls
// (a parent-supplied onSuccess/onError callback, for example).

import type {
  HandlerPropCall,
  HandlerPropPass,
  InteractionHandler,
  PropPass,
  PropSpreadPass,
  StatePropPass,
} from "../types";
import { getJSXName } from "../../structure/collectors/jsx-helpers";
import { isComponentJSXName, walkAst } from "./ast-helpers";
import {
  collectComponentPropAliases,
  collectPropReferenceNames,
  collectStateReferenceNames,
  type ComponentPropAliases,
} from "./reference-names";

export function extractDirectCalledHandlerName(
  expressionNode: any,
): string | null {
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

export function collectStatePropPasses(
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

export function collectPropPasses(componentFunctionNode: any): {
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

export function collectHandlerPropPasses(
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
          candidateHandlerName = extractDirectCalledHandlerName(
            expression.body,
          );
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
  propAliases: ComponentPropAliases,
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

export function collectHandlerPropCalls(
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
    // Nested functions are included: outcome callbacks routinely live in a
    // promise chain — fetch(...).then(ok, err).catch(err) — and a prop called
    // from there is still this handler delegating its outcome to the parent.
    // State-write tracing already walks nested functions, so this keeps the
    // two consistent.
    walkAst(handler.node.body ?? handler.node, (current) => {
      if (current.type !== "CallExpression") return;

      const propName = resolveCalledPropName(current.callee, propAliases);
      if (!propName) return;

      calls.push({
        handlerId: handler.id,
        propName,
        node: current,
      });
    });
  }

  return calls;
}
