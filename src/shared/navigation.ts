// Structural predicates for recognizing navigation: router/history method
// calls, navigate()/redirect() function calls, and window.location writes.
// Pure node-shape checks with no tree walking of their own, so both the
// interaction-feedback write tracer and the split-button evaluator can use
// them without needing a shared AST walker.

const NAVIGATION_OBJECT_NAMES = new Set([
  "router",
  "history",
  "location",
  "navigation",
]);
const NAVIGATION_METHOD_NAMES = new Set([
  "push",
  "replace",
  "assign",
  "reload",
  "back",
  "refresh",
  "navigate",
  "go",
]);
const NAVIGATION_FUNCTION_NAMES = new Set(["navigate", "redirect"]);
const LOCATION_ASSIGNMENT_PROPERTIES = new Set([
  "href",
  "pathname",
  "hash",
  "search",
]);

function memberChainContainsName(node: any, names: Set<string>): boolean {
  let current = node;

  while (current) {
    if (current.type === "Identifier") return names.has(current.name);
    if (current.type !== "MemberExpression" || current.computed) return false;
    if (
      current.property?.type === "Identifier" &&
      names.has(current.property.name)
    ) {
      return true;
    }
    current = current.object;
  }

  return false;
}

export function isNavigationCallExpression(callExpressionNode: any): boolean {
  const callee = callExpressionNode?.callee;

  if (callee?.type === "Identifier") {
    return NAVIGATION_FUNCTION_NAMES.has(callee.name);
  }

  if (
    callee?.type === "MemberExpression" &&
    callee.computed === false &&
    callee.property?.type === "Identifier" &&
    NAVIGATION_METHOD_NAMES.has(callee.property.name)
  ) {
    return memberChainContainsName(callee.object, NAVIGATION_OBJECT_NAMES);
  }

  return false;
}

export function isLocationAssignmentTarget(assignmentLeftNode: any): boolean {
  if (
    assignmentLeftNode?.type !== "MemberExpression" ||
    assignmentLeftNode.computed !== false ||
    assignmentLeftNode.property?.type !== "Identifier" ||
    !LOCATION_ASSIGNMENT_PROPERTIES.has(assignmentLeftNode.property.name)
  ) {
    return false;
  }

  return memberChainContainsName(
    assignmentLeftNode.object,
    new Set(["location"]),
  );
}
