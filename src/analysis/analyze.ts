// Runs the whole UXLint pipeline for one file and returns its findings,
// tagged with the ESLint rule each one belongs to.
//
// The plugin exposes one ESLint rule per built-in finding id so teams can set
// severity, filter in an editor, and suppress per rule. Those rules all need
// the same expensive analysis — collectors, multi-file tracing, evaluators —
// so it runs once per file and is cached on the Program node, which every
// rule sees the same instance of.

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
import { evaluateAsyncCollectionSources } from "../interactions/evaluators/data-states";
import { InteractionStore } from "../interactions/store";

// Rule keys for the findings that are not a built-in pack finding.
export const CUSTOM_RULE_KEY = "custom";
export const CONFIG_ERROR_RULE_KEY = "config-error";

export type AnalyzedFinding = {
  // ESLint rule this finding belongs to, without the `uxlint/` prefix.
  ruleKey: string;
  node: any;
  message: string;
};

const BUILTIN_FINDING_ID_PATTERN = /^\[([A-Z0-9-]+)\]\s*/;

// The finding id verbatim in lower case: INPUT-DATE-002 -> input-date-002.
// Deliberately mechanical. Trimming the trailing -001 would read better on
// the single-member families but would make INPUT-DATE-001 and
// INPUT-DATE-002 collapse into inconsistent names.
export function ruleKeyForFindingId(findingId: string): string {
  return findingId.toLowerCase();
}

const analysisCache = new WeakMap<object, AnalyzedFinding[]>();

// Depth-first walk with enter and exit, mirroring the traversal the collectors
// used to get from ESLint. Exit is needed for form scoping.
function walkTree(
  node: any,
  enter: (node: any) => void,
  exit: (node: any) => void,
) {
  if (!node || typeof node.type !== "string") return;

  enter(node);

  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;

    const value = node[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object") walkTree(entry, enter, exit);
      }
      continue;
    }

    if (value && typeof value === "object") walkTree(value, enter, exit);
  }

  exit(node);
}

function runAnalysis(context: Rule.RuleContext): AnalyzedFinding[] {
  const cwd = context.cwd ?? process.cwd();
  const {
    rules: heuristics,
    config: projectConfig,
    configPath,
    configError,
  } = loadUXLintFile(cwd);

  const sourceCode = context.sourceCode;
  const filename = context.filename;
  // Resolve against the same cwd as projectRoot so the tracer's same-project
  // checks compare paths in one consistent form.
  const absoluteFilename = path.resolve(cwd, filename);

  const findings: AnalyzedFinding[] = [];

  if (configError) {
    findings.push({
      ruleKey: CONFIG_ERROR_RULE_KEY,
      node: sourceCode.ast,
      message: `[UXLINT-CONFIG-001] Could not load ${configPath}: ${configError}. DSL rules and design-system config are disabled until the file loads.`,
    });
  }

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

  function addBuiltinFinding(finding: { node: any; message: string }) {
    const idMatch = BUILTIN_FINDING_ID_PATTERN.exec(finding.message);
    if (!idMatch) return;

    const findingId = idMatch[1];
    const override = resolveBuiltinRuleOverride(projectConfig, findingId);
    if (!override.enabled) return;

    findings.push({
      ruleKey: ruleKeyForFindingId(findingId),
      node: finding.node,
      message: override.message
        ? `[${findingId}] ${override.message}`
        : finding.message,
    });
  }

  function addFactScopeFindings<T>(
    scope: string,
    items: T[],
    toSignals: (item: T) => Record<string, unknown>,
    toNode: (item: T) => any,
  ) {
    const scopedHeuristics = heuristics.filter(
      (heuristic) =>
        heuristic.appliesTo.includes(scope) && heuristic.severity !== "off",
    );
    if (scopedHeuristics.length === 0) return;

    for (const item of items) {
      const signals = toSignals(item);

      for (const heuristic of scopedHeuristics) {
        if (evalExpr(signals, heuristic.when as Expr) !== true) continue;

        findings.push({
          ruleKey: CUSTOM_RULE_KEY,
          node: toNode(item),
          message: `[${heuristic.id}] ${heuristic.report.message}`,
        });
      }
    }
  }

  function addSingleNodeFindings(node: any) {
    const signals = makeSignals({ node, sourceCode, filename });

    for (const heuristic of heuristics) {
      if (!heuristic.appliesTo.includes(node.type)) continue;
      if (heuristic.severity === "off") continue;
      if (evalExpr(signals, heuristic.when as Expr) !== true) continue;

      findings.push({
        ruleKey: CUSTOM_RULE_KEY,
        node,
        message: `[${heuristic.id}] ${heuristic.report.message}`,
      });
    }
  }

  walkTree(
    sourceCode.ast,
    (node) => {
      switch (node.type) {
        case "JSXOpeningElement":
          addSingleNodeFindings(node);
          break;
        case "JSXElement":
          jsxCollector.JSXElement(node);
          inputControlsCollector.JSXElement(node);
          toggleControlsCollector.JSXElement(node);
          splitButtonsCollector.JSXElement(node);
          break;
        case "FunctionDeclaration":
          componentStateCollector.FunctionDeclaration(node);
          break;
        case "VariableDeclarator":
          componentStateCollector.VariableDeclarator(node);
          break;
        default:
          break;
      }
    },
    (node) => {
      if (node.type === "JSXElement") {
        jsxCollector["JSXElement:exit"](node);
      }
    },
  );

  const forms = store.getForms();
  const inputControls = store.getInputControls();
  const labels = store.getLabels();
  const toggleControls = store.getToggleControls();
  const splitButtons = store.getSplitButtons();
  const interactionFacts = collectInteractionFacts(interactionStore);

  for (const finding of evaluateFormHasSubmitButNoErrorState(
    forms,
    interactionFacts,
  )) {
    addBuiltinFinding(finding);
  }

  for (const finding of evaluateInputControls(inputControls, labels)) {
    addBuiltinFinding(finding);
  }

  for (const finding of evaluateToggleControls(toggleControls, forms)) {
    addBuiltinFinding(finding);
  }

  for (const finding of evaluateSplitButtons(splitButtons)) {
    addBuiltinFinding(finding);
  }

  for (const finding of evaluateInteractionFactFindings(interactionFacts)) {
    addBuiltinFinding(finding);
  }

  for (const component of interactionStore.getComponents()) {
    for (const finding of evaluateAsyncCollectionSources(
      component.asyncCollectionSources,
    )) {
      addBuiltinFinding(finding);
    }
  }

  addFactScopeFindings(
    "InputControl",
    inputControls,
    (control) => makeInputControlSignals(control, labels, filename),
    (control) => control.node,
  );

  addFactScopeFindings(
    "Form",
    forms,
    (form) => makeFormSignals(form, filename),
    (form) => form.node,
  );

  addFactScopeFindings(
    "ToggleControl",
    toggleControls,
    (toggle) => makeToggleControlSignals(toggle, forms, filename),
    (toggle) => toggle.node,
  );

  addFactScopeFindings(
    "SplitButton",
    splitButtons,
    (splitButton) => makeSplitButtonSignals(splitButton, filename),
    (splitButton) => splitButton.node,
  );

  addFactScopeFindings(
    "Interaction",
    interactionFacts,
    (fact) => makeInteractionSignals(fact, filename),
    (fact) => fact.node,
  );

  return findings;
}

export function analyzeFile(context: Rule.RuleContext): AnalyzedFinding[] {
  const program = context.sourceCode.ast as unknown as object;

  const cached = analysisCache.get(program);
  if (cached) return cached;

  const findings = runAnalysis(context);
  analysisCache.set(program, findings);
  return findings;
}
