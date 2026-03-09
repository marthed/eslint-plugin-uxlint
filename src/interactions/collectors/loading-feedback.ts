import { InteractionStore } from "../store";
import { getInteractionScopeKey } from "../scope";
import {
  getJSXName,
  getJSXAttribute,
} from "../../multi/collectors/jsx-helpers";

function getExpressionIdentifier(attr: any): string | undefined {
  const value = attr?.value;
  if (!value || value.type !== "JSXExpressionContainer") return;

  const expr = value.expression;

  if (expr?.type === "Identifier") {
    return expr.name;
  }

  return;
}

function looksLikeSpinner(name: string | null): boolean {
  if (!name) return false;

  return [
    "Spinner",
    "Loader",
    "LoadingSpinner",
    "Progress",
    "CircularProgress",
    "LoadingIndicator",
  ].includes(name);
}

function looksLikeLoadingText(text: string | null): boolean {
  if (!text) return false;

  const lower = text.toLowerCase();

  return (
    lower.includes("loading") ||
    lower.includes("saving") ||
    lower.includes("submitting")
  );
}

export function createLoadingFeedbackCollector(store: InteractionStore) {
  return {
    JSXOpeningElement(node: any) {
      const name = getJSXName(node);
      const scopeKey = getInteractionScopeKey(node);

      const disabledAttr = getJSXAttribute(node, "disabled");
      const loadingAttr =
        getJSXAttribute(node, "loading") || getJSXAttribute(node, "isLoading");

      if (disabledAttr) {
        const feedback = {
          id: store.nextId("feedback"),
          node,
          scopeKey,
          kind: "disabled-control",
          stateKey: getExpressionIdentifier(disabledAttr),
        } as const;
        store.addLoadingFeedback(feedback);
      }

      if (loadingAttr) {
        const feedback = {
          id: store.nextId("feedback"),
          node,
          scopeKey,
          kind: "loading-prop",
          stateKey: getExpressionIdentifier(loadingAttr),
        } as const;
        store.addLoadingFeedback(feedback);
      }

      if (looksLikeSpinner(name)) {
        const feedback = {
          id: store.nextId("feedback"),
          node,
          scopeKey,
          kind: "spinner-component",
        } as const;
        store.addLoadingFeedback(feedback);
      }
    },

    JSXText(node: any) {
      const text = node.value?.trim();
      const scopeKey = getInteractionScopeKey(node);

      if (!text) return;

      if (looksLikeLoadingText(text)) {
        const feedback = {
          id: store.nextId("feedback"),
          node,
          scopeKey,
          kind: "loading-text",
        } as const;
        store.addLoadingFeedback(feedback);
      }
    },
  };
}
