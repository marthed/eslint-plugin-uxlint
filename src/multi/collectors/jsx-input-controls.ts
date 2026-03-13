import { MultiNodeFactStore } from "../fact-store";
import type { UXLintProjectConfig } from "../../shared/rules-loader";
import {
  attrText,
  getJSXAttribute,
  getJSXName,
  getLiteralAttrValue,
  isLowerTagName,
} from "./jsx-helpers";

function includesName(
  names: string[] | undefined,
  name: string | null,
): boolean {
  return !!name && !!names?.includes(name);
}

function isTextLikeInputType(inputType: string): boolean {
  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(inputType);
}

function hasTruthyishAttr(openingEl: any, name: string): boolean {
  const value = getLiteralAttrValue(getJSXAttribute(openingEl, name));
  if (value === null) return Boolean(getJSXAttribute(openingEl, name));
  if (value === "") return true;
  return value !== "false";
}

function getElementKey(node: any): string | undefined {
  if (Array.isArray(node?.range) && typeof node.range[0] === "number") {
    return String(node.range[0]);
  }

  return undefined;
}

function normalizeText(parts: string[]): string {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function extractNodeText(node: any): string {
  const parts: string[] = [];

  function visit(current: any) {
    if (!current) return;

    if (current.type === "JSXText" && typeof current.value === "string") {
      parts.push(current.value);
      return;
    }

    if (current.type === "Literal") {
      if (
        typeof current.value === "string" ||
        typeof current.value === "number"
      ) {
        parts.push(String(current.value));
      }
      return;
    }

    if (current.type === "JSXExpressionContainer") {
      visit(current.expression);
      return;
    }

    if (Array.isArray(current.children)) {
      for (const child of current.children) {
        visit(child);
      }
    }
  }

  visit(node);
  return normalizeText(parts);
}

function getWrappingLabelElement(node: any): any | null {
  let current = node?.parent;

  while (current) {
    if (current.type === "JSXElement") {
      const opening = current.openingElement;
      if (getJSXName(opening) === "label") return current;
    }
    current = current.parent;
  }

  return null;
}

function getContainerKey(node: any): string | undefined {
  let current = node?.parent;

  while (current) {
    if (current.type === "JSXElement") {
      const opening = current.openingElement;
      if (getJSXName(opening) !== "label") {
        return getElementKey(current);
      }
    }
    current = current.parent;
  }

  return undefined;
}

function getFirstTextAttr(openingEl: any, names: string[]): string | undefined {
  for (const name of names) {
    const value = attrText(openingEl, name);
    if (value) return value;
  }

  return undefined;
}

export function createJSXInputControlsCollector(
  store: MultiNodeFactStore,
  config: UXLintProjectConfig,
) {
  const ds = config.designSystem ?? {};

  function JSXElement(node: any) {
    const opening = node.openingElement;
    if (!opening) return;

    const name = getJSXName(opening);
    const formId = store.currentForm()?.id;

    if (name === "label") {
      store.addLabel({
        node,
        id: attrText(opening, "id") ?? undefined,
        htmlFor: attrText(opening, "htmlFor") ?? undefined,
        text: extractNodeText(node),
        formId,
      });
      return;
    }

    const wrappingLabel = getWrappingLabelElement(node);
    const wrappingLabelText = wrappingLabel
      ? extractNodeText(wrappingLabel)
      : undefined;
    const containerKey = getContainerKey(node);
    const isWrappedByLabel = Boolean(wrappingLabel);

    if (name === "input") {
      const inputType = (attrText(opening, "type") ?? "text").toLowerCase();
      const common = {
        node,
        inputType,
        formId,
        containerKey,
        name: attrText(opening, "name") ?? undefined,
        id: attrText(opening, "id") ?? undefined,
        value: attrText(opening, "value") ?? undefined,
        placeholder: attrText(opening, "placeholder") ?? undefined,
        ariaLabel: attrText(opening, "aria-label") ?? undefined,
        ariaLabelledBy: attrText(opening, "aria-labelledby") ?? undefined,
        wrappingLabelText,
        isWrappedByLabel,
        isDefaultSelected:
          hasTruthyishAttr(opening, "checked") ||
          hasTruthyishAttr(opening, "defaultChecked"),
      };

      if (inputType === "checkbox" || inputType === "radio") {
        store.addInputControl({
          ...common,
          kind: inputType,
        });
        return;
      }

      if (isTextLikeInputType(inputType)) {
        store.addInputControl({
          ...common,
          kind: "text-input",
        });
      }

      return;
    }

    if (name === "textarea") {
      store.addInputControl({
        node,
        kind: "textarea",
        componentName: name,
        formId,
        containerKey,
        name: attrText(opening, "name") ?? undefined,
        id: attrText(opening, "id") ?? undefined,
        placeholder: attrText(opening, "placeholder") ?? undefined,
        ariaLabel: attrText(opening, "aria-label") ?? undefined,
        ariaLabelledBy: attrText(opening, "aria-labelledby") ?? undefined,
        wrappingLabelText,
        isWrappedByLabel,
        isDefaultSelected: false,
      });
      return;
    }

    if (name === "select") {
      store.addInputControl({
        node,
        kind: "select",
        componentName: name,
        formId,
        containerKey,
        name: attrText(opening, "name") ?? undefined,
        id: attrText(opening, "id") ?? undefined,
        ariaLabel: attrText(opening, "aria-label") ?? undefined,
        ariaLabelledBy: attrText(opening, "aria-labelledby") ?? undefined,
        wrappingLabelText,
        isWrappedByLabel,
        isDefaultSelected: false,
      });
      return;
    }

    if (!includesName(ds.fieldComponents, name) || isLowerTagName(name)) {
      return;
    }

    if (/select/i.test(name ?? "")) {
      store.addInputControl({
        node,
        kind: "design-system-select",
        componentName: name ?? undefined,
        formId,
        containerKey,
        name: attrText(opening, "name") ?? undefined,
        id: attrText(opening, "id") ?? undefined,
        labelProp:
          getFirstTextAttr(opening, ["label", "labelText"]) ?? undefined,
        ariaLabel: attrText(opening, "aria-label") ?? undefined,
        ariaLabelledBy: attrText(opening, "aria-labelledby") ?? undefined,
        wrappingLabelText,
        isWrappedByLabel,
        isDefaultSelected: false,
      });
      return;
    }

    store.addInputControl({
      node,
      kind: "design-system-field",
      componentName: name ?? undefined,
      formId,
      containerKey,
      name: attrText(opening, "name") ?? undefined,
      id: attrText(opening, "id") ?? undefined,
      placeholder: attrText(opening, "placeholder") ?? undefined,
      labelProp: getFirstTextAttr(opening, ["label", "labelText"]) ?? undefined,
      ariaLabel: attrText(opening, "aria-label") ?? undefined,
      ariaLabelledBy: attrText(opening, "aria-labelledby") ?? undefined,
      wrappingLabelText,
      isWrappedByLabel,
      isDefaultSelected: false,
    });
  }

  return {
    JSXElement,
  };
}
