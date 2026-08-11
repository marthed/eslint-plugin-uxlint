// Finds where a component's state (or a received prop) is read in a way
// that is visible to the user: disabled/loading props, visible host
// attributes, conditional rendering, or direct rendering.

import type { ComponentVocabulary } from "../../shared/design-system";
import type { PropRead, StateRead } from "../types";
import { getJSXName } from "../../structure/collectors/jsx-helpers";
import { isComponentJSXName, walkAst } from "./ast-helpers";
import {
  collectComponentPropAliases,
  collectPropReferenceNames,
  collectStateReferenceNames,
} from "./reference-names";

// Host-element attributes whose value change is user-visible. Event handlers,
// refs, keys, and data-* attributes are deliberately excluded.
const VISIBLE_HOST_ATTRIBUTES = new Set([
  "src",
  "href",
  "value",
  "checked",
  "selected",
  "open",
  "hidden",
  "alt",
  "title",
  "placeholder",
  "className",
  "style",
  "width",
  "height",
]);

function isVisibleHostAttribute(attributeName: unknown): boolean {
  if (typeof attributeName !== "string") return false;
  return (
    VISIBLE_HOST_ATTRIBUTES.has(attributeName) ||
    attributeName.startsWith("aria-")
  );
}

export function collectVisibleStateReads(
  componentFunctionNode: any,
  stateNames: Set<string>,
  vocabulary?: ComponentVocabulary,
): StateRead[] {
  const reads: StateRead[] = [];

  if (stateNames.size === 0) return reads;

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type === "JSXAttribute") {
        const expression = current.value?.expression;
        const stateVars = collectStateReferenceNames(expression, stateNames);
        if (stateVars.length === 0) return;

        const openingElement = current.parent;
        const ownerTagName =
          openingElement?.type === "JSXOpeningElement"
            ? getJSXName(openingElement)
            : null;
        const belongsToComponent = isComponentJSXName(ownerTagName);

        const propName = current.name?.name;

        if (belongsToComponent) {
          // Components declared in designSystem.components are trusted to
          // visibly render their disabled/loading props even when their
          // implementation cannot be traced (e.g. an external package).
          if (!vocabulary?.isDeclaredComponent(ownerTagName)) return;

          if (vocabulary.getDisabledProps(ownerTagName).includes(propName)) {
            for (const stateVar of stateVars) {
              reads.push({ stateVar, node: current, kind: "disabled-prop" });
            }
            return;
          }

          if (vocabulary.getLoadingProps(ownerTagName).includes(propName)) {
            for (const stateVar of stateVars) {
              reads.push({ stateVar, node: current, kind: "loading-prop" });
            }
          }
          return;
        }

        if (propName === "disabled") {
          for (const stateVar of stateVars) {
            reads.push({ stateVar, node: current, kind: "disabled-prop" });
          }
          return;
        }

        if (propName === "loading" || propName === "isLoading") {
          for (const stateVar of stateVars) {
            reads.push({ stateVar, node: current, kind: "loading-prop" });
          }
          return;
        }

        if (isVisibleHostAttribute(propName)) {
          for (const stateVar of stateVars) {
            reads.push({
              stateVar,
              node: current,
              kind: "generic-visible-read",
            });
          }
          return;
        }

        return;
      }

      if (current.type === "LogicalExpression" && current.operator === "&&") {
        const leftStateVars = collectStateReferenceNames(
          current.left,
          stateNames,
        );
        for (const stateVar of leftStateVars) {
          reads.push({
            stateVar,
            node: current,
            kind: "conditional-render",
          });
        }
        return;
      }

      if (current.type === "ConditionalExpression") {
        const testStateVars = collectStateReferenceNames(
          current.test,
          stateNames,
        );
        for (const stateVar of testStateVars) {
          reads.push({
            stateVar,
            node: current,
            kind: "ternary-render",
          });
        }
        return;
      }

      if (
        current.type === "JSXExpressionContainer" &&
        current.parent?.type !== "JSXAttribute"
      ) {
        const expressionStateVars = collectStateReferenceNames(
          current.expression,
          stateNames,
        );
        for (const stateVar of expressionStateVars) {
          reads.push({
            stateVar,
            node: current,
            kind: "generic-visible-read",
          });
        }
      }
    },
    { skipNestedFunctions: true },
  );

  return reads;
}

export function collectVisiblePropReads(
  componentFunctionNode: any,
  vocabulary?: ComponentVocabulary,
): PropRead[] {
  const reads: PropRead[] = [];
  const propAliases = collectComponentPropAliases(componentFunctionNode);

  if (
    propAliases.localAliasToPropName.size === 0 &&
    !propAliases.propsObjectName
  ) {
    return reads;
  }

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type === "JSXAttribute") {
        const propNames = collectPropReferenceNames(
          current.value?.expression,
          propAliases,
        );
        if (propNames.length === 0) return;

        const openingElement = current.parent;
        const ownerTagName =
          openingElement?.type === "JSXOpeningElement"
            ? getJSXName(openingElement)
            : null;
        const attributeName = current.name?.name;

        const declaredOwner = vocabulary?.isDeclaredComponent(ownerTagName)
          ? ownerTagName
          : null;
        if (declaredOwner) {
          if (
            vocabulary!.getDisabledProps(declaredOwner).includes(attributeName)
          ) {
            for (const propName of propNames) {
              reads.push({ propName, node: current, kind: "disabled-prop" });
            }
            return;
          }

          if (
            vocabulary!.getLoadingProps(declaredOwner).includes(attributeName)
          ) {
            for (const propName of propNames) {
              reads.push({ propName, node: current, kind: "loading-prop" });
            }
            return;
          }
        }

        if (attributeName === "disabled") {
          for (const propName of propNames) {
            reads.push({ propName, node: current, kind: "disabled-prop" });
          }
          return;
        }

        if (attributeName === "loading" || attributeName === "isLoading") {
          for (const propName of propNames) {
            reads.push({ propName, node: current, kind: "loading-prop" });
          }
          return;
        }

        if (
          !isComponentJSXName(ownerTagName) &&
          isVisibleHostAttribute(attributeName)
        ) {
          for (const propName of propNames) {
            reads.push({
              propName,
              node: current,
              kind: "generic-visible-read",
            });
          }
          return;
        }

        return;
      }

      if (current.type === "LogicalExpression" && current.operator === "&&") {
        const leftPropNames = collectPropReferenceNames(
          current.left,
          propAliases,
        );
        for (const propName of leftPropNames) {
          reads.push({
            propName,
            node: current,
            kind: "conditional-render",
          });
        }

        const rightPropNames = collectPropReferenceNames(
          current.right,
          propAliases,
        );
        for (const propName of rightPropNames) {
          reads.push({
            propName,
            node: current,
            kind: "generic-visible-read",
          });
        }
        return;
      }

      if (current.type === "ConditionalExpression") {
        const testPropNames = collectPropReferenceNames(
          current.test,
          propAliases,
        );
        for (const propName of testPropNames) {
          reads.push({
            propName,
            node: current,
            kind: "ternary-render",
          });
        }

        const consequentPropNames = collectPropReferenceNames(
          current.consequent,
          propAliases,
        );
        for (const propName of consequentPropNames) {
          reads.push({
            propName,
            node: current,
            kind: "generic-visible-read",
          });
        }

        const alternatePropNames = collectPropReferenceNames(
          current.alternate,
          propAliases,
        );
        for (const propName of alternatePropNames) {
          reads.push({
            propName,
            node: current,
            kind: "generic-visible-read",
          });
        }
        return;
      }

      if (
        current.type === "JSXExpressionContainer" &&
        current.parent?.type !== "JSXAttribute"
      ) {
        const propNames = collectPropReferenceNames(
          current.expression,
          propAliases,
        );
        for (const propName of propNames) {
          reads.push({
            propName,
            node: current,
            kind: "generic-visible-read",
          });
        }
      }
    },
    { skipNestedFunctions: true },
  );

  return reads;
}
