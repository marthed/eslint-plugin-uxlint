import type { Rule } from "eslint";
import { loadHeuristics, loadUXLintConfig } from "../shared/rules-loader";
import { makeSignals } from "../shared/signals";
import { evalExpr, type Expr } from "../shared/dsl";

import { MultiNodeFactStore } from "../multi/fact-store";
import { createJSXFormCollector } from "../multi/collectors/jsx-forms";
import { evaluateFormHasSubmitButNoErrorState } from "../multi/evaluators/form-submit-without-error";
import { InteractionStore } from "../interactions/store";
import { createEventSourceCollector } from "../interactions/collectors/event-sources";
import { createAsyncHandlerCollector } from "../interactions/collectors/local-state";
import { createLoadingFeedbackCollector } from "../interactions/collectors/loading-feedback";
import { evaluateAsyncNoLoading } from "../interactions/evaluators/async-no-loading";

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

    const eventSourceCollector = createEventSourceCollector(interactionStore);
    const asyncHandlerCollector = createAsyncHandlerCollector(interactionStore);
    const loadingFeedbackCollector =
      createLoadingFeedbackCollector(interactionStore);

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
        loadingFeedbackCollector.JSXOpeningElement(node);
      },

      JSXElement(node: any) {
        jsxCollector.JSXElement(node);
      },

      "JSXElement:exit"(node: any) {
        jsxCollector["JSXElement:exit"](node);
      },

      JSXText(node: any) {
        loadingFeedbackCollector.JSXText(node);
      },

      FunctionDeclaration(node: any) {
        asyncHandlerCollector.FunctionDeclaration(node);
      },

      VariableDeclarator(node: any) {
        asyncHandlerCollector.VariableDeclarator(node);
      },

      "Program:exit"() {
        const formFindings = evaluateFormHasSubmitButNoErrorState(
          store.getForms(),
        );
        for (const finding of formFindings) {
          context.report({
            node: finding.node,
            messageId: "uxFinding",
            data: { message: finding.message },
          });
        }

        const interactionFindings = evaluateAsyncNoLoading(interactionStore);

        // TEMP DEBUG
        context.report({
          loc: { line: 1, column: 0 },
          messageId: "uxFinding",
          data: {
            message:
              `[DEBUG] sources=${interactionStore.getSources().length}, ` +
              `handlers=${interactionStore.getHandlers().length}, ` +
              `loadingFeedback=${interactionStore.getLoadingFeedback().length}, ` +
              `interactionFindings=${interactionFindings.length}`,
          },
        });

        context.report({
          loc: { line: 1, column: 0 },
          messageId: "uxFinding",
          data: {
            message:
              `[DEBUG NAMES] handlers=` +
              interactionStore
                .getHandlers()
                .map((h) => h.name)
                .join(", "),
          },
        });
        context.report({
          loc: { line: 1, column: 0 },
          messageId: "uxFinding",
          data: {
            message:
              `[DEBUG SOURCES] sourceHandlers=` +
              interactionStore
                .getSources()
                .map((s) => s.handlerName ?? "inline/none")
                .join(", "),
          },
        });

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
