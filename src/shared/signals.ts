import type { SourceCode } from "eslint"; 

type AnyNode = any;

function getJSXAttr(openingEl: AnyNode, name: string) {
  const attrs = openingEl.attributes ?? [];
  return attrs.find((a: AnyNode) => a?.type === "JSXAttribute" && a?.name?.name === name);
}

function literalToString(valueNode: AnyNode): string | null {
  if (!valueNode) return ""; // boolean attr
  if (valueNode.type === "Literal") return String(valueNode.value ?? "");
  if (valueNode.type === "JSXExpressionContainer") {
    const expr = valueNode.expression;
    if (expr?.type === "Literal") return String(expr.value ?? "");
    return null; // unknown expression
  }
  return null;
}

export type SignalContext = {
  node: AnyNode;
  sourceCode: SourceCode; 
  filename: string;
};

export type Signals = {
  // Common
  "node.type": string;

  // JSX
  "jsx.tag": string | null;
  "jsx.componentName": string | null;
  "jsx.hasAttr": (name: string) => boolean;
  "jsx.hasAnyAttr": (names: string[]) => boolean;
  "jsx.attrText": (name: string) => string | null;

  // Optional: file-level
  "file.path": string;
};

export function makeSignals(ctx: SignalContext): Signals {
  const { node, filename } = ctx;

  const opening = node?.type === "JSXOpeningElement" ? node : null;
  const nameNode = opening?.name;

  const jsxName =
    nameNode?.type === "JSXIdentifier" ? nameNode.name :
    nameNode?.type === "JSXMemberExpression" ? nameNode.property?.name :
    null;

  const isLowerTag = jsxName ? jsxName.toLowerCase() === jsxName : false;

  return {
    "node.type": node?.type ?? "Unknown",

    "jsx.tag": opening && isLowerTag ? jsxName : null,
    "jsx.componentName": opening && !isLowerTag ? jsxName : null,

    "jsx.hasAttr": (name: string) => {
      if (!opening) return false;
      return Boolean(getJSXAttr(opening, name));
    },

    "jsx.hasAnyAttr": (names: string[]) => {
      if (!opening) return false;
      return names.some((n) => Boolean(getJSXAttr(opening, n)));
    },

    "jsx.attrText": (name: string) => {
      if (!opening) return null;
      const attr = getJSXAttr(opening, name);
      if (!attr) return null;
      return literalToString(attr.value);
    },

    "file.path": filename,
  };
}