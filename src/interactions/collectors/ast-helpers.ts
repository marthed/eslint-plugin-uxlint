// Generic AST utilities shared across the component-state collectors.
// Nothing here knows about React, forms, or UX heuristics — just node
// walking and structural predicates.

const FUNCTION_LIKE_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

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

export function walkAst(
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

export function getNodeStart(node: any): number | null {
  if (Array.isArray(node?.range) && typeof node.range[0] === "number") {
    return node.range[0];
  }

  return null;
}

export function getMemberExpressionName(node: any): string | null {
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

export function getCallTargetName(node: any): string {
  if (node?.type === "Identifier") return node.name;

  const memberExpressionName = getMemberExpressionName(node);
  if (memberExpressionName) return memberExpressionName;

  return "<call>";
}

export function unwrapAssignmentPattern(node: any): any {
  if (node?.type === "AssignmentPattern") return node.left;
  return node;
}

export function getObjectPatternPropertyKeyName(
  propertyNode: any,
): string | null {
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

export function isReactComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

export function isComponentJSXName(name: string | null): name is string {
  return Boolean(name && /^[A-Z]/.test(name));
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

export function inferIsAsyncHandler(handlerNode: any): boolean {
  return Boolean(handlerNode?.async) || handlerContainsAwait(handlerNode);
}
