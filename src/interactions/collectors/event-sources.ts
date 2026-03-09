import { InteractionStore } from "../store";
import { getInteractionScopeKey } from "../scope";
import {
  getJSXName,
  getJSXAttribute,
  attrText,
} from "../../multi/collectors/jsx-helpers";

function extractHandler(attr: any) {
  const value = attr?.value;
  if (!value || value.type !== "JSXExpressionContainer") return null;

  const expr = value.expression;

  if (!expr) return null;

  if (expr.type === "Identifier") {
    return { type: "named", name: expr.name };
  }

  if (
    expr.type === "ArrowFunctionExpression" ||
    expr.type === "FunctionExpression"
  ) {
    return { type: "inline", node: expr };
  }

  return null;
}

export function createEventSourceCollector(store: InteractionStore) {
  return {
    JSXOpeningElement(node: any) {
      const name = getJSXName(node);
      if (!name) return;

      const onClick = getJSXAttribute(node, "onClick");
      const onSubmit = getJSXAttribute(node, "onSubmit");
      const onPress = getJSXAttribute(node, "onPress");

      const attr = onSubmit || onClick || onPress;
      if (!attr) return;

      const handler = extractHandler(attr);
      const scopeKey = getInteractionScopeKey(node);

      const sourceId = store.nextId("source");
      const handlerId =
        handler?.type === "inline" && handler.node.async
          ? store.nextId("handler")
          : undefined;

      store.addSource({
        id: sourceId,
        node,
        scopeKey,
        eventName: onSubmit ? "onSubmit" : onClick ? "onClick" : "onPress",
        componentName: name,
        label: attrText(node, "aria-label") ?? undefined,
        handlerId,
        handlerName: handler?.type === "named" ? handler.name : undefined,
      });

      // If handler is inline async
      if (handler?.type === "inline") {
        const fn = handler.node;

        if (fn.async) {
          store.addHandler({
            id: handlerId ?? store.nextId("handler"),
            name: `inline-${sourceId}`,
            node: fn,
            scopeKey,
            asyncKind: "async-function",
            stateKeysSetLoading: [],
          });
        }
      }
    },
  };
}
