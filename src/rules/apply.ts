import type { Rule } from "eslint";
import { loadHeuristics, loadUXLintConfig } from "../shared/rules-loader";
import { makeSignals } from "../shared/signals";
import { evalExpr, type Expr } from "../shared/dsl";

import { MultiNodeFactStore } from "../multi/fact-store";
import { createJSXFormCollector } from "../multi/collectors/jsx-forms";
import { createComponentStateCollector } from "../interactions/collectors/component-state";
import { createEventSourceCollector } from "../interactions/collectors/event-sources";
import { evaluateAsyncNoLoading } from "../interactions/evaluators/async-no-loading";
import { InteractionStore } from "../interactions/store";

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Apply UX heuristics defined in uxlint rules and multi-node evaluators",
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

    const interactionStore = new InteractionStore();

    const componentStateCollector =
      createComponentStateCollector(interactionStore);

    const eventSourceCollector = createEventSourceCollector(interactionStore);

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
        eventSourceCollector.JSXOpeningElement(node);
      },

      JSXElement(node: any) {
        jsxCollector.JSXElement(node);
      },

      "JSXElement:exit"(node: any) {
        jsxCollector["JSXElement:exit"](node);
      },

      FunctionDeclaration(node: any) {
        componentStateCollector.FunctionDeclaration(node);
      },

      VariableDeclarator(node: any) {
        componentStateCollector.VariableDeclarator(node);
      },

      "Program:exit"() {
        const interactionFindings = evaluateAsyncNoLoading(interactionStore);
        for (const finding of interactionFindings) {
          context.report({
            node: finding.node,
            messageId: "uxFinding",
            data: { message: finding.message },
          });
        }

        // TEMP DEBUG
        // context.report({
        //   loc: { line: 1, column: 0 },
        //   messageId: "uxFinding",
        //   data: {
        //     message:
        //       `[DEBUG] sources=${interactionStore.getSources().length}, ` +
        //       `handlers=${interactionStore.getHandlers().length}, ` +
        //       `loadingFeedback=${interactionStore.getLoadingFeedback().length}, ` +
        //       `interactionFindings=${interactionFindings.length}`,
        //   },
        // });

        // context.report({
        //   loc: { line: 1, column: 0 },
        //   messageId: "uxFinding",
        //   data: {
        //     message:
        //       `[DEBUG NAMES] handlers=` +
        //       interactionStore
        //         .getHandlers()
        //         .map((h) => h.name)
        //         .join(", "),
        //   },
        // });
        // context.report({
        //   loc: { line: 1, column: 0 },
        //   messageId: "uxFinding",
        //   data: {
        //     message:
        //       `[DEBUG SOURCES] sourceHandlers=` +
        //       interactionStore
        //         .getSources()
        //         .map((s) => s.handlerName ?? "inline/none")
        //         .join(", "),
        //   },
        // });

        for (const finding of interactionFindings) {
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
