// Collects split-button usages for INPUT-SPLIT-001 (must expose a default
// action, not just a menu) and INPUT-SPLIT-002 (should not be used for
// navigation).
//
// There is no native HTML split-button primitive, so detection is entirely
// design-system driven: a component declared with role: "split-button" in
// designSystem.components. Evidence comes only from the JSX usage itself —
// which of the configured primaryActionProps/menuProps are present, and
// whether any of those prop values (or an href/to prop) look like
// navigation — not from tracing into the component's own implementation.

import { StructureFactStore } from "../fact-store";
import type { UXLintProjectConfig } from "../../shared/rules-loader";
import { createComponentVocabulary } from "../../shared/design-system";
import {
  getJSXAttribute,
  getJSXName,
  hasAttr,
  isLowerTagName,
} from "./jsx-helpers";
import {
  isLocationAssignmentTarget,
  isNavigationCallExpression,
} from "../../shared/navigation";

function containsNavigation(node: any): boolean {
  if (!node || typeof node.type !== "string") return false;

  if (node.type === "CallExpression" && isNavigationCallExpression(node)) {
    return true;
  }

  if (
    node.type === "AssignmentExpression" &&
    isLocationAssignmentTarget(node.left)
  ) {
    return true;
  }

  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const value = node[key];

    if (Array.isArray(value)) {
      if (value.some((entry) => containsNavigation(entry))) return true;
      continue;
    }

    if (value && typeof value === "object" && containsNavigation(value)) {
      return true;
    }
  }

  return false;
}

function elementIndicatesNavigation(
  opening: any,
  candidatePropNames: string[],
): boolean {
  if (hasAttr(opening, "href")) return true;
  if (hasAttr(opening, "to")) return true;

  for (const propName of candidatePropNames) {
    const attr = getJSXAttribute(opening, propName);
    const expression = attr?.value?.expression;
    if (!expression) continue;

    // Scan the whole prop value, not just a directly-inlined handler, so a
    // menu array of { label, onSelect } items is covered the same as a
    // single primaryAction={() => ...} handler.
    if (containsNavigation(expression)) return true;
  }

  return false;
}

export function createJSXSplitButtonsCollector(
  store: StructureFactStore,
  config: UXLintProjectConfig,
) {
  const vocabulary = createComponentVocabulary(config.designSystem);

  function JSXElement(node: any) {
    const opening = node.openingElement;
    if (!opening) return;

    const name = getJSXName(opening);
    if (isLowerTagName(name)) return;
    if (vocabulary.getComponentRole(name) !== "split-button") return;

    const primaryActionProps = vocabulary.getPrimaryActionProps(name);
    const menuProps = vocabulary.getMenuProps(name);

    const hasPrimaryAction = primaryActionProps.some((propName) =>
      hasAttr(opening, propName),
    );
    const navigatesToRoute = elementIndicatesNavigation(opening, [
      ...primaryActionProps,
      ...menuProps,
    ]);

    store.addSplitButton({
      node,
      componentName: name ?? undefined,
      hasPrimaryAction,
      navigatesToRoute,
    });
  }

  return { JSXElement };
}
