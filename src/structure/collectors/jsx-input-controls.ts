import { StructureFactStore } from "../fact-store";
import type { UXLintProjectConfig } from "../../shared/rules-loader";
import { createComponentVocabulary } from "../../shared/design-system";
import {
  attrText,
  getJSXAttribute,
  getJSXName,
  getLiteralAttrValue,
  isLowerTagName,
} from "../../shared/jsx-helpers";

function isTextLikeInputType(inputType: string): boolean {
  return ![
    "button",
    "checkbox",
    "color",
    "date",
    "datetime-local",
    "file",
    "hidden",
    "image",
    "month",
    "radio",
    "range",
    "reset",
    "submit",
    "time",
    "week",
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

// Design systems wrap the native element rather than exposing it, so
// <FieldLabel htmlFor="email"> is the same labelling as <label htmlFor="email">.
// Without these, every properly labelled design-system field looks unlabelled.
const DEFAULT_LABEL_COMPONENTS = [
  "Label",
  "FormLabel",
  "FieldLabel",
  "InputLabel",
];

function getWrappingLabelElement(
  node: any,
  isLabelName: (name: string | null) => boolean,
): any | null {
  let current = node?.parent;

  while (current) {
    if (current.type === "JSXElement") {
      const opening = current.openingElement;
      if (isLabelName(getJSXName(opening))) return current;
    }
    current = current.parent;
  }

  return null;
}

// Design systems commonly hand the control to a labelled wrapper rather than
// wrapping it in a <label>:
//
//   <FormRow label="Website" input={<input placeholder="example.com" />} />
//
// The visible label exists; it just lives on an ancestor component instead of
// on the control. Without this, every field built that way reads as
// placeholder-only.
function getLabellingAncestorText(
  node: any,
  labelProps: string[],
): string | undefined {
  let current = node?.parent;

  while (current) {
    if (current.type === "JSXElement") {
      const opening = current.openingElement;
      const name = getJSXName(opening);

      // Only components. A native ancestor with a `label` attribute is not a
      // labelling wrapper.
      if (name && !isLowerTagName(name)) {
        const text = getFirstTextAttr(opening, labelProps);
        if (text) return text;
      }
    }
    current = current.parent;
  }

  return undefined;
}

function getContainerKey(
  node: any,
  isLabelName: (name: string | null) => boolean,
): string | undefined {
  let current = node?.parent;

  while (current) {
    if (current.type === "JSXElement") {
      const opening = current.openingElement;
      if (!isLabelName(getJSXName(opening))) {
        return getElementKey(current);
      }
    }
    current = current.parent;
  }

  return undefined;
}

// A visible label in the same field group. Bounded to a few ancestors so this
// stays "the label next to this control" rather than "a label anywhere on the
// page". Used only to decide whether a *visible* label exists -- association is
// a separate question, and a separate rule.
const NEARBY_LABEL_ANCESTOR_LIMIT = 3;

function hasNearbyLabel(
  node: any,
  isLabelName: (name: string | null) => boolean,
): boolean {
  let current = node?.parent;
  let climbed = 0;

  while (current && climbed < NEARBY_LABEL_ANCESTOR_LIMIT) {
    if (current.type === "JSXElement") {
      climbed += 1;

      let found = false;
      const visit = (inner: any) => {
        if (found || !inner || typeof inner.type !== "string") return;
        if (inner === node) return;

        if (
          inner.type === "JSXElement" &&
          isLabelName(getJSXName(inner.openingElement)) &&
          extractNodeText(inner).trim().length > 0
        ) {
          found = true;
          return;
        }

        for (const key of Object.keys(inner)) {
          if (key === "parent") continue;
          const value = inner[key];
          if (Array.isArray(value)) {
            for (const entry of value) {
              if (entry && typeof entry === "object") visit(entry);
            }
          } else if (value && typeof value === "object") {
            visit(value);
          }
        }
      };

      visit(current);
      if (found) return true;
    }

    current = current.parent;
  }

  return false;
}

function getFirstTextAttr(openingEl: any, names: string[]): string | undefined {
  for (const name of names) {
    const value = attrText(openingEl, name);
    if (value) return value;
  }

  return undefined;
}

export function createJSXInputControlsCollector(
  store: StructureFactStore,
  config: UXLintProjectConfig,
) {
  const vocabulary = createComponentVocabulary(config.designSystem);
  const labelComponents =
    config.designSystem?.labelComponents ?? DEFAULT_LABEL_COMPONENTS;

  function isLabelName(name: string | null): boolean {
    return name === "label" || (!!name && labelComponents.includes(name));
  }

  function JSXElement(node: any) {
    const opening = node.openingElement;
    if (!opening) return;

    const name = getJSXName(opening);
    const formId = store.currentForm()?.id;

    if (isLabelName(name)) {
      store.addLabel({
        node,
        id: attrText(opening, "id") ?? undefined,
        htmlFor: attrText(opening, "htmlFor") ?? undefined,
        text: extractNodeText(node),
        formId,
      });
      return;
    }

    const wrappingLabel = getWrappingLabelElement(node, isLabelName);
    const wrappingLabelText =
      (wrappingLabel ? extractNodeText(wrappingLabel) : undefined) ??
      getLabellingAncestorText(node, vocabulary.getLabelProps(name));
    const containerKey = getContainerKey(node, isLabelName);
    const isWrappedByLabel = Boolean(wrappingLabel);
    const hasNearbyLabelText = hasNearbyLabel(node, isLabelName);

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
        hasNearbyLabelText,
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
        hasNearbyLabelText,
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
        hasNearbyLabelText,
        isDefaultSelected: false,
      });
      return;
    }

    const fieldRole = isLowerTagName(name)
      ? undefined
      : vocabulary.getFieldRole(name);
    if (!fieldRole) return;

    // Design-system fields usually forward `type` to a native input, so
    // <TextInput type="date" /> is a native date control wearing a component
    // name and should be treated exactly like <input type="date" />.
    const forwardedType = attrText(opening, "type")?.toLowerCase();
    if (forwardedType && !isTextLikeInputType(forwardedType)) return;

    const labelProp =
      getFirstTextAttr(opening, vocabulary.getLabelProps(name)) ?? undefined;

    if (fieldRole === "select") {
      store.addInputControl({
        node,
        kind: "design-system-select",
        componentName: name ?? undefined,
        formId,
        containerKey,
        name: attrText(opening, "name") ?? undefined,
        id: attrText(opening, "id") ?? undefined,
        labelProp,
        ariaLabel: attrText(opening, "aria-label") ?? undefined,
        ariaLabelledBy: attrText(opening, "aria-labelledby") ?? undefined,
        wrappingLabelText,
        isWrappedByLabel,
        hasNearbyLabelText,
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
      labelProp,
      ariaLabel: attrText(opening, "aria-label") ?? undefined,
      ariaLabelledBy: attrText(opening, "aria-labelledby") ?? undefined,
      wrappingLabelText,
      isWrappedByLabel,
      hasNearbyLabelText,
      isDefaultSelected: false,
    });
  }

  return {
    JSXElement,
  };
}
