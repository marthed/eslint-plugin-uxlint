import path from "node:path";
import type { Rule } from "eslint";
import {
  loadUXLintFile,
  resolveBuiltinRuleOverride,
} from "../shared/rules-loader";
import { createComponentVocabulary } from "../shared/design-system";
import { makeSignals } from "../shared/signals";
import { evalExpr, type Expr } from "../shared/dsl";

import { StructureFactStore } from "../structure/fact-store";
import { createJSXFormCollector } from "../structure/collectors/jsx-forms";
import { evaluateFormHasSubmitButNoErrorState } from "../structure/evaluators/form-submit-without-error";
import { createJSXInputControlsCollector } from "../structure/collectors/jsx-input-controls";
import { evaluateInputControls } from "../structure/evaluators/input-controls";
import { createJSXToggleControlsCollector } from "../structure/collectors/jsx-toggle-controls";
import { evaluateToggleControls } from "../structure/evaluators/toggle-controls";
import { createJSXSplitButtonsCollector } from "../structure/collectors/jsx-split-buttons";
import { evaluateSplitButtons } from "../structure/evaluators/split-buttons";
import { makeInputControlSignals } from "../structure/input-control-signals";
import { makeFormSignals } from "../structure/form-signals";
import { makeToggleControlSignals } from "../structure/toggle-control-signals";
import { makeSplitButtonSignals } from "../structure/split-button-signals";
import { createComponentStateCollector } from "../interactions/collectors/component-state";
import {
  collectInteractionFacts,
  evaluateInteractionFactFindings,
} from "../interactions/evaluators/interaction-feedback";
import { makeInteractionSignals } from "../interactions/interaction-signals";
import { InteractionStore } from "../interactions/store";

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Apply UX heuristics defined in uxlint rules and structural evaluators",
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

    const store = new StructureFactStore(filename);
    const jsxCollector = createJSXFormCollector(store, projectConfig);
    const inputControlsCollector = createJSXInputControlsCollector(
      store,
      projectConfig,
    );
    const toggleControlsCollector = createJSXToggleControlsCollector(
      store,
      projectConfig,
    );
    const splitButtonsCollector = createJSXSplitButtonsCollector(
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
        vocabulary: createComponentVocabulary(projectConfig.designSystem),
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

    function applyFactScopeHeuristics<T>(
      scope: string,
      items: T[],
      toSignals: (item: T) => Record<string, unknown>,
      toNode: (item: T) => any,
    ) {
      const scopedHeuristics = heuristics.filter(
        (h) => h.appliesTo.includes(scope) && h.severity !== "off",
      );
      if (scopedHeuristics.length === 0) return;

      for (const item of items) {
        const signals = toSignals(item);

        for (const h of scopedHeuristics) {
          if (evalExpr(signals, h.when as Expr) !== true) continue;

          context.report({
            node: toNode(item),
            messageId: "uxFinding",
            data: {
              message: `[${h.id}] ${h.report.message}`,
            },
          });
        }
      }
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
        toggleControlsCollector.JSXElement(node);
        splitButtonsCollector.JSXElement(node);
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
        const forms = store.getForms();
        const inputControls = store.getInputControls();
        const labels = store.getLabels();
        const toggleControls = store.getToggleControls();
        const splitButtons = store.getSplitButtons();
        const interactionFacts = collectInteractionFacts(interactionStore);

        const structureFindings = evaluateFormHasSubmitButNoErrorState(
          forms,
          interactionFacts,
        );
        for (const finding of structureFindings) {
          reportBuiltinFinding(finding);
        }

        const inputControlFindings = evaluateInputControls(
          inputControls,
          labels,
        );
        for (const finding of inputControlFindings) {
          reportBuiltinFinding(finding);
        }

        const toggleFindings = evaluateToggleControls(toggleControls, forms);
        for (const finding of toggleFindings) {
          reportBuiltinFinding(finding);
        }

        const splitButtonFindings = evaluateSplitButtons(splitButtons);
        for (const finding of splitButtonFindings) {
          reportBuiltinFinding(finding);
        }

        const interactionFindings =
          evaluateInteractionFactFindings(interactionFacts);
        for (const finding of interactionFindings) {
          reportBuiltinFinding(finding);
        }

        applyFactScopeHeuristics(
          "InputControl",
          inputControls,
          (control) => makeInputControlSignals(control, labels, filename),
          (control) => control.node,
        );

        applyFactScopeHeuristics(
          "Form",
          forms,
          (form) => makeFormSignals(form, filename),
          (form) => form.node,
        );

        applyFactScopeHeuristics(
          "ToggleControl",
          toggleControls,
          (toggle) => makeToggleControlSignals(toggle, forms, filename),
          (toggle) => toggle.node,
        );

        applyFactScopeHeuristics(
          "SplitButton",
          splitButtons,
          (splitButton) => makeSplitButtonSignals(splitButton, filename),
          (splitButton) => splitButton.node,
        );

        applyFactScopeHeuristics(
          "Interaction",
          interactionFacts,
          (fact) => makeInteractionSignals(fact, filename),
          (fact) => fact.node,
        );
      },
    };
  },
};

export default rule;
