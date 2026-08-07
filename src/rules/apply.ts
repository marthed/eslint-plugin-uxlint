import path from "node:path";
import type { Rule } from "eslint";
import {
  loadUXLintFile,
  resolveBuiltinRuleOverride,
} from "../shared/rules-loader";
import { makeSignals } from "../shared/signals";
import { evalExpr, type Expr } from "../shared/dsl";

import { MultiNodeFactStore } from "../multi/fact-store";
import { createJSXFormCollector } from "../multi/collectors/jsx-forms";
import { evaluateFormHasSubmitButNoErrorState } from "../multi/evaluators/form-submit-without-error";
import { createJSXInputControlsCollector } from "../multi/collectors/jsx-input-controls";
import { evaluateInputControls } from "../multi/evaluators/input-controls";
import { createComponentStateCollector } from "../interactions/collectors/component-state";
import { evaluateInteractionFeedback } from "../interactions/evaluators/interaction-feedback";
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
    const cwd = context.cwd ?? process.cwd();
    const {
      rules: heuristics,
      config: projectConfig,
      configPath,
      configError,
    } = loadUXLintFile(cwd);

    const sourceCode = context.sourceCode;
    const filename = context.filename;
    // Resolve against the same cwd as projectRoot so the tracer's
    // same-project checks compare paths in one consistent form.
    const absoluteFilename = path.resolve(cwd, filename);

    const store = new MultiNodeFactStore(filename);
    const jsxCollector = createJSXFormCollector(store, projectConfig);
    const inputControlsCollector = createJSXInputControlsCollector(
      store,
      projectConfig,
    );

    const interactionStore = new InteractionStore();

    const componentStateCollector = createComponentStateCollector(
      interactionStore,
      {
        filePath: absoluteFilename,
        parser: (context as any).languageOptions?.parser,
        parserOptions: (context as any).languageOptions?.parserOptions,
        projectRoot: cwd,
      },
    );

    const builtinFindingIdPattern = /^\[([A-Z0-9-]+)\]\s*/;

    function reportBuiltinFinding(finding: { node: any; message: string }) {
      let message = finding.message;

      const idMatch = builtinFindingIdPattern.exec(message);
      if (idMatch) {
        const override = resolveBuiltinRuleOverride(projectConfig, idMatch[1]);
        if (!override.enabled) return;
        if (override.message) {
          message = `[${idMatch[1]}] ${override.message}`;
        }
      }

      context.report({
        node: finding.node,
        messageId: "uxFinding",
        data: { message },
      });
    }

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
      Program(node: any) {
        if (configError) {
          context.report({
            node,
            messageId: "uxFinding",
            data: {
              message: `[UXLINT-CONFIG-001] Could not load ${configPath}: ${configError}. DSL rules and design-system config are disabled until the file loads.`,
            },
          });
        }
      },

      JSXOpeningElement(node: any) {
        applySingleNodeHeuristics(node);
      },

      JSXElement(node: any) {
        jsxCollector.JSXElement(node);
        inputControlsCollector.JSXElement(node);
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
        const multiNodeFindings = evaluateFormHasSubmitButNoErrorState(
          store.getForms(),
        );
        for (const finding of multiNodeFindings) {
          reportBuiltinFinding(finding);
        }

        const inputControlFindings = evaluateInputControls(
          store.getInputControls(),
          store.getLabels(),
        );
        for (const finding of inputControlFindings) {
          reportBuiltinFinding(finding);
        }

        const interactionFindings =
          evaluateInteractionFeedback(interactionStore);

        for (const finding of interactionFindings) {
          reportBuiltinFinding(finding);
        }
      },
    };
  },
};

export default rule;
