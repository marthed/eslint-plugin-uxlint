// A tab panel that is conditionally rendered is destroyed every time the user
// switches away from it.
//
// The spec phrases this as ARIA housekeeping -- Tabs: "don't remove panels
// from the DOM when hidden; use `hidden` attribute instead" -- but the damage
// is not an announcement problem. Unmounting a panel throws away anything
// uncontrolled inside it, resets scroll position, stops media, and puts the
// content beyond the reach of the browser's own find. A sighted mouse user
// loses their work exactly as fast as anyone else.
//
// Scope is narrow on purpose. Conditional rendering is correct almost
// everywhere else -- a modal, an alert, an empty state should all unmount --
// so only an element that declares itself a tab panel counts.

import { walkAst } from "../../interactions/collectors/ast-helpers";
import { attrText, getJSXName, hasAttr } from "../../shared/jsx-helpers";
import { createComponentVocabulary } from "../../shared/design-system";
import type { UXLintProjectConfig } from "../../shared/rules-loader";

export type UnmountedPanelFact = {
  node: any;
};

function isTabPanel(
  node: any,
  vocabulary: ReturnType<typeof createComponentVocabulary>,
): boolean {
  if (node?.type !== "JSXElement") return false;
  const opening = node.openingElement;
  if (!opening) return false;

  if (attrText(opening, "role") === "tabpanel") return true;

  // Almost nobody hand-writes role="tabpanel" any more -- 3 files in an
  // 11,000-file corpus, against 56 using a library's panel component. A team
  // declares theirs with role: "tab-panel" to bring this rule into reach.
  return vocabulary.getComponentRole(getJSXName(opening)) === "tab-panel";
}

// Walks out of the panel looking for the conditional that gates it, stopping
// at the enclosing function so a condition elsewhere in the file cannot match.
function isConditionallyRendered(panelNode: any): boolean {
  let current = panelNode;
  let parent = panelNode?.parent;

  while (parent) {
    if (
      parent.type === "FunctionDeclaration" ||
      parent.type === "FunctionExpression" ||
      parent.type === "ArrowFunctionExpression"
    ) {
      return false;
    }

    // {active && <div role="tabpanel" />} -- the panel is the right operand.
    if (
      parent.type === "LogicalExpression" &&
      parent.right === current &&
      (parent.operator === "&&" || parent.operator === "||")
    ) {
      return true;
    }

    // {active ? <Panel /> : null} -- either branch is gated.
    if (
      parent.type === "ConditionalExpression" &&
      (parent.consequent === current || parent.alternate === current)
    ) {
      return true;
    }

    current = parent;
    parent = parent.parent;
  }

  return false;
}

export function collectUnmountedTabPanelsInFile(
  programNode: any,
  config: UXLintProjectConfig,
): UnmountedPanelFact[] {
  const facts: UnmountedPanelFact[] = [];
  const vocabulary = createComponentVocabulary(config.designSystem);

  walkAst(programNode, (current) => {
    if (!isTabPanel(current, vocabulary)) return;
    // `hidden` is the fix the spec asks for; if it is already there the panel
    // stays mounted whatever else surrounds it.
    if (hasAttr(current.openingElement, "hidden")) return;
    // Radix and friends keep a panel mounted when asked to.
    if (hasAttr(current.openingElement, "forceMount")) return;
    if (!isConditionallyRendered(current)) return;

    facts.push({ node: current });
  });

  return facts;
}
