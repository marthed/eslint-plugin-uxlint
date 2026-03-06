import type { Rule } from "eslint";
import { loadHeuristics, loadUXLintConfig } from "../shared/rules-loader";
import { makeSignals } from "../shared/signals";
import { evalExpr, type Expr } from "../shared/dsl";

import { MultiNodeFactStore } from "../multi/fact-store";
import { createJSXFormCollector } from "../multi/collectors/jsx-forms";
import { evaluateFormHasSubmitButNoErrorState } from "../multi/evaluators/form-submit-without-error";

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Apply UX heuristics defined in uxlint rules and multi-node evaluators",
    },
    schema: [],
    messages: {
      uxFinding: "{{message}}",
    },
  },

  create(context) {
    const cwd = process.cwd();
    const heuristics = loadHeuristics(cwd);
    const projectConfig = loadUXLintConfig(cwd);

    const sourceCode = context.sourceCode;
    const filename = context.filename;

    const store = new MultiNodeFactStore(filename);
    const jsxCollector = createJSXFormCollector(store, projectConfig);

    function applySingleNodeHeuristics(node: any) {
      const signals = makeSignals({ node, sourceCode, filename });

      for (const h of heuristics) {
        if (!h.appliesTo.includes(node.type)) continue;

        const match = evalExpr(signals, h.when as Expr);
        if (match !== true) continue;
        if (h.severity === "off") continue;

        context.report({
          node,
          messageId: "uxFinding",
          data: {
            message: `[${h.id}] ${h.report.message}`,
          },
        });
      }
    }

    return {
      JSXOpeningElement(node: any) {
        applySingleNodeHeuristics(node);
      },

      JSXElement(node: any) {
        jsxCollector.JSXElement(node);
      },

      "JSXElement:exit"(node: any) {
        jsxCollector["JSXElement:exit"](node);
      },

      "Program:exit"() {
        const findings = evaluateFormHasSubmitButNoErrorState(store.getForms());

        for (const finding of findings) {
          context.report({
            node: finding.node,
            messageId: "uxFinding",
            data: { message: finding.message },
          });
        }
      },
    };
  },
};

export default rule;