import { InteractionStore } from "../store";
import {
  getJSXAttribute,
  getJSXName,
  attrText,
} from "../../multi/collectors/jsx-helpers";

function extractHandlerName(attr: any): string | undefined {
  const value = attr?.value;
  if (!value || value.type !== "JSXExpressionContainer") return undefined;

  const expr = value.expression;
  if (expr?.type === "Identifier") return expr.name;

  return undefined;
}

function findOwningComponentName(node: any): string {
  let current = node.parent;

  while (current) {
    if (current.type === "FunctionDeclaration" && current.id?.name) {
      return current.id.name;
    }

    if (
      current.type === "VariableDeclarator" &&
      current.id?.type === "Identifier" &&
      (current.init?.type === "ArrowFunctionExpression" ||
        current.init?.type === "FunctionExpression")
    ) {
      return current.id.name;
    }

    current = current.parent;
  }

  return "UnknownComponent";
}

export function createEventSourceCollector(store: InteractionStore) {
  return {
    JSXOpeningElement(node: any) {
      const onClick = getJSXAttribute(node, "onClick");
      const onSubmit = getJSXAttribute(node, "onSubmit");
      const onPress = getJSXAttribute(node, "onPress");

      const handlerAttr = onSubmit || onClick || onPress;
      if (!handlerAttr) return;

      const componentName = findOwningComponentName(node);

      store.addInteraction(componentName, {
        id: store.nextId("interaction"),
        node,
        eventName: onSubmit ? "onSubmit" : onClick ? "onClick" : "onPress",
        componentName: getJSXName(node) ?? undefined,
        label: attrText(node, "aria-label") ?? undefined,
        handlerName: extractHandlerName(handlerAttr),
      });
    },
  };
}
