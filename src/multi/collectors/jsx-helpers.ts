export function getJSXName(node: any): string | null {
  const nameNode = node?.name;
  if (!nameNode) return null;

  if (nameNode.type === "JSXIdentifier") return nameNode.name;
  if (nameNode.type === "JSXMemberExpression") return nameNode.property?.name ?? null;

  return null;
}

export function isLowerTagName(name: string | null): boolean {
  return !!name && name.toLowerCase() === name;
}

export function getJSXAttribute(openingEl: any, name: string) {
  const attrs = openingEl.attributes ?? [];
  return attrs.find(
    (a: any) => a?.type === "JSXAttribute" && a?.name?.name === name,
  );
}

export function getLiteralAttrValue(attr: any): string | null {
  if (!attr) return null;
  const v = attr.value;
  if (!v) return ""; // boolean attr
  if (v.type === "Literal") return String(v.value ?? "");
  if (v.type === "JSXExpressionContainer") {
    const expr = v.expression;
    if (expr?.type === "Literal") return String(expr.value ?? "");
    return null;
  }
  return null;
}

export function hasAttr(openingEl: any, name: string): boolean {
  return Boolean(getJSXAttribute(openingEl, name));
}

export function attrText(openingEl: any, name: string): string | null {
  return getLiteralAttrValue(getJSXAttribute(openingEl, name));
}