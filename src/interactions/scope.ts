const FUNCTION_LIKE_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function nodeRangeKey(node: any): string {
  if (Array.isArray(node?.range) && node.range.length >= 2) {
    return `${node.range[0]}-${node.range[1]}`;
  }

  const start = node?.loc?.start;
  const end = node?.loc?.end;
  if (start && end) {
    return `${start.line}:${start.column}-${end.line}:${end.column}`;
  }

  return "unknown";
}

export function getInteractionScopeKey(node: any): string {
  let current = node;

  while (current) {
    if (FUNCTION_LIKE_TYPES.has(current.type)) {
      return `fn:${nodeRangeKey(current)}`;
    }

    current = current.parent;
  }

  return "program";
}
