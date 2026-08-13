// Finds references to a set of trackable names (component state, or a
// parent's props) inside an arbitrary expression. Shared by the visible-read
// collectors and the prop-flow tracers, since both need to answer "does this
// expression read one of these names".

import {
  unwrapAssignmentPattern,
  walkAst,
  getObjectPatternPropertyKeyName,
} from "./ast-helpers";

// Full dotted path of a non-computed member chain rooted at an identifier:
// form.formState.isSubmitting. Needed for status models nested more than one
// level deep, such as react-hook-form's formState.
export function getFullMemberPath(node: any): string | null {
  const parts: string[] = [];
  let current = node;

  while (current?.type === "MemberExpression") {
    if (current.computed || current.property?.type !== "Identifier")
      return null;
    parts.unshift(current.property.name);
    current = current.object;
  }

  if (current?.type !== "Identifier") return null;
  parts.unshift(current.name);

  return parts.length > 1 ? parts.join(".") : null;
}

export function collectStateReferenceNames(
  expressionNode: any,
  stateNames: Set<string>,
): string[] {
  const foundStateNames = new Set<string>();
  if (!expressionNode) return [];

  walkAst(expressionNode, (current) => {
    if (current.type === "MemberExpression") {
      const fullPath = getFullMemberPath(current);
      if (fullPath && stateNames.has(fullPath)) {
        foundStateNames.add(fullPath);
        return;
      }
    }

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

export type ComponentPropAliases = {
  localAliasToPropName: Map<string, string>;
  propsObjectName?: string;
};

export function collectComponentPropAliases(
  componentFunctionNode: any,
): ComponentPropAliases {
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

export function collectPropReferenceNames(
  expressionNode: any,
  propAliases: ComponentPropAliases,
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
