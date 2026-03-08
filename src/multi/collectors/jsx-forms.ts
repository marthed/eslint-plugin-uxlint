import { MultiNodeFactStore } from "../fact-store";
import type { UXLintProjectConfig } from "../../shared/rules-loader";
import { attrText, getJSXName, hasAttr, isLowerTagName } from "./jsx-helpers";

function includesName(names: string[] | undefined, name: string | null): boolean {
  return !!name && !!names?.includes(name);
}

export function createJSXFormCollector(
  store: MultiNodeFactStore,
  config: UXLintProjectConfig
) {
  const ds = config.designSystem ?? {};

  function enterJSXElement(node: any) {
    const opening = node.openingElement;
    if (!opening) return;

    const name = getJSXName(opening);
    const isNative = isLowerTagName(name);

    // 1) Form scope start
    if (name === "form") {
      store.enterForm(node, "html", "native");
      return;
    }

    if (includesName(ds.formComponents, name)) {
      store.enterForm(node, "react", "design-system");
      return;
    }

    const currentForm = store.currentForm();
    if (!currentForm) return;

    // 2) Submit controls
    if (name === "button" && attrText(opening, "type") === "submit") {
      store.addSubmit({ node, kind: "native-submit" });
    }

    if (name === "input" && attrText(opening, "type") === "submit") {
      store.addSubmit({ node, kind: "native-submit" });
    }

    if (
      !isNative &&
      (name === "Button" || name === "SubmitButton") &&
      attrText(opening, "type") === "submit"
    ) {
      store.addSubmit({ node, kind: "button-submit" });
    }

    if (includesName(ds.submitComponents, name)) {
      store.addSubmit({ node, kind: "submit-component" });
    }

    // 3) Fields
    const isField =
      name === "input" ||
      name === "textarea" ||
      name === "select" ||
      includesName(ds.fieldComponents, name);

    if (isField) {
      const fieldErrorProps = ds.fieldErrorProps ?? ["error", "errorMessage", "invalid"];
      const hasErrorProp = fieldErrorProps.some((prop) => hasAttr(opening, prop));

      store.addField({
        node,
        name: attrText(opening, "name") ?? undefined,
        hasErrorProp,
      });

      if (hasErrorProp) {
        store.addErrorIndicator({
          node,
          kind: "field-error-prop",
        });
      }
    }

    // 4) Explicit error UI
    if (attrText(opening, "role") === "alert") {
      store.addErrorIndicator({ node, kind: "role-alert" });
    }

    if (hasAttr(opening, "aria-live")) {
      store.addErrorIndicator({ node, kind: "aria-live" });
    }

    if (includesName(ds.errorComponents, name)) {
      store.addErrorIndicator({ node, kind: "error-component" });
    }

    if (includesName(ds.errorSummaryComponents, name)) {
      store.addErrorIndicator({ node, kind: "error-summary" });
    }

    if (
      !isNative &&
      ["ErrorMessage", "InlineError", "FormError", "FormErrorSummary"].includes(name ?? "")
    ) {
      store.addErrorIndicator({
        node,
        kind: name === "FormErrorSummary" ? "error-summary" : "error-component",
      });
    }
  }

  function exitJSXElement(node: any) {
    const opening = node.openingElement;
    if (!opening) return;

    const name = getJSXName(opening);

    if (name === "form" || includesName(ds.formComponents, name)) {
      store.exitForm();
    }
  }

  return {
    JSXElement: enterJSXElement,
    "JSXElement:exit": exitJSXElement,
  };
}