// Finds a component's own useState pairs: const [value, setValue] = useState(...).

import type { StatePair } from "../types";

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

export function collectStatePairsFromFunctionBody(fnBody: any): StatePair[] {
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
