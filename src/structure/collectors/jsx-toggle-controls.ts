// Collects toggle/switch controls for INPUT-TOGGLE-001 (must represent a
// binary state) and INPUT-TOGGLE-002 (should apply immediately).
//
// Scope is deliberately narrow: only a native checkbox with role="switch"
// (the WAI-ARIA switch pattern) or a design-system component declared with
// role: "switch" counts as a toggle. Plain checkboxes are unaffected, since
// a checkbox inside a submit-gated form is completely ordinary and not what
// this rule is about.
//
// The bound-value shape check is same-component only (Stage 1 in the
// project direction): it only resolves a simple `checked={identifier}`
// reference to a local `useState` declaration in the immediately enclosing
// function. Anything else — a prop, a member expression, a non-literal
// initializer — is left "unknown" and not reported, per the fail-safe
// philosophy the rest of the DSL and built-in rules follow.

import { StructureFactStore } from "../fact-store";
import type { UXLintProjectConfig } from "../../shared/rules-loader";
import { createComponentVocabulary } from "../../shared/design-system";
import {
  attrText,
  getJSXAttribute,
  getJSXName,
  isLowerTagName,
} from "./jsx-helpers";

function findEnclosingFunctionBody(node: any): any | null {
  let current = node?.parent;

  while (current) {
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      return current.body?.type === "BlockStatement" ? current.body : null;
    }
    current = current.parent;
  }

  return null;
}

function isUseStateCall(node: any): boolean {
  if (node?.type !== "CallExpression") return false;

  if (node.callee?.type === "Identifier" && node.callee.name === "useState") {
    return true;
  }

  return (
    node.callee?.type === "MemberExpression" &&
    node.callee.object?.type === "Identifier" &&
    node.callee.object.name === "React" &&
    node.callee.property?.type === "Identifier" &&
    node.callee.property.name === "useState" &&
    node.callee.computed === false
  );
}

// Only looks at the function's own top-level statements, mirroring
// collectStatePairsFromFunctionBody in interactions/collectors/state-pairs.ts.
// Kept as a narrower, self-contained lookup here rather than imported, since
// this only needs one declarator's initializer, not the full pair list.
function findLocalUseStateInitializer(
  functionBody: any,
  stateVarName: string,
): any {
  if (!Array.isArray(functionBody?.body)) return undefined;

  for (const statement of functionBody.body) {
    if (statement.type !== "VariableDeclaration") continue;

    for (const declarator of statement.declarations ?? []) {
      if (!isUseStateCall(declarator.init)) continue;

      const pattern = declarator.id;
      if (
        pattern?.type !== "ArrayPattern" ||
        pattern.elements?.[0]?.type !== "Identifier" ||
        pattern.elements[0].name !== stateVarName
      ) {
        continue;
      }

      return declarator.init.arguments?.[0];
    }
  }

  return undefined;
}

function classifyInitializerShape(
  initializerNode: any,
): "boolean" | "non-boolean" | "unknown" {
  if (!initializerNode) return "unknown";

  if (initializerNode.type === "Literal") {
    return typeof initializerNode.value === "boolean"
      ? "boolean"
      : "non-boolean";
  }

  if (
    initializerNode.type === "ArrayExpression" ||
    initializerNode.type === "ObjectExpression"
  ) {
    return "non-boolean";
  }

  if (
    initializerNode.type === "NewExpression" &&
    initializerNode.callee?.type === "Identifier" &&
    (initializerNode.callee.name === "Set" ||
      initializerNode.callee.name === "Map")
  ) {
    return "non-boolean";
  }

  return "unknown";
}

export function createJSXToggleControlsCollector(
  store: StructureFactStore,
  config: UXLintProjectConfig,
) {
  const vocabulary = createComponentVocabulary(config.designSystem);

  function JSXElement(node: any) {
    const opening = node.openingElement;
    if (!opening) return;

    const name = getJSXName(opening);

    const isNativeSwitch =
      name === "input" &&
      (attrText(opening, "type") ?? "").toLowerCase() === "checkbox" &&
      (attrText(opening, "role") ?? "").toLowerCase() === "switch";

    const isDeclaredSwitch =
      !isLowerTagName(name) && vocabulary.getComponentRole(name) === "switch";

    if (!isNativeSwitch && !isDeclaredSwitch) return;

    const checkedPropNames = isNativeSwitch
      ? ["checked"]
      : vocabulary.getCheckedProps(name);
    const checkedAttr = checkedPropNames
      .map((propName) => getJSXAttribute(opening, propName))
      .find(Boolean);
    const checkedExpression = checkedAttr?.value?.expression;

    let boundValueShape: "boolean" | "non-boolean" | "unknown" = "unknown";
    if (checkedExpression?.type === "Identifier") {
      const functionBody = findEnclosingFunctionBody(node);
      const initializer = functionBody
        ? findLocalUseStateInitializer(functionBody, checkedExpression.name)
        : undefined;
      boundValueShape = classifyInitializerShape(initializer);
    }

    store.addToggleControl({
      node,
      formId: store.currentForm()?.id,
      boundValueShape,
    });
  }

  return { JSXElement };
}
